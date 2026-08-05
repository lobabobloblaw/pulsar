/** The dirty-confirm dialog in PresetBar must run the cancel cleanup on Esc.
 *
 *  Source tripwire, same rationale as `trackerUiWiring.test.ts`: vitest runs in
 *  node with no jsdom and no svelte plugin, so a native-`<dialog>` interaction
 *  can only be pinned by reading the component. The failure it guards against
 *  is one deleted attribute: with no `oncancel` the dialog's Esc key path
 *  bypassed `syncSelect()`, leaving `pending` set and the `<select>` displaying
 *  a song that never loaded — the desync commit b6b58d8 added `syncSelect()`
 *  to kill. Every path that dismisses the dialog without loading must run the
 *  same cleanup; Esc is the one with no button to hang the handler on.
 */
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

describe('the dirty-confirm dialog cleans up on Esc', () => {
  const bar = codeOf('ui', 'tracker', 'PresetBar.svelte')

  it('wires the dialog cancel event to the same cleanup as keep editing', () => {
    const dialog = section(bar, '<dialog', '</dialog>')
    // The 'keep editing' button and the Esc path must share one cleanup, or the
    // two cancel routes can drift apart again.
    expect(dialog).toMatch(/onclick=\{cancelDiscard\}/)
    expect(dialog).toMatch(/oncancel=\{cancelDiscard\}/)
  })

  it('cancelDiscard drops the pending pick and re-syncs the select', () => {
    const cancel = section(bar, 'function cancelDiscard', '</script>')
    expect(cancel).toMatch(/pending = null/)
    expect(cancel).toMatch(/syncSelect\(\)/)
  })
})
