import { describe, expect, it } from 'vitest'
import {
  BandlimitedBuf,
  KERNEL_WIDTH,
  TIME_BITS,
  TIME_UNIT,
  factorFor,
} from '../../src/audio/dsp/bandlimitedBuf'
import { KERNEL_GROUP_DELAY, STEP_KERNEL } from '../../src/audio/dsp/kernel'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'

function renderStep(delayCycles: number, samples: number): Float64Array {
  const buf = new BandlimitedBuf(samples + 64)
  buf.setRates(NTSC_CPU_HZ, 48000)
  buf.addDelta(delayCycles, 1)
  buf.endFrame(buf.cyclesForSamples(samples))
  const out = new Float64Array(samples)
  buf.readSamples(out, 0, samples)
  return out
}

/** Sample index where a rendered unit step passes 0.5, linearly interpolated. */
function stepCrossing(out: Float64Array): number {
  for (let i = 1; i < out.length; i++) {
    if (out[i - 1] < 0.5 && out[i] >= 0.5) {
      return i - 1 + (0.5 - out[i - 1]) / (out[i] - out[i - 1])
    }
  }
  return NaN
}

describe('fixed-point time', () => {
  it('TIME_BITS = 22, TIME_UNIT = 4 194 304', () => {
    expect(TIME_BITS).toBe(22)
    expect(TIME_UNIT).toBe(4_194_304)
    expect(TIME_UNIT).toBe(Math.pow(2, TIME_BITS))
  })

  it('factorFor matches the pinned values', () => {
    expect(factorFor(NTSC_CPU_HZ, 48000)).toBe(112487)
    expect(factorFor(NTSC_CPU_HZ, 44100)).toBe(103348)
  })

  it('the 48 kHz factor is −1.97 ppm off exact — the documented D-B1 deviation', () => {
    const exact = (TIME_UNIT * 48000) / NTSC_CPU_HZ
    const ppm = (112487 / exact - 1) * 1e6
    expect(ppm).toBeCloseTo(-1.9697, 3)
    // −0.0034 cents; far below anything audible.
    expect(Math.abs(1200 * Math.log2(112487 / exact))).toBeLessThan(0.005)
  })

  it('handles the other supported rates without collapsing', () => {
    for (const fs of [16000, 44100, 48000, 88200, 96000]) {
      const f = factorFor(NTSC_CPU_HZ, fs)
      expect(f).toBeGreaterThan(0)
      expect(Number.isInteger(f)).toBe(true)
      const impliedRate = (f * NTSC_CPU_HZ) / TIME_UNIT
      expect(Math.abs(impliedRate / fs - 1)).toBeLessThan(1e-5)
    }
  })
})

describe('unit-step convergence', () => {
  it('a single unit delta integrates to exactly 1.0 and stays there', () => {
    const out = renderStep(0, 200)
    expect(out[199]).toBeCloseTo(1, 12)
    expect(out[120]).toBeCloseTo(1, 12)
  })

  it('scales linearly and superposes', () => {
    const single = renderStep(0, 128)
    const buf = new BandlimitedBuf(256)
    buf.setRates(NTSC_CPU_HZ, 48000)
    buf.addDelta(0, 0.25)
    buf.addDelta(0, 0.75)
    buf.endFrame(buf.cyclesForSamples(128))
    const out = new Float64Array(128)
    buf.readSamples(out, 0, 128)
    for (let i = 0; i < 128; i++) expect(out[i]).toBeCloseTo(single[i], 12)
  })

  it('the overshoot is the expected ~3.3 % Gibbs ripple of a 0.465·fs cutoff', () => {
    const out = renderStep(0, 200)
    let peak = 0
    for (let i = 0; i < out.length; i++) if (out[i] > peak) peak = out[i]
    expect(peak).toBeCloseTo(1.03316203191, 9)
  })
})

describe('group delay', () => {
  it('the kernel is linear phase with a 15-sample delay', () => {
    // First moment of the phase-0 impulse response.
    let sum = 0
    let moment = 0
    for (let i = 0; i < KERNEL_WIDTH; i++) {
      sum += STEP_KERNEL[i]
      moment += i * STEP_KERNEL[i]
    }
    const centroid = moment / sum
    expect(centroid).toBeCloseTo(15, 3)
    expect(Math.abs(centroid - KERNEL_GROUP_DELAY)).toBeLessThan(0.5)
  })

  it('a rendered step reaches half amplitude within 15 ± 0.5 samples', () => {
    const crossing = stepCrossing(renderStep(0, 200))
    expect(Math.abs(crossing - 15)).toBeLessThanOrEqual(0.5)
    // Precisely 14.5: `readSamples` integrates THROUGH sample i, so the cumulative
    // sum contributes the standard half-sample of a running integrator on top of the
    // kernel's own 15. End-to-end latency should be budgeted at 15 samples = 0.31 ms
    // (deviation D-B2), which is the conservative figure.
    expect(crossing).toBeCloseTo(14.5, 4)
  })

  it('the delay is independent of sub-sample phase', () => {
    // Half a sample of clock time ≈ 18.6 cycles at 48 kHz.
    const a = stepCrossing(renderStep(0, 200))
    const b = stepCrossing(renderStep(19, 200))
    expect(b - a).toBeGreaterThan(0.4)
    expect(b - a).toBeLessThan(0.6)
  })
})

