/** Song format v1 with the three VRC6 lanes (spec-core "Song format").
 *
 *  The format did NOT get a version bump, and that is the claim under test here:
 *    - `channels` is still a PREFIX of `CANONICAL_CHANNELS`, which now has eight
 *      entries, so a five-lane song is unchanged on disk and an eight-lane one is
 *      refused by an older build with the diagnostic it already has;
 *    - a new document is still a 2A03 document — five lanes, five effect columns,
 *      one five-wide order frame, five patterns;
 *    - the length checks that used to say "five" now say "as many as `channels`".
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SongFormatError, parseSong, serializeSong } from '../../src/tracker/model/validate'
import {
  CANONICAL_CHANNELS,
  CHIP_2A03_CHANNELS,
  emptySong,
  type ChannelId,
} from '../../src/tracker/model/types'

const SONGS = join(import.meta.dirname, '..', 'fixtures', 'songs')

function doc(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(SONGS, name), 'utf8')) as Record<string, unknown>
}

function errorPaths(input: unknown): string[] {
  try {
    parseSong(input)
  } catch (e) {
    if (e instanceof SongFormatError) {
      return e.diagnostics.filter((d) => d.severity === 'error').map((d) => d.path)
    }
    throw e
  }
  return []
}

describe('the canonical lane list', () => {
  it('is the five 2A03 lanes then the three VRC6 ones, in that order', () => {
    expect([...CANONICAL_CHANNELS]).toEqual([
      'pulse1',
      'pulse2',
      'triangle',
      'noise',
      'dpcm',
      'vrc6p1',
      'vrc6p2',
      'vrc6saw',
    ])
    expect([...CHIP_2A03_CHANNELS]).toEqual([...CANONICAL_CHANNELS].slice(0, 5))
  })

  it('a NEW document is still a 2A03 song — five of everything', () => {
    const s = emptySong()
    expect([...s.channels]).toEqual([...CHIP_2A03_CHANNELS])
    expect(s.effectColumns).toHaveLength(5)
    expect(s.order).toEqual([[0, 0, 0, 0, 0]])
    expect(s.patterns).toHaveLength(5)
    // and it still round-trips as the five-lane document it has always been
    expect(parseSong(JSON.parse(serializeSong(s))).song.channels).toHaveLength(5)
  })
})

describe('an eight-lane song', () => {
  it('parses with no diagnostics at all', () => {
    const r = parseSong(doc('vrc6.json'))
    expect(r.diagnostics).toEqual([])
    expect([...r.song.channels]).toEqual([...CANONICAL_CHANNELS])
  })

  it('serializes byte-stably and parse ∘ serialize ∘ parse is the identity', () => {
    const once = parseSong(doc('vrc6.json')).song
    const text = serializeSong(once)
    const twice = parseSong(JSON.parse(text)).song
    expect(serializeSong(twice)).toBe(text)
    expect(twice).toEqual(once)
    // byte-stable against the file on disk, not merely self-consistent
    expect(text).toBe(readFileSync(join(SONGS, 'vrc6.json'), 'utf8'))
  })

  it('carries the VRC6 material the driver suites read', () => {
    const song = parseSong(doc('vrc6.json')).song
    const ids = song.patterns.map((p) => p.channel)
    expect(ids).toContain('vrc6p1' as ChannelId)
    expect(ids).toContain('vrc6p2' as ChannelId)
    expect(ids).toContain('vrc6saw' as ChannelId)
    expect(ids).toContain('pulse1' as ChannelId)
    expect(song.sequences.duty[0].values).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
})

describe('the prefix rule now runs against eight', () => {
  it('a six-lane song — through vrc6p1 — loads', () => {
    const d = doc('vrc6.json')
    d.channels = [...CANONICAL_CHANNELS].slice(0, 6)
    d.effectColumns = [1, 1, 1, 1, 1, 1]
    d.order = [[0, 0, 0, 0, 0, 0]]
    d.patterns = (d.patterns as { channel: string }[]).filter(
      (p) => p.channel !== 'vrc6p2' && p.channel !== 'vrc6saw',
    )
    expect(parseSong(d).diagnostics).toEqual([])
  })

  it('a list that SKIPS vrc6p1 is rejected at channels[5]', () => {
    const d = doc('vrc6.json')
    d.channels = ['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p2', 'vrc6saw']
    expect(errorPaths(d)).toContain('channels[5]')
  })

  it("'vrc6pulse1' is not an id — the old probe still fails, as a lane and as a pattern", () => {
    const asLane = doc('vrc6.json')
    asLane.channels = ['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6pulse1']
    expect(errorPaths(asLane)).toContain('channels[5]')

    const asPattern = doc('tiny.json')
    ;(asPattern.patterns as Record<string, unknown>[])[0].channel = 'vrc6pulse1'
    expect(errorPaths(asPattern)).toContain('patterns[0].channel')
  })

  it('effectColumns and order frames are checked against eight, not five', () => {
    const short = doc('vrc6.json')
    short.effectColumns = [1, 1, 1, 1, 1]
    expect(errorPaths(short)).toContain('effectColumns')

    const narrow = doc('vrc6.json')
    ;(narrow.order as number[][])[0] = [0, 0, 0, 0, 0]
    expect(errorPaths(narrow)).toContain('order[0]')
  })
})

describe('no existing fixture changed its diagnostics', () => {
  /** Recorded on `main` before the VRC6 lanes existed: `severity:path` for every
   *  diagnostic each fixture produces, whether it loads or throws. Adding lanes to
   *  the canonical list must not move a single one of them. */
  const PINNED: Record<string, string[]> = {
    'bad-bank-drift.json': [],
    'bad-hex-param.json': ['error:patterns[pulse1:3].rows[0].fx[0].param'],
    'bad-inst-ref.json': ['error:patterns[pulse1:1].rows[0].inst'],
    'bad-key.json': [],
    'bad-loop-frame.json': [],
    'bad-null-inst.json': ['error:patterns[pulse1:1].rows[6].inst'],
    'bad-order-ref.json': ['error:order[0][0]'],
    'bad-percussion.json': ['warn:instruments[7]'],
    'bad-row-order.json': ['error:patterns[pulse1:1].rows[2].r'],
    'bad-sample-length.json': ['error:samples[0].data'],
    // gate B2's fixture (preset-suite §12.5): a clean five-lane document whose only
    // fault is musical — three channel modes latched across its own Bxx.
    'bad-sticky-seam.json': [],
    'tiny.json': [],
  }

  it('pins every one of them', () => {
    for (const [name, expected] of Object.entries(PINNED)) {
      let got: string[] = []
      try {
        got = parseSong(doc(name)).diagnostics.map((d) => `${d.severity}:${d.path}`)
      } catch (e) {
        if (!(e instanceof SongFormatError)) throw e
        got = e.diagnostics.map((d) => `${d.severity}:${d.path}`)
      }
      expect(got, name).toEqual(expected)
    }
  })

  it('covers every five-lane fixture in the tree — a new one cannot be forgotten', () => {
    const onDisk = readdirSync(SONGS)
      .filter((n) => n.endsWith('.json') && n !== 'shared-bank.json' && n !== 'vrc6.json')
      .sort()
    expect(onDisk).toEqual(Object.keys(PINNED).sort())
  })
})
