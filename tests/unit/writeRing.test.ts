/** The SPSC write ring, and the claim the whole M3 milestone rests on: the
 *  SharedArrayBuffer transport and the postMessage transport hand the APU the same
 *  writes, in the same order, at the same cycles — so they render bit-identical audio.
 *
 *  Nothing here needs a browser. `createRingBuffer(rate, false)` builds the ring over
 *  a plain ArrayBuffer, and Atomics work on non-shared integer TypedArrays, so the
 *  exact production classes run under `environment: 'node'`. The only thing the seam
 *  changes is which constructor allocates the bytes.
 */
import { describe, expect, it } from 'vitest'
import {
  CODES_OFFSET,
  CYCLES_BYTES,
  CYCLES_OFFSET,
  HEADER_BYTES,
  IDX_MASK,
  I_CLIPPED,
  I_DROPPED,
  I_LATE,
  I_READ_INDEX,
  I_RUNNING,
  I_SAMPLE_RATE,
  I_UNDERRUNS,
  I_WRITE_INDEX,
  OFF_READ_INDEX,
  OFF_WRITE_INDEX,
  RING_BYTES,
  RING_CAPACITY,
  RING_MAGIC,
  RING_VERSION,
  SLOT_MASK,
  headerView,
  initRing,
  isRingBuffer,
} from '../../src/audio/protocol/layout'
import {
  LocalWriteRing,
  RingConsumer,
  RingProducer,
  createRingBuffer,
  type WriteDrain,
} from '../../src/audio/protocol/writeRing'
import { WRITE_BATCH_CAPACITY } from '../../src/audio/protocol/messages'
import {
  applyStats,
  dspLoadPercent,
  newDiagnostics,
  readRingCounters,
} from '../../src/audio/host/diagnostics'
import { writeNoteOff, writePulseNoteOn } from '../../src/audio/host/liveScheduler'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { decodeAddr, decodeValue, encodeWrite } from '../../src/audio/timeline/types'
import { makeApu, renderWith } from '../helpers/renderTrace'
import { sameSamples } from '../helpers/analysis'

const SAMPLE_RATE = 48000

function newRing(): ArrayBufferLike {
  return createRingBuffer(SAMPLE_RATE, false)
}

describe('SAB layout', () => {
  it('is the byte map plan B6 specifies', () => {
    expect(RING_MAGIC).toBe(0x50554c31)
    expect(String.fromCharCode(0x50, 0x55, 0x4c, 0x31)).toBe('PUL1')
    expect(RING_CAPACITY).toBe(4096)
    expect(HEADER_BYTES).toBe(256)
    // Separate 64-byte cache lines: the two indices are written by different threads
    // every quantum, and sharing a line would make every write ping-pong the line.
    expect(OFF_WRITE_INDEX).toBe(64)
    expect(OFF_READ_INDEX).toBe(128)
    expect(OFF_READ_INDEX - OFF_WRITE_INDEX).toBeGreaterThanOrEqual(64)
    expect(CYCLES_OFFSET).toBe(256)
    expect(CODES_OFFSET).toBe(CYCLES_OFFSET + CYCLES_BYTES)
    expect(RING_BYTES).toBe(49408)
  })

  it('index masks give an index space twice the capacity, so full ≠ empty', () => {
    expect(SLOT_MASK).toBe(RING_CAPACITY - 1)
    expect(IDX_MASK).toBe(2 * RING_CAPACITY - 1)
    // Powers of two, or the masking is a lie.
    expect((RING_CAPACITY & SLOT_MASK) === 0).toBe(true)
    expect(((2 * RING_CAPACITY) & IDX_MASK) === 0).toBe(true)
  })

  it('stamps and validates a buffer', () => {
    const buffer = newRing()
    expect(isRingBuffer(buffer)).toBe(true)
    const h = headerView(buffer)
    expect(h[0]).toBe(RING_MAGIC)
    expect(h[1]).toBe(RING_VERSION)
    expect(h[2]).toBe(RING_CAPACITY)
    expect(h[I_SAMPLE_RATE]).toBe(SAMPLE_RATE)
    expect(h[I_WRITE_INDEX]).toBe(0)
    expect(h[I_READ_INDEX]).toBe(0)
  })

  it('refuses a ring stamped with the previous version rather than misdecoding it', () => {
    // RING_VERSION went 1 → 2 when the wire code widened to the whole 16-bit address.
    // A stale worklet chunk carrying the v1 decoder would read every VRC6 address as
    // `0x4000 | (addr & 0x1f)` — $9002 would land on $4002 and detune pulse 1. The
    // version check is the only thing standing between that and silence, so prove it
    // is actually consulted.
    expect(RING_VERSION).toBe(2)
    const buffer = newRing()
    expect(isRingBuffer(buffer)).toBe(true)
    headerView(buffer)[1] = 1
    expect(isRingBuffer(buffer)).toBe(false)
    expect(() => new RingProducer(buffer)).toThrow(/pulsar ring/)
    expect(() => new RingConsumer(buffer)).toThrow(/pulsar ring/)
    headerView(buffer)[1] = RING_VERSION
    expect(isRingBuffer(buffer)).toBe(true)
  })

  it('rejects a buffer that is not ours, rather than corrupting it', () => {
    const foreign = new ArrayBuffer(RING_BYTES)
    expect(isRingBuffer(foreign)).toBe(false)
    expect(() => new RingProducer(foreign)).toThrow(/pulsar ring/)
    expect(() => new RingConsumer(foreign)).toThrow(/pulsar ring/)
    // Too small is also not ours — a stale build with a smaller capacity.
    const short = new ArrayBuffer(HEADER_BYTES)
    initRing(short, SAMPLE_RATE)
    expect(isRingBuffer(short)).toBe(false)
  })
})

