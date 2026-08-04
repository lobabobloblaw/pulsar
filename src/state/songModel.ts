/* pulsar — the song store's read helpers and undo policy (design §4.6).
 *
 * The DATA MODEL and the COMMAND LAYER are both WP9's: this file re-exports
 * `src/tracker/model/types.ts` and `src/tracker/model/commands.ts` verbatim, so
 * the grid, the order list, the driver and the validator all speak about one
 * `Song` and one `Command`, and WP10 code keeps a single import for everything.
 *
 * What is left here is what design §4.6 puts in the STORE rather than in the
 * command stack:
 *   - the undo/redo stack, its cap and its coalescing window (the two constants
 *     themselves live with the commands and are re-exported below);
 *   - the read helpers the canvas grid draws from;
 *   - the small adapter that turns the grid's two-column effect editing into the
 *     model's single `Effect`.
 *
 * Why this file is plain `.ts` and not `.svelte.ts`: `tests/unit/songStore.test.ts`
 * runs under vitest's node environment with no svelte plugin, so a rune in the
 * import graph is a `ReferenceError` at runtime AND an unresolved global under
 * `tsconfig.test.json`. The reactive wrapper lives in `song.svelte.ts`; the
 * policy that the gate actually tests lives here, where it can be tested.
 *
 * No DOM types either, for the same reason.
 */

import { applyCommands, COALESCE_MS, UNDO_CAP, type Command } from '../tracker/model/commands'
import {
  CANONICAL_CHANNELS,
  emptySong,
  type Cell,
  type ChannelId,
  type Effect,
  type Frame,
  type Instrument,
  type Pattern,
  type Song,
  type SongMeta,
} from '../tracker/model/types'

/** The data model and the command layer, re-exported so WP10 code has one import
 *  for everything — including `UNDO_CAP` and `COALESCE_MS`, which are stated once,
 *  next to the commands they constrain. */
export * from '../tracker/model/types'
export * from '../tracker/model/commands'

/** Lane names as the grid and the order list print them — lowercase UI copy,
 *  which is WP10's business and not the format's. */
export const CHANNEL_LABELS: Readonly<Record<ChannelId, string>> = {
  pulse1: 'pulse 1',
  pulse2: 'pulse 2',
  triangle: 'triangle',
  noise: 'noise',
  dpcm: 'dpcm',
}

export const CHANNEL_IDS = CANONICAL_CHANNELS

/* ---- the grid's view of a cell's sub-fields ------------------------------ */

/**
 * Which sub-field of a cell the cursor is on.
 *
 * The model stores an effect as one `Effect` — a command character and a param.
 * The grid edits it as TWO columns, the character and the two hex digits after
 * it, because that is how a tracker is typed. This type is that UI split; the
 * command that comes out of it always carries a whole `Effect` (see
 * `cellFieldCommand`).
 */
export type CellField =
  | { readonly kind: 'note' | 'inst' | 'vol' }
  | { readonly kind: 'fx'; readonly slot: number; readonly part: 'cmd' | 'param' }

/** A rectangular copy: `channels` lanes wide, `rows` tall, cells row-major with
 *  `r` rebased to 0. Cut/copy/paste in the grid is whole-cell, not sub-column —
 *  stated here because it is the one place the editor is narrower than the
 *  design's "block-rectangular" wording allows. */
export interface ClipboardBlock {
  readonly channels: number
  readonly rows: number
  /** `lanes[c]` is the cell list for the c-th channel of the block. */
  readonly lanes: readonly (readonly Cell[])[]
}

const EMPTY_ROWS: readonly Cell[] = []

/* ---- reads ---------------------------------------------------------------- */

export function findPattern(song: Song, channel: ChannelId, index: number): Pattern | null {
  for (let i = 0; i < song.patterns.length; i++) {
    const p = song.patterns[i] as Pattern
    if (p.index === index && p.channel === channel) return p
  }
  return null
}

export function rowsOf(song: Song, channel: ChannelId, index: number): readonly Cell[] {
  return findPattern(song, channel, index)?.rows ?? EMPTY_ROWS
}

