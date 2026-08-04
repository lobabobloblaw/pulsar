import { describe, expect, it } from 'vitest'
import { DUTY_BITSTRINGS, DUTY_LOOKUP, DUTY_OUTPUT } from '../../src/audio/core/tables'
import { DutySequencer } from '../../src/audio/core/units/dutySequencer'

const EXPECTED: readonly (readonly number[])[] = [
  [0, 1, 0, 0, 0, 0, 0, 0], // 12.5 %
  [0, 1, 1, 0, 0, 0, 0, 0], // 25 %
  [0, 1, 1, 1, 1, 0, 0, 0], // 50 %
  [1, 0, 0, 1, 1, 1, 1, 1], // 25 % negated
]

describe('duty tables', () => {
  it('the four output waveforms are the pinned bit strings', () => {
    expect(DUTY_BITSTRINGS).toEqual(['01000000', '01100000', '01111000', '10011111'])
    expect(DUTY_OUTPUT.length).toBe(32)
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < 8; i++) expect(DUTY_OUTPUT[d * 8 + i]).toBe(EXPECTED[d][i])
    }
  })

  it('duty cycles are 12.5 / 25 / 50 / 25 % as advertised', () => {
    const ones = (d: number): number => {
      let n = 0
      for (let i = 0; i < 8; i++) n += DUTY_OUTPUT[d * 8 + i]
      return n
    }
    expect(ones(0)).toBe(1)
    expect(ones(1)).toBe(2)
    expect(ones(2)).toBe(4)
    expect(ones(3)).toBe(6) // 25 % negated → 75 % high, still "25 %" by convention
  })

  it('output[i] === lookup[(8 − i) & 7] — the incrementing and decrementing forms agree', () => {
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < 8; i++) {
        expect(DUTY_OUTPUT[d * 8 + i]).toBe(DUTY_LOOKUP[d * 8 + ((8 - i) & 7)])
      }
    }
  })

  it('duty 3 is duty 1 inverted', () => {
    for (let i = 0; i < 8; i++) {
      expect(DUTY_OUTPUT[3 * 8 + i]).toBe(1 - DUTY_OUTPUT[1 * 8 + i])
    }
  })
})

describe('DutySequencer', () => {
  it('starts at step 0 of duty 0', () => {
    const seq = new DutySequencer()
    expect(seq.duty).toBe(0)
    expect(seq.step).toBe(0)
    expect(seq.output).toBe(0)
  })

  it('walks each waveform in order and wraps after 8 steps', () => {
    for (let d = 0; d < 4; d++) {
      const seq = new DutySequencer()
      seq.setDuty(d)
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 8; i++) {
          expect(seq.step).toBe(i)
          expect(seq.output).toBe(EXPECTED[d][i])
          seq.advance()
        }
      }
      expect(seq.step).toBe(0)
    }
  })

  it('reset() returns to step 0 and republishes the output — the $4003 phase-reset click', () => {
    const seq = new DutySequencer()
    seq.setDuty(2)
    seq.advance()
    seq.advance()
    expect(seq.step).toBe(2)
    expect(seq.output).toBe(1)
    seq.reset()
    expect(seq.step).toBe(0)
    expect(seq.output).toBe(0)
  })

  it('changing duty mid-phase keeps the step and re-reads the new waveform', () => {
    const seq = new DutySequencer()
    seq.setDuty(0)
    seq.advance()
    seq.advance()
    expect(seq.step).toBe(2)
    expect(seq.output).toBe(0) // duty 0 step 2
    seq.setDuty(1)
    expect(seq.step).toBe(2)
    expect(seq.output).toBe(1) // duty 1 step 2
  })

  it('masks the duty index to two bits', () => {
    const seq = new DutySequencer()
    seq.setDuty(6)
    expect(seq.duty).toBe(2)
  })
})
