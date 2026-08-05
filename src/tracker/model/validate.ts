/** Hand-written validator + serializer for song format v1 (design §1.5, §1.6).
 *
 *  No schema library, and that is a decision, not an omission (K4): `zod`/`valibot`
 *  would be ~12 KB gzipped of runtime for a document parsed a few times a session, and
 *  the messages we want — "pattern 3 row 7 references instrument 2, which does not
 *  exist" — are domain messages a generic validator cannot produce. This file is
 *  smaller than the dependency and its output feeds the preset QA lint directly.
 *
 *  Two-tier result, always:
 *    error  refuse to load. `parseSong` throws `SongFormatError` carrying all of them.
 *    warn   load anyway, surface in the UI and in preset QA.
 *
 *  Unknown TOP-LEVEL keys warn and are dropped; anything under `extra` is
 *  round-tripped verbatim and never interpreted. Those two rules together are the
 *  forward-compatibility hinge for phase-4 FamiTracker import.
 */
import {
  CANONICAL_CHANNELS,
  MACRO_KINDS,
  MAX_EFFECT_COLUMNS,
  MAX_ENGINE_SPEED,
  MAX_NOTE,
  MAX_ROWS_PER_PATTERN,
  MAX_SEQUENCE_LENGTH,
  MAX_SPEED,
  MAX_TEMPO,
  MIN_ENGINE_SPEED,
  MIN_NOTE,
  MIN_SPEED,
  MIN_TEMPO,
  NOTE_CUT,
  NOTE_RELEASE,
  RESERVED_EFFECTS,
  SONG_FORMAT_VERSION,
  SUPPORTED_EFFECTS,
  type ArpMode,
  type Cell,
  type ChannelId,
  type DpcmAssignment,
  type DpcmSample,
  type Effect,
  type Frame,
  type Instrument,
  type MacroKind,
  type Pattern,
  type Region,
  type Sequence,
  type SequenceBank,
  type Song,
  type SongMeta,
} from './types'

export interface Diagnostic {
  path: string
  message: string
  severity: 'error' | 'warn'
}

export class SongFormatError extends Error {
  readonly diagnostics: readonly Diagnostic[]
  constructor(diagnostics: readonly Diagnostic[]) {
    const first = diagnostics.find((d) => d.severity === 'error')
    super(first === undefined ? 'invalid song' : `${first.path}: ${first.message}`)
    this.name = 'SongFormatError'
    this.diagnostics = diagnostics
  }
}

const TOP_LEVEL_KEYS = [
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
]

const META_KEYS = [
  'name',
  'author',
  'engineSpeed',
  'tempo',
  'speed',
  'rowsPerPattern',
  'rowHighlight',
  'rowHighlight2',
  'region',
  'speedSplitPoint',
  'evenTempo',
]

