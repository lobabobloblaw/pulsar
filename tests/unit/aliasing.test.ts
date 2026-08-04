/** The headline test.
 *
 *  A 50 % pulse at timer 8 runs at 12 429.0 Hz, which is a hair above a quarter of the
 *  48 kHz sample rate. Its 3rd harmonic (37 287 Hz) and 5th (62 145 Hz) both sit past
 *  Nyquist, so a naive renderer folds them back to 10 713 Hz and 14 145 Hz — two loud,
 *  inharmonic tones sitting right in the middle of the ear's most sensitive band. This
 *  is the single most audible failure mode of a chiptune engine.
 *
 *  Band-limited step synthesis has to put those images below −70 dBc. The anti-vacuity
 *  half of this file is what makes that claim mean anything: the SAME assertions are
 *  applied to a naive control renderer that differs only in how it samples the duty
 *  sequencer, and they must FAIL.
 */
import { describe, expect, it } from 'vitest'
import { dBc, magnitudeSpectrum, peakMagnitudeNear } from '../helpers/dft'
import { renderNaivePulse } from '../helpers/naivePulse'
import { pulseNoteOnTrace, renderTrace } from '../helpers/renderTrace'
import { hasNonFinite, maxAbs } from '../helpers/analysis'
import { dftFundamentalHz } from '../helpers/analysis'

const SAMPLE_RATE = 48000
const TIMER = 8
const DUTY = 2
const VOLUME = 15
const FFT_SIZE = 32768
/** Skip the filter start-up transient before analysing. */
const SKIP = 16384
const TOTAL = FFT_SIZE + SKIP

const FUNDAMENTAL_HZ = 12429.0
/** 3rd harmonic 37 287 Hz folded about 48 kHz. */
const IMAGE_1_HZ = 10713
/** 5th harmonic 62 145 Hz folded about 48 kHz. */
const IMAGE_2_HZ = 14145

interface Images {
  image1: number
  image2: number
  worst: number
  worstHz: number
}

function measureImages(signal: Float32Array): Images {
  const mag = magnitudeSpectrum(signal, SKIP, FFT_SIZE)
  const carrier = peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, FUNDAMENTAL_HZ, 30)
  let worst = Number.NEGATIVE_INFINITY
  let worstHz = 0
  for (let i = 8; i < mag.length; i++) {
    const hz = (i * SAMPLE_RATE) / FFT_SIZE
    if (hz < 60 || Math.abs(hz - FUNDAMENTAL_HZ) < 300) continue
    const db = dBc(mag[i], carrier)
    if (db > worst) {
      worst = db
      worstHz = hz
    }
  }
  return {
    image1: dBc(peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, IMAGE_1_HZ, 30), carrier),
    image2: dBc(peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, IMAGE_2_HZ, 30), carrier),
    worst,
    worstHz,
  }
}

function bandlimited(analogFilters: boolean): Float32Array {
  return renderTrace(pulseNoteOnTrace(0, TIMER, DUTY, VOLUME), {
    sampleRate: SAMPLE_RATE,
    durationSamples: TOTAL,
    analogFilters,
  })
}

function naive(analogFilters: boolean): Float32Array {
  return renderNaivePulse({
    timer: TIMER,
    duty: DUTY,
    volume: VOLUME,
    sampleRate: SAMPLE_RATE,
    durationSamples: TOTAL,
    filterModel: analogFilters ? 'nes' : 'none',
  })
}

describe('the two renderers are otherwise comparable', () => {
  it('both produce the same fundamental — only the sampling differs', () => {
    const a = dftFundamentalHz(bandlimited(true), SAMPLE_RATE, SKIP, FFT_SIZE, 8000, 16000)
    const b = dftFundamentalHz(naive(true), SAMPLE_RATE, SKIP, FFT_SIZE, 8000, 16000)
    expect(a).toBeCloseTo(FUNDAMENTAL_HZ, 0)
    expect(Math.abs(a - b)).toBeLessThan(2)
  })

  it('both stay in range and finite', () => {
    for (const sig of [bandlimited(true), naive(true)]) {
      expect(hasNonFinite(sig)).toBe(false)
      expect(maxAbs(sig)).toBeLessThanOrEqual(1)
      expect(maxAbs(sig)).toBeGreaterThan(0.1)
    }
  })
})

describe('band-limited synthesis — the gate', () => {
  const images = measureImages(bandlimited(true))

  it(`folds the 3rd harmonic to ${IMAGE_1_HZ} Hz at ≤ −70 dBc`, () => {
    expect(images.image1).toBeLessThanOrEqual(-70)
    // Measured −129.5 dBc on the shipped NES filter chain.
    expect(images.image1).toBeLessThan(-120)
  })

  it(`folds the 5th harmonic to ${IMAGE_2_HZ} Hz at ≤ −70 dBc`, () => {
    expect(images.image2).toBeLessThanOrEqual(-70)
    expect(images.image2).toBeLessThan(-115)
  })

  it('has no spurious component anywhere above −70 dBc', () => {
    expect(images.worst).toBeLessThanOrEqual(-70)
    // Measured −97.9 dBc, which is the Blackman–Harris analysis floor rather than the
    // engine — the real images are below what this window can resolve.
    expect(images.worst).toBeLessThan(-90)
  })

  it('holds without the analog filters too, so the rejection is the kernel’s', () => {
    const raw = measureImages(bandlimited(false))
    expect(raw.image1).toBeLessThanOrEqual(-70)
    expect(raw.image2).toBeLessThanOrEqual(-70)
  })
})

