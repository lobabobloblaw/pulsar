/** Preset format gate (design §5.5 gate A, §7.1) — the half WP9 owns.
 *
 *  This suite runs against WHATEVER EXISTS in `src/assets/songs/`. The album has since
 *  landed in full, so the first test pins the count: a vanished JSON fails the run
 *  instead of silently shrinking the per-file suites below. WP11's own
 *  `presets.test.ts` adds gates B–D (musicality lint, offline render, anti-vacuity);
 *  this file is the structural floor underneath them.
 *
 *  Headline assertions:
 *    - every shipped preset parses with ZERO error diagnostics and round-trips
 *      byte-identically through `serializeSong`.
 *    - every effect a preset uses is one the phase-2 driver actually implements.
 *    - the golden song: `tests/fixtures/songs/tiny.json` renders to a PINNED checksum
 *      through `renderSong`, so the driver, the macro engine and the DSP path are all
 *      held together by one number.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import { SUPPORTED_EFFECTS } from '../../src/tracker/model/types'
import { renderSong, rmsDb } from '../../src/tracker/offlineRender'

const ROOT = join(import.meta.dirname, '..', '..')
const PRESET_DIR = join(ROOT, 'src', 'assets', 'songs')
const TINY = join(ROOT, 'tests', 'fixtures', 'songs', 'tiny.json')

/** The four technique demos design §5.2 commits to, plus the eight album pieces
 *  `docs/preset-suite.md` §4 adds to the same directory and the two `docs/preset-suite.md`
 *  §10.4 adds after them (`green-flash`, `harbour-echo`). The album is complete: all of
 *  them must be present, and nothing OUTSIDE the list may ever appear. Album files carry
 *  a two-digit play-order prefix (`07-rust-and-neon.json`), which
 *  `src/assets/songs/index.ts` strips to form the id. */
const EXPECTED_PRESETS = [
  'first-light',
  'long-fall',
  'hammer-shop',
  'switchback',
  'iron-sunrise',
  'glass-ladder',
  'midnight-ferry',
  'paper-lanterns',
  'tide-pool',
  'switch-cutter',
  'rust-and-neon',
  'long-division',
  'green-flash',
  'harbour-echo',
]

function presetFiles(): string[] {
  if (!existsSync(PRESET_DIR)) return []
  return readdirSync(PRESET_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
}

describe('shipped presets — structural gate', () => {
  const files = presetFiles()

  it(`ships exactly the ${EXPECTED_PRESETS.length} album tracks (${files.length} found)`, () => {
    const present = files.map((f) => f.replace(/\.json$/, '').replace(/^\d{2}-/, ''))
    for (const id of present) expect(EXPECTED_PRESETS).toContain(id)
    // Presence is a hard floor: without it a vanished JSON would only shrink the
    // per-file suites below — a loop over an empty file list registers nothing and
    // the run stays green. The pin on EXPECTED_PRESETS itself keeps the list from
    // being edited down to match a thinning directory.
    expect(EXPECTED_PRESETS).toHaveLength(14)
    expect(files).toHaveLength(EXPECTED_PRESETS.length)
    // Nothing outside the design's list, and never twice.
    expect(new Set(present).size).toBe(present.length)
  })

  for (const file of files) {
    describe(file, () => {
      const raw: unknown = JSON.parse(readFileSync(join(PRESET_DIR, file), 'utf8'))

      it('parses with zero error diagnostics', () => {
        const { diagnostics } = parseSong(raw)
        const errors = diagnostics.filter((d) => d.severity === 'error')
        expect(errors).toEqual([])
        const unexpected = diagnostics.filter(
          (d) => !d.message.includes('never referenced by the order list'),
        )
        // Warnings other than an unreferenced pattern are printed so WP11 sees them.
        if (unexpected.length > 0) {
          expect(unexpected.map((d) => `${d.path}: ${d.message}`)).toEqual([])
        }
      })

      it('round-trips byte-identically', () => {
        const { song } = parseSong(raw)
        const text = serializeSong(song)
        expect(serializeSong(parseSong(JSON.parse(text)).song)).toBe(text)
      })

      it('uses only effects the phase-2 driver implements', () => {
        const { song } = parseSong(raw)
        const used = new Set<string>()
        for (const p of song.patterns) {
          for (const cell of p.rows) {
            for (const e of cell.fx ?? []) if (e !== null) used.add(e.cmd)
          }
        }
        for (const cmd of used) expect(SUPPORTED_EFFECTS, `effect ${cmd}`).toContain(cmd)
      })

      it('declares its QA metadata under `extra.qa`', () => {
        const { song } = parseSong(raw)
        const qa = (song.extra ?? {}).qa
        expect(qa, 'extra.qa is what the §5.5 gates read').toBeDefined()
      })
    })
  }
})

describe('the golden song — tests/fixtures/songs/tiny.json', () => {
  const { song, diagnostics } = parseSong(JSON.parse(readFileSync(TINY, 'utf8')))

  it('parses with no diagnostics at all', () => {
    expect(diagnostics).toEqual([])
  })

  it('renders one full pass to a pinned checksum', () => {
    const r = renderSong(song, { sampleRate: 48000, maxSeconds: 6, loops: 1 })
    // One `B00` loop point after two 8-row frames at 6 ticks a row.
    expect(r.rowsPlayed).toBe(16)
    expect(r.noteOns).toBe(8)
    expect(r.clippedSamples).toBe(0)
    expect(r.sampleRate).toBe(48000)
    // 16 rows x 6 ticks x (1789773/60) cycles, within one output frame.
    expect(r.cycles / 1789773).toBeCloseTo(1.6, 1)
    expect(r.samples.length).toBeGreaterThan(48000)
    expect(r.checksum).toBe(2975725462)
  })

  it('is audible, and every voice it claims is in the mix', () => {
    const full = renderSong(song, { maxSeconds: 6, loops: 1 })
    expect(rmsDb(full.samples)).toBeGreaterThan(-30)
    for (const ch of [0, 2]) {
      const solo = renderSong(song, { maxSeconds: 6, loops: 1, soloChannel: ch })
      expect(rmsDb(solo.samples), `channel ${ch}`).toBeGreaterThan(-40)
    }
    // pulse2, noise and dpcm are empty in this fixture and must be silent.
    for (const ch of [1, 3, 4]) {
      const solo = renderSong(song, { maxSeconds: 6, loops: 1, soloChannel: ch })
      expect(rmsDb(solo.samples), `channel ${ch}`).toBeLessThan(-90)
    }
  })

  it('anti-vacuity: transposing one pattern breaks the checksum', () => {
    const pinned = renderSong(song, { maxSeconds: 6, loops: 1 }).checksum
    const transposed = {
      ...song,
      patterns: song.patterns.map((p) =>
        p.channel === 'pulse1' && p.index === 0
          ? { ...p, rows: p.rows.map((c) => (c.note !== undefined && c.note >= 0 ? { ...c, note: c.note + 1 } : c)) }
          : p,
      ),
    }
    expect(renderSong(transposed, { maxSeconds: 6, loops: 1 }).checksum).not.toBe(pinned)
  })
})
