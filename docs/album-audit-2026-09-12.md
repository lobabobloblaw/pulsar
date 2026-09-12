# Album audit — twelve pieces, 2026-09-12

Two complaints were reported against the shipped album: *beats desynchronise and later
resolve themselves*, and *the harmonies have an algorithmic feel*. Both are real. They
have different causes, they live in different tracks, and only the first was a defect.

Everything below is measured off the shipped song JSON. The harness is transient; the
one durable result is `check.mjs`'s new `loop-metre` rule, which refuses the defect.

## 1. The beat really does slip — and it was three tracks, not twelve

The driver does not drift. `tempo` is 150 and `engineSpeed` 60 in every piece, so
`ticksPerRow = 2.5·E·S/T` is an exact integer, the Bresenham accumulator never
alternates, and `cycleOfTick` is a closed form. Nothing in the audio path can lose time.

The slip was written into the score. Three pieces carried a `Dxx` pattern break that cut
a frame by **one beat rather than a whole bar**:

| | cut | frame plays | loop body | that is | slips per pass | back in phase after |
|---|---|---|---|---|---|---|
| Crooked Mile | `D00` at 15:51 | 52 of 56 rows | 1060 rows | 75.71 bars of 14 | 10 rows = 2.5 beats | 7 passes |
| Night Shift | `D00` at 16:55 | 56 of 64 rows | 1400 rows | 43.75 bars of 32 | 24 rows = 3 beats | 4 passes |
| Headlong | `D00` at 39:41 | 42 of 48 rows | 2346 rows | 195.50 bars of 12 | 6 rows = 1 beat | 2 passes |

A cut that is not a whole bar leaves the loop body a fraction of a bar long. Each pass
therefore re-enters the music that fraction away from the pulse the listener entrained on
the pass before, and the metre only recovers after `bar / gcd(remainder, bar)` passes.
That is the reported symptom exactly: the beat slips, and some minutes later it sorts
itself out. The preview WAVs hold two passes, so the seam is audible in them.

Within a single pass the cut is a legitimate elision — the whole ensemble moves together
and the ear re-anchors. The defect is only that the device never closes.

**The fix cost no written music.** In all three pieces the rows the cut discarded were
empty on every lane: the music was written to end at the cut and the cut swallowed the
remainder. Removing it gives:

- **Crooked Mile** — 1064 rows, exactly 76 bars. The accelerating snare roll in `climb`
  now simply ends, and one beat of air carries into `crest`.
- **Night Shift** — 1408 rows, exactly 44 bars. `graveyard` also had a clean-up loop
  blanking the rows past the cut; removing both restores a real backbeat (DPCM snare at
  vol 14, hats at 56 and 60) on the last beat, so the kit walks into the `lift`.
- **Headlong** — 2352 rows, exactly 196 bars, which is also the bar count the piece has
  always claimed. `stall` now stalls: the brake roll stops and one beat of silence stands
  before the theme returns.

The other nine pieces close on a bar line and always did. Tailwind and Counterweight both
use `D00` too — but each cuts a whole number of bars (32 rows = 2 bars, 32 rows = 1 bar),
which is why their grids stayed intact. That is the distinction the new rule draws.

### The guard

`tools/songs/compose/check.mjs` gained `loop-metre`. It walks the order from the loop
frame, truncates each frame at its first `Dxx`/`Bxx`, and refuses the piece if the total
is not a multiple of `rowHighlight2`. It reports the remainder, the slip in beats and how
many passes the metre would take to recover. Run against the twelve it fires on exactly
the three above and on nothing else.

## 2. Tide Tables' latched modes are the composition, not a defect

An earlier draft of this audit reported four channel modes in Tide Tables still latched when
the order ends — two `4xy` vibratos, a `3xx` portamento and a `7xy` tremolo, none of them ever
cancelled — and called it a defect needing a cancel on the loop row. **That was wrong, and no
change was made.**

The findings are real, but the project had already found, measured and kept them.
`stickyLint` (gate B2) reports them, `KNOWN_STICKY['tide-tables']` in
`tests/unit/presets.test.ts` pins them, and `docs/preset-suite.md` §12.5 records the decision:
**RESOLVED, 2026-09-11 — they are the composition.** The port was audited against OCTET's own
engine first. Both engines carry vibrato and tremolo across the loop the same way, so the
behaviour crossed the port one for one and there is nothing for `applyEngineDifferences` to
correct — cancelling them would be re-composing a port, which `tools/songs/octet/README.md`
rules out. The pin guards the music in both directions: cancelling any of them fails gate B2.

