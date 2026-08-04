/** Tempo — the arithmetic that must not drift (design §2.2, §2.3).
 *
 *  Headline assertions:
 *    - E=60 S=6 T=160 produces row lengths 6,6,5,6,6,5,6,5 and returns the accumulator
 *      to ZERO after 8 rows — character for character the `F06 F06 F05 F06 F06 F05
 *      F06 F05` expansion FamiTracker's own documentation gives for tempo 160.
 *    - E=60 S=6 T=150 is 6 ticks per row exactly, forever, with no alternation.
 *    - E=60 S=6 T=140 alternates and CANNOT drift: 700 rows sum to exactly
 *      round(700 · 1800 / 280).
 *    - `bpm = 24T/(S·rowHighlight)` and `bpm = 60E/(tpr·rowHighlight)` agree over a
 *      200-case sweep — the two published formulas, asserted together so a future edit
 *      cannot break them apart.
 *    - `cycleOfTick` is exact for an hour at 60 Hz AND ten hours at engineSpeed 400.
 *    - the hidden-tab lookahead is bounded by RING OCCUPANCY, not by a constant.
 */
import { describe, expect, it } from 'vitest'
import {
  HIDDEN_PUMP_MS,
  LOOKAHEAD_MS,
  PUMP_MS,
  RING_OCCUPANCY_BUDGET,
  RowAccumulator,
  bpmFromTempo,
  bpmFromTicks,
  cycleOfTick,
  evenTicksPerRow,
  exactTickLimit,
  hiddenLookaheadMs,
  isEvenTempo,
  tempoRatio,
  ticksInRow,
  ticksPerRow,
  worstRingOccupancy,
} from '../../src/tracker/driver/tempo'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'

/** Row lengths in ticks, straight off the accumulator. */
function rowLengths(engineSpeed: number, speed: number, tempo: number, rows: number): number[] {
  const acc = new RowAccumulator()
  acc.setRatio(engineSpeed, speed, tempo)
  const out: number[] = []
  let ticks = 0
  while (out.length < rows) {
    ticks++
    const advanced = acc.step()
    if (advanced === 0) continue
    out.push(ticks)
    // Below one tick per row (speed 1 at a high tempo) several rows land on one tick;
    // the extras are genuinely zero-length.
    for (let i = 1; i < advanced && out.length < rows; i++) out.push(0)
    ticks = 0
  }
  return out
}

function residueAfter(engineSpeed: number, speed: number, tempo: number, rows: number): number {
  const acc = new RowAccumulator()
  acc.setRatio(engineSpeed, speed, tempo)
  let done = 0
  while (done < rows) done += acc.step()
  return acc.accum
}

describe('the F06 @ tempo 160 validation vector', () => {
  it('reproduces the documented 6,6,5,6,6,5,6,5 groove', () => {
    expect(rowLengths(60, 6, 160, 8)).toEqual([6, 6, 5, 6, 6, 5, 6, 5])
  })

  it('spells the documented expansion string', () => {
    const spelled = rowLengths(60, 6, 160, 8)
      .map((n) => `F0${n}`)
      .join(' ')
    expect(spelled).toBe('F06 F06 F05 F06 F06 F05 F06 F05')
  })

  it('returns the accumulator to zero after 8 rows, having spent 45 ticks', () => {
    expect(residueAfter(60, 6, 160, 8)).toBe(0)
    const total = rowLengths(60, 6, 160, 8).reduce((a, b) => a + b, 0)
    expect(total).toBe(45)
    // 45 ticks / 8 rows = 5.625 = 2.5·60·6/160, exactly.
    expect(total / 8).toBe(ticksPerRow(60, 6, 160))
  })
})

describe('the even case', () => {
  it('F150 / speed 6 is 6 ticks per row with no alternation', () => {
    expect(ticksPerRow(60, 6, 150)).toBe(6)
    expect(new Set(rowLengths(60, 6, 150, 64))).toEqual(new Set([6]))
    expect(residueAfter(60, 6, 150, 64)).toBe(0)
  })

  it('ticksPerRow is an integer iff tempo === 2.5 · engineSpeed', () => {
    expect(isEvenTempo(60, 150)).toBe(true)
    expect(isEvenTempo(50, 125)).toBe(true)
    expect(isEvenTempo(60, 160)).toBe(false)
    for (let speed = 1; speed <= 31; speed++) {
      expect(Number.isInteger(ticksPerRow(60, speed, 150))).toBe(true)
    }
  })
})

