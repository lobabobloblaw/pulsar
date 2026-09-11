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
 *
 *  The VRC6 expansion chip is clocked every CPU cycle instead, and its dividers are
 *  12-BIT rather than 11-bit — which is the whole practical difference, because it is
 *  what lets the expansion lanes reach the bottom octave the 2A03 saturates in:
 *    vrc6 pulse  16 steps → f = fCPU / (16·(t+1)) — the same formula as the 2A03
 *                pulse, so the same timer sounds the same pitch, with four times the
 *                range below it. Anchor: t = 253 → 440.3969 Hz.
 *    vrc6 saw    14 steps → f = fCPU / (14·(t+1)). Anchor: A4 → t = 290 → 439.3159 Hz
 *                (−2.694 cents; the saw's coarser divider is simply further out of
 *                tune than the pulse's at A4, and that is the hardware).
 */
import { MAX_TIMER, NTSC_CPU_HZ } from '../core/constants'

export const PULSE_TIMER_DIVISOR = 16
export const TRIANGLE_TIMER_DIVISOR = 32
export const VRC6_PULSE_TIMER_DIVISOR = 16
export const VRC6_SAW_TIMER_DIVISOR = 14

/** The VRC6's dividers are 12-bit: `$x002`'s low nibble is the period's high nibble. */
export const MAX_VRC6_TIMER = 0xfff

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

// --- VRC6 (12-bit dividers) ----------------------------------------------------------

function clampVrc6Timer(t: number): number {
  if (t < 0) return 0
  if (t > MAX_VRC6_TIMER) return MAX_VRC6_TIMER
  return t
}

export function vrc6PulseTimerForHz(hz: number, clockRate: number = NTSC_CPU_HZ): number {
  if (!(hz > 0)) return MAX_VRC6_TIMER
  return clampVrc6Timer(Math.round(clockRate / (VRC6_PULSE_TIMER_DIVISOR * hz) - 1))
}

export function vrc6PulseHzForTimer(timer: number, clockRate: number = NTSC_CPU_HZ): number {
  return clockRate / (VRC6_PULSE_TIMER_DIVISOR * (timer + 1))
}

export function vrc6PulseTimerForMidi(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return vrc6PulseTimerForHz(midiToHz(note), clockRate)
}

export function vrc6SawTimerForHz(hz: number, clockRate: number = NTSC_CPU_HZ): number {
  if (!(hz > 0)) return MAX_VRC6_TIMER
  return clampVrc6Timer(Math.round(clockRate / (VRC6_SAW_TIMER_DIVISOR * hz) - 1))
}

export function vrc6SawHzForTimer(timer: number, clockRate: number = NTSC_CPU_HZ): number {
  return clockRate / (VRC6_SAW_TIMER_DIVISOR * (timer + 1))
}

export function vrc6SawTimerForMidi(note: number, clockRate: number = NTSC_CPU_HZ): number {
  return vrc6SawTimerForHz(midiToHz(note), clockRate)
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
