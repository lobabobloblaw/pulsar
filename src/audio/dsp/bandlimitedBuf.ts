/** BandlimitedBuf — fixed-point-time delta buffer with band-limited step insertion.
 *
 *  Fresh implementation of the well-documented "blip" technique; no LGPL source was
 *  consulted (see NOTICE.md). Semantics are cross-checkable against the technique's
 *  public description, not against anybody's code.
 *
 *  The contract:
 *    - `addDelta(cycleTime, delta)` splats one kernel row (interpolated between two
 *      adjacent phase rows) into the delta buffer at the fractional sample position
 *      that `cycleTime` maps to. `cycleTime` is CPU cycles SINCE the current frame
 *      origin, so the product `cycleTime · factor` always stays an exact integer in
 *      f64 (well under 2^53) no matter how long the engine has been running.
 *    - `endFrame(cycleCount)` advances fixed-point time by a frame's worth of cycles
 *      and reports how many whole output samples are now available.
 *    - `readSamples` runs the cumulative sum (the integration that turns the stored
 *      impulses into steps), then slides the buffer down and reduces `offset` so it
 *      stays bounded in [0, TIME_UNIT).
 *
 *  BANNED here and everywhere downstream: `t >> TIME_BITS`. Fixed-point time for a
 *  one-second export frame is ~2.0e11, far past int32; only `Math.floor(t / TIME_UNIT)`
 *  is correct. tests/unit/bandlimitedBuf.test.ts contains the one-second frame test
 *  that exists specifically to catch a regression back to `>>`.
 */
import { KERNEL_WIDTH, PHASE_COUNT, STEP_KERNEL } from './kernel'

export {
  KAISER_BETA,
  KERNEL_CUTOFF,
  KERNEL_GROUP_DELAY,
  KERNEL_HALF,
  KERNEL_ROWS,
  KERNEL_WIDTH,
  PHASE_COUNT,
  STEP_KERNEL,
} from './kernel'

/** Fractional bits of the cycle→sample fixed-point mapping. */
export const TIME_BITS = 22
/** 2 ** TIME_BITS. Written as a literal: `1 << 22` would be an int32 expression. */
export const TIME_UNIT = 4_194_304

/** Default frame ceiling: 512 samples covers a 128-frame render quantum four times
 *  over. Offline/export callers pass a bigger value (see the one-second frame test). */
export const DEFAULT_MAX_SAMPLES_PER_FRAME = 512

/** Fixed-point sample-time increment per CPU cycle.
 *  1 789 773 → 48 000 gives 112 487 (−1.97 ppm ≈ −0.0034 cents, deviation D-B1);
 *  1 789 773 → 44 100 gives 103 348. */
export function factorFor(clockRate: number, sampleRate: number): number {
  return Math.round((TIME_UNIT * sampleRate) / clockRate)
}

export class BandlimitedBuf {
  /** Delta accumulator. Sized so a full frame plus one kernel tail always fits. */
  readonly buf: Float64Array
  /** Shared, sample-rate-independent kernel table. */
  readonly kernel: Float64Array = STEP_KERNEL
  readonly maxSamplesPerFrame: number

  clockRate = 0
  sampleRate = 0
  /** Fixed-point sample time per cycle. */
  factor = 0
  /** Fixed-point time already accumulated but not yet read out. Always ≥ 0 and, after
   *  a `readSamples` that consumed everything available, < TIME_UNIT. */
  offset = 0

  private integrator = 0

  constructor(maxSamplesPerFrame: number = DEFAULT_MAX_SAMPLES_PER_FRAME) {
    this.maxSamplesPerFrame = maxSamplesPerFrame
    this.buf = new Float64Array(maxSamplesPerFrame + KERNEL_WIDTH + 2)
  }

  setRates(clockRate: number, sampleRate: number): void {
    this.clockRate = clockRate
    this.sampleRate = sampleRate
    this.factor = factorFor(clockRate, sampleRate)
    this.clear()
  }

  clear(): void {
    this.buf.fill(0)
    this.offset = 0
    this.integrator = 0
  }

  /** Test hook: the running integration state, i.e. the DC level the next sample
   *  would start from. */
  get integratorValue(): number {
    return this.integrator
  }

  /** Whole output samples currently renderable. */
  get samplesAvail(): number {
    return Math.floor(this.offset / TIME_UNIT)
  }

  /** Splat one band-limited step edge. `cycleTime` is relative to the frame origin.
   *  Touches buf[pos .. pos+KERNEL_WIDTH−1] only — the kernel is causal in buffer
   *  terms, so no left guard region is needed. */
  addDelta(cycleTime: number, delta: number): void {
    const t = this.offset + cycleTime * this.factor // exact integer in f64
    const pos = Math.floor(t / TIME_UNIT) // NOT t >> TIME_BITS
    const frac = t - pos * TIME_UNIT
    const ph = frac * (PHASE_COUNT / TIME_UNIT)
    const p0 = Math.floor(ph)
    const b = ph - p0
    const a = 1 - b
    const k0 = p0 * KERNEL_WIDTH
    const k1 = k0 + KERNEL_WIDTH
    const d0 = delta * a
    const d1 = delta * b
    const K = this.kernel
    const buf = this.buf
    for (let i = 0; i < KERNEL_WIDTH; i++) buf[pos + i] += K[k0 + i] * d0 + K[k1 + i] * d1
  }

  /** Advance fixed-point time by `cycleCount` CPU cycles and report how many whole
   *  output samples are now available. Throws rather than corrupting the buffer. */
  endFrame(cycleCount: number): number {
    this.offset += cycleCount * this.factor
    const avail = Math.floor(this.offset / TIME_UNIT)
    if (avail + KERNEL_WIDTH > this.buf.length) throw new RangeError('BandlimitedBuf overflow')
    return avail
  }

  /** Cycles that must still elapse before `count` whole samples are available.
   *  With offset 0 and factor 112 487 this is 4 773 for a 128-frame quantum — the
   *  pull-driven `process()` uses exactly this so the ratio error can never underrun. */
  cyclesForSamples(count: number): number {
    return Math.ceil((count * TIME_UNIT - this.offset) / this.factor)
  }

  /** Running integration = the step trick. Consumes what it returns. */
  readSamples(out: Float64Array, outOffset: number, count: number): number {
    const avail = Math.floor(this.offset / TIME_UNIT)
    const n = count < avail ? count : avail
    const buf = this.buf
    let sum = this.integrator
    for (let i = 0; i < n; i++) {
      sum += buf[i]
      out[outOffset + i] = sum
    }
    this.integrator = sum
    const live = avail + KERNEL_WIDTH
    buf.copyWithin(0, n, live)
    buf.fill(0, live - n, live)
    this.offset -= n * TIME_UNIT
    return n
  }
}
