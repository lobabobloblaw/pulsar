/** Host-side owner of the AudioContext, the worklet node and the write transport.
 *
 *  Two transports live behind one `WriteSink` surface, chosen at runtime:
 *
 *    sab          `crossOriginIsolated === true` and SharedArrayBuffer exists. Writes
 *                 go straight into the shared ring; `flush()` is a no-op because
 *                 there is nothing to hand over. Diagnostics are five Atomics.load
 *                 from the ring header.
 *    postMessage  everything else, byte-for-byte the M2 path: writes accumulate in a
 *                 pooled pair of typed arrays and `flush()` transfers them, the
 *                 worklet hands the pair back through `recycle`. Diagnostics come
 *                 from a ~10 Hz `stats` message.
 *
 *  Nothing upstream knows which one is live — `transport` and `diagnostics()` exist so
 *  the UI can say so truthfully (plan C10: the `sab` chip), not so callers can branch.
 *
 *  `write()` is called at keydown and pointermove rate and allocates on neither path.
 */
import { APU_PROCESSOR_NAME, APU_WORKLET_URL } from './workletUrl'
import { DEFAULT_LEAD_MS, type LiveEngine } from './liveScheduler'
import {
  applyStats,
  newDiagnostics,
  readRingCounters,
  type Diagnostics,
  type MutableDiagnostics,
} from './diagnostics'
import { NTSC_CPU_HZ, DEFAULT_MASTER_GAIN } from '../core/constants'
import { headerView } from '../protocol/layout'
import { RingProducer, createSharedRing } from '../protocol/writeRing'
import {
  WRITE_BATCH_CAPACITY,
  WRITE_POOL_DEPTH,
  type TransportKind,
  type WireCodes,
  type WireCycles,
  type WorkletToHostMessage,
} from '../protocol/messages'
import { cyclesForMs, nowCycle, type ClockAnchor } from '../timeline/clockMap'
import { encodeWrite, type NesCycle, type RegAddr, type WriteSink } from '../timeline/types'

interface WriteBatch {
  cycles: WireCycles
  codes: WireCodes
}

export interface StartEngineOptions {
  clockRate?: number
  consoleModel?: 'nes' | 'famicom'
  mixerMode?: 'lut' | 'linear'
  masterGain?: number
  /** How far ahead of `nowCycle()` live events are scheduled. Default 6 ms. */
  leadMs?: number
  /** Force the postMessage path even where the SAB would work — the resilience check
   *  ("strip COOP/COEP, audio still works") without touching server headers. */
  forcePostMessage?: boolean
}

export { DEFAULT_LEAD_MS }

/** True when the page can actually allocate a SharedArrayBuffer the worklet may map.
 *  Both halves matter: Firefox exposes the constructor without isolation but the
 *  buffer is not shareable, and a non-isolated Chrome tab has no constructor at all. */
export function sabAvailable(): boolean {
  return typeof SharedArrayBuffer === 'function' && crossOriginIsolated === true
}

export class EngineHandle implements WriteSink, LiveEngine {
  readonly ctx: AudioContext
  readonly node: AudioWorkletNode
  readonly clockRate: number
  readonly transport: TransportKind
  leadMs: number

  private anchorValue: ClockAnchor | null = null
  private readonly readyPromise: Promise<ClockAnchor>
  private resolveReady: (a: ClockAnchor) => void = () => {}

  /** SAB path. */
  private readonly producer: RingProducer | null
  private readonly header: Int32Array | null

  /** postMessage path. */
  private readonly pool: WriteBatch[] = []
  private current: WriteBatch | null = null
  private count = 0

  private readonly snapshot: MutableDiagnostics
  private disposed = false

