/** The instrument macro engine (design §3.4).
 *
 *  Headline assertions:
 *    - index 0 is read ON the trigger tick — the first macro value IS heard.
 *    - a loop point wraps; NO loop point HOLDS the last value forever (it does not
 *      zero, and it does not end the note) — **[ours]**, pinned here.
 *    - a release point splits the sequence: held, the index never advances past it;
 *      on `===` it jumps to `release + 1`, runs the tail and holds the last value.
 *    - **the VOLUME sequence decides whether release is possible at all.** A pitch
 *      macro with a release point and a volume macro without one still produces a CUT.
 *    - `---` always cuts, release point or not.
 *    - an instrument change WITHOUT a note swaps the macro SET and keeps the macro
 *      INDICES — **[ours]**, pinned here.
 *    - hi-pitch is pitch ×16; fixed / absolute / relative arpeggio all differ.
 */
import { describe, expect, it } from 'vitest'
import {
  MACRO_ARPEGGIO,
  MACRO_DUTY,
  MACRO_VOLUME,
  MacroEngine,
  compileMacros,
} from '../../src/tracker/driver/macros'
import { NOTE_CUT, NOTE_RELEASE } from '../../src/tracker/model/types'
import {
  REG,
  buildSong,
  drive,
  dutySeries,
  instrument,
  sequence,
  timerSeries,
  volumeSeries,
} from '../fixtures/songs/build'

/** One instrument, one volume sequence, driven a tick at a time. */
function volumeRun(values: number[], loop: number, release: number, ticks: number, releaseAt = -1): number[] {
  const song = buildSong({
    instruments: [instrument({ volume: 0 })],
    sequences: { volume: [sequence(values, loop, release)] },
  })
  const engine = new MacroEngine(5, compileMacros(song))
  engine.trigger(0, 0)
  const out: number[] = []
  for (let t = 0; t < ticks; t++) {
    if (t === releaseAt) engine.release(0)
    out.push(engine.read(0, MACRO_VOLUME, 15))
    engine.advance(0)
  }
  return out
}

describe('sequence stepping', () => {
  it('reads index 0 on the trigger tick', () => {
    expect(volumeRun([9, 8, 7], -1, -1, 3)).toEqual([9, 8, 7])
  })

  it('wraps to the loop point when it runs past the end', () => {
    expect(volumeRun([15, 12, 9, 6], 2, -1, 9)).toEqual([15, 12, 9, 6, 9, 6, 9, 6, 9])
  })

  it('with no loop point HOLDS the last value forever [ours]', () => {
    expect(volumeRun([15, 8, 3], -1, -1, 8)).toEqual([15, 8, 3, 3, 3, 3, 3, 3])
    // The distinguishing case: it does NOT fall to zero, and it does NOT end.
    expect(volumeRun([15, 8, 3], -1, -1, 200).at(-1)).toBe(3)
  })

  it('loop 0 restarts from the top', () => {
    expect(volumeRun([4, 5], 0, -1, 6)).toEqual([4, 5, 4, 5, 4, 5])
  })

  it('a one-value sequence is a constant', () => {
    expect(volumeRun([11], -1, -1, 5)).toEqual([11, 11, 11, 11, 11])
  })
})

describe('release points', () => {
  it('holds at the release point while the note is held', () => {
    // values [15,12,9,4,0], release 2 -> sustain on 9 until the key comes up.
    expect(volumeRun([15, 12, 9, 4, 0], -1, 2, 7)).toEqual([15, 12, 9, 9, 9, 9, 9])
  })

  it('loops back INSIDE the sustain region when a loop point precedes the release', () => {
    expect(volumeRun([15, 12, 9, 4, 0], 1, 2, 8)).toEqual([15, 12, 9, 12, 9, 12, 9, 12])
  })

  it('jumps to release + 1 and runs the tail, then holds the last value', () => {
    expect(volumeRun([15, 12, 9, 4, 0], -1, 2, 8, 4)).toEqual([15, 12, 9, 9, 4, 0, 0, 0])
  })

  it('ignores the loop point once released — the tail runs to the end', () => {
    expect(volumeRun([15, 12, 9, 4, 1], 1, 2, 8, 3)).toEqual([15, 12, 9, 4, 1, 1, 1, 1])
  })
})

