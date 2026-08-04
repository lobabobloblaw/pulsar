# the register-write timeline — pulsar's one interface

Everything in pulsar reduces to a stream of timestamped APU register writes:

```
(cycle: NesCycle, addr: RegAddr, value: byte)
```

- `NesCycle` — NES CPU cycles since engine start, integer-valued, stored as a
  **double**. `t = 0` is the first output sample frame the worklet renders.
  Bitwise ops (`|0`, `<<`, `>>`, `&`) are banned on cycle values: int32 wraps at
  2³¹ cycles ≈ 20 minutes of audio.
- `RegAddr` — `0x4000..0x4017`.
- Wire encoding — 16 bits: `(addr & 0x1f) << 8 | value`.

The canonical source is `src/audio/timeline/types.ts` (`WriteSink`). **Changes to
that file are breaking changes** to every producer and must be mirrored here.

## producers (one per phase, same consumer forever)

| producer | phase | computes `cycle` as |
|---|---|---|
| `LiveScheduler` (key / knob / MIDI) | 1 | `nowCycle() + lead` (default lead 6 ms = 10 739 cycles; adaptive 3–25 ms) |
| tracker tick scheduler | 2 | `tickIndex × cyclesPerTick`, integer accumulator (FamiTracker: ticks/row = 2.5·E·S/T) |
| WAV export driver | 3 | same producer as playback, run faster than realtime |

One consumer: `Apu2A03.write(cycle, addr, value)`. Late writes (cycle <
`apu.cycle`) are **clamped to now and counted** (`stats.lateWrites`), never
dropped and never reordered — order on the wire is order applied.

## why this is sacred

Live play, tracker playback, and WAV export all funnel through the same stream,
so they are bit-identical by construction. The Phase-2 tracker and Phase-3
exporter plug in without touching the core.

## canonical note-on (all writes at the same target cycle)

1. `$4015 |= channelBit` — enable the length counter first
2. `$4000` `DDLC VVVV` — duty, halt, constant-volume, volume
3. `$4001` `EPPP NSSS` — sweep (`0x08` = disabled)
4. `$4002` — timer low
5. `$4003` `LLLL LHHH` — **last**: latches timer high, loads length counter,
   resets the duty sequencer step, restarts the envelope

Note-off: clear the channel's `$4015` bit (authentic hard cut; the 90/440 Hz
high-passes absorb the step).

The same discipline for the other channels (the register whose write has side
effects — length load / phase latch / restart — always comes LAST):

- **triangle** — `$4015 |= 0x04` → `$4008` (`CRRR RRRR`, bit 7 set to sustain) →
  `$400A` timer low → **`$400B` last** (timer high + length load + linear-counter
  reload flag). A fresh triangle note is silent until the next quarter-frame clock
  (≤ 4.17 ms) — that reload latency is the hardware's soft attack.
- **noise** — `$4015 |= 0x08` → `$400C` (halt/const-vol/volume) → `$400E`
  (mode + period index) → **`$400F` last** (length load + envelope restart).
- **dmc** — `$4011` (direct level) → `$4010` (IRQ/loop/rate) → `$4012` addr →
  `$4013` length → **`$4015 |= 0x10` last** (starts the sample only if
  `bytesRemaining === 0`).

`src/audio/host/liveScheduler.ts` owns these sequences (`writePulseNoteOn`,
`writeNoteOff`, `writePulseControl`, `writePulseSweep`) — the `$4015` argument is
the whole enable byte, never a single bit, so adding a channel cannot silence the
others.

## how a write crosses threads

Two transports, chosen once at `startEngine()` and reported truthfully as
`engine.transport`. Both feed the same `drainUpTo(limitCycle, sink)` contract, so
everything downstream of the queue is identical and the two paths render
bit-identical audio (`tests/unit/writeRing.test.ts`).

| | `sab` | `postMessage` |
|---|---|---|
| when | `crossOriginIsolated === true` and `SharedArrayBuffer` exists | anything else |
| queue | `RingProducer` → SAB → `RingConsumer` | pooled `Float64Array`/`Int32Array` pair → `LocalWriteRing` |
| `flush()` | no-op (the release store already published it) | transfers the batch; the worklet transfers it back via `recycle` |
| diagnostics | `Atomics.load` of the ring header, on demand | `stats` message at ~10 Hz |