Two of the draft's claims were also overstated, measured on prototypes during the check:

- Only the sawtooth's tremolo is audible across passes. Both vibrato lanes render
  **bit-identical** over two passes, because frame 6 restarts each vibrato with a new note.
- A cancel on the loop row alone would not have cleared the finding: the check reads the
  state at the end of the order, so the `B00` row would need cancels too.

If the later passes should ever match the first exactly, that is a decision to reverse
§12.5, not a correction — and it would leave untouched the larger thing §12.5 describes,
33 notes playing under a vibrato set five sections earlier.

## 3. The phasing cells are deliberate, and mostly earn their keep

Every piece composed here carries an ostinato on a cell that does not divide the bar —
five rows, six rows, three rows, twenty rows — carried across three to five frames with
its phase deliberately unreset. That is the reported "desynchronisation" in the tracks
that do *not* have the `Dxx` defect, and it is working as designed.

It survives the obvious objection. A phasing figure is only heard as phasing if the metre
is audible underneath it; measured bar by bar, a timekeeping lane (noise, DPCM, triangle
or sawtooth) plays under the cell in every bar of the album but eight — Cathedral of
Gears' intro (bars 1, 3, 5) and coda (81, 83, 85), Tide Tables' `one note` at 14:0, and
Long Light's `descent` at 15:48, the last two carrying one attack apiece. So the ear
almost always has something to hear the cell against.

Two observations worth weighing:

- **Long Light ran one cell for 88 % of its bars** (56 of 64) — the five-row bell, the
  only off-grid figure in the piece. By design, and stated as the spine, but a very large
  share of one device and the piece most likely to read as drift. It now rests for two
  bars at 5:32 and three at 9:16, placed at a phrase end and inside a falling-fifths
  sequence, with the grid counting on through both: 51 of 64 bars, 80 %.
  Crooked Mile's apparent 79 % is an artefact of asymmetric metre: a four-row quarter note
  does not divide a fourteen-row bar, so ordinary quarters register as off-grid. Its only
  real device is the three-row cell on vrc6p1 across frames 1–3.
- **Four pieces use the identical gesture** — a bar in which the kit stops and only the
  phasing cell keeps time (Sunward Banner 15:48, Winding Stair 21:0, Blue Hour 10:0, Long
  Light 10:48). Each is stated as *the* metric surprise of its piece. Across an album it
  is a formula, and it is the one place where the reference pulse is deliberately removed.

## 4. The harmony: the complaint is real, and it is concentrated

Measured on a beat grid, merging chord spans by root so an ornament cannot invent a chord:

| track | round | voicing reuse | non-chord tones | bass stepwise | bass root/octave | locked doublings | changes on barline | longest 4-chord loop |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Skyline Run | port | **57 %** | 3 % | **2 %** | **90 %** | 0 | 44 % | 3× |
| Cathedral of Gears | port | 36 % | 7 % | 3 % | 76 % | 1 | 64 % | 2× |
| Tide Tables | port | 47 % | **1 %** | 19 % | 27 % | 0 | 71 % | 1× |
| Tailwind | r1 | 32 → 16 % | 6 → 12 % | 10 → 44 % | 82 → 38 % | 1 → 0 | 67 → 43 % | 3× |
| Counterweight | r1 | 45 → 30 % | 17 % | 36 % | 55 % | **8 → 1** | 31 → 34 % | **6× → 3×** |
| Sunward Banner | r1 | 21 → 12 % | 3 → 9 % | 7 → 53 % | 77 → 10 % | 1 | 62 → 48 % | 1× |
| Winding Stair | r2 | 13 % | 10 % | 16 % | 49 % | 1 | 60 % | 2× |
| Blue Hour | r2 | 7 % | 24 % | 47 % | 1 % | 0 | 28 % | 1× |
| Long Light | r2 | 10 → 9 % | 8 → 9 % | 30 % | 6 % | 0 | 41 → 39 % | 1× |
| Crooked Mile | r3 | 2 % | 13 % | 36 % | 5 % | 0 | 22 % | 1× |
| Night Shift | r3 | 14 % | 9 % | 12 % | 21 % | 1 | 37 % | 2× |
| Headlong | r3 | 8 % | 9 % | 12 % | 14 % | 1 | 58 % | 2× |

