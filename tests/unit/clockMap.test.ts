/** The cycle ↔ sample map and the wire encoding.
 *
 *  Both threads import `timeline/clockMap` and `timeline/types`; if the host and the
 *  worklet ever disagreed about what cycle a keypress belongs to, notes would land in
 *  the wrong render quantum and nothing downstream would notice.
 *  `writeRing.test.ts` carries the rest of the transport story: ring wrap, drop
 *  accounting and SAB ≡ postMessage equivalence.
 */
import { describe, expect, it } from 'vitest'
import {
  cycleForSample,
  cyclesForMs,
  makeClockAnchor,
  msToCycles,
  nowCycle,
  sampleForCycle,
} from '../../src/audio/timeline/clockMap'
import {
  RingConsumer,
  RingProducer,
  createRingBuffer,
} from '../../src/audio/protocol/writeRing'
import { TIME_UNIT, factorFor } from '../../src/audio/dsp/bandlimitedBuf'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { decodeAddr, decodeValue, encodeWrite } from '../../src/audio/timeline/types'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { makeApu, pulseNoteOnTrace, renderWith } from '../helpers/renderTrace'
import { sameSamples } from '../helpers/analysis'

const ANCHOR = makeClockAnchor(0, 48000, NTSC_CPU_HZ)

describe('ClockAnchor', () => {
  it('carries the same factor the engine uses — one number, one source', () => {
    expect(ANCHOR.factor).toBe(factorFor(NTSC_CPU_HZ, 48000))
    expect(ANCHOR.factor).toBe(112487)
    expect(makeClockAnchor(0, 44100, NTSC_CPU_HZ).factor).toBe(103348)
  })

  it('a 6 ms scheduling lead is 10 739 NTSC cycles', () => {
    expect(cyclesForMs(ANCHOR, 6)).toBe(10739)
    expect(cyclesForMs(ANCHOR, 3)).toBe(5369)
    expect(cyclesForMs(ANCHOR, 25)).toBe(44744)
  })

  it('the anchor-free form the live scheduler uses is the same conversion', () => {
    // LiveScheduler adapts its lead before the anchor has arrived, so it converts
    // from the clock rate alone. One formula, or the lead would mean two things.
    for (const ms of [0.5, 3, 6, 6.5, 25]) {
      expect(msToCycles(NTSC_CPU_HZ, ms)).toBe(cyclesForMs(ANCHOR, ms))
    }
  })
})

