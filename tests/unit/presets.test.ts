/** the preset gates (phase2-design §5.5, preset-suite §7.1) — A, B, C, D.
 *
 *  These run over EVERY song registered in `src/assets/songs/`. Registration is by file
 *  presence (`index.ts` globs `./*.json`), so this suite reads the same directory rather
 *  than importing the index: `import.meta.glob` is a Vite build-time transform and does
 *  not typecheck under `tsconfig.test.json`'s node-only lib. The two sets are the same
 *  set by construction, and `the registry is a glob of this directory` below pins that.
 *
 *  Four gates, and each one can fail — `tests/fixtures/songs/bad-*.json` proves it.
 *
 *    A structural   parseSong with zero errors; warnings only for unreferenced patterns
 *    B musicality   key, tempo, percussion, claimed channels/effects, reachable frames,
 *                   plus preset-suite §7.1's loop-frame and bank-drift checks
 *    C render       duration, clipping, note-event count, per-channel audibility, level,
 *                   no long silence, pinned checksum
 *    D anti-vacuity a mutation must break the checksum; every bad fixture must fail
 *
 *  THREE DEVIATIONS FROM THE WRITTEN GATES, each forced by measurement and each stated
 *  here rather than quietly coded around:
 *
 *  1. `durationSec` describes ONE pass, and Gate C renders `loops: 2` so the loop seam is
 *     inside the checksummed audio. A looping song does NOT play its intro twice, so the
 *     rendered length is not `2 x durationSec` — it is `passes = renderedRows /
 *     rowsInOnePass`, a fraction, and the assertion divides by that.
 *  2. "all four channels audible: solo RMS > -40 dBFS" cannot work for a sample-playback
 *     lane that is silent by construction between hits (a DPCM kick lane measures around
 *     -43 dBFS over a whole pass however loud each hit is). The generalisation kept here
 *     is the LOUDEST 0.5-SECOND WINDOW of the solo pass, which asks the same question —
 *     "is this channel ever clearly in the mix?" — and answers it for sparse lanes too.
 *  3. The design's full-mix window `[-20, -9] dBFS` is not reachable on this engine. With
 *     EVERY volume column of an album piece forced to 15 the mix measures -22.4 dBFS at
 *     the default master gain; the NES mixer's non-linear LUT is what eats the headroom.
 *     The window is therefore a declared per-song `extra.qa.rmsRange`, defaulting to the
 *     design's value, and floored at -30 dBFS so it stays non-vacuous — the same shape
 *     as §7.1's `percussionGap` amendment, for the same reason.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong, type Diagnostic } from '../../src/tracker/model/validate'
import { SUPPORTED_EFFECTS, type ChannelId, type Song } from '../../src/tracker/model/types'
import { renderSong, rmsDb } from '../../src/tracker/offlineRender'
import { RowAccumulator, bpmFromTempo } from '../../src/tracker/driver/tempo'

const ROOT = join(import.meta.dirname, '..', '..')
const SONG_DIR = join(ROOT, 'src', 'assets', 'songs')
const FIXTURES = join(ROOT, 'tests', 'fixtures', 'songs')
const BANK = JSON.parse(readFileSync(join(FIXTURES, 'shared-bank.json'), 'utf8')) as BankDoc

const MELODIC: readonly ChannelId[] = ['pulse1', 'pulse2', 'triangle']
const PERCUSSION_GAP_DEFAULT = 8
const PERCUSSION_GAP_CAP = 32
const PERCUSSION_MIN_EVENTS_DEFAULT = 16
const PERCUSSION_MIN_EVENTS_FLOOR = 8
/** Fraction of played rows allowed to sit inside an over-long percussion gap (§5.5's
 *  "across >= 80 % of the played rows"). */
const PERCUSSION_COVERAGE = 0.8
const RMS_RANGE_DEFAULT: readonly [number, number] = [-20, -9]
const RMS_FLOOR = -30

// --- the registry -----------------------------------------------------------------------

interface Registered {
  id: string
  file: string
  raw: unknown
}

function registered(): Registered[] {
  if (!existsSync(SONG_DIR)) return []
  return readdirSync(SONG_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.json$/, '').replace(/^\d{2}-/, ''),
      file: f,
      raw: JSON.parse(readFileSync(join(SONG_DIR, f), 'utf8')) as unknown,
    }))
}

// --- extra.qa ---------------------------------------------------------------------------