class Diagnostics {
  readonly list: Diagnostic[] = []
  error(path: string, message: string): void {
    this.list.push({ path, message, severity: 'error' })
  }
  warn(path: string, message: string): void {
    this.list.push({ path, message, severity: 'warn' })
  }
  get hasError(): boolean {
    return this.list.some((d) => d.severity === 'error')
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function int(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
}

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi
}

/** Decoded byte length of a base64 string, or −1 when it is not base64. Also the
 *  decoder the DPCM image builder uses, so there is one implementation. */
export function decodeBase64(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return null
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let pad = 0
  if (s.endsWith('==')) pad = 2
  else if (s.endsWith('=')) pad = 1
  const out = new Uint8Array((s.length / 4) * 3 - pad)
  let o = 0
  for (let i = 0; i < s.length; i += 4) {
    const a = alphabet.indexOf(s[i])
    const b = alphabet.indexOf(s[i + 1])
    const c = s[i + 2] === '=' ? 0 : alphabet.indexOf(s[i + 2])
    const d = s[i + 3] === '=' ? 0 : alphabet.indexOf(s[i + 3])
    if (a < 0 || b < 0 || c < 0 || d < 0) return null
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 0xff
    if (o < out.length) out[o++] = (n >> 8) & 0xff
    if (o < out.length) out[o++] = n & 0xff
  }
  return out
}

// --- parse ---------------------------------------------------------------------------

export function parseSong(input: unknown): { song: Song; diagnostics: Diagnostic[] } {
  const d = new Diagnostics()
  const raw = typeof input === 'string' ? tryJson(input, d) : input
  if (!isObject(raw)) {
    d.error('', 'not a JSON object')
    throw new SongFormatError(d.list)
  }

  if (raw.format !== 'pulsar-song') d.error('format', `expected "pulsar-song", got ${json(raw.format)}`)
  const version = int(raw.version, 0)
  if (version > SONG_FORMAT_VERSION) {
    d.error('version', `format version ${version} is newer than this build understands (${SONG_FORMAT_VERSION})`)
  }
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) d.warn(key, 'unknown top-level key, dropped')
  }

  const meta = parseMeta(raw.meta, d)
  const channels = parseChannels(raw.channels, d)
  const effectColumns = parseEffectColumns(raw.effectColumns, channels.length, d)
  // Patterns are NORMALISED into canonical (channel, index) order on the way in, the
  // same order the serializer writes — which is what makes `parse ∘ serialize ∘ parse`
  // an identity on the OBJECT and not merely on the text.
  const patterns = sortPatterns(
    parsePatterns(raw.patterns, channels, meta.rowsPerPattern, effectColumns, d),
  )
  const order = parseOrder(raw.order, channels, patterns, d)
  const sequences = parseSequences(raw.sequences, d)
  const samples = parseSamples(raw.samples, d)
  const instruments = parseInstruments(raw.instruments, sequences, samples.length, d)

  // Cross-references the driver would otherwise hit at 60 Hz.
  const usedInstruments = new Set<number>()
  for (const p of patterns) {
    for (const cell of p.rows) {
      if (cell.inst === undefined) continue
      if (cell.inst >= instruments.length) {
        d.error(
          `patterns[${p.channel}:${p.index}].rows[${cell.r}].inst`,
          `references instrument ${cell.inst}, which does not exist`,
        )
      } else {
        usedInstruments.add(cell.inst)
      }
    }
  }
  for (let i = 0; i < instruments.length; i++) {
    if (!usedInstruments.has(i)) d.warn(`instruments[${i}]`, 'instrument is never referenced')
  }

  const referenced = new Set<string>()
  for (const frame of order) {
    for (let ch = 0; ch < channels.length; ch++) referenced.add(`${channels[ch]}:${frame[ch]}`)
  }
  for (const p of patterns) {
    if (!referenced.has(`${p.channel}:${p.index}`)) {
      d.warn(`patterns[${p.channel}:${p.index}]`, 'pattern is never referenced by the order list')
    }
  }

  if (meta.region === 'pal') {
    d.warn(
      'meta.region',
      'D-TK5: PAL songs play at the NTSC rate in phase 2 — the field is stored and round-tripped',
    )
  }

  const song: Song = {
    format: 'pulsar-song',
    version: SONG_FORMAT_VERSION,
    meta,
    channels,
    effectColumns,
    order,
    patterns,
    instruments,
    sequences,
    samples,
    ...(isObject(raw.extra) ? { extra: raw.extra as Readonly<Record<string, unknown>> } : {}),
  }

  if (d.hasError) throw new SongFormatError(d.list)
  return { song, diagnostics: d.list }
}

