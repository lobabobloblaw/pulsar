/** The 5x7 face's letterform geometry, pinned (UI audit 2026-08-04).
 *
 *  The interface is lowercase by design, so a glyph that reads as a capital is
 *  a rendering bug, not a style: the descender letters were once authored with
 *  their bowls at row 1 and "sweep" rendered as "sweeP" on the params page.
 *  The cell has no true descender row — every a-z glyph bottoms at row 6 — so
 *  the descender class (g p q y) holds its bowl in rows 2-4 and drops a
 *  one-dot tail to row 6. These tests hold that geometry so a future glyph
 *  edit that regresses it fails here, by name, and not in a screenshot.
 */
import { describe, expect, it } from 'vitest'
import { GLYPH_H, GLYPH_W, glyph, hasGlyph } from '../../src/ui/canvas/font5x7'

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const DESCENDERS = 'gpqy'

function bitmap(ch: string): string[] {
  const rows = glyph(ch)
  const out: string[] = []
  for (let y = 0; y < GLYPH_H; y++) {
    let line = ''
    for (let x = 0; x < GLYPH_W; x++) {
      line += (rows[y] as number) & (1 << (GLYPH_W - 1 - x)) ? '#' : '.'
    }
    out.push(line)
  }
  return out
}

function litRows(ch: string): number[] {
  const rows = glyph(ch)
  const out: number[] = []
  for (let y = 0; y < GLYPH_H; y++) if ((rows[y] as number) !== 0) out.push(y)
  return out
}

describe('font5x7 letterform geometry', () => {
  it('covers every character these assertions rely on (not tofu)', () => {
    for (const ch of LOWERCASE) expect(hasGlyph(ch), ch).toBe(true)
  })

  it('descender letterforms are pinned exactly', () => {
    expect(bitmap('p')).toEqual(['.....', '.....', '####.', '#...#', '####.', '#....', '#....'])
    expect(bitmap('q')).toEqual(['.....', '.....', '.####', '#...#', '.####', '....#', '....#'])
    expect(bitmap('y')).toEqual(['.....', '.....', '#...#', '#...#', '.####', '....#', '.###.'])
    expect(bitmap('g')).toEqual(['.....', '.....', '.####', '#...#', '.####', '....#', '.###.'])
  })

  it('descender bodies start at the x-height row, never above it', () => {
    // A bowl in row 0 or 1 is what made "sweep" read "sweeP".
    for (const ch of DESCENDERS) {
      const rows = litRows(ch)
      expect(rows[0], `${ch} starts at x-height`).toBe(2)
    }
  })

  it('every a-z glyph shares row 6 as its bottom row', () => {
    // One visual baseline-bottom for the whole alphabet: a letter that stops
    // short floats; one that cannot reach row 6 does not exist in this cell.
    for (const ch of LOWERCASE) {
      const rows = litRows(ch)
      expect(rows[rows.length - 1], `${ch} bottoms at row 6`).toBe(GLYPH_H - 1)
    }
  })

  it('the face stays lowercase-only', () => {
    // Uppercase input is a producer bug; the face makes it loud (tofu), not
    // quietly capital. screenSafe() lowercases dynamic strings for this reason.
    for (const ch of 'PQYG') expect(hasGlyph(ch), ch).toBe(false)
  })
})
