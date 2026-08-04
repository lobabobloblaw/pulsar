/** pulsar song model — JSON project format v1 (phase-2 design §1.2).
 *
 *  This file is the CONTRACT. WP10 (the grid) and WP11 (the presets) code against it,
 *  and the driver, the validator and the command stack all read exactly these shapes.
 *  Every field is `readonly`: edits go through `commands.ts`, which produces a NEW
 *  document structurally shared with the old one, which is what makes undo cheap.
 *
 *  The design notes that matter, restated because they are the ones that get broken:
 *    - rows are SPARSE (`Cell[]` with an explicit `r`), sorted ascending, unique
 *    - patterns are PER-CHANNEL and carry their `channel`
 *    - `inst`/`vol` absent means "unchanged", NEVER 0 — the validator rejects `null`
 *    - effect commands are stored as the CHARACTER the user types, not an enum
 *    - sequences are shared BY INDEX across instruments (FamiTracker's own model)
 *    - `extra` is round-tripped verbatim and never interpreted
 *
 *  DOM-free on purpose: this module typechecks under tsconfig.test.json and could move
 *  to a worker unchanged.
 */

/** Bumped only on a breaking change. A loader that sees a higher major refuses. */
export const SONG_FORMAT_VERSION = 1 as const

export type ChannelId = 'pulse1' | 'pulse2' | 'triangle' | 'noise' | 'dpcm'
export type Region = 'ntsc' | 'pal'

/** The canonical lane order. `channels` must be a PREFIX of this. */
export const CANONICAL_CHANNELS: readonly ChannelId[] = [
  'pulse1',
  'pulse2',
  'triangle',
  'noise',
  'dpcm',
]

/** MIDI note number, 0..119 (c-1..b8). Two sentinels share the space, out of band. */
export type NoteValue = number
export const NOTE_CUT = -1 // '---'  hard cut: channel off this tick
export const NOTE_RELEASE = -2 // '==='  release: macros jump to their release point
/** absence of a note in a cell is `undefined`, never 0 — 0 is a real note (c-1) */

/** Sentinel used by the COMPILED (dense) representation only, never on disk: the
 *  sparse JSON model expresses "no note" as an absent key. */
export const NOTE_NONE = -128

/** One effect column. `fx` is a fixed-length tuple of up to 4, holes are null. */
export interface Effect {
  /** Single uppercase command char: '0'..'9','A'..'Z'. Stored as the char, not a
   *  number, because that is what the user types and what FamiTracker text uses. */
  readonly cmd: string
  /** 0..255. The two hex digits after the command. */
  readonly param: number
}

export interface Cell {
  /** Row index within the pattern, 0..rowsPerPattern-1. Rows are stored sparsely and
   *  MUST be sorted ascending and unique within a pattern. */
  readonly r: number
  readonly note?: NoteValue
  /** Instrument index into `instruments`. Absent = keep the channel's current one. */
  readonly inst?: number
  /** Volume column, 0..15. Absent = keep the channel's current volume. */
  readonly vol?: number
  /** Up to `effectColumns[channel]` entries; trailing nulls may be omitted. */
  readonly fx?: readonly (Effect | null)[]
}

/** A pattern belongs to exactly one channel — patterns are per-channel in FamiTracker
 *  and mixing them across lanes is the first thing that breaks on import. */
export interface Pattern {
  readonly channel: ChannelId
  /** Stable index; referenced from `order`. */
  readonly index: number
  readonly rows: readonly Cell[]
}

export type MacroKind = 'volume' | 'arpeggio' | 'pitch' | 'hiPitch' | 'duty'

/** The five banks in their canonical order — the order `instruments[].macros` is
 *  written in, the order the driver advances them in (§3.1 step 2c). */
export const MACRO_KINDS: readonly MacroKind[] = [
  'volume',
  'arpeggio',
  'pitch',
  'hiPitch',
  'duty',
]

/** Arpeggio macro interpretation. 'scheme' is 0CC-only and is parsed-but-rejected in
 *  v1 (validator error), so a future phase can accept it without a format bump. */
export type ArpMode = 'absolute' | 'fixed' | 'relative' | 'scheme'

export interface Sequence {
  /** One value per tick. Signed; range depends on kind (§3.4). Max length 253,
   *  FamiTracker's own cap — kept so export stays lossless. */
  readonly values: readonly number[]
  /** Index to jump back to when the sequence runs past its end (or past `release`
   *  while the note is held). −1 = no loop. */
  readonly loop: number
  /** Index of the last sustain step. On note-release playback resumes at
   *  `release + 1`. −1 = no release point (§3.4). */
  readonly release: number
  /** Only meaningful for kind 'arpeggio'. Defaults to 'absolute'. */
  readonly mode?: ArpMode
}

/** FamiTracker's own cap, kept so export stays lossless. */
export const MAX_SEQUENCE_LENGTH = 253

/** Five parallel banks, shared by index across instruments. */
export type SequenceBank = { readonly [K in MacroKind]: readonly Sequence[] }

