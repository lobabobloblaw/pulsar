# the composer's library

Write a piece as a committed generator script; ship its JSON. `docs/preset-suite.md` §12
is the annex that sanctions this and says why. `lib.mjs` is the only import a generator
needs — zero dependencies, node ≥ 22, nothing under `src/`.

```
tools/songs/compose/
  lib.mjs        the API below (Song, n, hex, nib, CUT, REL, L)
  notes.mjs      note names, lane indices, hardware floors, the album effect set
  bank.mjs       tests/fixtures/songs/shared-bank.json, read and copied verbatim
  section.mjs    the Section grid and its setters
  build.mjs      order flattening, the loop seam, the channel prefix
  serialize.mjs  serializeSong's exact byte shape
  sticky.mjs     the channel modes a note trigger does not clear, and their cancels
  check.mjs      the structural pre-flight
  analyse.mjs    the facts report.mjs prints
  wav.mjs        PCM16 reading, RMS/peak/zero-crossings
  report.mjs     the report tool
  examples/demo.mjs  a working generator that uses every helper
```

## the loop, end to end

```bash
node tools/songs/compose/15-my-piece.mjs                  # writes src/assets/songs/15-my-piece.json
pnpm test tests/unit/presets.test.ts tests/unit/soundtrack.test.ts
PULSAR_PREVIEW_ONLY=my-piece pnpm preview:songs           # previews/my-piece.wav + a level line
node tools/songs/compose/report.mjs src/assets/songs/15-my-piece.json previews/my-piece.wav
```

Gate C prints the render checksum it wanted:

```
add "renderChecksum": 602407995 to extra.qa (this render's FNV-1a)
```

Paste that number into the generator's `s.qa({ … renderChecksum: 602407995 })`, re-run the
generator, re-run the gates. The committed JSON must be byte-identical to what the
generator writes — gate A proves the round trip, and that is the whole point of the
arrangement: **never hand-edit the JSON.** Any change to the piece changes the checksum,
so the pin and the music always move in the same commit.

## the API

```js
import { Song, n, CUT, REL, L } from './lib.mjs'
// L = { P1:0, P2:1, TRI:2, NOISE:3, DPCM:4, V1:5, V2:6, SAW:7 }

const s = new Song({ id: 'my-piece', name: 'My Piece', author: '…', speed: 5,
                     rowsPerPattern: 64, rowHighlight: 4, rowHighlight2: 16 })
// tempo is always 150 and engineSpeed 60 (the even-tick condition, §1); region ntsc.
// BPM = 24 · 150 / (speed · rowHighlight); `s.bpm` is that number.

const [KICK, SNARE, HAT] = s.bank('kick', 'snare', 'hat-closed')  // shared bank, by name
const LEAD = s.instrument('lead', { volume: { values: [15, 14, 13], loop: 2 },
                                    duty:   { values: [3, 3, 2] },
                                    pitch:  { values: [-3, -1, 0] },
                                    arpeggio: { values: [0, 4, 7], mode: 'fixed' } })
const KIT  = s.dpcmKit()               // { inst, kick: 36, snare: 39, notes }

const A = s.section('A', 4)            // 4 bars; rows = 4 · rowHighlight2; eight lanes, null
A.put(L.P1, row, { note: n('e4'), inst: LEAD, vol: 12, fx: [['4', 0x32]] })
A.line(L.P1, LEAD, 12, [[bar, row, 'e4'], [bar, row, 'g4', '4', 0x32], [bar, row, '---']])
A.hits(L.NOISE, KICK, 13, [[0, 0], [0, 8], [1, 0]])
A.hits(L.DPCM, KIT.inst, 15, [[0, 0]], KIT.kick)
A.chord(L.V2, PAD, 10, bar, row, 'c4', [4, 7])     // 0xy triad: 047 -> param 71
A.fx(L.SAW, bar, row, 'A', 0x20)                   // effect-only cell
A.echo(L.P1, L.P2, 3, ECHO, 8)                     // §2.2, three rows behind, quieter

s.order(['intro', 'intro', 'A', 'A', 'B', 'B', 'A'])
s.loopTo('A')
s.qa({ key: 'e-minor', bpmRange: [178, 182], durationSec: [120, 135], notes: '…',
       percussionGap: 8, renderChecksum: 0 })
s.check()
s.write('src/assets/songs/15-my-piece.json')
```

