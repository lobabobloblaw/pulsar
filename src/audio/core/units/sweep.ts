/** Pulse sweep unit — $4001 (pulse 1) / $4005 (pulse 2), EPPP NSSS.
 *
 *  Three things here are the classic emulator bugs, and all three are asserted in
 *  tests/unit/sweep.test.ts:
 *
 *  1. **The negate quirk.** Pulse 1 negates with ones' complement (−c − 1), pulse 2
 *     with two's complement (−c). Period 0x100 shifted right by 1 therefore targets
 *     0x07F on pulse 1 and 0x080 on pulse 2. A pulse-1 sweep can never reach period 0
 *     by negation, which is why downward sweeps on the two channels detune apart.
 *
 *  2. **Muting is continuous and unconditional.** The target period is recomputed from
 *     the live period all the time, and either `period < 8` or `target > 0x7FF` mutes
 *     the channel — even when the sweep is DISABLED and even when the shift count is 0.
 *     This is why `$4001 = 0x08` (negate set, shift 0) is the canonical "sweep off"
 *     value trackers write: it makes the target `period − period − 1 = −1`, which can
 *     never exceed 0x7FF at any pitch. Writing 0x00 instead would mute every note with
 *     a period ≥ 0x400, because shift 0 makes the target twice the period.
 *
 *  3. **Write-back is narrow.** The channel period is only updated on a half-frame
 *     clock, and only when divider == 0 ∧ enabled ∧ shift ≠ 0 ∧ ¬muting. A muted
 *     channel therefore stays muted forever on a rising sweep — its period can no
 *     longer move. The divider itself keeps counting either way.
 *
 *  The unit holds no reference to its channel: the period is passed in and the new
 *  period is returned, which keeps it independently testable and allocation-free.
 *
 *  Bitwise operators act on the 8-bit register and the 11-bit period only (plan B5).
 */
import { MAX_TIMER, PULSE_MIN_TIMER } from '../constants'

export class SweepUnit {
  /** True for pulse 1 (ones' complement negation), false for pulse 2. */
  readonly onesComplement: boolean

  /** $4001 bit 7. */
  enabled = false
  /** $4001 bits 6–4: half-frame clocks between period updates, minus one. */
  dividerPeriod = 0
  /** $4001 bit 3. */
  negate = false
  /** $4001 bits 2–0. */
  shift = 0
  /** Raw register value, kept for $4015-adjacent debugging and golden traces. */
  register = 0

  divider = 0
  reloadFlag = false

  constructor(onesComplement: boolean) {
    this.onesComplement = onesComplement
  }

  reset(value = 0x08): void {
    this.write(value)
    this.divider = 0
    this.reloadFlag = false
  }

  /** $4001 / $4005 — EPPP NSSS. Always sets the reload flag. */
  write(value: number): void {
    const v = value & 0xff
    this.register = v
    this.enabled = (v & 0x80) !== 0
    this.dividerPeriod = (v >> 4) & 0x07
    this.negate = (v & 0x08) !== 0
    this.shift = v & 0x07
    this.reloadFlag = true
  }

  /** Signed target period. May be negative on a ones'-complement negate — negative is
   *  NOT "greater than 0x7FF", so it does not mute; it is clamped to 0 if it is ever
   *  written back. */
  targetPeriod(period: number): number {
    const change = period >> this.shift
    if (!this.negate) return period + change
    return this.onesComplement ? period - change - 1 : period - change
  }

  /** Evaluated continuously, regardless of `enabled` and `shift`. */
  isMuting(period: number): boolean {
    if (period < PULSE_MIN_TIMER) return true
    return this.targetPeriod(period) > MAX_TIMER
  }

  /** Half-frame clock. Returns the channel's new period (unchanged unless every
   *  write-back condition holds). */
  clockHalf(period: number): number {
    let next = period
    if (this.divider === 0 && this.enabled && this.shift !== 0 && !this.isMuting(period)) {
      const target = this.targetPeriod(period)
      next = target < 0 ? 0 : target
    }
    if (this.divider === 0 || this.reloadFlag) {
      this.divider = this.dividerPeriod
      this.reloadFlag = false
    } else {
      this.divider--
    }
    return next
  }
}
