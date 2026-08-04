/* pulsar — the pattern grid's draw functions (design §4.2, §4.3).
 *
 * Pure. No Svelte, no DOM lookups, no state: geometry in, pixels out. The two
 * entry points map onto §4.3's two layers —
 *
 *   drawFurniture()  the static furniture (channel headers, column rules, the
 *                    row-number gutter frame). Painted once into an offscreen
 *                    surface and blitted per frame by the component.
 *   drawRows()       the live layer: highlight bands, cells, selection, the
 *                    playhead and the edit cursor.
 *
 * Two disciplines make the p99 <= 4 ms gate reachable at 8 channels x 40 rows:
 *
 *   1. Every string the grid can draw is precomputed. Note names, two-digit hex
 *      and one-digit hex are tables built at module load, so a full repaint
 *      allocates NOTHING and `fillText` always receives an interned string.
 *   2. Cells are drawn in three colour passes (empty marks, notes, parameters)
 *      rather than in cell order, so a full repaint writes `fillStyle` three
 *      times instead of once per cell.
 *
 * The 2D context is typed structurally (`Ctx2D`) rather than as
 * `CanvasRenderingContext2D`, because `tests/bench/patternGrid.bench.ts` runs
 * under `tsconfig.test.json` (lib ES2023, no DOM) against a headless shim, and
 * because it documents exactly which seven context members the grid uses. A
 * real 2D context satisfies it.
 */

import type { ColumnKind } from '../../input/trackerKeys'

/* ---- the context shim ---------------------------------------------------- */

export interface TextMetricsLike {
  readonly width: number
}

export interface Ctx2D {
  /** `unknown` rather than `string`: the DOM's is `string | CanvasGradient |
   *  CanvasPattern`, which is not assignable to `string`. We only ever assign
   *  strings to it. */
  fillStyle: unknown
  font: string
  textBaseline: string
  globalAlpha: number
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): TextMetricsLike
  save(): void
  restore(): void
}

/* ---- palette + geometry -------------------------------------------------- */

/** Resolved from `tokens.css` — never mirrored as literals (design §4.2/K5).
 *  `gridMetrics.ts` owns the resolution; this module only consumes it. */
export interface GridPalette {
  bg: string
  bgAlt: string
  bgBeat: string
  bgBar: string
  ink: string
  inkDim: string
  inkMuted: string
  accent: string
  selection: string
  hairline: string
  focus: string
}

export interface FieldLayout {
  readonly kind: ColumnKind
  /** Which effect column this field belongs to; -1 for note/inst/vol. */
  readonly fx: number
  /** Index into the channel's packed lane data. */
  readonly lane: number
  readonly x: number
  readonly w: number
  readonly chars: number
}

export interface ChannelLayout {
  readonly x: number
  readonly w: number
  readonly fields: readonly FieldLayout[]
}

export interface GridLayout {
  readonly charW: number
  readonly rowH: number
  readonly headerH: number
  readonly gutterW: number
  readonly width: number
  readonly channels: readonly ChannelLayout[]
  readonly fontCell: string
  readonly fontMicro: string
}

/** Base-4 space scale, same unit as the lattice (§4.2). */
export const ROW_H = 18
export const PAD = 4
/** 1 px between fields, 2 px between channel groups (§4.2). */
export const FIELD_RULE = 1
export const CHANNEL_RULE = 2
export const HEADER_H = 22

/** note, inst, vol, then (cmd, param) per effect column. */
export const LANE_NOTE = 0
export const LANE_INST = 1
export const LANE_VOL = 2
export const LANE_FX0 = 3
export const MAX_FX = 4
export const LANES_PER_CHANNEL = LANE_FX0 + MAX_FX * 2

/** Absent. Distinct from NOTE_CUT (-1) and NOTE_RELEASE (-2), which are values. */
export const NONE = -32768

export interface LayoutOptions {
  readonly charW: number
  readonly channels: number
  /** Visible effect columns per channel, 1..4. */
  readonly effectColumns: readonly number[]
  readonly rowH?: number
  readonly headerH?: number
  readonly fontCell: string
  readonly fontMicro: string
}

