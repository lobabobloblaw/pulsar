/** Length counter — the 2A03's note-duration timer, on all four non-DPCM channels.
 *
 *  Two behaviours blargg's tests key on and that are easy to get wrong:
 *    - clearing the channel's $4015 enable bit forces the counter to 0 AND blocks
 *      every subsequent load until the bit is set again (it is not merely a mute);
 *    - the halt bit freezes the counter in place, it does not zero it, so a halted
 *      note sustains forever and resumes counting from where it stopped.
 *
 *  Clocked by the frame counter's half-frame signal (~120 Hz).
 *
 *  `& 0x1f` masks a 5-bit register field, never a cycle count (plan B5).
 */
import { LENGTH_TABLE } from '../tables'

export class LengthCounter {
  /** Remaining half-frame clocks. Zero silences the channel. */
  counter = 0
  /** $4000/$4004/$400C bit 5, or $4008 bit 7 for the triangle. */
  halt = false
  /** $4015 enable bit for this channel. */
  enabled = false

  reset(): void {
    this.counter = 0
    this.halt = false
    this.enabled = false
  }

  /** $4003/$4007/$400B/$400F bits 7–3. Ignored entirely while disabled. */
  load(index5: number): void {
    if (!this.enabled) return
    this.counter = LENGTH_TABLE[index5 & 0x1f]
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) this.counter = 0
  }

  clockHalf(): void {
    if (this.halt) return
    if (this.counter > 0) this.counter--
  }

  get active(): boolean {
    return this.counter > 0
  }
}
