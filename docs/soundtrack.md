# Pulsar — three tracks, two chips

September 2026. The eight-genre set is replaced by the three demo compositions of
OCTET, a sibling NES/Famicom sequencer project for the 2A03 and the VRC6 expansion.
Each piece was authored there as a generator script that writes every melody, bass
line, chord, drum pattern and form as code; they are that project's own original
music, not transcriptions or imitations of any published work. Pulsar now has the
same eight lanes, so the port carries the notes over exactly and re-voices nothing:
every lane lands on its own lane. The converter and the per-song modules live in
`tools/songs/octet/` (see its README); song JSON remains the shipped source.

## Catalog and audition map

One-pass times are measured from the order walk (the loop skips an intro where there
is one). The WAVs from `pnpm preview:songs` hold two passes including the loop seam.

| Track | Character | BPM | One pass | Form and defining sound |
| --- | --- | ---: | ---: | --- |
| Skyline Run | Action-stage theme | 150 | 2:18 | Intro, A, chorus, A2, bridge, A3 (42 frames on a 32nd-note grid); hook on pulse 1 with a two-row echo canon on pulse 2, diatonic thirds and `0xy` chord stabs, walking triangle bass with a pitch-dive thump, noise kit over DPCM kick and snare, a half-time breakdown in the bridge |
| Cathedral of Gears | Gothic theme, eight voices | 150 | 2:24 | Intro, A, A repeat, B, A′ (a minor third up), coda (22 frames); a driving-sixteenth bass gallop on the VRC6 sawtooth with the triangle doubling it an octave up, the melody on VRC6 pulse 1 under a duty macro that opens at 50 % and narrows to 3/16, reedy 25 % inner harmony on VRC6 pulse 2, counter-melody and `0xy` chord stabs on 2A03 pulse 1, a three-row echo of the leading line on 2A03 pulse 2, the sawtooth taking the solo lead through the B section, an `Fxx` ritardando into the loop |
| Tide Tables | Slow ambient, 5/4, eight voices | 56 | 2:44 | Fifteen named patterns of two 5/4 bars (80 rows, speed 8) in D Dorian; triangle drones joined by `3xx` glides, struck bell chords on fixed-mode arpeggio instruments answered two beats later by quieter echoes, two slow VRC6 voices trading beats (duty 1 above, duty 0 below), a soft sawtooth pad at volume 3 gliding between chord tones, wind and surf on the noise lane, a tempo dip to 110 in the slack-water pattern |

About seven and a half minutes of first-pass material. For a quick contrast test,
audition **Skyline Run → Tide Tables → Cathedral of Gears**: they differ at once in
grid, register, density and articulation.

## What the port corrects

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
`applyEngineDifferences` is untouched and the song is what OCTET plays.

Both eight-voice songs claim seven lanes and declare a silent `dpcm` as well, because
`channels` is a prefix of the canonical eight and reaching `vrc6p1` means carrying every
lane before it. That lane gets an empty pattern and a `0` in each order frame.

**The arrangement that was here before.** The 2026-09-11 release folded these two pieces
onto four 2A03 lanes — melody to pulse 1, sawtooth bass to the triangle, harmony spelled
as `0xy` triads in the counter-melody's rests, the echo lane dropped — because Pulsar had
no VRC6 yet. Commit `006f837` holds that arrangement and the fold modules that produced
it. It is history, not a fallback: the chip is in the core now and the pieces play as
composed.

## Rendering and checks

`pnpm preview:songs` writes `previews/<id>.wav`: 48 kHz mono PCM16, raw tracker/APU
mixes with no normalization or limiter, at render master gain 2.0 (the app knob at
maximum; its usual 0.72 setting is about 5.7 dB lower).

| id | two passes | RMS | peak | clipped |
| --- | ---: | ---: | ---: | ---: |
| skyline-run | 268.8 s | −18.74 dBFS | 0.647 | 0 |
| cathedral-of-gears | 275.7 s | −16.62 dBFS | 1.000 | 38 |
| tide-tables | 327.8 s | −23.67 dBFS | 0.853 | 0 |

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

Against the source project's own renders of the originals (`tools/render-cli.mjs`, one
pass, no fade; both sides analysed with its `tools/analyze-wav.mjs`):

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
envelopes, non-drifting pitch macros, the four preset gates (structure, musicality lint,
render, anti-vacuity) and a byte-identical round trip of the committed files through
`serializeSong`. The key lint reads all six pitched lanes, and each VRC6 lane is proved
to move its accidental count. Piece-specific tests pin what makes each one itself:
Skyline Run's speed 3 with eight rows to the beat, DPCM on the kit slots and the two-row
echo; Cathedral of Gears's sawtooth bass with the triangle an octave above it, the lead's
7 → 2 duty macro, every pulse-2 note proved to be a lead note three rows earlier, and the
declared accidental allowance (the raised leading tone and the F-minor restatement); Tide
Tables's 80-row patterns with a 40-row bar, `3xx` on the triangle, fixed-mode arpeggio
bells with their echoes two beats behind, and two VRC6 voices that never share a row.
Texture signatures ignore labels, transposition and tempo; a renamed, transposed copy is
shown not to count as a new piece.

Two driver-facing corrections came out of the port and are covered by tests: `Qxy`
and `Rxy` are one-shot in the preset walk as they are in the driver, and a cut now
forgets a glide still in flight (its arrival used to restore a base note on a silenced
channel, leaving the next `3xx` note as a silent target). These checks verify the
implementation and the written arrangement, not beauty or recognizability; final
approval belongs to an audition — now of eight voices rather than four.

## Scope

No engine or visual redesign was needed. The song picker keeps its labels; user-saved
browser drafts and local-storage snapshots are preserved. Deployment follows the
existing homepage integration workflow.
