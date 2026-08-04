/** The volume envelope shared by pulse 1, pulse 2 and noise ($4000 / $4004 / $400C).
 *
 *  One register does four jobs: DDLC VVVV holds the duty (pulse only, handled by the
 *  channel), the loop/length-halt flag, the constant-volume flag, and a 4-bit field V
 *  that is EITHER the constant volume OR the decay divider's period, depending on the
 *  C bit. The decay counter itself runs either way — switching C on a sounding note
 *  changes what is heard, not what the unit is doing. That is why `clockQuarter()`
 *  never looks at `constantVolume`.
 *
 *  Clocked by the frame counter's quarter-frame signal (~240 Hz).
 *
 *  Bitwise operators here act on an 8-bit register value only (plan B5).
 */
import { MAX_VOLUME } from '../constants'

export class Envelope {
  /** $4000 bit 5 — shared with the length-counter halt. Reloads the decay to 15
   *  instead of stopping at 0. */
  loop = false
  /** $4000 bit 4. When set, `output()` is the raw V field. */
  constantVolume = true
  /** $4000 bits 3–0: constant volume, or the decay divider's period. */
  volume = 0
  /** Set by $4003/$4007/$400F; consumed on the next quarter-frame clock. */
  startFlag = false
  /** Divider that turns the ~240 Hz quarter clock into one decay step every V+1. */
  divider = 0
  /** 15 → 0, the envelope's actual output while `constantVolume` is clear. */
  decayLevel = 0

  reset(): void {
    this.loop = false
    this.constantVolume = true
    this.volume = 0
    this.startFlag = false
    this.divider = 0
    this.decayLevel = 0
  }

  /** $4000 / $4004 / $400C — ..LC VVVV. */
  writeControl(value: number): void {
    this.loop = (value & 0x20) !== 0
    this.constantVolume = (value & 0x10) !== 0
    this.volume = value & 0x0f
  }

  /** $4003 / $4007 / $400F side effect. The reload is deferred to the next quarter
   *  clock — the hardware only ever sets a flag here. */
  restart(): void {
    this.startFlag = true
  }

  clockQuarter(): void {
    if (this.startFlag) {
      this.startFlag = false
      this.decayLevel = MAX_VOLUME
      this.divider = this.volume
      return
    }
    if (this.divider > 0) {
      this.divider--
      return
    }
    this.divider = this.volume
    if (this.decayLevel > 0) this.decayLevel--
    else if (this.loop) this.decayLevel = MAX_VOLUME
  }

  /** 0..15 — what the channel multiplies its waveform bit by. */
  output(): number {
    return this.constantVolume ? this.volume : this.decayLevel
  }
}