  constructor(
    ctx: AudioContext,
    node: AudioWorkletNode,
    opts: StartEngineOptions,
    ring: SharedArrayBuffer | null,
  ) {
    this.ctx = ctx
    this.node = node
    this.clockRate = opts.clockRate ?? NTSC_CPU_HZ
    this.leadMs = opts.leadMs ?? DEFAULT_LEAD_MS
    this.transport = ring === null ? 'postMessage' : 'sab'
    this.producer = ring === null ? null : new RingProducer(ring)
    this.header = ring === null ? null : headerView(ring)
    this.snapshot = newDiagnostics(this.transport, ctx.sampleRate)
    this.readyPromise = new Promise<ClockAnchor>((resolve) => {
      this.resolveReady = resolve
    })
    node.port.onmessage = (ev: MessageEvent): void => {
      this.handleMessage(ev.data as WorkletToHostMessage)
    }
    // The pool exists on both paths: it costs 8 KiB and it means a fallback engine
    // constructed after a SAB failure needs no second code path.
    for (let i = 0; i < WRITE_POOL_DEPTH; i++) this.pool.push(newBatch())
  }

  /** Resolves once the worklet has rendered its first quantum and published the
   *  clock anchor. Nothing can be scheduled on the timeline before this. */
  ready(): Promise<ClockAnchor> {
    return this.readyPromise
  }

  get anchor(): ClockAnchor | null {
    return this.anchorValue
  }

  /** Current position on the engine's cycle timeline. Returns 0 until `ready()`. */
  nowCycle(): NesCycle {
    const a = this.anchorValue
    if (a === null) return 0
    return nowCycle(a, this.ctx.currentTime)
  }

  /** The cycle live input should be scheduled at: now plus the scheduling lead. */
  scheduleCycle(): NesCycle {
    const a = this.anchorValue
    if (a === null) return 0
    return nowCycle(a, this.ctx.currentTime) + cyclesForMs(a, this.leadMs)
  }

  // --- WriteSink ---------------------------------------------------------------

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    if (this.disposed) return
    const producer = this.producer
    if (producer !== null) {
      producer.push(cycle, addr, value)
      return
    }
    let cur = this.current
    if (cur === null) {
      cur = this.acquire()
      this.current = cur
      this.count = 0
    }
    const i = this.count
    cur.cycles[i] = cycle
    cur.codes[i] = encodeWrite(addr, value)
    this.count = i + 1
    if (this.count >= WRITE_BATCH_CAPACITY) this.flush()
  }

  /** Hand the current batch to the worklet. A no-op on the SAB path — the ring is
   *  already visible to the other thread the moment `push` released its index — and
   *  safe to call with nothing pending. */
  flush(): void {
    if (this.producer !== null) return
    const cur = this.current
    if (cur === null || this.count === 0 || this.disposed) return
    this.node.port.postMessage(
      { t: 'writes', cycles: cur.cycles, codes: cur.codes, count: this.count },
      [cur.cycles.buffer, cur.codes.buffer],
    )
    this.current = null
    this.count = 0
  }

  // --- LiveEngine ---------------------------------------------------------------

  /** Writes queued but not yet drained. Diagnostic only, and the SECOND of the two
   *  narrow additive host APIs phase 2 is allowed (design §2.6): the tracker's `[drv]`
   *  chip shows ring occupancy so a main-thread stall is visible rather than
   *  mysterious. `0` on the postMessage path, which hands its batch over whole. */
  get pending(): number {
    return this.producer === null ? 0 : this.producer.pending
  }

  /** Late writes seen so far. The adaptive-lead controller samples this every 2 s. */
  lateWrites(): number {
    return this.diagnostics().lateWrites
  }

  setMasterGain(gain: number): void {
    this.setConfig({ masterGain: gain })
  }

  // --- diagnostics ---------------------------------------------------------------

  /** Pull the current counters. Cheap enough for a 10 Hz UI poll: five Atomics.load
   *  on the SAB path, a struct copy on the fallback. The returned object is REUSED —
   *  read the fields, do not keep the reference. */
  diagnostics(): Diagnostics {
    const d = this.snapshot
    d.leadMs = this.leadMs
    d.sampleRate = this.ctx.sampleRate
    d.baseLatencyMs = this.ctx.baseLatency * 1000
    const outputLatency = this.ctx.outputLatency
    d.outputLatencyMs = typeof outputLatency === 'number' ? outputLatency * 1000 : 0
    const header = this.header
    if (header !== null) readRingCounters(d, header)
    return d
  }

  setConfig(config: {
    consoleModel?: 'nes' | 'famicom'
    mixerMode?: 'lut' | 'linear'
    masterGain?: number
  }): void {
    if (this.disposed) return
    this.node.port.postMessage({ t: 'config', ...config })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.node.port.postMessage({ t: 'stop' })
    this.node.port.onmessage = null
    this.node.disconnect()
    await this.ctx.close()
  }

  private acquire(): WriteBatch {
    const b = this.pool.pop()
    return b ?? newBatch()
  }

  private handleMessage(msg: WorkletToHostMessage): void {
    if (msg.t === 'ready') {
      this.anchorValue = msg.anchor
      this.resolveReady(msg.anchor)
      return
    }
    if (msg.t === 'stats') {
      applyStats(this.snapshot, msg.stats)
      return
    }
    if (msg.t === 'recycle' && this.pool.length < WRITE_POOL_DEPTH) {
      this.pool.push({ cycles: msg.cycles, codes: msg.codes })
    }
  }
}

