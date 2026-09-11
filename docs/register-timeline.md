# the register-write timeline — pulsar's one interface

Everything in pulsar reduces to a stream of timestamped APU register writes:

```
(cycle: NesCycle, addr: RegAddr, value: byte)
```

- `NesCycle` — NES CPU cycles since engine start, integer-valued, stored as a
  **double**. `t = 0` is the first output sample frame the worklet renders.
  Bitwise ops (`|0`, `<<`, `>>`, `&`) are banned on cycle values: int32 wraps at
  2³¹ cycles ≈ 20 minutes of audio.
- `RegAddr` — the 2A03 block `0x4000..0x4017`, plus the VRC6 expansion block
  `0x9000..0x9003 | 0xA000..0xA002 | 0xB000..0xB002`. Any other address is ordered,
  timestamped and counted like the 2A03's unused registers, but changes nothing.
- Wire encoding — 24 bits: `(addr & 0xffff) << 8 | value`. The WHOLE 16-bit address
  travels, because the VRC6 does not live in the `$4000 + offset` page the original
  five-bit field assumed; the widest code is `0xffffff`, so an Int32 slot on either
  transport still carries a write without truncation. `RING_VERSION` is **2**: a stale
  worklet chunk holding the v1 decoder must refuse the ring rather than fold `$9002`,
  `$A002` and `$B002` onto `$4002` and detune pulse 1
  (`tests/unit/writeRing.test.ts`).

The canonical source is `src/audio/timeline/types.ts` (`WriteSink`). **Changes to
that file are breaking changes** to every producer and must be mirrored here.

## producers (one per phase, same consumer forever)

| producer | phase | computes `cycle` as |
|---|---|---|
| `LiveScheduler` (key / knob / MIDI) | 1 | `nowCycle() + lead` (default lead 6 ms = 10 739 cycles; adaptive 3–25 ms) |
| `TrackerDriver` (song playback) | 2 | `origin + floor(tick · clockRate / engineHz)` — a **closed form**, not an accumulator. Rows advance on an integer Bresenham accumulator over `num = 5·E·S`, `den = 2·T` |
| `renderSong` (offline / preset QA) | 2 | the same `TrackerDriver`, run faster than realtime against an `Apu2A03` it owns |
| WAV export driver | 3 | `renderSong` plus an encoder and a download — the same function, deliberately |

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

## the VRC6 (expansion audio)

Konami's VRC6 mapper carries two extra pulse channels and a sawtooth on the cartridge.
`Apu2A03` hosts them as three more named event sources beside its own six
(`src/audio/core/vrc6/`), so nothing above the core changes shape: the same
`write(cycle, addr, value)` reaches them, and a song that never writes them is silent
there. Mapper 24's register layout is the only one implemented — mapper 26 swaps two
address lines, which is a cartridge wiring difference, not an audio one.

```
$9000  M DDD VVVV   pulse 1 — mode (bit 7), duty 0..7, volume 0..15
$9001  LLLL LLLL    pulse 1 period low          } 12-bit period
$9002  E--- HHHH    pulse 1 enable + period high
$9003  ---- -X21    bit 0 halt all three; bit 1 period >> 4; bit 2 period >> 8
$A000-$A002         pulse 2, same layout
$B000  --RR RRRR    sawtooth accumulator rate, 0..63
$B001  LLLL LLLL    sawtooth period low
$B002  E--- HHHH    sawtooth enable + period high
```

**Duty is a threshold, not a waveform index.** The pulse output is high while
`step <= duty` over a 16-step sequencer, so duty `D` gives `(D+1)/16` high time and
duty 7 — not duty 2 — is the 50 % square. Bit 7 (`mode`) bypasses the sequencer and
holds `volume` continuously.

**Everything clocks at the CPU rate.** There is no `/2` divider: one sequencer step
lasts `effPeriod + 1` CPU cycles, where `effPeriod = period >> shift` and the shift
comes from `$9003`. So a VRC6 pulse runs at `fCPU / (16·(P+1))` — the same divisor as
the 2A03 pulse, reached by sixteen one-cycle-granular steps instead of eight
half-speed ones — and the sawtooth, whose sequence is **fourteen** steps, runs at
`fCPU / (14·(P+1))`. The same period register therefore sounds a different note on the
two kinds of lane, and the sawtooth's range is 12 bits with no `$7FF` clamp.

