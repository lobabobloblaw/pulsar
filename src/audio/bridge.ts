/* pulsar — the UI<->audio boundary (plan C3).
 *
 * `createAudioBridge()` now returns the REAL bridge: an `EngineHandle` (AudioContext
 * + worklet + SAB-or-postMessage transport), a `LiveScheduler` producing the canonical
 * register sequences, and an AnalyserNode tap that fills `meter` and `scope` inside
 * the app's single rAF. The stub is still here and still reachable with `?stub`,
 * because a shell that can boot with no audio thread is worth keeping.
 *
 * Nothing in `src/ui`, `src/state` or `src/input` changed for the swap — which was
 * the point of the contract. What crosses this file:
 *   - native units in (see audio/params.ts); the register mapping is ours, and it
 *     lives in host/paramMapping.ts
 *   - noteOn/noteOff/setParam are synchronous, allocation-free, fire-and-forget
 *     (they are called at keydown, glissando and pointermove rate)
 *   - the UI holds the authoritative optimistic copy and NEVER reads values back
 *   - `meter` and `scope` are preallocated ONCE and read only inside the rAF
 *   - `start()` must be called from a user gesture (the boot keydown)
 *
 * URL flags, both test affordances, both harmless in production:
 *   ?stub  the synthetic bridge — the shell with no audio thread at all
 *   ?pm    force the postMessage transport even on an isolated page, so the
 *          fallback can be exercised without touching COOP/COEP headers
 */

import { PARAMS, type ParamId } from './params'
import { sabAvailable, startEngine, type EngineHandle } from './host/audioEngine'
import { LiveScheduler } from './host/liveScheduler'
import { newDiagnostics, type Diagnostics, type MutableDiagnostics } from './host/diagnostics'

export type BridgeState = 'idle' | 'starting' | 'running' | 'error'

export interface BridgeStatus {
  readonly state: BridgeState
  readonly sampleRate: number
  readonly crossOriginIsolated: boolean
  readonly transport: 'sab' | 'postMessage'
  readonly baseLatencyMs: number
  readonly error?: string
}

export interface AudioBridge {
  readonly status: BridgeStatus
  /** MUST be called from a user gesture (the boot keydown). */
  start(): Promise<void>
  noteOn(note: number, velocity: number, channel?: number): void
  noteOff(note: number, channel?: number): void
  allNotesOff(): void
  /** NATIVE units; the audio side owns the register mapping. */
  setParam(id: ParamId, value: number): void
  /** [rmsL, peakL, rmsR, peakR], 0..1. Read in rAF ONLY. */
  readonly meter: Float32Array
  /** 256 samples, -1..1. Read in rAF ONLY. */
  readonly scope: Float32Array
  subscribe(fn: (s: BridgeStatus) => void): () => void
  /** Pumped once per frame by App's single rAF. The real bridge copies from its
   *  AnalyserNode tap into the same preallocated arrays and pumps the scheduler's
   *  adaptive-lead controller. Allocation-free either way. */
  tick(nowMs: number): void
  dispose(): void
}

/** What the stub last did — surfaced in the dev chip so the shell is verifiably
 *  wired end to end without audible output. Not part of the real contract. */
export interface StubAction {
  kind: 'none' | 'start' | 'noteOn' | 'noteOff' | 'allNotesOff' | 'setParam'
  detail: string
  at: number
}

export const SCOPE_LENGTH = 256

/** 512 samples is 10.7 ms at 48 kHz: two full 256-sample scope traces of headroom and
 *  a meter window long enough to be steady, short enough to still feel live. */
const ANALYSER_FFT_SIZE = 512

/** Diagnostics poll, 10 Hz (plan B1 M3). A bridge-internal timer rather than work in
 *  the rAF: the frame loop must not write $state, and 10 Hz is not a frame rate. */
const DIAGNOSTICS_INTERVAL_MS = 100

/** The worklet publishes its clock anchor from the first `process()`. If that has not
 *  happened within this budget the audio thread never ran and nothing will sound. */
