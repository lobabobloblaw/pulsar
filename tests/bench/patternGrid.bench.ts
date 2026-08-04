/** Full-repaint cost of the pattern grid, against design §4.3's budget.
 *
 *  The gate is the 60 fps acceptance item (plan-file Phase-2 (e), design §6.4):
 *  **p99 ≤ 4 ms for a full repaint at 8 channels × 40 visible rows**. 4 ms is a
 *  quarter of a 16.7 ms frame, which is the room a canvas may take while the
 *  main-thread tracker driver also has to run (§2.1).
 *
 *  Measured against a headless 2D context shim, exactly as §4.3 specifies —
 *  node has no canvas. What that DOES measure honestly: the per-cell work, the
 *  virtualization window, the three-pass colour batching, and the fact that the
 *  renderer allocates nothing per repaint (every glyph string is interned at
 *  module load). What it CANNOT measure is Chrome's own `fillText` cost; that
 *  half is measured in the browser, over CDP, as frame times while scrolling
 *  and editing.
 *
 *  Anti-vacuity, because Phase 1 set that standard: a renderer that drew
 *  nothing would post a superb p99. So the gate also asserts the repaint really
 *  issues the glyph runs and rectangles it claims to — the counts are printed
 *  next to the timings, and the design's own estimate ("~1 700 fillText glyph
 *  runs worst case") is what they are read against.
 *
 *  The percentile table is computed at module scope: vitest 4 does not run
 *  `beforeAll`/`afterAll` in benchmark mode, and the p99 of a repaint is the
 *  number a frame budget cares about — not tinybench's mean over a batch.
 */
import { bench, describe } from 'vitest'
import {
  computeLayout,
  drawFurniture,
  drawRows,
  LANES_PER_CHANNEL,
  LANE_FX0,
  LANE_INST,
  LANE_NOTE,
  LANE_VOL,
  NONE,
  type Ctx2D,
  type GridLayout,
  type GridPalette,
  type PatternView,
  type TextMetricsLike,
} from '../../src/ui/canvas/patternRenderer'

/** design §6.4: p99 ≤ 4 ms at 8 channels × 40 visible rows. */
const BUDGET_MS = 4
const CHANNELS = 8
const VISIBLE_ROWS = 40
const ROWS_PER_PATTERN = 64
const ROW_H = 18
const HEADER_H = 22
const CHAR_W = 7.2

/** Counts every call and touches every argument, so nothing here can be
 *  optimised away and the anti-vacuity assertions have something to read. */
class CountingCtx implements Ctx2D {
  fillStyle: unknown = '#000'
  font = ''
  textBaseline = ''
  globalAlpha = 1
  fillTextCalls = 0
  fillRectCalls = 0
  glyphs = 0
  /** Consumes every argument. Never inspected — it exists to defeat DCE. */
  sink = 0

  fillRect(x: number, y: number, w: number, h: number): void {
    this.fillRectCalls++
    this.sink += x + y + w + h
  }

  fillText(text: string, x: number, y: number): void {
    this.fillTextCalls++
    this.glyphs += text.length
    this.sink += text.charCodeAt(0) + x + y
  }

  measureText(text: string): TextMetricsLike {
    return { width: text.length * CHAR_W }
  }

  save(): void {
    this.sink++
  }

  restore(): void {
    this.sink++
  }

  reset(): void {
    this.fillTextCalls = 0
    this.fillRectCalls = 0
    this.glyphs = 0
  }
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

function layoutFor(effectColumns: number): GridLayout {
  return computeLayout({
    charW: CHAR_W,
    channels: CHANNELS,
    effectColumns: new Array<number>(CHANNELS).fill(effectColumns),
    rowH: ROW_H,
    headerH: HEADER_H,
    fontCell: "400 12px 'JetBrains Mono Variable', monospace",
    fontMicro: "600 9px 'JetBrains Mono Variable', monospace",
  })
}

/** A pattern with the density of real music: a note on ~45 % of rows in the
 *  melodic lanes, most rows in the drum lane, instruments and volumes where a
 *  tracker would actually put them, and an effect on every fourth event. */
function fillData(rows: number, fxCols: number): Int32Array {
  const data = new Int32Array(rows * CHANNELS * LANES_PER_CHANNEL).fill(NONE)
  let seed = 0x2a03
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < CHANNELS; c++) {
      const dense = c === 3
      if (rnd() > (dense ? 0.75 : 0.45)) continue
      const base = (r * CHANNELS + c) * LANES_PER_CHANNEL
      data[base + LANE_NOTE] = 24 + Math.floor(rnd() * 84)
      if (rnd() > 0.5) data[base + LANE_INST] = Math.floor(rnd() * 16)
      if (rnd() > 0.6) data[base + LANE_VOL] = Math.floor(rnd() * 16)
      for (let k = 0; k < fxCols; k++) {
        if (rnd() > 0.25) continue
        data[base + LANE_FX0 + k * 2] = 0x30 + Math.floor(rnd() * 10)
        data[base + LANE_FX0 + k * 2 + 1] = Math.floor(rnd() * 256)
      }
    }
  }
  return data
}

interface Scenario {
  name: string
  gated: boolean
  fxCols: number
}

const SCENARIOS: Scenario[] = [
  { name: '8 channels x 40 rows, 1 effect column (the gate)', gated: true, fxCols: 1 },
  { name: '8 channels x 40 rows, 4 effect columns (ceiling)', gated: false, fxCols: 4 },
]

