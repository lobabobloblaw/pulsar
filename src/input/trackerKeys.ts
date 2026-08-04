/* pulsar — tracker keybindings (design §4.5).
 *
 * This module is a PURE resolver: `(event-shape, context) -> action | null`.
 * It attaches no listeners, touches no DOM, holds no state and imports nothing
 * reactive, for two reasons that are really one reason — `tests/unit/trackerKeys.test.ts`
 * runs under vitest's node environment (no jsdom, no svelte plugin), so a rune
 * or a `KeyboardEvent` in this file's import graph would make the keymap
 * untestable. `PatternGrid.svelte` owns the listener and the action handling.
 *
 * The note-key map is INJECTED (`ctx.noteKeys`) rather than imported here, and
 * the injection site — `TrackerPanel.svelte` — passes `NOTE_KEYS` straight from
 * `src/input/keyboard.ts`. §4.5's "imported, not duplicated" therefore holds at
 * the app level: there is exactly one `event.code` -> semitone table in the
 * codebase and the tracker uses it. What this file must NOT do is import the
 * module that owns it, because that module owns a window listener and a store.
 *
 * A real `KeyboardEvent` structurally satisfies `TrackerKeyEvent`, so the call
 * site passes the event through unchanged.
 */

/** The subset of `KeyboardEvent` the keymap reads. */
export interface TrackerKeyEvent {
  readonly code: string
  readonly key: string
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly altKey: boolean
  readonly repeat: boolean
}

/** Which sub-column the cursor is in. Drives what a digit key means. */
export type ColumnKind = 'note' | 'inst' | 'vol' | 'fxCmd' | 'fxParam'

export interface TrackerKeyContext {
  /** `[edit]` chip state. Off: note keys audition only, nothing writes. */
  readonly editing: boolean
  readonly column: ColumnKind
  /** `event.code` -> semitone, from `src/input/keyboard.ts`'s LOWER_ROW/UPPER_ROW. */
  readonly noteKeys: ReadonlyMap<string, number>
}

export type TrackerAction =
  | { readonly kind: 'toggleEdit' }
  | { readonly kind: 'play'; readonly mode: 'row' | 'pattern' }
  | { readonly kind: 'stop' }
  | { readonly kind: 'move'; readonly rows: number; readonly columns: number; readonly channels: number }
  | { readonly kind: 'jump'; readonly to: 'rowFirst' | 'rowLast' | 'songStart' | 'songEnd' }
  | { readonly kind: 'octave'; readonly delta: number }
  /** Semitone offset from the current octave's base c. Write + audition in edit
   *  mode, audition only otherwise. */
  | { readonly kind: 'note'; readonly semitone: number }
  | { readonly kind: 'noteSpecial'; readonly value: 'cut' | 'release' }
  /** 0..15, for inst / vol / fx-param columns. */
  | { readonly kind: 'hex'; readonly value: number }
  /** One uppercase effect command character. */
  | { readonly kind: 'fxChar'; readonly char: string }
  | { readonly kind: 'clearField' }
  | { readonly kind: 'clearRow' }
  | { readonly kind: 'insertRow' }
  | { readonly kind: 'deleteRow' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' }
  | { readonly kind: 'clipboard'; readonly op: 'copy' | 'cut' | 'paste' }
  | { readonly kind: 'mute'; readonly channel: number }
  | { readonly kind: 'solo'; readonly channel: number }

/** ±16 rows, per §4.5's page up/down. */
export const PAGE_ROWS = 16

/** A hex column takes 0-9 and a-f; anything else is not ours. */
export function hexValue(key: string): number | null {
  if (key.length !== 1) return null
  const c = key.toLowerCase()
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'a' && c <= 'f') return c.charCodeAt(0) - 87
  return null
}

/** An effect command is a single character, stored uppercase (§1.2) and drawn
 *  lowercase (§4.2). */
export function effectChar(key: string): string | null {
  if (key.length !== 1) return null
  const c = key.toUpperCase()
  if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) return c
  return null
}

function channelDigit(code: string): number | null {
  if (!code.startsWith('Digit')) return null
  const n = Number(code.slice(5))
  return n >= 1 && n <= 5 ? n - 1 : null
}

