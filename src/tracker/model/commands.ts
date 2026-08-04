/** The command stack (design §4.6) — every mutation of a song, as a pure function.
 *
 *      applyCommand(song, cmd) -> { song, inverse }
 *
 *  The document is immutable, so a command produces a NEW `Song` structurally shared
 *  with the old one and an INVERSE that exactly undoes it. That is what makes undo
 *  cheap over an immutable model: two arrays of commands and no snapshots.
 *
 *  Ownership note: this file is pure and belongs to WP9. The store that holds the
 *  `undo`/`redo` arrays is `src/state/song.svelte.ts` (WP10) and enforces the two
 *  policies stated here as constants — a **200-entry cap** and **700 ms same-cell
 *  coalescing**, so typing `1`,`0`,`5` into a volume field is one undo, not three.
 *
 *  Scope, from the design: pattern, order, instrument, sequence and meta data only.
 *  Never playback state, never cursor/scroll, never mute/solo, never preset selection.
 */
import type {
  Cell,
  ChannelId,
  Effect,
  Frame,
  Instrument,
  MacroKind,
  Pattern,
  Sequence,
  Song,
  SongMeta,
} from './types'

/** Undo entries the store keeps. Beyond this the oldest is dropped. */
export const UNDO_CAP = 200
/** Consecutive `setCellField` commands on the SAME cell inside this window coalesce
 *  into one undo entry. */
export const COALESCE_MS = 700

export interface CellTarget {
  readonly channel: ChannelId
  readonly pattern: number
  readonly row: number
}

export type Command =
  /** Replace one whole cell. `cell: null` clears it. */
  | ({ readonly kind: 'setCell'; readonly cell: Cell | null } & CellTarget)
  /** Replace one field of one cell. This is the command the grid emits per keystroke
   *  and the one the store coalesces. */
  | ({
      readonly kind: 'setCellField'
      readonly field: 'note' | 'inst' | 'vol'
      readonly value: number | null
    } & CellTarget)
  | ({
      readonly kind: 'setCellField'
      readonly field: 'fx'
      readonly slot: number
      readonly effect: Effect | null
    } & CellTarget)
  | ({ readonly kind: 'clearRow' } & CellTarget)
  /** Push rows down from `row`; the last row of the pattern falls off the end. */
  | ({ readonly kind: 'insertRow' } & CellTarget)
  /** Pull rows up into `row`. */
  | ({ readonly kind: 'deleteRow' } & CellTarget)
  /** Block-rectangular paste. `cells` carry `r` RELATIVE to `row`. */
  | ({ readonly kind: 'pasteBlock'; readonly cells: readonly Cell[] } & CellTarget)
  /** The exact inverse of every structural pattern edit: the whole sparse row list.
   *  Patterns are small and sparse, so carrying the previous list is cheaper than
   *  reconstructing an inverse edit — and it cannot be subtly wrong. */
  | {
      readonly kind: 'setPatternRows'
      readonly channel: ChannelId
      readonly pattern: number
      readonly rows: readonly Cell[]
    }
  | { readonly kind: 'setOrderEntry'; readonly frame: number; readonly channel: number; readonly pattern: number }
  | { readonly kind: 'insertFrame'; readonly frame: number; readonly value: Frame }
  | { readonly kind: 'deleteFrame'; readonly frame: number }
  /** The exact inverse of a frame insert/delete. */
  | { readonly kind: 'setOrder'; readonly order: readonly Frame[] }
  | { readonly kind: 'setMeta'; readonly meta: Partial<SongMeta> }
  /** `index === instruments.length` appends; `instrument: null` at the last index
   *  pops. Anything else replaces. */
  | { readonly kind: 'setInstrument'; readonly index: number; readonly instrument: Instrument | null }
  | {
      readonly kind: 'setSequence'
      readonly macro: MacroKind
      readonly index: number
      readonly sequence: Sequence | null
    }

export interface CommandResult {
  readonly song: Song
  readonly inverse: Command
}

/** A no-op command, returned when a command targets something that does not exist.
 *  `applyCommand` never throws: the grid can emit a command for a pattern the user
 *  just deleted and the worst outcome is that nothing happens. */
const NOOP: Command = { kind: 'setMeta', meta: {} }

