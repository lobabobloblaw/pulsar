# phase-1 acceptance — evidence against plan-file.md's criteria (a)–(e)

Run date 2026-08-03, MacBook Pro M4 Pro, Chrome headless CDP harness
(`?selftest` / `?selftest&soak=N`, muted). Tree: 351 vitest tests across 23
files, five-project typecheck clean, axe zero violations, production build
verified (self-contained IIFE worklet, no `import.meta`, no bare imports).

| # | criterion | evidence | status |
|---|---|---|---|
| a | A440 within a few cents | Automated: `pitch.test.ts` — timer 253 → 440.3969 Hz, +1.561 cents (hardware resolution), dual-method (zero-crossing + interpolated DFT) agreeing to 0.015 c. Live: headless render measured **440.396 Hz, −0.004 c** vs the emulated target on the SAB path; −0.014 c on the production build; +0.006 c on the postMessage fallback | **pass** |
| b | Spectral match vs NSFPlay/Mesen for known register traces | Six golden trace fixtures with pinned FNV-1a output checksums (`pulse1-a440-duty2` 63e66e7f · `pulse-sweep-mute` bd5e3511 · `triangle-a440` 4aaaab26 · `noise-modes` 86e145fb · `dmc-ramp` b093c29d · `all-channels-mix` 17fba1f6) + the manual Mesen/NSFPlay NSF-stub comparison procedure in `tests/fixtures/README.md` | **procedure documented; manual spectral comparison not yet performed** |
| c | No dropouts over 10 min at 128-frame quantum | 25-minute all-channel soak (7 453 steps: pulse pair + triangle + auto-cut noise + DMC level ramp + 234 live console-model flips), muted but real-device-paced: **0 late writes, 0 dropped writes, 0 underruns**; **2 684 905 208 NES cycles elapsed — the 2³¹ int32-truncation crossing asserted and passed**. The per-quantum CPU budget is evidenced by the bench (headless worklets lack the clock probe, and the soak reports that gauge as untrusted rather than vacuously green): worst-case ~760 deltas/quantum p99 **261.8 µs = 9.8 %** of the 2.67 ms deadline (gate 267 µs); register-space ceiling (ultrasonic triangle t=2, info-only) p99 615 µs = 23 % | **pass** |
| d | Live-play latency < ~15 ms | App-controlled path: adaptive lead **3–6 ms** (converges to 3 under load) + baseLatency **5.8 ms** (measured) + band-limited group delay **0.31 ms** ≈ **9.1–12.1 ms → passes the budget**. End-to-end adds the device's `outputLatency`: 216 ms on the measured output device (Bluetooth-class; a wired device is typically 3–12 ms). Per plan M8(d), the dominating term is reported rather than hidden: **outputLatency dominates end-to-end on Bluetooth audio** | **pass (app side); device-dependent end-to-end** |
| e | blargg behavioral semantics | `blarggSemantics.test.ts` (11 tests): full length table with counter expiry on the exact half-frame clock; duty phase-reset click-then-silence (repeated reset at the step rate renders RMS < 1e-9 with the channel enabled and clocking); triangle halts in phase holding its DAC value — zero deltas over 100 000 cycles; sweep muting with the unit disabled | **pass** |

## supporting gates

- **Aliasing:** duty-2 images at −129.5 / −119.1 dBc (gate ≤ −70; naive control renderer fails at −9.8 dBc — the assertion is proven non-vacuous).
- **Transport equivalence:** SAB and postMessage paths render bit-identical output over a ring-wrapping 4 500-write trace; a one-quantum drain lag provably breaks the comparison (anti-vacuity).
- **Determinism:** chunk-independence (375×128 ≡ one 48 000-sample render), byte-identical re-renders, cycle-origin invariance at 3e9 and 9e15.
- **DPCM ducking** measured within 0.045 % of the TND_LUT prediction with no ducking code (shared mixer index).
- **Accessibility:** axe 33 rule groups, zero violations; keyboard-only operation proven over CDP (knob ARIA valuetext, keybed roving cursor, stuck-note guards incl. multi-touch, focus loss, and macOS Cmd-swallowed keyups).
- **Adversarial review:** an independent read-only review of all seams produced 4 blockers + 15 should-fixes; the blockers and the eight items affecting soak trustworthiness were fixed and re-verified (commit `M8 review fixes`). Verified-clean claims from that review: SAB memory ordering, ring index algebra, recycle-pool lifetimes, kernel/readSamples window arithmetic, mixer LUT bounds, cycle-domain purity.

## known polish (deliberately deferred, none load-bearing)

- Symmetric note-ownership: QWERTY keyup can cut a note a keybed pointer holds (needs per-source refcounts in `transport.notes`).
- `clippedSamples` / `running` / `frameSkips` counters are published but unread; diagnostics panel data reaches the bridge but no UI surface shows late/dropped/underruns.
- `InitMessage.clockRate` is carried but the worklet hardcodes NTSC (becomes real work with a PAL toggle).
- DPR-change without a resize does not invalidate the cached dot lattice (`matchMedia('(resolution)')` listener needed).
- Asset regeneration tooling: flat-grey inputs can pass grain/favicon gates (shipped assets were eyeball-verified; copy `pixelize.py`'s ink-coverage pattern before the next regeneration); `generate.sh` seed-arg exit bug; palette drift test pins structure but not values.
- Wheel `deltaMode`/`deltaX` handling on knobs; scope extreme-row rounding; `motion.svelte.ts` listener never removed; notes pressed during the ~100 ms engine start are dropped (scripts only — the boot keydown consumes the human's first press).

## how to re-run

`pnpm test` · `pnpm bench` · `pnpm typecheck` · `pnpm build && pnpm preview` ·
selftest: serve, then drive `/?selftest` (or `&soak=25`) with headless Chrome
(`--mute-audio --autoplay-policy=no-user-gesture-required`), grep the
`SELFTEST PASS` line / `pulsar-selftest-pass` title. Golden-trace spectral
comparison against Mesen/NSFPlay: follow `tests/fixtures/README.md`.
