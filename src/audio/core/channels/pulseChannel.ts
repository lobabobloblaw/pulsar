/** Pulse channel — $4000–$4003 (pulse 1) / $4004–$4007 (pulse 2).
 *
 *  Four units feed one output: the duty sequencer picks a waveform bit, the envelope
 *  supplies the level, the length counter and the sweep unit each independently gate
 *  the whole thing. The only difference between the two instances is the sweep's
 *  negation form (ones' complement on pulse 1, two's on pulse 2) — everything else,
 *  including the register layout, is identical.
 *
 *  Timing: the pulse timer is clocked every SECOND CPU cycle and the sequencer advances
 *  on each timer underflow, so one duty step is 2·(t+1) CPU cycles and the fundamental
 *  is fCPU / (16·(t+1)).
 *
 *  $4003/$4007 semantics (blargg's "duty phase reset" case): latch the timer's high
 *  bits, reset the duty step to 0, restart the envelope, load the length counter —
 *  and deliberately do NOT reset the timer divider.
 *
 *  Deviation D-P1: while the channel is silent (disabled, length 0, or sweep-muted)
 *  its timer divider is frozen rather than counted on, so it can advertise
 *  `nextCycle = Infinity` and drop out of the run loop's min scan entirely. See
 *  `refresh()` and docs/deviations.md.
 *
 *  Bitwise operators in this file act on 8-bit register values and the 3-bit sequencer
 *  step only. `nextCycle` / `stepCycle` are NES cycles: f64 doubles, never touched by
 *  `|0`, `<<`, `>>` or `&` (plan B5).
 */
import { APU_TIMER_DIVIDER, MAX_TIMER } from '../constants'
import { DutySequencer } from '../units/dutySequencer'
import { Envelope } from '../units/envelope'
import { LengthCounter } from '../units/lengthCounter'
import { SweepUnit } from '../units/sweep'
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from './types'

/** Power-up value this engine gives $4001/$4005. Hardware powers up at $00, which
 *  (shift 0, no negate → target = 2·period) would mute every note below A1 until the
 *  host wrote the register. 0x08 is the "sweep off" value every tracker writes and the
 *  one the canonical note-on in plan B6 uses. */
export const SWEEP_OFF = 0x08

export class PulseChannel implements ChannelEventSource {
  readonly sequencer = new DutySequencer()
  readonly envelope = new Envelope()
  readonly length = new LengthCounter()
  readonly sweep: SweepUnit

  /** Pulse 1 negates with ones' complement, pulse 2 with two's complement. */
  readonly onesComplementSweep: boolean

  /** 11-bit period. Period in CPU cycles is APU_TIMER_DIVIDER · (timer + 1). */
  timer = 0

  /** Current DAC level, 0..15. */
  out = 0
  /** Next timer expiry, or Infinity while the channel cannot change its output. */
  nextCycle: NesCycle = Infinity
  /** Cycle the current timer period started at. */
  stepCycle: NesCycle = 0

  /** Cached `envelope.output()`. The envelope can only move on a register write or a
   *  quarter-frame clock, and both of those go through `refresh()`, so the hot path
   *  never has to call across into the envelope. */
  private level = 0
  /** Cached CPU cycles per sequencer step, kept in step with `timer` by `refresh()`. */
  private stepPeriod = APU_TIMER_DIVIDER

  constructor(onesComplementSweep: boolean) {
    this.onesComplementSweep = onesComplementSweep
    this.sweep = new SweepUnit(onesComplementSweep)
    this.sweep.reset(SWEEP_OFF)
  }

  reset(): void {
    this.sequencer.setDuty(0)
    this.sequencer.reset()
    this.envelope.reset()
    this.length.reset()
    this.sweep.reset(SWEEP_OFF)
    this.timer = 0
    this.out = 0
    this.nextCycle = Infinity
    this.stepCycle = 0
    this.level = 0
    this.stepPeriod = APU_TIMER_DIVIDER
  }

  /** $4015 enable bit for this channel. Single source of truth: the length counter. */
  get enabled(): boolean {
    return this.length.enabled
  }

  /** $4000 bits 3–0. */
  get volume(): number {
    return this.envelope.volume
  }

  /** $4000 bit 4. */
  get constantVolume(): boolean {
    return this.envelope.constantVolume
  }

