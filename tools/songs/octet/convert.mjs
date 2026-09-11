/** OCTET song → pulsar song, mechanically (tools/songs/octet/README.md).
 *
 *  Usage:  node tools/songs/octet/build.mjs <octet.json> <out.json> --song <module.mjs>
 *
 *  The OCTET document is an eight-lane dense grid — `rows[lane][row] = [note, inst, vol,
 *  fx, param]`, lanes 0–4 the 2A03 (pulse 1, pulse 2, triangle, noise, DMC), lanes 5–7 the
 *  VRC6 expansion (two pulses and the sawtooth). pulsar now has the same eight lanes, so
 *  every lane maps straight across. A song module (`skyline-run.mjs`, `cathedral-of-gears
 *  .mjs`, `tide-tables.mjs`) may still adjust the document in its `reduce`, but only for a
 *  target-driver difference — never to re-voice the music:
 *
 *    note 0..95 (A-4 = 57)            -> MIDI, +12 on the melodic lanes (A4 = 69; the
 *                                        triangle, the VRC6 pulses and the sawtooth all
 *                                        sound at written pitch in both engines)
 *    noise note n                     -> 32 + (n & 15): both engines write
 *                                        $400E = 15 - (note mod 16), so the residue is what
 *                                        must survive, and 32..47 is the lint's window
 *    DMC row [rate, sample]           -> a kit instrument's key-map slot (36, 38, 40, …),
 *                                        one slot per distinct (sample, rate)
 *    -1 / -2 / null                   -> cut / release / absent
 *    instrument macros                -> shared sequence banks, de-duplicated by value;
 *                                        fixed-mode arpeggio values are notes, so +12
 *    one pattern of eight lanes       -> one pattern per channel, de-duplicated, order
 *                                        frames of per-channel indices
 *
 *  `channels` is a PREFIX of the canonical eight, so a song that uses a VRC6 lane declares
 *  `dpcm` as well — empty pattern, index 0 in every order frame — and a 2A03-only song
 *  still ends at five.
 *
 *  The output is written in exactly the shape `serializeSong` emits (key order, sorting,
 *  trailing-null trimming, two-space indent), so gate A's byte-identical round trip holds
 *  on the committed file — `tests/unit/soundtrack.test.ts` asserts it.
 */
import { readFileSync } from 'node:fs'

export const LANE = Object.freeze({ P1: 0, P2: 1, TRI: 2, NOISE: 3, DMC: 4, V1: 5, V2: 6, SAW: 7 })
export const CHANNELS = Object.freeze([
  'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
])
/** The lanes that carry pitched notes: everything but noise (a period index) and DMC. */
const MELODIC_LANES = Object.freeze([LANE.P1, LANE.P2, LANE.TRI, LANE.V1, LANE.V2, LANE.SAW])
/** Every lane that carries an instrument reference (all but DMC, which uses the kit). */
const INSTRUMENT_LANES = Object.freeze([LANE.P1, LANE.P2, LANE.TRI, LANE.NOISE, LANE.V1, LANE.V2, LANE.SAW])
export const OFF = -1
export const REL = -2

// --- reading -------------------------------------------------------------------------------

/** A cell is `[note, inst, vol, fx, param, extraFx?]`; `extraFx` (ours, for the reducers)
 *  is a list of further `[cmd, param]` pairs on the same row. */
export function toCell(cell) {
  if (cell === null || cell === undefined) return null
  const out = [null, null, null, null, null]
  for (let i = 0; i < 5; i++) out[i] = cell[i] === undefined ? null : cell[i]
  if (Array.isArray(cell[5]) && cell[5].length > 0) out[5] = cell[5].map((e) => [e[0], e[1]])
  return isEmptyCell(out) ? null : out
}

export function isEmptyCell(cell) {
  if (!cell) return true
  for (let i = 0; i < 5; i++) if (cell[i] !== null) return false
  return !(Array.isArray(cell[5]) && cell[5].length > 0)
}

