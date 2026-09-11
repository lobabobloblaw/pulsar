/** The VRC6 expansion chip's register semantics, driven through the real
 *  `Apu2A03.write()` / `runTo()` the worklet uses.
 *
 *  Every case here is ported from the reference implementation's own vector suite
 *  (a prior project of the author's, written from the NESdev wiki's "VRC6 audio"
 *  page — no GPL emulator source was read for either). The reference clocks the chip
 *  one CPU cycle at a time; pulsar instead arms a `nextCycle` per channel and runs a
 *  merged min scan, so these tests re-derive the same numbers through the event model.
 *  Timing claims that survive both are claims about the CHIP.
 *
 *  Rendered-audio claims (pitch, level, determinism) live in vrc6Render.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { Apu2A03 } from '../../src/audio/core/apu2a03'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { VRC6_PULSE_STEPS } from '../../src/audio/core/vrc6/vrc6Pulse'
import { VRC6_SAW_STEPS } from '../../src/audio/core/vrc6/vrc6Saw'

function apu(): Apu2A03 {
  return new Apu2A03({ sampleRate: 48000, maxSamplesPerFrame: 512 })
}

interface PulseSetup {
  duty?: number
  volume?: number
  period?: number
  mode?: number
  channel?: number
}

/** $9000 → $9001 → $9002, enable last. Returns the APU positioned at cycle 0. */
function pulseSetup(a: Apu2A03, opts: PulseSetup = {}): Apu2A03 {
  const duty = opts.duty ?? 7
  const volume = opts.volume ?? 15
  const period = opts.period ?? 253
  const mode = opts.mode ?? 0
  const base = (opts.channel ?? 0) === 0 ? 0x9000 : 0xa000
  a.write(0, base, (mode << 7) | (duty << 4) | volume)
  a.write(0, base + 1, period & 0xff)
  a.write(0, base + 2, 0x80 | ((period >> 8) & 0x0f))
  return a
}

function sawSetup(a: Apu2A03, period: number, rate: number): Apu2A03 {
  a.write(0, 0xb000, rate)
  a.write(0, 0xb001, period & 0xff)
  a.write(0, 0xb002, 0x80 | ((period >> 8) & 0x0f))
  return a
}

/** Run cycle by cycle, the way the reference's `clock()` loop does, reporting every
 *  cycle at which `read()` changed value. */
function edgeCount(a: Apu2A03, cycles: number, read: () => number): number {
  let edges = 0
  let prev = read()
  const from = a.cycle
  for (let c = from + 1; c <= from + cycles; c++) {
    a.runTo(c)
    const now = read()
    if (now !== prev) {
      edges++
      prev = now
    }
  }
  return edges
}

