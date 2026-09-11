/** VRC6 sawtooth channel — $B000–$B002.
 *
 *    $B000  --RR RRRR    accumulator rate, 6 bits (0..63)
 *    $B001  LLLL LLLL    period low
 *    $B002  E--- HHHH    enable (bit 7) + period high nibble
 *
 *  Not a sequencer reading a table: an 8-bit ACCUMULATOR. The sequence is 14 steps
 *  long (0..13); step 0 clears the accumulator and every EVEN step after it adds the
 *  rate, so the accumulator walks 0, r, 2r … 6r and the DAC sees `accum >> 3` — seven
 *  levels, a coarse rising ramp, maximum 31. One step lasts `effPeriod + 1` CPU cycles,
 *  so the fundamental is fCPU / (14·(P+1)).
 *
 *  The `>> 3` is why the rate matters twice over: 6·rate is what the accumulator
 *  reaches, so any rate above $2A (42) overflows eight bits part-way up the ramp and
 *  the output folds back down. That fold is the documented VRC6 "distortion" timbre,
 *  not a defect — the ramp above rate 42 is deliberately reachable.
 *
 *  Deviation D-V1 applies here exactly as it does to the VRC6 pulses: a disabled or
 *  halted saw freezes its divider and advertises `nextCycle = Infinity`. Clearing the
 *  enable bit additionally resets step, accumulator and output — the driver's note-off.
 *
 *  Bitwise operators in this file act on the 8-bit accumulator, 8-bit register values,
 *  the 12-bit period and the 4-bit step only, never on a NES cycle (plan B5).
 */
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from '../channels/types'

/** Steps in the accumulator sequence. */
export const VRC6_SAW_STEPS = 14
/** Highest rate that completes the ramp without wrapping the 8-bit accumulator. */
export const VRC6_SAW_CLEAN_RATE_MAX = 42

export class Vrc6Saw implements ChannelEventSource {
  /** $B002 bit 7. */
  enabled = false
  /** 12-bit period, before the $9003 shift. */
  period = 0
  /** $B000 bits 5–0. */
  rate = 0
  /** Sequence position, 0..13. */
  step = 0
  /** The 8-bit accumulator. */
  accum = 0
  /** `period >> shift`. */
  effPeriod = 0

  /** Current DAC level, 0..31 — `accum >> 3`. */
  out = 0
  /** Next timer expiry, or Infinity while the channel cannot change its output. */
  nextCycle: NesCycle = Infinity
  /** Cycle the current step started at. */
  stepCycle: NesCycle = 0

  private shift = 0
  private halted = false
  private stepPeriod = 1

  reset(): void {
    this.enabled = false
    this.period = 0
    this.rate = 0
    this.step = 0
    this.accum = 0
    this.effPeriod = 0
    this.out = 0
    this.nextCycle = Infinity
    this.stepCycle = 0
    this.shift = 0
    this.halted = false
    this.stepPeriod = 1
  }

  isSilent(): boolean {
    return !this.enabled || this.halted
  }

  /** $B000 — --RR RRRR. Takes effect at the next accumulation, not retroactively. */
  writeRate(value: number, cycle: NesCycle): void {
    this.rate = value & 0x3f
    this.refresh(cycle)
  }

  /** $B001 — period low 8 bits. Does NOT reset the divider. */
  writeTimerLow(value: number, cycle: NesCycle): void {
    this.period = (this.period & 0xf00) | (value & 0xff)
    this.refresh(cycle)
  }

  /** $B002 — E--- HHHH. Clearing a set enable bit resets the whole oscillator: step,
   *  accumulator, output and timer. */
  writeEnable(value: number, cycle: NesCycle): void {
    this.period = (this.period & 0x0ff) | ((value & 0x0f) << 8)
    const on = (value & 0x80) !== 0
    if (!on && this.enabled) {
      this.step = 0
      this.accum = 0
    }
    this.enabled = on
    this.refresh(cycle)
  }

  /** $9003, relayed by the chip to all three channels. */
  setFrequencyControl(halted: boolean, shift: number, cycle: NesCycle): void {
    this.halted = halted
    this.shift = shift
    this.refresh(cycle)
  }

  /** Hot path — see the note on Vrc6Pulse.stepTimer. */
  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at
    const next = this.step + 1
    const s = next === VRC6_SAW_STEPS ? 0 : next
    this.step = s
    if (s === 0) this.accum = 0
    else if ((s & 1) === 0) this.accum = (this.accum + this.rate) & 0xff
    this.nextCycle = at + this.stepPeriod
    this.out = this.accum >> 3
  }

  private refresh(cycle: NesCycle): void {
    const wasSilent = this.nextCycle === Infinity
    this.effPeriod = this.period >> this.shift
    this.stepPeriod = this.effPeriod + 1
    this.out = this.enabled ? this.accum >> 3 : 0
    if (!this.enabled || this.halted) {
      this.nextCycle = Infinity
      return
    }
    if (wasSilent) {
      this.stepCycle = cycle
      this.nextCycle = cycle + 1
    }
  }
}