/** Read an OCTET JSON file into a fully dense, normalised document (a deep copy). */
export function loadOctet(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  if (raw.format !== 'octet-song') throw new Error(`${path}: not an octet-song document`)
  const rows = raw.rowsPerPattern
  return {
    title: raw.title,
    author: raw.author,
    notes: raw.notes ?? '',
    speed: raw.speed,
    tempo: raw.tempo,
    rowsPerPattern: rows,
    instruments: raw.instruments.map((i) => ({
      name: i.name,
      volume: macro(i.volume),
      arpeggio: { ...macro(i.arpeggio), mode: i.arpeggio?.mode ?? 'absolute' },
      pitch: macro(i.pitch),
      duty: macro(i.duty),
    })),
    dpcm: (raw.dpcm ?? []).map((s) => ({ name: s.name, data: s.data, loop: !!s.loop, rate: s.rate })),
    patterns: raw.patterns.map((p) => ({
      name: p.name ?? '',
      rows: Array.from({ length: 8 }, (_, c) =>
        Array.from({ length: rows }, (_, r) => toCell(p.rows[c]?.[r])),
      ),
    })),
    order: raw.order.slice(),
  }
}

function macro(m) {
  return { values: (m?.values ?? []).slice(), loop: m?.loop ?? -1, release: m?.release ?? -1 }
}

// --- helpers the song modules share ---------------------------------------------------------

/** A cell's effects as `[cmd, param]` pairs (the primary column first). */
export function cellFx(cell) {
  if (!cell) return []
  const out = []
  if (cell[3] !== null && cell[3] !== undefined) out.push([cell[3], cell[4] ?? 0])
  if (Array.isArray(cell[5])) for (const e of cell[5]) out.push([e[0], e[1]])
  return out
}

/** Set a cell's effect list (first pair into the primary column, the rest into `extraFx`). */
export function withFx(cell, fx) {
  const out = cell ? cell.slice(0, 5) : [null, null, null, null, null]
  while (out.length < 5) out.push(null)
  out[3] = fx.length ? fx[0][0] : null
  out[4] = fx.length ? fx[0][1] : null
  if (fx.length > 1) out[5] = fx.slice(1).map((e) => [e[0], e[1]])
  return isEmptyCell(out) ? null : out
}

export function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inst'
}

export function hasNote(cell) {
  return !!cell && cell[0] !== null && cell[0] !== undefined
}

/** The lane's cells across the whole order as one array (`absolute row = frame ·
 *  rowsPerPattern + row`; cells are shared, not copied). Both VRC6 demos use an identity
 *  order, so a timeline maps back onto the patterns one-to-one; this asserts that. */
export function timeline(doc, lane) {
  doc.order.forEach((p, f) => {
    if (p !== f) throw new Error(`order[${f}] = ${p}: a lane timeline needs an identity order`)
  })
  const out = []
  for (const p of doc.order) for (const cell of doc.patterns[p].rows[lane]) out.push(cell)
  return out
}

export function writeTimeline(doc, lane, cells) {
  const rows = doc.rowsPerPattern
  for (let i = 0; i < cells.length; i++) {
    doc.patterns[doc.order[Math.floor(i / rows)]].rows[lane][i % rows] = cells[i] ?? null
  }
}

/** Row 0 of the loop frame must state note, instrument and volume on every lane that
 *  sounds — pulsar's presets declare their entry state rather than inheriting whatever the
 *  previous pass left in the register file. `policy[lane]` is `'cut'` (nothing was sounding
 *  across the seam) or `[note, inst, vol]` (restate the note that carries across it).
 *  Returns the lanes it actually had to write, so a module can assert the short list its
 *  header comment claims instead of letting a silent document change widen it. */
export function ensureLoopEntry(doc, frame, policy) {
  const pattern = doc.patterns[doc.order[frame]]
  const written = []
  for (const [laneKey, rule] of Object.entries(policy)) {
    const lane = Number(laneKey)
    const cell = pattern.rows[lane][0] ?? [null, null, null, null, null]
    if (hasNote(cell) && cell[0] >= 0 && cell[1] !== null && cell[2] !== null) continue
    if (hasNote(cell) && cell[0] === OFF) continue
    const next = cell.slice()
    while (next.length < 5) next.push(null)
    if (rule === 'cut') {
      if (!hasNote(next)) next[0] = OFF
    } else {
      if (!hasNote(next)) next[0] = rule[0]
      if (next[1] === null) next[1] = rule[1]
      if (next[2] === null) next[2] = rule[2]
    }
    pattern.rows[lane][0] = isEmptyCell(next) ? null : next
    written.push(lane)
  }
  return written.sort((a, b) => a - b)
}

