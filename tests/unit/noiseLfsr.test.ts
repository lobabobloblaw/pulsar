/** Noise LFSR — exact periods and exact bit sequences.
 *
 *  This is the one unit where "sounds about right" is not a test: the short mode's
 *  93-step sequence is short enough to hear as a PITCH, so a wrong tap position or a
 *  wrong shift direction produces a different note, not a different noise. The full
 *  93-bit cycle is therefore pinned literally below, along with the first 40 bits of
 *  both modes from the power-up seed.
 *
 *  Bit convention: each character is `reg & 1` for successive register states, starting
 *  with the seed itself. A '1' means the channel is SILENCED for that step — the mixer
 *  receives the envelope volume only while bit 0 is clear.
 */
import { describe, expect, it } from 'vitest'
import { NoiseLfsr } from '../../src/audio/core/units/noiseLfsr'
import { NOISE_PERIOD_NTSC, NOISE_PERIOD_PAL } from '../../src/audio/core/tables'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { makeApu } from '../helpers/renderTrace'

const MODE0_FIRST_40 = '1000000000000001000000000000011000000000'
const MODE1_FIRST_40 = '1000000000000001000000001000001001000000'
const MODE1_FULL_93 =
  '100000000000000100000000100000100100000000100100100100100000000000100100000100100100000100000'

/** Six seeds spanning the register: power-up, one bit, alternating, and all-ones. */
const SEEDS = [0x0001, 0x0002, 0x0555, 0x2aaa, 0x4001, 0x7fff]

function bits(seed: number, mode: boolean, count: number): string {
  const lfsr = new NoiseLfsr()
  lfsr.reg = seed
  lfsr.mode = mode
  let s = ''
  for (let i = 0; i < count; i++) {
    s += lfsr.reg & 1
    lfsr.clock()
  }
  return s
}

function period(seed: number, mode: boolean): number {
  const lfsr = new NoiseLfsr()
  lfsr.reg = seed
  lfsr.mode = mode
  let n = 0
  do {
    lfsr.clock()
    n++
    if (n > 100_000) return -1
  } while (lfsr.reg !== seed)
  return n
}

describe('periods', () => {
  it('mode 0 (long) has period 32767 from every one of the six seeds', () => {
    for (const seed of SEEDS) expect(period(seed, false)).toBe(32767)
  })

  it('mode 1 (short) has period 93 from every one of the six seeds', () => {
    for (const seed of SEEDS) expect(period(seed, true)).toBe(93)
  })

  it('mode 0 is maximal-length: every non-zero state is on the same 32767 cycle', () => {
    const seen = new Uint8Array(32768)
    const lfsr = new NoiseLfsr()
    for (let i = 0; i < 32767; i++) {
      expect(seen[lfsr.reg]).toBe(0)
      seen[lfsr.reg] = 1
      lfsr.clock()
    }
    expect(lfsr.reg).toBe(1)
    expect(seen[0]).toBe(0)
  })

  it('the register never reaches 0 in either mode', () => {
    const long = new NoiseLfsr()
    for (let i = 0; i < 32767; i++) {
      long.clock()
      expect(long.reg).not.toBe(0)
    }
    const short = new NoiseLfsr()
    short.mode = true
    for (let i = 0; i < 93 * 4; i++) {
      short.clock()
      expect(short.reg).not.toBe(0)
    }
  })

  it('short mode also has one 31-state orbit — unreachable from the power-up seed', () => {
    // A hardware curiosity worth pinning: the short-mode map is a bijection, so the 31
    // states on that orbit can never be entered from reg = 1. 32736 states are on the
    // 93 cycle, 31 on the other one, 32767 total.
    let on93 = 0
    let on31 = 0
    for (let seed = 1; seed < 32768; seed++) {
      const p = period(seed, true)
      if (p === 93) on93++
      else if (p === 31) on31++
      else throw new Error(`unexpected short-mode period ${p} for seed ${seed}`)
    }
    expect(on93).toBe(32736)
    expect(on31).toBe(31)
    expect(period(0x0737, true)).toBe(31)
  })
})

describe('exact bit sequences', () => {
  it('mode 0 from the power-up seed: the first 40 bits', () => {
    expect(bits(1, false, 40)).toBe(MODE0_FIRST_40)
    // The leading 1 walks up to bit 14 and takes fourteen clocks to come back down.
    expect(MODE0_FIRST_40.indexOf('1', 1)).toBe(15)
  })

  it('mode 1 from the power-up seed: the first 40 bits', () => {
    expect(bits(1, true, 40)).toBe(MODE1_FIRST_40)
    // The two modes are identical until the bit-6 tap first sees a 1 — clock 24.
    expect(MODE1_FIRST_40.slice(0, 24)).toBe(MODE0_FIRST_40.slice(0, 24))
    expect(MODE1_FIRST_40[24]).not.toBe(MODE0_FIRST_40[24])
  })

  it('mode 1: the complete 93-bit cycle, then it repeats exactly', () => {
    expect(bits(1, true, 93)).toBe(MODE1_FULL_93)
    expect(MODE1_FULL_93.length).toBe(93)
    expect(bits(1, true, 186)).toBe(MODE1_FULL_93 + MODE1_FULL_93)
    // 16 of the 93 steps are silenced, so short-mode noise is loud and tonal rather
    // than the ~50 % duty of the long mode.
    expect(MODE1_FULL_93.split('').filter((c) => c === '1').length).toBe(16)
  })

  it('mode 0 is balanced: 16384 of the 32767 steps are silenced', () => {
    const long = new NoiseLfsr()
    let ones = 0
    for (let i = 0; i < 32767; i++) {
      if (long.silenced) ones++
      long.clock()
    }
    expect(ones).toBe(16384)
  })

  it('`silenced` is exactly bit 0', () => {
    const lfsr = new NoiseLfsr()
    for (let i = 0; i < 200; i++) {
      expect(lfsr.silenced).toBe((lfsr.reg & 1) === 1)
      lfsr.clock()
    }
  })
})

