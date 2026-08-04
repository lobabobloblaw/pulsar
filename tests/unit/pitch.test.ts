import { describe, expect, it } from 'vitest'
import {
  centsBetween,
  midiToHz,
  pulseDetuneCents,
  pulseHzForTimer,
  pulseMaxAudibleHz,
  pulseTimerForHz,
  pulseTimerForMidi,
  triangleDetuneCents,
  triangleHzForTimer,
  triangleTimerForHz,
  triangleTimerForMidi,
} from '../../src/audio/host/pitch'
import { MAX_TIMER, NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { pulseNoteOnTrace, renderTrace } from '../helpers/renderTrace'
import { dftFundamentalHz, zeroCrossingHz } from '../helpers/analysis'

/** Pulse-1 timer for every key of an 88-key piano, MIDI 21 (A0) → 108 (C8). */
const PULSE_88 = [
  2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2047, 2033, 1919, 1811,
  1709, 1613, 1523, 1437, 1356, 1280, 1208, 1140, 1076, 1016, 959, 905, 854, 806, 761, 718,
  678, 640, 604, 570, 538, 507, 479, 452, 427, 403, 380, 359, 338, 319, 301, 284, 268, 253,
  239, 225, 213, 201, 189, 179, 169, 159, 150, 142, 134, 126, 119, 112, 106, 100, 94, 89, 84,
  79, 75, 70, 66, 63, 59, 56, 52, 49, 47, 44, 41, 39, 37, 35, 33, 31, 29, 27, 26,
]

describe('timer formula', () => {
  it('t = fCPU / (16·f) − 1 for the pulse channels', () => {
    for (const hz of [110, 220, 440, 880, 1760]) {
      const t = pulseTimerForHz(hz)
      expect(t).toBe(Math.round(NTSC_CPU_HZ / (16 * hz) - 1))
      expect(pulseHzForTimer(t)).toBeCloseTo(NTSC_CPU_HZ / (16 * (t + 1)), 12)
    }
  })

  it('t = fCPU / (32·f) − 1 for the triangle — it clocks every CPU cycle', () => {
    for (const hz of [55, 110, 220, 440]) {
      const t = triangleTimerForHz(hz)
      expect(t).toBe(Math.round(NTSC_CPU_HZ / (32 * hz) - 1))
    }
  })

  it('round-trips timer → Hz → timer', () => {
    for (let t = 8; t <= MAX_TIMER; t += 7) {
      expect(pulseTimerForHz(pulseHzForTimer(t))).toBe(t)
    }
  })

  it('clamps into the 11-bit register range', () => {
    expect(pulseTimerForHz(1)).toBe(MAX_TIMER)
    expect(pulseTimerForHz(1_000_000)).toBe(0)
    expect(pulseTimerForHz(0)).toBe(MAX_TIMER)
    expect(pulseTimerForHz(-5)).toBe(MAX_TIMER)
  })
})

describe('pinned pitch anchors', () => {
  it('A440 is timer 253 → 440.3969 Hz, +1.561 cents', () => {
    expect(pulseTimerForHz(440)).toBe(253)
    expect(pulseHzForTimer(253)).toBeCloseTo(440.3969, 4)
    expect(centsBetween(pulseHzForTimer(253), 440)).toBeCloseTo(1.561, 3)
  })

  it('C4 is timer 427 → −1.778 cents', () => {
    expect(pulseTimerForMidi(60)).toBe(427)
    expect(pulseDetuneCents(60)).toBeCloseTo(-1.778, 3)
  })

  it('triangle A5 is timer 63 → 873.9126 Hz, −12.017 cents — REAL hardware resolution', () => {
    // Do not "fix" this. An 11-bit divider simply cannot land on 880 Hz here, and
    // every NES that ever shipped is this flat at A5.
    expect(triangleTimerForHz(880)).toBe(63)
    expect(triangleHzForTimer(63)).toBeCloseTo(873.9126, 4)
    expect(triangleDetuneCents(81)).toBeCloseTo(-12.017, 3)
  })

  it('triangle timer 126 gives the same 440.3969 Hz as pulse timer 253', () => {
    expect(triangleHzForTimer(126)).toBeCloseTo(pulseHzForTimer(253), 9)
    expect(triangleTimerForMidi(69)).toBe(126)
  })

  it('the highest audible pulse is timer 8 → 12 429.0 Hz', () => {
    expect(pulseMaxAudibleHz()).toBeCloseTo(12429.0, 1)
  })
})

describe('88-key snapshot table', () => {
  it('matches the pinned timers for every key', () => {
    const actual: number[] = []
    for (let note = 21; note <= 108; note++) actual.push(pulseTimerForMidi(note))
    expect(actual).toEqual(PULSE_88)
    expect(actual.length).toBe(88)
  })

  it('timers decrease monotonically as pitch rises', () => {
    for (let i = 13; i < PULSE_88.length; i++) {
      expect(PULSE_88[i]).toBeLessThan(PULSE_88[i - 1])
    }
  })

  it('plan B2’s "A0 t=4067 (−0.142 c)" is a TRIANGLE anchor — t = 2033 — not a pulse one', () => {
    // The frequency and the detune in plan B2 are exactly right: fCPU/(16·4068) =
    // 27.4977 Hz = −0.142 cents. But 4067 is not a writable pulse timer — the pulse
    // register is ELEVEN bits (0..2047). The identical frequency comes off the triangle,
    // which divides by 32 rather than 16, at t = 2033 (32·2034 === 16·4068).
    expect(32 * 2034).toBe(16 * 4068)
    expect(4067).toBeGreaterThan(MAX_TIMER)
    expect(triangleTimerForMidi(21)).toBe(2033)
    expect(triangleHzForTimer(2033)).toBeCloseTo(27.4977, 4)
    expect(triangleDetuneCents(21)).toBeCloseTo(-0.142, 3)
  })

  it('A0 is out of range for the pulse channels — every note below A1 clamps', () => {
    // The lowest pulse pitch is t = 2047 → 54.62 Hz. FamiTracker's 2A03 note table
    // starts at A-1 for exactly this reason; the UI must not offer lower pulse notes
    // as if they were in tune.
    expect(pulseHzForTimer(MAX_TIMER)).toBeCloseTo(54.6195, 4)
    for (let note = 21; note <= 32; note++) expect(pulseTimerForMidi(note)).toBe(MAX_TIMER)
    // A1 lands on the same divider 2033 as triangle A0, so it carries the same
    // −0.142 cents — one octave apart, one divider apart in the two clock domains.
    expect(pulseTimerForMidi(33)).toBe(2033)
    expect(pulseDetuneCents(33)).toBeCloseTo(-0.142, 3)
  })

  it('every reachable key is within 20 cents, and most within 3', () => {
    let worst = 0
    let within3 = 0
    let reachable = 0
    for (let note = 33; note <= 108; note++) {
      const cents = Math.abs(pulseDetuneCents(note))
      reachable++
      if (cents < 3) within3++
      if (cents > worst) worst = cents
    }
    // Worst is B7 (MIDI 107) at 19.16 cents: the divider steps get coarse at the top,
    // where one integer of timer is worth a fifth of a semitone.
    expect(worst).toBeCloseTo(19.1567, 3)
    expect(worst).toBeLessThan(20)
    expect(within3 / reachable).toBeGreaterThan(0.6)
  })
})

describe('midiToHz', () => {
  it('anchors on A4 = 440', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(57)).toBeCloseTo(220, 12)
    expect(midiToHz(81)).toBeCloseTo(880, 12)
    expect(midiToHz(60)).toBeCloseTo(261.6255653006, 9)
    expect(midiToHz(21)).toBeCloseTo(27.5, 12)
  })
})

