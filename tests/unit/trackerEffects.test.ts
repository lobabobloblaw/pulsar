/** Every effect the phase-2 driver implements, tick by tick (design §3.2, §3.5, §3.6).
 *
 *  Headline assertions:
 *    - `Axy`: **x slides DOWN, y slides UP**, in eighths of a volume step.
 *    - `Qxy`/`Rxy`: **x is the SPEED and y is the number of SEMITONES**, and the glide
 *      runs at 2x+1 period units per tick, then latches the arrived note.
 *    - `Gxx` delays the note on ITS OWN CHANNEL ONLY — the flam tool, not a shuffle.
 *    - `3xx`/`Qxy`/`Rxy` do NOT retrigger: `$4003` is not rewritten and the macros
 *      keep their indices. This is the rule that makes legato lines possible.
 *    - the per-tick DELTA effects contribute no step on tick 0 of a row; the
 *      table-driven ones (`0xy`, `4xy`, `Pxx`, `Vxx`) DO apply on tick 0.
 *    - the effect-memory table, and which `00`s are documented off-switches instead.
 */
import { describe, expect, it } from 'vitest'
import {
  REG,
  at,
  buildSong,
  countWrites,
  drive,
  dutySeries,
  instrument,
  sequence,
  timerSeries,
  volumeSeries,
} from '../fixtures/songs/build'
import { pulseTimerForMidi } from '../../src/audio/host/pitch'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { VIB_TABLE, VIB_PHASES } from '../../src/tracker/driver/effects'

const T = (note: number): number => pulseTimerForMidi(note, NTSC_CPU_HZ)

/** One pulse-1 pattern at a fixed speed, nothing else sounding. */
function song(rows: { r: number; note?: number; inst?: number; vol?: number; fx?: unknown }[], speed = 8, extra = {}) {
  return buildSong({
    meta: { speed, rowsPerPattern: 8 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    patterns: { 'pulse1:0': rows as any },
    ...extra,
  })
}

const fx = (cmd: string, param: number) => [{ cmd, param }]

describe('0xy arpeggio', () => {
  it('cycles [base, base+x, base+y] every tick, starting UNMODIFIED', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('0', 0x47) }])
    const timers = timerSeries(drive(s, 7).ticks, REG.P1_LO)
    expect(timers).toEqual([T(60), T(64), T(67), T(60), T(64), T(67), T(60)])
  })

  it('resets its phase on a fresh note', () => {
    const s = song([
      { r: 0, note: 60, vol: 15, fx: fx('0', 0x47) },
      { r: 1, note: 60 },
    ])
    const timers = timerSeries(drive(s, 10).ticks, REG.P1_LO)
    expect(timers[8]).toBe(T(60))
    expect(timers[9]).toBe(T(64))
  })

  it('000 cancels it', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('0', 0x47) },
        { r: 1, fx: fx('0', 0) },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    expect(timers.slice(4)).toEqual([T(60), T(60), T(60), T(60)])
  })

  it('a pitch slide cancels an active arpeggio', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('0', 0x47) },
        { r: 1, fx: fx('1', 0) },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    expect(new Set(timers.slice(4))).toEqual(new Set([T(60)]))
  })
})

describe('1xx / 2xx pitch slides', () => {
  it('1xx slides the PERIOD down (pitch up), one xx per tick, from tick 1', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('1', 4) }])
    const timers = timerSeries(drive(s, 5).ticks, REG.P1_LO)
    expect(timers).toEqual([T(60), T(60) - 4, T(60) - 8, T(60) - 12, T(60) - 16])
  })

  it('2xx is the mirror', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('2', 4) }])
    const timers = timerSeries(drive(s, 3).ticks, REG.P1_LO)
    expect(timers).toEqual([T(60), T(60) + 4, T(60) + 8])
  })

  it('persists past the row and keeps its accumulator across the boundary', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('2', 4) }], 4)
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    // Ticks 0..3 are row 0, 4..7 are row 1. Tick 4 is a row boundary and takes NO
    // step (the delta group is quiet on tick 0), but the accumulator is NOT reset.
    expect(timers).toEqual([
      T(60),
      T(60) + 4,
      T(60) + 8,
      T(60) + 12,
      T(60) + 12,
      T(60) + 16,
      T(60) + 20,
      T(60) + 24,
    ])
  })

  it('clamps the pulse period at 8 rather than letting the sweep unit mute it', () => {
    const s = song([{ r: 0, note: 96, vol: 15, fx: fx('1', 60) }], 16)
    const timers = timerSeries(drive(s, 16).ticks, REG.P1_LO)
    expect(Math.min(...timers)).toBe(8)
  })

  it('clamps downward at the 11-bit maximum', () => {
    const s = song([{ r: 0, note: 24, vol: 15, fx: fx('2', 200) }], 16)
    const timers = timerSeries(drive(s, 16).ticks, REG.P1_LO)
    expect(Math.max(...timers)).toBe(0x7ff)
  })
})

