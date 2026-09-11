/** the composer's library — write a piece as a script, ship its JSON.
 *
 *      import { Song, n, CUT, REL, L } from './lib.mjs'
 *
 *  Zero dependencies, node >= 22, nothing under `src/`. The generator is the
 *  composition (preset-suite §12): readable sections, named motifs, comments that say
 *  what each lane does and why. Its output JSON is the shipped artifact and is never
 *  hand-edited, and gate A's byte-identical round trip is what proves the two agree.
 *
 *  Everything a piece declares that can be DERIVED is derived — the channel prefix, the
 *  effect columns, the pattern de-duplication, `qa.channels`, `qa.effects`, `qa.form`,
 *  `qa.loopFrame`, `qa.bank`. A composer states the things only a composer knows: the
 *  key, the tempo bracket, the duration bracket, the notes, and the render checksum the
 *  gate prints.
 *
 *  See `README.md` in this directory for the authoring loop, and `docs/preset-suite.md`
 *  §12 for the annex that sanctions the generator.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { makeSamples } from '../makeDpcm.mjs'
import { CHANNELS, CUT, L, MELODIC_LANES, REL, hex, n, nib, noteName } from './notes.mjs'
import { DPCM_KIT_NAME, KIT_NOTES, REPO_ROOT, bankInstrument, bankSequence, copyDpcmMap, loadBank } from './bank.mjs'
import { MACRO_KINDS, channelPrefix, closeLoop, flatten, soundingLanes } from './build.mjs'
import { serialize } from './serialize.mjs'
import { checkDoc } from './check.mjs'
import { Section } from './section.mjs'

export { L, CUT, REL, n, hex, nib, noteName, CHANNELS, KIT_NOTES, MELODIC_LANES }

/** Even ticks per row need `tempo === 2.5 * engineSpeed` (§1), so the album's grid is
 *  fixed at NTSC 60 Hz and tempo 150 and a piece chooses its `speed`. */
const TEMPO = 150
const ENGINE_SPEED = 60

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inst'
}

/** A macro spec: `[15, 14, 13]`, or `{ values, loop, release, mode }`. */
function macro(kind, spec, label) {
  if (spec === undefined || spec === null) return null
  const raw = Array.isArray(spec) ? { values: spec } : spec
  const values = (raw.values ?? []).map((v) => {
    if (!Number.isInteger(v)) throw new Error(`${label}.${kind}: ${JSON.stringify(v)} is not an integer`)
    return v
  })
  if (values.length === 0) return null
  if (values.length > 253) throw new Error(`${label}.${kind}: ${values.length} values exceeds FamiTracker's cap of 253`)
  const loop = raw.loop === undefined ? -1 : raw.loop
  const release = raw.release === undefined ? -1 : raw.release
  for (const [field, v] of [['loop', loop], ['release', release]]) {
    if (!Number.isInteger(v) || v < -1 || v > values.length - 1) {
      throw new Error(`${label}.${kind}.${field}: ${v} outside -1..${values.length - 1}`)
    }
  }
  if (kind === 'volume' && values.some((v) => v < 0 || v > 15)) throw new Error(`${label}.volume: values must be 0..15`)
  if (kind === 'duty' && values.some((v) => v < 0)) throw new Error(`${label}.duty: values must be >= 0`)
  const out = { values, loop, release }
  if (kind === 'arpeggio' && raw.mode !== undefined) {
    if (!['absolute', 'fixed', 'relative'].includes(raw.mode)) {
      throw new Error(`${label}.arpeggio.mode: ${JSON.stringify(raw.mode)} is not absolute | fixed | relative`)
    }
    if (raw.mode !== 'absolute') out.mode = raw.mode
  }
  return out
}