/** Every address the engine accepts: the 2A03 block and the VRC6's three. */
const ALL_ADDRESSES: number[] = (() => {
  const out: number[] = []
  for (let a = 0x4000; a <= 0x4017; a++) out.push(a)
  for (let a = 0x9000; a <= 0x9003; a++) out.push(a)
  for (let a = 0xa000; a <= 0xa002; a++) out.push(a)
  for (let a = 0xb000; a <= 0xb002; a++) out.push(a)
  return out
})()

describe('the 24-bit wire encoding', () => {
  it('round-trips every 2A03 and VRC6 address at both ends of the value range', () => {
    for (let i = 0; i < ALL_ADDRESSES.length; i++) {
      const addr = ALL_ADDRESSES[i]
      for (const value of [0, 0xff]) {
        const code = encodeWrite(addr, value)
        expect(decodeAddr(code)).toBe(addr)
        expect(decodeValue(code)).toBe(value)
        // Still an honest Int32 slot on both transports.
        expect(code | 0).toBe(code)
        expect(code).toBeGreaterThanOrEqual(0)
      }
    }
    expect(ALL_ADDRESSES.length).toBe(24 + 10)
  })

  it('anti-vacuity: the OLD five-bit encoding collapsed the VRC6 onto the $4000 page', () => {
    // $9002 and $A002 both decoded to $4002 under `(addr & 0x1f) << 8`, so a VRC6
    // note-on would have retuned pulse 1. That collision is the whole reason for v2.
    const legacy = (addr: number): number => 0x4000 | (addr & 0x1f)
    expect(legacy(0x9002)).toBe(0x4002)
    expect(legacy(0xa002)).toBe(0x4002)
    expect(decodeAddr(encodeWrite(0x9002, 0))).not.toBe(decodeAddr(encodeWrite(0xa002, 0)))
  })
})

