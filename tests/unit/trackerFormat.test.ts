/** Song format v1 — the validator and the serializer (design §1).
 *
 *  (Named `trackerFormat` rather than the design §7.1 working title `songFormat` so it
 *  falls inside WP9's `tests/unit/tracker*.test.ts` ownership glob; same contents.)
 *
 *  Headline assertions:
 *    - `parse ∘ serialize ∘ parse` is the identity over five documents, and the text is
 *      BYTE-stable: key order, indent, pattern order, row order, trailing newline.
 *    - every §1.5 error is produced with a message that names the thing that is wrong.
 *    - `null` for `inst`/`vol`/`note` is REJECTED — "unchanged" is an absent key, never
 *      null and never 0. This is the single most common tracker-format bug.
 *    - duplicate (channel, index) patterns are REJECTED — the compiler keeps the LAST,
 *      the grid finds the FIRST — and a wrong-typed order entry is an error, never a
 *      silent pattern 0.
 *    - unknown top-level keys WARN and are dropped; `extra` round-trips verbatim.
 *    - `fx` trailing nulls are omitted on write and tolerated on read.
 *    - `region: "pal"` warns (D-TK5) and still loads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SongFormatError,
  decodeBase64,
  parseSong,
  serializeSong,
} from '../../src/tracker/model/validate'
import { emptySong, type Song } from '../../src/tracker/model/types'

const TINY = join(import.meta.dirname, '..', 'fixtures', 'songs', 'tiny.json')

function tiny(): Record<string, unknown> {
  return JSON.parse(readFileSync(TINY, 'utf8')) as Record<string, unknown>
}

/** Deep-clone the fixture and hand it to a mutator, so each case is independent. */
function broken(mutate: (doc: Record<string, unknown>) => void): Record<string, unknown> {
  const doc = tiny()
  mutate(doc)
  return doc
}

function errorsOf(doc: unknown): { path: string; message: string }[] {
  try {
    parseSong(doc)
  } catch (e) {
    if (e instanceof SongFormatError) {
      return e.diagnostics.filter((d) => d.severity === 'error').map((d) => ({ path: d.path, message: d.message }))
    }
    throw e
  }
  return []
}

function paths(doc: unknown): string[] {
  return errorsOf(doc).map((d) => d.path)
}

describe('round-trip', () => {
  const documents: Record<string, () => Song> = {
    tiny: () => parseSong(tiny()).song,
    empty: () => emptySong(),
    'renamed meta': () => ({ ...emptySong(), meta: { ...emptySong().meta, name: 'x', author: 'y' } }),
    'pal + even tempo': () => ({
      ...emptySong(),
      meta: { ...emptySong().meta, region: 'pal', evenTempo: true, tempo: 125, engineSpeed: 50 },
    }),
    'sequences + extra': () => ({
      ...emptySong(),
      instruments: [
        { name: 'a', macros: { volume: 0, arpeggio: 0, pitch: -1, hiPitch: -1, duty: -1 } },
      ],
      sequences: {
        volume: [{ values: [15, 8, 4, 0], loop: -1, release: 1 }],
        arpeggio: [{ values: [0, 4, 7], loop: 0, release: -1, mode: 'fixed' }],
        pitch: [],
        hiPitch: [],
        duty: [],
      },
      patterns: emptySong().patterns.map((p) =>
        p.channel === 'pulse1' ? { ...p, rows: [{ r: 0, note: 60, inst: 0, vol: 15 }] } : p,
      ),
      extra: { qa: { key: 'a-minor', nested: [1, 2, { deep: true }] } },
    }),
  }

  for (const [name, make] of Object.entries(documents)) {
    it(`is the identity on "${name}"`, () => {
      const song = make()
      const text = serializeSong(song)
      const back = parseSong(JSON.parse(text)).song
      expect(serializeSong(back)).toBe(text)
      expect(back).toEqual(song)
    })
  }

  it('is byte-stable: declaration key order, two-space indent, trailing newline', () => {
    const text = serializeSong(parseSong(tiny()).song)
    const lines = text.split('\n')
    expect(text.endsWith('}\n')).toBe(true)
    expect(text.includes(' \n')).toBe(false)
    expect(lines[1]).toBe('  "format": "pulsar-song",')
    expect(lines[2]).toBe('  "version": 1,')
    const keys = Object.keys(JSON.parse(text) as Record<string, unknown>)
    expect(keys).toEqual([
      'format',
      'version',
      'meta',
      'channels',
      'effectColumns',
      'order',
      'patterns',
      'instruments',
      'sequences',
      'samples',
      'extra',
    ])
  })

  it('sorts patterns by (channel, index) and rows by r', () => {
    const song = parseSong(
      broken((doc) => {
        const patterns = doc.patterns as { channel: string; index: number; rows: unknown[] }[]
        patterns.reverse()
      }),
    ).song
    const out = JSON.parse(serializeSong(song)) as {
      patterns: { channel: string; index: number }[]
    }
    expect(out.patterns.map((p) => `${p.channel}:${p.index}`)).toEqual([
      'pulse1:0',
      'pulse1:1',
      'pulse2:0',
      'triangle:0',
      'noise:0',
      'dpcm:0',
    ])
  })

  it('round-trips `extra` verbatim, never interpreting it', () => {
    const { song } = parseSong(tiny())
    expect(song.extra).toEqual({ notes: 'param 71 = 0x47 = arpeggio +4/+7 = major triad' })
  })
})

