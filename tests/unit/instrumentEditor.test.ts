/** Wiring tripwires for InstrumentEditor.svelte — the same source-reading
 *  pattern as `trackerUiWiring.test.ts` (its header explains why components
 *  can't mount in this suite: node environment, no jsdom, no svelte plugin,
 *  zero-deps). Each case names the failure it prevents, and each fails if the
 *  wiring is deleted. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', '..', 'src')

/** Source with comments removed, so a tripwire can never be satisfied by prose. */
function codeOf(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/** The slice of `code` from `start` up to `end`, both matched literally. */
function section(code: string, start: string, end: string): string {
  const from = code.indexOf(start)
  expect(from, `missing: ${start}`).toBeGreaterThanOrEqual(0)
  const to = code.indexOf(end, from + start.length)
  expect(to, `missing: ${end}`).toBeGreaterThan(from)
  return code.slice(from, to)
}

const editor = codeOf('ui', 'tracker', 'InstrumentEditor.svelte')

describe('the envelope slider eats the keys it handles', () => {
  it('stopPropagation next to preventDefault, like Knob and KeyBed', () => {
    // The slider handles '-', '=', '+' and 'r'; without stopPropagation the
    // same keydown also reaches the global QWERTY listener, where Minus/Equal
    // change octave AND panic() (allNotesOff + clearNotes, cutting notes other
    // sources still hold) and KeyR plays semitone 17.
    const handler = section(editor, 'function onKeyDown', 'function draw')
    expect(handler).toMatch(/e\.preventDefault\(\)\s*e\.stopPropagation\(\)/)
  })
})

describe('step can never index past the macro under edit', () => {
  it('setValue clamps step before the indexed write', () => {
    // View step 31 of a 32-step arp, switch to an instrument whose macro has 4
    // steps, press ArrowUp: the old code wrote next[31] on a length-4 array and
    // the sparse holes went into the song document (silent 0s in compileBank).
    const fn = section(editor, 'function setValue', 'function setLength')
    const clamp = fn.search(/step = Math\.min\(step, values\.length - 1\)/)
    expect(clamp, 'no step clamp in setValue').toBeGreaterThanOrEqual(0)
    expect(clamp, 'the clamp must precede the indexed write').toBeLessThan(fn.indexOf('next[step]'))
  })

  it('mark clamps step before storing a loop/release point', () => {
    // A stale step stored a loop or release point past the end of the values.
    const fn = section(editor, 'function mark', 'function onKeyDown')
    expect(fn).toMatch(/step = Math\.min\(step, values\.length - 1\)/)
  })

  it('switching instrument resets step', () => {
    // The select swaps which sequence `values` derives from; the cursor must
    // not keep a position the new sequence may not have.
    const picker = section(editor, 'id="inst-pick"', '</select>')
    expect(picker).toMatch(/step = 0/)
  })

  it('a document swap (preset load) re-clamps step', () => {
    // song.load() replaces the document under the editor, so no handler on the
    // select can see it — a reactive clamp keeps the cursor inside whatever
    // sequence survives (length 0 when the new song has no such macro).
    expect(editor).toMatch(
      /\$effect\(\(\) => \{\s*step = Math\.max\(0, Math\.min\(step, values\.length - 1\)\)\s*\}\)/,
    )
  })
})

describe('sequence length respects the format cap', () => {
  it("'+' cannot grow values past MAX_SEQUENCE_LENGTH", () => {
    // 253 is the validator's own limit; growing past it wrote a song the
    // validator itself would reject.
    const fn = section(editor, 'function setLength', 'function mark')
    expect(fn).toMatch(/if \(delta > 0 && values\.length >= MAX_SEQUENCE_LENGTH\) return/)
  })
})
