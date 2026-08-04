/** The analog output section, as one-pole IIR sections.
 *
 *  Both section types share the same coefficient `k = exp(−2π·fc/fs)`, so the whole
 *  chain is rate-agnostic: change the sample rate, recompute three numbers.
 *    high-pass: y = k·(yPrev + x − xPrev)
 *    low-pass:  y = (1 − k)·x + k·yPrev
 *
 *  Console models (plan B7):
 *    nes      HP 90 Hz → HP 440 Hz → LP 14 kHz
 *    famicom  a single HP 37 Hz
 *    none     bypass — offline analysis only, so the aliasing measurement can look
 *             at raw band-limited synthesis as well as at the shipped signal path
 *
 *  'famicom' and 'none' are expressed as coefficient values rather than as branches:
 *  a high-pass with k = 1 and a low-pass with k = 0 are both bit-exact identities,
 *  so `process()` is a straight-line three-section evaluation in every mode.
 */
import { FAMICOM_HP_HZ, NES_HP1_HZ, NES_HP2_HZ, NES_LP_HZ } from './constants'

export type ConsoleModel = 'nes' | 'famicom'
export type FilterModel = ConsoleModel | 'none'

/** k = exp(−2π·fc/fs). @48 kHz: 90 Hz → 0.9882881515, 440 Hz → 0.9440313862,
 *  14 kHz → 0.1599977199. @44.1 kHz: 0.9872590350 / 0.9392351762 / 0.1360596342. */
export function onePoleCoeff(cutoffHz: number, sampleRate: number): number {
  return Math.exp((-2 * Math.PI * cutoffHz) / sampleRate)
}

export class OnePoleHighPass {
  /** k = 1 is a bit-exact pass-through. */
  k = 1
  private xPrev = 0
  private yPrev = 0

  setCutoff(cutoffHz: number, sampleRate: number): void {
    this.k = onePoleCoeff(cutoffHz, sampleRate)
  }

  bypass(): void {
    this.k = 1
  }

  reset(): void {
    this.xPrev = 0
    this.yPrev = 0
  }

  process(x: number): number {
    const y = this.k * (this.yPrev + x - this.xPrev)
    this.xPrev = x
    this.yPrev = y
    return y
  }
}

export class OnePoleLowPass {
  /** k = 0 is a bit-exact pass-through. */
  k = 0
  private yPrev = 0

  setCutoff(cutoffHz: number, sampleRate: number): void {
    this.k = onePoleCoeff(cutoffHz, sampleRate)
  }

  bypass(): void {
    this.k = 0
  }

  reset(): void {
    this.yPrev = 0
  }

  process(x: number): number {
    const y = (1 - this.k) * x + this.k * this.yPrev
    this.yPrev = y
    return y
  }
}

/** Three named sections — never an array (megamorphic dispatch in the hot loop). */
export class AnalogFilterChain {
  readonly hp1 = new OnePoleHighPass()
  readonly hp2 = new OnePoleHighPass()
  readonly lp = new OnePoleLowPass()
  model: FilterModel = 'nes'
  sampleRate = 0

  setRates(sampleRate: number, model: FilterModel): void {
    this.sampleRate = sampleRate
    this.model = model
    if (model === 'nes') {
      this.hp1.setCutoff(NES_HP1_HZ, sampleRate)
      this.hp2.setCutoff(NES_HP2_HZ, sampleRate)
      this.lp.setCutoff(NES_LP_HZ, sampleRate)
    } else if (model === 'famicom') {
      this.hp1.setCutoff(FAMICOM_HP_HZ, sampleRate)
      this.hp2.bypass()
      this.lp.bypass()
    } else {
      this.hp1.bypass()
      this.hp2.bypass()
      this.lp.bypass()
    }
    this.reset()
  }

  reset(): void {
    this.hp1.reset()
    this.hp2.reset()
    this.lp.reset()
  }

  process(x: number): number {
    return this.lp.process(this.hp2.process(this.hp1.process(x)))
  }
}
