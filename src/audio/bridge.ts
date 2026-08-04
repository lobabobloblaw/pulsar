/* pulsar — the UI<->audio boundary (plan C3).
 *
 * THIS FILE CURRENTLY SHIPS A STUB. It implements the full AudioBridge contract
 * with synthetic meter/scope data so the shell can be built, reviewed and
 * keyboard-tested before the engine exists. WP6 replaces `createAudioBridge()`'s
 * body with a real implementation over `host/{audioEngine,liveScheduler,
 * voiceAllocator}` plus an AnalyserNode tap; nothing in `src/ui`, `src/state` or
 * `src/input` may need to change, because nothing outside this file knows which
 * implementation it is holding.
 *
 * Contract points that are fixed and must survive the swap:
 *   - native units cross the boundary (see audio/params.ts)
 *   - noteOn/noteOff/setParam are synchronous, allocation-free, fire-and-forget
 *     (they are called at pointermove rate)
 *   - the UI holds the authoritative optimistic copy and NEVER reads values back
 *   - `meter` and `scope` are preallocated and read ONLY inside the single rAF,
 *     never in an $effect
 *   - `start()` must be called from a user gesture (the boot keydown)
 */

import type { ParamId } from './params'

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
  /** Pumped once per frame by App's single rAF. The stub synthesises meter and
   *  scope here; the real bridge will copy from its AnalyserNode tap into the
   *  same preallocated arrays. Allocation-free either way. */
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

class StubBridge implements AudioBridge {
  readonly meter = new Float32Array(4)
  readonly scope = new Float32Array(SCOPE_LENGTH)

  /** Mutated in place, never reassigned — see `noteOn` for why. */
  lastAction: StubAction = { kind: 'none', detail: '', at: 0 }

  #status: BridgeStatus = {
    state: 'idle',
    sampleRate: 0,
    crossOriginIsolated: typeof crossOriginIsolated === 'boolean' ? crossOriginIsolated : false,
    transport: typeof SharedArrayBuffer === 'function' && crossOriginIsolated ? 'sab' : 'postMessage',
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

/** The one swap point. WP6: return the real bridge here (and keep the stub for
 *  tests / a `?stub` URL flag). Everything upstream depends only on the type. */
export function createAudioBridge(): AudioBridge {
  return new StubBridge()
}

/** Module-level singleton: one bridge per document, created lazily so that
 *  importing this module has no side effects. */
let singleton: AudioBridge | null = null

export function bridge(): AudioBridge {
  singleton ??= createAudioBridge()
  return singleton
}
