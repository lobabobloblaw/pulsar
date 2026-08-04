/** The driver's register file: write-on-change over the canonical per-channel orders
 *  from docs/register-timeline.md (design §2.7, §2.8).
 *
 *  Two disciplines, neither optional:
 *
 *  **Write-on-change.** Each channel holds the register image it last emitted; a tick
 *  emits a write ONLY when the computed byte differs. That is what keeps the write
 *  rate at 3–8 per tick instead of 21, and — far more importantly — it is what stops
 *  `$4003` being written every tick. `$4003` resets the duty sequencer and restarts
 *  the envelope, so writing it per tick would turn every sustained note into a 60 Hz
 *  buzz. The one exception is a note trigger, which emits the FULL canonical sequence
 *  unconditionally; that is the point of a trigger.
 *
 *  **`$4015` is a whole byte, never a single bit**, and the driver owns it for the
 *  whole of playback (Rule L). A channel with no sounding note has its bit clear.
 *
 *  Standing conventions chosen once (design §2.8): pulse and noise run with L=1
 *  (length halt) and C=1 (constant volume) — note duration is the driver's business,
 *  not the length counter's. The triangle runs with `$4008` bit 7 set while sounding;
 *  a composed volume of 0 writes `$4008 = 0x00`, which halts the sequencer IN PHASE
 *  holding its DAC value rather than clearing `$4015`. Duty changes go out as
 *  `$4000`/`$4004` alone so a duty macro stepping every tick cannot click.
 */
import { REG_STATUS } from '../../audio/core/constants'
import type { NesCycle, WriteSink } from '../../audio/timeline/types'

export const CH_PULSE1 = 0
export const CH_PULSE2 = 1
export const CH_TRIANGLE = 2
export const CH_NOISE = 3
export const CH_DPCM = 4

/** $4015 enable bits, indexed by canonical channel. */
export const ENABLE_BIT: readonly number[] = [0x01, 0x02, 0x04, 0x08, 0x10]

/** Four register slots per channel: $4000 + ch·4 + slot. */
export const SLOTS_PER_CHANNEL = 4

/** Length-counter halt + constant volume, both set on every pulse/noise note. */
export const HALT_CONSTANT = 0x30
/** Canonical "sweep off" byte (plan B6, D-P4). */
export const SWEEP_OFF = 0x08
/** `$4008` while sounding: control bit set, reload 127 — the linear counter holds. */
export const TRIANGLE_SUSTAIN = 0xff
/** `$4008` when the composed volume is 0: halts the sequencer in phase. */
export const TRIANGLE_GATED = 0x00

export function pulseControlByte(duty: number, volume: number): number {
  return ((duty & 3) << 6) | HALT_CONSTANT | (volume & 0x0f)
}

export function noiseControlByte(volume: number): number {
  return HALT_CONSTANT | (volume & 0x0f)
}

export function noisePeriodByte(mode: number, index: number): number {
  return (mode !== 0 ? 0x80 : 0) | (index & 0x0f)
}

/** The register image, write-on-change. One instance per driver. */
export class RegisterFile {
  /** `ch · 4 + slot` -> last byte emitted, or −1 for "never written". */
  readonly last: Int32Array
  /** The whole `$4015` byte the driver owns. */
  enable = 0
  private lastEnable = -1
  /** Cycle of the most recent write, so `stop()` can report its horizon. */
  lastCycle: NesCycle = 0
  writes = 0

  constructor(channelCount: number) {
    this.last = new Int32Array(channelCount * SLOTS_PER_CHANNEL)
    this.last.fill(-1)
  }

  /** Forget the whole image — every byte is re-emitted on the next tick. Used on
   *  `play()` and on unmute, so a channel that was suppressed resumes coherently. */
  invalidate(channel = -1): void {
    if (channel < 0) {
      this.last.fill(-1)
      this.lastEnable = -1
      return
    }
    const base = channel * SLOTS_PER_CHANNEL
    for (let i = 0; i < SLOTS_PER_CHANNEL; i++) this.last[base + i] = -1
  }

  reset(): void {
    this.last.fill(-1)
    this.enable = 0
    this.lastEnable = -1
    this.lastCycle = 0
    this.writes = 0
  }

  /** Raw write. Every emission funnels through here so `lastCycle` and the counter
   *  cannot drift from what actually went out. */
  emit(sink: WriteSink, cycle: NesCycle, addr: number, value: number): void {
    sink.write(cycle, addr, value & 0xff)
    this.lastCycle = cycle
    this.writes++
  }

