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
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

/** Lanes whose note column is a PITCH, so the key lint may read it: the 2A03's three
 *  pitched lanes and all three VRC6 lanes. Noise is a period index and dpcm a key-map
 *  slot, and neither belongs in a scale. */
const MELODIC: readonly ChannelId[] = ['pulse1', 'pulse2', 'triangle', 'vrc6p1', 'vrc6p2', 'vrc6saw']
const PERCUSSION_GAP_DEFAULT = 8
const PERCUSSION_GAP_CAP = 32
const PERCUSSION_MIN_EVENTS_DEFAULT = 16
const PERCUSSION_MIN_EVENTS_FLOOR = 8
/** Fraction of played rows allowed to sit inside an over-long percussion gap (§5.5's
 *  "across >= 80 % of the played rows"). A song may declare `percussionCoverage` down to
 *  the floor with a justification — the same shape as `percussionGap` — for a piece whose
 *  drum-free stretches are the composition (a crash-only intro, a coda of held chords). */
const PERCUSSION_COVERAGE_DEFAULT = 0.8
const PERCUSSION_COVERAGE_FLOOR = 0.75
/** Gate C's clamp budget: eight samples for any preset, and never more than 64 even when
 *  a VRC6 piece declares its own (`extra.qa.clippedSamplesMax`). */
