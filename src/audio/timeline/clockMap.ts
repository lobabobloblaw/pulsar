/** The cycle ↔ output-sample map, imported by BOTH threads.
 *
 *  There is exactly one anchor per engine instance, published once from the worklet's
 *  first `process()` and shipped to the host in the `ready` message. Both sides then
 *  agree on what "cycle 0" means, which is what makes a live keypress land on the
 *  same cycle the worklet will render it at.
 *
 *  Precision matters more than it looks. The naive `Math.floor(c * factor / TIME_UNIT)`
 *  loses integer exactness once `c · factor` passes 2^53 — about 13 hours of audio —
 *  and the failure mode is a silently drifting schedule, not a crash. Both directions
 *  below split the operand first, so the largest intermediate stays exact out to
 *  ~1e17 cycles (millennia). Cycles are f64 doubles: no `|0`, `<<`, `>>` or `&`.
 */
import { TIME_UNIT, factorFor } from '../dsp/bandlimitedBuf'
import type { NesCycle } from './types'

export interface ClockAnchor {
  /** `currentFrame` at the worklet's first render quantum — the output-sample index
   *  that CPU cycle 0 corresponds to. */
  readonly startFrame: number
  readonly sampleRate: number
  readonly clockRate: number
  /** Fixed-point sample-time increment per cycle; must equal the engine's. */
  readonly factor: number
}

export function makeClockAnchor(
  startFrame: number,
  sampleRate: number,
  clockRate: number,
): ClockAnchor {
  return { startFrame, sampleRate, clockRate, factor: factorFor(clockRate, sampleRate) }
}

/** Output-sample index (relative to `startFrame`) that cycle `c` falls in. */
export function sampleForCycle(anchor: ClockAnchor, c: NesCycle): number {
  const hi = Math.floor(c / TIME_UNIT)
  const lo = c - hi * TIME_UNIT
  return hi * anchor.factor + Math.floor((lo * anchor.factor) / TIME_UNIT)
}

/** First cycle that renders at or after output sample `s` (relative to `startFrame`). */
export function cycleForSample(anchor: ClockAnchor, s: number): NesCycle {
  const q = Math.floor(s / anchor.factor)
  const r = s - q * anchor.factor
  return q * TIME_UNIT + Math.ceil((r * TIME_UNIT) / anchor.factor)
}

/** Milliseconds → CPU cycles, for scheduling lead times. 6 ms ≈ 10 739 cycles. */
export function cyclesForMs(anchor: ClockAnchor, ms: number): NesCycle {
  return msToCycles(anchor.clockRate, ms)
}

/** The same conversion for callers that hold a clock rate but not an anchor — the
 *  live scheduler adapts its lead before the anchor arrives. One formula, one place. */
export function msToCycles(clockRate: number, ms: number): NesCycle {
  return Math.round((ms * clockRate) / 1000)
}

/** What the host calls "now" on the engine's timeline: the cycle matching the first
 *  output sample the worklet has not rendered yet. `contextTime` is
 *  `AudioContext.currentTime`; the caller adds its scheduling lead on top. */
export function nowCycle(anchor: ClockAnchor, contextTime: number): NesCycle {
  const frame = Math.ceil(contextTime * anchor.sampleRate) - anchor.startFrame
  return cycleForSample(anchor, frame < 0 ? 0 : frame)
}