describe('the alternating case, and why it cannot drift', () => {
  it('T=140 / S=6 alternates 7 and 6 on a 7-row period', () => {
    const first24 = rowLengths(60, 6, 140, 24)
    expect(first24).toEqual([
      7, 6, 7, 6, 7, 6, 6, 7, 6, 7, 6, 7, 6, 6, 7, 6, 7, 6, 7, 6, 6, 7, 6, 7,
    ])
    // The period is 7 rows / 45 ticks, and 45/7 === 1800/280.
    expect(first24.slice(0, 7).reduce((a, b) => a + b, 0)).toBe(45)
    expect(45 / 7).toBeCloseTo(ticksPerRow(60, 6, 140), 12)
  })

  it('700 rows sum to exactly round(700 · num / den) — zero accumulated error', () => {
    const { num, den } = tempoRatio(60, 6, 140)
    const total = rowLengths(60, 6, 140, 700).reduce((a, b) => a + b, 0)
    expect(total).toBe(Math.round((700 * num) / den))
    expect(residueAfter(60, 6, 140, 700)).toBe(0)
  })

  it('sweeps every tempo and never drifts by more than one tick', () => {
    for (let tempo = 32; tempo <= 255; tempo += 7) {
      for (let speed = 1; speed <= 31; speed += 5) {
        const { num, den } = tempoRatio(60, speed, tempo)
        const rows = 400
        const total = rowLengths(60, speed, tempo, rows).reduce((a, b) => a + b, 0)
        const ideal = (rows * num) / den
        expect(Math.abs(total - ideal), `T${tempo} S${speed}`).toBeLessThan(1)
      }
    }
  })

  it('ticksInRow is the closed form of the loop, for Gxx and Sxx', () => {
    const acc = new RowAccumulator()
    acc.setRatio(60, 6, 160)
    for (let row = 0; row < 16; row++) {
      const predicted = ticksInRow(acc.accum, acc.num, acc.den)
      let actual = 0
      while (acc.step() === 0) actual++
      expect(actual + 1).toBe(predicted)
    }
  })

  it('carries the residue across a mid-song Fxx instead of resetting it', () => {
    const acc = new RowAccumulator()
    acc.setRatio(60, 6, 160)
    acc.step()
    acc.step()
    const residue = acc.accum
    expect(residue).toBeGreaterThan(0)
    acc.setRatio(60, 3, 160) // an Fxx speed change
    expect(acc.accum).toBe(residue)
  })

  it('emits the backlog immediately when Fxx shrinks the row below the residue', () => {
    const acc = new RowAccumulator()
    acc.setRatio(60, 6, 150)
    for (let i = 0; i < 5; i++) acc.step()
    expect(acc.accum).toBe(1500)
    acc.setRatio(60, 1, 150) // F01: num drops to 300, well under the residue
    expect(acc.step()).toBe(6)
  })
})

describe('even tempo mode', () => {
  it('rounds ticksPerRow and never goes below 1', () => {
    expect(evenTicksPerRow(60, 6, 140)).toBe(6) // 6.4286 -> 6, i.e. +7 % tempo
    expect(evenTicksPerRow(60, 6, 160)).toBe(6) // 5.625  -> 6
    expect(evenTicksPerRow(60, 6, 150)).toBe(6)
    expect(evenTicksPerRow(60, 1, 255)).toBe(1)
  })
})

describe('the two BPM formulas', () => {
  it('agree over a 200-case sweep', () => {
    let cases = 0
    for (let tempo = 32; tempo <= 255; tempo += 11) {
      for (let speed = 1; speed <= 31; speed += 3) {
        for (const rh of [4, 8]) {
          const a = bpmFromTicks(60, speed, tempo, rh)
          const b = bpmFromTempo(speed, tempo, rh)
          expect(a).toBeCloseTo(b, 10)
          cases++
        }
      }
    }
    expect(cases).toBeGreaterThanOrEqual(200)
  })

  it('E cancels: engineSpeed does not move the BPM readout', () => {
    for (const e of [50, 60, 120, 400]) {
      expect(bpmFromTicks(e, 6, 150, 4)).toBeCloseTo(bpmFromTempo(6, 150, 4), 10)
    }
    expect(bpmFromTempo(6, 150, 4)).toBe(150)
  })
})