describe('period tables', () => {
  it('index 0 clocks the LFSR at 447 443.25 Hz', () => {
    expect(NOISE_PERIOD_NTSC[0]).toBe(4)
    expect(NTSC_CPU_HZ / NOISE_PERIOD_NTSC[0]).toBe(447_443.25)
  })

  it('both tables have 16 entries and rise monotonically', () => {
    for (const table of [NOISE_PERIOD_NTSC, NOISE_PERIOD_PAL]) {
      expect(table.length).toBe(16)
      for (let i = 1; i < 16; i++) expect(table[i]).toBeGreaterThan(table[i - 1])
    }
  })

  it('PAL is a different table, not a scaled NTSC one', () => {
    expect(Array.from(NOISE_PERIOD_PAL)).toEqual([
      4, 8, 14, 30, 60, 88, 118, 148, 188, 236, 354, 472, 708, 944, 1890, 3778,
    ])
    expect(NOISE_PERIOD_PAL[2] / NOISE_PERIOD_NTSC[2]).not.toBe(
      NOISE_PERIOD_PAL[15] / NOISE_PERIOD_NTSC[15],
    )
  })

  it('the tonal frequencies of short mode span the audible range', () => {
    // f = clock / (period · 93). Index 0 is 4811 Hz; index 15 is 4.73 Hz.
    expect(NTSC_CPU_HZ / NOISE_PERIOD_NTSC[0] / 93).toBeCloseTo(4811.22, 2)
    expect(NTSC_CPU_HZ / NOISE_PERIOD_NTSC[15] / 93).toBeCloseTo(4.73, 2)
  })
})

describe('through the APU', () => {
  it('$400E selects the tap mode and the period index', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x400e, 0x00)
    expect(apu.noise.lfsr.mode).toBe(false)
    expect(apu.noise.periodIndex).toBe(0)
    expect(apu.noise.periodCycles).toBe(4)
    apu.write(0, 0x400e, 0x8f)
    expect(apu.noise.lfsr.mode).toBe(true)
    expect(apu.noise.periodIndex).toBe(15)
    expect(apu.noise.periodCycles).toBe(4068)
  })

  it('clocks at exactly the table period and silences on bit 0', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x08)
    apu.write(0, 0x400c, 0x3f) // halt, constant volume 15
    apu.write(0, 0x400e, 0x04) // index 4 → 64 cycles
    apu.write(0, 0x400f, 0x00) // load length
    expect(apu.noise.nextCycle).toBe(64)
    // Power-up register is 1 → silenced → out 0.
    expect(apu.noise.out).toBe(0)
    apu.runTo(64)
    expect(apu.noise.lfsr.reg).toBe(0x4000)
    expect(apu.noise.out).toBe(15)
    expect(apu.noise.nextCycle).toBe(128)
  })

  it('the output follows a decaying envelope, step by step', () => {
    // The channel caches the envelope level for the hot path; this is the test that
    // catches that cache going stale on a quarter-frame clock.
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x08)
    apu.write(0, 0x400c, 0x20) // halt/loop set, envelope mode, V = 0 → one step per clock
    apu.write(0, 0x400e, 0x0f) // slow period so the LFSR does not race ahead
    apu.write(0, 0x400f, 0x00)
    apu.runTo(7457)
    expect(apu.noise.envelope.decayLevel).toBe(15)
    for (let clock = 1; clock <= 6; clock++) {
      apu.runTo(29830 * Math.floor(clock / 4) + [7457, 14913, 22371, 29829][clock % 4])
      const expected = apu.noise.lfsr.silenced ? 0 : apu.noise.envelope.decayLevel
      expect(apu.noise.out).toBe(expected)
    }
    expect(apu.noise.envelope.decayLevel).toBeLessThan(15)
  })

  it('the LFSR is frozen while the length counter is 0 (deviation D-P2)', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x08)
    apu.write(0, 0x400c, 0x3f)
    apu.write(0, 0x400e, 0x00)
    expect(apu.noise.nextCycle).toBe(Infinity)
    apu.runTo(1_000_000)
    expect(apu.noise.lfsr.reg).toBe(1)
    expect(apu.stats.eventsProcessed).toBe(0)
  })
})
