/* pulsar — the boot sequence (plan C1 signature moment, C9 boot page).
 *
 * The one piece of choreography in the product. Everything else on the page is
 * still, which is what makes this land.
 *
 *   0     380ms   raster scan: the unlit lattice paints itself row by row, an
 *                 amber beam riding the leading edge. 64 rows, ~6ms each.
 *   380   520ms   the boot art resolves onto the lattice it just laid down —
 *                 dot by dot, in a fixed hash order, never a fade.
 *   520  1220ms   hold.
 *  1220  1540ms   dot dissolve: the art leaves in the same hash order while the
 *                 parameter page arrives underneath it.
 *  1540    ...    `press any key`.
 *
 * The first keydown dismisses the sequence AND is the user gesture that starts
 * audio — see input/keyboard.ts. Dismissal is accepted at any point, not just
 * at the end.
 *
 * prefers-reduced-motion: no scan, no dissolve. The art paints in one frame,
 * holds, and cuts to `press any key`. Nothing is lost but the theatre.
 *
 * MANDATORY FALLBACK: if src/assets/boot/boot-128x64.png is absent or fails to
 * decode, the `pulsar` wordmark is drawn in the 5x7 face at 3x on the lattice.
 * The app must boot with src/assets/ deleted — that is a checkable invariant,
 * which is why the art is loaded through import.meta.glob (an empty glob is a
 * legal state, a missing static import is a build error).
 */

import { CANVAS_DUR, LATTICE, SCREEN } from '../../design/tokens'
import { motion } from '../../state/motion.svelte'
import type { DotMatrix } from './dotMatrix'
import { GLYPH_H, forEachTextDot, textWidth } from './font5x7'
import { forEachGlyph8Dot, GLYPH8 } from './glyphs8'

export type BootPhase = 'scan' | 'resolve' | 'hold' | 'dissolve' | 'ready' | 'done'

const T_SCAN = CANVAS_DUR.scan
const T_RESOLVE = T_SCAN + CANVAS_DUR.resolve
const T_HOLD = T_RESOLVE + CANVAS_DUR.hold
const T_DISSOLVE = T_HOLD + CANVAS_DUR.dissolve

const PROMPT = 'press any key'
const WORDMARK = 'pulsar'
const WORDMARK_SCALE = 3

/** Lit dots of the decoded boot art, packed as cell index + colour index. */
interface BootArt {
  cells: Int32Array
  colorOf: Uint8Array
  colors: string[]
  count: number
}

/** Fixed-order pseudo-random per cell, so resolve and dissolve are stable
 *  across frames and across reloads without storing a shuffle. */