const READY_TIMEOUT_MS = 3000

function urlFlag(name: string): boolean {
  if (typeof location === 'undefined') return false
  try {
    return new URLSearchParams(location.search).has(name)
  } catch {
    return false
  }
}

function initialParamValues(): Record<ParamId, number> {
  const out = {} as Record<ParamId, number>
  for (const id of Object.keys(PARAMS) as ParamId[]) out[id] = PARAMS[id].default
  return out
}

function isolated(): boolean {
  return typeof crossOriginIsolated === 'boolean' ? crossOriginIsolated : false
}

// --- the real bridge ---------------------------------------------------------------

class RealBridge implements AudioBridge {
  readonly meter = new Float32Array(4)
  readonly scope = new Float32Array(SCOPE_LENGTH)

  #status: BridgeStatus
  #subs = new Set<(s: BridgeStatus) => void>()

  #engine: EngineHandle | null = null
  #scheduler: LiveScheduler | null = null
  #analyser: AnalyserNode | null = null
  /** Time-domain staging for the analyser. Allocated once, at start(). The buffer
   *  type is pinned: `getFloatTimeDomainData` will not take a SharedArrayBuffer view. */
  #tap: Float32Array<ArrayBuffer> | null = null
  #startPromise: Promise<void> | null = null
  #diagTimer: ReturnType<typeof setInterval> | null = null
  #disposed = false

  /** The last value every parameter was set to, in native units. Seeded from the
   *  registry defaults so a bridge that has not started yet still has an answer, and
   *  kept current because `params.attach()` pushes all four values BEFORE `start()`
   *  can resolve — they would otherwise be lost. */
  readonly #values: Record<ParamId, number> = initialParamValues()

  /** Our own copy of the engine's diagnostics. `engine.diagnostics()` returns a
   *  REUSED object; fields get copied out of it here and the reference is dropped. */
  readonly #diag: MutableDiagnostics

  readonly #forcePostMessage: boolean

