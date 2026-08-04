import { describe, expect, it } from 'vitest'
import {
  KAISER_BETA,
  KERNEL_CUTOFF,
  KERNEL_GROUP_DELAY,
  KERNEL_HALF,
  KERNEL_ROWS,
  KERNEL_WIDTH,
  PHASE_COUNT,
  STEP_KERNEL,
  besselI0,
  buildStepKernel,
} from '../../src/audio/dsp/kernel'

function rowSum(table: Float64Array, p: number): number {
  let s = 0
  for (let i = 0; i < KERNEL_WIDTH; i++) s += table[p * KERNEL_WIDTH + i]
  return s
}

function rowSnapshot(table: Float64Array, p: number): string[] {
  const out: string[] = []
  for (let i = 0; i < KERNEL_WIDTH; i++) out.push(table[p * KERNEL_WIDTH + i].toPrecision(12))
  return out
}

/** 12-significant-figure snapshots. These are the kernel; if they move, the engine's
 *  output moves, and that must be a deliberate decision rather than a diff nobody
 *  looked at. */
const ROW_0 = [
  '-0.00000855263036337',
  '-0.0000119884272947',
  '0.000139665164050',
  '-0.000535947064137',
  '0.00146059358258',
  '-0.00326283874390',
  '0.00633458943097',
  '-0.0110240503055',
  '0.0175228405775',
  '-0.0257540599550',
  '0.0352969301911',
  '-0.0453808182615',
  '0.0549663551019',
  '-0.0629073515555',
  '0.0681615967904',
  '0.930003471226',
  '0.0681615967904',
  '-0.0629073515555',
  '0.0549663551019',
  '-0.0453808182615',
  '0.0352969301911',
  '-0.0257540599550',
  '0.0175228405775',
  '-0.0110240503055',
  '0.00633458943097',
  '-0.00326283874390',
  '0.00146059358258',
  '-0.000535947064137',
  '0.000139665164050',
  '-0.0000119884272947',
  '-0.00000855263036337',
  '0.00000260098354376',
]

const ROW_32 = [
  '0.0000227995287836',
  '-0.000107217174629',
  '0.000312460075798',
  '-0.000700987207728',
  '0.00129784988656',
  '-0.00202702818594',
  '0.00263289937603',
  '-0.00260263866133',
  '0.00110533050605',
  '0.00305129723421',
  '-0.0114878950386',
  '0.0264926602805',
  '-0.0519128496806',
  '0.0966255881757',
  '-0.192551207957',
  '0.629848938843',
  '0.629848938843',
  '-0.192551207957',
  '0.0966255881757',
  '-0.0519128496806',
  '0.0264926602805',
  '-0.0114878950386',
  '0.00305129723421',
  '0.00110533050605',
  '-0.00260263866133',
  '0.00263289937603',
  '-0.00202702818594',
  '0.00129784988656',
  '-0.000700987207728',
  '0.000312460075798',
  '-0.000107217174629',
  '0.0000227995287836',
]

describe('kernel — shape and constants', () => {
  it('is 65 rows of 32 taps', () => {
    expect(KERNEL_ROWS).toBe(65)
    expect(KERNEL_WIDTH).toBe(32)
    expect(KERNEL_HALF).toBe(16)
    expect(PHASE_COUNT).toBe(64)
    expect(KAISER_BETA).toBe(10.0)
    expect(KERNEL_CUTOFF).toBe(0.465)
    expect(KERNEL_GROUP_DELAY).toBe(15)
    expect(STEP_KERNEL.length).toBe(KERNEL_ROWS * KERNEL_WIDTH)
    expect(STEP_KERNEL).toBeInstanceOf(Float64Array)
  })

  it('has one guard row past the last phase, so interpolation never reads past the end', () => {
    // addDelta interpolates rows p0 and p0+1 with p0 ∈ [0, PHASE_COUNT-1].
    expect(KERNEL_ROWS).toBe(PHASE_COUNT + 1)
  })
})

describe('kernel — normalisation (mandatory)', () => {
  it('every row sums to 1.0 within 1e-12', () => {
    let worst = 0
    for (let p = 0; p < KERNEL_ROWS; p++) {
      const err = Math.abs(rowSum(STEP_KERNEL, p) - 1)
      if (err > worst) worst = err
    }
    // Measured: 7.77e-16, i.e. a few ulps.
    expect(worst).toBeLessThan(1e-12)
  })

  it('un-normalised rows would NOT sum to 1 — the normalisation is load-bearing', () => {
    // Rebuild the raw windowed sinc for phase 32 and show the sum is meaningfully off.
    const invI0 = 1 / besselI0(KAISER_BETA)
    const twoC = 2 * KERNEL_CUTOFF
    let raw = 0
    for (let i = 0; i < KERNEL_WIDTH; i++) {
      const x = i - KERNEL_GROUP_DELAY - 32 / PHASE_COUNT
      const a = twoC * x
      const sinc = a === 0 ? twoC : (twoC * Math.sin(Math.PI * a)) / (Math.PI * a)
      const r = x / KERNEL_HALF
      const rr = 1 - r * r
      raw += sinc * (rr <= 0 ? invI0 : besselI0(KAISER_BETA * Math.sqrt(rr)) * invI0)
    }
    expect(Math.abs(raw - 1)).toBeGreaterThan(1e-6)
  })
})

describe('kernel — symmetry', () => {
  it('phase 0 is symmetric about tap 15 (the group delay)', () => {
    for (let k = 1; k <= 15; k++) {
      expect(STEP_KERNEL[15 + k]).toBeCloseTo(STEP_KERNEL[15 - k], 15)
    }
  })

  it('phase 32 (the half-sample row) is symmetric about the tap pair 15/16', () => {
    for (let i = 0; i < KERNEL_WIDTH; i++) {
      expect(STEP_KERNEL[32 * KERNEL_WIDTH + i]).toBe(
        STEP_KERNEL[32 * KERNEL_WIDTH + (31 - i)],
      )
    }
  })

  it('the guard row is phase 0 shifted one tap right', () => {
    // Each row is normalised independently, so the two agree to a couple of ULPs
    // rather than bit-for-bit.
    for (let i = 0; i < KERNEL_WIDTH - 1; i++) {
      const a = STEP_KERNEL[64 * KERNEL_WIDTH + i + 1]
      const b = STEP_KERNEL[i]
      expect(Math.abs(a - b)).toBeLessThan(1e-15)
    }
  })
})

describe('kernel — 12-significant-figure snapshots', () => {
  it('phase 0 matches', () => {
    expect(rowSnapshot(STEP_KERNEL, 0)).toEqual(ROW_0)
  })

  it('phase 32 matches', () => {
    expect(rowSnapshot(STEP_KERNEL, 32)).toEqual(ROW_32)
  })

  it('rebuilding produces the identical table', () => {
    const rebuilt = buildStepKernel()
    for (let i = 0; i < STEP_KERNEL.length; i++) expect(rebuilt[i]).toBe(STEP_KERNEL[i])
  })
})

describe('besselI0', () => {
  it('I0(0) = 1', () => {
    expect(besselI0(0)).toBe(1)
  })

  it('matches published values', () => {
    // Abramowitz & Stegun table values.
    expect(besselI0(1)).toBeCloseTo(1.2660658778, 9)
    expect(besselI0(2)).toBeCloseTo(2.2795853023, 9)
    expect(besselI0(5)).toBeCloseTo(27.239871823, 7)
    expect(besselI0(10)).toBeCloseTo(2815.7166284, 5)
  })
})