describe('the decimal/hex seam', () => {
  it('stores effect params as DECIMAL on disk — 71 is what the grid shows as 047', () => {
    const { song } = parseSong(tiny())
    const p = song.patterns.find((x) => x.channel === 'pulse1' && x.index === 0)
    const cell = p?.rows.find((c) => c.r === 4)
    expect(cell?.fx?.[0]).toEqual({ cmd: '0', param: 71 })
    expect(71).toBe(0x47)
  })
})

describe('fx tolerance', () => {
  it('parses trailing nulls and omits them on write', () => {
    const withNulls = broken((doc) => {
      const patterns = doc.patterns as { rows: Record<string, unknown>[] }[]
      patterns[0].rows[2].fx = [{ cmd: '0', param: 71 }, null, null, null]
    })
    const a = serializeSong(parseSong(withNulls).song)
    const b = serializeSong(parseSong(tiny()).song)
    expect(a).toBe(b)
  })

  it('keeps an interior null so column 2 stays column 2', () => {
    const doc = broken((doc2) => {
      const patterns = doc2.patterns as { rows: Record<string, unknown>[] }[]
      patterns[0].rows[2].fx = [null, { cmd: '4', param: 0x47 }]
      ;(doc2.effectColumns as number[])[0] = 2
    })
    const { song } = parseSong(doc)
    const cell = song.patterns[0].rows.find((c) => c.r === 4)
    expect(cell?.fx).toEqual([null, { cmd: '4', param: 71 }])
  })
})

