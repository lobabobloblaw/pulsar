/** The diagnostics snapshot — one typed struct, filled from whichever transport is
 *  live (plan B1 M3: "diagnostics panel"; plan C10: the StatusBar chips).
 *
 *  Two sources, one shape:
 *    SAB path          five Atomics.load from the ring header, on demand
 *    postMessage path  the last `stats` message the worklet posted (~10 Hz)
 *
 *  Nothing here touches the DOM or the AudioContext, so the same module is importable
 *  from a plain node test and from the adaptive-lead controller in `liveScheduler`.
 *  The engine owns the latency/lead fields; this module owns the counters.
 *
 *  The snapshot object is REUSED between polls (the UI is expected to poll at ~10 Hz
 *  and read the fields immediately, exactly like `bridge.meter`). Copy anything you
 *  need to keep.
 */
import { RENDER_QUANTUM } from '../core/constants'
import {
  I_DROPPED,
  I_LATE,
  I_PEAK_PROCESS_NS,
  I_UNDERRUNS,
} from '../protocol/layout'
import type { StatsPayload, TransportKind } from '../protocol/messages'

export interface Diagnostics {
  /** Which write transport is actually live — not which one was hoped for. */
  readonly transport: TransportKind
  /** `AudioContext.baseLatency`, in ms. */
  readonly baseLatencyMs: number
  /** `AudioContext.outputLatency`, in ms. 0 where the browser does not report it. */
  readonly outputLatencyMs: number
  /** Current scheduling lead, in ms. Moves under the adaptive controller. */
  readonly leadMs: number
  /** Writes whose timestamp had already passed; clamped, never dropped. */
  readonly lateWrites: number
  /** Writes lost to a full ring — should be 0 forever. */
  readonly droppedWrites: number
  /** Render quanta the engine could not fill. */
  readonly underruns: number
  /** Worst `process()` seen so far, in µs. The M8 budget is 267 µs. */
  readonly peakProcessUs: number
  /** `peakProcessUs` as a percentage of the quantum's wall-clock duration. */
  readonly dspLoadPct: number
  readonly sampleRate: number
}

/** The writable face of the snapshot. Only the engine holds one. */
export type MutableDiagnostics = { -readonly [K in keyof Diagnostics]: Diagnostics[K] }

export function newDiagnostics(transport: TransportKind, sampleRate = 0): MutableDiagnostics {
  return {
    transport,
    baseLatencyMs: 0,
    outputLatencyMs: 0,
    leadMs: 0,
    lateWrites: 0,
    droppedWrites: 0,
    underruns: 0,
    peakProcessUs: 0,
    dspLoadPct: 0,
    sampleRate,
  }
}

/** Peak `process()` cost as a percentage of the deadline. One quantum is
 *  `RENDER_QUANTUM / sampleRate` seconds — 2.67 ms at 48 kHz — and the M8 gate wants
 *  the peak under 10 % of it. */
export function dspLoadPercent(
  peakProcessUs: number,
  sampleRate: number,
  quantum: number = RENDER_QUANTUM,
): number {
  if (!(sampleRate > 0)) return 0
  const quantumUs = (quantum / sampleRate) * 1e6
  return (peakProcessUs / quantumUs) * 100
}

/** SAB path: read the counters the two threads publish into the ring header.
 *  `droppedWrites` is the producer's, the rest are the worklet's. */
export function readRingCounters(into: MutableDiagnostics, header: Int32Array): void {
  into.droppedWrites = Atomics.load(header, I_DROPPED)
  into.lateWrites = Atomics.load(header, I_LATE)
  into.underruns = Atomics.load(header, I_UNDERRUNS)
  into.peakProcessUs = Atomics.load(header, I_PEAK_PROCESS_NS) / 1000
  into.dspLoadPct = dspLoadPercent(into.peakProcessUs, into.sampleRate)
}

/** postMessage path: fold in the last stats message. The worklet counts its own
 *  dropped writes there, because on that path the ring it can overflow is its own. */
export function applyStats(into: MutableDiagnostics, stats: StatsPayload): void {
  into.lateWrites = stats.lateWrites
  into.droppedWrites = stats.droppedWrites
  into.underruns = stats.underruns
  into.peakProcessUs = stats.peakProcessNs / 1000
  into.dspLoadPct = dspLoadPercent(into.peakProcessUs, into.sampleRate)
}

/** One line for the selftest log and the dev chip. Allocates — main thread only. */
export function formatDiagnostics(d: Diagnostics): string {
  return (
    `transport=${d.transport} rate=${d.sampleRate} lead=${d.leadMs.toFixed(1)}ms ` +
    `base=${d.baseLatencyMs.toFixed(2)}ms out=${d.outputLatencyMs.toFixed(2)}ms ` +
    `late=${d.lateWrites} dropped=${d.droppedWrites} underruns=${d.underruns} ` +
    `peak=${d.peakProcessUs.toFixed(1)}us load=${d.dspLoadPct.toFixed(1)}%`
  )
}
