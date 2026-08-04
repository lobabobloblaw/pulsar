/** Frame counter — the event schedule the whole chip's modulation hangs off.
 *
 *  The load-bearing claim of this file is that the schedule is a TABLE, not a divide.
 *  A `cycle % 7457` implementation passes a "roughly 240 Hz" test and still gets the
 *  4-step period wrong by a cycle per step, which drifts a vibrato out of phase with
 *  the driver that wrote it. So the intervals are asserted individually: 7457, 7456,
 *  7458, 7458 — deliberately not equal.
 */
import { describe, expect, it } from 'vitest'
import {
  FRAME_PERIOD_4,
  FRAME_PERIOD_5,
  FRAME_STEPS_4,
  FRAME_STEPS_5,
  FrameCounter,
} from '../../src/audio/core/frameCounter'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { makeApu } from '../helpers/renderTrace'

interface FrameEvent {
  cycle: number
  quarter: boolean
  half: boolean
  irq: boolean
}

function collect(fc: FrameCounter, untilCycle: number): FrameEvent[] {
  const out: FrameEvent[] = []
  while (fc.nextCycle <= untilCycle) {
    const cycle = fc.nextCycle
    fc.stepTimer()
    out.push({ cycle, quarter: fc.quarterClock, half: fc.halfClock, irq: fc.irqFlag })
  }
  return out
}

describe('4-step mode (power-up)', () => {
  it('fires quarter clocks at exactly 7457 / 14913 / 22371 / 29829', () => {
    const fc = new FrameCounter()
    const events = collect(fc, FRAME_PERIOD_4)
    expect(events.map((e) => e.cycle)).toEqual([7457, 14913, 22371, 29829])
    expect(events.every((e) => e.quarter)).toBe(true)
  })

  it('fires half clocks only at 14913 and 29829', () => {
    const fc = new FrameCounter()
    const events = collect(fc, FRAME_PERIOD_4)
    expect(events.filter((e) => e.half).map((e) => e.cycle)).toEqual([14913, 29829])
  })

  it('repeats with period 29830 — the sequence restarts one cycle after the last step', () => {
    const fc = new FrameCounter()
    const events = collect(fc, 3 * FRAME_PERIOD_4)
    expect(events.length).toBe(12)
    expect(events.map((e) => e.cycle)).toEqual([
      7457, 14913, 22371, 29829,
      7457 + 29830, 14913 + 29830, 22371 + 29830, 29829 + 29830,
      7457 + 59660, 14913 + 59660, 22371 + 59660, 29829 + 59660,
    ])
    expect(FRAME_PERIOD_4).toBe(29830)
  })

  it('the intervals are NOT uniform: 7457, 7456, 7458, 7458', () => {
    const fc = new FrameCounter()
    const cycles = collect(fc, 2 * FRAME_PERIOD_4).map((e) => e.cycle)
    const intervals: number[] = []
    let prev = 0
    for (let i = 0; i < cycles.length; i++) {
      intervals.push(cycles[i] - prev)
      prev = cycles[i]
    }
    expect(intervals.slice(0, 4)).toEqual([7457, 7456, 7458, 7458])
    expect(intervals.slice(0, 4).reduce((a, b) => a + b, 0)).toBe(FRAME_PERIOD_4 - 1)
    // The wrap is a fifth distinct gap: the period is 29 830 but the last step is at
    // 29 829, so the step after it comes 7458 cycles later, and the in-sequence
    // pattern then repeats.
    expect(intervals.slice(4, 8)).toEqual([7458, 7456, 7458, 7458])
    expect(intervals.reduce((a, b) => a + b, 0)).toBe(FRAME_PERIOD_4 + 29829)
  })

  it('runs at 239.996 Hz over 10 seconds — not 240', () => {
    const fc = new FrameCounter()
    const tenSeconds = 10 * NTSC_CPU_HZ
    const events = collect(fc, tenSeconds)
    // 2399 quarter clocks in ten seconds, not 2400: the sequence is 29 830 cycles, so
    // it takes 10.00015 s to fit 600 of them.
    expect(events.length).toBe(2399)
    const span = events[events.length - 1].cycle - events[0].cycle
    const hz = ((events.length - 1) * NTSC_CPU_HZ) / span
    expect(hz).toBeCloseTo(239.996, 3)
    expect(4 * (NTSC_CPU_HZ / FRAME_PERIOD_4)).toBeCloseTo(239.996, 3)
    // Half clocks are exactly half of them (one short here — the run ended on a
    // quarter-only step).
    expect(events.filter((e) => e.half).length).toBe(1199)
    // And the frame rate itself is 59.99909 Hz, not 60.
    expect(NTSC_CPU_HZ / FRAME_PERIOD_4).toBeCloseTo(59.99909, 5)
  })

  it('sets the frame IRQ flag at the end of every sequence unless inhibited', () => {
    const fc = new FrameCounter()
    const events = collect(fc, FRAME_PERIOD_4)
    expect(events.map((e) => e.irq)).toEqual([false, false, false, true])

    const inhibited = new FrameCounter()
    inhibited.write(0x40, 0)
    const quiet = collect(inhibited, 4 * FRAME_PERIOD_4)
    expect(quiet.some((e) => e.irq)).toBe(false)
  })
})

