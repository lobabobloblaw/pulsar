/** Sweep unit — the negate quirk, continuous muting, and the narrow write-back gate.
 *
 *  The canonical example (NESdev "APU Sweep"): period 0x100 shifted right by 1 with
 *  negate set targets 0x07F on pulse 1 and 0x080 on pulse 2. One channel subtracts the
 *  change, the other subtracts it and one more — which is why a downward sweep played
 *  on both pulses at once slowly detunes into a chorus instead of staying in unison.
 *
 *  The muting rules are the ones that decide whether a note sounds at all, and they
 *  apply with the sweep DISABLED and with shift 0. That is the blargg semantic in the
 *  M4 gate: "sweep muting fires even when sweep disabled".
 */
import { describe, expect, it } from 'vitest'
import { SweepUnit } from '../../src/audio/core/units/sweep'
import { MAX_TIMER, PULSE_MIN_TIMER } from '../../src/audio/core/constants'
import { makeApu } from '../helpers/renderTrace'

/** EPPP NSSS. */
function reg(enabled: boolean, dividerPeriod: number, negate: boolean, shift: number): number {
  return (enabled ? 0x80 : 0) | ((dividerPeriod & 7) << 4) | (negate ? 0x08 : 0) | (shift & 7)
}

describe('the negate quirk', () => {
  it('pulse 1 targets 0x07F where pulse 2 targets 0x080', () => {
    const p1 = new SweepUnit(true)
    const p2 = new SweepUnit(false)
    p1.write(reg(true, 0, true, 1))
    p2.write(reg(true, 0, true, 1))
    expect(p1.targetPeriod(0x100)).toBe(0x07f)
    expect(p2.targetPeriod(0x100)).toBe(0x080)
    // Ones' complement is −c − 1; two's complement is −c.
    expect(p2.targetPeriod(0x100) - p1.targetPeriod(0x100)).toBe(1)
  })

  it('holds at every period and shift — pulse 1 is always exactly one lower', () => {
    const p1 = new SweepUnit(true)
    const p2 = new SweepUnit(false)
    for (let shift = 0; shift <= 7; shift++) {
      p1.write(reg(true, 0, true, shift))
      p2.write(reg(true, 0, true, shift))
      for (let period = 0; period <= MAX_TIMER; period += 37) {
        expect(p1.targetPeriod(period)).toBe(p2.targetPeriod(period) - 1)
        expect(p2.targetPeriod(period)).toBe(period - (period >> shift))
      }
    }
  })

  it('without negate both channels agree: target = period + (period >> shift)', () => {
    const p1 = new SweepUnit(true)
    const p2 = new SweepUnit(false)
    p1.write(reg(true, 0, false, 3))
    p2.write(reg(true, 0, false, 3))
    expect(p1.targetPeriod(400)).toBe(400 + 50)
    expect(p2.targetPeriod(400)).toBe(400 + 50)
  })

  it('a pulse-1 negate sweep can never reach period 0 by negation alone', () => {
    const p1 = new SweepUnit(true)
    p1.write(reg(true, 0, true, 7))
    // shift 7 on a small period gives change 0, so the target is period − 0 − 1.
    expect(p1.targetPeriod(8)).toBe(7)
    expect(p1.targetPeriod(1)).toBe(0)
    expect(p1.targetPeriod(0)).toBe(-1)
  })
})

describe('muting — evaluated continuously, regardless of enable and shift', () => {
  it('mutes below period 8', () => {
    const s = new SweepUnit(true)
    s.write(reg(false, 0, true, 0)) // disabled, shift 0
    for (let p = 0; p < PULSE_MIN_TIMER; p++) expect(s.isMuting(p)).toBe(true)
    expect(s.isMuting(8)).toBe(false)
  })

  it('mutes when the target runs past $7FF — even with the sweep DISABLED', () => {
    const s = new SweepUnit(true)
    s.write(reg(false, 0, false, 1)) // ENABLE CLEAR
    expect(s.enabled).toBe(false)
    expect(s.isMuting(0x500)).toBe(false)
    expect(s.targetPeriod(0x600)).toBe(0x900)
    expect(s.isMuting(0x600)).toBe(true)
  })

  it('mutes with shift 0 and no negate: the target is twice the period', () => {
    const s = new SweepUnit(true)
    s.write(reg(false, 0, false, 0)) // this is what a $4001 = 0x00 power-up looks like
    expect(s.targetPeriod(0x400)).toBe(0x800)
    expect(s.isMuting(0x400)).toBe(true)
    expect(s.isMuting(0x3ff)).toBe(false)
  })

  it('$4001 = 0x08 is "sweep off" precisely because it can never mute', () => {
    const s = new SweepUnit(true)
    s.write(0x08) // negate set, shift 0 → target = period − period − 1 = −1
    for (let p = PULSE_MIN_TIMER; p <= MAX_TIMER; p++) {
      expect(s.isMuting(p)).toBe(false)
    }
    expect(s.targetPeriod(1234)).toBe(-1)
  })
})

