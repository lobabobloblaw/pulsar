/** Band-limited step kernel — a Kaiser-windowed sinc, tabulated at 64 sub-sample
 *  phases plus one guard row so `addDelta` can linearly interpolate between rows.
 *
 *  What is stored is the band-limited IMPULSE. `BandlimitedBuf.readSamples` runs a
 *  cumulative sum over the delta buffer, which integrates the impulse into the
 *  band-limited STEP — that is the whole "blip" trick: one kernel splat per
 *  register-accurate edge instead of per output sample.
 *
 *  Design numbers (plan B2/B7, all independently re-derived here):
 *    H = 16 half-width taps → 32 taps per row
 *    P = 64 phases (+1 guard row = 65 rows) — phase count dominates image rejection
 *    Kaiser β = 10, cutoff c = 0.465·fs
 *  → measured images at −127.5 dBc / −118.8 dBc for a 12.4 kHz square at 48 kHz
 *    (naive point-sampling of the same wave: −9.8 dBc). See tests/unit/aliasing.test.ts.
 *
 *  MANDATORY: every row is normalised to sum to exactly 1.0. Un-normalised rows make
 *  each edge deposit a slightly different amount of energy depending on its sub-sample
 *  phase, which shows up as an fs-locked buzz riding on every note.
 *
 *  No bitwise operators appear in this file: cycle-domain values are f64 doubles and
 *  `|0`/`<<`/`>>`/`&` would silently wrap them (see plan B5).
 */

/** Half-width of the kernel in output samples. */
export const KERNEL_HALF = 16
/** Taps per row = 2·KERNEL_HALF. A delta landing at sample `pos` touches [pos, pos+31]. */
export const KERNEL_WIDTH = 32
/** Sub-sample phases resolved by the table; the remainder is linearly interpolated. */
export const PHASE_COUNT = 64
/** PHASE_COUNT + 1 — the extra row is the right-hand partner of phase 63. */
export const KERNEL_ROWS = 65
/** Kaiser window shape parameter. */
export const KAISER_BETA = 10.0
/** Sinc cutoff as a fraction of the output sample rate (0.465·fs ≈ 0.93·Nyquist). */
export const KERNEL_CUTOFF = 0.465

/** Group delay of the kernel in output samples: the impulse response is symmetric
 *  about tap index KERNEL_HALF − 1 = 15. At 48 kHz that is 0.3125 ms, and it is a
 *  counted line item in the latency budget (deviation D-B2). */
export const KERNEL_GROUP_DELAY = KERNEL_HALF - 1

/** Zeroth-order modified Bessel function of the first kind, via its power series
 *  I0(x) = Σ (x/2)^2k / (k!)². Converges in ~30 terms at x = β = 10. */
export function besselI0(x: number): number {
  let sum = 1
  let term = 1
  for (let k = 1; k < 64; k++) {
    const r = x / (2 * k)
    term *= r * r
    sum += term
    if (term < 1e-18 * sum) break
  }
  return sum
}

/** Builds the KERNEL_ROWS × KERNEL_WIDTH table, row-major, f64 (16.25 KiB — still
 *  comfortably L1-resident; f32 would halve it but costs precision on the running
 *  integrator that never gets reset). */
export function buildStepKernel(): Float64Array {
  const table = new Float64Array(KERNEL_ROWS * KERNEL_WIDTH)
  const invI0Beta = 1 / besselI0(KAISER_BETA)
  const twoC = 2 * KERNEL_CUTOFF

  for (let p = 0; p < KERNEL_ROWS; p++) {
    const base = p * KERNEL_WIDTH
    let sum = 0
    for (let i = 0; i < KERNEL_WIDTH; i++) {
      // Distance from this tap to the (fractional) impulse centre, in samples.
      const x = i - KERNEL_GROUP_DELAY - p / PHASE_COUNT
      const a = twoC * x
      const sinc = a === 0 ? twoC : (twoC * Math.sin(Math.PI * a)) / (Math.PI * a)
      const r = x / KERNEL_HALF
      const rr = 1 - r * r
      // |r| ≤ 1 by construction; rr === 0 at the outermost tap → window = 1/I0(β).
      const window = rr <= 0 ? invI0Beta : besselI0(KAISER_BETA * Math.sqrt(rr)) * invI0Beta
      const v = sinc * window
      table[base + i] = v
      sum += v
    }
    const norm = 1 / sum
    for (let i = 0; i < KERNEL_WIDTH; i++) table[base + i] *= norm
  }
  return table
}

/** The one shared kernel table. Built once at module load; every BandlimitedBuf
 *  instance points at it (it depends only on H/P/β/c, never on the sample rate). */
export const STEP_KERNEL: Float64Array = buildStepKernel()