interface Rig {
  ctx: CountingCtx
  layout: GridLayout
  view: PatternView
  repaint(scrollRow: number): void
}

function rig(scenario: Scenario): Rig {
  const ctx = new CountingCtx()
  const layout = layoutFor(scenario.fxCols)
  const view: PatternView = {
    firstRow: 0,
    rowCount: VISIBLE_ROWS + 4,
    channels: CHANNELS,
    data: fillData(VISIBLE_ROWS + 4, scenario.fxCols),
    beat: 4,
    bar: 16,
    rowsPerPattern: ROWS_PER_PATTERN,
  }
  const muted = new Array<boolean>(CHANNELS).fill(false)
  const labels = ['pulse 1', 'pulse 2', 'triangle', 'noise', 'dpcm', 'vrc6 a', 'vrc6 b', 'saw']
  const viewportH = HEADER_H + VISIBLE_ROWS * ROW_H

  return {
    ctx,
    layout,
    view,
    /** One frame's worth of work: the furniture blit is a drawImage the
     *  component owns, so a full repaint here is the furniture pass plus the
     *  live pass — the pessimistic reading, since the furniture is cached. */
    repaint(scrollRow: number): void {
      drawFurniture(ctx, layout, PALETTE, labels, layout.width + layout.gutterW, viewportH, 0, muted)
      drawRows(ctx, layout, PALETTE, view, {
        scrollRow,
        scrollX: 0,
        viewportW: layout.width + layout.gutterW,
        viewportH,
        cursorRow: 12,
        cursorChannel: 2,
        cursorField: 0,
        cursorDigit: 0,
        editing: true,
        focused: true,
        playRow: 20,
        selection: { row0: 8, row1: 20, channel0: 1, channel1: 3 },
        muted,
      })
    },
  }
}

interface Measurement {
  name: string
  gated: boolean
  mean: number
  p50: number
  p99: number
  max: number
  fillTexts: number
  fillRects: number
  glyphs: number
}

function measure(scenario: Scenario, repaints: number, warmup = 500): Measurement {
  const r = rig(scenario)
  for (let i = 0; i < warmup; i++) r.repaint(i % 4)
  r.ctx.reset()
  const times = new Float64Array(repaints)
  for (let i = 0; i < repaints; i++) {
    const t0 = performance.now()
    // A fractional scroll offset every frame: the scrolling case is the one the
    // acceptance item names, and it is the one that cannot reuse anything.
    r.repaint((i % 24) + (i % 7) / 7)
    times[i] = performance.now() - t0
  }
  const sorted = Float64Array.from(times).sort()
  let sum = 0
  for (let i = 0; i < repaints; i++) sum += times[i] as number
  return {
    name: scenario.name,
    gated: scenario.gated,
    mean: sum / repaints,
    p50: sorted[Math.floor(repaints * 0.5)] as number,
    p99: sorted[Math.floor(repaints * 0.99)] as number,
    max: sorted[repaints - 1] as number,
    fillTexts: r.ctx.fillTextCalls / repaints,
    fillRects: r.ctx.fillRectCalls / repaints,
    glyphs: r.ctx.glyphs / repaints,
  }
}

function report(): void {
  const rows = SCENARIOS.map((s) => measure(s, 2000))
  const pad = (s: string, n: number): string => s.padEnd(n)
  const num = (v: number, n = 9): string => v.toFixed(3).padStart(n)
  const lines: string[] = ['']
  lines.push(
    `ms per full repaint at ${CHANNELS} channels x ${VISIBLE_ROWS} rows — gate ${BUDGET_MS} ms (p99)`,
  )
  lines.push(
    `${pad('scenario', 52)}${pad('mean', 11)}${pad('p50', 11)}${pad('p99', 11)}${pad('max', 11)}${pad('fillText', 11)}${pad('fillRect', 11)}glyphs`,
  )
  const failures: string[] = []
  for (const r of rows) {
    lines.push(
      `${pad(r.name, 52)}${num(r.mean)}  ${num(r.p50)}  ${num(r.p99)}  ${num(r.max)}  ${num(r.fillTexts)}  ${num(r.fillRects)}  ${num(r.glyphs)}`,
    )
    if (r.gated && r.p99 > BUDGET_MS) {
      failures.push(`"${r.name}" p99 ${r.p99.toFixed(3)} ms > ${BUDGET_MS} ms`)
    }
    // Anti-vacuity: a repaint that drew nothing would be the fastest of all.
    // 8 channels x 40 rows x (note + inst + vol + fx) is ~1 280 fields, plus
    // 40 row numbers; the floor below is half of the sparse case.
    if (r.gated && r.fillTexts < 600) {
      failures.push(`"${r.name}" drew only ${r.fillTexts.toFixed(0)} glyph runs — not a repaint`)
    }
    if (r.gated && r.fillRects < 40) {
      failures.push(`"${r.name}" drew only ${r.fillRects.toFixed(0)} rects — no bands or cursor`)
    }
  }
  lines.push('')
  console.log(lines.join('\n'))
  if (failures.length > 0) throw new Error(`pattern grid repaint budget: ${failures.join('; ')}`)
}

report()

describe('pattern grid full repaint', () => {
  for (const scenario of SCENARIOS) {
    const r = rig(scenario)
    for (let i = 0; i < 200; i++) r.repaint(i % 4)
    let n = 0
    bench(scenario.name, () => {
      r.repaint((n++ % 24) + 0.5)
    })
  }
})