describe('errors — refuse to load', () => {
  it('wrong format', () => {
    expect(paths(broken((d) => (d.format = 'famitracker')))).toContain('format')
  })

  it('a newer major version', () => {
    expect(paths(broken((d) => (d.version = 2)))).toContain('version')
  })

  it('channels that are not a prefix of the canonical five', () => {
    expect(paths(broken((d) => (d.channels = ['pulse1', 'triangle'])))).toContain('channels[1]')
  })

  it('an order frame of the wrong length', () => {
    expect(paths(broken((d) => ((d.order as number[][])[0] = [0, 0])))).toContain('order[0]')
  })

  it('a frame referencing a missing pattern', () => {
    const errs = errorsOf(broken((d) => ((d.order as number[][])[0][0] = 9)))
    expect(errs.some((e) => e.path === 'order[0][0]' && e.message.includes('does not exist'))).toBe(true)
  })

  it('a wrong-typed order entry — null/string/NaN must not silently become pattern 0', () => {
    for (const bad of [null, '0', 'pulse1:0', NaN]) {
      const errs = errorsOf(broken((d) => ((d.order as unknown[][])[0][0] = bad)))
      expect(
        errs.some((e) => e.path === 'order[0][0]' && e.message.includes('pattern index')),
        String(bad),
      ).toBe(true)
    }
  })

  it('an order entry of 0 is legitimate — it names pattern 0', () => {
    // tiny's first frame is [0, 0, 0, 0, 0]: pattern 0 on every channel, zero errors.
    expect(errorsOf(tiny())).toEqual([])
  })

  it('a pattern on a channel the song does not have', () => {
    const errs = errorsOf(
      broken((d) => {
        ;(d.patterns as Record<string, unknown>[])[0].channel = 'vrc6pulse1'
      }),
    )
    expect(errs.some((e) => e.path === 'patterns[0].channel')).toBe(true)
  })

  it('a duplicated (channel, index) pattern — compile keeps the LAST, the grid shows the FIRST', () => {
    const errs = errorsOf(
      broken((d) => {
        ;(d.patterns as Record<string, unknown>[]).push({
          channel: 'pulse1',
          index: 0,
          rows: [{ r: 0, note: 48 }],
        })
      }),
    )
    expect(errs.some((e) => e.path.endsWith('.index') && e.message.includes('pulse1:0 is duplicated'))).toBe(true)
  })

  it('a float index that ROUNDS onto an existing pattern is a duplicate too', () => {
    // Math.round(0.4) lands on the real pulse1:0 — the collision exists post-rounding.
    const errs = errorsOf(
      broken((d) => {
        ;(d.patterns as Record<string, unknown>[]).push({ channel: 'pulse1', index: 0.4, rows: [] })
      }),
    )
    expect(errs.some((e) => e.message.includes('pulse1:0 is duplicated'))).toBe(true)
  })

  it('the same index on DIFFERENT channels is not a duplicate', () => {
    const doc = broken((d) => {
      ;(d.patterns as Record<string, unknown>[]).push({ channel: 'pulse2', index: 1, rows: [] })
      ;(d.order as number[][]).push([1, 1, 0, 0, 0])
    })
    expect(errorsOf(doc)).toEqual([])
  })

  it('rows out of range, out of order, or duplicated', () => {
    expect(
      paths(broken((d) => ((d.patterns as { rows: { r: number }[] }[])[0].rows[0].r = 99))),
    ).toContain('patterns[pulse1:0].rows[0].r')
    const unsorted = errorsOf(
      broken((d) => {
        const rows = (d.patterns as { rows: { r: number }[] }[])[0].rows
        rows[1].r = 0
      }),
    )
    expect(unsorted.some((e) => e.message.includes('duplicated'))).toBe(true)
    const backwards = errorsOf(
      broken((d) => {
        const rows = (d.patterns as { rows: { r: number }[] }[])[0].rows
        rows[0].r = 5
      }),
    )
    expect(backwards.some((e) => e.message.includes('out of order'))).toBe(true)
  })

  it('a note outside -2..119', () => {
    expect(
      paths(broken((d) => ((d.patterns as { rows: { note?: number }[] }[])[0].rows[0].note = 120))),
    ).toContain('patterns[pulse1:0].rows[0].note')
    expect(
      paths(broken((d) => ((d.patterns as { rows: { note?: number }[] }[])[0].rows[0].note = -3))),
    ).toContain('patterns[pulse1:0].rows[0].note')
  })

  it('REJECTS null for inst, vol and note — "unchanged" is an ABSENT key', () => {
    for (const field of ['inst', 'vol', 'note'] as const) {
      const errs = errorsOf(
        broken((d) => {
          ;(d.patterns as { rows: Record<string, unknown>[] }[])[0].rows[0][field] = null
        }),
      )
      expect(errs.some((e) => e.path.endsWith(`.${field}`)), field).toBe(true)
      expect(errs.some((e) => e.message.toLowerCase().includes('null')), field).toBe(true)
    }
  })

  it('an out-of-range vol or effect param', () => {
    expect(
      paths(broken((d) => ((d.patterns as { rows: { vol?: number }[] }[])[0].rows[0].vol = 16))),
    ).toContain('patterns[pulse1:0].rows[0].vol')
    expect(
      paths(
        broken((d) => {
          const rows = (d.patterns as { rows: Record<string, unknown>[] }[])[0].rows
          rows[2].fx = [{ cmd: '0', param: 300 }]
        }),
      ),
    ).toContain('patterns[pulse1:0].rows[4].fx[0].param')
  })

  it('an instrument index with nothing behind it', () => {
    const errs = errorsOf(
      broken((d) => ((d.patterns as { rows: { inst?: number }[] }[])[0].rows[0].inst = 7)),
    )
    expect(errs.some((e) => e.message.includes('instrument 7'))).toBe(true)
  })

  it('a macro index with no sequence behind it', () => {
    const errs = errorsOf(
      broken((d) => {
        ;(d.instruments as { macros: Record<string, number> }[])[0].macros.arpeggio = 3
      }),
    )
    expect(errs.some((e) => e.path === 'instruments[0].macros.arpeggio')).toBe(true)
  })

  it('loop or release outside -1..values.length-1', () => {
    expect(
      paths(
        broken((d) => {
          ;(d.sequences as { volume: { loop: number }[] }).volume[0].loop = 5
        }),
      ),
    ).toContain('sequences.volume[0].loop')
    expect(
      paths(
        broken((d) => {
          ;(d.sequences as { volume: { release: number }[] }).volume[0].release = -2
        }),
      ),
    ).toContain('sequences.volume[0].release')
  })

  it('arpeggio scheme mode (0CC only)', () => {
    const errs = errorsOf(
      broken((d) => {
        ;(d.sequences as Record<string, unknown[]>).arpeggio = [
          { values: [0], loop: -1, release: -1, mode: 'scheme' },
        ]
      }),
    )
    expect(errs.some((e) => e.path === 'sequences.arpeggio[0].mode')).toBe(true)
  })

  it('speed / tempo / engineSpeed out of range', () => {
    expect(paths(broken((d) => ((d.meta as { speed: number }).speed = 32)))).toContain('meta.speed')
    expect(paths(broken((d) => ((d.meta as { tempo: number }).tempo = 31)))).toContain('meta.tempo')
    expect(paths(broken((d) => ((d.meta as { engineSpeed: number }).engineSpeed = 401)))).toContain(
      'meta.engineSpeed',
    )
  })

  it('a DMC sample whose decoded length is not 16n + 1', () => {
    // 16 bytes decoded -> 16n, not 16n+1.
    const sixteen = 'AAAAAAAAAAAAAAAAAAAAAA=='
    expect(decodeBase64(sixteen)?.length).toBe(16)
    const errs = errorsOf(
      broken((d) => {
        d.samples = [{ name: 'bad', data: sixteen }]
      }),
    )
    expect(errs.some((e) => e.message.includes('16n + 1'))).toBe(true)
  })

  it('throws SongFormatError carrying every error, not just the first', () => {
    let caught: SongFormatError | null = null
    try {
      parseSong(
        broken((d) => {
          ;(d.meta as { speed: number }).speed = 99
          ;(d.meta as { tempo: number }).tempo = 1
        }),
      )
    } catch (e) {
      caught = e as SongFormatError
    }
    expect(caught).toBeInstanceOf(SongFormatError)
    expect(caught?.diagnostics.filter((d) => d.severity === 'error').length).toBeGreaterThanOrEqual(2)
  })
})

