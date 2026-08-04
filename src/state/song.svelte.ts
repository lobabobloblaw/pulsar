/* pulsar — the song document store (design §4.6).
 *
 * A thin reactive skin over `songModel.ts`, which holds the undo policy and the
 * read helpers, and over WP9's `tracker/model/commands.ts`, which holds the
 * command layer itself. Everything testable is in there; everything reactive is
 * here. That split is not stylistic: `tests/unit/songStore.test.ts` runs in
 * vitest's node environment, where a rune is a ReferenceError.
 *
 * The cursor speaks in LANE INDICES (0..4) and the commands speak in
 * `ChannelId`s, so this is also the one place that translates between them —
 * `channelId()` below, called on the way into every command.
 *
 * Scope of undo, restated because it is the rule that keeps this honest (§4.6):
 * pattern, order, instrument, sequence and meta data only. Never playback
 * state, never the cursor or scroll, never mute/solo, never preset selection.
 */

import {
  cellAt,
  cellFieldCommand,
  createEmptySong,
  edit as applyEdit,
  EMPTY_HISTORY,
  ensurePattern,
  patternTargetOf,
  readField,
  redoStep,
  rowsOf,
  undoStep,
  withCell,
  type Cell,
  type CellField,
  type ChannelId,
  type ClipboardBlock,
  type Command,
  type History,
  type Song,
} from './songModel'

export * from './songModel'

/** Lanes packed per channel, mirroring `patternRenderer.LANES_PER_CHANNEL`. */
const LANES = 11
const LANE_NOTE = 0
const LANE_INST = 1
const LANE_VOL = 2
const LANE_FX0 = 3
const NONE = -32768

class SongStore {
  #doc = $state<Song>(createEmptySong())
  #history = $state<History>(EMPTY_HISTORY)
  /** Bumped on every document change — the canvas grid's cheap dirty signal,
   *  so it never has to deep-compare a document to know it must repaint. */
  #version = $state(0)
  /** Set by any edit, cleared by `load`. The preset bar reads it before it
   *  replaces the document (§5.6). */
  #dirty = $state(false)

  get doc(): Song {
    return this.#doc
  }
  get version(): number {
    return this.#version
  }
  get dirty(): boolean {
    return this.#dirty
  }
  get canUndo(): boolean {
    return this.#history.undo.length > 0
  }
  get canRedo(): boolean {
    return this.#history.redo.length > 0
  }
  get undoDepth(): number {
    return this.#history.undo.length
  }

  /** Replace the document. Clears history — an undo across a load would be a
   *  lie about which song you are editing. */
  load(song: Song): void {
    this.#doc = song
    this.#history = EMPTY_HISTORY
    this.#version++
    this.#dirty = false
  }

  reset(): void {
    this.load(createEmptySong())
  }

