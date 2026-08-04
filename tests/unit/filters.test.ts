import { describe, expect, it } from 'vitest'
import {
  AnalogFilterChain,
  OnePoleHighPass,
  OnePoleLowPass,
  onePoleCoeff,
} from '../../src/audio/core/filters'
import {
  FAMICOM_HP_HZ,
  NES_HP1_HZ,
  NES_HP2_HZ,
  NES_LP_HZ,
} from '../../src/audio/core/constants'
import { hasNonFinite, maxAbs } from '../helpers/analysis'

/** Analytic magnitude of the shipped one-pole sections, in dB. */
function magnitudeDb(k: number, hz: number, sampleRate: number, highPass: boolean): number {
  const w = (2 * Math.PI * hz) / sampleRate
  const den = Math.sqrt(1 - 2 * k * Math.cos(w) + k * k)
  const num = highPass ? k * Math.sqrt(2 - 2 * Math.cos(w)) : 1 - k
  return 20 * Math.log10(num / den)
}

/** The continuous-time RC prototype these sections model. */
function analogRcDb(hz: number, cutoffHz: number, highPass: boolean): number {
  const r = hz / cutoffHz
  return 20 * Math.log10(highPass ? r / Math.sqrt(1 + r * r) : 1 / Math.sqrt(1 + r * r))
}

describe('one-pole coefficients', () => {
  it('matches the pinned 48 kHz table to 1e-10', () => {
    expect(onePoleCoeff(NES_HP1_HZ, 48000)).toBeCloseTo(0.9882881515, 10)
    expect(onePoleCoeff(NES_HP2_HZ, 48000)).toBeCloseTo(0.9440313862, 10)
    expect(onePoleCoeff(NES_LP_HZ, 48000)).toBeCloseTo(0.1599977199, 10)
    expect(onePoleCoeff(FAMICOM_HP_HZ, 48000)).toBeCloseTo(0.9951684211, 10)
  })

  it('matches the pinned 44.1 kHz table to 1e-10', () => {
    expect(onePoleCoeff(NES_HP1_HZ, 44100)).toBeCloseTo(0.9872590350, 10)
    expect(onePoleCoeff(NES_HP2_HZ, 44100)).toBeCloseTo(0.9392351762, 10)
    expect(onePoleCoeff(NES_LP_HZ, 44100)).toBeCloseTo(0.1360596342, 10)
    expect(onePoleCoeff(FAMICOM_HP_HZ, 44100)).toBeCloseTo(0.9947422638, 10)
  })

  it('is k = exp(−2π·fc/fs) at every rate — the chain is rate-agnostic by construction', () => {
    for (const fs of [16000, 44100, 48000, 88200, 96000]) {
      expect(onePoleCoeff(440, fs)).toBe(Math.exp((-2 * Math.PI * 440) / fs))
    }
  })
})

describe('high-pass response', () => {
  it('rejects DC completely', () => {
    const hp = new OnePoleHighPass()
    hp.setCutoff(NES_HP1_HZ, 48000)
    let y = 0
    for (let i = 0; i < 200_000; i++) y = hp.process(0.5)
    expect(Math.abs(y)).toBeLessThan(1e-9)
  })

  it('is −3 dB at its corner, where fc ≪ fs (both NES high-passes)', () => {
    const k90 = onePoleCoeff(NES_HP1_HZ, 48000)
    const k440 = onePoleCoeff(NES_HP2_HZ, 48000)
    expect(magnitudeDb(k90, 90, 48000, true)).toBeCloseTo(-3.0615143, 5)
    expect(magnitudeDb(k440, 440, 48000, true)).toBeCloseTo(-3.2616364, 5)
    // Within half a dB of the analog prototype it models.
    expect(Math.abs(magnitudeDb(k90, 90, 48000, true) - analogRcDb(90, 90, true))).toBeLessThan(0.5)
    expect(
      Math.abs(magnitudeDb(k440, 440, 48000, true) - analogRcDb(440, 440, true)),
    ).toBeLessThan(0.5)
  })

  it('passes the audio band essentially untouched', () => {
    const k = onePoleCoeff(NES_HP1_HZ, 48000)
    expect(magnitudeDb(k, 2000, 48000, true)).toBeCloseTo(-0.06, 2)
    expect(magnitudeDb(k, 2000, 48000, true)).toBeGreaterThan(-0.1)
  })

  it('k = 1 is a bit-exact pass-through', () => {
    const hp = new OnePoleHighPass()
    hp.bypass()
    const input = [0.1, -0.7, 0.33, 0, 1, -1, 0.25]
    for (const x of input) expect(hp.process(x)).toBe(x)
  })
})