function tryJson(text: string, d: Diagnostics): unknown {
  try {
    return JSON.parse(text)
  } catch (e) {
    d.error('', `not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
    throw new SongFormatError(d.list)
  }
}

function json(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

function parseMeta(input: unknown, d: Diagnostics): SongMeta {
  const m = isObject(input) ? input : {}
  if (!isObject(input)) d.error('meta', 'missing or not an object')
  for (const key of Object.keys(m)) {
    if (!META_KEYS.includes(key)) d.warn(`meta.${key}`, 'unknown meta key, dropped')
  }
  const engineSpeed = int(m.engineSpeed, 60)
  const tempo = int(m.tempo, 150)
  const speed = int(m.speed, 6)
  const rowsPerPattern = int(m.rowsPerPattern, 64)
  if (!inRange(engineSpeed, MIN_ENGINE_SPEED, MAX_ENGINE_SPEED)) {
    d.error('meta.engineSpeed', `${engineSpeed} outside ${MIN_ENGINE_SPEED}..${MAX_ENGINE_SPEED}`)
  }
  if (!inRange(tempo, MIN_TEMPO, MAX_TEMPO)) {
    d.error('meta.tempo', `${tempo} outside ${MIN_TEMPO}..${MAX_TEMPO}`)
  }
  if (!inRange(speed, MIN_SPEED, MAX_SPEED)) {
    d.error('meta.speed', `${speed} outside ${MIN_SPEED}..${MAX_SPEED}`)
  }
  if (!inRange(rowsPerPattern, 1, MAX_ROWS_PER_PATTERN)) {
    d.error('meta.rowsPerPattern', `${rowsPerPattern} outside 1..${MAX_ROWS_PER_PATTERN}`)
  }
  const region: Region = m.region === 'pal' ? 'pal' : 'ntsc'
  if (m.region !== undefined && m.region !== 'pal' && m.region !== 'ntsc') {
    d.error('meta.region', `expected "ntsc" or "pal", got ${json(m.region)}`)
  }
  return {
    name: typeof m.name === 'string' ? m.name : 'untitled',
    author: typeof m.author === 'string' ? m.author : '',
    engineSpeed,
    tempo,
    speed,
    rowsPerPattern,
    rowHighlight: Math.max(1, int(m.rowHighlight, 4)),
    rowHighlight2: Math.max(1, int(m.rowHighlight2, 16)),
    region,
    speedSplitPoint: int(m.speedSplitPoint, 0x20),
    evenTempo: m.evenTempo === true,
  }
}

function parseChannels(input: unknown, d: Diagnostics): readonly ChannelId[] {
  if (!Array.isArray(input)) {
    d.error('channels', 'missing or not an array')
    return CANONICAL_CHANNELS
  }
  const out: ChannelId[] = []
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== CANONICAL_CHANNELS[i]) {
      d.error(
        `channels[${i}]`,
        `channels must be a prefix of [${CANONICAL_CHANNELS.join(', ')}] — expected ${json(CANONICAL_CHANNELS[i])}, got ${json(input[i])}`,
      )
      return CANONICAL_CHANNELS
    }
    out.push(CANONICAL_CHANNELS[i])
  }
  if (out.length === 0) {
    d.error('channels', 'at least one channel is required')
    return CANONICAL_CHANNELS
  }
  return out
}

function parseEffectColumns(input: unknown, channelCount: number, d: Diagnostics): readonly number[] {
  const out: number[] = []
  if (!Array.isArray(input)) {
    d.warn('effectColumns', 'missing — defaulting every channel to 1')
    for (let i = 0; i < channelCount; i++) out.push(1)
    return out
  }
  if (input.length !== channelCount) {
    d.error('effectColumns', `length ${input.length} does not match channels.length ${channelCount}`)
  }
  for (let i = 0; i < channelCount; i++) {
    const n = int(input[i], 1)
    if (!inRange(n, 1, MAX_EFFECT_COLUMNS)) {
      d.error(`effectColumns[${i}]`, `${n} outside 1..${MAX_EFFECT_COLUMNS}`)
    }
    out.push(n < 1 ? 1 : n > MAX_EFFECT_COLUMNS ? MAX_EFFECT_COLUMNS : n)
  }
  return out
}

function parsePatterns(
  input: unknown,
  channels: readonly ChannelId[],
  rowsPerPattern: number,
  effectColumns: readonly number[],
  d: Diagnostics,
): readonly Pattern[] {
  if (!Array.isArray(input)) {
    d.error('patterns', 'missing or not an array')
    return []
  }
  const out: Pattern[] = []
  const seen = new Set<string>()
  for (let i = 0; i < input.length; i++) {
    const p = input[i]
    if (!isObject(p)) {
      d.error(`patterns[${i}]`, 'not an object')
      continue
    }
    const channel = p.channel as ChannelId
    const chIndex = channels.indexOf(channel)
    if (chIndex < 0) {
      d.error(`patterns[${i}].channel`, `${json(p.channel)} is not one of this song's channels`)
      continue
    }
    const index = int(p.index, -1)
    if (index < 0) {
      d.error(`patterns[${i}].index`, `${json(p.index)} is not a valid pattern index`)
    } else {
      // A duplicate (channel, index) must not load: the compiler's slotOf keeps the
      // LAST, the song model's findPattern returns the FIRST. Checked AFTER rounding,
      // so a float index cannot slip a second pattern onto an occupied slot.
      const key = `${channel}:${index}`
      if (seen.has(key)) d.error(`patterns[${i}].index`, `pattern ${key} is duplicated`)
      else seen.add(key)
    }
    const path = `patterns[${channel}:${index}]`
    const rows = parseRows(p.rows, path, rowsPerPattern, effectColumns[chIndex] ?? 1, d)
    out.push({ channel, index, rows })
  }
  return out
}