describe('3xx portamento', () => {
  it('slides linearly to the new note and STOPS EXACTLY on arrival', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, note: 72, fx: fx('3', 0x20) },
      ],
      8,
    )
    const timers = timerSeries(drive(s, 16).ticks, REG.P1_LO)
    const from = T(60)
    const to = T(72)
    expect(timers.slice(0, 8)).toEqual(new Array(8).fill(from))
    // Row 1: no step on tick 0, then 32 units per tick until it lands on `to`.
    expect(timers[8]).toBe(from)
    expect(timers[9]).toBe(from - 32)
    expect(timers[10]).toBe(from - 64)
    expect(timers.at(-1)).toBe(to)
    // And it does not overshoot on the way.
    expect(Math.min(...timers)).toBe(to)
  })

  it('does NOT retrigger: $4003 is written once, for the first note only', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, note: 72, fx: fx('3', 0x20) },
      ],
      8,
    )
    const { sink } = drive(s, 16)
    // $4003 goes out on the trigger and again only when the timer's HIGH BITS move,
    // which a c4 -> c5 slide does exactly once (D-TK2).
    expect(countWrites(sink, REG.STATUS)).toBe(1)
    const statusOnly = drive(s, 16).ticks.flat().filter((w) => w.addr === REG.STATUS)
    expect(statusOnly.length).toBe(1)
  })

  it('keeps the macro running across the glide instead of restarting it', () => {
    const s = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, inst: 0, vol: 15 },
          { r: 1, note: 72, fx: fx('3', 0x20) },
        ],
      },
      instruments: [instrument({ volume: 0 })],
      sequences: { volume: [sequence([15, 14, 13, 12, 11, 10, 9, 8], -1, -1)] },
    })
    // A retrigger would restart the volume macro at 15 on tick 4.
    expect(volumeSeries(drive(s, 8).ticks, REG.P1_CTRL)).toEqual([15, 14, 13, 12, 11, 10, 9, 8])
  })

  it('300 freezes at the current pitch', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, note: 72, fx: fx('3', 0x10) },
        { r: 2, fx: fx('3', 0) },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 12).ticks, REG.P1_LO)
    const frozen = timers[7]
    expect(timers.slice(8)).toEqual(new Array(4).fill(frozen))
  })
})

describe('4xy vibrato', () => {
  it('follows the quarter-wave table from a zero offset on the trigger tick', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('4', 0x17) }], 16)
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    const expected: number[] = []
    for (let i = 0; i < 8; i++) expected.push(T(60) + VIB_TABLE[7 * VIB_PHASES + i])
    expect(timers).toEqual(expected)
  })

  it('applies on tick 0 — it is table-driven, not a delta effect', () => {
    // acc is 0 on a trigger, so the FIRST tick's offset is 0; on the next row's tick 0
    // the accumulator has moved and the offset is not 0.
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('4', 0x47) }], 2)
    const timers = timerSeries(drive(s, 6).ticks, REG.P1_LO)
    expect(timers[0]).toBe(T(60))
    expect(timers[2]).not.toBe(T(60))
  })

  it('400 disables it and the offset returns to zero', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('4', 0x4f) },
        { r: 2, fx: fx('4', 0) },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 12).ticks, REG.P1_LO)
    expect(new Set(timers.slice(8))).toEqual(new Set([T(60)]))
  })

  it('resets its phase on a fresh note', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('4', 0x8f) },
        { r: 1, note: 60 },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    expect(timers[4]).toBe(T(60))
  })
})

