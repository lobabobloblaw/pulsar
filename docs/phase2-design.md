# phase 2 design — the tracker

Status: **design, execution-ready**. Nothing here is implemented. The sections below
are handed to the implementing agents verbatim (see §6 for the carve).

Phase 1 shipped a register-accurate 2A03 in an AudioWorklet, a SAB/postMessage write
transport, a TE-styled live-play shell, 351 tests. Phase 2 adds the tracker: song model
+ native JSON format, a FamiTracker-exact tick driver, the instrument/macro engine,
Tier-1 and most Tier-2 effects, the pattern editor, step record — plus four shipped
preset tracks (user-requested addition to plan-file's Phase-2 list).

## 0. constraints carried in from phase 1

These are not negotiable and every section below is written to respect them.

| # | constraint | where it bites |
|---|---|---|
| K1 | `src/audio/timeline/types.ts` is **FROZEN**. `WriteSink` is the only interface between a producer and the core | the driver implements nothing new; it calls `write(cycle, addr, value)` |
| K2 | **Exactly one producer per ring**, and the producer must push in **non-decreasing cycle order** (`drainUpTo` stops at the first write past the limit) | §2.1 — the whole threading decision falls out of this |
| K3 | Worklet and `src/audio/core/**` are **untouched**. The driver is host-side | §2 needs zero core changes. Two *narrow additive host* methods are specified in §2.6 and flagged there |
| K4 | Zero new runtime dependencies | nothing in Phase 2 needs one. Hand-written validator, native JSON, no schema lib. Justified in §1.6 |
| K5 | All UI in the existing token system, lowercase, one accent per surface | §4.2 — the grid reads `tokens.css` through `getComputedStyle` once per palette change, it does **not** mirror enclosure colours the way `tokens.ts` mirrors screen colours |
| K6 | Tests follow the existing vitest patterns (`environment: 'node'`, no jsdom), including the `banGates` tripwire | §7. `src/tracker/**` is *not* worklet-reachable, so `banGates` does not widen to it — but the driver's per-tick path keeps the same zero-allocation discipline for its own reasons (§2.7) |
| K7 | `docs/register-timeline.md` gains a **tracker producer** section when WP9 lands | §6, WP9 deliverable list |

Non-goals for Phase 2, stated so nobody drifts into them: VRC6 (Phase 3), WAV export
(Phase 3 — but §5.4's offline renderer is deliberately the same function it will use),
FamiTracker text/FTM import (Phase 4 — but §1 is shaped so that import is a mapping
exercise, not a format migration), PAL playback (§1.5, D-TK5).

---

## 1. song data model + JSON project format v1

### 1.1 shape, in one paragraph

A song is a flat, index-addressed document: `channels` names the lanes in order;
`patterns` is a sparse map from `"channel:index"` to a **sparse row list** (only
non-empty rows are stored, each `{ r, note?, inst?, vol?, fx? }`); `order` is an array
of frames, each frame an array of pattern indices, one per channel; `instruments` is an
array of `{name, macros:{volume,arpeggio,pitch,hiPitch,duty}}` where every macro field
is an **index into a shared `sequences` bank** (−1 = none), exactly matching
FamiTracker's shared-by-index model; `sequences` is five parallel arrays of
`{values, loop, release, mode?}`. Everything else is metadata (`name`, `author`,
`engineSpeed`, `tempo`, `speed`, `rowsPerPattern`, `rowHighlight`, `region`,
`speedSplitPoint`, `evenTempo`). Sparse rows and shared sequences are what make the
format hand-authorable: a 64-row pattern with four notes is four lines of JSON.

### 1.2 complete TypeScript types

Ships as `src/tracker/model/types.ts`. Every field is `readonly` — edits go through the
command layer (§4.6), which produces new documents structurally shared with the old.

```ts
/** Bumped only on a breaking change. A loader that sees a higher major refuses. */
export const SONG_FORMAT_VERSION = 1 as const

export type ChannelId = 'pulse1' | 'pulse2' | 'triangle' | 'noise' | 'dpcm'
export type Region = 'ntsc' | 'pal'

/** MIDI note number, 0..119 (c-1..b8). Two sentinels share the space, out of band. */
export type NoteValue = number
export const NOTE_CUT = -1      // '---'  hard cut: channel off this tick
export const NOTE_RELEASE = -2  // '==='  release: macros jump to their release point
/** absence of a note in a cell is `undefined`, never 0 — 0 is a real note (c-1) */

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
  readonly rowsPerPattern: number   // 1..256, default 64
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
  readonly version: number            // SONG_FORMAT_VERSION
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
```

Design notes, each load-bearing:

- **Sparse rows** (`Cell[]` with an explicit `r`) rather than a dense `rows[64]` of
  nullable cells. A hand-authored pattern is then readable, a 64-row pattern with 4
  notes costs 4 objects, and JSON diffs of an edit are one line. The cost — an index
  lookup per row — is paid once per row boundary (60 times a second at worst), not per
  tick. The driver builds a dense `Int32Array` view per pattern **on load** (§2.7) so
  the hot path never searches.
- **Patterns are per-channel** and carry their `channel`. FamiTracker patterns are
  per-channel; a shared pattern pool would make Phase-4 import lossy.
- **`inst`/`vol` absent ≠ 0.** `undefined` means "unchanged". This is the single
  most common source of tracker-format bugs; the validator rejects `null` for these.
- **Effects are `{cmd, param}` with `cmd` a character.** Storing `'4'`/`'A'` instead of
  an enum makes the JSON readable, makes FamiTracker text import a character copy, and
  makes an unknown effect survive a round-trip (the validator warns, the driver ignores).
- **Sequences shared by index** is plan-file §6's requirement, and it is why `sequences`
  is a bank rather than being inlined into instruments.
- **`extra`** is round-tripped verbatim so preset QA metadata, editor scroll position,
  or a future annotation cannot force a version bump.

### 1.3 the JSON on disk

Same shape, no transformation — the file **is** `Song` serialized. Two authoring
affordances the writer applies and the reader tolerates either way:

1. **`fx` trailing nulls are omitted.** `"fx": [{"cmd":"0","param":55}]` and
   `"fx": [{"cmd":"0","param":55}, null, null, null]` parse identically.
2. **Numbers are decimal.** Effect params are hex *in the UI* and decimal *on disk* —
   one representation in the file, one conversion at the edge, and no `"0x"` string
   parsing in the loader. The preset authoring guide (§5.3) says so in bold, because it
   is the mistake an authoring agent will make.

Serializer rules (so a round-trip is byte-stable and diffs stay small): key order is the
declaration order above; two-space indent; patterns sorted by `(channel, index)`; rows
sorted by `r`; no trailing whitespace; file ends with a newline.

### 1.4 worked example — `tests/fixtures/songs/tiny.json`

Eight rows, two channels used, one instrument with a 5-step volume macro that loops on
its last value, one arpeggio effect, one order jump. This is the fixture the round-trip
and driver tests run against, and it is the shape a preset-authoring agent copies.

```json
{
  "format": "pulsar-song",
  "version": 1,
  "meta": {
    "name": "tiny",
    "author": "pulsar",
    "engineSpeed": 60,
    "tempo": 150,
    "speed": 6,
    "rowsPerPattern": 8,
    "rowHighlight": 4,
    "rowHighlight2": 16,
    "region": "ntsc",
    "speedSplitPoint": 32,
    "evenTempo": false
  },
  "channels": ["pulse1", "pulse2", "triangle", "noise", "dpcm"],
  "effectColumns": [1, 1, 1, 1, 1],
  "order": [
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0]
  ],
  "patterns": [
    {
      "channel": "pulse1",
      "index": 0,
      "rows": [
        { "r": 0, "note": 60, "inst": 0, "vol": 15 },
        { "r": 2, "note": 64 },
        { "r": 4, "note": 67, "fx": [{ "cmd": "0", "param": 71 }] },
        { "r": 6, "note": -1 }
      ]
    },
    {
      "channel": "pulse1",
      "index": 1,
      "rows": [
        { "r": 0, "note": 72, "vol": 10 },
        { "r": 4, "note": -2 },
        { "r": 7, "fx": [{ "cmd": "B", "param": 0 }] }
      ]
    },
    {
      "channel": "triangle",
      "index": 0,
      "rows": [
        { "r": 0, "note": 36, "inst": 0 },
        { "r": 4, "note": 43 }
      ]
    },
    { "channel": "pulse2", "index": 0, "rows": [] },
    { "channel": "noise", "index": 0, "rows": [] },
    { "channel": "dpcm", "index": 0, "rows": [] }
  ],
  "instruments": [
    {
      "name": "lead",
      "macros": { "volume": 0, "arpeggio": -1, "pitch": -1, "hiPitch": -1, "duty": 0 }
    }
  ],
  "sequences": {
    "volume": [{ "values": [15, 13, 11, 9, 8], "loop": 4, "release": -1 }],
    "arpeggio": [],
    "pitch": [],
    "hiPitch": [],
    "duty": [{ "values": [2, 2, 1, 1], "loop": 2, "release": -1 }]
  },
  "samples": [],
  "extra": { "notes": "param 71 = 0x47 = arpeggio +4/+7 = major triad" }
}
```

Reading it: 8 rows/pattern at speed 6, tempo 150, engine 60 → 6 ticks/row → 8 rows =
48 ticks = 0.8 s per frame. Frame 0 plays pulse1 pattern 0 (c4, e4, g4 with a major-triad
arpeggio on the g4, then a hard cut) over a triangle bass. Frame 1 plays pulse1 pattern 1
(c5, released at row 4 — the instrument's volume sequence has no release point, so per
§3.4 the release degrades to a cut) and jumps back to frame 0 with `B00`.

Note the arpeggio param: the user types `047` in the grid, the file stores `71`. **This is
the decimal/hex seam and it is the mistake a preset author will make** (§5.3, rule 2) —
which is why the example carries its own reminder inside `extra`. Anything under `extra`
is round-tripped verbatim and never interpreted; an unknown **top-level** key, by
contrast, is warned about and dropped, never a load failure. Those two rules together are
the forward-compatibility hinge for Phase-4 import.

### 1.5 validation

`src/tracker/model/validate.ts`, hand-written, ~180 lines, no dependency (K4). Signature:

```ts
export interface Diagnostic { path: string; message: string; severity: 'error' | 'warn' }
export function parseSong(input: unknown): { song: Song; diagnostics: Diagnostic[] }
// throws SongFormatError (carrying all `error` diagnostics) if any error is present
export function serializeSong(song: Song): string
```

Errors (refuse to load): wrong `format`; `version` major > 1; `channels` not a prefix of
the canonical five; `order` frame length ≠ `channels.length`; a frame referencing a
missing pattern; a pattern whose `channel` is not in `channels`; rows out of range,
unsorted, or duplicated; `note` outside `-2..119`; `inst`/`vol`/`fx.param` out of range;
a macro index with no sequence behind it; `loop`/`release` outside `-1..values.length-1`;
`arpMode === 'scheme'`; `speed` outside 1..31; `tempo` outside 32..255; `engineSpeed`
outside 1..400; base64 sample whose decoded length is not `16n + 1`.

Warnings (load anyway, surface in the UI and in preset QA): unknown top-level key;
unknown effect command; an effect column index beyond `effectColumns[ch]`; a pattern
never referenced by the order list; an instrument never referenced; `region: 'pal'`
(**D-TK5** — v1 plays PAL songs at the NTSC rate because the worklet hardcodes NTSC and
K3 forbids changing it; the field is stored and round-tripped so Phase 3 can honour it).

### 1.6 why no schema library

`zod`/`valibot` would be ~12 KB gzipped of runtime for a document we parse at most a few
times per session, and the error messages we want ("pattern 3 row 7 references
instrument 2, which does not exist") are domain messages a generic validator cannot
produce. The hand-written validator is smaller than the dependency and its output feeds
the preset QA lint (§5.5) directly. K4 holds: **Phase 2 adds zero runtime dependencies.**

### 1.7 forward compatibility with FamiTracker text import (phase 4)

The mapping is deliberately mechanical, and the format above was chosen to keep it that
way: FamiTracker text `ORDER`/`PATTERN`/`ROW` lines map to `order`/`patterns`/`rows`
one-for-one; `MACRO <kind> <index> <loop> <release> <setting> : values` maps to
`sequences[kind][index]` with `setting` → `mode`; `INST2A03 <i> <vol> <arp> <pit> <hpi>
<dty> "name"` maps to `instruments[i].macros`. The three things that would have made
import lossy and are therefore designed out: shared cross-channel patterns (we keep them
per-channel), effect commands stored as an enum (we keep the character), and dropping
unknown keys (we round-trip them via `extra`).

---

## 2. the driver — a tick scheduler producing (cycle, addr, value)

### 2.1 threading: **main thread, single producer object** — decided

The ring allows exactly one producer (K2). Three candidates were on the table.

| option | what breaks |
|---|---|
| worker owns the ring, live events forwarded to it | Genuinely correct, and what plan B6 sketched. Costs: the `ClockAnchor` must be re-published to a third thread; the SAB is already allocated by the host, so the host would have to hand it over and then *never* touch it, which means `EngineHandle.write()` (used by knobs, `setConfig`, `allNotesOff`) has to be re-plumbed through the worker; live-play latency gains a `postMessage` hop (~1–3 ms plus scheduling); the postMessage transport fallback has no worker path at all and would need a second design. Three new failure modes to buy jitter resistance the numbers below say we do not need |
| two producers (LiveScheduler + driver) pushing the same ring | Violates K2 outright, and not academically: the drain **stops at the first write past the limit**, so one far-future tracker write parks every live write queued behind it until that cycle arrives. Silent, and it looks like "MIDI stopped working" |
| **main thread, one producer object, one owner at a time** | **chosen** |

**The decision.** `EngineHandle` remains the one and only `RingProducer` owner, exactly
as in Phase 1. `TrackerDriver` and `LiveScheduler` are both *callers* of it, on the same
thread, and a `PlaybackCoordinator` guarantees only one of them is writing during any
interval. Two call sites on one thread are not two producers — the SPSC hazard the rule
exists to prevent is *concurrent* writers, which a single thread cannot produce. What the
rule genuinely still demands is **non-decreasing cycle order**, and §2.6 buys that with an
explicit handoff rather than with a merge buffer.

Why main-thread survives, in numbers:

- Ring capacity 4096 slots ≈ **320 ms** of transport slack (`docs/register-timeline.md`),
  and the ring is only ever occupied by *lookahead* worth of writes, not by the whole song.
- Worst-case write rate: 5 channels × 4 registers + one `$4015` ≈ **21 writes/tick**, and
  that is a pathological tick where every channel retriggers. A realistic tick is 3–8.
  At `engineSpeed` 60 that is ≤ 1 260 writes/s.
- The driver's per-tick cost is a few hundred arithmetic ops across 5 channels. Generating
  a 120 ms lookahead block is ~7 ticks — microseconds. This is not the work that janks a
  main thread; the pattern grid is, and §4.3 keeps that to a dirty-flag repaint.
- The failure mode is bounded and honest: if the main thread stalls past the lookahead,
  the writes land late, `Apu2A03` **clamps them to now and counts them** (never drops,
  never reorders), and because tick→cycle is an absolute function of the tick index (§2.2)
  the driver *cannot drift* — it emits a short burst and is immediately back in phase. A
  stall is a stutter, never a tempo error.

If profiling ever contradicts this, the escalation is written down and cheap: move
`TrackerDriver` into a worker **and move `LiveScheduler` with it**, so the worker becomes
the sole producer as B6 anticipated. The driver is designed to make that possible — it
holds no DOM types, takes its clock through an injected interface, and its only
environment coupling is the pump (§2.5).

### 2.2 tick → cycle, drift-free

```ts
/** Cycle of the driver's tick `n`, counted from the driver's own origin.
 *  Closed form, not an accumulator: the value depends only on `n`, so no amount of
 *  arithmetic history can make it drift. */
cycleOfTick(n) = originCycle + Math.floor((n * clockRate) / engineHz)
```

- `clockRate` = 1 789 773 (NTSC), `engineHz` = `meta.engineSpeed` (60 default).
- Exactness: an hour at 60 Hz is 216 000 ticks; `n * clockRate` = 3.87e11, exact in a
  double (< 2^53) by a factor of ~23 000. Ten hours at `engineSpeed` 400 gives 2.6e13 —
  still exact. **Assert this**: `cycleOfTick` is exact for all `n ≤ 5e9 / clockRate`.
- No `|0`, `<<`, `>>`, `&` anywhere near a cycle value (Phase-1 standing rule).
- Tick spacing at NTSC/60 alternates 29 829 / 29 830 cycles (1 789 773 / 60 = 29 829.55).
  That alternation is *correct* and is asserted, not smoothed.

**D-TK1 (deviation, new).** Pulsar ticks at exactly `engineSpeed` Hz — 60.000 Hz, not the
console's 60.0988 Hz vblank rate. Consequence: playback is 0.16 % slower than an NES.
Rationale: plan-file §4 defines the tempo model with `EngineSpeed = 60` and the whole
`2.5·E·S/T` formula is stated against that integer; matching the formula exactly is worth
more than matching an emulator's frame rate, and 0.16 % is 2.8 cents of tempo. An override
(`meta.engineSpeed: 60.0988` is *legal* — the field is a number, not an enum) exists for
anyone doing a reference comparison.

### 2.3 rows: ticks-per-row, the 6/7 alternation, and even tempo

`ticksPerRow = 2.5 · E · S / T` (plan-file §4). Kept as an exact integer ratio:

```ts
const num = 5 * engineSpeed * speed   // = 2·(2.5·E·S)
const den = 2 * tempo                 //   both integers, no floats anywhere
// ticksPerRow === num / den
```

Row advance is a Bresenham accumulator over ticks, evaluated **at the end of every tick**:

```ts
// rowAccum: integer, invariant 0 <= rowAccum < num
rowAccum += den
while (rowAccum >= num) { rowAccum -= num; advanceRow() }
```

Worked, `E=60, S=6, T=150`: `num=1800, den=300` → the accumulator hits 1800 on exactly
tick 6, every row, carry 0. **6 ticks/row, no alternation** — the canonical case, and the
first unit test.

**Worked, `E=60, S=6, T=160` — the validation vector.** FamiTracker's own documentation
gives tempo 160 as expanding to `F06 F06 F05 F06 F06 F05 F06 F05` (45 ticks over 8 rows =
5.625 = 2.5·60·6/160). Running the accumulator above with `num=1800, den=320` produces
row lengths **6, 6, 5, 6, 6, 5, 6, 5** and returns `rowAccum` to 0 after 8 rows —
character for character the documented sequence. **This is the headline tempo test**
(`trackerTempo.test.ts`) and it is what makes the Bresenham form defensible: FamiTracker's
literal internal accumulator is not published anywhere licence-safe, but its *observable
output* is, and ours reproduces it exactly.

Worked, `E=60, S=6, T=140` (`ticksPerRow = 6.4286`): `num=1800, den=280` → **7, 6, 6, 7, 6,
7, 6, 6, 7, …**, average 6.4286. The test asserts the first 24 row lengths as a literal
array *and* that `sum(first 700 rows) === Math.round(700 * 1800 / 280)` (the accumulator
can never drift).

Note the documented identity behind the even case: `ticksPerRow` is an exact integer
**iff `tempo === 2.5 · engineSpeed`** — hence NTSC's default 150 (= 2.5·60) and PAL's 125
(= 2.5·50). "Keep tempo at 150 and change only speed" is therefore the authored-music
discipline that avoids alternation without any mode switch, and §5.3 tells preset authors
exactly that.

Rules around it:

- The accumulator **carries across rows, across patterns, across order jumps, and across
  `Fxx`**. It is reset only by `stop` and by `play from row`. Resetting it on a jump is
  the classic wrong implementation and is called out here because it looks harmless.
- `Fxx` mid-song changes `num` (speed) or `den` (tempo); `rowAccum` keeps its residue. If
  the new `num` is smaller than the residue, the `while` loop emits the backlog rows
  immediately — which is what the hardware driver does and what makes `F01` feel instant.
- **`meta.evenTempo: true`** replaces the accumulator with a fixed
  `ticksPerRow = max(1, Math.round(num / den))`. Document in the UI that this changes the
  tempo slightly (6.43 → 6 is +7 %); it is a musical convenience, not an accuracy mode.
  (For reference: FamiStudio solves the same problem differently, with an explicit
  user-placed "groove" and a padding-position setting, and 0CC exposes grooves via `Oxx`.
  Both are richer than a rounding toggle and both are out of scope for Phase 2; `evenTempo`
  is a boolean so that adding a groove table later is additive, not a format break.)
- **BPM readout**: `bpm = 60 * engineHz / (ticksPerRow * rowHighlight)`. Substituting
  `ticksPerRow = 2.5·E·S/T` gives `bpm = 24·T / (S · rowHighlight)` — E cancels, which is
  why plan-file's two formulas agree. Both forms are asserted in one test so a future
  edit cannot break them apart.

### 2.4 the driver's interface

`src/tracker/driver/trackerDriver.ts`. No DOM, no AudioContext, no Svelte — it is
constructed with a `WriteSink` and a clock, which is what lets the same object drive live
playback, the offline renderer (§5.4) and every unit test.

```ts
export interface DriverClock {
  readonly clockRate: number
  /** Current position on the engine timeline. Offline renderers return their own. */
  nowCycle(): NesCycle
}

export interface DriverPosition {
  readonly playing: boolean
  readonly orderIndex: number
  readonly row: number
  readonly tick: number          // tick within the row
  readonly tickIndex: number     // absolute, since play start
  readonly bpm: number
  /** Per-channel 0..15 composed volume, for the grid's channel meters. */
  readonly levels: Int32Array
}

export class TrackerDriver {
  constructor(sink: WriteSink, clock: DriverClock, opts?: { song?: Song })
  loadSong(song: Song): void          // rebuilds dense pattern views + DPCM image
  play(mode: PlayMode, from?: { order: number; row: number }): void
  stop(): void
  /** Generate every tick whose cycle is <= horizonCycle. Idempotent and resumable:
   *  called once per pump, and repeatedly by the offline renderer. */
  runTo(horizonCycle: NesCycle): void
  /** Live input while playing (§2.6). Channel = the editor's cursor channel. */
  liveNoteOn(channel: number, note: number, velocity: number): void
  liveNoteOff(channel: number, note: number): void
  /** Read in rAF. A plain mutable object, deliberately NOT $state. */
  readonly position: DriverPosition
  readonly stats: DriverStats     // {ticksGenerated, writesEmitted, lateTicks, rowsPlayed}
  setChannelMute(channel: number, muted: boolean): void
  setSoloChannel(channel: number | -1): void
}

export type PlayMode = 'song' | 'pattern' | 'row'   // 'pattern' loops the current frame
```

### 2.5 the pump, the lookahead window, and backpressure

```
setInterval(pump, PUMP_MS) →  driver.runTo(engine.nowCycle() + lookaheadCycles)
                              engine.flush()          // no-op on the SAB path
```

| state | `PUMP_MS` | lookahead | why |
|---|---|---|---|
| visible, playing | 20 ms | **120 ms** | 6× the pump; survives a 100 ms layout stall; live-input latency during playback (§2.6) stays at a tracker-normal 120 ms |
| hidden (`visibilitychange`) | 250 ms | **min(1500 ms, 3000 / (21 · engineHz) s)** | Chrome aligns background timers to ~1 Hz for non-audible pages; audible pages are exempt, but we do not *rely* on the exemption. Nobody is playing live into a hidden tab, so a long lookahead is free |
| stopped | timer not running | — | zero cost when idle; `LiveScheduler` owns the timeline (§2.6) |

The hidden-state cap is the ring-occupancy bound made explicit: at 21 writes/tick worst
case, `lookahead_s · engineHz · 21` must stay under ~3 000 of the ring's 4 096 slots. At
`engineHz = 60` the cap is 2.38 s so 1 500 ms wins; at `engineHz = 400` the cap is 357 ms.
Encode it as a function, not a constant, and unit-test the bound at E = 60, 120, 240, 400.

`requestAnimationFrame` is **not** the pump: it stops entirely in a hidden tab, and it ties
the audio timeline to the display refresh rate. The existing frame bus stays what it is —
a *rendering* clock. The driver publishes `position` as a plain object that the grid reads
during rAF; the driver never writes `$state` (Phase-1 rule, §4.3).

Backpressure and diagnostics: after each pump the coordinator reads
`engine.diagnostics().droppedWrites`. Any increase is a hard bug (the ring should never
fill at these rates) and is surfaced, not swallowed — see §7's `drop` chip.

### 2.6 playback state machine, and how live play coexists

**Rule L — exactly one producer owns the timeline at a time.** Stated as the whole rule,
because half of it is what people get wrong:

- **stopped** → `LiveScheduler` owns the timeline. Behaviour is *bit-identical to
  Phase 1*: 3–25 ms adaptive lead, monotonic clamp, canonical note-on. The instrument the
  user judges latency by does not get slower because a tracker was added.
- **playing** → `TrackerDriver` owns the timeline. `bridge.noteOn/noteOff` are routed to
  `driver.liveNoteOn/liveNoteOff` instead of to the scheduler. The driver plays the live
  note on the **editor's cursor channel**, stealing it from the song for as long as the key
  is held: that channel's pattern data is suppressed, its macros and effects freeze, and it
  resumes from the song at the first row boundary after release.
- Parameter changes (`setParam`) during playback are applied to the driver's per-channel
  base state and take effect at its next generated tick.
- Live latency during playback is the current lookahead (120 ms). The UI says so, in the
  existing chip vocabulary, rather than pretending otherwise.

Why cursor-channel stealing and not "play on a free channel": the driver would have to know
which channels are idle *in the future* (it only knows the current row), and "free" flips
the moment the song's next row wants the lane back — producing a note that dies for reasons
the player cannot see. Stealing the cursor channel is what FamiTracker does, it is
predictable, and the cursor is already the user's statement of intent.

**Step record keeps real timestamps.** The audible feedback is late by the lookahead, but
the *recorded row* is computed from the input event's own `engine.nowCycle()` at the moment
the key went down, mapped back through `cycleOfTick`. Quantization is therefore unaffected
by the lookahead — the note lands on the row the player heard themselves play.

**The handoff** — this is where K2's ordering requirement is actually discharged:

```
play():
  1. liveScheduler.allNotesOff()                    // writes at now+lead
  2. const start = Math.max(engine.nowCycle() + msToCycles(clockRate, START_LATENCY_MS),
                            liveScheduler.lastScheduledCycle + 1)
  3. liveScheduler.reset(start)                     // ← additive host API, below
  4. driver.play(mode, from); driver.originCycle = start
  5. driver.runTo(start + lookahead); engine.flush(); start the pump timer
stop():
  1. stop the pump; driver.stop() emits its final all-channels-off writes at horizon H
  2. liveScheduler.reset(H + 1)                     // its monotonic clamp resumes from H
```

`START_LATENCY_MS` = 40. Playback also **awaits `engine.ready()`** before step 2 — the
known Phase-1 polish item "notes pressed during the ~100 ms engine start are dropped"
becomes load-bearing the moment a user hits play on a cold page.

**Narrow additive host APIs (K3 — no core change, host-side only, flagged loudly):**

1. `LiveScheduler.reset(cycle: NesCycle): void` — clears `enableMask`, `soundingNote` and
   the held stack and sets `lastCycle = cycle`, **without emitting any writes**. Needed so
   the two owners cannot both believe they own the `$4015` byte, and so the monotonic clamp
   survives the handoff. ~6 lines in `src/audio/host/liveScheduler.ts`.
2. `EngineHandle.pending: number` — forwards `RingProducer.pending`, `0` on the postMessage
   path. Diagnostic only. ~3 lines in `src/audio/host/audioEngine.ts`.

**No change to `src/audio/core/**`, `src/audio/worklet/**`, `src/audio/timeline/types.ts`,
`src/audio/protocol/**` is required or permitted.** If an implementer believes otherwise,
they stop and escalate rather than editing.

### 2.7 inside `runTo` — the per-tick loop

```
runTo(horizon):
  while (cycleOfTick(nextTick) <= horizon && playing):
    const c = cycleOfTick(nextTick)
    if (isRowBoundary) latchRow(c)          // §3.1 step 1
    for (ch = 0; ch < channelCount; ch++) tickChannel(ch, c)   // §3.1 steps 2a–2f
    endOfTick(c)                            // §3.1 step 3: flow effects, row accumulator
    nextTick++
```

Two disciplines that are not optional:

- **Write-on-change.** Each channel holds `lastBytes[8]` (the register image it last
  emitted). A tick emits a write **only** when the computed byte differs. This is what
  keeps the write rate at 3–8/tick instead of 21, and more importantly it is what stops
  `$4003` being written every tick — writing it resets the duty sequencer and restarts the
  envelope, which would turn every sustained note into a 60 Hz buzz. The one exception is a
  note trigger, which emits the **full canonical sequence** from
  `docs/register-timeline.md` unconditionally (that is the point of a trigger).
- **Zero allocation per tick.** Not because the driver is on the audio thread (it is not),
  but because it runs 60–400 times a second underneath a canvas repaint, and a GC pause
  here is exactly the stall the lookahead exists to absorb. Per-channel state lives in
  preallocated typed arrays; patterns are compiled on load into a dense
  `Int32Array` per (pattern, row) — 6 lanes (note, inst, vol, fx0..fx3 packed as
  `cmdIndex << 8 | param`) — so a row read is an offset, never a search or an object.

### 2.8 registers the driver writes

Reuses `docs/register-timeline.md`'s canonical per-channel orders verbatim. The driver's
standing register conventions, chosen once:

- **Pulse/noise run with `L = 1` (length halt) and `C = 1` (constant volume).** Note
  duration is the driver's business — note-off, `Sxx`, and the volume macro decide it, not
  the length counter. Same choice FamiTracker makes.
- **Triangle runs with `$4008` bit 7 set (linear counter hold)** while sounding. A composed
  volume of 0 on triangle writes `$4008 = 0x00`, which halts the sequencer **in phase**
  holding its DAC value (the Phase-1 acceptance behaviour) rather than clearing `$4015` —
  this is how a volume macro gates the triangle, which is the NES idiom for triangle
  "envelopes".
- **Duty writes never reset phase**: duty changes go out as `$4000`/`$4004` alone, exactly
  as `writePulseControl` already does. A duty macro stepping every tick must not click.
- **`$4015` is written as a whole byte, never a single bit**, and the driver owns the byte
  for the whole of playback (Rule L). A channel with no sounding note has its bit clear.
- **Timer high (`$4003`/`$4007`/`$400B`) is written only when the high 3 bits change or a
  trigger occurs.** **D-TK2 (deviation, new):** a pitch slide crossing a high-byte boundary
  therefore resets the pulse duty phase, producing the same tiny click a real tracker on
  real hardware produces. We do not work around it; the alternative (never writing the high
  byte) would cap slides at 256 timer units.

---

## 3. macro + effect engine semantics

**Source discipline.** plan-file §5/§6; the **official FamiTracker CHM help manual**
(shipped documentation, mirrored as HTML at `github.com/HertzDevil/famitracker-all/hlp/*`
— `effect_list.htm`, `instruments.htm`, `properties.htm`, `speed.htm`); FamiStudio's
public docs (`famistudio.org/doc/{song,pianoroll,instruments}`, MIT project); the 0CC
readme/changelog for what is *not* ours to implement; NESdev forum threads for
reconstructions. **No FamiTracker, 0CC, Dn or Furnace source was read, and none is to be
read** — they are GPL and the project's licensing posture depends on that line holding.

Note for implementers: `famitracker.com` (wiki + forum) was unreachable during this
research (broken TLS, refused connections) and `famitracker.org` does not resolve. Facts
sourced only from search-engine snippets of that wiki are marked **[snippet]**; facts we
chose ourselves because no licence-safe source documents them are marked **[ours]**. Every
**[snippet]** and **[ours]** item carries a unit test that pins our behaviour so it cannot
drift silently, and the doc says which is which so a future contributor with a working
wiki knows exactly where to check.

### 3.1 per-tick evaluation order

**No published document states this order end to end** — not the official manual, not
FamiStudio's docs, not NESdev. The order below is **[ours]**, assembled from the
individually-documented fragments that constrain it (`Gxx` delays *only* the note trigger
and only on its own channel; `4xy`/`7xy` run off an accumulator that advances every tick
rather than being recomputed per row; `0xy` puts the *unmodified* note on the first of its
three ticks). It is fixed, it is the same for every channel, and it is pinned by tests.

```
1. row boundary only — LATCH
   for each channel, in channel order:
     read the row's cell; update effect memory (§3.5); stash note/inst/vol as PENDING.
     A pending note fires this tick unless Gxx delays it.
     Record row-scope flow effects (Bxx, Cxx, Dxx, Fxx) for step 3.

2. every tick — per channel, in channel order:
   a. DELAYED EVENTS due on this tick fire: Gxx note trigger, Sxx cut.
   b. TRIGGER (if a note fires this tick):
        - hard note   -> reset macro indices to 0, reset arpeggio phase, clear pitch
                         accumulators, set base note, emit the full canonical note-on.
        - note with 3xx / Qxy / Rxy in the same row -> DOES NOT retrigger: it only sets
                         the portamento target. Macros keep running, phase is untouched.
        - instrument change without a note -> swap the macro set, keep the macro indices
                         [ours — pinned by test].
        - NOTE_CUT     -> channel silenced immediately (bit cleared in $4015).
        - NOTE_RELEASE -> macros jump to their release point (§3.4); the channel keeps
                         sounding until a macro drives it to zero or a cut arrives.
   c. MACROS ADVANCE one step each (volume, arpeggio, pitch, hiPitch, duty) and their
      current outputs are read. Tick 0 of a note uses index 0 — the first macro value
      IS applied on the trigger tick.
   d. EFFECTS APPLY, in this order: arpeggio (0xy) -> portamento/slides (1xx/2xx/3xx/
      Qxy/Rxy) -> vibrato (4xy) -> fine pitch (Pxx) -> tremolo (7xy) -> volume slide
      (Axy) -> duty override (Vxx).
   e. COMPOSE
        period = periodFor(baseNote + arpOffset + relArpAccum) + slideAccum
                 + pitchAccum + vibratoOffset + finePitchOffset
        volume = compose(chanVol, macroVol, tremolo)      // §3.3
   f. EMIT register writes for every byte that changed (write-on-change, §2.7), in the
      channel's canonical order.

3. every tick — END OF TICK:
   apply Fxx (immediately), then the row accumulator (§2.3). At a row advance, apply
   Dxx/Bxx/Cxx recorded in step 1 — Bxx sets the frame, Dxx sets the row within the
   next frame, both together mean "frame from Bxx, row from Dxx", Cxx stops.
```

Two ordering facts worth stating because they are the ones that sound wrong when
reversed: **macros advance before effects apply**, so an arpeggio effect offsets a note
the arpeggio *macro* has already displaced; and **per-tick delta effects (1xx, 2xx, 3xx,
Axy, 7xy, Qxy, Rxy) contribute nothing on tick 0 of a row** — the row's own values are
heard first and the slide starts on tick 1. Table-driven effects (0xy, 4xy, Pxx, Vxx)
*do* apply on tick 0. **[ours]** for the tick-0 split; pinned by test.

`Gxx` is explicitly documented as delaying the note trigger **for its own channel only** —
other channels' rows fire on tick 0 as usual, which is what makes `Gxx` a flam tool rather
than a global shuffle.

### 3.2 tier-1 effects, tick by tick

| cmd | semantics |
|---|---|
| `0xy` **arpeggio** | "Changes the pitch of the note every tick, with base + x and base + y semitones. Use 00 to disable." Offset table `[0, x, y]` indexed by `arpStep % 3` where `arpStep` advances **every tick** and resets on note trigger — so the first tick of a fresh note is the unmodified note. `000` cancels. A pitch-slide effect (`1xx`/`2xx`/`3xx`) also cancels an active arpeggio [snippet] |
| `1xx` **slide up** | "Continuously slides the pitch up, with xx steps in pitch units every tick." `slideAccum -= xx` per tick from tick 1 (smaller period = higher pitch). Clamped so the period stays ≥ 8 on pulse (below that the sweep-unit mute rule silences the channel anyway) and ≥ 2 on triangle. Persists past the row. `100`, `200` and `300` all cancel each other and the arpeggio |
| `2xx` **slide down** | Mirror of `1xx`: `slideAccum += xx` per tick from tick 1, clamped to the 11-bit maximum 0x7FF |
| `3xx` **portamento** | "Automatically slides to new notes, with xx steps in pitch units every tick. Use 00 to disable." Same linear per-tick step as `1xx`/`2xx` — **not** an exponential glide — toward the target period, stopping exactly on arrival. The row's note sets the target **without retriggering**. `300` freezes at the current pitch |
| `4xy` **vibrato** | "Applies sine vibrato to notes. x is speed (0 to disable), y is depth." Accumulator model, 6 bits: `acc = (acc + x) & 0x3F` each tick; `idx = acc & 0x0F` selects a column of a 16-entry quarter-wave table, `quad = (acc >> 4) & 3` selects `0`=forward, `1`=backward, `2`=forward+inverted, `3`=backward+inverted — a full bipolar cycle in 64 ticks at speed 1. `acc` resets to 0 on note trigger; `400` disables and the offset returns to 0. The **quarter-wave table is [ours]**: `VIB[d][i] = round(AMP[d] · sin(i·π/30))`, `i = 0..15`, with `AMP = [0,1,2,3,4,6,8,11,14,18,23,29,36,44,54,64]` — chosen because it reproduces the one published FamiTracker row we could corroborate (depth 7 = `00 01 02 03 04 05 06 07 08 09 09 0a 0b 0b 0b 0b`) and because `4xf` then spans ≈ ±1 semitone at c4. Pinned by a 16×16 snapshot test. **D-TK3**. Bipolar is FamiTracker's post-0.3.5 "new vibrato"; the legacy *unipolar, downward-only* style is a module-wide FamiTracker option we do **not** implement (v1 songs are always new-style) |
| `7xy` **tremolo** | "Applies sine tremolo to notes. x is speed, y is depth." Same accumulator and the same table object as `4xy` [snippet], applied to volume and **unipolar downward** — it only subtracts, never boosts: `volume -= abs(vibValue)`, clamped at 0. Listed Tier-2 by plan-file; it lands now because it is ~6 lines on top of vibrato |
| `Axy` **volume slide** | "Use A0y to slide up and Ax0 to slide down. The x and y parameters affect the volume column value as fractions of 8." **Note the direction: `x` slides DOWN, `y` slides UP** — the opposite of the ProTracker convention, and the single most likely implementation bug in this table. Channel volume is therefore tracked at 8× resolution: `chanVol8 ∈ [0, 120]`, `chanVol = chanVol8 >> 3`; per tick from tick 1, `chanVol8 = clamp(chanVol8 + y − x, 0, 120)`. `A00` stops and holds. Operates on the volume-column value, *before* the macro composition of §3.3. Not applicable to triangle (§3.3) |
| `Bxx` **jump** | At the end of the current row, jump to order frame `xx`, row 0 (or the `Dxx` row if both appear) |
| `Cxx` **halt** | At the end of the current row, stop playback. Any parameter. The driver emits its all-channels-off writes at that cycle |
| `Dxx` **skip** | At the end of the current row, advance to the next frame and start at row `xx` |
| `Fxx` **speed/tempo** | `xx < speedSplitPoint` (default 0x20) → `speed = xx` (clamped 1..31); otherwise `tempo = xx`. Applied immediately at end-of-tick, before the row accumulator; `rowAccum` keeps its residue (§2.3) |
| `Gxx` **note delay** | The row's note (and its instrument and volume) fire on tick `min(xx, ticksPerRow − 1)` of the row instead of tick 0 — plan-file's "if xx > speed, speed is used", made exact for the fractional case. A `G00` is a no-op, not an error |

### 3.3 volume composition — the one formula everything funnels through

Three independent volume sources exist and they compose in a fixed order:

```ts
// chanVol8  0..120  volume column at 8x resolution, mutated by Axy (§3.2)
// macroVol  0..15   current output of the instrument's volume macro (15 if none)
// trem      0..15   current unipolar tremolo magnitude from 7xy (0 if none)
const chanVol = chanVol8 >> 3                     // 0..15
let v = (chanVol * (macroVol + 1)) >> 4           // multiply-and-shift
if (v === 0 && chanVol > 0 && macroVol > 0) v = 1 // never round a live note to silence
v = v - trem                                      // tremolo applies AFTER the multiply
regVolume = v < 0 ? 0 : v > 15 ? 15 : v
```

**What is documented and what is ours.** That the volume column and the volume macro
compose **multiplicatively** is documented — FamiStudio states it plainly ("50 % volume
track × 50 % envelope volume = 25 % total volume") and the FamiTracker wiki's Volume page
lists instrument volume, channel volume and `7xy` as the three contributing factors. What
is **not** documented anywhere licence-safe is (a) the exact integer rounding FamiTracker
uses and (b) whether tremolo applies before or after the multiply. Both are **[ours]**:
`(a · (b + 1)) >> 4` (giving `15×15→15`, `15×0→0`, `8×15→8`, `8×8→4`), the
never-round-to-silence guard, and tremolo last. A 16×16 table of expected outputs is
pinned in `tests/unit/trackerVolume.test.ts`, and this is flagged in `docs/deviations.md`
as **D-TK4** so that anyone who later gets a definitive answer knows exactly which three
lines to change and which test will tell them they succeeded.

On the **triangle** the composed volume is a gate, not a level (§2.8): `0` → `$4008 =
0x00`, `> 0` → `$4008 = 0xff`. `Axy` and `7xy` are consequently on/off switches there, not
slides — which is why the manual says the volume slide does not apply to triangle. On
**DPCM** the volume column is ignored entirely.

### 3.4 macros / sequences

- One value per tick, index advances by 1 each tick, starting at index 0 **on the trigger
  tick** (the first value is heard).
- **loop point** (`loop >= 0`): when the index passes the last value, it jumps to `loop`.
  With no loop point the index stops at the last value and **holds it forever** — it does
  not zero and it does not end the note. **[ours]**: no source we can reach documents the
  no-loop end behaviour; "hold last value" is the tracker convention and is pinned by test.
- **release point** (`release >= 0`): splits the sequence. While the note is held, the
  index never advances past `release` — it loops back to `loop` if there is one, otherwise
  it holds at `release`. On `NOTE_RELEASE` the index jumps to `release + 1` and runs the
  tail to the end, then holds the last value.
- **The volume sequence decides whether release is even possible.** Documented rule: on a
  release event, if the current instrument's **volume** sequence has a release point the
  note releases; otherwise the note is **cut**. Pulsar implements exactly that — the other
  four macros follow the volume macro's verdict, so a pitch macro with a release point and
  a volume macro without one still produces a cut.
- **`NOTE_CUT`** always silences immediately, regardless of release points.
- **Instrument change without a note**: the macro *set* swaps, the macro *indices* carry
  over. **[ours]** — pinned by test.

Per-kind meaning:

| kind | range | applied as |
|---|---|---|
| `volume` | 0..15 ("channel amplitude") | `macroVol` in §3.3. **Triangle**: gate only. **DPCM**: ignored |
| `arpeggio` | −79..+79 | `absolute` = semitones added to the base note. `relative` = each value accumulates into a running semitone offset (a constant +1 climbs one semitone per tick), reset on trigger — this is the mode FamiStudio documents as matching FamiTracker's relative pitch behaviour. `fixed` = the value **is** the note number, ignoring the row's note; used for drum kits and fixed noise pitches — **[ours]**, the weakest-sourced item in this section, pinned by test. `scheme` = 0CC only, rejected by the validator (§1.5) |
| `pitch` | −127..126 | Accumulates into `pitchAccum` (raw period units) each tick, reset on trigger. *Relative*: a constant +1 is a continuous downward glide, not a fixed detune |
| `hiPitch` | −127..126 | Identical, but each step counts **×16** — documented verbatim in the manual ("Hi-pitch multiplies the value by 16"). Coarse companion to `pitch` |
| `duty` | 0..3 (pulse) / 0..1 (noise) / inert (triangle, dpcm) | Written to the channel's control byte with **no phase reset**. On noise it is the mode bit. On triangle it is inert — the channel has no duty register, so the macro is simply not applied (not an error) |

### 3.5 interaction rules

- **Effect memory** is per channel, per command letter. A command with param `00` where
  `00` is not a documented "off" value re-uses the last non-zero param for that letter
  (`3xx`, `4xy`, `7xy`, `1xx`, `2xx`, `Axy`, `Qxy`, `Rxy`). Commands whose `00` *is*
  meaningful — `0xy` (cancel arpeggio), `Gxx`, `Bxx`, `Dxx`, `Fxx` (invalid, ignored),
  `Cxx` — do not consult memory. Memory is cleared by `stop()`, never by a note.
- **Note-off vs release**: `NOTE_CUT` (`---`) clears the channel's `$4015` bit — an
  authentic hard cut, exactly as Phase 1's `writeNoteOff` does. `NOTE_RELEASE` (`===`)
  does not touch `$4015`; it drives the macros to their release tails and lets them decide
  when the channel goes quiet.
- **Instrument change mid-note**: swaps the macro set, keeps indices, keeps phase, keeps
  the pitch accumulators. No retrigger, no envelope restart, no `$4003` write.
- **A note with both a trigger and `Gxx`** delays the whole trigger (macros included) —
  the macro's index 0 lands on the delayed tick, not on tick 0.
- **A note with `3xx`/`Qxy`/`Rxy`** never retriggers (§3.1 step 2b). This is the rule that
  makes legato lines possible and it is the one most often got wrong.
- **`Sxx` and a note in the same row**: the note fires first, `Sxx` cuts it `xx` ticks
  later. `Sxx` alone cuts whatever is sounding.
- **Channel mute/solo** (editor state, not song data) suppresses emission for that channel
  but the driver keeps running its state, so unmuting mid-song resumes coherently.

### 3.6 tier-2: what lands now, what is deferred, and why

**Lands in Phase 2** (all cheap, all share existing machinery):

| cmd | note |
|---|---|
| `7xy` tremolo | shares vibrato's table and phase |
| `Pxx` fine pitch | "Sets the fine pitch in xx pitch units. 80 means in tune." Constant period offset, `0x80` = centre, `< 0x80` and `> 0x80` are the two directions; same pitch units as `1xx`/`2xx`/`3xx`. Persists until changed |
| `Sxx` delayed cut | "Cuts the active note after xx number of ticks." A scheduled `NOTE_CUT` at tick `xx`; `S00` is an immediate cut |
| `Qxy` / `Rxy` note slide | "Triggers a targeted note slide up/down. **x is the speed and y is the number of semitones** above/below the current one to slide to." (x and y in that order — easy to swap by accident.) Computes the target period from `baseNote ± y`, runs a glide toward it at **2x+1 period units per tick** [snippet], then latches `baseNote` to the arrived note. One-shot |
| `Vxx` duty / timbre | "Controls the duty period of the pulse channels and noise mode of the noise channel." Ranges: pulse `00–03`, noise `00–01`; out-of-range values are masked, not rejected. Sets the value immediately; a duty *macro* on the instrument overwrites it from the next tick — documented behaviour, not a bug: macros are per-tick, `Vxx` is per-row |

**Deferred, with the real reason** (not "ran out of time"):

- `Hxy` / `Ixy` **hardware sweep** → Phase 3. The sweep unit rewrites the channel's period
  register internally; our driver writes `$4002`/`$4003` whenever the computed period
  changes, silently discarding what the sweep computed. Making both work needs the driver
  to *stop* owning the period while a sweep is armed, and to reconcile its pitch state
  when the sweep ends — a real design, not a patch. Ships with VRC6 in Phase 3, where
  the period-ownership question has to be answered anyway.
- `Wxx` / `Xxx` / `Yxx` / `Zxx` **DPCM** (pitch override, retrigger, sample offset, delta
  counter) → Phase 3, with DPCM instrument work generally. `Zxx` is trivial in isolation
  (`$4011 = xx`) but pointless without samples in songs people actually author.
- `Exx` **deprecated volume** (legacy channel volume, superseded by the volume column) →
  never implemented as a runtime effect. The Phase-4 text importer maps it into the volume
  column, which is what FamiStudio does.
- `Oxx` **groove** (0CC/Dn) and FamiStudio's groove-based tempo mode → out of scope; §2.3
  explains why `evenTempo` is a boolean that does not block adding them later.
- `Lxx`, `Mxy`, `Txy`, `EEx`, FDS `Hxx/Ixx/Jxx` → Tier 3, out of scope (plan-file §5).

### 3.7 DPCM in v1 — scoped, and where the cut line is

The format carries `samples` and `Instrument.dpcm` (§1.2), the grid edits the dpcm lane,
and the validator checks both. Driver support is: build the 32 KiB `$8000–$FFFF` image at
load (samples packed 64-byte aligned from `$C000`), then on a dpcm note write `$4010`
(rate + loop) → `$4012` (address) → `$4013` (length) → `$4015 |= 0x10` last, per
`docs/register-timeline.md`; optional `$4011` preload before it. `setDpcmMemory` already
exists on the core, so this needs no core change.

**If WP9 runs long, driver DPCM triggering is the single item to cut** — format,
validation and grid support are mandatory (they are what stops a format bump later), the
trigger path is not. None of the four preset tracks uses DPCM (§5.2), and plan-file's
Phase-2 acceptance never mentions it.

---

## 4. the pattern grid

Desktop-first, per plan-file §10 ("tracker grid stays desktop-first"). This is **not** the
dot-matrix screen — the 128×64 lattice is the instrument's lit well and stays that. The
grid is a second canvas surface living on the aluminium, and it is the only place in the
product where real typography meets a canvas.

### 4.1 where it sits

`Enclosure.svelte` gains one grid area, `tracker`, between `screen` and `knobs`, present
only when the tracker panel is open (a `[tracker]` chip in the StatusBar toggles it; the
live-play shell must still be usable on its own — that is the Phase-1 product and it does
not regress). Below 720 px the tracker area collapses to a message pointing at a wider
window: an 8-channel grid on a phone is a lie, and plan-file already said desktop-first.

> **Amended 2026-08-04 (UI audit P3).** The between-screen-and-knobs placement stacked
> six full-width rows and made the open-tracker page roughly twice a laptop viewport,
> with the grid below the fold. The tracker area now **replaces** the `screen` and
> `knobs` rows: the panel hosts the screen itself in its work row's left pane (above the
> order list, at `DOT_MIN` — the song page beside the grid it narrates; the StatusBar
> toggle switches the page on open/close), and the knob row returns when the panel
> closes. Between 720 and 1080 px the work row stacks to one column. The closed shell is
> untouched, so the no-regress rule above still holds as stated.

```
src/ui/tracker/
  TrackerPanel.svelte      layout, transport buttons, preset bar slot, mode chips
  PatternGrid.svelte       the canvas + the offscreen semantic model (§4.4)
  OrderList.svelte         plain DOM table, one row per frame
  InstrumentEditor.svelte  plain DOM: macro list + a small canvas envelope editor
  canvas/patternRenderer.ts   pure draw functions, no Svelte
  canvas/gridMetrics.ts       geometry + palette resolution, pure, unit-testable
```

Order list and instrument editor are **plain DOM on purpose**. They are small, they are
where screen-reader users will actually work, and building them as canvas would cost
accessibility for nothing.

### 4.2 typography, colour, geometry

Read from `tokens.css` — the grid lives on the enclosure, whose tokens change between
`day` and `night` rooms, so it must **not** mirror literals the way `design/tokens.ts`
mirrors the (room-invariant) screen palette. `gridMetrics.ts` resolves a palette object
via one `getComputedStyle(document.documentElement)` call at mount and again on a
`data-room` change, caching:

```ts
interface GridPalette {
  bg, bgAlt, bgBeat, bgBar     // --n-000 / --n-100 / derived highlight bands
  ink, inkDim, inkMuted        // --enclosure-ink / -ink-2 / --enclosure-hairline
  accent                       // --enclosure-accent  (blue) — cursor + playhead only
  selection, hairline, focus
}
```

- **Font**: `var(--font-ui)` (JetBrains Mono Variable), `--t-body-size` 12 px for cells,
  `--t-micro-size` 9 px for the channel headers and row numbers, weight 400/600. Set once
  as `ctx.font`; monospace means one `measureText('0')` gives the whole column geometry.
- **Row height** 18 px, **cell padding** 4 px, derived from the base-4 space scale so the
  grid lines up with everything else on the slab.
- **Accent rule holds**: exactly one accent on this surface, blue, used for the edit
  cursor and the playhead only. The row-highlight bands are neutral luminance steps
  (`rowHighlight` → `--n-100`, `rowHighlight2` → `--n-300` at low alpha), never colour.
  Empty cells render as `---` / `..` in `--enclosure-hairline`, which is a legal use of
  that token (non-text marks).
- **Everything lowercase**, including note names (`c-4`, `a#3`) and effect letters — the
  grid is the one place a tracker traditionally shouts in caps, and we do not.
- **Column layout per channel**: `note(3) inst(2) vol(1) fx(3 each)` separated by a
  1 px `hairline`; channel groups separated by a 2 px rule. Widths in character cells so
  a DPR change never reflows.

### 4.3 rendering strategy — dirty-flag, not per-frame

The grid subscribes to the app's **existing single rAF** (`ui/frame.ts` — no second loop,
Phase-1 rule) and paints **only when dirty**. Dirty is set by: scroll, cursor move,
selection change, data edit, focus change, room change, resize/DPR change, and a change in
the driver's `position.row`/`position.orderIndex` read from the plain object in §2.4.

Consequences and why this is the right answer for the 60 fps acceptance item:

- During playback at 150 BPM the playhead moves ~10 times a second. Idle frames cost one
  boolean test.
- A full repaint of 8 channels × 40 visible rows is ~320 cells ≈ 1 700 `fillText` glyph
  runs worst case. Budget: **p99 ≤ 4 ms**, benched in `tests/bench/patternGrid.bench.ts`
  against a headless 2D context shim. If that misses, the escalation is pre-rendered
  glyph atlases (`drawImage` from an offscreen sheet of the ~48 characters the grid can
  show) — specified here so it is a known move, not a redesign.
- **Row virtualization**: only `[firstVisible − 2, lastVisible + 2]` are drawn. `scrollTop`
  is a number the component owns, never DOM scroll — the canvas is fixed-size and the
  content moves under it, which is what keeps the playhead pinned without layout.
- **Two layers**: a cached `OffscreenCanvas` for the static furniture (channel headers,
  column rules, row-number gutter) blitted once per frame, and the live layer for cells,
  bands, cursor and playhead. Same pattern `dotMatrix.ts` already uses, same invalidation
  triggers.
- **DPR**: `dpr = max(1, round(devicePixelRatio))`, backing store × dpr,
  `setTransform(dpr,…)`, `imageSmoothingEnabled = false`. **And a
  `matchMedia('(resolution: Xdppx)')` listener** — the known Phase-1 polish item
  ("DPR-change without a resize does not invalidate the cached lattice") is inherited here
  and must be fixed in the grid, not repeated.
- **Follow modes**: `follow` (default — the view scrolls to keep the playhead on the
  centre third) and `free` (the user scrolled; auto-follow re-arms on the next `play` or
  on a `[follow]` chip click). Under `prefers-reduced-motion` the follow scroll is a jump,
  not an animation; `motion.svelte.ts` already exposes the flag to canvas code.

### 4.4 accessibility — what a tracker grid can honestly promise

The canvas is `aria-hidden="true"`. Beside it, in the same container, sits a **DOM
semantic model**: a `role="grid"` element with `aria-rowcount = rowsPerPattern`,
`aria-colcount`, and one `role="row"`/`role="gridcell"` element **per visible row only**,
each carrying `aria-rowindex`/`aria-colindex` so the virtualization is announced correctly.
The container is the single tab stop; `aria-activedescendant` points at the cursor cell.
Cells are visually hidden (clip, not `display:none`) but present and labelled:

```
"channel pulse 1, row 12, note c-4, instrument 00, volume f, effect 1 0 5 5"
"channel noise, row 13, empty"
```

- Cursor moves announce the *cell*, throttled to one announcement per 250 ms through the
  existing `LiveRegion`. Edits announce the new value. Playback start/stop and order-frame
  changes announce once each.
- The **order list and instrument editor are plain DOM** and are fully operable — a
  screen-reader user can build a song's structure there and enter notes in the grid.
- **What we do not promise, stated in the doc and in the UI's help text**: reading a whole
  pattern aurally is slow, and no tracker solves that. The honest promise is *cell-level
  navigation and editing parity with the mouse*, not aural comprehension of a pattern at
  speed. Saying so is better than shipping 512 aria-labels nobody can use.
- axe must report zero violations on the tracker panel (same gate as Phase 1), and the
  keyboard-only walkthrough is a WP10 gate.

### 4.5 keybindings

Note entry **reuses `src/input/keyboard.ts`'s `LOWER_ROW`/`UPPER_ROW` `event.code` maps** —
imported, not duplicated. The physical-position mapping and the octave keys stay exactly
what the keybed already teaches.

| context | key | action |
|---|---|---|
| always | `space` | toggle edit mode |
| always | `enter` | play from the cursor row (`PlayMode.row`) |
| always | `shift+enter` | play the current pattern, looping |
| always | `escape` | stop |
| always | arrows | move cursor (up/down = row, left/right = sub-column) |
| always | `tab` / `shift+tab` | next / previous channel |
| always | `page up/down` | ±16 rows · `home`/`end` first/last row · `ctrl+home/end` song start/end |
| always | `−` / `=` | octave down / up (unchanged from Phase 1) |
| note column, edit | note keys (`z`–`,`, `q`–`i`) | write note at cursor + audition, advance by `editStep` |
| note column, edit | `1` | note cut `---` (Digit1 is free — the upper row uses 2,3,5,6,7) |
| note column, edit | `` ` `` | note release `===` |
| inst / vol / fx-param, edit | `0`–`9`, `a`–`f` | hex digit entry, left-to-right within the field |
| fx-command column, edit | letter/digit | the effect character |
| edit | `delete` | clear the field under the cursor · `shift+delete` clear the whole row |
| edit | `insert` | push rows down from the cursor · `backspace` pull rows up |
| edit | `ctrl+z` / `ctrl+shift+z` | undo / redo |
| edit | `ctrl+c/x/v` | copy / cut / paste the selection (block-rectangular) |
| always | `ctrl+1`…`ctrl+5` | toggle mute on channel n · `ctrl+alt+n` solo |

`preventDefault()` on every bound combination, and the grid **ignores keys while focus is
in an `<input>`** (the same `isTextTarget` guard `keyboard.ts` already implements). While
the tracker panel has focus, the global QWERTY listener must not *also* fire — WP10 wires
the grid's focus state into `attachKeyboard`'s guard rather than adding a second listener.

**Edit vs play mode.** Edit mode off: note keys audition only (live play, Rule L). Edit
mode on: note keys write **and** audition. Stopped + edit → step record (write, advance by
`editStep`). Playing + edit → live record (write at the row derived from the input event's
own timestamp, §2.6). One boolean, two behaviours, both discoverable from the `[edit]`
chip's state.

### 4.6 undo/redo — **in Phase 2**, scoped

In. A tracker without undo is not usable for the authoring that acceptance item (b) and
the preset work both require, and over an immutable document it is genuinely cheap.

- Every mutation is a **command** — `src/tracker/model/commands.ts` (pure, WP9):
  `applyCommand(song, cmd): { song: Song; inverse: Command }`. Commands: `setCell`,
  `setCellField`, `clearRow`, `insertRow`, `deleteRow`, `pasteBlock`, `setOrderEntry`,
  `insertFrame`, `deleteFrame`, `setMeta`, `setInstrument`, `setSequence`.
- `src/state/song.svelte.ts` (WP10) holds `$state` for the document plus two arrays
  (`undo`, `redo`), capped at **200** entries. Consecutive `setCellField` commands on the
  *same cell within 700 ms* coalesce into one undo entry so typing `1`,`0`,`5` into a
  volume field is one undo, not three.
- **Scope**: pattern, order, instrument, sequence and meta data only. Never playback
  state, never cursor/scroll, never mute/solo, never preset selection. Undo during
  playback is allowed and takes effect at the next row boundary (the driver re-reads the
  document each row; §2.7's compiled pattern views are rebuilt on any document change,
  which at these sizes is sub-millisecond).
- Gate: a property test — apply N random valid commands, then N undos, and assert
  structural equality with the original document; then N redos and assert equality with
  the mutated one.

---

## 5. preset tracks

User-requested addition to plan-file's Phase-2 list. Four shipped tracks, plus one tiny
fixture (§1.4) that lives in `tests/` and is not shipped.

### 5.1 why four, and why they are not "demos"

Four is the smallest set that covers the four things a new user needs to believe: that the
instrument macros work, that the pitch effects work, that percussion and tempo work, and
that song structure works. Each track is **music first** — a preset that demonstrates
`4xy` but is unpleasant teaches the user that the app sounds bad. Each is 40–90 s, loops
cleanly, and exercises a **disjoint** effect set so a regression points at one track.

### 5.2 the four tracks

| file | length | demonstrates | effects exercised | channels |
|---|---|---|---|---|
| `first-light.json` | ~48 s | instrument macros: volume envelopes with loop + release, duty macros, arpeggio macros. The "this is what an NES instrument is" track | `0xy`, `Gxx`, `Fxx` (speed only) | p1 lead · p2 echo (same pattern, +1 frame offset, lower volume) · tri bass · noise hats |
| `long-fall.json` | ~72 s | pitch: portamento lead over a walking bass, vibrato on held notes, a `1xx`/`2xx` riser into the loop point | `3xx`, `4xy`, `1xx`, `2xx`, `Pxx`, `Qxy`/`Rxy` | p1 lead · p2 harmony a third below · tri bass · noise sparse |
| `hammer-shop.json` | ~40 s | percussion and dynamics: noise drum kit with volume-macro auto-cut, `Axy` swells, `Gxx` flams, `Sxx` chokes, a mid-song tempo change | `Axy`, `7xy`, `Gxx`, `Sxx`, `Fxx` (speed **and** tempo) | noise kit (3 timbres via `Vxx` + duty macro) · p1 stab · p2 stab · tri kick reinforcement |
| `switchback.json` | ~55 s | structure and timing: an order list with a `Bxx` loop, a `Dxx` shortcut, a `Cxx`-terminated ending variant, and a deliberately **fractional** tempo (`T=160, S=6` → the documented 6,6,5,6,6,5,6,5 groove) so the alternation is audible as swing | `Bxx`, `Cxx`, `Dxx`, `Fxx`, `Vxx` | all four, plus two frames where p2 carries the melody |

None uses DPCM (§3.7). Together they cover every Tier-1 effect and every Tier-2 effect that
lands in Phase 2, which makes the preset suite a second, musical regression net over §7's
unit tests.

### 5.3 authoring pipeline — the brief an agent receives

Preset JSON is hand-authored by an agent against §1's types. The brief:

1. **Write the JSON directly.** No intermediate DSL, no generator script. The format is
   designed to be typed (§1.1); a generator would become a second source of truth.
2. **Numbers on disk are decimal.** The grid shows `047`; the file stores `"param": 71`.
   Convert once, and record the intent in `extra.notes` next to it. This is the single
   most likely authoring mistake and the lint cannot catch it — a wrong-but-in-range param
   is still a valid song, just the wrong chord.
3. **NES voicing idioms**, because they are why NES music sounds like NES music:
   - pulse 1 = melody, duty 2 (50 %) or 1 (25 %); pulse 2 = harmony a third or sixth
     below, **or** the same line one frame later at lower volume for an echo;
   - triangle = bass, one or two octaves below the melody, and **nothing else** — the
     triangle has no volume control, so a triangle pad drowns everything;
   - noise = drums. Kick ≈ period index 12–14 with a fast downward pitch macro, snare ≈
     index 6–8 mode 0, hat ≈ index 1–3 with a 2–4 tick volume macro. **Every drum's
     length comes from its volume macro reaching 0, not from a note-off row** — that is
     the auto-cut idiom and it keeps patterns readable;
   - leave space. Two channels playing constantly is a wall; the NES canon breathes.
4. **Tempo discipline**: keep `tempo: 150` and vary `speed` unless the track is
   *deliberately* demonstrating the fractional groove (only `switchback`). §2.3 explains
   why `tempo = 2.5 · engineSpeed` is the even-tick condition.
5. **Key discipline**: pick one key, declare it in `extra.qa.key` (e.g. `"a-minor"`), and
   keep accidentals under 12 % of note events. The lint (§5.5) enforces it.
6. **Declare what you are demonstrating** in `extra.qa`, because the QA gate reads it:
   ```json
   "extra": { "qa": { "key": "a-minor", "channels": ["pulse1","pulse2","triangle","noise"],
                      "effects": ["0","G","F"], "bpmRange": [110, 130],
                      "durationSec": [40, 60] } }
   ```
7. **Run the gate before declaring done**: `pnpm test tests/unit/presets.test.ts`. It is
   designed to be runnable by an agent with no ears (§5.5).

### 5.4 where the songs live, and where the offline renderer lives

**Songs: `src/assets/songs/*.json`, imported statically** through
`src/assets/songs/index.ts`:

```ts
import firstLight from './first-light.json'
export const PRESETS = [
  { id: 'first-light', title: 'first light', song: firstLight as unknown },
  …
] as const
```

Rationale: (a) plan A1's asset rule — referenced from code → `src/assets`, Vite-hashed;
(b) a preset that fails `parseSong()` fails **the test run and the build**, not the user's
click, because `index.ts` is in the app's module graph and the QA test imports the same
module; (c) no fetch means no COEP interaction, no loading state, no 404 path. Rejected
alternative `public/songs/` + fetch: buys lazy loading we do not need at 15–40 KB/file and
costs a runtime failure mode. Total added bundle ≈ 60–140 KB raw, well under 30 KB gzipped
— reported in the WP11 gate.

**Offline renderer: `src/tracker/offlineRender.ts`** — in `src/`, not in `tests/`.

```ts
export interface OfflineRenderResult {
  samples: Float32Array; sampleRate: number; cycles: number
  clippedSamples: number; noteOns: number; rowsPlayed: number; checksum: number
}
export function renderSong(song: Song, opts?: {
  sampleRate?: number; maxSeconds?: number; loops?: number
  consoleModel?: 'nes' | 'famicom'; masterGain?: number
}): OfflineRenderResult
```

It constructs an `Apu2A03`, a `TrackerDriver` writing straight into it, and runs the same
four-line quantum loop `process()` and `tests/helpers/renderTrace.ts` already use. It lives
in `src/` for one decisive reason: **Phase 3's WAV export is this function**, plus an
encoder and a download. Putting it in `tests/` would guarantee it gets rewritten. The
existing `tests/helpers/renderTrace.ts` stays exactly as it is — it renders *register
traces*, which is a different input and still the right tool for the golden-trace tests.
`offlineRender.ts` must stay DOM-free so it typechecks under `tsconfig.test.json` and can
later move to a worker unchanged.

### 5.5 QA an agent can run without ears — `tests/unit/presets.test.ts`

Every preset runs all four gates. Failures name the preset and the gate.

**Gate A — structural** (`parseSong`, zero `error` diagnostics; `warn` diagnostics are
printed and allowed only for `unreferenced pattern`): every ordered pattern exists; every
referenced instrument and sequence exists; effect params in range; no unknown effect
command; `effectColumns` covers every `fx` slot actually used.

**Gate B — musicality lint** (pure, on the document, no rendering):
- **key consistency**: ≥ 88 % of note events lie in the declared key's scale (
  `extra.qa.key`); accidentals are counted and reported even when passing.
- **tempo in range**: computed BPM ∈ `extra.qa.bpmRange`, and that range ⊆ [60, 220].
- **non-empty percussion lane**: the noise channel has ≥ 16 note events and no silent gap
  longer than 8 rows across ≥ 80 % of the played rows.
- **claimed channels are used**: every channel in `extra.qa.channels` has ≥ 8 note events;
  every channel *not* claimed has 0.
- **claimed effects appear**: every command letter in `extra.qa.effects` occurs ≥ once, and
  no effect outside the Phase-2 supported set occurs at all.
- **no dead frames**: every order frame is reachable from frame 0 by following `Bxx`/`Dxx`
  and normal advance.

**Gate C — offline render** (`renderSong`, 48 kHz, one full pass + one loop):
- **duration**: `cycles / clockRate` within ±1 row-time of `rowsPlayed × ticksPerRow ×
  cyclesPerTick`, and inside `extra.qa.durationSec`.
- **no clipping beyond N**: `clippedSamples ≤ 8` (essentially "none"; the engine clamps at
  ±1 and counts, so this is a real measurement, not a proxy). A preset that clips is
  re-voiced, not re-gained.
- **note-event count matches the data**: `result.noteOns` equals the count of note cells
  the order walk actually reaches, computed independently by the test from the document.
  This is the assertion that catches a driver that silently skips rows.
- **all four channels audible**: render four extra passes with three channels muted each
  time and assert each solo pass has RMS > −40 dBFS. Proves the mix, not just the events.
- **level sanity**: full-mix RMS ∈ [−20, −9] dBFS; no window of > 1.2 s below −60 dBFS
  anywhere except the last 0.5 s.
- **deterministic checksum**: FNV-1a over the rendered `Float32Array` quantised to
  1e-4, pinned per preset — the same shape as the Phase-1 golden traces (1e-6 over
  seconds-long fixtures). Re-rendering must reproduce it; changing a preset requires
  updating the pin in the same commit, which is the point. The quantization absorbs
  last-bit `Math.sin`/`Math.exp` differences across V8 builds, which a minutes-long
  render otherwise accumulates in the filter state until a raw byte flips.

**Gate D — anti-vacuity**, because Phase 1 set this standard: a mutation of the preset
(transpose one pattern by +1 semitone) must **break** the checksum, and a deliberately
broken preset fixture (`tests/fixtures/songs/bad-*.json`, six of them) must fail Gates A
and B with the specific diagnostics named in the test. A gate that cannot fail is not a
gate.

### 5.6 preset browser UX — minimal

- A **`PresetBar.svelte`** row of chips at the top of the tracker panel, reusing the
  StatusBar chip styling verbatim (`--chip-bg`, `--chip-accent`, `--t-micro`, lowercase):
  `[ first light ] [ long fall ] [ hammer shop ] [ switchback ] · [ open… ] [ save ]`.
  Chips are `<button>`s, so keyboard and screen-reader support come free.
- Loading a preset when the document is dirty prompts (a plain `<dialog>`); loading is
  otherwise instant and starts stopped, cursor at frame 0 row 0.
- The **screen gains one page, `song`** (added to `SCREEN_PAGES`), showing name, author,
  `bpm`, and `frame/row` position in the 5×7 font on the existing lattice — the tracker's
  presence made visible on the instrument itself. No new canvas primitive; it is four
  `text()` calls and one `hline()`.
- `[ open… ]` is a file input accepting `.json`; `[ save ]` triggers a download of
  `serializeSong()`. No file-system API, no persistence service, no new dependency.

---

## 6. work-package carve

Same delegation model as Phase 1 (plan Part E): each agent gets its section of this
document verbatim, runs its own tests before reporting, and **touches no file outside its
ownership column**. Three packages, disjoint ownership, one serialization point.

### 6.1 sequencing

```
WP9  (tracker-core)  ──┬──►  WP10 (tracker-ui)   ──┐
                       │                            ├──►  lead: phase-2 acceptance
                       └──►  WP11 (presets)     ────┘
```

WP9 goes first and alone, because it freezes two interfaces the other two code against:
the `Song` types (§1.2) and the bridge's tracker API (§6.3). **WP9 publishes those two
files as its first commit**, before the driver is written, so WP10 and WP11 can start
against real types. WP10 and WP11 then run in parallel; WP11 depends only on WP9 (it uses
`renderSong` and `parseSong`, never the UI).

### 6.2 ownership table

| WP | agent | owns (exclusive) | may not touch |
|---|---|---|---|
| **WP9** | `tracker-core` | `src/tracker/**` (model/{types,validate,commands,compile}.ts · driver/{trackerDriver,tempo,macros,effects,registers}.ts · offlineRender.ts) · `src/audio/bridge.ts` · `src/audio/host/liveScheduler.ts` (the 6-line `reset()` only) · `src/audio/host/audioEngine.ts` (the 3-line `pending` getter only) · `tests/unit/tracker*.test.ts` · `tests/unit/presetFormat.test.ts` · `tests/fixtures/songs/**` · `docs/register-timeline.md` (new *tracker producer* section) · `docs/deviations.md` (D-TK1…D-TK5) | anything under `src/ui`, `src/state`, `src/input`, `src/design`, `src/assets`; `src/audio/{core,dsp,worklet,protocol,timeline}/**` |
| **WP10** | `tracker-ui` | `src/ui/tracker/**` · `src/ui/canvas/patternRenderer.ts`, `gridMetrics.ts` · `src/state/song.svelte.ts`, `src/state/tracker.svelte.ts` · `src/input/trackerKeys.ts` · `src/App.svelte` · `src/ui/Enclosure.svelte` · `src/ui/StatusBar.svelte` · `src/ui/Screen.svelte` · `src/state/transport.svelte.ts` (note-refcount fix, §7.2) · `src/input/keyboard.ts` (focus-guard hook only) · `src/design/tokens.css` (additive `--grid-*` block) · `tests/bench/patternGrid.bench.ts` · `tests/unit/{songStore,trackerKeys}.test.ts` | `src/tracker/**`, `src/audio/**`, `src/assets/songs/**` |
| **WP11** | `presets` | `src/assets/songs/**` (4 JSON + `index.ts`) · `src/ui/tracker/PresetBar.svelte` · `tests/unit/presets.test.ts` · `tests/fixtures/songs/bad-*.json` · a `presets` section appended to `README.md` | everything else, including the grid, the driver and the bridge |

Conflict notes, resolved in advance: `src/audio/bridge.ts` is **WP9-only** (it is the audio
boundary and the tracker API lives there); `src/App.svelte` and `Screen.svelte` are
**WP10-only**; `src/ui/tracker/PresetBar.svelte` is **WP11-only** and WP10 leaves a named
slot for it in `TrackerPanel.svelte`. Nothing in `src/audio/{core,dsp,worklet,protocol}` or
`src/audio/timeline/types.ts` is owned by anyone — those are frozen (K1, K3).

### 6.3 the interface WP9 freezes first

Added to `src/audio/bridge.ts`'s `AudioBridge`, additive only — every Phase-1 member keeps
its exact signature and behaviour:

```ts
interface AudioBridge {
  /* …all phase-1 members unchanged… */
  loadSong(song: Song): void
  play(mode: PlayMode, from?: { order: number; row: number }): void
  stopPlayback(): void
  /** Plain object, mutated in place, read in rAF only — never $state. */
  readonly playback: DriverPosition
  /** Which channel live input steals while playing (§2.6). */
  setLiveChannel(channel: number): void
  setChannelMute(channel: number, muted: boolean): void
  setEditStep(rows: number): void
  /** Recorded input while playing: returns the row it landed on, or -1. */
  readonly recordSink: { onNote(note: number, velocity: number): number } | null
}
```

The `StubBridge` implements all of it (synthetic position advance) so WP10 can build the
whole grid against `?stub` with no audio thread, exactly as WP2 did in Phase 1.

### 6.4 gates

| WP | gate — all must be true before merge |
|---|---|
| **WP9** | `trackerTempo.test.ts`: F150/S6 = 6 ticks/row exactly; **T=160/S=6 produces 6,6,5,6,6,5,6,5** (§2.3); `bpm = 24T/(S·rowHighlight)` and `60E/(tpr·rowHighlight)` agree over a 200-case sweep; one hour of ticks has zero drift; `evenTempo` rounds as specified · format round-trip: `parse∘serialize∘parse` is identity over all fixtures and the four presets, and the six `bad-*.json` fixtures fail with the exact named diagnostics · driver determinism: two `renderSong` calls are bit-identical, **and the render is independent of pump chunking** (drive `runTo` in 1-tick, 7-tick and one-shot horizons → identical output; the chunk-independence analogue of Phase 1's 375×128 test) · macro semantics table tests (loop, release, no-loop hold, volume-gated release, instrument swap) · effect table tests incl. the `Axy` direction and the volume composition table · **write-on-change proof**: a 10-second held note emits `$4003` exactly once · `pnpm test` and `pnpm typecheck` green, `banGates` green, `git diff --stat` shows no frozen file touched |
| **WP10** | `patternGrid.bench.ts` full repaint p99 ≤ 4 ms at 8 channels × 40 visible rows (the 60 fps acceptance item, measured not asserted by eye) · keyboard-only authoring walkthrough: create a pattern, enter 8 notes, an instrument, a volume and an effect, reorder two frames, undo everything, redo everything — mouse untouched · axe zero violations on the tracker panel · undo/redo property test (N random commands → N undos ≡ original; N redos ≡ mutated) · playhead follows during playback without a dropped frame in a 60 s DevTools recording · the live-play shell still passes every Phase-1 behaviour with the tracker panel closed |
| **WP11** | all four presets pass Gates A–D (§5.5) · Gate D anti-vacuity demonstrably fails on a mutated preset · presets load and play from a cold `pnpm preview` in Chrome · bundle delta reported in the PR body · `README.md` presets section added |

### 6.5 plan-file phase-2 acceptance mapping

| plan-file item | discharged by |
|---|---|
| **(a)** tempo math verified by unit tests against the formula (F150/Speed6 = 6 ticks/row = 150 BPM; BPM = 24·Tempo/(Speed·4)) | **WP9** — `trackerTempo.test.ts`, both formulas asserted together |
| **(b)** a 4-channel test song plays with correct arpeggios, slides, vibrato, volume slides and frame jumps | **WP9** owns the assertion (fixture song + per-effect register-timeline assertions); **WP11** owns the shipped musical proof — `long-fall` (slides/vibrato) + `hammer-shop` (volume slides) + `switchback` (frame jumps) + `first-light` (arpeggios) cover the list between them |
| **(c)** non-integer ticks-per-row reproduces the 6/7 alternation, or an "even" mode toggle | **WP9** — the T=160 documented-groove vector plus the T=140 alternation table plus `evenTempo` |
| **(d)** instrument macros audibly match FamiStudio/FamiTracker playback of an equivalent instrument | **WP9** — behavioural tests for every documented rule, **plus a written manual comparison procedure** in `tests/fixtures/songs/README.md` in the same style as Phase 1's `tests/fixtures/README.md` (build the equivalent instrument in FamiStudio, render both, compare envelopes). Honest status: automatable up to the documented rules; the "audibly matches" half is a documented manual procedure, exactly as Phase 1 handled its spectral-comparison item |
| **(e)** pattern grid scrolls at 60 fps with 8 channels × 64 rows | **WP10** — `patternGrid.bench.ts` p99 ≤ 4 ms + the 60 s recording |
| *(user-added)* shipped preset tracks | **WP11** — four tracks, Gates A–D |

### 6.6 docs the carve must produce

- `docs/register-timeline.md` — **WP9** adds a *tracker producer* section: the driver's
  `cycleOfTick` formula, the write-on-change rule, the per-channel canonical orders it
  reuses, Rule L and the play/stop handoff (§2.6), and updates the producers table's
  Phase-2 row from a promise to a description.
- `docs/deviations.md` — **WP9** adds **D-TK1** (60.000 Hz tick, not 60.0988), **D-TK2**
  (high-byte writes during slides reset duty phase), **D-TK3** (our vibrato/tremolo table),
  **D-TK4** (our volume-composition rounding and tremolo ordering), **D-TK5** (PAL songs
  play at NTSC rate in Phase 2).
- `docs/phase2-acceptance.md` — **lead session**, at the end, in the shape of
  `docs/phase1-acceptance.md`: evidence per (a)–(e) plus the preset gates, and a fresh
  "known polish" list.

---

## 7. tests, absorbed phase-1 polish, and risks

### 7.1 test map

Same conventions as Phase 1: vitest, `environment: 'node'`, no jsdom, headline assertions
stated in the file header, anti-vacuity wherever a gate could pass by doing nothing.

| file | owner | proves | headline assertions |
|---|---|---|---|
| `trackerTempo.test.ts` | WP9 | §2.2–2.3 | T=160/S=6 → `[6,6,5,6,6,5,6,5]` and accumulator returns to 0; F150/S6 → all-6; T=140 first-24 table; both BPM formulas agree over 200 cases; 216 000 ticks exact, zero drift; `evenTempo` rounding; the ring-occupancy lookahead cap at E = 60/120/240/400 |
| `songFormat.test.ts` | WP9 | §1 | round-trip identity on 5 documents; key order and formatting are byte-stable; 6 `bad-*.json` fail with the exact diagnostics; unknown top-level key warns and is dropped; `fx` trailing-null tolerance |
| `trackerMacros.test.ts` | WP9 | §3.4 | index 0 on trigger tick; loop wrap; no-loop hold; release tail; **volume-macro release point gates release for all macros**; cut ignores release; instrument swap keeps indices; hi-pitch = pitch ×16; fixed vs absolute vs relative arpeggio |
| `trackerEffects.test.ts` | WP9 | §3.2, §3.6 | per-effect register timelines against literal expected `(tick, addr, value)` lists; **`Axy` x=down y=up at eighths**; `Qxy` x=speed y=semitones; `Gxx` delays only its own channel; `3xx`/`Qxy`/`Rxy` do not retrigger; effect memory table |
| `trackerVolume.test.ts` | WP9 | §3.3 | the 16×16 composition table; never-round-to-silence; tremolo applied last; triangle gate behaviour |
| `trackerVibrato.test.ts` | WP9 | §3.2 | 16×16 quarter-wave snapshot; the 4-quadrant reconstruction is a full bipolar cycle in 64 ticks at speed 1; depth-7 row matches the corroborated reference |
| `trackerDriver.test.ts` | WP9 | §2.7 | write-on-change (`$4003` once per held note, never per tick); chunk independence across 1/7/one-shot horizons; play/stop handoff keeps cycles non-decreasing across the `LiveScheduler` boundary; `Cxx` stops on the right cycle; mute/solo suppress emission without desyncing state |
| `trackerCommands.test.ts` | WP9 | §4.6 | every command has a correct inverse; property test N-apply/N-undo ≡ original |
| `presetFormat.test.ts` | WP9 | §1.5 | the four presets parse with zero errors (runs even if WP11 is mid-flight, against whatever exists) |
| `songStore.test.ts` | WP10 | §4.6 | undo cap, coalescing window, redo invalidation on a new edit |
| `trackerKeys.test.ts` | WP10 | §4.5 | the keymap table; hex entry per column; `Digit1`/backquote cut & release; no collision with the Phase-1 note keys |
| `patternGrid.bench.ts` | WP10 | §4.3 | full-repaint p99 ≤ 4 ms at 8×40 |
| `presets.test.ts` | WP11 | §5.5 | Gates A–D per preset, incl. pinned render checksums and the mutation anti-vacuity check |

`banGates.test.ts` is **not** widened to `src/tracker/**` — that tree is not
worklet-reachable, and widening a tripwire past its rationale is how tripwires get
disabled. The driver's own zero-allocation discipline (§2.7) is enforced by review and by
the bench, which is the honest instrument for it.

### 7.2 phase-1 known-polish items phase 2 must absorb

From `docs/phase1-acceptance.md`'s deferred list — these stop being cosmetic once a tracker
exists, and each is assigned:

| item | why it becomes load-bearing | owner |
|---|---|---|
| **Per-source note refcounts in `transport.notes`** (QWERTY keyup can cut a note the pointer holds) | Step record adds a **third** note source, and record-while-playing adds a fourth path. The current set-of-numbers model will drop keybed highlights and, worse, send a `noteOff` for a note another source still holds | **WP10** — blocking |
| **Diagnostics have no UI surface** (`late`/`dropped`/`underruns` published, unread) | A main-thread driver's failure mode *is* late writes (§2.1). Shipping it with no readout would be shipping a blind spot on purpose | **WP10** — a `[drv]` chip showing late/dropped, plus `stats` in the driver |
| **`clippedSamples` published but unread** | Preset Gate C asserts on it (§5.5) | **WP9** (reads it) / **WP11** (asserts) |
| **Notes during the ~100 ms engine start are dropped** | `play()` on a cold page hits exactly this window | **WP9** — `play()` awaits `engine.ready()` (§2.6) |
| **DPR change without resize does not invalidate the cached lattice** | The pattern grid has the same cached-offscreen design and would inherit the same bug at 10× the surface | **WP10** — `matchMedia('(resolution)')` listener in `gridMetrics.ts`; fixing `dotMatrix.ts` too is in-scope since WP10 owns `Screen.svelte` |
| **`InitMessage.clockRate` carried but the worklet hardcodes NTSC** | The song format has a `region` field | **WP9** — documents **D-TK5** (PAL plays at NTSC rate) rather than touching the worklet, which K3 forbids |

Not absorbed, still deferred (unchanged from Phase 1): asset-regeneration tooling gaps,
knob wheel `deltaMode`, scope extreme-row rounding, `motion.svelte.ts` listener cleanup.

### 7.3 risks, and what we do about them

| risk | mitigation |
|---|---|
| Main-thread driver stalls behind a grid repaint | §4.3's dirty-flag repaint keeps the grid off the critical path; §2.5's 120 ms lookahead is 6× the pump; the failure is a bounded stutter that self-corrects (§2.1) because tick→cycle is absolute. The `[drv]` chip makes it visible rather than mysterious |
| Undocumented FamiTracker internals (order of operations, volume rounding, vibrato table, fixed-arp) | Every one is marked **[ours]** or **[snippet]** in §3, pinned by a test, and listed in `docs/deviations.md` as D-TK3/D-TK4. A future contributor with a working famitracker.com wiki has an exact list of what to check and a test that will tell them if they changed it |
| Scope creep in WP9 (model + IO + driver + macros + effects + DPCM) | §3.7 names the single cut line (driver DPCM triggering) in advance, and §6.3 makes WP9 publish its two interface files first so WP10/WP11 are never blocked by WP9's tail |
| The tracker panel degrading the live-play shell | WP10's gate includes "every Phase-1 behaviour still passes with the panel closed"; the panel is opt-in behind a chip |
| Preset tracks that pass every gate and still sound bad | Gates are a floor, not a ceiling. §5.3's voicing brief is the actual quality instrument, and the lead session listens to all four before the phase closes — stated here so nobody mistakes the automated gates for a substitute for ears |

---

## 8. summary of decisions

1. **Driver threading**: main thread; `EngineHandle` stays the single ring producer;
   `TrackerDriver` and `LiveScheduler` are two callers with a strict one-owner-at-a-time
   rule and an explicit ordered handoff. Worker escalation is designed for but not taken.
2. **Live coexistence (Rule L)**: stopped → live play owns the timeline with Phase-1
   latency, unchanged. Playing → the driver owns it and live input steals the editor's
   cursor channel; recorded rows use the input event's real timestamp, so quantization is
   unaffected by the 120 ms lookahead.
3. **Tempo**: `cycleOfTick(n) = origin + floor(n·clockRate/engineHz)` (closed form, cannot
   drift); rows advance on an integer Bresenham accumulator over `num = 5ES`, `den = 2T`
   that reproduces FamiTracker's documented `6,6,5,6,6,5,6,5` groove at tempo 160 exactly.
4. **Format v1**: one flat versioned JSON document — sparse rows, per-channel patterns,
   shared-by-index sequence banks, character-keyed effects, verbatim `extra` round-trip.
5. **Effects**: all of Tier 1 plus `7xy`, `Pxx`, `Sxx`, `Qxy`/`Rxy`, `Vxx`; hardware sweep,
   DPCM effects and `Exx` deferred with stated reasons.
6. **Grid**: canvas, dirty-flag repaint, offscreen DOM semantic model, `role="grid"` +
   `aria-activedescendant`, tokens read from CSS not mirrored.
7. **Undo/redo**: in Phase 2, as a pure command stack over the immutable document.
8. **Presets**: four, in `src/assets/songs/` imported statically, with a four-gate
   earless QA suite; the offline renderer ships in `src/tracker/offlineRender.ts` because
   Phase 3's WAV export is the same function.
9. **Zero new runtime dependencies. Nothing in `src/audio/{core,dsp,worklet,protocol}` or
   `timeline/types.ts` changes.** The only additive host-side APIs are
   `LiveScheduler.reset()` and `EngineHandle.pending`.

