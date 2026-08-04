# the preset suite — style bible, piece briefs, production pipeline

**Status:** design. This document is the brief composer agents execute. It ADDS eight
original album pieces to the four technique-demo tracks of `phase2-design.md` §5; those
four are unchanged and remain the effect-coverage regression net.

**Read before writing a note:** `docs/phase2-design.md` §1 (song JSON v1 — the only
format), §2.3 (tempo), §3 (macro + effect semantics), §5 (demo tracks + QA gates);
`docs/register-timeline.md`; `docs/deviations.md`.

---

## 0. ground rules — non-negotiable

**0.1 ORIGINAL MUSIC ONLY.** Every melody, bass line, counter-line, chord progression,
drum pattern and form in this suite is invented for this project. "Inspired by classic
chiptune" means **idiom, technique, form and energy** — the craft vocabulary in §2 — and
nothing else. Game soundtracks are copyrighted; so are their melodies and their
characteristic progressions.

Forbidden, without exception:

- Quoting, transcribing, paraphrasing or "reharmonising" a melody, riff, bass line or
  chord-for-chord progression from any existing work.
- Briefs, prompts or commit messages of the form "in the style of «specific song»",
  "like the theme from «game»", "«composer»'s «piece» but in C". A brief that names a
  work invites reproduction; that is why **no brief in §4 names one**.
- Recognisable phrases. If a listener could say "that's the X theme", it is a defect,
  regardless of how it got there. Composer agents must not reach for remembered material;
  invent from the harmonic and contour rules in §2.10.

Permitted and encouraged: eras, moods, functions and techniques —
"driving 1989-action-platformer energy", "the descending-bass lament idiom",
"a three-note motif answered by its inversion", "echo canon on pulse 2".

**0.2 MIT-shippable.** These songs ship in the repo under the project licence as
project-original works. No sample is lifted from any ROM or recording; the DPCM bank in
§3.5 is synthesised from arithmetic described here. `NOTICE.md` gains one line: the preset
songs are original compositions authored for pulsar.

**0.3 Executable as written.** Every brief must be hand-authorable in song JSON v1 and
must pass the §5.5 deterministic gates. If a brief cannot be expressed in the format, the
brief is wrong — report it, do not extend the format.

**0.4 Five voices, maximum, forever.** pulse1, pulse2, triangle, noise, dpcm. There is no
sixth. Every arrangement decision in §2 is downstream of that number.

---

## 1. the machine, honestly — what constrains the music

These are measured facts about *this* engine, not general NES lore. They are the ones that
change what you can write.

| fact | consequence for the composer |
|---|---|
| **Pulse pitch floor.** `pulseTimerForMidi` clamps the timer to 8..2047; timer 2047 = 54.6 Hz. | **Never write a pulse note below MIDI 33 (a1, 55 Hz).** MIDI 32 and below silently render as a1 — wrong pitch, no error. Pulse ceiling: timer 8 = 12 429 Hz (MIDI 123); irrelevant musically. |
| **Triangle range** is a factor of two lower: `f = fCPU / (32·(t+1))`, floor 27.3 Hz. | Triangle reaches **MIDI 21 (a0)**. That octave below the pulse floor is the album's real bass register. Practical bass writing: MIDI 24–52. |
| **Triangle has no volume** (D-T1, §3.3): composed volume is a **gate**, 0 = off, >0 = full. | `Axy`, `7xy` and volume macros on triangle are on/off switches. Triangle dynamics are *rhythmic and registral*, never level. A sustained triangle pad is a wall — see §2.1. |
| **Triangle attack latency:** a fresh note is silent until the next quarter-frame clock (≤ 4.17 ms). | Triangle has a soft front. It cannot be the sharpest thing in a groove; noise or a pulse stab must define the transient. |
| **Noise "pitch" wraps.** `noisePeriodIndex(note) = 15 − (note mod 16)`. Higher note = higher pitch, but **the map wraps every 16 semitones**. | A drum's **arpeggio** macro (which offsets the *note*) crossing a mod-16 boundary jumps from lowest to highest pitch. Keep every noise instrument's note + arpeggio excursion inside one 16-semitone window. |
| **Noise pitch macros do NOT wrap.** `pitch`/`hiPitch`/`1xx`/`2xx`/`Pxx` add to the *index* and clamp to 0..15. | **Use the `pitch` macro, not the arpeggio macro, for drum period sweeps.** This is the single most useful engine fact in the kit design (§3.4). |
| **Pitch macros ACCUMULATE** (§3.4): `pitchAccum += value` every tick, reset only on trigger. | **Every pitch macro must end on 0**, or the note drifts forever while held. A macro with no loop point holds its last value — hold `0`, not `+4`. |
| **`hiPitch` counts ×16.** | Coarse-only. On noise, one `hiPitch` step blows through the whole 0..15 index. Do not use hiPitch on noise. |
| **DPCM is the fifth voice and it ducks the other two.** DMC, triangle and noise share one mixer index (`3·tri + 2·noise + dmc`). | Loud DPCM audibly pulls the triangle and noise down. This is real hardware behaviour and a **mix tool** (§2.8), but it means a busy DPCM lane costs bass presence. |
| **DPCM level persists** after a sample finishes — the DAC holds wherever the sample left it. | Every DPCM assignment sets an explicit `delta` preload so each hit starts from a known level, and samples are authored to end near their start level (§3.5). |
| **DPCM: 16 rate indices, 1-bit delta, samples 16n+1 bytes.** `buildDpcmImage` packs them 64-byte aligned from `$C000`. | Two samples for the whole album (§3.5). A sample bank is bundle weight in `src/assets/songs/*.json`; keep it under ~600 bytes decoded, total. |
| **Even ticks-per-row iff `tempo === 2.5 · engineSpeed`** = 150 at NTSC (§2.3). | **Keep `tempo: 150` and vary `speed`** unless the piece is deliberately swung. Two album pieces are (§4). |
| **BPM = `24·T / (S · rowHighlight)`.** | With T=150, rowHighlight=4: S=5→180, 6→150, 7→128.6, 8→112.5, 9→100, 10→90 BPM. |
| **Supported effects, exhaustively:** `0 1 2 3 4 7 A B C D F G P Q R S V`. | Anything else is a load-time warning and is ignored by the driver. `Hxy/Ixy/Wxx/Xxx/Yxx/Zxx/Exx/Oxx` do not exist here (§3.6). |
| **`Axy` direction is inverted:** `x` slides DOWN, `y` slides UP, in eighths of a volume step. | **`Ax0` fades, `A0y` swells** — the opposite of the ProTracker habit. The column is tracked at 8× (0..120) and moves `y − x` per tick from tick 1, so at 6 ticks/row `A20` fades a full-volume note to silence in ~10 rows and `A03` swells 0 → full in ~7. |
| **A note sharing a row with `3xx`/`Qxy`/`Rxy` does NOT retrigger.** | This is how you write legato. It is also how you accidentally kill an attack. |
| **Per-tick effects contribute nothing on tick 0** (`1xx 2xx 3xx Axy 7xy Qxy Rxy`); table effects do (`0xy 4xy Pxx Vxx`). | A slide starts on tick 1. At speed 6 that is 1/6 of a row of "clean" note before it moves — audible, and usually what you want. |
| **Numbers on disk are DECIMAL.** The grid shows `047`; the file stores `"param": 71`. | The most likely authoring mistake in the project. Every effect cell gets a decimal param and, for anything non-obvious, a note in `extra.notes`. |

---

## 2. the style bible

Craft rules. A composer agent may deviate from any of them **and say so in
`extra.qa.notes`**; an unexplained deviation is a critic finding.

### 2.1 voice allocation doctrine

The default, from which every piece starts:

| voice | job | register | notes |
|---|---|---|---|
| **pulse 1** | lead / melody | MIDI 60–84 typical; 55–88 hard | duty 1 (25 %) is the album's default lead. It carries the tune; everything else answers it. |
| **pulse 2** | harmony, echo, or countermelody — **pick one per section** | a third/sixth below the lead, or the lead's own line delayed | the most-wasted channel on the NES. See §2.2 before defaulting it to parallel thirds. |
| **triangle** | bass | MIDI 24–52 | walking, octave-alternating, or arpeggiated. **Bass and nothing else** unless the piece has explicitly bought a bar of it (below). |
| **noise** | drum kit | see §3.4 | groove and transient definition. Silence in this lane is a compositional choice, not a gap. |
| **dpcm** | percussive accent | — | earns its place only where noise cannot do the job (§2.6). Six of eight pieces leave it empty. |

**When to break it — the four sanctioned breaks:**

1. **Triangle takes the tune** for 2–8 bars while the pulses play a chordal pad or drop
   out. The triangle's flat, gateless tone is a genuine timbral event when it is exposed;
   it works because the *bass leaving* is as dramatic as the tune arriving. Give it back.
2. **Triangle as drum** — a note around MIDI 36–45 with a fast downward `pitch` macro and
   a short gate is a tom/kick reinforcement (§3.4, `tri-kick`). It costs the bass note it
   replaces; use it on beat 1 of a section, not every bar.
3. **Pulse 2 takes the melody** and pulse 1 drops to harmony for a section. The duty change
   between the two channels does the timbral work; the listener hears "a different singer".
4. **Both pulses in unison/octaves** for a hook or a final chorus. Costs all harmony —
   which is exactly why it reads as a lift. Never longer than 8 bars.

**Never:** a sustained triangle pad under a full arrangement (no volume control = it wins
every fight); three voices sustaining chords with no rhythmic differentiation; the noise
lane running the same 1-bar loop for 90 seconds.

### 2.2 the echo trick

The defining pulse-2 technique: **pulse 2 plays pulse 1's line, 2–3 rows later, quieter,
with a different duty.** It converts a monophonic lead into a lead with depth and buys an
apparent reverb the hardware cannot produce.

The recipe, exactly:

- **Delay:** 2 or 3 rows at speed 6–8. Shorter than 2 rows reads as chorus/flam;
  longer than 4 reads as a canon (which is a different, also-good, technique — §2.2b).
  A delay of 3 rows against a 4-rows-per-beat grid puts the echo on the last 16th of the
  beat — the most musical of the three because it never collides with the next downbeat.
- **Level:** 55–70 % of the lead. With the lead at `vol 15` put the echo at `vol 9` or
  `10`, or give it the `echo-*` instruments in §3.3 whose volume macros are pre-scaled.
- **Timbre:** a **different duty** — lead 25 % / echo 12.5 % is the album default. Same
  duty at lower volume sounds like a mixing error; a thinner duty sounds like distance.
- **Detune (optional, tasteful):** `P7e` or `P82` on the echo channel — one or two raw
  period units off centre (`0x80` = 128 = in tune). At c5 that is ~10 cents. It widens the
  pair. More than ±3 units is a chorus effect, not an echo.
- **Register:** same octave, or one octave down for a darker "room". Never up.

**Authoring it in v1:** the cleanest form is *a separate pattern for pulse 2 whose rows are
the lead's rows plus the delay*, hand-shifted. Do **not** try to get an echo by reusing the
lead's pattern index in a later order frame unless the delay is exactly one whole frame
(the `first-light.json` demo does that on purpose; it is a one-frame echo, which is a
different, larger effect).

**Where the echo must stop:** dense 16th-note passages (the echo mudges the rhythm), and
any bar where pulse 2 has a real countermelody. An echo that runs for a whole piece stops
being an effect and becomes a smear.

**2.2b canon.** The same idea at 1–2 *beats* of delay, at near-equal volume, is a canon:
the ear stops hearing "echo" and starts hearing two voices. It requires the melody to be
written so that it harmonises with itself at that offset — mostly stepwise, avoiding
tritones between the leader and follower at the delay interval. `midnight ferry` (§4.7)
owns this and the brief asks for both: echo in the A sections, true canon in the B.

### 2.3 duty-cycle timbre language

`Vxx` sets it per row; a `duty` macro sets it per tick and **overrides `Vxx` from the next
tick** (§3.6). Both are legal; use `Vxx` for section-level timbre and the macro for
per-note character.

| duty | value | character | use |
|---|---|---|---|
| 12.5 % | `0` | thin, nasal, reedy — sits *above* the mix without volume | echoes, distant answers, high counter-lines, "small" leads |
| 25 % | `1` | the classic NES lead: bright, present, cuts | default lead, most hooks |
| 50 % | `2` | hollow, round, clarinet-ish, **loudest-sounding** at equal volume | warm leads, pads, low harmony, bass-doubling stabs |
| 75 % | `3` | **identical in sound to 12.5 %** (inverted phase, same spectrum) | phase tricks between two pulses only; treat as a duplicate of `0` |

**Duty as expression — the three moves worth knowing:**

1. **Attack bite.** A duty macro `[0,0,1,1,2]` with `loop: 4` starts thin and opens to
   round over 5 ticks. Every note gets a percussive front without touching volume. This is
   `dut-attack` in §3.3 and it is the album's default lead colour.
2. **PWM shimmer.** A slow cycling duty macro (`[2,2,2,2,1,1,1,1,0,0,0,0,1,1,1,1]`,
   `loop: 0`) on a *held* note is a slow timbral sweep — the closest a 2A03 gets to a
   filter. Only audible on notes ≥ 8 rows long. Use on pads and held final notes.
3. **Section repaint.** One `V00`/`V01`/`V02` on the first row of a section changes the
   instrument's whole colour without changing a note. Two identical A sections that differ
   only in duty are a legitimate, cheap "second verse" — but only *one* of the two
   variation quotas in §2.10 may be satisfied this way.

On **noise**, `Vxx` and the duty macro select the LFSR mode: `0` = long/hiss (drums),
`1` = short/tonal-metallic (93-step loop — pitched, buzzy; great for a metal-hit accent or
a robotic tick, terrible for a snare).

### 2.4 arpeggio conventions

`0xy` puts `[0, x, y]` semitones on a 3-tick rotation, restarting on the note. It is how a
monophonic channel plays a chord, and how it plays a *texture*, and the difference is
speed against tempo.

- **Reads as harmony** when the full 3-tick cycle fits comfortably inside the note: at
  speed 6–8 a whole-note arp cycles 8–16 times and the ear fuses it into a chord.
  This is the "chord bed" use — pulse 2 holding `047` under a lead.
- **Reads as texture/energy** at speed 3–4, where the cycle is a third of a row: it
  becomes a buzzy tone-colour rather than a chord. Use deliberately (it is loud and
  fatiguing); never for a whole piece.
- **Reads as an ostinato** when you write the arpeggio out as actual rows instead of using
  `0xy` — three or four 16th notes per beat spelling the chord. Slower, clearer, costs
  pattern rows, and is the right choice when the arpeggio *is* the hook.

Common params (**decimal on disk**, hex in the grid):

| chord | grid | decimal | notes |
|---|---|---|---|
| major triad | `047` | 71 | root position |
| minor triad | `037` | 55 | |
| major 6 / minor 7 inversion | `049` | 73 | ambiguous, useful over a moving bass |
| dominant 7 (no 5) | `04a` | 74 | |
| sus4 | `057` | 87 | |
| diminished | `036` | 54 | |
| octave shimmer | `00c` | 12 | thickener, not a chord |
| fifth | `007` | 7 | power-chord bed |
| cancel | `000` | 0 | **required before any pitch effect on that channel** |

**Inversion is chosen by the note column, not the param.** `0xy` only ever builds *upward*
from the written note, so the rule is: **write the chord tone you want on the bottom, then
set `x`,`y` to the intervals up to the other two.** C major in root position is `c` + `047`
(71); first inversion is `e` + `038` (56 — up a minor 3rd, then a minor 6th); second
inversion is `g` + `059` (89). Keep the top note under MIDI 88 or the arp whistles.

**When to prefer an arpeggio MACRO to `0xy`:** when the arpeggio should survive an
instrument change, when you want a non-3-step cycle (4-note chords: `[0,4,7,11]`), or when
you want the arp to *stop* after N ticks (`loop: -1` holds the last value — a "strum" that
settles on one note). Macro arps are `absolute` mode; `fixed` mode ignores the row's note
and is for drum kits only.

**Never:** `0xy` on the triangle (the flat waveform makes it sound like a broken siren, and
the bass loses its function); an arp left running into a `3xx`/`1xx`/`2xx` (the slide
cancels it, but the reverse is not guaranteed — cancel with `000` explicitly).

### 2.5 vibrato taste

`4xy`: `x` = speed, `y` = depth; the accumulator resets on note trigger, so vibrato starts
from zero phase on every note. Bipolar (D-TK3), peak deviation `VIB_AMP[y]` in raw period
units: `[0,1,2,3,4,6,8,11,14,18,23,29,36,44,54,64]`.

**Depth in period units is register-dependent.** The same `y` is a wider interval in the
low register than the high, because a semitone is more period units down there. Practical
values at lead register (MIDI 65–80):

| grid | speed·depth | sounds like |
|---|---|---|
| `421` – `431` | slow, ±1 unit | almost imperceptible warmth; use on sustained harmony |
| `442` – `452` | medium, ±2 | **the album's default "singing" vibrato** |
| `463` – `473` | medium-fast, ±3 | expressive, operatic; only on notes ≥ 6 rows |
| `4x6`+ | ±8 and up | warble/siren. An effect, not a vibrato. Sparingly, on one note. |
| `4f7`+ | fast + deep | seasick. Reserved for `tide pool`'s one deliberate destabilisation. |

**Delayed vibrato is the professional move.** A note that starts straight and blooms into
vibrato after ~1/2 beat sounds sung; instant vibrato sounds synthetic. Two ways here:

1. **Effect-side:** write the note on row *n* and the `4xy` on row *n+2* (rows are cheap,
   this is explicit and readable). Cancel with `400` on the next note that shouldn't have it.
2. **Macro-side (preferred for a whole instrument):** a `pitch` macro that is `0` for 8–12
   ticks then cycles a balanced triangle LFO, e.g. ten zeros followed by
   `1,1,-1,-1,-1,-1,1,1` with `loop: 10`. Because pitch macros accumulate, **the loop
   segment must sum to exactly 0** or the note walks out of tune, and the *accumulated*
   excursion (here ±2 units) is the depth. This is `pit-vib-delay` in §3.3 — check the sum.