/** Widths are whole character cells so a DPR change never reflows (§4.2). */
export function computeLayout(opts: LayoutOptions): GridLayout {
  const charW = opts.charW
  const rowH = opts.rowH ?? ROW_H
  const headerH = opts.headerH ?? HEADER_H
  const gutterW = Math.round(2 * charW + PAD * 2)

  const channels: ChannelLayout[] = []
  let x = gutterW
  for (let c = 0; c < opts.channels; c++) {
    const fxCols = Math.max(1, Math.min(MAX_FX, opts.effectColumns[c] ?? 1))
    const fields: FieldLayout[] = []
    let fx = x + PAD
    const push = (kind: ColumnKind, chars: number, lane: number, fxIndex: number): void => {
      const w = Math.round(chars * charW + PAD)
      fields.push({ kind, fx: fxIndex, lane, x: fx, w, chars })
      fx += w + FIELD_RULE
    }
    push('note', 3, LANE_NOTE, -1)
    push('inst', 2, LANE_INST, -1)
    push('vol', 1, LANE_VOL, -1)
    for (let k = 0; k < fxCols; k++) {
      push('fxCmd', 1, LANE_FX0 + k * 2, k)
      push('fxParam', 2, LANE_FX0 + k * 2 + 1, k)
    }
    const w = fx - FIELD_RULE + PAD - x
    channels.push({ x, w, fields })
    x += w + CHANNEL_RULE
  }

  return {
    charW,
    rowH,
    headerH,
    gutterW,
    width: x - CHANNEL_RULE,
    channels,
    fontCell: opts.fontCell,
    fontMicro: opts.fontMicro,
  }
}

/** Total sub-columns in a channel — the cursor's left/right range. */
export function fieldCount(layout: GridLayout, channel: number): number {
  return layout.channels[channel]?.fields.length ?? 0
}

/* ---- interned strings ---------------------------------------------------- */

const NAMES = ['c-', 'c#', 'd-', 'd#', 'e-', 'f-', 'f#', 'g-', 'g#', 'a-', 'a#', 'b-']

/** `c-4`, `a#3` — lowercase, always three characters wide (§4.2). */
export const NOTE_TEXT: readonly string[] = buildNoteText()
function buildNoteText(): string[] {
  const out: string[] = []
  for (let n = 0; n < 120; n++) {
    const octave = Math.floor(n / 12) - 1
    out.push(`${NAMES[n % 12] as string}${octave < 0 ? '-' : octave}`)
  }
  return out
}

export const HEX2: readonly string[] = buildHex(256, 2)
export const HEX1: readonly string[] = buildHex(16, 1)
function buildHex(count: number, width: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(i.toString(16).padStart(width, '0'))
  return out
}

export const TEXT_CUT = '---'
export const TEXT_RELEASE = '==='
export const EMPTY_3 = '...'
export const EMPTY_2 = '..'
export const EMPTY_1 = '.'

/** The glyph for one lane value. Never allocates. */
export function laneText(lane: number, value: number): string {
  if (lane === LANE_NOTE) {
    if (value === NONE) return EMPTY_3
    if (value === -1) return TEXT_CUT
    if (value === -2) return TEXT_RELEASE
    return NOTE_TEXT[value] ?? EMPTY_3
  }
  if (lane === LANE_INST) return value === NONE ? EMPTY_2 : (HEX2[value & 0xff] as string)
  if (lane === LANE_VOL) return value === NONE ? EMPTY_1 : (HEX1[value & 0x0f] as string)
  // Effect lanes alternate command, param.
  if ((lane - LANE_FX0) % 2 === 0) {
    return value === NONE ? EMPTY_1 : String.fromCharCode(value).toLowerCase()
  }
  return value === NONE ? EMPTY_2 : (HEX2[value & 0xff] as string)
}

/* ---- the window the renderer draws --------------------------------------- */

export interface PatternView {
  /** Row index of `data`'s first row. */
  readonly firstRow: number
  /** How many rows `data` carries. */
  readonly rowCount: number
  readonly channels: number
  /** `data[(row * channels + channel) * LANES_PER_CHANNEL + lane]`, NONE = absent. */
  readonly data: Int32Array
  /** Rows per beat / per bar, from `meta.rowHighlight` / `rowHighlight2`. */
  readonly beat: number
  readonly bar: number
  readonly rowsPerPattern: number
}

export interface Selection {
  readonly row0: number
  readonly row1: number
  readonly channel0: number
  readonly channel1: number
}

export interface GridState {
  /** Fractional row at the top edge of the viewport — the component owns this
   *  number, never DOM scroll (§4.3). */
  readonly scrollRow: number
  readonly scrollX: number
  readonly viewportW: number
  readonly viewportH: number
  readonly cursorRow: number
  readonly cursorChannel: number
  readonly cursorField: number
  /** Which digit of a two-digit field is armed, 0 or 1. */
  readonly cursorDigit: number
  readonly editing: boolean
  readonly focused: boolean
  /** Row the driver is playing, or -1. */
  readonly playRow: number
  readonly selection: Selection | null
  readonly muted: readonly boolean[]
}

