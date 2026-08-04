# golden register traces

Six fixtures under `traces/`, each a pair:

- `<name>.trace` — a plain-text register timeline (format v1, below)
- `<name>.meta.json` — the expectations, plus any DPCM sample data

`tests/unit/goldenTraces.test.ts` parses both, renders the trace through the shipped
signal path, and asserts (a) the sidecar's expectations and (b) an inline output
checksum. **No audio is stored in the repo.** A `.wav` would be unreviewable in a diff
and would have to be regenerated every time the band-limited kernel is touched; a trace
plus an expected fundamental is readable, portable, and — the point of the format —
mechanically convertible into a 6502 stub that Mesen or NSFPlay can play back.

## trace format v1

```
# pulsar-trace v1
# clockRate=1789773 region=ntsc
# free-form comment lines are allowed anywhere
0        4015 0F
0        4000 BF
894886   400E 84
# END 1789773
```

- Row = `<cycle> <address-hex> <value-hex>`, whitespace-separated. The cycle is a CPU
  cycle on the same timeline the engine uses; addresses are `4000`–`4017` without the
  `$`; values are two hex digits.
- Rows MUST be chronological. The parser rejects out-of-order rows, addresses outside
  the APU block, and values above `FF`.
- `# END <cycle>` is required and gives the render length in CPU cycles.
- `clockRate` and `region` come off the second header line; both default to NTSC.

## meta sidecar

```json
{
  "clockRate": 1789773,
  "sampleRate": 48000,
  "durationCycles": 1789773,
  "dpcm": { "address": 49152, "runs": [[255, 16], [0, 17]] },
  "expect": { "fundamentalHz": 440.3969, "toleranceCents": 3, "rmsMin": 0.1 },
  "reference": { "renderer": "pulsar", "notes": "…" }
}
```

`dpcm.runs` is a run-length list of `[byte, count]` pairs written at `dpcm.address`
(decimal) inside the 32 KiB `$8000–$FFFF` window — traces carry register writes only,
never sample payloads. `expect` is a bag of assertions interpreted per fixture; the
keys in use are `fundamentalHz` / `toleranceCents`, `rmsMin`, `peakMax`,
`clippedSamplesMax`, `silentAfterCycle`, `thirdHarmonicDbcMax`, and the noise fixture's
`shortModeFundamentalHz` / `shortModeToleranceCents` / `shortModeAfterCycle`.

## the fixtures

| fixture | what it pins |
|---|---|
| `pulse1-a440-duty2` | the M2 vertical slice: timer 253 → 440.3969 Hz, +1.561 cents |
| `pulse-sweep-mute` | a rising sweep muting itself when the target passes `$7FF`, permanently |
| `triangle-a440` | timer 126 → the same 440.3969 Hz off a ÷32 divider; third harmonic ≈ 1/9 |
| `noise-modes` | long mode (period 32767) for half a second, then short mode (period 93 → a 300.7 Hz tone) |
| `dmc-ramp` | a looping 33-byte DPCM sample, ±2 delta steps with the level clamped at both ends |
| `all-channels-mix` | all five channels through the non-linear mixer, including DPCM ducking the triangle and noise |

## checksums

The inline snapshots hash samples quantised to 1e-6 (`Math.round(x * 1e6)`, FNV-1a).
That is tight enough to catch any real change in the engine and loose enough to survive
last-bit differences in `Math.sin`/`Math.exp` between platforms. A changed checksum with
the behavioural assertions still passing means the output moved by less than a cent and
more than a microunit — review the diff, then update with `pnpm exec vitest run
tests/unit/goldenTraces.test.ts -u`. A changed checksum WITH a failed expectation is a
regression, not a snapshot to refresh.

## manual comparison against Mesen / NSFPlay

Automated spectral comparison against another emulator is not in the repo: it would mean
shipping either their binaries or their audio output. The procedure below is the
documented manual gate for plan-file Phase-1 acceptance item (b). Run it when the APU
core changes materially — not on every commit.

### 1. turn a trace into a playable NSF

Each row becomes a store, and the gaps become delays. A minimal NSF is a 128-byte header
plus 6502 code; the shape of the INIT/PLAY routines:

```asm
; INIT: silence everything, then run the trace from the top
    lda #$00
    sta $4015
    lda #$40          ; frame counter: 4-step, IRQ inhibited
    sta $4017
    ...
; PLAY (called once per frame, 29780 CPU cycles):
;   emit the writes whose cycle falls in this frame, padding with NOPs so each
;   store lands within ±10 cycles of its trace timestamp
    lda #$BF
    sta $4000
    ...
    rts
```

Frame-accurate is enough for every fixture here: the only sub-frame-critical write in the
set is `pulse-sweep-mute`, whose mute lands on the half-frame clock at cycle 14913 and is
therefore insensitive to a few cycles either way. If a future fixture needs cycle-exact
placement, drive it from an IRQ instead of the PLAY hook.

Header fields that matter: load address `$8000`, INIT/PLAY as above, NTSC speed `$411A`
(16666 µs), and — for `dmc-ramp` and `all-channels-mix` — the sample bytes from
`meta.dpcm` assembled at `$C000`.

### 2. render the same trace with pulsar

```
pnpm exec vitest run tests/unit/goldenTraces.test.ts
```

To get a `.wav` out for listening, render the fixture with `renderWith(...)` from
`tests/helpers/renderTrace.ts` and write the `Float32Array` out as 32-bit float PCM. Keep
the file out of the repo.

### 3. compare

- **Mesen**: Debug → Audio Player, or the built-in NSF player. `Audio Options → Sample
  Rate 48000`, all channels enabled, no filters beyond the console model you are
  comparing against. Record with the built-in WAV export.
- **NSFPlay**: use the `Quality` preset with the non-linear mixer ON (`Options → Sound →
  APU Mixer`), 48 kHz, and export to WAV. NSFPlay's default is the same non-linear
  formula this engine uses, so absolute levels should agree within a few tenths of a dB.

Then, on the two WAVs:

1. **Pitch** — measure the fundamental of each with the same estimator (Audacity's
   `Analyze → Plot Spectrum`, or `zeroCrossingHz` from `tests/helpers/analysis.ts`). They
   must agree within 3 cents. A larger gap means a timer-divider or clock-rate error.
2. **Timbre** — overlay the magnitude spectra (log frequency, 4096-point Blackman-Harris).
   Harmonic *positions* must match exactly; harmonic *amplitudes* within ~1 dB up to
   10 kHz. A tilted difference is the analog filter chain (90/440 Hz high-pass, 14 kHz
   low-pass), not the synthesis.
3. **Alias floor** — pulsar's band-limited synthesis should show a LOWER noise floor
   between harmonics than either reference at the same settings (both use naive or
   lightly-filtered synthesis by default). Images above the Nyquist reflection points
   should be ≥ 70 dB down; that claim is also asserted automatically in
   `tests/unit/aliasing.test.ts`.
4. **Level** — RMS over a steady second within 0.5 dB after matching master gain. The
   documented `PULSE_LUT` renormalisation (−0.375 %, deviation D-M2) is well inside that.

Record the outcome — date, emulator versions, and the four numbers — in the PR that
prompted the comparison. There is deliberately no script for this: the value is in a
human listening to both files back to back.
