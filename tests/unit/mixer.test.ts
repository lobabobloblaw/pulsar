import { describe, expect, it } from 'vitest'
import { PULSE_LUT, TND_LUT } from '../../src/audio/core/tables'
import { mixExact, mixLinear, mixLut } from '../../src/audio/core/mixer'

describe('PULSE_LUT', () => {
  it('has 31 entries and index 0 is exactly zero', () => {
    expect(PULSE_LUT.length).toBe(31)
    expect(PULSE_LUT[0]).toBe(0)
  })

  it('matches the pinned spot values to 1e-9', () => {
    expect(PULSE_LUT[1]).toBeCloseTo(0.01160913952, 9)
    expect(PULSE_LUT[2]).toBeCloseTo(0.02293948127, 9)
    expect(PULSE_LUT[15]).toBeCloseTo(0.1488159535, 9)
    expect(PULSE_LUT[16]).toBeCloseTo(0.1571052632, 9)
    expect(PULSE_LUT[30]).toBeCloseTo(0.2575125809, 9)
  })

  it('is strictly monotonic', () => {
    for (let n = 1; n < 31; n++) expect(PULSE_LUT[n]).toBeGreaterThan(PULSE_LUT[n - 1])
  })

  it('sits a CONSTANT −0.375 % below the exact formula (deviation D-M2)', () => {
    let min = Infinity
    let max = -Infinity
    for (let n = 1; n < 31; n++) {
      const dev = PULSE_LUT[n] / mixExact(n, 0, 0, 0, 0) - 1
      if (dev < min) min = dev
      if (dev > max) max = dev
    }
    // The 95.52 numerator differs from the exact 95.88 by a pure scale factor, so the
    // deviation is identical at every index — that is what makes it a renormalisation
    // rather than an error.
    expect(max - min).toBeLessThan(1e-15)
    expect(min).toBeCloseTo(-0.00375469336671, 12)
  })
})

describe('TND_LUT', () => {
  it('has 203 entries and index 0 is exactly zero', () => {
    expect(TND_LUT.length).toBe(203)
    expect(TND_LUT[0]).toBe(0)
  })

  it('matches the pinned spot values to 1e-9', () => {
    expect(TND_LUT[1]).toBeCloseTo(0.006699823980, 9)
    expect(TND_LUT[45]).toBeCloseTo(0.2554771237, 9)
    expect(TND_LUT[90]).toBeCloseTo(0.4419664556, 9)
    expect(TND_LUT[127]).toBeCloseTo(0.5613462421, 9)
    expect(TND_LUT[202]).toBeCloseTo(0.7424676054, 9)
  })

  it('is strictly monotonic', () => {
    for (let n = 1; n < 203; n++) expect(TND_LUT[n]).toBeGreaterThan(TND_LUT[n - 1])
  })

  it('stays inside NESdev’s "within 4 %" hedge, worst 4.66 % at index 1 (D-M1)', () => {
    let worst = 0
    let worstIndex = 0
    for (let n = 1; n < 203; n++) {
      // Exact TND output for a DMC-only excitation of the same index.
      const exact = 159.79 / (1 / (n / 22638) + 100)
      const rel = Math.abs(TND_LUT[n] / exact - 1)
      if (rel > worst) {
        worst = rel
        worstIndex = n
      }
    }
    expect(worstIndex).toBe(1)
    expect(worst).toBeCloseTo(0.0466199533742, 10)
    expect(worst).toBeLessThanOrEqual(0.047)
  })
})

describe('full-scale sum', () => {
  it('PULSE_LUT[30] + TND_LUT[202] = 0.999980186258', () => {
    expect(PULSE_LUT[30] + TND_LUT[202]).toBeCloseTo(0.999980186258, 9)
  })

  it('the LUT mixer therefore spans 0 → ~1 before DC removal', () => {
    expect(mixLut(0, 0, 0, 0, 0)).toBe(0)
    expect(mixLut(15, 15, 15, 15, 127)).toBeCloseTo(0.999980186258, 9)
  })
})

describe('mixLut composition', () => {
  it('indexes PULSE_LUT by pulse1 + pulse2', () => {
    expect(mixLut(7, 8, 0, 0, 0)).toBe(PULSE_LUT[15])
    expect(mixLut(15, 0, 0, 0, 0)).toBe(PULSE_LUT[15])
  })

  it('indexes TND_LUT by 3·triangle + 2·noise + dmc', () => {
    expect(mixLut(0, 0, 15, 0, 0)).toBe(TND_LUT[45])
    expect(mixLut(0, 0, 0, 15, 0)).toBe(TND_LUT[30])
    expect(mixLut(0, 0, 0, 0, 127)).toBe(TND_LUT[127])
    expect(mixLut(0, 0, 10, 5, 3)).toBe(TND_LUT[3 * 10 + 2 * 5 + 3])
  })

  it('DPCM ducks triangle and noise for free — the shared index IS the ducking', () => {
    const withoutDpcm = mixLut(0, 0, 15, 15, 0)
    const withDpcm = mixLut(0, 0, 15, 15, 60)
    // The TND group compresses: adding DPCM raises the total by less than DPCM alone.
    const dpcmAlone = mixLut(0, 0, 0, 0, 60)
    expect(withDpcm - withoutDpcm).toBeLessThan(dpcmAlone)
    expect(withDpcm).toBeGreaterThan(withoutDpcm)
  })
})

describe('mixExact reference', () => {
  it('is zero for silence and monotonic in every channel', () => {
    expect(mixExact(0, 0, 0, 0, 0)).toBe(0)
    expect(mixExact(1, 0, 0, 0, 0)).toBeGreaterThan(0)
    expect(mixExact(0, 0, 1, 0, 0)).toBeGreaterThan(0)
    expect(mixExact(0, 0, 0, 1, 0)).toBeGreaterThan(0)
    expect(mixExact(0, 0, 0, 0, 1)).toBeGreaterThan(0)
  })

  it('is what the two tables approximate, to within their documented error', () => {
    for (let p = 0; p <= 30; p++) {
      const lut = mixLut(p, 0, 0, 0, 0)
      const exact = mixExact(p, 0, 0, 0, 0)
      if (p === 0) continue
      expect(Math.abs(lut / exact - 1)).toBeLessThan(0.004)
    }
  })
})

describe('mixLinear', () => {
  it('is the NESdev first-order approximation and is audibly flatter', () => {
    expect(mixLinear(0, 0, 0, 0, 0)).toBe(0)
    expect(mixLinear(15, 15, 0, 0, 0)).toBeCloseTo(0.00752 * 30, 12)
    // The whole point of the LUT path: at full scale the linear mix is well below
    // the non-linear one for the pulses.
    expect(mixLinear(15, 15, 0, 0, 0)).toBeLessThan(mixLut(15, 15, 0, 0, 0))
  })
})