interface Qa {
  key?: string
  channels?: ChannelId[]
  effects?: string[]
  bpmRange?: [number, number]
  durationSec?: [number, number]
  rmsRange?: [number, number]
  loopFrame?: number
  form?: string[]
  bank?: { instruments?: string[]; rev?: number }
  percussionGap?: number
  percussionMinEvents?: number
  renderChecksum?: number
  notes?: string
}

function qaOf(song: Song): Qa {
  return ((song.extra ?? {}).qa ?? {}) as Qa
}

// --- the shared bank --------------------------------------------------------------------

type MacroKindName = 'volume' | 'arpeggio' | 'pitch' | 'hiPitch' | 'duty'
const MACRO_KINDS: readonly MacroKindName[] = ['volume', 'arpeggio', 'pitch', 'hiPitch', 'duty']

interface BankSeq {
  name: string
  values: number[]
  loop: number
  release: number
  mode?: string
}
interface BankInst {
  name: string
  macros: Record<MacroKindName, number>
  dpcm?: Record<string, unknown>
}
interface BankDoc {
  rev: number
  sequences: Record<MacroKindName, BankSeq[]>
  instruments: BankInst[]
  samples: { name: string; data: string }[]
}

/** An instrument reduced to VALUES, so a song's dense renumbering cannot hide a change. */
function resolve(
  macros: Record<MacroKindName, number>,
  banks: Record<MacroKindName, { values: readonly number[]; loop: number; release: number; mode?: string }[]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const kind of MACRO_KINDS) {
    const i = macros[kind]
    if (i < 0) {
      out[kind] = null
      continue
    }
    const s = banks[kind][i]
    out[kind] =
      s === undefined
        ? 'MISSING'
        : { values: [...s.values], loop: s.loop, release: s.release, mode: s.mode ?? 'absolute' }
  }
  return out
}

const BANK_BY_NAME = new Map(BANK.instruments.map((i) => [i.name, i]))

function bankResolved(name: string): Record<string, unknown> | null {
  const inst = BANK_BY_NAME.get(name)
  if (inst === undefined) return null
  return { ...resolve(inst.macros, BANK.sequences), dpcm: inst.dpcm ?? null }
}

function songResolved(song: Song, index: number): Record<string, unknown> {
  const inst = song.instruments[index]
  return {
    ...resolve(inst.macros as Record<MacroKindName, number>, song.sequences as never),
    dpcm: inst.dpcm ?? null,
  }
}

// --- the independent order walk ---------------------------------------------------------

/** Everything Gate C needs to check the driver against the DOCUMENT: how many rows the
 *  order walk reaches, how long that takes, how many note events actually TRIGGER (a note
 *  sharing its row with 3xx/Qxy/Rxy does not retrigger — §3.1 step 2b), and which frames
 *  are reachable at all. Written from the document, never from the driver. */
interface Walk {
  rows: number
  ticks: number
  seconds: number
  noteOns: number
  visited: Set<number>
  /** Rows one full pass (frame 0 through the last frame) costs. */
  passRows: number
}