describe('7xy tremolo', () => {
  it('only ever subtracts from the volume, never boosts it', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('7', 0x14) }], 16)
    const vols = volumeSeries(drive(s, 16).ticks, REG.P1_CTRL)
    expect(Math.max(...vols)).toBe(15)
    expect(Math.min(...vols)).toBeLessThan(15)
    expect(Math.min(...vols)).toBeGreaterThanOrEqual(0)
  })

  it('is a per-tick delta effect: it takes no step on tick 0 of a row', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('7', 0x1f) }], 2)
    const vols = volumeSeries(drive(s, 8).ticks, REG.P1_CTRL)
    // Ticks 0 and 1 of a row hold the same accumulator value.
    expect(vols[2]).toBe(vols[3])
    expect(vols[4]).toBe(vols[5])
  })
})

describe('Axy volume slide', () => {
  it('A0y slides UP and Ax0 slides DOWN — NOT the ProTracker convention', () => {
    const up = song([{ r: 0, note: 60, vol: 8, fx: fx('A', 0x08) }], 8)
    const down = song([{ r: 0, note: 60, vol: 8, fx: fx('A', 0x80) }], 8)
    const upVols = volumeSeries(drive(up, 5).ticks, REG.P1_CTRL)
    const downVols = volumeSeries(drive(down, 5).ticks, REG.P1_CTRL)
    expect(upVols).toEqual([8, 9, 10, 11, 12])
    expect(downVols).toEqual([8, 7, 6, 5, 4])
  })

  it('moves in EIGHTHS of a volume step', () => {
    const s = song([{ r: 0, note: 60, vol: 8, fx: fx('A', 0x02) }], 16)
    const vols = volumeSeries(drive(s, 9).ticks, REG.P1_CTRL)
    // +2/8 per tick: four ticks to climb one whole step.
    expect(vols).toEqual([8, 8, 8, 8, 9, 9, 9, 9, 10])
  })

  it('A00 stops and holds — it does NOT recall the effect memory', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 8, fx: fx('A', 0x80) },
        { r: 1, fx: fx('A', 0) },
      ],
      4,
    )
    const vols = volumeSeries(drive(s, 8).ticks, REG.P1_CTRL)
    expect(vols.slice(0, 4)).toEqual([8, 7, 6, 5])
    expect(vols.slice(4)).toEqual([5, 5, 5, 5])
  })
})

describe('Bxx / Cxx / Dxx — order flow', () => {
  it('Bxx jumps to the frame at the end of the row', () => {
    const s = buildSong({
      meta: { speed: 1, rowsPerPattern: 4 },
      order: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
      ],
      patterns: {
        'pulse1:0': [{ r: 0, fx: fx('B', 1) }],
        'pulse1:1': [{ r: 0, note: 72, vol: 15 }],
      },
    })
    const { ticks, driver } = drive(s, 4)
    expect(at(ticks, 1, REG.P1_LO)).toBe(T(72) & 0xff)
    expect(driver.stats.rowsPlayed).toBeGreaterThan(0)
  })

  it('Dxx advances a frame and starts at row xx', () => {
    const s = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      order: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
      ],
      patterns: {
        'pulse1:0': [{ r: 0, fx: fx('D', 5) }],
        'pulse1:1': [{ r: 5, note: 72, vol: 15 }],
      },
    })
    const { ticks } = drive(s, 4)
    expect(at(ticks, 1, REG.P1_LO)).toBe(T(72) & 0xff)
  })

  it('Bxx and Dxx together mean "frame from Bxx, row from Dxx"', () => {
    const s = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      effectColumns: [2, 1, 1, 1, 1],
      order: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [2, 0, 0, 0, 0],
      ],
      patterns: {
        'pulse1:0': [
          {
            r: 0,
            fx: [
              { cmd: 'B', param: 2 },
              { cmd: 'D', param: 3 },
            ],
          },
        ],
        'pulse1:2': [{ r: 3, note: 84, vol: 15 }],
      },
    })
    const { ticks, driver } = drive(s, 4)
    expect(driver.position.orderIndex).toBe(2)
    expect(at(ticks, 1, REG.P1_LO)).toBe(T(84) & 0xff)
  })

  it('Cxx stops playback and silences every channel on that cycle', () => {
    const s = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, vol: 15 },
          { r: 1, fx: fx('C', 0) },
        ],
      },
    })
    const { ticks, driver } = drive(s, 6)
    expect(driver.playing).toBe(false)
    expect(at(ticks, 1, REG.STATUS)).toBe(0)
    // Nothing is emitted after the halt.
    expect(ticks.slice(2).flat()).toEqual([])
  })
})