Vibrato on **triangle bass**: no. It muddies pitch definition at low frequencies and the
period units are enormous down there. On **noise**: `4xy` shifts the period index; a depth
of 1–2 on a long noise tail is a nice "shimmer", anything more is a machine gun.

### 2.6 noise kit + DPCM

Every drum's length comes from **its volume macro reaching 0**, never from a note-off row.
That is the auto-cut idiom; it keeps the pattern readable (a drum lane is just notes) and
it is what §5.3 already requires of the demo tracks.

The kit's note choices come from `noisePeriodIndex(note) = 15 − (note mod 16)`. The album
fixes one octave so every piece's drum lane is legible at a glance:

| drum | MIDI note | index | period | why |
|---|---|---|---|---|
| kick | **36** | 11 | 508 | the default kick; `pit-kick-drop` sweeps it 11 → 15 (508 → 4068), which is the thump |
| kick (low, no sweep) | **33** | 14 | 2034 | woolly rumble for half-time sections |
| kick (tight) | **35** | 12 | 762 | fast 16th kick patterns, sweep truncated to 2 steps |
| snare | **39** | 8 | 202 | mid-band body |
| snare (high) | **41** | 6 | 128 | for a cracking backbeat over a busy mix |
| tom-low | **37** | 10 | 380 | |
| tom-high | **43** | 4 | 64 | |
| metal / tick | **44** + noise mode 1 | 3 | 32 | short-mode LFSR; tonal, buzzy accent |
| hat closed | **45** | 2 | 16 | |
| hat open / crash | **46** | 1 | 8 | |

**The safe window is MIDI 32–47**, where `index = 47 − note` exactly, monotonic, no wrap.
Every drum note *and every arpeggio-macro excursion from it* must land inside 32–47. Note
48 wraps to index 15 — a hi-hat becomes a kick with no warning.

Sweep headroom is why the default kick is note 36 and not 33: the `pitch` macro adds to the
index and clamps at 15, so a kick that starts at index 14 has one step of sweep left and
lands as a click instead of a thump.

Exact macro sequences are in §3.4. The shapes, and why:

- **Kick** = mid-low index + a *downward* period sweep + fast volume decay. The sweep is a
  `pitch` macro `[1,1,1,1,0]` (index 11 → 15 over four ticks, then hold — pitch macros
  accumulate, so the trailing `0` is mandatory) and the volume macro is `[15,13,9,5,2,0]`.
  Six ticks = one row at speed 6. It reads as a thump because the pitch *falls*.
