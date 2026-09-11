/** VRC6 pulse channel — $9000–$9002 (pulse 1) / $A000–$A002 (pulse 2).
 *
 *  Nothing like the 2A03's pulse: no envelope, no sweep, no length counter, and the
 *  timer is clocked every CPU cycle rather than every second one. One 16-step
 *  sequencer, one 12-bit period, one 4-bit volume, and a duty field that is a
 *  THRESHOLD rather than a waveform index — the output is high while `step <= duty`,
 *  so duty 0..7 gives 1/16 .. 8/16 high time and duty 7 is the 50 % square.
 *
 *    $9000  M DDD VVVV   mode (bit 7: ignore the sequencer, output `volume` forever),
 *                        duty 0..7, volume 0..15
 *    $9001  LLLL LLLL    period low
 *    $9002  E--- HHHH    enable (bit 7) + period high nibble
 *
 *  Timing: one sequencer step lasts `effPeriod + 1` CPU cycles, so the fundamental is
 *  fCPU / (16·(P+1)) — the same divisor as the 2A03 pulse, reached by a different
 *  route (16 steps of one cycle each, not 16 steps of two half-speed ones).
 *  `effPeriod` is `period >> shift`, where the shift comes from $9003 and is owned by
 *  the chip (`Vrc6`), which pushes it into all three channels.
 *
 *  Writing a period or a shift does NOT move a running timer: the reload lands at the
 *  next expiry, exactly as the 2A03 pulse's divider behaves on a $4002 write.
 *
 *  Deviation D-V1: while the channel cannot change its output — disabled, or halted by
 *  $9003 bit 0 — the divider is FROZEN and the channel advertises `nextCycle = Infinity`
 *  so it drops out of the run loop's min scan. It restarts one cycle after the cycle
 *  that revives it, which is exactly the hardware's behaviour for the disable case (a
 *  disable zeroes the timer, so the first clock after an enable expires immediately)
 *  and a phase offset of at most one step for the halt case. See docs/deviations.md.
 *
 *  Bitwise operators in this file act on 8-bit register values, the 12-bit period and
 *  the 4-bit sequencer step only. `nextCycle` / `stepCycle` are NES cycles: f64
 *  doubles, never touched by `|0`, `<<`, `>>` or `&` (plan B5).
 */
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from '../channels/types'

/** Steps in the pulse sequencer. */
export const VRC6_PULSE_STEPS = 16
/** Widest value the 12-bit period register can hold. */
export const VRC6_MAX_PERIOD = 0xfff

export class Vrc6Pulse implements ChannelEventSource {
  /** $9002 / $A002 bit 7. */
  enabled = false
  /** 12-bit period, before the $9003 shift. */
  period = 0
  /** $9000 / $A000 bits 3–0. */
  volume = 0
  /** $9000 / $A000 bits 6–4. Output is high while `step <= duty`. */
  duty = 0
  /** $9000 / $A000 bit 7 — output `volume` continuously, ignoring the sequencer. */
  mode = false
  /** Sequencer position, 0..15. */
  step = 0
  /** `period >> shift`. */
  effPeriod = 0

  /** Current DAC level, 0..15. */
  out = 0
  /** Next timer expiry, or Infinity while the channel cannot change its output. */
  nextCycle: NesCycle = Infinity
  /** Cycle the current sequencer step started at. */
  stepCycle: NesCycle = 0

  /** $9003 bits 2–1, pushed down by the chip: 0, 4 or 8. */
  private shift = 0
  /** $9003 bit 0, pushed down by the chip. */
  private halted = false
  /** Cached CPU cycles per sequencer step — `effPeriod + 1`. */
  private stepPeriod = 1

  reset(): void {
    this.enabled = false
    this.period = 0
    this.volume = 0
    this.duty = 0
    this.mode = false
    this.step = 0
    this.effPeriod = 0
    this.out = 0
    this.nextCycle = Infinity
    this.stepCycle = 0
    this.shift = 0
    this.halted = false
    this.stepPeriod = 1
  }

  /** True when no sequencer step could change the output. */
  isSilent(): boolean {
    return !this.enabled || this.halted
  }

  /** $9000 / $A000 — M DDD VVVV. Level and duty only; the timer is untouched. */
  writeControl(value: number, cycle: NesCycle): void {
    this.mode = (value & 0x80) !== 0
    this.duty = (value >> 4) & 7
    this.volume = value & 0x0f
    this.refresh(cycle)
  }

  /** $9001 / $A001 — period low 8 bits. Does NOT reset the divider. */
  writeTimerLow(value: number, cycle: NesCycle): void {
    this.period = (this.period & 0xf00) | (value & 0xff)
    this.refresh(cycle)
  }

  /** $9002 / $A002 — E--- HHHH. Latches the period's high nibble and sets the enable
   *  bit. Clearing a set enable bit is the channel's only phase reset: step and timer
   *  both return to 0, which is how the driver spells "note off". */
  writeEnable(value: number, cycle: NesCycle): void {
    this.period = (this.period & 0x0ff) | ((value & 0x0f) << 8)
    const on = (value & 0x80) !== 0
    if (!on && this.enabled) this.step = 0
    this.enabled = on
    this.refresh(cycle)
  }

  /** $9003, relayed by the chip to all three channels. */
  setFrequencyControl(halted: boolean, shift: number, cycle: NesCycle): void {
    this.halted = halted
    this.shift = shift
    this.refresh(cycle)
  }

  /** Hot path. `nextCycle` is Infinity whenever the channel is silent and every state
   *  change goes through `refresh()`, so a stepping channel is by construction NOT
   *  silent — no enable check belongs here. */
  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at
    const s = (this.step + 1) & 15
    this.step = s
    this.nextCycle = at + this.stepPeriod
    this.out = this.mode || s <= this.duty ? this.volume : 0
  }

  /** Recompute `out` and re-arm the timer after any state change. A running channel
   *  keeps its divider phase (the reload takes the new period at the next expiry); a
   *  channel coming out of silence restarts one cycle later — deviation D-V1. */
  private refresh(cycle: NesCycle): void {
    const wasSilent = this.nextCycle === Infinity
    this.effPeriod = this.period >> this.shift
    this.stepPeriod = this.effPeriod + 1
    // Recomputed from the CURRENT step, so a halted channel that is rewritten still
    // tracks its volume/duty registers — halt stops the oscillator, not the DAC.
    this.out = !this.enabled ? 0 : this.mode || this.step <= this.duty ? this.volume : 0
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
