/* pulsar — meter + scope renderers (plan C10).
 *
 * Both are drawn on the dot lattice, like everything else that carries a value.
 *
 * The LEVEL meter lives in the status bar, i.e. on the aluminium — so it is an
 * UNLIT readout: ink dots on the enclosure, blue for the peak-hold marker
 * (component-level 3:1, never text), red for clip. It must never look lit,
 * because the screen is the only lit object on the page.
 *
 * The SCOPE is inside the screen and uses the screen palette.
 *
 * Both are read from `bridge.meter` / `bridge.scope` inside the single rAF only.
 */

import { LATTICE, SCREEN } from '../../design/tokens'
import { motion } from '../../state/motion.svelte'
import { CANVAS_DUR } from '../../design/tokens'
import type { DotMatrix } from './dotMatrix'

export const LEVEL_COLS = 24
export const LEVEL_ROWS = 3

export interface LevelColors {
  on: string
  peak: string
  clip: string
}

/** Peak-hold and clip-latch state. Owned by the component, mutated in the rAF —
 *  deliberately NOT $state: it changes every frame and nothing re-renders on it. */
export class LevelState {
  peak = 0
  peakAt = 0
  clipAt = -Infinity
}

export function drawLevel(
  dm: DotMatrix,
  meter: Float32Array,
  state: LevelState,
  now: number,
  colors: LevelColors,
): void {
  const rms = clamp01(meter[0] ?? 0)
  const peak = clamp01(meter[1] ?? 0)

  // Peak hold: rise instantly, fall over 1.2s. Under reduced motion the decay
  // collapses to one step — the information (where the peak was) survives, the
  // animation does not.
  if (peak >= state.peak) {
    state.peak = peak
    state.peakAt = now
  } else if (motion.reduced) {
    state.peak = peak
    state.peakAt = now
  } else {
    const age = now - state.peakAt
    const k = age <= 0 ? 0 : age / CANVAS_DUR.peakDecay
    state.peak = k >= 1 ? peak : Math.max(peak, state.peak * (1 - k))
  }

  if (peak >= 0.999) state.clipAt = now
  const clipped = now - state.clipAt < CANVAS_DUR.peakDecay

  const lit = Math.round(rms * LEVEL_COLS)
  const peakCol = Math.min(LEVEL_COLS - 1, Math.max(0, Math.round(state.peak * LEVEL_COLS) - 1))

  for (let c = 0; c < lit; c++) {
    for (let r = 0; r < LEVEL_ROWS; r++) dm.set(c, r, colors.on)
  }
  if (state.peak > 0.001) {
    for (let r = 0; r < LEVEL_ROWS; r++) dm.set(peakCol, r, colors.peak)
  }
  if (clipped) {
    for (let r = 0; r < LEVEL_ROWS; r++) dm.set(LEVEL_COLS - 1, r, colors.clip)
  }
}

/** Text form of the same number, for the status chip and the live region. There
 *  is never a colour-only state: the meter always has words next to it. */
export function levelText(meter: Float32Array): string {
  const peak = clamp01(meter[1] ?? 0)
  if (peak <= 0.0005) return 'silent'
  const db = 20 * Math.log10(peak)
  return `${db <= -60 ? '-60' : db.toFixed(0)} db`
}

export interface ScopeBox {
  x: number
  y: number
  w: number
  h: number
}

/** 256-sample single trace, aligned to the first rising zero crossing so the
 *  waveform stands still instead of crawling. One lit dot per column. */
export function drawScope(
  dm: DotMatrix,
  scope: Float32Array,
  box: ScopeBox,
  color: string = SCREEN.accent,
): void {
  const n = scope.length
  if (n === 0 || box.w <= 0 || box.h <= 0) return

  let start = 0
  const searchEnd = n >> 1
  for (let i = 1; i < searchEnd; i++) {
    const prev = scope[i - 1] as number
    const cur = scope[i] as number
    if (prev < 0 && cur >= 0) {
      start = i
      break
    }
  }

  const span = n - start
  const mid = box.y + ((box.h - 1) >> 1)
  const amp = (box.h - 1) / 2

  for (let c = 0; c < box.w; c++) {
    const idx = start + Math.min(span - 1, Math.floor((c * span) / box.w))
    const s = scope[idx] as number
    const clamped = s > 1 ? 1 : s < -1 ? -1 : s
    dm.set(box.x + c, mid - Math.round(clamped * amp), color)
  }
}

/** The scope page's frame: a centre line plus edge ticks, so an empty trace
 *  still reads as an instrument rather than a broken screen. */
export function drawScopeFrame(dm: DotMatrix, box: ScopeBox, color: string = SCREEN.dotOff): void {
  const mid = box.y + ((box.h - 1) >> 1)
  for (let c = 0; c < box.w; c += 2) dm.set(box.x + c, mid, color)
  for (let r = 0; r < box.h; r += 2) {
    dm.set(box.x, box.y + r, color)
    dm.set(box.x + box.w - 1, box.y + r, color)
  }
}

/** Default box: the scope page uses the full lattice width with a 2-dot margin. */
export const SCOPE_BOX: ScopeBox = {
  x: 2,
  y: 14,
  w: LATTICE.cols - 4,
  h: 40,
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : Number.isFinite(v) ? v : 0
}
