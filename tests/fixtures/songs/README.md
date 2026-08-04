# song fixtures, and the one thing tests cannot judge

- `tiny.json` — the eight-row, two-lane fixture from phase-2 design §1.4. It is the
  round-trip fixture, the driver fixture and the **golden song**: `presetFormat.test.ts`
  pins the FNV-1a checksum of its 48 kHz render through `renderSong`, so the driver, the
  macro engine and the whole DSP path are held together by one number. Changing it means
  updating the pin in the same commit, which is the point.
- `build.ts` — song builders and the driver harness the `tracker*.test.ts` suites share.
  Every fixture it produces goes through the real `parseSong`, so a broken fixture fails
  loudly where it is written rather than mysteriously where it is used.
- `bad-*.json` — WP11's deliberately-broken presets for §5.5's gate D. Not here yet.

## the honest status of acceptance item (d)

plan-file's phase-2 acceptance asks that **instrument macros audibly match
FamiStudio/FamiTracker playback of an equivalent instrument**. Half of that is
automatable and is automated: every documented rule in design §3.4 has a behavioural
test in `tests/unit/trackerMacros.test.ts` (index 0 on the trigger tick, loop wrap,
no-loop hold, the release tail, the volume-macro-gates-release rule, instrument swap
keeping indices, hi-pitch = pitch × 16, and the three arpeggio modes).

The other half — "audibly" — is a **manual comparison procedure**, written down here in
the same style as phase 1's spectral-comparison item, because a test suite with no ears
cannot discharge it and pretending otherwise would be worse than saying so.

### the procedure

1. **Pick the instrument.** Use `tiny.json`'s `lead`: volume `[15, 13, 11, 9, 8]` looping
   on index 4, duty `[2, 2, 1, 1]` looping on index 2, no arpeggio, no pitch macros.
2. **Build the equivalent in FamiStudio** (or FamiTracker, if you have it): a 2A03
   instrument with a volume envelope `15 13 11 9 8` with the loop point on the last
   value, and a duty envelope `2 2 1 1` with the loop point on index 2. Engine speed 60,
   tempo 150, speed 6 — the even-tick case, so the two players agree on row length
   exactly and any difference you hear is the instrument, not the clock.
3. **Author the same eight rows**: `c-4` at row 0 with volume `f`, `e-4` at row 2, `g-4`
   at row 4 with `047`, `---` at row 6.
4. **Render both.** Ours:
   ```ts
   import { renderSong } from '../../../src/tracker/offlineRender'
   const { samples, sampleRate } = renderSong(song, { sampleRate: 48000, loops: 1 })
   ```
   (Phase 3's WAV export is this same function plus an encoder; until it lands, write
   the `Float32Array` out with any scratch script.) Theirs: FamiStudio's WAV export at
   48 kHz, no compression, no stereo separation.
5. **Compare, in this order** — each step catches a different class of bug:
   - **envelope shape.** Plot the per-tick amplitude of the first note. Ours steps
     15 → 13 → 11 → 9 → 8 and then holds 8 forever. If theirs decays to zero after the
     last value, the "no loop point holds the last value" rule (design §3.4, **[ours]**)
     is wrong and `trackerMacros.test.ts` is the test to change.
   - **duty timing.** The duty macro must change timbre on ticks 2 and 3 of every note
     **without a click**. A click means `$4003` is being written with the duty change —
     see the write-on-change rule in `docs/register-timeline.md`.
   - **arpeggio phase.** `047` on `g-4` must start on the *unmodified* note, then +4,
     then +7, cycling every tick. If ours starts on +4, the arpeggio step is being
     advanced before it is read.
   - **release.** Add a release point to the volume envelope on both sides, replace the
     `---` with `===`, and check that the tail runs from `release + 1` to the end and
     then holds. Then REMOVE the release point and check that `===` produces a hard cut
     on both sides — that is the volume-macro-gates-release rule, and it is the one most
     likely to differ.
6. **Record what you found** in `docs/phase2-acceptance.md`, including anything that did
   NOT match. A documented mismatch is evidence; a silent one is a bug with a good
   disguise.

### what this procedure cannot tell you

Absolute level and the analog section will differ — pulsar's mixer is the NESdev
non-linear LUT plus a modelled NES/Famicom filter chain (see `docs/deviations.md`
D-M1/D-M2), and FamiStudio's is not the same code. Compare **shapes and timings**,
normalise before you compare levels, and do not chase a 0.5 dB difference.