/** Throw unless `lanes` is exactly `expected` — the assertion a module's header comment
 *  makes when it says which lanes a correction touches. */
export function expectLanes(label, lanes, expected) {
  const got = lanes.join(',')
  const want = [...expected].sort((a, b) => a - b).join(',')
  if (got !== want) throw new Error(`${label}: touched lanes [${got}], expected [${want}]`)
}

// --- instruments and sequences --------------------------------------------------------------

/** Shared banks, de-duplicated by value. Returns `{ banks, indexOf(kind, seq) }`. */
function bankBuilder() {
  const banks = { volume: [], arpeggio: [], pitch: [], hiPitch: [], duty: [] }
  const keys = new Map()
  return {
    banks,
    indexOf(kind, seq) {
      if (!seq || seq.values.length === 0) return -1
      const entry = { values: seq.values.slice(), loop: seq.loop, release: seq.release }
      if (kind === 'arpeggio' && seq.mode && seq.mode !== 'absolute') entry.mode = seq.mode
      const key = `${kind}:${JSON.stringify(entry)}`
      if (!keys.has(key)) {
        keys.set(key, banks[kind].length)
        banks[kind].push(entry)
      }
      return keys.get(key)
    },
  }
}

function convertInstrument(inst, id, bank) {
  const arp = { ...inst.arpeggio }
  // A fixed-mode arpeggio value IS the note, so it moves with the note numbering.
  if (arp.mode === 'fixed') arp.values = arp.values.map((v) => v + 12)
  return {
    name: `x-${id}-${slug(inst.name)}`,
    macros: {
      volume: bank.indexOf('volume', inst.volume),
      arpeggio: bank.indexOf('arpeggio', arp),
      pitch: bank.indexOf('pitch', inst.pitch),
      hiPitch: -1,
      duty: bank.indexOf('duty', inst.duty),
    },
  }
}

// --- engine differences ------------------------------------------------------------------
//
// The two drivers agree on notes, macros and most effects (the port's notes list every
// item checked); the differences below are the ones that change what is heard, fixed here
// so every song module inherits them.

const VIB_AMP = [0, 1, 2, 3, 4, 6, 8, 11, 14, 18, 23, 29, 36, 44, 54, 64]

function fixEffect(cmd, param) {
  // Axy: OCTET x = up, y = down; pulsar (FamiTracker) x = down, y = up.
  if (cmd === 'A') return ['A', ((param & 15) << 4) | ((param >> 4) & 15)]
  // 7xy: OCTET is a raised cosine of depth y over 64 ticks; pulsar is |sin| over 32 ticks
  // with depth through the vibrato amplitude table. 700 must not re-read effect memory.
  if (cmd === '7') {
    const x = (param >> 4) & 15
    const y = param & 15
    if (param === 0) return ['7', 0x10]
    let depth = 0
    while (depth < 15 && VIB_AMP[depth + 1] <= y) depth++
    return ['7', (Math.max(1, Math.round(0.6 * x)) << 4) | depth]
  }
  // 300 (OCTET: portamento off) -> 100 (pulsar: cancel the slide mode, no slide).
  if (cmd === '3' && param === 0) return ['1', 0]
  return [cmd, param]
}

/** OCTET's 3xx glides the note on ITS row only — a later plain note retriggers and snaps.
 *  pulsar's 3xx is a channel mode that keeps later notes from retriggering until 1xx/2xx
 *  cancels it, so the first plain note after a glide (or after a Qxy/Rxy scoop) gets an
 *  explicit `100`: cancel, no slide, hard trigger. The VRC6 pulses and the sawtooth take
 *  exactly the same treatment as the 2A03 pulses — same effect set, same slide semantics. */
