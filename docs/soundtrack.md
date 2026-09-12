# Pulsar — twelve pieces, two chips

September 2026. The eight-genre set is replaced by an album of twelve original pieces for
the eight-voice machine — the 2A03's five lanes and the VRC6 expansion's two pulses and
sawtooth. They arrive by two different routes, and that is the interesting fact about
this repertoire.

**Three are ports.** Skyline Run, Cathedral of Gears and Tide Tables are the demo
compositions of OCTET, a sibling NES/Famicom sequencer project for the 2A03 and the VRC6
expansion. Each piece was authored there as a generator script that writes every melody,
bass line, chord, drum pattern and form as code; they are that project's own original
music, not transcriptions or imitations of any published work. Pulsar has the same eight
lanes, so the port carries the notes over exactly and re-voices nothing: every lane lands
on its own lane. The converter and the per-song modules live in `tools/songs/octet/` (see
its README); song JSON remains the shipped source.

**Nine were composed here.** Tailwind, Counterweight and Sunward Banner came first;
Winding Stair, Blue Hour and Long Light followed them, and Crooked Mile, Night Shift and
Headlong followed those. Each was written for pulsar as a committed generator script
under `tools/songs/compose/` that imports
`lib.mjs` and writes its own `src/assets/songs/NN-<id>.json`. `docs/preset-suite.md` §12.3
sanctions that arrangement, amending §7.3 step 3's "write the JSON directly": the JSON is
still the shipped artifact and is never hand-edited, gate A's byte-identical round trip
still holds on the committed bytes, and `extra.qa.renderChecksum` pins the render, so the
generator, the file and the music move in one commit or a gate fails.

Same machine, same gates, same style bible for both routes. What differs is what the
script is *for*: a port module states the corrections the target driver needs and nothing
else, because a module that moved a voice would be changing the music; a composer's
generator **is** the composition, written to be read — named sections in the order they
are heard, named motifs, and a comment on each lane in each section.

## Catalog and audition map

One-pass times are measured from the order walk (the loop skips an intro where there
is one). The WAVs from `pnpm preview:songs` hold two passes including the loop seam.
The first three rows are the ports, the last three the pieces composed here.

