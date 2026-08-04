# Implementation Plan: "PULSAR" — A Teenage Engineering-Style Web Synth with FamiTracker-Accurate NES APU Audio

## TL;DR
- **Build the audio engine from scratch as a register-accurate NES 2A03 APU emulator running inside an AudioWorklet, using Blargg's band-limited synthesis (blip_buf/Blip_Buffer) approach for aliasing-free downsampling from the ~1.79 MHz APU clock to 48 kHz.** Do NOT compile FamiTracker/0CC/Dn (all GPL) into the app — port the public-domain register/DSP logic yourself against the NESdev Wiki to keep the codebase MIT/permissive and avoid GPL contamination.
- **Recommended stack: Vite + TypeScript + Svelte (or React) for UI; the DSP core written in Rust or C++ compiled to WASM/SIMD and run inside the worklet, or hand-written TypeScript for Phase 1.** Live-play and tracker share one deterministic register-write timeline. VRC6 is Phase 3 (linear mix, easy). WAV export via a faster-than-realtime WASM render loop, not OfflineAudioContext.
- **Critical constraint: Web MIDI is NOT supported in Safari on macOS or iOS — the app must target Chromium (Chrome 43+/Edge 79+) as the primary browser for the user's MacBook Pro M4 Pro, with a QWERTY-keyboard fallback for Safari/Firefox.** Cross-origin isolation headers (COOP/COEP) are mandatory for SharedArrayBuffer.

## Key Findings

