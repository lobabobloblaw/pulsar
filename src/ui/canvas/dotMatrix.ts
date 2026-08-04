/* pulsar — the dot lattice (plan C9).
 *
 * Every lit thing in the product is drawn through this class: screen glyphs,
 * boot art, the level meter, the scope. One primitive, one grid — the 24x3
 * meter in the status bar is literally the same code as the 128x64 screen, just
 * a smaller lattice with a smaller dot.
 *
 * Sizing rule for crisp dots on every display:
 *   dpr = max(1, round(devicePixelRatio))   <- ROUND, not raw. A 1.5x display
 *         renders at 2x and lets the compositor downscale; rendering AT 1.5x
 *         puts dot edges on half-pixels and the lattice shimmers.
 *   dot = clamp(min, floor(min(width / cols, height / rows)), max)  integer CSS px
 *         — the largest dot that fits BOTH axes (`dotFor`). Height defaults to
 *         unbounded: the meter sizes by width alone, the screen passes the
 *         viewport budget so the instrument fits a window without scrolling.
 *   canvas CSS size = exactly cols*dot x rows*dot; leftover space is bezel.
 *
 * Two layers, because 8192 unlit squares per frame is the whole frame budget:
 *   Layer A  the unlit lattice, painted once into an offscreen surface and
 *            blitted with a single drawImage per frame. Invalidated only on a
 *            geometry or DPR change.
 *   Layer B  the lit dots, batched by colour so a frame costs at most one
 *            fillStyle write per colour in use (typically two or three).
 */

import { DOT_MAX, DOT_MIN, LATTICE, SCREEN } from '../../design/tokens'
import { dotFor } from './dotFit'
import { ADVANCE, GLYPH_H, GLYPH_W, glyph, textWidth } from './font5x7'
import { GLYPH8, glyph8 as glyphRows8, type Glyph8Name } from './glyphs8'
import { watchDevicePixelRatio } from './gridMetrics'

/** Boot art is NES-quantised to <=16 colours; the live pages use three. */
const MAX_COLOR_SLOTS = 20

interface ColorSlot {
  color: string
  cells: Int32Array
  count: number
}

export interface DotMatrixOptions {
  cols?: number
  rows?: number
  dotMin?: number
  dotMax?: number
  /** Surface behind the lattice. Defaults to the screen well. */
  bg?: string
  /** The unlit dot. Defaults to the screen's deliberately-visible #303030. */
  dotOff?: string
}

export class DotMatrix {
  readonly canvas: HTMLCanvasElement
  readonly cols: number
  readonly rows: number
  #ctx: CanvasRenderingContext2D
  #dotMin: number
  #dotMax: number
  #dot: number
  #dpr = 1
  #bg: string
  #dotOff: string
  #lattice: HTMLCanvasElement | OffscreenCanvas | null = null
  #latticeBitmap: ImageBitmap | null = null
  #slots: ColorSlot[] = []
  #used = 0
  /** Forces the next `resize` past its early-out. See the constructor. */
  #dprDirty = false
  /** The last container box `resize` was given, so the DPR watcher can redo
   *  the sizing itself — Meter sizes once at mount and never again. */
  #lastWidth = 0
  #lastHeight = Infinity
  #unwatchDpr: () => void

