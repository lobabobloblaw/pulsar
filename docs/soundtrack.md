# Pulsar — three tracks, one APU

September 2026. The eight-genre set is replaced by the three demo compositions of
OCTET, a sibling NES/Famicom sequencer project for the 2A03 and the VRC6 expansion.
Each piece was authored there as a generator script that writes every melody, bass
line, chord, drum pattern and form as code; they are that project's own original
music, not transcriptions or imitations of any published work. The port carries the
notes over exactly and changes only the voice allocation where the 2A03's five lanes
force it. The converter and the per-song arrangement modules live in
`tools/songs/octet/` (see its README); song JSON remains the shipped source.

## Catalog and audition map

One-pass times are measured from the order walk (the loop skips an intro where there
is one). The WAVs from `pnpm preview:songs` hold two passes including the loop seam.

| Track | Character | BPM | One pass | Form and defining sound |
| --- | --- | ---: | ---: | --- |
| Skyline Run | Action-stage theme | 150 | 2:18 | Intro, A, chorus, A2, bridge, A3 (42 frames on a 32nd-note grid); hook on pulse 1 with a two-row echo canon on pulse 2, diatonic thirds and `0xy` chord stabs, walking triangle bass with a pitch-dive thump, noise kit over DPCM kick and snare, a half-time breakdown in the bridge |
| Cathedral of Gears | Gothic theme | 150 | 2:24 | Intro, A, A repeat, B, A′ (a minor third up), coda (22 frames); driving-sixteenth bass gallop on the triangle at the sawtooth's register, a lead with vibrato and portamento on pulse 1, counter-melody and `0xy` inner-harmony triads on pulse 2, a sawtooth solo folded onto pulse 1, an `Fxx` ritardando into the loop |
| Tide Tables | Slow ambient, 5/4 | 56 | 2:44 | Fifteen named patterns of two 5/4 bars (80 rows, speed 8) in D Dorian; triangle drones joined by `3xx` glides, struck bell chords on fixed-mode arpeggio instruments with quieter echoes, two slow voices trading beats, a soft pad, wind and surf on the noise lane, a tempo dip to 110 in the slack-water pattern |

About seven and a half minutes of first-pass material. For a quick contrast test,
audition **Skyline Run → Tide Tables → Cathedral of Gears**: they differ at once in
grid, register, density and articulation.

## What was folded from the VRC6, and how

Skyline Run is a 2A03 piece and ports one-to-one. The other two used three more
voices — two VRC6 pulses and a sawtooth — and are re-voiced by priority: melody >
bass > drums > harmony/chords > counter-melody > echo/doubling. Every fold is a code
decision with a comment in the song's module.

**Cathedral of Gears** (`tools/songs/octet/cathedral-of-gears.mjs`)

| OCTET lane | Role | Pulsar lane | Section detail |
| --- | --- | --- | --- |
| VRC6 pulse 1 | melody; pad tones in the intro, B section and coda | pulse 1 | verbatim, except bars 48–53 where the saw solo takes the lane |
| VRC6 saw | bass gallop; pedal + running line and a solo in B; pad roots | triangle (bass) / pulse 1 (solo) | bass at the saw's own octave everywhere; slides scaled 14/32 for the triangle's period table; the six-bar solo, with its bend-in pitch macro, on pulse 1 at 25 % duty |
| 2A03 triangle | doubling the saw an octave up; the gallop under the solo | dropped / triangle | its own gallop is kept for bars 48–53 only |
| 2A03 pulse 1 | counter-melody (A sections); `0xy` arpeggio chords (B) | pulse 2 | verbatim |
| VRC6 pulse 2 | wide-duty inner-harmony chords; pads | pulse 2 (in rests) | in the first A section the harmony's struck tones become `0xy` triads spelled from the two alternating tones and the saw's root wherever the counter-melody rests; intro and coda pad tones pass through; hits under sounding counter-melody notes and the B-section pads are dropped |
| 2A03 pulse 2 | three-row echo of the leading line | dropped | echo is the first thing to go |
| noise | kit, with the coda's `Fxx` ritardando | noise | verbatim |

