/** Length counter — the table, the halt bit, and the enable bit's two jobs.
 *
 *  blargg's length-counter ROM reads the loaded value back through $4015 for all 32
 *  table indices, so the table itself is a behavioural contract, not an internal
 *  detail. The two rules that are easy to half-implement are asserted end to end
 *  through the APU: clearing a channel's $4015 bit forces the counter to 0 AND blocks
 *  every later load, and the halt bit freezes the counter without zeroing it.
 */
import { describe, expect, it } from 'vitest'
import { LENGTH_TABLE } from '../../src/audio/core/tables'
import { LengthCounter } from '../../src/audio/core/units/lengthCounter'
import { makeApu } from '../helpers/renderTrace'

/** The whole table, as blargg's test reads it back. */
const EXPECTED = [
  10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14, 12, 16, 24, 18, 48, 20, 96,
  22, 192, 24, 72, 26, 16, 28, 32, 30,
]

function loaded(index: number): number {
  const lc = new LengthCounter()
  lc.setEnabled(true)
  lc.load(index)
  return lc.counter
}

describe('the length table', () => {
  it('has 32 entries and matches the hardware table exactly', () => {
    expect(LENGTH_TABLE.length).toBe(32)
    expect(Array.from(LENGTH_TABLE)).toEqual(EXPECTED)
  })

  it('load(0x00) = 10, load(0x01) = 254, load(0x1F) = 30', () => {
    expect(loaded(0x00)).toBe(10)
    expect(loaded(0x01)).toBe(254)
    expect(loaded(0x1f)).toBe(30)
  })

  it('the odd entries are just the index minus one — except index 1, which is 254', () => {
    expect(LENGTH_TABLE[1]).toBe(254)
    for (let i = 3; i < 32; i += 2) {
      expect(LENGTH_TABLE[i]).toBe(i - 1)
    }
    // The even entries are the musical series (whole notes at 60 Hz and their
    // subdivisions), which is why they are not monotonic.
    expect(LENGTH_TABLE[0]).toBe(10)
    expect(LENGTH_TABLE[2]).toBe(20)
    expect(LENGTH_TABLE[24]).toBe(192)
  })

  it('every entry is reachable and non-zero', () => {
    for (let i = 0; i < 32; i++) {
      expect(loaded(i)).toBe(EXPECTED[i])
      expect(loaded(i)).toBeGreaterThan(0)
    }
  })

  it('masks the index to five bits', () => {
    expect(loaded(0x20)).toBe(loaded(0x00))
    expect(loaded(0xff)).toBe(loaded(0x1f))
  })
})

describe('halt and enable', () => {
  it('counts down one per half-frame clock and stops at 0', () => {
    const lc = new LengthCounter()
    lc.setEnabled(true)
    lc.load(0x03) // 2
    expect(lc.active).toBe(true)
    lc.clockHalf()
    expect(lc.counter).toBe(1)
    lc.clockHalf()
    expect(lc.counter).toBe(0)
    expect(lc.active).toBe(false)
    lc.clockHalf()
    expect(lc.counter).toBe(0)
  })

  it('the halt bit freezes the counter in place — it does not zero it', () => {
    const lc = new LengthCounter()
    lc.setEnabled(true)
    lc.load(0x00) // 10
    lc.halt = true
    for (let i = 0; i < 1000; i++) lc.clockHalf()
    expect(lc.counter).toBe(10)
    // Unhalting resumes from where it stopped.
    lc.halt = false
    lc.clockHalf()
    expect(lc.counter).toBe(9)
  })

  it('disabling forces the counter to 0 AND blocks every later load', () => {
    const lc = new LengthCounter()
    lc.setEnabled(true)
    lc.load(0x18) // 192
    expect(lc.counter).toBe(192)
    lc.setEnabled(false)
    expect(lc.counter).toBe(0)
    lc.load(0x18)
    expect(lc.counter).toBe(0)
    expect(lc.active).toBe(false)
    // Re-enabling does not restore anything — the load has to happen again.
    lc.setEnabled(true)
    expect(lc.counter).toBe(0)
    lc.load(0x18)
    expect(lc.counter).toBe(192)
  })
})

describe('through the APU register file', () => {
  it('$4003 / $4007 / $400B / $400F all load from the same table', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x0f)
    apu.write(0, 0x4003, 0x01 << 3) // index 1 → 254
    apu.write(0, 0x4007, 0x03 << 3) // index 3 → 2
    apu.write(0, 0x400b, 0x18 << 3) // index 24 → 192
    apu.write(0, 0x400f, 0x1f << 3) // index 31 → 30
    expect(apu.pulse1.length.counter).toBe(254)
    expect(apu.pulse2.length.counter).toBe(2)
    expect(apu.triangle.length.counter).toBe(192)
    expect(apu.noise.length.counter).toBe(30)
  })

  it('the halt bit is $4000/$400C bit 5 but $4008 bit 7 for the triangle', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x0f)
    apu.write(0, 0x4000, 0x20)
    apu.write(0, 0x400c, 0x20)
    apu.write(0, 0x4008, 0x80)
    expect(apu.pulse1.length.halt).toBe(true)
    expect(apu.noise.length.halt).toBe(true)
    expect(apu.triangle.length.halt).toBe(true)
    // …and bit 5 does nothing at all on $4008.
    apu.write(0, 0x4008, 0x20)
    expect(apu.triangle.length.halt).toBe(false)
  })

  it('$4015 = 0 silences all four length counters at once', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x0f)
    apu.write(0, 0x4003, 0)
    apu.write(0, 0x4007, 0)
    apu.write(0, 0x400b, 0)
    apu.write(0, 0x400f, 0)
    expect(apu.readStatus(0) & 0x0f).toBe(0x0f)
    apu.write(0, 0x4015, 0x00)
    expect(apu.readStatus(0) & 0x0f).toBe(0x00)
  })

  it('a note with no halt bit ends itself after exactly (length) half-frame clocks', () => {
    // Length index 3 → 2 half-frames. Half clocks are at 14913 and 29829.
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x1f) // constant volume 15, halt CLEAR
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x03 << 3)
    expect(apu.pulse1.length.counter).toBe(2)
    apu.runTo(14913)
    expect(apu.pulse1.length.counter).toBe(1)
    expect(apu.pulse1.isSilent()).toBe(false)
    apu.runTo(29829)
    expect(apu.pulse1.length.counter).toBe(0)
    expect(apu.pulse1.isSilent()).toBe(true)
    expect(apu.pulse1.out).toBe(0)
    expect(apu.pulse1.nextCycle).toBe(Infinity)
  })
})
