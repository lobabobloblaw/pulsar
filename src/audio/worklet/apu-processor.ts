/** The only file in the project that touches AudioWorklet globals.
 *
 *  Pull-driven render, per plan B6: each quantum asks the engine how many cycles it
 *  owes for `n` output samples, drains every scheduled register write up to exactly
 *  that cycle, closes the frame there, and reads the samples out. Because the target
 *  is derived from the engine's own fixed-point clock, the sample-rate ratio error can
 *  never accumulate into an underrun — it only ever shows up as the documented
 *  −0.0034-cent tuning offset (deviation D-B1).
 *
 *  Transport: whichever queue the `init` message hands over. With a SharedArrayBuffer
 *  it is `RingConsumer`, draining the host's ring directly and publishing diagnostics
 *  back through the same header with Atomics; without one it is `LocalWriteRing`, fed
 *  by transferred `writes` batches in `port.onmessage`. Both implement the same
 *  `drainUpTo(limit, sink)` contract, so the four lines below — and therefore every
 *  sample this file produces — are identical on both paths. That is the M3 gate, and
 *  tests/unit/writeRing.test.ts renders both queues through Apu2A03 to prove it.
 *
 *  Allocation policy: `process()` allocates nothing at all. The queues, the sample
 *  scratch, the stats message and the timing closure are all built in the constructor
 *  or in `onmessage`, never on the hot path. Indexed `for` loops only — `for...of`
 *  over a typed array allocates an iterator.
 *
 *  The module-URL meta property must never appear anywhere in this module graph:
 *  Vite's IIFE worklet output replaces it with `undefined`. The build gate greps for
 *  it, so this comment deliberately does not spell it out.
 */
import { Apu2A03 } from '../core/apu2a03'
import { NTSC_CPU_HZ, RENDER_QUANTUM } from '../core/constants'
import { makeClockAnchor } from '../timeline/clockMap'
import { LocalWriteRing, RingConsumer } from '../protocol/writeRing'
import {
  STATS_INTERVAL_HZ,
  type HostToWorkletMessage,
  type RecycleMessage,
  type StatsPayload,
} from '../protocol/messages'

type MutableRecycle = { -readonly [K in keyof RecycleMessage]: RecycleMessage[K] }
type MutableStats = { -readonly [K in keyof StatsPayload]: StatsPayload[K] }
type MutableStatsMessage = { readonly t: 'stats'; readonly stats: MutableStats }

/** `performance` is not part of the AudioWorkletGlobalScope IDL, but Chrome exposes
 *  it. Detected ONCE, in the constructor: a `typeof` probe per `process()` would be a
 *  branch on the hot path for a value that cannot change. */
interface PerfLike {
  now(): number
}

function detectPerformanceNow(): (() => number) | null {
  const g = globalThis as unknown as { performance?: PerfLike }
  const p = g.performance
  if (p === undefined || typeof p.now !== 'function') return null
  return () => p.now()
}

class PulsarApuProcessor extends AudioWorkletProcessor {
  private readonly apu: Apu2A03

  /** The fallback transport's queue. Fed by `port.onmessage`, drained by `process()`.
   *  Preallocated here so a burst of key presses costs no garbage. */
  private readonly localRing = new LocalWriteRing()
  /** The SAB transport's queue, once `init` hands one over. */
  private consumer: RingConsumer | null = null

  private started = false
  private stopped = false
  private underruns = 0
  private peakProcessNs = 0

  /** Bound once; null where the global is absent (then load reporting stays 0). */
  private readonly perfNow: (() => number) | null

  /** Fallback-path stats cadence, in quanta. */
  private readonly statsInterval: number
  private quantaSinceStats = 0

  /** Preallocated so returning buffers to the host pool costs no steady-state garbage. */
  private readonly recycleMsg: MutableRecycle = {
    t: 'recycle',
    cycles: new Float64Array(0),
    codes: new Int32Array(0),
  }
  private readonly recycleTransfer: Transferable[] = [
    this.recycleMsg.cycles.buffer,
    this.recycleMsg.codes.buffer,
  ]

  /** One stats object for the life of the processor: the fallback path mutates and
   *  re-posts it, so the ~10 Hz uplink allocates nothing on the audio thread. */
  private readonly statsMsg: MutableStatsMessage = {
    t: 'stats',
    stats: {
      lateWrites: 0,
      droppedWrites: 0,
      clippedSamples: 0,
      deltasEmitted: 0,
      eventsProcessed: 0,
      frameSkips: 0,
      underruns: 0,
      peakProcessNs: 0,
      cycle: 0,
    },
  }

