/** The tracker keymap — design §4.5.
 *
 *  Headline assertions:
 *    - the §4.5 table, combination by combination, in both modes;
 *    - hex entry is live in inst / vol / fx-param and DEAD in the note column,
 *      where the same physical keys play notes;
 *    - `Digit1` writes a note cut and backquote writes a release;
 *    - NO COLLISION with the Phase-1 note keys — asserted against
 *      `src/input/keyboard.ts` itself.
 *
 *  That last one reads keyboard.ts as TEXT rather than importing it, exactly as
 *  `paletteDrift.test.ts` reads two palettes as text: importing would drag the
 *  module's `transport.svelte.ts` dependency — and therefore runes — into
 *  vitest's node environment, where `$state` is a ReferenceError. Parsing the
 *  source is also the stronger claim: it proves the REAL table has no conflict,
 *  not that a copy of it does.
 *
 *  Anti-vacuity: `the parsed rows are the real ones` fails if the regexes stop
 *  matching, so a silently-empty note map cannot make the collision test pass.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  effectChar,
  hexValue,
  PAGE_ROWS,
  resolveTrackerKey,
  type ColumnKind,
  type TrackerKeyContext,
  type TrackerKeyEvent,
} from '../../src/input/trackerKeys'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const KEYBOARD_PATH = resolve(ROOT, 'src/input/keyboard.ts')

function rowFrom(src: string, name: string): string[] {
  const m = src.match(new RegExp(`export const ${name}: readonly string\\[\\] = \\[([^\\]]*)\\]`))
  if (!m) throw new Error(`${name} not found in ${KEYBOARD_PATH}`)
  const codes = (m[1] as string).match(/'([A-Za-z0-9]+)'/g)
  if (!codes) throw new Error(`${name} has no codes`)
  return codes.map((c) => c.slice(1, -1))
}

const SRC = readFileSync(KEYBOARD_PATH, 'utf8')
const LOWER_ROW = rowFrom(SRC, 'LOWER_ROW')
const UPPER_ROW = rowFrom(SRC, 'UPPER_ROW')

/** The same table `keyboard.ts` builds, from the same source of truth. */
const NOTE_KEYS: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>()
  LOWER_ROW.forEach((code, i) => m.set(code, i))
  UPPER_ROW.forEach((code, i) => m.set(code, i + 12))
  return m
})()

function key(code: string, over: Partial<TrackerKeyEvent> = {}): TrackerKeyEvent {
  return {
    code,
    key: over.key ?? '',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    ...over,
  }
}

function ctx(column: ColumnKind, editing = true): TrackerKeyContext {
  return { editing, column, noteKeys: NOTE_KEYS }
}

describe('the note-key table it shares with phase 1', () => {
  it('the parsed rows are the real ones', () => {
    expect(LOWER_ROW).toHaveLength(13)
    expect(UPPER_ROW).toHaveLength(13)
    expect(LOWER_ROW[0]).toBe('KeyZ')
    expect(UPPER_ROW[0]).toBe('KeyQ')
    expect(NOTE_KEYS.get('KeyZ')).toBe(0)
    expect(NOTE_KEYS.get('KeyQ')).toBe(12)
    expect(NOTE_KEYS.size).toBe(26)
  })

  it('none of the tracker-reserved keys is a note key', () => {
    // §4.5 calls Digit1 out by name ("the upper row uses 2,3,5,6,7"), and the
    // rest are the navigation and structural keys the grid binds in EVERY
    // column, so a collision would silently steal a note or a command.
    const reserved = [
      'Digit1',
      'Backquote',
      'Space',
      'Enter',
      'Escape',
      'Tab',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      'Delete',
      'Insert',
      'Backspace',
    ]
    for (const code of reserved) expect(NOTE_KEYS.has(code), code).toBe(false)
  })

  it('octave keys are still Minus and Equal, as phase 1 teaches them', () => {
    expect(SRC).toMatch(/'Minus'/)
    expect(SRC).toMatch(/'Equal'/)
    expect(resolveTrackerKey(key('Minus'), ctx('note'))).toEqual({ kind: 'octave', delta: -1 })
    expect(resolveTrackerKey(key('Equal'), ctx('note'))).toEqual({ kind: 'octave', delta: 1 })
  })
})