Timbre: VRC6 duties map through the port's table, so the lead settles on 25 %, the
50 % pad stays 50 % and the harmony alternates 25/50 %. The drums stop where the piece
stops them (a crash-only intro, a coda of held chords under the ritardando), which the
song declares as `percussionCoverage: 0.75`.

**Tide Tables** (`tools/songs/octet/tide-tables.mjs`)

| OCTET lane | Role | Pulsar lane | Detail |
| --- | --- | --- | --- |
| triangle | drones and glides | triangle | verbatim; the final drone is restated on the loop row |
| VRC6 pulse 1 | voice A, the upper slow line | pulse 1 | verbatim, highest priority |
| 2A03 pulse 1 | struck bell chords | pulse 1 / pulse 2 | a strike that lands on a voice-A note moves to pulse 2 instead of being lost |
| VRC6 pulse 2 | voice B, the lower line on the beats voice A leaves free | pulse 2 | verbatim below displaced strikes |
| 2A03 pulse 2 | bell echoes two beats later | pulse 2 | kept where no strike or voice note claims the row |
| VRC6 saw | soft pad gliding between chord tones | pulse 2 (background) | 50 % duty with its own slow envelope, volume column doubled; struck where the lane is free and re-entered on its current chord tone as soon as a bell or echo above it has died; silent while a voice-B note or a ringing bell holds the lane |
| noise | wind, surf and a surf tick on looping breathing envelopes | noise | the same breaths as one-shot swells re-struck at their own length (16 and 26 rows), so every envelope ends on 0 |

The pad is quieter on a pulse than on the sawtooth, and the low drones sit under the
target's 90 Hz post-DAC high-pass, so the piece measures about −25 dBFS over two
passes; it is not normalised.

## Rendering and checks

`pnpm preview:songs` writes `previews/<id>.wav`: 48 kHz mono PCM16, raw tracker/APU
mixes with no normalization or limiter, at render master gain 2.0 (the app knob at
maximum; its usual 0.72 setting is about 5.7 dB lower).

| id | two passes | RMS | peak | clipped |
| --- | ---: | ---: | ---: | ---: |
| skyline-run | 268.8 s | −18.74 dBFS | 0.647 | 0 |
| cathedral-of-gears | 275.7 s | −18.86 dBFS | 0.751 | 0 |
| tide-tables | 327.8 s | −24.56 dBFS | 0.553 | 0 |

Against the source project's own renders of the originals (one pass with a two-second
fade), one pass runs within a second of the same length for every piece, no second is
silent on either side, and the ten-second loudness profiles follow the same shape;
overall level differs by up to 3 dB because the VRC6 mixes with extra gain and the
sawtooth is louder than a pulse at the same column value.

Tests keep the per-song rules that hold for any album piece: explicit state on every
lane at the loop row, hardware pitch ranges, self-ending noise envelopes,
non-drifting pitch macros, the four preset gates (structure, musicality lint, render,
anti-vacuity) and a byte-identical round trip of the committed files through
`serializeSong`. Piece-specific tests pin what makes each one itself: Skyline Run's
speed 3 with eight rows to the beat, DPCM on the kit slots and the two-row echo;
Cathedral of Gears's triangle bass, `0xy` chord device on pulse 2 and declared
accidental allowance (the raised leading tone and the F-minor restatement);
Tide Tables's 80-row patterns with a 40-row bar, `3xx` on the triangle and fixed-mode
arpeggio bells. Texture signatures ignore labels, transposition and tempo; a renamed,
transposed copy is shown not to count as a new piece.

Two driver-facing corrections came out of the port and are covered by tests: `Qxy`
and `Rxy` are one-shot in the preset walk as they are in the driver, and a cut now
forgets a glide still in flight (its arrival used to restore a base note on a silenced
channel, leaving the next `3xx` note as a silent target). These checks verify the
implementation and the written arrangement, not beauty or recognizability; final
approval belongs to an audition, especially the folded lanes of the two VRC6 pieces.

## Scope

No engine or visual redesign was needed. The song picker keeps its labels; user-saved
browser drafts and local-storage snapshots are preserved. Deployment follows the
existing homepage integration workflow.
