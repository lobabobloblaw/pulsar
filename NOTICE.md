# provenance notice

pulsar's NES 2A03 APU emulation and band-limited synthesis are original
implementations written against publicly documented behavior:

- **NESdev Wiki** (public documentation): APU, APU Pulse, APU Triangle, APU Noise,
  APU DMC, APU Frame Counter, APU Length Counter, APU Sweep, APU Mixer.
- The band-limited-step synthesis in `src/audio/dsp/` is a fresh implementation of
  the well-known windowed-sinc band-limited step technique. **No GPL or LGPL source
  code was consulted or copied** (no FamiTracker, 0CC, Dn, Furnace, Nes_Snd_Emu,
  Blip_Buffer, or blip_buf source).
- FamiStudio's MIT-licensed documentation is used as a behavioral reference for
  tracker semantics in later phases.

The eight preset songs in `src/assets/songs/` are original compositions authored
by Codex for pulsar in September 2026. Their tracker notes, arrangements and custom
instrument envelopes were written directly; no existing game melodies, ROM audio,
recordings, or hosted music-generation services were used. Pocket Voltage, Razor
Rally and Breakwater reuse pulsar’s original arithmetic DPCM percussion bank (reproducible with
`tools/songs/makeDpcm.mjs`). The previous eighteen presets are retired from the app;
their source history remains in Git. Composition notes: `docs/soundtrack.md`.

Generated image assets are documented per-file in `ASSETS.md`, including the exact
model checkpoint, license, seed, prompt, and post-processing chain for each.

pulsar is not a Teenage Engineering product and is not affiliated with
Teenage Engineering. The UI evokes a general industrial-minimal design language
with original tokens; no TE fonts, logos, or product artwork are used.