function walk(song: Song, loops: number): Walk {
  const channels = song.channels
  const rowsPerPattern = song.meta.rowsPerPattern
  const engine = song.meta.engineSpeed
  const rows = new Map<string, Map<number, (typeof song.patterns)[number]['rows'][number]>>()
  for (const p of song.patterns) {
    const m = new Map<number, (typeof p.rows)[number]>()
    for (const c of p.rows) m.set(c.r, c)
    rows.set(`${p.channel}:${p.index}`, m)
  }

  const acc = new RowAccumulator()
  let speed = song.meta.speed
  let tempo = song.meta.tempo
  acc.setRatio(engine, speed, tempo)
  const even = song.meta.evenTempo
  const evenTicks = Math.max(1, Math.round(acc.num / acc.den))

  const porta = new Array<boolean>(channels.length).fill(false)
  const noteSlide = new Array<boolean>(channels.length).fill(false)
  const sounding = new Array<boolean>(channels.length).fill(false)

  const frames = song.order.length
  let oi = 0
  let row = 0
  let played = 0
  let ticks = 0
  let noteOns = 0
  let loopCount = 0
  const visited = new Set<number>()
  const guard = frames * rowsPerPattern * (loops + 2) + 64

  while (played < guard) {
    visited.add(oi)
    let jump = -1
    let skip = -1
    let halt = false
    let pendingSpeed = -1

    for (let ch = 0; ch < channels.length; ch++) {
      const cell = rows.get(`${channels[ch]}:${song.order[oi][ch]}`)?.get(row)
      if (cell === undefined) continue
      for (const e of cell.fx ?? []) {
        if (e === null) continue
        switch (e.cmd) {
          case '1':
          case '2':
            porta[ch] = false
            noteSlide[ch] = false
            break
          case '3':
            porta[ch] = true
            noteSlide[ch] = false
            break
          case 'Q':
          case 'R':
            noteSlide[ch] = true
            porta[ch] = false
            break
          case 'B':
            jump = e.param
            break
          case 'D':
            skip = e.param
            break
          case 'C':
            halt = true
            break
          case 'F':
            pendingSpeed = e.param
            break
          default:
            break
        }
      }
      const note = cell.note
      if (note === undefined) continue
      if (note === -1) {
        sounding[ch] = false
      } else if (note >= 0) {
        if (noteSlide[ch] || (porta[ch] && sounding[ch])) {
          sounding[ch] = true // target only: no trigger, no note-on
        } else {
          noteOns++
          sounding[ch] = true
        }
      }
    }

    // ticks of this row, with Fxx applied at the end of the row's first tick
    let advanced = 0
    let tickInRow = 0
    while (advanced === 0) {
      ticks++
      tickInRow++
      if (pendingSpeed >= 0) {
        const v = pendingSpeed
        pendingSpeed = -1
        if (v > 0) {
          if (v < song.meta.speedSplitPoint) speed = Math.max(1, Math.min(31, v))
          else tempo = Math.max(32, Math.min(255, v))
          acc.setRatio(engine, speed, tempo)
        }
      }
      advanced = even ? (tickInRow >= evenTicks ? 1 : 0) : acc.step()
    }
    played += advanced

    if (halt) break
    if (jump >= 0 || skip >= 0) {
      const next = jump >= 0 ? Math.max(0, Math.min(frames - 1, jump)) : (oi + 1) % frames
      if (next <= oi) loopCount++
      oi = next
      row = skip >= 0 ? Math.max(0, Math.min(rowsPerPattern - 1, skip)) : 0
    } else {
      row++
      if (row >= rowsPerPattern) {
        row = 0
        oi++
        if (oi >= frames) {
          oi = 0
          loopCount++
        }
      }
    }
    if (loopCount >= loops) break
  }

  return {
    rows: played,
    ticks,
    seconds: ticks / engine,
    noteOns,
    visited,
    passRows: frames * rowsPerPattern,
  }
}

// --- gate B, as pure predicates so the bad fixtures can exercise them --------------------

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
}
const ROOTS: Record<string, number> = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
  g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
}

function scaleOf(key: string): Set<number> | null {
  const [root, mode] = key.split('-')
  const r = ROOTS[root]
  const s = SCALES[mode ?? 'major']
  if (r === undefined || s === undefined) return null
  return new Set(s.map((d) => (d + r) % 12))
}

interface Lint {
  ok: boolean
  problems: string[]
  accidentals: number
  melodicNotes: number
}