Helpers: `n('c#4')` → 61 (c4 = 60), `n('---')` → `CUT`, `n('===')` → `REL`;
`hex(0x47)` and `hex('047')` → 71; `nib(4, 7)` → 71; `noteName(64)` → `'e4'`;
`s.at(bar, row)` and `section.at(bar, row)` → the absolute row, from `rowHighlight2`.

## what is derived, and what you must declare

Derived — do not pass these to `qa()`, they are overwritten:

| field | from |
|---|---|
| `channels` (both the document prefix and `qa.channels`) | the lanes that carry attacks; reaching a VRC6 lane pulls the empty `dpcm` lane in with it |
| `effectColumns` | the widest effect cell on each lane |
| `qa.effects` | every command actually written, sorted |
| `qa.form` | one label per frame, from the section names in `order()` |
| `qa.loopFrame` | the first frame of the section `loopTo()` names |
| `qa.bank` | the shared-bank instruments the piece carries, and the fixture's `rev` |
| patterns, and their indices | identical per-lane patterns are de-duplicated across the order |
| sequence banks | identical macro values share one entry |
| the instrument table | an instrument nothing plays is dropped, and the rest are renumbered |

Declared — nobody can derive these, and the lint wants them:
`key`, `bpmRange`, `durationSec`, `notes`, and any of `accidentalFractionMax`,
`rmsRange`, `clippedSamplesMax`, `percussionGap`, `percussionMinEvents`,
`percussionCoverage`, `motif`, `renderChecksum`. Every raised bound and every declared
allowance needs a sentence in `notes` — `check()` says so, and so does the lint.

## what `check()` catches

One code per fault; `tests/unit/compose.test.ts` proves each one can fire.

| code | what it means |
|---|---|
| `pulse-floor` | a 2A03 pulse note under MIDI 33 — it renders as a1, silently, with no error |
| `triangle-floor` / `vrc6-floor` | under MIDI 21 (triangle, VRC6 pulses) or 24 (VRC6 saw) |
| `noise-window` | a noise note outside 32–47, where `period index = 47 − note` wraps |
| `note-range` | above MIDI 119 |
| `vrc6-duty` | a duty value above 7 — bit 3 is the mode bit: constant output, a click, silence |
| `pulse-duty` / `noise-duty` | a duty above 3 on a 2A03 pulse, or above 1 on the noise mode bit |
| `effect-unsupported` | an effect outside `0 1 2 3 4 7 A B D F G P Q R S V`. `Cxx` halts playback |
| `param-decimal` | a param that is not an integer 0–255. Params on disk are DECIMAL |
| `effect-columns` | more than four effects in one cell |
| `pitch-tail` | a pitch/hiPitch macro not ending on 0, or a loop segment that does not sum to 0 — pitch macros ACCUMULATE |
| `noise-envelope` | a noise volume macro that loops or does not end on 0 — the lane never releases |
| `instrument-name` | a name that is neither the shared bank's values nor `x-<id>-…` |
| `loop-row` | a lane that sounds but states nothing at the loop row (§2.9) |
| `sticky-latched` | a channel mode still latched at the end of the order — pass 2 starts under it (§12.5) |
| `sticky-loop` | a channel mode that reaches the loop row latched, which the loop row does not state |
| `thin-lane` | a claimed lane with fewer than eight attacks; the lint refuses it |
| `bpm-range` / `qa-missing` / `qa-justification` | the declared block does not match the document, or is incomplete |

`check()` does **not** judge music, and it does not check percussion coverage, render
level, clipping or duration — those need a render. `report.mjs` prints the percussion
numbers and the preview levels; gates B and C decide.

## reading the report

```
node tools/songs/compose/report.mjs <song.json> [preview.wav]
```

Facts only. It never calls a piece thin, loud or repetitive.

- **notes per lane** — attacks, cuts, releases and the note range each lane occupies.
  Ranges that sit on top of each other are two voices fighting for one register (§2.1).
- **attacks per frame** — the density map. A lane that never rests, and a section that
  never changes, are both visible here as a flat column.
- **effects per lane** — which commands each lane uses and how often. A lane with no
  effects at all is a lane with no articulation.
