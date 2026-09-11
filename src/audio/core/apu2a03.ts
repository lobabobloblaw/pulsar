/** Apu2A03 — the register-accurate core, and the single consumer of the write
 *  timeline. Everything upstream (live play, the Phase-2 tracker tick scheduler, the
 *  WAV export driver) is just another `WriteSink` producer, which is what guarantees
 *  tracker playback will be bit-identical to live play.
 *
 *  Complete 2A03: two pulses, triangle, noise, DPCM and the frame counter, plus the
 *  VRC6 expansion chip's two pulses and sawtooth — nine event sources driven by one
 *  merged chronological event loop over a single CPU-cycle timeline. The 2A03's five
 *  channels mix through the hardware's non-linear ladders; the VRC6's three sum
 *  linearly on top (see `VRC6_GAIN` in mixer.ts), because that is how the expansion
 *  audio pin works.
 *
 *  Load-bearing structure:
 *    - channels are NAMED FIELDS, never an array (monomorphic property access)
 *    - the run loop is a merged chronological min scan over `nextCycle`; silent
 *      sources advertise Infinity and drop out of it
 *    - `emit()` re-evaluates the FULL non-linear mix on every state change and emits
 *      one band-limited delta if the level moved — which is why DPCM ducking of the
 *      triangle and noise falls out of TND_LUT for free instead of being coded
 *    - NES cycles are f64 doubles end to end. `|0`, `<<`, `>>` and `&` never touch
 *      them; bitwise ops in this file act on 8-bit register values only.
 */
import { BandlimitedBuf, DEFAULT_MAX_SAMPLES_PER_FRAME } from '../dsp/bandlimitedBuf'
import { DmcChannel } from './channels/dmcChannel'
import { NoiseChannel } from './channels/noiseChannel'
import { PulseChannel } from './channels/pulseChannel'
import { TriangleChannel } from './channels/triangleChannel'
import { FrameCounter } from './frameCounter'
import { AnalogFilterChain, type ConsoleModel } from './filters'
import { Vrc6 } from './vrc6/vrc6'
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ, PAL_CPU_HZ } from './constants'
import { VRC6_GAIN, mixLinear, mixLut, type MixerMode } from './mixer'
import { ApuStats } from './stats'
import type { NesCycle, RegAddr, WriteSink } from '../timeline/types'

export type Region = 'ntsc' | 'pal'

export interface Apu2A03Options {
  sampleRate: number
  clockRate?: number
  region?: Region
  consoleModel?: ConsoleModel
  mixerMode?: MixerMode
  maxSamplesPerFrame?: number
  masterGain?: number
  /** Offline analysis escape hatch: false bypasses the analog section so a test can
   *  measure raw band-limited synthesis. Defaults to true — the shipped signal path. */
  analogFilters?: boolean
}

export class Apu2A03 implements WriteSink {
  // --- nine named event sources ------------------------------------------------
  readonly pulse1 = new PulseChannel(true)
  readonly pulse2 = new PulseChannel(false)
  readonly triangle = new TriangleChannel()
  readonly noise = new NoiseChannel()
  readonly dmc = new DmcChannel()
  readonly frameCounter = new FrameCounter()

  /** The VRC6 expansion chip. Always present and silent until written — there is no
   *  option flag, because a chip nobody writes costs one Infinity comparison per scan
   *  iteration and adds exactly 0.0 to the mix. */
  readonly vrc6 = new Vrc6()
  /** The VRC6's three channels, aliased as named fields so the min scan below reads
   *  them exactly the way it reads the 2A03's — one monomorphic load each, hoisted
   *  into locals once per `runTo`. Same objects as `vrc6.pulse1` / `.pulse2` / `.saw`. */
  readonly vrc6p1 = this.vrc6.pulse1
  readonly vrc6p2 = this.vrc6.pulse2
  readonly vrc6saw = this.vrc6.saw

  readonly buf: BandlimitedBuf
  readonly filters = new AnalogFilterChain()
  readonly stats = new ApuStats()

  readonly clockRate: number
  readonly region: Region
  readonly sampleRate: number
  readonly maxSamplesPerFrame: number

  masterGain: number
  mixerMode: MixerMode
  consoleModel: ConsoleModel