function parseRows(
  input: unknown,
  path: string,
  rowsPerPattern: number,
  columns: number,
  d: Diagnostics,
): readonly Cell[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) {
    d.error(`${path}.rows`, 'not an array')
    return []
  }
  const out: Cell[] = []
  let previous = -1
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    const where = `${path}.rows[${i}]`
    if (!isObject(c)) {
      d.error(where, 'not an object')
      continue
    }
    const r = int(c.r, -1)
    if (!inRange(r, 0, rowsPerPattern - 1)) {
      d.error(`${where}.r`, `row ${json(c.r)} outside 0..${rowsPerPattern - 1}`)
      continue
    }
    if (r === previous) d.error(`${where}.r`, `row ${r} is duplicated`)
    else if (r < previous) d.error(`${where}.r`, `row ${r} is out of order (previous was ${previous})`)
    previous = r

    // Past this point the ROW NUMBER identifies the cell (rows are sparse, sorted and
    // unique), and it is what the grid shows — so it, not the array index, is the path.
    const cellWhere = `${path}.rows[${r}]`
    const cell: { r: number; note?: number; inst?: number; vol?: number; fx?: (Effect | null)[] } = { r }

    if (c.note !== undefined) {
      if (c.note === null || typeof c.note !== 'number') {
        d.error(`${cellWhere}.note`, `${json(c.note)} — a missing note is an ABSENT key, never null`)
      } else {
        const note = Math.round(c.note)
        if (!inRange(note, NOTE_RELEASE, MAX_NOTE)) {
          d.error(`${cellWhere}.note`, `${note} outside ${NOTE_RELEASE}..${MAX_NOTE} (${NOTE_RELEASE}=release, ${NOTE_CUT}=cut, ${MIN_NOTE}..${MAX_NOTE}=notes)`)
        } else {
          cell.note = note
        }
      }
    }
    if (c.inst !== undefined) {
      if (c.inst === null || typeof c.inst !== 'number') {
        d.error(`${cellWhere}.inst`, `${json(c.inst)} — "unchanged" is an ABSENT key, never null and never 0`)
      } else {
        const inst = Math.round(c.inst)
        if (inst < 0 || inst > 255) d.error(`${cellWhere}.inst`, `${inst} outside 0..255`)
        else cell.inst = inst
      }
    }
    if (c.vol !== undefined) {
      if (c.vol === null || typeof c.vol !== 'number') {
        d.error(`${cellWhere}.vol`, `${json(c.vol)} — "unchanged" is an ABSENT key, never null and never 0`)
      } else {
        const vol = Math.round(c.vol)
        if (!inRange(vol, 0, 15)) d.error(`${cellWhere}.vol`, `${vol} outside 0..15`)
        else cell.vol = vol
      }
    }
    if (c.fx !== undefined) {
      const fx = parseFx(c.fx, cellWhere, columns, d)
      if (fx.length > 0) cell.fx = fx
    }
    out.push(cell as Cell)
  }
  return out
}

