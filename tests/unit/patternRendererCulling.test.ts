/** Vertical culling of the selection and playhead rects (code-review fix).
 *
 *  Bands, row numbers and cells all cull against [headerH, viewportH]
 *  (`if (y + rowH < top || y > state.viewportH) continue`); the selection and
 *  playhead did not, so once the selection's top row (or, follow off, the play
 *  row) scrolled above the viewport, yOf() went negative and the rect painted
 *  over the channel-header band — the furniture is blitted first and drawRows
 *  runs with no clip region, so the channel labels were covered. These tests
 *  pin the repaired discipline: dropped when wholly outside, clipped — never
 *  dropped — when straddling, pixel-exact while fully visible.
 *
 *  The shim is the bench's CountingCtx grown a memory: every fillRect recorded
 *  with the fillStyle in force, so the selection (palette.selection) and
 *  playhead (palette.accent) rects can be read out of a full repaint. The
 *  cursor is parked on a visible row, unfocused (inkDim) and not editing, so
 *  its frame cannot masquerade as either layer under test.
 *
 *  Anti-vacuity: the drop/clip cases all fail against the uncullled renderer
 *  (rects painted at negative y, or past the viewport bottom), and a renderer
 *  that culled everything would fail the clip and pixel-exact cases.
 *
 *  The edit cursor got the same repair (it painted its block/outline over the
 *  header when follow scrolled it off the top): pinned below with the cursor
 *  as the layer under test — unfocused, so it paints inkDim, with the
 *  selection empty and the playhead off, so no other rect uses that style.
 */
import { describe, expect, it } from 'vitest'
import {
  computeLayout,
  drawRows,
  HEADER_H,
  LANES_PER_CHANNEL,
  NONE,
  ROW_H,
  type Ctx2D,
  type GridLayout,
  type GridPalette,
  type GridState,
  type PatternView,
  type Selection,
  type TextMetricsLike,
} from '../../src/ui/canvas/patternRenderer'

const CHAR_W = 7.2
const CHANNELS = 2
const ROWS_PER_PATTERN = 64
const VIEWPORT_H = HEADER_H + 10 * ROW_H // 202

interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly style: unknown
}

class RecordingCtx implements Ctx2D {
  fillStyle: unknown = '#000'
  font = ''
  textBaseline = ''
  globalAlpha = 1
  readonly rects: Rect[] = []

  fillRect(x: number, y: number, w: number, h: number): void {
    this.rects.push({ x, y, w, h, style: this.fillStyle })
  }

  fillText(): void {
    /* glyphs are not under test here */
  }

  measureText(text: string): TextMetricsLike {
    return { width: text.length * CHAR_W }
  }

  save(): void {}
  restore(): void {}
}

const PALETTE: GridPalette = {
  bg: '#ffffff',
  bgAlt: '#f2f2f2',
  bgBeat: '#ebebeb',
  bgBar: '#dcdcdc',
  ink: '#181818',
  inkDim: '#484848',
  inkMuted: '#949494',
  accent: '#1270b8',
  selection: '#d8e7f4',
  hairline: '#bdbdbd',
  focus: '#1270b8',
}

const LAYOUT: GridLayout = computeLayout({
  charW: CHAR_W,
  channels: CHANNELS,
  effectColumns: [1, 1],
  rowH: ROW_H,
  headerH: HEADER_H,
  fontCell: "400 12px 'JetBrains Mono Variable', monospace",
  fontMicro: "600 9px 'JetBrains Mono Variable', monospace",
})

const VIEW: PatternView = {
  firstRow: 0,
  rowCount: ROWS_PER_PATTERN,
  channels: CHANNELS,
  data: new Int32Array(ROWS_PER_PATTERN * CHANNELS * LANES_PER_CHANNEL).fill(NONE),
  beat: 4,
  bar: 16,
  rowsPerPattern: ROWS_PER_PATTERN,
}

function repaint(scrollRow: number, selection: Selection | null, playRow: number): RecordingCtx {
  const ctx = new RecordingCtx()
  const state: GridState = {
    scrollRow,
    scrollX: 0,
    viewportW: LAYOUT.width,
    viewportH: VIEWPORT_H,
    // First fully visible row: the cursor keeps its own (separate) culling
    // story out of these assertions by staying inside the viewport.
    cursorRow: Math.ceil(scrollRow),
    cursorChannel: 0,
    cursorField: 0,
    cursorDigit: 0,
    editing: false,
    focused: false,
    playRow,
    selection,
    muted: [false, false],
  }
  drawRows(ctx, LAYOUT, PALETTE, VIEW, state)
  return ctx
}

/** `[y, h]` of every rect drawn in the given style, in paint order. */
function spans(ctx: RecordingCtx, style: string): [number, number][] {
  return ctx.rects.filter((r) => r.style === style).map((r) => [r.y, r.h])
}