describe('cyclesForSamples', () => {
  it('128 samples from a fresh buffer is 4773 cycles at 48 kHz', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    expect(buf.cyclesForSamples(128)).toBe(4773)
  })

  it('always yields at least the requested count', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    const out = new Float64Array(128)
    for (let f = 0; f < 500; f++) {
      const avail = buf.endFrame(buf.cyclesForSamples(128))
      expect(avail).toBeGreaterThanOrEqual(128)
      expect(buf.readSamples(out, 0, 128)).toBe(128)
    }
  })
})

describe('long-run bookkeeping', () => {
  it('one million 128-sample frames drift by less than 3 ppm and leave offset bounded', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    const out = new Float64Array(128)
    let totalCycles = 0
    let totalSamples = 0
    for (let f = 0; f < 1_000_000; f++) {
      const c = buf.cyclesForSamples(128)
      totalCycles += c
      buf.endFrame(c)
      totalSamples += buf.readSamples(out, 0, 128)
    }
    expect(totalSamples).toBe(128_000_000)
    // 2 665 s of audio — well past the 2^31 cycle boundary that an int32 would wrap at.
    expect(totalCycles).toBeGreaterThan(2 ** 31)
    const impliedRate = totalSamples / (totalCycles / NTSC_CPU_HZ)
    const ppm = (impliedRate / 48000 - 1) * 1e6
    expect(Math.abs(ppm)).toBeLessThan(3)
    expect(ppm).toBeCloseTo(-1.97, 1)
    // The residual never accumulates: offset stays inside one sample.
    expect(buf.offset).toBeGreaterThanOrEqual(0)
    expect(buf.offset).toBeLessThan(TIME_UNIT)
  })

  it('a one-second frame renders correctly — the test that catches `t >> TIME_BITS`', () => {
    const buf = new BandlimitedBuf(48_100)
    buf.setRates(NTSC_CPU_HZ, 48000)
    buf.addDelta(0, 1)
    // Fixed-point time for one second is 2.01e11: an int32 shift would produce garbage.
    const fixedPointTime = NTSC_CPU_HZ * buf.factor
    expect(fixedPointTime).toBe(201_326_195_451)
    expect(fixedPointTime).toBeGreaterThan(2 ** 31)

    const avail = buf.endFrame(NTSC_CPU_HZ)
    expect(avail).toBe(47_999)
    const out = new Float64Array(48_100)
    const n = buf.readSamples(out, 0, 48_100)
    expect(n).toBe(47_999)
    expect(out[n - 1]).toBeCloseTo(1, 12)
    // A `>>` would fold the position back near zero and the step would land at the
    // wrong sample entirely; assert the step is where it belongs.
    expect(stepCrossing(out)).toBeCloseTo(14.5, 4)
  })

  it('a delta late in a long frame lands at the right sample', () => {
    const buf = new BandlimitedBuf(48_100)
    buf.setRates(NTSC_CPU_HZ, 48000)
    // Half a second in.
    const at = Math.round(NTSC_CPU_HZ / 2)
    buf.addDelta(at, 1)
    buf.endFrame(NTSC_CPU_HZ)
    const out = new Float64Array(48_100)
    const n = buf.readSamples(out, 0, 48_100)
    const crossing = stepCrossing(out.subarray(0, n))
    const expected = (at * buf.factor) / TIME_UNIT + 14.5
    expect(Math.abs(crossing - expected)).toBeLessThan(1)
  })
})

describe('overflow and clearing', () => {
  it('throws RangeError rather than silently corrupting the buffer', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    expect(() => buf.endFrame(buf.cyclesForSamples(600))).toThrow(RangeError)
    expect(() => buf.endFrame(buf.cyclesForSamples(600))).toThrow(/overflow/)
  })

  it('leaves exactly one kernel width of headroom', () => {
    const buf = new BandlimitedBuf(512)
    expect(buf.buf.length).toBe(512 + KERNEL_WIDTH + 2)
    buf.setRates(NTSC_CPU_HZ, 48000)
    expect(() => buf.endFrame(buf.cyclesForSamples(512))).not.toThrow()
  })

  it('clear() resets time, the integrator and the delta buffer', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    buf.addDelta(0, 1)
    buf.endFrame(buf.cyclesForSamples(128))
    const out = new Float64Array(128)
    buf.readSamples(out, 0, 128)
    expect(buf.integratorValue).toBeCloseTo(1, 12)

    buf.clear()
    expect(buf.integratorValue).toBe(0)
    expect(buf.offset).toBe(0)
    expect(buf.samplesAvail).toBe(0)
    for (let i = 0; i < buf.buf.length; i++) expect(buf.buf[i]).toBe(0)
  })

  it('readSamples returns what is actually available, never more', () => {
    const buf = new BandlimitedBuf(512)
    buf.setRates(NTSC_CPU_HZ, 48000)
    buf.endFrame(buf.cyclesForSamples(10))
    const avail = buf.samplesAvail
    expect(avail).toBe(10)
    const out = new Float64Array(128)
    expect(buf.readSamples(out, 0, 128)).toBe(avail)
    expect(buf.samplesAvail).toBe(0)
  })
})
