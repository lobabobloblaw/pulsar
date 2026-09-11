/** The five-lane songs did not move.
 *
 *  Adding three lanes to `CANONICAL_CHANNELS` grows `MAX_CHANNELS`, rewires every
 *  register address through a base table and gives `RegisterFile` a second notion of
 *  "enabled". Any one of those could have shifted a 2A03 song's timeline by a byte,
 *  and a shifted timeline is a changed sound that no checksum elsewhere would have
 *  caught until a preset render disagreed.
 *
 *  So this gate pins the FNV-1a of the WHOLE register trace — cycle, address and value
 *  of every write, in order, including `stop()`'s all-channels-off — for the golden
 *  fixture and all three shipped songs. The four numbers were recorded on `main`,
 *  before any of this existed.
 *
 *  Anti-vacuity (house style): the last case proves the hash can fail, by driving one
 *  deliberately altered song and asserting the number MOVES.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong } from '../../src/tracker/model/validate'
import { hashTrace, traceOf } from '../fixtures/songs/trace'
import { CHIP_2A03_CHANNELS, type Song } from '../../src/tracker/model/types'

const SONGS = join(import.meta.dirname, '..', 'fixtures', 'songs')
const ASSETS = join(import.meta.dirname, '..', '..', 'src', 'assets', 'songs')

function load(path: string): Song {
  return parseSong(JSON.parse(readFileSync(path, 'utf8')) as unknown).song
}

/** `[name, path, ticks, writes, hash]`, recorded on `main` at 006f837. */
const PINNED: [string, string, number, number, number][] = [
  ['tiny', join(SONGS, 'tiny.json'), 600, 767, 806142942],
  ['skyline run', join(ASSETS, '01-skyline-run.json'), 3000, 8280, 1024797720],
  ['cathedral of gears', join(ASSETS, '02-cathedral-of-gears.json'), 3000, 6103, 1983719432],
  ['tide tables', join(ASSETS, '03-tide-tables.json'), 3000, 1094, 3887850663],
]

describe('every five-lane song’s register trace is byte-for-byte what it was', () => {
  for (const [name, path, ticks, writes, hash] of PINNED) {
    it(name, () => {
      const song = load(path)
      // a 2A03 song: some of these stop short of dpcm, which is a legal prefix too
      expect(song.channels.length).toBeLessThanOrEqual(CHIP_2A03_CHANNELS.length)
      expect([...song.channels]).toEqual(
        [...CHIP_2A03_CHANNELS].slice(0, song.channels.length),
      )
      const trace = traceOf(song, ticks)
      expect(trace.length, `${name} write count`).toBe(writes)
      expect(hashTrace(trace), `${name} trace hash`).toBe(hash)
    })
  }

  it('and none of them touches a VRC6 register or $9003', () => {
    for (const [name, path, ticks] of PINNED) {
      const trace = traceOf(load(path), ticks)
      for (let i = 0; i < trace.length; i++) {
        expect(trace.addrs[i], `${name} write ${i}`).toBeLessThan(0x4018)
      }
    }
  })
})

describe('the gate can fail', () => {
  it('one transposed note moves the hash and the assertion catches it', () => {
    const tiny = load(join(SONGS, 'tiny.json'))
    const good = hashTrace(traceOf(tiny, 600))
    expect(good).toBe(806142942)

    // The smallest change a musician could make: shift one pattern up a semitone.
    const altered: Song = {
      ...tiny,
      patterns: tiny.patterns.map((p, i) =>
        i === 0
          ? { ...p, rows: p.rows.map((c) => (c.note === undefined || c.note < 0 ? c : { ...c, note: c.note + 1 })) }
          : p,
      ),
    }
    const moved = hashTrace(traceOf(altered, 600))
    expect(moved).not.toBe(good)
  })

  it('and so does one extra write in the middle of a trace', () => {
    const trace = traceOf(load(join(SONGS, 'tiny.json')), 600)
    const base = hashTrace(trace)
    trace.addrs[10] = trace.addrs[10] + 1
    expect(hashTrace(trace)).not.toBe(base)
  })
})