function parseFx(input: unknown, where: string, columns: number, d: Diagnostics): (Effect | null)[] {
  if (!Array.isArray(input)) {
    d.error(`${where}.fx`, 'not an array')
    return []
  }
  const out: (Effect | null)[] = []
  for (let i = 0; i < input.length && i < MAX_EFFECT_COLUMNS; i++) {
    const e = input[i]
    if (e === null || e === undefined) {
      out.push(null)
      continue
    }
    if (!isObject(e) || typeof e.cmd !== 'string' || e.cmd.length !== 1) {
      d.error(`${where}.fx[${i}]`, 'expected {cmd: "<one char>", param: 0..255}')
      out.push(null)
      continue
    }
    const cmd = e.cmd.toUpperCase()
    const param = int(e.param, -1)
    if (!inRange(param, 0, 255)) {
      d.error(`${where}.fx[${i}].param`, `${json(e.param)} outside 0..255 (params are DECIMAL on disk)`)
      out.push(null)
      continue
    }
    if (!SUPPORTED_EFFECTS.includes(cmd)) {
      d.warn(
        `${where}.fx[${i}].cmd`,
        RESERVED_EFFECTS.includes(cmd)
          ? `effect "${cmd}" is reserved for a later phase — it round-trips and the driver ignores it`
          : `unknown effect command "${cmd}" — it round-trips and the driver ignores it`,
      )
    }
    if (i >= columns) {
      d.warn(`${where}.fx[${i}]`, `effect column ${i} is beyond this channel's effectColumns (${columns})`)
    }
    out.push({ cmd, param })
  }
  while (out.length > 0 && out[out.length - 1] === null) out.pop()
  return out
}

function parseOrder(
  input: unknown,
  channels: readonly ChannelId[],
  patterns: readonly Pattern[],
  d: Diagnostics,
): readonly Frame[] {
  if (!Array.isArray(input)) {
    d.error('order', 'missing or not an array')
    return []
  }
  const known = new Set(patterns.map((p) => `${p.channel}:${p.index}`))
  const out: Frame[] = []
  for (let f = 0; f < input.length; f++) {
    const frame = input[f]
    if (!Array.isArray(frame)) {
      d.error(`order[${f}]`, 'not an array')
      continue
    }
    if (frame.length !== channels.length) {
      d.error(`order[${f}]`, `frame length ${frame.length} does not match channels.length ${channels.length}`)
    }
    const row: number[] = []
    for (let ch = 0; ch < channels.length; ch++) {
      const entry = frame[ch]
      // A wrong-typed entry is an authoring error, like a null cell field — int()'s
      // fallback would otherwise read null/string/NaN as pattern 0 with no diagnostic.
      if (typeof entry !== 'number' || !Number.isFinite(entry)) {
        d.error(`order[${f}][${ch}]`, `${json(entry)} — an order entry is a pattern index, never null and never a string`)
        row.push(0)
        continue
      }
      const idx = Math.round(entry)
      if (!known.has(`${channels[ch]}:${idx}`)) {
        d.error(`order[${f}][${ch}]`, `references ${channels[ch]} pattern ${idx}, which does not exist`)
      }
      row.push(idx)
    }
    out.push(row)
  }
  if (out.length === 0) d.error('order', 'a song needs at least one order frame')
  return out
}

function parseSequences(input: unknown, d: Diagnostics): SequenceBank {
  const src = isObject(input) ? input : {}
  if (!isObject(input)) d.error('sequences', 'missing or not an object')
  const bank: Record<MacroKind, Sequence[]> = {
    volume: [],
    arpeggio: [],
    pitch: [],
    hiPitch: [],
    duty: [],
  }
  for (const kind of MACRO_KINDS) {
    const list = src[kind]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      d.error(`sequences.${kind}`, 'not an array')
      continue
    }
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      const where = `sequences.${kind}[${i}]`
      if (!isObject(s) || !Array.isArray(s.values)) {
        d.error(where, 'expected {values: number[], loop, release}')
        bank[kind].push({ values: [], loop: -1, release: -1 })
        continue
      }
      const values = s.values.map((v: unknown) => int(v, 0))
      if (values.length > MAX_SEQUENCE_LENGTH) {
        d.error(`${where}.values`, `length ${values.length} exceeds FamiTracker's cap of ${MAX_SEQUENCE_LENGTH}`)
      }
      const loop = int(s.loop, -1)
      const release = int(s.release, -1)
      const top = values.length - 1
      if (!inRange(loop, -1, top)) d.error(`${where}.loop`, `${loop} outside -1..${top}`)
      if (!inRange(release, -1, top)) d.error(`${where}.release`, `${release} outside -1..${top}`)
      const seq: { values: number[]; loop: number; release: number; mode?: ArpMode } = {
        values,
        loop,
        release,
      }
      if (s.mode !== undefined) {
        const mode = s.mode as ArpMode
        if (mode === 'scheme') {
          d.error(`${where}.mode`, 'arpeggio scheme mode is 0CC-only and is rejected in format v1')
        } else if (mode !== 'absolute' && mode !== 'fixed' && mode !== 'relative') {
          d.error(`${where}.mode`, `${json(s.mode)} is not one of absolute | fixed | relative`)
        } else if (kind !== 'arpeggio') {
          d.warn(`${where}.mode`, `mode is only meaningful for arpeggio sequences, ignored on ${kind}`)
        } else {
          seq.mode = mode
        }
      }
      bank[kind].push(seq as Sequence)
    }
  }
  return bank
}