  constructor(canvas: HTMLCanvasElement, opts: DotMatrixOptions = {}) {
    this.canvas = canvas
    this.cols = opts.cols ?? LATTICE.cols
    this.rows = opts.rows ?? LATTICE.rows
    this.#dotMin = opts.dotMin ?? DOT_MIN
    this.#dotMax = opts.dotMax ?? DOT_MAX
    this.#dot = this.#dotMin
    this.#bg = opts.bg ?? SCREEN.bg
    this.#dotOff = opts.dotOff ?? SCREEN.dotOff
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('pulsar: 2d context unavailable')
    this.#ctx = ctx

    // DPR invalidation (phase-2 design §7.2 — the Phase-1 known-polish item).
    // Dragging the window between a 1x and a 2x display fires NO resize and no
    // ResizeObserver callback: the CSS box is identical, only the backing-store
    // scale changed. The cached lattice then stays at the old device resolution
    // and the dots go soft. `(resolution: Xdppx)` matches only while the ratio
    // is exactly X, so the watcher re-arms itself after every change. It then
    // redoes the sizing at the remembered container width — the meter sizes
    // itself exactly once at mount, so waiting for a caller would never heal.
    this.#unwatchDpr = watchDevicePixelRatio(() => {
      this.#dprDirty = true
      if (this.#lastWidth > 0) this.resize(this.#lastWidth, this.#lastHeight)
    })
  }

  /** The status-bar meter lives on the aluminium, not in the screen, so its
   *  surface colours follow the room tokens. Rebuilds the cached lattice. */
  setPalette(bg: string, dotOff: string): void {
    if (bg === this.#bg && dotOff === this.#dotOff) return
    this.#bg = bg
    this.#dotOff = dotOff
    if (this.#hasLattice()) this.#buildLattice()
  }

  get dot(): number {
    return this.#dot
  }
  get dpr(): number {
    return this.#dpr
  }
  get cssWidth(): number {
    return this.cols * this.#dot
  }
  get cssHeight(): number {
    return this.rows * this.#dot
  }

  /** Returns true when the geometry actually changed. Safe to call per frame. */
  resize(containerWidth: number, containerHeight: number = Infinity): boolean {
    this.#lastWidth = containerWidth
    this.#lastHeight = containerHeight
    const dpr = Math.max(1, Math.round(globalThis.devicePixelRatio || 1))
    const dot = dotFor(containerWidth, containerHeight, this.cols, this.rows, this.#dotMin, this.#dotMax)
    if (dot === this.#dot && dpr === this.#dpr && this.#hasLattice() && !this.#dprDirty) return false
    this.#dprDirty = false

    this.#dot = dot
    this.#dpr = dpr

    const cssW = this.cssWidth
    const cssH = this.cssHeight
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.canvas.width = Math.round(cssW * dpr)
    this.canvas.height = Math.round(cssH * dpr)

    const ctx = this.#ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    this.#buildLattice()
    return true
  }

  /** Clear to the screen background and blit the unlit lattice. `rows` limits
   *  the blit to the top N lattice rows — that is the boot raster scan. */
  beginFrame(rows: number = this.rows): void {
    const ctx = this.#ctx
    ctx.fillStyle = this.#bg
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)

    const src = (this.#latticeBitmap ?? this.#lattice) as CanvasImageSource | null
    if (src && rows > 0) {
      const visible = Math.min(this.rows, rows)
      const devH = visible * this.#dot * this.#dpr
      ctx.drawImage(
        src,
        0,
        0,
        this.cols * this.#dot * this.#dpr,
        devH,
        0,
        0,
        this.cssWidth,
        visible * this.#dot,
      )
    }

    this.#used = 0
  }

  /** Queue one lit dot. Out-of-bounds cells are dropped, not clamped: a bar
   *  that runs off the lattice should visibly stop, not pile up at the edge. */
  set(col: number, row: number, color: string): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return
    const slot = this.#slot(color)
    slot.cells[slot.count++] = row * this.cols + col
  }

  rect(col: number, row: number, w: number, h: number, color: string): void {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) this.set(col + x, row + y, color)
    }
  }

  /** Horizontal run — parameter bars and rules. */
  hline(col: number, row: number, len: number, color: string): void {
    for (let i = 0; i < len; i++) this.set(col + i, row, color)
  }

  /** 5x7 text. The bit walk is inlined rather than reusing font5x7's callback
   *  form so a page render allocates no closures. Returns the x the next glyph
   *  would start at. */
  text(str: string, col: number, row: number, color: string): number {
    const slot = this.#slot(color)
    let cx = col
    for (let i = 0; i < str.length; i++) {
      const rows = glyph(str[i] as string)
      for (let ry = 0; ry < GLYPH_H; ry++) {
        const bits = rows[ry] as number
        if (bits === 0) continue
        const y = row + ry
        if (y < 0 || y >= this.rows) continue
        for (let rx = 0; rx < GLYPH_W; rx++) {
          if (!(bits & (1 << (GLYPH_W - 1 - rx)))) continue
          const x = cx + rx
          if (x < 0 || x >= this.cols) continue
          slot.cells[slot.count++] = y * this.cols + x
        }
      }
      cx += ADVANCE
    }
    return cx
  }

  /** Right-aligned so the last dot of `str` lands on column `right`. */
  textRight(str: string, right: number, row: number, color: string): void {
    this.text(str, right - textWidth(str) + 1, row, color)
  }

  glyph8(name: Glyph8Name, col: number, row: number, color: string): void {
    const slot = this.#slot(color)
    const rows = glyphRows8(name)
    for (let ry = 0; ry < GLYPH8; ry++) {
      const bits = rows[ry] as number
      if (bits === 0) continue
      const y = row + ry
      if (y < 0 || y >= this.rows) continue
      for (let rx = 0; rx < GLYPH8; rx++) {
        if (!(bits & (1 << (GLYPH8 - 1 - rx)))) continue
        const x = col + rx
        if (x < 0 || x >= this.cols) continue
        slot.cells[slot.count++] = y * this.cols + x
      }
    }
  }

  /** Flush every queued dot. At most one fillStyle write per colour. */
  endFrame(): void {
    const ctx = this.#ctx
    const dot = this.#dot
    const size = dot - LATTICE.gap
    const cols = this.cols
    for (let i = 0; i < this.#used; i++) {
      const slot = this.#slots[i]
      if (!slot || slot.count === 0) continue
      ctx.fillStyle = slot.color
      const cells = slot.cells
      const n = slot.count
      for (let c = 0; c < n; c++) {
        const cell = cells[c] as number
        const col = cell % cols
        const row = (cell - col) / cols
        ctx.fillRect(col * dot, row * dot, size, size)
      }
    }
  }

  destroy(): void {
    this.#unwatchDpr()
    this.#latticeBitmap?.close()
    this.#latticeBitmap = null
    this.#lattice = null
    this.#slots = []
    this.#used = 0
  }

  #hasLattice(): boolean {
    return this.#latticeBitmap !== null || this.#lattice !== null
  }

  #slot(color: string): ColorSlot {
    for (let i = 0; i < this.#used; i++) {
      const s = this.#slots[i]
      if (s && s.color === color) return s
    }
    // Past the slot budget, fold into the last slot rather than dropping dots:
    // a wrong shade is a bug you can see; a missing dot is one you cannot.
    const index = this.#used < MAX_COLOR_SLOTS ? this.#used : MAX_COLOR_SLOTS - 1
    let slot = this.#slots[index]
    if (!slot) {
      slot = { color, cells: new Int32Array(this.cols * this.rows), count: 0 }
      this.#slots[index] = slot
    }
    if (index === this.#used) {
      slot.color = color
      slot.count = 0
      this.#used++
    }
    return slot
  }

  /** Paint the unlit dots once, at device resolution, into an offscreen
   *  surface. `transferToImageBitmap` is synchronous, which is why the
   *  offscreen path beats `createImageBitmap`'s promise here. */
  #buildLattice(): void {
    this.#latticeBitmap?.close()
    this.#latticeBitmap = null
    this.#lattice = null

    const dot = this.#dot
    const dpr = this.#dpr
    const w = Math.round(this.cols * dot * dpr)
    const h = Math.round(this.rows * dot * dpr)
    const size = (dot - LATTICE.gap) * dpr

    let surface: HTMLCanvasElement | OffscreenCanvas
    if (typeof OffscreenCanvas === 'function') {
      surface = new OffscreenCanvas(w, h)
    } else {
      const el = document.createElement('canvas')
      el.width = w
      el.height = h
      surface = el
    }

    const c = surface.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
    if (!c) return
    c.imageSmoothingEnabled = false
    c.fillStyle = this.#bg
    c.fillRect(0, 0, w, h)
    c.fillStyle = this.#dotOff
    const step = dot * dpr
    for (let row = 0; row < this.rows; row++) {
      const y = row * step
      for (let col = 0; col < this.cols; col++) c.fillRect(col * step, y, size, size)
    }

    if (typeof OffscreenCanvas === 'function' && surface instanceof OffscreenCanvas) {
      this.#latticeBitmap = surface.transferToImageBitmap()
    } else {
      this.#lattice = surface
    }
  }
}