export function cellAt(rows: readonly Cell[], row: number): Cell | null {
  // Sparse and sorted: a linear scan is fine at editor rates and a binary search
  // is fine too. Rows are <= 256, so this is not the place to be clever.
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i] as Cell
    if (c.r === row) return c
    if (c.r > row) return null
  }
  return null
}

/** Read one sub-field, as the grid's hex editor sees it. `null` = absent. An
 *  effect's command character reads back as its char code, which is what the two
 *  digit-entry paths in `PatternGrid` compare and rewrite. */
export function readField(cell: Cell | null, field: CellField): number | null {
  if (cell === null) return null
  if (field.kind === 'fx') {
    const fx = cell.fx?.[field.slot]
    if (!fx) return null
    return field.part === 'cmd' ? fx.cmd.charCodeAt(0) : fx.param
  }
  if (field.kind === 'note') return cell.note ?? null
  if (field.kind === 'inst') return cell.inst ?? null
  return cell.vol ?? null
}

function isEmptyCell(c: Cell): boolean {
  if (c.note !== undefined || c.inst !== undefined || c.vol !== undefined) return false
  const fx = c.fx
  if (fx === undefined) return true
  for (let i = 0; i < fx.length; i++) if (fx[i]) return false
  return true
}

/** Insert / replace / drop one row in a sparse, ascending row list. Exported
 *  because the store's block paste builds whole row lists before committing them
 *  as one `setPatternRows` command (one undo entry for one paste). */
export function withCell(rows: readonly Cell[], row: number, cell: Cell | null): readonly Cell[] {
  const out: Cell[] = []
  let placed = false
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i] as Cell
    if (c.r === row) {
      placed = true
      if (cell !== null && !isEmptyCell(cell)) out.push(cell)
      continue
    }
    if (c.r > row && !placed) {
      placed = true
      if (cell !== null && !isEmptyCell(cell)) out.push(cell)
    }
    out.push(c)
  }
  if (!placed && cell !== null && !isEmptyCell(cell)) out.push(cell)
  return out
}

/* ---- command construction ------------------------------------------------ */

/**
 * The grid's per-keystroke edit, as a command.
 *
 * For note/inst/vol it is a straight pass-through. For an effect it is the
 * adapter that keeps the two-column UX honest: a command character typed over an
 * existing effect keeps that effect's param, a param digit typed into an empty
 * slot gets the neutral `0` command, and clearing EITHER column clears the whole
 * effect — the model has no half-effect to store.
 */
export function cellFieldCommand(
  cell: Cell | null,
  target: { readonly channel: ChannelId; readonly pattern: number; readonly row: number },
  field: CellField,
  value: number | null,
): Command {
  if (field.kind !== 'fx') {
    return { kind: 'setCellField', ...target, field: field.kind, value }
  }
  const current = cell?.fx?.[field.slot] ?? null
  let effect: Effect | null = null
  if (value !== null) {
    effect =
      field.part === 'cmd'
        ? { cmd: String.fromCharCode(value), param: current?.param ?? 0 }
        : { cmd: current?.cmd ?? '0', param: value }
  }
  return { kind: 'setCellField', ...target, field: 'fx', slot: field.slot, effect }
}

/** Which pattern a command edits, or null for the order/meta/instrument ones.
 *  The store reads this to make sure the pattern exists first — see
 *  `ensurePattern`. */
export function patternTargetOf(
  cmd: Command,
): { readonly channel: ChannelId; readonly pattern: number } | null {
  switch (cmd.kind) {
    case 'setCell':
    case 'setCellField':
    case 'clearRow':
    case 'insertRow':
    case 'deleteRow':
    case 'pasteBlock':
    case 'setPatternRows':
      return { channel: cmd.channel, pattern: cmd.pattern }
    default:
      return null
  }
}

/** Patterns are kept sorted by (channel, index) — §1.3's serializer rule, and
 *  the reason a create-then-edit round trip serializes identically rather than
 *  merely equivalently-with-the-rows-in-a-different-place. */