**The sawtooth is an accumulator, not a table.** Step 0 clears an 8-bit accumulator and
every even step adds the rate, so it walks `0, r, 2r … 6r`; the DAC sees `accum >> 3`,
seven levels topping out at 31. `6 · rate` is what the accumulator reaches, so any rate
above `$2A` (42) folds over eight bits part-way up the ramp — the documented VRC6
"distortion" timbre, deliberately reachable rather than clamped away.

**Writing a period never moves a running timer.** The reload lands at the next expiry,
exactly as a `$4002` write behaves on the 2A03 pulse. The one phase reset the chip has
is clearing an enable bit: `$x002` with bit 7 low zeroes the step (and, on the
sawtooth, the accumulator and the output too).

**The mix is linear.** The three outputs meet at the cartridge's expansion audio pin;
there is no resistor ladder to model. `emit()` therefore adds
`(v1 + v2 + saw) · VRC6_GAIN` to whichever 2A03 mix is selected — the non-linear LUT
path and the `linear` reference path both. `VRC6_GAIN = PULSE_LUT[15] / 15`
(≈ 0.0099211, `src/audio/core/mixer.ts`), chosen so one VRC6 pulse at volume 15 swings
exactly as far as a **lone** 2A03 pulse at volume 15. Calibrating against the lone
pulse rather than one inside a full mix is what reproduces the balance a real VRC6
cartridge has: the 2A03's own channels compress each other through the ladder while
the expansion keeps its level, so the VRC6 is audibly the louder voice in a busy
passage. All three outputs at 0 make the added term exactly `0.0`, which is why every
2A03 golden checksum is byte-identical either side of this feature
(`tests/unit/goldenTraces.test.ts`).

**Deviation D-V1.** A disabled or halted VRC6 oscillator freezes its divider and
advertises `nextCycle = Infinity`, dropping out of the run loop's min scan; it restarts
one cycle after the cycle that revives it. For a disable that is exact (the hardware's
timer is zeroed, so the first clock after a re-enable expires). For `$9003`'s halt bit
it costs at most one sequencer step of phase. See `docs/deviations.md`.

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
`MAGIC 'PUL1'`/`VERSION` (2)/`CAPACITY 4096`/`SAMPLE_RATE`, then `writeIndex` @64 and
`readIndex` @128 on separate cache lines, counters (dropped, late, underruns,
peakProcessNs, clipped, running) @192, `Float64 cycles[4096]` @256 and
`Int32 codes[4096]` @33024 (the 24-bit wire encoding above).

Ring indices live in `[0, 2·CAPACITY)` so full and empty are distinguishable
without a count; `& IDX_MASK`/`& SLOT_MASK` apply to **indices**, never to cycle
values. A full ring drops the write and counts it (`droppedWrites`) rather than
blocking or overwriting: dropping is visible, corruption is not.

The consumer stops at the first write past the frame's limit, so the producer must
push in non-decreasing cycle order. `LiveScheduler` guarantees that with a
monotonic clamp — an adaptive lead that shrinks between two key presses would
otherwise emit an earlier cycle than the write already queued.

## the tracker producer (phase 2)

`src/tracker/driver/trackerDriver.ts` is the P2 producer. It holds no DOM types and
takes its clock through `DriverClock`, which is what lets one object drive live
playback, `renderSong` and every unit test — and what would let it move to a worker
unchanged if profiling ever demanded it.

**tick → cycle is a closed form.**

```
cycleOfTick(n) = originCycle + Math.floor((n * clockRate) / engineHz)
```

The value depends only on `n`, so no amount of arithmetic history can make it drift. A
main-thread stall produces a short burst of late writes — which `Apu2A03` clamps to now
and counts, never dropping and never reordering — and playback is immediately back in
phase. **A stall is a stutter, never a tempo error.** At NTSC/60 the tick spacing
alternates 29 829 / 29 830 cycles; that alternation is correct and is asserted, not
smoothed. Exactness holds to `n ≤ 5e9/clockRate`: an hour at 60 Hz is 216 000 ticks and
ten hours at `engineSpeed` 400 is still exact in a double.

**rows → ticks is an integer accumulator.** `ticksPerRow = 2.5·E·S/T` is kept as the
exact ratio `num = 5·E·S` over `den = 2·T`; at the end of every tick `rowAccum += den`
and every time it reaches `num` a row advances. The accumulator **carries across rows,
patterns, order jumps and `Fxx`** — it is reset only by `stop()` and by play-from-row.
`E=60 S=6 T=160` therefore produces row lengths `6,6,5,6,6,5,6,5` and returns the
accumulator to zero after 8 rows, character for character the `F06 F06 F05 F06 F06 F05
F06 F05` expansion FamiTracker's documentation gives for tempo 160
(`tests/unit/trackerTempo.test.ts`).

