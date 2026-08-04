/** Pitch measurement from a rendered buffer — shared by the in-page tuner readout
 *  (`src/selftest.ts`, later the Screen's tuner) and by the offline test suite, so
 *  "the live readout agrees with the offline render" is a real claim about one
 *  algorithm rather than two that happen to agree today.
 *
 *  Plain zero-crossing counting does NOT work on this signal, and the reason is worth
 *  writing down. Band-limited step synthesis at a 0.465·fs cutoff leaves a few percent
 *  of near-Nyquist ripple on each edge (that ripple is the price of −128 dBc images),
 *  and the NES's 440 Hz analog high-pass droops a held A440 square down to ~4 % of its
 *  amplitude before the next edge arrives. The ripple therefore crosses zero many
 *  times per period. A Schmitt trigger at a fraction of the measured peak ignores all
 *  of it: measured error 0.002 cents over a one-second render, 0.033 cents over a
 *  single 4096-sample analyser window.
 */

/** Fraction of peak amplitude used as the trigger threshold. */
export const DEFAULT_HYSTERESIS = 0.25

export function peakAmplitude(buf: ArrayLike<number>, from = 0, to = buf.length): number {
  let peak = 0
  for (let i = from; i < to; i++) {
    const a = buf[i] < 0 ? -buf[i] : buf[i]
    if (a > peak) peak = a
  }
  return peak
}

/** Fundamental frequency by hysteresis zero-crossing, with linear interpolation of
 *  each trigger point. Returns 0 when fewer than two periods are present. */
export function zeroCrossingHz(
  buf: ArrayLike<number>,
  sampleRate: number,
  hysteresis: number = DEFAULT_HYSTERESIS,
  from = 0,
): number {
  const peak = peakAmplitude(buf, from)
  if (peak <= 0) return 0
  const threshold = peak * hysteresis
  let armed = false
  let count = 0
  let first = 0
  let last = 0
  for (let i = from + 1; i < buf.length; i++) {
    const y = buf[i]
    if (y < -threshold) {
      armed = true
      continue
    }
    if (armed && y >= threshold && buf[i - 1] < threshold) {
      const prev = buf[i - 1]
      const t = i - 1 + (threshold - prev) / (y - prev)
      if (count === 0) first = t
      last = t
      count++
      armed = false
    }
  }
  if (count < 2 || last <= first) return 0
  return ((count - 1) * sampleRate) / (last - first)
}

export function centsBetween(hz: number, referenceHz: number): number {
  return 1200 * Math.log2(hz / referenceHz)
}
