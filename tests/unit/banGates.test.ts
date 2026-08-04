/** Plan B5's standing rules, as a tripwire instead of reviewer vigilance
 *  (review finding #17): the worklet-reachable tree must contain no import.meta
 *  (Vite replaces it with `undefined` in IIFE output), no console usage, no
 *  for...of (iterator allocation on the audio thread), and no allocating array
 *  combinators. Comment text is stripped first — the ban is on code.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', 'src', 'audio')
const HOT_DIRS = ['core', 'dsp', 'worklet'].map((d) => join(ROOT, d))
const WORKLET_GRAPH_DIRS = [...HOT_DIRS, join(ROOT, 'timeline'), join(ROOT, 'protocol')]

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...tsFilesUnder(p))
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/[^\n]*$/gm, '')
}

describe('plan B5 banned constructs', () => {
  it('worklet graph has no import.meta', () => {
    for (const dir of WORKLET_GRAPH_DIRS) {
      for (const f of tsFilesUnder(dir)) {
        expect.soft(codeOf(f), f).not.toMatch(/import\s*\.\s*meta/)
      }
    }
  })

  it('hot tree has no console, for...of, or allocating combinators', () => {
    for (const dir of HOT_DIRS) {
      for (const f of tsFilesUnder(dir)) {
        const code = codeOf(f)
        expect.soft(code, f).not.toMatch(/\bconsole\s*\./)
        expect.soft(code, f).not.toMatch(/\bfor\s*(?:await\s*)?\([^;)]*\bof\b/)
        expect.soft(code, f).not.toMatch(/\.(?:forEach|map|filter|reduce|flatMap)\s*\(/)
      }
    }
  })
})