function cellHash(cell: number): number {
  let h = Math.imul(cell ^ 0x9e3779b9, 2654435761)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export interface BootSequence {
  readonly phase: BootPhase
  /** Resolves once the sequence reaches `press any key`. */
  readonly ready: Promise<void>
  /** Called by the first keydown. Safe at any phase, idempotent. */
  dismiss(): void
  /** One frame. `underlay` draws the page the sequence dissolves into. */
  render(dm: DotMatrix, now: number, underlay: (dm: DotMatrix) => void): void
  /** True once dismissed — the Screen stops calling render. */
  readonly done: boolean
  /** For the status copy: did the generated art load, or are we on the
   *  wordmark? Reported, never apologised for. */
  readonly usingArt: boolean
}

class Boot implements BootSequence {
  #phase: BootPhase = 'scan'
  #t0 = 0
  #art: BootArt | null = null
  #resolveReady!: () => void
  readonly ready: Promise<void>

  constructor() {
    this.ready = new Promise<void>((res) => {
      this.#resolveReady = res
    })
    void this.#loadArt()
  }

  get phase(): BootPhase {
    return this.#phase
  }
  get done(): boolean {
    return this.#phase === 'done'
  }
  get usingArt(): boolean {
    return this.#art !== null
  }

  dismiss(): void {
    if (this.#phase === 'done') return
    this.#phase = 'done'
    this.#resolveReady()
  }

  render(dm: DotMatrix, now: number, underlay: (dm: DotMatrix) => void): void {
    if (this.#t0 === 0) this.#t0 = now
    const t = now - this.#t0
    const reduced = motion.reduced

    // Reduced motion: paint once, hold, cut to the prompt. No scan, no dissolve.
    if (reduced) {
      dm.beginFrame()
      if (t < CANVAS_DUR.hold) {
        this.#phase = 'hold'
        this.#drawArt(dm, 1)
      } else {
        this.#enterReady()
        underlay(dm)
        this.#drawPrompt(dm, now, false)
      }
      dm.endFrame()
      return
    }

    if (t < T_SCAN) {
      this.#phase = 'scan'
      const rows = Math.min(LATTICE.rows, Math.floor((t / T_SCAN) * LATTICE.rows) + 1)
      dm.beginFrame(rows)
      // The beam: one amber row at the leading edge. The only moving light.
      const head = rows - 1
      for (let c = 0; c < LATTICE.cols; c++) dm.set(c, head, SCREEN.accent)
      dm.endFrame()
      return
    }

    dm.beginFrame()

    if (t < T_RESOLVE) {
      this.#phase = 'resolve'
      this.#drawArt(dm, (t - T_SCAN) / CANVAS_DUR.resolve)
    } else if (t < T_HOLD) {
      this.#phase = 'hold'
      this.#drawArt(dm, 1)
    } else if (t < T_DISSOLVE) {
      this.#phase = 'dissolve'
      const p = (t - T_HOLD) / CANVAS_DUR.dissolve
      underlay(dm)
      this.#drawArt(dm, 1 - p)
      this.#drawPrompt(dm, now, p < 0.6)
    } else {
      this.#enterReady()
      underlay(dm)
      this.#drawPrompt(dm, now, false)
    }

    dm.endFrame()
  }

  #enterReady(): void {
    if (this.#phase === 'ready' || this.#phase === 'done') return
    this.#phase = 'ready'
    this.#resolveReady()
  }

  /** `amount` 0..1 — the fraction of dots present, chosen by cellHash so the
   *  same dots always arrive (and leave) in the same order. */
  #drawArt(dm: DotMatrix, amount: number): void {
    if (amount <= 0) return
    const art = this.#art
    if (art) {
      for (let i = 0; i < art.count; i++) {
        const cell = art.cells[i] as number
        if (amount < 1 && cellHash(cell) > amount) continue
        const col = cell % LATTICE.cols
        const row = (cell - col) / LATTICE.cols
        dm.set(col, row, art.colors[art.colorOf[i] as number] as string)
      }
      return
    }
    this.#drawWordmark(dm, amount)
  }

  /** The fallback, and it has to be good: the emblem at 2x over the wordmark at
   *  3x, both on the same lattice as everything else. */
  #drawWordmark(dm: DotMatrix, amount: number): void {
    const markW = textWidth(WORDMARK) * WORDMARK_SCALE
    const markX = Math.round((LATTICE.cols - markW) / 2)
    const markY = 30

    const emblemW = GLYPH8 * 2
    const emblemX = Math.round((LATTICE.cols - emblemW) / 2)
    const emblemY = 12

    const plot = (col: number, row: number): void => {
      const cell = row * LATTICE.cols + col
      if (amount < 1 && cellHash(cell) > amount) return
      dm.set(col, row, SCREEN.ink)
    }

    forEachGlyph8Dot('beacon', 0, 0, (gx, gy) => {
      for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) plot(emblemX + gx * 2 + x, emblemY + gy * 2 + y)
      }
    })

    forEachTextDot(WORDMARK, 0, 0, (gx, gy) => {
      for (let y = 0; y < WORDMARK_SCALE; y++) {
        for (let x = 0; x < WORDMARK_SCALE; x++) {
          plot(markX + gx * WORDMARK_SCALE + x, markY + gy * WORDMARK_SCALE + y)
        }
      }
    })

    // A hairline rule under the wordmark, at the same width. Structure, not
    // decoration: it is the width the art would have occupied.
    const ruleY = markY + GLYPH_H * WORDMARK_SCALE + 3
    for (let i = 0; i < markW; i++) {
      const cell = ruleY * LATTICE.cols + markX + i
      if (amount < 1 && cellHash(cell) > amount) continue
      dm.set(markX + i, ruleY, SCREEN.dim)
    }
  }

  /** The prompt sits in a cleared band at the foot of the lattice. It has to
   *  clear, not overlay: the underlay page owns that band too, and a prompt
   *  printed through a status line is unreadable on a dot matrix. */
  #drawPrompt(dm: DotMatrix, now: number, dim: boolean): void {
    const top = LATTICE.rows - GLYPH_H - 2
    for (let y = top - 1; y < LATTICE.rows; y++) {
      for (let x = 0; x < LATTICE.cols; x++) dm.set(x, y, SCREEN.bg)
    }

    // A slow 1 Hz blink while waiting. Decorative, so reduced motion pins it lit.
    const lit = motion.reduced || dim || now % 1000 < 620
    if (!lit) return
    const x = Math.round((LATTICE.cols - textWidth(PROMPT)) / 2)
    dm.text(PROMPT, x, top, dim ? SCREEN.dim : SCREEN.accent)
  }

  /** import.meta.glob, not a static import: src/assets is owned by another work
   *  package and may legitimately not exist. An empty glob is a legal state. */
  async #loadArt(): Promise<void> {
    try {
      const mods = import.meta.glob('../../assets/boot/boot-128x64.png', {
        query: '?url',
        import: 'default',
      }) as Record<string, () => Promise<string>>
      const loader = Object.values(mods)[0]
      if (!loader) return
      const url = await loader()
      const img = new Image()
      img.decoding = 'async'
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('boot art decode failed'))
        img.src = url
      })
      this.#art = rasterise(img)
    } catch {
      this.#art = null // wordmark it is
    }
  }
}

/** Decode 128x64 art into lattice dots: one source pixel becomes one lit dot,
 *  so the art wears the same grid (and the same 1-dot gap) as the glyphs. */
function rasterise(img: HTMLImageElement): BootArt | null {
  const c = document.createElement('canvas')
  c.width = LATTICE.cols
  c.height = LATTICE.rows
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, LATTICE.cols, LATTICE.rows)
  const data = ctx.getImageData(0, 0, LATTICE.cols, LATTICE.rows).data

  const cells = new Int32Array(LATTICE.cols * LATTICE.rows)
  const colorOf = new Uint8Array(LATTICE.cols * LATTICE.rows)
  const colors: string[] = []
  const index = new Map<number, number>()
  let count = 0

  for (let cell = 0; cell < LATTICE.cols * LATTICE.rows; cell++) {
    const o = cell * 4
    const a = data[o + 3] as number
    if (a < 16) continue
    const r = data[o] as number
    const g = data[o + 1] as number
    const b = data[o + 2] as number
    // Near-black is the unlit background of the art, not a lit dot.
    if (r + g + b < 36) continue
    const key = (r << 16) | (g << 8) | b
    let ci = index.get(key)
    if (ci === undefined) {
      ci = colors.length
      colors.push(`#${key.toString(16).padStart(6, '0')}`)
      index.set(key, ci)
    }
    cells[count] = cell
    colorOf[count] = ci
    count++
  }
  return count === 0 ? null : { cells, colorOf, colors, count }
}

export function createBootSequence(): BootSequence {
  return new Boot()
}