/* ---- layer A: the furniture ---------------------------------------------- */

/**
 * Channel headers, the gutter frame and the vertical rules. Painted once per
 * geometry change into an offscreen surface; §4.3's cached layer.
 */
export function drawFurniture(
  ctx: Ctx2D,
  layout: GridLayout,
  palette: GridPalette,
  labels: readonly string[],
  /** The canvas box, not the column content — a grid narrower than its host
   *  still owns the whole surface, or the unpainted remainder shows through as
   *  a black rectangle on an `alpha: false` context. */
  width: number,
  height: number,
  scrollX: number,
  muted: readonly boolean[],
): void {
  ctx.save()
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, width, height)

  // Header band and gutter column: the two pieces of chrome that never scroll
  // vertically, drawn in the alternate ground so the field reads as a surface
  // laid on the slab rather than a hole in it.
  ctx.fillStyle = palette.bgAlt
  ctx.fillRect(0, 0, width, layout.headerH)
  ctx.fillRect(0, 0, layout.gutterW, height)

  ctx.fillStyle = palette.hairline
  ctx.fillRect(0, layout.headerH - 1, width, 1)
  ctx.fillRect(layout.gutterW - 1, 0, 1, height)

  ctx.font = layout.fontMicro
  ctx.textBaseline = 'middle'
  const midY = Math.round(layout.headerH / 2)

  for (let c = 0; c < layout.channels.length; c++) {
    const ch = layout.channels[c] as ChannelLayout
    const x = ch.x - scrollX
    if (x + ch.w < layout.gutterW || x > width) continue

    // Channel group rule, 2 px (§4.2).
    if (c > 0) {
      ctx.fillStyle = palette.hairline
      ctx.fillRect(x - CHANNEL_RULE, 0, CHANNEL_RULE, height)
    }
    // Field rules, 1 px.
    ctx.fillStyle = palette.hairline
    for (let f = 0; f < ch.fields.length - 1; f++) {
      const fl = ch.fields[f] as FieldLayout
      ctx.fillRect(fl.x + fl.w - scrollX, layout.headerH, FIELD_RULE, height - layout.headerH)
    }

    ctx.fillStyle = muted[c] === true ? palette.inkMuted : palette.ink
    ctx.fillText(labels[c] ?? '', x + PAD, midY)
  }

  ctx.restore()
}

/* ---- layer B: the live rows ---------------------------------------------- */

/**
 * Bands, cells, selection, playhead, cursor. Draws only
 * `[firstVisible - 2, lastVisible + 2]` (§4.3's row virtualization) — the
 * caller supplies exactly that window in `view`.
 */