function lint(song: Song, id: string): Lint {
  const qa = qaOf(song)
  const problems: string[] = []
  const chIndex = new Map(song.channels.map((c, i) => [c, i]))

  // Which cells the order walk actually reaches, per channel, in played-row order.
  const noteEvents = new Map<ChannelId, number[]>()
  const noteRows = new Map<ChannelId, number[]>()
  for (const c of song.channels) {
    noteEvents.set(c, [])
    noteRows.set(c, [])
  }
  const byKey = new Map<string, Map<number, (typeof song.patterns)[number]['rows'][number]>>()
  for (const p of song.patterns) {
    const m = new Map<number, (typeof p.rows)[number]>()
    for (const c of p.rows) m.set(c.r, c)
    byKey.set(`${p.channel}:${p.index}`, m)
  }
  const usedEffects = new Set<string>()
  let absoluteRow = 0
  for (let f = 0; f < song.order.length; f++) {
    for (let r = 0; r < song.meta.rowsPerPattern; r++) {
      for (const c of song.channels) {
        const cell = byKey.get(`${c}:${song.order[f][chIndex.get(c) as number]}`)?.get(r)
        if (cell === undefined) continue
        for (const e of cell.fx ?? []) if (e !== null) usedEffects.add(e.cmd)
        if (cell.note !== undefined && cell.note >= 0) {
          ;(noteEvents.get(c) as number[]).push(cell.note)
          ;(noteRows.get(c) as number[]).push(absoluteRow)
        }
      }
      absoluteRow++
    }
  }

  // key consistency — melodic lanes only: a noise "note" is a period index, not a pitch,
  // and a dpcm "note" is a key-map slot.
  let melodicNotes = 0
  let accidentals = 0
  const scale = qa.key === undefined ? null : scaleOf(qa.key)
  if (scale === null) problems.push(`extra.qa.key ${JSON.stringify(qa.key)} is not a key this lint knows`)
  else {
    for (const c of MELODIC) {
      for (const n of noteEvents.get(c) ?? []) {
        melodicNotes++
        if (!scale.has(n % 12)) accidentals++
      }
    }
    if (melodicNotes > 0 && accidentals / melodicNotes > 0.12) {
      problems.push(
        `${((accidentals / melodicNotes) * 100).toFixed(1)}% of melodic notes are outside ${qa.key} (max 12%)`,
      )
    }
  }

  // tempo
  const bpm = bpmFromTempo(song.meta.speed, song.meta.tempo, song.meta.rowHighlight)
  const range = qa.bpmRange
  if (range === undefined) problems.push('extra.qa.bpmRange is missing')
  else {
    if (range[0] < 60 || range[1] > 220) problems.push(`bpmRange ${range.join('..')} escapes [60, 220]`)
    if (bpm < range[0] || bpm > range[1]) problems.push(`computed BPM ${bpm.toFixed(1)} outside ${range.join('..')}`)
  }

  // percussion
  const gap = qa.percussionGap ?? PERCUSSION_GAP_DEFAULT
  const minEvents = qa.percussionMinEvents ?? PERCUSSION_MIN_EVENTS_DEFAULT
  if (gap > PERCUSSION_GAP_CAP) problems.push(`percussionGap ${gap} exceeds the hard cap ${PERCUSSION_GAP_CAP}`)
  if (minEvents < PERCUSSION_MIN_EVENTS_FLOOR) {
    problems.push(`percussionMinEvents ${minEvents} is under the floor ${PERCUSSION_MIN_EVENTS_FLOOR}`)
  }
  if ((gap !== PERCUSSION_GAP_DEFAULT || minEvents !== PERCUSSION_MIN_EVENTS_DEFAULT) && !qa.notes) {
    problems.push('a raised percussion bound needs a justification in extra.qa.notes')
  }
  if (song.channels.includes('noise')) {
    const hits = noteRows.get('noise') as number[]
    if (hits.length < minEvents) problems.push(`the noise lane has ${hits.length} events, under ${minEvents}`)
    let inLongGap = 0
    let prev = -1
    for (const r of [...hits, absoluteRow]) {
      const len = r - prev - 1
      if (len > gap) inLongGap += len
      prev = r
    }
    const covered = 1 - inLongGap / Math.max(1, absoluteRow)
    if (covered < PERCUSSION_COVERAGE) {
      problems.push(
        `only ${(covered * 100).toFixed(1)}% of rows are inside a percussion gap of <= ${gap} rows (need ${PERCUSSION_COVERAGE * 100}%)`,
      )
    }
  }

  // claimed channels
  const claimed = new Set(qa.channels ?? [])
  for (const c of song.channels) {
    const n = (noteEvents.get(c) as number[]).length
    if (claimed.has(c) && n < 8) problems.push(`${c} is claimed but has only ${n} note events`)
    if (!claimed.has(c) && n > 0) problems.push(`${c} is not claimed but has ${n} note events`)
  }

  // claimed effects, and nothing unsupported
  for (const cmd of qa.effects ?? []) {
    if (!usedEffects.has(cmd)) problems.push(`effect ${cmd} is claimed but never used`)
  }
  for (const cmd of usedEffects) {
    if (!SUPPORTED_EFFECTS.includes(cmd)) problems.push(`effect ${cmd} is not implemented in phase 2`)
  }

  // reachable frames
  const reach = walk(song, 2).visited
  for (let f = 0; f < song.order.length; f++) {
    if (!reach.has(f)) problems.push(`order frame ${f} is never reached`)
  }

  // §7.1 loop-frame check
  if (qa.loopFrame !== undefined) {
    const last = song.order.length - 1
    const lastRow = song.meta.rowsPerPattern - 1
    let found = -1
    for (const c of song.channels) {
      const cell = byKey.get(`${c}:${song.order[last][chIndex.get(c) as number]}`)?.get(lastRow)
      for (const e of cell?.fx ?? []) if (e !== null && e.cmd === 'B') found = e.param
    }
    if (found !== qa.loopFrame) {
      problems.push(`the last frame's last row carries B${found < 0 ? '--' : found}, but loopFrame is ${qa.loopFrame}`)
    }
    if (qa.form !== undefined && qa.form[0] !== qa.form[qa.loopFrame] && qa.loopFrame === 0) {
      problems.push('loopFrame is 0 even though the piece has an intro')
    }
  }
  for (const p of song.patterns) {
    for (const cell of p.rows) {
      for (const e of cell.fx ?? []) {
        if (e !== null && e.cmd === 'C') problems.push(`Cxx halts playback and never belongs in an album piece (${p.channel}:${p.index} row ${cell.r})`)
      }
    }
  }

  // §7.1 bank-drift check
  for (let i = 0; i < song.instruments.length; i++) {
    const name = song.instruments[i].name
    const canonical = bankResolved(name)
    if (canonical === null) {
      if (!new RegExp(`^x-${id}-`).test(name)) {
        problems.push(`instrument "${name}" is not in the shared bank and is not named x-${id}-*`)
      }
      continue
    }
    const mine = songResolved(song, i)
    if (JSON.stringify(mine) !== JSON.stringify(canonical)) {
      problems.push(`instrument "${name}" has drifted from the shared bank`)
    }
  }
  const declared = qa.bank?.instruments ?? []
  for (const name of declared) {
    if (!song.instruments.some((i) => i.name === name)) {
      problems.push(`extra.qa.bank declares "${name}", which this song does not carry`)
    }
  }
  for (const s of song.samples) {
    const canonical = BANK.samples.find((b) => b.name === s.name)
    if (canonical !== undefined && canonical.data !== s.data) {
      problems.push(`sample "${s.name}" differs from the generated bank sample`)
    }
  }

  return { ok: problems.length === 0, problems, accidentals, melodicNotes }
}