describe('warnings — load anyway', () => {
  it('drops an unknown top-level key and says so', () => {
    const { song, diagnostics } = parseSong(
      broken((d) => {
        d.groove = [6, 5, 6, 5]
      }),
    )
    expect(diagnostics.some((x) => x.path === 'groove' && x.severity === 'warn')).toBe(true)
    expect('groove' in song).toBe(false)
    expect(serializeSong(song).includes('groove')).toBe(false)
  })

  it('warns on an unknown effect command and keeps it round-tripping', () => {
    const { song, diagnostics } = parseSong(
      broken((d) => {
        ;(d.patterns as { rows: Record<string, unknown>[] }[])[0].rows[2].fx = [
          { cmd: 'C', param: 0 },
          { cmd: 'K', param: 5 },
        ]
        ;(d.effectColumns as number[])[0] = 2
      }),
    )
    expect(diagnostics.some((x) => x.message.includes('unknown effect command "K"'))).toBe(true)
    expect(serializeSong(song).includes('"K"')).toBe(true)
  })

  it('warns on a reserved (deferred) effect rather than calling it unknown', () => {
    const { diagnostics } = parseSong(
      broken((d) => {
        ;(d.patterns as { rows: Record<string, unknown>[] }[])[0].rows[2].fx = [
          { cmd: 'H', param: 5 },
        ]
      }),
    )
    expect(diagnostics.some((x) => x.message.includes('reserved for a later phase'))).toBe(true)
  })

  it('warns on an effect column past effectColumns', () => {
    const { diagnostics } = parseSong(
      broken((d) => {
        ;(d.patterns as { rows: Record<string, unknown>[] }[])[0].rows[2].fx = [
          { cmd: '0', param: 71 },
          { cmd: '4', param: 0x47 },
        ]
      }),
    )
    expect(diagnostics.some((x) => x.message.includes("beyond this channel's effectColumns"))).toBe(
      true,
    )
  })

  it('warns on an unreferenced pattern and an unreferenced instrument', () => {
    const { diagnostics } = parseSong(
      broken((d) => {
        const patterns = d.patterns as Record<string, unknown>[]
        patterns.push({ channel: 'noise', index: 4, rows: [] })
        const insts = d.instruments as Record<string, unknown>[]
        insts.push({ name: 'unused', macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: -1 } })
      }),
    )
    expect(diagnostics.some((x) => x.message.includes('never referenced by the order list'))).toBe(true)
    expect(diagnostics.some((x) => x.message.includes('instrument is never referenced'))).toBe(true)
  })

  it('warns D-TK5 on a PAL song and still loads it', () => {
    const { song, diagnostics } = parseSong(
      broken((d) => ((d.meta as { region: string }).region = 'pal')),
    )
    expect(song.meta.region).toBe('pal')
    expect(diagnostics.some((x) => x.message.includes('D-TK5'))).toBe(true)
  })

  it('anti-vacuity: the clean fixture produces ZERO diagnostics', () => {
    expect(parseSong(tiny()).diagnostics).toEqual([])
  })
})

describe('base64', () => {
  it('decodes, and rejects non-base64', () => {
    expect(Array.from(decodeBase64('AAE=') ?? [])).toEqual([0, 1])
    expect(decodeBase64('not base64!')).toBeNull()
    expect(decodeBase64('AAA')).toBeNull()
  })
})