function insertPattern(
  patterns: readonly Pattern[],
  channels: readonly ChannelId[],
  next: Pattern,
): Pattern[] {
  const rank = (p: Pattern): number => channels.indexOf(p.channel) * 100000 + p.index
  const out = [...patterns]
  const r = rank(next)
  let at = out.length
  for (let i = 0; i < out.length; i++) {
    if (rank(out[i] as Pattern) > r) {
      at = i
      break
    }
  }
  out.splice(at, 0, next)
  return out
}

/**
 * Materialise an empty pattern if the song has none for `(channel, index)`.
 *
 * Every command REWRITES a pattern; none of them creates one, so a command aimed
 * at a pattern the order list names but the document does not hold yet is a
 * silent no-op. The order list lets a user type any index, so the store calls
 * this before it edits. It is deliberately OUTSIDE the undo stack: an empty
 * pattern is indistinguishable from an absent one to the driver, the serializer
 * and the grid (`emptySong` ships five of them), so undo still lands on exactly
 * the document the user was looking at.
 */
export function ensurePattern(song: Song, channel: ChannelId, index: number): Song {
  if (index < 0 || findPattern(song, channel, index) !== null) return song
  return {
    ...song,
    patterns: insertPattern(song.patterns, song.channels, { channel, index, rows: [] }),
  }
}

/** The lowest pattern index no lane and no frame is using yet — what "add frame"
 *  fills a new frame with, so a fresh frame is a fresh page rather than a second
 *  view of the one above it. */
export function nextFreePatternIndex(song: Song): number {
  let max = -1
  for (let i = 0; i < song.order.length; i++) {
    const f = song.order[i] as Frame
    for (let c = 0; c < f.length; c++) max = Math.max(max, f[c] as number)
  }
  for (let i = 0; i < song.patterns.length; i++) {
    max = Math.max(max, (song.patterns[i] as Pattern).index)
  }
  return max + 1
}

/** A blank order frame: one fresh pattern index across every lane. */
export function newFrame(song: Song): Frame {
  return new Array<number>(song.channels.length).fill(nextFreePatternIndex(song))
}

export function emptyInstrument(name = 'instrument'): Instrument {
  return {
    name,
    macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: -1 },
  }
}

/** The document a fresh session starts on. WP9's `emptySong()` is structurally
 *  valid but instrument-less; a first note has to make a sound, so WP10 seeds
 *  one instrument with a short volume envelope and a 50 % duty. */
export function createEmptySong(name = 'untitled'): Song {
  const base = emptySong({ name })
  return {
    ...base,
    instruments: [
      { name: 'lead', macros: { volume: 0, arpeggio: -1, pitch: -1, hiPitch: -1, duty: 0 } },
    ],
    sequences: {
      volume: [{ values: [15, 14, 12, 10, 9], loop: 4, release: -1 }],
      arpeggio: [],
      pitch: [],
      hiPitch: [],
      duty: [{ values: [2], loop: 0, release: -1 }],
    },
  }
}

/* ---- undo/redo policy (design §4.6) -------------------------------------- */

export interface HistoryEntry {
  /** Replays the whole entry, in order. More than one command when a paste, a
   *  row insert across lanes or a coalesced run made it so. */
  readonly redo: readonly Command[]
  /** Unwinds the whole entry, newest first — so one undo returns to the state
   *  before the FIRST keystroke of the run. */
  readonly undo: readonly Command[]
  /** `channel:pattern:row`, or null for anything that is not a single cell edit. */
  readonly cell: string | null
  readonly at: number
}

export interface History {
  readonly undo: readonly HistoryEntry[]
  readonly redo: readonly HistoryEntry[]
}

export const EMPTY_HISTORY: History = { undo: [], redo: [] }

/** Only a lone `setCellField` coalesces. A batch is already one gesture. */
function cellKeyOf(cmds: readonly Command[]): string | null {
  if (cmds.length !== 1) return null
  const cmd = cmds[0] as Command
  return cmd.kind === 'setCellField' ? `${cmd.channel}:${cmd.pattern}:${cmd.row}` : null
}