  /** `$4015`, write-on-change. `force` is the trigger path: the canonical note-on
   *  writes the enable byte first, unconditionally. */
  status(sink: WriteSink, cycle: NesCycle, force: boolean): void {
    if (!force && this.enable === this.lastEnable) return
    this.lastEnable = this.enable
    this.emit(sink, cycle, REG_STATUS, this.enable)
  }

  setEnabled(channel: number, on: boolean): void {
    const bit = ENABLE_BIT[channel] ?? 0
    if (on) this.enable |= bit
    else this.enable &= ~bit
  }

  isEnabled(channel: number): boolean {
    return (this.enable & (ENABLE_BIT[channel] ?? 0)) !== 0
  }

  /** One register slot, write-on-change. Returns true when a write went out. */
  private slot(
    sink: WriteSink,
    cycle: NesCycle,
    channel: number,
    slot: number,
    value: number,
    force: boolean,
  ): boolean {
    const i = channel * SLOTS_PER_CHANNEL + slot
    const v = value & 0xff
    if (!force && this.last[i] === v) return false
    this.last[i] = v
    this.emit(sink, cycle, 0x4000 + channel * SLOTS_PER_CHANNEL + slot, v)
    return true
  }

  // --- canonical per-channel orders -------------------------------------------------

  /** Pulse: `$4015` → `$4000` → `$4001` → `$4002` → **`$4003` last** (it latches the
   *  timer high bits, loads the length counter, resets the duty step and restarts the
   *  envelope, so everything it depends on must already be in place).
   *
   *  Off a trigger, `$4003` goes out only when its high 3 bits actually change —
   *  **D-TK2**: a pitch slide crossing a high-byte boundary therefore resets the duty
   *  phase, exactly the tiny click a real tracker on real hardware produces. */
  pulse(
    sink: WriteSink,
    cycle: NesCycle,
    channel: number,
    trigger: boolean,
    duty: number,
    volume: number,
    timer: number,
    sweepByte: number,
  ): void {
    if (trigger) this.status(sink, cycle, true)
    this.slot(sink, cycle, channel, 0, pulseControlByte(duty, volume), trigger)
    this.slot(sink, cycle, channel, 1, sweepByte, trigger)
    this.slot(sink, cycle, channel, 2, timer & 0xff, trigger)
    this.slot(sink, cycle, channel, 3, (timer >> 8) & 0x07, trigger)
  }

  /** Triangle: `$4015` → `$4008` → `$400A` → **`$400B` last**. `$4008` carries the
   *  volume gate: 0xff sustains, 0x00 halts the sequencer in phase. */
  triangle(
    sink: WriteSink,
    cycle: NesCycle,
    channel: number,
    trigger: boolean,
    gate: boolean,
    timer: number,
  ): void {
    if (trigger) this.status(sink, cycle, true)
    this.slot(sink, cycle, channel, 0, gate ? TRIANGLE_SUSTAIN : TRIANGLE_GATED, trigger)
    this.slot(sink, cycle, channel, 2, timer & 0xff, trigger)
    this.slot(sink, cycle, channel, 3, (timer >> 8) & 0x07, trigger)
  }

  /** Noise: `$4015` → `$400C` → `$400E` → **`$400F` last** (length load + envelope
   *  restart). `$400F` is written on a trigger only — off a trigger it would restart
   *  the envelope every tick. */
  noise(
    sink: WriteSink,
    cycle: NesCycle,
    channel: number,
    trigger: boolean,
    volume: number,
    index: number,
    mode: number,
  ): void {
    if (trigger) this.status(sink, cycle, true)
    this.slot(sink, cycle, channel, 0, noiseControlByte(volume), trigger)
    this.slot(sink, cycle, channel, 2, noisePeriodByte(mode, index), trigger)
    if (trigger) this.slot(sink, cycle, channel, 3, 0x00, true)
  }

  /** DPCM: `$4011` (optional preload) → `$4010` → `$4012` → `$4013` →
   *  **`$4015` last** — the sample starts only if `bytesRemaining === 0`, so the
   *  enable byte is the trigger here rather than the prologue. */
  dpcm(
    sink: WriteSink,
    cycle: NesCycle,
    channel: number,
    rateIndex: number,
    loop: boolean,
    address: number,
    length: number,
    delta: number,
  ): void {
    if (delta >= 0) this.slot(sink, cycle, channel, 1, delta & 0x7f, true)
    this.slot(sink, cycle, channel, 0, (loop ? 0x40 : 0) | (rateIndex & 0x0f), true)
    this.slot(sink, cycle, channel, 2, address & 0xff, true)
    this.slot(sink, cycle, channel, 3, length & 0xff, true)
    this.status(sink, cycle, true)
  }
}
