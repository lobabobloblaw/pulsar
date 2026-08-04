/** Song builders and a driver harness for the WP9 tracker tests.
 *
 *  Lives under `tests/fixtures/songs/` because that is what it is — fixture
 *  construction — and because WP9 owns that tree outright. Not a `.test.ts`, so vitest
 *  never collects it as a suite.
 *
 *  Everything here goes through the REAL `parseSong`, so a fixture that a test relies
 *  on cannot quietly be an invalid document.
 */
import { TrackerDriver, type PlayMode } from '../../../src/tracker/driver/trackerDriver'
import { cycleOfTick } from '../../../src/tracker/driver/tempo'
import { parseSong } from '../../../src/tracker/model/validate'
import { emptySong, type Cell, type ChannelId, type Instrument, type Sequence, type SequenceBank, type Song, type SongMeta } from '../../../src/tracker/model/types'
import { NTSC_CPU_HZ } from '../../../src/audio/core/constants'
import { ArrayWriteSink } from '../../../src/audio/timeline/writeSink'

export interface SongSpec {
  /** `"<channel>:<patternIndex>"` -> the pattern's sparse rows. */
  patterns?: Record<string, Cell[]>
  order?: number[][]
  meta?: Partial<SongMeta>
  instruments?: Instrument[]
  sequences?: Partial<Record<keyof SequenceBank, Sequence[]>>
  effectColumns?: number[]
}

const CHANNELS: readonly ChannelId[] = ['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm']

/** Build a valid `Song`. Every pattern referenced by `order` is created, empty, if the
 *  spec did not name it — so a test only writes the rows it cares about. */
export function buildSong(spec: SongSpec = {}): Song {
  const base = emptySong()
  const meta = { ...base.meta, ...spec.meta }
  const order = spec.order ?? [[0, 0, 0, 0, 0]]

  const wanted = new Map<string, Cell[]>()
  for (const frame of order) {
    for (let ch = 0; ch < CHANNELS.length; ch++) wanted.set(`${CHANNELS[ch]}:${frame[ch] ?? 0}`, [])
  }
  for (const [key, rows] of Object.entries(spec.patterns ?? {})) wanted.set(key, rows)

  const patterns = [...wanted.entries()].map(([key, rows]) => {
    const [channel, index] = key.split(':')
    return { channel: channel as ChannelId, index: Number(index), rows }
  })

  const song: Song = {
    ...base,
    meta,
    effectColumns: spec.effectColumns ?? [4, 4, 4, 4, 4],
    order,
    patterns,
    instruments: spec.instruments ?? base.instruments,
    sequences: { ...base.sequences, ...spec.sequences },
  }
  // Round-trip through the validator so a broken fixture fails loudly, here.
  return parseSong(JSON.parse(JSON.stringify(song))).song
}

/** A single-macro instrument, the shape most macro tests want. */
export function instrument(macros: Partial<Instrument['macros']>, name = 'test'): Instrument {
  return {
    name,
    macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: -1, ...macros },
  }
}

export function sequence(values: number[], loop = -1, release = -1, mode?: Sequence['mode']): Sequence {
  return mode === undefined ? { values, loop, release } : { values, loop, release, mode }
}

export interface Emitted {
  addr: number
  value: number
}

export interface DriveResult {
  /** Writes grouped by driver tick index. */
  ticks: Emitted[][]
  /** Every write, flat, with its cycle. */
  sink: ArrayWriteSink
  driver: TrackerDriver
}

/** Run a song for `ticks` driver ticks and group the register writes by tick.
 *
 *  The clock is fixed at 0, so `originCycle` is 0 and tick `n` lands on exactly
 *  `floor(n · clockRate / engineHz)` — which makes the grouping exact rather than
 *  approximate. */
export function drive(
  song: Song,
  ticks: number,
  opts: { mode?: PlayMode; from?: { order: number; row: number }; mute?: number[] } = {},
): DriveResult {
  const sink = new ArrayWriteSink()
  const driver = new TrackerDriver(sink, { clockRate: NTSC_CPU_HZ, nowCycle: () => 0 }, { song })
  for (const ch of opts.mute ?? []) driver.setChannelMute(ch, true)
  driver.play(opts.mode ?? 'song', opts.from)

  const engineHz = song.meta.engineSpeed
  const byCycle = new Map<number, number>()
  for (let n = 0; n < ticks; n++) byCycle.set(cycleOfTick(0, n, NTSC_CPU_HZ, engineHz), n)

  driver.runTo(cycleOfTick(0, ticks - 1, NTSC_CPU_HZ, engineHz))

  const out: Emitted[][] = []
  for (let n = 0; n < ticks; n++) out.push([])
  for (let i = 0; i < sink.length; i++) {
    const tick = byCycle.get(sink.cycles[i])
    if (tick !== undefined) out[tick].push({ addr: sink.addrs[i], value: sink.values[i] })
  }
  return { ticks: out, sink, driver }
}

/** The value written to `addr` on this tick, or −1 when nothing was. */
export function at(ticks: Emitted[][], tick: number, addr: number): number {
  const list = ticks[tick]
  if (list === undefined) return -1
  for (let i = list.length - 1; i >= 0; i--) if (list[i].addr === addr) return list[i].value
  return -1
}

/** The channel's 11-bit timer as it stands after `tick`, tracking write-on-change. */
export function timerSeries(ticks: Emitted[][], loAddr: number): number[] {
  const hiAddr = loAddr + 1
  let lo = -1
  let hi = 0
  const out: number[] = []
  for (const tick of ticks) {
    for (const w of tick) {
      if (w.addr === loAddr) lo = w.value
      else if (w.addr === hiAddr) hi = w.value & 0x07
    }
    out.push(lo < 0 ? -1 : (hi << 8) | lo)
  }
  return out
}

/** The channel's volume nibble as it stands after each tick. */
export function volumeSeries(ticks: Emitted[][], ctrlAddr: number): number[] {
  let v = -1
  const out: number[] = []
  for (const tick of ticks) {
    for (const w of tick) if (w.addr === ctrlAddr) v = w.value & 0x0f
    out.push(v)
  }
  return out
}

/** The channel's duty bits as they stand after each tick. */
export function dutySeries(ticks: Emitted[][], ctrlAddr: number): number[] {
  let d = -1
  const out: number[] = []
  for (const tick of ticks) {
    for (const w of tick) if (w.addr === ctrlAddr) d = (w.value >> 6) & 3
    out.push(d)
  }
  return out
}

/** Count of writes to `addr` across the whole run. */
export function countWrites(sink: ArrayWriteSink, addr: number): number {
  let n = 0
  for (let i = 0; i < sink.length; i++) if (sink.addrs[i] === addr) n++
  return n
}

export const REG = {
  P1_CTRL: 0x4000,
  P1_SWEEP: 0x4001,
  P1_LO: 0x4002,
  P1_HI: 0x4003,
  P2_CTRL: 0x4004,
  P2_LO: 0x4006,
  P2_HI: 0x4007,
  TRI_LINEAR: 0x4008,
  TRI_LO: 0x400a,
  TRI_HI: 0x400b,
  NOISE_CTRL: 0x400c,
  NOISE_PERIOD: 0x400e,
  NOISE_LEN: 0x400f,
  STATUS: 0x4015,
} as const
