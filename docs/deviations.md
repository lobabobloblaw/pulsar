# documented deviations from hardware / references

Every entry is a deliberate, justified divergence decided at design time.
Nothing here is a bug discovered later. Tests assert the deviated behavior.

| id | deviation | justification |
|---|---|---|
| D-T1 | Triangle at timer `t < 2`: sequencer frozen, output held at 7 (hardware runs the sequencer at 55.9 kHz+ and the DAC averages ~7.5) | Inaudible; the 90/440 Hz high-passes remove the DC; caps a pathological ~4 772-events-per-quantum path |
| D-D1 | No DMC DMA cycle stealing | There is no CPU to stall |
| D-D2 | No IRQ delivery; `$4015` flags maintained for read-back only | No CPU to interrupt |
| D-F1 | `$4017` write delay = 3 or 4 cycles chosen by write-cycle parity | Inaudible; the parity convention differs between emulators |
| D-M1 | `TND_LUT` accurate to 4.66 % at index 1 vs the exact formula | NESdev's own "within 4 %" hedge; < 1 % at musical levels |
| D-M2 | `PULSE_LUT` is a constant −0.375 % vs the exact formula | Intentional renormalization so `PULSE_LUT[30] + TND_LUT[202] ≈ 1.0` |
| D-B1 | Fixed-point rate factor −1.97 ppm at 48 kHz (112 487 vs 112 487.22) | −0.0034 cents, ~400× under the ±3-cent acceptance threshold |
| D-B2 | Band-limited step group delay = 15 output samples (0.31 ms) | Inherent to a symmetric FIR; counted in the latency budget |
| D-C1 | `noUncheckedIndexedAccess: false` in the DSP tsconfig | Typed-array DSP would need `!` on every line for no real safety on fixed-size tables; bounds are covered by unit tests |
| D-U1 | Knobs render as SVG, not canvas (plan-file §10 suggested canvas) | Four knobs animate one compositor-only transform each; canvas costs DPR/hit-testing/ARIA by hand. Revisit if > 24 simultaneous knobs |
| D-P1 | A silent pulse channel (disabled, length 0, or sweep-muted) FREEZES its timer divider instead of counting on, and restarts it at the unmute cycle | Exactness is unattainable anyway — the sweep unit can rewrite the period on any half-frame clock while muted, so "catching up" would only be right in the constant-period case. The cost is a duty-phase offset at unmute, on a square wave, where phase is inaudible; `$4003`/`$4007` resets that phase deliberately in any case. In exchange a muted channel advertises `nextCycle = Infinity` and contributes literally nothing to the run loop's min scan, which is what keeps the worst case bounded |
| D-P2 | The noise LFSR is frozen while the length counter is 0 | At period index 0 the LFSR clocks every 4 CPU cycles (447 kHz ≈ 1 200 events per quantum) for a channel contributing nothing. The only observable difference is which point of a pseudo-random sequence the next note starts from |
| D-P3 | An idle DMC output unit is frozen rather than clocked, and `$4015` bit 4 restarts a finished sample by starting its output cycle immediately instead of waiting up to 8 output clocks for the bit counter to reload | Same min-scan argument as D-P1/D-P2. The restart latency on hardware is 0–8 output periods depending on where in the byte the write lands (up to 3.4 ms, and nondeterministic); starting immediately makes live DPCM triggering deterministic and removes an audible attack delay |
| D-P4 | `$4001`/`$4005` power up as `0x08` (negate set, shift 0 — "sweep off") rather than hardware's `0x00` | With `0x00` the sweep target is twice the period, so every note below A1 (timer ≥ 0x400) would be muted until the host wrote the register. `0x08` is what every tracker writes and what plan B6's canonical note-on uses; the muting rules themselves are unchanged and fully asserted in `sweep.test.ts` |
| D-S1 | TypeScript pinned to 6.x, not 7.x | svelte-check 4.7.4 peer-accepts `^5 || ^6` only; nothing in the build needs TS 7 |