// --- helpers ------------------------------------------------------------------------------

function loudestWindow(samples: Float32Array, seconds: number, rate = 48000): number {
  const w = Math.round(rate * seconds)
  if (samples.length < w) return rmsDb(samples)
  let best = -Infinity
  const hop = Math.max(1, Math.round(w / 4))
  for (let a = 0; a + w <= samples.length; a += hop) best = Math.max(best, rmsDb(samples, a, a + w))
  return best
}

function quietestWindow(samples: Float32Array, seconds: number, rate = 48000): number {
  const w = Math.round(rate * seconds)
  const end = samples.length - Math.round(rate * 0.5)
  if (end < w) return rmsDb(samples)
  let worst = Infinity
  const hop = Math.max(1, Math.round(rate * 0.1))
  for (let a = 0; a + w <= end; a += hop) worst = Math.min(worst, rmsDb(samples, a, a + w))
  return worst
}

function errorsOf(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.path}: ${d.message}`)
}

function tryParse(raw: unknown): { song: Song | null; diagnostics: Diagnostic[] } {
  try {
    const r = parseSong(raw)
    return { song: r.song, diagnostics: r.diagnostics }
  } catch (e) {
    const diagnostics = (e as { diagnostics?: Diagnostic[] }).diagnostics ?? []
    return { song: null, diagnostics }
  }
}

// --- the suite ------------------------------------------------------------------------------

const SONGS = registered()

describe('the preset registry', () => {
  it('is a glob of src/assets/songs, so a composer registers a song by adding a file', () => {
    const index = readFileSync(join(SONG_DIR, 'index.ts'), 'utf8')
    expect(index).toContain("import.meta.glob('./*.json', { eager: true })")
  })

  it('names every song with a two-digit play-order prefix or a bare demo id', () => {
    for (const s of SONGS) expect(s.file, s.file).toMatch(/^(\d{2}-)?[a-z0-9-]+\.json$/)
  })
})

describe('the shared instrument bank', () => {
  it('is at rev 1 and holds the 23 named entries of preset-suite §3', () => {
    expect(BANK.rev).toBe(1)
    expect(BANK.instruments).toHaveLength(23)
    expect(BANK.instruments.map((i) => i.name)).toContain('lead-bright')
    expect(BANK.instruments.map((i) => i.name)).toContain('dpcm-kit')
  })

  it('every pitch and hiPitch sequence ends on 0, and every loop segment sums to 0', () => {
    for (const kind of ['pitch', 'hiPitch'] as const) {
      for (const s of BANK.sequences[kind]) {
        if (s.loop < 0) {
          // No loop point: the index stops on the last value and HOLDS it forever, so a
          // non-zero tail walks the note out of tune for as long as it is held.
          expect(s.values[s.values.length - 1], `${s.name} must end on 0 — pitch macros ACCUMULATE`).toBe(0)
        } else {
          // A loop point: the excursion is bounded iff the looped segment sums to zero.
          const segment = s.values.slice(s.loop)
          expect(segment.reduce((a, b) => a + b, 0), `${s.name} loop segment must sum to 0`).toBe(0)
        }
      }
    }
  })

  it('every volume sequence stays inside 0..15 and every duty inside 0..3', () => {
    for (const s of BANK.sequences.volume) for (const v of s.values) expect(v, s.name).toBeGreaterThanOrEqual(0)
    for (const s of BANK.sequences.volume) for (const v of s.values) expect(v, s.name).toBeLessThanOrEqual(15)
    for (const s of BANK.sequences.duty) for (const v of s.values) expect(v, s.name).toBeGreaterThanOrEqual(0)
    for (const s of BANK.sequences.duty) for (const v of s.values) expect(v, s.name).toBeLessThanOrEqual(3)
  })

  it('carries the two generated DPCM samples, byte-identical to makeDpcm.mjs', () => {
    const printed = JSON.parse(
      execFileSync(process.execPath, [join(ROOT, 'tools', 'songs', 'makeDpcm.mjs'), '--json'], {
        encoding: 'utf8',
      }),
    ) as { name: string; data: string; byteLength: number; rateIndex: number; finalLevel: number }[]
    expect(printed.map((s) => [s.name, s.byteLength, s.rateIndex])).toEqual([
      ['dpcm-kick', 257, 12],
      ['dpcm-snare', 145, 15],
    ])
    // The generator asserts this itself; assert it here too, because a sample that ends
    // far from its preload permanently ducks the triangle and the noise (§1).
    for (const s of printed) expect(Math.abs(s.finalLevel - 8), s.name).toBeLessThanOrEqual(4)
    expect(BANK.samples.map((s) => [s.name, s.data])).toEqual(printed.map((s) => [s.name, s.data]))
  })
})

describe.each(SONGS)('$file', ({ id, raw }) => {
  const parsed = tryParse(raw)
  const song = parsed.song as Song

  it('gate A — parses with zero errors and only unreferenced-pattern warnings', () => {
    expect(errorsOf(parsed.diagnostics)).toEqual([])
    const unexpected = parsed.diagnostics.filter(
      (d) => !d.message.includes('never referenced by the order list'),
    )
    expect(unexpected.map((d) => `${d.path}: ${d.message}`)).toEqual([])
  })

  it('gate A — round-trips byte-identically through serializeSong', () => {
    const text = serializeSong(song)
    expect(serializeSong(parseSong(JSON.parse(text)).song)).toBe(text)
  })

  it('gate B — musicality lint', () => {
    const r = lint(song, id)
    expect(r.problems).toEqual([])
    expect(r.melodicNotes).toBeGreaterThan(0)
  })

  it('gate C — renders two passes: duration, level, audibility, checksum', () => {
    const qa = qaOf(song)
    const expected = walk(song, 2)
    const budget = Math.ceil(expected.seconds * 1.15 + 5)
    const r = renderSong(song, { sampleRate: 48000, loops: 2, maxSeconds: budget })

    const rowSeconds = expected.seconds / Math.max(1, expected.rows)
    const rendered = r.samples.length / r.sampleRate
    expect(r.rowsPlayed, 'rows played must match the document walk').toBe(expected.rows)
    expect(Math.abs(rendered - expected.seconds), 'duration within one row of the walk').toBeLessThan(
      rowSeconds + 0.05,
    )

    // §7.1: durationSec describes ONE pass, and a looping song does not replay its intro.
    const passes = expected.rows / expected.passRows
    const onePass = rendered / passes
    const window = qa.durationSec
    expect(window, 'extra.qa.durationSec').toBeDefined()
    expect(onePass, `one pass is ${onePass.toFixed(1)}s`).toBeGreaterThanOrEqual((window as number[])[0])
    expect(onePass, `one pass is ${onePass.toFixed(1)}s`).toBeLessThanOrEqual((window as number[])[1])

    expect(r.noteOns, 'note-ons must match the count the document walk reaches').toBe(expected.noteOns)
    expect(r.clippedSamples, 'a preset that clips is re-voiced, not re-gained').toBeLessThanOrEqual(8)

    const [lo, hi] = qa.rmsRange ?? RMS_RANGE_DEFAULT
    expect(lo, 'a declared rms floor may not go under -30 dBFS').toBeGreaterThanOrEqual(RMS_FLOOR)
    expect(hi).toBeLessThanOrEqual(RMS_RANGE_DEFAULT[1])
    if (qa.rmsRange !== undefined) expect(qa.notes, 'a declared rmsRange needs a justification').toBeTruthy()
    const mix = rmsDb(r.samples)
    expect(mix, `full-mix RMS ${mix.toFixed(2)} dBFS`).toBeGreaterThanOrEqual(lo)
    expect(mix, `full-mix RMS ${mix.toFixed(2)} dBFS`).toBeLessThanOrEqual(hi)

    expect(quietestWindow(r.samples, 1.2), 'something must always sound').toBeGreaterThan(-60)

    for (const c of qa.channels ?? []) {
      const ch = song.channels.indexOf(c)
      const solo = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: budget, soloChannel: ch })
      const best = loudestWindow(solo.samples, 0.5)
      expect(best, `${c} is claimed but its loudest half-second is ${best.toFixed(1)} dBFS`).toBeGreaterThan(-40)
    }

    // The pin. Changing a preset requires updating `extra.qa.renderChecksum` in the same
    // commit — that is the point, not an inconvenience.
    expect(
      qa.renderChecksum,
      `add "renderChecksum": ${r.checksum} to extra.qa (this render's FNV-1a)`,
    ).toBe(r.checksum)
  })

  it('gate D — transposing one pattern breaks the checksum', () => {
    const budget = 40
    const base = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: budget }).checksum
    const target = song.patterns.find((p) => p.channel === 'pulse1' && p.rows.length > 0)
    const mutated: Song = {
      ...song,
      patterns: song.patterns.map((p) =>
        p === target
          ? { ...p, rows: p.rows.map((c) => (c.note !== undefined && c.note >= 0 ? { ...c, note: c.note + 1 } : c)) }
          : p,
      ),
    }
    expect(renderSong(mutated, { sampleRate: 48000, loops: 1, maxSeconds: budget }).checksum).not.toBe(base)
  })
})

