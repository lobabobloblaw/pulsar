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
