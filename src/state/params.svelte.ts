/* pulsar — parameter state (plan C5).
 *
 * `set()` is the SINGLE write path: clamp -> quantize to step -> store ->
 * bridge.setParam. Knobs, the keyboard map, MIDI CC and the screen all go
 * through it; nothing else may call `bridge.setParam` directly. That is what
 * makes the optimistic UI copy authoritative — the UI never reads a value back
 * out of the audio side, so there is exactly one number per parameter in the
 * whole app.
 */

import { PARAMS, PHASE1_KNOBS, type ParamDescriptor, type ParamId } from '../audio/params'
import type { AudioBridge } from '../audio/bridge'
import { CANVAS_DUR } from '../design/tokens'

function initialValues(): Record<ParamId, number> {
  const out = {} as Record<ParamId, number>
  for (const id of Object.keys(PARAMS) as ParamId[]) out[id] = PARAMS[id].default
  return out
}

export class ParamStore {
  #values = $state(initialValues())
  #lastTouched = $state<ParamId | null>(null)
  #lastTouchedAt = 0
  #bridge: AudioBridge | null = null

  /** Called once by App after the bridge exists. Flushes defaults so the audio
   *  side starts from the same numbers the UI is already showing. */
  attach(bridge: AudioBridge): void {
    this.#bridge = bridge
    for (const id of Object.keys(PARAMS) as ParamId[]) bridge.setParam(id, this.#values[id])
  }

  get(id: ParamId): number {
    return this.#values[id]
  }

  descriptor(id: ParamId): ParamDescriptor {
    return PARAMS[id]
  }

  format(id: ParamId): string {
    return PARAMS[id].format(this.#values[id])
  }

  get lastTouched(): ParamId | null {
    return this.#lastTouched
  }

  /** True while the highlight window is open — the screen reads this each frame
   *  from inside the rAF, so it must not itself be reactive work. */
  touchAgeMs(now: number): number {
    return now - this.#lastTouchedAt
  }

  isHighlighted(id: ParamId, now: number): boolean {
    return this.#lastTouched === id && now - this.#lastTouchedAt < CANVAS_DUR.touchHighlight
  }

  /** THE write path. Returns the value actually stored. */
  set(id: ParamId, raw: number, opts?: { touch?: boolean }): number {
    const d = PARAMS[id]
    const v = quantize(d, raw)
    const touch = opts?.touch !== false
    if (touch) {
      this.#lastTouched = id
      this.#lastTouchedAt = performance.now()
    }
    if (this.#values[id] === v) return v
    this.#values[id] = v
    this.#bridge?.setParam(id, v)
    return v
  }

  /** Relative nudge in native units (keyboard arrows, wheel). */
  nudge(id: ParamId, delta: number): number {
    return this.set(id, this.#values[id] + delta)
  }

  reset(id: ParamId): number {
    return this.set(id, PARAMS[id].default)
  }

  /** Left-to-right knob order, resolved once. */
  get knobs(): readonly ParamId[] {
    return PHASE1_KNOBS
  }
}

/** clamp -> quantize to step, on a grid anchored at `min` so that -7..+7 by 1
 *  and 0..1 by 0.01 both land on exact representable values. */
export function quantize(d: ParamDescriptor, raw: number): number {
  const clamped = raw < d.min ? d.min : raw > d.max ? d.max : raw
  if (d.step <= 0) return clamped
  const steps = Math.round((clamped - d.min) / d.step)
  const v = d.min + steps * d.step
  // Kill float dust from the multiply (0.7200000000000001 -> 0.72).
  const rounded = Number(v.toFixed(6))
  return rounded < d.min ? d.min : rounded > d.max ? d.max : rounded
}

export const params = new ParamStore()