**write-on-change.** Each channel holds the register image it last emitted and a tick
writes a byte **only when it differs**. That keeps the steady-state rate at 3–8 writes
per tick instead of 21, and more importantly it stops `$4003` being written every tick —
`$4003` resets the duty sequencer and restarts the envelope, so writing it per tick
would turn every sustained note into a 60 Hz buzz. A ten-second held note writes `$4003`
exactly once. The one exception is a **note trigger**, which emits the full canonical
sequence below unconditionally; that is the point of a trigger.

**The canonical per-channel orders are the ones above, reused verbatim** — pulse
`$4015 → $4000 → $4001 → $4002 → $4003`, triangle `$4015 → $4008 → $400A → $400B`, noise
`$4015 → $400C → $400E → $400F`, dmc `$4011 → $4010 → $4012 → $4013 → $4015`. Standing
conventions, chosen once:

- pulse and noise run with `L = 1` (length halt) and `C = 1` (constant volume) — note
  duration is the driver's business, not the length counter's;
- the triangle runs with `$4008` bit 7 set while sounding, and a composed volume of 0
  writes `$4008 = 0x00`, halting the sequencer **in phase** rather than clearing `$4015`;
- duty changes go out as `$4000`/`$4004` alone, so a duty macro stepping every tick
  cannot click;
- `$4015` is written as a **whole byte, never a single bit**, and the driver owns that
  byte for the whole of playback;
- timer high (`$4003`/`$4007`/`$400B`) is written only when its 3 bits change or a
  trigger occurs — **D-TK2**.

**Noise "pitch"** is the `$400E` period index, inverted so a rising keyboard is a rising
pitch: `index = 15 − (note mod 16)`. **[ours]** — no licence-safe source documents
FamiTracker's noise key map. Note 48 is index 15 (lowest); the design's suggested kit
lands on ordinary MIDI notes — kick (index 12–14) on notes ≡ 1..3 mod 16, snare (6–8) on
≡ 7..9, hat (1–3) on ≡ 12..14. Pitch effects and pitch macros move the INDEX on this
channel, not an 11-bit timer.

### VRC6 lanes

The tracker's lane list is a PREFIX of eight: the five 2A03 lanes then `vrc6p1`,
`vrc6p2`, `vrc6saw`. Their register blocks are not four apart and not adjacent to the
APU, so `registers.ts` addresses every lane through a base table —
`$4000 $4004 $4008 $400C $4010 $9000 $A000 $B000` — rather than `$4000 + ch·4 + slot`.

**Canonical orders.** The side-effect register is `$x002`: its enable bit, when
cleared, resets the lane's step, its accumulator and its timer. It therefore goes LAST,
and all three registers go out unconditionally on a trigger, write-on-change after.

