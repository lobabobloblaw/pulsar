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
import { msToCycles } from './timeline/clockMap'
import { NTSC_CPU_HZ } from './core/constants'
import {
  PlaybackCoordinator,
  TrackerDriver,
  type DriverPosition,
  type DriverStats,
  type PlayMode,
} from '../tracker/driver/trackerDriver'
import {
  HIDDEN_PUMP_MS,
  LOOKAHEAD_MS,
  PUMP_MS,
  hiddenLookaheadMs,
} from '../tracker/driver/tempo'
import { buildDpcmImage } from '../tracker/offlineRender'
import { emptySong, type Song } from '../tracker/model/types'
import type { NesCycle, RegAddr, WriteSink } from './timeline/types'

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
  /** Switch the analog output section: NES (HP90→HP440→LP14k) or Famicom (HP37). */
  setConsoleModel(model: 'nes' | 'famicom'): void
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

  // --- phase 2: the tracker transport (design §6.3) --------------------------------
  // Additive only: every phase-1 member above keeps its exact signature and behaviour.

  loadSong(song: Song): void
  play(mode: PlayMode, from?: { order: number; row: number }): void
  stopPlayback(): void
  /** Plain object, mutated in place, read in rAF only — never `$state`. */
  readonly playback: DriverPosition
  /** Driver counters for the `[drv]` chip (§7.2). Null before the engine exists. */
  readonly playbackStats: DriverStats | null
  /** Which channel live input steals while playing (§2.6). */
  setLiveChannel(channel: number): void
  setChannelMute(channel: number, muted: boolean): void
  setEditStep(rows: number): void
  /** Recorded input while playing: returns the row it landed on, or −1. The row is
   *  computed from the input event's OWN engine cycle, so quantization is unaffected
   *  by the 120 ms lookahead — the note lands on the row the player heard themselves
   *  play (§2.6). Null while stopped, where step record uses the cursor instead. */
  readonly recordSink: RecordSink | null
}

export interface RecordSink {
  onNote(note: number, velocity: number): number
  /** The order frame that row belongs to, for the caller that writes the cell. */
  readonly orderIndex: number
}

/** What the stub last did — surfaced in the dev chip so the shell is verifiably
 *  wired end to end without audible output. Not part of the real contract. */
export interface StubAction {
  kind: 'none' | 'start' | 'noteOn' | 'noteOff' | 'allNotesOff' | 'setParam' | 'setConsoleModel'
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

/** The driver is constructed before the AudioContext exists, so `bridge.playback` is a
 *  stable object the grid can read from its very first frame. Until `start()` resolves
 *  the sink swallows writes and the clock reads 0 — and playback cannot begin anyway,
 *  because `play()` awaits `engine.ready()` (the phase-1 polish item §7.2 makes
 *  load-bearing the moment a user hits play on a cold page). */
class DeferredEngine implements WriteSink {
  engine: EngineHandle | null = null

  get clockRate(): number {
    const e = this.engine
    return e === null ? NTSC_CPU_HZ : e.clockRate
  }

  nowCycle(): NesCycle {
    const e = this.engine
    return e === null ? 0 : e.nowCycle()
  }

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.engine?.write(cycle, addr, value)
  }

  flush(): void {
    this.engine?.flush()
  }
}

class RealBridge implements AudioBridge {
  readonly meter = new Float32Array(4)
  readonly scope = new Float32Array(SCOPE_LENGTH)

  /** Tracker transport. The driver exists from construction; the coordinator (Rule L)
   *  needs the LiveScheduler and so appears at `start()`. */
  readonly #timeline = new DeferredEngine()
  readonly #driver = new TrackerDriver(this.#timeline, this.#timeline)
  #coordinator: PlaybackCoordinator | null = null
  #pumpTimer: ReturnType<typeof setInterval> | null = null
  #pumpMs = PUMP_MS
  #lookaheadMs = LOOKAHEAD_MS
  #visibilityHandler: (() => void) | null = null
  #wakeHandler: (() => void) | null = null
  #resumePending = false
  #lastDropped = 0
  /** Bumped by every `play()` and by every `stopPlayback()`. `#playAsync` re-reads it
   *  after each await and abandons the start if it moved — a stop pressed during the
   *  ~100 ms cold-page engine start would otherwise be swallowed and playback would
   *  begin after the user asked for silence. */
  #playSeq = 0
  /** The DPCM image the current song needs, kept because `loadSong` almost always
   *  runs BEFORE the engine exists (the store loads the document at mount; the engine
   *  waits for a gesture). Posted again from `#run()`, or the kit is silent all session. */
  #dpcmMemory: Uint8Array | null = null

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

