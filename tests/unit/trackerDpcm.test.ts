/** The tracker driver's DPCM lane (§3.7) — the ghost-restart gate.
 *
 *  A one-shot sample ends on its own in the core, but the driver owns the whole
 *  `$4015` byte and every note trigger force-writes it: unless the lane's bit 4 is
 *  cleared once the sample's computed duration has passed, the standing byte keeps
 *  bit 4 set and the NEXT trigger on ANY channel restarts the finished sample —
 *  hardware-authentically, because the core's `setEnabled(true)` restarts whatever
 *  has `bytesRemaining === 0`.
 *
 *  Headline assertions, all replayed through a REAL `DmcChannel` so they cannot
 *  pass vacuously:
 *    - a finished one-shot does NOT restart when a later note fires on another
 *      channel: core-level sample starts equal the authored `$4013` writes;
 *    - the force-written `$4015` byte carries bit 4 = 0 once the one-shot is done;
 *    - a LOOPED sample never expires — its bit stays set and it is never cut;
 *    - a whole DPCM preset starts exactly its authored samples, no ghosts.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REG, buildSong, countWrites, instrument } from '../fixtures/songs/build'
import { TrackerDriver, dpcmSampleCycles } from '../../src/tracker/driver/trackerDriver'
import { cycleOfTick } from '../../src/tracker/driver/tempo'
import { parseSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'
import { buildDpcmImage, type DpcmImage } from '../../src/tracker/offlineRender'
import { DmcChannel } from '../../src/audio/core/channels/dmcChannel'
import { DMC_RATE_NTSC } from '../../src/audio/core/tables'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'

const DMC_FREQ = 0x4010
const DMC_RAW = 0x4011
const DMC_START = 0x4012
const DMC_LEN = 0x4013

const CLOCK = { clockRate: NTSC_CPU_HZ, nowCycle: () => 0 }

/** 17 zero bytes — one length step (16·L + 1), so the core plays exactly 17 bytes. */
const SAMPLE_B64 = 'AAAAAAAAAAAAAAAAAAAAAAA='

/** Replay a write stream through a REAL `DmcChannel`, clocking the output unit
 *  between writes, and count sample starts — `setEnabled(true)` taking
 *  `bytesRemaining` from 0, which is exactly what `startPlayback()` answers. */
function countSampleStarts(sink: ArrayWriteSink, memory: Uint8Array): number {
  const dmc = new DmcChannel()
  dmc.setMemory(memory)
  let starts = 0
  for (let i = 0; i < sink.length; i++) {
    const cycle = sink.cycles[i]
    while (dmc.nextCycle <= cycle) dmc.stepTimer()
    const addr = sink.addrs[i]
    const value = sink.values[i]
    if (addr === DMC_FREQ) dmc.writeControl(value, cycle)
    else if (addr === DMC_RAW) dmc.writeDirectLoad(value)
    else if (addr === DMC_START) dmc.writeAddress(value)
    else if (addr === DMC_LEN) dmc.writeLength(value)
    else if (addr === REG.STATUS) {
      const before = dmc.bytesRemaining
      dmc.setEnabled((value & 0x10) !== 0, cycle)
      if (before === 0 && dmc.bytesRemaining > 0) starts++
    }
  }
  return starts
}

/** One dpcm hit at row 0, one pulse note at row 2 — far past the one-shot's end
 *  (17 bytes at rate index 15: 8·17·54 = 7 344 cycles, under a quarter of a row).
 *  The dpcm key map and the sample bank attach in one parse: each is invalid
 *  without the other. */
function hitThenNote(loop: boolean): { song: Song; image: DpcmImage } {
  const base = buildSong({
    meta: { speed: 6, rowsPerPattern: 16 },
    patterns: {
      'dpcm:0': [{ r: 0, note: 60, inst: 0 }],
      'pulse1:0': [{ r: 2, note: 64, vol: 15 }],
    },
    instruments: [instrument({})],
  })
  const instruments = [{ ...base.instruments[0], dpcm: { '60': { sample: 0, pitch: 15, loop } } }]
  const song = parseSong(
    JSON.parse(
      JSON.stringify({ ...base, instruments, samples: [{ name: 'kick', data: SAMPLE_B64 }] }),
    ),
  ).song
  const image = buildDpcmImage(song)
  if (image === null) throw new Error('the fixture carries a sample')
  return { song, image }
}