function parseInstruments(
  input: unknown,
  sequences: SequenceBank,
  sampleCount: number,
  d: Diagnostics,
): readonly Instrument[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) {
    d.error('instruments', 'not an array')
    return []
  }
  const out: Instrument[] = []
  for (let i = 0; i < input.length; i++) {
    const inst = input[i]
    if (!isObject(inst)) {
      d.error(`instruments[${i}]`, 'not an object')
      continue
    }
    const src = isObject(inst.macros) ? inst.macros : {}
    const macros = {} as Record<MacroKind, number>
    for (const kind of MACRO_KINDS) {
      const idx = int(src[kind], -1)
      if (idx >= sequences[kind].length) {
        d.error(
          `instruments[${i}].macros.${kind}`,
          `references ${kind} sequence ${idx}, but only ${sequences[kind].length} exist`,
        )
      }
      macros[kind] = idx < 0 ? -1 : idx
    }
    const dpcm = parseDpcm(inst.dpcm, `instruments[${i}].dpcm`, sampleCount, d)
    out.push({
      name: typeof inst.name === 'string' ? inst.name : `inst ${i}`,
      macros,
      ...(dpcm === null ? {} : { dpcm }),
    })
  }
  return out
}

function parseDpcm(
  input: unknown,
  path: string,
  sampleCount: number,
  d: Diagnostics,
): Readonly<Record<string, DpcmAssignment>> | null {
  if (input === undefined) return null
  if (!isObject(input)) {
    d.error(path, 'not an object')
    return null
  }
  const out: Record<string, DpcmAssignment> = {}
  for (const key of Object.keys(input)) {
    const a = input[key]
    const where = `${path}["${key}"]`
    // A JSON object key is ALWAYS a string, so this must parse the string — `int()`
    // takes the `number` branch and would reject every well-formed key map.
    const note = /^\d+$/.test(key) ? Number.parseInt(key, 10) : -1
    if (!inRange(note, MIN_NOTE, MAX_NOTE)) {
      d.error(where, `key ${json(key)} is not a note number in ${MIN_NOTE}..${MAX_NOTE}`)
      continue
    }
    if (!isObject(a)) {
      d.error(where, 'expected {sample, pitch, loop}')
      continue
    }
    const sample = int(a.sample, -1)
    const pitch = int(a.pitch, 0)
    if (sample < 0 || sample >= sampleCount) {
      d.error(`${where}.sample`, `references sample ${sample}, but only ${sampleCount} exist`)
      continue
    }
    if (!inRange(pitch, 0, 15)) d.error(`${where}.pitch`, `${pitch} outside 0..15`)
    const assignment: { sample: number; pitch: number; loop: boolean; delta?: number } = {
      sample,
      pitch,
      loop: a.loop === true,
    }
    if (a.delta !== undefined) {
      const delta = int(a.delta, 0)
      if (!inRange(delta, 0, 127)) d.error(`${where}.delta`, `${delta} outside 0..127`)
      else assignment.delta = delta
    }
    out[String(note)] = assignment as DpcmAssignment
  }
  return out
}

function parseSamples(input: unknown, d: Diagnostics): readonly DpcmSample[] {
  if (input === undefined) return []
  if (!Array.isArray(input)) {
    d.error('samples', 'not an array')
    return []
  }
  const out: DpcmSample[] = []
  for (let i = 0; i < input.length; i++) {
    const s = input[i]
    if (!isObject(s) || typeof s.data !== 'string') {
      d.error(`samples[${i}]`, 'expected {name, data} with base64 data')
      continue
    }
    const bytes = decodeBase64(s.data)
    if (bytes === null) {
      d.error(`samples[${i}].data`, 'not valid base64')
      continue
    }
    if (bytes.length % 16 !== 1) {
      d.error(`samples[${i}].data`, `decoded length ${bytes.length} is not 16n + 1 — DMC samples are 16n+1 bytes`)
    }
    out.push({ name: typeof s.name === 'string' ? s.name : `sample ${i}`, data: s.data })
  }
  return out
}

