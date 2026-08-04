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