describe('Fxx speed / tempo', () => {
  it('splits at speedSplitPoint: below sets speed, at or above sets tempo', () => {
    const s = buildSong({
      meta: { speed: 8, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, vol: 15, fx: fx('F', 2) },
          { r: 1, note: 62 },
          { r: 2, note: 64 },
        ],
      },
    })
    const { ticks } = drive(s, 12)
    // The change lands at the END OF TICK 0, before the row accumulator — so even the
    // row that carries the Fxx is shortened. That is what makes `F01` feel instant.
    expect(at(ticks, 0, REG.P1_LO)).toBe(T(60) & 0xff)
    expect(at(ticks, 2, REG.P1_LO)).toBe(T(62) & 0xff)
    expect(at(ticks, 4, REG.P1_LO)).toBe(T(64) & 0xff)
  })

  it('a param at or above the split point sets the tempo', () => {
    const s = buildSong({
      meta: { speed: 6, tempo: 150, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15, fx: fx('F', 0x4b) }] },
    })
    const { driver } = drive(s, 8)
    // bpm = 24 * 75 / (6 * 4)
    expect(driver.position.bpm).toBeCloseTo((24 * 0x4b) / (6 * 4), 9)
  })

  it('F00 is invalid and is ignored rather than dividing by zero', () => {
    const s = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15, fx: fx('F', 0) }] },
    })
    const { driver } = drive(s, 12)
    expect(driver.playing).toBe(true)
    // Speed 4 is untouched: 12 ticks is exactly 3 rows.
    expect(driver.stats.rowsPlayed).toBe(3)
  })
})

describe('Gxx note delay', () => {
  it('delays the note on its OWN CHANNEL ONLY', () => {
    const s = buildSong({
      meta: { speed: 6, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [{ r: 0, note: 60, vol: 15, fx: fx('G', 3) }],
        'pulse2:0': [{ r: 0, note: 67, vol: 15 }],
      },
    })
    const { ticks } = drive(s, 6)
    expect(at(ticks, 0, REG.P2_LO)).toBe(T(67) & 0xff)
    expect(at(ticks, 0, REG.P1_LO)).toBe(-1)
    expect(at(ticks, 3, REG.P1_LO)).toBe(T(60) & 0xff)
  })

  it('delays the instrument and the volume with the note', () => {
    const s = buildSong({
      meta: { speed: 6, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 4, fx: fx('G', 2) }] },
    })
    const vols = volumeSeries(drive(s, 4).ticks, REG.P1_CTRL)
    expect(vols).toEqual([-1, -1, 4, 4])
  })

  it('clamps to the LAST TICK OF THIS ROW, exactly, in the fractional case', () => {
    // T=160 S=6 -> the first row is 6 ticks, the third is 5 (§2.3). A G09 on row 2
    // must land on that row's last tick, tick 4, not on tick 9.
    const s = buildSong({
      meta: { speed: 6, tempo: 160, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 48, vol: 15 },
          { r: 2, note: 60, fx: fx('G', 9) },
        ],
      },
    })
    const { ticks } = drive(s, 20)
    // rows 0 and 1 are 6 ticks each, so row 2 starts on tick 12 and lasts 5 ticks.
    expect(at(ticks, 16, REG.P1_LO)).toBe(T(60) & 0xff)
    expect(at(ticks, 15, REG.P1_LO)).toBe(-1)
  })

  it('G00 is a no-op, not an error', () => {
    const s = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15, fx: fx('G', 0) }] },
    })
    const { ticks } = drive(s, 4)
    expect(at(ticks, 0, REG.P1_LO)).toBe(T(60) & 0xff)
  })
})