// --- serialize -------------------------------------------------------------------------

/** Byte-stable: key order is the declaration order of §1.2, two-space indent, patterns
 *  sorted by (channel, index), rows sorted by `r`, `fx` trailing nulls omitted, no
 *  trailing whitespace, file ends with a newline. `parse ∘ serialize ∘ parse` is the
 *  identity, which `trackerFormat.test.ts` asserts over every fixture. */
function sortPatterns(patterns: readonly Pattern[]): readonly Pattern[] {
  return [...patterns].sort((a, b) => {
    const ca = CANONICAL_CHANNELS.indexOf(a.channel)
    const cb = CANONICAL_CHANNELS.indexOf(b.channel)
    return ca !== cb ? ca - cb : a.index - b.index
  })
}

export function serializeSong(song: Song): string {
  const patterns = sortPatterns(song.patterns)
  const doc: Record<string, unknown> = {
    format: song.format,
    version: song.version,
    meta: {
      name: song.meta.name,
      author: song.meta.author,
      engineSpeed: song.meta.engineSpeed,
      tempo: song.meta.tempo,
      speed: song.meta.speed,
      rowsPerPattern: song.meta.rowsPerPattern,
      rowHighlight: song.meta.rowHighlight,
      rowHighlight2: song.meta.rowHighlight2,
      region: song.meta.region,
      speedSplitPoint: song.meta.speedSplitPoint,
      evenTempo: song.meta.evenTempo,
    },
    channels: song.channels,
    effectColumns: song.effectColumns,
    order: song.order,
    patterns: patterns.map((p) => ({
      channel: p.channel,
      index: p.index,
      rows: [...p.rows]
        .sort((a, b) => a.r - b.r)
        .map((cell) => {
          const out: Record<string, unknown> = { r: cell.r }
          if (cell.note !== undefined) out.note = cell.note
          if (cell.inst !== undefined) out.inst = cell.inst
          if (cell.vol !== undefined) out.vol = cell.vol
          const fx = trimFx(cell.fx)
          if (fx !== null) out.fx = fx
          return out
        }),
    })),
    instruments: song.instruments.map((inst) => {
      const out: Record<string, unknown> = {
        name: inst.name,
        macros: {
          volume: inst.macros.volume,
          arpeggio: inst.macros.arpeggio,
          pitch: inst.macros.pitch,
          hiPitch: inst.macros.hiPitch,
          duty: inst.macros.duty,
        },
      }
      if (inst.dpcm !== undefined) out.dpcm = inst.dpcm
      return out
    }),
    sequences: {
      volume: serializeBank(song.sequences.volume),
      arpeggio: serializeBank(song.sequences.arpeggio),
      pitch: serializeBank(song.sequences.pitch),
      hiPitch: serializeBank(song.sequences.hiPitch),
      duty: serializeBank(song.sequences.duty),
    },
    samples: song.samples.map((s) => ({ name: s.name, data: s.data })),
  }
  if (song.extra !== undefined) doc.extra = song.extra
  return `${JSON.stringify(doc, null, 2)}\n`
}

function serializeBank(seqs: readonly Sequence[]): unknown[] {
  return seqs.map((s) => {
    const out: Record<string, unknown> = { values: s.values, loop: s.loop, release: s.release }
    if (s.mode !== undefined) out.mode = s.mode
    return out
  })
}

/** Trailing nulls are omitted on write and tolerated on read (§1.3). */
function trimFx(fx: readonly (Effect | null)[] | undefined): unknown[] | null {
  if (fx === undefined) return null
  let end = fx.length
  while (end > 0 && fx[end - 1] === null) end--
  if (end === 0) return null
  const out: unknown[] = []
  for (let i = 0; i < end; i++) {
    const e = fx[i]
    out.push(e === null ? null : { cmd: e.cmd, param: e.param })
  }
  return out
}
