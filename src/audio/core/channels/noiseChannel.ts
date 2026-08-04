/** Noise channel — $400C, $400E, $400F.
 *
 *  A pulse channel with the duty sequencer replaced by a 15-bit LFSR and the timer
 *  replaced by a 16-entry period table (already expressed in CPU cycles, so index 0
 *  clocks at 1 789 773 / 4 = 447 443.25 Hz). Envelope and length counter are the same
 *  units the pulses use.
 *
 *  Mode 1 ("short") taps bit 6 instead of bit 1, dropping the period from 32 767 to 93
 *  — the metallic buzz used for hi-hats and laser sounds. Both are exact, integer
 *  periods, asserted bit for bit in noiseLfsr.test.ts.
 *
 *  Deviation D-P2: the LFSR is frozen while the length counter is at 0, so a silent
 *  noise channel drops out of the run loop's min scan. On hardware it keeps shifting at
 *  up to 447 kHz; keeping that would cost ~1 200 events per quantum for a channel that
 *  is contributing nothing, and the only observable difference is which point of a
 *  pseudo-random sequence the next note starts from.
 */
import { NOISE_PERIOD_NTSC, NOISE_PERIOD_PAL } from '../tables'
import { Envelope } from '../units/envelope'
import { LengthCounter } from '../units/lengthCounter'
import { NoiseLfsr } from '../units/noiseLfsr'
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from './types'

export class NoiseChannel implements ChannelEventSource {
  readonly envelope = new Envelope()
  readonly length = new LengthCounter()
  readonly lfsr = new NoiseLfsr()

  /** $400E bits 3–0. */
  periodIndex = 0

  out = 0
  nextCycle: NesCycle = Infinity
  stepCycle: NesCycle = 0

  private periods: Uint16Array = NOISE_PERIOD_NTSC
  /** Cached `envelope.output()` and `periods[periodIndex]`. Both can only move on a
   *  register write or a quarter-frame clock, and both of those go through `refresh()`,
   *  so the hot path — up to 1200 LFSR clocks per quantum at period index 0 — reads
   *  two plain fields instead of calling across into two other objects. */
  private level = 0
  private stepPeriod = 4

  setRegion(region: 'ntsc' | 'pal'): void {
    this.periods = region === 'pal' ? NOISE_PERIOD_PAL : NOISE_PERIOD_NTSC
  }

  reset(): void {
    this.envelope.reset()
    this.length.reset()
    this.lfsr.reset()
    this.periodIndex = 0
    this.out = 0
    this.nextCycle = Infinity
    this.stepCycle = 0
    this.level = 0
    this.stepPeriod = this.periods[0]
  }

  get enabled(): boolean {
    return this.length.enabled
  }

  /** LFSR clock period in CPU cycles. */
  get periodCycles(): number {
    return this.periods[this.periodIndex]
  }

  isSilent(): boolean {
    return !this.length.active
  }

  /** $400C — --LC VVVV. */
  writeControl(value: number, cycle: NesCycle): void {
    this.length.halt = (value & 0x20) !== 0
    this.envelope.writeControl(value)
    this.refresh(cycle)
  }

  /** $400E — M--- PPPP. */
  writePeriod(value: number, cycle: NesCycle): void {
    this.lfsr.mode = (value & 0x80) !== 0
    this.periodIndex = value & 0x0f
    this.refresh(cycle)
  }

  /** $400F — LLLL L---. Loads the length counter and restarts the envelope. The LFSR
   *  is deliberately not reseeded: noise has no phase to retrigger. */
  writeLength(value: number, cycle: NesCycle): void {
    this.length.load((value >> 3) & 0x1f)
    this.envelope.restart()
    this.refresh(cycle)
  }

  /** $4015 bit 3. */
  setEnabled(on: boolean, cycle: NesCycle): void {
    this.length.setEnabled(on)
    this.refresh(cycle)
  }

  clockQuarter(cycle: NesCycle): void {
    this.envelope.clockQuarter()
    this.refresh(cycle)
  }

  clockHalf(cycle: NesCycle): void {
    this.length.clockHalf()
    this.refresh(cycle)
  }

  /** Hot path — the busiest event source on the chip. `nextCycle` is Infinity whenever
   *  the length counter is at 0, so a stepping channel is by construction sounding. */
  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at
    const lfsr = this.lfsr
    lfsr.clock()
    this.nextCycle = at + this.stepPeriod
    this.out = (lfsr.reg & 1) === 1 ? 0 : this.level
  }

  private refresh(cycle: NesCycle): void {
    const wasIdle = this.nextCycle === Infinity
    this.level = this.envelope.output()
    this.stepPeriod = this.periods[this.periodIndex]
    if (this.isSilent()) {
      this.nextCycle = Infinity
      this.out = 0
      return
    }
    if (wasIdle) {
      this.stepCycle = cycle
      this.nextCycle = cycle + this.stepPeriod
    }
    this.out = this.lfsr.silenced ? 0 : this.level
  }
}
