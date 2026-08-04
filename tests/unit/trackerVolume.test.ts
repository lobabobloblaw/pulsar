/** Volume composition — the one formula everything funnels through (design §3.3).
 *
 *  Headline assertions:
 *    - the full 16×16 table of `(volume column) × (volume macro)`, pinned literally.
 *      That the two compose MULTIPLICATIVELY is documented; the exact integer rounding
 *      `(a·(b+1)) >> 4` is **[ours]** and this table is what pins it (D-TK4).
 *    - a live note is NEVER rounded to silence: a non-zero column times a non-zero
 *      macro is at least 1.
 *    - tremolo is applied AFTER the multiply, not before — also [ours], also D-TK4.
 *    - `Axy`'s direction: **x slides DOWN, y slides UP**, in eighths. This is the
 *      opposite of the ProTracker convention and the single most likely bug here.
 */
import { describe, expect, it } from 'vitest'
import {
  CHAN_VOL_SCALE,
  MAX_CHAN_VOL8,
  composeVolume,
  volumeSlideStep,
} from '../../src/tracker/driver/effects'

/** Composition with the column expressed as 0..15, which is how a song stores it. */
function compose(column: number, macro: number, trem = 0): number {
  return composeVolume(column * CHAN_VOL_SCALE, macro, trem)
}

describe('the 16x16 composition table (D-TK4)', () => {
  it('is exactly this', () => {
    const table: number[][] = []
    for (let column = 0; column <= 15; column++) {
      const row: number[] = []
      for (let macro = 0; macro <= 15; macro++) row.push(compose(column, macro))
      table.push(row)
    }
    expect(table).toEqual([
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3],
      [0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4],
      [0, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5],
      [0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6],
      [0, 1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7],
      [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8],
      [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7, 8, 9],
      [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8, 9, 10],
      [0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 11],
      [0, 1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12],
      [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13],
      [0, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    ])
  })

  it('matches the four values the design names', () => {
    expect(compose(15, 15)).toBe(15)
    expect(compose(15, 0)).toBe(0)
    expect(compose(8, 15)).toBe(8)
    expect(compose(8, 8)).toBe(4)
  })

  it('never rounds a live note to silence', () => {
    for (let column = 1; column <= 15; column++) {
      for (let macro = 1; macro <= 15; macro++) {
        expect(compose(column, macro), `${column}x${macro}`).toBeGreaterThanOrEqual(1)
      }
    }
    // ...but a zero on either side IS silence. The guard must not invent sound.
    expect(compose(0, 15)).toBe(0)
    expect(compose(15, 0)).toBe(0)
  })

  it('is monotone in both arguments', () => {
    for (let column = 0; column <= 15; column++) {
      for (let macro = 1; macro <= 15; macro++) {
        expect(compose(column, macro)).toBeGreaterThanOrEqual(compose(column, macro - 1))
      }
    }
    for (let macro = 0; macro <= 15; macro++) {
      for (let column = 1; column <= 15; column++) {
        expect(compose(column, macro)).toBeGreaterThanOrEqual(compose(column - 1, macro))
      }
    }
  })
})

describe('tremolo is applied last', () => {
  it('subtracts from the composed value, not from the column', () => {
    // Column 8 x macro 15 = 8; a tremolo of 4 leaves 4.
    expect(compose(8, 15, 4)).toBe(4)
    // Applying the tremolo BEFORE the multiply would give (8-4)*16>>4 = 4 here too,
    // so pick a case where the two differ: column 15 x macro 8 = 8 composed.
    expect(compose(15, 8)).toBe(8)
    expect(compose(15, 8, 4)).toBe(4)
    // Before-the-multiply would be compose(11, 8) = 6, not 4.
    expect(compose(11, 8)).toBe(6)
  })

  it('clamps at zero and never boosts', () => {
    expect(compose(15, 15, 64)).toBe(0)
    expect(compose(8, 15, 0)).toBe(8)
    expect(compose(15, 15, 0)).toBe(15)
  })
})

describe('Axy volume slide — x DOWN, y UP, in eighths', () => {
  it('A0y slides UP', () => {
    let v = 8 * CHAN_VOL_SCALE
    v = volumeSlideStep(v, 0x02) // A02
    expect(v).toBe(8 * CHAN_VOL_SCALE + 2)
    // Four ticks of A02 is one whole volume step.
    v = volumeSlideStep(volumeSlideStep(volumeSlideStep(v, 0x02), 0x02), 0x02)
    expect(v >> 3).toBe(9)
  })

  it('Ax0 slides DOWN — the opposite of the ProTracker convention', () => {
    let v = 8 * CHAN_VOL_SCALE
    v = volumeSlideStep(v, 0x20) // A20
    expect(v).toBe(8 * CHAN_VOL_SCALE - 2)
    expect(volumeSlideStep(8 * CHAN_VOL_SCALE, 0x80) >> 3).toBe(7)
  })

  it('A00 is a hold, not a slide', () => {
    expect(volumeSlideStep(64, 0x00)).toBe(64)
  })

  it('clamps at 0 and at 15 (120 at 8x)', () => {
    let v = 0
    for (let i = 0; i < 40; i++) v = volumeSlideStep(v, 0xf0)
    expect(v).toBe(0)
    v = MAX_CHAN_VOL8
    for (let i = 0; i < 40; i++) v = volumeSlideStep(v, 0x0f)
    expect(v).toBe(MAX_CHAN_VOL8)
    expect(MAX_CHAN_VOL8 >> 3).toBe(15)
  })

  it('nets out when both nibbles are set', () => {
    expect(volumeSlideStep(64, 0x33)).toBe(64)
    expect(volumeSlideStep(64, 0x13)).toBe(66)
    expect(volumeSlideStep(64, 0x31)).toBe(62)
  })
})