const CLIPPED_SAMPLES_DEFAULT = 8
const CLIPPED_SAMPLES_CAP = 64
const RMS_RANGE_DEFAULT: readonly [number, number] = [-20, -9]
const RMS_FLOOR = -30
// Gate C/D render minutes of audio per song (two loops plus solo passes); a shared
// CI runner is ~10x slower than the dev machine, so vitest's 5 s default kills them
// there. Two minutes is generous headroom, not a hang licence — a wedged render
// still fails, just later.
const GATE_RENDER_TIMEOUT = 120_000

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
  accidentalFractionMax?: number
  channels?: ChannelId[]
  effects?: string[]
  bpmRange?: [number, number]
  durationSec?: [number, number]
  rmsRange?: [number, number]
  /** Clamped samples the two-pass render may contain at the reference gain, when the
   *  default 8 is not enough. Declared, capped, and only honoured when the default
   *  would actually fail — see gate C. */
  clippedSamplesMax?: number
  loopFrame?: number
  form?: string[]
  bank?: { instruments?: string[]; rev?: number }
  percussionGap?: number
  percussionMinEvents?: number
  percussionCoverage?: number
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
  const sounding = new Array<boolean>(channels.length).fill(false)

  const frames = song.order.length
  let oi = 0
  let row = 0
  let played = 0
  let ticks = 0
  let noteOns = 0
  let loopCount = 0
  let passRows = 0
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
      // Qxy/Rxy are ONE-SHOT: they retarget the note on their own row and the driver
      // clears the slide on arrival, so the next plain note triggers again. (The old
      // latched flag undercounted every note after a bass scoop.)
      let noteSlide = false
      for (const e of cell.fx ?? []) {
        if (e === null) continue
        switch (e.cmd) {
          case '1':
          case '2':
            porta[ch] = false
            break
          case '3':
            porta[ch] = true
            break
          case 'Q':
          case 'R':
            noteSlide = true
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
        if ((noteSlide || porta[ch]) && sounding[ch]) {
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
    if (loopCount > 0 && passRows === 0) passRows = played
    if (loopCount >= loops) break
  }

  return {
    rows: played,
    ticks,
    seconds: ticks / engine,
    noteOns,
    visited,
    // Dxx can shorten a frame; nominal order capacity is not played duration.
    passRows: passRows || played,
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
    const accidentalMax = qa.accidentalFractionMax ?? 0.12
    if (!Number.isFinite(accidentalMax) || accidentalMax < 0 || accidentalMax > 0.2) {
      problems.push('accidentalFractionMax must be in 0..0.2')
    }
    if (qa.accidentalFractionMax !== undefined && !qa.notes) {
      problems.push('a chromatic allowance requires composition notes')
    }
    if (melodicNotes > 0 && accidentals / melodicNotes > accidentalMax) {
      problems.push(
        `${((accidentals / melodicNotes) * 100).toFixed(1)}% of melodic notes are outside ${qa.key} (max ${accidentalMax * 100}%)`,
      )
    }
  }

  // tempo
  const bpm = bpmFromTempo(song.meta.speed, song.meta.tempo, song.meta.rowHighlight)
  const range = qa.bpmRange
  if (range === undefined) problems.push('extra.qa.bpmRange is missing')
  else {
    // Ambient’s 48 BPM editing grid is deliberate, not an invalid pop tempo.
    if (range[0] < 30 || range[1] > 220) problems.push(`bpmRange ${range.join('..')} escapes [30, 220]`)
    if (bpm < range[0] || bpm > range[1]) problems.push(`computed BPM ${bpm.toFixed(1)} outside ${range.join('..')}`)
  }

  // percussion
  const gap = qa.percussionGap ?? PERCUSSION_GAP_DEFAULT
  const minEvents = qa.percussionMinEvents ?? PERCUSSION_MIN_EVENTS_DEFAULT
  if (gap > PERCUSSION_GAP_CAP) problems.push(`percussionGap ${gap} exceeds the hard cap ${PERCUSSION_GAP_CAP}`)
  if (minEvents < PERCUSSION_MIN_EVENTS_FLOOR) {
    problems.push(`percussionMinEvents ${minEvents} is under the floor ${PERCUSSION_MIN_EVENTS_FLOOR}`)
  }
  const coverage = qa.percussionCoverage ?? PERCUSSION_COVERAGE_DEFAULT
  if (coverage < PERCUSSION_COVERAGE_FLOOR || coverage > PERCUSSION_COVERAGE_DEFAULT) {
    problems.push(`percussionCoverage ${coverage} escapes ${PERCUSSION_COVERAGE_FLOOR}..${PERCUSSION_COVERAGE_DEFAULT}`)
  }
  if (
    (gap !== PERCUSSION_GAP_DEFAULT || minEvents !== PERCUSSION_MIN_EVENTS_DEFAULT || coverage !== PERCUSSION_COVERAGE_DEFAULT) &&
    !qa.notes
  ) {
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
    if (covered < coverage) {
      problems.push(
        `only ${(covered * 100).toFixed(1)}% of rows are inside a percussion gap of <= ${gap} rows (need ${coverage * 100}%)`,
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

// --- gate B2, the channel-mode effects a note trigger does NOT clear (§12) ---------------

/** `trigger()` resets the PHASES — `arpStep`, `slideAccum`, `pitchAccum`, `portaTarget`,
 *  `portaNote`, `vibAcc`, `tremAcc` — and NOTHING else. Every field `applyRowEffect`
 *  writes below therefore outlives the note that was sounding when it was set, outlives
 *  the pattern, and outlives the order frame; only `resetChannels()` — a stop, never a
 *  loop — puts it back. `neutral` is the value `resetChannels()` installs, so "latched"
 *  is exactly "differs from what a fresh playback start would have".
 *
 *  `cancel` is what the DRIVER accepts, which is not always what the manual implies:
 *   - `300` does NOT cancel `3xx`. It freezes the glide with `portaEnabled` still 1,
 *     and a latched `portaEnabled` makes the next note a glide target instead of an
 *     attack (`fire()`), so the lane loses its transient without changing a note.
 *   - `700` does NOT cancel `7xy`. `7` is a memory command and is NOT in
 *     `OFF_ON_ZERO_COMMANDS`, so `700` REPLAYS the last tremolo parameter. The depth
 *     nibble is the off switch: `7x0` with x > 0.
 *   - `Vxx` has no off value at all: `V00` is duty 0, a real duty. It must be restated.
 *   - `Sxx` also survives the row (`cutTick`), but it is consumed by the tick it names,
 *     so it only latches when xx >= the row's tick count — a cut that never fires, which
 *     is a different defect and not this gate's business.
 */
interface StickyDef {
  readonly cmd: string
  readonly what: string
  readonly neutral: number
  readonly cancel: string
}
const STICKY = {
  arp: { cmd: '0xy', what: 'arpeggio', neutral: 0, cancel: '000, or any of 1xx/2xx/3xx/Qxy/Rxy' },
  slide: { cmd: '1xx/2xx', what: 'pitch slide', neutral: 0, cancel: '100/200, or 3xx/Qxy/Rxy' },
  porta: { cmd: '3xx', what: 'portamento', neutral: 0, cancel: '1xx/2xx/Qxy/Rxy (300 freezes, it does not cancel)' },
  vibrato: { cmd: '4xy', what: 'vibrato', neutral: 0, cancel: '4x0 — the depth nibble is the off switch' },
  tremolo: { cmd: '7xy', what: 'tremolo', neutral: 0, cancel: '7x0 with x > 0 (700 replays the effect memory)' },
  volSlide: { cmd: 'Axy', what: 'volume slide', neutral: 0, cancel: 'A00' },
  finePitch: { cmd: 'Pxx', what: 'fine pitch', neutral: 0x80, cancel: 'P80' },
  duty: { cmd: 'Vxx', what: 'duty override', neutral: -1, cancel: 'nothing — restate Vxx in every section that wants it' },
} satisfies Record<string, StickyDef>
type StickyField = keyof typeof STICKY
const STICKY_FIELDS = Object.keys(STICKY) as StickyField[]

/** `resolveParam`'s two tables, copied so the walk reads a row the way the driver does. */
const MEMORY_CMDS = '12347AQR'
const OFF_ON_ZERO_CMDS = '1234A'

type StickyState = Record<StickyField, number>

function neutralSticky(): StickyState {
  const s = {} as StickyState
  for (const f of STICKY_FIELDS) s[f] = STICKY[f].neutral
  return s
}

/** How a latched value reads in a problem message, in the composer's own notation. */
function stickyValue(field: StickyField, v: number): string {
  const hex = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0')
  switch (field) {
    case 'arp': return `0${hex(v)}`
    case 'slide': return v < 0 ? `1${hex(-v)}` : `2${hex(v)}`
    case 'porta': return 'on'
    case 'vibrato': return `depth ${v}`
    case 'tremolo': return `depth ${v}`
    case 'volSlide': return `A${hex(v)}`
    case 'finePitch': return `P${hex(v)}`
    case 'duty': return `V${hex(v)}`
  }
}

interface Where {
  frame: number
  row: number
  played: number
}
interface Lane {
  state: StickyState
  setAt: Map<StickyField, Where>
  memory: Map<string, number>
  counts: Map<StickyField, { set: number; cancel: number }>
  sounding: boolean
}
interface StickyResult {
  ok: boolean
  problems: string[]
  /** One `kind:lane:field` id per entry of `problems`, same order: the stable handle a
   *  known-defect pin can name without pinning a sentence. */
  findings: string[]
  /** Per lane, "pulse2: 0xy set 6, cleared 10" — set against cancel at a glance. */
  summary: string[]
  /** Arrivals at the loop row: the first one and the one the Bxx jump makes. */
  arrivals: number
}

/** How far a sticky effect may carry before a note that sounds under it counts as having
 *  inherited somebody else's writing: ONE ORDER FRAME of played rows. The frame is the
 *  unit the composer divides the piece into — every shipped piece's `extra.qa.form`
 *  carries exactly one name per order frame — so an effect still inside the frame that
 *  wrote it is a sustained gesture, a legitimate way to write a phrase, and one still on
 *  a whole frame later has outlived its section. Measured against the album: skyline-run
 *  carries `0xy` at most 30 rows on pulse2, half of its 64-row frame and one phrase,
 *  while tide-tables carries `4xy` 320 rows — from "flood" through "building", "high
 *  water", "running out" and "releasing", four named sections later. */
const INHERIT_TOLERANCE_FRAMES = 1

/** Walks the order the way the driver does — normal advance plus `Bxx`/`Dxx`, the same
 *  flow `reachableFrames` follows — carrying every sticky channel mode per lane, and
 *  reports what is still latched where it must not be. Written from the DOCUMENT: the
 *  driver is not run, so a driver bug cannot make this gate pass. */
function stickyLint(song: Song): StickyResult {
  const qa = qaOf(song)
  const problems: string[] = []
  const findings: string[] = []
  const report = (id: string, message: string): void => {
    findings.push(id)
    problems.push(message)
  }
  const chs = song.channels
  const rpp = song.meta.rowsPerPattern
  const frames = song.order.length
  const tolerance = rpp * INHERIT_TOLERANCE_FRAMES
  const byKey = new Map<string, Map<number, (typeof song.patterns)[number]['rows'][number]>>()
  for (const p of song.patterns) {
    const m = new Map<number, (typeof p.rows)[number]>()
    for (const c of p.rows) m.set(c.r, c)
    byKey.set(`${p.channel}:${p.index}`, m)
  }
  const lanes: Lane[] = chs.map(() => ({
    state: neutralSticky(),
    setAt: new Map<StickyField, Where>(),
    memory: new Map<string, number>(),
    counts: new Map<StickyField, { set: number; cancel: number }>(),
    sounding: false,
  }))
  const inherited = new Map<string, { ch: number; field: StickyField; n: number; age: number; where: Where }>()
  const arrivals: { state: StickyState[]; stated: Set<string> }[] = []
  const loopFrame = qa.loopFrame

  let oi = 0
  let row = 0
  let played = 0
  let laps = 0
  // Intro plus one full pass is every reachable row once; the guard only has to outlast
  // a piece whose Bxx never comes back.
  const guard = frames * rpp * 3 + 64

  while (played < guard) {
    let jump = -1
    let skip = -1
    let halt = false
    const stated = new Set<string>()

    for (let ch = 0; ch < chs.length; ch++) {
      const cell = byKey.get(`${chs[ch]}:${song.order[oi][ch]}`)?.get(row)
      if (cell === undefined) continue
      const lane = lanes[ch]
      const here: Where = { frame: oi, row, played }
      const mark = (f: StickyField, v: number): void => {
        const tally = lane.counts.get(f) ?? { set: 0, cancel: 0 }
        if (v === STICKY[f].neutral) {
          tally.cancel++
          lane.setAt.delete(f)
        } else {
          tally.set++
          lane.setAt.set(f, here)
        }
        lane.counts.set(f, tally)
        lane.state[f] = v
        stated.add(`${ch}:${f}`)
      }
      let noteSlide = false
      for (const e of cell.fx ?? []) {
        if (e === null || e === undefined) continue
        // §3.5 effect memory, resolved before the switch exactly as the driver does it.
        let param = e.param
        if (MEMORY_CMDS.includes(e.cmd)) {
          if (param !== 0) lane.memory.set(e.cmd, param)
          else if (!OFF_ON_ZERO_CMDS.includes(e.cmd)) param = lane.memory.get(e.cmd) ?? 0
        }
        switch (e.cmd) {
          case '0': mark('arp', param); break
          case '1': mark('arp', 0); mark('porta', 0); mark('slide', -param); break
          case '2': mark('arp', 0); mark('porta', 0); mark('slide', param); break
          case '3': mark('arp', 0); mark('slide', 0); mark('porta', 1); break
          case '4': mark('vibrato', param & 0x0f); break
          case '7': mark('tremolo', param & 0x0f); break
          case 'A': mark('volSlide', param); break
          case 'P': mark('finePitch', param); break
          case 'V': mark('duty', param); break
          case 'Q':
          case 'R':
            noteSlide = true
            mark('arp', 0)
            mark('porta', 0)
            mark('slide', 0)
            break
          case 'B': jump = e.param; break
          case 'D': skip = e.param; break
          case 'C': halt = true; break
          default: break
        }
      }
      const note = cell.note
      if (note === undefined) continue
      if (note === -1) {
        // A cut silences the lane but leaves every mode above standing (`cut()`).
        lane.sounding = false
        continue
      }
      if (note < 0) continue
      // A note sharing its row with 3xx/Qxy/Rxy retargets a sounding note instead of
      // triggering it — the same rule the duration walk above models, and gate C's
      // note-event count is what holds it honest.
      const triggers = !((noteSlide || lane.state.porta === 1) && lane.sounding)
      lane.sounding = true
      if (!triggers) continue
      for (const f of STICKY_FIELDS) {
        if (lane.state[f] === STICKY[f].neutral || stated.has(`${ch}:${f}`)) continue
        const where = lane.setAt.get(f)
        if (where === undefined) continue
        const age = played - where.played
        if (age <= tolerance) continue
        const key = `${ch}:${f}`
        const rec = inherited.get(key) ?? { ch, field: f, n: 0, age: 0, where }
        rec.n++
        if (age >= rec.age) {
          rec.age = age
          rec.where = where
        }
        inherited.set(key, rec)
      }
    }

    if (loopFrame !== undefined && oi === loopFrame && row === 0) {
      // AFTER the loop row's own effects: a mode cancelled or restated on the loop row
      // itself is stated by the seam, not carried across it.
      arrivals.push({ state: lanes.map((l) => ({ ...l.state })), stated: new Set(stated) })
      if (arrivals.length >= 2) break
    }

    played++
    if (halt) break
    if (jump >= 0 || skip >= 0) {
      const next = jump >= 0 ? Math.max(0, Math.min(frames - 1, jump)) : (oi + 1) % frames
      if (next <= oi) laps++
      oi = next
      row = skip >= 0 ? Math.max(0, Math.min(rpp - 1, skip)) : 0
    } else {
      row++
      if (row >= rpp) {
        row = 0
        oi++
        if (oi >= frames) {
          oi = 0
          laps++
        }
      }
    }
    if (loopFrame === undefined && laps >= 1) break
  }

  // 1. the seam. Pass 2 begins at the loop row, and it has to begin the way pass 1 did.
  const first = arrivals[0]
  const seam = arrivals[arrivals.length - 1]
  if (loopFrame === undefined) {
    report('seam:-:loopFrame', 'extra.qa.loopFrame is missing, so the loop seam cannot be walked')
  } else if (arrivals.length < 2 || first === undefined || seam === undefined) {
    report('seam:-:unreached', `the order walk never comes back to the loop row (frame ${loopFrame} row 0)`)
  } else {
    for (let ch = 0; ch < chs.length; ch++) {
      for (const f of STICKY_FIELDS) {
        const def = STICKY[f]
        const now = seam.state[ch][f]
        const before = first.state[ch][f]
        const at = lanes[ch].setAt.get(f)
        const from = at === undefined ? 'an earlier frame' : `frame ${at.frame} row ${at.row}`
        if (now !== def.neutral && !seam.stated.has(`${ch}:${f}`)) {
          // A mode the FIRST arrival carried too is not a pass-2-only surprise, but the
          // loop row still does not own its own state: a reader of that row cannot tell
          // what the lane is doing, and one edit to the intro changes the loop.
          const cost =
            now === before
              ? 'every pass enters the loop under it and nothing on the loop row says so'
              : 'pass 2 sounds that lane under an effect pass 1 did not have'
          report(
            `seam:${chs[ch]}:${f}`,
            `${chs[ch]} reaches the loop row (frame ${loopFrame} row 0) with ${def.cmd} ${def.what} still latched (${stickyValue(f, now)}, last stated at ${from}): ${cost}. Restate it on the loop row, or cancel it before the Bxx — cancel: ${def.cancel}.`,
          )
        } else if (now !== before) {
          report(
            `drift:${chs[ch]}:${f}`,
            `${chs[ch]} enters the loop row with ${def.cmd} ${def.what} = ${stickyValue(f, now)} on the looping pass but ${stickyValue(f, before)} on the first: the two passes do not start alike.`,
          )
        }
      }
    }
  }

  // 2. notes that sound under a mode written for an earlier section.
  for (const rec of [...inherited.values()].sort((a, b) => b.age - a.age)) {
    const def = STICKY[rec.field]
    report(
      `inherited:${chs[rec.ch]}:${rec.field}`,
      `${chs[rec.ch]} triggers ${rec.n} note${rec.n === 1 ? '' : 's'} under ${def.cmd} ${def.what} it never asked for, inherited from frame ${rec.where.frame} row ${rec.where.row} and still latched ${rec.age} rows (${(rec.age / rpp).toFixed(1)} frames) later, past the ${tolerance}-row tolerance. Restate it, or cancel it where the section changes — cancel: ${def.cancel}.`,
    )
  }

  // 3. set versus cancel, per lane, for the composer rather than for the assertion.
  const summary: string[] = []
  for (let ch = 0; ch < chs.length; ch++) {
    // Only modes this lane actually ASKS for: `1xx` writes `arpParam` to 0 as a side
    // effect, and reporting that as "0xy cancelled 7 times" on a lane with no arpeggio
    // at all would be a count of something nobody typed.
    const parts = STICKY_FIELDS.flatMap((f) => {
      const t = lanes[ch].counts.get(f)
      return t === undefined || t.set === 0 ? [] : [`${STICKY[f].cmd} set ${t.set}, cleared ${t.cancel}`]
    })
    if (parts.length > 0) summary.push(`${chs[ch]}: ${parts.join(', ')}`)
  }

  return { ok: problems.length === 0, problems, findings, summary, arrivals: arrivals.length }
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

/** True when every instrument the order walk plays on this lane has a FIXED-mode
 *  arpeggio: the macro supplies the pitch, so the cell's own note never reaches the
 *  chip. A lane of struck chords is written that way. */
function fixedArpeggioOnly(song: Song, channel: ChannelId): boolean {
  const indices = new Set(song.order.map((frame) => frame[song.channels.indexOf(channel)]))
  const instruments = new Set<number>()
  let notes = 0
  for (const p of song.patterns) {
    if (p.channel !== channel || !indices.has(p.index)) continue
    for (const c of p.rows) {
      if (c.note !== undefined && c.note >= 0) notes++
      if (c.inst !== undefined) instruments.add(c.inst)
    }
  }
  if (notes === 0 || instruments.size === 0) return false
  for (const i of instruments) {
    const seq = song.instruments[i].macros.arpeggio
    if (seq < 0 || song.sequences.arpeggio[seq].mode !== 'fixed') return false
  }
  return true
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

describe('order-walk duration regression', () => {
  it('counts skipped rows and a one-time intro independently of the changing catalog', () => {
    const { song: base } = parseSong(JSON.parse(readFileSync(join(FIXTURES, 'tiny.json'), 'utf8')))
    const song: Song = {
      ...base,
      order: [[0, 0, 0, 0, 0], [1, 0, 0, 0, 0], [2, 0, 0, 0, 0]],
      patterns: [
        ...base.patterns.filter((p) => p.channel !== 'pulse1'),
        { channel: 'pulse1', index: 0, rows: [{ r: 0, note: 60, inst: 0, vol: 15 }, { r: 3, fx: [{ cmd: 'D', param: 0 }] }] },
        { channel: 'pulse1', index: 1, rows: [{ r: 0, note: 62, inst: 0, vol: 15 }] },
        { channel: 'pulse1', index: 2, rows: [{ r: 0, note: 64, inst: 0, vol: 15 }, { r: 7, fx: [{ cmd: 'B', param: 1 }] }] },
      ],
    }
    const first = walk(song, 1)
    const two = walk(song, 2)
    expect(first.rows).toBe(20) // 4-row intro + two 8-row frames
    expect(first.passRows).toBe(20)
    expect(first.seconds).toBeCloseTo(2, 6)
    expect(two.passRows).toBe(20)
    expect(two.rows).toBe(36) // intro occurs only once
    expect(renderSong(song, { loops: 2, maxSeconds: 5 }).rowsPlayed).toBe(36)
  })
})

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
  it('is at rev 2: §3’s 23 named entries plus §10.3’s 6 tropic ones, appended', () => {
    expect(BANK.rev).toBe(2)
    expect(BANK.instruments).toHaveLength(29)
    expect(BANK.instruments.map((i) => i.name)).toContain('lead-bright')
    expect(BANK.instruments.map((i) => i.name)).toContain('dpcm-kit')
    // §10.3 appends; it never rewrites. The first 23 are still §3's, in §3's order,
    // which is what keeps the drift check over songs 01-12 meaningful.
    expect(BANK.instruments.slice(23).map((i) => i.name)).toEqual([
      'steel-lead',
      'steel-comp',
      'steel-roll',
      'skank',
      'bubble',
      'rim',
    ])
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

  it('generates the same samples from a path with a space in it', () => {
    // `import.meta.url === \`file://${process.argv[1]}\`` is a string comparison against
    // something that is not a URL: any path component needing percent-encoding — a
    // space is the everyday one, "My Project", "Google Drive" — makes the check false,
    // and the script then silently prints nothing at all. The pin test above would
    // still pass, because THIS repository's path happens to have no spaces.
    const dir = join(mkdtempSync(join(tmpdir(), 'pulsar-')), 'a dir with spaces')
    mkdirSync(dir, { recursive: true })
    const copied = join(dir, 'makeDpcm.mjs')
    copyFileSync(join(ROOT, 'tools', 'songs', 'makeDpcm.mjs'), copied)
    try {
      const out = execFileSync(process.execPath, [copied, '--json'], { encoding: 'utf8' })
      expect(out.trim(), 'the script printed nothing — it did not recognise itself').not.toBe('')
      const printed = JSON.parse(out) as { name: string; data: string }[]
      expect(printed.map((s) => s.name)).toEqual(['dpcm-kick', 'dpcm-snare'])
      expect(printed.map((s) => s.data)).toEqual(BANK.samples.map((s) => s.data))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

/** RESOLVED 2026-09-11 — NOT a port defect. tide-tables really does carry four channel
 *  modes across its own loop, and the escalation these entries opened asked the right
 *  question: is that Pulsar's driver diverging from the engine the piece was composed on?
 *  It is not. OCTET's `core/engine.js` latches `4xy` and `7xy` exactly as `trackerDriver`
 *  does — `applyCell` writes `vibDepth`/`tremDepth` and only a zero depth nibble clears
 *  them, `triggerNote` resets the PHASES and not the modes, and `nextOrder()` wraps the
 *  order with no channel reset, so the modes cross the loop there too. Running OCTET's own
 *  engine over its own document for two passes reproduces the finding: of 189 note events
 *  a pass, the one that differs audibly is `vrc6saw` frame 2 row 0 under `7xy` depth 2 —
 *  the same note, the same effect, the same pass. `convert.mjs` carries every `3xx`, `4xy`
 *  and `7xy` cell over one for one (34/3/2/20/4 per lane, both sides), so there is nothing
 *  for `applyEngineDifferences` to correct: the song already plays what was composed.
 *
 *  The entries therefore stay as a PIN on the music, not a waiver of a bug: the gate still
 *  reports all six in full, the list cannot grow without this assertion failing, and a
 *  later edit that cancels one fails it too (delete the entry in the same commit).
 *  Evidence and the frame:row table are in `docs/preset-suite.md` §12 and
 *  `docs/soundtrack.md`. Changing the song here would be re-composition. */
const KNOWN_STICKY: Record<string, string[]> = {
  'tide-tables': [
    'seam:vrc6p1:vibrato',
    'seam:vrc6p2:vibrato',
    'seam:vrc6saw:porta',
    'seam:vrc6saw:tremolo',
    'inherited:vrc6p1:vibrato',
    'inherited:vrc6p2:vibrato',
  ],
}

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

  it('gate B2 — no channel mode is left latched across the loop seam', () => {
    const r = stickyLint(song)
    expect(r.arrivals, 'the order walk must reach the loop row twice').toBe(2)
    expect(r.findings, r.problems.join('\n')).toEqual(KNOWN_STICKY[id] ?? [])
    expect(r.summary.length, 'an album piece uses at least one channel mode').toBeGreaterThan(0)
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
    // A 2A03 preset that clips is re-voiced, not re-gained. A VRC6 piece is different in
    // kind: the expansion's linear DAC adds up to 0.625 on top of the 2A03's full-scale
    // mix, so an eight-voice song played AS COMPOSED can pass full scale at the render
    // gain, which is the app's knob at maximum. Such a song declares the clamp count it
    // needs — capped, justified in `notes`, and accepted only when the default really
    // would fail, so the allowance cannot creep onto a song that does not need it.
    const clipAllowance = qa.clippedSamplesMax ?? CLIPPED_SAMPLES_DEFAULT
    if (qa.clippedSamplesMax !== undefined) {
      expect(qa.clippedSamplesMax, 'a declared clip allowance is capped').toBeLessThanOrEqual(CLIPPED_SAMPLES_CAP)
      expect(qa.notes, 'a declared clip allowance needs a justification').toBeTruthy()
      expect(r.clippedSamples, 'a clip allowance is declared only where the default would fail').toBeGreaterThan(CLIPPED_SAMPLES_DEFAULT)
    }
    expect(r.clippedSamples, 'a preset that clips beyond its allowance is re-voiced, not re-gained').toBeLessThanOrEqual(clipAllowance)

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
  }, GATE_RENDER_TIMEOUT)

  it('gate D — transposing a pitched lane breaks the checksum, lane by lane', () => {
    // One whole pass: a piece may keep a lane silent for its first minute.
    const budget = Math.ceil(walk(song, 1).seconds) + 2
    const base = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: budget }).checksum
    // Every note of the lane, not one pattern: the first pattern may be a lone loop-entry
    // cut. The exception is a lane whose every instrument carries a FIXED-mode arpeggio —
    // the macro supplies the pitch and the row note is ignored by design (a struck bell
    // chord is written that way), so there the render must NOT move, which pins the
    // fixed-mode semantics instead of quietly excusing the lane.
    let moved = 0
    for (const channel of (qaOf(song).channels ?? []).filter((c) => MELODIC.includes(c))) {
      const mutated: Song = {
        ...song,
        patterns: song.patterns.map((p) =>
          p.channel === channel
            ? { ...p, rows: p.rows.map((c) => (c.note !== undefined && c.note >= 0 ? { ...c, note: c.note + 1 } : c)) }
            : p,
        ),
      }
      const after = renderSong(mutated, { sampleRate: 48000, loops: 1, maxSeconds: budget }).checksum
      if (fixedArpeggioOnly(song, channel)) expect(after, `${channel} (fixed-mode arpeggios)`).toBe(base)
      else {
        expect(after, channel).not.toBe(base)
        moved++
      }
    }
    expect(moved, 'no lane in this song answers a transposition').toBeGreaterThan(0)
  }, GATE_RENDER_TIMEOUT)
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
  it('chromatic allowances remain bounded, documented and reject wholly wrong keys', () => {
    const source = SONGS.find((s) => s.id === 'skyline-run')!
    const song = tryParse(source.raw).song as Song
    const withQa = (qa: Qa): Song => ({ ...song, extra: { ...song.extra, qa } })
    expect(lint(withQa({ ...qaOf(song), accidentalFractionMax: 1 }), source.id).problems)
      .toContain('accidentalFractionMax must be in 0..0.2')
    expect(lint(withQa({ ...qaOf(song), notes: '' }), source.id).problems)
      .toContain('a chromatic allowance requires composition notes')
    const wrong: Song = {
      ...song, patterns: song.patterns.map((p) => MELODIC.includes(p.channel) ? {
        ...p, rows: p.rows.map((c) => c.note !== undefined && c.note >= 0 ? { ...c, note: 66 } : c),
      } : p),
    }
    expect(lint(wrong, source.id).problems.join('\n')).toContain('outside a-minor')
  })

  it('the key lint reads the VRC6 lanes, one at a time and together', () => {
    const source = SONGS.find((s) => s.id === 'cathedral-of-gears')!
    const song = tryParse(source.raw).song as Song
    const base = lint(song, source.id)
    expect(base.problems).toEqual([])
    const offKey = (lanes: readonly string[]): Song => ({
      ...song,
      patterns: song.patterns.map((p) => lanes.includes(p.channel) ? {
        ...p, rows: p.rows.map((c) => c.note !== undefined && c.note >= 0 ? { ...c, note: 66 } : c),
      } : p),
    })
    // F#4 is outside D minor. Each VRC6 lane on its own must raise the accidental count —
    // that is what proves the lane is inside MELODIC at all — over the same note total.
    for (const lane of ['vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      const r = lint(offKey([lane]), source.id)
      expect(r.melodicNotes, lane).toBe(base.melodicNotes)
      expect(r.accidentals, lane).toBeGreaterThan(base.accidentals)
    }
    expect(lint(offKey(['vrc6p1', 'vrc6p2', 'vrc6saw']), source.id).problems.join('\n'))
      .toContain('outside d-minor')
  })

  it('every lane that sounds must be claimed; a silent dpcm lane need not be', () => {
    const source = SONGS.find((s) => s.id === 'cathedral-of-gears')!
    const song = tryParse(source.raw).song as Song
    const qa = qaOf(song)
    // `channels` is a PREFIX of the canonical eight, so the VRC6 song carries a dpcm lane
    // it never plays — declared on the document, absent from the claim, and silent.
    expect(song.channels).toContain('dpcm')
    expect(qa.channels).not.toContain('dpcm')
    expect(lint(song, source.id).problems).toEqual([])
    const withQa = (next: Qa): Song => ({ ...song, extra: { ...song.extra, qa: next } })
    for (const lane of ['vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      const dropped = withQa({ ...qa, channels: (qa.channels ?? []).filter((c) => c !== lane) })
      expect(lint(dropped, source.id).problems.join('\n')).toContain(`${lane} is not claimed`)
    }
    // ...and claiming the empty lane is just as wrong as leaving a sounding one out.
    expect(lint(withQa({ ...qa, channels: [...(qa.channels ?? []), 'dpcm'] }), source.id).problems.join('\n'))
      .toContain('dpcm is claimed but has only 0 note events')
  })

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

describe('gate B2 — the sticky-effect gate must be able to fail', () => {
  const fixture = (): Song =>
    tryParse(JSON.parse(readFileSync(join(FIXTURES, 'bad-sticky-seam.json'), 'utf8'))).song as Song

  /** Write one cell's effect list, keeping whatever note the cell already had — the edit
   *  a composer makes when they add the cancel the gate asked for. */
  const withFx = (
    song: Song,
    channel: ChannelId,
    index: number,
    r: number,
    fx: { cmd: string; param: number }[],
  ): Song => ({
    ...song,
    patterns: song.patterns.map((p) =>
      p.channel !== channel || p.index !== index
        ? p
        : { ...p, rows: [...p.rows.filter((c) => c.r !== r), { ...(p.rows.find((c) => c.r === r) ?? { r }), fx }].sort((a, b) => a.r - b.r) },
    ),
  })
  const withQa = (song: Song, qa: Qa): Song => ({ ...song, extra: { ...song.extra, qa } })

  it('bad-sticky-seam.json parses, and every branch of the gate fires on it', () => {
    const r = stickyLint(fixture())
    expect(r.ok).toBe(false)
    expect(r.findings).toEqual([
      'seam:pulse1:arp',
      'seam:pulse2:porta',
      'seam:triangle:tremolo',
      'inherited:pulse1:arp',
      'inherited:triangle:tremolo',
    ])
    expect(r.problems.join('\n')).toContain('loop row (frame 1 row 0)')
  })

  it('a note trigger does not clear 0xy — only 000 does', () => {
    // pulse1 triggers four notes between the 047 and the Bxx and stays latched, because
    // `trigger()` resets `arpStep` and never `arpParam`.
    expect(stickyLint(fixture()).findings).toContain('seam:pulse1:arp')
    const cancelled = stickyLint(withFx(fixture(), 'pulse1', 3, 0, [{ cmd: '0', param: 0 }]))
    expect(cancelled.findings).not.toContain('seam:pulse1:arp')
    // ...and the notes that already sounded under it two frames on are still reported.
    expect(cancelled.findings).toContain('inherited:pulse1:arp')
  })

  it('300 freezes 3xx and does not cancel it; 100 cancels it', () => {
    expect(stickyLint(withFx(fixture(), 'pulse2', 3, 0, [{ cmd: '3', param: 0 }])).findings)
      .toContain('seam:pulse2:porta')
    expect(stickyLint(withFx(fixture(), 'pulse2', 3, 0, [{ cmd: '1', param: 0 }])).findings)
      .not.toContain('seam:pulse2:porta')
  })

  it('700 replays the tremolo memory; 7x0 is the off switch', () => {
    expect(stickyLint(withFx(fixture(), 'triangle', 3, 0, [{ cmd: '7', param: 0 }])).findings)
      .toContain('seam:triangle:tremolo')
    expect(stickyLint(withFx(fixture(), 'triangle', 3, 0, [{ cmd: '7', param: 0xa0 }])).findings)
      .not.toContain('seam:triangle:tremolo')
  })

  it('Vxx has no off value, so V00 does not clear the duty override', () => {
    const set = withFx(fixture(), 'pulse1', 0, 12, [{ cmd: 'V', param: 2 }])
    expect(stickyLint(set).findings).toContain('seam:pulse1:duty')
    expect(stickyLint(withFx(set, 'pulse1', 3, 8, [{ cmd: 'V', param: 0 }])).findings)
      .toContain('seam:pulse1:duty')
  })

  it('every mode in the table can be caught, one command at a time', () => {
    // One cell in the intro, nothing to cancel it: each of the eight fields has to make
    // it to the loop row on its own. `1xx` and `2xx` share a field and both are checked,
    // since the driver stores a signed rate rather than a direction flag.
    const cases: [string, number, string][] = [
      ['0', 0x47, 'arp'],
      ['1', 0x04, 'slide'],
      ['2', 0x04, 'slide'],
      ['3', 0x04, 'porta'],
      ['4', 0xa4, 'vibrato'],
      ['7', 0xa4, 'tremolo'],
      ['A', 0x10, 'volSlide'],
      ['P', 0x40, 'finePitch'],
      ['V', 0x02, 'duty'],
    ]
    for (const [cmd, param, field] of cases) {
      const mutated = withFx(fixture(), 'pulse1', 0, 12, [{ cmd, param }])
      expect(stickyLint(mutated).findings, `${cmd}${param.toString(16)}`).toContain(`seam:pulse1:${field}`)
    }
  })

  it('a mode the intro leaves behind that the loop pass clears is reported too', () => {
    // 4A4 in the intro, 400 after the loop row: pass 1 reaches the loop row with vibrato
    // running and pass 2 reaches it clear, so the passes do not start alike.
    const drift = withFx(withFx(fixture(), 'pulse1', 0, 12, [{ cmd: '4', param: 0xa4 }]), 'pulse1', 1, 8, [{ cmd: '4', param: 0 }])
    expect(stickyLint(drift).findings).toContain('drift:pulse1:vibrato')
  })

  it('a loop row the order never returns to, and a missing loopFrame, both fail', () => {
    const song = fixture()
    expect(stickyLint(withQa(song, { ...qaOf(song), loopFrame: 0 })).findings)
      .toContain('seam:-:unreached')
    expect(stickyLint(withQa(song, {})).findings).toContain('seam:-:loopFrame')
  })

  it('the summary counts set against cleared, per lane', () => {
    expect(stickyLint(fixture()).summary).toEqual([
      'pulse1: 0xy set 1, cleared 0',
      'pulse2: 3xx set 2, cleared 0',
      'triangle: 7xy set 2, cleared 0',
    ])
    expect(stickyLint(withFx(fixture(), 'pulse1', 3, 0, [{ cmd: '0', param: 0 }])).summary[0])
      .toBe('pulse1: 0xy set 1, cleared 1')
  })

  it('the songs that pass are not passing for want of sticky effects', () => {
    const source = SONGS.find((s) => s.id === 'skyline-run') as Registered
    const song = tryParse(source.raw).song as Song
    expect(stickyLint(song).findings).toEqual([])
    expect(stickyLint(song).summary.join('\n')).toContain('0xy set')
    // Delete its twelve 000 cells — nothing else — and the same song fails the gate.
    const stripped: Song = {
      ...song,
      patterns: song.patterns.map((p) => ({
        ...p,
        rows: p.rows.map((c) =>
          c.fx === undefined ? c : { ...c, fx: c.fx.filter((e) => !(e !== null && e.cmd === '0' && e.param === 0)) },
        ),
      })),
    }
    expect(stickyLint(stripped).findings.length).toBeGreaterThan(0)
  })
})
