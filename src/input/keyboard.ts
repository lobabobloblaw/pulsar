/* pulsar — QWERTY note input (plan C8).
 *
 * This module owns the window keydown/keyup listeners. KeyBed.svelte only
 * renders; it never listens for typing. That split is what lets a letter play a
 * note while a knob has focus — dispatch is by physical code, not by focus.
 *
 * Mapping is by `event.code`, i.e. physical position, so AZERTY and Dvorak
 * keyboards keep the SHAPE of the two rows even though the legends differ. The
 * legends printed on the keybed are the US ones, which is a documented and
 * deliberate compromise: they are a hint, not a promise.
 *
 * Stuck-note guard is non-negotiable. Losing the window mid-note (Cmd+Tab, a
 * screen lock, an OS notification stealing focus) means keyup never arrives, so
 * blur / visibilitychange->hidden / pointercancel all panic. macOS swallows
 * keyup for letter keys while Command is held WITHOUT losing the window, which
 * no window-level guard can catch — so the Cmd/Ctrl keydown panics too.
 */

import type { AudioBridge } from '../audio/bridge'
import { transport } from '../state/transport.svelte'

/** Semitone offset from the base C of the current octave, by physical code. */
export const LOWER_ROW: readonly string[] = [
  'KeyZ',
  'KeyS',
  'KeyX',
  'KeyD',
  'KeyC',
  'KeyV',
  'KeyG',
  'KeyB',
  'KeyH',
  'KeyN',
  'KeyJ',
  'KeyM',
  'Comma',
]

export const UPPER_ROW: readonly string[] = [
  'KeyQ',
  'Digit2',
  'KeyW',
  'Digit3',
  'KeyE',
  'KeyR',
  'Digit5',
  'KeyT',
  'Digit6',
  'KeyY',
  'Digit7',
  'KeyU',
  'KeyI',
]

export const NOTE_KEYS: ReadonlyMap<string, number> = buildMap()

function buildMap(): Map<string, number> {
  const m = new Map<string, number>()
  for (let i = 0; i < LOWER_ROW.length; i++) m.set(LOWER_ROW[i] as string, i)
  for (let i = 0; i < UPPER_ROW.length; i++) m.set(UPPER_ROW[i] as string, i + 12)
  return m
}

/** US legend for a physical code — printed on the white keys as a hint. */
export function keyLegend(code: string): string {
  if (code.startsWith('Key')) return code.slice(3).toLowerCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (code === 'Comma') return ','
  if (code === 'Minus') return '-'
  if (code === 'Equal') return '='
  return ''
}

/** Semitone -> the code whose legend gets printed on that key. The two rows
 *  overlap at semitone 12 (Comma and KeyQ both play it); the upper row wins the
 *  legend there so that the printed hint reads as two clean rows, z..m and
 *  q..i, which is what the foot copy promises. Both codes still play. */
export function codeForSemitone(semitone: number): string | undefined {
  const upper = semitone - 12
  if (upper >= 0 && upper < UPPER_ROW.length) return UPPER_ROW[upper]
  if (semitone >= 0 && semitone < LOWER_ROW.length) return LOWER_ROW[semitone]
  return undefined
}

/** Velocity for every non-MIDI source. MIDI passes the real thing. */
export const LOCAL_VELOCITY = 100

export interface KeyboardOptions {
  bridge: AudioBridge
  /** Runs before note handling on every keydown until it returns true once —
   *  the boot sequence uses it to consume the first key as the audio gesture. */
  gesture?: (e: KeyboardEvent) => boolean
  /** Announced by the live region, throttled by the caller. */
  onNote?: (note: number) => void
  /** Focus guard (phase-2 design §4.5). While the tracker grid owns the
   *  keyboard, this listener must not ALSO fire — the grid's own keymap is
   *  responsible for note entry there. WP10 wires the grid's focus state in
   *  here rather than adding a second window listener, which is why there is
   *  still exactly one keydown handler in the product.
   *
   *  Guards keydown only; see the call site for why it must never panic. */
  suppress?: () => boolean
}

function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
  )
}

export function noteForSemitone(semitone: number): number {
  return (transport.octave + 1) * 12 + semitone
}

export function attachKeyboard(opts: KeyboardOptions): () => void {
  const { bridge } = opts
  /** Which note each held code is sounding — the octave may change mid-hold, so
   *  the note-off must use the note that was actually started. */
  const held = new Map<string, number>()
  let gestureDone = false

  function panic(): void {
    if (held.size === 0 && transport.notes.size === 0) return
    held.clear()
    bridge.allNotesOff()
    transport.clearNotes()
  }

  function keydown(e: KeyboardEvent): void {
    if (isTextTarget(e.target)) return

    // macOS delivers NO keyup for a letter key while Command is held: hold z,
    // press Cmd, release z, release Cmd -> keyup(KeyZ) never arrives and the
    // note drones for ever, with no blur to save us because the window never
    // lost focus. The Cmd/Ctrl keydown is the last moment we can still see it
    // coming, so it panics. Deliberately before the modifier bail below, and
    // deliberately not altKey: Option is a dead-key modifier that still
    // delivers keyup, and Option+letter is how accented characters are typed.
    if ((e.metaKey || e.ctrlKey) && held.size > 0) panic()

    // Focus guard: the tracker grid owns typing while it has focus. Only
    // KEYDOWN is suppressed — `keyup` still runs, so a note this listener
    // started before focus moved is released normally by its own key release.
    // It deliberately does NOT panic: another source (a pointer on the keybed,
    // a MIDI key) may be holding notes, and cutting those because the user
    // clicked into the grid is exactly the bug §7.2's refcounts exist to end.
    if (opts.suppress?.() === true) return

    if (e.metaKey || e.ctrlKey || e.altKey) return

    if (!gestureDone && opts.gesture) {
      if (opts.gesture(e)) {
        gestureDone = true
        e.preventDefault()
        return
      }
      gestureDone = true
    }

    if (e.code === 'Minus' || e.code === 'Equal') {
      e.preventDefault()
      if (e.repeat) return
      panic() // an octave change under held notes would orphan them
      transport.setOctave(transport.octave + (e.code === 'Equal' ? 1 : -1))
      return
    }

    const semitone = NOTE_KEYS.get(e.code)
    if (semitone === undefined) return
    e.preventDefault()
    if (e.repeat) return
    if (held.has(e.code)) return

    const note = noteForSemitone(semitone)
    held.set(e.code, note)
    // Per-source refcount (§7.2): sound it only if nobody else already is.
    if (transport.noteOn(note, 'qwerty')) bridge.noteOn(note, LOCAL_VELOCITY)
    opts.onNote?.(note)
  }

  function keyup(e: KeyboardEvent): void {
    const note = held.get(e.code)
    if (note === undefined) return
    held.delete(e.code)
    // …and cut it only if this was the last hand on it. A keyup used to cut a
    // note the pointer or the tracker was still holding.
    if (transport.noteOff(note, 'qwerty')) bridge.noteOff(note)
  }

  function onVisibility(): void {
    if (document.visibilityState === 'hidden') panic()
  }

  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', panic)
  window.addEventListener('pointercancel', panic)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
    window.removeEventListener('blur', panic)
    window.removeEventListener('pointercancel', panic)
    document.removeEventListener('visibilitychange', onVisibility)
    panic()
  }
}