describe('the volume macro decides whether a release is possible', () => {
  const held = { r: 0, note: 60, inst: 0, vol: 15 }
  const released = { r: 2, note: NOTE_RELEASE }

  it('releases when the volume sequence has a release point', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [held, released] },
      instruments: [instrument({ volume: 0 })],
      sequences: { volume: [sequence([15, 15, 15, 6, 2, 0], -1, 2)] },
    })
    const { ticks, driver } = drive(song, 8)
    // Sustains at 15 until row 2, then runs the tail 6, 2, 0.
    expect(volumeSeries(ticks, REG.P1_CTRL).slice(0, 6)).toEqual([15, 15, 6, 2, 0, 0])
    // Still enabled: a release does NOT touch $4015 (§3.5).
    expect(driver.position.playing).toBe(true)
    const statusWrites = ticks.flat().filter((w) => w.addr === REG.STATUS)
    expect(statusWrites.every((w) => (w.value & 0x01) !== 0)).toBe(true)
  })

  it('CUTS when the volume sequence has NO release point, even if pitch does', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [held, released] },
      instruments: [instrument({ volume: 0, pitch: 0 })],
      sequences: {
        volume: [sequence([15, 15, 15, 15], -1, -1)],
        pitch: [sequence([0, 0, 1, 2], -1, 1)],
      },
    })
    const { ticks } = drive(song, 6)
    // Row 2's release lands as a hard cut: the $4015 bit is cleared.
    const cut = ticks[2].find((w) => w.addr === REG.STATUS)
    expect(cut).toBeDefined()
    expect((cut?.value ?? 1) & 0x01).toBe(0)
  })

  it('--- always cuts, release point or not', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [held, { r: 2, note: NOTE_CUT }] },
      instruments: [instrument({ volume: 0 })],
      sequences: { volume: [sequence([15, 15, 15, 6, 2, 0], -1, 2)] },
    })
    const { ticks } = drive(song, 6)
    const cut = ticks[2].find((w) => w.addr === REG.STATUS)
    expect((cut?.value ?? 1) & 0x01).toBe(0)
  })
})

describe('instrument change without a note [ours]', () => {
  it('swaps the macro SET and keeps the macro INDICES', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, inst: 0, vol: 15 },
          { r: 3, inst: 1 },
        ],
      },
      instruments: [instrument({ volume: 0 }, 'a'), instrument({ volume: 1 }, 'b')],
      sequences: {
        volume: [sequence([15, 14, 13, 12, 11, 10], -1, -1), sequence([1, 2, 3, 4, 5, 6], -1, -1)],
      },
    })
    const { ticks, sink } = drive(song, 7)
    // Ticks 0..2 read instrument a at indices 0,1,2; from tick 3 instrument b is read
    // at index 3 — NOT at index 0. A restart would have shown 1, 2, 3.
    expect(volumeSeries(ticks, REG.P1_CTRL).slice(0, 6)).toEqual([15, 14, 13, 4, 5, 6])
    // And it is not a retrigger: $4003 went out exactly once, at the note.
    let hi = 0
    for (let i = 0; i < sink.length; i++) if (sink.addrs[i] === REG.P1_HI) hi++
    expect(hi).toBe(1)
  })

  it('clamps rather than restarting when the new sequence is shorter', () => {
    const song = buildSong({
      instruments: [instrument({ volume: 0 }), instrument({ volume: 1 })],
      sequences: { volume: [sequence([15, 14, 13, 12, 11], -1, -1), sequence([3], -1, -1)] },
    })
    const engine = new MacroEngine(5, compileMacros(song))
    engine.trigger(0, 0)
    for (let i = 0; i < 4; i++) engine.advance(0)
    engine.swapInstrument(0, 1)
    expect(engine.read(0, MACRO_VOLUME, 15)).toBe(3)
  })
})