- **volume column** — the distribution per lane, the share of attacks at 15, and how many
  distinct values the lane ever asks for. `distinct 1` on a melodic lane means the piece
  has no dynamics on it (§2.8); the triangle is a gate, so 15 everywhere is correct there.
- **key** — melodic notes outside `qa.key`, total and per lane, against the declared cap.
- **percussion** — event count, the longest noise gap in rows, and the coverage figure
  the lint computes, in the lint's own arithmetic.
- **loop row** — what every lane states at the seam (§2.9 rule 2).
- **preview** — whole-file RMS and peak; RMS, peak and at-or-over-full-scale counts per
  5 s; then per form section: start, length, RMS and a zero-crossing rate as a crude
  brightness proxy. int16 has already clamped, so the full-scale count is an *estimate*
  of the excursion, not a clip count — but it matched the renderer's own `clippedSamples`
  on the piece it was developed against.

Headroom: gate C allows ≤ 8 clamped samples unless the song declares
`clippedSamplesMax` with a justification. If the preview shows clipping, lower the
arrangement (the VRC6 sawtooth first — vol 15 on the saw is roughly twice a pulse at 15),
do not re-gain it.

## the delivery checklist

- [ ] the generator lives at `tools/songs/compose/NN-<id>.mjs`, imports `lib.mjs`, runs
      with `node`, and writes `src/assets/songs/NN-<id>.json`
- [ ] the generator IS the composition: named sections, named motifs, and a comment on
      each lane in each section saying what it does and why. A reader follows the form.
- [ ] `pnpm test tests/unit/presets.test.ts tests/unit/soundtrack.test.ts` green
- [ ] the piece's own pins added to `tests/unit/soundtrack.test.ts` — the signature
      devices at `frame:row`, the things that make it itself
- [ ] `renderChecksum` pasted from gate C, generator re-run, JSON byte-identical
- [ ] a catalog row and a paragraph in `docs/soundtrack.md`, naming no game, composer or
      published piece
- [ ] a self-score on preset-suite §6 / §9.5 with `frame:row` evidence for axes 7 and 11

## things the API does not say

- **Octaves take no separator.** `n('a4')`, `n('c#5')`, `n('c-1')` (octave minus one).
  FamiTracker's `A-4` throws rather than reading as octave minus four.
- **`hits()` without a note** uses the instrument's registered note: preset-suite §3.4's
  kit table for a shared-bank drum (kick 36, snare 39, tom 37, hat-closed 45, hat-open 46,
  crash 46, metal 44, rim 44), or whatever `s.instrument(name, { note })` declared. The
  `note` field is an authoring default and never reaches the file.
- **Every channel mode you turn on is turned off in the section that turned it on** —
  `0xy` (which is what `chord()` writes), `1xx`/`2xx`, `3xx`, `4xy`, `7xy`, `Axy` and
  `Pxx` latch per channel and survive the note, the pattern, the frame and the loop
  (preset-suite §12.5), so the library cancels each on the next bare `line()` event on
  that lane and, failing that, on the section's last row — and `check()` refuses a piece
  that ends the order, or reaches the loop row, with one still standing.
- **The cancel is the one the DRIVER honours, not a zero param.** `sticky.mjs` holds the
  table: `000`, `100`/`200`, `4x0`, `A00`, `P80` — but `300` only FREEZES the portamento
  (cancel it with `100`) and `700` REPLAYS the last tremolo depth (cancel it with `7x0`,
  x > 0). `Vxx` has no off value at all, so the library cannot police it; state it on the
  loop row if you use it. `put()` writes exactly what you say and nothing else.
- **`put(lane, row, …)` takes an ABSOLUTE row** inside the section; `line`, `hits`,
  `chord` and `fx` take `bar, row`. `at(bar, row)` converts.
- **`order()` names sections, not frames.** A section longer than one pattern becomes
  consecutive frames; a section named twice is written out twice and the two copies are
  independent from then on, which is why the loop `Bxx` lands on the last frame only.
- **A section's rows must be a whole number of patterns.** `bars · rowHighlight2` must
  divide by `rowsPerPattern` — at 64/16 that is sections of 4, 8, 12 … bars.
- **`write()` runs `check()` first** and refuses to write a faulty file. `write(path,
  { check: false })` skips it; `{ quiet: true }` silences the summary line.