export class Song {
  constructor(meta = {}) {
    const { id, name, author, speed, rowsPerPattern = 64, rowHighlight = 4, rowHighlight2 = 16 } = meta
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) throw new Error('Song: id must be a lowercase slug, e.g. "my-piece"')
    if (!Number.isInteger(speed) || speed < 1 || speed > 31) throw new Error('Song: speed must be an integer 1..31')
    if (!Number.isInteger(rowsPerPattern) || rowsPerPattern < 1 || rowsPerPattern > 256) {
      throw new Error('Song: rowsPerPattern must be 1..256')
    }
    if (!Number.isInteger(rowHighlight) || rowHighlight < 1) throw new Error('Song: rowHighlight must be >= 1')
    if (!Number.isInteger(rowHighlight2) || rowHighlight2 < 1) throw new Error('Song: rowHighlight2 must be >= 1')
    this.id = id
    this.meta = {
      name: name ?? id,
      author: author ?? '',
      engineSpeed: ENGINE_SPEED,
      tempo: TEMPO,
      speed,
      rowsPerPattern,
      rowHighlight,
      rowHighlight2,
      region: 'ntsc',
      speedSplitPoint: 0x20,
      evenTempo: false,
    }
    this.instruments = []
    this.samples = []
    this.sections = new Map()
    this.orderNames = null
    this.loopTarget = null
    this.loopLane = undefined
    this.declared = {}
    this.kit = null
  }

  /** `24 * tempo / (speed * rowHighlight)` — the number `qa.bpmRange` brackets. */
  get bpm() {
    return (24 * this.meta.tempo) / (this.meta.speed * this.meta.rowHighlight)
  }

  /** One bar is `rowHighlight2` rows. `at(3, 8)` is row 8 of bar 3. */
  get rowsPerBar() {
    return this.meta.rowHighlight2
  }

  at(bar, row = 0) {
    return bar * this.rowsPerBar + row
  }

  /** Shared-bank instruments BY NAME, copied byte-identically from the fixture
   *  (preset-suite §3.1). Returns their ids, in the order asked. */
  bank(...names) {
    return names.map((name) => {
      if (name === DPCM_KIT_NAME) throw new Error(`use s.dpcmKit(), not s.bank('${DPCM_KIT_NAME}') — the kit needs its samples too`)
      const existing = this.instruments.findIndex((i) => i.name === name)
      if (existing >= 0) return existing
      const src = bankInstrument(name)
      const macros = {}
      for (const kind of MACRO_KINDS) macros[kind] = src.macros[kind] < 0 ? null : bankSequence(kind, src.macros[kind])
      const entry = { name, macros }
      if (KIT_NOTES[name] !== undefined) entry.note = KIT_NOTES[name]
      this.instruments.push(entry)
      return this.instruments.length - 1
    })
  }

  /** A piece-specific instrument, named `x-<id>-<name>` automatically. Sequences are
   *  de-duplicated by value into the shared banks at write time, so two instruments that
   *  share an envelope cost one entry. `note` is an authoring default for `hits()` and
   *  never reaches the file. */
  instrument(name, spec = {}) {
    const full = `x-${this.id}-${slug(name)}`
    if (this.instruments.some((i) => i.name === full)) throw new Error(`instrument "${full}" already exists`)
    const label = `instrument("${name}")`
    const macros = {}
    for (const kind of MACRO_KINDS) macros[kind] = macro(kind, spec[kind], label)
    const entry = { name: full, macros }
    if (spec.note !== undefined) entry.note = n(spec.note)
    this.instruments.push(entry)
    return this.instruments.length - 1
  }

  /** The album's DPCM kit: the shared bank's `dpcm-kit` instrument plus the two samples
   *  `tools/songs/makeDpcm.mjs` generates from arithmetic. Returns
   *  `{ inst, kick, snare, notes }` — the key-map notes are the bank's, not new ones. */
  dpcmKit() {
    if (this.kit !== null) return this.kit
    const generated = makeSamples()
    const base = this.samples.length
    for (const s of generated) this.samples.push({ name: s.name, data: s.data })
    const src = bankInstrument(DPCM_KIT_NAME)
    const map = copyDpcmMap(src.dpcm)
    const notes = {}
    for (const key of Object.keys(map)) {
      notes[generated[map[key].sample].name] = Number(key)
      map[key].sample += base
    }
    this.instruments.push({ name: DPCM_KIT_NAME, macros: { volume: null, arpeggio: null, pitch: null, hiPitch: null, duty: null }, dpcm: map })
    this.kit = {
      inst: this.instruments.length - 1,
      kick: notes['dpcm-kick'],
      snare: notes['dpcm-snare'],
      notes,
    }
    return this.kit
  }

  /** `bars` bars of eight lanes, all null. One bar is `rowHighlight2` rows, so the
   *  section's length must come out a whole number of `rowsPerPattern` patterns. */
  section(name, bars) {
    if (this.sections.has(name)) throw new Error(`section "${name}" already exists`)
    if (!Number.isInteger(bars) || bars < 1) throw new Error(`section("${name}"): bars must be a positive integer`)
    const sec = new Section(name, bars, this.rowsPerBar)
    sec.defaultNote = (inst) => {
      const entry = this.instruments[inst]
      if (entry === undefined) throw new Error(`hits(): instrument ${inst} does not exist`)
      if (entry.note === undefined) {
        throw new Error(`hits(): "${entry.name}" has no default note — pass one, or declare { note } on the instrument`)
      }
      return entry.note
    }
    this.sections.set(name, sec)
    return sec
  }

  /** Section names, one entry per playthrough of that section. A section longer than one
   *  pattern spans consecutive frames; `qa.form` is derived from these names. */
  order(names) {
    if (!Array.isArray(names) || names.length === 0) throw new Error('order(): expected a non-empty list of section names')
    for (const name of names) if (!this.sections.has(name)) throw new Error(`order(): "${name}" is not a section`)
    this.orderNames = [...names]
    return this
  }

  /** `Bxx` on the last frame's last row, pointing at the first frame of `name`, plus the
   *  §2.9 loop-entry state on every lane that sounds. */
  loopTo(name, opts = {}) {
    this.loopTarget = name
    this.loopLane = opts.lane
    return this
  }

  /** Declared QA fields. `channels`, `effects`, `form`, `loopFrame` and `bank` are
   *  derived and must not be passed; everything else passes through verbatim. */
  qa(fields = {}) {
    this.declared = { ...this.declared, ...fields }
    return this
  }

  /** Flatten, close the loop, de-duplicate, serialize. Pure: safe to call repeatedly. */
  build() {
    if (this.orderNames === null) throw new Error('call order([...]) before building')
    if (this.loopTarget === null) throw new Error('call loopTo(section) before building — an album piece loops (§2.9)')
    const { frames, form, firstFrameOf } = flatten(this)
    const lanes = soundingLanes(frames)
    const channels = channelPrefix(frames)
    const loopFrame = firstFrameOf.get(this.loopTarget)
    if (loopFrame === undefined) throw new Error(`loopTo("${this.loopTarget}"): that section is not in the order`)
    const loop = closeLoop(frames, this.meta.rowsPerPattern, loopFrame, lanes, this.loopLane)
    const extra = { qa: this.buildQa({ frames, form, channels, lanes, loopFrame }) }
    const out = serialize({ meta: this.meta, channels, frames, instruments: this.instruments, samples: this.samples, extra })
    return { ...out, frames, form, channels, loopFrame, loopLane: loop.bLane, loopEntries: loop.entries }
  }

  /** Derived fields first, then whatever the composer declared, in a stable order. */
  buildQa({ frames, form, channels, lanes, loopFrame }) {
    const effects = new Set()
    for (const frame of frames) {
      for (let c = 0; c < channels.length; c++) {
        for (const cell of frame[c]) for (const e of cell?.fx ?? []) effects.add(e.cmd)
      }
    }
    const claimed = lanes.filter((c) => c < channels.length).map((c) => CHANNELS[c])
    const bankNames = this.instruments.filter((i) => !i.name.startsWith('x-')).map((i) => i.name)
    const d = this.declared
    const qa = {}
    const set = (key, value) => {
      if (value !== undefined) qa[key] = value
    }
    set('key', d.key)
    set('accidentalFractionMax', d.accidentalFractionMax)
    qa.channels = claimed
    qa.effects = [...effects].sort()
    set('bpmRange', d.bpmRange)
    set('durationSec', d.durationSec)
    set('rmsRange', d.rmsRange)
    set('clippedSamplesMax', d.clippedSamplesMax)
    qa.loopFrame = loopFrame
    set('percussionGap', d.percussionGap)
    set('percussionMinEvents', d.percussionMinEvents)
    set('percussionCoverage', d.percussionCoverage)
    qa.form = [...form]
    set('motif', d.motif)
    if (d.bank !== undefined) qa.bank = d.bank
    else if (bankNames.length > 0) qa.bank = { instruments: bankNames, rev: loadBank().rev }
    set('notes', d.notes)
    set('renderChecksum', d.renderChecksum)
    return qa
  }

  /** The structural pre-flight. Throws listing every fault; returns `this` when clean. */
  check() {
    const built = this.build()
    const problems = checkDoc(built.doc, this.id, built.loopFrame)
    if (problems.length > 0) {
      throw new Error(`${this.id}: ${problems.length} problem(s)\n  ${problems.map((p) => `[${p.code}] ${p.message}`).join('\n  ')}`)
    }
    return this
  }

  /** Write the canonical bytes. Runs `check()` first unless told not to. */
  write(path, opts = {}) {
    const built = this.build()
    if (opts.check !== false) {
      const problems = checkDoc(built.doc, this.id, built.loopFrame)
      if (problems.length > 0) {
        throw new Error(`${this.id}: ${problems.length} problem(s)\n  ${problems.map((p) => `[${p.code}] ${p.message}`).join('\n  ')}`)
      }
    }
    const full = isAbsolute(path) ? path : join(REPO_ROOT, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, built.text)
    const summary = {
      path: full,
      bytes: Buffer.byteLength(built.text),
      frames: built.doc.order.length,
      patterns: built.doc.patterns.length,
      instruments: built.doc.instruments.length,
      samples: built.doc.samples.length,
      channels: built.channels.length,
      loopFrame: built.loopFrame,
      bpm: this.bpm,
    }
    if (opts.quiet !== true) {
      process.stdout.write(
        `${full}\n  ${summary.frames} frames, ${summary.patterns} patterns, ${summary.instruments} instruments, ` +
          `${summary.samples} samples, ${summary.channels} lanes, loop @ ${summary.loopFrame}, ` +
          `${summary.bpm.toFixed(2)} BPM, ${summary.bytes} bytes\n`,
      )
    }
    return summary
  }
}