describe('per-kind meaning', () => {
  it('pitch accumulates into the period; hi-pitch is the same value x16', () => {
    const make = (kind: 'pitch' | 'hiPitch') =>
      buildSong({
        meta: { speed: 1, rowsPerPattern: 8 },
        patterns: { 'pulse1:0': [{ r: 0, note: 60, inst: 0, vol: 15 }] },
        instruments: [instrument({ [kind]: 0 })],
        sequences: { [kind]: [sequence([1], 0, -1)] },
      })
    const pitch = timerSeries(drive(make('pitch'), 5).ticks, REG.P1_LO)
    const hi = timerSeries(drive(make('hiPitch'), 5).ticks, REG.P1_LO)
    // A constant +1 is a continuous downward glide, one period unit per tick...
    expect(pitch[1] - pitch[0]).toBe(1)
    expect(pitch[4] - pitch[0]).toBe(4)
    // ...and hi-pitch multiplies the value by 16, verbatim from the manual.
    expect(hi[1] - hi[0]).toBe(16)
    expect(hi[4] - hi[0]).toBe(64)
  })

  it('absolute arpeggio adds semitones to the base note', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, inst: 0, vol: 15 }] },
      instruments: [instrument({ arpeggio: 0 })],
      sequences: { arpeggio: [sequence([0, 4, 7], 0, -1)] },
    })
    const plain = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15 }, { r: 1, note: 64 }, { r: 2, note: 67 }] },
    })
    const arp = timerSeries(drive(song, 3).ticks, REG.P1_LO)
    const ref = timerSeries(drive(plain, 3).ticks, REG.P1_LO)
    expect(arp).toEqual(ref)
  })

  it('fixed arpeggio IGNORES the row note and uses the value as the note [ours]', () => {
    const fixed = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, inst: 0, vol: 15 }] },
      instruments: [instrument({ arpeggio: 0 })],
      sequences: { arpeggio: [sequence([84], 0, -1, 'fixed')] },
    })
    const literal = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 84, vol: 15 }] },
    })
    expect(timerSeries(drive(fixed, 3).ticks, REG.P1_LO)).toEqual(
      timerSeries(drive(literal, 3).ticks, REG.P1_LO),
    )
  })

  it('relative arpeggio accumulates: a constant +1 climbs a semitone per tick', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 48, inst: 0, vol: 15 }] },
      instruments: [instrument({ arpeggio: 0 })],
      sequences: { arpeggio: [sequence([1], 0, -1, 'relative')] },
    })
    const climb = timerSeries(drive(song, 4).ticks, REG.P1_LO)
    const steps = buildSong({
      meta: { speed: 1, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 49, vol: 15 },
          { r: 1, note: 50 },
          { r: 2, note: 51 },
          { r: 3, note: 52 },
        ],
      },
    })
    expect(climb).toEqual(timerSeries(drive(steps, 4).ticks, REG.P1_LO))
  })

  it('a duty macro steps every tick without ever writing $4003', () => {
    const song = buildSong({
      meta: { speed: 8, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, inst: 0, vol: 15 }] },
      instruments: [instrument({ duty: 0 })],
      sequences: { duty: [sequence([0, 1, 2, 3], 0, -1)] },
    })
    const { ticks, sink } = drive(song, 8)
    expect(dutySeries(ticks, REG.P1_CTRL)).toEqual([0, 1, 2, 3, 0, 1, 2, 3])
    let hi = 0
    for (let i = 0; i < sink.length; i++) if (sink.addrs[i] === REG.P1_HI) hi++
    expect(hi).toBe(1)
  })

  it('a duty macro on the triangle is inert, not an error', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'triangle:0': [{ r: 0, note: 48, inst: 0, vol: 15 }] },
      instruments: [instrument({ duty: 0 })],
      sequences: { duty: [sequence([0, 1, 2, 3], 0, -1)] },
    })
    const { ticks } = drive(song, 4)
    // $4008 is written once (the sustain byte) and never toggled by the duty macro.
    const linear = ticks.flat().filter((w) => w.addr === REG.TRI_LINEAR)
    expect(linear).toEqual([{ addr: REG.TRI_LINEAR, value: 0xff }])
  })
})

describe('the engine API', () => {
  it('reports whether a macro exists and what mode it is in', () => {
    const song = buildSong({
      instruments: [instrument({ volume: 0, arpeggio: 0 })],
      sequences: {
        volume: [sequence([15], -1, -1)],
        arpeggio: [sequence([0], -1, -1, 'fixed')],
      },
    })
    const engine = new MacroEngine(5, compileMacros(song))
    engine.trigger(0, 0)
    expect(engine.has(0, MACRO_VOLUME)).toBe(true)
    expect(engine.has(0, MACRO_DUTY)).toBe(false)
    expect(engine.has(0, MACRO_ARPEGGIO)).toBe(true)
    expect(engine.canRelease(0)).toBe(false)
    expect(engine.read(0, MACRO_DUTY, -1)).toBe(-1)
  })

  it('an instrument index with no instrument behind it has no macros', () => {
    const song = buildSong({})
    const engine = new MacroEngine(5, compileMacros(song))
    engine.trigger(0, 7)
    expect(engine.has(0, MACRO_VOLUME)).toBe(false)
    expect(engine.read(0, MACRO_VOLUME, 15)).toBe(15)
    expect(engine.canRelease(7)).toBe(false)
  })
})