*Voicing reuse* is the share of chord occurrences whose exact pitch set has already been
used for that chord. *Locked doublings* are lane pairs holding one fixed interval on more
than 55 % of their shared attack rows. Arrows are before → after the revisions in §6;
the three ports are unchanged.

**Voicing reuse falls monotonically by round**: ports 57/36/47, round 1 32/45/21, round 2
13/7/10, round 3 2/14/8. The craft curve is visible in the numbers. The algorithmic feel
is not spread across the album — it is the first six tracks, and rounds 2 and 3 already
solved it.

### The three things that actually produce the feeling

**A bass that spells chords instead of walking.** This is the clearest single cause.

| | bars where the bass plays exactly 1 pitch | exactly 2 |
|---|---|---|
| Tailwind | **75 %** | 2 % |
| Skyline Run | 0 % | **79 %** |
| Sunward Banner | 16 % | **58 %** |

Tailwind's `pre` is the illustration: twelve attacks a bar, and every one of them is the
same note — `g2 ×12`, then `f#2 ×12`, then `e2 ×12`, then `g2 ×12`. The gallop rhythm is
good; the pitch content is one chord symbol per bar with a rhythm stamped over it. Skyline
Run and Sunward Banner do the same thing with root-and-octave instead of one note (90 %
and 77 % of their bass motion is a repeat or an octave leap; 2 % and 7 % is stepwise).

This is the amateur tell the reference names first — "root notes only on the downbeat
instead of an active, stepwise, syncopated line — the single biggest difference between
amateur and Konami/Capcom-grade tracks" — and Hooktheory's high Chord-Bass-Melody scores
on the model repertoire measure exactly the property these three lack. Blue Hour proves
the album can do it: 47 % stepwise, 1 % root/octave, all twelve pitch classes.

**Every note a chord tone.** Tide Tables 1 %, Skyline Run 3 %, Sunward Banner 3 %,
Tailwind 6 %. A line with no suspension, passing tone or appoggiatura sounds like a chart
being realised rather than a voice being sung. Blue Hour runs 24 %, Counterweight 17 %,
Crooked Mile 13 %.

**Chords that always wear the same clothes.** Skyline Run's A minor appears on 27 beats
and takes only 7 distinct voicings; one of them — `a1 a2 c5 e5` — is used on 9 separate
beats, pitch for pitch. Its A5 gets 37 beats and 10 voicings. Tailwind's problem is
narrower and only at its pillars: `E5` is voiced `e2 e3 e4 e5` on 9 separate beats, but
its A major gets 47 beats across 31 distinct voicings, which is healthy.

**Counterweight is a different failure.** Its voicing reuse is bad (45 %) for one reason:
eight lane pairs are welded. The triangle and sawtooth run in octaves on 95 % of shared
attacks, vrc6p1 and vrc6p2 on 99 %, triangle and vrc6p2 in *unison* on 98 %, vrc6p2 and
sawtooth on 83 %. Four of eight voices are one line. It also runs a single four-chord
cycle six times. As a wall for a boss theme that is a deliberate effect; as harmony it
means the eight-voice machine is playing about three parts.

### What is *not* wrong

- **Literal repetition is absent.** Ten of twelve pieces have no order frame whose eight
  pattern indices repeat an earlier frame's; Skyline Run has 7 %, Counterweight 9 %. The
  "no variation between repetitions" failure is not present.
- **The bar is not unmarked.** An earlier reading that Skyline Run and Headlong fail to
  privilege the downbeat was an artefact of weighting onsets: both run a backbeat kit
  (kick on 1 and 3, snare on 2 and 4), which weights all four beats equally by
  construction and is perfectly legible.
- **Voice leading is good everywhere.** Mean nearest-tone motion is 0.72–1.04 semitones
  across all twelve, and 69–97 % of chord changes keep a common tone.

## 5. Verification of the fix

```
pnpm test        75 files, 1240 passed, 14 skipped
pnpm typecheck   178 files, 0 errors
PULSAR_PREVIEW_ONLY=crooked-mile,night-shift,headlong pnpm preview:songs

id              dur      rms     peak  clip  checksum
crooked-mile    254.8s  -19.56  0.891     0  1231770164
night-shift     245.3s  -24.11  0.679     0  2992020422
headlong        240.0s  -18.58  0.741     0  130968323
```