  constructor(opts: { forcePostMessage?: boolean } = {}) {
    this.#forcePostMessage = opts.forcePostMessage === true
    const transport = this.#forcePostMessage || !sabAvailable() ? 'postMessage' : 'sab'
    this.#diag = newDiagnostics(transport)
    this.#status = {
      state: 'idle',
      sampleRate: 0,
      crossOriginIsolated: isolated(),
      transport,
      baseLatencyMs: 0,
    }
  }

  get status(): BridgeStatus {
    return this.#status
  }

  /** The live engine, for the headless harness and the dev hook. Not part of the
   *  AudioBridge contract — the UI must never reach past this file. */
  get engine(): EngineHandle | null {
    return this.#engine
  }

  /** A copy, refreshed by the 10 Hz poll. Safe to hold, unlike the engine's. */
  get diagnostics(): Diagnostics {
    return this.#diag
  }

  /** Idempotent: the first call owns the start, every later one waits on it. Resolves
   *  once the context is running AND the worklet has published its clock anchor, so a
   *  note played immediately after it lands on a real timeline. */
  start(): Promise<void> {
    if (this.#disposed) return Promise.resolve()
    const pending = this.#startPromise
    if (pending !== null) return pending
    const run = this.#run()
    this.#startPromise = run
    return run
  }

  async #run(): Promise<void> {
    this.#publish({ ...this.#status, state: 'starting' })
    let engine: EngineHandle | null = null
    try {
      engine = await startEngine(this.#forcePostMessage ? { forcePostMessage: true } : {})
      if (this.#disposed) {
        void engine.dispose()
        return
      }
      this.#engine = engine

      // The scheduler starts from whatever the knobs already say — the UI has been
      // authoritative since before the audio thread existed.
      const scheduler = new LiveScheduler(engine, {
        duty: this.#values['pulse1.duty'],
        volume: this.#values['pulse1.envDecay'],
      })
      this.#scheduler = scheduler

      // The tap: one analyser, fed from the worklet node. It needs no output
      // connection — an AnalyserNode captures whatever reaches its input.
      const analyser = engine.ctx.createAnalyser()
      analyser.fftSize = ANALYSER_FFT_SIZE
      analyser.smoothingTimeConstant = 0
      engine.node.connect(analyser)
      this.#analyser = analyser
      this.#tap = new Float32Array(analyser.fftSize)

      // Flush every buffered parameter through the real mapping. duty and level were
      // seeded above; sweep and master gain need their write / config message.
      for (const id of Object.keys(this.#values) as ParamId[]) {
        scheduler.setParam(id, this.#values[id])
      }

      engine.ctx.onstatechange = (): void => {
        this.#onContextState()
      }

      const anchor = await Promise.race([
        engine.ready(),
        new Promise<null>((r) => setTimeout(() => r(null), READY_TIMEOUT_MS)),
      ])
      if (this.#disposed) return
      if (anchor === null) throw new Error('the audio worklet never rendered')

      this.#diagTimer = setInterval(() => {
        this.#poll()
      }, DIAGNOSTICS_INTERVAL_MS)
      this.#poll()
      this.#publish(this.#statusFor('running'))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.#teardown()
      if (engine !== null) void engine.dispose().catch(() => {})
      this.#engine = null
      this.#startPromise = null // a later gesture may retry
      this.#publish({ ...this.#status, state: 'error', error: message })
    }
  }

  noteOn(note: number, velocity: number, _channel = 0): void {
    const s = this.#scheduler
    if (s === null) return
    s.noteOn(note, velocity)
  }

  noteOff(note: number, _channel = 0): void {
    const s = this.#scheduler
    if (s === null) return
    s.noteOff(note)
  }

  allNotesOff(): void {
    const s = this.#scheduler
    if (s === null) return
    s.allNotesOff()
  }

  /** Native units. Remembered even before the engine exists, so the knobs' state
   *  survives the gap between page load and the first gesture. */
  setParam(id: ParamId, value: number): void {
    if (!(id in this.#values)) return
    this.#values[id] = value
    const s = this.#scheduler
    if (s === null) return
    s.setParam(id, value)
  }

  subscribe(fn: (s: BridgeStatus) => void): () => void {
    this.#subs.add(fn)
    fn(this.#status)
    return () => {
      this.#subs.delete(fn)
    }
  }

  /** One frame's worth of work, allocation-free: copy the analyser window into the
   *  preallocated staging array, reduce it to rms/peak, hand the newest 256 samples
   *  to the scope, and pump the adaptive-lead controller. */
  tick(_nowMs: number): void {
    const s = this.#scheduler
    if (s !== null) s.tick()

    const analyser = this.#analyser
    const tap = this.#tap
    const meter = this.meter
    const scope = this.scope
    if (analyser === null || tap === null) {
      if (meter[1] !== 0) meter.fill(0)
      if (scope[0] !== 0) scope.fill(0)
      return
    }

    analyser.getFloatTimeDomainData(tap)

    const n = tap.length
    let sum = 0
    let peak = 0
    for (let i = 0; i < n; i++) {
      const v = tap[i]
      sum += v * v
      const a = v < 0 ? -v : v
      if (a > peak) peak = a
    }
    const rms = Math.sqrt(sum / n)
    if (peak > 1) peak = 1
    // Mono engine (outputChannelCount [1]): both sides carry the same signal, and
    // saying otherwise would be a decorative lie in a status readout.
    meter[0] = rms
    meter[1] = peak
    meter[2] = rms
    meter[3] = peak

    // The newest SCOPE_LENGTH samples: the analyser hands back its window oldest
    // first, so the freshest audio is at the end.
    const from = n - SCOPE_LENGTH
    for (let i = 0; i < SCOPE_LENGTH; i++) scope[i] = tap[from + i]
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    const engine = this.#engine
    this.#teardown()
    this.#engine = null
    this.#subs.clear()
    if (engine !== null) void engine.dispose().catch(() => {})
  }

  // --- internals -------------------------------------------------------------------

  #teardown(): void {
    if (this.#diagTimer !== null) {
      clearInterval(this.#diagTimer)
      this.#diagTimer = null
    }
    const s = this.#scheduler
    const engine = this.#engine
    if (s !== null && engine !== null && engine.ctx.state === 'running') s.allNotesOff()
    this.#scheduler = null
    this.#analyser = null
    this.#tap = null
    this.meter.fill(0)
    this.scope.fill(0)
    if (engine !== null) engine.ctx.onstatechange = null
  }

  /** 10 Hz. Copies the engine's reused snapshot into ours and republishes the status
   *  only when something the UI shows actually moved — the chips must be truthful,
   *  not chatty. */
  #poll(): void {
    const engine = this.#engine
    if (engine === null) return
    const d = engine.diagnostics()
    const own = this.#diag
    own.transport = d.transport
    own.baseLatencyMs = d.baseLatencyMs
    own.outputLatencyMs = d.outputLatencyMs
    own.leadMs = d.leadMs
    own.lateWrites = d.lateWrites
    own.droppedWrites = d.droppedWrites
    own.underruns = d.underruns
    own.peakProcessUs = d.peakProcessUs
    own.dspLoadPct = d.dspLoadPct
    own.sampleRate = d.sampleRate

    const next = this.#statusFor(this.#status.state === 'error' ? 'error' : 'running')
    const cur = this.#status
    if (
      next.state !== cur.state ||
      next.sampleRate !== cur.sampleRate ||
      next.transport !== cur.transport ||
      next.baseLatencyMs !== cur.baseLatencyMs ||
      next.crossOriginIsolated !== cur.crossOriginIsolated
    ) {
      this.#publish(next)
    }
  }

  /** The browser can suspend a context out from under us (device change, sleep).
   *  Resume it ourselves: the page already has its gesture, and the StatusBar's start
   *  affordance is one-shot, so waiting for another click would strand the user. */
  #onContextState(): void {
    const engine = this.#engine
    if (engine === null || this.#disposed) return
    const state = engine.ctx.state
    if (state === 'running') {
      this.#publish(this.#statusFor('running'))
      return
    }
    if (state === 'closed') return
    this.#publish(this.#statusFor('starting'))
    void engine.ctx.resume().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      this.#publish({ ...this.#statusFor('error'), error: message })
    })
  }

  #statusFor(state: BridgeState): BridgeStatus {
    const engine = this.#engine
    return {
      state,
      sampleRate: engine === null ? 0 : engine.ctx.sampleRate,
      crossOriginIsolated: isolated(),
      transport: engine === null ? this.#status.transport : engine.transport,
      baseLatencyMs: this.#diag.baseLatencyMs,
    }
  }

  #publish(next: BridgeStatus): void {
    this.#status = next
    for (const fn of this.#subs) fn(next)
  }
}