function applyEngineDifferences(doc) {
  const rows = doc.rowsPerPattern
  const lanes = [LANE.P1, LANE.P2, LANE.TRI, LANE.NOISE, LANE.V1, LANE.V2, LANE.SAW]
  for (const p of new Set(doc.order)) {
    for (const c of lanes) {
      const lane = doc.patterns[p].rows[c]
      for (let r = 0; r < rows; r++) {
        if (!lane[r]) continue
        let fx = cellFx(lane[r]).map(([cmd, param]) => fixEffect(cmd, param))
        // OCTET ignores pitch effects on the noise lane; pulsar would move the period index.
        if (c === LANE.NOISE) fx = fx.filter(([cmd]) => !'1234PQR'.includes(cmd))
        lane[r] = withFx(lane[r], fx)
      }
    }
  }
  for (const c of MELODIC_LANES) {
    let porta = false
    let inst = 0
    for (const p of doc.order) {
      const lane = doc.patterns[p].rows[c]
      for (let r = 0; r < rows; r++) {
        const cell = lane[r]
        if (!cell) continue
        if (cell[1] !== null) inst = cell[1]
        const fx = cellFx(cell)
        const cancels = fx.some(([cmd]) => cmd === '1' || cmd === '2')
        const glide = fx.some(([cmd, param]) => cmd === '3' && param !== 0)
        // Qxy/Rxy too: pulsar re-arms the slide on every later note until something
        // cancels it; OCTET retriggers the next plain note and drops the slide.
        const noteSlide = fx.some(([cmd]) => cmd === 'Q' || cmd === 'R')
        if (cancels) porta = false
        if (cell[0] !== null && cell[0] >= 0 && porta && !glide && !noteSlide && !cancels) {
          lane[r] = withFx(cell, [['1', 0], ...fx])
          porta = false
        }
        if (glide || noteSlide) porta = true
        // `===` on an instrument without a release point is a no-op in OCTET and a cut in
        // pulsar: drop the note, keep the row's effects.
        if (cell[0] === REL && doc.instruments[inst].volume.release < 0) {
          lane[r] = withFx([null, cell[1], cell[2], null, null], fx)
        }
      }
    }
  }
  // ...and it ignores pitch macros there too.
  const onNoise = new Set()
  for (const p of doc.order) for (const cell of doc.patterns[p].rows[LANE.NOISE]) if (cell && cell[1] !== null) onNoise.add(cell[1])
  for (const i of onNoise) doc.instruments[i].pitch = { values: [], loop: -1, release: -1 }
  return doc
}

// --- the conversion ---------------------------------------------------------------------------

/** `song` is a song module's exports: `{ id, name, author, rowHighlight, rowHighlight2, qa,
 *  reduce(doc) }`. Returns the canonical JSON text. */