describe('VRC6 pulse', () => {
  it('runs at fCPU / (16·(P+1)) — the 2A03 pulse divisor, reached without the /2', () => {
    for (const p of [253, 100, 1000]) {
      const a = pulseSetup(apu(), { period: p })
      a.runTo(VRC6_PULSE_STEPS * (p + 1)) // skip the partial first period (D-V1)
      const cycles = VRC6_PULSE_STEPS * (p + 1) * 200
      const edges = edgeCount(a, cycles, () => a.vrc6p1.out)
      const hz = (edges / 2) * (NTSC_CPU_HZ / cycles)
      const want = NTSC_CPU_HZ / (VRC6_PULSE_STEPS * (p + 1))
      expect(Math.abs(hz - want) / want).toBeLessThan(0.002)
    }
  })

  it('duty D is a THRESHOLD: high for (D+1) of 16 steps, so D=7 is the 50 % square', () => {
    const p = 60
    for (let d = 0; d < 8; d++) {
      const a = pulseSetup(apu(), { duty: d, period: p })
      a.runTo(VRC6_PULSE_STEPS * (p + 1))
      const total = VRC6_PULSE_STEPS * (p + 1) * 20
      let high = 0
      const from = a.cycle
      for (let c = from + 1; c <= from + total; c++) {
        a.runTo(c)
        if (a.vrc6p1.out > 0) high++
      }
      expect(Math.abs(high / total - (d + 1) / 16)).toBeLessThan(0.002)
    }
  })

  it('mode (bit 7) ignores the sequencer and holds the volume', () => {
    const a = pulseSetup(apu(), { duty: 0, mode: 1, volume: 11, period: 30 })
    let low = 0
    for (let c = 1; c <= 5000; c++) {
      a.runTo(c)
      if (a.vrc6p1.out !== 11) low++
    }
    expect(low).toBe(0)
    // Not vacuous: the same duty WITHOUT the mode bit is low 15 steps out of 16.
    const b = pulseSetup(apu(), { duty: 0, mode: 0, volume: 11, period: 30 })
    let lowB = 0
    for (let c = 1; c <= 5000; c++) {
      b.runTo(c)
      if (b.vrc6p1.out !== 11) lowB++
    }
    expect(lowB).toBeGreaterThan(4000)
  })

  it('both pulses sound and their sum is linear — it reaches 30', () => {
    const a = apu()
    pulseSetup(a, { period: 0, channel: 0 })
    pulseSetup(a, { period: 0, channel: 1 })
    let max = 0
    for (let c = 1; c <= 10_000; c++) {
      a.runTo(c)
      const sum = a.vrc6p1.out + a.vrc6p2.out
      if (sum > max) max = sum
    }
    expect(max).toBe(30)
  })

  it('clearing the enable bit silences the channel and resets its phase', () => {
    const a = pulseSetup(apu(), { period: 30 })
    a.runTo(1000)
    expect(a.vrc6p1.step).toBeGreaterThan(0)
    a.write(1000, 0x9002, 0x00)
    expect(a.vrc6p1.enabled).toBe(false)
    expect(a.vrc6p1.out).toBe(0)
    expect(a.vrc6p1.step).toBe(0)
    a.runTo(2000)
    expect(a.vrc6p1.out).toBe(0)
    expect(a.vrc6p1.nextCycle).toBe(Infinity)
  })
})

describe('VRC6 sawtooth', () => {
  it('walks 0, r, 2r … 6r through the 8-bit accumulator and resets after 14 steps', () => {
    const rate = 42
    const period = 9
    const a = sawSetup(apu(), period, rate)
    const levels: number[] = []
    const stepMarks: number[] = []
    let prev = -1
    let prevStep = a.vrc6saw.step
    for (let c = 1; c <= VRC6_SAW_STEPS * (period + 1) * 4; c++) {
      a.runTo(c)
      if (a.vrc6saw.out !== prev) {
        levels.push(a.vrc6saw.out)
        prev = a.vrc6saw.out
      }
      if (prevStep !== 0 && a.vrc6saw.step === 0) stepMarks.push(c)
      prevStep = a.vrc6saw.step
    }
    // Seven levels per sequence: (k · 42) >> 3 for k = 0..6.
    const want = [0, 5, 10, 15, 21, 26, 31]
    const start = levels.indexOf(0)
    expect(levels.slice(start, start + 7)).toEqual(want)
    expect(levels[start + 7]).toBe(0)
    expect(Math.max(...levels)).toBe(31)
    // 14 steps of (P+1) cycles each.
    for (let i = 1; i < stepMarks.length; i++) {
      expect(stepMarks[i] - stepMarks[i - 1]).toBe(VRC6_SAW_STEPS * (period + 1))
    }
    expect(stepMarks.length).toBeGreaterThan(2)
  })

  it('runs at fCPU / (14·(P+1)) — a 14-step sequence, not 16', () => {
    const p = 200
    const a = sawSetup(apu(), p, 30)
    const marks: number[] = []
    let prevStep = a.vrc6saw.step
    for (let c = 1; c <= VRC6_SAW_STEPS * (p + 1) * 8; c++) {
      a.runTo(c)
      if (prevStep !== 0 && a.vrc6saw.step === 0) marks.push(c)
      prevStep = a.vrc6saw.step
    }
    const per = (marks[marks.length - 1] - marks[0]) / (marks.length - 1)
    expect(per).toBe(VRC6_SAW_STEPS * (p + 1))
    expect(NTSC_CPU_HZ / per).toBeCloseTo(NTSC_CPU_HZ / (VRC6_SAW_STEPS * (p + 1)), 9)
  })

  it('rate 63 wraps the accumulator part-way up the ramp — the documented distortion', () => {
    const a = sawSetup(apu(), 1, 63)
    const levels: number[] = []
    let prev = -1
    for (let c = 1; c <= VRC6_SAW_STEPS * 2 * 6; c++) {
      a.runTo(c)
      if (a.vrc6saw.out !== prev) {
        levels.push(a.vrc6saw.out)
        prev = a.vrc6saw.out
      }
    }
    const start = levels.indexOf(0)
    const ramp = levels.slice(start, start + 7)
    let fell = false
    for (let i = 1; i < ramp.length; i++) if (ramp[i] < ramp[i - 1]) fell = true
    expect(fell).toBe(true)
    // 6 · 63 = 378 > 255, so the fold is arithmetic, not a clamp.
    expect(6 * 63).toBeGreaterThan(0xff)
    // Rate 42 is the largest that does NOT fold — the contrast is the point.
    const clean = sawSetup(apu(), 1, 42)
    let falls = 0
    let last = clean.vrc6saw.out
    for (let c = 1; c <= VRC6_SAW_STEPS * 2; c++) {
      clean.runTo(c)
      if (clean.vrc6saw.out < last && clean.vrc6saw.step !== 0) falls++
      last = clean.vrc6saw.out
    }
    expect(falls).toBe(0)
  })

  it('clearing the enable bit resets step, accumulator and output', () => {
    const a = sawSetup(apu(), 9, 42)
    a.runTo(200)
    expect(a.vrc6saw.accum).toBeGreaterThan(0)
    a.write(200, 0xb002, 0x00)
    expect(a.vrc6saw.enabled).toBe(false)
    expect(a.vrc6saw.step).toBe(0)
    expect(a.vrc6saw.accum).toBe(0)
    expect(a.vrc6saw.out).toBe(0)
    expect(a.vrc6saw.nextCycle).toBe(Infinity)
  })
})

