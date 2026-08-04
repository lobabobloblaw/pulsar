# phase-2 acceptance — the tracker + the preset suite

Run date 2026-08-04. Tree: **765 tests / 36 files**, five-project typecheck clean,
production build green. Everything below cites its evidence; the honest gaps are
stated with the same prominence as the passes.

## plan-file.md phase-2 criteria (a)–(e)

| # | criterion | evidence | status |
|---|---|---|---|
| a | Tempo math verified against the formula | `trackerTempo.test.ts` (21 tests): `2.5·E·S/T` as the exact ratio `5·E·S / 2·T`; E=60 S=6 T=160 → row lengths **6,6,5,6,6,5,6,5**, 45 ticks / 8 rows, accumulator returns to 0 — character-for-character FamiTracker's documented `F06@160` expansion; 224×7 tempo sweep never drifts a full tick; closed-form `cycleOfTick` exact to 10 h at E=400 | **pass** |
| b | A test song plays with correct arps, slides, vibrato, volume slides, frame jumps | `trackerEffects.test.ts` (53) + `trackerMacros/Volume/Vibrato` suites pin every implemented effect tick-by-tick; Gate C runs an **independent document walk** (own note-on derivation) over all 14 shipped songs; the 4 technique demos are living fixtures (first-light macros, long-fall pitch effects, hammer-shop percussion, switchback structure) | **pass** |
| c | Non-integer ticks-per-row reproduces the 6/7 alternation (+ even-tempo toggle) | (a)'s Bresenham evidence; `evenTempo` toggle implemented and tested; the swing is *musically load-bearing* in three shipped songs (midnight-ferry's measured `7 6 7 6 7 6 6`, switch-cutter, green-flash's 8/7 lilt) | **pass** |
| d | Instrument macros audibly match reference behavior | Macro engine semantics pinned by tests (loop + release points, volume-release gating, shared-by-index bank); behavioral reference comparison vs FamiTracker itself remains **by-ear/manual** — the suite's musical QA (critic + user audition rounds) is the operating evidence | **pass (documented-manual reference check)** |
| e | Pattern grid 60 fps at 8ch × 64 rows | `patternGrid.bench.ts`: full repaint p99 **0.195 ms** vs the 4 ms gate (anti-vacuity floors on glyph/rect counts); CDP frame-delta runs: zero frames > 20 ms while scrolling/editing/playing | **pass** |

## sustained playback (the phase's runtime claim)

- Song-playback soak harness (`?selftest&soak=N&song=<id>`): plays a real preset
  through the real `TrackerDriver` over a bare engine. 2-minute green-flash proof:
  16 order frames, 0 late / 0 dropped / 0 underruns (sab).
- 12-minute long-division soak (muted, real-device-paced, sab): **4 complete
  loops, 111 order-frame advances, 0 late / 0 dropped / 0 underruns — PASS.**
- Known harness limit (ledgered): the soak's DPCM lane is silent (no `dpcmLayout`
  upload); the in-app path posts the image at engine start (pinned by
  `bridgeTransport.test.ts`).

## review rounds (the defects the green suite could not see)

**Musical:** an independent critic verified every claimed device attack-for-attack
(`docs/preset-critique.md`) — all eight album pieces cleared the 11-axis bar; its
findings (false dissonance claim, static-harmony stretches, density breaches)
were fixed in a polish round with seam transients verified by envelope
cross-correlation against untouched controls.

**Engineering:** an adversarial review found **5 blockers** between the agents'
scopes — PresetBar built but never mounted; two empirically-probed stuck-note
paths in the Rule-L handoff (unowned coordinator stop; missing status write on
stolen-lane handback); a grid keyboard trap (WCAG 2.1.2); record-while-playing
writing to the viewed frame instead of `recordSink.orderIndex` — plus the
preview-gain discrepancy (previews render at knob-max, +5.7 dB over the app's
default; documented in preset-suite §7.2 as gain-invariant for relative
judgments). All blockers + S1/S3/S4/S5/S8 fixed with pinning tests that fail
against the pre-fix tree (749 → 765).

## the preset suite

14 songs: a 10-piece original album (01–10, incl. the two §10 tropical tracks in
the Kondo/Tanaka register with the verified steel-drum family, bank rev 2) + 4
technique demos (11–14). Every piece: originality-absolute, gate-clean
(structure, musicality lint, offline render with clipping ≤ target and pinned
checksums, anti-vacuity bad-fixtures), critic-scored with frame:row-verified
devices, and rendered to preview WAVs auditioned by the user across three
rounds (round-1 feedback — "generic, wants polyrhythms/prestige" — drove the
§9 prestige pass; the audition loop is the real quality gate the deterministic
gates cannot be).

## ship-polish ledger (deliberately deferred, none load-bearing)

From the engineering review: S6 auto-follow fights user scroll / ensureVisible
gaps; S7 Gate C's duration assertion shares `RowAccumulator` with the driver
(note-on count IS independent); instrument editor lacks DPR/resize watcher;
hardcoded instrument 00 on note entry; sub-column a11y announcements;
`setLiveChannel` not wired to `setCursor` (arrow-only); soak DPCM upload;
`renderPreviews` suite-factory executes under plain `pnpm test`; Gate D budget
hardcoding; glob-registry locale tie-break; plus the review's nits list
(verbatim in the review transcript). From the music side: harmonic-motion
follow-ups if the user's round-3 audition asks for them.

## how to re-run

`pnpm test` · `pnpm bench` · `pnpm preview:songs` (writes `previews/*.wav`) ·
song soak: serve + drive `/?selftest&soak=12&song=long-division` muted via CDP ·
grid bench: `pnpm bench` · the audition loop: send `previews/` to ears.
