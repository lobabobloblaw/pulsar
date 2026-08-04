/** The single-producer / single-consumer register-write ring (plan B6).
 *
 *  Three classes, one queue discipline:
 *
 *    RingProducer   host side, writes into a SharedArrayBuffer
 *    RingConsumer   worklet side, drains it inside `process()`
 *    LocalWriteRing the identical queue over private typed arrays — this is what the
 *                   postMessage fallback copies incoming batches into
 *
 *  `LocalWriteRing` is not a test double: it is the fallback transport's real queue,
 *  and it exists as a separate class from the SAB pair precisely so both paths can be
 *  driven from a plain node test and proved to hand the APU the same writes in the
 *  same order. Everything downstream of `drainUpTo` is then, by construction,
 *  identical — which is the M3 gate ("SAB path and postMessage path produce
 *  bit-identical output").
 *
 *  Memory ordering. Each index has exactly one writer:
 *    producer  loads readIndex  (acquire) → writes the slot → stores writeIndex (release)
 *    consumer  loads writeIndex (acquire) → reads the slot  → stores readIndex  (release)
 *  `Atomics.load`/`Atomics.store` on a SharedArrayBuffer are sequentially consistent,
 *  which is strictly stronger than the acquire/release this needs. The release store
 *  of `writeIndex` is what publishes the slot payload — the slot is written first,
 *  always.
 *
 *  Zero allocation. Every view is built once in a constructor. `push` and `drainUpTo`
 *  allocate nothing: no closures, no iterators, no destructuring, indexed loops only.
 *
 *  Atomics work on non-shared integer TypedArrays too (everything except wait/notify),
 *  so a ring constructed over a plain ArrayBuffer behaves identically — that is the
 *  seam `createRingBuffer` exposes for environments without SharedArrayBuffer.
 */
import {
  IDX_MASK,
  I_DROPPED,
  I_CLIPPED,
  I_LATE,
  I_PEAK_PROCESS_NS,
  I_READ_INDEX,
  I_RUNNING,
  I_SAMPLE_RATE,
  I_UNDERRUNS,
  I_WRITE_INDEX,
  RING_BYTES,
  RING_CAPACITY,
  SLOT_MASK,
  codesView,
  cyclesView,
  headerView,
  initRing,
  isRingBuffer,
} from './layout'
import {
  decodeAddr,
  decodeValue,
  encodeWrite,
  type NesCycle,
  type RegAddr,
  type WriteSink,
} from '../timeline/types'

/** A drainable write queue. Both transports satisfy it, which is what lets the
 *  worklet hold either one behind the same four lines of `process()`. */
export interface WriteDrain {
  /** Consume every queued write with `cycle <= limitCycle`, in order, stopping at the
   *  first write past the limit so ordering survives across quanta. Returns how many
   *  writes were handed to the sink. */
  drainUpTo(limitCycle: NesCycle, sink: WriteSink): number
  readonly pending: number
}

/** Allocate a ring buffer. Shared when the platform allows it (which requires
 *  cross-origin isolation in a browser), private otherwise — the private form is only
 *  ever used by tests and by callers that want the queue without the thread. */
export function createRingBuffer(sampleRate: number, shared = true): ArrayBufferLike {
  const buffer: ArrayBufferLike =
    shared && typeof SharedArrayBuffer === 'function'
      ? new SharedArrayBuffer(RING_BYTES)
      : new ArrayBuffer(RING_BYTES)
  initRing(buffer, sampleRate)
  return buffer
}

/** The host's ring, or null when SharedArrayBuffer is not available. Returning null
 *  rather than throwing is what makes the postMessage fallback a runtime decision. */
export function createSharedRing(sampleRate: number): SharedArrayBuffer | null {
  if (typeof SharedArrayBuffer !== 'function') return null
  const sab = new SharedArrayBuffer(RING_BYTES)
  initRing(sab, sampleRate)
  return sab
}

/** Host side. Exactly one of these per ring, forever (plan B6): in Phase 2 the
 *  tracker worker becomes the sole producer and the main thread routes live events
 *  through it rather than opening a second producer. */
export class RingProducer {
  private readonly header: Int32Array
  private readonly cycles: Float64Array
  private readonly codes: Int32Array
  /** Producer-owned index. Cached so the steady state is one atomic load (of the
   *  consumer's index) and one atomic store per write. */
  private writeIndex: number

  constructor(buffer: ArrayBufferLike) {
    if (!isRingBuffer(buffer)) throw new Error('writeRing: buffer is not a pulsar ring')
    this.header = headerView(buffer)
    this.cycles = cyclesView(buffer)
    this.codes = codesView(buffer)
    this.writeIndex = Atomics.load(this.header, I_WRITE_INDEX) & IDX_MASK
  }

  /** Queue one register write. Returns false — and counts a drop — when the ring is
   *  full, which means the consumer has stopped draining (a stalled or dead worklet).
   *  Never blocks, never allocates. */
  push(cycle: NesCycle, addr: RegAddr, value: number): boolean {
    return this.pushCode(cycle, encodeWrite(addr, value))
  }

  /** Same, for a pre-encoded wire code. */
  pushCode(cycle: NesCycle, code: number): boolean {
    const header = this.header
    const w = this.writeIndex
    const r = Atomics.load(header, I_READ_INDEX)
    if (((w - r) & IDX_MASK) >= RING_CAPACITY) {
      Atomics.add(header, I_DROPPED, 1)
      return false
    }
    const slot = w & SLOT_MASK
    this.cycles[slot] = cycle
    this.codes[slot] = code
    const next = (w + 1) & IDX_MASK
    // Release: the slot payload above must be visible before the index that publishes it.
    Atomics.store(header, I_WRITE_INDEX, next)
    this.writeIndex = next
    return true
  }