describe('navigation and transport, in every column and both modes', () => {
  const columns: ColumnKind[] = ['note', 'inst', 'vol', 'fxCmd', 'fxParam']

  it('space toggles edit, escape stops, enter plays', () => {
    for (const column of columns) {
      for (const editing of [false, true]) {
        const c = ctx(column, editing)
        expect(resolveTrackerKey(key('Space'), c)).toEqual({ kind: 'toggleEdit' })
        expect(resolveTrackerKey(key('Escape'), c)).toEqual({ kind: 'stop' })
        expect(resolveTrackerKey(key('Enter'), c)).toEqual({ kind: 'play', mode: 'row' })
        expect(resolveTrackerKey(key('Enter', { shiftKey: true }), c)).toEqual({
          kind: 'play',
          mode: 'pattern',
        })
      }
    }
  })

  it('arrows move by row and sub-column, tab by channel', () => {
    const c = ctx('note')
    expect(resolveTrackerKey(key('ArrowUp'), c)).toEqual({ kind: 'move', rows: -1, columns: 0, channels: 0 })
    expect(resolveTrackerKey(key('ArrowDown'), c)).toEqual({ kind: 'move', rows: 1, columns: 0, channels: 0 })
    expect(resolveTrackerKey(key('ArrowLeft'), c)).toEqual({ kind: 'move', rows: 0, columns: -1, channels: 0 })
    expect(resolveTrackerKey(key('ArrowRight'), c)).toEqual({ kind: 'move', rows: 0, columns: 1, channels: 0 })
    expect(resolveTrackerKey(key('Tab'), c)).toEqual({ kind: 'move', rows: 0, columns: 0, channels: 1 })
    expect(resolveTrackerKey(key('Tab', { shiftKey: true }), c)).toEqual({
      kind: 'move',
      rows: 0,
      columns: 0,
      channels: -1,
    })
  })

  it('page keys move 16 rows and home/end bracket the pattern, ctrl the song', () => {
    const c = ctx('vol')
    expect(PAGE_ROWS).toBe(16)
    expect(resolveTrackerKey(key('PageUp'), c)).toEqual({ kind: 'move', rows: -16, columns: 0, channels: 0 })
    expect(resolveTrackerKey(key('PageDown'), c)).toEqual({ kind: 'move', rows: 16, columns: 0, channels: 0 })
    expect(resolveTrackerKey(key('Home'), c)).toEqual({ kind: 'jump', to: 'rowFirst' })
    expect(resolveTrackerKey(key('End'), c)).toEqual({ kind: 'jump', to: 'rowLast' })
    expect(resolveTrackerKey(key('Home', { ctrlKey: true }), c)).toEqual({ kind: 'jump', to: 'songStart' })
    expect(resolveTrackerKey(key('End', { ctrlKey: true }), c)).toEqual({ kind: 'jump', to: 'songEnd' })
  })
})

describe('the note column', () => {
  it('plays notes by physical position, in both modes', () => {
    for (const editing of [false, true]) {
      const c = ctx('note', editing)
      expect(resolveTrackerKey(key('KeyZ'), c)).toEqual({ kind: 'note', semitone: 0 })
      expect(resolveTrackerKey(key('KeyM'), c)).toEqual({ kind: 'note', semitone: 11 })
      expect(resolveTrackerKey(key('KeyQ'), c)).toEqual({ kind: 'note', semitone: 12 })
      expect(resolveTrackerKey(key('KeyI'), c)).toEqual({ kind: 'note', semitone: 24 })
    }
  })

  it('Digit1 is the note cut and backquote the release', () => {
    const c = ctx('note')
    expect(resolveTrackerKey(key('Digit1', { key: '1' }), c)).toEqual({ kind: 'noteSpecial', value: 'cut' })
    expect(resolveTrackerKey(key('Backquote', { key: '`' }), c)).toEqual({
      kind: 'noteSpecial',
      value: 'release',
    })
  })

  it('never returns a hex digit — the same keys are notes here', () => {
    const c = ctx('note')
    expect(resolveTrackerKey(key('Digit2', { key: '2' }), c)).toEqual({ kind: 'note', semitone: 13 })
    expect(resolveTrackerKey(key('KeyE', { key: 'e' }), c)).toEqual({ kind: 'note', semitone: 16 })
    // Digit4 and Digit8 are in neither note row and are not hex here either.
    expect(resolveTrackerKey(key('Digit4', { key: '4' }), c)).toBeNull()
  })
})

