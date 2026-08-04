import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The NES 2C02 palette exists twice on purpose: `src/assets/palette/nes2c02.ts` for the app
 * and `tools/assets/pixelize.py` for the asset pipeline, which must run without a JS
 * runtime. Two hand-maintained copies of 64 hex values WILL drift, and the failure is
 * silent -- the boot art quantizes against a palette the renderer does not have, and the
 * result merely looks slightly wrong.
 *
 * So this test does not import either list. It reads both files as text, parses the literals
 * out, and compares them. Parsing text is the point: importing the TS module would prove
 * only that TypeScript is self-consistent.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TS_PATH = resolve(ROOT, 'src/assets/palette/nes2c02.ts')
const PY_PATH = resolve(ROOT, 'tools/assets/pixelize.py')

/** Indices dropped from the quantization set: $0D plus the eight duplicate blacks. */
const DROPPED = [0x0d, 0x0e, 0x0f, 0x1e, 0x1f, 0x2e, 0x2f, 0x3e, 0x3f]

function hexes(body: string, where: string): string[] {
  const found = body.match(/#[0-9A-Fa-f]{6}/g)
  if (!found) throw new Error(`no colors found in ${where}`)
  return found.map((h) => h.toUpperCase())
}

function fromTs(src: string, name: string): string[] {
  const m = src.match(new RegExp(`export const ${name}: readonly string\\[\\] = \\[([^\\]]*)\\]`))
  if (!m) throw new Error(`${name} not found in ${TS_PATH}`)
  return hexes(m[1]!, `${name} (ts)`)
}

function fromPy(src: string, name: string): string[] {
  const m = src.match(new RegExp(`^${name} = \\[([^\\]]*)\\]`, 'm'))
  if (!m) throw new Error(`${name} not found in ${PY_PATH}`)
  return hexes(m[1]!, `${name} (py)`)
}

const ts = readFileSync(TS_PATH, 'utf8')
const py = readFileSync(PY_PATH, 'utf8')

const tsFull = fromTs(ts, 'NES_2C02')
const tsQuant = fromTs(ts, 'NES_2C02_QUANT')
const pyFull = fromPy(py, 'NES_2C02')
const pyQuant = fromPy(py, 'NES_2C02_QUANT')

describe('NES 2C02 palette (pinned 2026-08-03)', () => {
  it('the TypeScript master table has all 64 hardware entries', () => {
    expect(tsFull).toHaveLength(64)
  })

  it('the TypeScript quantization set has 55 entries', () => {
    expect(tsQuant).toHaveLength(55)
  })

  it('pixelize.py carries the same master table, entry for entry', () => {
    expect(pyFull).toEqual(tsFull)
  })

  it('pixelize.py carries the same quantization set, entry for entry', () => {
    expect(pyQuant).toEqual(tsQuant)
  })

  it('the quantization set is the master table minus $0D and the duplicate blacks', () => {
    const dropped = new Set(DROPPED)
    const expected = tsFull.filter((_, i) => !dropped.has(i))
    expect(tsQuant).toEqual(expected)
  })

  it('keeps $1D as true black and drops $0D', () => {
    expect(tsFull[0x1d]).toBe('#000000')
    expect(tsQuant).toContain('#000000')
    // exactly one black survives: the eight duplicates and $0D are gone
    expect(tsQuant.filter((c) => c === '#000000')).toHaveLength(1)
  })

  it('every entry is a full 6-digit uppercase hex color', () => {
    for (const c of [...tsFull, ...tsQuant]) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('parsing actually found the lists (guards against a regex that matches nothing)', () => {
    expect(tsFull.length + tsQuant.length + pyFull.length + pyQuant.length).toBe(238)
  })
})