  /** 32 KiB of $8000–$FFFF for the DMC memory reader. Loaded by the host. */
  dpcmMemory: Uint8Array | null = null

  /** Cached `vrc6p1.out + vrc6p2.out + vrc6saw.out`. The VRC6 sums LINEARLY, so the
   *  mix only ever needs the total — caching it keeps `emit()` at one load instead of
   *  six, which is what pays for a ninth, tenth and eleventh event source inside the
   *  same per-quantum budget. Derived state, so it is restored at the only two places
   *  a VRC6 output can move: after a step in `runTo`'s scan, and after a register
   *  write in `writeVrc6`. `vrc6.test.ts` asserts the invariant over a long trace. */
  private vrc6SumValue = 0

  private cycleValue: NesCycle = 0
  private frameOriginValue: NesCycle = 0
  private lastMix = 0
  private useLut: boolean
  private readonly scratch: Float64Array

  constructor(opts: Apu2A03Options) {
    this.region = opts.region ?? 'ntsc'
    this.clockRate = opts.clockRate ?? (this.region === 'pal' ? PAL_CPU_HZ : NTSC_CPU_HZ)
    this.sampleRate = opts.sampleRate
    this.maxSamplesPerFrame = opts.maxSamplesPerFrame ?? DEFAULT_MAX_SAMPLES_PER_FRAME
    this.masterGain = opts.masterGain ?? DEFAULT_MASTER_GAIN
    this.mixerMode = opts.mixerMode ?? 'lut'
    this.consoleModel = opts.consoleModel ?? 'nes'
    this.useLut = this.mixerMode === 'lut'

    this.noise.setRegion(this.region)
    this.dmc.setRegion(this.region)

    this.buf = new BandlimitedBuf(this.maxSamplesPerFrame)
    this.buf.setRates(this.clockRate, this.sampleRate)
    this.filters.setRates(
      this.sampleRate,
      opts.analogFilters === false ? 'none' : this.consoleModel,
    )
    this.scratch = new Float64Array(this.maxSamplesPerFrame)
  }

  /** Run position on the CPU-cycle timeline. Advanced by the engine only. */
  get cycle(): NesCycle {
    return this.cycleValue
  }

  /** Cycle the current output frame started at; `addDelta` positions are relative
   *  to it, which keeps `cycleTime · factor` an exact integer forever. */
  get frameOrigin(): NesCycle {
    return this.frameOriginValue
  }

  /** The VRC6's summed output level, 0..61. Read-only derived state — see the field. */
  get vrc6Sum(): number {
    return this.vrc6SumValue
  }

  // --- WriteSink ---------------------------------------------------------------

