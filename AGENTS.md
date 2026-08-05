# AGENTS.md

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project overview

**pulsar** is a teenage-engineering-flavored web synthesizer whose voice is a register-accurate NES 2A03 APU (2 pulse channels, triangle, noise, DPCM) running in an AudioWorklet, with a FamiTracker-style tracker. It is played live from a QWERTY keyboard or Web MIDI, and renders songs to WAV.

- Stack: **TypeScript + Svelte 5 (runes) + Vite + Vitest**. **Zero runtime dependencies** — devDependencies only (constraint K4); keep it that way.
- License: MIT. The APU and DSP are original implementations written against public NESdev documentation — no GPL/LGPL emulator source was consulted (see `NOTICE.md`).
- `plan-file.md` is the approved implementation plan (phases, milestones, acceptance criteria). Phases 1–2 are complete; evidence lives in `docs/phase1-acceptance.md` / `docs/phase2-acceptance.md`. Later phases per the plan: VRC6, WAV export, expansion chips, FamiTracker/FamiStudio text interchange.
- Note: the "status" section of `README.md` ("phase 1 in progress") is stale — trust this file and the acceptance docs.
- Browser targets: Chrome/Edge primary (Web MIDI). Safari works via the computer keyboard only (z–m lower octave, q–p upper); it has no Web MIDI.

## Commands

pnpm only (`.npmrc` sets `engine-strict`; node ≥ 22.12, pnpm 10).

```bash
pnpm install
pnpm dev                              # :5173, strictPort, COOP/COEP headers (enables the SharedArrayBuffer path)
pnpm test                             # vitest run, node environment (tests/**/*.test.ts)
pnpm test tests/unit/pitch.test.ts    # single file
pnpm test:watch
pnpm typecheck                        # five isolated TS projects + svelte-check — run before claiming done
pnpm bench                            # perf gates (apu.bench, patternGrid.bench)
pnpm preview:songs                    # PULSAR_PREVIEW=1: render every registered song to previews/<id>.wav + level table
pnpm build && pnpm preview            # production build at :4173 (build runs typecheck first)
pnpm coverage                         # vitest with v8 coverage
pnpm worklet:build                    # fallback worklet loader only — NOT part of the normal build
```

### Headless selftest / soak (the CDP harness)

In-browser acceptance is URL-flag driven: serve (dev or preview), drive with headless Chrome, grep the result.

- `/?selftest` — canonical note-on through the real transport, pitch measured off the AudioContext
- `/?selftest&soak=N` — N-minute all-channel soak
- `/?selftest&soak=N&song=<id>` — song-playback soak of a real preset
- Output contract: details text ends `SELFTEST PASS` / `SELFTEST FAIL`; `document.title` becomes `pulsar-selftest-pass|fail`
- Chrome flags: `--headless=new --mute-audio --autoplay-policy=no-user-gesture-required`. **`--mute-audio` is mandatory** — headless Chrome on macOS plays through the real speakers.
- Other URL flags: `?stub` (UI shell with synthetic bridge, no audio thread), `?pm` (force the postMessage transport)

## Architecture

### The one interface (sacred)

Everything reduces to a stream of timestamped APU register writes `(nesCycle, addr, value)`. Three producers — `LiveScheduler` (keys/MIDI/knobs), `TrackerDriver` (song playback), `renderSong` (offline render → previews/WAV) — feed one consumer, `Apu2A03.write()`, hosted in the worklet. Live play, tracker playback, and export are therefore bit-identical by construction. The core clocks channels at 1.789773 MHz and downsamples through a fresh implementation of band-limited step synthesis.

**`docs/register-timeline.md` is the authoritative doc** — read it before touching anything in the audio path. It defines: canonical per-channel register orders (the side-effect register — `$4003`/`$400B`/`$400F` — always LAST), `$4015` written as a whole byte never a single bit, write-on-change discipline in the driver (a held note writes `$4003` exactly once), the closed-form tick→cycle map, and Rule L (exactly one timeline owner at a time — `PlaybackCoordinator` hands off between `LiveScheduler` and `TrackerDriver`).

Hard rules:

- `src/audio/timeline/types.ts` (`WriteSink`) is **FROZEN**. Changes break every producer and must be mirrored in `docs/register-timeline.md`.
- Exactly one ring producer (`EngineHandle`), pushing in **non-decreasing cycle order** — the consumer stops at the first write past the frame limit, so one out-of-order write silently parks everything behind it.
- Cycle values are integer-valued **doubles**; bitwise ops (`|0`, `<<`, `&`) on them are banned — int32 wraps at 2³¹ cycles ≈ 20 min. `& MASK` applies to ring *indices* only.
- `tests/unit/banGates.test.ts` is a tripwire: no `import.meta` anywhere in the worklet-reachable graph (`src/audio/{core,dsp,timeline,protocol,worklet}`); no `console`, `for...of`, or allocating array combinators (`map`/`filter`/`forEach`/…) in the hot tree (`core`, `dsp`, `worklet`). No allocation inside `process()`.

### Layout of `src/audio`

- `core/` — the 2A03: `channels/` (pulse ×2, triangle, noise, dmc), `units/` (envelope, sweep, length/linear counters, LFSR, duty), `frameCounter`, non-linear `mixer` LUTs, post-DAC `filters`. Pure, DOM-free, deterministic.
- `dsp/` — fresh implementation of band-limited step synthesis (blip-style) + tone measurement.
- `timeline/` — the frozen `WriteSink` types + clock mapping.
- `protocol/` — SAB ring layout and postMessage protocol. Two transports chosen once at `startEngine()` (`sab` when crossOriginIsolated, else `postMessage`); both feed the same `drainUpTo` contract and render bit-identical audio.
- `worklet/` — `apu-processor.ts`, the AudioWorkletProcessor hosting the core.
- `host/` — main thread: `audioEngine` (EngineHandle, sole ring producer), `liveScheduler` (canonical note-on sequences, 3–25 ms adaptive lead), `pitch`, `paramMapping` (the single definition of what a knob means), `diagnostics`.
- `bridge.ts` — the only object the UI holds; owns engine + scheduler + analyser tap.

### The tracker (`src/tracker`)

- `model/` — song JSON v1: `types`, hand-written `validate` (no schema lib), `compile`, `commands` (unified command layer shared by all editors).
- `driver/` — `trackerDriver` + `tempo` (closed-form `cycleOfTick`, integer Bresenham row accumulator — FamiTracker-exact 6/6/5 row alternation), `macros`, `effects`, `registers` (write-on-change register images).
- `offlineRender.ts` + `wav.ts` — faster-than-realtime render through the *same* driver.

### Everything else

- `src/state/` — Svelte 5 runes stores (`*.svelte.ts`); `songModel.ts` is the plain-TS document. The rAF frame loop must not write `$state`.
- `src/ui/` — TE-styled shell; `canvas/` renderers (dot-matrix screen, pattern grid, meters); `tracker/` panel components. Pump order: `bridge.tick()` first in the app's single rAF; playback pump is `setInterval`, never rAF.
- `src/input/` — QWERTY, Web MIDI, tracker keys.
- `src/assets/songs/` — the preset registry is `import.meta.glob`: **register a song by adding `NN-name.json`** — no list to edit; two-digit prefix = album play order; a preset failing `parseSong()` fails `pnpm test`, not the build — vite only catches JSON syntax errors.
- `src/selftest.ts` — the headless gate harness described above.
- `tools/assets/` — Python asset regeneration (recipes in `ASSETS.md`); `tools/songs/makeDpcm.mjs` — synthesized DPCM bank.

### The five-tsconfig split (enforced discipline)

`pnpm typecheck` runs five isolated projects: **dsp** (core/dsp/timeline/protocol — `lib: ES2022`, `types: []`: no DOM, no Node possible), **worklet** (dsp + worklet dir + audioworklet types), **app** (DOM + svelte, *excludes* the worklet dir), **node** (vite configs), **test**. New core files must stay inside the dsp include set. `noUncheckedIndexedAccess` is off deliberately (D-C1).

### Vite specifics