describe('RingProducer / RingConsumer', () => {
  it('delivers every write in order', () => {
    const buffer = newRing()
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const sink = new ArrayWriteSink()

    for (let i = 0; i < 1000; i++) {
      expect(producer.push(i * 7, 0x4000 + (i % 4), i & 0xff)).toBe(true)
    }
    expect(consumer.drainUpTo(Infinity, sink)).toBe(1000)
    expect(sink.length).toBe(1000)
    for (let i = 0; i < 1000; i++) {
      expect(sink.cycles[i]).toBe(i * 7)
      expect(sink.addrs[i]).toBe(0x4000 + (i % 4))
      expect(sink.values[i]).toBe(i & 0xff)
    }
  })

  it('wraps cleanly at ten times capacity, and the indices never leave [0, 2·CAP)', () => {
    const buffer = newRing()
    const header = headerView(buffer)
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const sink = new ArrayWriteSink()

    const total = RING_CAPACITY * 10
    const chunk = 300 // deliberately not a divisor of the capacity
    let pushed = 0
    while (pushed < total) {
      const n = Math.min(chunk, total - pushed)
      for (let i = 0; i < n; i++) {
        expect(producer.push(pushed + i, 0x4000, (pushed + i) & 0xff)).toBe(true)
      }
      pushed += n
      consumer.drainUpTo(Infinity, sink)
      const w = Atomics.load(header, I_WRITE_INDEX)
      const r = Atomics.load(header, I_READ_INDEX)
      expect(w).toBeGreaterThanOrEqual(0)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(w).toBeLessThan(2 * RING_CAPACITY)
      expect(r).toBeLessThan(2 * RING_CAPACITY)
    }
    expect(sink.length).toBe(total)
    for (let i = 0; i < total; i += 997) expect(sink.cycles[i]).toBe(i)
    expect(sink.cycles[total - 1]).toBe(total - 1)
    expect(producer.droppedWrites).toBe(0)
  })

  it('holds exactly CAPACITY writes, then drops and counts', () => {
    const buffer = newRing()
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)

    for (let i = 0; i < RING_CAPACITY; i++) {
      expect(producer.push(i, 0x4000, 0)).toBe(true)
    }
    expect(producer.pending).toBe(RING_CAPACITY)
    expect(producer.push(9999, 0x4000, 0)).toBe(false)
    expect(producer.push(9999, 0x4000, 0)).toBe(false)
    expect(producer.droppedWrites).toBe(2)
    expect(Atomics.load(headerView(buffer), I_DROPPED)).toBe(2)

    // Room reappears exactly as fast as the consumer makes it.
    const sink = new ArrayWriteSink()
    expect(consumer.drainUpTo(9, sink)).toBe(10)
    for (let i = 0; i < 10; i++) expect(producer.push(10_000 + i, 0x4000, 0)).toBe(true)
    expect(producer.push(20_000, 0x4000, 0)).toBe(false)
    expect(producer.droppedWrites).toBe(3)
    // The dropped writes are gone; nothing after them was reordered ahead.
    expect(sink.cycles[0]).toBe(0)
    expect(sink.cycles[9]).toBe(9)
  })

  it('drainUpTo stops at the first write past the limit, inclusive of the limit', () => {
    const buffer = newRing()
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const sink = new ArrayWriteSink()

    producer.push(10, 0x4000, 1)
    producer.push(20, 0x4000, 2)
    producer.push(30, 0x4000, 3)

    expect(consumer.drainUpTo(9, sink)).toBe(0)
    expect(consumer.drainUpTo(20, sink)).toBe(2) // `cycle === limit` belongs to this frame
    expect(sink.length).toBe(2)
    expect(consumer.drainUpTo(29, sink)).toBe(0)
    expect(consumer.pending).toBe(1)
    expect(consumer.drainUpTo(30, sink)).toBe(1)
    expect(sink.cycles).toEqual([10, 20, 30])
    expect(consumer.pending).toBe(0)
    expect(consumer.drainUpTo(Infinity, sink)).toBe(0)
  })

  it('publishes the worklet-owned counters through the header', () => {
    const buffer = newRing()
    const consumer = new RingConsumer(buffer)
    const header = headerView(buffer)

    consumer.publishStats(3, 1, 123_456, 7)
    expect(Atomics.load(header, I_LATE)).toBe(3)
    expect(Atomics.load(header, I_UNDERRUNS)).toBe(1)
    expect(Atomics.load(header, I_CLIPPED)).toBe(7)
    expect(Atomics.load(header, I_LATE)).toBe(3)

    expect(Atomics.load(header, I_RUNNING)).toBe(0)
    consumer.setRunning(true)
    expect(Atomics.load(header, I_RUNNING)).toBe(1)
    consumer.setRunning(false)
    expect(Atomics.load(header, I_RUNNING)).toBe(0)

    consumer.publishSampleRate(44100)
    expect(Atomics.load(header, I_SAMPLE_RATE)).toBe(44100)
  })

  it('runs over a real SharedArrayBuffer identically where one exists', () => {
    if (typeof SharedArrayBuffer !== 'function') return
    const buffer = createRingBuffer(SAMPLE_RATE)
    expect(buffer).toBeInstanceOf(SharedArrayBuffer)
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const sink = new ArrayWriteSink()
    for (let i = 0; i < 5000; i++) {
      producer.push(i, 0x4000, i & 0xff)
      if (i % 100 === 99) consumer.drainUpTo(Infinity, sink)
    }
    consumer.drainUpTo(Infinity, sink)
    expect(sink.length).toBe(5000)
    expect(producer.droppedWrites).toBe(0)
  })
})

