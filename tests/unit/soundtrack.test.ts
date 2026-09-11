/** Piece-specific contracts for the three OCTET tracks — what makes each one itself, not
 *  an automated claim of musical quality (tools/songs/octet/README.md, docs/soundtrack.md). */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import { MAX_NOTE, type Song } from '../../src/tracker/model/types'
import {
  centsBetween,
  midiToHz,
  vrc6PulseHzForTimer,
  vrc6PulseTimerForMidi,
  vrc6SawHzForTimer,
  vrc6SawTimerForMidi,
} from '../../src/audio/host/pitch'

const dir = join(import.meta.dirname, '../../src/assets/songs')
const songs = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => {
  const text = readFileSync(join(dir, file), 'utf8')
  return { file, text, song: parseSong(JSON.parse(text)).song }
})
function named(id: string): Song {
  return songs.find(({ file }) => file.endsWith(`-${id}.json`))!.song
}
function pattern(song: Song, channel: Song['channels'][number], frame = 0) {
  const index = song.order[frame][song.channels.indexOf(channel)]
  return song.patterns.find((p) => p.channel === channel && p.index === index)!
}
function attacks(p: Song['patterns'][number]) {
  return p.rows.filter((c) => c.note !== undefined && c.note >= 0)
}
/** Every attack the order reaches on one channel, in played order. */
function played(song: Song, channel: Song['channels'][number]) {
  return song.order.flatMap((_, frame) => attacks(pattern(song, channel, frame)))
}
/** Every cell the order reaches on one channel, tagged with its ABSOLUTE row, so two
 *  lanes can be compared in time (an echo three rows behind, an octave doubling). */
function timeline(song: Song, channel: Song['channels'][number]) {
  const rows = song.meta.rowsPerPattern
  return song.order.flatMap((_, frame) =>
    pattern(song, channel, frame).rows.map((cell) => ({ ...cell, row: frame * rows + cell.r })))
}
/** Absolute row -> note, for the attacks on one channel. */
function notesByRow(song: Song, channel: Song['channels'][number]): Map<number, number> {
  return new Map(timeline(song, channel)
    .filter((c) => c.note !== undefined && c.note >= 0)
    .map((c) => [c.row, c.note as number]))
}
function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}
/** The instruments an order walk actually plays on one channel. */
function instrumentsOn(song: Song, channel: Song['channels'][number]): number[] {
  return [...new Set(timeline(song, channel).map((c) => c.inst).filter((i): i is number => i !== undefined))]
}
function dutyOf(song: Song, inst: number): number[] {
  const index = song.instruments[inst].macros.duty
  return index < 0 ? [] : [...song.sequences.duty[index].values]
}

/** The lowest MIDI note a VRC6 divider can still SOUND. Derived from `pitch.ts`, not
 *  pinned: below it the 12-bit timer saturates and the lane plays a different pitch than
 *  the one written. Ten cents is well outside the timer's own quantisation down there
 *  (one step is under half a cent near the bottom of the table), so the first note inside
 *  it is the first note the chip can actually reach. */
function lowestSounding(
  timerForMidi: (note: number) => number,
  hzForTimer: (timer: number) => number,
): number {
  for (let n = 0; n <= MAX_NOTE; n++) {
    if (Math.abs(centsBetween(hzForTimer(timerForMidi(n)), midiToHz(n))) <= 10) return n
  }
  return MAX_NOTE
}
const VRC6_PULSE_FLOOR = lowestSounding(vrc6PulseTimerForMidi, vrc6PulseHzForTimer)
const VRC6_SAW_FLOOR = lowestSounding(vrc6SawTimerForMidi, vrc6SawHzForTimer)
function bpm(song: Song) {
  return 24 * song.meta.tempo / (song.meta.speed * song.meta.rowHighlight)
}
/** Actual rhythmic/voice/form data; labels and transposition cannot change it. */
function texture(song: Song): string {
  return JSON.stringify({
    frameBeats: song.meta.rowsPerPattern / song.meta.rowHighlight,
    voices: song.channels,
    frames: song.order.map((_, frame) => song.channels.map((channel) =>
      attacks(pattern(song, channel, frame)).map((c) => c.r / song.meta.rowHighlight))),
  })
}
function openingTimbre(song: Song): string {
  return JSON.stringify(Object.entries(song.instruments[0].macros).map(([kind, index]) =>
    index < 0 ? null : song.sequences[kind as keyof Song['sequences']][index]))
}
function qaOf(song: Song) {
  return song.extra!.qa as {
    form: string[]
    loopFrame: number
    accidentalFractionMax?: number
    key: string
    channels: string[]
  }
}