describe('5-step mode ($4017 bit 7)', () => {
  it('fires quarter clocks at 7457 / 14913 / 22371 / 37281 with period 37282', () => {
    const fc = new FrameCounter()
    fc.write(0x80, 0)
    // The write itself resets the sequence at cycle 3 (even write cycle, D-F1).
    const events = collect(fc, 3 + FRAME_PERIOD_5)
    expect(events[0].cycle).toBe(3)
    expect(events.slice(1).map((e) => e.cycle - 3)).toEqual([7457, 14913, 22371, 37281])
    expect(FRAME_PERIOD_5).toBe(37282)
    expect(FRAME_STEPS_5).toEqual([7457, 14913, 22371, 37281])
  })

  it('has no step at 29829 at all — the "fifth step" does nothing', () => {
    const fc = new FrameCounter()
    fc.write(0x80, 0)
    const events = collect(fc, 3 + FRAME_PERIOD_5)
    expect(events.some((e) => e.cycle - 3 === 29829)).toBe(false)
  })

  it('fires half clocks at 14913 and 37281', () => {
    const fc = new FrameCounter()
    fc.write(0x80, 0)
    const events = collect(fc, 3 + FRAME_PERIOD_5)
    expect(
      events
        .slice(1)
        .filter((e) => e.half)
        .map((e) => e.cycle - 3),
    ).toEqual([14913, 37281])
  })

  it('never sets the frame IRQ flag', () => {
    const fc = new FrameCounter()
    fc.write(0x80, 0)
    const events = collect(fc, 3 * FRAME_PERIOD_5)
    expect(events.some((e) => e.irq)).toBe(false)
    expect(fc.irqFlag).toBe(false)
  })
})

describe('$4017 write side effects', () => {
  it('resets the sequence 3 cycles after an even write, 4 after an odd one (D-F1)', () => {
    const even = new FrameCounter()
    even.write(0x00, 1000)
    expect(even.nextCycle).toBe(1003)
    even.stepTimer()
    expect(even.nextCycle).toBe(1003 + 7457)

    const odd = new FrameCounter()
    odd.write(0x00, 1001)
    expect(odd.nextCycle).toBe(1005)
    odd.stepTimer()
    expect(odd.nextCycle).toBe(1005 + 7457)
  })

  it('mode 1 issues an immediate quarter AND half clock at the reset point', () => {
    const fc = new FrameCounter()
    fc.write(0x80, 0)
    expect(fc.nextCycle).toBe(3)
    fc.stepTimer()
    expect(fc.quarterClock).toBe(true)
    expect(fc.halfClock).toBe(true)
  })

  it('mode 0 issues no immediate clock at all', () => {
    const fc = new FrameCounter()
    fc.write(0x00, 0)
    expect(fc.nextCycle).toBe(3)
    fc.stepTimer()
    expect(fc.quarterClock).toBe(false)
    expect(fc.halfClock).toBe(false)
    expect(fc.nextCycle).toBe(3 + 7457)
  })

  it('a scheduled event still fires if it falls before the pending reset', () => {
    // Write two cycles before a step: the step is due at 7457, the reset at 7459
    // (odd write cycle → 4-cycle delay).
    const fc = new FrameCounter()
    fc.write(0x00, 7455)
    expect(fc.nextCycle).toBe(7457)
    fc.stepTimer()
    expect(fc.quarterClock).toBe(true)
    expect(fc.nextCycle).toBe(7459)
    fc.stepTimer()
    expect(fc.quarterClock).toBe(false)
    expect(fc.nextCycle).toBe(7459 + 7457)
  })

  it('bit 6 clears the frame IRQ flag', () => {
    const fc = new FrameCounter()
    collect(fc, FRAME_PERIOD_4)
    expect(fc.irqFlag).toBe(true)
    fc.write(0x40, 100_000)
    expect(fc.irqFlag).toBe(false)
  })

  it('a mid-sequence reset restarts the schedule from the write point', () => {
    const fc = new FrameCounter()
    collect(fc, 20_000) // two steps in
    fc.write(0x00, 20_000)
    expect(fc.nextCycle).toBe(20_003)
    const events = collect(fc, 20_003 + FRAME_PERIOD_4)
    expect(events.map((e) => e.cycle - 20_003)).toEqual([0, 7457, 14913, 22371, 29829])
    expect(events[0].quarter).toBe(false)
  })

  it('the offsets are exported as tables, not computed from a divide', () => {
    expect(FRAME_STEPS_4).toEqual([7457, 14913, 22371, 29829])
    expect(FRAME_PERIOD_4).toBe(29830)
    // A `% 7457` implementation would put the steps at 7457/14914/22371/29828.
    expect(FRAME_STEPS_4[1]).not.toBe(2 * 7457)
  })
})

describe('inside the APU', () => {
  it('the frame counter is always in the min scan and never advertises Infinity', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    expect(apu.frameCounter.nextCycle).toBe(7457)
    apu.runTo(1_000_000)
    expect(Number.isFinite(apu.frameCounter.nextCycle)).toBe(true)
    expect(apu.stats.frameEvents).toBe(134)
  })

  it('$4017 = 0x80 clocks every envelope and length counter immediately', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x05) // envelope mode, V = 5, no halt
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x08) // length index 1 → 254
    expect(apu.pulse1.length.counter).toBe(254)
    expect(apu.pulse1.envelope.startFlag).toBe(true)

    apu.write(0, 0x4017, 0x80)
    apu.runTo(10)
    // The immediate quarter clock consumed the envelope's start flag...
    expect(apu.pulse1.envelope.startFlag).toBe(false)
    expect(apu.pulse1.envelope.decayLevel).toBe(15)
    // ...and the immediate half clock took one off the length counter.
    expect(apu.pulse1.length.counter).toBe(253)
  })

  it('$4017 = 0x00 leaves both alone until the first scheduled step', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x05)
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x08)
    apu.write(0, 0x4017, 0x00)
    apu.runTo(1000)
    expect(apu.pulse1.envelope.startFlag).toBe(true)
    expect(apu.pulse1.length.counter).toBe(254)
    apu.runTo(3 + 7457)
    expect(apu.pulse1.envelope.startFlag).toBe(false)
    expect(apu.pulse1.length.counter).toBe(254) // quarter clock only
  })
})
