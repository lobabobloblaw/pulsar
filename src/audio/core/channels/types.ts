import type { NesCycle } from '../../timeline/types'

/** What the APU's merged min-scan run loop needs from every channel.
 *
 *  The loop takes the minimum `nextCycle` over the six named channel/frame-counter
 *  fields, calls `stepTimer()` on whichever sources are due at exactly that cycle,
 *  and then re-evaluates the full non-linear mix once. A channel that cannot change
 *  its output — disabled, muted, silenced — MUST advertise `nextCycle = Infinity`
 *  so it drops out of the scan entirely.
 *
 *  Deliberately a structural interface, not a base class: the channels are stored as
 *  named fields on `Apu2A03` so every call site stays monomorphic.
 */
export interface TimerEventSource {
  /** CPU cycle of this source's next expiry, or Infinity when it cannot fire. */
  readonly nextCycle: NesCycle
  /** Called by the run loop exactly when `cycle === nextCycle`. Must advance
   *  `nextCycle` past the current cycle or the loop will not terminate. */
  stepTimer(): void
}

export interface ChannelEventSource extends TimerEventSource {
  /** Current DAC input level: 0..15 for pulse/triangle/noise, 0..127 for DMC. */
  readonly out: number
}
