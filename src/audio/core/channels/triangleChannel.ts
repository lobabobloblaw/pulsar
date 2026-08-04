/** Triangle channel — $4008, $400A, $400B.
 *
 *  The odd one out on the chip, in four ways that all matter:
 *
 *  1. It is clocked every CPU cycle, not every second one, over a 32-step sequence:
 *     f = fCPU / (32·(t + 1)). Timer 126 gives the same 440.397 Hz as pulse timer 253.
 *  2. It has no volume control at all — the 4-bit sequence IS the output.
 *  3. It has two independent duration gates: the length counter (half-frame) and the
 *     linear counter (quarter-frame).
 *  4. **When silenced it stops in phase and HOLDS its output.** It is never zeroed and
 *     never reset, so a note-off leaves the DAC wherever the waveform happened to be
 *     and emits no further deltas at all. This is a Phase-1 acceptance item (plan-file
 *     Phase 1 (e), blargg semantics) and the reason `refresh()` leaves `out` alone on
 *     the silent path — zeroing it would produce a click that hardware does not make,
 *     and the analog high-passes remove the resulting DC anyway.
 *
 *  Deviation D-T1: at t < 2 the sequencer would run at 55.9 kHz or above (a ~9 000
 *  events-per-quantum path producing an inaudible tone that the DAC averages out). We
 *  freeze the sequencer and hold the output at 7, the mean of the 32-step sequence.
 *
 *  Bitwise operators here act on register values and the 5-bit sequencer step (plan B5).
 */
import { MAX_TIMER } from '../constants'
import { TRIANGLE_SEQUENCE } from '../tables'
import { LengthCounter } from '../units/lengthCounter'
import { LinearCounter } from '../units/linearCounter'
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from './types'

/** Below this timer the sequencer is frozen and the output held (deviation D-T1). */
export const TRIANGLE_MIN_TIMER = 2

/** Held output while frozen: the mean of the 32-step sequence. */
export const TRIANGLE_FROZEN_LEVEL = 7

/** Power-up sequencer position. The hardware's power-up phase is undefined; step 15 is
 *  chosen because its output is 0, so a freshly constructed engine is silent and emits
 *  no start-up delta. */
const POWER_UP_STEP = 15

export class TriangleChannel implements ChannelEventSource {
  readonly length = new LengthCounter()
  readonly linear = new LinearCounter()

  /** 11-bit period. One sequencer step is (timer + 1) CPU cycles. */
  timer = 0
  /** 0..31 index into TRIANGLE_SEQUENCE. */
  step = POWER_UP_STEP

  out = TRIANGLE_SEQUENCE[POWER_UP_STEP]
  nextCycle: NesCycle = Infinity
  stepCycle: NesCycle = 0

  reset(): void {
    this.length.reset()
    this.linear.reset()
    this.timer = 0
    this.step = POWER_UP_STEP
    this.out = TRIANGLE_SEQUENCE[POWER_UP_STEP]
    this.nextCycle = Infinity
    this.stepCycle = 0
  }

  get enabled(): boolean {
    return this.length.enabled
  }

  /** Timer period in CPU cycles — the triangle divides by (t+1), not 2·(t+1). */
  get periodCycles(): number {
    return this.timer + 1
  }

  /** Both duration gates must be non-zero for the sequencer to advance. */
  isSilent(): boolean {
    return !this.length.active || !this.linear.active
  }

  /** $4008 — CRRR RRRR. Bit 7 is the linear counter's control flag AND the triangle's
   *  length-counter halt: one bit, two units. */
  writeLinear(value: number, cycle: NesCycle): void {
    this.linear.write(value)
    this.length.halt = (value & 0x80) !== 0
    this.refresh(cycle)
  }

  /** $400A — timer low 8 bits. */
  writeTimerLow(value: number, cycle: NesCycle): void {
    this.timer = (this.timer & 0x700) | (value & 0xff)
    this.refresh(cycle)
  }

  /** $400B — LLLL LHHH. Latches the timer high bits, loads the length counter and sets
   *  the linear counter's reload flag. The sequencer is NOT reset (that is what keeps
   *  the triangle in phase across notes). */
  writeTimerHigh(value: number, cycle: NesCycle): void {
    this.timer = (((value & 0x07) << 8) | (this.timer & 0xff)) & MAX_TIMER
    this.length.load((value >> 3) & 0x1f)
    this.linear.setReloadFlag()
    this.refresh(cycle)
  }

  /** $4015 bit 2. */
  setEnabled(on: boolean, cycle: NesCycle): void {
    this.length.setEnabled(on)
    this.refresh(cycle)
  }

  clockQuarter(cycle: NesCycle): void {
    this.linear.clockQuarter()
    this.refresh(cycle)
  }

  clockHalf(cycle: NesCycle): void {
    this.length.clockHalf()
    this.refresh(cycle)
  }

  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at
    const step = (this.step + 1) & 31
    this.step = step
    this.nextCycle = at + this.timer + 1
    this.out = TRIANGLE_SEQUENCE[step]
  }

  /** Note what is NOT here: no `out = 0`. A silenced triangle holds its level. */
  private refresh(cycle: NesCycle): void {
    const wasIdle = this.nextCycle === Infinity
    if (this.isSilent()) {
      this.nextCycle = Infinity
      return
    }
    if (this.timer < TRIANGLE_MIN_TIMER) {
      this.nextCycle = Infinity
      this.out = TRIANGLE_FROZEN_LEVEL
      return
    }
    if (wasIdle) {
      this.stepCycle = cycle
      this.nextCycle = cycle + this.timer + 1
    }
    this.out = TRIANGLE_SEQUENCE[this.step]
  }
}
