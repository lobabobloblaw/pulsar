/* pulsar — the parameter registry (plan C4).
 *
 * Shared by both sides of the UI<->audio boundary. The UI reads this file for
 * ranges, labels and formatting; the audio side owns the register mapping and
 * may rename a parameter in exactly one place. Values that cross the bridge are
 * always NATIVE units (duty index 0..3, decay 0..15, sweep -7..+7, volume 0..1)
 * — never normalized 0..1, never register bytes.
 *
 * `label` is capped at 7 characters because it has to render in the 5x7 bitmap
 * face on a 128-dot-wide lattice: 7 glyphs * 6 dots = 42 dots of the 44 the
 * parameter page reserves for a row label.
 */

export type ParamId =
  | 'pulse1.duty'
  | 'pulse1.envDecay'
  | 'pulse1.sweep'
  | 'master.volume'

export type ParamTaper = 'linear' | 'exp' | 'enum'

export interface ParamDescriptor {
  readonly id: ParamId
  /** <= 7 chars, lowercase, must exist in font5x7. */
  readonly label: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly default: number
  readonly unit: string
  readonly taper: ParamTaper
  readonly enumLabels?: readonly string[]
  /** Display string for the readout and for `aria-valuetext` (before symbol
   *  expansion). Must be pure and allocation-cheap: it runs at pointermove rate. */
  readonly format: (v: number) => string
}

const DUTY_LABELS = ['12.5%', '25%', '50%', '75%'] as const

export const PARAMS: Readonly<Record<ParamId, ParamDescriptor>> = {
  'pulse1.duty': {
    id: 'pulse1.duty',
    label: 'duty',
    min: 0,
    max: 3,
    step: 1,
    default: 2,
    unit: '',
    taper: 'enum',
    enumLabels: DUTY_LABELS,
    format: (v) => DUTY_LABELS[clampIndex(v, DUTY_LABELS.length)] ?? '',
  },
  'pulse1.envDecay': {
    id: 'pulse1.envDecay',
    label: 'decay',
    min: 0,
    max: 15,
    step: 1,
    default: 8,
    unit: '',
    taper: 'linear',
    format: (v) => String(Math.round(v)),
  },
  'pulse1.sweep': {
    id: 'pulse1.sweep',
    label: 'sweep',
    min: -7,
    max: 7,
    step: 1,
    default: 0,
    unit: '',
    taper: 'linear',
    format: (v) => {
      const n = Math.round(v)
      if (n === 0) return 'off'
      return n > 0 ? `+${n}` : String(n)
    },
  },
  'master.volume': {
    id: 'master.volume',
    label: 'vol',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.72,
    unit: '%',
    taper: 'exp',
    format: (v) => `${Math.round(v * 100)}%`,
  },
}

/** Exactly four, left to right. The audio design's fourth knob ("console
 *  model") is a StatusBar chip-toggle instead — a binary switch is not a knob. */
export const PHASE1_KNOBS: readonly ParamId[] = [
  'pulse1.duty',
  'pulse1.envDecay',
  'pulse1.sweep',
  'master.volume',
]

export function paramById(id: ParamId): ParamDescriptor {
  return PARAMS[id]
}

/** Fraction of the range a value sits at, 0..1 — drives knob angle and the
 *  screen's 64-dot bars. Linear for every taper: the exp taper lives in the
 *  audio-side mapping, not in the control's travel. */
export function paramFraction(d: ParamDescriptor, v: number): number {
  const span = d.max - d.min
  if (span <= 0) return 0
  const f = (v - d.min) / span
  return f < 0 ? 0 : f > 1 ? 1 : f
}

/** Screen readers voice `12.5%` and `+3` inconsistently; aria-valuetext gets
 *  words. Kept next to `format` so the two never drift. */
export function speak(text: string): string {
  return text
    .replace(/%/g, ' percent')
    .replace(/\+/g, 'plus ')
    .replace(/-(?=\d)/g, 'minus ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clampIndex(v: number, len: number): number {
  const i = Math.round(v)
  return i < 0 ? 0 : i > len - 1 ? len - 1 : i
}