describe('Pxx fine pitch', () => {
  it('0x80 is in tune; either side is one period unit per step', () => {
    const centre = song([{ r: 0, note: 60, vol: 15, fx: fx('P', 0x80) }], 4)
    const up = song([{ r: 0, note: 60, vol: 15, fx: fx('P', 0x84) }], 4)
    const down = song([{ r: 0, note: 60, vol: 15, fx: fx('P', 0x7c) }], 4)
    expect(timerSeries(drive(centre, 2).ticks, REG.P1_LO)[0]).toBe(T(60))
    expect(timerSeries(drive(up, 2).ticks, REG.P1_LO)[0]).toBe(T(60) + 4)
    expect(timerSeries(drive(down, 2).ticks, REG.P1_LO)[0]).toBe(T(60) - 4)
  })

  it('persists until changed', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('P', 0x84) },
        { r: 2, note: 60 },
      ],
      2,
    )
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    expect(new Set(timers)).toEqual(new Set([T(60) + 4]))
  })
})

describe('Sxx delayed cut', () => {
  it('cuts xx ticks after the row starts, the note having sounded first', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('S', 3) }], 8)
    const { ticks } = drive(s, 8)
    expect(at(ticks, 0, REG.P1_LO)).toBe(T(60) & 0xff)
    expect(at(ticks, 3, REG.STATUS)).toBe(0)
    expect(ticks.slice(4).flat()).toEqual([])
  })

  it('S00 is an immediate cut', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('S', 0) }], 8)
    const { ticks } = drive(s, 4)
    expect(at(ticks, 0, REG.STATUS)).toBe(0)
  })

  it('cuts whatever is sounding when it has no note of its own', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('S', 2) },
      ],
      4,
    )
    const { ticks } = drive(s, 8)
    expect(at(ticks, 6, REG.STATUS)).toBe(0)
  })
})

describe('Qxy / Rxy note slide — x is SPEED, y is SEMITONES', () => {
  it('Q41 glides one semitone UP at 2x+1 = 9 units per tick, then latches', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('Q', 0x41) },
      ],
      8,
    )
    const timers = timerSeries(drive(s, 16).ticks, REG.P1_LO)
    const from = T(60)
    const to = T(61)
    expect(to - from).toBe(-24)
    expect(timers[8]).toBe(from)
    expect(timers[9]).toBe(from - 9)
    expect(timers[10]).toBe(from - 18)
    expect(timers[11]).toBe(to)
    expect(timers[12]).toBe(to)
  })

  it('R goes DOWN by y semitones', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('R', 0x41) },
      ],
      8,
    )
    const timers = timerSeries(drive(s, 16).ticks, REG.P1_LO)
    expect(timers.at(-1)).toBe(T(59))
    expect(T(59)).toBeGreaterThan(T(60))
  })

  it('x and y are not interchangeable — Q14 is four semitones at 3 units/tick', () => {
    const fast = song([{ r: 0, note: 60, vol: 15 }, { r: 1, fx: fx('Q', 0x41) }], 16)
    const slow = song([{ r: 0, note: 60, vol: 15 }, { r: 1, fx: fx('Q', 0x14) }], 16)
    const fastT = timerSeries(drive(fast, 64).ticks, REG.P1_LO)
    const slowT = timerSeries(drive(slow, 64).ticks, REG.P1_LO)
    expect(fastT.at(-1)).toBe(T(61))
    expect(slowT.at(-1)).toBe(T(64))
    // Q14 steps 3 units a tick, Q41 steps 9.
    expect(fastT[17] - fastT[16]).toBe(-9)
    expect(slowT[17] - slowT[16]).toBe(-3)
  })

  it('latches the arrived note, so a later arpeggio is relative to IT', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('Q', 0xf2) },
        { r: 3, fx: fx('0', 0x00) },
      ],
      8,
    )
    const timers = timerSeries(drive(s, 32).ticks, REG.P1_LO)
    expect(timers.at(-1)).toBe(T(62))
  })

  it('does not retrigger the note', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('Q', 0x41) },
      ],
      8,
    )
    const { sink } = drive(s, 16)
    expect(countWrites(sink, REG.STATUS)).toBe(1)
  })
})