describe('the OCTET tracks', () => {
  it('the VRC6 pitch floors are real boundaries, not zero', () => {
    // Twelve bits against the 2A03 pulse's eleven: a whole octave lower.
    expect(VRC6_PULSE_FLOOR).toBeLessThanOrEqual(33 - 12)
    // The saw divides by 14 rather than 16, so it bottoms out higher than its own pulses.
    expect(VRC6_SAW_FLOOR).toBeGreaterThan(VRC6_PULSE_FLOOR)
    // One semitone under each floor the 12-bit timer saturates: the lane would sound a
    // pitch other than the one written, which is exactly what the gate above forbids.
    for (const [floor, timerFor, hzFor] of [
      [VRC6_PULSE_FLOOR, vrc6PulseTimerForMidi, vrc6PulseHzForTimer],
      [VRC6_SAW_FLOOR, vrc6SawTimerForMidi, vrc6SawHzForTimer],
    ] as const) {
      const under = floor - 1
      expect(Math.abs(centsBetween(hzFor(timerFor(under)), midiToHz(under))), `${under}`).toBeGreaterThan(10)
      expect(Math.abs(centsBetween(hzFor(timerFor(floor)), midiToHz(floor))), `${floor}`).toBeLessThanOrEqual(10)
    }
  })

  it('are three, each with its own texture, opening palette and tempo', () => {
    expect(songs.map(({ file }) => file)).toEqual([
      '01-skyline-run.json', '02-cathedral-of-gears.json', '03-tide-tables.json',
    ])
    expect(new Set(songs.map(({ song }) => texture(song))).size).toBe(3)
    expect(new Set(songs.map(({ song }) => openingTimbre(song))).size).toBe(3)
    expect(songs.map(({ song }) => bpm(song))).toEqual([150, 150, 56.25])
    expect(songs.map(({ song }) => song.meta.speed)).toEqual([3, 6, 8])
    // Relabeling, transposing and speeding up a copy cannot fake a new texture.
    const original = songs[0].song
    const copy: Song = {
      ...original, meta: { ...original.meta, name: 'Not a new piece', tempo: 180 },
      patterns: original.patterns.map((p) => ({
        ...p, rows: p.rows.map((c) => c.note !== undefined && c.note >= 0
          ? { ...c, note: c.note + 2 } : c),
      })),
    }
    expect(texture(copy)).toBe(texture(original))
  })

  it('are committed exactly as serializeSong writes them (the converter is canonical)', () => {
    for (const { file, text, song } of songs) expect(serializeSong(song), file).toBe(text)
  })

  it('never name their author as a person or a work: they are the sibling project’s demos', () => {
    for (const { song } of songs) expect(song.meta.author).toMatch(/^OCTET demo/)
  })

  it('Skyline Run: a 32nd-note grid, DPCM kick and snare on the kit slots, a two-row echo', () => {
    const s = named('skyline-run')
    expect(s.meta.speed).toBe(3)
    expect(s.meta.rowHighlight).toBe(8)
    expect(s.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm'])
    const kit = s.instruments.find((i) => i.dpcm !== undefined)!.dpcm!
    expect(Object.keys(kit)).toEqual(['36', '38'])
    expect(kit['36'].sample).toBe(0)
    expect(kit['38'].sample).toBe(1)
    expect(s.samples.map((x) => x.name)).toEqual(['x-skyline-run-dpcm-kick', 'x-skyline-run-dpcm-snare'])
    // pulse 2 shadows the hook two rows late and quieter, from the loop frame on
    const lead = attacks(pattern(s, 'pulse1', 2)).slice(0, 6)
    const echo = attacks(pattern(s, 'pulse2', 2)).slice(0, 6)
    expect(echo.map((c) => c.r - lead[echo.indexOf(c)].r)).toEqual([2, 2, 2, 2, 2, 2])
    expect(echo.map((c) => c.note)).toEqual(lead.map((c) => c.note))
    expect(echo[0].vol!).toBeLessThan(lead[0].vol!)
    // the half-time breakdown and its return are the only speed changes
    const speeds = s.patterns.flatMap((p) => p.rows.flatMap((c) => (c.fx ?? []).filter((e) => e && e.cmd === 'F').map((e) => e!.param)))
    expect(speeds.sort()).toEqual([3, 6])
    expect(qaOf(s).loopFrame).toBe(2)
    expect(s.order).toHaveLength(42)
  })

  it('Cathedral of Gears: the sawtooth is the bass, the triangle doubles it, the lead is on VRC6 pulse 1', () => {
    const s = named('cathedral-of-gears')
    expect(s.channels).toEqual([
      'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
    ])
    // dpcm is declared only because `channels` is a PREFIX of the canonical eight.
    expect(played(s, 'dpcm')).toHaveLength(0)
    expect(qaOf(s).channels).not.toContain('dpcm')

    // the bass gallop is the sawtooth's: more attacks than any other lane, lowest register
    const saw = played(s, 'vrc6saw')
    const tri = played(s, 'triangle')
    for (const c of s.channels) if (c !== 'vrc6saw') expect(saw.length, c).toBeGreaterThan(played(s, c).length)
    expect(Math.min(...saw.map((c) => c.note!))).toBeLessThan(36)
    expect(Math.min(...saw.map((c) => c.note!))).toBeLessThan(Math.min(...tri.map((c) => c.note!)))

    // the triangle doubles it an octave up wherever both strike
    const sawAt = notesByRow(s, 'vrc6saw')
    const shared = [...notesByRow(s, 'triangle')].filter(([row]) => sawAt.has(row))
    expect(shared.length).toBeGreaterThan(400)
    const octave = shared.filter(([row, note]) => note - (sawAt.get(row) as number) === 12)
    expect(octave.length / shared.length).toBeGreaterThan(0.9)

    // the lead sits on VRC6 pulse 1 under a duty macro that opens wide and narrows, 7 -> 2
    const lead = instrumentsOn(s, 'vrc6p1').map((i) => dutyOf(s, i))
    expect(lead.some((d) => d[0] === 7 && d.at(-1) === 2)).toBe(true)
    // the inner harmony is on VRC6 pulse 2: reedy duties only, and it sits under the lead
    for (const i of instrumentsOn(s, 'vrc6p2')) {
      for (const v of dutyOf(s, i)) expect(v, `vrc6p2 inst ${i}`).toBeLessThanOrEqual(4)
    }
    expect(mean(played(s, 'vrc6p2').map((c) => c.note!)))
      .toBeLessThan(mean(played(s, 'vrc6p1').map((c) => c.note!)))

    // the counter-melody and the B section's chord stabs are on 2A03 pulse 1
    const chords = played(s, 'pulse1').filter((c) => c.fx?.some((e) => e && e.cmd === '0' && e.param !== 0))
    expect(chords.length).toBeGreaterThanOrEqual(8)
    expect(mean(played(s, 'pulse1').map((c) => c.note!)))
      .toBeLessThan(mean(played(s, 'vrc6p1').map((c) => c.note!)))

    // ...and 2A03 pulse 2 is the three-row echo of whichever line leads
    const echoSources = [notesByRow(s, 'vrc6p1'), notesByRow(s, 'vrc6saw')]
    const echo = timeline(s, 'pulse2').filter((c) => c.note !== undefined && c.note >= 0)
    expect(echo.length).toBeGreaterThan(150)
    for (const c of echo) {
      expect(echoSources.some((src) => src.get(c.row - 3) === c.note), `pulse2 row ${c.row}`).toBe(true)
    }

    // the coda's ritardando is Fxx on the noise lane, and it only ever slows down
    const lastFrame = (s.order.length - 1) * s.meta.rowsPerPattern
    const rit = timeline(s, 'noise').filter((c) => c.row >= lastFrame)
      .flatMap((c) => (c.fx ?? []).filter((e) => e && e.cmd === 'F').map((e) => e!.param))
    expect(rit.length).toBeGreaterThanOrEqual(3)
    expect(rit).toEqual([...rit].sort((a, b) => a - b))
    expect(new Set(rit).size).toBe(rit.length)

    expect(qaOf(s).key).toBe('d-minor')
    expect(qaOf(s).accidentalFractionMax).toBe(0.2)
    expect(s.order).toHaveLength(22)
    expect(qaOf(s).loopFrame).toBe(2)
  })

  it('Tide Tables: two bars of 5/4 a pattern, two VRC6 voices trading beats, a saw pad, fixed-mode bells', () => {
    const s = named('tide-tables')
    expect(s.meta.rowsPerPattern).toBe(80)
    expect(s.meta.rowHighlight).toBe(8)
    expect(s.meta.rowHighlight2).toBe(40)
    expect(s.channels).toEqual([
      'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
    ])
    expect(played(s, 'dpcm')).toHaveLength(0)
    expect(qaOf(s).channels).not.toContain('dpcm')

    const glides = played(s, 'triangle').filter((c) => c.fx?.some((e) => e && e.cmd === '3' && e.param !== 0))
    expect(glides.length).toBeGreaterThanOrEqual(20)
    expect(s.sequences.arpeggio.length).toBeGreaterThanOrEqual(4)
    for (const seq of s.sequences.arpeggio) expect(seq.mode).toBe('fixed')

    // voice A above on VRC6 pulse 1 at duty 1, voice B below on VRC6 pulse 2 at duty 0
    expect(instrumentsOn(s, 'vrc6p1').map((i) => dutyOf(s, i))).toEqual([[1]])
    expect(instrumentsOn(s, 'vrc6p2').map((i) => dutyOf(s, i))).toEqual([[0]])
    const voiceA = notesByRow(s, 'vrc6p1')
    const voiceB = notesByRow(s, 'vrc6p2')
    expect(voiceA.size).toBeGreaterThanOrEqual(20)
    expect(voiceB.size).toBeGreaterThanOrEqual(20)
    expect(mean([...voiceB.values()])).toBeLessThan(mean([...voiceA.values()]))
    // each takes the beats the other leaves free: no row carries both
    expect([...voiceA.keys()].filter((row) => voiceB.has(row))).toEqual([])

    // the sawtooth is a pad: one volume, 3, and it glides between chord tones
    const pad = timeline(s, 'vrc6saw')
    expect(pad.filter((c) => c.vol !== undefined && c.vol !== 3)).toEqual([])
    expect(pad.filter((c) => c.fx?.some((e) => e && e.cmd === '3' && e.param !== 0)).length)
      .toBeGreaterThanOrEqual(15)

    // bells on pulse 1, answered two beats (16 rows) later by quieter echoes on pulse 2
    const bells = notesByRow(s, 'pulse1')
    const echoes = timeline(s, 'pulse2').filter((c) => c.note !== undefined && c.note >= 0)
    expect(echoes.length).toBeGreaterThanOrEqual(15)
    for (const c of echoes) expect(bells.has(c.row - 2 * s.meta.rowHighlight), `echo at ${c.row}`).toBe(true)
    expect(mean(echoes.map((c) => c.vol as number)))
      .toBeLessThan(mean(played(s, 'pulse1').map((c) => c.vol as number)))

    // the wind is written as re-struck one-shot swells: every noise envelope ends on 0
    for (const c of played(s, 'noise')) {
      const env = s.sequences.volume[s.instruments[c.inst!].macros.volume]
      expect(env.loop).toBe(-1)
      expect(env.values.at(-1)).toBe(0)
    }
    expect(s.order).toHaveLength(15)
    expect(qaOf(s).loopFrame).toBe(0)
  })

  for (const { file, song } of songs) {
    it(`${file}: explicitly resets its own loop, without requiring an introduction`, () => {
      const qa = qaOf(song)
      expect(qa.form).toHaveLength(song.order.length)
      expect(qa.loopFrame).toBeGreaterThanOrEqual(0)
      expect(qa.loopFrame).toBeLessThan(song.order.length)
      for (const channel of song.channels) {
        // A lane that never sounds has no entry state to declare. `channels` is a PREFIX
        // of the canonical eight, so a VRC6 song carries an empty dpcm lane it never uses.
        if (played(song, channel).length === 0) continue
        const first = pattern(song, channel, qa.loopFrame).rows.find((c) => c.r === 0)
        expect(first, `${channel}: explicit state at loop entry`).toBeDefined()
        if (first!.note !== -1) {
          expect(first!.inst).toBeDefined()
          expect(first!.vol).toBeDefined()
          expect(first!.note).toBeGreaterThanOrEqual(0)
        }
      }
    })

    it(`${file}: stays inside hardware registers and uses self-ending percussion`, () => {
      for (const p of song.patterns) for (const c of p.rows) {
        if (c.note === undefined || c.note < 0) continue
        if (p.channel.startsWith('pulse')) expect(c.note).toBeGreaterThanOrEqual(33)
        if (p.channel === 'triangle') expect(c.note).toBeGreaterThanOrEqual(21)
        // The VRC6's dividers are 12-bit, so its lanes reach an octave below a 2A03
        // pulse; the saw divides by 14 and bottoms out two semitones higher than its
        // pulses. Both ceilings are the pulses' — nothing stops a short timer up there.
        if (p.channel === 'vrc6p1' || p.channel === 'vrc6p2') {
          expect(c.note, p.channel).toBeGreaterThanOrEqual(VRC6_PULSE_FLOOR)
        }
        if (p.channel === 'vrc6saw') expect(c.note, p.channel).toBeGreaterThanOrEqual(VRC6_SAW_FLOOR)
        expect(c.note).toBeLessThanOrEqual(MAX_NOTE)
        if (p.channel === 'noise') {
          expect(c.note).toBeGreaterThanOrEqual(32)
          expect(c.note).toBeLessThanOrEqual(47)
          if (c.inst !== undefined) {
            const envelope = song.sequences.volume[song.instruments[c.inst].macros.volume]
            expect(envelope.loop).toBe(-1)
            expect(envelope.values.at(-1)).toBe(0)
          }
        }
      }
      for (const seq of [...song.sequences.pitch, ...song.sequences.hiPitch]) {
        if (seq.loop >= 0) expect(seq.values.slice(seq.loop).reduce((a, b) => a + b, 0), 'pitch loops must not drift').toBe(0)
        else expect(seq.values.at(-1), 'held pitch tails must not drift').toBe(0)
      }
    })
  }
})