- **Snare** = mid index + a *rising* two-step arpeggio + a longer decay tail. The rise is
  what gives the strike its "crack" and the tail its movement — a documented technique
  ([btothethree ch.6](https://btothethree.tumblr.com/post/109306979202/how-to-use-famitracker-chapter-6-wrangling-the)).
  Volume `[15,15,12,10,8,6,5,4,3,2,1,0]`, 12 ticks = two rows at speed 6.
- **Closed hat** = high index, 3–4 tick volume macro, level capped around 10 — hats at
  full volume flatten the groove. `[10,6,2,0]`.
- **Open hat** = same index, 12–14 tick decay, and it must be *cut* by the next closed hat
  landing on the beat (which happens naturally — one channel, monophonic).
- **Crash/wash** = index 1–2, slow decay (`A10`-style, or a 24-step volume macro), plus a
  gentle `4x1` shimmer. One per section maximum.
- **Roll/flam** = `Gxx` on the second of two adjacent hits (`G02`/`G03` at speed 6) is a
  flam; a 3-row `0xy`-free burst of 32nd hits is not available (rows are the resolution),
  so rolls are written as alternating rows with a descending volume column.

**Triangle reinforcement.** A kick gains real low end from a triangle note (MIDI 33–40)
with a steep `pitch` macro and a 4–6 tick gate — the classic two-channel drum. It costs
the bass note on that beat, so it belongs on beat 1 and on fills, not on every kick.

**DPCM: when it earns its channel.** Noise cannot produce (a) a kick with actual
low-frequency weight and a *pitched* body, (b) a snare with a noise+tone composite, or
(c) a hit with a non-exponential envelope. If the piece needs weight the triangle can't
spare, DPCM earns the lane. Costs, all real: the sample bytes go in the bundle; the DMC
level ducks triangle and noise through the shared TND index (§1); and the DMC lane cannot
do anything else while it plays. **Two pieces of eight use it** (§4.4, §4.8) — the rest
declare `dpcm` unused and leave the lane empty (Gate B checks this).

The suite needs **exactly two samples** — one kick, one snare — described in §3.5. They are
generated programmatically via the `buildDpcmImage` path; no recorded audio, ever.

### 2.7 groove, tempo, and humanisation

**Straight.** `tempo: 150` + `speed` chosen from the BPM table in §1. Ticks per row is an
exact integer; every row is the same length; the groove comes from the writing.

**Swing — the fractional-tempo device.** When `tempo ≠ 2.5 · engineSpeed`, the Bresenham
row accumulator alternates row lengths, and that alternation is an *expressive device*
(§2.3 of the design), not an artifact:

| `tempo` | `speed` | ticks/row | row pattern | BPM | feel |
|---|---|---|---|---|---|
| 160 | 6 | 5.625 | `6 6 5 6 6 5 6 5` | 160 | brisk, forward-leaning shuffle |
| 140 | 6 | 6.4286 | `7 6 6 7 6 7 6 6` | 140 | loping, laid-back |
| 170 | 7 | 6.176 | mostly `6`, with a `7` every ~6th row | 145.7 | subtle drag, near-straight |

The alternation lands on *row* boundaries, so it swings the 16th-note grid, not the 8ths —
it is a fine-grained lilt rather than a jazz triplet shuffle. Two album pieces own it
(§4.6, §4.7). Everything else keeps `tempo: 150`. Set `evenTempo: false` for swung pieces
(it is the default; `true` would round the alternation away).

**Tempo ranges.** Album span is 90–170 BPM. Ballad/ambient 90–105 · mid-groove 110–130 ·
song tempo 130–150 · driving 150–170. Above 170 the 16th-note grid at 4 rows/beat runs out
of ticks per row (speed 5 = 5 ticks/row; macros get 5 steps per row, and a 6-tick drum
envelope no longer fits inside one row).

**`Gxx` as humanisation.** A `G01`/`G02` on a chord's second and third voice is a strum;
on a snare it is a flam; on the bass, one tick late against the kick is *feel*. Rules:
delay ≤ 2 ticks for humanisation (more is a rhythmic event, not a nudge); never on the
lead's downbeat of a section (the ear uses it to find the beat); the delayed note fires its
macros from the delayed tick, so a `G03` on a 6-tick drum envelope truncates the drum to 3
ticks — check the arithmetic.

**Rows per beat.** `rowHighlight` is rows-per-beat and it drives the BPM readout, so it is
not cosmetic. Album convention: **4 rows/beat** (16th-note resolution) for everything
except the waltz, which uses 4 rows/beat with `rowHighlight2: 12` so a 12-row bar is
three beats. `rowsPerPattern` is then 64 (four 4/4 bars) or 48 (four 3/4 bars).

### 2.8 dynamics and mix discipline inside a four-voice budget

There is no mixer, no pan, no reverb. **Volume, register, duty and silence are the whole
mix.**

- **Constant-15 fatigue is the failure mode.** Four channels at `vol 15` for 90 seconds is
  loud, flat, and tiring, and it clips the mixer (Gate C counts clipped samples). Target
  histogram per piece: **no more than 45 % of note events at 15**, at least **five distinct
  volume-column values** across the piece, at least **three per melodic channel**.
- **Static balance** (before any phrasing): lead 13–15 · harmony/echo 8–11 · pulse pad or
  arp bed 6–9 · noise hats 6–10 · noise kick/snare 12–15. Triangle has no level; its
  balance is set by register (lower = less present) and by how often it rests.
- **Phrase with the volume column.** A four-bar phrase whose notes all sit at 15 is a MIDI
  file; give the phrase an arc — approach notes 11–12, peak note 15, resolution 12–13. Two
  or three values per phrase is enough.
- **`Axy` swells** are for *within* a note or across a held passage: `A20` is a gentle fade
  (~1.5 volume steps per row at speed 6); `A0f` is a fast crescendo, 0 → full in under two
  rows, used as a section pickup. Remember the inverted direction (§1) and that
  `Axy` operates on the column value **before** macro composition, so a swell under an
  instrument whose volume macro decays still decays.
- **`7xy` tremolo** subtracts only (unipolar downward). `732`–`742` on a held pad is a
  breathing texture. It never adds level, so a tremolo'd note is always quieter than the
  written value — write the column 1–2 higher to compensate.
- **DPCM/triangle ducking as a feature.** When the DMC lane fires, the triangle and noise
  drop (shared TND index). On a piece with DPCM drums, that is the pump: bass ducks on
  every kick and returns. Lean into it by placing the DPCM hit where the bass note is
  *already* being restruck; fight it by keeping the sample short and the delta preload low.
- **Rests are mix.** The single most effective way to make a chorus louder is to write a
  bar before it where two voices stop. One-voice moments (lead alone, or bass alone with
  hats) are the album's dynamic range. Every piece must contain at least one bar where
  **two or more voices rest simultaneously**.
- **Register is level.** Two voices in the same octave fight; move the harmony a sixth
  below instead of a third and the lead comes forward for free.
- **Clipping is re-voiced, not re-gained** (Gate C's rule): if the mix clips, thin the
  arrangement or drop a volume column — do not touch `masterGain`.

### 2.9 form, order-list mechanics, and the loop convention

Album pieces are **1.5–3 minutes** and they **loop**. Duration arithmetic:
`seconds = frames · rowsPerPattern · ticksPerRow / 60`. At 64 rows, speed 6, that is
6.4 s/frame → **14–28 frames** for the target range.

**Three form templates.** Each row is an order frame; letters are pattern groups.

| template | order | when |
|---|---|---|
| **song form** | `I I A A' B A'' C A A' B A'' O→loop@A` | verse/chorus pieces (most of the album) |
| **arch** | `I A B C B' A' O→loop@A` | through-composed, ambient, waltz |
| **riff-driven** | `I A A A' B A A' B' Br A'' A'' O→loop@A` | driving pieces where the groove is the subject |

Mechanics:

- **Pattern reuse with variation patterns.** `A` and `A'` share the triangle and noise
  pattern indices and differ only in the pulse lanes. That is how a 20-frame piece costs
  8 patterns per channel instead of 20. **Quota: no pattern index may repeat more than
  4 consecutive frames without a variation** (§2.10).
- **`Bxx` is the loop.** The last frame's last row carries `Bxx` pointing at the **loop
  frame** — the first frame of the first `A`, *not* frame 0, so the intro plays once.
  Declare it: `extra.qa.loopFrame`.
- **`Dxx` is a pickup.** `Dxx` on the last row of a frame skips into the next frame at row
  `xx` — the clean way to write a 3-beat pickup bar without a short pattern. Use it for
  the pickup into a chorus; do not use it to shave a bar off a phrase (that just confuses
  the form).
- **`Cxx` never appears in an album piece.** It halts playback. Ending variants belong to
  the demo tracks (`switchback.json`).
- **`Fxx`** for a deliberate tempo event only (one piece, §4.8). A speed change alters
  ticks-per-row and therefore every macro's timing relative to the beat — audition it.
- **Phrase lengths:** 4-bar and 8-bar phrases, with **one 6-bar or 2-bar asymmetry per
  piece** placed at a section boundary. Symmetry everywhere is the sound of a generator.
- **Key changes** belong at a section boundary and are approached, not dropped: pivot
  chord, a bar of the new dominant, or a bare unison lead-in. Placement: the last B or the
  final A''. One piece owns multiple keys (§4.8).

**The loop convention — mandatory, and the critic checks it:**

1. `extra.qa.loopFrame` names the target frame. The final frame ends with `Bxx` = that
   frame (decimal!).
2. **State at the seam must be identical on pass 1 and pass 2.** Every channel's first row
   of the loop-target frame carries an explicit `inst` and `vol`, or the channel is silent
   there. No channel may rely on a value set only in the intro.
3. **No effect is left running across the seam.** Before the seam, cancel: `000`
   (arpeggio), `300` (portamento), `400` (vibrato), `700` (tremolo), `A00` (volume slide),
   `V` re-stated. Effect memory is per channel and per letter and it survives the jump.
4. **No sounding note crosses the seam** unless the loop frame's first row restrikes it.
   A ringing open hat or a held pad that gets retriggered a tick later is the classic
   audible loop click.
5. The last bar leads *musically* to the loop frame — a dominant, a turnaround, or a
   rhythmic break. An album piece that stops and restarts has no loop, it has a fade.

### 2.10 harmony and melody craft — the checkable rules

These exist so the critic (§6) has something concrete to score. They are floors, not
ceilings.

**Harmony**

- **Functional progressions.** Every section's chords must have a function the analyst can
  name (tonic / pre-dominant / dominant), and each section ends on a **cadence** —
  authentic (V→i/I), plagal (iv/IV→i/I), or a deliberate half cadence (→V) at a section
  that continues. A progression that is just a loop of parallel triads is a texture; a
  piece needs at least two real cadences.
- **At least one non-diatonic colour per piece**, named in `extra.qa.notes`. Menu:
  secondary dominant (V/V, V/vi — the raised third is the event), borrowed iv in major,
  bVII or bVI in minor-key rock idiom, Neapolitan bII at a final cadence, a chromatic
  passing tone in an inner voice, a modal-interchange picardy third at the very end.
- **Keep modulations close** — relative, dominant, or one accidental away. This is both
  good craft and a hard engine constraint: Gate B requires ≥ 88 % of note events inside the
  declared key's scale, so a distant modulation fails the lint. Relative-key moves
  (a minor ↔ C major, g minor ↔ Bb major) cost zero accidentals.
- **Voice the chords, don't just spell them.** With two pulses you get two chord tones;
  choose the two that define the chord (third + seventh, or third + root) and let the
  triangle supply the root. Doubling the root in all three voices wastes the harmony.

**Melody**

- **A motif is 2–4 bars** and it is the piece's subject. It must **recur at least three
  times**, with **at least one true variation** — transposed sequence, rhythmic
  augmentation/diminution, inversion, re-orchestration onto another channel, or
  re-harmonisation under the same notes. Literal repetition three times is not development.
- **Contour:** ≥ 70 % stepwise or small-leap (≤ 3 semitones) motion. Leaps are events:
  one signature leap (a fifth or wider) per section, and a leap should be followed by
  stepwise motion in the opposite direction.
- **Peak note.** Each section has exactly one highest note; it lands on a strong beat, and
  the piece's global peak lands in the last third. A melody that touches its ceiling
  repeatedly has no shape.
- **Phrase breathing.** Every phrase ends with a rest of at least one beat in the lead.
  A lead that never stops has no phrasing and gives pulse 2 nothing to answer.
- **Range:** keep the lead inside a tenth per section. Wider is a different section.

**Counterpoint (bass vs melody)**

- **Contrary motion at cadences** — when the melody rises to its resolution, the bass
  falls to the root (or vice versa). **At least two cadence points per piece** must show it,
  and the critic checks it by reading the note columns.
- **The bass does not shadow the melody.** No more than 4 consecutive beats where triangle
  and pulse 1 move in the same direction by the same intervals.
- **Rhythmic differentiation.** If the lead is in 8ths, the bass should not also be in
  8ths in the same register-relative pattern; give one of them a syncopation or a
  sustained note.
- **Parallel fifths/octaves between pulse 1 and pulse 2** are allowed only as a deliberate
  "power" gesture and only for ≤ 4 bars — otherwise they collapse two voices into one.

**Repetition-with-variation quotas** (per piece, checkable):

- ≥ 1 variation pattern for every 4 repeats of a pattern index, per channel.
- The drum lane gets a **fill** at least every 8 bars, and the fill is not the same fill
  every time.
- ≥ 2 sections where the arrangement *thins* (a voice drops out) and ≥ 1 where it thickens.

---

## 3. the shared instrument / kit bank

**Why a shared bank:** eight pieces written by three agents must sound like one album. The
bank fixes the timbres; the pieces differ in music, not in synthesis. It is also a QA
surface — a critic can diff a song's instruments against the canonical bank mechanically.

### 3.1 how sharing works in a format with per-song banks

Song JSON v1 embeds `sequences` and `instruments` per song; there is no cross-file
reference and we are not adding one. So:

- **The bank is identified by NAME, not by index.** Each song includes only the entries it
  uses, in bank order, densely numbered from 0. Instrument `name` fields must be the exact
  canonical names below.
- **Values are frozen.** An instrument named `lead-bright` must resolve to exactly the
  macro values in §3.2–3.4. The critic (§6) checks this by resolving each instrument's
  macro indices to values and comparing against the canonical table.
- **Piece-specific additions are allowed**: up to **3** extra instruments per piece, named
  `x-<piece>-<what>` (e.g. `x-tidepool-glass`), appended after the shared ones, plus any
  sequences they need. Anything an agent finds itself wanting twice belongs in the bank —
  report it to the director rather than duplicating it.
- **Declare the subset** in `extra.qa.bank`:
  ```json
  "bank": {
    "instruments": ["lead-bright", "echo-thin", "bass", "kick", "snare", "hat-closed"],
    "rev": 1
  }
  ```
- Batch C ships the canonical copy as `tests/fixtures/songs/shared-bank.json` (a fragment
  holding `sequences`, `instruments`, `samples` — **not** a playable `Song`) plus the pin
  test. Composers copy from it; the pin test is what stops drift.

Rejected alternative: identical full banks in every song with frozen indices. It fails Gate
A, which allows only `unreferenced pattern` warnings — an unused instrument or sequence
warns, and eight songs carrying 22 instruments each would warn constantly.

### 3.2 sequence bank — volume

`loop`/`release` are indices into `values`; `−1` = none. Ticks, not rows: at speed 6 a
6-value envelope is exactly one row.

| name | values | loop | release | use |
|---|---|---|---|---|
| `vol-lead` | `[12,15,14,13,13,12, 9,6,4,2,1,0]` | 5 | 5 | sung lead: soft-front attack, settles at 12, `===` releases through a 6-tick fade |
| `vol-lead-soft` | `[9,11,10,10,9, 7,5,3,1,0]` | 4 | 4 | harmony / second voice, ~65 % of lead |
| `vol-echo` | `[7,9,8,7,7, 5,3,2,1,0]` | 4 | 4 | echo channel, ~55 % of lead |
| `vol-pluck` | `[15,14,12,10,8,6,5,4,3,2,1,0]` | −1 | −1 | 12-tick auto-cut pluck; no release point, so `===` becomes a cut (§3.4 of the design) |
| `vol-stab` | `[15,15,12,8,4,1,0]` | −1 | −1 | 7-tick chord stab |
| `vol-pad` | `[0,2,4,6,8,9,10,11,11,12,12,12, 10,8,6,5,4,3,2,1,0]` | 11 | 11 | 12-tick swell in, sustains at 12, 9-tick release |
| `vol-tri-gate` | `[15]` | 0 | −1 | triangle sustain (gate on until a cut) |
| `vol-tri-short` | `[15,15,15,15,15,15,0]` | −1 | −1 | detached triangle bass, one row at speed 6 |
| `vol-tri-kick` | `[15,15,15,15,0]` | −1 | −1 | triangle drum gate, 4 ticks |
| `vol-kick` | `[15,13,9,5,2,0]` | −1 | −1 | noise kick |
| `vol-snare` | `[15,15,12,10,8,6,5,4,3,2,1,0]` | −1 | −1 | noise snare, 12 ticks |
| `vol-hat-closed` | `[10,6,2,0]` | −1 | −1 | capped at 10 on purpose |
| `vol-hat-open` | `[9,9,8,7,6,5,4,4,3,2,2,1,1,0]` | −1 | −1 | 14 ticks; the next closed hat cuts it |
| `vol-crash` | `[12,12,11,10,10,9,9,8,8,7,7,6,6,5,5,4,4,3,3,2,2,1,1,0]` | −1 | −1 | 24-tick wash, one per section |
| `vol-metal` | `[12,8,5,3,1,0]` | −1 | −1 | short-mode tick |

### 3.3 sequence bank — arpeggio, pitch, hiPitch, duty

**arpeggio** (`mode: "absolute"` throughout; omit the field, absolute is the default)

| name | values | loop | use |
|---|---|---|---|
| `arp-maj` | `[0,4,7]` | 0 | major triad bed |
| `arp-min` | `[0,3,7]` | 0 | minor triad bed |
| `arp-dom7` | `[0,4,7,10]` | 0 | 4-note cycle — needs a note ≥ 4 rows to read as harmony |
| `arp-min7` | `[0,3,7,10]` | 0 | |
| `arp-sus4` | `[0,5,7]` | 0 | |
| `arp-oct` | `[0,12]` | 0 | thickener, not a chord |
| `arp-fifth` | `[0,7]` | 0 | power bed |
| `arp-grace` | `[-2,-1,0]` | −1 | two-tick grace slide into every note; holds at 0 |
| `arp-snare-rise` | `[0,1,2]` | −1 | the snare's rising strike (noise: +semitone = lower index = higher pitch) |

**pitch** — every sequence **ends on 0** because values accumulate (§1). Loop segments must
sum to exactly 0.

| name | values | loop | use |
|---|---|---|---|
| `pit-kick-drop` | `[1,1,1,1,0]` | −1 | noise kick period sweep: index +4 over 4 ticks |
| `pit-tom-drop` | `[1,1,0]` | −1 | tom sweep, index +2 |
| `pit-vib-delay` | `[0,0,0,0,0,0,0,0,0,0, 1,1,-1,-1,-1,-1,1,1]` | 10 | **the album's delayed vibrato**: straight for 10 ticks, then a triangle LFO reaching **±2 raw units** on an 8-tick cycle (≈ 7.5 Hz). The loop segment sums to 0 — check it if you change a value |
| `pit-vib-wide` | `[0,0,0,0,0,0,0,0, 2,2,-2,-2,-2,-2,2,2]` | 8 | same shape, ±4 units, arriving 2 ticks earlier; for exposed sustained notes |
| `pit-fall` | `[0,0,0,0,2,5,9,14,20,0]` | −1 | sagging tail, ending ~50 units flat; pair with a decaying volume macro only |
| `pit-scoop` | `[7,-1,-1,-1,-1,-1,-1,-1,0]` | −1 | starts 7 units flat and arrives in tune after 8 ticks — a scoop into the note that ends at zero offset |

**hiPitch** (×16 per step)

| name | values | loop | use |
|---|---|---|---|
| `hip-tri-kick` | `[4,6,8,10,0]` | −1 | triangle drum: +448 timer units over 4 ticks ≈ a 9-semitone fall. **Triangle only** — one step swamps the noise index |

**duty** (pulse 0..3; on noise the value is the LFSR mode bit 0..1)

| name | values | loop | use |
|---|---|---|---|
| `dut-12` | `[0]` | 0 | thin |
| `dut-25` | `[1]` | 0 | classic lead |
| `dut-50` | `[2]` | 0 | round |
| `dut-attack` | `[0,0,1,1,2]` | 4 | **album default lead**: thin front opening to round |
| `dut-attack-bright` | `[2,2,1,1,1]` | 4 | round front narrowing to bright — a softer, vocal attack |
| `dut-pwm-slow` | `[2,2,2,2,1,1,1,1,0,0,0,0,1,1,1,1]` | 0 | 16-tick timbral sweep; audible on notes ≥ 8 rows |
| `dut-pwm-fast` | `[2,1,0,1]` | 0 | buzzy 4-tick shimmer; texture, use sparingly |
| `dut-noise-long` | `[0]` | 0 | noise mode 0 — all drums |
| `dut-noise-short` | `[1]` | 0 | noise mode 1 — metallic tick |

### 3.4 instruments

| name | volume | arpeggio | pitch | hiPitch | duty | notes |
|---|---|---|---|---|---|---|
| `lead-bright` | `vol-lead` | — | `pit-vib-delay` | — | `dut-attack` | the album's default lead |
| `lead-round` | `vol-lead` | — | `pit-vib-delay` | — | `dut-50` | warm, low leads and second verses |
| `lead-thin` | `vol-lead` | — | `pit-vib-delay` | — | `dut-12` | high counter-lines, distant answers |
| `lead-plain` | `vol-lead` | — | — | — | `dut-25` | for lines that drive vibrato with `4xy` by hand |
| `harm-soft` | `vol-lead-soft` | — | — | — | `dut-25` | pulse-2 harmony |
| `echo-thin` | `vol-echo` | — | — | — | `dut-12` | **the echo instrument** (§2.2) |
| `echo-round` | `vol-echo` | — | — | — | `dut-50` | darker echo, for bright leads |
| `pluck` | `vol-pluck` | — | — | — | `dut-attack` | detached 8ths/16ths |
| `stab` | `vol-stab` | — | — | — | `dut-50` | chord stabs |
| `pad` | `vol-pad` | — | `pit-vib-delay` | — | `dut-pwm-slow` | held background; never under a busy mix |
| `arp-bed-maj` | `vol-lead-soft` | `arp-maj` | — | — | `dut-12` | macro-arp chord bed, major |
| `arp-bed-min` | `vol-lead-soft` | `arp-min` | — | — | `dut-12` | minor |
| `bass` | `vol-tri-gate` | — | — | — | — | triangle sustain bass |
| `bass-short` | `vol-tri-short` | — | — | — | — | detached triangle bass |
| `tri-kick` | `vol-tri-kick` | — | — | `hip-tri-kick` | — | triangle drum reinforcement |
| `kick` | `vol-kick` | — | `pit-kick-drop` | — | `dut-noise-long` | **note 36** (index 11 → 15 under the sweep) |
| `snare` | `vol-snare` | `arp-snare-rise` | — | — | `dut-noise-long` | **note 39** (index 8 → 6) |
| `tom` | `vol-snare` | — | `pit-tom-drop` | — | `dut-noise-long` | notes 37 / 43 |
| `hat-closed` | `vol-hat-closed` | — | — | — | `dut-noise-long` | **note 45** |
| `hat-open` | `vol-hat-open` | — | — | — | `dut-noise-long` | **note 46** |
| `crash` | `vol-crash` | — | — | — | `dut-noise-long` | note 46; add `4x1` for shimmer |
| `metal` | `vol-metal` | — | — | — | `dut-noise-short` | note 44, mode 1 — tonal tick |
| `dpcm-kit` | — | — | — | — | — | `dpcm` map only (§3.5) |

**Noise note arithmetic, restated because it is the trap:** inside MIDI **32–47**,
`period index = 47 − note`, monotonic, no wrap. Every drum note and every arpeggio-macro
excursion must land inside 32–47. Outside that window the index wraps and a kick becomes a
hi-hat.

| note | 33 | 35 | 36 | 37 | 39 | 41 | 43 | 44 | 45 | 46 |
|---|---|---|---|---|---|---|---|---|---|---|
| index | 14 | 12 | 11 | 10 | 8 | 6 | 4 | 3 | 2 | 1 |
| role | kick-low | kick-tight | **kick** | tom-low | **snare** | snare-hi | tom-hi | metal | **hat** | **open hat** |

### 3.5 the DPCM bank — two samples, generated, tiny

| name | bytes | `$4010` rate index | duration | `delta` preload | note key |
|---|---|---|---|---|---|
| `dpcm-kick` | 257 (`16·16+1`) | 12 (106 cyc → 16.9 kHz) | 121.8 ms | 8 | 36 |
| `dpcm-snare` | 145 (`16·9+1`) | 15 (54 cyc → 33.1 kHz) | 35.0 ms | 8 | 39 |

402 bytes decoded, ~536 base64 characters, duplicated into the two songs that use them.
That is the entire sample budget for the album.

**How they are made — arithmetic, not recordings.** Batch C writes
`tools/songs/makeDpcm.mjs` (Node, no dependencies, deterministic, no seed input):

1. Choose a target waveform sampled at the DMC rate.
   - **kick:** `s(t) = A(t)·sin(φ(t))`, amplitude `A` decaying exponentially from 40 to 2
     over the sample, instantaneous frequency sweeping 110 Hz → 45 Hz — a pitched thump the
     noise channel structurally cannot make.
   - **snare:** a deterministic LFSR noise burst (the same 15-bit polynomial the APU uses,
     seeded to 1) shaped by an exponential decay from 45 to 0, with the first 4 ms boosted
     for the crack.
2. **Delta-modulate to 1 bit:** track the 7-bit DAC level `L` starting at the `delta`
   preload; per output bit emit `1` if `target > L` (then `L = min(127, L+2)`) else `0`
   (then `L = max(0, L−2)`); pack 8 bits per byte, LSB first.
3. **Land the tail near the preload** so the DMC's held level does not permanently duck the
   triangle and noise (§1). The generator asserts `|L_final − 8| ≤ 4`.
4. Emit base64 and the exact byte count; the script prints a block ready to paste into
   `samples`. Decoded length must be `16n + 1` or the validator rejects the song.

**Using them:** instrument `dpcm-kit` carries
`"dpcm": { "36": {"sample":0,"pitch":12,"loop":false,"delta":8},
           "39": {"sample":1,"pitch":15,"loop":false,"delta":8} }`.
`loop` is always `false` — a looping DPCM sample on a 5-voice budget is a drone that never
ends. The dpcm lane's volume column is ignored entirely (§3.3 of the design), so DPCM
dynamics come from *how often you hit it*, nothing else.

---

## 4. the eight pieces

Eight original pieces, 1.5–3 minutes each, all looping. Files land in
`src/assets/songs/<id>.json` alongside the four demo tracks. Every brief names **feelings,
functions and techniques** — never a piece of existing music (§0.1).

Common `meta` unless a brief overrides: `engineSpeed: 60`, `region: "ntsc"`,
`speedSplitPoint: 32`, `rowsPerPattern: 64`, `rowHighlight: 4`, `rowHighlight2: 16`,
`evenTempo: false`, `author: "pulsar"`.

Frame time = `rowsPerPattern × ticksPerRow / 60` seconds. Every brief's frame count is
already arithmetic — hit it, or say why in `extra.qa.notes`.

### 4.1 `iron-sunrise.json` — batch A

- **energy** driving, bright, forward — 1989-action-platformer momentum without menace.
- **meta** `tempo 150 · speed 6` → **150 BPM**, 6 ticks/row, **6.40 s/frame**.
- **key** D dorian (d e f g a b c). Non-diatonic colour: **A7 (c♯) secondary dominant**
  pulling into the final A″; one borrowed b♭ in the bridge's bass line.
- **form** riff-driven, **17 frames ≈ 108.8 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | triangle 16ths alone, then hats join; lead enters on the last beat via a `Rxy` scoop |
  | 2–5 | A | the riff: 4-bar motif, answered by pulse 2 a sixth below |
  | 6–7 | A′ | same riff, lead moved up an octave, drums add open hats |
  | 8–11 | B | new 8-bar melody over a descending bass; the one 6-bar asymmetry lives here |
  | 12 | break | drums + triangle only, one bar of everything-drops before the return |
  | 13–16 | A″ | riff with the A7 turn, both pulses in octaves for the last 4 bars |
- **owns** (1) a **driving 16th-note triangle bass** — octave-alternating with chromatic
  approach notes into each chord change, `bass-short` so every 16th is detached;
  (2) **`Qxy`/`Rxy` note slides** as lead articulation (scoops into phrase starts, falls
  out of phrase ends — remember they do not retrigger); (3) **`Gxx` flams** on snare
  accents and a `G03` kick double before each section change.
- **kit** `kick`(36) · `snare`(39) · `hat-closed`(45) · `hat-open`(46) · `crash`(46).
  Straight 16th hats, open hat on the "and" of 4, snare on 2 and 4, kick on 1 and the
  "and" of 3.
- **mood direction** Write the sunrise, not the fight: this is *momentum and optimism*, the
  feeling of a run that is going well. The triangle never stops moving; the lead is short,
  punchy, and leaves a beat of air at the end of every phrase for pulse 2 to answer.
  Keep the register bright and let the `Rxy` scoops give the melody a physical, springing
  attack.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["Q","R","G","A","0","B"]`
  · `bpmRange [148,152]` · `durationSec [100,118]` · `key "d-dorian"` · `loopFrame 2`.

### 4.2 `glass-ladder.json` — batch A

- **energy** bright, weightless, mechanical-but-warm; a puzzle in motion.
- **meta** `tempo 150 · speed 7` → **128.6 BPM**, 7 ticks/row, **7.47 s/frame**.
- **key** A major, with a relative sidestep to F♯ minor (zero accidentals). Non-diatonic
  colour: **C♯7 (V/vi)** landing on F♯m at the top of B.
- **form** song form, **16 frames ≈ 119.5 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | the arp bed alone on pulse 2, one chord per bar; hats enter at bar 3 |
  | 2–5 | A | lead melody over the arp bed; triangle plays roots on 1 and 3 only |
  | 6–7 | A′ | lead varied by rhythmic diminution; triangle walks |
  | 8–11 | B | the arpeggio becomes the hook — pulse 1 spells the chords as written-out 16ths while pulse 2 holds the melody |
  | 12–15 | A″ | both ideas at once: arp bed returns under the lead, kick enters for the first time |
- **owns** (1) **`0xy` arpeggio as the harmonic bed** for the whole piece — one arp param
  per chord, changed on the chord's downbeat, cancelled with `000` before any pitch effect;
  (2) **the arp/ostinato contrast** — the B section proves the difference between an
  arpeggio *effect* and an arpeggio *written out in rows*, which is the piece's argument;
  (3) **`Sxx` chokes** carving rests into the bed so it breathes instead of droning.
- **kit** hats and snare only until frame 12; `hat-closed` 8ths, `snare` on 3, `crash` at
  section tops. `kick`(36) is held back for the final section — its entry is the lift.
- **mood direction** Weightless and precise, like something assembling itself correctly.
  The harmony should feel like it is *climbing* — each 4-bar phrase starting a step higher
  in the chord bed than the last — and the arrival on F♯m via C♯7 should feel like stepping
  outside into cooler air. Nothing here is dramatic; the pleasure is mechanism.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["0","S","A","V","B"]`
  · `bpmRange [127,130]` · `durationSec [110,128]` · `key "a-major"` · `loopFrame 2`.

### 4.3 `midnight-ferry.json` — batch A

- **energy** nocturnal, moving water, patient; melancholy with somewhere to be.
- **meta** `tempo 140 · speed 6` → **140 BPM**, ticksPerRow 6.4286, **row pattern
  `7 6 6 7 6 7 6 6`**, **6.86 s/frame**. `evenTempo: false` — the lope is the point.
- **key** G minor, lifting to its relative B♭ major in B (zero accidentals). Non-diatonic
  colour: **D7 (f♯)** as the secondary dominant returning to Gm; an E♭→D half cadence
  closes B.
- **form** song form, **18 frames ≈ 123.4 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | triangle + hats establish the lope; lead enters unaccompanied for 2 bars |
  | 2–5 | A | melody on pulse 1, **echo** on pulse 2 three rows later |
  | 6–9 | A′ | same melody, echo moved to one octave down (`echo-round`), drums fill out |
  | 10–13 | B | **canon**: pulse 2 enters one beat (4 rows) after pulse 1 at near-equal volume and becomes a real second voice; B♭ major |
  | 14 | pickup | `Dxx` on the last row skips into the next frame at row 12 — a 3-beat pickup |
  | 15–17 | A″ | echo returns, thinner; last bar is a D7 turnaround into the loop |
- **owns** (1) **the echo trick, properly** — 3-row delay, `echo-thin`, volume ~60 %,
  `P7e` detune (`param 126`), and it *stops* wherever pulse 2 has real material;
  (2) **a true canon** in B, written so leader and follower consonate at the 4-row offset
  (no tritones between the voices on strong beats); (3) **`Gxx` humanisation** — the bass
  one tick behind the kick through the A sections, dead-on in B.
- **kit** laid-back: `kick`(36) on 1 and the "and" of 2, `snare`(39) on 2 and 4 with ghost
  hits at vol 5–7, `hat-open`(46) on the "and" of 2, `hat-closed` elsewhere.
- **mood direction** The swing here is a *lope*, not a bounce — the alternating row lengths
  should feel like water moving under a hull. The melody is long-breathed and mostly
  stepwise so that its own echo, and later its canon, never fights it. When B lifts to the
  relative major, keep the drums identical: the harmony does all the work.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["G","A","4","D","P","B"]`
  · `bpmRange [139,141]` · `durationSec [115,132]` · `key "g-minor"` · `loopFrame 2` ·
  `notes: "fractional tempo — rows alternate 7/6/6/7/6/7/6/6 by design"`.

### 4.4 `paper-lanterns.json` — batch B

- **energy** graceful, turning, a little wistful; a 3/4 lilt that never hurries.
- **meta** `tempo 150 · speed 8` → **112.5 BPM**, 8 ticks/row, `rowsPerPattern 48`,
  `rowHighlight 4`, **`rowHighlight2 12`** (12 rows = one 3/4 bar, 4 bars/pattern),
  **6.40 s/frame**.
- **key** B♭ major. Non-diatonic colours: **borrowed iv (E♭ minor)** at B's final cadence,
  and a passing **G7 (b♮)** as V/ii in A′.
- **form** arch, **18 frames ≈ 115.2 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | triangle "um" + pulse-2 "pah-pah" alone; two bars of just the waltz engine |
  | 2–5 | A | lead melody, long notes with delayed vibrato |
  | 6–9 | B | triangle switches to an **arpeggiated bass** figure across the bar; lead becomes a descending line; borrowed iv at the cadence |
  | 10–12 | C | the quiet centre — pulse 1 alone with the triangle, no drums for 3 frames (this is the arch's apex, played *down*) |
  | 13–14 | B′ | B returns with the melody an octave up and the drums back |
  | 15–17 | A′ | melody with portamento connecting its leaps; plagal cadence into the loop |
- **owns** (1) **3/4 via row geometry** — 12-row bars, triangle root on beat 1, pulse-2
  chord stabs on beats 2 and 3 (`stab`), which is the entire waltz idiom on this hardware;
  (2) **`4xy` delayed vibrato + `3xx` portamento** as the lyrical vocabulary — vibrato
  arriving 2 rows into every long note, portamento connecting the melody's leaps;
  (3) **arpeggiated triangle bass** in B — root, fifth, third across the three beats
  instead of um-pah-pah, which is how a waltz bass modulates its own weight.
- **kit** brushed and light: no kick under the A sections; `hat-closed` on beats 2 and 3,
  `snare` at vol 10–12 on beat 1 of alternate bars, `tom`(37/43) fills at section joins.
  Frames 10–12 have **no drums at all** — the percussion-gap declaration covers it.
- **mood direction** Warm and slightly faded, like something remembered fondly rather than
  missed. The melody should sing — long notes, blooming vibrato, leaps that are *connected*
  by portamento rather than jumped. Let the quiet centre be genuinely quiet: two voices, no
  drums, and trust that the return of the waltz engine is the payoff.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["4","3","A","G","B"]`
  · `bpmRange [111,114]` · `durationSec [108,122]` · `key "bb-major"` · `loopFrame 2` ·
  `percussionGap 24`.

### 4.5 `tide-pool.json` — batch B

- **energy** still, wide, luminous; time passing slowly over something alive.
- **meta** `tempo 150 · speed 10` → **90 BPM**, 10 ticks/row, **10.67 s/frame**.
- **key** F lydian (f g a **b♮** c d e) — the raised fourth is the mode's own colour.
  Second colour: a **borrowed b♭VII (E♭ major)** triad twice, which flatly contradicts the
  lydian b♮ and is the piece's one moment of doubt.
- **form** arch, **11 frames ≈ 117.3 s**, loop @ frame 1.

  | frames | section | content |
  |---|---|---|
  | 0 | intro | pad alone, one chord, swelling in with `Axy` |
  | 1–3 | A | slow 4-bar melodic cell on `lead-thin`, notes 8–16 rows long, released with `===` |
  | 4–6 | B | the cell inverted, a fourth higher, over the E♭ colour; the two pulses detuned against each other |
  | 7–8 | peak | one held note carries the piece's global peak; a single `4f7` destabilises it, then it resolves |
  | 9–10 | A′ | the cell one last time, thinner, triangle dropping to its lowest octave |
- **owns** (1) **long macro envelopes** — `pad` and `lead-thin` with real release points,
  every phrase ended with `===` (not `---`) so the release tails overlap the next entry;
  (2) **`Axy` swells + `Pxx` static detune** — the two pulses sit 2–3 raw period units
  apart (`P7e` / `P82`) so their unison beats slowly, which is the only chorus this machine
  has; (3) **the one destabilisation** — a single deep, fast `4f7` on the peak note,
  earned by five frames of stillness before it.
- **kit** **no drum kit.** The noise lane is weather: long mode-0 notes at index 1–3 with
  slow 24-tick envelopes (wash), plus sparse single high ticks (drips). It must still
  satisfy the percussion gate with `percussionGap 32` declared.
- **mood direction** Nothing here is sad or tense; it is *attentive*. Write for the space
  between events — a note that lasts four bars is a legitimate compositional statement at
  this tempo. **Something always sounds**: the render gate fails on any 1.2-second window
  below −60 dBFS, so pad or triangle must sustain through every transition, including the
  loop seam.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["A","P","4","7","B"]`
  · `bpmRange [89,91]` · `durationSec [110,124]` · `key "f-lydian"` · `loopFrame 1` ·
  `percussionGap 32`.

### 4.6 `switch-cutter.json` — batch B

- **energy** sharp, wiry, slightly sardonic; a groove that keeps changing its mind about
  its own tone.
- **meta** `tempo 160 · speed 6` → **160 BPM**, ticksPerRow 5.625, **row pattern
  `6 6 5 6 6 5 6 5`**, **6.00 s/frame**. `evenTempo: false`.
- **key** C minor. Non-diatonic colours: a **blue ♭5 (g♭)** as a chromatic passing tone in
  the riff, and **G7 (b♮)** at every section cadence.
- **form** riff-driven, **18 frames ≈ 108 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | riff on `lead-thin` at duty 0, drums only on the off-beats |
  | 2–5 | A | riff at full kit; `Vxx` repaints the lead's duty every 2 bars |
  | 6–7 | A′ | same riff, duty automation now *inside* the long notes (per-row `Vxx`) |
  | 8–11 | B | contrasting 8-bar line on `lead-round`; the riff moves to pulse 2 |
  | 12–13 | break | `Sxx`-chopped riff fragments, drums stripped to kick and hat |
  | 14–17 | A″ | riff, all three duties cycling, both pulses in unison for the last 2 bars |
- **owns** (1) **duty automation as the hook** — `Vxx` per row on sustained lead notes,
  `dut-pwm-fast` on the riff instrument, and one section where the *only* thing that
  changes between repeats is timbre; (2) **the fractional 6/7 swing** as the groove — the
  riff is written on off-beats so the alternating row lengths are maximally audible;
  (3) **`Sxx` staccato chokes** cutting notes mid-row to make the riff spit.
- **kit** tight and dry: `kick`(35, tight) on 1 and the "and" of 3, `snare`(41, high) on 2
  and 4, `hat-closed` on off-beat 8ths only (the swing does the rest), `metal`(44, mode 1)
  ticks as an accent every 4 bars.
- **mood direction** Nervy and confident — a riff that sounds like it is being *sharpened*
  as it repeats. Let the duty changes carry the development so the notes can stay stubbornly
  the same; the listener should notice the tone shifting before they notice why. The blue
  ♭5 is a wink, not a wound: place it on a weak beat, passing.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` · `effects ["V","0","S","A","B"]`
  · `bpmRange [158,162]` · `durationSec [100,116]` · `key "c-minor"` · `loopFrame 2` ·
  `notes: "fractional tempo — rows alternate 6/6/5/6/6/5/6/5 by design"`.

### 4.7 `rust-and-neon.json` — batch C

- **energy** heavy, half-time, humid; swagger with rust on it.
- **meta** `tempo 150 · speed 9` → **100 BPM**, 9 ticks/row, **9.60 s/frame**.
- **key** E minor with **phrygian colour: b♭II (F major)** as the piece's signature chord;
  second colour, a **B7 (d♯)** at the final turnaround.
- **form** riff-driven, **12 frames ≈ 115.2 s**, loop @ frame 1.

  | frames | section | content |
  |---|---|---|
  | 0 | intro | DPCM kick alone, four bars, then triangle |
  | 1–4 | A | the riff — triangle and both pulses in rhythmic unison on a syncopated figure |
  | 5–6 | B | pulses hold tremolo'd chords while the drums carry the section |
  | 7–8 | break | DPCM only, then noise ghosts; the ducking pump is fully exposed here |
  | 9–11 | A′ | riff with the F-major phrygian turn, `metal` ticks doubling the hat |
- **owns** (1) **DPCM drums** — `dpcm-kick`(36) and `dpcm-snare`(39) carry the backbone
  while the noise lane is demoted to hats and ghost hits, which is the *only* arrangement
  in the album where noise is not the kit; (2) **the ducking pump as a mix feature** —
  place the triangle's re-strike under the DPCM kick so the bass visibly breathes with the
  beat, and expose it nakedly in the break; (3) **`7xy` tremolo** on the sustained pulse
  chords in B, plus **`Vxx`** noise-mode switching for the metal ticks.
- **kit** dpcm lane: kick + snare. noise lane: `hat-closed`(45) 8ths, `metal`(44) accents,
  ghost `snare`(39) at vol 4–6 between the DPCM hits. No noise kick at all.
- **mood direction** Slow and physical — every hit should feel like it weighs something.
  The half-time grid means space is the default; resist filling it. Let the DMC's ducking
  of the triangle be part of the groove rather than a defect to be engineered around, and
  make the phrygian b♭II arrive on a downbeat so it lands like a door opening.
- **declare** `channels ["pulse1","pulse2","triangle","noise","dpcm"]` ·
  `effects ["7","S","G","V","A","B"]` · `bpmRange [99,101]` · `durationSec [108,122]` ·
  `key "e-minor"` · `loopFrame 1`.

### 4.8 `long-division.json` — batch C

- **energy** the finale: purposeful, cumulative, resolving. The longest and the fullest.
- **meta** `tempo 150 · speed 6` → **150 BPM**, 6.40 s/frame; **`F07` at the bridge**
  drops to 128.6 BPM and `F06` restores it.
- **keys** **A minor → C major → D minor → A minor.** C major is the relative (zero
  accidentals); D minor adds only b♭, and its section is capped at 5 frames so global
  accidentals stay under Gate B's 12 %. Non-diatonic colours: **E7 (g♯)** as the pivot back
  to A minor, and a **Neapolitan B♭ major** at the last cadence.
- **form** song form + coda, **25 frames ≈ 160 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | the motif, bare, one voice, no drums |
  | 2–6 | A (Am) | full arrangement; motif stated twice, answered by its inversion |
  | 7–10 | B (C) | relative-major lift; pivot is the shared Am chord, arrived at on a bare unison lead-in |
  | 11–13 | bridge (Dm) | **`F07`** — tempo drops, texture thins to triangle + one pulse, `3xx` portamento throughout |
  | 14–15 | retransition | **`F06`** restores tempo over a bar of E7; drums re-enter on the last beat |
  | 16–20 | A′ (Am) | motif in **augmentation** (doubled note values) over the original bass, both pulses in octaves |
  | 21–24 | coda | Neapolitan B♭ → E7 → Am; DPCM snare accents on the last two frames; the last bar is a turnaround, not a stop |
- **owns** (1) **three key centres with prepared modulations** — pivot chord, bare unison,
  and a dominant bar, one technique per transition so the piece teaches all three;
  (2) **`Fxx` as a structural event** — a real tempo change and a real return, with the
  macro timings re-auditioned at both speeds; (3) **motif development across the whole
  form** — statement, inversion, augmentation, re-orchestration onto the triangle in the
  bridge. DPCM appears only as snare reinforcement in the coda.
- **kit** full noise kit throughout (`kick` 36 · `snare` 39 · hats · `crash`), plus
  `tri-kick` on section downbeats and `dpcm-snare`(39) doubling the backbeat in the coda
  only.
- **mood direction** This one has to *arrive*. Every section should feel like it is
  spending something the previous section saved: the bare intro buys the full A, the
  thinned bridge buys the augmented return, and the coda's Neapolitan buys the final
  cadence. Keep the motif recognisable through all four of its transformations — if a
  listener cannot hear that the bridge and the coda are the same idea, the form has failed.
- **declare** `channels ["pulse1","pulse2","triangle","noise","dpcm"]` ·
  `effects ["F","B","D","0","3","V","A","G","S"]` · `bpmRange [128,151]` ·
  `durationSec [150,175]` · `key "a-minor"` · `loopFrame 2` ·
  `notes: "three key centres; Fxx tempo event at frames 11 and 14"`.

### 4.9 batch assignment

Three composer agents, no shared files, no serialization (§7.4).

| batch | pieces | why these three together | also owns |
|---|---|---|---|
| **A** | `iron-sunrise` (150, D dorian, driving) · `glass-ladder` (128.6, A major, arpeggio) · `midnight-ferry` (140 swung, G minor, echo/canon) | one straight-driving, one bright mid-tempo, one swung nocturne; techniques split across articulation, harmony-by-arpeggio, and the pulse-2 vocabulary | — |
| **B** | `paper-lanterns` (112.5, B♭ major, 3/4) · `tide-pool` (90, F lydian, ambient) · `switch-cutter` (160 swung, C minor, duty) | the widest tempo spread in the album (90 → 160) and the three most timbre-led pieces; two of the three break the default 4/4-with-kit arrangement | — |
| **C** | `rust-and-neon` (100, E minor, DPCM) · `long-division` (150 + tempo event, three keys, finale) | the two pieces that use the fifth voice and the two that need the most infrastructure; both depend on the bank being right | **the shared bank** (§3), `tools/songs/makeDpcm.mjs`, `tests/fixtures/songs/shared-bank.json` + its pin test, `src/assets/songs/index.ts`, the preview harness (§7.2), and the Gate-B amendment (§7.1) |

**Ordering:** batch C ships the bank and the DPCM samples **first** (they are the shared
dependency); A and B start from the bank fixture the moment it exists and then run fully in
parallel. Nothing else is shared: each agent touches only its own three song files.

---

## 5. the `extra.qa` block — every album piece declares itself

`extra` is round-tripped verbatim and never interpreted by the driver (§1.2), so this is
free metadata that both the deterministic gates and the critic read. Album pieces carry
the §5.3 fields plus five more.

```json
"extra": {
  "qa": {
    "key": "d-dorian",
    "channels": ["pulse1", "pulse2", "triangle", "noise"],
    "effects": ["Q", "R", "G", "A", "0", "B"],
    "bpmRange": [148, 152],
    "durationSec": [100, 118],
    "loopFrame": 2,
    "form": ["intro", "intro", "A", "A", "A", "A", "A'", "A'", "B", "B", "B", "B",
             "break", "A''", "A''", "A''", "A''"],
    "motif": { "channel": "pulse1", "patterns": [0, 2, 6], "variation": "octave + A7 turn" },
    "bank": { "instruments": ["lead-bright", "echo-thin", "bass-short", "kick", "snare",
                              "hat-closed", "hat-open", "crash"], "rev": 1 },
    "percussionGap": 8,
    "notes": "047 = param 71 = major triad; P7e = param 126 = −2 units detune"
  }
}
```

| field | meaning |
|---|---|
| `loopFrame` | the order frame the final `Bxx` targets. Gate: the last frame's `Bxx` param equals it, and it is > 0 whenever there is an intro |
| `form` | one label per order frame, same length as `order`. The critic compares this to the brief |
| `motif` | where the piece's subject lives, so the critic can find it without guessing |
| `bank` | canonical instrument names used (§3.1), for the bank-drift pin |
| `percussionGap` | max allowed silent rows in the noise lane; default 8, cap 32. Only `paper-lanterns` (24) and `tide-pool` (32) raise it, and both say why in `notes` |

---

## 6. the critic rubric

A reviewer agent scores each piece on **ten axes, 1–5**, reading the JSON (and, where the
axis needs it, the rendered WAV). Every score needs one sentence of evidence naming a
frame, pattern and row — a score without a location is not a finding.

| # | axis | 5 = | 3 = | 1 = |
|---|---|---|---|---|
| 1 | **form fidelity** | `extra.qa.form` matches the brief's frame map exactly; section lengths and the asymmetry are where the brief put them | one section short or long, form still legible | order list does not resemble the brief |
| 2 | **motif development** | motif recurs ≥ 3× with ≥ 2 genuine variations (transposition/augmentation/inversion/re-orchestration) | 3 recurrences, 1 variation | literal repeats only, or no identifiable motif |
| 3 | **cadences + harmony** | every section closes with a nameable cadence; ≥ 1 non-diatonic colour, correctly prepared and resolved | cadences present but one is a fade-out; colour present but unprepared | no functional closure; parallel-triad drift |
| 4 | **counterpoint** | ≥ 2 cadences with contrary motion; bass never shadows the melody > 4 beats; rhythmic differentiation throughout | 1 contrary-motion cadence; some shadowing | bass and lead move as one voice |
| 5 | **melodic contour** | ≥ 70 % stepwise; one peak per section on a strong beat; global peak in the last third; every phrase breathes | contour sound but peaks repeat | random-walk melody, no phrase rests |
| 6 | **dynamics** | ≤ 45 % of note events at vol 15; ≥ 5 distinct column values; ≥ 3 per melodic channel; ≥ 1 bar with 2+ voices resting | histogram acceptable but no resting bar | everything at 15 |
| 7 | **briefed techniques** | all 2–3 signature techniques present, prominent, and used the way §2 describes | present but incidental | one or more absent |
| 8 | **groove consistency** | tempo/speed match the brief; swung pieces are written so the alternation reads; `Gxx` nudges ≤ 2 ticks and never on a section downbeat | minor drift | wrong tempo family, or swing inaudible |
| 9 | **loop seam** | all five §2.9 loop rules hold; the render's last 0.3 s and the loop row's first 0.3 s are compatible (no click, no orphaned effect, no stranded note) | one rule bent, seam still clean by ear | audible click, hung note, or effect running into the loop |
| 10 | **bank + engine hygiene** | bank instruments byte-identical to §3; no pulse note < MIDI 33; noise notes inside 32–47; every pitch macro ends on 0; effect params decimal and correct | one hygiene slip, non-audible | wrong-pitch clamping or a wrapped drum |

**Thresholds.** Total ≤ 50.
- **Any axis ≤ 2 → mandatory revision**, no discussion.
- **Total < 38 → mandatory revision.**
- **Total 38–43 → revision at the director's discretion**, with the two lowest axes named.
- **Total ≥ 44 and no axis below 3 → pass to audition.**
- Axes 1, 7, 8, 10 are mostly mechanical and the critic should score them from the document
  before listening; 2–6 and 9 need the render.

The critic also re-runs the §7.1 gates and reports them **separately** — a gate is pass/fail
and never contributes to the score. A piece that fails a gate does not get scored.

---

## 7. production pipeline

### 7.1 deterministic gates (no ears required)

Album pieces run the **existing four gates** of `phase2-design.md` §5.5 unchanged —
A structural, B musicality lint, C offline render, D anti-vacuity — via
`tests/unit/presets.test.ts`, which grows from 4 presets to 12 by iterating
`src/assets/songs/index.ts`. Gate C renders album pieces with `loops: 2` so the loop seam is
inside the checksummed audio; **`extra.qa.durationSec` describes ONE pass** (frame 0 through
the last frame), so the duration assertion divides the rendered length by the pass count
rather than comparing it raw. Say so in the test, or the first album piece fails on arrival.

**One amendment, owned by batch C.** Gate B's percussion rule is currently a constant
("≥ 16 note events, no silent gap > 8 rows"). Two album pieces are deliberately sparse, so
the rule reads its bound from `extra.qa.percussionGap` (**default 8, hard cap 32**) and its
event floor from `extra.qa.percussionMinEvents` (default 16, floor 8). The cap is what
keeps the gate non-vacuous, and a raised value requires a `notes` justification. Two new
Gate-B checks come with it, both cheap and both from §5 of this document:

- **loop-frame check**: the last order frame's last row carries `Bxx` with `param ===
  extra.qa.loopFrame`, and no `Cxx` appears anywhere in an album piece.
- **bank-drift check**: every instrument whose `name` is a canonical bank name resolves to
  exactly the canonical macro values (`tests/fixtures/songs/shared-bank.json`); names
  outside the bank must match `^x-<songid>-`.

Gate D extends by one fixture: a song whose loop `Bxx` points at the wrong frame must fail
the loop-frame check, and a song with a mutated `lead-bright` must fail the bank-drift
check. A gate that cannot fail is not a gate.

### 7.2 WAV previews — the part that is for the user's ears

The gates prove the songs are *correct*. Only the user can say they are *good*, so every
piece renders to a listenable file.

- **Encoder: `src/tracker/wav.ts`** — `encodeWavPcm16(samples: Float32Array, sampleRate:
  number): Uint8Array`. ~40 lines: 44-byte canonical RIFF/WAVE header, mono, 16-bit,
  `round(clamp(x, −1, 1) · 32767)`. It lives in `src/` for the same reason `offlineRender`
  does — **Phase 3's WAV export is this function** plus a download. DOM-free, no dependency.
- **Harness: `tests/preview/renderPreviews.test.ts`**, skipped unless
  `PULSAR_PREVIEW=1`:

  ```ts
  describe.skipIf(process.env.PULSAR_PREVIEW !== '1')('song previews', () => { … })
  ```

  It walks `PRESETS`, calls `renderSong(song, { sampleRate: 48000, loops: 2 })`, writes
  `previews/<id>.wav`, and prints one line per song: id · duration · full-mix RMS dBFS ·
  peak · clipped samples · checksum. The default `pnpm test` run is untouched (the file
  matches `tests/**/*.test.ts`, so the skip guard is what keeps it inert and out of CI).
- **Script:** `"preview:songs": "PULSAR_PREVIEW=1 vitest run tests/preview/renderPreviews.test.ts"`.
- **`previews/` goes in `.gitignore`.** Rendered audio is a build artifact, not a source.
- **No normalisation, no limiting, no extra gain.** The preview is the mix. If it is quiet,
  the arrangement is quiet, and that is information the user needs.
- Renders are ~1–2 s of CPU per song (faster than realtime through the same core), so the
  whole album previews in well under a minute.

**One level caveat, stated once so nobody re-derives it from a listening test.** Previews —
and every gate measurement in `presets.test.ts` — render at `masterGain 2.0`, the offline
renderer's default. That is the unity-full-scale mapping and it is exactly the master
knob's maximum: the app's taper is `2.0 · v²`, so the knob at its top is the same gain
these files were rendered at. The app's *default* knob position is 0.72, which is
`2.0 · 0.72² = 1.0368` — about **5.7 dB quieter** than the preview of the same song.
Nothing about the mix changes with it: relative channel levels, the clipping margin and
every dBFS *difference* the gates assert are all gain-invariant, and no gate threshold is
affected. It only means an auditioner comparing a preview against the running app should
put the master knob at maximum first, or they will hear the app as the quieter of the two
and blame the arrangement.

### 7.3 the loop, end to end

1. **Director** hands each composer agent this document plus its batch's briefs.
2. **Batch C first**: shared bank fixture + `makeDpcm.mjs` + the two samples' base64 +
   `index.ts` skeleton + the Gate-B amendment. Reports when the bank is pinned.
3. **Composers write JSON directly** — no DSL, no generator (§5.3 rule 1). Decimal params.
   `extra.qa` filled in as they go, not retrofitted.
4. **Gates**: `pnpm test tests/unit/presets.test.ts`. An agent does not report done until
   its pieces are green. A failing gate is never "waived".
5. **Critic agent** scores each piece on §6 and returns a per-piece report: scores,
   evidence locations, and a ranked revision list. Gate failures are reported separately
   and block scoring.
6. **Preview render**: `pnpm preview:songs` → `previews/*.wav` + the level table.
7. **User audition.** The user listens and gives notes. This is the only opinion that
   ships the album.
8. **One revision round.** Composers apply user notes + critic findings, re-run gates,
   re-render, update the pinned checksum in the same commit (§5.5's rule: changing a preset
   requires updating its pin, which is the point).
9. **Ship**: songs in `src/assets/songs/`, chips in `PresetBar.svelte` (§5.6), one line in
   `NOTICE.md` recording that the preset songs are original compositions.

### 7.4 parallelism

**No serialization discipline is required.** Everything here is pure CPU — JSON authoring,
a DOM-free renderer, vitest in node. There is no GPU, no shared device, no audio hardware
in the loop, and no port to contend for. The three composer batches run **fully in
parallel** after batch C's bank lands; the critic can score a piece the moment its gates
are green rather than waiting for the album.

The only real coupling is file ownership, and it is disjoint by construction:

| agent | writes |
|---|---|
| batch A | `src/assets/songs/{iron-sunrise,glass-ladder,midnight-ferry}.json` |
| batch B | `src/assets/songs/{paper-lanterns,tide-pool,switch-cutter}.json` |
| batch C | `src/assets/songs/{rust-and-neon,long-division}.json`, `src/assets/songs/index.ts`, `tests/fixtures/songs/shared-bank.json`, `tools/songs/makeDpcm.mjs`, `tests/unit/presets.test.ts`, `src/tracker/wav.ts`, `tests/preview/renderPreviews.test.ts` |

Batch C's `index.ts` lists all twelve entries from the start (four demos + eight album), so
A and B never edit a shared file; a missing song file is a build error that tells batch C
its dependencies have not landed yet.

---

## 8. sources

Composition craft in §2 is drawn from publicly documented, licence-safe technique writeups.
No FamiTracker, 0CC, Dn or Furnace **source** was read (the §3 source discipline of
`phase2-design.md` holds here too), and **no existing musical work was transcribed,
analysed bar-by-bar, or used as a model** (§0.1).

- [DDRKirby(ISQ), "NES Chiptunes in *Unlock Everything*"](https://ddrkirby.com/articles/nes-chiptunes-unlock-everything/nes-chiptunes-unlock-everything.html)
  — channel allocation; the echo technique stated explicitly ("the second channel will play
  the exact same notes, but a bit later, softer, and with a small amount of detuning");
  25 % duty as a lead choice; delayed pitch vibrato on long notes; triangle pitch-slide
  percussion.
- [btothethree, "How to Use FamiTracker — Chapter 6: Wrangling the Noise Channel"](https://btothethree.tumblr.com/post/109306979202/how-to-use-famitracker-chapter-6-wrangling-the)
  — the drum-kit shapes: kick = low period + fast decay, snare = mid period + a rising
  two-tone arpeggio for the strike, hats = high period + very short decay and a reduced
  starting volume, crash = slow decay with a shallow vibrato.
- [Ozzed, "How to make 8-bit music — a comprehensive guide"](https://ozzed.net/how-to-make-8-bit-music.shtml)
  — duty-cycle timbre language ("the closer to 50 % … the more hollow it will sound");
  arpeggio as the chord substitute on a monophonic channel and the `047` major-triad
  convention; noise frequency placement (high = hats, mid = snare, low = kick); triangle as
  tom via fast downward slides.
- [pinobatch/pently — `docs/famitracker.md`](https://github.com/pinobatch/pently/blob/master/docs/famitracker.md)
  — drums as fixed-pitch sound effects, and the noise+triangle two-channel drum idiom.
- Engine facts in §1 and §3 come from this repository: `src/tracker/driver/*`,
  `src/audio/host/pitch.ts`, `docs/phase2-design.md`, `docs/register-timeline.md`,
  `docs/deviations.md`, and plan-file §B7's verified constant tables.

---

## 9. the prestige pass — addendum (binding)

User feedback on the first two rendered pieces: *"a nice start — albeit a little
generic-sounding. I'm hoping for compositions with more complexity, polyrhythms, prestige
chiptune feel."*

**This section is the binding form of that direction and supersedes the interim message the
batch composers received.** It is an addendum: §§0–8 stand as written. Where it tightens an
earlier rule it says so in bold, inline. Three earlier rules are tightened here — §2.2's
default posture for pulse 2 (**9.2**), §2.10's non-diatonic floor (**9.3**), and §6's rubric
and thresholds (**9.5**). Everything else in §§0–8 is unchanged and still binding.

**Section map:** 9.1 polymeter/polyrhythm catalog · 9.2 counterpoint upgrade · 9.3 harmonic
ambition floor · 9.4 rhythm and drum language · 9.5 rubric changes · 9.6 revision brief:
`07-rust-and-neon` · 9.7 revision brief: `08-long-division` · 9.8 constraints that do not move.

**The one-sentence definition of the target.** Prestige is **line independence** — every
sounding voice has its own rhythm, its own contour and its own reason to be there — plus a
metric layer the ear can feel arguing with the bar. It is **not** more notes. A piece that
gets busier without getting more independent has moved away from the target, not toward it.

### 9.1 polymeter and polyrhythm — tracker-exact recipes

**The one structural fact that governs all of this.** `rowsPerPattern` is *song-level*: there
are no short patterns and no per-lane pattern lengths. Every lane advances frames together.
So **polymeter here is always written straight through the global grid** — you author the
phase carry by hand, across as many patterns as the cycle needs. Two mechanisms, and only
two: (a) an odd-period cell written out with its phase carried across N patterns, and
(b) `Dxx` truncating a frame.

Grid vocabulary at the album's standard `rowsPerPattern: 64`, `rowHighlight: 4`:
**1 row = 16th · 2 = 8th · 3 = dotted-8th · 4 = beat · 6 = dotted-quarter · 8 = half-bar ·
16 = bar · 64 = frame (4 bars).**

**Phase-carry table (64-row frames).** A cell of length `c` re-aligns with the frame boundary
after `lcm(c,64)/64` frames. The **entry row** of frame `k` — the local row of that frame's
first attack — is `ceil(64k/c)·c − 64k`, equivalently `(−64k) mod c`. Author one pattern per
distinct entry row and cycle them in the order list. **Compute this, do not guess it: the
sequence is not `0,1,2,…` and it is not the obvious one.**

| cell `c` | frames to re-align | entry rows, in frame order | reads as |
|---|---|---|---|
| 3 (dotted-8th) | **3** | **0, 2, 1** | 3-against-4: a fast limp that walks around the beat |
| 5 | **5** | **0, 1, 2, 3, 4** | 5-over-4: the phase shift itself is the subject |
| 6 (dotted-quarter) | **3** | **0, 2, 4** | 2:3 against the beat — the safest, most musical option |
| 7 | 7 | 0, 6, 5, 4, 3, 2, 1 | too long for a 12–18 frame piece; use only as a 1-frame gesture |
| 10 | **5** | **0, 6, 2, 8, 4** | 5-over-4 at the 8th level; the fast-tempo substitute for `c=5` |
| 12 | **3** | **0, 8, 4** | 3-against-4 at the half-note level; broad and structural |

For `paper-lanterns` (48-row frames): `c=6` re-aligns every frame (entry row 0 always —
useless as a polymeter, useful as a hemiola, see below); `c=5` takes **5** frames with entry
rows **0, 2, 4, 1, 3**; `c=7` takes 7, entry rows 0, 1, 2, 3, 4, 5, 6.

**Recipe A — 3-against-4 ostinato (dotted-8th cell).**
Attacks every 3 rows. Frame 1 pattern: rows 0, 3, 6, … 63. Frame 2 pattern (**entry row 2**):
rows 2, 5, 8, … 62. Frame 3 pattern (**entry row 1**): rows 1, 4, 7, … 61. Order the three
patterns and the cell resolves onto the downbeat exactly at frame 4. Put it on **pulse 2 or
triangle**, never the lead. At 150 BPM one cell is 0.30 s; at 100 BPM, 0.45 s.

**Recipe B — 5-over-4 phase shift (5-row cell).**
Attacks every 5 rows: entry rows 0, 1, 2, 3, 4 over five frames. Self-contained alternative when
five frames is too many: 12 cells (60 rows) + a 4-row cadential tag = 64, which re-aligns
every frame and reads as "the bar keeps arriving early". Best at **90–130 BPM**; above 140
the 5-row unit blurs — use `c=10` instead.

**Recipe C — tresillo (3+3+2).**
16th-level: an 8-row half-bar as 3+3+2 → attacks at rows **0, 3, 6** and **8, 11, 14** of
each 16-row bar. 8th-level: a 16-row bar as 6+6+4 → attacks at **0, 6, 12**.
Use 16th-level at **90–130 BPM**; at 140–160 it becomes a gallop, so use the 8th-level
grouping there. Tresillo on the bass with a straight kit above it is the single cheapest
upgrade available to a four-square riff.

**Recipe D — 2:3 between lanes.**
Triangle on a 6-row cell (rows 0, 6, 12, 18, …) against a kit on the 4-row beat: two bass
attacks per three beats. The pair re-aligns every 12 rows (3 beats) and against the 16-row
bar every 48 rows (3 bars). Keep the two lanes in different registers or the ear fuses them.

**Recipe E — hemiola cadence.**
6 rows against a 4-row beat *is* 3:2. In 4/4: take the **last 3 bars before a cadence
(48 rows) and accent every 6 rows** — rows 0, 6, 12, 18, 24, 30, 36, 42 of that span; eight
groups, closing exactly on the barline. In 3/4 (`paper-lanterns`, 12-row bars): **2 bars =
24 rows regrouped as 3 × 8 rows.** Put the accents on pulse 2 and the kit and let the
triangle hold, so the metre dissolves and then snaps back at the cadence.

**Recipe F — motif displacement.**
Restate the motif at **+2 rows** (an 8th late), **+1** (a 16th late), or **−1**
(anticipated). Every displaced restatement is a *new pattern*: shift each row's `r` and
either (a) write the 1–2 wrapped rows into rows 0–1 of the pattern the next frame plays, or
(b) shorten the phrase's last note so nothing wraps. (b) is safer and is the default.
Audibility: ±1 row reads at 90–105 BPM; at 140–160 use ±2 or ±4.

**Recipe G — `Gxx` sub-row displacement.**
`Gxx` delays a channel's note by `xx` ticks. At speed 6, `G03` = half a row (a 32nd); at
speed 9, `G03` = ⅓ of a row. A whole lane held at `G01`–`G02` sits *behind* the beat; a lane
alternating `G00`/`G02` swings a straight-tempo piece. Legible at **90–130 BPM only** —
above that a tick reads as timbre, not time. **Caveat:** `Gxx` delays macro index 0 too, so a
6-tick drum envelope under `G03` loses half its tail.

**Recipe H — metric insertion via `Dxx`.**
`Dxx` on any row ends the frame after that row and starts the next frame at row `xx`.
- **Drop one beat:** `D00` on **row 59** of a 64-row frame → a 60-row frame whose last bar
  is 12 rows (3 beats).
- **Drop two beats:** `D00` on **row 55** → 56 rows.
- **Add one beat:** insert an extra order frame and put `D00` on **row 3** of it → a 4-row
  frame. This is the only way to lengthen; there are no short patterns.
- **Elide into the next section:** `D08` on the last row → the next frame starts at row 8,
  skipping its first half-bar.
The row accumulator carries across the jump, so a swung piece keeps its groove, and Gate B's
no-dead-frames check still passes because the target frame is reached. Budget: **one metric
surprise per piece** (§9.4) — two is a gimmick.

**Where each device reads best.**

| device | 90–105 BPM | 110–130 | 140–160 |
|---|---|---|---|
| 3-row cell (A) | clear, spacious | **ideal** | reads as shimmer/texture |
| 5-row cell (B) | **ideal** | good | blurs — use `c=10` |
| 6-row cell (D) | good | **ideal** | **ideal** |
| tresillo 16th (C) | **ideal** | good | gallops — use 6+6+4 |
| hemiola (E) | good | **ideal** | **ideal** |
| displacement ±1 row (F) | audible | marginal | inaudible — use ±2 |
| `Gxx` sub-row (G) | **ideal** | good | do not bother |
| `Dxx` insertion (H) | **ideal** | **ideal** | **ideal** |

### 9.2 counterpoint upgrade — pulse 2 is a voice, not a mirror

**This tightens §2.1 and §2.2.** §2.2 offered echo, harmony and countermelody as three equal
options for pulse 2 and gave the echo trick pride of place. From now on:

- **The DEFAULT posture for pulse 2 is an independent line** — its own rhythm, its own
  contour, its own phrase shape. Not the lead's rhythm at another interval.
- **Echo and canon are demoted to deliberate section colours.** They are still excellent and
  §2.2's recipes are unchanged, but they may cover **at most one third of a piece's frames**,
  and `midnight-ferry` — whose whole brief is the echo/canon vocabulary — is the single
  exception, where they may cover two thirds.

**Complementary rhythm, measured.** Across any section, **≥ 40 % of pulse 2's attacks must
fall on rows where pulse 1 has no attack**, and the two lanes must not share an identical
attack-row set in any pattern. The practical device: pulse 2 moves *while the lead holds or
rests*. §2.10's rule that every lead phrase ends with a beat of rest exists precisely to
give pulse 2 somewhere to speak.

**Own contour.** Contrary or oblique motion against pulse 1 on **≥ 50 % of shared attack
rows**; the two lines never place their section peak on the same row; pulse 2 stays below
pulse 1 except for one deliberate voice-crossing per piece.

**Written suspensions and appoggiaturas** — the cheapest prestige on this hardware, because
they cost nothing but row placement:
- **Suspension:** hold a chord tone from the previous chord across the change (2–4 rows into
  the new chord), then **resolve down by step**. At 4 rows/beat: the chord changes on row 0,
  the suspended note sounds rows 0–3, the resolution lands on row 4. A 4–3 suspension over a
  dominant is the classic cadential form and it is *audible* on a pulse channel.
- **Appoggiatura:** attack a non-chord tone **on** the strong beat and resolve by step within
  1–2 rows. Put it in the lead at a phrase peak.
- **Quota:** **≥ 2 written suspensions or appoggiaturas per piece**, at least one at a
  cadence. Name them in `extra.qa.notes` with `frame:row`.

**When parallel thirds/sixths are earned.** Only after the two voices have been demonstrably
independent for **≥ 8 bars**; only for **≤ 4 bars** at a time; and only as a hook, a chorus
lift, or a final statement. Parallel motion as a section's default harmonic posture is now a
rubric-4 failure, not a style choice.

### 9.3 harmonic ambition floor — raised

**This tightens §2.10.** The floor was "at least one non-diatonic colour per piece". It is now:

**≥ 2 *distinct* non-diatonic devices per album piece, occurring in different sections**,
each named in `extra.qa.notes` with `frame:row`. From this menu (a borrowed iv and a borrowed
♭VI count as **one** device — modal interchange — not two):

| device | what it is | cheap 3-voice voicing |
|---|---|---|
| **chromatic mediant** | a triad a third from the tonic whose quality is not the diatonic one (in C major: E major, E♭ major, A♭ major) | triangle takes the new root; the two pulses take the third and fifth; keep one common tone stationary |
| **chained secondaries** | V/V → V → i, or V/vi → vi → V/V → V — two or more links | each link raises one note by a semitone; put the raised tone in pulse 2 so the lead stays singable |
| **chromatic bass descent** | a stepwise chromatic line in the triangle under a held or slowly-moving harmony, 4+ links | triangle walks; pulses hold; the harmony is *implied* by the collision |
| **true pivot modulation** | a chord functioning in both keys, approached in the old key and quitted in the new | state the pivot bare (two voices), then confirm the new key with its dominant |
| **augmented sixth** | ♭6 in the bass, 1 and ♯4 above, resolving outward to V | triangle ♭6, pulse 1 ♯4, pulse 2 the tonic — three voices, exactly the chord, resolves by contrary motion |
| **Neapolitan ♭II** | major triad on ♭2, usually first inversion, into V | already used by `long-division`'s coda |
| **common-tone diminished** | a fully-diminished chord sharing a tone with its target | one held pulse note, everything else moves by semitone |
| **modal interchange** | borrowed iv, ♭VI, ♭VII, ♭II, picardy third | the album's existing vocabulary |

**The no-stock-loop rule.** No album piece may be built on a repeating four-chord loop.
Specifically banned as a *section's or piece's harmonic backbone*: `I–V–vi–IV` and every
rotation of it, `vi–IV–I–V`, `i–♭VII–♭VI–V` held for a whole section, a looped `ii–V–I` with
no destination, and 12-bar blues as an entire form. Mechanically: **no four-chord cycle may
repeat for more than 8 consecutive bars anywhere in a piece.**

Two positive requirements come with it: **(1)** at least one section whose *harmonic rhythm*
differs from the others (two chords per bar against one chord per two bars, say), and
**(2)** at least one progression that is a **sequence going somewhere** — a descending-fifths
or descending-thirds chain of ≥ 3 links — rather than a loop returning to its start.

**Melodic chromaticism.** Chromatic passing tones between scale degrees a whole tone apart;
chromatic lower neighbours into a strong-beat target; ♯4→5 and ♭6→5 inflections; a chromatic
approach on the row before a downbeat. Rules that keep it craft rather than noise: **every
chromatic note resolves by step in the same direction within 2 rows**, no chromatic note is
held longer than 2 rows, and the accidental budget is Gate B's 12 % — which works out to
roughly **one chromatic event every two bars in the lead**, concentrated in the sections that
own it rather than sprinkled evenly.

### 9.4 rhythm and drum language

**Ghost notes.** The backbeat is not the drum part. Between the accented hits, write snare
ghosts at **vol 3–6** on off-16ths. Concrete, on a 16-row bar with backbeats at rows 4 and
12: ghosts at rows **6, 10, 14** at vol 4–6, and a ghost at row 15 pushing into the next
downbeat. Ghosts use the same `snare` instrument — the volume column is the whole difference.

**Per-section kit variation — never one loop throughout.** Each section changes **at least
two** of: hat density (16ths → 8ths → off-beats only), hat instrument (`hat-closed` →
`hat-open` on a chosen subdivision), kick placement, snare timbre (note 39 ↔ 41), the
presence of `metal`(44, mode 1) ticks, ghost density. A hat lane that plays the same
subdivision at the same two volumes for the whole piece is now a rubric finding, not a
neutral choice.

**Fills on 8-bar seams.** Every 8-bar unit ends with a fill in its **last 8 rows** (half a
bar) or **last 16 rows** for a section-ending fill. Materials: `tom`(37/43) with
`pit-tom-drop`; a **pitch-macro sweep riser** — a noise note with a pitch macro ramping the
index *down* (`[-1,-1,-1,-1,-1,-1,-1,-1,0]` on a note at index 10, rising over 8 ticks);
a **faller** using `pit-kick-drop`-shaped values on a mid note; a `crash` on the following
downbeat. **No two fills in a piece may be identical** (this restates §2.10's quota and makes
it explicit at the 8-bar seam).

**One metric surprise per piece.** Exactly one: a dropped beat (`D00` on row 59, recipe H), a
dropped two beats, an inserted 4-row frame, or a full bar where the kit stops and only the
polymetric cell continues. Place it at a section seam where it *does* something — before a
break, into a modulation, at the return of the main theme.

### 9.5 rubric changes — **supersedes §6's axis 4 and §6's thresholds**

**New axis 11 — metric & polyrhythmic interest.**

| 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|
| ≥ 2 distinct structural devices from 9.1, one carrying its phase across ≥ 3 frames, **plus** the piece's metric surprise, all cited `frame:row` | **one structural polyrhythmic device, verifiable at a stated `frame:row`**, spanning ≥ 2 frames or a full section, **plus** displaced restatements of the main material | surface syncopation plus one tresillo or hemiola moment, but the bar is never genuinely challenged | mild syncopation only | four-square throughout |

**Axis 4, counterpoint — tightened.** A **4 now requires sustained line independence, not
moments**:

| 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|
| independence sustained across ≥ 2 sections, ≥ 2 written suspensions/appoggiaturas incl. one cadential, ≥ 2 contrary-motion cadences, parallels only as an earned ≤ 4-bar gesture | **independence sustained through at least one complete section** — pulse 2 with its own rhythm and contour for the whole of it — plus ≥ 1 suspension/appoggiatura and ≥ 1 contrary-motion cadence | independence in *moments* only; thirds/sixths or echo is the default posture elsewhere | pulse 2 shadows pulse 1 rhythmically almost throughout | pulse 2 is a harmoniser or an echo machine and nothing else |

**New thresholds — these replace §6's "any axis ≤ 2, total < 38 / 50".** Total is now
**out of 55**:

- **Any axis ≤ 2 → mandatory revision.**
- **Total < 42 / 55 → mandatory revision.**
- Total 42–47 → revision at the director's discretion, two lowest axes named.
- Total ≥ 48 with no axis below 3 → pass to audition.

**Evidence requirement.** Self-scores and critic scores **must cite `frame:row` evidence for
axis 7 (briefed techniques) and axis 11 (metric interest)** — a claim without a location does
not count and the axis is scored as if the claim were absent. Axes 1, 7, 8, 10 and 11 are
scorable from the document; 2–6 and 9 need the render.

Gates remain pass/fail and outside the score (§7.1). A piece that fails a gate is not scored.

### 9.6 revision brief — `07-rust-and-neon.json` (batch C)

Self-contained: everything needed is here plus the file itself. **Keep the key (e-minor),
the tempo (`tempo 150 / speed 9` = 100 BPM), the 12-frame order and its form labels, the
DPCM identity (DPCM carries kick+snare, no noise kick anywhere), and `loopFrame 1`.** All
five rules of the loop convention (§2.9) still apply.

**What reads as generic, with evidence.**

1. *The riff is four-square and restated without displacement.* Frames 1, 2 and 4 all play
   `pulse1 p1` + `pulse2 p1` + `triangle p1` — the same four bars three times, unchanged.
2. *Pulse 2 is a rhythmic clone.* `pulse2 p1`'s attack rows (0, 6, 10, 14, 16, 20, 24, 32,
   38, 42, 46, 48, 54, 56, 58) are **identical** to `pulse1 p1`'s; it is the lead at a fixed
   interval below, and it holds that posture across four consecutive frames (1–4).
3. *The kit is one loop.* `noise p1` is 8th-note hats on note 45 at every even row 0–62 with
   the volume alternating 11/8, plus a snare on rows 6, 22, 38, 54 — and nothing between the
   backbeats anywhere in the piece.

**Prescribed changes.**

- **A. Displace and re-group the riff.**
  - Frame 1 keeps `pulse1 p1` as the statement.
  - **Frame 2** gets a new `pulse1` pattern: the same pitches **re-grouped as a 16th-level
    tresillo** — attacks on rows 0, 3, 6 · 8, 11, 14 · 16, 19, 22 · 24, 27, 30 and the same
    3+3+2 across bars 3–4. At 100 BPM a row is 150 ms, so the 3-row unit is a clearly
    audible 450 ms. Melodic content unchanged; only the grid changes.
  - **Frame 4** gets a new `pulse1` pattern: the riff **displaced +2 rows** (an 8th late) —
    every `r` becomes `r+2`, and the closing note is shortened so nothing passes row 63.
    Triangle and kit stay aligned; that collision is the effect.
  - Frame 3 (`A'`, the octave-up statement) is already a variation — leave it.
- **B. Give pulse 2 its own line.**
  - Re-author `pulse2 p1` **in place** — it is referenced by frames 1–4 and all four should
    get the improved line — so that **≥ 40 % of its attacks land on rows where pulse 1 has
    none**.
    Working target: drop its attacks at rows 6, 20 and 42, add attacks at rows 8, 12, 28,
    44 and 52, and let it *rise* where the lead falls. Harmonic function unchanged.
  - **A″ (frames 9–11):** author a genuinely independent `pulse2` counter-line, a new
    pattern for frame 10 and one for frame 11, moving where the lead holds. Include **one
    written suspension**: hold pulse 2's chord tone across the chord change at
    **frame 11 : row 32** and resolve it **down by step at row 36**.
- **C. Ghost notes and per-section kit variation.**
  - Ghost snares (same `snare` instrument, **vol 4–6**) on the off-16ths between backbeats:
    rows **11, 15, 27, 31, 43, 47, 59, 63**.
  - Change at least two kit elements per section: **A** = 8th hats as now; **B (frames 5–6)**
    = hats on off-8ths only plus a `metal`(44, mode 1) accent on row 0 of each bar;
    **break (frames 7–8)** = hats out entirely, ghosts only, so the DPCM pump is naked;
    **A″ (frames 9–11)** = 16th hats for the first two bars then back to 8ths, and move the
    snare to note **41**.
  - A **distinct** fill in the last 8 rows of frames 4, 6, 8 and 10 — one tom fill
    (37/43 with `pit-tom-drop`), one pitch-macro riser, one all-ghost fill, one crash-led.
    No two identical.
- **D. One metric surprise.** Put `D00` — `{"cmd":"D","param":0}` — on **row 59 of frame 6**
  (the last B frame). Frame 6 then runs 60 rows and the break lands a beat early.
  **Watch the pattern sharing:** frames 5 and 6 are `[3,2,2,4,2]` on *every* lane, so editing
  any existing pattern would truncate frame 5 as well. Author a **new noise pattern** for
  frame 6 (a copy of `noise p4` plus the `D00` at row 59, plus its own fill) and point frame 6
  at it — which also breaks up the two identical B frames, so this fixes two findings at once.
  **Add `"D"` to `extra.qa.effects`**, or Gate B's claimed-effects check will not see it and
  the unclaimed-effect path will.
- **E. Re-declare.** Update `extra.qa.notes` with `frame:row` citations for the tresillo, the
  displacement, the suspension and the dropped beat (axes 7 and 11 need them), then re-render
  and re-pin `renderChecksum` in the same commit.

**Target after revision:** axis 11 ≥ 4 (the tresillo restatement plus the dropped beat, both
cited), axis 4 ≥ 4 (pulse 2 independent through the whole of A″).

### 9.7 revision brief — `08-long-division.json` (batch C)

Self-contained. **Keep the 25-frame order and its form labels, the `F07`/`F06` architecture
at frames 11 and 14, the four key centres and their prepared modulations, and `loopFrame 2`.**
The loop convention (§2.9) still applies.

**What reads as generic, with evidence.** The modulations are prepared and the motif
development is real — the problem is the *surface between* them.

1. *The B section's accompaniment is four identical frames.* Frames 7–10 play `pulse2 p3`
   four times and `triangle p2` four times.
2. *The bridge is three identical frames.* Frames 11, 12 and 13 play `pulse1 p5`, `pulse2 p4`,
   `triangle p3`, `noise p9` — unchanged, three times.
3. *The A theme's accompaniment is metrically plain* — the triangle sits on the beat under
   frames 2–6 and nothing argues with the bar anywhere in the piece.

**Prescribed changes.**

**Read this first — pattern sharing.** Several of the changes below apply to *one* frame, but
that frame's pattern index is shared with others: `pulse1 p3` runs at frames 7 **and** 8,
`pulse1 p5` at 11–13, `pulse1 p7` at 16 **and** 18, `pulse2 p1` at frames 2, 3 **and** 5,
`pulse1 p6` at frames 14 **and** 15. **Editing in place changes every frame that references
the index.** Wherever a change is meant for one frame, author a **new pattern index** and
repoint that frame's entry in the order list; the order list's shape and its `form` labels do
not change.

- **A. Polymetric accompaniment cell under the A theme (frames 2–6).** Put a **6-row
  dotted-quarter cell on pulse 2**, phase-carried across three patterns:
  - frame 2 pattern — entry row 0: attacks on rows **0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60**;
  - frame 3 pattern — entry row **2**: rows **2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62**;
  - frame 4 pattern — entry row **4**: rows **4, 10, 16, 22, 28, 34, 40, 46, 52, 58**;
  - frames 5–6 keep their existing aligned `pulse2` patterns — the device gets a beginning
    and an end.

  These are **three new pattern indices** repointed at frames 2, 3 and 4; do not edit
  `pulse2 p1` in place or frame 5 loses its alignment. The harmony is unchanged; the cell is
  *when*, not *what*. This is the piece's axis-11 evidence: cite it as
  `frame 2 : row 0 → frame 4 : row 58`.
- **B. Displaced motif re-entries after each modulation.**
  - **Frame 7 (C major):** the motif re-enters **+2 rows** — a new pattern holding `pulse1
    p3`'s rows shifted by +2 with the last note shortened so nothing wraps. Frame 8 keeps the
    undisplaced `p3`, so the displacement reads as an entry gesture.
  - **Frame 11 (D minor, after `F07`):** re-enters **+4 rows** (a full beat late) as a new
    pattern; the first beat of the bridge belongs to the triangle alone. Frames 12–13 keep
    `p5` (change D then gives them their own material anyway).
  - **Frame 16 (A minor, `A'`):** re-enters **−2 rows** (anticipated) as a new pattern, with
    the two anticipation rows written into rows **62–63 of a new `pulse1` pattern for frame
    15** — not into `p6` in place, which frame 14 also plays.
- **C. Hemiola into the `F07` tempo drop.** In the **last 3 bars of frame 10** (rows 16–63)
  accent every 6 rows: rows **16, 22, 28, 34, 40, 46, 52, 58** — eight groups closing exactly
  on the barline. Put the accents on pulse 2 and the kit (snare plus tom), hold a triangle
  pedal underneath, and let 4/4 dissolve right before the tempo changes. The beat returns at
  frame 11 row 0.
- **D. Chromatic inner voice in the bridge (frames 11–13).** Give pulse 2 a descending
  chromatic line under the D-minor harmony — **d → c♯ → c♮ → b♮ → b♭**, one step per bar,
  each note resolving down by step within 2 rows, over a held triangle d pedal. This is the
  bridge's second non-diatonic device (the E7 pivot is the first). It also fixes finding 2:
  frames 11–13 must end up with **at least two distinct patterns per lane**. Keep the
  chromatic tones to one per bar in a single voice so the accidental budget holds.
- **E. Break up the B accompaniment (frames 7–10).** One variation pattern per lane, used at
  frames 9–10: the **triangle takes a 6-row cell for two frames** (entry row 0 at frame 9,
  entry row **2** at frame 10 — rows 2, 8, 14 … 62) and pulse 2 adds a **written suspension**
  at the frame-10 cadence — hold across
  the chord change on **row 48**, resolve down by step on **row 52**.
- **F. One metric surprise.** `D00` on **row 59 of frame 20** (the last `A'` frame) so the
  coda arrives a beat early. Put it on **`pulse1 p12`**, which frame 20 alone references —
  every other lane at frame 20 shares its pattern with frames 16/17/19. `"D"` is already in
  this song's declared effects.
- **G. Re-declare.** Add `frame:row` citations for the polymetric cell, the hemiola, the three
  displaced re-entries and the suspension to `extra.qa.notes`; re-render; re-pin
  `renderChecksum` in the same commit.

**Target after revision:** axis 11 = 5 is reachable here (polymetric cell + hemiola + dropped
beat); axis 4 ≥ 4 via the bridge's chromatic inner voice and the frame-10 suspension.

### 9.8 constraints that do not move

- **Originality is absolute** (§0.1): idiom, technique, form and energy only — never a
  melody, a progression or a phrase from an existing work, and no brief may name one.
- **The 5-rule loop convention** (§2.9) is unchanged: explicit `inst`/`vol` at the loop row,
  no effect left running across the seam, no note stranded, a musical turnaround, and the
  declared `loopFrame` matching the final `Bxx`. Displacement and polymetry make rule 3
  easier to break — a phase-carried cell must land its last attack **before** the seam.
- **Mix-discipline floors** (§2.8) are unchanged: ≤ 45 % of note events at vol 15, ≥ 5
  distinct column values, ≥ 1 bar with two or more voices resting, rests are mix, clipping is
  re-voiced and never re-gained. Ghost notes at vol 4–6 help this floor rather than
  threatening it.
- **Every device must survive the deterministic gates** (§7.1): key consistency ≥ 88 %
  (which is what bounds §9.3's chromaticism), claimed effects declared, no dead frames,
  duration and RMS in range, checksum re-pinned in the same commit as any edit.
- **Complexity is line independence, never clutter.** Density ceiling: **≤ 28 note attacks
  per bar summed across all five lanes**, and **never more than two lanes running 16ths at
  once**. If a piece needs to get busier to sound better, the fix is almost always a
  different rhythm in an existing voice, not another voice.

---

## 10. the tropical annex — two tracks in a documented island idiom

### 10.0 the line, restated before anything else

These two tracks are **directly inspired by the documented stylistic language of Koji Kondo
and Hirokazu "Hip" Tanaka**. That means, and is limited to: the *devices* those composers are
documented as using — Kondo's Caribbean rhythmic reference and modal-mixture/secondary-dominant
harmony, Tanaka's dub-reggae bass-and-drums arrangement, echo, and sparseness.

**We compose ORIGINAL music in that language. Never their melodies, never their progressions
as wholes, never a recognisable phrase.** §0.1 is unchanged and applies at full strength: no
brief here names a piece of music as a model, and no composer may reach for remembered
material. If a listener could name the source, it is a defect.

**Fan and community material is a TECHNIQUE reference only.** Fan compositions, covers and
arrangements found online are themselves copyrighted, and most of them are covers of
copyrighted works. They are consulted for *how people do a thing on this hardware* — how a
skank is voiced on a pulse channel, how a steel drum is faked on a 2A03, how a one-drop kit
is built in a tracker — and cited by URL in §10.6. **They are never a melodic or harmonic
source.** Nothing in §10 was transcribed from any recording or module.

Everything in §§0–9 still binds: the 5-rule loop convention (§2.9), the mix-discipline floors
(§2.8), the deterministic gates (§7.1), and every §9 prestige floor — including the two
written dissonances, the ≥ 2 distinct non-diatonic devices in different sections, one
structural polyrhythmic device cited at `frame:row`, and one metric surprise per piece.
Complexity is line independence, never clutter (§9.8): reggae is a *sparse* idiom and these
two tracks are where the density ceiling matters most.

### 10.1 the tropical / reggae 2A03 technique sheet

**What the research actually supports**, before the recipes (full citations in §10.6):

- Kondo is documented as having "had in mind the sounds of Caribbean music like reggae, soca
  and calypso"; the analysis of his best-known theme identifies a **clave figure described as
  "two dotted quarter notes plus a quarter"** — that is **3+3+2** — plus **swung drums under
  straight-note melodies**, **modal mixture** (a ♭VI–♭VII–I cadence borrowed from the parallel
  minor), **secondary dominants**, and a bass that **moves from being the third voice of the
  harmony to an independent counterpoint line**. [S1]
- Tanaka is documented, in his own words, as dub-obsessed: *"In the essence, it's strictly
  driven by drums and bass. That's what I love about it the most."* And, crucially for us, he
  describes the arrangement move as **a hardware strategy**: *"some parts are drum and bass
  only. So that turned out to be an idea for working around the limitations in the game
  hardware… I'd play the melody in some parts, then cut it off and insert a part with just
  drums and bass, and vice versa."* He also cites **echo and delay** as what first caught him,
  and **high-speed arpeggios to make three channels sound fuller**. [S2]
- The **one drop** is documented precisely: **beat 1 is dropped**, kick and a cross-stick
  snare land **together on beat 3**, hats keep steady 8ths or 16ths, notated at ~80 BPM;
  **rockers** = the same with a steady kick on every quarter, **steppers** = a steady kick on
  every eighth. [S3]
- The organ **bubble** is documented as a low, *felt-more-than-heard* left-hand pattern of
  **upbeats**, with the right hand playing the **chop/skank on beats 2 and 4**; the bubble is
  what decides whether the tune reads straight-8th or swung. [S4] The commonly-taught
  formulation is **"every eighth note except the downbeats, one and three."** [S5, snippet]
- Steel pan acoustics: the tuned overtones a pan is hammered to are the **octave and the
  fifth** above the fundamental; the balance of partials is the timbre, and notes decay
  quickly. [S6, snippet]
- **Community pickings are thin.** There is no findable 2A03/FamiTracker steel-pan instrument
  recipe, and no findable reggae-specific FamiTracker tutorial; searches returned general
  chiptune drum-synthesis advice and general reggae drum-programming articles, plus the
  existence of a chip-adjacent digital-dub scene (Jahtari) as a proof that the combination is
  a real practice rather than a novelty. [S7, S8, snippet] **The steel-drum recipes below are
  therefore derived** from the pan-acoustics source plus this album's existing macro
  vocabulary, and they are flagged **verify-in-preview**: they are the first thing to audition
  and the first thing to change if the user's ear disagrees.

#### skank comping — which rows, exactly

Three distinct comping patterns, at **4 rows/beat, 16 rows/bar** (multiply every row by 2 for
`harbour-echo`'s 8 rows/beat, 32-row bar):

| pattern | rows in a 16-row bar | what it is |
|---|---|---|
| **offbeat skank** | **2, 6, 10, 14** | the guitar chop on all the "ands" — the default, the most identifiable |
| **chop (2 and 4)** | **4, 12** | the organ/piano right-hand chop; sparser, heavier, pairs with a busy bass |
| **bubble** | **2, 4, 6, 10, 12, 14** | every 8th except the downbeats of beats 1 and 3 [S5]; six attacks, low register, *felt* |
| **tresillo bubble** | **3, 6, 11, 14** | the 3+3+2 clave with its two downbeats removed — Kondo's rhythmic reference [S1] crossed with the bubble |

Voicing and articulation:

- **Lane:** pulse 2. This is the one place the album's default (pulse 2 = independent line,
  §9.2) is satisfied *by* the comp — a skank has its own rhythm and its own register and never
  doubles the lead, so it counts as independence, **but only if the comp is not the whole of
  pulse 2's job**: each of these two pieces must still give pulse 2 a genuine counter-line for
  at least one full section.
- **Chord:** `0xy` on the row (decimal params — §2.4's table). At 7–8 ticks/row a 3-step arp
  cycles twice inside one skank stab, which is exactly enough to read as a chord rather than a
  ripple. Below 6 ticks/row, drop to a two-note stab (`007` fifth, or a written dyad).
- **Staccato:** by **volume macro, not by `Sxx`** — the `skank` instrument's 8-tick envelope
  self-cuts, so the pattern stays one note per row with no cut rows. Reserve `Sxx` for the
  *deliberate* choke (a skank cut to 2 ticks reads as a mute-strum accent); one or two per
  section, not as the default mechanism.
- **Register:** skank around MIDI 60–72, bubble a fifth to an octave lower (MIDI 52–62) — the
  bubble is documented as low and felt [S4], and low is also where it stops fighting the lead.

#### noise kit — one drop vs rockers vs steppers

At **16 rows/bar** (double every row for a 32-row bar):

| kit | kick | snare / rim | hats | use |
|---|---|---|---|---|
| **one drop** | **row 8 only** (beat 3) — **row 0 is empty, that is the whole idea** [S3] | rim on **row 8**, with the kick | 8ths: rows 0,2,4,6,8,10,12,14 | slow, spacious, dub |
| **rockers** | rows **0, 4, 8, 12** (every beat) [S3] | rim/snare on **8** | 8ths, open hat on row 14 of alternate bars | brighter, danceable, calypso/soca-leaning |
| **steppers** | documented as every eighth [S3]; **on the 2A03 use every beat plus the "and" of 4** (rows 0, 4, 8, 12, 14) | snare on 8 | 16ths for two bars, 8ths for two | driving; a true 8th-note kick eats the whole noise lane |

- **The rim/cross-stick** is the sound the noise channel is worst at and most needs here: use
  **noise mode 1 (short LFSR)** at note 44 with a 4-tick envelope — tonal, woody, dry. That is
  the `rim` instrument in §10.3. A mode-0 snare on beat 3 is the alternative and sounds
  wetter; both are correct, pick per piece.
- **Ghosts** (§9.4) matter more in this idiom than any other: vol 3–6 ticks scattered on
  off-16ths keep the lane alive while the kit stays sparse.
- **Hat shuffle:** if the piece is swung by fractional tempo, the hats inherit the lilt for
  free — do **not** also write an uneven hat pattern, or the two shuffles fight.

#### bass doctrine — the triangle is the co-lead here

Reggae is bass-led; Tanaka says so in as many words [S2]. On this hardware that is a
promotion, not a metaphor:

- **Rootsy and syncopated**, MIDI 28–45, phrases of 1–2 bars that *repeat* and are answered.
- **Space is the engine.** A reggae bass line is defined by its rests: aim for **40–60 % of
  the bar sounding**, and put the silence where the kick isn't. A bass that plays through is
  the single fastest way to make this idiom sound wrong.
- **The dotted-8th + 16th figure** (3 rows + 1 row at 4 rows/beat) is a documented Tanaka
  rhythmic fingerprint [S9, snippet] and the natural bass cell here; it is also a 3-row unit,
  so it hands you §9.1's 3-against-4 for free.
- **Octave doubling** — jump the root up an octave for one note at the end of a two-bar phrase
  — is the idiom's cadence, not a texture. Once per phrase at most.
- **Triangle attack latency** (§1, ≤ 4.17 ms to the next quarter-frame clock) is *useful*
  here: the bass front is soft, which is what a reggae bass sounds like. Let the rim define
  the transient.

#### steel drums — the recipe family (**verify in preview**)

Derived, not found (see above). The physical target: a struck-metal attack with a bright
inharmonic front that settles into a clean fundamental, with the pan's tuned **octave and
fifth** partials [S6] and a fast decay.

Three ingredients, all in the album's existing vocabulary:

1. **Pitch drop-and-settle** — a `pitch` macro that starts sharp and lands in tune. Pitch
   macros accumulate (§1), so the values must sum to 0: `[-6, 3, 2, 1, 0]` gives a running
   offset of −6, −3, −1, 0, 0 — a 5-tick metallic ping that settles exactly in tune.
   At c5 (timer ≈ 253) six raw units is ≈ 40 cents.
2. **The partial ping** — an `arpeggio` macro spelling the pan's tuned overtones on the attack
   and then getting out of the way: `[0, 12, 0, 12, 0, 7, 0, 0]` with `loop: 7` (the last
   index, value 0, so it holds the fundamental forever after 8 ticks).
3. **Soft attack bump + fast decay** — a volume macro that starts one step below the peak,
   bumps, then decays: `[10,15,13,11,10,9,8,7,6,5,4,3,2,1,0]`.

Duty stays thin (`[0,0,1,1,1]`, loop 4): 12.5 % opening to 25 % is struck metal; 50 % is a
clarinet and kills the illusion. The **pan roll** — how a real pan sustains, by rapid
restriking — is a looping volume ripple, `[15,12,9,14,15,11,8,13]` with `loop: 0`, giving a
~7.5 Hz pulse at 8 ticks. Use `7xy` tremolo on top only if the roll needs to be slower than
the macro allows.

#### dub moments — one per piece, maximum

Tanaka's documented move: **cut the melody and leave drums and bass**, then bring it back
[S2]. Rules:

- **One dub section per piece**, 1–3 frames (the bright track needs one, the dub track earns
  three), texture reduced to triangle + noise (+ DPCM if
  the piece has it). This is also the §2.8 "two or more voices resting" requirement, paid in
  full.
- **Echo throws:** on the last note of a phrase, hand the note to pulse 2 via the existing
  `echo-thin` / `echo-round` instruments at 3 rows' delay and 55–60 % volume (§2.2), then a
  second, quieter repeat 3 rows after that if the space allows. **A throw is an event** — two
  or three per dub section, placed at phrase ends, never a running echo.
- **Do not** try to fake a filter sweep with duty automation during a dub section; the
  restraint *is* the effect.

#### tempo guidance and the row arithmetic

The one drop reads slow — **72–92 BPM** is the pocket [S3]. Two ways to get there:

- **Half-time rows (direct):** `tempo 150`, `speed 11`, `rowHighlight 4` → **81.8 BPM**,
  11 ticks/row, 16 rows/bar. Simple, but 11 ticks/row makes every macro feel sluggish against
  the grid.
- **Double-time rows (preferred, and what `harbour-echo` uses):** `tempo 150`, `speed 6`,
  **`rowHighlight 8`**, `rowHighlight2 32` → the BPM readout is `24·150/(6·8)` = **75 BPM**,
  which *is* the felt tempo, with **8 rows per beat and 32 rows per bar**. You get 32nd-note
  resolution for hats, ghosts and echo throws at a genuinely slow tempo, and 6 ticks/row keeps
  every macro in the album's normal timing. `rowsPerPattern: 64` = two bars per frame.
- **Bright / calypso-soca side:** 115–130 BPM with a rockers kit. A **fractional swing** is
  idiomatic here — the bubble is documented as what decides straight vs shuffle [S4] — so
  `tempo 160, speed 8` gives ticks/row 7.5, rows alternating **8, 7, 8, 7…**, and
  `24·160/(8·4)` = **120 BPM**. A gentle 53/47 lilt: present, never a triplet gimmick.

### 10.2 the two pieces

Both are ≈ 2:20, both loop, both carry every §9 floor. `extra.qa` per §5 plus §9's `frame:row`
citations for axes 7 and 11.

#### 10.2.1 `13-green-flash.json` — bright island, Kondo register

- **energy** sunlit, buoyant, generous; the feeling of a good day that keeps getting better.
- **meta** `tempo 160 · speed 8 · rowHighlight 4 · rowHighlight2 16 · rowsPerPattern 64`
  → **120 BPM**, ticksPerRow 7.5, rows alternating **8, 7**, **8.00 s/frame**,
  16 rows/bar, 4 bars/frame. `evenTempo: false`.
- **key** **G major with a lydian ♯4 (c♯) inflection** — the bright pole of the album.
  Two non-diatonic devices, in different sections: **(1) chained secondaries A7 → D7 → G**
  (V/V → V → I) at the top of B; **(2) chromatic mediant B♭ major** against G, at the A″ turn.
  Both are devices Kondo's analysed practice supports [S1] and neither is a progression taken
  from anything.
- **form** song form, **18 frames ≈ 144 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | `steel-lead` figure alone, then triangle + rockers kit underneath |
  | 2–5 | A | melody on `steel-lead`; **offbeat skank** (rows 2, 6, 10, 14) on pulse 2; bass rootsy with rests |
  | 6–7 | A′ | melody varied; comp switches to the **bubble** (rows 2, 4, 6, 10, 12, 14) |
  | 8–11 | B | chained secondaries; comp becomes the **3-row polymetric cell** (below) |
  | 12 | dub moment | drums + bass only, two echo throws; ends with the metric surprise |
  | 13–17 | A″ | melody plus a genuine pulse-2 counter-line; B♭ chromatic mediant at the turn; `steel-roll` on the final phrase |
- **owns** (1) **the steel-drum family** as the lead voice — this is the album's steel-pan
  piece; (2) **skank → bubble → polymetric cell** as a three-stage comp development, so the
  comping is the form; (3) **rockers kit + swung rows**, the lilt coming from the tempo
  fraction rather than from written unevenness.
- **§9 floors.** *Structural polyrhythm:* a **3-row dotted-8th comp cell on pulse 2 across
  frames 8–10**, phase-carried with entry rows **0, 2, 1** (§9.1 recipe A) — three new
  patterns, resolving onto the downbeat at frame 11. Cite `frame 8:0 → frame 10:61`.
  *Metric surprise:* `D00` on **row 59 of frame 12** — one dropped beat, so A″ arrives early.
  *Two written dissonances:* a 4–3 suspension held across the chord change at `frame 11:48`
  resolving down by step at `frame 11:52`, and an appoggiatura on the melody's peak at
  `frame 15:16` resolving by step within 2 rows.
- **kit** rockers: `kick`(36) on rows 0, 4, 8, 12 · `rim`(44, mode 1) on row 8 ·
  `hat-closed`(45) 8ths with `hat-open`(46) on row 14 of alternate bars · ghosts vol 4–6 ·
  `metal`(44) tick as a section accent. Per-section variation per §9.4: A = 8th hats;
  A′ = 16th hats for the first two bars; B = hats on offbeats only; A″ = open hat on every
  bar's row 14.
- **mood direction** Warm, unhurried, *generous* — write like the sun is out and nothing is
  chasing you. The steel-drum attack should sparkle without being shrill: let the octave-plus-
  fifth ping do the work and keep the sustained part of every note plain. The skank is the
  piece's heartbeat, so give it room — a lead phrase that ends early is a lead phrase that
  lets you hear the groove. When the comp turns polymetric in B, the argument with the bar
  should feel playful rather than clever.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` ·
  `effects ["0","S","A","4","G","D","B"]` · `bpmRange [119,121]` · `durationSec [138,152]` ·
  `key "g-major"` · `loopFrame 2` ·
  `notes: "fractional tempo — rows alternate 8/7 by design; 047 = param 71"`.

#### 10.2.2 `14-harbour-echo.json` — dub, Tanaka register

- **energy** night water, patient, weightless-heavy; space with something moving in it.
- **meta** `tempo 150 · speed 6 · **rowHighlight 8** · rowHighlight2 32 · rowsPerPattern 64`
  → **75 BPM felt**, 6 ticks/row, **8 rows/beat, 32 rows/bar, 2 bars/frame**,
  **6.40 s/frame**. Even ticks (T = 2.5·E), so the groove is dead straight — dub does not
  swing, it hangs.
- **key** **E dorian** (e f♯ g a b c♯ d) — darker-modal, with dorian's bright sixth keeping it
  off the album's minor-key floor. Two non-diatonic devices, in different sections:
  **(1) a chromatic bass descent e → d♯ → d → c♯** under a held tonic in B; **(2) chromatic
  mediant C major (♭VI)** in section C. Neither duplicates `rust-and-neon`'s phrygian ♭II.
- **form** arch, **22 frames ≈ 141 s**, loop @ frame 2.

  | frames | section | content |
  |---|---|---|
  | 0–1 | intro | bass + one drop only — the piece states its subject first, as Tanaka describes [S2] |
  | 2–5 | A | melody enters on `lead-thin`, echo throws at phrase ends; **chop comp** (rows 8, 24) |
  | 6–9 | B | **bubble** (rows 4, 8, 12, 20, 24, 28) over the chromatic bass descent |
  | 10–12 | dub | **the dub moment**: melody cut, drums + bass only, three echo throws, hats out |
  | 13–16 | A′ | melody returns an octave down; `steel-comp` takes the offbeats (rows 4, 12, 20, 28) |
  | 17–19 | C | chromatic mediant C major; **triangle phase cell** (below); **pulse 2 drops the comp entirely and plays a genuine counter-line here** — this is the piece's §9.2 independence section |
  | 20–21 | turnaround | back to bass + drums, a two-bar turn into the loop |
- **owns** (1) **the dub arrangement doctrine** — the melody is *absent* for three frames and
  the piece is better for it; (2) **bass as co-lead**, using the dotted-8th + 16th cell
  (6 rows + 2 rows at this grid) as its rhythmic signature [S9]; (3) **echo throws** as
  punctuation, using the existing `echo-thin`/`echo-round` instruments rather than any new
  machinery.
- **§9 floors.** *Structural polyrhythm:* a **6-row triangle cell across frames 17–19**,
  phase-carried with entry rows **0, 2, 4** (§9.1, 64-row frames) — at 8 rows/beat a 6-row
  cell is a dotted-8th against the beat, so the bass argues with the bar for three frames and
  resolves at frame 20. Cite `frame 17:0 → frame 19:58`. *Metric surprise:* `D00` on **row 55
  of frame 12** — one dropped beat (8 rows at this grid) at the end of the dub section, so A′
  lands early. *Two written dissonances:* a suspension held across the chord change at
  `frame 9:32` resolving down by step at `frame 9:40`, and an appoggiatura at `frame 16:16`.
- **kit** strict one drop: **row 0 empty**, `kick`(36) + `rim`(44, mode 1) together on
  **row 16** of each 32-row bar, `hat-closed`(45) on 8ths (every 4 rows), `hat-open`(46) on
  row 28, ghosts vol 3–5 at rows 6, 22, 30. Section variation: B adds 16th hats for one bar
  per four; the **dub frames drop hats entirely** — kick + rim + two ghosts only, which is why
  this piece declares `percussionGap 32`; C returns the hats an octave of noise-index higher.
- **mood direction** Restraint is the composition. Write the bass line first and let it be the
  thing the listener follows; the melody's job is to appear, say one thing, and leave an echo
  behind. The dub section should feel like the room got bigger, not like the track stopped —
  which means the bass phrase there must be the most interesting one in the piece. Keep the
  timbres unusual and slightly cold: thin duties, low register, nothing bright until section C.
- **declare** `channels ["pulse1","pulse2","triangle","noise"]` ·
  `effects ["0","S","A","P","4","D","B"]` · `bpmRange [74,76]` · `durationSec [134,148]` ·
  `key "e-dorian"` · `loopFrame 2` · `percussionGap 32` ·
  `notes: "8 rows per beat, 32 rows per bar — one drop kick+rim on row 16 of each bar"`.

### 10.3 instrument mechanics — a "tropic" addition to the shared bank

**Decision: these timbres extend the shared bank (§3), they do not live as per-song `x-`
instruments.** The reason is cohesion, which is the whole point of §3: the two tracks must
sound like siblings, and a steel drum defined twice is a steel drum that drifts. It also costs
nothing — §3.1 already identifies bank entries **by name**, and each song carries only the
entries it uses, so songs 01–12 are entirely unaffected.

**The pin test tolerates additions.** §7.1's bank-drift check resolves every instrument whose
`name` is canonical and compares it to `tests/fixtures/songs/shared-bank.json`. Appending new
named entries **cannot** fail it; only changing an existing name's values can. So the composer
**appends** to the bank fixture, bumps `extra.qa.bank.rev` to **2** in the two new songs, and
the pin stays green with no edit to any existing song.

**§10 amendment to §3.1:** the per-song cap on piece-specific `x-<songid>-*` instruments is
raised from 3 to **4**, for `13-green-flash` and `14-harbour-echo` only, so each piece can
afford one local colour on top of the shared tropic family. Every other piece stays at 3.

**New sequences** (appended; `loop`/`release` are indices, `−1` = none):

| kind | name | values | loop | rel |
|---|---|---|---|---|
| volume | `vol-steel` | `[10,15,13,11,10,9,8,7,6,5,4,3,2,1,0]` | −1 | −1 |
| volume | `vol-steel-short` | `[12,15,12,9,6,3,0]` | −1 | −1 |
| volume | `vol-steel-roll` | `[15,12,9,14,15,11,8,13]` | **0** | −1 |
| volume | `vol-skank` | `[15,14,12,9,6,3,1,0]` | −1 | −1 |
| volume | `vol-bubble` | `[11,9,6,3,0]` | −1 | −1 |
| volume | `vol-rim` | `[14,8,3,0]` | −1 | −1 |
| arpeggio | `arp-steel-ping` | `[0,12,0,12,0,7,0,0]` | **7** | −1 |
| pitch | `pit-steel-attack` | `[-6,3,2,1,0]` | −1 | −1 |
| duty | `dut-steel` | `[0,0,1,1,1]` | **4** | −1 |

Three things about those values, each load-bearing:

- `pit-steel-attack` **accumulates to exactly 0** (−6, −3, −1, 0, 0) — it starts ≈ 40 cents
  sharp at c5 and settles dead in tune by tick 4. Change any value and you must re-check the
  sum, or every steel note drifts (§1).
- `arp-steel-ping` loops on its **last index**, whose value is 0, so the octave-and-fifth ping
  [S6] lasts 8 ticks and then the fundamental holds forever. It is an attack transient
  spelled as an arpeggio, not a chord.
- `vol-steel-roll` **loops forever** (`loop: 0`). A note on `steel-roll` sustains until it is
  cut or replaced — write the `---`. And none of these volume macros has a release point, so
  `===` on any of them degrades to a cut (§3.4), which is the correct behaviour for struck
  metal and for a skank.

**New instruments** (appended; `—` = no macro of that kind):

| name | volume | arpeggio | pitch | duty | notes |
|---|---|---|---|---|---|
| `steel-lead` | `vol-steel` | `arp-steel-ping` | `pit-steel-attack` | `dut-steel` | the lead pan; MIDI 64–84 |
| `steel-comp` | `vol-steel-short` | `arp-steel-ping` | `pit-steel-attack` | `dut-12` | short pan stab for offbeat comping |
| `steel-roll` | `vol-steel-roll` | `arp-oct` | `pit-steel-attack` | `dut-steel` | the pan roll — sustains until cut |
| `skank` | `vol-skank` | — | — | `dut-12` | 8-tick self-cutting chop; chord comes from `0xy` on the row |
| `bubble` | `vol-bubble` | — | — | `dut-50` | low, round, *felt more than heard* [S4]; MIDI 52–62 |
| `rim` | `vol-rim` | — | — | `dut-noise-short` | cross-stick: noise **mode 1**, note **44**, 4 ticks |

`skank` and `bubble` deliberately carry no arpeggio macro: the comp's chord changes every
row or two, so it belongs in the `0xy` effect column where the composer can see it, not baked
into an instrument. **Verify the whole family in preview before writing 140 seconds against
it** — §10.1 flags the steel recipes as derived rather than sourced.

### 10.4 registration mechanics

- **Files:** `src/assets/songs/13-green-flash.json` and `src/assets/songs/14-harbour-echo.json`.
- **Registry:** two entries appended to `src/assets/songs/index.ts`, ids `green-flash` and
  `harbour-echo`.
- **The one sanctioned test edit:** `tests/unit/presetFormat.test.ts`'s `EXPECTED_PRESETS`
  array must be **widened from twelve ids to fourteen** (adding `green-flash` and
  `harbour-echo`). That array is a names-only allowlist — the test asserts that every preset
  file present is in it, that there are no duplicates, and that no more files exist than the
  list names — so it must be widened **before or in the same commit as** the songs landing, or
  both new tracks fail on arrival. **This is the only test file this work may touch**, and it
  is named here so the edit is sanctioned rather than a surprise.
- **Numbering:** the demo tracks currently occupy `09`–`12`, so the album lands as 01–08 plus
  13–14 and is not contiguous. That is fine — the registry sorts by filename prefix, so play
  order is `01…08, 09…12 (demos), 13, 14`. **A ship-time renumber to make all album tracks
  contiguous is the lead's call, not the composer's**: it renames every file at once and
  changes play order, and doing it mid-flight would collide with concurrent work. Do not
  renumber as part of this task.
- **Gates:** `tests/unit/presets.test.ts` iterates the registry, so both tracks are picked up
  by Gates A–D with no edit. The `effects` lists in §10.2 are the *expected* sets: Gate B
  requires every declared letter to occur at least once, so a composer who ends up not using
  one **removes it from `extra.qa.effects`** rather than forcing it into the music. Both need
  `renderChecksum` pinned in the commit that lands them
  (§7.1), and `pnpm preview:songs` renders `previews/green-flash.wav` and
  `previews/harbour-echo.wav` for the user's ears (§7.2).
- **Concurrency.** A polish pass is editing songs 01–12 at the same time. The §10 composer
  **touches none of those files.** The only two shared touch-points are
  `src/assets/songs/index.ts` and `tests/fixtures/songs/shared-bank.json`, and both edits here
  are **append-only** — the lead should still sequence them so two agents do not write the same
  file in the same minute.

### 10.5 ownership

| agent | writes |
|---|---|
| **batch D** (this work) | `src/assets/songs/13-green-flash.json`, `src/assets/songs/14-harbour-echo.json`; **appends** to `src/assets/songs/index.ts` and `tests/fixtures/songs/shared-bank.json`; widens `EXPECTED_PRESETS` in `tests/unit/presetFormat.test.ts` |

Both tracks then go through the §7.3 loop unchanged: gates → critic (§6 as amended by §9.5,
eleven axes out of 55) → preview render → user audition → one revision round → ship.

### 10.6 sources

Every URL below was consulted for **technique, documented influence, or acoustics**. None was
used as a melodic or harmonic source, and no recording, module or transcription was analysed
bar-by-bar. Items marked **[snippet]** were read via search-result summaries rather than a
successful page fetch, following the same honesty convention as `phase2-design.md` §3.

| id | source | what it contributed |
|---|---|---|
| **S1** | [Video Game Music Shrine — *Inside the Score: The Super Mario Bros Theme*](https://videogamemusicshrine.com/inside-the-score-the-super-mario-bros-theme/) | Kondo's documented Caribbean intent (reggae, soca, calypso); the clave described as "two dotted quarter notes plus a quarter" = **3+3+2**; swung drums under straight melodies; modal mixture (a ♭VI–♭VII–I cadence borrowed from the parallel minor); secondary dominants; the bass moving from third-voice-of-the-harmony to independent counterpoint |
| **S2** | [Red Bull Music Academy — Hip Tanaka lecture](https://www.redbullmusicacademy.com/lectures/hip-tanaka) | Tanaka in his own words: dub discovery via echo/delay; *"In the essence, it's strictly driven by drums and bass"*; **drum-and-bass-only sections as a deliberate hardware-limitation strategy**; cutting the melody in and out; high-speed arpeggios to make three channels sound fuller |
| **S3** | [Wikipedia — *One drop rhythm*](https://en.wikipedia.org/wiki/One_drop_rhythm) | The exact kit definition: beat 1 dropped, kick + cross-stick together on beat 3, steady 8th/16th hats, notated ~80 BPM; **rockers** = steady kick on every quarter; **steppers** = steady kick on every eighth |
| **S4** | [Berklee Today — *The Woodshed: Bubblin'*](https://www.berklee.edu/berklee-today/spring-2015/The-Woodshed-Bubblin) | The organ **bubble**: a low left-hand upbeat pattern, "*felt* more than heard", with the right hand's chop/skank on beats 2 and 4; the bubble is what decides straight-8th vs shuffle feel; its origin in ska "cut in half" |
| **S5** | [Audiolover — *How To Do The Bubble Organ Effect In Reggae*](https://audiolover.com/genres/reggae/how-to-do-the-bubble-organ-effect-in-reggae/) · [how-to-play-reggae.com — *the reggae bubble sound*](http://www.how-to-play-reggae.com/Learn-the-secret-of-the-reggae-bubble-sound.php) **[snippet]** | The commonly-taught formulation used for the row table: **"every eighth note except the downbeats, one and three"**, right-hand chords on 2 and 4 |
| **S6** | [Stockholm Steel Band — *Acoustic function of the steel pan* / *Tone generation in steel pans*](https://stockholmsteelband.se/pan/tuning/theory19_acoustics.php) **[snippet]** | Steel-pan tuning aligns the **octave and the fifth** as the supporting overtones; partial balance is the timbre; notes decay quickly — the basis for `arp-steel-ping` and the fast `vol-steel` decay |
| **S7** | [MusicRadar — *How to program a typical one drop reggae beat and add fills*](https://www.musicradar.com/how-to/how-to-program-a-typical-one-drop-reggae-beat-and-add-fills) **[snippet]** | Corroborates the one-drop programming layout and that the guitar/keyboard skank sits on all the "ands" — the `offbeat skank` row set |
| **S8** | [Woolyss chipmusic directory](https://www.woolyss.com/chipmusic.php) · Jahtari digital-dub netlabel (Pupajim, *I Am A Robot*) **[snippet]** | The only community pointer found for chip-adjacent reggae/dub as a real practice. **No 2A03/FamiTracker steel-pan recipe and no reggae-specific FamiTracker tutorial exists that we could find** — hence §10.1's derived-and-flagged steel recipes |
| **S9** | Search-surfaced summaries of Tanaka coverage (Japan Times, *The music you didn't realize you grew up with*, 2017 — **page returned HTTP 402, paywalled, not read**) **[snippet]** | The attributed rhythmic fingerprint of **dotted eighth followed by sixteenth** figures, used as the bass cell in §10.1. Flagged because the primary page could not be fetched; treat as unconfirmed and drop it if it does not sound right |
| — | [btothethree ch.6](https://btothethree.tumblr.com/post/109306979202/how-to-use-famitracker-chapter-6-wrangling-the) · [Ozzed](https://ozzed.net/how-to-make-8-bit-music.shtml) · [DDRKirby(ISQ)](https://ddrkirby.com/articles/nes-chiptunes-unlock-everything/nes-chiptunes-unlock-everything.html) | Already cited in §8; the noise-kit shapes, duty language and echo technique §10 builds on come from there |