describe('hex and effect-character entry', () => {
  it('takes 0-9 and a-f in inst, vol and fx-param', () => {
    for (const column of ['inst', 'vol', 'fxParam'] as ColumnKind[]) {
      expect(resolveTrackerKey(key('Digit0', { key: '0' }), ctx(column))).toEqual({ kind: 'hex', value: 0 })
      expect(resolveTrackerKey(key('Digit9', { key: '9' }), ctx(column))).toEqual({ kind: 'hex', value: 9 })
      expect(resolveTrackerKey(key('KeyA', { key: 'a' }), ctx(column))).toEqual({ kind: 'hex', value: 10 })
      expect(resolveTrackerKey(key('KeyF', { key: 'f' }), ctx(column))).toEqual({ kind: 'hex', value: 15 })
      expect(resolveTrackerKey(key('KeyG', { key: 'g' }), ctx(column))).toBeNull()
    }
  })

  it('the fx-command column takes the character, uppercased for the file', () => {
    const c = ctx('fxCmd')
    expect(resolveTrackerKey(key('KeyA', { key: 'a' }), c)).toEqual({ kind: 'fxChar', char: 'A' })
    expect(resolveTrackerKey(key('Digit4', { key: '4' }), c)).toEqual({ kind: 'fxChar', char: '4' })
    expect(resolveTrackerKey(key('KeyQ', { key: 'q' }), c)).toEqual({ kind: 'fxChar', char: 'Q' })
  })

  it('writes nothing at all when edit mode is off', () => {
    for (const column of ['inst', 'vol', 'fxParam', 'fxCmd'] as ColumnKind[]) {
      expect(resolveTrackerKey(key('KeyA', { key: 'a' }), ctx(column, false))).toBeNull()
      expect(resolveTrackerKey(key('Delete'), ctx(column, false))).toBeNull()
      expect(resolveTrackerKey(key('Insert'), ctx(column, false))).toBeNull()
    }
  })

  it('hexValue and effectChar agree with the columns that use them', () => {
    expect(hexValue('F')).toBe(15)
    expect(hexValue('g')).toBeNull()
    expect(hexValue('')).toBeNull()
    expect(effectChar('b')).toBe('B')
    expect(effectChar('!')).toBeNull()
  })
})

describe('structural and modified keys', () => {
  it('delete clears the field, shift+delete the row, insert and backspace shift rows', () => {
    const c = ctx('inst')
    expect(resolveTrackerKey(key('Delete'), c)).toEqual({ kind: 'clearField' })
    expect(resolveTrackerKey(key('Delete', { shiftKey: true }), c)).toEqual({ kind: 'clearRow' })
    expect(resolveTrackerKey(key('Insert'), c)).toEqual({ kind: 'insertRow' })
    expect(resolveTrackerKey(key('Backspace'), c)).toEqual({ kind: 'deleteRow' })
  })

  it('ctrl+z undoes, ctrl+shift+z redoes, ctrl+c/x/v are the clipboard', () => {
    const c = ctx('note')
    expect(resolveTrackerKey(key('KeyZ', { ctrlKey: true }), c)).toEqual({ kind: 'undo' })
    expect(resolveTrackerKey(key('KeyZ', { ctrlKey: true, shiftKey: true }), c)).toEqual({ kind: 'redo' })
    expect(resolveTrackerKey(key('KeyZ', { metaKey: true }), c)).toEqual({ kind: 'undo' })
    expect(resolveTrackerKey(key('KeyC', { ctrlKey: true }), c)).toEqual({ kind: 'clipboard', op: 'copy' })
    expect(resolveTrackerKey(key('KeyX', { ctrlKey: true }), c)).toEqual({ kind: 'clipboard', op: 'cut' })
    expect(resolveTrackerKey(key('KeyV', { ctrlKey: true }), c)).toEqual({ kind: 'clipboard', op: 'paste' })
  })

  it('ctrl+1..5 mute and ctrl+alt+1..5 solo, beating the hex columns', () => {
    for (const column of ['note', 'vol', 'fxParam'] as ColumnKind[]) {
      const c = ctx(column)
      expect(resolveTrackerKey(key('Digit1', { key: '1', ctrlKey: true }), c)).toEqual({ kind: 'mute', channel: 0 })
      expect(resolveTrackerKey(key('Digit5', { key: '5', ctrlKey: true }), c)).toEqual({ kind: 'mute', channel: 4 })
      expect(resolveTrackerKey(key('Digit3', { key: '3', ctrlKey: true, altKey: true }), c)).toEqual({
        kind: 'solo',
        channel: 2,
      })
      expect(resolveTrackerKey(key('Digit6', { key: '6', ctrlKey: true }), c)).toBeNull()
    }
  })

  it('leaves unbound and alt-modified keys alone', () => {
    const c = ctx('note')
    expect(resolveTrackerKey(key('F5'), c)).toBeNull()
    expect(resolveTrackerKey(key('KeyZ', { altKey: true }), c)).toBeNull()
    expect(resolveTrackerKey(key('KeyP', { key: 'p' }), c)).toBeNull()
  })
})