  /** Survives the gap between page load and the first gesture, exactly like
   *  `#values` — a pre-start toggle would otherwise start the engine as 'nes'. */
  #consoleModel: 'nes' | 'famicom' = 'nes'

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
   *  note played immediately after it lands on a real timeline.
   *
   *  On a LIVE engine a later call is a RESUME, not a re-create: iOS suspends
   *  the context behind the page's back (lock, phone call, Siri, ringer, route
   *  change) and often honours only a gesture-borne resume — and this method is
   *  exactly where the gestures arrive. A one-shot latch here once made the
   *  reappearing start cap a dead button on iOS. */
  start(): Promise<void> {
    if (this.#disposed) return Promise.resolve()
    if (this.#engine !== null) {
      this.#resume()
      return this.#startPromise ?? Promise.resolve()
    }
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
      engine = await startEngine(
        this.#forcePostMessage
          ? { forcePostMessage: true, consoleModel: this.#consoleModel }
          : { consoleModel: this.#consoleModel },
      )
      if (this.#disposed) {
        void engine.dispose()
        return
      }
      this.#engine = engine

      // The song was loaded long before this gesture; its sample memory has to be
      // handed to the freshly built worklet or every DPCM note is silently dropped.
      const dpcm = this.#dpcmMemory
      if (dpcm !== null) engine.node.port.postMessage({ t: 'dpcm', mem: dpcm })

      // The scheduler starts from whatever the knobs already say — the UI has been
      // authoritative since before the audio thread existed.
      const scheduler = new LiveScheduler(engine, {
        duty: this.#values['pulse1.duty'],
        volume: this.#values['pulse1.envDecay'],
      })
      this.#scheduler = scheduler

      // Rule L: two callers, one owner at a time, one ring producer (§2.1/§2.6).
      this.#timeline.engine = engine
      this.#coordinator = new PlaybackCoordinator(this.#timeline, scheduler, this.#driver)

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
      // A model toggle during the async start window would otherwise be silently
      // dropped — startEngine read #consoleModel before the await (finding #6).
      engine.setConfig({ consoleModel: this.#consoleModel })

      engine.ctx.onstatechange = (): void => {
        this.#onContextState()
      }

      // WebKit rarely fires statechange for ITS interruptions — after a lock
      // screen or a phone call the state just sits suspended (or the non-spec
      // 'interrupted'). The reliable wake signals are the page coming back;
      // any one of them may be the moment the audio session is grantable again.
      if (typeof document !== 'undefined') {
        const wake = (): void => {
          if (document.visibilityState !== 'hidden') this.#resume()
        }
        this.#wakeHandler = wake
        document.addEventListener('visibilitychange', wake)
        window.addEventListener('pageshow', wake)
        window.addEventListener('focus', wake)
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

  /** Rule L (§2.6): stopped -> `LiveScheduler` owns the timeline and phase-1 latency
   *  is untouched; playing -> the driver owns it and the note steals the editor's
   *  cursor channel. */
  noteOn(note: number, velocity: number, _channel = 0): void {
    // Note-ons ride real gestures (keydown, pointerdown, MIDI). If iOS
    // silenced the context since the last one, this activation is the one that
    // can legally bring it back — "press any key" stays a true promise.
    this.#gestureKick()
    if (this.#driver.playing) {
      this.#driver.liveNoteOn(this.#driver.liveChannelIndex, note, velocity)
      return
    }
    const s = this.#scheduler
    if (s === null) return
    s.noteOn(note, velocity)
  }

  noteOff(note: number, _channel = 0): void {
    if (this.#driver.playing) {
      this.#driver.liveNoteOff(this.#driver.liveChannelIndex, note)
      return
    }
    const s = this.#scheduler
    if (s === null) return
    s.noteOff(note)
  }

  allNotesOff(): void {
    if (this.#driver.playing) this.#driver.liveAllOff()
    const s = this.#scheduler
    if (s === null) return
    s.allNotesOff()
  }

  // --- phase 2: the tracker transport (design §6.3) ----------------------------------

  get playback(): DriverPosition {
    return this.#driver.position
  }

  get playbackStats(): DriverStats | null {
    return this.#driver.stats
  }

  get recordSink(): RecordSink | null {
    if (!this.#driver.playing) return null
    return this.#record
  }

  readonly #record: { onNote(note: number, velocity: number): number; orderIndex: number } = {
    orderIndex: 0,
    onNote: (_note: number, _velocity: number): number => {
      const engine = this.#engine
      if (engine === null || !this.#driver.playing) return -1
      const cycle = engine.nowCycle()
      this.#record.orderIndex = this.#driver.orderAtCycle(cycle)
      return this.#driver.rowAtCycle(cycle)
    },
  }

  loadSong(song: Song): void {
    this.#driver.loadSong(song)
    const image = buildDpcmImage(song)
    this.#driver.dpcmLayout = image === null ? null : image.layout
    this.#dpcmMemory = image === null ? null : image.memory
    if (image !== null) this.#engine?.node.port.postMessage({ t: 'dpcm', mem: image.memory })
  }

  play(mode: PlayMode, from?: { order: number; row: number }): void {
    void this.#playAsync(mode, from)
  }

  async #playAsync(mode: PlayMode, from?: { order: number; row: number }): Promise<void> {
    const seq = ++this.#playSeq
    await this.start()
    if (seq !== this.#playSeq) return
    const engine = this.#engine
    const coordinator = this.#coordinator
    if (engine === null || coordinator === null || this.#disposed) return
    // The known phase-1 gap — notes pressed during the ~100 ms engine start are
    // dropped — becomes load-bearing here, so playback waits for the clock anchor.
    await engine.ready()
    // Two awaits, two chances for the user to change their mind. A stop (or a second
    // play) taken during either one wins: it moved the token, so this start abandons.
    if (seq !== this.#playSeq || this.#disposed) return
    this.#applyVisibility()
    coordinator.start(mode, from, msToCycles(engine.clockRate, this.#lookaheadMs))
    this.#startPump()
  }

  stopPlayback(): void {
    this.#playSeq++
    this.#stopPump()
    this.#coordinator?.stop()
  }

  setLiveChannel(channel: number): void {
    this.#driver.setLiveChannel(channel)
  }

  setChannelMute(channel: number, muted: boolean): void {
    this.#driver.setChannelMute(channel, muted)
  }

  setEditStep(rows: number): void {
    this.#driver.setEditStep(rows)
  }

  /** The pump (§2.5). `setInterval`, not `requestAnimationFrame`: rAF stops entirely
   *  in a hidden tab and ties the audio timeline to the display refresh rate. */
  #startPump(): void {
    this.#stopPump()
    this.#pumpTimer = setInterval(() => {
      this.#pump()
    }, this.#pumpMs)
    if (this.#visibilityHandler === null && typeof document !== 'undefined') {
      const handler = (): void => {
        this.#applyVisibility()
        if (this.#pumpTimer !== null) this.#startPump()
      }
      this.#visibilityHandler = handler
      document.addEventListener('visibilitychange', handler)
    }
  }

  #stopPump(): void {
    if (this.#pumpTimer === null) return
    clearInterval(this.#pumpTimer)
    this.#pumpTimer = null
  }

  /** Hidden tabs pump at 250 ms with a lookahead bounded by ring occupancy, not by a
   *  constant — see `hiddenLookaheadMs`. Nobody plays live into a hidden tab, so the
   *  long lookahead is free. */
  #applyVisibility(): void {
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    this.#pumpMs = hidden ? HIDDEN_PUMP_MS : PUMP_MS
    this.#lookaheadMs = hidden
      ? hiddenLookaheadMs(this.#driver.song.meta.engineSpeed)
      : LOOKAHEAD_MS
  }

  #pump(): void {
    const engine = this.#engine
    const coordinator = this.#coordinator
    if (engine === null || coordinator === null) return
    coordinator.pump(msToCycles(engine.clockRate, this.#lookaheadMs))
    // A main-thread driver's failure mode IS a full ring. Surface it immediately
    // rather than waiting for the 10 Hz poll — shipping it unread would be shipping a
    // blind spot on purpose (§7.2).
    const dropped = engine.diagnostics().droppedWrites
    if (dropped !== this.#lastDropped) {
      this.#lastDropped = dropped
      this.#diag.droppedWrites = dropped
    }
    if (!coordinator.playing) {
      // The driver stopped itself — a `Cxx` halt, or the end of a non-looping song.
      // Stopping the pump is not enough: the timeline is still the driver's until it
      // is handed back, so the live scheduler would keep clamping behind it and the
      // next `play()` would start over an owner that never let go (S3).
      this.#stopPump()
      coordinator.stop()
    }
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

  /** Remembered before start (like `#values`), pushed live after. */
  setConsoleModel(model: 'nes' | 'famicom'): void {
    this.#consoleModel = model
    this.#engine?.setConfig({ consoleModel: model })
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
    this.#stopPump()
    if (this.#visibilityHandler !== null && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#visibilityHandler)
      this.#visibilityHandler = null
    }
    if (this.#wakeHandler !== null && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#wakeHandler)
      window.removeEventListener('pageshow', this.#wakeHandler)
      window.removeEventListener('focus', this.#wakeHandler)
      this.#wakeHandler = null
    }
    if (this.#driver.playing) this.#driver.stop()
    this.#coordinator = null
    this.#timeline.engine = null
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

    // The state field belongs to the wake/resume machine, not to the poll: a
    // refused resume publishes 'idle' — the state that puts the start cap back
    // on the panel — and re-publishing 'running' over a SUSPENDED context
    // flashes the cap for one interval and leaves the LED green on silence.
    // Until the context is genuinely running again the poll's whole job is the
    // numbers above.
    if (engine.ctx.state !== 'running') return
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

  /** The browser can suspend a context out from under us (device change, sleep,
   *  and on iOS a lock screen, phone call, Siri or the ringer switch). */
  #onContextState(): void {
    const engine = this.#engine
    if (engine === null || this.#disposed) return
    const state: string = engine.ctx.state
    if (state === 'running') {
      this.#publish(this.#statusFor('running'))
      return
    }
    if (state === 'closed') {
      // Chrome closes the context on device loss. Claiming 'running' with nothing
      // sounding would be a truthfulness violation (finding #16) — publish the
      // failure and let a fresh gesture retry via start(). That retry rebuilds
      // only when #engine is null: start()'s live-engine branch is a RESUME and
      // #resume refuses 'closed', so the dead handle is torn down here, not just
      // unpromised — scheduler, coordinator, tap and timers belonged to the old
      // context and a cleared #startPromise alone left start() resuming a corpse.
      this.#teardown()
      this.#engine = null
      this.#startPromise = null
      void engine.dispose().catch(() => {})
      this.#publish({ ...this.#statusFor('error'), error: 'audio device lost' })
      return
    }
    this.#resume()
  }

  /** One resume attempt, deduplicated. Called from the statechange handler,
   *  from the wake signals, from `start()` on a live engine and from every
   *  note-on — whichever of them is the gesture WebKit will accept. A refusal
   *  (typically an interruption still in progress) publishes 'idle', which is
   *  the state that puts the start cap back on the panel; the next gesture or
   *  wake signal retries. `state` is compared as a string because WebKit
   *  reports the non-spec 'interrupted'. */
  #resume(): void {
    const engine = this.#engine
    if (engine === null || this.#disposed || this.#resumePending) return
    const state: string = engine.ctx.state
    if (state === 'running' || state === 'closed') return
    this.#resumePending = true
    this.#publish(this.#statusFor('starting'))
    engine.ctx
      .resume()
      .then(() => {
        this.#resumePending = false
        if (this.#disposed) return
        const now: string = engine.ctx.state
        if (now === 'running') this.#publish(this.#statusFor('running'))
      })
      .catch(() => {
        this.#resumePending = false
        if (!this.#disposed) this.#publish(this.#statusFor('idle'))
      })
  }

  /** See noteOn. Cheap: one string compare on the hot path. */
  #gestureKick(): void {
    const engine = this.#engine
    if (engine === null) return
    const state: string = engine.ctx.state
    if (state !== 'running' && state !== 'closed') this.#resume()
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

  /** The stub implements the whole tracker surface with a SYNTHETIC position advance,
   *  so WP10 can build the entire grid against `?stub` with no audio thread — exactly
   *  as WP2 did in phase 1. */
  #song: Song = emptySong()
  #playing = false
  #rowMs = 0
  #rowClock = 0
  readonly #position = {
    playing: false,
    orderIndex: 0,
    row: 0,
    tick: 0,
    tickIndex: 0,
    bpm: 0,
    levels: new Int32Array(5),
  }
  readonly #stats: DriverStats = {
    ticksGenerated: 0,
    writesEmitted: 0,
    lateTicks: 0,
    rowsPlayed: 0,
    noteOns: 0,
    loops: 0,
  }
  readonly #record: RecordSink = {
    onNote: (): number => this.#position.row,
    orderIndex: 0,
  }

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

  setConsoleModel(model: 'nes' | 'famicom'): void {
    this.#note('setConsoleModel', model)
  }

  subscribe(fn: (s: BridgeStatus) => void): () => void {
    this.#subs.add(fn)
    fn(this.#status)
    return () => {
      this.#subs.delete(fn)
    }
  }

  // --- phase 2: the tracker transport, synthetic ------------------------------------

  get playback(): DriverPosition {
    return this.#position
  }

  get playbackStats(): DriverStats | null {
    return this.#stats
  }

  get recordSink(): RecordSink | null {
    return this.#playing ? this.#record : null
  }

  loadSong(song: Song): void {
    this.#song = song
    const m = song.meta
    this.#position.bpm = (24 * m.tempo) / (m.speed * Math.max(1, m.rowHighlight))
    this.#rowMs = ((2.5 * m.engineSpeed * m.speed) / m.tempo) * (1000 / m.engineSpeed)
    this.#note('setParam', `song=${m.name}`)
  }

  play(mode: PlayMode, from?: { order: number; row: number }): void {
    if (this.#rowMs === 0) this.loadSong(this.#song)
    this.#playing = true
    this.#position.playing = true
    this.#position.orderIndex = from === undefined ? 0 : from.order
    this.#position.row = from === undefined ? 0 : from.row
    this.#position.tickIndex = 0
    this.#rowClock = 0
    this.#note('start', `play/${mode}`)
  }

  stopPlayback(): void {
    this.#playing = false
    this.#position.playing = false
    this.#position.levels.fill(0)
    this.#note('allNotesOff', 'stop')
  }

  setLiveChannel(channel: number): void {
    this.#note('setParam', `liveChannel=${channel}`)
  }

  setChannelMute(channel: number, muted: boolean): void {
    this.#note('setParam', `mute${channel}=${muted}`)
  }

  setEditStep(rows: number): void {
    this.#note('setParam', `editStep=${rows}`)
  }

  /** Advance the synthetic playhead at the song's real row rate. */
  #advancePlayhead(dt: number): void {
    if (!this.#playing || this.#rowMs <= 0) return
    this.#rowClock += dt
    while (this.#rowClock >= this.#rowMs) {
      this.#rowClock -= this.#rowMs
      this.#stats.rowsPlayed++
      this.#position.tickIndex++
      this.#position.row++
      if (this.#position.row >= this.#song.meta.rowsPerPattern) {
        this.#position.row = 0
        this.#position.orderIndex =
          (this.#position.orderIndex + 1) % Math.max(1, this.#song.order.length)
      }
    }
    for (let i = 0; i < this.#position.levels.length; i++) {
      this.#position.levels[i] = this.#held.size > 0 || i < 2 ? 9 : 4
    }
  }

  /** Synthetic but plausible: a slow breathing level that responds to held
   *  notes, and a ~440 Hz scope trace at the stub's nominal 48 kHz. Enough for
   *  the meter and the scope page to be visibly, verifiably alive. */
  tick(nowMs: number): void {
    const dt = this.#lastTick === 0 ? 16 : Math.min(64, nowMs - this.#lastTick)
    this.#lastTick = nowMs
    this.#advancePlayhead(dt)

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

/** App teardown disposes the bridge; a remount (Vite HMR is the everyday case)
 *  must get a FRESH one, not a latched-dead singleton. Review finding #12. */
export function releaseBridge(instance: AudioBridge): void {
  if (singleton === instance) singleton = null
}

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