  /** $4000 bit 5 — length halt / envelope loop, one bit driving both units. */
  get lengthHalt(): boolean {
    return this.length.halt
  }

  /** Raw $4001 / $4005. */
  get sweepRegister(): number {
    return this.sweep.register
  }

  /** Timer period in CPU cycles. */
  get periodCycles(): number {
    return APU_TIMER_DIVIDER * (this.timer + 1)
  }

  /** True when no sequencer step can change the output level: the channel is disabled,
   *  its length counter has run out, its period is below 8, or the sweep unit's target
   *  has run past $7FF. The last two mute regardless of the sweep's enable and shift. */
  isSilent(): boolean {
    return !this.length.active || this.sweep.isMuting(this.timer)
  }

  /** $4000 / $4004 — DDLC VVVV. */
  writeControl(value: number, cycle: NesCycle): void {
    this.sequencer.setDuty((value >> 6) & 3)
    this.length.halt = (value & 0x20) !== 0
    this.envelope.writeControl(value)
    this.refresh(cycle)
  }

  /** $4001 / $4005 — EPPP NSSS. Always sets the sweep's reload flag. */
  writeSweep(value: number, cycle: NesCycle): void {
    this.sweep.write(value)
    this.refresh(cycle)
  }

  /** $4002 / $4006 — timer low 8 bits. Does NOT reset the timer divider. */
  writeTimerLow(value: number, cycle: NesCycle): void {
    this.timer = (this.timer & 0x700) | (value & 0xff)
    this.refresh(cycle)
  }

  /** $4003 / $4007 — LLLL LHHH. Latches timer high bits, resets the duty step, loads
   *  the length counter and restarts the envelope. The timer divider is deliberately
   *  NOT reset — that is what makes the duty phase reset audible as a click rather
   *  than a retrigger. */
  writeTimerHigh(value: number, cycle: NesCycle): void {
    this.timer = (((value & 0x07) << 8) | (this.timer & 0xff)) & MAX_TIMER
    this.sequencer.reset()
    this.length.load((value >> 3) & 0x1f)
    this.envelope.restart()
    this.refresh(cycle)
  }

  /** $4015 bit 0 / bit 1. Clearing zeroes the length counter and blocks further loads
   *  until the bit is set again. */
  setEnabled(on: boolean, cycle: NesCycle): void {
    this.length.setEnabled(on)
    this.refresh(cycle)
  }

  /** Frame counter, ~240 Hz. */
  clockQuarter(cycle: NesCycle): void {
    this.envelope.clockQuarter()
    this.refresh(cycle)
  }

  /** Frame counter, ~120 Hz. The sweep may rewrite the period here — and only here. */
  clockHalf(cycle: NesCycle): void {
    this.length.clockHalf()
    this.timer = this.sweep.clockHalf(this.timer)
    this.refresh(cycle)
  }

  /** Hot path. `nextCycle` is Infinity whenever the channel is silent and every state
   *  change goes through `refresh()`, so a stepping channel is by construction NOT
   *  silent — no mute check belongs here. */
  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at
    const sequencer = this.sequencer
    sequencer.advance()
    this.nextCycle = at + this.stepPeriod
    this.out = sequencer.output * this.level
  }

  /** Recompute `out` and re-arm the timer after any state change.
   *
   *  A channel that is already running keeps its divider phase: the hardware's timer is
   *  a down-counter that only reloads from the period register on underflow, so a
   *  mid-period $4002/$4003 write — or a sweep write-back — must not move `nextCycle`.
   *
   *  A channel coming out of silence restarts its divider at `cycle` (deviation D-P1).
   *  On hardware the divider keeps counting while the channel is muted; freezing it
   *  costs at most one duty step of phase at the moment of unmute and buys the
   *  guarantee that a muted channel contributes literally nothing to the min scan. */
  private refresh(cycle: NesCycle): void {
    const wasSilent = this.nextCycle === Infinity
    this.level = this.envelope.output()
    this.stepPeriod = APU_TIMER_DIVIDER * (this.timer + 1)
    if (this.isSilent()) {
      this.nextCycle = Infinity
      this.out = 0
      return
    }
    if (wasSilent) {
      this.stepCycle = cycle
      this.nextCycle = cycle + this.stepPeriod
    }
    this.out = this.sequencer.output * this.level
  }
}