describe('drawRows selection culling', () => {
  it('drops a selection scrolled wholly above the viewport', () => {
    // yOf(2) = -302 at scrollRow 20; the uncullled renderer painted it there,
    // straight over the header band.
    const ctx = repaint(20, { row0: 2, row1: 5, channel0: 0, channel1: 1 }, -1)
    expect(spans(ctx, PALETTE.selection)).toEqual([])
  })

  it('drops a selection scrolled wholly below the viewport', () => {
    const ctx = repaint(6, { row0: 30, row1: 32, channel0: 0, channel1: 1 }, -1)
    expect(spans(ctx, PALETTE.selection)).toEqual([])
  })

  it('clips, not drops, a selection straddling the header edge', () => {
    // yOf(4) = -14 at scrollRow 6, bottom at 76: visible part is [22, 76).
    const ctx = repaint(6, { row0: 4, row1: 8, channel0: 0, channel1: 1 }, -1)
    expect(spans(ctx, PALETTE.selection)).toEqual([
      [HEADER_H, 54],
      [HEADER_H, 54],
    ])
  })

  it('clips a selection straddling the viewport bottom', () => {
    // yOf(14) = 166 at scrollRow 6, bottom at 256: visible part is [166, 202).
    const ctx = repaint(6, { row0: 14, row1: 18, channel0: 0, channel1: 1 }, -1)
    expect(spans(ctx, PALETTE.selection)).toEqual([
      [166, 36],
      [166, 36],
    ])
  })

  it('leaves a fully visible selection pixel-exact', () => {
    const ctx = repaint(6, { row0: 8, row1: 10, channel0: 0, channel1: 1 }, -1)
    expect(spans(ctx, PALETTE.selection)).toEqual([
      [58, 54],
      [58, 54],
    ])
  })
})

describe('drawRows playhead culling', () => {
  it('drops a playhead scrolled wholly above the viewport', () => {
    const ctx = repaint(6, null, 1) // yOf(1) = -68
    expect(spans(ctx, PALETTE.accent)).toEqual([])
  })

  it('drops a playhead scrolled wholly below the viewport', () => {
    const ctx = repaint(6, null, 30) // yOf(30) = 454
    expect(spans(ctx, PALETTE.accent)).toEqual([])
  })

  it('clips, not drops, a playhead straddling the header edge', () => {
    // Fractional scroll is the only way a one-row rect straddles: yOf(6) = 13
    // at scrollRow 6.5, bottom at 31 — visible part [22, 31), and the 2 px
    // top-edge line is scrolled under the header, so it must not paint.
    const ctx = repaint(6.5, null, 6)
    expect(spans(ctx, PALETTE.accent)).toEqual([[HEADER_H, 9]])
  })

  it('leaves a fully visible playhead pixel-exact', () => {
    const ctx = repaint(6, null, 8) // yOf(8) = 58
    expect(spans(ctx, PALETTE.accent)).toEqual([
      [58, ROW_H],
      [58, 2],
    ])
  })
})

/** Repaint with the cursor as the layer under test (unfocused → inkDim). */
function repaintCursor(scrollRow: number, cursorRow: number, editing: boolean): RecordingCtx {
  const ctx = new RecordingCtx()
  const state: GridState = {
    scrollRow,
    scrollX: 0,
    viewportW: LAYOUT.width,
    viewportH: VIEWPORT_H,
    cursorRow,
    cursorChannel: 0,
    cursorField: 0,
    cursorDigit: 0,
    editing,
    focused: false,
    playRow: -1,
    selection: null,
    muted: [false, false],
  }
  drawRows(ctx, LAYOUT, PALETTE, VIEW, state)
  return ctx
}

describe('drawRows cursor culling', () => {
  it('drops a cursor scrolled wholly above the viewport', () => {
    // yOf(2) = -302 at scrollRow 20; the unguarded renderer painted the
    // outline there, straight over the header band.
    expect(spans(repaintCursor(20, 2, false), PALETTE.inkDim)).toEqual([])
  })

  it('drops a cursor scrolled wholly below the viewport', () => {
    expect(spans(repaintCursor(6, 30, false), PALETTE.inkDim)).toEqual([]) // yOf(30) = 454
  })

  it('clips, not drops, a hollow cursor straddling the header edge', () => {
    // Fractional scroll is the only straddle: yOf(6) = 13 at scrollRow 6.5 —
    // the top edge line is under the header and must not paint, the bottom
    // edge sits at 30, and the side bars clip to [22, 31).
    expect(spans(repaintCursor(6.5, 6, false), PALETTE.inkDim)).toEqual([
      [30, 1],
      [HEADER_H, 9],
      [HEADER_H, 9],
    ])
  })

  it('leaves a fully visible hollow cursor pixel-exact', () => {
    expect(spans(repaintCursor(6, 8, false), PALETTE.inkDim)).toEqual([
      [58, 1],
      [75, 1],
      [58, ROW_H],
      [58, ROW_H],
    ])
  })

  it('clips, not drops, an editing block straddling the header edge', () => {
    // yOf(6) = 13 at scrollRow 6.5: the block clips to [22, 31).
    expect(spans(repaintCursor(6.5, 6, true), PALETTE.inkDim)).toEqual([[HEADER_H, 9]])
  })

  it('leaves a fully visible editing block pixel-exact', () => {
    expect(spans(repaintCursor(6, 8, true), PALETTE.inkDim)).toEqual([[58, ROW_H]])
  })
})