export function drawRows(
  ctx: Ctx2D,
  layout: GridLayout,
  palette: GridPalette,
  view: PatternView,
  state: GridState,
): void {
  const rowH = layout.rowH
  const top = layout.headerH
  const gutter = layout.gutterW
  const bodyH = state.viewportH - top
  const totalW = state.viewportW

  ctx.save()
  ctx.textBaseline = 'middle'

  const yOf = (row: number): number => top + Math.round((row - state.scrollRow) * rowH)

  // --- highlight bands: neutral luminance steps, never colour (§4.2) --------
  for (let i = 0; i < view.rowCount; i++) {
    const row = view.firstRow + i
    const y = yOf(row)
    if (y + rowH < top || y > state.viewportH) continue
    const band =
      view.bar > 0 && row % view.bar === 0
        ? palette.bgBar
        : view.beat > 0 && row % view.beat === 0
          ? palette.bgBeat
          : null
    if (band !== null) {
      ctx.fillStyle = band
      ctx.fillRect(gutter, y, totalW - gutter, rowH)
    }
  }

  // --- selection ------------------------------------------------------------
  const sel = state.selection
  if (sel !== null) {
    ctx.fillStyle = palette.selection
    const y0 = yOf(sel.row0)
    const h = (sel.row1 - sel.row0 + 1) * rowH
    for (let c = sel.channel0; c <= sel.channel1; c++) {
      const ch = layout.channels[c]
      if (ch === undefined) continue
      ctx.fillRect(ch.x - state.scrollX, y0, ch.w, h)
    }
  }

  // --- playhead: the one accent on this surface, with the cursor (§4.2) -----
  if (state.playRow >= 0) {
    const y = yOf(state.playRow)
    ctx.globalAlpha = 0.14
    ctx.fillStyle = palette.accent
    ctx.fillRect(gutter, y, totalW - gutter, rowH)
    ctx.globalAlpha = 1
    ctx.fillRect(gutter, y, totalW - gutter, 2)
  }

  // --- row numbers ----------------------------------------------------------
  ctx.font = layout.fontMicro
  ctx.fillStyle = palette.inkDim
  for (let i = 0; i < view.rowCount; i++) {
    const row = view.firstRow + i
    const y = yOf(row)
    if (y + rowH < top || y > state.viewportH) continue
    ctx.fillText(HEX2[row & 0xff] as string, PAD, y + rowH / 2)
  }

  // --- cells, in three colour passes ---------------------------------------
  ctx.font = layout.fontCell
  const stride = view.channels * LANES_PER_CHANNEL
  for (let pass = 0; pass < 3; pass++) {
    ctx.fillStyle = pass === 0 ? palette.inkMuted : pass === 1 ? palette.ink : palette.inkDim
    for (let i = 0; i < view.rowCount; i++) {
      const row = view.firstRow + i
      const y = yOf(row)
      if (y + rowH < top || y > state.viewportH) continue
      const cy = y + rowH / 2
      const base = i * stride
      for (let c = 0; c < layout.channels.length; c++) {
        const ch = layout.channels[c] as ChannelLayout
        const chX = ch.x - state.scrollX
        if (chX + ch.w < gutter || chX > totalW) continue
        const lanes = base + c * LANES_PER_CHANNEL
        for (let f = 0; f < ch.fields.length; f++) {
          const fl = ch.fields[f] as FieldLayout
          const value = view.data[lanes + fl.lane] as number
          const empty = value === NONE
          // pass 0 = the empty marks, 1 = notes, 2 = parameters.
          const want = empty ? 0 : fl.lane === LANE_NOTE ? 1 : 2
          if (want !== pass) continue
          ctx.fillText(laneText(fl.lane, value), fl.x - state.scrollX + 2, cy)
        }
      }
    }
  }

  // --- cursor: filled block while editing, hollow while not ----------------
  const cur = layout.channels[state.cursorChannel]
  const field = cur?.fields[state.cursorField]
  if (cur !== undefined && field !== undefined) {
    const y = yOf(state.cursorRow)
    const x = field.x - state.scrollX
    ctx.fillStyle = state.focused ? palette.accent : palette.inkDim
    if (state.editing) {
      ctx.fillRect(x, y, field.w, rowH)
      // Redraw the glyph knocked out of the block, so the value under the
      // cursor stays readable — white on blue is 5.9:1.
      const i = state.cursorRow - view.firstRow
      if (i >= 0 && i < view.rowCount) {
        const value = view.data[
          i * stride + state.cursorChannel * LANES_PER_CHANNEL + field.lane
        ] as number
        ctx.fillStyle = palette.bg
        ctx.fillText(laneText(field.lane, value), x + 2, y + rowH / 2)
      }
      // The armed digit of a two-digit field, as an underscore under it.
      if (field.chars > 1 && state.cursorDigit > 0) {
        ctx.fillStyle = palette.bg
        ctx.fillRect(x + 2 + state.cursorDigit * layout.charW, y + rowH - 4, layout.charW, 2)
      }
    } else {
      ctx.fillRect(x, y, field.w, 1)
      ctx.fillRect(x, y + rowH - 1, field.w, 1)
      ctx.fillRect(x, y, 1, rowH)
      ctx.fillRect(x + field.w - 1, y, 1, rowH)
    }
  }

  // --- focus ring, matching --focus's double ring --------------------------
  if (state.focused) {
    ctx.fillStyle = palette.focus
    ctx.fillRect(0, 0, totalW, 2)
    ctx.fillRect(0, state.viewportH - 2, totalW, 2)
    ctx.fillRect(0, 0, 2, state.viewportH)
    ctx.fillRect(totalW - 2, 0, 2, state.viewportH)
  }

  ctx.restore()
  void bodyH
}

/* ---- hit testing (pointer -> cursor) ------------------------------------- */

export interface HitResult {
  readonly row: number
  readonly channel: number
  readonly field: number
}

export function hitTest(
  layout: GridLayout,
  state: { scrollRow: number; scrollX: number },
  x: number,
  y: number,
): HitResult | null {
  if (y < layout.headerH) return null
  const row = Math.floor((y - layout.headerH) / layout.rowH + state.scrollRow)
  const px = x + state.scrollX
  for (let c = 0; c < layout.channels.length; c++) {
    const ch = layout.channels[c] as ChannelLayout
    if (px < ch.x || px > ch.x + ch.w) continue
    for (let f = ch.fields.length - 1; f >= 0; f--) {
      const fl = ch.fields[f] as FieldLayout
      if (px >= fl.x) return { row, channel: c, field: f }
    }
    return { row, channel: c, field: 0 }
  }
  return null
}
