/** Wiring facts behind "the sound keeps vanishing on my phone" (2026-08-04).
 *
 *  iOS suspends the AudioContext behind the page's back — lock screen, phone
 *  call, Siri, ringer, route change — often without firing statechange, and it
 *  frequently honours only a GESTURE-borne resume. Recovery is therefore a set
 *  of one-line wirings, each invisible to every unit test and fatal on a phone
 *  when absent. Same pattern as trackerUiWiring.test.ts: source tripwires,
 *  comments stripped so prose can never satisfy them.
 */
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

describe('a later gesture reaches the bridge as a resume', () => {
  it('App.startAudio forwards every call — no one-shot latch around start()', () => {
    const app = codeOf('App.svelte')
    const fn = section(app, 'function startAudio', 'function connectMidi')
    expect(fn).toContain('void audio.start()')
    // The original bug: start() gated behind the first-gesture flag, so the
    // reappearing start cap did nothing after an iOS suspension.
    expect(fn).not.toMatch(/if \(!started\)[\s\S]*?audio\.start/)
  })

  it('bridge.start() on a live engine attempts a resume instead of no-op', () => {
    const bridge = codeOf('audio', 'bridge.ts')
    const start = section(bridge, 'start(): Promise<void>', 'async #run')
    expect(start).toMatch(/#engine !== null[\s\S]{0,120}?#resume\(\)/)
  })
})

describe('the page coming back wakes the context', () => {
  const bridge = codeOf('audio', 'bridge.ts')

  it('wake signals are wired: visibilitychange, pageshow, focus', () => {
    // WebKit rarely fires statechange for its own interruptions; without these
    // the app returns from the lock screen silent with no path back.
    expect(bridge).toMatch(/addEventListener\('visibilitychange', wake\)/)
    expect(bridge).toMatch(/addEventListener\('pageshow', wake\)/)
    expect(bridge).toMatch(/addEventListener\('focus', wake\)/)
  })

  it('and are removed on teardown', () => {
    expect(bridge).toMatch(/removeEventListener\('pageshow', this\.#wakeHandler\)/)
  })

  it('every note-on doubles as a resume gesture', () => {
    // Anchored on the implementation signature — the AudioBridge interface
    // declares the same method name a few hundred lines earlier.
    const noteOn = section(bridge, 'noteOn(note: number, velocity: number, _channel', 'noteOff(')
    expect(noteOn).toContain('this.#gestureKick()')
  })
})

describe('the audio session asks to ignore the ringer switch', () => {
  it('startEngine requests the playback session type where the API exists', () => {
    const engine = codeOf('audio', 'host', 'audioEngine.ts')
    expect(engine).toMatch(/audioSession[\s\S]{0,120}?type = 'playback'/)
  })
})