export function applyCommand(song: Song, cmd: Command): CommandResult {
  switch (cmd.kind) {
    case 'setCell':
      return setCell(song, cmd, cmd.cell)
    case 'setCellField':
      return setCellField(song, cmd)
    case 'clearRow':
      return setCell(song, cmd, null)
    case 'insertRow':
      return rewriteRows(song, cmd.channel, cmd.pattern, (rows, limit) =>
        rows
          .map((c) => (c.r >= cmd.row ? withRow(c, c.r + 1) : c))
          .filter((c) => c.r < limit),
      )
    case 'deleteRow':
      return rewriteRows(song, cmd.channel, cmd.pattern, (rows) =>
        rows
          .filter((c) => c.r !== cmd.row)
          .map((c) => (c.r > cmd.row ? withRow(c, c.r - 1) : c)),
      )
    case 'pasteBlock':
      return rewriteRows(song, cmd.channel, cmd.pattern, (rows, limit) => {
        const replaced = new Set(cmd.cells.map((c) => c.r + cmd.row))
        const kept = rows.filter((c) => !replaced.has(c.r))
        const pasted = cmd.cells
          .map((c) => withRow(c, c.r + cmd.row))
          .filter((c) => c.r >= 0 && c.r < limit)
        return [...kept, ...pasted]
      })
    case 'setPatternRows':
      return rewriteRows(song, cmd.channel, cmd.pattern, () => cmd.rows)
    case 'setOrderEntry':
      return setOrderEntry(song, cmd)
    case 'insertFrame': {
      const order = [...song.order]
      const frame = clamp(cmd.frame, 0, order.length)
      order.splice(frame, 0, cmd.value)
      return { song: { ...song, order }, inverse: { kind: 'setOrder', order: song.order } }
    }
    case 'deleteFrame': {
      if (song.order.length <= 1 || cmd.frame < 0 || cmd.frame >= song.order.length) {
        return { song, inverse: NOOP }
      }
      const order = [...song.order]
      order.splice(cmd.frame, 1)
      return { song: { ...song, order }, inverse: { kind: 'setOrder', order: song.order } }
    }
    case 'setOrder':
      return { song: { ...song, order: cmd.order }, inverse: { kind: 'setOrder', order: song.order } }
    case 'setMeta': {
      const before: Partial<SongMeta> = {}
      const keys = Object.keys(cmd.meta) as (keyof SongMeta)[]
      for (const k of keys) assignMeta(before, k, song.meta[k])
      return {
        song: { ...song, meta: { ...song.meta, ...cmd.meta } },
        inverse: { kind: 'setMeta', meta: before },
      }
    }
    case 'setInstrument':
      return setInstrument(song, cmd.index, cmd.instrument)
    case 'setSequence':
      return setSequence(song, cmd.macro, cmd.index, cmd.sequence)
    default:
      return { song, inverse: NOOP }
  }
}

/** Apply a list in order, returning the inverses in the order that undoes them. */
export function applyCommands(
  song: Song,
  cmds: readonly Command[],
): { song: Song; inverses: Command[] } {
  let cur = song
  const inverses: Command[] = []
  for (const cmd of cmds) {
    const r = applyCommand(cur, cmd)
    cur = r.song
    inverses.unshift(r.inverse)
  }
  return { song: cur, inverses }
}

// --- internals ---------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function assignMeta<K extends keyof SongMeta>(
  target: Partial<SongMeta>,
  key: K,
  value: SongMeta[K],
): void {
  ;(target as Record<string, unknown>)[key as string] = value
}

function withRow(cell: Cell, r: number): Cell {
  return { ...cell, r }
}

function findPattern(song: Song, channel: ChannelId, index: number): number {
  for (let i = 0; i < song.patterns.length; i++) {
    const p = song.patterns[i]
    if (p.channel === channel && p.index === index) return i
  }
  return -1
}

function cellAt(pattern: Pattern, row: number): Cell | null {
  for (const c of pattern.rows) if (c.r === row) return c
  return null
}

/** Every pattern-shaped edit funnels through here so its inverse is always the exact
 *  previous row list. `limit` is `rowsPerPattern`. */
function rewriteRows(
  song: Song,
  channel: ChannelId,
  index: number,
  fn: (rows: readonly Cell[], limit: number) => readonly Cell[],
): CommandResult {
  const at = findPattern(song, channel, index)
  if (at < 0) return { song, inverse: NOOP }
  const pattern = song.patterns[at]
  const next = [...fn(pattern.rows, song.meta.rowsPerPattern)]
    .filter((c) => c.r >= 0 && c.r < song.meta.rowsPerPattern && !isEmptyCell(c))
    .sort((a, b) => a.r - b.r)
  const patterns = [...song.patterns]
  patterns[at] = { ...pattern, rows: next }
  return {
    song: { ...song, patterns },
    inverse: { kind: 'setPatternRows', channel, pattern: index, rows: pattern.rows },
  }
}

