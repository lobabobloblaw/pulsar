# The OCTET tracks

The three presets in `src/assets/songs/` — *Skyline Run*, *Cathedral of Gears* and
*Tide Tables* — are the demo compositions of **OCTET**, a browser synthesizer and
sequencer for the 2A03 and the VRC6 expansion kept in a sibling project. They are that
project's own original pieces, each authored as a generator script that writes every
melody, bass line, chord, drum pattern and form as code; nothing in them quotes or
paraphrases a published work, which is what `docs/preset-suite.md` §0 requires.

pulsar has the 2A03's five lanes only. *Skyline Run* is a 2A03 piece and ports
one-to-one. The other two use the VRC6's two pulses and sawtooth, so they are
**re-arranged** for pulse 1, pulse 2, triangle and noise: the same music, the same
notes, a different voice allocation where the chip forces it. Every allocation
decision is code, in one module per song, with a comment saying what moved where
and why.

| file | role |
|---|---|
| `convert.mjs` | the mechanical OCTET → pulsar mapping (notes, noise indices, DPCM key map, macros, per-channel patterns, canonical serialization) and the engine-difference fixups shared by every song |
| `fold.mjs` | time-folding helpers: lane timelines, priority folds, global-effect parking, loop-entry state |
| `skyline-run.mjs` | direct port; adds the loop-entry state and the DPCM restart gates the target driver needs |
| `cathedral-of-gears.mjs` | the VRC6 fold for the gothic piece (melody to pulse 1, saw bass to the triangle, counter-melody and harmony chords on pulse 2) |
| `tide-tables.mjs` | the VRC6 fold for the ambient piece (voices and bells shared by time across the pulses, breathing noise as re-struck one-shot swells) |
| `build.mjs` | the command line |

Rebuild a song from its OCTET document (paths are the sibling checkout's):

```
node tools/songs/octet/build.mjs ../octet/demos/skyline-run.json src/assets/songs/01-skyline-run.json --song tools/songs/octet/skyline-run.mjs
node tools/songs/octet/build.mjs ../octet/demos/cathedral-of-gears.json src/assets/songs/02-cathedral-of-gears.json --song tools/songs/octet/cathedral-of-gears.mjs
node tools/songs/octet/build.mjs ../octet/demos/tide-tables.json src/assets/songs/03-tide-tables.json --song tools/songs/octet/tide-tables.mjs
```

The output is byte-identical to what `serializeSong` writes, so gate A's round trip
holds on the committed file. After any change, run `pnpm test tests/unit/presets.test.ts`,
paste the checksum gate C prints into the module's `qa.renderChecksum`, and rebuild.

## What the converter corrects between the two drivers

Both engines agree on note numbering (after +12), period tables, macro semantics,
noise mapping (`$400E = 15 − (note mod 16)`) and most effects. The differences that
change what is heard are fixed in `convert.mjs`:

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