function newBatch(): WriteBatch {
  return {
    cycles: new Float64Array(WRITE_BATCH_CAPACITY),
    codes: new Int32Array(WRITE_BATCH_CAPACITY),
  }
}

/** Must be called from a user gesture (autoplay policy). A fresh AudioContext per
 *  start — addModule() is one-shot per processor name per context, so dispose()
 *  fully closes the context and the cache-busted URL keeps reloads deterministic.
 *  `sampleRate` is deliberately NOT passed: forcing it inserts Chrome's resampler
 *  (deviation D8). The worklet reads the real rate and derives everything from it. */
export async function startEngine(opts: StartEngineOptions = {}): Promise<EngineHandle> {
  // iOS routes Web Audio through the AMBIENT session by default, which the
  // ringer switch silences — an instrument that mutes with the ringer reads as
  // broken. Where the Audio Session API exists (iOS 16.4+), ask for playback.
  // Best-effort on purpose: unknown elsewhere, and never worth failing over.
  if (typeof navigator !== 'undefined') {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    try {
      if (nav.audioSession !== undefined) nav.audioSession.type = 'playback'
    } catch {
      /* the session keeps its default */
    }
  }
  const ctx = new AudioContext({ latencyHint: 'interactive' })
  const sep = APU_WORKLET_URL.includes('?') ? '&' : '?'
  await ctx.audioWorklet.addModule(`${APU_WORKLET_URL}${sep}v=${Date.now()}`)
  const node = new AudioWorkletNode(ctx, APU_PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  })

  // The transport decision, made once, here. `createSharedRing` returns null rather
  // than throwing when SharedArrayBuffer is missing, so a page served without
  // COOP/COEP degrades to postMessage instead of failing to start.
  const ring = opts.forcePostMessage === true || !sabAvailable()
    ? null
    : createSharedRing(ctx.sampleRate)

  const handle = new EngineHandle(ctx, node, opts, ring)
  node.connect(ctx.destination)

  const init: {
    t: 'init'
    clockRate: number
    consoleModel: 'nes' | 'famicom'
    mixerMode: 'lut' | 'linear'
    masterGain: number
    ring?: SharedArrayBuffer
  } = {
    t: 'init',
    clockRate: opts.clockRate ?? NTSC_CPU_HZ,
    consoleModel: opts.consoleModel ?? 'nes',
    mixerMode: opts.mixerMode ?? 'lut',
    masterGain: opts.masterGain ?? DEFAULT_MASTER_GAIN,
  }
  if (ring !== null) init.ring = ring
  node.port.postMessage(init)

  if (ctx.state === 'suspended') await ctx.resume()
  return handle
}