describe('cycleOfTick — closed form, exact, drift-free', () => {
  it('alternates 29 829 / 29 830 cycles at NTSC / 60 Hz, and that is correct', () => {
    const gaps = new Set<number>()
    for (let n = 0; n < 600; n++) {
      gaps.add(
        cycleOfTick(0, n + 1, NTSC_CPU_HZ, 60) - cycleOfTick(0, n, NTSC_CPU_HZ, 60),
      )
    }
    expect(gaps).toEqual(new Set([29829, 29830]))
  })

  it('has zero drift over an hour at 60 Hz', () => {
    const ticks = 216_000
    const c = cycleOfTick(0, ticks, NTSC_CPU_HZ, 60)
    expect(c).toBe(Math.floor((ticks * NTSC_CPU_HZ) / 60))
    // The closed form is exactly the ideal, so "drift" is bounded by one cycle by
    // construction rather than by an accumulator's luck.
    expect(Math.abs(c - (ticks * NTSC_CPU_HZ) / 60)).toBeLessThan(1)
  })

  it('is exact for ten hours at engineSpeed 400', () => {
    const ticks = 400 * 3600 * 10
    expect(ticks * NTSC_CPU_HZ).toBeLessThan(Number.MAX_SAFE_INTEGER)
    expect(Number.isSafeInteger(ticks * NTSC_CPU_HZ)).toBe(true)
    expect(ticks).toBeLessThan(exactTickLimit(NTSC_CPU_HZ))
  })

  it('is a pure function of the tick index — recomputing after a stall re-phases', () => {
    const origin = 1_234_567
    for (const n of [0, 1, 7, 999, 216_000]) {
      expect(cycleOfTick(origin, n, NTSC_CPU_HZ, 60)).toBe(
        cycleOfTick(origin, n, NTSC_CPU_HZ, 60),
      )
    }
    // A 500 ms stall costs a burst, never a tempo error: tick 60 is still exactly one
    // second after tick 0 regardless of when it was generated.
    expect(cycleOfTick(origin, 60, NTSC_CPU_HZ, 60) - origin).toBe(NTSC_CPU_HZ)
  })
})

describe('the pump window and its ring-occupancy bound', () => {
  it('pumps 6x faster than the lookahead when visible', () => {
    expect(PUMP_MS).toBe(20)
    expect(LOOKAHEAD_MS).toBe(120)
    expect(LOOKAHEAD_MS / PUMP_MS).toBe(6)
    expect(HIDDEN_PUMP_MS).toBe(250)
  })

  it('caps the hidden lookahead so the ring can never fill', () => {
    // At E=60 the occupancy cap is 2 381 ms, so the 1 500 ms ceiling wins; from E=120
    // up the ring bound is what binds.
    expect(hiddenLookaheadMs(60)).toBe(1500)
    expect(hiddenLookaheadMs(120)).toBeCloseTo(1190.476, 3)
    expect(hiddenLookaheadMs(240)).toBeCloseTo(595.238, 3)
    expect(hiddenLookaheadMs(400)).toBeCloseTo(357.143, 3)
    for (const e of [60, 120, 240, 400]) {
      expect(worstRingOccupancy(hiddenLookaheadMs(e), e)).toBeLessThanOrEqual(
        RING_OCCUPANCY_BUDGET + 1e-9,
      )
      expect(worstRingOccupancy(LOOKAHEAD_MS, e)).toBeLessThanOrEqual(RING_OCCUPANCY_BUDGET)
    }
  })

  it('anti-vacuity: an unbounded lookahead WOULD overflow the ring at E=400', () => {
    expect(worstRingOccupancy(1500, 400)).toBeGreaterThan(RING_OCCUPANCY_BUDGET)
  })
})
