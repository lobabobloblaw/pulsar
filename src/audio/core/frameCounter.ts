/** The frame counter (a.k.a. frame sequencer) — $4017, MI-- ----.
 *
 *  It is not a timer that divides down to a nice round rate: it is a hard-wired list
 *  of CPU-cycle positions, and the intervals between them are deliberately NOT equal
 *  (7457, 7456, 7458, 7458). Implementing it as `cycle % 7457` would drift by one cycle
 *  per step and lose the 4-step mode's 59.99909 Hz period — so the table below IS the
 *  implementation, and frameCounter.test.ts asserts the non-uniformity directly.
 *
 *    4-step: quarter @ 7457 / 14913 / 22371 / 29829, half @ 14913 / 29829, period 29830
 *    5-step: quarter @ 7457 / 14913 / 22371 / 37281, half @ 14913 / 37281, period 37282
 *
 *  Quarter clocks drive the envelopes and the triangle's linear counter; half clocks
 *  drive the length counters and the sweep units. A quarter clock at 29829 ÷ 4 steps
 *  works out to 239.996 Hz, which is the rate every NES driver's vibrato and volume
 *  ramp is written against.
 *
 *  $4017 write side effects (NESdev "APU Frame Counter"):
 *    - the sequence is reset 3 or 4 CPU cycles after the write, chosen by the write
 *      cycle's parity (deviation D-F1: emulators disagree on which parity gets which);
 *    - mode 1 (bit 7 set) additionally issues an immediate quarter AND half clock at
 *      that reset point; mode 0 issues no immediate clock at all;
 *    - bit 6 (IRQ inhibit) clears the frame IRQ flag.
 *  Only 4-step mode ever sets the frame IRQ flag, and per deviation D-D2 the flag is
 *  maintained for $4015 read-back only — there is no CPU to interrupt.
 *
 *  Cycle values are pure f64 doubles; `%` and `+` only. The bitwise operators in this
 *  file act on the 8-bit $4017 value (plan B5).
 */
import type { NesCycle } from '../timeline/types'
import type { TimerEventSource } from './channels/types'

/** Cycle offsets from the start of a 4-step sequence. */
export const FRAME_STEPS_4: readonly number[] = [7457, 14913, 22371, 29829]
export const FRAME_PERIOD_4 = 29830

/** Cycle offsets from the start of a 5-step sequence. The step at 29829 does nothing
 *  at all, so it is simply absent — the sequence is four events long in both modes. */
export const FRAME_STEPS_5: readonly number[] = [7457, 14913, 22371, 37281]
export const FRAME_PERIOD_5 = 37282

/** Half-frame clocks land on sequence indices 1 and 3 in both modes. */
const HALF_AT_1 = 1
const HALF_AT_3 = 3

export class FrameCounter implements TimerEventSource {
  /** $4017 bit 7. */
  mode5 = false
  /** $4017 bit 6. */
  inhibitIrq = false
  /** Read back through $4015 bit 6; cleared by a $4015 read. Never delivered (D-D2). */
  irqFlag = false

  /** Cycle the current sequence started at. Event i fires at `origin + STEPS[i]`. */
  origin: NesCycle = 0
  stepIndex = 0

  /** True for the event that just fired. Read by the APU immediately after
   *  `stepTimer()` to fan the clocks out to the channels. */
  quarterClock = false
  halfClock = false

  /** Next scheduled sequence event. */
  private eventCycle: NesCycle = FRAME_STEPS_4[0]
  /** Pending $4017 reset (write + 3 or 4), or Infinity. */
  private resetAt: NesCycle = Infinity

  /** min(eventCycle, resetAt) — what the APU's run loop scans. Never Infinity: the
   *  frame counter is the one unit on the chip that cannot be switched off. */
  nextCycle: NesCycle = FRAME_STEPS_4[0]

  reset(): void {
    this.mode5 = false
    this.inhibitIrq = false
    this.irqFlag = false
    this.origin = 0
    this.stepIndex = 0
    this.quarterClock = false
    this.halfClock = false
    this.eventCycle = FRAME_STEPS_4[0]
    this.resetAt = Infinity
    this.nextCycle = FRAME_STEPS_4[0]
  }

  /** $4017 — MI-- ----. */
  write(value: number, cycle: NesCycle): void {
    this.mode5 = (value & 0x80) !== 0
    this.inhibitIrq = (value & 0x40) !== 0
    if (this.inhibitIrq) this.irqFlag = false
    // D-F1: 3 cycles when the write lands on an even (APU) cycle, 4 on an odd one.
    this.resetAt = cycle + (cycle % 2 === 0 ? 3 : 4)
    this.rearm()
  }

  /** Cycle offset of sequence event `index` in the current mode. */
  stepCycleOffset(index: number): number {
    return this.mode5 ? FRAME_STEPS_5[index] : FRAME_STEPS_4[index]
  }

  get periodCycles(): number {
    return this.mode5 ? FRAME_PERIOD_5 : FRAME_PERIOD_4
  }

  stepTimer(): void {
    const at = this.nextCycle
    this.quarterClock = false
    this.halfClock = false

    if (at === this.resetAt) {
      this.resetAt = Infinity
      this.origin = at
      this.stepIndex = 0
      this.eventCycle = at + this.stepCycleOffset(0)
      if (this.mode5) {
        // Mode 1 only: the reset itself issues one quarter and one half clock.
        this.quarterClock = true
        this.halfClock = true
      }
      this.rearm()
      return
    }

    const i = this.stepIndex
    this.quarterClock = true
    this.halfClock = i === HALF_AT_1 || i === HALF_AT_3
    if (!this.mode5 && i === 3 && !this.inhibitIrq) this.irqFlag = true

    const nextIndex = i === 3 ? 0 : i + 1
    this.stepIndex = nextIndex
    if (nextIndex === 0) this.origin = this.origin + this.periodCycles
    this.eventCycle = this.origin + this.stepCycleOffset(nextIndex)
    this.rearm()
  }

  /** Move the whole schedule along a timeline shift (`Apu2A03.seekTo`). */
  shiftBy(delta: number): void {
    this.origin += delta
    this.eventCycle += delta
    if (this.resetAt !== Infinity) this.resetAt += delta
    this.rearm()
  }

  private rearm(): void {
    this.nextCycle = this.resetAt < this.eventCycle ? this.resetAt : this.eventCycle
  }
}