export interface Instrument {
  readonly name: string
  /** Index into the matching bank, or −1 for "no macro of this kind". */
  readonly macros: { readonly [K in MacroKind]: number }
  /** DPCM key map, sparse: note -> sample assignment. Empty unless the song uses
   *  the dpcm lane. */
  readonly dpcm?: Readonly<Record<string, DpcmAssignment>>
}

export interface DpcmAssignment {
  /** Index into `samples`. */
  readonly sample: number
  /** $4010 rate index 0..15. */
  readonly pitch: number
  readonly loop: boolean
  /** Optional $4011 preload, 0..127. */
  readonly delta?: number
}

export interface DpcmSample {
  readonly name: string
  /** base64 of the raw .dmc bytes. Length must be ≡ 1 (mod 16) after decode. */
  readonly data: string
}

/** One frame of the order list: one pattern index per channel, same length and same
 *  order as `channels`. */
export type Frame = readonly number[]

export interface SongMeta {
  readonly name: string
  readonly author: string
  /** Driver ticks per second. 60 = NTSC default (see D-TK1 for the 60 vs 60.0988
   *  question). Range 1..400 per plan-file §4. */
  readonly engineSpeed: number
  /** FamiTracker tempo, 32..255. */
  readonly tempo: number
  /** FamiTracker speed, 1..31. */
  readonly speed: number
  readonly rowsPerPattern: number // 1..256, default 64
  /** "1st row highlight" — rows per beat. Drives the grid's highlight bands AND the
   *  BPM readout (§2.3). Default 4. */
  readonly rowHighlight: number
  /** Secondary highlight, default 16. Cosmetic only. */
  readonly rowHighlight2: number
  readonly region: Region
  /** Fxx split: param < this sets Speed, >= sets Tempo. Default 0x20. */
  readonly speedSplitPoint: number
  /** true = round ticks-per-row to an integer, killing the 6/7 alternation (§2.3). */
  readonly evenTempo: boolean
}

export interface Song {
  readonly format: 'pulsar-song'
  readonly version: number // SONG_FORMAT_VERSION
  readonly meta: SongMeta
  /** Lane order. v1 writers emit all five; a reader must tolerate a prefix. */
  readonly channels: readonly ChannelId[]
  /** Effect columns visible per channel, 1..4, same length as `channels`. */
  readonly effectColumns: readonly number[]
  readonly order: readonly Frame[]
  readonly patterns: readonly Pattern[]
  readonly instruments: readonly Instrument[]
  readonly sequences: SequenceBank
  readonly samples: readonly DpcmSample[]
  /** Free-form, ignored by the loader, round-tripped verbatim. Preset QA metadata
   *  lives here (§5.5) so it never contaminates the playable model. */
  readonly extra?: Readonly<Record<string, unknown>>
}

// --- bounds the validator, the grid and the driver all share ------------------------

export const MIN_NOTE = 0
export const MAX_NOTE = 119
export const MIN_TEMPO = 32
export const MAX_TEMPO = 255
export const MIN_SPEED = 1
export const MAX_SPEED = 31
export const MIN_ENGINE_SPEED = 1
export const MAX_ENGINE_SPEED = 400
export const MAX_ROWS_PER_PATTERN = 256
export const MAX_EFFECT_COLUMNS = 4
export const DEFAULT_SPEED_SPLIT_POINT = 0x20

/** Effect commands the phase-2 driver implements (§3.2 tier 1 + §3.6 tier 2). An
 *  unknown command is a WARN at load and is ignored by the driver, never a failure. */
export const SUPPORTED_EFFECTS: readonly string[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '7',
  'A',
  'B',
  'C',
  'D',
  'F',
  'G',
  'P',
  'Q',
  'R',
  'S',
  'V',
]

/** Commands the format knows about but this phase does not run: they parse, they
 *  round-trip, they warn, and the driver ignores them (§3.6's deferred list). */
export const RESERVED_EFFECTS: readonly string[] = [
  'E',
  'H',
  'I',
  'J',
  'L',
  'M',
  'O',
  'T',
  'W',
  'X',
  'Y',
  'Z',
]

/** An empty but structurally valid document. Used by the store's initial state, by
 *  the command tests, and as the base every fixture builds on. */
export function emptySong(overrides: Partial<SongMeta> = {}): Song {
  return {
    format: 'pulsar-song',
    version: SONG_FORMAT_VERSION,
    meta: {
      name: 'untitled',
      author: '',
      engineSpeed: 60,
      tempo: 150,
      speed: 6,
      rowsPerPattern: 64,
      rowHighlight: 4,
      rowHighlight2: 16,
      region: 'ntsc',
      speedSplitPoint: DEFAULT_SPEED_SPLIT_POINT,
      evenTempo: false,
      ...overrides,
    },
    channels: CANONICAL_CHANNELS,
    effectColumns: [1, 1, 1, 1, 1],
    order: [[0, 0, 0, 0, 0]],
    patterns: CANONICAL_CHANNELS.map((channel) => ({ channel, index: 0, rows: [] })),
    instruments: [],
    sequences: { volume: [], arpeggio: [], pitch: [], hiPitch: [], duty: [] },
    samples: [],
  }
}
