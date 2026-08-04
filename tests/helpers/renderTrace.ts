/** Offline renderer that drives Apu2A03 exactly the way the worklet does.
 *
 *  The loop below is the same four lines as `process()`: derive a cycle target from
 *  the engine's own fixed-point clock, drain every write up to it, close the frame,
 *  read the samples. Rendering offline through the identical path is what lets
 *  determinism.test.ts claim chunk independence and lets aliasing.test.ts claim it is
 *  measuring the shipped signal path rather than a test-only shortcut.
 */
import { Apu2A03, type Apu2A03Options } from '../../src/audio/core/apu2a03'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'

export interface RenderOptions {
  sampleRate: number
  durationSamples: number
  /** Samples per render call. 128 mirrors the Web Audio render quantum. */
  quantum?: number
  clockRate?: number
  consoleModel?: 'nes' | 'famicom'
  mixerMode?: 'lut' | 'linear'
  masterGain?: number
  analogFilters?: boolean
  maxSamplesPerFrame?: number
  /** Cycle the engine's timeline starts at — used by the cycle-origin tests. */
  originCycle?: number
}

export function makeApu(opts: RenderOptions): Apu2A03 {
  const quantum = opts.quantum ?? 128
  const init: Apu2A03Options = {
    sampleRate: opts.sampleRate,
    clockRate: opts.clockRate ?? NTSC_CPU_HZ,
    maxSamplesPerFrame: opts.maxSamplesPerFrame ?? Math.max(512, quantum),
  }
  if (opts.consoleModel !== undefined) init.consoleModel = opts.consoleModel
  if (opts.mixerMode !== undefined) init.mixerMode = opts.mixerMode
  if (opts.masterGain !== undefined) init.masterGain = opts.masterGain
  if (opts.analogFilters !== undefined) init.analogFilters = opts.analogFilters
  return new Apu2A03(init)
}

/** Render `durationSamples` of a recorded register timeline. Writes are delivered in
 *  chronological order and never earlier than the quantum they belong to, which is
 *  what the real transport guarantees. */
export function renderTrace(trace: ArrayWriteSink, opts: RenderOptions): Float32Array {
  const apu = makeApu(opts)
  return renderWith(apu, trace, opts)
}

export function renderWith(
  apu: Apu2A03,
  trace: ArrayWriteSink,
  opts: RenderOptions,
): Float32Array {
  const quantum = opts.quantum ?? 128
  const out = new Float32Array(opts.durationSamples)
  let written = 0
  let cursor = 0
  while (written < out.length) {
    const want = Math.min(quantum, out.length - written)
    const target = apu.cycle + apu.cyclesForSamples(want)
    cursor = trace.replayUpTo(apu, target, cursor)
    apu.endFrame(target)
    const got = apu.readSamples(out, written, want)
    if (got === 0) throw new Error('renderTrace: engine produced no samples')
    written += got
  }
  return out
}

/** A held pulse-1 note in canonical order, all writes on one cycle (plan B6). */
export function pulseNoteOnTrace(
  cycle: number,
  timer: number,
  duty: number,
  volume: number,
): ArrayWriteSink {
  const trace = new ArrayWriteSink()
  trace.write(cycle, 0x4015, 0x01)
  trace.write(cycle, 0x4000, ((duty & 3) << 6) | 0x30 | (volume & 0x0f))
  trace.write(cycle, 0x4001, 0x08)
  trace.write(cycle, 0x4002, timer & 0xff)
  trace.write(cycle, 0x4003, (timer >> 8) & 0x07)
  return trace
}

/** A held triangle note: enable, hold the linear counter (control set), then timer.
 *  $400B last — it loads the length counter and sets the linear reload flag. */
export function triangleNoteOnTrace(cycle: number, timer: number): ArrayWriteSink {
  const trace = new ArrayWriteSink()
  trace.write(cycle, 0x4015, 0x04)
  trace.write(cycle, 0x4008, 0xff) // control set → linear counter holds at 127
  trace.write(cycle, 0x400a, timer & 0xff)
  trace.write(cycle, 0x400b, (timer >> 8) & 0x07)
  return trace
}

/** A held noise note. `mode` true selects the 93-step short sequence. */
export function noiseNoteOnTrace(
  cycle: number,
  periodIndex: number,
  volume: number,
  mode = false,
): ArrayWriteSink {
  const trace = new ArrayWriteSink()
  trace.write(cycle, 0x4015, 0x08)
  trace.write(cycle, 0x400c, 0x30 | (volume & 0x0f)) // halt + constant volume
  trace.write(cycle, 0x400e, (mode ? 0x80 : 0) | (periodIndex & 0x0f))
  trace.write(cycle, 0x400f, 0x00)
  return trace
}