// --- the stub ----------------------------------------------------------------------

class StubBridge implements AudioBridge {
  readonly meter = new Float32Array(4)
  readonly scope = new Float32Array(SCOPE_LENGTH)

  /** Mutated in place, never reassigned — see `noteOn` for why. */
  lastAction: StubAction = { kind: 'none', detail: '', at: 0 }

  #status: BridgeStatus = {
    state: 'idle',
    sampleRate: 0,
    crossOriginIsolated: isolated(),
    transport: sabAvailable() ? 'sab' : 'postMessage',
    baseLatencyMs: 0,
  }
  #subs = new Set<(s: BridgeStatus) => void>()
  #held = new Set<number>()
  #phase = 0
  #lastTick = 0
  #env = 0

  get status(): BridgeStatus {
    return this.#status
  }

  async start(): Promise<void> {
    if (this.#status.state === 'running' || this.#status.state === 'starting') return
    this.#publish({ ...this.#status, state: 'starting' })
    this.#note('start', 'bridge')
    await Promise.resolve()
    this.#publish({
      ...this.#status,
      state: 'running',
      sampleRate: 48000,
      baseLatencyMs: 2.67,
    })
  }

  noteOn(note: number, velocity: number, channel = 0): void {
    // Allocation-free on the hot path: Set.add of a number does not allocate,
    // and lastAction is mutated rather than replaced. The template literal in
    // #note is the one concession — the stub is not the audio thread.
    this.#held.add(note)
    this.#note('noteOn', `${note}/${velocity}/${channel}`)
  }

  noteOff(note: number, channel = 0): void {
    this.#held.delete(note)
    this.#note('noteOff', `${note}/${channel}`)
  }

  allNotesOff(): void {
    this.#held.clear()
    this.#note('allNotesOff', '')
  }

  setParam(id: ParamId, value: number): void {
    this.#note('setParam', `${id}=${value}`)
  }

  subscribe(fn: (s: BridgeStatus) => void): () => void {
    this.#subs.add(fn)
    fn(this.#status)
    return () => {
      this.#subs.delete(fn)
    }
  }

  /** Synthetic but plausible: a slow breathing level that responds to held
   *  notes, and a ~440 Hz scope trace at the stub's nominal 48 kHz. Enough for
   *  the meter and the scope page to be visibly, verifiably alive. */
  tick(nowMs: number): void {
    const dt = this.#lastTick === 0 ? 16 : Math.min(64, nowMs - this.#lastTick)
    this.#lastTick = nowMs

    if (this.#status.state !== 'running') {
      this.#env += (0 - this.#env) * 0.08
    } else {
      const target = this.#held.size > 0 ? 0.62 : 0.12
      this.#env += (target - this.#env) * (this.#held.size > 0 ? 0.25 : 0.05)
    }

    const breathe = 0.5 + 0.5 * Math.sin(nowMs / 1400)
    const rms = this.#env * (0.7 + 0.3 * breathe)
    const peak = Math.min(1, rms * 1.45)
    this.meter[0] = rms
    this.meter[1] = peak
    this.meter[2] = rms * 0.94
    this.meter[3] = Math.min(1, peak * 0.94)

    // 440 Hz at 48 kHz -> 2*pi*440/48000 rad per sample.
    const inc = (2 * Math.PI * 440) / 48000
    this.#phase = (this.#phase + inc * (dt * 48)) % (2 * Math.PI)
    let p = this.#phase
    const amp = this.#env
    for (let i = 0; i < SCOPE_LENGTH; i++) {
      // A pulse-ish trace, not a pure sine: this is a 2A03, after all.
      const s = Math.sin(p) + 0.32 * Math.sin(3 * p) + 0.16 * Math.sin(5 * p)
      this.scope[i] = amp * s * 0.62
      p += inc
    }
  }

  dispose(): void {
    this.#subs.clear()
    this.#held.clear()
  }

  #note(kind: StubAction['kind'], detail: string): void {
    this.lastAction.kind = kind
    this.lastAction.detail = detail
    this.lastAction.at = performance.now()
  }

  #publish(next: BridgeStatus): void {
    this.#status = next
    for (const fn of this.#subs) fn(next)
  }
}

/** The one construction point. `?stub` keeps the synthetic shell reachable; `?pm`
 *  forces the postMessage transport on a page that could have used the ring. */
export function createAudioBridge(): AudioBridge {
  if (urlFlag('stub')) return new StubBridge()
  return new RealBridge(urlFlag('pm') ? { forcePostMessage: true } : {})
}

/** Module-level singleton: one bridge per document, created lazily so that
 *  importing this module has no side effects. */
let singleton: AudioBridge | null = null

export function bridge(): AudioBridge {
  if (singleton === null) {
    singleton = createAudioBridge()
    // Dev-only handle for the headless harness: transport, diagnostics and the live
    // scope without reaching through Svelte. Never shipped in a build.
    if (import.meta.env.DEV) {
      ;(globalThis as unknown as { __pulsar?: AudioBridge }).__pulsar = singleton
    }
  }
  return singleton
}