describe('LocalWriteRing (the postMessage fallback queue)', () => {
  it('applies the same order, wrap and drop rules', () => {
    const ring = new LocalWriteRing()
    const sink = new ArrayWriteSink()
    for (let i = 0; i < RING_CAPACITY; i++) {
      expect(ring.push(i, encodeWrite(0x4000, i & 0xff))).toBe(true)
    }
    expect(ring.pending).toBe(RING_CAPACITY)
    expect(ring.push(1, encodeWrite(0x4000, 0))).toBe(false)
    expect(ring.droppedWrites).toBe(1)
    expect(ring.drainUpTo(Infinity, sink)).toBe(RING_CAPACITY)
    expect(sink.cycles[0]).toBe(0)
    expect(sink.cycles[RING_CAPACITY - 1]).toBe(RING_CAPACITY - 1)
  })

  it('enqueue stops at the first drop rather than skipping a hole into the timeline', () => {
    const ring = new LocalWriteRing()
    const cycles = new Float64Array(RING_CAPACITY + 10)
    const codes = new Int32Array(RING_CAPACITY + 10)
    for (let i = 0; i < cycles.length; i++) {
      cycles[i] = i
      codes[i] = encodeWrite(0x4000, i & 0xff)
    }
    expect(ring.enqueue(cycles, codes, cycles.length)).toBe(RING_CAPACITY)
    expect(ring.droppedWrites).toBe(1)
    const sink = new ArrayWriteSink()
    ring.drainUpTo(Infinity, sink)
    // Everything accepted is a contiguous prefix — never a gap in the middle.
    for (let i = 0; i < sink.length; i++) expect(sink.cycles[i]).toBe(i)
  })

  it('wraps at ten times capacity', () => {
    const ring = new LocalWriteRing()
    const sink = new ArrayWriteSink()
    const total = RING_CAPACITY * 10
    for (let i = 0; i < total; i++) {
      expect(ring.push(i, encodeWrite(0x4000, i & 0xff))).toBe(true)
      if (i % 617 === 616) ring.drainUpTo(Infinity, sink)
    }
    ring.drainUpTo(Infinity, sink)
    expect(sink.length).toBe(total)
    expect(ring.droppedWrites).toBe(0)
    expect(sink.cycles[total - 1]).toBe(total - 1)
  })
})

describe('diagnostics', () => {
  it('reads the header counters back into the snapshot the UI polls', () => {
    const buffer = newRing()
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const header = headerView(buffer)

    for (let i = 0; i < RING_CAPACITY + 3; i++) producer.push(i, 0x4000, 0)
    consumer.publishStats(5, 2, 250_000, 9)

    const snap = newDiagnostics('sab', SAMPLE_RATE)
    readRingCounters(snap, header)
    expect(snap.droppedWrites).toBe(3)
    expect(snap.lateWrites).toBe(5)
    expect(snap.underruns).toBe(2)
    expect(snap.peakProcessUs).toBe(250)
    expect(snap.dspLoadPct).toBeCloseTo(9.375, 6)
    expect(snap.transport).toBe('sab')
  })

  it('scores the peak against the render deadline — 267 µs is the 10 % budget', () => {
    // One 128-frame quantum is 2 666.67 µs at 48 kHz; the M8 gate allows 10 % of it.
    expect(dspLoadPercent(267, 48000)).toBeCloseTo(10.0125, 4)
    expect(dspLoadPercent(2666.667, 48000)).toBeCloseTo(100, 3)
    expect(dspLoadPercent(100, 44100)).toBeCloseTo(3.4453, 3)
    expect(dspLoadPercent(100, 0)).toBe(0)
  })

  it('fills the same snapshot from a fallback-path stats message', () => {
    const snap = newDiagnostics('postMessage', SAMPLE_RATE)
    applyStats(snap, {
      lateWrites: 4,
      droppedWrites: 1,
      clippedSamples: 0,
      deltasEmitted: 10,
      eventsProcessed: 20,
      frameSkips: 2,
      underruns: 2,
      peakProcessNs: 133_000,
      cycle: 1_789_773,
    })
    expect(snap.transport).toBe('postMessage')
    expect(snap.lateWrites).toBe(4)
    expect(snap.droppedWrites).toBe(1)
    expect(snap.underruns).toBe(2)
    expect(snap.peakProcessUs).toBe(133)
    expect(snap.dspLoadPct).toBeCloseTo(4.9875, 4)
  })
})

