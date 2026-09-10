# Pulsar — eight genres, one APU

September 2026. This second restart discards the first replacement set as well as
the eighteen legacy presets. The first attempt changed melodies and keys but reused
too much timbre, accompaniment and “intro / theme / contrast / late peak” form.
This set starts from eight different musical jobs for the chip.

These are original, directly authored tracker compositions, not transcriptions or
imitations of named games or composers. The genre names describe arrangements
translated into the 2A03's two pulses, triangle, noise and optional DPCM—not
recordings of acoustic ensembles. No expansion chips, backing tracks, external
effects, model inference or runtime dependencies are involved.

## Catalog and audition map

First-pass times include any build/count-in. The WAVs include the loop seam and
a second pass; only funk and drum and bass skip an introductory section on repeat.

| Track | Genre | BPM | First pass | Form and defining sound |
| --- | --- | ---: | ---: | --- |
| Pocket Voltage | Funk | 108 | 1:02 | Bass/drum count-in; syncopated pocket, wah answers, breakdown, short solo |
| Blue Hour Club | Swing jazz | 120 | 1:12 | Three twelve-bar blues choruses: head, solo, out-head; walking bass and swung horn |
| Version in Salt | Dub | 72 | 1:20 | Six successive four-bar versions; one-drop beat, offbeat skanks, written echoes and dropouts |
| Razor Rally | Speed metal | 192 | 0:50 | Low pedal riffs, double kick, stop-time, solo and half-time return |
| Café Azimuth | Bossa nova | 144 | 0:53 | 32-bar AABA; two-bar comping, flute-like lead and seventh chords |
| Two-Part Machine | Baroque invention | 96 | 0:40 | 16-bar through-written counterpoint; two manuals and continuo, no drums |
| Slow Orbit | Ambient | 48* | 1:20 | Eight sustained sonorities, staggered releases; no beat or lead melody |
| Breakwater | Drum and bass | 174 | 1:28 | Eight-bar build, 24-bar drop, eight-bar breakdown/rebuild, 24-bar second drop |

*Slow Orbit's 48 BPM is its editing grid, not an audible drum pulse.
About nine minutes of first-pass material. Genres appear in the song picker;
all notes and instruments remain editable.

For a quick contrast test, start with **Blue Hour Club → Razor Rally → Slow Orbit**.
They should differ immediately in pulse, register, density and articulation.

## Specific composition decisions

- **Pocket Voltage:** D-dorian bass is the foreground instrument, with sixteenth-note
  anticipations and octave pops. Pulse1 supplies clipped clav-like stabs before a
  short late solo; pulse2 answers with a duty-shaped wah. Noise supplies ghosts
  around the DPCM backbeat. This is a groove arrangement, not a continuous treble theme.
- **Blue Hour Club:** six rows per quarter note, with eighth-note pairs at offsets
  0 and 4, produces an actual 2:1 long–short rhythm. Four quarter-note bass attacks
  per bar ground the horn's syncopations. Third/seventh shells and blue thirds
  define the C blues changes; chromatic bass approaches are intentional.
- **Version in Salt:** the bass has deliberate holes, with roots in octave2 so
  the engine's hardware-style high-pass does not remove their weight. Rounded
  offbeat skanks use a different envelope/duty from the quieter echoes at four
  and six rows later. Dry-only and echo-only sections expose the arrangement.
  It is the sparsest and quietest beat-based mix; it is not normalized upward.
- **Razor Rally:** low E-pedal figures and open fifth/octave power textures replace
  a high lead for much of the piece. Double-kick subdivisions, a tritone answer,
  a stop-time break and a separate solo create the form. Half-time changes the
  backbeat, not the underlying 192 BPM.
- **Café Azimuth:** the comping attacks at rows 0, 6, 12, 18, 22 and 28 form a
  two-bar cell. Four-note major-seventh, minor-seventh and dominant-seventh macros
  support a softer sustained lead. The bridge moves through Am/D7 and G/Gm
  before the A material returns; no mandatory melody cut at every pattern edge.
- **Two-Part Machine:** two short plucked pulse manuals exchange subject and
  countersubject over triangle continuo. Pulse2 enters one bar after pulse1.
  Sequences, an inverted contour and a dominant episode develop into a cadence.
  There is no noise channel, chord arpeggiator or vibrato.
- **Slow Orbit:** each ten-second sonority has slow pulse attacks, detuning and
  staggered releases; the triangle is a low foundation with actual gate rests.
  Each voice has only eight attacks in eighty seconds. No percussion is added
  to satisfy an album-wide density rule.
- **Breakwater:** broken kick/snare grids, noise ghosts, interrupted pulse bass
  doubled by triangle, and rave-chord stabs take turns with sustained clouds.
  Three playback rates change the snare chops. The eight-bar opening build
  plays once; the loop returns directly to the first drop.

Every track has a different custom opening instrument palette. Pocket Voltage,
Razor Rally and Breakwater reuse the project's two arithmetic DPCM samples, not
sampled recordings. Their hits have explicit short Sxx gates: three ticks for
kick, one or two for snare according to rate. This is deliberate tight percussion
articulation and avoids overlap/restarts in the current driver. Ungated fast DPCM
patterns exposed a pre-existing retirement/retrigger limitation; the driver was
not rewritten in this composition pass. Whole-song tests replay these three
arrangements through the real DMC channel and require exactly the authored starts.

## Rendering and checks

Run `pnpm preview:songs` for `previews/<id>.wav`: 48 kHz mono PCM16,
raw tracker/APU mixes with no normalization or limiter. Render masterGain 2.0
corresponds to the app knob at maximum; its usual 0.72 setting is about 5.7 dB lower.
The two-pass mixes range from approximately −29.7 to −21.7 dBFS RMS, with no
clipped samples. Each song declares a narrow level range and pinned checksum.

Tests retain parsing, reachable patterns, real voice audibility, hardware pitch
ranges, self-ending noise, non-drifting pitch macros, explicit loop state, silence
and clipping checks. Genre-specific tests check the actual swing offsets,
walking bass, dub repeats/dropouts, low metal riffs, bossa comping, drum-free
counterpoint, sparse ambient attacks and multi-rate breaks. Rhythm signatures
ignore labels, transposition and tempo; a renamed/transposed copy is explicitly
shown not to count as a new texture.

Removed requirements: six lead patterns in every song, a cut in every lead phrase,
a peak in the last third, and a nonzero loop target in every song. Those tests
were enforcing the sameness the user rejected. Jazz gets a documented, capped
15% chromatic allowance against its diatonic reference; other songs retain 12%.
The ambient grid lowers the tempo lint floor to 30 BPM, not a change to timing.

The order-walk duration regression uses an independent miniature fixture:
a shortened four-row intro followed by two eight-row frames, 20 rows on the first
pass and 36 across two passes. It no longer depends on a retired song.

These checks verify implementation and the written arrangement—not beauty,
recognizability, emotional impact, or a claim of having listened. Final approval
belongs to an audition, especially bass weight, groove, fatigue and loop transitions.
User-saved browser drafts and local-storage snapshots are preserved.

## Scope

No ground-up engine or visual redesign was needed to express this contrast.
The song picker is wider to accommodate genre labels. A section-aware arrangement
view remains a possible future authoring improvement, not part of this change.
Song JSON is the sole composition source; no generator or intermediate score
language was introduced. Deployment follows the existing homepage integration workflow.
