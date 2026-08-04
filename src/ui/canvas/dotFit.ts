/** The lattice sizing rule, alone in its own module so the node test project
 *  can import it without dragging `dotMatrix`'s DOM-touching import chain
 *  (gridMetrics reads `document`) into a lib that has no DOM. */

/** The dot size that fits a cols x rows lattice into a width x height CSS box:
 *  the largest integer dot that fits BOTH axes, clamped to [dotMin, dotMax].
 *  Height defaults to unbounded at the call sites that size by width alone
 *  (the meter); the screen passes its viewport budget. Pinned by
 *  `tests/unit/dotMatrix.test.ts` — the audit's live-mode defect (a 7-dot
 *  lattice squeezed into an 880px box and resampled) was a wrong answer
 *  produced by feeding this rule a padding-inflated width. */
export function dotFor(
  width: number,
  height: number,
  cols: number,
  rows: number,
  dotMin: number,
  dotMax: number,
): number {
  const fit = Math.floor(Math.min(width / cols, height / rows))
  return fit < dotMin ? dotMin : fit > dotMax ? dotMax : fit
}
