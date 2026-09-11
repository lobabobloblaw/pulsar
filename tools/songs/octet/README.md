# The OCTET tracks

The three presets in `src/assets/songs/` — *Skyline Run*, *Cathedral of Gears* and
*Tide Tables* — are the demo compositions of **OCTET**, a browser synthesizer and
sequencer for the 2A03 and the VRC6 expansion kept in a sibling project. They are that
project's own original pieces, each authored as a generator script that writes every
melody, bass line, chord, drum pattern and form as code; nothing in them quotes or
paraphrases a published work, which is what `docs/preset-suite.md` §0 requires.

pulsar has the same eight lanes: the 2A03's five and the VRC6's two pulses and
sawtooth. All three pieces therefore port **one to one** — every lane lands on its
own lane and no voice is re-allocated. The song modules carry only the corrections
the target driver needs, each with a comment saying what it corrects and why; a
module that moved a voice would be changing the music, which is not what this
directory is for.

| file | role |
|---|---|
| `convert.mjs` | the mechanical OCTET → pulsar mapping (notes, noise indices, DPCM key map, macros, per-channel patterns, canonical serialization), the engine-difference fixups shared by every song, and the small helpers the modules use (lane timelines, loop-entry state) |
| `skyline-run.mjs` | the 2A03 piece: adds the loop-entry state and the DPCM restart gates the target driver needs |
| `cathedral-of-gears.mjs` | the eight-voice gothic piece: adds the loop-entry state, nothing else |
| `tide-tables.mjs` | the eight-voice ambient piece: adds the loop-entry state, and turns the looping wind and surf envelopes into one-shot swells re-struck at their own length |
| `build.mjs` | the command line |
| `audit.mjs` | the lane audit: source events against shipped events, lane by lane, with each module's corrections declared |

Rebuild a song from its OCTET document (paths are the sibling checkout's):

```
node tools/songs/octet/build.mjs ../octet/demos/skyline-run.json src/assets/songs/01-skyline-run.json --song tools/songs/octet/skyline-run.mjs
node tools/songs/octet/build.mjs ../octet/demos/cathedral-of-gears.json src/assets/songs/02-cathedral-of-gears.json --song tools/songs/octet/cathedral-of-gears.mjs
node tools/songs/octet/build.mjs ../octet/demos/tide-tables.json src/assets/songs/03-tide-tables.json --song tools/songs/octet/tide-tables.mjs
```

The output is byte-identical to what `serializeSong` writes, so gate A's round trip
holds on the committed file. After any change, run `pnpm test tests/unit/presets.test.ts`,
paste the checksum gate C prints into the module's `qa.renderChecksum`, and rebuild.

Then check that the rebuild is still the same music:

```
node tools/songs/octet/audit.mjs --octet ../octet
```

It counts note attacks, cuts and releases per lane on both sides of the port and fails
on any difference the song modules have not declared.

The two eight-voice pieces claim seven lanes each. They also declare `dpcm`, which they
never play: `channels` is a PREFIX of the canonical eight, so reaching `vrc6p1` means
carrying the lanes before it. The lane gets an empty pattern and a `0` in every order
frame, and the preset lint accepts it because it claims nothing and sounds nothing.

## What the converter corrects between the two drivers

Both engines agree on note numbering (after +12), period tables, macro semantics, VRC6
duty values (0–7 pass through unchanged), noise mapping (`$400E = 15 − (note mod 16)`)
and most effects. The differences that change what is heard are fixed in `convert.mjs`,
on the VRC6 lanes exactly as on the 2A03 pulses:

- `Axy` nibbles are swapped (OCTET: x up; pulsar: x down).
- `7xy` is re-expressed for pulsar's faster, deeper tremolo table; `700` becomes `710`.
- OCTET's `3xx` glides its own row only; pulsar's is a channel mode, so the first
  plain note after a glide or a `Qxy`/`Rxy` scoop carries `100` (cancel and retrigger).
- `===` on an instrument with no release point is a no-op in OCTET and a cut in pulsar,
  so those cells lose their note.
- Pitch effects and pitch macros are stripped from the noise lane, where OCTET ignores
  them.
- Volume rounding differs by one step for some non-full volume columns, per-tick
  effects step once more per row in OCTET, and `Qxy` runs at `2x+1` rather than `2x`
  units a tick: accepted, inaudible.
