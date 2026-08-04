/** The vibrato / tremolo table and its 4-quadrant reconstruction (design §3.2, D-TK3).
 *
 *  Headline assertions:
 *    - the 16×16 quarter-wave snapshot, pinned literally. `VIB[d][i] =
 *      round(AMP[d]·sin(i·π/30))` is **[ours]** — no licence-safe source publishes
 *      FamiTracker's table — so this snapshot IS the specification.
 *    - the 6-bit accumulator produces a full BIPOLAR cycle in exactly 64 ticks at
 *      speed 1, and the four quadrants join CONTINUOUSLY at every seam.
 *    - the depth-7 row against the one published FamiTracker row the design could
 *      corroborate: we reproduce 14 of its 16 values and differ at i = 10 and i = 12.
 *      The divergence is asserted deliberately, so it can never drift unnoticed and so
 *      a future contributor with a working famitracker.com wiki knows exactly what to
 *      check (docs/deviations.md, D-TK3).
 */
import { describe, expect, it } from 'vitest'
import {
  VIB_ACC_MASK,
  VIB_AMP,
  VIB_PHASES,
  VIB_TABLE,
  vibratoValue,
} from '../../src/tracker/driver/effects'

function row(depth: number): number[] {
  const out: number[] = []
  for (let i = 0; i < VIB_PHASES; i++) out.push(VIB_TABLE[depth * VIB_PHASES + i])
  return out
}

function hex(values: number[]): string {
  return values.map((v) => v.toString(16).padStart(2, '0')).join(' ')
}

describe('the quarter-wave table', () => {
  it('is exactly this 16x16 snapshot', () => {
    const table: number[][] = []
    for (let d = 0; d < 16; d++) table.push(row(d))
    expect(table).toEqual([
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
      [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4],
      [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
      [0, 1, 2, 2, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8, 8],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 11, 11, 11],
      [0, 1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 13, 14, 14, 14],
      [0, 2, 4, 6, 7, 9, 11, 12, 13, 15, 16, 16, 17, 18, 18, 18],
      [0, 2, 5, 7, 9, 11, 14, 15, 17, 19, 20, 21, 22, 22, 23, 23],
      [0, 3, 6, 9, 12, 14, 17, 19, 22, 23, 25, 26, 28, 28, 29, 29],
      [0, 4, 7, 11, 15, 18, 21, 24, 27, 29, 31, 33, 34, 35, 36, 36],
      [0, 5, 9, 14, 18, 22, 26, 29, 33, 36, 38, 40, 42, 43, 44, 44],
      [0, 6, 11, 17, 22, 27, 32, 36, 40, 44, 47, 49, 51, 53, 54, 54],
      [0, 7, 13, 20, 26, 32, 38, 43, 48, 52, 55, 58, 61, 63, 64, 64],
    ])
  })

  it('starts at zero and reaches exactly AMP[d] at the peak', () => {
    for (let d = 0; d < 16; d++) {
      expect(VIB_TABLE[d * VIB_PHASES]).toBe(0)
      expect(VIB_TABLE[d * VIB_PHASES + 15]).toBe(VIB_AMP[d])
    }
  })

  it('is non-decreasing across the quarter wave, at every depth', () => {
    for (let d = 0; d < 16; d++) {
      const r = row(d)
      for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1])
    }
  })

  it('reproduces 14 of the 16 cells of the corroborated depth-7 row (D-TK3)', () => {
    const ours = row(7)
    const cited = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 11, 11, 11, 11]
    expect(hex(ours)).toBe('00 01 02 03 04 05 06 07 08 09 0a 0a 0a 0b 0b 0b')
    const differ: number[] = []
    for (let i = 0; i < 16; i++) if (ours[i] !== cited[i]) differ.push(i)
    // Exactly two cells, and exactly these two. If this ever changes, so did the table.
    expect(differ).toEqual([10, 12])
  })
})

describe('the 6-bit accumulator', () => {
  it('completes a full bipolar cycle in exactly 64 ticks at speed 1', () => {
    const depth = 15
    const values: number[] = []
    let acc = 0
    for (let t = 0; t < 64; t++) {
      values.push(vibratoValue(acc, depth))
      acc = (acc + 1) & VIB_ACC_MASK
    }
    expect(acc).toBe(0)
    expect(values.length).toBe(64)
    expect(Math.max(...values)).toBe(VIB_AMP[depth])
    expect(Math.min(...values)).toBe(-VIB_AMP[depth])
    // Rises to the peak, back to zero, down to the trough, back to zero.
    expect(values[0]).toBe(0)
    expect(values[15]).toBe(VIB_AMP[depth])
    expect(values[31]).toBe(0)
    expect(values[47]).toBe(-VIB_AMP[depth])
    expect(values[63]).toBe(0)
    // Symmetric about zero.
    let sum = 0
    for (const v of values) sum += v
    expect(sum).toBe(0)
  })

  it('joins continuously at every quadrant seam', () => {
    for (let depth = 1; depth < 16; depth++) {
      const step = VIB_AMP[depth] // the widest single step at this depth is far below
      for (let acc = 0; acc < 64; acc++) {
        const a = vibratoValue(acc, depth)
        const b = vibratoValue((acc + 1) & VIB_ACC_MASK, depth)
        // No seam may produce a bigger jump than the biggest interior step.
        expect(Math.abs(b - a), `depth ${depth} acc ${acc}`).toBeLessThanOrEqual(step)
      }
      // The seams specifically: 15->16, 31->32, 47->48, 63->0.
      for (const seam of [15, 31, 47, 63]) {
        const a = vibratoValue(seam, depth)
        const b = vibratoValue((seam + 1) & VIB_ACC_MASK, depth)
        expect(Math.abs(b - a), `seam ${seam}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('halves the period when the speed doubles', () => {
    let acc = 0
    let ticks = 0
    do {
      acc = (acc + 2) & VIB_ACC_MASK
      ticks++
    } while (acc !== 0)
    expect(ticks).toBe(32)
  })

  it('depth 0 is silence and depth 15 is the widest deviation', () => {
    for (let acc = 0; acc < 64; acc++) expect(vibratoValue(acc, 0)).toBe(0)
    expect(VIB_AMP[15]).toBe(64)
  })
})