describe('$9003 — one register for all three oscillators', () => {
  it('bit 0 halts every oscillator and HOLDS its level (it is not a mute)', () => {
    const a = pulseSetup(apu(), { period: 20 })
    sawSetup(a, 5, 20)
    a.runTo(500)
    const p = a.vrc6p1.out
    const s = a.vrc6saw.out
    a.write(500, 0x9003, 0x01)
    expect(a.vrc6.halt).toBe(true)
    expect(a.vrc6p1.out).toBe(p)
    expect(a.vrc6saw.out).toBe(s)
    a.runTo(10_500)
    expect(a.vrc6p1.out).toBe(p)
    expect(a.vrc6saw.out).toBe(s)
    expect(a.vrc6p1.nextCycle).toBe(Infinity)
    expect(a.vrc6saw.nextCycle).toBe(Infinity)
    // Not vacuous: released, the same oscillators move again.
    a.write(10_500, 0x9003, 0x00)
    expect(a.vrc6.halt).toBe(false)
    const edges = edgeCount(a, 10_000, () => a.vrc6p1.out + a.vrc6saw.out)
    expect(edges).toBeGreaterThan(100)
  })

  it('bits 2–1 shift every period right by 4 or 8, and bit 2 wins', () => {
    const a = apu()
    a.write(0, 0x9001, 0xff)
    a.write(0, 0x9002, 0x8f) // period $FFF, enabled
    a.write(0, 0xb001, 0xff)
    a.write(0, 0xb002, 0x8f)
    expect(a.vrc6p1.effPeriod).toBe(0xfff)
    expect(a.vrc6saw.effPeriod).toBe(0xfff)

    a.write(0, 0x9003, 0x02)
    expect(a.vrc6.shift).toBe(4)
    expect(a.vrc6p1.effPeriod).toBe(0xfff >> 4)
    expect(a.vrc6saw.effPeriod).toBe(0xfff >> 4)

    a.write(0, 0x9003, 0x04)
    expect(a.vrc6.shift).toBe(8)
    expect(a.vrc6p1.effPeriod).toBe(0xfff >> 8)

    a.write(0, 0x9003, 0x06) // both bits: bit 2 wins
    expect(a.vrc6.shift).toBe(8)
    expect(a.vrc6p1.effPeriod).toBe(0xfff >> 8)

    a.write(0, 0x9003, 0x00)
    expect(a.vrc6.shift).toBe(0)
    expect(a.vrc6p1.effPeriod).toBe(0xfff)
  })

  it('and the shift is audible, not bookkeeping: >> 4 runs more than 10× faster', () => {
    const plain = pulseSetup(apu(), { period: 0xff })
    const shifted = pulseSetup(apu(), { period: 0xff })
    shifted.write(0, 0x9003, 0x02)
    const ea = edgeCount(plain, 200_000, () => plain.vrc6p1.out)
    const eb = edgeCount(shifted, 200_000, () => shifted.vrc6p1.out)
    expect(eb).toBeGreaterThan(ea * 10)
  })
})

