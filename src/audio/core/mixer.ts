/** The 2A03 mixer. Two DAC groups feed one summing node through a deliberately
 *  non-linear network; `mixLut` is the shipped path and is re-evaluated in full on
 *  every channel state change.
 *
 *  Do NOT "optimise" this into per-channel linear buffers that get summed later:
 *  the non-linearity is what makes a NES sound like a NES, and evaluating it after
 *  band-limited synthesis re-introduces exactly the aliasing the kernel removes.
 *  There is ~200× headroom in the budget for doing it the right way.
 */
import { PULSE_LUT, TND_LUT } from './tables'

/** Shipped mixer: two table lookups and one add. All inputs are integers —
 *  pulses 0..15, triangle 0..15, noise 0..15, dmc 0..127. */
export function mixLut(
  pulse1: number,
  pulse2: number,
  triangle: number,
  noise: number,
  dmc: number,
): number {
  return PULSE_LUT[pulse1 + pulse2] + TND_LUT[3 * triangle + 2 * noise + dmc]
}

/** NESdev's first-order linear approximation. Offered as `mixerMode: 'linear'` for
 *  A/B listening and for reference renders; it is audibly flatter and loses the
 *  DPCM-ducking interaction entirely. */
export const LINEAR_PULSE_COEFF = 0.00752
export const LINEAR_TRIANGLE_COEFF = 0.00851
export const LINEAR_NOISE_COEFF = 0.00494
export const LINEAR_DMC_COEFF = 0.00335

export function mixLinear(
  pulse1: number,
  pulse2: number,
  triangle: number,
  noise: number,
  dmc: number,
): number {
  return (
    LINEAR_PULSE_COEFF * (pulse1 + pulse2) +
    LINEAR_TRIANGLE_COEFF * triangle +
    LINEAR_NOISE_COEFF * noise +
    LINEAR_DMC_COEFF * dmc
  )
}

/** The exact analog formulas the two lookup tables approximate. Kept as the
 *  reference the LUT tests measure against — never used in the render path. */
export function mixExact(
  pulse1: number,
  pulse2: number,
  triangle: number,
  noise: number,
  dmc: number,
): number {
  const p = pulse1 + pulse2
  const pulseOut = p === 0 ? 0 : 95.88 / (8128 / p + 100)
  const tnd = triangle / 8227 + noise / 12241 + dmc / 22638
  const tndOut = tnd === 0 ? 0 : 159.79 / (1 / tnd + 100)
  return pulseOut + tndOut
}

export type MixerMode = 'lut' | 'linear'

/** Linear gain applied to the VRC6's summed output (`pulse1 + pulse2 + saw`, 0..61
 *  in practice and 0..63 nominal) before it is added to whichever 2A03 mix is running.
 *
 *  `PULSE_LUT[15] / 15` — chosen so ONE VRC6 pulse at volume 15 swings exactly as far
 *  as a LONE 2A03 pulse at volume 15. The reference point matters: the 2A03's own
 *  pulse ladder compresses, so a pulse sitting inside a full 2A03 mix contributes less
 *  than the same pulse alone. Calibrating against the lone pulse is what reproduces the
 *  balance a VRC6 cartridge actually has — the expansion is audibly the louder voice in
 *  a busy passage, because it keeps its full level while the 2A03's own channels are
 *  busy compressing each other.
 *
 *  It is a plain multiply, not a table, because the VRC6 has no ladder to model: the
 *  three outputs meet at the cartridge's expansion audio pin and sum. */
export const VRC6_GAIN = PULSE_LUT[15] / 15