### 1. Architecture decision: write the APU from scratch, don't port GPL code
- **FamiTracker (0.4.6), 0CC-FamiTracker, Dn-FamiTracker, and Furnace are all GPL** (FamiTracker/0CC/Dn are GPLv2; Furnace is GPLv2-or-later). Compiling any of their sound engines to WASM and shipping it would force the entire project under GPL. Avoid.
- **FamiStudio is MIT-licensed** (confirmed: `github.com/BleuBleu/FamiStudio/LICENSE`, "MIT License. Copyright (c) 2019 BleuBleu") and is the best *reference* for tracker/instrument behavior. Its NES emulation uses `NesSndEmu` (a C++ DLL descended from Blargg's Nes_Snd_Emu) plus `NotSoFatso`; the app itself is C#/.NET 8.0 desktop (Direct2D/XAudio2/PortAudio/RtMidi) — not directly portable to the browser, but its docs and sound-engine assembly are the gold-standard spec for tempo, instruments, and effect semantics.
- **Blargg's Nes_Snd_Emu / Blip_Buffer / blip_buf are LGPL.** LGPL permits use in a proprietary/MIT app *if dynamically linked or kept as a separable module*, but in a WASM bundle "dynamic linking" is murky. Safest path: **re-implement the tiny blip_buf band-limited-step algorithm from scratch** (it is well-documented and small) rather than linking the LGPL source, OR keep blip_buf as an isolated, separately-compiled WASM module and document the LGPL obligation. The register/channel logic (pulse/triangle/noise/DPCM) should be written fresh against the public-domain NESdev Wiki.
- **Existing web prior art to study (not depend on):** `dtinth/nes-apu-worklet` (NES APU as an AudioWorklet, MIT, based on takahirox/nes-js), `bfirsh/jsnes`, `angelo-wf/NesJs` (all 5 channels, but self-described as "not fully accurate"), `afska/nescore`. These prove the approach works in a worklet but none are register-accurate enough or expansion-capable for this project's authenticity bar.
- **Why band-limited synthesis is non-negotiable:** naive square-wave generation at 48 kHz aliases badly ("scratchy" sound, as noted by Blargg on the NESdev forums). Blargg's Blip_Buffer represents the waveform as a sum of band-limited steps: you clock the channels at the native ~1.79 MHz rate and record the exact NES-clock timestamps where each channel's amplitude changes; the library convolves each step with a band-limited impulse (BLEP) and decimates to 48 kHz. This is the technique NSFPlay, FamiStudio, and every accurate NES emulator use.

### 2. The exact APU non-linear mixing formula (authenticity-critical)
From the NESdev Wiki "APU Mixer" page (retrieved live, page last edited 19 January 2026; derived from Blargg's `apu_ref.txt`), the output is normalized 0.0–1.0 and is the sum of two non-linear groups:

```
output = pulse_out + tnd_out

               95.88
pulse_out = ---------------------------
             8128 / (pulse1 + pulse2) + 100

                            159.79
tnd_out = -----------------------------------------------------
           1 / ( triangle/8227 + noise/12241 + dmc/22638 ) + 100
```
Channel ranges: `pulse1, pulse2, triangle, noise = 0–15`; `dmc = 0–127`. When a group's inputs are all zero, treat that group's result as 0 (avoid divide-by-zero).

**Lookup-table implementation (recommended for speed):**
```
pulse_table[n]  = 95.52  / (8128.0  / n + 100)   // 31 entries
tnd_table[n]    = 163.67 / (24329.0 / n + 100)   // 203 entries; approximated "within 4%"
pulse_out = pulse_table[pulse1 + pulse2]
tnd_out   = tnd_table[3*triangle + 2*noise + dmc]
```
(Note the numerator 95.88 in the exact formula vs 95.52 in the lookup table — this is intentional; the lookup numerators are adjusted to preserve the normalized range. The `tnd_table` is documented as accurate to within 4%.)

**Linear approximation (acceptable fallback, slightly louder DMC):**
```
pulse_out = 0.00752 * (pulse1 + pulse2)
tnd_out   = 0.00851*triangle + 0.00494*noise + 0.00335*dmc
```

**Post-DAC analog filters** (apply after mixing for realism): first-order high-pass at 90 Hz, first-order high-pass at 440 Hz, first-order low-pass at 14 kHz (NES). The Famicom instead uses a single first-order high-pass at 37 Hz — expose as a "console model" toggle.

### 3. VRC6 mixing (Phase 3 — easy, linear)
From NESdev Wiki "VRC6 audio": *"At maximum volume, the pulse channels of the VRC6 are roughly equivalent to the pulse channels of the 2A03 (except inverted). The DAC of the VRC6, unlike the 2A03, appears to be linear. The final mix is a 6-bit DAC summing the two 4-bit pulse outputs and the high 5 bits of the saw accumulator."** VRC6 is mixed **linearly and added** to the APU's non-linear mix — do NOT put it through the non-linear tnd/pulse tables. Per NESdev forum thread t12449 verbatim ("The VRC6 is mixed independently of the APU and it is linear. Don't include it in the APU's nonlinear mix. Linear mix = addition"):
```
const VRC6_SCALE = APU_PULSE_STRENGTH / 15;   // APU_PULSE_STRENGTH = pulse_out for a full-on pulse
vrc6_mix = (vrc6_pulse1 + vrc6_pulse2 + vrc6_sawtooth) * VRC6_SCALE;
output = apu_mix + vrc6_mix;
```
VRC6 channel details: two pulses with **8 duty settings** (`$9000/$A000`, duty width bits), 12-bit period (`$9001-2 / $A001-2`), sawtooth with a 6-bit accumulator rate (`$B000-2`), a global frequency/halt register `$9003` (16×/256× octave shifts; 16× ignores the low 4 period bits, 256× ignores the low 8), and phase reset via clearing the enable bit in `$x002`. The VRC6 pulse duty is inverted relative to the 2A03 (inaudible unless layered). Note: two board variants (mapper 24 vs 26) swap A0/A1 lines — for a synth we only implement the mapper-24 register layout.

### 4. FamiTracker tick/speed/tempo model (must be exact)
- NES music drivers update once per video frame ("tick"): **60 Hz NTSC / 50 Hz PAL**. Everything (envelopes, effects, note delays) is measured in ticks.
- **Ticks-per-row = 2.5 × EngineSpeed × Speed / Tempo.** With default NTSC EngineSpeed=60, Tempo=150, Speed=6 → 2.5·60·6/150 = 6 ticks/row.
- **BPM = 24 × Tempo / (Speed × Rows-per-beat)** where rows-per-beat is the "1st row highlight" (default 4). Default 150 BPM = 24·150/(6·4).
- `Fxx`: `00–1F` sets Speed, `20–FF` sets Tempo (split point adjustable via Ctrl+Shift+S). When ticks-per-row is non-integer (e.g., between 6 and 7, as with tempos 128–150 BPM), FamiTracker alternates 6/7-tick rows, producing slight timing unevenness — replicate this exactly or offer an "even tempo" mode. EngineSpeed is user-settable up to 400 Hz for high-refresh tricks; Tempo must equal 2.5×EngineSpeed for the "speed = ticks/row" relationship to hold.
- Implementation: the tracker/sequencer runs a **tick scheduler** on the same NES-clock timeline the APU consumes. Each tick, the sequencer (a) advances envelopes/effects, (b) at row boundaries reads pattern data and issues register writes, (c) the APU consumes those writes at their exact timestamps. This keeps live-play and tracker playback bit-identical.

### 5. FamiTracker effects — priority tiers
The effect column uses `Nxx`/`Nxy` hex commands; up to 4 effect columns per channel. Prioritize:
- **Tier 1 (Phase 2 core):** `0xy` arpeggio, `1xx` pitch slide up, `2xx` pitch slide down, `3xx` automatic portamento, `4xy` vibrato (speed/depth), `Axy` volume slide, `Bxx` jump to frame, `Cxx` halt, `Dxx` skip to next frame at row xx, `Fxx` speed/tempo, `Gxx` note delay (ticks; if xx > speed, speed is used).
- **Tier 2 (Phase 2/3):** `7xy` tremolo, `Pxx` fine pitch, `Hxy`/`Ixy` hardware sweep up/down (pulse only), `Sxx` delayed cut (also controls tri length/linear counter), `Qxy`/`Rxy` note slide up/down, `Vxx` timbre/duty (and VRC6 volume-range hack), `Zxx` DPCM delta counter, `Exx` (deprecated volume — map to volume column).
- **Tier 3 (0CC/expansion, later):** `Lxx` delayed release, `Mxy` delayed volume, `Txy` delayed transpose, `EEx`/`Exx` hardware envelope / length-counter, FDS `Ixx/Jxx` modulation.

### 6. Instrument/macro (sequence) system
FamiTracker instruments are **not samples** — they are sequences ("macros") of hardware parameter values applied one-per-tick after a note triggers:
- **Volume macro** (0–15; VRC6 gets 0–63 via the duty/`V01` high-bit trick, where V01 adds 32 to the value and max useful value is 42 before the sawtooth accumulator wraps; FDS 0–32), **Arpeggio macro** (absolute / fixed / relative / *scheme* in 0CC — semitone offsets per tick), **Pitch macro** (relative: adds delta each tick; or absolute), **Hi-pitch**, **Duty/Noise macro** (pulse width or noise mode). Each macro has an optional loop point and release point. Sequences are shared by index across instruments (multiple instruments can reference the same volume/arp/pitch/duty sequence).
- Triangle has no volume-macro effect (always full). N163 instruments define up to 16 waves cycled via `V`/duty macro; FDS adds a 64-step wavetable + modulation table.

### 7. Web Audio / AudioWorklet best practices (2025–2026)
- **Do all synthesis in an `AudioWorkletProcessor`.** Per the W3C Web Audio spec, rendering is done in a fixed **render quantum of 128 sample-frames** — `process()` is called every 128 frames (~2.67 ms at 48 kHz, ~2.9 ms at 44.1 kHz). Never allocate inside `process()` (no `new Float32Array`), or the GC will cause dropouts; missing this deadline produces audible clicks.
- **Buffer-size mismatch:** the APU core naturally renders in NES-clock chunks; use a **WASM/SAB ring buffer** (padenot/ringbuf.js pattern, or Chrome's `wasm-ring-buffer` design pattern) to bridge the core's block size to the worklet's 128-frame callback. Chrome's official design pattern keeps the ring buffered (e.g., act only when ≥512 frames are available) to survive main-thread reflows — keep the ring roughly half-full for a safety margin.
- **SharedArrayBuffer requires cross-origin isolation:** serve with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Without these, SAB is unavailable and you must fall back to `postMessage`.
- **Parameter updates (knob turns, note-ons):** for low-latency live play, push into a lock-free SAB param queue (padenot's `param.js`) read by the worklet each block; use `postMessage` only for infrequent structural changes (load song, change chip).
- **Design pattern (recommended):** heavy tracker logic can live in a **Web Worker** (looser API, better Emscripten support, runs at lower priority than the audio render thread) that fills a SAB ring the worklet drains — Chrome's official "Audio Worklet + SharedArrayBuffer + Worker" pattern.
- **Emscripten** has a first-class **Wasm Audio Worklets API** (`emscripten_create_wasm_audio_worklet_node`, etc.) that runs C/C++ directly in the worklet with a runtime engineered to generate no JS-level garbage (no GC pauses) — the cleanest path if the core is C++. Rust via `wasm-bindgen` + manual worklet glue is the alternative.

### 8. WAV / audio export
- **OfflineAudioContext is a trap here:** it allocates the entire output AudioBuffer up front (gigabytes for long songs, as documented in Microsoft Edge's OfflineAudioContext explainer) and an AudioWorklet's timing in an offline context is awkward for a register-write emulator. Instead, **run the WASM APU core in a plain loop faster-than-realtime**, generating Float32 samples directly, then encode a 16-bit PCM WAV in JS and trigger a download. This is deterministic, fast (emulation is far cheaper than realtime), and gives sample-exact renders identical to live playback.

### 9. Web MIDI status (2026) — decisive for browser targeting
- **Chrome 43+, Edge 79+, Opera 30+, Samsung Internet 4+, and Firefox 108+ support Web MIDI; Safari (macOS and iOS) does NOT** — Apple/WebKit declined on fingerprinting grounds and no public WebKit implementation is tracked. Global support sits near 78%. The user's Mac runs macOS Tahoe, so **Safari cannot do MIDI**; recommend Chrome/Edge as the primary target.
- Web MIDI requires a **secure context (HTTPS)**, a permission prompt, and a separate `sysex: true` grant for SysEx. **Firefox (99+) gates it behind a manually-installed "site permission" add-on** — `navigator.requestMIDIAccess()` always fails (except on localhost) until the user installs it — so treat Firefox MIDI as best-effort, not guaranteed.
- **Fallback:** always provide a QWERTY computer-keyboard piano mapping (tracker-style: Z–M = lower octave, Q–P = upper) so the instrument is fully playable without MIDI or in Safari. Optionally use the `WEBMIDI.js` library to smooth over API quirks.

### 10. Teenage Engineering design language (specify tokens, don't copy trademarks)
TE's aesthetic = **brutalist minimalism**: near-white/gray industrial base palette with a single saturated accent per view, RAL-style primary accents mapped to geometric shapes (yellow=triangle, blue=square, red=circle), **monospaced/lowercase typography** (they use monospace exclusively and avoid capitalization for a "democratic" look), visible grid systems, segmented/dot-matrix displays, and tactile knob/encoder metaphors. Concrete tokens to hand Claude Code:
- **Neutrals:** `#ffffff`, `#d8d8d8`, `#a8a8a8`, `#484848`, `#181818`, `#000000` (measured from teenage.engineering).
- **Accents (use sparingly, one per screen):** blue `#1270b8`, green `#1aa167`, red `#ce2021`, yellow `#ffc003`, gray `#bdbdbd`.
- **Type:** a monospace face for all readouts/labels, lowercase; small caps avoided. Suggest `Space Mono`, `JetBrains Mono`, or a licensed grotesque — never TE's proprietary font.
- **Interaction:** drag-vertically-to-turn knobs (with fine mode on Shift), a small central "screen" that hosts parameter pages, physical-feeling key row, segmented value displays. Avoid TE product photos, logos, and exact enclosure copies (trademark/trade-dress risk) — evoke the *language*, don't clone a product.
- **Accessibility/responsive:** keyboard-operable knobs (arrow keys adjust value, ARIA `role="slider"` with `aria-valuenow`), respect `prefers-reduced-motion`, provide numeric readouts alongside every knob, ensure ≥4.5:1 text contrast (the light-gray palette needs care), and a responsive layout that reflows the keybed/screen/pattern-grid for narrower viewports (tracker grid stays desktop-first).

## Details

### Recommended architecture (text diagram)
```
┌──────────────────────────────────────────── main thread (UI) ────────────────────────────────────────────┐
│  Svelte/React + Vite + TS                                                                                  │
│   • TE-style UI: knobs, keys, screen, pattern grid (Canvas), order list                                    │
│   • Input: Web MIDI (Chromium) → note events; QWERTY fallback; pointer knob drag                           │
│   • State: song model (instruments, sequences, patterns, orders, effects) in a plain TS store              │
└───────────┬───────────────────────────────────────────────────────────┬───────────────────────────────────┘
            │ postMessage (structural: load song, change chip)           │ SAB param queue (note-on/off, knob)
            ▼                                                             ▼
┌──────────────── Web Worker (sequencer/driver, optional) ────────────┐  │
│  • FamiTracker tick scheduler (2.5·E·S/T ticks/row)                  │  │
│  • Runs instrument macros, effect state machines per channel        │  │
│  • Emits timestamped APU register writes → SAB command ring         │  │
└───────────┬─────────────────────────────────────────────────────────┘  │
            │ SAB ring (register writes + audio) │                        │
            ▼                                     ▼                        ▼
┌──────────────────────────── AudioWorkletProcessor (real-time) ─────────────────────────────┐
│  WASM (Rust/C++ via Emscripten Wasm Audio Worklets) OR TS for Phase 1                         │
│   • 2A03 APU: 2 pulse (duty/sweep/envelope/length), triangle (4-bit stepped + linear         │
│     counter), noise (2 LFSR modes), DPCM; frame counter (4/5-step)                            │
│   • Expansion slot: VRC6 (P3) → N163/FDS/MMC5/S5B/VRC7 (P4)                                    │
│   • Clocks channels at ~1.79 MHz; records amplitude-change timestamps                         │
│   • Blip-buffer band-limited synthesis → decimate to ctx.sampleRate (48 kHz)                  │
│   • Non-linear APU mix (tables) + linear VRC6 add + 3 HP/LP analog filters                     │
│   • process(): drain ring, output 128 frames, zero allocation                                  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```
The **single-timeline principle**: both live play and tracker playback ultimately produce the same stream of `(nes_cycle_timestamp, register, value)` writes into the APU core. Live play = writes generated by input events at "now"; tracker = writes generated by the tick scheduler. This guarantees the synth and the sequencer sound identical and makes WAV export trivial (run the same core in a loop).

### Chosen tech stack with rationale
- **Vite + TypeScript**: fast HMR, first-class worker/worklet/WASM handling, easy COOP/COEP dev-server headers.
- **UI framework — Svelte (primary rec) or React**: Svelte compiles to minimal runtime and its fine-grained reactivity suits many independent knob/meter widgets; React is fine if the team prefers it. Either way, **render the pattern editor and knobs on `<canvas>`**, not DOM — a scrolling tracker grid with dozens of rows × channels × cells will jank as DOM but scrolls at 60 fps on canvas with virtualized rows.
- **DSP core — two-stage:** Phase 1 in **hand-written TypeScript** inside the worklet (fastest to iterate, good enough for 2A03). If profiling on the M4 Pro shows headroom issues with expansion chips in Phase 3–4, port the core to **Rust or C++ → WASM+SIMD** via Emscripten Wasm Audio Worklets. Keeping the register interface identical makes this a drop-in swap.
- **No react-three-fiber / WebGL needed**; 2D canvas + CSS is sufficient and cheaper.

### Suggested repo structure
```
pulsar/
  index.html
  vite.config.ts            # sets COOP/COEP headers in dev + preview
  src/
    ui/                     # Svelte/React components: Knob, KeyBed, Screen, PatternGrid, OrderList
    ui/canvas/              # canvas renderers (pattern grid, meters, scopes)
    state/                  # song model, instruments, sequences, undo/redo
    input/midi.ts           # Web MIDI + permission flow
    input/keyboard.ts       # QWERTY fallback mapping
    audio/
      worklet/apu-processor.ts   # AudioWorkletProcessor entry
      core/                 # 2A03: pulse.ts triangle.ts noise.ts dpcm.ts frameCounter.ts mixer.ts
      core/expansion/       # vrc6.ts (P3), n163.ts fds.ts mmc5.ts s5b.ts vrc7.ts (P4)
      blip/                 # band-limited step synthesis (fresh implementation)
      ringbuf/              # SAB ring (SPSC) + param queue
    driver/                 # FamiTracker tick scheduler, effect state machines, macro engine
    io/                     # wavExport.ts, famistudioText.ts (P4), ftm.ts (P4, optional)
    design/tokens.ts        # TE color/type/spacing tokens
  wasm/                     # (P3+) Rust/C++ core + Emscripten build scripts
  public/
  tests/                    # golden-sample comparisons, tick-math unit tests, register traces
```

### Phased milestones & acceptance criteria

**Phase 1 — Core 2A03 APU in AudioWorklet + live-play UI (foundation)**
- Deliver: all five 2A03 channels register-accurate (2 pulse w/ 4 duties + sweep + envelope + length counter; triangle w/ 4-bit stepped output + linear counter; noise w/ both LFSR modes — 15-bit "long" and 6-bit-tap "short" periods; DPCM sample playback), frame counter (4-step & 5-step), non-linear mixer + analog filters, blip-buffer downsampling to 48 kHz. TE-style UI shell: keybed, ~4 knobs, screen, one instrument's parameters live-editable. QWERTY + (Chromium) MIDI note input.
- **Acceptance:** (a) A440 test tone measured within a few cents; (b) generate a register-write trace for a known pattern and compare rendered output spectrally against **NSFPlay/Mesen** output of the same writes — pulse/triangle/noise timbres match; (c) no audio dropouts over 10 min on the M4 Pro at 128-frame quantum; (d) live-play latency (key→sound) under ~15 ms in Chrome; (e) passes the *behavioral* expectations of blargg's APU test semantics (length-counter table values, duty phase-reset produces click-then-silence, triangle stops in phase rather than zeroing its DAC).

**Phase 2 — Tracker/sequencer + instruments + effects**
- Deliver: pattern editor (canvas grid), order/frame list, instrument editor with volume/arpeggio/pitch/hi-pitch/duty macros (loop + release points, shared-by-index), tick scheduler implementing `ticks/row = 2.5·E·S/T`, Tier-1 effects + most Tier-2, per-channel effect columns (up to 4). Step-record from MIDI/QWERTY. Save/load native JSON project format.
- **Acceptance:** (a) tempo math verified by unit tests against the formula (e.g., F150/Speed6 = 6 ticks/row = 150 BPM; BPM = 24·Tempo/(Speed·4)); (b) a 4-channel test song plays with correct arpeggios, slides, vibrato, volume slides, and frame jumps; (c) non-integer ticks-per-row reproduces FamiTracker's 6/7 alternation (or "even" mode toggle); (d) instrument macros audibly match FamiStudio/FamiTracker playback of an equivalent instrument; (e) pattern grid scrolls at 60 fps with 8 channels × 64 rows.

**Phase 3 — VRC6 + Web MIDI polish + WAV export**
- Deliver: VRC6 chip (2 pulses w/ 8 duties, sawtooth, `$9003` octave/halt), linear-add mixing, expansion-aware instrument macros and `Vxx` volume-range handling; robust Web MIDI (device hot-plug, permission UX, velocity→volume), MIDI step-record refinements; faster-than-realtime WASM/loop WAV export with download.
- **Acceptance:** (a) VRC6 sawtooth + pulses sound correct vs a Furnace/FamiTracker VRC6 reference (compare spectrally, not by code reuse); (b) VRC6 volume level ≈ 2A03 pulse at full scale; (c) exported WAV is bit-for-bit reproducible and sample-matches live playback of the same song; (d) MIDI works in Chrome/Edge with graceful "MIDI unavailable" messaging in Safari.

**Phase 4 — Additional expansion chips + interchange formats (stretch)**
- Ranked by browser-implementation difficulty (easiest→hardest): **MMC5** (2 extra pulses, ~2A03-like, easy) → **Sunsoft 5B** (3 square via AY-3-8910-style, envelope/noise, easy-moderate) → **FDS** (single 64-step wavetable + mod unit, moderate) → **Namco 163 / N163** (1–8 wavetable channels with time-multiplexed output artifacts, moderate-hard) → **VRC7** (2-op FM / YM2413-derived with fixed patches, hardest). Add interchange: start with **FamiStudio Text and FamiTracker Text** import/export (human-readable, documented, far easier than binary) and treat **binary FTM import** as optional last (block-based little-endian format; only a subset of effects survives — mirror FamiStudio's documented "supported subset," which covers 0xy/1xx/2xx/3xx/4xy/Axx/Bxx/Cxx/Dxx/Fxx speed-only/Sxx/Vxx/Zxx and a few chip-specific commands).
- **Acceptance:** each chip validated spectrally against a reference tracker's NSF/render (see `bbbradsmith/nes-audio-tests` relative-volume ROMs `db_vrc6`, `db_fds`, `db_mmc5`, `db_n163`, `db_5b`, `db_vrc7`); text-format round-trip preserves notes/instruments/effects within the documented supported subset.

### Performance targets (2024 MacBook Pro 16", M4 Pro, 24 GB)
- Audio quantum 128 frames → ~2.67 ms budget at 48 kHz; the full 2A03+VRC6 emulation with blip synthesis should use well under 10% of one core — the M4 Pro has ample headroom. Keep `process()` allocation-free.
- Ring buffer sized for ~100–150 ms of slack to survive main-thread reflows.
- UI: pattern grid on canvas with row virtualization, target 60 fps; decouple UI repaint (rAF) from audio entirely.
- Offer a 44.1 kHz vs 48 kHz option; 48 kHz matches most macOS output devices and avoids an extra resample.

### Key technical risks & mitigations
- **Aliasing / inauthentic timbre** → use band-limited step synthesis from day one; validate spectrally against NSFPlay/Mesen. Do not ship naive oscillators.
- **GPL contamination** → write APU/tracker logic fresh from NESdev + FamiStudio *docs*; never paste FamiTracker/0CC/Dn/Furnace source. Keep any LGPL blip code as a clearly separated module or reimplement it.
- **Timing jitter / dropouts** → zero-allocation `process()`, SAB ring with slack, sequencer in worker not main thread.
- **SAB unavailable (missing COOP/COEP)** → detect and fall back to postMessage; document the header requirement in deploy config.
- **Safari MIDI gap** → QWERTY fallback is a first-class feature, not an afterthought; show capability banner. Firefox MIDI requires a user-installed add-on — surface a clear prompt.
- **DPCM & non-linear mix subtleties** → implement the exact mixer tables; DPCM playback can duck triangle/noise volume (real hardware behavior) — replicate or document.
- **Scope creep across 6 expansion chips** → gate Phase 4 chips behind acceptance-tested milestones; VRC6 is the only committed expansion.

### Licensing guidance (summary)
- **Ship under MIT** (or similar). Permitted references/deps: FamiStudio docs & sound-engine spec (MIT), NESdev Wiki (public documentation), `dtinth/nes-apu-worklet` (MIT) for worklet plumbing patterns, `padenot/ringbuf.js` (permissive) for SAB ring.
- **Avoid linking:** FamiTracker/0CC/Dn/Furnace (GPL). **Handle carefully:** Blargg's Nes_Snd_Emu/Blip_Buffer/blip_buf (LGPL) — reimplement the algorithm or isolate as a separate LGPL module with attribution.

### Reference repos & docs for Claude Code to consult
- **NESdev Wiki:** APU, APU Pulse, APU Triangle, APU Noise, APU DPCM, APU Frame Counter, APU Mixer, VRC6 audio, plus per-chip pages (FDS, N163, MMC5, Sunsoft 5B, VRC7).
- **Blargg:** `slack.net/~ant/nes-emu/apu_ref.txt`, Blip_Buffer/blip_buf docs (`slack.net/~ant/libs/audio.html`), `bl-synth` band-limited synthesis writeup.
- **FamiTracker:** effects command reference, Fxx tempo page, instrument editor page; FamiStudio docs (sound engine, instruments, import) as the MIT-friendly spec.
- **Web platform:** MDN AudioWorklet & OfflineAudioContext; Chrome "Audio Worklet Design Pattern" + `web-audio-samples` (wasm-ring-buffer); Emscripten Wasm Audio Worklets API; `padenot/ringbuf.js`; MDN/caniuse Web MIDI.
- **Test/validation:** `christopherpow/nes-test-roms` (blargg APU tests), `bbbradsmith/nes-audio-tests` (relative-volume/expansion tests), `100thCoin/AccuracyCoin`, Mesen & NSFPlay as reference renderers.
- **Prior art to study:** `dtinth/nes-apu-worklet`, `bfirsh/jsnes`, `angelo-wf/NesJs`, `steffest/BassoonTracker` (web tracker UX), FamiStudio (MIT reference).

## Recommendations
1. **Start Phase 1 immediately in TypeScript-in-worklet**; get one register-accurate pulse channel + blip downsampling producing a clean A440 before adding channels. This de-risks the hardest authenticity question first.
2. **Lock the register-write timeline abstraction early** — every later feature (tracker, MIDI, export) plugs into it. If you get this interface right, live-play/tracker/export parity is free.
3. **Set up COOP/COEP headers and a SAB ring in Phase 1**, even if postMessage would suffice initially, so the architecture is ready for WASM and heavy expansion chips.
4. **Target Chrome/Edge first** given the Safari MIDI gap; ship the QWERTY fallback in Phase 1 so the app is never unplayable.
5. **Validate spectrally against Mesen/NSFPlay at each phase** rather than trusting the ear alone; keep golden register-trace fixtures in `tests/`.
6. **Decision thresholds:** if the TS core exceeds ~15% CPU with VRC6 active on the M4 Pro, or if Phase 4 chips stutter, port the core to Rust/C++ WASM+SIMD (interface unchanged). If a target audience needs Safari, invest in the QWERTY/OSC path rather than waiting on WebKit MIDI.
7. **Treat FTM binary import as the very last, optional item**; do FamiStudio/FamiTracker **text** interchange first — it captures the user's real need (moving songs in/out) at a fraction of the effort.

## Caveats
- **Emulation-accuracy claims must be validated, not assumed.** "Register-accurate" here means matching NESdev-documented behavior and spectral comparison to Mesen/NSFPlay; true cycle-perfect DMC/DMA edge cases (bus conflicts, `$4015` interactions) are unnecessary for a synth and explicitly out of scope.
- The **APU mixer constants** (95.88/8128/159.79/8227/12241/22638 and the lookup numerators 95.52/163.67/24329) are from the NESdev Wiki, itself derived from Blargg's hardware measurements — the wiki explicitly hedges the `tnd_table` as accurate "within 4%," so minor level differences vs a given emulator are expected and acceptable.
- **VRC6 behavior** is described on NESdev with cautious language ("appears to be linear," "roughly equivalent") reflecting measured rather than datasheet-guaranteed behavior.
- **Web MIDI support** is current as of 2026 research (near 78% global; Safari absent, Firefox add-on-gated). Apple could add it in a future Safari, but no public WebKit work is tracked — do not plan around it.
- Performance numbers for the M4 Pro are engineering estimates based on the lightness of APU emulation plus reported worklet budgets, not a benchmark on the specific machine; confirm with profiling in Phase 1.
- **Trademark/trade-dress:** Teenage Engineering's product designs and fonts are protected; this plan deliberately specifies *evoking* the design language with original tokens and a licensed monospace font, not reproducing any TE product or logo.