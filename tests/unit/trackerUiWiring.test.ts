/** Four wiring facts about the tracker UI that no other test can reach.
 *
 *  **Why this suite reads source instead of mounting components.** `vitest.config.ts`
 *  runs the whole suite in node's environment with no jsdom and no svelte plugin — a
 *  deliberate choice (`trackerKeys.ts`'s header explains it: a rune or a real
 *  `KeyboardEvent` anywhere in a test's import graph makes the keymap untestable), and
 *  the project has no component-test dependency to add without breaking its zero-deps
 *  posture. The alternative to a source tripwire here is no test at all, which is how
 *  all four of these shipped broken: each one is a single line of wiring whose absence
 *  is invisible to every unit test in the repo and obvious the moment the app runs.
 *
 *  `tests/unit/banGates.test.ts` establishes the pattern; this file is the same idea
 *  aimed at presence rather than absence. Each case names the failure it prevents, and
 *  each is backed by a manual check in the browser (the phase-2 review's CDP pass:
 *  preset chips visible and loading, Escape with a key held, Tab out of the grid,
 *  record-during-playback landing in the right pattern).
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

describe('the preset bar is mounted', () => {
  const app = codeOf('App.svelte')

  it('fills TrackerPanel\'s presetBar seam', () => {
    // The component was complete and rendered by nobody: the panel showed its
    // "presets land here" placeholder and the whole album was unreachable in the app.
    expect(app).toMatch(/import PresetBar from '\.\/ui\/tracker\/PresetBar\.svelte'/)
    expect(app).toMatch(
      /<TrackerPanel[\s\S]*?\{#snippet presetBar\(\)\}[\s\S]*?<PresetBar[\s\S]*?\{\/snippet\}[\s\S]*?<\/TrackerPanel>/,
    )
  })

  it('routes its announcements to the app LiveRegion', () => {
    // A preset that fails to load says so through `announce`, and App owns the only
    // live region there is. Mounting it without the prop drops those messages.
    const mount = section(app, '{#snippet presetBar()}', '{/snippet}')
    expect(mount).toMatch(/<PresetBar\s+announce=\{announceText\}\s*\/>/)
  })
})

describe('the pattern grid is not a keyboard trap', () => {
  const grid = codeOf('ui', 'tracker', 'PatternGrid.svelte')

  it('lets tab out of the grid at the edges, before preventDefault', () => {
    // Tab and shift-tab resolve to a channel move and every resolved action is
    // preventDefault'ed, so focus could never leave the grid's single tab stop —
    // WCAG 2.1.2. The escape hatch has to be tested BEFORE the preventDefault.
    const handler = section(grid, 'function onKeyDown', 'function onKeyUp')
    const guard = handler.search(/if \(tabLeavesGrid\(e, action\)\) return/)
    const prevented = handler.indexOf('e.preventDefault()')
    expect(guard, 'no tab escape in onKeyDown').toBeGreaterThanOrEqual(0)
    expect(prevented).toBeGreaterThanOrEqual(0)
    expect(guard, 'the escape must come before preventDefault').toBeLessThan(prevented)
  })

  it('escapes at the LAST channel forwards and the FIRST backwards', () => {
    const edge = section(grid, 'function tabLeavesGrid', 'function onKeyDown')
    expect(edge).toContain("e.code !== 'Tab'")
    expect(edge).toMatch(/action\.channels > 0[\s\S]*?tracker\.channel >= channelCount - 1/)
    expect(edge).toMatch(/action\.channels < 0[\s\S]*?tracker\.channel <= 0/)
  })
})

describe('live record writes to the pattern it was played over', () => {
  const grid = codeOf('ui', 'tracker', 'PatternGrid.svelte')

  it('takes the order frame from the record sink, not from the cursor', () => {
    // The row came from the recorder and the pattern came from `tracker.frame`, so a
    // note played while the playhead was in another frame landed in whichever pattern
    // the editor happened to be looking at. `RecordSink.orderIndex` exists for this.
    const target = section(grid, 'function recordTarget', 'function writeNote')
    expect(target).toContain('sink.orderIndex')
    expect(target).toMatch(/orderIndex: tracker\.position\.orderIndex/)
  })

  it('addresses the write by that frame and moves the cursor only inside it', () => {
    const write = section(grid, 'function writeNote', 'function audition')
    expect(write).toMatch(/const \{ row, orderIndex \} = recordTarget\(note\)/)
    expect(write).toMatch(/writeAt\(orderIndex, row, NOTE_FIELD, note\)/)
    expect(write).toMatch(/orderIndex === tracker\.frame && row !== tracker\.row/)
    // The old, wrong call: cursor-addressed, on a row the cursor may not be on.
    expect(write).not.toMatch(/\bwrite\(NOTE_FIELD/)
  })
})

describe('edits during playback reach the driver', () => {
  const panel = codeOf('ui', 'tracker', 'TrackerPanel.svelte')

  it('reloads the song on a document change while the transport is running', () => {
    // The driver holds a compiled copy of the document; nothing reloaded it, so every
    // edit made while playing was inert until the next stop/play.
    expect(panel).toMatch(/\$effect\(\(\) => \{[\s\S]*?song\.version[\s\S]*?\}\)/)
    const effect = section(panel, '$effect(() => {', 'const songBpm')
    expect(effect).toContain('song.version')
    expect(effect).toMatch(/if \(!tracker\.playing\) return/)
    expect(effect).toMatch(/bridge\(\)\.loadSong\(song\.doc\)/)
    // Untracked, or the effect re-subscribes to the whole document it just published.
    expect(effect).toContain('untrack(')
  })
})

describe('the playing mirror cannot desync from the driver', () => {
  const store = codeOf('state', 'tracker.svelte.ts')

  it('re-syncs the $state mirror inside pump(), not only in play()/stop()', () => {
    // A driver-initiated stop (Cxx halt) never goes through stop(), so a mirror
    // written only in play()/stop() stayed true forever: the chip showed "stop"
    // over a silent song and togglePlay stopped instead of restarting.
    const pump = section(store, 'pump(_nowMs: number): boolean {', 'return moved')
    expect(pump).toMatch(/if \(driver\.playing !== this\.playing\)/)
    expect(pump).toMatch(/this\.playing = driver\.playing/)
  })
})

describe('shift+arrow across a pattern boundary does not extend the selection', () => {
  const store = codeOf('state', 'tracker.svelte.ts')

  it('decides extension from the frame captured BEFORE moveRow assigns it', () => {
    // `extend && frame === this.frame` was evaluated after `this.frame = frame`
    // — always true, and the anchor=null above it dead. Crossing re-anchored at
    // the old row in the new frame: a bogus up-to-full-pattern selection the
    // next ctrl+x silently cleared.
    const move = section(store, 'moveRow(delta: number, extend = false): void {', 'moveField')
    expect(move).toMatch(/const crossed = frame !== this\.frame/)
    expect(
      move.indexOf('const crossed'),
      'the crossing must be captured before the frame write',
    ).toBeLessThan(move.indexOf('this.frame = frame'))
    expect(move).toContain('extend && !crossed')
  })
})

describe('the live channel follows every cursor-channel path', () => {
  const store = codeOf('state', 'tracker.svelte.ts')
  const grid = codeOf('ui', 'tracker', 'PatternGrid.svelte')

  it('is pushed from the one channel setter, which setCursor and moveChannel use', () => {
    // Only moveChannel() pushed setLiveChannel, so while playing a pointer click
    // on the noise lane still stole whichever channel the last Tab press had
    // picked (the driver steals the editor's cursor channel, §2.6).
    const setter = section(store, 'setChannel(channel: number): void {', 'moveChannel(delta: number')
    expect(setter).toContain('setLiveChannel')
    const cursor = section(store, 'setCursor(row: number', 'moveRow(delta: number')
    expect(cursor).toContain('this.setChannel(channel)')
    const move = section(store, 'moveChannel(delta: number): void {', 'setFrame(frame: number')
    expect(move).toContain('this.setChannel(')
  })

  it("is the path the grid's field normalisation takes too", () => {
    // `tracker.channel += 1` / `-= 1` bypassed the push the same way.
    expect(grid).not.toMatch(/tracker\.channel\s*[+-]=/)
    const normalise = section(grid, 'function normaliseField', 'function ensureVisible')
    expect(normalise).toContain('tracker.setChannel(')
  })
})

describe('closing the panel cannot leave the keyboard suppressed', () => {
  const store = codeOf('state', 'tracker.svelte.ts')
  const grid = codeOf('ui', 'tracker', 'PatternGrid.svelte')

  it('resets tracker.focused when the grid unmounts', () => {
    // focus/blur own the flag and unmount fires neither: closing the panel
    // mid-focus left it stuck true, and App's suppress guard
    // (`suppress: () => tracker.focused`) silently killed every global keydown.
    const cleanup = section(grid, 'return () => {', '})')
    expect(cleanup).toContain('tracker.focused = false')
  })

  it('resets it when the panel closes, even without an unmount', () => {
    const toggle = section(store, 'toggleOpen(): void {', 'get rowsPerPattern')
    expect(toggle).toContain('this.focused = false')
  })
})