/**
 * The whole keymap, as one function.
 *
 * Returns `null` for anything not bound, and the caller then leaves the event
 * alone. Every non-null return is a combination §4.5 lists, and the caller
 * `preventDefault()`s all of them.
 */
export function resolveTrackerKey(
  e: TrackerKeyEvent,
  ctx: TrackerKeyContext,
): TrackerAction | null {
  const mod = e.ctrlKey || e.metaKey

  // --- modified combinations first: ctrl+1..5 must beat the hex columns ------
  if (mod) {
    const ch = channelDigit(e.code)
    if (ch !== null) return e.altKey ? { kind: 'solo', channel: ch } : { kind: 'mute', channel: ch }

    switch (e.code) {
      case 'KeyZ':
        return e.shiftKey ? { kind: 'redo' } : { kind: 'undo' }
      case 'KeyY':
        return { kind: 'redo' }
      case 'KeyC':
        return { kind: 'clipboard', op: 'copy' }
      case 'KeyX':
        return { kind: 'clipboard', op: 'cut' }
      case 'KeyV':
        return { kind: 'clipboard', op: 'paste' }
      case 'Home':
        return { kind: 'jump', to: 'songStart' }
      case 'End':
        return { kind: 'jump', to: 'songEnd' }
      default:
        return null
    }
  }

  if (e.altKey) return null

  // --- unmodified navigation and transport, in every column and both modes ---
  switch (e.code) {
    case 'Space':
      return { kind: 'toggleEdit' }
    case 'Enter':
    case 'NumpadEnter':
      return { kind: 'play', mode: e.shiftKey ? 'pattern' : 'row' }
    case 'Escape':
      return { kind: 'stop' }
    case 'ArrowUp':
      return { kind: 'move', rows: -1, columns: 0, channels: 0 }
    case 'ArrowDown':
      return { kind: 'move', rows: 1, columns: 0, channels: 0 }
    case 'ArrowLeft':
      return { kind: 'move', rows: 0, columns: -1, channels: 0 }
    case 'ArrowRight':
      return { kind: 'move', rows: 0, columns: 1, channels: 0 }
    case 'Tab':
      return { kind: 'move', rows: 0, columns: 0, channels: e.shiftKey ? -1 : 1 }
    case 'PageUp':
      return { kind: 'move', rows: -PAGE_ROWS, columns: 0, channels: 0 }
    case 'PageDown':
      return { kind: 'move', rows: PAGE_ROWS, columns: 0, channels: 0 }
    case 'Home':
      return { kind: 'jump', to: 'rowFirst' }
    case 'End':
      return { kind: 'jump', to: 'rowLast' }
    case 'Minus':
      return { kind: 'octave', delta: -1 }
    case 'Equal':
      return { kind: 'octave', delta: 1 }
    default:
      break
  }

  // --- edit-only structural keys -------------------------------------------
  if (ctx.editing) {
    switch (e.code) {
      case 'Delete':
        return e.shiftKey ? { kind: 'clearRow' } : { kind: 'clearField' }
      case 'Insert':
        return { kind: 'insertRow' }
      case 'Backspace':
        return { kind: 'deleteRow' }
      default:
        break
    }
  }

  // --- the note column ------------------------------------------------------
  if (ctx.column === 'note') {
    // Digit1 is deliberately free of the note map (the upper row uses 2,3,5,6,7)
    // so the two sentinels get the two keys a tracker player expects.
    if (e.code === 'Digit1') return { kind: 'noteSpecial', value: 'cut' }
    if (e.code === 'Backquote') return { kind: 'noteSpecial', value: 'release' }
    const semitone = ctx.noteKeys.get(e.code)
    if (semitone !== undefined) return { kind: 'note', semitone }
    return null
  }

  // --- the hex and effect-character columns ---------------------------------
  if (!ctx.editing) return null

  if (ctx.column === 'fxCmd') {
    const char = effectChar(e.key)
    return char === null ? null : { kind: 'fxChar', char }
  }

  const value = hexValue(e.key)
  if (value === null) return null
  // inst is 00..ff, vol is 0..f, fx params are 00..ff. The store clamps; the
  // keymap only says "this was a hex digit".
  return { kind: 'hex', value }
}