describe('end-to-end A440 — both measurement methods, on the shipped signal path', () => {
  const SAMPLE_RATE = 48000
  const IDEAL_HZ = pulseHzForTimer(253)
  const signal = renderTrace(pulseNoteOnTrace(0, 253, 2, 15), {
    sampleRate: SAMPLE_RATE,
    durationSamples: 65536,
  })

  it('zero-crossing measures 440.397 Hz', () => {
    const hz = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 4800)
    expect(hz).toBeCloseTo(440.397, 2)
    expect(Math.abs(centsBetween(hz, IDEAL_HZ))).toBeLessThan(0.05)
  })

  it('interpolated DFT independently measures 440.393 Hz', () => {
    const hz = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(hz).toBeCloseTo(440.393, 2)
    expect(Math.abs(centsBetween(hz, IDEAL_HZ))).toBeLessThan(0.05)
  })

  it('the two methods agree to better than a tenth of a cent', () => {
    const zc = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 4800)
    const dft = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(zc, dft))).toBeLessThan(0.1)
  })

  it('the M8(a) acceptance criterion: A440 within ±3 cents by both methods', () => {
    const zc = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 4800)
    const dft = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(zc, 440))).toBeLessThan(3)
    expect(Math.abs(centsBetween(dft, 440))).toBeLessThan(3)
    // And the residual is the hardware's, not ours: +1.561 cents.
    expect(centsBetween(zc, 440)).toBeCloseTo(1.561, 1)
  })

  it('holds at 44.1 kHz too — nothing in the engine is 48 kHz-specific', () => {
    const sig = renderTrace(pulseNoteOnTrace(0, 253, 2, 15), {
      sampleRate: 44100,
      durationSamples: 65536,
    })
    const hz = zeroCrossingHz(sig, 44100, 0.25, 4410)
    expect(Math.abs(centsBetween(hz, IDEAL_HZ))).toBeLessThan(0.1)
  })
})
