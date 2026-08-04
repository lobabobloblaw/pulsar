/** Triangle channel + linear counter.
 *
 *  The acceptance item this file exists for (plan-file Phase 1 (e), blargg semantics):
 *  **the triangle stops in phase and holds its DAC value.** It is not zeroed on
 *  note-off, it is not reset on note-on, and while it is stopped it emits no deltas at
 *  all. Every emulator that "helpfully" zeroes it produces a click that hardware does
 *  not make, and every one that resets the phase loses the continuity that makes NES
 *  basslines sound legato.
 */
import { describe, expect, it } from 'vitest'
import { TRIANGLE_SEQUENCE } from '../../src/audio/core/tables'
import { LinearCounter } from '../../src/audio/core/units/linearCounter'
import {
  TRIANGLE_FROZEN_LEVEL,
  TRIANGLE_MIN_TIMER,
} from '../../src/audio/core/channels/triangleChannel'
import { triangleHzForTimer } from '../../src/audio/host/pitch'
import { centsBetween, dftFundamentalHz, zeroCrossingHz } from '../helpers/analysis'
import { makeApu, renderTrace, triangleNoteOnTrace } from '../helpers/renderTrace'

const SAMPLE_RATE = 48000

describe('the 32-step sequence', () => {
  it('is 15 down to 0 and back up to 15, with both ends doubled', () => {
    expect(Array.from(TRIANGLE_SEQUENCE)).toEqual([
      15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15,
    ])
    expect(TRIANGLE_SEQUENCE.length).toBe(32)
    expect(TRIANGLE_SEQUENCE[15]).toBe(0)
    expect(TRIANGLE_SEQUENCE[16]).toBe(0)
  })

  it('is symmetric — the two halves mirror each other', () => {
    for (let i = 0; i < 16; i++) {
      expect(TRIANGLE_SEQUENCE[i]).toBe(TRIANGLE_SEQUENCE[31 - i])
    }
    let sum = 0
    for (let i = 0; i < 32; i++) sum += TRIANGLE_SEQUENCE[i]
    expect(sum / 32).toBe(7.5)
  })

  it('advances one step every (t+1) CPU cycles — not 2·(t+1) like the pulses', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0x00)
    expect(apu.triangle.periodCycles).toBe(127)
    apu.runTo(7457) // the quarter clock that loads the linear counter
    expect(apu.triangle.nextCycle).toBe(7457 + 127)
    apu.runTo(7457 + 127)
    expect(apu.triangle.nextCycle).toBe(7457 + 254)
    // 32 steps per waveform → 4064 cycles → 440.397 Hz.
    expect(32 * 127).toBe(4064)
  })
})

describe('linear counter', () => {
  it('reloads on the flag, then counts down once the control bit is clear', () => {
    const lc = new LinearCounter()
    lc.write(0x05) // control clear, reload value 5
    lc.setReloadFlag()
    lc.clockQuarter()
    expect(lc.counter).toBe(5)
    expect(lc.reloadFlag).toBe(false) // cleared because control is clear
    lc.clockQuarter()
    expect(lc.counter).toBe(4)
    for (let i = 0; i < 10; i++) lc.clockQuarter()
    expect(lc.counter).toBe(0)
    expect(lc.active).toBe(false)
  })

  it('with the control bit SET the flag is never cleared, so the note holds forever', () => {
    const lc = new LinearCounter()
    lc.write(0x85) // control set, reload value 5
    lc.setReloadFlag()
    for (let i = 0; i < 1000; i++) lc.clockQuarter()
    expect(lc.reloadFlag).toBe(true)
    expect(lc.counter).toBe(5)
    // Clearing control lets the pending reload flag be consumed, then it decays.
    lc.write(0x05)
    lc.clockQuarter()
    expect(lc.counter).toBe(5)
    lc.clockQuarter()
    expect(lc.counter).toBe(4)
  })

  it('reload value is 7 bits — $4008 bit 7 is the control flag', () => {
    const lc = new LinearCounter()
    lc.write(0xff)
    expect(lc.control).toBe(true)
    expect(lc.reloadValue).toBe(127)
    lc.write(0x7f)
    expect(lc.control).toBe(false)
    expect(lc.reloadValue).toBe(127)
  })

  it('gates the channel independently of the length counter', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0x02) // control CLEAR, reload 2 → two quarter clocks of sound
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0xf8) // length index 31 → 30 half-frames, plenty
    expect(apu.triangle.length.counter).toBe(30)
    apu.runTo(7457)
    expect(apu.triangle.linear.counter).toBe(2)
    apu.runTo(14913)
    expect(apu.triangle.linear.counter).toBe(1)
    apu.runTo(22371)
    expect(apu.triangle.linear.counter).toBe(0)
    // Length counter still has plenty left, but the linear counter alone silences it.
    expect(apu.triangle.length.active).toBe(true)
    expect(apu.triangle.isSilent()).toBe(true)
    expect(apu.triangle.nextCycle).toBe(Infinity)
  })
})

describe('the linear counter reload delay', () => {
  it('a note does not start until the next quarter-frame clock loads the counter', () => {
    // $400B only SETS the reload flag; the counter itself is loaded on the next
    // quarter clock, up to 7457 cycles (4.2 ms) later. That delay is the triangle's
    // characteristically soft attack, and any host scheduling triangle notes needs to
    // know the channel is silent until then.
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0x00)
    expect(apu.triangle.length.counter).toBe(10)
    expect(apu.triangle.linear.reloadFlag).toBe(true)
    expect(apu.triangle.linear.counter).toBe(0)
    expect(apu.triangle.nextCycle).toBe(Infinity)

    apu.runTo(7457)
    expect(apu.triangle.linear.counter).toBe(127)
    expect(apu.triangle.nextCycle).toBe(7457 + 127)
  })
})

