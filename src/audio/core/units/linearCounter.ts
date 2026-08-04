/** Triangle linear counter — $4008 CRRR RRRR.
 *
 *  A second, finer-grained duration timer that only the triangle has: it runs at the
 *  quarter-frame rate (~240 Hz) rather than the length counter's ~120 Hz, which is what
 *  lets NES basslines articulate short notes without the length table's coarse steps.
 *
 *  The control bit does double duty — it is also the triangle's length-counter halt —
 *  and its subtle half is the reload flag: the flag is set by every $400B write and is
 *  cleared on a quarter clock ONLY when control is clear. With control set the flag
 *  stays set, so the counter is re-loaded every quarter clock and the note sustains
 *  forever; that is the "hold" mode, not a separate feature.
 */
export class LinearCounter {
  /** $4008 bit 7 — control / length-counter halt. */
  control = false
  /** $4008 bits 6–0. */
  reloadValue = 0
  counter = 0
  reloadFlag = false

  reset(): void {
    this.control = false
    this.reloadValue = 0
    this.counter = 0
    this.reloadFlag = false
  }

  /** $4008 — CRRR RRRR. */
  write(value: number): void {
    this.control = (value & 0x80) !== 0
    this.reloadValue = value & 0x7f
  }

  /** $400B side effect. */
  setReloadFlag(): void {
    this.reloadFlag = true
  }

  clockQuarter(): void {
    if (this.reloadFlag) this.counter = this.reloadValue
    else if (this.counter > 0) this.counter--
    if (!this.control) this.reloadFlag = false
  }

  get active(): boolean {
    return this.counter > 0
  }
}