export interface EditResult {
  readonly song: Song
  readonly history: History
  /** True when the edit merged into the previous entry instead of adding one. */
  readonly coalesced: boolean
}

/**
 * Apply one command — or one indivisible group of them — and fold it into the
 * history.
 *
 * Three rules, each of which `songStore.test.ts` pins:
 *   - a new edit always invalidates the redo stack;
 *   - consecutive `setCellField`s on the same cell inside COALESCE_MS become one
 *     entry, keeping the ORIGINAL inverse;
 *   - the stack is capped at UNDO_CAP, dropping from the oldest end.
 */
export function edit(
  song: Song,
  history: History,
  cmds: Command | readonly Command[],
  now: number,
): EditResult {
  const list: readonly Command[] = Array.isArray(cmds) ? (cmds as readonly Command[]) : [cmds as Command]
  const { song: next, inverses } = applyCommands(song, list)
  const key = cellKeyOf(list)
  const top = history.undo[history.undo.length - 1]

  if (key !== null && top !== undefined && top.cell === key && now - top.at <= COALESCE_MS) {
    // Both halves keep the WHOLE run, not just the newest command. Writing a note
    // also writes the cell's instrument, and a run of edits inside one cell can
    // touch several sub-fields — keeping only the last command would make redo
    // drop every earlier one, and keeping only the first inverse would make undo
    // leave them behind. Redo replays the run in order; undo unwinds it in
    // reverse. It is still exactly one entry.
    const merged: HistoryEntry = {
      redo: [...top.redo, ...list],
      undo: [...inverses, ...top.undo],
      cell: key,
      at: now,
    }
    const undo = [...history.undo.slice(0, -1), merged]
    return { song: next, history: { undo, redo: [] }, coalesced: true }
  }

  const entry: HistoryEntry = { redo: list, undo: inverses, cell: key, at: now }
  const undo = [...history.undo, entry]
  // Drop from the oldest end. An editor that forgets the last 200 edits instead
  // of the first 200 is an editor nobody trusts.
  if (undo.length > UNDO_CAP) undo.splice(0, undo.length - UNDO_CAP)
  return { song: next, history: { undo, redo: [] }, coalesced: false }
}

export interface StepResult {
  readonly song: Song
  readonly history: History
  readonly moved: boolean
}

export function undoStep(song: Song, history: History): StepResult {
  const entry = history.undo[history.undo.length - 1]
  if (entry === undefined) return { song, history, moved: false }
  const { song: next } = applyCommands(song, entry.undo)
  return {
    song: next,
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, entry] },
    moved: true,
  }
}

export function redoStep(song: Song, history: History): StepResult {
  const entry = history.redo[history.redo.length - 1]
  if (entry === undefined) return { song, history, moved: false }
  const { song: next, inverses } = applyCommands(song, entry.redo)
  // The inverses are recomputed against the CURRENT document rather than reused:
  // a redo lands on a document that undo just rebuilt, and reusing a stale
  // inverse is how redo stacks quietly corrupt documents.
  const replayed: HistoryEntry = { redo: entry.redo, undo: inverses, cell: entry.cell, at: entry.at }
  return {
    song: next,
    history: { undo: [...history.undo, replayed], redo: history.redo.slice(0, -1) },
    moved: true,
  }
}

/* ---- derived read helpers the UI and the renderer share ------------------ */

/** `ticksPerRow = 2.5·E·S/T` as an exact ratio (design §2.3). */
export function ticksPerRow(meta: SongMeta): number {
  const num = 5 * meta.engineSpeed * meta.speed
  const den = 2 * meta.tempo
  const exact = num / den
  return meta.evenTempo ? Math.max(1, Math.round(exact)) : exact
}

/** `bpm = 24·T / (S · rowHighlight)` (design §2.3 — E cancels). */
export function bpm(meta: SongMeta): number {
  const rows = meta.rowHighlight > 0 ? meta.rowHighlight : 4
  return (60 * meta.engineSpeed) / (ticksPerRow(meta) * rows)
}