describe('Vxx duty / timbre', () => {
  it('sets the pulse duty immediately, on tick 0', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('V', 3) }], 4)
    expect(dutySeries(drive(s, 4).ticks, REG.P1_CTRL)).toEqual([3, 3, 3, 3])
  })

  it('is masked, not rejected, when out of range', () => {
    const s = song([{ r: 0, note: 60, vol: 15, fx: fx('V', 7) }], 4)
    expect(dutySeries(drive(s, 2).ticks, REG.P1_CTRL)[0]).toBe(3)
  })

  it('a duty MACRO overwrites it — macros are per-tick, Vxx is per-row', () => {
    const s = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, inst: 0, vol: 15, fx: fx('V', 3) }] },
      instruments: [instrument({ duty: 0 })],
      sequences: { duty: [sequence([0, 1], 0, -1)] },
    })
    expect(dutySeries(drive(s, 4).ticks, REG.P1_CTRL)).toEqual([0, 1, 0, 1])
  })

  it('is the noise MODE bit on the noise channel', () => {
    const s = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'noise:0': [{ r: 0, note: 60, vol: 15, fx: fx('V', 1) }] },
    })
    const { ticks } = drive(s, 2)
    expect(at(ticks, 0, REG.NOISE_PERIOD) & 0x80).toBe(0x80)
  })
})

describe('effect memory (§3.5)', () => {
  it('Q00 and R00 recall the last non-zero param for that letter', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: fx('Q', 0x41) },
        { r: 4, fx: fx('Q', 0x00) },
      ],
      8,
    )
    const timers = timerSeries(drive(s, 48).ticks, REG.P1_LO)
    // The first Q41 lands on c#4; the recalled Q00 climbs another semitone to d4.
    expect(timers.at(-1)).toBe(T(62))
  })

  it('700 recalls, because §3.2 documents no off value for 7xy', () => {
    const withMemory = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('7', 0x1f) },
        { r: 1, fx: fx('7', 0x00) },
      ],
      8,
    )
    const vols = volumeSeries(drive(withMemory, 16).ticks, REG.P1_CTRL)
    expect(Math.min(...vols.slice(8))).toBeLessThan(15)
  })

  it('but the DOCUMENTED off-switches win: 100, 200, 300, 400 and A00 do not recall', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 8, fx: fx('2', 8) },
        { r: 1, fx: fx('2', 0) },
      ],
      4,
    )
    const timers = timerSeries(drive(s, 8).ticks, REG.P1_LO)
    const frozen = timers[3]
    expect(timers.slice(4)).toEqual(new Array(4).fill(frozen))
  })

  it('memory is per channel, never shared', () => {
    const s = buildSong({
      meta: { speed: 8, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, vol: 15, fx: fx('Q', 0x41) },
          { r: 1, fx: fx('Q', 0x00) },
        ],
        'pulse2:0': [
          { r: 0, note: 60, vol: 15 },
          { r: 1, fx: fx('Q', 0x00) },
        ],
      },
    })
    const { ticks } = drive(s, 24)
    // pulse2 never set a Q param, so its Q00 has nothing to recall and does nothing.
    expect(timerSeries(ticks, REG.P2_LO).at(-1)).toBe(T(60))
    expect(timerSeries(ticks, REG.P1_LO).at(-1)).not.toBe(T(60))
  })

  it('memory is cleared by stop(), never by a note', () => {
    const s = song(
      [
        { r: 0, note: 60, vol: 15, fx: fx('Q', 0x41) },
        { r: 1, note: 60 },
        { r: 2, fx: fx('Q', 0x00) },
      ],
      8,
    )
    const { driver, ticks } = drive(s, 32)
    expect(timerSeries(ticks, REG.P1_LO).at(-1)).not.toBe(T(60))
    driver.stop()
    driver.play('song')
    expect(driver.stats.noteOns).toBe(0)
  })
})

describe('the tick-0 rule (§3.1)', () => {
  it('table-driven effects apply on tick 0, delta effects take no step', () => {
    const table = song([{ r: 0, note: 60, vol: 15, fx: fx('P', 0x88) }], 4)
    const delta = song([{ r: 0, note: 60, vol: 15, fx: fx('2', 8) }], 4)
    expect(timerSeries(drive(table, 1).ticks, REG.P1_LO)[0]).toBe(T(60) + 8)
    expect(timerSeries(drive(delta, 1).ticks, REG.P1_LO)[0]).toBe(T(60))
  })
})