- COOP/COEP headers on dev and preview → SAB fast path. Without headers the engine must still play via postMessage (selftest asserts this).
- The worklet module graph cannot HMR (`addModule` is one-shot) — a plugin in `vite.config.ts` forces a full reload on any change under `src/audio/{core,dsp,timeline,protocol,worklet}`.
- `build.target: chrome120`; worklet loads via `?worker&url` with a self-contained IIFE fallback.

## Code style guidelines

- TypeScript everywhere, ESM (`"type": "module"`). Svelte 5 runes for UI/state (`*.svelte.ts` stores).
- The DSP core (`src/audio/core`, `dsp`, `worklet`) is a real-time hot tree: deterministic, allocation-free in `process()`, no DOM, no Node, no `console`, no `for...of`, no allocating array combinators. `banGates.test.ts` enforces this mechanically — don't work around it.
- Make new code read like the code around it; the project favors hand-written, dependency-free implementations (e.g. song validation is hand-written, no schema lib).
- Match the register-timeline discipline when writing anything that produces APU writes: canonical register orders, side-effect register last, write-on-change.

## Testing instructions

- Everything DSP/tracker runs in node against the core directly (offline renders; DFT/analysis helpers in `tests/helpers/`) — no browser in `pnpm test`. Browser truths are the selftest harness's job.
- Golden traces pin FNV-1a checksums (`goldenTraces.test.ts`); update a checksum only with a spectral/audible justification.
- **Anti-vacuity is house style**: gates prove they can fail (aliasing asserts the naive renderer fails, perf gates floor their work counts, transport equivalence proves a lag breaks it). New gates should follow it.
- `tests/preview/` is inert without `PULSAR_PREVIEW=1` (use `pnpm preview:songs`); previews are the raw mix — no normalization or limiting.
- Perf gates live in `tests/bench/` (`pnpm bench`).

## Deviations ledger

`docs/deviations.md` — every deliberate divergence from hardware gets a `D-xx` id, a justification, and a test asserting the deviated behavior. If behavior looks wrong vs NESdev, check the ledger before "fixing" it. If you introduce a divergence, ledger it.

## Security and licensing considerations (these bite everyday work)

- The APU/DSP is a fresh implementation from public NESdev documentation. **Never read or port GPL tracker/emulator source** (FamiTracker, 0CC, Dn, Furnace) — and don't link LGPL blip_buf either; the project's MIT posture depends on that line holding. FamiStudio (MIT) docs are safe references.
- Preset music must be **original**. No transcribing/paraphrasing existing game music; no briefs or commit messages of the form "like the theme from X" (`docs/preset-suite.md` §0).
- Generated raster assets carry per-file model licenses with executable regeneration recipes (`ASSETS.md`). The app must remain functional and intentional-looking with all generated assets deleted.
- Do not imitate teenage engineering trademarks/trade dress — evoke the language, never clone a product; pulsar is unaffiliated.
- Do not add runtime dependencies (constraint K4).

## Doc map

- `docs/register-timeline.md` — the architecture doc; read first for any audio-path work
- `docs/phase2-design.md` — tracker design: song JSON v1 (§1), tempo (§2.3), macros/effects (§3), demo tracks + QA gates (§5), work packages with allowed/forbidden file sets (§WP)
- `docs/preset-suite.md` — style bible + composition rules for the album presets
- `docs/deviations.md` — the deviation ledger
- `ASSETS.md` — provenance + regeneration recipe for every generated raster
- `plan-file.md` — the approved implementation plan (phases, milestones, acceptance criteria)

## Deployment

Static site via `pnpm build` (runs typecheck first, outputs to `dist/`); `pnpm preview` serves the build at :4173 with COOP/COEP headers. Any static host works, but it **must** send the cross-origin-isolation headers (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin`) for the SAB fast path — without them the engine falls back to the postMessage transport. CI is `.github/workflows/pages.yml`: on every push to main it runs `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` → `vite build --base="/pulsar/"` and deploys `dist/` to GitHub Pages. Pages cannot send response headers, so the deployed app always runs the postMessage transport — the designed, tested fallback; the SAB fast path is dev/preview only. `pnpm typecheck` + `pnpm test` + the headless selftest are the acceptance gates.