// --- the M3 gate ------------------------------------------------------------------

const DURATION_SAMPLES = 12_000
const QUANTUM = 128
/** The host stays this far ahead of the render position, exactly as LiveScheduler
 *  does at the default 6 ms lead. */
const LOOKAHEAD_CYCLES = 10_739

/** A quarter second of dense live play: ~900 note events, well over 4 500 register
 *  writes — more than the ring's 4 096 slots, so the equivalence claim covers a wrap.
 *
 *  Every VRC6 register is in here too. The addresses are what the v2 wire encoding
 *  exists for, and an encoding that truncated them would not merely sound wrong: it
 *  would fold $9002/$A002/$B002 onto $4002 and detune the 2A03 pulse. Carrying them
 *  through BOTH transports is how "the two paths are bit-identical" stays a claim
 *  about the whole address space rather than about the $4000 page. */
function densePlayTrace(): ArrayWriteSink {
  const trace = new ArrayWriteSink()
  let cycle = 1000
  let mask = 0
  for (let i = 0; i < 890; i++) {
    if (i % 3 === 2) {
      mask = 0
      writeNoteOff(trace, cycle, mask)
      // Padding writes keep the event count above the ring capacity.
      trace.write(cycle, 0x4001, 0x08)
      trace.write(cycle, 0x4000, 0x30)
      trace.write(cycle, 0x4002, 0)
      trace.write(cycle, 0x4003, 0)
      // VRC6 note-off: clear the enable bit on all three, which is also a phase reset.
      trace.write(cycle, 0x9002, 0x00)
      trace.write(cycle, 0xa002, 0x00)
      trace.write(cycle, 0xb002, 0x00)
    } else {
      mask = 0x01
      writePulseNoteOn(trace, cycle, 0, 200 + (i % 97), i % 4, 15 - (i % 16), 0x08, mask)
      const p = 180 + (i % 211)
      trace.write(cycle, 0x9000, ((i % 8) << 4) | (15 - (i % 16)))
      trace.write(cycle, 0x9001, p & 0xff)
      trace.write(cycle, 0x9002, 0x80 | ((p >> 8) & 0x0f))
      trace.write(cycle, 0xa000, 0x70 | (i % 16))
      trace.write(cycle, 0xa001, (p + 40) & 0xff)
      trace.write(cycle, 0xa002, 0x80 | (((p + 40) >> 8) & 0x0f))
      trace.write(cycle, 0xb000, 20 + (i % 43))
      trace.write(cycle, 0xb001, (p * 2) & 0xff)
      trace.write(cycle, 0xb002, 0x80 | (((p * 2) >> 8) & 0x0f))
      if (i % 97 === 0) trace.write(cycle, 0x9003, i % 2 === 0 ? 0x02 : 0x00)
    }
    cycle += 500
  }
  return trace
}

/** Render a queue the way `process()` does: derive the target from the engine's own
 *  clock, push everything the host would have queued by then, drain, close the frame,
 *  read. The two callers differ only in which queue they hand in. */
function renderThroughQueue(
  trace: ArrayWriteSink,
  drain: WriteDrain,
  enqueueUpTo: (limit: number) => void,
): Float32Array {
  const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION_SAMPLES })
  const out = new Float32Array(DURATION_SAMPLES)
  let written = 0
  while (written < out.length) {
    const want = Math.min(QUANTUM, out.length - written)
    const target = apu.cycle + apu.cyclesForSamples(want)
    enqueueUpTo(target + LOOKAHEAD_CYCLES)
    drain.drainUpTo(target, apu)
    apu.endFrame(target)
    const got = apu.readSamples(out, written, want)
    if (got === 0) throw new Error('renderThroughQueue: engine produced no samples')
    written += got
  }
  return out
}

function renderViaSharedRing(trace: ArrayWriteSink): Float32Array {
  const buffer = newRing()
  const producer = new RingProducer(buffer)
  const consumer = new RingConsumer(buffer)
  let cursor = 0
  const enqueueUpTo = (limit: number): void => {
    while (cursor < trace.length && trace.cycles[cursor] <= limit) {
      if (!producer.push(trace.cycles[cursor], trace.addrs[cursor], trace.values[cursor])) break
      cursor++
    }
  }
  const out = renderThroughQueue(trace, consumer, enqueueUpTo)
  expect(producer.droppedWrites).toBe(0)
  expect(cursor).toBe(trace.length)
  return out
}

