/** Wiring tripwires for the Ivory shell (2026-09-10) — the same source-reading
 *  pattern as `trackerUiWiring.test.ts` (its header explains why components
 *  cannot mount in this suite: node environment, no jsdom, no svelte plugin,
 *  zero-deps). Each case names the failure it prevents and each fails if the
 *  wiring is deleted or moved somewhere the design forbids.
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

describe('master output lives in the head, not in the voice section', () => {
  const knobRow = codeOf('ui', 'KnobRow.svelte')
  const output = codeOf('ui', 'OutputControl.svelte')
  const registry = codeOf('audio', 'params.ts')

  it('KnobRow renders the voice knobs and never master.volume', () => {
    // Output must stay reachable during song playback, when the voice dials are
    // disabled; a fourth dial here would either vanish with them or be disabled.
    expect(knobRow).toContain('VOICE_KNOBS')
    expect(knobRow).not.toContain('master.volume')
    const voice = section(registry, 'export const VOICE_KNOBS', '\n')
    expect(voice).toContain("'pulse1.duty'")
    expect(voice).toContain("'pulse1.sweep'")
    expect(voice).not.toContain('master.volume')
  })

  it('OutputControl binds a native range to the store write path', () => {
    // Nothing else may talk to the bridge: the store clamps, quantises and pushes.
    expect(output).toMatch(/<input[\s\S]*?type="range"/)
    expect(output).toContain("params.set('master.volume'")
    expect(output).toContain("params.get('master.volume')")
    expect(output).not.toContain('setParam(')
  })
})

describe('the transport position readout never writes $state from the frame loop', () => {
  const bar = codeOf('ui', 'TransportBar.svelte')

  it('writes the readout through textContent inside the frame.subscribe callback', () => {
    const callback = section(bar, 'frame.subscribe((now) => {', 'return stop')
    expect(callback).toMatch(/\.textContent\s*=/)
    // The readout follows the driver while playing and the cursor otherwise.
    expect(callback).toContain('tracker.position')
    expect(callback).toContain('tracker.frame')
  })

  it('assigns no rune and no store field in that callback', () => {
    // C2: a rune write per frame is a reactive invalidation for the life of the
    // page. The callback may touch plain locals and the DOM node, nothing else.
    const callback = section(bar, 'frame.subscribe((now) => {', 'return stop')
    const runes = [...bar.matchAll(/let (\w+) = \$state/g)].map((m) => m[1] as string)
    expect(runes.length, 'the component declares runes to guard').toBeGreaterThan(0)
    for (const name of runes) {
      expect(callback, `${name} is $state and must not be assigned per frame`).not.toMatch(
        new RegExp(`\\b${name}\\s*=[^=]`),
      )
    }
    expect(callback).not.toMatch(/\b(tracker|transport|song|params)\.\w+\s*=[^=]/)
  })
})

describe('the workspace switch pages the phone and guards the desktop', () => {
  const modes = codeOf('ui', 'ModeSwitch.svelte')

  it('on compact the two segments are Play and Voice, neither disabled', () => {
    // The phone is paged, not stacked: a disabled "wider screen" segment would
    // leave one dead control and a shell two screens tall.
    const phone = section(modes, '{#if compact}', '{:else}')
    const buttons = phone.match(/<button[\s\S]*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toMatch(/>\s*Play\s*</)
    expect(buttons[1]).toMatch(/>\s*Voice\s*</)
    expect(buttons[0]).toMatch(/aria-pressed=\{phonePage === 'play'\}/)
    expect(buttons[1]).toMatch(/aria-pressed=\{phonePage === 'voice'\}/)
    for (const b of buttons) expect(b).not.toMatch(/\bdisabled\b/)
    expect(modes).not.toContain('wider screen')
  })

  it('on wide the segments are Instrument and Tracker, neither disabled', () => {
    const wide = section(modes, '{:else}', '{/if}')
    const buttons = wide.match(/<button[\s\S]*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toMatch(/>\s*Instrument\s*</)
    expect(buttons[1]).toMatch(/>\s*Tracker\s*</)
    for (const b of buttons) expect(b).not.toMatch(/\bdisabled\b/)
  })

  it('the wide setter guards on the rendered state, so the pressed segment is a no-op', () => {
    // `tracker.open` can be true while the editor is hidden; a guard on the
    // store would toggle the hidden editor — and `toggleOpen` stops a song.
    expect(modes).toMatch(/const trackerShown = \$derived\(tracker\.open && !compact\)/)
    const setter = section(modes, 'function setMode', '</script>')
    expect(setter).toMatch(/if \(trackerShown === open\) return/)
    expect(setter).not.toMatch(/tracker\.open === open/)
    expect(setter).toContain('tracker.toggleOpen()')
  })
})

describe('the keybed releases every hold it owns on unmount', () => {
  const keybed = codeOf('ui', 'KeyBed.svelte')

  it('registers releaseAll with onDestroy', () => {
    // The phone's Voice page unmounts the bed; a finger still down on a key
    // would never get its pointerup, and the note would sound until a panic.
    expect(keybed).toMatch(/import \{[^}]*\bonDestroy\b[^}]*\} from 'svelte'/)
    expect(keybed).toMatch(/onDestroy\(releaseAll\)/)
    const fn = section(keybed, 'function releaseAll', 'function onKeyDown')
    expect(fn).toContain('releaseCursorNote()')
    expect(fn).toMatch(/for \(const hold of pointers\.values\(\)\) release\(hold\.note, hold\.holder\)/)
    expect(fn).toContain('pointers.clear()')
  })
})

describe('the screen palette mirror cannot drift from the tokens', () => {
  const ts = readFileSync(join(SRC, 'design', 'tokens.ts'), 'utf8')
  const css = readFileSync(join(SRC, 'design', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

  const MIRROR: Record<string, string> = {
    bg: '--screen-bg',
    dotOff: '--screen-dot-off',
    ink: '--screen-ink',
    dim: '--screen-dim',
    accent: '--screen-accent',
  }

  function tsLiteral(key: string): string {
    const block = ts.match(/export const SCREEN = \{([\s\S]*?)\} as const/)
    expect(block, 'SCREEN block not found in tokens.ts').not.toBeNull()
    const m = (block as RegExpMatchArray)[1]!.match(new RegExp(`\\b${key}: '(#[0-9a-fA-F]{6})'`))
    expect(m, `SCREEN.${key} not found`).not.toBeNull()
    return (m as RegExpMatchArray)[1]!.toLowerCase()
  }

  function cssLiteral(name: string): string {
    const root = css.match(/:root \{([\s\S]*?)\n\}/)
    expect(root, ':root block not found in tokens.css').not.toBeNull()
    const m = (root as RegExpMatchArray)[1]!.match(new RegExp(`${name}: (#[0-9a-fA-F]{6});`))
    expect(m, `${name} not found in :root`).not.toBeNull()
    return (m as RegExpMatchArray)[1]!.toLowerCase()
  }

  for (const [key, name] of Object.entries(MIRROR)) {
    it(`SCREEN.${key} equals ${name}`, () => {
      expect(tsLiteral(key)).toBe(cssLiteral(name))
    })
  }

  it('parsing actually found five pairs (guards against a regex that matches nothing)', () => {
    const pairs = Object.entries(MIRROR).map(([k, n]) => [tsLiteral(k), cssLiteral(n)])
    expect(pairs).toHaveLength(5)
    for (const [a, b] of pairs) {
      expect(a).toMatch(/^#[0-9a-f]{6}$/)
      expect(b).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('the night room redefines every enclosure-facing day token', () => {
  const css = readFileSync(join(SRC, 'design', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const block = (selector: string): string => {
    const at = css.indexOf(`${selector} {`)
    expect(at, `missing block: ${selector}`).toBeGreaterThanOrEqual(0)
    const end = css.indexOf('\n}', at)
    return css.slice(at, end)
  }
  const names = (body: string): string[] =>
    [...body.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1] as string)
  const day = names(block(':root'))
  const night = names(block(":root[data-room='night']"))
  const ENCLOSURE_FACING = /^--(enclosure-|chip-|key-|play-|field-|dial-|sh-slab$|page-bg$)/

  it('finds both blocks and a real token set (guards against a regex that matches nothing)', () => {
    expect(day.length).toBeGreaterThan(40)
    expect(night.length).toBeGreaterThan(20)
    expect(day.filter((n) => ENCLOSURE_FACING.test(n)).length).toBeGreaterThan(20)
  })

  it('leaves no enclosure-facing day token light at night', () => {
    // A new --enclosure-*/--chip-*/--key-*/--play-*/--field-*/--dial-* token,
    // --page-bg or --sh-slab added to the day root without a night value would
    // keep its day colour in the dark room — invisible until someone switches.
    const missing = day.filter((n) => ENCLOSURE_FACING.test(n) && !night.includes(n))
    expect(missing).toEqual([])
  })

  it('defines no glass token: the lattice and the grid are room-invariant', () => {
    expect(night.filter((n) => /^--(screen-|grid-)/.test(n))).toEqual([])
    expect(day.filter((n) => /^--(screen-|grid-)/.test(n)).length).toBeGreaterThan(10)
  })
})