describe('stops in phase, holds the DAC value, emits nothing', () => {
  it('a note-off holds `out` where the waveform was — it is never zeroed', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0x00)
    apu.runTo(7457 + 127 * 5) // five steps past the linear counter reload
    const heldOut = apu.triangle.out
    const heldStep = apu.triangle.step
    expect(heldOut).toBeGreaterThan(0)

    apu.write(7457 + 127 * 5, 0x4015, 0x00) // note off
    expect(apu.triangle.isSilent()).toBe(true)
    expect(apu.triangle.out).toBe(heldOut)
    expect(apu.triangle.step).toBe(heldStep)
    expect(apu.triangle.nextCycle).toBe(Infinity)
  })

  it('emits exactly zero deltas over 10 000 cycles while stopped', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0x00)
    apu.runTo(8000)
    apu.write(8000, 0x4015, 0x00)

    const deltasAtStop = apu.stats.deltasEmitted
    const eventsAtStop = apu.stats.eventsProcessed
    const heldOut = apu.triangle.out
    apu.runTo(18_000)
    expect(apu.stats.deltasEmitted).toBe(deltasAtStop)
    expect(apu.stats.eventsProcessed).toBe(eventsAtStop)
    expect(apu.triangle.out).toBe(heldOut)
  })

  it('resumes from the held step — the sequencer is never reset by a register write', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 126)
    apu.write(0, 0x400b, 0x00)
    apu.runTo(7457 + 127 * 7)
    const heldStep = apu.triangle.step
    apu.write(7457 + 127 * 7, 0x4015, 0x00)
    apu.runTo(500_000)
    apu.write(500_000, 0x4015, 0x04)
    apu.write(500_000, 0x400b, 0x00)
    expect(apu.triangle.step).toBe(heldStep)
    apu.runTo(500_000 + 127)
    expect(apu.triangle.step).toBe((heldStep + 1) & 31)
  })
})

describe('deviation D-T1 — t < 2 freezes at out = 7', () => {
  it('freezes the sequencer and holds the mean level', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x04)
    apu.write(0, 0x4008, 0xff)
    apu.write(0, 0x400a, 1)
    apu.write(0, 0x400b, 0x00)
    expect(apu.triangle.timer).toBe(1)
    // Silent until the first quarter clock loads the linear counter; from then on the
    // channel is "running" but frozen by D-T1 rather than silenced.
    apu.runTo(7457)
    expect(apu.triangle.isSilent()).toBe(false)
    expect(apu.triangle.nextCycle).toBe(Infinity)
    expect(apu.triangle.out).toBe(TRIANGLE_FROZEN_LEVEL)
    expect(TRIANGLE_FROZEN_LEVEL).toBe(7)
    apu.runTo(100_000)
    expect(apu.stats.eventsProcessed).toBe(0)

    // Raising the timer to 2 sets it running again from the held step.
    apu.write(100_000, 0x400a, TRIANGLE_MIN_TIMER)
    expect(apu.triangle.nextCycle).toBe(100_003)
    expect(apu.triangle.out).toBe(TRIANGLE_SEQUENCE[apu.triangle.step])
  })

  it('t = 0 and t = 1 would otherwise run at 55.9 kHz and 27.9 kHz', () => {
    expect(triangleHzForTimer(0)).toBeCloseTo(55_930.4, 1)
    expect(triangleHzForTimer(1)).toBeCloseTo(27_965.2, 1)
    // Both are above the 20 kHz limit; the DAC on hardware averages them to ~7.5.
    expect(triangleHzForTimer(TRIANGLE_MIN_TIMER)).toBeCloseTo(18_643.5, 1)
  })
})

describe('pitch — timer 126 is A440', () => {
  const signal = renderTrace(triangleNoteOnTrace(0, 126), {
    sampleRate: SAMPLE_RATE,
    durationSamples: 65536,
  })

  it('zero-crossing measures 440.397 Hz', () => {
    const hz = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 4800)
    expect(hz).toBeCloseTo(440.397, 1)
    expect(Math.abs(centsBetween(hz, triangleHzForTimer(126)))).toBeLessThan(0.1)
  })

  it('interpolated DFT agrees, and the ideal is the same as pulse timer 253', () => {
    const hz = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(hz, triangleHzForTimer(126)))).toBeLessThan(0.5)
    expect(triangleHzForTimer(126)).toBeCloseTo(440.3969, 4)
  })

  it('and it is a triangle, not a square: the third harmonic is 1/9, not 1/3', () => {
    // A square's third harmonic is 1/3 (−9.5 dB); a triangle's is 1/9 (−19.1 dB).
    const fundamental = 440.397
    /** Quadrature magnitude at `harmonic × fundamental` — phase-independent. */
    function magnitude(harmonic: number): number {
      let re = 0
      let im = 0
      const n = 16384
      for (let k = 0; k < n; k++) {
        const w = (2 * Math.PI * harmonic * fundamental * k) / SAMPLE_RATE
        re += signal[8192 + k] * Math.cos(w)
        im += signal[8192 + k] * Math.sin(w)
      }
      return Math.hypot(re, im)
    }
    const db = 20 * Math.log10(magnitude(3) / magnitude(1))
    expect(db).toBeLessThan(-16)
    expect(db).toBeGreaterThan(-22)
    expect(20 * Math.log10(1 / 9)).toBeCloseTo(-19.08, 2)
  })
})