  /** Writes queued but not yet consumed. */
  get pending(): number {
    return (this.writeIndex - Atomics.load(this.header, I_READ_INDEX)) & IDX_MASK
  }

  get droppedWrites(): number {
    return Atomics.load(this.header, I_DROPPED)
  }

  /** The rate the worklet actually got, stamped by whoever created the buffer. */
  get sampleRate(): number {
    return Atomics.load(this.header, I_SAMPLE_RATE)
  }
}

/** Worklet side. Owns `readIndex` and every consumer-published counter. */
export class RingConsumer implements WriteDrain {
  private readonly header: Int32Array
  private readonly cycles: Float64Array
  private readonly codes: Int32Array
  /** Consumer-owned index. */
  private readIndex: number

  constructor(buffer: ArrayBufferLike) {
    if (!isRingBuffer(buffer)) throw new Error('writeRing: buffer is not a pulsar ring')
    this.header = headerView(buffer)
    this.cycles = cyclesView(buffer)
    this.codes = codesView(buffer)
    this.readIndex = Atomics.load(this.header, I_READ_INDEX) & IDX_MASK
  }

  /** The hot path. Called once per render quantum from `process()`; allocates
   *  nothing, and the `& SLOT_MASK` is on the ring INDEX, never on the cycle. */
  drainUpTo(limitCycle: NesCycle, sink: WriteSink): number {
    const cycles = this.cycles
    const codes = this.codes
    // Acquire: everything the producer wrote before publishing this index is visible.
    const w = Atomics.load(this.header, I_WRITE_INDEX)
    let r = this.readIndex
    let n = 0
    while (r !== w) {
      const slot = r & SLOT_MASK
      const c = cycles[slot]
      if (c > limitCycle) break
      const code = codes[slot]
      sink.write(c, decodeAddr(code), decodeValue(code))
      r = (r + 1) & IDX_MASK
      n++
    }
    if (n !== 0) {
      this.readIndex = r
      // Release: the slots are free only after the payload reads above.
      Atomics.store(this.header, I_READ_INDEX, r)
    }
    return n
  }

  get pending(): number {
    return (Atomics.load(this.header, I_WRITE_INDEX) - this.readIndex) & IDX_MASK
  }

  /** Publish the consumer-owned counters. Six atomic stores, no allocation — this is
   *  the whole diagnostics uplink on the SAB path, which is why the worklet never has
   *  to postMessage from inside `process()`. `droppedWrites` is deliberately absent:
   *  it belongs to the producer, and two writers to one slot would lose counts. */
  publishStats(
    lateWrites: number,
    underruns: number,
    peakProcessNs: number,
    clippedSamples: number,
  ): void {
    // Atomics.store on an Int32Array already truncates to int32; these are event
    // counters, never cycle values.
    const header = this.header
    Atomics.store(header, I_LATE, lateWrites)
    Atomics.store(header, I_UNDERRUNS, underruns)
    Atomics.store(header, I_PEAK_PROCESS_NS, peakProcessNs)
    Atomics.store(header, I_CLIPPED, clippedSamples)
  }

  /** 1 while the processor is rendering; 0 once it has returned false for good. */
  setRunning(running: boolean): void {
    Atomics.store(this.header, I_RUNNING, running ? 1 : 0)
  }

  /** The worklet is the authority on the real context rate. */
  publishSampleRate(sampleRate: number): void {
    Atomics.store(this.header, I_SAMPLE_RATE, Math.round(sampleRate))
  }
}

/** The postMessage fallback's queue: the same index algebra over private arrays.
 *
 *  `port.onmessage` copies each transferred batch in with `enqueue`, `process()`
 *  drains it with the same `drainUpTo` contract the SAB consumer implements, and the
 *  APU downstream cannot tell the two apart. */
export class LocalWriteRing implements WriteDrain {
  private readonly cycles = new Float64Array(RING_CAPACITY)
  private readonly codes = new Int32Array(RING_CAPACITY)
  private writeIndex = 0
  private readIndex = 0

  /** Writes lost to a full ring. The SAB path counts these in the header instead. */
  droppedWrites = 0

  /** Copy a transferred batch in. Stops at the first drop, exactly as the SAB
   *  producer does, so the two transports lose the same writes under the same
   *  pressure. Returns how many were accepted. */
  enqueue(cycles: Float64Array, codes: Int32Array, count: number): number {
    let n = 0
    for (let i = 0; i < count; i++) {
      if (!this.push(cycles[i], codes[i])) break
      n++
    }
    return n
  }

  push(cycle: NesCycle, code: number): boolean {
    const w = this.writeIndex
    if (((w - this.readIndex) & IDX_MASK) >= RING_CAPACITY) {
      this.droppedWrites++
      return false
    }
    const slot = w & SLOT_MASK
    this.cycles[slot] = cycle
    this.codes[slot] = code
    this.writeIndex = (w + 1) & IDX_MASK
    return true
  }

  drainUpTo(limitCycle: NesCycle, sink: WriteSink): number {
    const cycles = this.cycles
    const codes = this.codes
    const w = this.writeIndex
    let r = this.readIndex
    let n = 0
    while (r !== w) {
      const slot = r & SLOT_MASK
      const c = cycles[slot]
      if (c > limitCycle) break
      const code = codes[slot]
      sink.write(c, decodeAddr(code), decodeValue(code))
      r = (r + 1) & IDX_MASK
      n++
    }
    this.readIndex = r
    return n
  }

  get pending(): number {
    return (this.writeIndex - this.readIndex) & IDX_MASK
  }

  clear(): void {
    this.writeIndex = 0
    this.readIndex = 0
  }
}
