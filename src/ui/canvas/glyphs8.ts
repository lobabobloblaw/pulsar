/* pulsar — hand-authored 8x8 status glyphs (plan D2, hand-authored tier).
 *
 * These are NOT generated. An 8x8 produced by downscaling a diffusion render is
 * mush; 9 glyphs x 64 bits authored by hand is pixel-exact and costs less than
 * the QA pass would. They live on the same lattice as everything else, so they
 * compose with 5x7 text on a single dot grid.
 *
 * The four VOICE icons (pulse/triangle/noise/dpcm at 32x32) are the generated
 * tier and live in src/assets/icons — this file is the status tier only.
 */

export const GLYPH8 = 8

/* prettier-ignore */
const SOURCE = {
  /** one cycle of a square wave — the pulse channels */
  square:
    '........' + '..####..' + '..#..#..' + '..#..#..' +
    '..#..#..' + '###..###' + '........' + '........',
  /** a single peak — the triangle channel */
  triangle:
    '........' + '...##...' + '..#..#..' + '.#....#.' +
    '#......#' + '........' + '........' + '........',
  /** structured scatter — the noise channel */
  noise:
    '.#...#..' + '#..#..#.' + '..#....#' + '#...##..' +
    '.##..#..' + '#..#...#' + '..#.#...' + '#...#..#',
  /** 5-pin din */
  midi:
    '..####..' + '.#....#.' + '#.#..#.#' + '#......#' +
    '#.#..#.#' + '.#.##.#.' + '..####..' + '........',
  /** two keys of a keybed */
  key:
    '#######.' + '#..#..#.' + '#..#..#.' + '#..#..#.' +
    '#..#..#.' + '#..#..#.' + '#######.' + '........',
  /** caution — always drawn next to words, never instead of them */
  warn:
    '...#....' + '..#.#...' + '..#.#...' + '.#.#.#..' +
    '.#.#.#..' + '#.....#.' + '#..#..#.' + '########',
  lock:
    '..###...' + '.#...#..' + '.#...#..' + '#######.' +
    '#######.' + '###.###.' + '#######.' + '........',
  /** the wordmark's emblem: a core with two polar beams. The core is thickened
   *  so it still reads as a core, not a kink in a line, when the boot fallback
   *  draws this at 2x on the lattice. */
  beacon:
    '#.......' + '.#......' + '..##....' + '..###...' +
    '...###..' + '....##..' + '......#.' + '.......#',
  /** page cursor */
  arrow:
    '........' + '.#......' + '.##.....' + '.###....' +
    '.####...' + '.###....' + '.##.....' + '.#......',
} as const

export type Glyph8Name = keyof typeof SOURCE

function compile(src: string): Uint8Array {
  const rows = new Uint8Array(GLYPH8)
  for (let y = 0; y < GLYPH8; y++) {
    let bits = 0
    for (let x = 0; x < GLYPH8; x++) {
      if (src[y * GLYPH8 + x] === '#') bits |= 1 << (GLYPH8 - 1 - x)
    }
    rows[y] = bits
  }
  return rows
}

const COMPILED = new Map<Glyph8Name, Uint8Array>()
for (const name of Object.keys(SOURCE) as Glyph8Name[]) {
  COMPILED.set(name, compile(SOURCE[name]))
}

export function glyph8(name: Glyph8Name): Uint8Array {
  return COMPILED.get(name) as Uint8Array
}

/** Emit every lit dot of a glyph with its top-left at lattice cell (x, y). */
export function forEachGlyph8Dot(
  name: Glyph8Name,
  x: number,
  y: number,
  fn: (col: number, row: number) => void,
): void {
  const rows = glyph8(name)
  for (let ry = 0; ry < GLYPH8; ry++) {
    const bits = rows[ry]
    if (bits === 0) continue
    for (let rx = 0; rx < GLYPH8; rx++) {
      if (bits & (1 << (GLYPH8 - 1 - rx))) fn(x + rx, y + ry)
    }
  }
}
