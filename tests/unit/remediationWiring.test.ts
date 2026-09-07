import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', '..', 'src')

function codeOf(...parts: string[]): string {
  return readFileSync(join(SRC, ...parts), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function section(code: string, start: string, end: string): string {
  const from = code.indexOf(start)
  expect(from, `missing: ${start}`).toBeGreaterThanOrEqual(0)
  const to = code.indexOf(end, from + start.length)
  expect(to, `missing: ${end}`).toBeGreaterThan(from)
  return code.slice(from, to)
}

describe('remediation wiring', () => {
  it('scopes each interactive note hold to its physical control', () => {
    expect(codeOf('input', 'keyboard.ts')).toContain("noteHolder('qwerty', e.code)")
    expect(codeOf('ui', 'tracker', 'PatternGrid.svelte')).toContain(
      "noteHolder('tracker', code)",
    )
    const keybed = codeOf('ui', 'KeyBed.svelte')
    expect(keybed).toContain("noteHolder('pointer', e.pointerId)")
    expect(keybed).not.toMatch(/transport\.notes\.has\(note\)[\s\S]{0,30}return null/)
  })

  it('releases MIDI locally on hot-plug instead of panicking every source', () => {
    const midi = codeOf('input', 'midi.ts')
    const stateChange = section(midi, 'function onStateChange', 'async function ensureAccess')
    expect(midi).toContain("noteHolder('midi', `${inputId}:${status & 0x0f}`)")
    expect(stateChange).toContain('releaseMidiNotes()')
    expect(stateChange).not.toContain('allNotesOff()')
    expect(stateChange).not.toContain('clearNotes()')
  })

  it('applies effective solo routing to both mute and solo mutations', () => {
    const tracker = codeOf('state', 'tracker.svelte.ts')
    expect(section(tracker, 'toggleMute(', 'toggleSolo(')).toContain('effectiveChannelMute(')
    expect(section(tracker, 'toggleSolo(', 'isAudible(')).toContain('effectiveChannelMute(')
  })

  it('closes a partially initialized AudioContext before rethrowing', () => {
    const engine = codeOf('audio', 'host', 'audioEngine.ts')
    const start = section(engine, 'export async function startEngine', '\n}')
    expect(start).toMatch(/catch \(error\)[\s\S]*?ctx\.close\(\)[\s\S]*?throw error/)
  })

  it('loads DPCM memory and layout in the real-song browser soak', () => {
    const selftest = codeOf('selftest.ts')
    const soak = section(selftest, 'async function runSongSoak', 'async function runSoakTest')
    expect(soak).toContain('buildDpcmImage(parsed.song)')
    expect(soak).toContain("postMessage({ t: 'dpcm', mem: image.memory })")
    expect(soak).toContain('driver.dpcmLayout = image?.layout ?? null')
  })
})