describe('sampleForCycle / cycleForSample', () => {
  it('agree with the naive formula in the range where the naive formula is exact', () => {
    for (const c of [0, 1, 4773, 100_000, 1_789_773, 12_345_678]) {
      expect(sampleForCycle(ANCHOR, c)).toBe(Math.floor((c * ANCHOR.factor) / TIME_UNIT))
    }
  })

  it('round-trips: the cycle for a sample renders in that sample', () => {
    for (let s = 0; s < 5000; s += 37) {
      expect(sampleForCycle(ANCHOR, cycleForSample(ANCHOR, s))).toBe(s)
    }
  })

  it('cycleForSample is the FIRST cycle of the sample — one earlier is the sample before', () => {
    for (let s = 1; s < 2000; s += 13) {
      const c = cycleForSample(ANCHOR, s)
      expect(sampleForCycle(ANCHOR, c)).toBe(s)
      expect(sampleForCycle(ANCHOR, c - 1)).toBe(s - 1)
    }
  })

  it('stays exact past 2^53 / factor, where the naive product loses integer precision', () => {
    // 1e12 cycles ≈ 155 hours. c · factor is 1.1e17 here — well past 2^53, so a naive
    // `Math.floor(c * factor / TIME_UNIT)` starts returning wrong integers. The split
    // form does not.
    const c = 1e12
    expect(c * ANCHOR.factor).toBeGreaterThan(Number.MAX_SAFE_INTEGER)
    const split = sampleForCycle(ANCHOR, c)
    // Exact rational value of floor(c·factor / 2^22).
    const hi = Math.floor(c / TIME_UNIT)
    const lo = c - hi * TIME_UNIT
    expect(split).toBe(hi * ANCHOR.factor + Math.floor((lo * ANCHOR.factor) / TIME_UNIT))
    expect(Number.isSafeInteger(split)).toBe(true)
    // And it still round-trips at that magnitude.
    expect(sampleForCycle(ANCHOR, cycleForSample(ANCHOR, split))).toBe(split)
  })

  it('monotonic over a long sweep', () => {
    let prev = -1
    for (let c = 0; c < 2_000_000; c += 1237) {
      const s = sampleForCycle(ANCHOR, c)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
  })

  it('nowCycle clamps a pre-start context time to zero rather than going negative', () => {
    const late = makeClockAnchor(4800, 48000, NTSC_CPU_HZ)
    expect(nowCycle(late, 0)).toBe(0)
    expect(nowCycle(late, 0.1)).toBe(cycleForSample(late, 0))
    expect(nowCycle(late, 0.2)).toBeGreaterThan(0)
  })

  it('nowCycle advances one sample per 1/fs of context time', () => {
    const a = nowCycle(ANCHOR, 1.0)
    const b = nowCycle(ANCHOR, 1.0 + 100 / 48000)
    // `Math.ceil(contextTime · fs)` inherits whatever float noise `currentTime`
    // carries, so the result can land one sample either side. That is fine and is not
    // worth an epsilon fudge: the scheduling lead is 288 samples at 6 ms, three orders
    // of magnitude larger than this ambiguity.
    const delta = sampleForCycle(ANCHOR, b) - sampleForCycle(ANCHOR, a)
    expect(Math.abs(delta - 100)).toBeLessThanOrEqual(1)
  })

  it('nowCycle is monotonic in context time', () => {
    let prev = -1
    for (let i = 0; i < 500; i++) {
      const c = nowCycle(ANCHOR, i / 1000)
      expect(c).toBeGreaterThanOrEqual(prev)
      prev = c
    }
  })
})

describe('wire encoding', () => {
  it('round-trips every register and every byte value', () => {
    for (let addr = 0x4000; addr <= 0x4017; addr++) {
      for (let value = 0; value < 256; value++) {
        const code = encodeWrite(addr, value)
        expect(decodeAddr(code)).toBe(addr)
        expect(decodeValue(code)).toBe(value)
      }
    }
  })

  it('fits in 16 bits, so an Int32Array slot is never a lie', () => {
    for (let addr = 0x4000; addr <= 0x4017; addr++) {
      const code = encodeWrite(addr, 0xff)
      expect(code).toBeGreaterThanOrEqual(0)
      expect(code).toBeLessThan(0x10000)
    }
  })
})

describe('the transport encoding is lossless end to end', () => {
  it('a batch encoded, ring-drained and decoded renders identically to direct writes', () => {
    const SAMPLE_RATE = 48000
    const DURATION = 12000
    const trace = pulseNoteOnTrace(0, 253, 2, 15)

    const direct = renderWith(makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION }), trace, {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })

    // Encode exactly the way EngineHandle.write does, then decode exactly the way the
    // worklet's drainUpTo does.
    const cycles = new Float64Array(trace.length)
    const codes = new Int32Array(trace.length)
    for (let i = 0; i < trace.length; i++) {
      cycles[i] = trace.cycles[i]
      codes[i] = encodeWrite(trace.addrs[i], trace.values[i])
    }
    const decoded = new ArrayWriteSink()
    for (let i = 0; i < codes.length; i++) {
      decoded.write(cycles[i], decodeAddr(codes[i]), decodeValue(codes[i]))
    }
    const viaWire = renderWith(
      makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION }),
      decoded,
      { sampleRate: SAMPLE_RATE, durationSamples: DURATION },
    )

    expect(sameSamples(direct, viaWire)).toBe(true)
  })

  it('and the same holds through the real SPSC ring, not just the encoding', () => {
    const SAMPLE_RATE = 48000
    const DURATION = 12000
    const trace = pulseNoteOnTrace(0, 253, 2, 15)

    const direct = renderWith(makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION }), trace, {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })

    const buffer = createRingBuffer(SAMPLE_RATE, false)
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    for (let i = 0; i < trace.length; i++) {
      expect(producer.push(trace.cycles[i], trace.addrs[i], trace.values[i])).toBe(true)
    }
    const decoded = new ArrayWriteSink()
    expect(consumer.drainUpTo(Infinity, decoded)).toBe(trace.length)

    const viaRing = renderWith(
      makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION }),
      decoded,
      { sampleRate: SAMPLE_RATE, durationSamples: DURATION },
    )
    expect(sameSamples(direct, viaRing)).toBe(true)
  })

  it('carries a cycle stamp exactly, at magnitudes where an int32 would have wrapped', () => {
    // The ring stores cycles in a Float64Array precisely so this holds: 3e9 is past
    // int32 (~20 minutes of audio), 9e15 is at the edge of exact f64 integers.
    const buffer = createRingBuffer(48000, false)
    const producer = new RingProducer(buffer)
    const consumer = new RingConsumer(buffer)
    const stamps = [0, 1, 2 ** 31 - 1, 2 ** 31, 3e9, 1e12, 9e15]
    for (let i = 0; i < stamps.length; i++) producer.push(stamps[i], 0x4002, i)
    const out = new ArrayWriteSink()
    consumer.drainUpTo(Infinity, out)
    expect(out.cycles).toEqual(stamps)
    for (let i = 0; i < stamps.length; i++) {
      expect(Number.isSafeInteger(out.cycles[i])).toBe(true)
      expect(out.values[i]).toBe(i)
    }
  })
})
