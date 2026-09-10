/** Genre-specific contracts, not an automated claim of musical quality. */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const dir = join(import.meta.dirname, '../../src/assets/songs')
const songs = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((file) => ({
  file, song: parseSong(JSON.parse(readFileSync(join(dir, file), 'utf8'))).song,
}))
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

describe('genre restart', () => {
  it('has eight different rhythmic arrangements, opening palettes and tempos', () => {
    expect(songs).toHaveLength(8)
    expect(new Set(songs.map(({ song }) => song.extra!.genre)).size).toBe(8)
    expect(new Set(songs.map(({ song }) => texture(song))).size).toBe(8)
    expect(new Set(songs.map(({ song }) => openingTimbre(song))).size).toBe(8)
    expect(new Set(songs.map(({ song }) => bpm(song))).size).toBe(8)
    expect(Math.min(...songs.map(({ song }) => bpm(song)))).toBe(48)
    expect(Math.max(...songs.map(({ song }) => bpm(song)))).toBe(192)
    // Relabeling, transposing and speeding up a copy cannot fake a new texture.
    const original = songs[0].song
    const copy: Song = {
      ...original, meta: { ...original.meta, name: 'Not a new genre', tempo: 180 },
      extra: { ...original.extra, genre: 'different label' },
      patterns: original.patterns.map((p) => ({
        ...p, rows: p.rows.map((c) => c.note !== undefined && c.note >= 0
          ? { ...c, note: c.note + 2 } : c),
      })),
    }
    expect(texture(copy)).toBe(texture(original))
  })

  it('funk starts with the rhythm section and gives the bass offbeat motion', () => {
    const s = named('pocket-voltage')
    expect(attacks(pattern(s, 'pulse1'))).toHaveLength(0)
    expect(attacks(pattern(s, 'pulse2'))).toHaveLength(0)
    expect(attacks(pattern(s, 'triangle', 1)).filter((c) => c.r % 4 !== 0).length).toBeGreaterThanOrEqual(6)
    expect(attacks(pattern(s, 'dpcm')).length).toBeGreaterThanOrEqual(4)
  })

  it('jazz uses actual 2:1 swing subdivisions and quarter-note walking bass', () => {
    const s = named('blue-hour-club')
    expect(s.meta.rowHighlight).toBe(6)
    expect(attacks(pattern(s, 'pulse1')).slice(0, 3).map((c) => c.r)).toEqual([0, 4, 6])
    for (const p of s.patterns.filter((p) => p.channel === 'triangle')) {
      expect(attacks(p).map((c) => c.r)).toEqual(Array.from({ length: 16 }, (_, i) => i * 6))
    }
    expect(s.order).toHaveLength(9) // three 12-bar blues choruses
  })

  it('dub makes pulse2 a quieter written echo and drops the dry voice', () => {
    const s = named('version-in-salt')
    const dry = attacks(pattern(s, 'pulse1'))[0]
    const echo = attacks(pattern(s, 'pulse2')).slice(0, 2)
    expect(echo.map((c) => c.r - dry.r)).toEqual([4, 6])
    expect(echo.map((c) => c.note)).toEqual([dry.note, dry.note])
    expect(echo[0].vol!).toBeLessThan(dry.vol!)
    expect(echo[1].vol!).toBeLessThan(echo[0].vol!)
    expect(attacks(pattern(s, 'pulse1', 2))).toHaveLength(0)
    expect(attacks(pattern(s, 'pulse2', 2)).length).toBeGreaterThan(0)
  })

  it('metal centers low pedal riffs and fast double-kick attacks', () => {
    const s = named('razor-rally')
    const guitar = attacks(pattern(s, 'pulse1'))
    expect(guitar.filter((c) => c.note === 52).length).toBeGreaterThanOrEqual(6)
    expect(Math.max(...guitar.map((c) => c.note!))).toBeLessThan(65)
    const kicks = attacks(pattern(s, 'dpcm'))
    expect(kicks.filter((c, i) => i > 0 && c.r - kicks[i - 1].r === 2).length).toBeGreaterThanOrEqual(8)
    expect(s.order).toHaveLength(20)
  })

  it('bossa has two-bar comping and four-note extended-chord macros', () => {
    const s = named('cafe-azimuth')
    expect(attacks(pattern(s, 'pulse2')).map((c) => c.r)).toEqual([0, 6, 12, 18, 22, 28])
    expect(s.sequences.arpeggio.map((seq) => seq.values)).toEqual([
      [0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 10],
    ])
    expect(s.order).toHaveLength(16) // 32-bar AABA
  })

  it('the invention exchanges manuals without drums or a chord macro', () => {
    const s = named('two-part-machine')
    expect(s.channels).toEqual(['pulse1', 'pulse2', 'triangle'])
    expect(attacks(pattern(s, 'pulse2'))[0].r).toBe(16)
    expect(s.sequences.arpeggio).toHaveLength(0)
    expect(s.sequences.pitch).toHaveLength(0)
    expect(new Set(s.order.map((frame) => frame[0])).size).toBe(8)
  })

  it('ambient sustains eight sonorities with slow attacks and no drum lane', () => {
    const s = named('slow-orbit')
    expect(s.channels).toEqual(['pulse1', 'pulse2', 'triangle'])
    for (const channel of s.channels) {
      const onsets = s.order.flatMap((_, frame) => attacks(pattern(s, channel, frame)))
      expect(onsets).toHaveLength(8)
      expect(onsets.every((c) => c.r === 0 || c.r === 32)).toBe(true)
    }
    const envelope = s.sequences.volume[s.instruments[0].macros.volume]
    expect(envelope.values[0]).toBeLessThan(envelope.values[40])
    expect(envelope.release).toBeGreaterThan(40)
  })

  it('drum and bass has broken grids, pitched snare chops and a skipped build', () => {
    const s = named('breakwater')
    const kit = s.instruments.find((i) => i.dpcm !== undefined)!.dpcm!
    expect(new Set(Object.values(kit).filter((a) => a.sample === 1).map((a) => a.pitch)))
      .toEqual(new Set([9, 12, 15]))
    expect((s.extra!.qa as { loopFrame: number }).loopFrame).toBe(2)
    expect(attacks(pattern(s, 'dpcm', 2)).some((c) => c.r % 4 !== 0)).toBe(true)
    expect(new Set(s.order.map((frame) => frame[4])).size).toBeGreaterThanOrEqual(4)
  })

  for (const { file, song } of songs) {
    it(`${file}: explicitly resets its own loop, without requiring an introduction`, () => {
      const qa = song.extra!.qa as { form: string[]; loopFrame: number }
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
