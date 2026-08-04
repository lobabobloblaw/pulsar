/** The shared offline renderer (design §5.4): a song in, a `Float32Array` out, through
 *  the real `Apu2A03` core, faster than realtime and deterministic.
 *
 *  It lives in `src/`, not in `tests/`, for one decisive reason: **phase 3's WAV export
 *  is this function**, plus an encoder and a download. Putting it in `tests/` would
 *  guarantee it gets rewritten. Preset QA (§5.5) and the golden song tests consume it
 *  today; the exporter will consume it tomorrow.
 *
 *  The loop below is the same four lines as the worklet's `process()` and as
 *  `tests/helpers/renderTrace.ts`: derive a cycle target from the engine's own
 *  fixed-point clock, produce every write up to it, close the frame, read the samples.
 *  Rendering through the identical path is what lets a preset checksum mean anything.
 *
 *  DOM-free, so it typechecks under `tsconfig.test.json` and can move to a worker
 *  unchanged.
 */
import { Apu2A03 } from '../audio/core/apu2a03'
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ } from '../audio/core/constants'
import { TrackerDriver, type DriverClock, type PlayMode } from './driver/trackerDriver'
import { decodeBase64 } from './model/validate'
import type { Song } from './model/types'

export interface OfflineRenderResult {
  samples: Float32Array
  sampleRate: number
  cycles: number
  clippedSamples: number
  noteOns: number
  rowsPlayed: number
  checksum: number
}

export interface OfflineRenderOptions {
  sampleRate?: number
  /** Hard ceiling, so a song with no `Cxx` and a `B00` loop cannot render forever. */
  maxSeconds?: number
  /** How many times the order walk may return to (or before) its start before the
   *  render stops. 1 = a single pass. */
  loops?: number
  consoleModel?: 'nes' | 'famicom'
  masterGain?: number
  mode?: PlayMode
  from?: { order: number; row: number }
  /** Channel indices to mute — the "all four channels audible" gate renders one pass
   *  per channel with the others muted and asserts each is above −40 dBFS. */
  mute?: readonly number[]
  /** Render only this channel. −1 (default) renders the mix. */
  soloChannel?: number
  /** Samples per render call. 128 mirrors the Web Audio render quantum. */
  quantum?: number
}

/** Where the 32 KiB `$8000–$FFFF` DPCM image places each sample. */
export interface DpcmImage {
  memory: Uint8Array
  /** `sampleIndex -> { address: $4012 units, length: $4013 units }`. */
  layout: Map<number, { address: number; length: number }>
}

/** Pack the song's samples 64-byte aligned from `$C000` into the 32 KiB image the
 *  core's memory reader sees. Returns null when the song has no samples. */
export function buildDpcmImage(song: Song): DpcmImage | null {
  if (song.samples.length === 0) return null
  const memory = new Uint8Array(0x8000)
  const layout = new Map<number, { address: number; length: number }>()
  // $C000 is offset 0x4000 in an image that starts at $8000.
  let at = 0x4000
  for (let i = 0; i < song.samples.length; i++) {
    const bytes = decodeBase64(song.samples[i].data)
    if (bytes === null || bytes.length === 0) continue
    if (at + bytes.length > memory.length) break
    memory.set(bytes, at)
    layout.set(i, {
      address: (at - 0x4000) / 64,
      length: Math.max(0, Math.floor((bytes.length - 1) / 16)),
    })
    at += Math.ceil(bytes.length / 64) * 64
  }
  return { memory, layout }
}

class ApuClock implements DriverClock {
  readonly clockRate: number
  constructor(private readonly apu: Apu2A03) {
    this.clockRate = apu.clockRate
  }
  nowCycle(): number {
    return this.apu.cycle
  }
}

export function renderSong(song: Song, opts: OfflineRenderOptions = {}): OfflineRenderResult {
  const sampleRate = opts.sampleRate ?? 48000
  const quantum = opts.quantum ?? 128
  const maxSeconds = opts.maxSeconds ?? 300
  const loops = opts.loops ?? 1

  const apu = new Apu2A03({
    sampleRate,
    clockRate: NTSC_CPU_HZ,
    consoleModel: opts.consoleModel ?? 'nes',
    masterGain: opts.masterGain ?? DEFAULT_MASTER_GAIN,
    maxSamplesPerFrame: Math.max(512, quantum),
  })
  const image = buildDpcmImage(song)
  if (image !== null) apu.setDpcmMemory(image.memory)

  const driver = new TrackerDriver(apu, new ApuClock(apu), { song })
  if (image !== null) driver.dpcmLayout = image.layout
  if (opts.mute !== undefined) for (const ch of opts.mute) driver.setChannelMute(ch, true)
  if (opts.soloChannel !== undefined) driver.setSoloChannel(opts.soloChannel)

  driver.play(opts.mode ?? 'song', opts.from)

  const maxSamples = Math.ceil(maxSeconds * sampleRate)
  const out = new Float32Array(maxSamples)
  let written = 0
  let tail = 0

  while (written < maxSamples) {
    const want = Math.min(quantum, maxSamples - written)
    const target = apu.cycle + apu.cyclesForSamples(want)
    driver.runTo(target)
    apu.endFrame(target)
    const got = apu.readSamples(out, written, want)
    if (got === 0) break
    written += got

    if (tail > 0) {
      tail--
      if (tail === 0) break
      continue
    }
    if (!driver.playing) {
      // The driver already emitted its all-channels-off writes; render one more
      // quantum so they reach the core.
      tail = 2
      continue
    }
    if (driver.stats.loops >= loops) {
      // Stop ON the frame boundary we just closed, not at the driver's lookahead
      // horizon: an offline render owns its own frame timing, and a write past the
      // frame would overflow the band-limited buffer.
      driver.stop(target)
      tail = 2
    }
  }

  const samples = out.subarray(0, written)
  return {
    samples,
    sampleRate,
    cycles: apu.cycle,
    clippedSamples: apu.stats.clippedSamples,
    noteOns: driver.stats.noteOns,
    rowsPlayed: driver.stats.rowsPlayed,
    checksum: fnv1a(samples),
  }
}

/** FNV-1a over the raw sample bytes — the same shape as the phase-1 golden traces'
 *  pin, so a preset's checksum can only change when its audio does. */
export function fnv1a(samples: Float32Array): number {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** RMS in dBFS, for the preset level gates. −Infinity for pure silence. */
export function rmsDb(samples: Float32Array, from = 0, to = samples.length): number {
  let sum = 0
  const n = Math.max(0, to - from)
  if (n === 0) return -Infinity
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / n)
  return rms === 0 ? -Infinity : 20 * Math.log10(rms)
}
