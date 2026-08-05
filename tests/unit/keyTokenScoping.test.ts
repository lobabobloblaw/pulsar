import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The `.key` design token in `src/design/tokens.css` is global, but it has two
 * kinds of occupants: real caps (`<button class="key">`, minis included) and
 * KeyBed's piano keys (`<div class="key white|black">`, which also carry
 * aria-pressed). Two token rules must stay scoped to the caps or they leak
 * onto the bed:
 *
 * - a bare `.key[aria-pressed='true']` latch paints a pressed BLACK piano key
 *   solid blue, where the bed's own `.black.pressed` deliberately keeps the
 *   key dark and lights only its bottom bar;
 * - a bare coarse-pointer `.key::before` hit pad (`inset: -8px`) reaches 8px
 *   past every white key's right edge, and the next key — later in DOM, equal
 *   z-index — wins hit-testing, so the strip plays the next semitone.
 *
 * Minis are not all buttons: the editor reference disclosures are
 * `<summary class="key mini">`, so button-only scoping would silently drop
 * their touch pads. Like paletteDrift, this reads the sources as text —
 * importing nothing, so a selector edit cannot fail to parse its way green.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CSS_PATH = resolve(ROOT, 'src/design/tokens.css')

const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** The body of the `@media (pointer: coarse)` block (closing brace at column 0). */
function coarseBlock(body: string): string {
  const m = body.match(/@media \(pointer: coarse\) \{([\s\S]*?)\n\}/)
  if (!m) throw new Error('no @media (pointer: coarse) block found in tokens.css')
  return m[1]!
}

describe('.key token scoping (pinned 2026-08-04)', () => {
  it('the pressed latch is scoped to real caps, not every .key with aria-pressed', () => {
    expect(css).toContain("button.key[aria-pressed='true']")
    // a bare .key[aria-pressed] would also paint KeyBed's pressed piano keys
    expect(css).not.toMatch(/(^|[\s,}])\.key\[aria-pressed/)
  })

  it('coarse-pointer hit pads cover caps and minis, never the key bed', () => {
    const block = coarseBlock(css)
    // 24px caps are buttons; 18px minis are buttons AND <summary> disclosures
    expect(block).toContain('button.key::before')
    expect(block).toContain('summary.key::before')
    // a bare .key::before pad would extend 8px past every white piano key's
    // right edge and hand the next semitone the touch
    expect(block).not.toMatch(/(^|[\s,}])\.key::before/)
    expect(block).not.toMatch(/(^|[\s,}])\.key\s*\{/)
  })

  it('the premise holds: piano keys are non-button .key occupants with aria-pressed', () => {
    // if KeyBed changes shape this fails and the scoping above needs re-audit
    const keybed = readFileSync(resolve(ROOT, 'src/ui/KeyBed.svelte'), 'utf8')
    expect(keybed).toMatch(/<div[\s\S]*?class="key (white|black)"/)
    expect(keybed).toContain('aria-pressed={isPressed(k.semitone)}')
  })

  it('the premise holds: at least one mini is a <summary>, not a button', () => {
    // guards button-only rescoping, which would drop this mini's hit pad
    const editors = ['src/ui/tracker/InstrumentEditor.svelte', 'src/ui/tracker/TrackerPanel.svelte']
      .map((p) => readFileSync(resolve(ROOT, p), 'utf8'))
      .join('\n')
    expect(editors).toContain('<summary class="key mini"')
  })

  it('parsing actually found the rules (guards against a regex that matches nothing)', () => {
    expect(coarseBlock(css)).toContain('inset: -8px')
    expect(coarseBlock(css)).toContain('inset: -11px')
  })
})
