/** The lattice sizing rule, pinned (UI audit 2026-08-04).
 *
 *  Live mode once fed this rule a padding-inflated width (912 for an 880px
 *  content box): it answered 7, the 896px canvas hit reset.css's
 *  `max-width: 100%`, and every dot resampled at 2.036 device px per CSS px.
 *  The boundary cases here keep the rule honest in both axes — the height
 *  axis is what lets the instrument fit a short window without scrolling.
 */
import { describe, expect, it } from 'vitest'
import { dotFor } from '../../src/ui/canvas/dotFit'
import { DOT_MAX, DOT_MIN, LATTICE } from '../../src/design/tokens'

const fit = (w: number, h: number): number =>
  dotFor(w, h, LATTICE.cols, LATTICE.rows, DOT_MIN, DOT_MAX)

describe('dotFor', () => {
  it('width-limited: the audit regression pair', () => {
    // The well's content box is 880 at the phase-1 device width: dot 6.
    expect(fit(880, Infinity)).toBe(6)
    // The padding-inflated 912 is what produced the resampled 7-dot lattice.
    expect(fit(912, Infinity)).toBe(7)
  })

  it('height-limited: the viewport budget wins when it is the tighter axis', () => {
    expect(fit(880, 402)).toBe(6)
    expect(fit(880, 384)).toBe(6) // exact fit, no off-by-one
    expect(fit(880, 383)).toBe(5)
    expect(fit(880, 320)).toBe(5)
    expect(fit(880, 319)).toBe(4)
  })

  it('clamps to the dot bounds instead of vanishing or ballooning', () => {
    expect(fit(100_000, Infinity)).toBe(DOT_MAX)
    expect(fit(100, 50)).toBe(DOT_MIN)
    expect(fit(0, 0)).toBe(DOT_MIN)
  })

  it('unbounded height reproduces the width-only rule (the meter path)', () => {
    for (const w of [96, 384, 640, 896, 1160]) {
      expect(fit(w, Infinity)).toBe(Math.min(DOT_MAX, Math.max(DOT_MIN, Math.floor(w / LATTICE.cols))))
    }
  })
})
