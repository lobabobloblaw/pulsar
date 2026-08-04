/** The pulse channel's 8-step duty sequencer.
 *
 *  The step counter INCREMENTS and indexes the output waveform directly; a $4003 /
 *  $4007 write resets it to 0 (which is the audible "duty phase reset" click that
 *  blargg's tests look for). The hardware's decrementing lookup form is kept in
 *  `DUTY_LOOKUP` and the equivalence is asserted in tests/unit/dutySequencer.test.ts.
 *
 *  `& 7` / `& 3` here mask a 3-bit step and a 2-bit duty index — never a cycle count.
 */
import { DUTY_OUTPUT } from '../tables'

export class DutySequencer {
  duty = 0
  step = 0
  /** Current waveform bit, 0 or 1. Kept as a field so the channel never has to
   *  index the table on the read path. */
  output = 0

  setDuty(duty: number): void {
    this.duty = duty & 3
    this.output = DUTY_OUTPUT[this.duty * 8 + this.step]
  }

  reset(): void {
    this.step = 0
    this.output = DUTY_OUTPUT[this.duty * 8]
  }

  advance(): void {
    const step = (this.step + 1) & 7
    this.step = step
    this.output = DUTY_OUTPUT[this.duty * 8 + step]
  }
}