| Track | Character | BPM | One pass | Form and defining sound |
| --- | --- | ---: | ---: | --- |
| Skyline Run | Action-stage theme | 150 | 2:18 | Intro, A, chorus, A2, bridge, A3 (42 frames on a 32nd-note grid); hook on pulse 1 with a two-row echo canon on pulse 2, diatonic thirds and `0xy` chord stabs, walking triangle bass with a pitch-dive thump, noise kit over DPCM kick and snare, a half-time breakdown in the bridge |
| Cathedral of Gears | Gothic theme, eight voices | 150 | 2:24 | Intro, A, A repeat, B, A′ (a minor third up), coda (22 frames); a driving-sixteenth bass gallop on the VRC6 sawtooth with the triangle doubling it an octave up, the melody on VRC6 pulse 1 under a duty macro that opens at 50 % and narrows to 3/16, reedy 25 % inner harmony on VRC6 pulse 2, counter-melody and `0xy` chord stabs on 2A03 pulse 1, a three-row echo of the leading line on 2A03 pulse 2, the sawtooth taking the solo lead through the B section, an `Fxx` ritardando into the loop |
| Tide Tables | Slow ambient, 5/4, eight voices | 56 | 2:44 | Fifteen named patterns of two 5/4 bars (80 rows, speed 8) in D Dorian; triangle drones joined by `3xx` glides, struck bell chords on fixed-mode arpeggio instruments answered two beats later by quieter echoes, two slow VRC6 voices trading beats (duty 1 above, duty 0 below), a soft sawtooth pad at volume 3 gliding between chord tones, wind and surf on the noise lane, a tempo dip to 110 in the slack-water pattern |
| Tailwind | Bright stage theme, eight voices | 180 | 2:05 | Intro, A, A′, pre-chorus, chorus, break, A″, chorus′, tag (24 frames of four bars on a 16th-note grid, the fastest on the album); the hook on 2A03 pulse 1 with a three-row echo canon at pitch on a duty-0 pulse 2, five volume steps quieter and copying the lead's cuts, a sawtooth gallop answered by the triangle on the off-16ths an octave up, VRC6 thirds in A and sixths in the chorus, the DPCM pair under the noise kit's high snare; A′ moves the hook onto the sawtooth at pitch with the counter-hook an octave below it, and the last chorus is the tune a whole step up in B |
| Counterweight | Boss theme, eight voices | 150 | 2:19 | Alarm, riff A, B, riff A′, bridge, phase 2, riff A″, turn (44 frames of two bars on a 32nd-note grid, the longest order here) in D phrygian; the riff on the VRC6 sawtooth doubled by the triangle an octave up, `0xy` power fifths a 32nd behind it on the 2A03 pulses, the lead answering only in the riff's tails with pulse 2 a fourth under every phrase, a half-time bridge on a six-row tom cell over a tresillo kick, and a second phase that inverts the riff by scale degree a minor third up into F minor |
| Sunward Banner | Anthem, eight voices | 150 | 2:28 | Fanfare, theme, theme′, lift, chorus, bridge, build, chorus′, coda (23 frames of four bars on a 16th-note grid); an opening three-voice VRC6 chorale with the whole 2A03 silent, then the tune on pulse 1 with an echo three rows behind, a sawtooth eighth-note bass with octave leaps under a triangle an octave up, a chorus on a 6+6+4 tresillo with pulse 2 as an independent counter-melody, an Italian sixth at its cadence, a pivot modulation into a final chorus a whole step up in E, and an `Fxx` ritardando into the loop |
| Winding Stair | Descent in triple metre, eight voices | 150 | 2:14 | Entries, A, B, stretto, landing, A′, spiral, coda, turn (28 frames of four 3/4 bars — the album's only piece in three) in G minor; a real three-voice imitative exposition, each entry answered a fifth below while the voice before it hands over to a countersubject on rows the entry never uses; four stretto entries a bar apart down the circle, the subject inverted in close canon over two voices alone, then in augmentation in the triangle; a six-link chromatic bass descent, hemiola cadences, a Neapolitan in both positions, and the lowest statement of all on the sawtooth two octaves down, glided rather than struck |
| Blue Hour | Shuffle, eight voices | 120 | 2:08 | Head, A, A′, bridge, trade, comp, hush, A″, out (16 frames of four bars on a six-rows-to-the-beat grid) in G mixolydian — the album's only swung piece, and the ratio is exact rather than a tempo trick: every one of 1,349 attacks across all eight lanes lands on row 0, 2 or 4 of the beat and none on 1, 3 or 5. A walking triangle bass with chromatic approaches into every change, VRC6 pulses comping guide tones on the "and" and the push, the two 2A03 pulses trading phrases, a kit that is mostly ghosts, a chain of descending fifths and a tritone substitution at the last cadence |
| Long Light | Open mid-tempo, eight voices | 100 | 2:34 | Horizon, A, A′, B, air, answer, build, light, descent (16 frames of four bars) in F lydian, the raised fourth heard rather than implied; a five-row ostinato phasing against the four-row beat for three full cycles, an arpeggio bed established and then taken away so the ear supplies the harmony, two sections of two lanes and nothing else, a chromatic mediant on a stationary common tone, an Italian sixth resolving outward, and the global peak held back to the last third |
| Crooked Mile | Asymmetric scherzo, 7/8 | 129 | 2:10 | Gate, walk, stile, broad, walk2, hollow, climb, crest, turn (20 frames of four 7/8 bars — the album's only asymmetric metre) in C major; the bar is 2+2+3 eighths and the tune limps with it, a dotted-eighth cell on VRC6 pulse 1 walking around the bar for three whole frames, a section that re-hears the same 56-row frame as two bars of 7/4, chained secondaries voiced as two inner lines a tritone apart, a chromatic mediant held on a stationary common tone, and a dropped beat that leaves one bar of five eighths |
| Night Shift | Groove piece, straight | 90 | 2:07 | Clock-in, A, A′, comp, graveyard, lift, A″, turn (24 frames of two bars on a 32nd-note grid) in E dorian; a sawtooth bass on a 16th-level tresillo under a kit that is mostly ghosts, VRC6 stabs on the push, and one section where a single voice lays two ticks behind the beat while the bass and both drums stay dead on; prepared suspensions tied across the barline, a common-tone diminished, and a pivot a minor third up into G dorian |
| Headlong | Compound-metre flight | 200 | 2:02 | Launch, flight, flight2, chase, dive, three, hinge, updraft, hush, sprint, stall, return, crest, tail (51 frames of four 6/8 bars — the longest order and the fastest tempo here) in B minor; two beats of three re-heard as three of two for a whole section, a five-row cell carrying its phase across five frames, a six-link chromatic bass descent at two bars a link, an Italian sixth placed mid-flight rather than at a cadence, and a lead that never attacks two consecutive rows |

About twenty-eight minutes of first-pass material. The twelve span every mode the preset
lint knows — major, minor, dorian, phrygian, lydian, mixolydian — on **all seven natural
roots**, at 56, 90, 100, 120, 129, 150, 180 and 200 BPM, and on grids of four, six or eight
rows to the beat, twelve to forty rows to the bar, and forty-eight to ninety-six rows to
the frame. For a quick contrast test, audition **Night Shift → Crooked Mile → Headlong**:
a straight groove at ninety where one voice drags two ticks behind the beat, a limp in
seven, and a compound-metre flight at two hundred that keeps re-hearing its own bar —
differing at once in grid, register, density and articulation. Heard end to end,
**Headlong → Tailwind → Night Shift → Crooked Mile → Counterweight → Long Light → Winding
Stair → Blue Hour → Skyline Run → Tide Tables → Cathedral of Gears → Sunward Banner**
alternates bright against dark, puts each of the three slowest pieces — Night Shift at 90,
Long Light at 100 and Tide Tables at 56 — between two dense ones so that its restraint is
what you hear, places the four pieces that are not in four exactly three apart (Headlong's
6/8 first, then Crooked Mile's 7/8, Winding Stair's 3/4 and Tide Tables' 5/4), opens on the
fastest piece and ends on the anthem. No order groups the ports together: the two routes
are a fact about how these pieces were written, not a category the ear sorts them into.

## The three ports — what the conversion corrects

Nothing in these pieces is re-voiced: `tools/songs/octet/audit.mjs` counts the note
attacks, cuts and releases on every lane of the source document against the shipped
song and fails on any difference a song module has not declared. What the modules and
the converter do change is where the two drivers disagree.

**Engine differences, applied by `convert.mjs` to every song, on the VRC6 lanes exactly
as on the 2A03 pulses.** `Axy`'s nibbles are swapped (OCTET counts x up, Pulsar counts x
down). `7xy` is re-expressed for Pulsar's faster, deeper tremolo table, and `700` becomes
`710` so it does not re-read effect memory. OCTET's `3xx` glides its own row only while
Pulsar's is a channel mode, so the first plain note after a glide or a `Qxy`/`Rxy` scoop
carries an explicit `100` — cancel, no slide, hard trigger. A `===` on an instrument with
no release point is a no-op in OCTET and a cut in Pulsar, so those cells lose their note
(neither eight-voice piece has one: their voices and pad all carry release points). Pitch
effects and pitch macros are stripped from the noise lane, which OCTET ignores there.
Duty macros pass through unchanged — Pulsar's VRC6 lanes take the chip's own 0–7 values,
so the wide and reedy timbres are the composed ones.

**Self-ending noise** (`tide-tables.mjs`). The wind and surf envelopes loop forever in
OCTET; a preset's noise envelope has to end on 0, because a looping one never releases
the lane. Each becomes the same breath once, ending on 0, re-struck at its own length —
15 rows for the wind, 26 for the surf, from the envelopes' own tick counts — so the
breathing continues unchanged. The surf tick was a one-shot already.

**Loop entry** (every module). Pulsar's presets state note, instrument and volume
explicitly on the loop row rather than inheriting whatever the previous pass left in the
register file. Cathedral of Gears needs it on one lane only: 2A03 pulse 2, the echo lane,
which is silent across the seam and says so with a cut. Tide Tables restates the triangle
drone that is held across the seam and cuts the five lanes that are silent there — the
bells, their echoes and the three VRC6 voices, which release in the penultimate pattern.
Skyline Run keeps its own loop-entry cells and its DPCM restart gates.

**Channel modes across the loop — checked, and deliberately NOT corrected.** Gate B2
reports six findings on Tide Tables: `4xy` vibrato latched on both VRC6 pulses at the loop
row, `3xx` and `7xy` latched on the sawtooth, and 33 notes triggering under a vibrato
stated 320 rows earlier. That looked like the port, and it is not. OCTET's `core/engine.js`
latches the same modes the same way — `applyCell` writes `vibDepth`/`tremDepth` and only a
zero depth nibble clears them, `triggerNote` resets the phases and not the modes, and
`nextOrder()` wraps the order without resetting a channel — so the source engine carries
them across its own loop too. Driven over its own document for two passes it reproduces the
finding note for note: one audible difference, the sawtooth's entrance at frame 2 row 0
sounding under tremolo depth 2 on pass 2 and dry on pass 1. `convert.mjs` carries every
`3xx`, `4xy` and `7xy` cell over one for one, so there is nothing to compensate;
`applyEngineDifferences` is untouched and the song is what OCTET plays. The finding is
therefore resolved rather than open: the six entries are pinned in `presets.test.ts`'s
`KNOWN_STICKY`, so gate B2 still fails on a seventh or on any of the six disappearing,
and `docs/preset-suite.md` §12.5 records what the latch actually costs — one of 234 note
events differs between the passes. Tide Tables is the only piece in the album with an
entry there; the other five reach the loop row with nothing latched.

Both eight-voice songs claim seven lanes and declare a silent `dpcm` as well, because
`channels` is a prefix of the canonical eight and reaching `vrc6p1` means carrying every
lane before it. That lane gets an empty pattern and a `0` in each order frame.

**The arrangement that was here before.** The 2026-09-11 release folded these two pieces
onto four 2A03 lanes — melody to pulse 1, sawtooth bass to the triangle, harmony spelled
as `0xy` triads in the counter-melody's rests, the echo lane dropped — because Pulsar had
no VRC6 yet. Commit `006f837` holds that arrangement and the fold modules that produced
it. It is history, not a fallback: the chip is in the core now and the pieces play as
composed.

## The nine composed for pulsar

Each of these is a generator script under `tools/songs/compose/`: it runs with `node`,
imports `lib.mjs`, and writes the JSON the app ships. `check()` runs before every write
and refuses the file on a hardware floor (the 2A03 pulse's MIDI 33, the triangle's and
VRC6 pulses' 21, the sawtooth's 24), a noise note outside 32–47, an unsupported effect, a
pitch macro that does not sum back to zero, a looping noise envelope, a lane that sounds
but states nothing at the loop row, or a channel mode still latched at the seam. What the
library derives — the channel prefix, the effect columns, pattern and sequence
de-duplication, the instrument table, `qa.channels`, `qa.effects`, `qa.form`,
`qa.loopFrame`, `qa.bank` — the composer never types; what only a composer knows, the
`extra.qa` block declares, and every raised bound carries its sentence of justification.
Each piece then pins the devices that make it itself in its own
`tests/unit/track-<id>.test.ts`, at `frame:row`, against the bytes that shipped.

All nine carry all eight lanes and sound every one of them, including the sample lane
that both eight-voice ports declare and leave empty. §3.1's cap of three piece-specific
instruments is retired by §12.6 — these carry 12, 23, 9, 11, 8, 11, 14, 15 and 18 of their
own against the ports' 12, 17 and 23 — and what the shared bank is still for is the kit,
which all twelve take by name and byte-identical. Sunward Banner's `extra.qa.notes`
still declares its nine as a deviation and refers the cap to the director; it was written
four minutes before §12.6 answered the question, and the note is left standing as the
record of why the cap moved.

**Tailwind** (`04-tailwind.mjs`) is the bright stage theme: A major, speed 5 for 180 BPM
on 16th rows, 24 frames of four bars, looping past a one-frame intro. Pulse 1 carries the
hook and pulse 2 answers it as an echo canon three rows behind — the same notes, five
volume steps quieter, on a duty-0 instrument so the copy is thinner as well as softer,
and copying the lead's cuts so it breathes with the phrase; the sawtooth gallops an eighth
plus two 16ths while the triangle answers on the off-16ths an octave up, and the two VRC6
pulses hold the harmony — thirds under A, sixths under the chorus, guide tones at 12:16
and 12:32 where each lane holds a common tone in turn rather than four bars of parallel
sixths. The kit is the noise lane over the DPCM pair, and A and both choruses layer the
backbeat the same way: the monophonic sample lane plays kick on 1 and 3 and its own snare
on 2 and 4, under the noise kit's high snare (41). What makes the piece itself is the
re-orchestration: A′ states the hook on the sawtooth **at pitch** (MIDI 68–81) and drops
the counter-hook an octave below it, so the section's subject is its top voice, and the
saw sits at volume 10 there because moving the line above the APU's high-pass measurably
raised the section. The form then earns two surprises — the hook displaced two rows late
at 16:2, and a six-row hemiola in the saw and VRC6 pulse 2 from 18:16 to 18:58 — before
B7 → E7 → A → F#7 pivots the last chorus a whole step up into B. There VRC6 pulse 1
doubles the lead an octave above, folding to unison above MIDI 91: at 95 the VRC6 divider
quantises 11.5 cents flat against the 2A03 pulse's +3.8, and the octave would beat at
about 17 Hz on the loudest note in the piece. The tag is two bars — the riff in B, a
unison fall onto E7, then `B01`+`D00` at 23:31 home to frame 1, two bars early.

**Counterweight** (`05-counterweight.mjs`) is the boss theme: D phrygian, speed 3 for 150
BPM on a 32nd-note grid — eight rows to the beat, 32 to a bar, 64 to a two-bar frame — and
44 frames, the longest order on the album. Its motif is a two-bar cell on the sawtooth,
doubled by the triangle an octave up on the same rows, with `0xy` power fifths on the 2A03
pulses landing a 32nd behind it (2:5 against the riff at 2:4) so the stabs read as a
mechanism rather than a chord. The lead sings only in the riff's tails, and pulse 2 answers
every one of its phrases a fourth below. B is the breath between statements: a tonic pedal
on the saw, a walking triangle, a descending-fifths chain Dm–Gm–C–F–Bb stated twice and a
Neapolitan close (16:32 Eb → 17:0 A7 → 18:0 Dm), with VRC6 pulse 1 and the sample lane both
resting through its first phrase — and its second phrase is seven bars, because `D00` at
17:31 drops the last one. The bridge goes half time: the saw alone on D1 in a tresillo with
the DPCM kick, a six-row tom cell carried unbroken across all six frames, and VRC6 pulse 2
climbing chromatically D3 → C4 onto C, the pivot that is bVII of D phrygian and V of F
minor. Phase 2 is what the piece is for — the riff inverted by scale degree, a minor third
up into F minor — and it is measurably the escalation it claims to be: the loudest section
on both passes (−19.37 and −19.24 dBFS) and by a wide margin the brightest, a zero-crossing
rate of 4380 against 3351–4053 everywhere else. The piece declares an `rmsRange` floor of
−21 rather than being raised to meet the default, because the alarm, the turn and the
half-time bridge rest on purpose; the mix is built to that arc. Every `0xy` block ends with
an explicit `000` one envelope after its last stab, so nothing arpeggiates a note that did
not ask to and pass 2 is pass 1.

**Sunward Banner** (`06-sunward-banner.mjs`) is the anthem: D major, speed 6 for 150 BPM on
16th rows, 23 frames of four bars. It opens on a three-voice VRC6 chorale — both expansion
pulses and the sawtooth, with every 2A03 pulse and the triangle silent — so the tune's
entrance at frame 2 is the first thing the 2A03 does, and frame 2 is also the loop frame,
which means the returning pass opens on the tune and not on the chorale. From there
pulse 1 has the head, pulse 2 echoes three rows behind, the sawtooth walks eighths with
octave leaps and the triangle doubles it an octave up, while the VRC6 thirds wait until
bar 8 so the tune arrives on bare pulses; theme′ hands the second phrase to the saw with a
bend-in attack and gives pulse 1 a descant a sixth above it. The head is then treated four
ways: inverted and re-rhythmed as a 6+6+4 tresillo for the chorus, displaced two rows late
at 12:0, sequenced up a step a bar through the build, and transposed whole for the last
chorus. The harmony pays for its raised allowance in four different sections — chained
secondaries with the dominant quitted to IV in the theme, borrowed bVI and bVII across the
lift's 3+3 six-bar phrase, an Italian sixth at 13:32 resolving outward by a semitone, and a
true pivot modulation on the A of 17:0, V in D and IV in E, into a final chorus a whole
step up. That chorus doubles the lead in **unison** on VRC6 pulse 1 rather than the octave
the sketch asked for, for the same divider reason Tailwind meets at the top of its own
chorus, and the piece's test measures both. Its single metric surprise is 15:48, one bar
where the kit stops dead and only the saw's six-row cell and the VRC6 stabs continue; the
coda's `Fxx` ritardando then slows speed 6 → 7 → 9 → 12 across 22:48–22:63, and the loop
row restores speed 6 at 2:0, because a tempo survives the seam the way any effect does.

**Winding Stair** (`07-winding-stair.mjs`) is the descent: G minor, speed 6 for 150 BPM on
a twelve-row 3/4 bar, 28 frames of four bars, looping past a three-frame exposition. It is
the album's only piece in three and the only one whose form is contrapuntal rather than
melody-and-accompaniment. The subject arrives alone on 2A03 pulse 1 at 0:0, is answered a
real fifth below on VRC6 pulse 1 at 0:24 — the same intervals on the same row offsets —
and a fifth below that on the sawtooth at 1:0; each voice that has finished hands over to a
countersubject instead of shadowing the entry, pulse 1 tying its b♭ through the answer's
head and taking rows 26, 34, 38, 40 and 46, VRC6 pulse 1 doing the same from 1:2 to 1:22,
and neither sharing a single attack row with the entry it accompanies. The subject then
travels: four stretto entries a bar apart down the circle at 9:0, 9:12, 9:24 and 9:36
(d5, g4, c4, g3); inverted in close canon over `landing`'s two bare voices at 13:0; in
augmentation in the triangle at 15:0 under its own inversion; and lowest of all on the
sawtooth two octaves down at 22:0, restated at 24:0 as a `3xx` glide rather than an attack,
so the final statement arrives with no transient at all. The harmonic rhythm doubles twice —
a chord every two bars in the exposition, one a bar from 3:0, two a bar from 19:0 — and the
colour is a six-link chromatic bass descent in the triangle (g2, f♯2, f2, e2, d♯2, d2 at
7:0, 7:12, 7:24, 7:36, 8:0, 8:12) and a Neapolitan taken twice, root position at 23:0 and
first inversion at 25:0. Metrically the piece leans on the hemiola native to three — two
bars regrouped as three groups of eight rows, realised differently at 6:24 and 12:24 — over
a five-row cell on VRC6 pulse 2 whose entry row walks 19:0, 20:2, 21:4, 22:1, exactly
`(−48k) mod 5`, at a strict five-row stride; the kit stops for the whole of 21:0 while the
cell runs on. Two lead timbres share pulse 1, the thinner duty taking `landing` and the
coda's two answers, and `percussionGap` is declared at 32 because `landing` has no kit at
all.

**Blue Hour** (`08-blue-hour.mjs`) is the shuffle: G mixolydian, speed 5 for 120 BPM, and
the grid *is* the composition. Six rows to the beat make a swung eighth pair rows 0 and 4 —
an exact 2:1 triplet ratio written on the grid rather than a fractional tempo, and straight
sixteenths do not exist on it. The discipline holds everywhere: of 1,349 note attacks across
all eight lanes over 1,536 rows, every one lands on row 0, 2 or 4 of its beat and **not one**
on row 1, 3 or 5, so no lane can straighten against the rest. The triangle walks — 274
quarter-note attacks, 47 % of its motion stepwise with chromatic approaches into the
changes, only four of 64 bar downbeats repeating a pitch class, and an eight-link chromatic
descent through `hush` at 11:0–11:42 — while the sawtooth stays off the bass and comps or
solos instead. The VRC6 pulses comp guide tones, third and seventh rather than a doubled
root, on the "and" at bar row 4 and pushed at bar row 22. The two 2A03 pulses trade two-bar
phrases through `trade`, and pulse 1's tail rings one beat into pulse 2's entry at 7:48 so
the hand-off is a conversation; the return hand-off at 8:48 is left clean, because once is a
gesture and twice is a habit. The harmony moves: E7–A7–D7–G7 descending fifths at 5:0, 5:24,
5:48 and 5:72 with the guide-tone tritones walking down chromatically, a borrowed minor iv
at 3:72, and a tritone substitution at 13:48 where A♭7's guide tones each fall a semitone
into G7 at 13:72 against a bass rising a♭ to g. The kit is mostly ghosts — 419 of its 467
noise events sit at volume 3 to 8 — across sixteen distinct noise patterns with a different
fill at every eight-bar seam, and the metric surprise is the bar at 10:0 where it stops dead
and the polyrhythm plays on. That polyrhythm is a four-row cell against the six-row beat,
unbroken for 48 attacks from 9:0 to 10:92, its accent pair advancing one place each bar so
the 3:2 is heard rather than merely present; a twenty-row cell carries phase across three
frames at 3:0, 4:4 and 5:8.

**Long Light** (`09-long-light.mjs`) is the open piece: F lydian, speed 9 for 100 BPM, 16
frames of four bars, and the raised fourth is heard rather than implied. Its spine is a
five-row ostinato on VRC6 pulse 2 written straight through the four-row grid, its entry row
walking 1:0, 2:1, 3:2, 4:3, 5:4, then 6:0, silent through `air`, 8:2, 9:3, 10:4, 11:0, 12:1,
13:2, 14:3, 15:4 — `(−64k) mod 5`, three complete cycles inside one pass at a strict
five-row stride, with the last attack at 15:59 so nothing is stranded at the seam. The
harmony is spelled by a fast `0xy` bed through `horizon` and A and then **taken away** at
3:0, the removal being the event: the ear supplies the chord that is no longer being
arpeggiated, and the bed returns only at 15:32 to state itself on the loop row. Space is the
mix here — `horizon` and `air` are two lanes and nothing else, every lead phrase ends in a
rest, and the global peak, d6 on pulse 1 at 13:40, is held back to the last third. Motif L
is stated at 1:0, reharmonised at 3:0, re-orchestrated onto the sawtooth an octave down at
5:0, inverted at 7:4, augmented at 11:0 and displaced a row late at 14:1, under three
different lead duties. Its two non-diatonic colours sit in different sections: a chromatic
mediant at 5:8, where the bass falls f2 to a♭2 while VRC6 pulse 1 restrikes c4 without
moving and pulse 2's suspended a4 resolves to a♭4, and an Italian sixth at 10:48 resolving
outward to c3 and c6 at 10:56. Both `rmsRange` and `percussionGap` are declared with their
justifications: two of its sections are two lanes and nothing else, and `air` has no kit
at all.

**Crooked Mile** (`10-crooked-mile.mjs`) is the album's only asymmetric metre: C major,
speed 7 for 128.6 BPM on 16th rows, 20 frames of four 7/8 bars. The bar is 14 rows grouped
2+2+3 eighths, so its three group heads fall on rows 0, 4 and 8 and `rowHighlight: 4`'s
fourth mark lands *inside* the long group — the crookedness is visible in the grid before
it is audible. The motif at 1:0 is a foot, a rising fifth and the walk down, six attacks
closing on the crooked row 12; it returns augmented at 6:0, on the sawtooth an octave down
at 8:0, sequenced up the scale at 13:0, 13:14 and 13:28, and in octaves at 16:0. A
dotted-eighth cell on VRC6 pulse 1 runs three whole frames at entry rows 0, 1, 2 —
`(−56k) mod 3`, the cycle closing after `lcm(3,56)/56` frames — and resolves onto the
downbeat at 4:0, while `broad` (6:0–7:55) re-hears the *same* 56-row frame as two bars of
7/4 with the kit on all seven quarters. Its two colours sit in different sections: chained
secondaries E7→A7→D7→G7→C at 4:36–5:8, voiced as the two lines a dominant seventh has, a
tritone apart in contrary motion, with every raised tone inner so the lead stays diatonic
throughout; and a chromatic mediant at 11:28 that holds E stationary on VRC6 pulse 2 from
11:0 and quits to F at 12:0, never to A minor, which would have made it a secondary
dominant instead. Pulse 2 is an independent line for all of `stile`, 28 attacks on its own
4-row grid under pulse 1's register. `D00` at 15:51 ends a frame four rows early, leaving
one bar of five eighths. The ghost layer is written through a helper deliberately outside
the piece's mix lift — a uniform correction is the one thing that destroys the layer it
lifts — and holds 47 cells at volume 4–6 under backbeats at 14–15.

**Night Shift** (`11-night-shift.mjs`) is the groove piece: E dorian, speed 5 for 90 BPM on
a 32nd-note grid — 8 rows to the beat, 32 to a bar, 64 to a two-bar frame — 24 frames, and
straight from end to end. The sawtooth bass carries a 16th-level tresillo (6+6+4 rows, 171
of its 188 attacks on tresillo rows) under a kit that is mostly ghosts and VRC6 sevenths
and ninths on the push. What is its own is that the delay is *sectional*: 76 `Gxx` cells as
played, 64 of them inside `comp` (frames 10–13), where VRC6 pulse 2 sits two ticks — 33 ms
— behind while the sawtooth bass, both DPCM drums, the hats and VRC6 pulse 1 stay dead on.
The album's other delayed piece spreads 186 cells across four lanes and all sixteen of its
frames; this one puts the drag in one voice for one section and then takes it away. Both
its suspensions are prepared rather than struck: e4 enters as a consonant sixth over Gmaj7
at 13:24, ties across the barline where Bm7 makes it an eleventh, and resolves down by step
at 13:52, with the same figure at 9:24. A common-tone diminished turns A°7 into A7 at
6:62→7:0 on one held tone and three semitone rises, restated transposed at 19:62→20:0; and
the piece pivots a minor third up rather than the whole step two others take — Am7 as
borrowed iv at 16:32, stated bare on two voices at 17:0, D7 confirming at 18:14, G dorian
landing at 19:0. The tune leaves pulse 1 for the sawtooth in the tenor at 17:16 while the
triangle takes the bass. At −24.08 dBFS it is the album's quietest render, and that is
density rather than mixing: it states 9.4 events a second against the fastest piece's
thirty, with the second-highest crest factor of the twelve and its sawtooth accents sitting
above every comparable piece's maximum.

**Headlong** (`12-headlong.mjs`) is the fastest piece here and the only one in compound
metre: B minor, speed 3 for 200 BPM on 16th rows, 51 frames of four 6/8 bars — the longest
order on the album, because a bar is 600 ms and a frame 2.4 s. Two beats of three, and the
piece is built on re-hearing them as three of two: `three` (18:0–22:47) is a whole section
where VRC6 pulse 2 takes rows 0, 4 and 8 and VRC6 pulse 1 rows 2, 6 and 10 against a kick
on the bar and a snare on 4 and 8 with nothing on 6, and there are cadential hemiolas at
5:24 and 48:24. A five-row cell on VRC6 pulse 2 carries its phase across five frames at
entry rows 0, 2, 4, 1, 3 — `(−48k) mod 5` — 48 attacks from 33:0 to 37:43. The bass falls
b1–a♯1–a1–g♯1–g1–f♯1 from 14:0, two bars a link, under oscillating upper voices and no kick
for eight bars. An Italian sixth at 23:36 — triangle g1, pulse 2 b4, pulse 1 e♯5 — resolves
outward at 24:0, and unlike the album's two other augmented sixths it is not a cadence: it
is a hinge at full speed, and the f♯ it resolves to is heard as the third of D when the
relative major arrives at 25:0. The wall of notes this tempo invites is designed out rather
than survived — no melodic lane ever attacks two consecutive rows, the lead has a rest of at
least 200 ms in all 204 bars, and it is silent for 13.5 % of them. Three lead colours carry
it: the tune moves to the sawtooth an octave down at 25:0, where the saw has 16 attacks a
frame to pulse 1's 4, and to a flat 50 % duty for all of `crest`. `D00` at 39:41 drops a
beat.

## Rendering and checks

`pnpm preview:songs` writes `previews/<id>.wav`: 48 kHz mono PCM16, raw tracker/APU
mixes with no normalization or limiter, at render master gain 2.0 (the app knob at
maximum; its usual 0.72 setting is about 5.7 dB lower).

| id | two passes | RMS | peak | clipped |
| --- | ---: | ---: | ---: | ---: |
| skyline-run | 268.8 s | −18.74 dBFS | 0.647 | 0 |
| cathedral-of-gears | 275.7 s | −16.62 dBFS | 1.000 | 38 |
| tide-tables | 327.8 s | −23.67 dBFS | 0.853 | 0 |
| tailwind | 245.3 s | −18.53 dBFS | 0.882 | 0 |
| counterweight | 272.0 s | −20.09 dBFS | 0.902 | 0 |
| sunward-banner | 283.1 s | −17.59 dBFS | 0.909 | 0 |

Eight voices are louder than four. Cathedral of Gears gained 2.2 dB of RMS over the
folded arrangement and its unclamped peak is now 1.16 — 1.3 dB over full scale, which
the render clamps at 38 samples out of 13.2 million, in 21 isolated spots of a few
samples each. This is the render gain meeting the expansion's headroom, not the
arrangement: the source project's own render of the same document peaks at 0.61, the
VRC6's linear DAC adds up to 0.625 on top of the 2A03's full-scale mix, and 2.0 is the
app's output knob at maximum, so at the default output (0.72, about 5.7 dB lower)
nothing clips. The piece is kept at the composed levels — no volume column is scaled
and the core's gain is untouched — and the song declares the clamp it needs
(`extra.qa.clippedSamplesMax: 48`, justified in its notes). Gate C honours a declared
allowance only when the default budget of 8 would actually fail, and caps it at 64, so
the declaration cannot creep onto a song that does not need it. The alternative, a lower
render/master gain (about 1.6 would put this peak at 0.93), would quieten every song and
live play by 2 dB and re-pin every checksum; it stays open as a product choice.

Cathedral of Gears is also the only piece in the album that clips, and the three composed
here are the control: they were written against §12.2's headroom rule, and their volume
columns show it. The sawtooth's highest attack is 12 in Tailwind, 13 in Counterweight —
the alarm stab, where the only other lanes sounding are a crash and the sample kick — and
11 in Sunward Banner, and their VRC6 pulses top out at 10, 11 and 12 (Sunward Banner's
single 12 is in the fanfare, where the 2A03 is silent). That is against 15 on both the
sawtooth and VRC6 pulse 1 in Cathedral of Gears, whose
columns are the source composition's and were carried over rather than chosen against
this render gain. All three land between 0.88 and 0.91 with nothing clamped.

The three ports have a second rendering to be checked against; the three composed here
have none, and their `renderChecksum` pins serve that purpose instead. Against the source
project's own renders of the originals (`tools/render-cli.mjs`, one pass, no fade; both
sides analysed with its `tools/analyze-wav.mjs`):

| piece | duration (source → Pulsar) | RMS | peak |
| --- | --- | --- | --- |
| skyline-run | 137.39 s → 137.59 s | −21.4 → −18.7 dBFS | 0.613 → 0.647 |
| cathedral-of-gears | 144.05 s → 144.26 s | −18.2 → −16.7 dBFS | 0.606 → 1.000 (23 clamped) |
| tide-tables | 163.63 s → 163.87 s | −22.2 → −23.7 dBFS | 0.539 → 0.820 |

One pass runs within a quarter of a second of the same length for every piece, no second
is silent on either side, and the ten-second loudness profiles follow the same shape.
Tide Tables measures quieter here and its quiet ends are quieter still, because its
lowest drones sit under the target's 90 Hz post-DAC high-pass.

Tests keep the per-song rules that hold for any album piece: explicit state on every
lane at the loop row (a lane that never sounds has none to declare), hardware pitch
ranges including the VRC6's 12-bit floors derived from `pitch.ts`, self-ending noise
envelopes, non-drifting pitch macros, the preset gates (structure, musicality lint,
channel modes at the seam, render, anti-vacuity) and a byte-identical round trip of the
committed files through `serializeSong`. The key lint reads all six pitched lanes, and
each VRC6 lane is proved to move its accidental count. All six are held to that same set,
whichever route they came in by. Piece-specific tests then pin what makes each one itself.
For the ports, in `tests/unit/soundtrack.test.ts`: Skyline Run's speed 3 with eight rows
to the beat, DPCM on the kit slots and the two-row
echo; Cathedral of Gears's sawtooth bass with the triangle an octave above it, the lead's
7 → 2 duty macro, every pulse-2 note proved to be a lead note three rows earlier, and the
declared accidental allowance (the raised leading tone and the F-minor restatement); Tide
Tables's 80-row patterns with a 40-row bar, `3xx` on the triangle, fixed-mode arpeggio
bells with their echoes two beats behind, and two VRC6 voices that never share a row.
Each composed piece has a file of its own — `tests/unit/track-tailwind.test.ts`,
`track-counterweight.test.ts`, `track-sunward-banner.test.ts` — which pins its devices at
`frame:row`: Tailwind's echo canon three rows behind, five steps quieter, on a duty-0
instrument, its saw-at-pitch re-orchestration, the unbroken six-row stab cell, the
displaced hook and the
transposed final chorus with its unison fold; Counterweight's riff cell counted across
four sections, the fifths a 32nd behind it, every `0xy` block proved to be cancelled, the
scale-degree inversion into F minor, the dropped bar and the hemiola that lands exactly on
the turn; Sunward Banner's silent-2A03 opening, the head's four treatments, the Italian
sixth resolving outward, the six-row cell entering on the rows §9.1 derives rather than
typed ones, the one-bar kit stop and the ritardando that the loop row undoes. Anti-vacuity
is in these files too: Tailwind's last test damages its own piece — an undisplaced A″, an
untransposed chorus′ — and shows the pins catch it, and Sunward Banner derives the
phase-carry rows from §9.1's formula and checks against `pitch.ts` that the octave its
unison replaced really would have beaten. Texture signatures ignore labels, transposition
and tempo; a renamed, transposed copy is shown not to count as a new piece.

Two driver-facing corrections came out of the port and are covered by tests: `Qxy`
and `Rxy` are one-shot in the preset walk as they are in the driver, and a cut now
forgets a glide still in flight (its arrival used to restore a base note on a silenced
channel, leaving the next `3xx` note as a silent target). These checks verify the
implementation and the written arrangement, not beauty or recognizability; final
approval belongs to an audition — now of eight voices rather than four.

## Scope

No engine or visual redesign was needed. The song picker lists all twelve by name, and
`tests/unit/presetFormat.test.ts` pins that list so the album cannot thin quietly and no
retired preset can leak back into it; user-saved browser drafts and local-storage
snapshots are preserved. Deployment follows the existing homepage integration workflow.
