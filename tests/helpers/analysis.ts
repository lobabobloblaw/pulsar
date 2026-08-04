/** Time-domain measurements shared by the tests.
 *
 *  `zeroCrossingHz` / `peakAmplitude` / `centsBetween` are re-exported from
 *  `src/audio/dsp/toneMeasure` on purpose: the in-page tuner in `src/selftest.ts`
 *  calls the SAME functions, so "the live readout agrees with the offline render" is
 *  a claim about one implementation rather than two that happen to agree.
 */
export {
  DEFAULT_HYSTERESIS,
  centsBetween,
  peakAmplitude,
  zeroCrossingHz,
} from '../../src/audio/dsp/toneMeasure'

import { magnitudeSpectrum, peakHzParabolic } from './dft'

export function rms(buf: ArrayLike<number>, from = 0, to = buf.length): number {
  let sum = 0
  for (let i = from; i < to; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / (to - from))
}

export function hasNonFinite(buf: ArrayLike<number>): boolean {
  for (let i = 0; i < buf.length; i++) if (!Number.isFinite(buf[i])) return true
  return false
}

export function maxAbs(buf: ArrayLike<number>): number {
  let m = 0
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i])
    if (a > m) m = a
  }
  return m
}

/** Fundamental by interpolated DFT — the second, independent pitch estimator the M2
 *  gate requires alongside zero-crossing. */
export function dftFundamentalHz(
  signal: ArrayLike<number>,
  sampleRate: number,
  offset: number,
  size: number,
  loHz = 20,
  hiHz = sampleRate / 2,
): number {
  const mag = magnitudeSpectrum(signal, offset, size)
  return peakHzParabolic(mag, sampleRate, size, loHz, hiHz)
}

/** Two Float32Arrays are bit-identical. */
export function sameSamples(a: Float32Array, b: Float32Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export function maxDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  let m = 0
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i])
    if (d > m) m = d
  }
  return m
}