SAB layout (`src/audio/protocol/layout.ts`), 49 408 bytes: an Int32 header with
`MAGIC 'PUL1'`/`VERSION`/`CAPACITY 4096`/`SAMPLE_RATE`, then `writeIndex` @64 and
`readIndex` @128 on separate cache lines, counters (dropped, late, underruns,
peakProcessNs, clipped, running) @192, `Float64 cycles[4096]` @256 and
`Int32 codes[4096]` @33024.

Ring indices live in `[0, 2·CAPACITY)` so full and empty are distinguishable
without a count; `& IDX_MASK`/`& SLOT_MASK` apply to **indices**, never to cycle
values. A full ring drops the write and counts it (`droppedWrites`) rather than
blocking or overwriting: dropping is visible, corruption is not.

The consumer stops at the first write past the frame's limit, so the producer must
push in non-decreasing cycle order. `LiveScheduler` guarantees that with a
monotonic clamp — an adaptive lead that shrinks between two key presses would
otherwise emit an earlier cycle than the write already queued.

## adaptive lead

Default 6 ms (10 739 NTSC cycles), bounds 3–25 ms. Every 2 s: any new late write
since the last check → **+2 ms**; a clean interval → **−0.5 ms**. Back off fast,
recover slowly — a lead that oscillates is worse than one that is 1 ms too long.
The current value is reported in `engine.diagnostics().leadMs`.

## how the bridge maps knobs onto registers (M7)

`src/audio/bridge.ts` is the only thing the UI holds. It owns an `EngineHandle`, a
`LiveScheduler` and an `AnalyserNode` tap, and it is where native parameter values
become register writes. The arithmetic itself lives in
`src/audio/host/paramMapping.ts` — pure, DOM-free, and imported by both the bridge
and the scheduler so there is exactly one definition of what a knob means
(`tests/unit/bridgeMapping.test.ts`).

| knob (native units) | register | byte | notes |
|---|---|---|---|
| `pulse1.duty` 0–3 | `$4000` | `DDLC VVVV`, `D` = duty | written **alone** on a held note — no `$4003`, so the sequencer phase never resets |
| `pulse1.envDecay` 0–15 | `$4000` | same byte's `VVVV` | constant-volume mode (`C` = 1): the nibble is pulse1's **level**, scaled by velocity |
| `pulse1.sweep` −7…+7 | `$4001` | `EPPP NSSS` | `0` → the canonical off byte `0x08`; `±n` → enabled, divider period 3, shift `|n|`, negate set for positive (a smaller period is a higher note) |
| `master.volume` 0–1 | — | — | not a register: `masterGain = 2.0 · v²` via the `config` message. The exp taper the registry declares is applied here, once — `paramFraction` keeps the knob's travel linear on purpose |

No parameter writes `$4002`, `$4003` or `$4015`, which is what makes every knob
live: turning one under a held key changes the sound without retriggering the note.

**Why `pulse1.envDecay` is a level and not an envelope period.** `$4000`'s `VVVV`
nibble is dual-purpose — constant volume with `C` = 1, hardware envelope period with
`C` = 0. Live play needs `C` = 1: the envelope always restarts at 15, so a `C` = 0
mapping would throw away velocity, and sustaining a held key needs the halt bit
`L` = 1, which is also the envelope's *loop* flag (a repeating sawtooth tremolo, not
a decay). `C` = 0 with `L` = 0 does decay once, but then the length counter cuts the
note after at most ~2.1 s. The parameter therefore keeps its `pulse1.envDecay` id
and reads `level` on the enclosure. A real per-note envelope belongs to the Phase-2
instrument macro engine, where it can have its own release point.

**Meter and scope.** One `AnalyserNode` (`fftSize` 512) hangs off the worklet node.
`bridge.tick(now)`, pumped first in the app's single rAF, copies the window into one
preallocated staging array, reduces it to rms/peak in `meter[0..3]`, and hands the
newest 256 samples to `scope`. Nothing there allocates, and the arrays are created
once at `start()`. Diagnostics are polled on a bridge-internal 10 Hz timer — the
frame loop must not write `$state` — and republished as a `BridgeStatus` only when a
field the chips show actually moves.

**URL flags.** `?stub` returns the synthetic bridge (the shell with no audio thread);
`?pm` forces `startEngine({ forcePostMessage: true })`, which exercises the fallback
transport without touching COOP/COEP headers.