The rendered durations confirm the row arithmetic independently. A preview is one whole
order followed by one loop body, so Crooked Mile is 1120 + 1064 = 2184 rows at 116.67 ms
= 254.8 s, Night Shift 1536 + 1408 = 2944 at 83.33 ms = 245.3 s, and Headlong 2448 + 2352
= 4800 at 50 ms = 240.0 s. All three match the renderer to the tenth of a second, and all
three checksums match the pins.

## 6. What was changed

**Timing — three pieces.** The `D00` cuts in Crooked Mile, Night Shift and Headlong were
removed (§1). `check.mjs` gained `loop-metre`.

**Tailwind — the gallop walks.** `gallop()` used to stamp one root onto all twelve
attacks of a bar. Each bar is now written from a figure: chord tones on the beats with the
root on 1 and 3, scale steps on the 16ths between them, and the last two attacks leaning by
step into the next bar's bass. Borrowed chords walk in their own scale. The attack rows,
volumes and instruments are identical to before — only pitches moved (345 on the saw, 183 on
the triangle, which now echoes the line rather than doubling a root). One-pitch bars fell
from 75 % to 6 %, and the ones left are deliberate pedals. Six prepared suspensions were
added: 4–3 over E7 at 4:32→4:52 and 8:32→8:52, at the pre-chorus half cadence 10:0→10:20,
and 9–8s at 12:60→13:4, 20:60→21:4 and 18:24→18:36.

**Sunward Banner — the pump walks.** The root-and-octave `sawBar` became `sawLine`, which
writes each bar from ten named figures and refuses a figure that puts a non-chord tone on a
beat or leaves one other than by step. About one bar in two keeps an octave leap, so the
anthem's character survives. Octave motion fell from 45 % to 8 %, stepwise rose from 7 % to
53 %, and the peak fell from 0.909 to 0.889. Four prepared 9–8 suspensions sound at six
places (0:48, 11:48, 13:0, 18:0, and 19:48 and 21:0 a step up); the fanfare's 4–3 at 0:32,
described as prepared but not, now is.

**Counterweight — the texture unwelded.** The sawtooth–triangle octave riff is the one lock
kept, deliberately. vrc6p2 strikes the fifths while vrc6p1 holds each chord's third or
seventh; phase 2's vrc6p2 plays an inner line of held notes instead of doubling the inverted
riff. The riff cell, never changed, is now heard under three harmonisations (2:0 and 4:0 as
written; `D Bb D A7 | Gm F Eb A7` at 6:0 and 36:0; `Dm Cm Bb A7 | Gm C7 F7 Bb` at 8:0 and
38:0). A pre-existing fault was found and fixed on the way: riff A′ left vrc6p1 on a c#4 whose
instrument loops its volume, so with no cut it rang for 364 rows — 18.2 s, the whole bridge
the comments call silent — a major seventh over the sawtooth's D1 pedal.

**Long Light — the bell rests.** §3.

**Tide Tables — not changed.** §2.

**Prose.** Every published level these renders moved was re-measured and corrected. Several
section figures after a removed cut had been measured on `report.mjs` section windows that
drifted past the `Dxx` — the tool prints a warning when that happens — so the corrected
figures for Crooked Mile's `climb`, `crest` and `turn` and Night Shift's `A″` and `turn` are
exact where the old ones were not. Counterweight's brightness claim was narrowed to what
still holds: the brightest of the six sections between the alarm and the turn, not of all.

### Verification

```
pnpm test        75 files · 1247 passed · 14 skipped
pnpm typecheck   178 files · 0 errors
every generator reproduces its committed JSON byte for byte
every render checksum matches its pin; zero clamped samples except Cathedral of Gears'
declared 38
```

### Left as it is

- **Skyline Run** has the album's weakest bass (2 % stepwise, 90 % root or octave) and the
  highest voicing reuse (57 %). It is a port, and a module that moved a voice would be
  changing another project's music.
- **Tailwind's peak rose from 0.882 to 0.951** with no volume raised and zero clamped
  samples. Gate C passes and live playback is the same renderer, so nothing was lowered;
  the chorus sawtooth from 11 to 10 is the lever if more margin is wanted.
- **About 25 weak-eighth passing notes in Sunward Banner** still rub briefly against a held
  upper voice. The harsh ones — simultaneous, chromatic against their natural, or against
  two voices — were removed; the rest are ordinary walking-bass passing dissonance.
