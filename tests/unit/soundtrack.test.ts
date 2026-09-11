/** Piece-specific contracts for the three OCTET tracks — what makes each one itself, not
 *  an automated claim of musical quality (tools/songs/octet/README.md, docs/soundtrack.md). */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

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
  return song.extra!.qa as { form: string[]; loopFrame: number; accidentalFractionMax?: number; key: string }
}

describe('the OCTET tracks', () => {
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

  it('Cathedral of Gears: the triangle carries the bass, pulse 2 a chord device, the key allows the raised seventh', () => {
    const s = named('cathedral-of-gears')
    expect(s.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise'])
    const tri = played(s, 'triangle')
    expect(tri.length).toBeGreaterThan(played(s, 'pulse1').length * 3)
    expect(tri.length).toBeGreaterThan(played(s, 'pulse2').length * 3)
    expect(Math.min(...tri.map((c) => c.note!))).toBeLessThan(36) // the sawtooth's own octave
    // the counter-melody lane spells the inner harmony with 0xy while it rests
    const chords = played(s, 'pulse2').filter((c) => c.fx?.some((e) => e && e.cmd === '0' && e.param !== 0))
    expect(chords.length).toBeGreaterThanOrEqual(8)
    expect(qaOf(s).key).toBe('d-minor')
    expect(qaOf(s).accidentalFractionMax).toBe(0.2)
    expect(s.order).toHaveLength(22)
    expect(qaOf(s).loopFrame).toBe(2)
  })

  it('Tide Tables: two bars of 5/4 a pattern, 3xx drones on the triangle, fixed-mode bells', () => {
    const s = named('tide-tables')
    expect(s.meta.rowsPerPattern).toBe(80)
    expect(s.meta.rowHighlight).toBe(8)
    expect(s.meta.rowHighlight2).toBe(40)
    expect(s.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise'])
    const glides = played(s, 'triangle').filter((c) => c.fx?.some((e) => e && e.cmd === '3' && e.param !== 0))
    expect(glides.length).toBeGreaterThanOrEqual(20)
    expect(s.sequences.arpeggio.length).toBeGreaterThanOrEqual(4)
    for (const seq of s.sequences.arpeggio) expect(seq.mode).toBe('fixed')
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
