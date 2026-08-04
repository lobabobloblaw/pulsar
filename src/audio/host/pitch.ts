/** Note → timer-period conversion.
 *
 *  The 2A03 has no tuning table: pitch is whatever an 11-bit integer divider produces.
 *  Every note is therefore slightly out, and the error is not a bug to be corrected —
 *  it IS the sound of the hardware. Two anchors that must stay asserted:
 *    pulse    t = 253 → 440.3969 Hz, +1.561 cents  (A440)
 *    triangle t =  63 → 873.9126 Hz, −12.017 cents (A5) — real hardware resolution
 *
 *  Pulse/noise timers are clocked every second CPU cycle and the sequencer has 8
 *  steps → f = fCPU / (16·(t+1)). The triangle is clocked every CPU cycle over a
 *  32-step sequence → f = fCPU / (32·(t+1)).
 */
import { MAX_TIMER, NTSC_CPU_HZ } from '../core/constants'

export const PULSE_TIMER_DIVISOR = 16
export const TRIANGLE_TIMER_DIVISOR = 32

/** Concert pitch. */
export const A4_HZ = 440
/** MIDI note number of A4. */
export const A4_MIDI = 69

export function midiToHz(note: number, a4Hz: number = A4_HZ): number {
  return a4Hz * Math.pow(2, (note - A4_MIDI) / 12)
}

export function centsBetween(hz: number, referenceHz: number): number {
  return 1200 * Math.log2(hz / referenceHz)
}

function clampTimer(t: number): number {
  if (t < 0) return 0
  if (t > MAX_TIMER) return MAX_TIMER
  return t
}

/** Closest pulse timer period for a frequency. Rounds — the nearest divider is the
 *  best the hardware can do, and rounding beats truncating by up to half a step. */
export function pulseTimerForHz(hz: number, clockRate: number = NTSC_CPU_HZ): number {
  if (!(hz > 0)) return MAX_TIMER
  return clampTimer(Math.round(clockRate / (PULSE_TIMER_DIVISOR * hz) - 1))
}

export function pulseHzForTimer(timer: number, clockRate: number = NTSC_CPU_HZ): number {
  return clockRate / (PULSE_TIMER_DIVISOR * (timer + 1))
}

export function triangleTimerForHz(hz: number, clockRate: number = NTSC_CPU_HZ): number {
  if (!(hz > 0)) return MAX_TIMER
  return clampTimer(Math.round(clockRate / (TRIANGLE_TIMER_DIVISOR * hz) - 1))
}

export function triangleHzForTimer(timer: number, clockRate: number = NTSC_CPU_HZ): number {
  return clockRate / (TRIANGLE_TIMER_DIVISOR * (timer + 1))
}

export function pulseTimerForMidi(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return pulseTimerForHz(midiToHz(note), clockRate)
}

export function triangleTimerForMidi(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return triangleTimerForHz(midiToHz(note), clockRate)
}

/** How far off equal temperament a MIDI note lands on the pulse channels. */
export function pulseDetuneCents(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return centsBetween(pulseHzForTimer(pulseTimerForMidi(note, clockRate), clockRate), midiToHz(note))
}

export function triangleDetuneCents(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return centsBetween(
    triangleHzForTimer(triangleTimerForMidi(note, clockRate), clockRate),
    midiToHz(note),
  )
}

/** Below this timer a pulse channel is muted by the sweep unit's period check. */
export const PULSE_MIN_AUDIBLE_TIMER = 8

/** Highest pitch a pulse channel can actually sound: 12 429.0 Hz at t = 8. */
export function pulseMaxAudibleHz(clockRate: number = NTSC_CPU_HZ): number {
  return pulseHzForTimer(PULSE_MIN_AUDIBLE_TIMER, clockRate)
}