  /**
   * The single mutation path. A list is one undo entry, applied in order and
   * unwound in reverse. `now` is injectable so the coalescing window is testable
   * without a clock.
   */
  run(cmd: Command | readonly Command[], now: number = performance.now()): void {
    const cmds: readonly Command[] = Array.isArray(cmd)
      ? (cmd as readonly Command[])
      : [cmd as Command]
    if (cmds.length === 0) return
    // Commands rewrite patterns; none of them creates one. The order list can
    // name a pattern this document does not hold yet, so give the edit something
    // to land on first (see `ensurePattern` — it is outside the undo stack on
    // purpose).
    let doc = this.#doc
    for (const c of cmds) {
      const target = patternTargetOf(c)
      if (target !== null) doc = ensurePattern(doc, target.channel, target.pattern)
    }
    const r = applyEdit(doc, this.#history, cmds, now)
    this.#doc = r.song
    this.#history = r.history
    this.#version++
    this.#dirty = true
  }

  /** Undo/redo do not mark the document clean — a redo stack is not a save. */
  undo(): boolean {
    const r = undoStep(this.#doc, this.#history)
    if (!r.moved) return false
    this.#doc = r.song
    this.#history = r.history
    this.#version++
    this.#dirty = true
    return true
  }

  redo(): boolean {
    const r = redoStep(this.#doc, this.#history)
    if (!r.moved) return false
    this.#doc = r.song
    this.#history = r.history
    this.#version++
    this.#dirty = true
    return true
  }

  /* ---- reads the grid needs ---------------------------------------------- */

  /** The lane index the cursor and the canvas speak in, as the `ChannelId` the
   *  commands speak in. Null only for a lane this song does not have. */
  channelId(channel: number): ChannelId | null {
    return this.#doc.channels[channel] ?? null
  }

  /** Which pattern the given lane plays in the given order frame. */
  patternAt(frame: number, channel: number): number {
    return this.#doc.order[frame]?.[channel] ?? 0
  }

  cell(frame: number, channel: number, row: number): Cell | null {
    const id = this.channelId(channel)
    if (id === null) return null
    return cellAt(rowsOf(this.#doc, id, this.patternAt(frame, channel)), row)
  }

  field(frame: number, channel: number, row: number, field: CellField): number | null {
    return readField(this.cell(frame, channel, row), field)
  }

  /** Write one sub-field of one cell. The effect columns are two columns in the
   *  grid and one `Effect` in the model; `cellFieldCommand` is the join, and it
   *  needs the cell that is there now to keep the half the user did not type. */
  writeField(
    frame: number,
    channel: number,
    row: number,
    field: CellField,
    value: number | null,
    now?: number,
  ): void {
    const id = this.channelId(channel)
    if (id === null) return
    const target = { channel: id, pattern: this.patternAt(frame, channel), row }
    this.run(cellFieldCommand(this.cell(frame, channel, row), target, field, value), now)
  }

  /**
   * Pack one window of one order frame into `out`, the layout
   * `patternRenderer.drawRows` reads. Allocation-free: the caller owns `out`
   * and reuses it every repaint.
   */
  fillView(out: Int32Array, frame: number, firstRow: number, rowCount: number): void {
    const doc = this.#doc
    const channels = doc.channels.length
    out.fill(NONE, 0, rowCount * channels * LANES)
    for (let c = 0; c < channels; c++) {
      const rows = rowsOf(doc, doc.channels[c] as ChannelId, this.patternAt(frame, c))
      for (let i = 0; i < rows.length; i++) {
        const cell = rows[i] as Cell
        const r = cell.r - firstRow
        if (r < 0) continue
        if (r >= rowCount) break
        const base = (r * channels + c) * LANES
        if (cell.note !== undefined) out[base + LANE_NOTE] = cell.note
        if (cell.inst !== undefined) out[base + LANE_INST] = cell.inst
        if (cell.vol !== undefined) out[base + LANE_VOL] = cell.vol
        const fx = cell.fx
        if (fx === undefined) continue
        for (let k = 0; k < fx.length && k < 4; k++) {
          const e = fx[k]
          if (!e) continue
          out[base + LANE_FX0 + k * 2] = e.cmd.charCodeAt(0)
          out[base + LANE_FX0 + k * 2 + 1] = e.param
        }
      }
    }
  }

  /* ---- block operations the keymap drives -------------------------------- */

  copyBlock(frame: number, row0: number, row1: number, channel0: number, channel1: number): ClipboardBlock {
    const lanes: Cell[][] = []
    for (let c = channel0; c <= channel1; c++) {
      const id = this.channelId(c)
      const rows = id === null ? [] : rowsOf(this.#doc, id, this.patternAt(frame, c))
      const lane: Cell[] = []
      for (let i = 0; i < rows.length; i++) {
        const cell = rows[i] as Cell
        if (cell.r < row0 || cell.r > row1) continue
        lane.push({ ...cell, r: cell.r - row0 })
      }
      lanes.push(lane)
    }
    return { channels: channel1 - channel0 + 1, rows: row1 - row0 + 1, lanes }
  }

  /** Paste is expressed against the frame's patterns as whole row lists, so it is
   *  one entry in the undo stack however many lanes it spans — and an empty cell
   *  in the block clears its target, which a per-cell paste could not do. */
  pasteBlock(frame: number, row: number, channel: number, block: ClipboardBlock, now?: number): void {
    const cmds: Command[] = []
    const doc = this.#doc
    for (let c = 0; c < block.channels; c++) {
      const target = channel + c
      const id = this.channelId(target)
      if (id === null) break
      const pattern = this.patternAt(frame, target)
      let rows = rowsOf(doc, id, pattern)
      const lane = block.lanes[c] ?? []
      for (let r = 0; r < block.rows; r++) {
        const dest = row + r
        if (dest >= doc.meta.rowsPerPattern) break
        const src = cellAt(lane, r)
        rows = withCell(rows, dest, src === null ? null : { ...src, r: dest })
      }
      cmds.push({ kind: 'setPatternRows', channel: id, pattern, rows })
    }
    if (cmds.length > 0) this.run(cmds, now)
  }

  clearBlock(frame: number, row0: number, row1: number, channel0: number, channel1: number, now?: number): void {
    const cmds: Command[] = []
    for (let c = channel0; c <= channel1; c++) {
      const id = this.channelId(c)
      if (id === null) continue
      const pattern = this.patternAt(frame, c)
      const rows = rowsOf(this.#doc, id, pattern).filter((cell) => cell.r < row0 || cell.r > row1)
      cmds.push({ kind: 'setPatternRows', channel: id, pattern, rows })
    }
    if (cmds.length > 0) this.run(cmds, now)
  }
}

export const song = new SongStore()
