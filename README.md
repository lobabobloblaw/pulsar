# pulsar

a teenage-engineering-flavored web synthesizer with a register-accurate NES 2A03
APU as its voice — band-limited synthesis in an AudioWorklet, played live from
your keyboard or MIDI, growing into a FamiTracker-compatible tracker.

![pulsar — an imagined nes-apu synthesizer](docs/img/hero.png)

> concept render. generated locally with Krea 2 Turbo (seed 810, 8 steps, cfg 1, 1344×768).
> the krea-2-community-license applies to this image — see [ASSETS.md](ASSETS.md). **pulsar is
> not a teenage engineering product and is not affiliated with them.**

## status

phase 1 in progress: the 2A03 core (2 pulse, triangle, noise, DPCM), a
TE-styled live-play shell, QWERTY + Web MIDI input. later phases per
`plan-file.md`: tracker + FamiTracker-exact tick model, VRC6, WAV export,
expansion chips, FamiTracker/FamiStudio text interchange.

## run

```bash
pnpm install
pnpm dev        # http://localhost:5173 — served cross-origin-isolated
pnpm test       # vitest: DSP, mixer, pitch, aliasing suites
pnpm typecheck  # five isolated TS projects + svelte-check
pnpm build && pnpm preview
```

chrome/edge are the primary targets (web midi). safari plays via the computer
keyboard — z–m lower octave, q–p upper.

## architecture in one breath

everything is a stream of `(nes_cycle, register, value)` writes — live keys,
the future tracker, and WAV export all produce the same stream, and one
worklet-hosted APU core consumes it (`docs/register-timeline.md`). the core
clocks channels at 1.789773 MHz and downsamples through a fresh implementation
of band-limited step synthesis. deliberate divergences from hardware are
ledgered in `docs/deviations.md`.

## licensing

MIT (see `LICENSE`). the APU and DSP are original implementations written
against public NESdev documentation — no GPL/LGPL emulator source was consulted
(`NOTICE.md`). generated images carry their own model licenses, documented
per-file in `ASSETS.md`.

pulsar is not a teenage engineering product and is not affiliated with them.
