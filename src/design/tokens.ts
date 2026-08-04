/* pulsar — the slice of the design tokens the canvas needs.
 *
 * Canvas cannot read CSS custom properties without a getComputedStyle call per
 * frame, so the screen palette is mirrored here as literals. These MUST stay in
 * sync with the `--screen-*` block in tokens.css; the screen is the one surface
 * whose tokens never change between rooms, which is exactly why mirroring it is
 * safe (the enclosure tokens are deliberately NOT mirrored).
 */

/** The lattice every lit thing is built from: 3px dot on a 4px pitch. */
export const LATTICE = {
  cols: 128,
  rows: 64,
  /** Gap in lattice units between adjacent dots — one dot is `dot - gap` px. */
  gap: 1,
} as const

export const SCREEN = {
  bg: '#181818',
  dotOff: '#303030',
  ink: '#ffffff',
  dim: '#a8a8a8',
  accent: '#ffc003',
} as const

/** Dot size bounds for the sizing rule in dotMatrix.ts. */
export const DOT_MIN = 3
export const DOT_MAX = 8

/** Decorative canvas timings, in ms. Mirrors --dur-* intent for the renderers. */
export const CANVAS_DUR = {
  /** Raster scan paint of the unlit lattice, 64 rows. */
  scan: 380,
  /** Boot art resolving onto the lattice the scan just laid down. */
  resolve: 140,
  /** Boot art hold before the dissolve. 700 originally; the audit timed the
   *  full choreography at 1.54s before the prompt ever appeared, and the hold
   *  was the long pole. 400 lands the art and keeps the total under 1.25s. */
  hold: 400,
  /** Dot dissolve into the parameter page. */
  dissolve: 320,
  /** Last-touched parameter row stays highlighted this long. */
  touchHighlight: 900,
  /** Meter peak-hold decay. */
  peakDecay: 1200,
} as const

export type ScreenColor = (typeof SCREEN)[keyof typeof SCREEN]