  constructor() {
    super()
    this.apu = new Apu2A03({ sampleRate, clockRate: NTSC_CPU_HZ, maxSamplesPerFrame: 512 })
    this.perfNow = detectPerformanceNow()
    this.statsInterval = Math.max(1, Math.round(sampleRate / STATS_INTERVAL_HZ / RENDER_QUANTUM))
    this.port.onmessage = (ev: MessageEvent): void => {
      this.handleMessage(ev.data as HostToWorkletMessage)
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0]
    if (channels === undefined) return true
    const out = channels[0]
    if (out === undefined) return true
    const n = out.length

    const perfNow = this.perfNow
    const t0 = perfNow === null ? 0 : perfNow()

    if (!this.started) {
      this.started = true
      const consumer = this.consumer
      if (consumer !== null) consumer.setRunning(true)
      this.port.postMessage({
        t: 'ready',
        anchor: makeClockAnchor(currentFrame, sampleRate, this.apu.clockRate),
        sampleRate,
      })
    }

    const apu = this.apu
    const target = apu.cycle + apu.cyclesForSamples(n)
    const consumer = this.consumer
    if (consumer !== null) consumer.drainUpTo(target, apu)
    else this.localRing.drainUpTo(target, apu)
    apu.endFrame(target)
    const got = apu.readSamples(out, 0, n)
    if (got < n) {
      for (let i = got; i < n; i++) out[i] = 0
      this.underruns++
      apu.stats.frameSkips++
    }

    if (perfNow !== null) {
      // Measured before publishing, so the diagnostics uplink never inflates the
      // number it is reporting. The peak is a running max — exactly what the M8 soak
      // gate ("peak process() < 267 µs") wants.
      const ns = Math.round((perfNow() - t0) * 1e6)
      if (ns > this.peakProcessNs) this.peakProcessNs = ns
    }
    this.publishStats()

    return !this.stopped
  }

  /** SAB path: four atomic stores, every quantum, no allocation and no message.
   *  Fallback path: one preallocated message at ~10 Hz. */
  private publishStats(): void {
    const stats = this.apu.stats
    const consumer = this.consumer
    if (consumer !== null) {
      consumer.publishStats(
        stats.lateWrites,
        this.underruns,
        this.peakProcessNs,
        stats.clippedSamples,
      )
      return
    }
    this.quantaSinceStats++
    if (this.quantaSinceStats < this.statsInterval) return
    this.quantaSinceStats = 0
    const s = this.statsMsg.stats
    s.lateWrites = stats.lateWrites
    s.droppedWrites = this.localRing.droppedWrites
    s.clippedSamples = stats.clippedSamples
    s.deltasEmitted = stats.deltasEmitted
    s.eventsProcessed = stats.eventsProcessed
    s.frameSkips = stats.frameSkips
    s.underruns = this.underruns
    s.peakProcessNs = this.peakProcessNs
    s.cycle = this.apu.cycle
    this.port.postMessage(this.statsMsg)
  }

  private handleMessage(msg: HostToWorkletMessage): void {
    switch (msg.t) {
      case 'writes': {
        const accepted = this.localRing.enqueue(msg.cycles, msg.codes, msg.count)
        if (accepted < msg.count) this.apu.stats.droppedWrites = this.localRing.droppedWrites
        this.recycleMsg.cycles = msg.cycles
        this.recycleMsg.codes = msg.codes
        this.recycleTransfer[0] = msg.cycles.buffer
        this.recycleTransfer[1] = msg.codes.buffer
        this.port.postMessage(this.recycleMsg, this.recycleTransfer)
        return
      }
      case 'init': {
        // The ring's presence IS the transport decision. Constructing the consumer
        // here allocates three views once, off the render path.
        if (msg.ring !== undefined) {
          const consumer = new RingConsumer(msg.ring)
          consumer.publishSampleRate(sampleRate)
          if (this.started) consumer.setRunning(true)
          this.consumer = consumer
        }
        this.applyConfig(msg.consoleModel, msg.mixerMode, msg.masterGain)
        return
      }
      case 'config':
        this.applyConfig(msg.consoleModel, msg.mixerMode, msg.masterGain)
        return
      case 'dpcm':
        this.apu.setDpcmMemory(msg.mem)
        return
      case 'stop': {
        this.stopped = true
        const consumer = this.consumer
        if (consumer !== null) consumer.setRunning(false)
        return
      }
      default:
        return
    }
  }

  private applyConfig(
    consoleModel: 'nes' | 'famicom' | undefined,
    mixerMode: 'lut' | 'linear' | undefined,
    masterGain: number | undefined,
  ): void {
    if (consoleModel !== undefined) this.apu.setConsoleModel(consoleModel)
    if (mixerMode !== undefined) this.apu.setMixerMode(mixerMode)
    if (masterGain !== undefined) this.apu.masterGain = masterGain
  }
}

registerProcessor('pulsar-apu', PulsarApuProcessor)