export function convert(doc, song) {
  const reduced = applyEngineDifferences(song.reduce ? song.reduce(doc) : doc)
  const rows = reduced.rowsPerPattern
  const referenced = [...new Set(reduced.order)]

  // DPCM: one kit instrument, one key-map slot per distinct (sample, rate) pair.
  const slots = new Map()
  for (const p of referenced) {
    for (const cell of reduced.patterns[p].rows[LANE.DMC]) {
      if (!cell || cell[0] === null || cell[0] < 0) continue
      const key = `${cell[1] ?? 0}:${cell[0] & 15}`
      if (!slots.has(key)) slots.set(key, { sample: cell[1] ?? 0, rate: cell[0] & 15 })
    }
  }
  const slotList = [...slots.values()].sort((a, b) => a.sample - b.sample || a.rate - b.rate)
  const slotNote = new Map(slotList.map((s, i) => [`${s.sample}:${s.rate}`, 36 + 2 * i]))

  // Instruments referenced by the melodic/noise lanes, compacted and renumbered.
  const used = new Set()
  for (const p of referenced) {
    for (const c of INSTRUMENT_LANES) {
      for (const cell of reduced.patterns[p].rows[c]) if (cell && cell[1] !== null) used.add(cell[1])
    }
  }
  const bank = bankBuilder()
  const renumber = new Map()
  const instruments = []
  for (let i = 0; i < reduced.instruments.length; i++) {
    if (!used.has(i)) continue
    renumber.set(i, instruments.length)
    instruments.push(convertInstrument(reduced.instruments[i], song.id, bank))
  }
  let kitIndex = -1
  if (slotList.length > 0) {
    const dpcm = {}
    for (const s of slotList) {
      const src = reduced.dpcm[s.sample]
      const entry = { sample: s.sample, pitch: s.rate, loop: src.loop }
      // OCTET parks the DMC level at 0x40 once at song start and its samples return to
      // that level, so every hit starts from 64; the preload reproduces that per hit.
      if (song.dpcmDelta !== undefined) entry.delta = song.dpcmDelta
      dpcm[String(slotNote.get(`${s.sample}:${s.rate}`))] = entry
    }
    kitIndex = instruments.length
    instruments.push({
      name: `x-${song.id}-kit`,
      macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: -1 },
      dpcm,
    })
  }

  // Lanes that actually carry anything decide the channel prefix. `channels` must be a
  // prefix of the canonical eight, so a VRC6 lane pulls the unused dpcm lane in with it:
  // an empty pattern and a 0 in every order frame, which the preset lint accepts because
  // the lane claims nothing and carries no events.
  let lastLane = 0
  for (const p of referenced) {
    for (let c = 0; c < 8; c++) if (reduced.patterns[p].rows[c].some((cell) => cell !== null)) lastLane = Math.max(lastLane, c)
  }
  const channels = CHANNELS.slice(0, lastLane + 1)
  const effectColumns = channels.map(() => 1)

  // Per-channel sparse patterns, de-duplicated across the order.
  const byChannel = channels.map(() => ({ keys: new Map(), list: [] }))
  const order = []
  for (const p of reduced.order) {
    const frame = []
    for (let c = 0; c < channels.length; c++) {
      const cells = []
      for (let r = 0; r < rows; r++) {
        const cell = reduced.patterns[p].rows[c][r]
        if (!cell) continue
        const out = { r }
        const note = cell[0]
        if (note !== null) {
          if (c === LANE.DMC) out.note = note < 0 ? note : slotNote.get(`${cell[1] ?? 0}:${note & 15}`)
          else if (c === LANE.NOISE) out.note = note < 0 ? note : 32 + (note & 15)
          else out.note = note < 0 ? note : note + 12
        }
        if (cell[1] !== null) out.inst = c === LANE.DMC ? kitIndex : renumber.get(cell[1])
        if (cell[2] !== null) out.vol = cell[2]
        const fx = cellFx(cell)
        if (fx.length) {
          out.fx = fx.map(([cmd, param]) => ({ cmd, param }))
          effectColumns[c] = Math.max(effectColumns[c], fx.length)
        }
        cells.push(out)
      }
      const key = JSON.stringify(cells)
      const slot = byChannel[c]
      if (!slot.keys.has(key)) {
        slot.keys.set(key, slot.list.length)
        slot.list.push({ channel: channels[c], index: slot.list.length, rows: cells })
      }
      frame.push(slot.keys.get(key))
    }
    order.push(frame)
  }

  const out = {
    format: 'pulsar-song',
    version: 1,
    meta: {
      name: song.name ?? reduced.title,
      author: song.author ?? reduced.author,
      engineSpeed: 60,
      tempo: reduced.tempo,
      speed: reduced.speed,
      rowsPerPattern: rows,
      rowHighlight: song.rowHighlight,
      rowHighlight2: song.rowHighlight2,
      region: 'ntsc',
      speedSplitPoint: 0x20,
      evenTempo: false,
    },
    channels,
    effectColumns,
    order,
    patterns: byChannel.flatMap((slot) => slot.list),
    instruments,
    sequences: bank.banks,
    samples: reduced.dpcm.map((s) => ({ name: `x-${song.id}-${slug(s.name)}`, data: s.data })),
    extra: { qa: song.qa },
  }
  return `${JSON.stringify(out, null, 2)}\n`
}
