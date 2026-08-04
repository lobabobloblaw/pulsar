/* pulsar — the grid's palette + geometry resolution (design §4.2, §4.3, §7.2).
 *
 * The pattern grid lives on the ALUMINIUM, whose tokens change between the day
 * and night rooms — so unlike `design/tokens.ts`, which may mirror the
 * room-invariant screen palette as literals, this module must read the live
 * values out of `tokens.css`. One `getComputedStyle(document.documentElement)`
 * per palette change, cached (K5).
 *
 * It also owns the DPR re-arm listener. The Phase-1 known-polish item "a DPR
 * change without a resize does not invalidate the cached lattice" is inherited
 * by every cached-offscreen surface in the product, so the fix lives here once
 * and `dotMatrix.ts` imports it (§7.2).
 */

import { computeLayout, type GridLayout, type GridPalette } from './patternRenderer'

/** Every token the grid reads, with the fallback it uses if the sheet has not
 *  loaded yet. Fallbacks are the day-room values from `tokens.css`. */
const TOKENS = {
  bg: ['--grid-bg', '#ffffff'],
  bgAlt: ['--grid-bg-alt', '#f2f2f2'],
  bgBeat: ['--grid-bg-beat', '#ebebeb'],
  bgBar: ['--grid-bg-bar', '#dcdcdc'],
  ink: ['--grid-ink', '#181818'],
  inkDim: ['--grid-ink-dim', '#484848'],
  inkMuted: ['--grid-ink-muted', '#949494'],
  accent: ['--grid-accent', '#1270b8'],
  selection: ['--grid-selection', '#d8e7f4'],
  hairline: ['--grid-hairline', '#bdbdbd'],
  focus: ['--grid-focus', '#1270b8'],
} as const satisfies Record<keyof GridPalette, readonly [string, string]>

export function resolvePalette(root: Element = document.documentElement): GridPalette {
  const cs = getComputedStyle(root)
  const read = (name: string, fallback: string): string => {
    const v = cs.getPropertyValue(name).trim()
    return v === '' ? fallback : v
  }
  const out = {} as Record<keyof GridPalette, string>
  for (const key of Object.keys(TOKENS) as (keyof GridPalette)[]) {
    const [name, fallback] = TOKENS[key]
    out[key] = read(name, fallback)
  }
  return out
}

export interface TypeTokens {
  readonly family: string
  readonly cellPx: number
  readonly microPx: number
}

export function resolveType(root: Element = document.documentElement): TypeTokens {
  const cs = getComputedStyle(root)
  const family = cs.getPropertyValue('--font-ui').trim() || 'ui-monospace, monospace'
  const px = (name: string, fallback: number): number => {
    const v = parseFloat(cs.getPropertyValue(name))
    return Number.isFinite(v) && v > 0 ? v : fallback
  }
  return { family, cellPx: px('--t-body-size', 12), microPx: px('--t-micro-size', 9) }
}

/** Monospace means one measurement gives the whole column geometry (§4.2). */
export function measureCharWidth(ctx: CanvasRenderingContext2D, font: string): number {
  ctx.font = font
  const w = ctx.measureText('0').width
  // JetBrains Mono is 0.6em advance; if the webfont has not loaded the fallback
  // still measures, and the layout is rebuilt on `document.fonts.ready`.
  return w > 0 ? w : 7.2
}

export interface MetricsOptions {
  readonly channels: number
  readonly effectColumns: readonly number[]
}

export function buildLayout(
  ctx: CanvasRenderingContext2D,
  type: TypeTokens,
  opts: MetricsOptions,
): GridLayout {
  const fontCell = `${400} ${type.cellPx}px ${type.family}`
  const fontMicro = `${600} ${type.microPx}px ${type.family}`
  const charW = measureCharWidth(ctx, fontCell)
  return computeLayout({
    charW,
    channels: opts.channels,
    effectColumns: opts.effectColumns,
    fontCell,
    fontMicro,
  })
}

/** `max(1, round(devicePixelRatio))` — ROUND, so a 1.5x display renders at 2x
 *  and lets the compositor downscale (the same rule `dotMatrix.ts` uses). */
export function deviceRatio(): number {
  return Math.max(1, Math.round(globalThis.devicePixelRatio || 1))
}

/**
 * Fire `onChange` whenever `devicePixelRatio` changes — dragging the window
 * between a 1x and a 2x display, or a zoom step.
 *
 * `(resolution: Xdppx)` matches only while the ratio is exactly X, so the query
 * has to be REBUILT after every change; a listener armed once at load stops
 * firing after the first move. That re-arm is the whole fix.
 *
 * Returns a disposer. Safe to call where `matchMedia` does not exist.
 */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  let mql: MediaQueryList | null = null
  let disposed = false

  const fire = (): void => {
    if (disposed) return
    arm()
    onChange()
  }

  function arm(): void {
    mql?.removeEventListener('change', fire)
    const dpr = globalThis.devicePixelRatio || 1
    mql = matchMedia(`(resolution: ${dpr}dppx)`)
    mql.addEventListener('change', fire, { once: true })
  }

  arm()
  return () => {
    disposed = true
    mql?.removeEventListener('change', fire)
    mql = null
  }
}

/**
 * Watch `data-room` on `<html>` so the palette can be re-resolved exactly when
 * the room changes, and never on a frame.
 */
export function watchRoom(onChange: () => void): () => void {
  if (typeof MutationObserver !== 'function') return () => {}
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-room'] })
  return () => mo.disconnect()
}
