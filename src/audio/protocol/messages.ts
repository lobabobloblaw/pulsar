/** The host ↔ worklet message protocol.
 *
 *  This is the postMessage transport, which is the *fallback* path: it works with or
 *  without cross-origin isolation and it is what M2 shipped on. M3 added the
 *  SharedArrayBuffer ring behind exactly these types — `init` now carries the ring
 *  when the page is cross-origin isolated, and the worklet drains it through the same
 *  `WriteDrain` contract the fallback's internal ring implements, so everything
 *  downstream is byte-for-byte identical and the two paths are testable against each
 *  other (tests/unit/writeRing.test.ts).
 *
 *  Write batches travel as two parallel typed arrays rather than as objects:
 *    cycles[i]  f64  NES cycle (integer-valued double — an int32 would wrap at ~20 min)
 *    codes[i]   i32  16-bit wire encoding, `(addr & 0x1f) << 8 | value`
 *  Both buffers are TRANSFERRED down and transferred back up in a `recycle` message,
 *  so the host cycles a small fixed pool instead of allocating per batch.
 *
 *  No DOM or worklet types are referenced here on purpose: this module compiles under
 *  tsconfig.dsp.json with `types: []`, which is what proves the protocol is pure data.
 */
import type { ClockAnchor } from '../timeline/clockMap'

export type TransportKind = 'sab' | 'postMessage'

/** Transferable-backed views. Pinning the buffer type parameter is what lets
 *  `.buffer` be passed in a transfer list — the default `ArrayBufferLike` could be a
 *  SharedArrayBuffer, which is not transferable. */
export type WireCycles = Float64Array<ArrayBuffer>
export type WireCodes = Int32Array<ArrayBuffer>
export type WireBytes = Uint8Array<ArrayBuffer>

// --- host → worklet ------------------------------------------------------------

export interface InitMessage {
  readonly t: 'init'
  readonly clockRate: number
  readonly consoleModel: 'nes' | 'famicom'
  readonly mixerMode: 'lut' | 'linear'
  readonly masterGain: number
  /** The SAB write ring, present only when `crossOriginIsolated === true`. Its
   *  presence IS the transport decision: a worklet that receives one drains it and
   *  publishes diagnostics into its header, a worklet that does not falls back to
   *  `writes` batches. See protocol/layout.ts for the byte map. */
  readonly ring?: SharedArrayBuffer
}

export interface WritesMessage {
  readonly t: 'writes'
  readonly cycles: WireCycles
  readonly codes: WireCodes
  /** Valid prefix length; the arrays themselves are pool-sized. */
  readonly count: number
}

export interface DpcmMessage {
  readonly t: 'dpcm'
  /** 32 768 bytes: $8000–$FFFF. */
  readonly mem: WireBytes
}

export interface ConfigMessage {
  readonly t: 'config'
  readonly consoleModel?: 'nes' | 'famicom'
  readonly mixerMode?: 'lut' | 'linear'
  readonly masterGain?: number
}

export interface StopMessage {
  readonly t: 'stop'
}

export type HostToWorkletMessage =
  | InitMessage
  | WritesMessage
  | DpcmMessage
  | ConfigMessage
  | StopMessage

// --- worklet → host ------------------------------------------------------------

/** Published exactly once, from the first `process()`. Until the host has this it
 *  cannot map context time to cycles, so it cannot schedule anything. */
export interface ReadyMessage {
  readonly t: 'ready'
  readonly anchor: ClockAnchor
  readonly sampleRate: number
}

export interface StatsPayload {
  readonly lateWrites: number
  readonly droppedWrites: number
  readonly clippedSamples: number
  readonly deltasEmitted: number
  readonly eventsProcessed: number
  readonly frameSkips: number
  readonly underruns: number
  readonly peakProcessNs: number
  readonly cycle: number
}

/** Sent ONLY on the postMessage fallback path, at ~10 Hz, from a single preallocated
 *  message object — the SAB path publishes the same numbers into the ring header with
 *  Atomics instead, so the hot path never posts anything. */
export interface StatsMessage {
  readonly t: 'stats'
  readonly stats: StatsPayload
}

/** Buffers handed back to the host's pool. */
export interface RecycleMessage {
  readonly t: 'recycle'
  readonly cycles: WireCycles
  readonly codes: WireCodes
}

export interface ErrorMessage {
  readonly t: 'error'
  readonly message: string
}

export type WorkletToHostMessage = ReadyMessage | StatsMessage | RecycleMessage | ErrorMessage

/** Default depth of the host's transferable pool. */
export const WRITE_POOL_DEPTH = 4
export const WRITE_BATCH_CAPACITY = 256

/** How often the fallback path posts a stats message, in render quanta at 48 kHz
 *  (≈ 10 Hz). The worklet derives its own value from the real sample rate. */
export const STATS_INTERVAL_HZ = 10

/** The internal ring is the SAB ring's capacity — one constant, one queue discipline,
 *  so the two transports cannot drift apart. */
export { RING_CAPACITY as WORKLET_RING_CAPACITY } from './layout'