- **vrc6 pulse 1 / 2** — `$9000`/`$A000` (`M DDD VVVV`) → `$9001`/`$A001` (period low)
  → **`$9002`/`$A002` last** (`E--- HHHH`: enable + the period's high nibble).
- **vrc6 saw** — `$B000` (`--RR RRRR`, the accumulator rate) → `$B001` (period low) →
  **`$B002` last**.

Standing conventions, chosen once:

- **`$4015` is never written for a VRC6 lane.** The expansion chip has no status
  register, and `$4015` belongs to five lanes that have nothing to do with this one —
  writing it on a VRC6 note-off would cut a 2A03 voice. `RegisterFile` keeps a per-lane
  `armed` flag for exactly this reason: a VRC6 lane has no bit to read back.
- **`$9003 = 0x00`, written once** on the first tick of a song that declares a VRC6
  lane, and never again. It means "no halt, no period shift", so every lane runs at the
  period the driver wrote. A 2A03-only song never writes it, which is what keeps its
  register timeline byte-for-byte what it was before these lanes existed
  (`trackerVrc6Regression.test.ts` pins the FNV-1a of all four shipped five-lane
  traces).
- **A note-off, a `---` cut and a composed volume of 0 are the same three bytes**:
  volume 0 in `$x000` (rate 0 for the saw) AND the enable bit cleared in `$x002`. The
  second half is not redundant — it is the phase reset, and it stops a silent lane's
  divider running. `stop()` adds `$9000 $9002 $A000 $A002 $B000 $B002`, in that order,
  after `$4015 = 0`, and only for a song that armed the chip.
- **Duty is a FOUR-bit field**: bits 0–2 the duty (output high for `duty+1` of 16
  steps) and bit 3 the mode bit, which makes the lane output its volume constantly. A
  duty macro or a `Vxx` is masked `& 0xF` — so `V08` and above reach the mode bit,
  OCTET's convention — and the default when neither is set is **7**, the 50 % square.
  The 2A03 pulses keep `& 3` and their default of 2.
- **The saw's volume is a rate**: `rate = sounding ? min(42, round(v · 42 / 15)) : 0`,
  OCTET's own mapping. 42 is the ceiling because the accumulator adds the rate on each
  of seven even steps and `7 · 42` already overflows eight bits — above it the chip
  distorts, which a volume column must not be able to reach by accident.
- **Periods are 12-bit, `0x000..0xFFF`**, and the minimum is 0: the VRC6 has no sweep
  unit, so it has no period check to mute a short timer the way a 2A03 pulse's floor of
  8 does. `clampPeriod` therefore takes the lane's maximum. Every pitch effect —
  `1xx 2xx 3xx 4xy Pxx Qxy Rxy`, arpeggio `0xy`, the pitch and hi-pitch macros — runs
  unchanged over the wider range and simply stops later, which is what lets a saw bass
  reach an octave a 2A03 pulse saturates in. `$x002` still moves only when its nibble
  or the enable bit changes, which is D-TK2 read on a 12-bit divider.
- **Pitch.** The VRC6 pulses divide by 16, like the 2A03 pulse, so the same timer sounds
  the same note (`t = 253` → 440.3969 Hz). The saw divides by 14: A4 is `t = 290` →
  439.3159 Hz, −2.694 cents, and that is the hardware, not a rounding bug.

Effects supported on a VRC6 lane are the PULSE set. The noise lane's inverted period
index and the dpcm lane's trigger path are keyed on their channel ids and do not reach
these lanes.

## Rule L — one owner of the timeline at a time

`EngineHandle` remains the one and only `RingProducer` owner. `TrackerDriver` and
`LiveScheduler` are two **callers** of it on the same thread, and `PlaybackCoordinator`
guarantees only one of them writes during any interval. Two call sites on one thread are
not two producers — the SPSC hazard the rule exists to prevent is *concurrent* writers.
What the rule genuinely still demands is **non-decreasing cycle order**, and the handoff
buys that explicitly rather than with a merge buffer:

```
play():
  1. liveScheduler.allNotesOff()                    // writes at now+lead
  2. start = max(engine.nowCycle() + 40 ms, liveScheduler.lastScheduledCycle + 1)
  3. liveScheduler.reset(start)                     // clears state, emits NOTHING
  4. driver.play(mode, from); driver.originCycle = start
  5. driver.runTo(start + lookahead); engine.flush(); start the pump
stop():
  1. stop the pump; driver.stop() emits all-channels-off at horizon H
  2. liveScheduler.reset(H + 1)                     // its monotonic clamp resumes past H
```

- **stopped** → `LiveScheduler` owns the timeline. Behaviour is bit-identical to phase 1:
  3–25 ms adaptive lead, monotonic clamp, canonical note-on. The instrument the user
  judges latency by does not get slower because a tracker was added.
- **playing** → `TrackerDriver` owns it. `bridge.noteOn/noteOff` route to the driver,
  which plays the note on the **editor's cursor channel**, stealing it from the song
  while the key is held; the lane returns at the first row boundary after release. Live
  latency during playback is therefore the lookahead (120 ms), and the UI says so.
- Step record keeps **real timestamps**: the recorded row comes from the input event's
  own `nowCycle()` mapped back through `cycleOfTick`, so quantization is unaffected by
  the lookahead.

The pump is `setInterval`, never `requestAnimationFrame` (rAF stops in a hidden tab and
ties the audio timeline to the display refresh): 20 ms with a 120 ms lookahead when
visible, 250 ms when hidden with the lookahead capped by **ring occupancy** —
`min(1500 ms, 3000 / (21 · engineHz) s)`, so `lookahead_s · engineHz · 21` can never
approach the ring's 4 096 slots.

Two narrow **additive host** APIs were added for this and nothing else:
`LiveScheduler.reset(cycle)` (~6 lines) and `EngineHandle.pending` (~3 lines,
diagnostic). Nothing in `src/audio/{core,dsp,worklet,protocol}` or
`src/audio/timeline/types.ts` changed.

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
