/* pulsar — hand-authored 5x7 bitmap face for the screen (plan C1/C9).
 *
 * No webfont ever appears inside the screen. Every character here is drawn on
 * the same 128x64 dot lattice as the boot art, the meter and the parameter
 * bars, which is the whole point: one primitive, one grid, one lit object.
 *
 * Coverage is deliberately exactly what the UI needs — lowercase a-z, 0-9, and
 * the punctuation that appears in labels, readouts and capability copy. Anything
 * else renders as a filled box so a missing glyph is loud, not silent. Uppercase
 * is absent on purpose: the interface is lowercase, and dynamic strings (MIDI
 * port names) are lowercased before they reach the screen.
 *
 * Every a-z glyph shares row 6 as its bottom row — the cell has no true
 * descender row. x-height letters span rows 2-6, ascenders start at row 0, and
 * descender letters (g p q y) keep their bowls in rows 2-4 with a one-dot tail
 * reaching row 6: the standard 5x7 LCD compromise. A descender bowl drawn any
 * higher reads as uppercase — "sweep" once rendered as "sweeP".
 * `tests/unit/font5x7.test.ts` pins this geometry.
 */

export const GLYPH_W = 5
export const GLYPH_H = 7
/** One dot of letter-space. Also the parameter page's column pitch. */
export const ADVANCE = GLYPH_W + 1

/* prettier-ignore */
const SOURCE: Record<string, string> = {
  ' ': '.....' + '.....' + '.....' + '.....' + '.....' + '.....' + '.....',

  '0': '.###.' + '#...#' + '#..##' + '#.#.#' + '##..#' + '#...#' + '.###.',
  '1': '..#..' + '.##..' + '..#..' + '..#..' + '..#..' + '..#..' + '.###.',
  '2': '.###.' + '#...#' + '....#' + '...#.' + '..#..' + '.#...' + '#####',
  '3': '#####' + '...#.' + '..#..' + '...#.' + '....#' + '#...#' + '.###.',
  '4': '...#.' + '..##.' + '.#.#.' + '#..#.' + '#####' + '...#.' + '...#.',
  '5': '#####' + '#....' + '####.' + '....#' + '....#' + '#...#' + '.###.',
  '6': '..##.' + '.#...' + '#....' + '####.' + '#...#' + '#...#' + '.###.',
  '7': '#####' + '....#' + '...#.' + '..#..' + '.#...' + '.#...' + '.#...',
  '8': '.###.' + '#...#' + '#...#' + '.###.' + '#...#' + '#...#' + '.###.',
  '9': '.###.' + '#...#' + '#...#' + '.####' + '....#' + '...#.' + '.##..',

  a: '.....' + '.....' + '.###.' + '....#' + '.####' + '#...#' + '.####',
  b: '#....' + '#....' + '####.' + '#...#' + '#...#' + '#...#' + '####.',
  c: '.....' + '.....' + '.####' + '#....' + '#....' + '#....' + '.####',
  d: '....#' + '....#' + '.####' + '#...#' + '#...#' + '#...#' + '.####',
  e: '.....' + '.....' + '.###.' + '#...#' + '#####' + '#....' + '.###.',
  f: '..##.' + '.#..#' + '.#...' + '####.' + '.#...' + '.#...' + '.#...',
  g: '.....' + '.....' + '.####' + '#...#' + '.####' + '....#' + '.###.',
  h: '#....' + '#....' + '####.' + '#...#' + '#...#' + '#...#' + '#...#',
  i: '..#..' + '.....' + '.##..' + '..#..' + '..#..' + '..#..' + '.###.',
  j: '...#.' + '.....' + '..##.' + '...#.' + '...#.' + '#..#.' + '.##..',
  k: '#....' + '#....' + '#..#.' + '#.#..' + '##...' + '#.#..' + '#..#.',
  l: '.##..' + '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '.###.',
  m: '.....' + '.....' + '##.#.' + '#.#.#' + '#.#.#' + '#.#.#' + '#.#.#',
  n: '.....' + '.....' + '####.' + '#...#' + '#...#' + '#...#' + '#...#',
  o: '.....' + '.....' + '.###.' + '#...#' + '#...#' + '#...#' + '.###.',
  p: '.....' + '.....' + '####.' + '#...#' + '####.' + '#....' + '#....',
  q: '.....' + '.....' + '.####' + '#...#' + '.####' + '....#' + '....#',
  r: '.....' + '.....' + '#.##.' + '##..#' + '#....' + '#....' + '#....',
  s: '.....' + '.....' + '.####' + '#....' + '.###.' + '....#' + '####.',
  t: '.#...' + '.#...' + '####.' + '.#...' + '.#...' + '.#..#' + '..##.',
  u: '.....' + '.....' + '#...#' + '#...#' + '#...#' + '#..##' + '.##.#',
  v: '.....' + '.....' + '#...#' + '#...#' + '#...#' + '.#.#.' + '..#..',
  w: '.....' + '.....' + '#...#' + '#...#' + '#.#.#' + '#.#.#' + '.#.#.',
  x: '.....' + '.....' + '#...#' + '.#.#.' + '..#..' + '.#.#.' + '#...#',
  y: '.....' + '.....' + '#...#' + '#...#' + '.####' + '....#' + '.###.',
  z: '.....' + '.....' + '#####' + '...#.' + '..#..' + '.#...' + '#####',

  '.': '.....' + '.....' + '.....' + '.....' + '.....' + '.##..' + '.##..',
  ',': '.....' + '.....' + '.....' + '.....' + '.##..' + '.##..' + '#....',
  ':': '.....' + '.##..' + '.##..' + '.....' + '.##..' + '.##..' + '.....',
  ';': '.....' + '.##..' + '.##..' + '.....' + '.##..' + '.##..' + '#....',
  '-': '.....' + '.....' + '.....' + '#####' + '.....' + '.....' + '.....',
  '+': '.....' + '..#..' + '..#..' + '#####' + '..#..' + '..#..' + '.....',
  '=': '.....' + '.....' + '#####' + '.....' + '#####' + '.....' + '.....',
  '_': '.....' + '.....' + '.....' + '.....' + '.....' + '.....' + '#####',
  '%': '##...' + '##..#' + '...#.' + '..#..' + '.#...' + '#..##' + '...##',
  '/': '....#' + '....#' + '...#.' + '..#..' + '.#...' + '#....' + '#....',
  '#': '.#.#.' + '.#.#.' + '#####' + '.#.#.' + '#####' + '.#.#.' + '.#.#.',
  "'": '..#..' + '..#..' + '.....' + '.....' + '.....' + '.....' + '.....',
  '!': '..#..' + '..#..' + '..#..' + '..#..' + '..#..' + '.....' + '..#..',
  '?': '.###.' + '#...#' + '....#' + '...#.' + '..#..' + '.....' + '..#..',
  '(': '...#.' + '..#..' + '.#...' + '.#...' + '.#...' + '..#..' + '...#.',
  ')': '.#...' + '..#..' + '...#.' + '...#.' + '...#.' + '..#..' + '.#...',
  '<': '...#.' + '..#..' + '.#...' + '#....' + '.#...' + '..#..' + '...#.',
  '>': '.#...' + '..#..' + '...#.' + '....#' + '...#.' + '..#..' + '.#...',
  '*': '.....' + '#.#.#' + '.###.' + '#####' + '.###.' + '#.#.#' + '.....',
  '·': '.....' + '.....' + '.....' + '..#..' + '.....' + '.....' + '.....',
  '°': '.###.' + '.#.#.' + '.###.' + '.....' + '.....' + '.....' + '.....',
}