describe('low-pass response', () => {
  // NOTE — deliberate deviation from plan B3's "LP −3 dB ±0.5 at 14 kHz".
  // The coefficient formula and the six numeric coefficients are pinned by plan B7 and
  // this implementation reproduces them exactly (asserted above). With k = exp(−2π·fc/fs)
  // the corner only lands on fc while fc ≪ fs; at 14 kHz / 48 kHz that ratio is 0.29, and
  // the section is −1.96 dB at 14 kHz, reaching only −2.80 dB at Nyquist — it never
  // crosses −3 dB at all. The pinned coefficients win; the −3 dB figure describes the
  // analog RC prototype, asserted separately below.
  it('is −1.96 dB at 14 kHz @48 kHz and −1.80 dB @44.1 kHz', () => {
    expect(magnitudeDb(onePoleCoeff(NES_LP_HZ, 48000), 14000, 48000, false)).toBeCloseTo(
      -1.9614350,
      5,
    )
    expect(magnitudeDb(onePoleCoeff(NES_LP_HZ, 44100), 14000, 44100, false)).toBeCloseTo(
      -1.8027667,
      5,
    )
  })

  it('never reaches −3 dB below Nyquist — a documented consequence of the pinned k', () => {
    const k = onePoleCoeff(NES_LP_HZ, 48000)
    expect(magnitudeDb(k, 23999, 48000, false)).toBeCloseTo(-2.8035334, 4)
    expect(magnitudeDb(k, 23999, 48000, false)).toBeGreaterThan(-3)
  })

  it('the analog prototype it models IS −3.01 dB at 14 kHz', () => {
    expect(analogRcDb(14000, 14000, false)).toBeCloseTo(-3.0103, 4)
  })

  it('rolls off monotonically and passes DC exactly', () => {
    const k = onePoleCoeff(NES_LP_HZ, 48000)
    expect(magnitudeDb(k, 0, 48000, false)).toBeCloseTo(0, 12)
    let prev = 0
    for (let hz = 500; hz < 24000; hz += 500) {
      const db = magnitudeDb(k, hz, 48000, false)
      expect(db).toBeLessThan(prev)
      prev = db
    }
  })

  it('k = 0 is a bit-exact pass-through', () => {
    const lp = new OnePoleLowPass()
    lp.bypass()
    const input = [0.1, -0.7, 0.33, 0, 1, -1, 0.25]
    for (const x of input) expect(lp.process(x)).toBe(x)
  })
})

describe('AnalogFilterChain', () => {
  it('nes = HP90 → HP440 → LP14k', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'nes')
    expect(chain.hp1.k).toBeCloseTo(0.9882881515, 10)
    expect(chain.hp2.k).toBeCloseTo(0.9440313862, 10)
    expect(chain.lp.k).toBeCloseTo(0.1599977199, 10)
  })

  it('famicom = a single HP37, with the other two sections bit-exact identities', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'famicom')
    expect(chain.hp1.k).toBeCloseTo(0.9951684211, 10)
    expect(chain.hp2.k).toBe(1)
    expect(chain.lp.k).toBe(0)
  })

  it('none bypasses the whole chain bit-exactly', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'none')
    const input = [0.1, -0.7, 0.33, 0, 1, -1, 0.25, 0.5]
    for (const x of input) expect(chain.process(x)).toBe(x)
  })

  it('famicom keeps more bass than nes — the console-model toggle is audible', () => {
    const nes = new AnalogFilterChain()
    nes.setRates(48000, 'nes')
    const fam = new AnalogFilterChain()
    fam.setRates(48000, 'famicom')
    const hz = 120
    let nesPeak = 0
    let famPeak = 0
    for (let i = 0; i < 48000; i++) {
      const x = Math.sin((2 * Math.PI * hz * i) / 48000)
      const a = Math.abs(nes.process(x))
      const b = Math.abs(fam.process(x))
      if (i > 24000) {
        if (a > nesPeak) nesPeak = a
        if (b > famPeak) famPeak = b
      }
    }
    expect(famPeak).toBeGreaterThan(nesPeak * 1.5)
  })

  it('removes DC from a mixer-shaped signal (0 → 1 swing) within a second', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'nes')
    let y = 0
    for (let i = 0; i < 48000; i++) y = chain.process(0.25)
    expect(Math.abs(y)).toBeLessThan(1e-6)
  })

  it('stays bounded and finite over a million white-noise samples', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'nes')
    // Deterministic LCG — a flaky filter test is worse than no filter test.
    let seed = 0x2a03
    const out = new Float64Array(1_000_000)
    for (let i = 0; i < out.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      out[i] = chain.process(seed / 0x80000000 - 1)
    }
    expect(hasNonFinite(out)).toBe(false)
    expect(maxAbs(out)).toBeLessThan(2)
  })

  it('reset() clears state so a fresh note starts from silence', () => {
    const chain = new AnalogFilterChain()
    chain.setRates(48000, 'nes')
    for (let i = 0; i < 100; i++) chain.process(1)
    chain.reset()
    expect(chain.process(0)).toBe(0)
  })
})