describe('power-up and reset', () => {
  it('powers up silent, armed at nothing, with $9003 clear', () => {
    const a = apu()
    expect(a.vrc6.halt).toBe(false)
    expect(a.vrc6.shift).toBe(0)
    expect(a.vrc6p1.nextCycle).toBe(Infinity)
    expect(a.vrc6p2.nextCycle).toBe(Infinity)
    expect(a.vrc6saw.nextCycle).toBe(Infinity)
    expect(a.vrc6p1.out + a.vrc6p2.out + a.vrc6saw.out).toBe(0)
    a.runTo(100_000)
    expect(a.vrc6p1.out + a.vrc6p2.out + a.vrc6saw.out).toBe(0)
  })

  it('reset() clears the whole chip', () => {
    const a = pulseSetup(apu(), { period: 20 })
    sawSetup(a, 5, 42)
    a.write(0, 0x9003, 0x03)
    a.runTo(1000)
    a.reset()
    expect(a.vrc6p1.enabled).toBe(false)
    expect(a.vrc6p2.enabled).toBe(false)
    expect(a.vrc6saw.enabled).toBe(false)
    expect(a.vrc6saw.accum).toBe(0)
    expect(a.vrc6.halt).toBe(false)
    expect(a.vrc6.shift).toBe(0)
    a.runTo(1000)
    expect(a.vrc6p1.out + a.vrc6p2.out + a.vrc6saw.out).toBe(0)
  })

  it('the chip is the same objects the APU aliases — one state, two names', () => {
    const a = apu()
    expect(a.vrc6p1).toBe(a.vrc6.pulse1)
    expect(a.vrc6p2).toBe(a.vrc6.pulse2)
    expect(a.vrc6saw).toBe(a.vrc6.saw)
  })
})

describe('the cached VRC6 sum', () => {
  it('never goes stale: it equals the three outs at every point of a busy trace', () => {
    // `Apu2A03.emit()` reads a cached `vrc6Sum` rather than the three channels, so
    // every path that can move a VRC6 output has to restore it. This walks a trace
    // that exercises all of them — enables, disables, control and period writes,
    // halts, shifts and plain stepping — and checks the invariant after each cycle.
    const a = apu()
    let seed = 0x1234abcd
    const rnd = (n: number): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return (seed >>> 8) % n
    }
    const addrs = [0x9000, 0x9001, 0x9002, 0x9003, 0xa000, 0xa001, 0xa002, 0xb000, 0xb001, 0xb002]
    let mismatches = 0
    let nonZeroSeen = 0
    for (let c = 1; c <= 60_000; c++) {
      if (c % 37 === 0) a.write(c, addrs[rnd(addrs.length)], rnd(256))
      a.runTo(c)
      const live = a.vrc6p1.out + a.vrc6p2.out + a.vrc6saw.out
      if (a.vrc6Sum !== live) mismatches++
      if (live !== 0) nonZeroSeen++
    }
    expect(mismatches).toBe(0)
    // Not vacuous: the trace really does put level on the chip most of the time.
    expect(nonZeroSeen).toBeGreaterThan(10_000)
  })

  it('and reset() clears it', () => {
    const a = pulseSetup(apu(), { period: 20 })
    a.runTo(100)
    expect(a.vrc6Sum).toBeGreaterThan(0)
    a.reset()
    expect(a.vrc6Sum).toBe(0)
  })
})