// --- gate D: the deliberately broken fixtures ----------------------------------------------

const BAD_PARSE: [string, string][] = [
  ['bad-order-ref.json', 'which does not exist'],
  ['bad-null-inst.json', 'never null'],
  ['bad-hex-param.json', 'outside 0..255'],
  ['bad-sample-length.json', 'is not 16n + 1'],
  ['bad-row-order.json', 'out of order'],
  ['bad-inst-ref.json', 'which does not exist'],
]

const BAD_LINT: [string, string][] = [
  ['bad-loop-frame.json', 'loopFrame is 1'],
  ['bad-bank-drift.json', 'has drifted from the shared bank'],
  ['bad-key.json', 'outside e-minor'],
  ['bad-percussion.json', 'percussion gap'],
]

describe('gate D — a gate that cannot fail is not a gate', () => {
  it.each(BAD_PARSE)('%s fails gate A with "%s"', (file, needle) => {
    const raw: unknown = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'))
    const { song, diagnostics } = tryParse(raw)
    expect(song, `${file} must not load`).toBeNull()
    expect(errorsOf(diagnostics).join('\n')).toContain(needle)
  })

  it.each(BAD_LINT)('%s parses but fails gate B with "%s"', (file, needle) => {
    const raw: unknown = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'))
    const { song } = tryParse(raw)
    expect(song, `${file} must still LOAD — it is a lint failure, not a format failure`).not.toBeNull()
    const r = lint(song as Song, 'rust-and-neon')
    expect(r.ok).toBe(false)
    expect(r.problems.join('\n')).toContain(needle)
  })

  it('the good songs pass the same lint the bad fixtures fail', () => {
    for (const s of SONGS) {
      const { song } = tryParse(s.raw)
      expect(lint(song as Song, s.id).problems, s.file).toEqual([])
    }
  })
})