describe('anti-vacuity — the same assertions must FAIL on the naive control renderer', () => {
  const images = measureImages(naive(true))

  it('the naive renderer aliases at better than −25 dBc, as designed', () => {
    expect(images.image1).toBeGreaterThan(-25)
    expect(images.image2).toBeGreaterThan(-25)
    // Measured −9.8 dBc and −14.4 dBc: a square wave's 3rd and 5th harmonics, folded
    // back at essentially full strength.
    expect(images.image1).toBeCloseTo(-9.83, 1)
    expect(images.image2).toBeCloseTo(-14.39, 1)
  })

  it('the −70 dBc assertion literally throws when applied to the control', () => {
    expect(() => expect(images.image1).toBeLessThanOrEqual(-70)).toThrow()
    expect(() => expect(images.image2).toBeLessThanOrEqual(-70)).toThrow()
  })

  it('the gap between the two renderers is more than 100 dB', () => {
    const good = measureImages(bandlimited(true))
    expect(images.image1 - good.image1).toBeGreaterThan(100)
    expect(images.image2 - good.image2).toBeGreaterThan(100)
  })

  it('and it is not an artefact of the analog chain — the raw control aliases too', () => {
    const raw = measureImages(naive(false))
    expect(raw.image1).toBeGreaterThan(-25)
    expect(raw.image2).toBeGreaterThan(-25)
  })
})

/** Worst spurious component strictly below `hiHz`, relative to the fundamental. */
function worstBelow(signal: Float32Array, hiHz: number): { db: number; hz: number } {
  const mag = magnitudeSpectrum(signal, SKIP, FFT_SIZE)
  const carrier = peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, FUNDAMENTAL_HZ, 30)
  let db = Number.NEGATIVE_INFINITY
  let hz = 0
  for (let i = 8; i < mag.length; i++) {
    const f = (i * SAMPLE_RATE) / FFT_SIZE
    if (f < 60 || f >= hiHz || Math.abs(f - FUNDAMENTAL_HZ) < 300) continue
    const v = dBc(mag[i], carrier)
    if (v > db) {
      db = v
      hz = f
    }
  }
  return { db, hz }
}

describe('other duties and pitches stay clean', () => {
  // Duties 0, 1 and 3 are asymmetric, so unlike duty 2 they have EVEN harmonics. At
  // timer 8 the 2nd harmonic sits at 24 858 Hz — just 858 Hz past Nyquist, inside the
  // kernel's transition band rather than its stopband — and folds back to 23 142 Hz at
  // about −26 dBc. That is inherent to a 32-tap / 64-phase interpolated kernel and is
  // shared by every step-insertion engine; 23 kHz is also inaudible. What matters, and
  // what is asserted here, is that nothing lands in the audible band.
  const AUDIBLE_HZ = 20000

  for (const duty of [0, 1, 3]) {
    it(`duty ${duty} at timer 8 keeps every AUDIBLE image below −70 dBc`, () => {
      const sig = renderTrace(pulseNoteOnTrace(0, TIMER, duty, VOLUME), {
        sampleRate: SAMPLE_RATE,
        durationSamples: TOTAL,
      })
      expect(worstBelow(sig, AUDIBLE_HZ).db).toBeLessThanOrEqual(-70)
      // The two images the gate names are far below that.
      const images = measureImages(sig)
      expect(images.image1).toBeLessThan(-110)
      expect(images.image2).toBeLessThan(-105)
    })
  }

  it('documents the ultrasonic transition-band residue for asymmetric duties', () => {
    const sig = renderTrace(pulseNoteOnTrace(0, TIMER, 0, VOLUME), {
      sampleRate: SAMPLE_RATE,
      durationSamples: TOTAL,
    })
    const all = worstBelow(sig, SAMPLE_RATE / 2)
    expect(all.hz).toBeCloseTo(SAMPLE_RATE - 2 * FUNDAMENTAL_HZ, -2)
    expect(all.db).toBeCloseTo(-26.2, 0)
    expect(all.hz).toBeGreaterThan(AUDIBLE_HZ)
    // Duty 2 has no even harmonics, so it does not have this residue at all.
    const symmetric = worstBelow(bandlimited(true), SAMPLE_RATE / 2)
    expect(symmetric.db).toBeLessThan(-90)
  })

  it('a mid-range note (A440, timer 253) has a clean harmonic series', () => {
    const sig = renderTrace(pulseNoteOnTrace(0, 253, 2, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: TOTAL,
    })
    const mag = magnitudeSpectrum(sig, SKIP, FFT_SIZE)
    const carrier = peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, 440.397, 30)
    // A 50 % square has no even harmonics; the 2nd must be far down.
    const second = peakMagnitudeNear(mag, SAMPLE_RATE, FFT_SIZE, 880.79, 20)
    expect(dBc(second, carrier)).toBeLessThan(-60)
  })
})