function isEmptyCell(c: Cell): boolean {
  if (c.note !== undefined || c.inst !== undefined || c.vol !== undefined) return false
  if (c.fx === undefined) return true
  for (const e of c.fx) if (e !== null) return false
  return true
}

function setCell(song: Song, target: CellTarget, cell: Cell | null): CommandResult {
  const at = findPattern(song, target.channel, target.pattern)
  if (at < 0) return { song, inverse: NOOP }
  const pattern = song.patterns[at]
  const previous = cellAt(pattern, target.row)
  const rows = pattern.rows.filter((c) => c.r !== target.row)
  if (cell !== null && !isEmptyCell(cell)) rows.push(withRow(cell, target.row))
  rows.sort((a, b) => a.r - b.r)
  const patterns = [...song.patterns]
  patterns[at] = { ...pattern, rows }
  return {
    song: { ...song, patterns },
    inverse: { kind: 'setCell', channel: target.channel, pattern: target.pattern, row: target.row, cell: previous },
  }
}

type FieldCommand = Extract<Command, { kind: 'setCellField' }>

function setCellField(song: Song, cmd: FieldCommand): CommandResult {
  const at = findPattern(song, cmd.channel, cmd.pattern)
  if (at < 0) return { song, inverse: NOOP }
  const previous = cellAt(song.patterns[at], cmd.row)
  const base: Record<string, unknown> = previous === null ? { r: cmd.row } : { ...previous }

  if (cmd.field === 'fx') {
    const fx: (Effect | null)[] = previous?.fx === undefined ? [] : [...previous.fx]
    while (fx.length <= cmd.slot) fx.push(null)
    fx[cmd.slot] = cmd.effect
    let end = fx.length
    while (end > 0 && fx[end - 1] === null) end--
    if (end === 0) delete base.fx
    else base.fx = fx.slice(0, end)
  } else if (cmd.value === null) {
    delete base[cmd.field]
  } else {
    base[cmd.field] = cmd.value
  }

  const next = base as unknown as Cell
  return setCell(song, cmd, isEmptyCell(next) ? null : next)
}

function setOrderEntry(
  song: Song,
  cmd: Extract<Command, { kind: 'setOrderEntry' }>,
): CommandResult {
  if (cmd.frame < 0 || cmd.frame >= song.order.length) return { song, inverse: NOOP }
  const frame = song.order[cmd.frame]
  if (cmd.channel < 0 || cmd.channel >= frame.length) return { song, inverse: NOOP }
  const next = [...frame]
  next[cmd.channel] = cmd.pattern
  const order = [...song.order]
  order[cmd.frame] = next
  return {
    song: { ...song, order },
    inverse: {
      kind: 'setOrderEntry',
      frame: cmd.frame,
      channel: cmd.channel,
      pattern: frame[cmd.channel],
    },
  }
}

function setInstrument(song: Song, index: number, instrument: Instrument | null): CommandResult {
  const list = [...song.instruments]
  if (index < 0 || index > list.length) return { song, inverse: NOOP }
  if (instrument === null) {
    if (index !== list.length - 1) return { song, inverse: NOOP }
    const previous = list[index]
    list.pop()
    return {
      song: { ...song, instruments: list },
      inverse: { kind: 'setInstrument', index, instrument: previous },
    }
  }
  const previous = index < list.length ? list[index] : null
  list[index] = instrument
  return {
    song: { ...song, instruments: list },
    inverse: { kind: 'setInstrument', index, instrument: previous },
  }
}

function setSequence(
  song: Song,
  macro: MacroKind,
  index: number,
  sequence: Sequence | null,
): CommandResult {
  const list = [...song.sequences[macro]]
  if (index < 0 || index > list.length) return { song, inverse: NOOP }
  let previous: Sequence | null = null
  if (sequence === null) {
    if (index !== list.length - 1) return { song, inverse: NOOP }
    previous = list[index]
    list.pop()
  } else {
    previous = index < list.length ? list[index] : null
    list[index] = sequence
  }
  return {
    song: { ...song, sequences: { ...song.sequences, [macro]: list } },
    inverse: { kind: 'setSequence', macro, index, sequence: previous },
  }
}