function renderViaPostMessage(trace: ArrayWriteSink): Float32Array {
  const ring = new LocalWriteRing()
  // The host's pooled batch, byte-for-byte what EngineHandle.flush() transfers.
  const cycles = new Float64Array(WRITE_BATCH_CAPACITY)
  const codes = new Int32Array(WRITE_BATCH_CAPACITY)
  let count = 0
  let cursor = 0
  let batches = 0
  const flush = (): void => {
    if (count === 0) return
    ring.enqueue(cycles, codes, count)
    count = 0
    batches++
  }
  const enqueueUpTo = (limit: number): void => {
    while (cursor < trace.length && trace.cycles[cursor] <= limit) {
      cycles[count] = trace.cycles[cursor]
      codes[count] = encodeWrite(trace.addrs[cursor], trace.values[cursor])
      count++
      cursor++
      if (count >= WRITE_BATCH_CAPACITY) flush()
    }
    flush()
  }
  const out = renderThroughQueue(trace, ring, enqueueUpTo)
  expect(ring.droppedWrites).toBe(0)
  expect(cursor).toBe(trace.length)
  expect(batches).toBeGreaterThan(1)
  return out
}

describe('SAB ≡ postMessage', () => {
  it('renders bit-identical audio through both transports (M3 gate)', () => {
    const trace = densePlayTrace()
    expect(trace.length).toBeGreaterThan(RING_CAPACITY)

    const viaSab = renderViaSharedRing(trace)
    const viaPost = renderViaPostMessage(trace)

    expect(sameSamples(viaSab, viaPost)).toBe(true)
    // Not vacuous: the trace has to actually make sound.
    let energy = 0
    for (let i = 0; i < viaSab.length; i++) energy += Math.abs(viaSab[i])
    expect(energy).toBeGreaterThan(1)
  })

  it('and the VRC6 writes in it are load-bearing, not decoration', () => {
    // If the expansion registers were being dropped, truncated or ignored, this
    // comparison would come out identical and the equivalence above would be a claim
    // about the 2A03 only.
    const full = densePlayTrace()
    let vrc6Writes = 0
    const without = new ArrayWriteSink()
    for (let i = 0; i < full.length; i++) {
      const addr = full.addrs[i]
      if (addr >= 0x9000) {
        vrc6Writes++
        continue
      }
      without.write(full.cycles[i], addr, full.values[i])
    }
    expect(vrc6Writes).toBeGreaterThan(2000)
    expect(sameSamples(renderViaSharedRing(full), renderViaSharedRing(without))).toBe(false)
  })

  it('anti-vacuity: a drain that lags by one quantum renders audibly different audio', () => {
    // Without this, "the two paths agree" could be true because the comparison is
    // insensitive. Delaying one drain by a single render quantum — 2.67 ms, the
    // smallest disagreement the transport could have — must show up in the samples.
    const trace = densePlayTrace()
    const buffer = newRing()
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const cyclesPerQuantum = Math.round((QUANTUM * 1_789_773) / SAMPLE_RATE)
    const laggy: WriteDrain = {
      drainUpTo: (limit, sink) => consumer.drainUpTo(limit - cyclesPerQuantum, sink),
      get pending() {
        return consumer.pending
      },
    }
    let cursor = 0
    const out = renderThroughQueue(trace, laggy, (limit) => {
      while (cursor < trace.length && trace.cycles[cursor] <= limit) {
        if (!producer.push(trace.cycles[cursor], trace.addrs[cursor], trace.values[cursor])) break
        cursor++
      }
    })
    expect(sameSamples(out, renderViaSharedRing(trace))).toBe(false)
  })

  it('and both match a direct replay of the same timeline', () => {
    const trace = densePlayTrace()
    const direct = renderWith(
      makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION_SAMPLES }),
      trace,
      { sampleRate: SAMPLE_RATE, durationSamples: DURATION_SAMPLES, quantum: QUANTUM },
    )
    expect(sameSamples(renderViaSharedRing(trace), direct)).toBe(true)
    expect(sameSamples(renderViaPostMessage(trace), direct)).toBe(true)
  })
})
