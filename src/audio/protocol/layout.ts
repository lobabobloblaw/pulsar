/** The SharedArrayBuffer transport layout (plan B6).
 *
 *  One buffer holds a lock-free SPSC ring of register writes plus a small header of
 *  Atomics-visible counters. Exactly one producer (the host's live scheduler, or in
 *  Phase 2 the tracker worker) and exactly one consumer (the worklet's `process()`).
 *
 *  Byte map — 49 408 B total, which is 4 096 queued writes ≈ 320 ms of headroom even
 *  at tracker rates:
 *
 *    0    i32  MAGIC        'PUL1'
 *    4    i32  VERSION
 *    8    i32  CAPACITY     4096 (mirrored so a mismatched build is detectable)
 *    12   i32  SAMPLE_RATE  the context rate the worklet actually got
 *    64   i32  writeIndex   producer-owned  ─┐ separate 64-byte cache lines: the two
 *    128  i32  readIndex    consumer-owned  ─┘ indices are written by different threads
 *                                             every quantum and must not share a line
 *    192  i32  droppedWrites   producer-owned (ring was full)
 *    196  i32  lateWrites      consumer-owned (write timestamp already in the past)
 *    200  i32  underruns       consumer-owned
 *    204  i32  peakProcessNs   consumer-owned (running max)
 *    208  i32  clippedSamples  consumer-owned
 *    212  i32  running         consumer-owned (1 while the processor renders)
 *    256  f64  cycles[4096]    NES cycle of each queued write
 *    33024 i32 codes[4096]     16-bit wire encoding, `(addr & 0x1f) << 8 | value`
 *
 *  Indices live in `[0, 2·CAPACITY)`, not `[0, CAPACITY)`. The extra bit is what
 *  distinguishes a full ring from an empty one without a separate count, and masking
 *  every increment means an index can never go negative and never overflow — the ring
 *  is still exact after a 25-minute soak. `IDX_MASK`/`SLOT_MASK` are applied to RING
 *  INDICES only; NES cycle VALUES stay pure f64 doubles and never meet a bitwise
 *  operator (plan B5).
 *
 *  No DOM and no worklet globals are referenced here: this module compiles under
 *  tsconfig.dsp.json with `types: []`, which is what makes it importable from both
 *  threads and from a plain node test.
 */

/** 'PUL1' — a buffer that does not start with this is not ours. */
export const RING_MAGIC = 0x50554c31
/** Bump on any layout change; the consumer refuses a buffer it does not understand. */
export const RING_VERSION = 1

/** Queued writes the ring can hold. Power of two — `SLOT_MASK` depends on it. */
export const RING_CAPACITY = 4096

/** Index space is twice the capacity so `full` and `empty` are distinguishable. */
export const IDX_MASK = 2 * RING_CAPACITY - 1
/** Index → slot. */
export const SLOT_MASK = RING_CAPACITY - 1

// --- header, byte offsets ------------------------------------------------------

export const OFF_MAGIC = 0
export const OFF_VERSION = 4
export const OFF_CAPACITY = 8
export const OFF_SAMPLE_RATE = 12
export const OFF_WRITE_INDEX = 64
export const OFF_READ_INDEX = 128
export const OFF_DROPPED = 192
export const OFF_LATE = 196
export const OFF_UNDERRUNS = 200
export const OFF_PEAK_PROCESS_NS = 204
export const OFF_CLIPPED = 208
export const OFF_RUNNING = 212

/** Bytes reserved for the header. The payload starts on an 8-byte boundary so the
 *  cycle array can be a Float64Array view. */
export const HEADER_BYTES = 256

// --- header, Int32Array element indices ---------------------------------------
// Atomics take an element index, not a byte offset. These are the only names the
// producer and consumer use; the byte offsets above document the layout.

export const I_MAGIC = OFF_MAGIC / 4
export const I_VERSION = OFF_VERSION / 4
export const I_CAPACITY = OFF_CAPACITY / 4
export const I_SAMPLE_RATE = OFF_SAMPLE_RATE / 4
export const I_WRITE_INDEX = OFF_WRITE_INDEX / 4
export const I_READ_INDEX = OFF_READ_INDEX / 4
export const I_DROPPED = OFF_DROPPED / 4
export const I_LATE = OFF_LATE / 4
export const I_UNDERRUNS = OFF_UNDERRUNS / 4
export const I_PEAK_PROCESS_NS = OFF_PEAK_PROCESS_NS / 4
export const I_CLIPPED = OFF_CLIPPED / 4
export const I_RUNNING = OFF_RUNNING / 4

export const HEADER_LENGTH = HEADER_BYTES / 4

// --- payload -------------------------------------------------------------------

export const CYCLES_OFFSET = HEADER_BYTES
export const CYCLES_BYTES = RING_CAPACITY * 8
export const CODES_OFFSET = CYCLES_OFFSET + CYCLES_BYTES
export const CODES_BYTES = RING_CAPACITY * 4

/** 49 408 bytes. */
export const RING_BYTES = CODES_OFFSET + CODES_BYTES

// --- views ---------------------------------------------------------------------

/** The Atomics-visible header. Constructing a view allocates, so both threads build
 *  theirs ONCE (in a constructor) and never inside `process()`. */
export function headerView(buffer: ArrayBufferLike): Int32Array {
  return new Int32Array(buffer, 0, HEADER_LENGTH)
}

export function cyclesView(buffer: ArrayBufferLike): Float64Array {
  return new Float64Array(buffer, CYCLES_OFFSET, RING_CAPACITY)
}

export function codesView(buffer: ArrayBufferLike): Int32Array {
  return new Int32Array(buffer, CODES_OFFSET, RING_CAPACITY)
}

/** Stamp a fresh buffer. Called by the host before the buffer is handed to the
 *  worklet, so the worklet only ever sees a fully-formed header. */
export function initRing(buffer: ArrayBufferLike, sampleRate: number): void {
  const h = headerView(buffer)
  h.fill(0)
  h[I_MAGIC] = RING_MAGIC
  h[I_VERSION] = RING_VERSION
  h[I_CAPACITY] = RING_CAPACITY
  h[I_SAMPLE_RATE] = Math.round(sampleRate)
}

/** Does this buffer carry a ring this build understands? A version or capacity
 *  mismatch means a stale worklet chunk is live — fall back rather than corrupt. */
export function isRingBuffer(buffer: ArrayBufferLike): boolean {
  if (buffer.byteLength < RING_BYTES) return false
  const h = headerView(buffer)
  return (
    h[I_MAGIC] === RING_MAGIC &&
    h[I_VERSION] === RING_VERSION &&
    h[I_CAPACITY] === RING_CAPACITY
  )
}
