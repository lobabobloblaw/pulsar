/** The noise channel's 15-bit linear-feedback shift register.
 *
 *  One register, two tap positions, two completely different characters:
 *    mode 0 (long)  — feedback from bit 1, period 32 767, sounds like white noise
 *    mode 1 (short) — feedback from bit 6, period 93, sounds like a metallic buzz
 *
 *  The register powers up as 1 and can never reach 0: bit 0 and the tap would both
 *  have to be 0 for the feedback to stay 0, and a 0 register would need to have come
 *  from a 0 register. That is asserted over both full periods in noiseLfsr.test.ts.
 *
 *  Output is SILENCED (0) while bit 0 is set — the register keeps shifting either way,
 *  the channel just contributes nothing to the mix half the time. That is why noise is
 *  perceptually quieter than a pulse at the same volume setting.
 *
 *  Bitwise operators here act on a 15-bit register, never on a cycle count (plan B5).
 */
export class NoiseLfsr {
  /** 15-bit shift register. Power-up value is 1. */
  reg = 1
  /** $400E bit 7. false = 15-bit "long" mode, true = 6-bit-tap "short" mode. */
  mode = false

  reset(): void {
    this.reg = 1
    this.mode = false
  }

  clock(): void {
    const r = this.reg
    const feedback = (r & 1) ^ ((r >> (this.mode ? 6 : 1)) & 1)
    this.reg = (r >>> 1) | (feedback << 14)
  }

  /** True when the channel outputs 0 this step. */
  get silenced(): boolean {
    return (this.reg & 1) === 1
  }
}