/** Loud fallback: an unknown character is a filled box, never blank. */
/* prettier-ignore */
const TOFU = '#####' + '#...#' + '#...#' + '#...#' + '#...#' + '#...#' + '#####'

function compile(src: string): Uint8Array {
  const rows = new Uint8Array(GLYPH_H)
  for (let y = 0; y < GLYPH_H; y++) {
    let bits = 0
    for (let x = 0; x < GLYPH_W; x++) {
      if (src[y * GLYPH_W + x] === '#') bits |= 1 << (GLYPH_W - 1 - x)
    }
    rows[y] = bits
  }
  return rows
}

const GLYPHS = new Map<string, Uint8Array>()
for (const key of Object.keys(SOURCE)) {
  const src = SOURCE[key]
  if (src !== undefined) GLYPHS.set(key, compile(src))
}
const TOFU_ROWS = compile(TOFU)

export function glyph(ch: string): Uint8Array {
  return GLYPHS.get(ch) ?? TOFU_ROWS
}

export function hasGlyph(ch: string): boolean {
  return GLYPHS.has(ch)
}

/** Width in lattice dots of `text` rendered at the default 1-dot letter-space.
 *  The trailing letter-space is not counted. */
export function textWidth(text: string): number {
  return text.length === 0 ? 0 : text.length * ADVANCE - 1
}

/** Emit every lit dot of `text` with its top-left at lattice cell (x, y).
 *  Renderer-agnostic on purpose: the same walk feeds the live screen, the boot
 *  dissolve and (in tests) a plain string dump. Allocation-free. */
export function forEachTextDot(
  text: string,
  x: number,
  y: number,
  fn: (col: number, row: number) => void,
): void {
  let cx = x
  for (let i = 0; i < text.length; i++) {
    const rows = glyph(text[i] as string)
    for (let ry = 0; ry < GLYPH_H; ry++) {
      const bits = rows[ry]
      if (bits === 0) continue
      for (let rx = 0; rx < GLYPH_W; rx++) {
        if (bits & (1 << (GLYPH_W - 1 - rx))) fn(cx + rx, y + ry)
      }
    }
    cx += ADVANCE
  }
}

/** Lowercase + strip anything the face cannot draw, for strings we do not
 *  author (MIDI port names). Keeps `tofu` for genuinely foreign characters
 *  while quietly normalising the common ones. */
export function screenSafe(text: string): string {
  let out = ''
  const lower = text.toLowerCase()
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i] as string
    out += hasGlyph(ch) ? ch : ' '
  }
  return out.replace(/\s+/g, ' ').trim()
}