  /** Late writes are CLAMPED to the current run position and counted — never dropped
   *  and never reordered. Dropping one would desync the register file; reordering one
   *  would make output depend on transport timing. */
  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    let c = cycle
    if (c < this.cycleValue) {
      c = this.cycleValue
      this.stats.lateWrites++
    }
    this.runTo(c)
    this.applyWrite(c, addr, value & 0xff)
    this.emit(c)
  }

  /** $4015 read — IF-D NT21.
   *    bit 7  DMC IRQ flag          bit 3  noise length counter > 0
   *    bit 6  frame IRQ flag        bit 2  triangle length counter > 0
   *    bit 5  open bus (0)          bit 1  pulse 2 length counter > 0
   *    bit 4  DMC bytes remaining   bit 0  pulse 1 length counter > 0
   *  Reading clears the frame IRQ flag ONLY — not the DMC one, which is cleared by a
   *  $4015 write or by clearing $4010 bit 7. Per deviation D-D2 both flags are
   *  maintained for read-back only; no IRQ is ever delivered, because there is no CPU. */
  readStatus(cycle: NesCycle): number {
    this.runTo(cycle)
    let v = 0
    if (this.pulse1.length.active) v |= 0x01
    if (this.pulse2.length.active) v |= 0x02
    if (this.triangle.length.active) v |= 0x04
    if (this.noise.length.active) v |= 0x08
    if (this.dmc.active) v |= 0x10
    if (this.frameCounter.irqFlag) v |= 0x40
    if (this.dmc.irqFlag) v |= 0x80
    this.frameCounter.irqFlag = false
    return v
  }

  setDpcmMemory(mem: Uint8Array): void {
    this.dpcmMemory = mem
    this.dmc.setMemory(mem)
  }

  // --- run loop ----------------------------------------------------------------

  /** Merged chronological min scan over the nine named sources. Every source due at the
   *  winning cycle steps, then the mix is re-evaluated exactly once for that cycle.
   *
   *  The three VRC6 reads are adjacent and monomorphic, and they fold into their own
   *  minimum (`v6next`) before joining the scan. That second level is not decoration:
   *  a chip nobody wrote advertises Infinity on all three, `v6next === next` is false
   *  once per iteration, and the three dispatch tests never run. Measured on the
   *  worst-case bench scenario, which uses no VRC6 at all, the gate is worth ~8 µs per
   *  quantum against the flat nine-way form. */
  runTo(target: NesCycle): void {
    const p1 = this.pulse1
    const p2 = this.pulse2
    const tri = this.triangle
    const nz = this.noise
    const dmc = this.dmc
    const fc = this.frameCounter
    const v1 = this.vrc6p1
    const v2 = this.vrc6p2
    const vs = this.vrc6saw
    let events = 0
    let frames = 0
    for (;;) {
      let next = p1.nextCycle
      const c2 = p2.nextCycle
      if (c2 < next) next = c2
      const c3 = tri.nextCycle
      if (c3 < next) next = c3
      const c4 = nz.nextCycle
      if (c4 < next) next = c4
      const c5 = dmc.nextCycle
      if (c5 < next) next = c5
      const c6 = fc.nextCycle
      if (c6 < next) next = c6
      let v6next = v1.nextCycle
      const c8 = v2.nextCycle
      if (c8 < v6next) v6next = c8
      const c9 = vs.nextCycle
      if (c9 < v6next) v6next = c9
      if (v6next < next) next = v6next
      if (!(next <= target)) break

      this.cycleValue = next
      if (p1.nextCycle === next) {
        p1.stepTimer()
        events++
      }
      if (p2.nextCycle === next) {
        p2.stepTimer()
        events++
      }
      if (tri.nextCycle === next) {
        tri.stepTimer()
        events++
      }
      if (nz.nextCycle === next) {
        nz.stepTimer()
        events++
      }
      if (dmc.nextCycle === next) {
        dmc.stepTimer()
        events++
      }
      if (fc.nextCycle === next) {
        fc.stepTimer()
        if (fc.quarterClock) this.clockQuarter(next)
        if (fc.halfClock) this.clockHalf(next)
        frames++
      }
      if (v6next === next) {
        if (v1.nextCycle === next) {
          v1.stepTimer()
          events++
        }
        if (v2.nextCycle === next) {
          v2.stepTimer()
          events++
        }
        if (vs.nextCycle === next) {
          vs.stepTimer()
          events++
        }
        this.vrc6SumValue = v1.out + v2.out + vs.out
      }
      this.emit(next)
    }
    const stats = this.stats
    stats.eventsProcessed += events
    stats.frameEvents += frames
    if (target > this.cycleValue) this.cycleValue = target
  }

  /** Quarter-frame clock (~240 Hz): envelopes and the triangle's linear counter. */
  clockQuarter(cycle: NesCycle): void {
    this.pulse1.clockQuarter(cycle)
    this.pulse2.clockQuarter(cycle)
    this.triangle.clockQuarter(cycle)
    this.noise.clockQuarter(cycle)
  }

  /** Half-frame clock (~120 Hz): length counters and sweep units. */
  clockHalf(cycle: NesCycle): void {
    this.pulse1.clockHalf(cycle)
    this.pulse2.clockHalf(cycle)
    this.triangle.clockHalf(cycle)
    this.noise.clockHalf(cycle)
  }

  /** Close the output frame at `cycle` and report how many whole samples are ready. */
  endFrame(cycle: NesCycle): number {
    this.runTo(cycle)
    const avail = this.buf.endFrame(cycle - this.frameOriginValue)
    this.frameOriginValue = cycle
    return avail
  }

  /** Cycles that must still elapse before `count` samples are renderable. The
   *  pull-driven `process()` uses this to pick its target, so the sample-rate ratio
   *  error can never accumulate into an underrun. */
  cyclesForSamples(count: number): number {
    return this.buf.cyclesForSamples(count)
  }

  /** Integrate, run the analog section, apply master gain, clamp. Returns the number
   *  of samples actually written. */
  readSamples(out: Float32Array, outOffset: number, count: number): number {
    const scratch = this.scratch
    const want = count < scratch.length ? count : scratch.length
    const n = this.buf.readSamples(scratch, 0, want)
    const gain = this.masterGain
    const filters = this.filters
    const stats = this.stats
    for (let i = 0; i < n; i++) {
      let y = filters.process(scratch[i]) * gain
      if (y > 1) {
        y = 1
        stats.clippedSamples++
      } else if (y < -1) {
        y = -1
        stats.clippedSamples++
      }
      out[outOffset + i] = y
    }
    return n
  }

  /** Reposition the timeline without rendering the gap. Every armed timer moves with
   *  it, so relative phase is preserved. Used by the cycle-origin tests (3e9 is past
   *  int32, 9e15 is at the edge of exact f64 integers) and by any future export driver
   *  that resumes mid-song. Call only between frames. */
  seekTo(cycle: NesCycle): void {
    const delta = cycle - this.cycleValue
    this.cycleValue = cycle
    this.frameOriginValue = cycle
    shiftSource(this.pulse1, delta)
    shiftSource(this.pulse2, delta)
    shiftSource(this.triangle, delta)
    shiftSource(this.noise, delta)
    shiftSource(this.dmc, delta)
    this.frameCounter.shiftBy(delta)
    this.vrc6.shiftBy(delta)
  }

  reset(): void {
    this.pulse1.reset()
    this.pulse2.reset()
    this.triangle.reset()
    this.noise.reset()
    this.dmc.reset()
    this.dmc.setMemory(this.dpcmMemory)
    this.frameCounter.reset()
    this.vrc6.reset()
    this.vrc6SumValue = 0
    this.noise.setRegion(this.region)
    this.dmc.setRegion(this.region)
    this.buf.clear()
    this.filters.reset()
    this.stats.reset()
    this.cycleValue = 0
    this.frameOriginValue = 0
    this.lastMix = 0
  }

  /** Switch the analog section between console models without rebuilding the engine. */
  setConsoleModel(model: ConsoleModel): void {
    this.consoleModel = model
    // setModel, not setRates: a live switch keeps filter state so it cannot click
    // (review finding #5). setRates' full reset is for sample-rate changes only.
    this.filters.setModel(model)
  }

  setMixerMode(mode: MixerMode): void {
    this.mixerMode = mode
    this.useLut = mode === 'lut'
  }

  // --- internals ---------------------------------------------------------------

  private applyWrite(cycle: NesCycle, addr: RegAddr, value: number): void {
    switch (addr) {
      // --- pulse 1 -------------------------------------------------------------
      case 0x4000:
        this.pulse1.writeControl(value, cycle)
        return
      case 0x4001:
        this.pulse1.writeSweep(value, cycle)
        return
      case 0x4002:
        this.pulse1.writeTimerLow(value, cycle)
        return
      case 0x4003:
        this.pulse1.writeTimerHigh(value, cycle)
        return
      // --- pulse 2 -------------------------------------------------------------
      case 0x4004:
        this.pulse2.writeControl(value, cycle)
        return
      case 0x4005:
        this.pulse2.writeSweep(value, cycle)
        return
      case 0x4006:
        this.pulse2.writeTimerLow(value, cycle)
        return
      case 0x4007:
        this.pulse2.writeTimerHigh(value, cycle)
        return
      // --- triangle ------------------------------------------------------------
      case 0x4008:
        this.triangle.writeLinear(value, cycle)
        return
      case 0x400a:
        this.triangle.writeTimerLow(value, cycle)
        return
      case 0x400b:
        this.triangle.writeTimerHigh(value, cycle)
        return
      // --- noise ---------------------------------------------------------------
      case 0x400c:
        this.noise.writeControl(value, cycle)
        return
      case 0x400e:
        this.noise.writePeriod(value, cycle)
        return
      case 0x400f:
        this.noise.writeLength(value, cycle)
        return
      // --- dmc -----------------------------------------------------------------
      case 0x4010:
        this.dmc.writeControl(value, cycle)
        return
      case 0x4011:
        this.dmc.writeDirectLoad(value)
        return
      case 0x4012:
        this.dmc.writeAddress(value)
        return
      case 0x4013:
        this.dmc.writeLength(value)
        return
      // --- status / frame counter ----------------------------------------------
      case 0x4015:
        this.pulse1.setEnabled((value & 0x01) !== 0, cycle)
        this.pulse2.setEnabled((value & 0x02) !== 0, cycle)
        this.triangle.setEnabled((value & 0x04) !== 0, cycle)
        this.noise.setEnabled((value & 0x08) !== 0, cycle)
        this.dmc.irqFlag = false
        this.dmc.setEnabled((value & 0x10) !== 0, cycle)
        return
      case 0x4017:
        this.frameCounter.write(value, cycle)
        return
      // --- vrc6 expansion audio -------------------------------------------------
      // All ten in one arm so the cached sum is restored at exactly one place; the
      // per-register dispatch is `writeVrc6` below. Register writes are the cold path
      // (a few hundred a second), so the extra call costs nothing measurable.
      case 0x9000:
      case 0x9001:
      case 0x9002:
      case 0x9003:
      case 0xa000:
      case 0xa001:
      case 0xa002:
      case 0xb000:
      case 0xb001:
      case 0xb002:
        this.writeVrc6(addr, value, cycle)
        return
      default:
        // $4009 / $400D are unused on the chip; $4014 (OAM DMA) and $4016
        // (controller strobe) are not APU registers at all. Their writes are still
        // ordered, timestamped and counted so a recorded trace stays replayable.
        return
    }
  }

  /** The VRC6's ten registers. $9003 is the only one that is not per-channel: it halts
   *  and shifts all three at once. Every path out of here restores `vrc6SumValue`. */
  private writeVrc6(addr: RegAddr, value: number, cycle: NesCycle): void {
    switch (addr) {
      case 0x9000:
        this.vrc6p1.writeControl(value, cycle)
        break
      case 0x9001:
        this.vrc6p1.writeTimerLow(value, cycle)
        break
      case 0x9002:
        this.vrc6p1.writeEnable(value, cycle)
        break
      case 0x9003:
        this.vrc6.writeFrequencyControl(value, cycle)
        break
      case 0xa000:
        this.vrc6p2.writeControl(value, cycle)
        break
      case 0xa001:
        this.vrc6p2.writeTimerLow(value, cycle)
        break
      case 0xa002:
        this.vrc6p2.writeEnable(value, cycle)
        break
      case 0xb000:
        this.vrc6saw.writeRate(value, cycle)
        break
      case 0xb001:
        this.vrc6saw.writeTimerLow(value, cycle)
        break
      default:
        this.vrc6saw.writeEnable(value, cycle)
        break
    }
    this.vrc6SumValue = this.vrc6p1.out + this.vrc6p2.out + this.vrc6saw.out
  }

  /** Re-evaluate the whole non-linear mix and emit one delta if it moved. Called after
   *  every event and every register write — recomputing the exact non-linear mix here
   *  is what keeps DPCM ducking and cross-channel compression real, and doing it BEFORE
   *  band-limited synthesis is what keeps the result alias-free. */
  private emit(cycle: NesCycle): void {
    const p1 = this.pulse1.out
    const p2 = this.pulse2.out
    const tri = this.triangle.out
    const nz = this.noise.out
    const dmc = this.dmc.out
    // The VRC6 sums linearly and is added to BOTH mixer modes. When the chip is
    // untouched all three outs are 0, the product is exactly 0.0, and `x + 0` returns
    // `x` unchanged — which is why every pre-VRC6 golden checksum still holds.
    const v6 = this.vrc6SumValue
    const mix =
      (this.useLut ? mixLut(p1, p2, tri, nz, dmc) : mixLinear(p1, p2, tri, nz, dmc)) +
      v6 * VRC6_GAIN
    const last = this.lastMix
    if (mix !== last) {
      this.buf.addDelta(cycle - this.frameOriginValue, mix - last)
      this.lastMix = mix
      this.stats.deltasEmitted++
    }
  }
}

/** Timeline shift for one channel. Free function rather than a method on each channel
 *  so the shape stays identical across all five and stays out of the hot path. */
function shiftSource(ch: { nextCycle: NesCycle; stepCycle: NesCycle }, delta: number): void {
  if (ch.nextCycle !== Infinity) ch.nextCycle += delta
  ch.stepCycle += delta
}