function driveDpcm(song: Song, image: DpcmImage, ticks: number): ArrayWriteSink {
  const sink = new ArrayWriteSink()
  const driver = new TrackerDriver(sink, CLOCK, { song })
  driver.dpcmLayout = image.layout
  driver.play('song')
  driver.runTo(cycleOfTick(0, ticks - 1, NTSC_CPU_HZ, song.meta.engineSpeed))
  return sink
}

/** The last `$4015` byte written, or −1. The whole byte, as the driver writes it. */
function lastStatus(sink: ArrayWriteSink): number {
  let v = -1
  for (let i = 0; i < sink.length; i++) if (sink.addrs[i] === REG.STATUS) v = sink.values[i]
  return v
}

describe('the driver-computed sample duration', () => {
  it('is 8 output clocks per byte at the $4010 rate, 16·L + 1 bytes per $4013', () => {
    expect(DMC_RATE_NTSC[15]).toBe(54)
    expect(dpcmSampleCycles(15, 1)).toBe(8 * 17 * 54)
    expect(dpcmSampleCycles(0, 0)).toBe(8 * 1 * DMC_RATE_NTSC[0])
  })
})

describe('DPCM ghost restarts', () => {
  it('a finished one-shot does NOT restart when a later note fires on another channel', () => {
    const { song, image } = hitThenNote(false)
    const sink = driveDpcm(song, image, 48)
    // Anti-vacuity: the authored hit really did fire exactly once...
    const authored = countWrites(sink, DMC_LEN)
    expect(authored).toBe(1)
    // ...and nothing else started the sample. Pre-fix the pulse trigger at row 2
    // force-writes the standing $4015 byte with bit 4 still set, and the core
    // restarts the finished sample: starts would be 2.
    expect(countSampleStarts(sink, image.memory)).toBe(authored)
  })

  it('retires the lane’s $4015 bit once the one-shot’s duration has passed', () => {
    const { song, image } = hitThenNote(false)
    const sink = driveDpcm(song, image, 48)
    // The byte the pulse trigger force-writes carries bit 4 = 0...
    expect(lastStatus(sink) & 0x10).toBe(0)
    // ...and an earlier byte really carried it set — the sample did play, so this
    // gate cannot pass on a song where nothing ever started.
    let sawArmed = false
    for (let i = 0; i < sink.length; i++) {
      if (sink.addrs[i] === REG.STATUS && (sink.values[i] & 0x10) !== 0) sawArmed = true
    }
    expect(sawArmed).toBe(true)
  })

  it('a LOOPED sample never expires — its $4015 bit stays set and it is not cut', () => {
    const { song, image } = hitThenNote(true)
    const sink = driveDpcm(song, image, 48)
    // The loop keeps bytesRemaining > 0 forever, so the pulse trigger's forced
    // byte restarts nothing — and the expiry logic must not retire the lane.
    expect(countSampleStarts(sink, image.memory)).toBe(1)
    expect(lastStatus(sink) & 0x10).toBe(0x10)
  })

  it('a whole DPCM preset starts exactly its AUTHORED samples — no ghosts', () => {
    const file = join(import.meta.dirname, '..', '..', 'src', 'assets', 'songs', '08-long-division.json')
    const song = parseSong(JSON.parse(readFileSync(file, 'utf8'))).song
    const image = buildDpcmImage(song)
    expect(image, 'the preset carries samples').not.toBeNull()
    if (image === null) return
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.dpcmLayout = image.layout
    driver.play('song')
    driver.runTo(170 * NTSC_CPU_HZ)
    const authored = countWrites(sink, DMC_LEN)
    expect(authored).toBeGreaterThan(0)
    expect(countSampleStarts(sink, image.memory)).toBe(authored)
  })
})