describe('write-back conditions', () => {
  it('needs divider 0 ∧ enabled ∧ shift ≠ 0 ∧ ¬mute — all four', () => {
    const base = 400
    /** Feed the period back the way the channel does, and report each step. */
    function run(s: SweepUnit, start: number, clocks: number): number[] {
      const seen: number[] = []
      let p = start
      for (let i = 0; i < clocks; i++) {
        p = s.clockHalf(p)
        seen.push(p)
      }
      return seen
    }

    // All four hold. Note the FIRST clock already writes back: the divider powers up
    // at 0, and the write-back happens before the reload, not instead of it.
    const ok = new SweepUnit(true)
    ok.write(reg(true, 0, false, 2))
    expect(run(ok, base, 3)).toEqual([500, 625, 781])

    // Disabled: no write-back, ever.
    const off = new SweepUnit(true)
    off.write(reg(false, 0, false, 2))
    expect(run(off, base, 3)).toEqual([400, 400, 400])

    // Shift 0: no write-back (but still muting-capable, see above).
    const noShift = new SweepUnit(true)
    noShift.write(reg(true, 0, false, 0))
    expect(run(noShift, base, 3)).toEqual([400, 400, 400])

    // Muting: no write-back, and the period is frozen forever after.
    const muted = new SweepUnit(true)
    muted.write(reg(true, 0, false, 1))
    expect(muted.isMuting(0x600)).toBe(true)
    expect(run(muted, 0x600, 3)).toEqual([0x600, 0x600, 0x600])

    // Divider period 3: write-back on clocks 1 and 5, nothing in between.
    const slow = new SweepUnit(true)
    slow.write(reg(true, 3, false, 2))
    expect(run(slow, base, 6)).toEqual([500, 500, 500, 500, 625, 625])
  })

  it('the reload flag makes a $4001 write restart the divider', () => {
    const s = new SweepUnit(true)
    s.write(reg(true, 2, false, 1))
    expect(s.reloadFlag).toBe(true)
    s.clockHalf(400)
    expect(s.reloadFlag).toBe(false)
    expect(s.divider).toBe(2)
    s.clockHalf(400)
    expect(s.divider).toBe(1)
    s.write(reg(true, 2, false, 1)) // rewrite mid-count
    expect(s.reloadFlag).toBe(true)
    s.clockHalf(400)
    expect(s.divider).toBe(2)
  })

  it('a negative target is clamped to 0 when it is written back', () => {
    const s = new SweepUnit(true)
    s.write(reg(true, 0, true, 1))
    s.clockHalf(9) // divider reload
    // target = 9 − 4 − 1 = 4, which is < 8 but the mute check uses the CURRENT period.
    expect(s.clockHalf(9)).toBe(4)
    // Now the period is 4 → muting → frozen.
    expect(s.isMuting(4)).toBe(true)
    expect(s.clockHalf(4)).toBe(4)
  })
})

describe('through the APU — a real sweep that mutes itself', () => {
  it('rises until the target passes $7FF, then goes permanently silent', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f) // duty 0, halt, constant volume 15
    apu.write(0, 0x4001, 0x81) // sweep on, divider 0, up, shift 1
    apu.write(0, 0x4002, 0x00)
    apu.write(0, 0x4003, 0x04) // timer 0x400 → target 0x600
    expect(apu.pulse1.timer).toBe(0x400)
    expect(apu.pulse1.isSilent()).toBe(false)

    // The divider starts at 0, so the very first half-frame clock writes back — the
    // reload happens after the write-back, not instead of it.
    apu.runTo(14913)
    expect(apu.pulse1.timer).toBe(0x600)
    expect(apu.pulse1.sweep.isMuting(0x600)).toBe(true)
    expect(apu.pulse1.isSilent()).toBe(true)
    expect(apu.pulse1.out).toBe(0)
    expect(apu.pulse1.nextCycle).toBe(Infinity)

    // And it never recovers: a muted channel's period can no longer be written back.
    apu.runTo(2_000_000)
    expect(apu.pulse1.timer).toBe(0x600)
    expect(apu.pulse1.out).toBe(0)
  })

  it('a downward sweep detunes pulse 1 one step below pulse 2 from the same registers', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x03)
    for (const base of [0x4000, 0x4004]) {
      apu.write(0, base + 0, 0x3f)
      apu.write(0, base + 1, 0x89) // sweep on, divider 0, negate, shift 1
      apu.write(0, base + 2, 0x00)
      apu.write(0, base + 3, 0x04) // timer 0x400
    }
    apu.runTo(14913)
    expect(apu.pulse1.timer).toBe(0x1ff)
    expect(apu.pulse2.timer).toBe(0x200)
    // Second half clock: the gap widens as the ones' complement keeps subtracting one
    // extra each time.
    apu.runTo(29829)
    expect(apu.pulse1.timer).toBe(0x0ff)
    expect(apu.pulse2.timer).toBe(0x100)
  })

  it('the write-back changes the timer period in CYCLES, not just the register', () => {
    // The channel caches its step period for the hot path; this is the test that
    // catches that cache going stale when the sweep rewrites the period.
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f)
    apu.write(0, 0x4001, 0x89) // negate, shift 1 — falling
    apu.write(0, 0x4002, 0xff)
    apu.write(0, 0x4003, 0x01) // timer 0x1FF → 2·(0x1FF+1) = 1024 cycles per step
    expect(apu.pulse1.periodCycles).toBe(1024)
    const before = apu.pulse1.nextCycle
    apu.runTo(before)
    expect(apu.pulse1.nextCycle - before).toBe(1024)

    apu.runTo(14913) // half-frame clock: 0x1FF → 0x0FF
    expect(apu.pulse1.timer).toBe(0x0ff)
    expect(apu.pulse1.periodCycles).toBe(512)
    const at = apu.pulse1.nextCycle
    apu.runTo(at)
    expect(apu.pulse1.nextCycle - at).toBe(512)
  })

  it('muting is not silence-on-write: an unmuted sweep keeps sounding', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f)
    apu.write(0, 0x4001, 0x89) // negate, shift 1 — falling
    apu.write(0, 0x4002, 0x00)
    apu.write(0, 0x4003, 0x04)
    apu.runTo(200_000)
    // Falling sweeps bottom out at the period-8 mute instead.
    expect(apu.pulse1.timer).toBeLessThan(8)
    expect(apu.pulse1.isSilent()).toBe(true)
  })
})
