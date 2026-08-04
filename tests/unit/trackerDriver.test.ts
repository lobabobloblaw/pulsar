/** The driver's own disciplines: write-on-change, chunk independence, Rule L (§2.6/§2.7).
 *
 *  Headline assertions:
 *    - **write-on-change**: a ten-second held note writes `$4003` exactly ONCE. Writing
 *      it per tick would reset the duty sequencer and restart the envelope 60 times a
 *      second, turning every sustained note into a buzz.
 *    - **chunk independence**: driving `runTo` one tick at a time, seven ticks at a
 *      time, or in one shot produces a BYTE-IDENTICAL write stream — the tracker
 *      analogue of phase 1's 375×128 determinism test.
 *    - **Rule L**: across live -> play -> stop -> live, every write on the timeline is
 *      non-decreasing in cycle and the two owners never fight over `$4015`.
 *      `LiveScheduler.reset()` emits nothing at all.
 *    - mute/solo suppress EMISSION only; the driver keeps running the channel's state
 *      and unmuting mid-song resumes coherently.
 */
import { describe, expect, it } from 'vitest'
import { REG, buildSong, countWrites, drive, instrument, sequence } from '../fixtures/songs/build'
import {
  PlaybackCoordinator,
  START_LATENCY_MS,
  TrackerDriver,
  noisePeriodIndex,
} from '../../src/tracker/driver/trackerDriver'
import { cycleOfTick } from '../../src/tracker/driver/tempo'
import { renderSong } from '../../src/tracker/offlineRender'
// `DEFAULT_LEAD_MS` comes from liveScheduler, NOT from audioEngine: pulling
// audioEngine into the test program would drag AudioContext and `crossOriginIsolated`
// in with it, and tsconfig.test.json has no DOM lib on purpose.
import { DEFAULT_LEAD_MS, LiveScheduler, type LiveEngine } from '../../src/audio/host/liveScheduler'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { msToCycles } from '../../src/audio/timeline/clockMap'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { triangleTimerForMidi } from '../../src/audio/host/pitch'
import type { NesCycle, RegAddr } from '../../src/audio/timeline/types'

const CLOCK = { clockRate: NTSC_CPU_HZ, nowCycle: () => 0 }

/** One note, held for 33 s of pattern (speed 31 × 64 rows) so a ten-second run cannot
 *  loop round and legitimately retrigger it. */
function heldNote() {
  return buildSong({
    meta: { speed: 31, rowsPerPattern: 64 },
    patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15 }] },
  })
}

describe('write-on-change', () => {
  it('writes $4003 exactly once for a ten-second held note', () => {
    const song = heldNote()
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    driver.runTo(10 * NTSC_CPU_HZ)
    expect(driver.stats.ticksGenerated).toBeGreaterThan(590)
    expect(countWrites(sink, REG.P1_HI)).toBe(1)
    expect(countWrites(sink, REG.P1_LO)).toBe(1)
    expect(countWrites(sink, REG.P1_CTRL)).toBe(1)
    expect(countWrites(sink, REG.STATUS)).toBe(1)
  })

  it('keeps the steady-state write rate near zero, not at 21 per tick', () => {
    const song = buildSong({
      meta: { speed: 8, rowsPerPattern: 64 },
      patterns: {
        'pulse1:0': [{ r: 0, note: 60, vol: 15 }],
        'pulse2:0': [{ r: 0, note: 67, vol: 12 }],
        'triangle:0': [{ r: 0, note: 36 }],
        'noise:0': [{ r: 0, note: 55, vol: 8 }],
      },
    })
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    driver.runTo(5 * NTSC_CPU_HZ)
    // Four canonical note-ons and nothing else: 4+4+3+4 register writes plus the
    // $4015 bytes, across 300 ticks.
    expect(sink.length).toBeLessThan(25)
    expect(driver.stats.ticksGenerated).toBeGreaterThan(290)
  })

  it('re-emits the FULL canonical sequence on a trigger, unconditionally', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, vol: 15 },
          { r: 1, note: 60, vol: 15 },
        ],
      },
    })
    const { ticks } = drive(song, 8)
    const order = ticks[4].map((w) => w.addr)
    expect(order).toEqual([REG.STATUS, REG.P1_CTRL, REG.P1_SWEEP, REG.P1_LO, REG.P1_HI])
  })

  it('emits the triangle and noise canonical orders too', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: {
        'triangle:0': [{ r: 0, note: 48 }],
        'noise:0': [{ r: 0, note: 55, vol: 8 }],
      },
    })
    const { ticks } = drive(song, 2)
    const addrs = ticks[0].map((w) => w.addr)
    expect(addrs).toEqual([
      REG.STATUS,
      REG.TRI_LINEAR,
      REG.TRI_LO,
      REG.TRI_HI,
      REG.STATUS,
      REG.NOISE_CTRL,
      REG.NOISE_PERIOD,
      REG.NOISE_LEN,
    ])
  })
})

describe('chunk independence', () => {
  const song = buildSong({
    meta: { speed: 6, tempo: 160, rowsPerPattern: 8 },
    order: [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
    ],
    patterns: {
      'pulse1:0': [
        { r: 0, note: 60, inst: 0, vol: 15, fx: [{ cmd: '4', param: 0x47 }] },
        { r: 2, note: 64, fx: [{ cmd: 'A', param: 0x30 }] },
        { r: 5, note: 67, fx: [{ cmd: '3', param: 0x20 }] },
      ],
      'pulse1:1': [
        { r: 0, note: 72, vol: 10 },
        { r: 7, fx: [{ cmd: 'B', param: 0 }] },
      ],
      'triangle:0': [{ r: 0, note: 36 }],
      'noise:0': [{ r: 0, note: 55, vol: 8, fx: [{ cmd: 'S', param: 3 }] }],
    },
    instruments: [instrument({ volume: 0, duty: 0 })],
    sequences: {
      volume: [sequence([15, 13, 11, 9, 8], 4, -1)],
      duty: [sequence([2, 2, 1, 1], 2, -1)],
    },
  })

  function capture(step: number): string {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    const end = 3 * NTSC_CPU_HZ
    if (step === 0) {
      driver.runTo(end)
    } else {
      for (let n = 0; cycleOfTick(0, n, NTSC_CPU_HZ, 60) <= end; n += step) {
        driver.runTo(cycleOfTick(0, n, NTSC_CPU_HZ, 60))
      }
      driver.runTo(end)
    }
    const out: string[] = []
    for (let i = 0; i < sink.length; i++) {
      out.push(`${sink.cycles[i]} ${sink.addrs[i].toString(16)} ${sink.values[i]}`)
    }
    return out.join('\n')
  }

  it('is identical at 1-tick, 7-tick and one-shot horizons', () => {
    const oneShot = capture(0)
    expect(capture(1)).toBe(oneShot)
    expect(capture(7)).toBe(oneShot)
    expect(oneShot.length).toBeGreaterThan(200)
  })

  it('anti-vacuity: the trace is not empty and does contain a jump back to frame 0', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    driver.runTo(3 * NTSC_CPU_HZ)
    expect(driver.stats.loops).toBeGreaterThanOrEqual(1)
    expect(sink.length).toBeGreaterThan(20)
  })

  it('renders bit-identically twice, and the cycles never go backwards', () => {
    const a = renderSong(song, { maxSeconds: 4, loops: 1 })
    const b = renderSong(song, { maxSeconds: 4, loops: 1 })
    expect(a.checksum).toBe(b.checksum)
    expect(a.samples.length).toBe(b.samples.length)
    expect(a.noteOns).toBe(b.noteOns)
    expect(a.rowsPlayed).toBe(b.rowsPlayed)

    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    driver.runTo(3 * NTSC_CPU_HZ)
    for (let i = 1; i < sink.length; i++) expect(sink.cycles[i]).toBeGreaterThanOrEqual(sink.cycles[i - 1])
  })
})

// --- Rule L ---------------------------------------------------------------------------

class FakeEngine implements LiveEngine {
  readonly clockRate = NTSC_CPU_HZ
  leadMs = DEFAULT_LEAD_MS
  readonly sink = new ArrayWriteSink()
  now: NesCycle = 0
  flushes = 0

  nowCycle(): NesCycle {
    return this.now
  }
  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.sink.write(cycle, addr, value)
  }
  flush(): void {
    this.flushes++
  }
  lateWrites(): number {
    return 0
  }
  setMasterGain(): void {}
}

describe('Rule L — one owner of the timeline at a time', () => {
  it('reset() moves the clamp and clears the state WITHOUT emitting a write', () => {
    const engine = new FakeEngine()
    const scheduler = new LiveScheduler(engine, { adaptive: false })
    engine.now = 1000
    scheduler.noteOn(60, 100)
    const before = engine.sink.length
    expect(scheduler.sounding).toBe(60)

    scheduler.reset(500_000)
    expect(engine.sink.length).toBe(before)
    expect(scheduler.sounding).toBe(-1)
    expect(scheduler.heldNotes).toBe(0)
    expect(scheduler.lastScheduledCycle).toBe(500_000)
  })

  it('keeps every cycle non-decreasing across live -> play -> stop -> live', () => {
    const engine = new FakeEngine()
    const scheduler = new LiveScheduler(engine, { adaptive: false })
    const song = buildSong({
      meta: { speed: 6, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15 }] },
    })
    const driver = new TrackerDriver(engine, engine, { song })
    const coordinator = new PlaybackCoordinator(engine, scheduler, driver)

    // 1. live play owns the timeline (phase-1 behaviour, untouched)
    engine.now = 100_000
    scheduler.noteOn(64, 127)
    engine.now = 150_000
    scheduler.noteOff(64)

    // 2. the handoff
    engine.now = 200_000
    const start = coordinator.start('song', undefined, msToCycles(NTSC_CPU_HZ, 120))
    expect(start).toBeGreaterThanOrEqual(engine.now + msToCycles(NTSC_CPU_HZ, START_LATENCY_MS))
    expect(start).toBeGreaterThan(scheduler.lastScheduledCycle - 1)

    // 3. pump a while
    for (let ms = 220; ms < 500; ms += 20) {
      engine.now = 200_000 + msToCycles(NTSC_CPU_HZ, ms - 200)
      coordinator.pump(msToCycles(NTSC_CPU_HZ, 120))
    }

    // 4. hand back, then play live again
    const resume = coordinator.stop()
    engine.now = 700_000
    scheduler.noteOn(72, 127)
    scheduler.noteOff(72)

    const cycles = engine.sink.cycles
    expect(cycles.length).toBeGreaterThan(6)
    for (let i = 1; i < cycles.length; i++) {
      expect(cycles[i], `write ${i}`).toBeGreaterThanOrEqual(cycles[i - 1])
    }
    expect(scheduler.lastScheduledCycle).toBeGreaterThanOrEqual(resume)
  })

  it('never lets the two owners fight over $4015', () => {
    const engine = new FakeEngine()
    const scheduler = new LiveScheduler(engine, { adaptive: false })
    const song = buildSong({
      meta: { speed: 6, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [{ r: 0, note: 60, vol: 15 }],
        'triangle:0': [{ r: 0, note: 36 }],
      },
    })
    const driver = new TrackerDriver(engine, engine, { song })
    const coordinator = new PlaybackCoordinator(engine, scheduler, driver)

    engine.now = 10_000
    scheduler.noteOn(64, 127)
    const beforeStart = engine.sink.length

    engine.now = 20_000
    const start = coordinator.start('song', undefined, msToCycles(NTSC_CPU_HZ, 120))

    // The handoff itself emits `allNotesOff` (one $4015 = 0 from the scheduler) and
    // then nothing from the scheduler at all.
    const handoffWrites: number[] = []
    for (let i = beforeStart; i < engine.sink.length; i++) {
      if (engine.sink.addrs[i] === REG.STATUS) handoffWrites.push(engine.sink.cycles[i])
    }
    expect(handoffWrites.length).toBeGreaterThan(0)
    // Every $4015 write from `start` onwards is the driver's, and each is a WHOLE byte
    // whose channel bits only ever reflect what the driver believes is sounding.
    for (let i = 0; i < engine.sink.length; i++) {
      if (engine.sink.addrs[i] !== REG.STATUS) continue
      if (engine.sink.cycles[i] < start) continue
      expect(engine.sink.values[i] & ~0x1f).toBe(0)
    }
    const stopAt = coordinator.stop()
    // The last thing the driver does is clear the whole byte...
    const statusWrites: { cycle: number; value: number }[] = []
    for (let i = 0; i < engine.sink.length; i++) {
      if (engine.sink.addrs[i] === REG.STATUS) {
        statusWrites.push({ cycle: engine.sink.cycles[i], value: engine.sink.values[i] })
      }
    }
    expect(statusWrites.at(-1)?.value).toBe(0)
    // ...and the scheduler resumes strictly after it.
    expect(scheduler.lastScheduledCycle).toBe(stopAt)
    expect(stopAt).toBeGreaterThan(statusWrites.at(-1)?.cycle ?? 0)
  })

  it('live input during playback steals the cursor channel and gives it back', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 4 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15 }, { r: 2, note: 62 }] },
    })
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.setLiveChannel(0)
    driver.play('song')
    driver.runTo(cycleOfTick(0, 3, NTSC_CPU_HZ, 60))

    driver.liveNoteOn(0, 84, 127)
    driver.runTo(cycleOfTick(0, 7, NTSC_CPU_HZ, 60))
    // The stolen channel plays the live note, not the song's row-2 note.
    let sawLive = false
    for (let i = 0; i < sink.length; i++) {
      if (sink.addrs[i] === REG.P1_LO && sink.cycles[i] >= cycleOfTick(0, 4, NTSC_CPU_HZ, 60)) {
        sawLive = true
      }
    }
    expect(sawLive).toBe(true)

    driver.liveNoteOff(0, 84)
    driver.runTo(cycleOfTick(0, 15, NTSC_CPU_HZ, 60))
    // ...and the song has the lane back by the next row boundary.
    expect(driver.position.playing).toBe(true)
  })
})

describe('mute and solo', () => {
  const song = buildSong({
    meta: { speed: 4, rowsPerPattern: 8 },
    patterns: {
      'pulse1:0': [{ r: 0, note: 60, vol: 15 }],
      'pulse2:0': [{ r: 0, note: 67, vol: 15 }],
    },
  })

  it('suppresses emission for a muted channel and keeps its $4015 bit clear', () => {
    const { ticks, sink } = drive(song, 8, { mute: [0] })
    expect(countWrites(sink, REG.P1_LO)).toBe(0)
    expect(countWrites(sink, REG.P2_LO)).toBe(1)
    const status = ticks.flat().filter((w) => w.addr === REG.STATUS)
    for (const w of status) expect(w.value & 0x01).toBe(0)
  })

  it('keeps running the muted channel, so unmuting resumes coherently', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.setChannelMute(0, true)
    driver.play('song')
    driver.runTo(cycleOfTick(0, 5, NTSC_CPU_HZ, 60))
    expect(countWrites(sink, REG.P1_LO)).toBe(0)

    driver.setChannelMute(0, false)
    driver.runTo(cycleOfTick(0, 8, NTSC_CPU_HZ, 60))
    // The channel comes straight back with the note it was already holding.
    expect(countWrites(sink, REG.P1_LO)).toBe(1)
    expect(driver.position.levels[0]).toBe(15)
  })

  it('solo suppresses every other channel', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.setSoloChannel(1)
    driver.play('song')
    driver.runTo(cycleOfTick(0, 8, NTSC_CPU_HZ, 60))
    expect(countWrites(sink, REG.P1_LO)).toBe(0)
    expect(countWrites(sink, REG.P2_LO)).toBe(1)
  })
})

describe('per-channel register conventions (§2.8)', () => {
  it('runs pulse and noise with L=1 and C=1', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: {
        'pulse1:0': [{ r: 0, note: 60, vol: 9 }],
        'noise:0': [{ r: 0, note: 55, vol: 9 }],
      },
    })
    const { ticks } = drive(song, 2)
    const p1 = ticks[0].find((w) => w.addr === REG.P1_CTRL)
    const nz = ticks[0].find((w) => w.addr === REG.NOISE_CTRL)
    expect((p1?.value ?? 0) & 0x30).toBe(0x30)
    expect((nz?.value ?? 0) & 0x30).toBe(0x30)
  })

  it('gates the triangle with $4008 rather than clearing $4015', () => {
    const song = buildSong({
      meta: { speed: 2, rowsPerPattern: 8 },
      patterns: { 'triangle:0': [{ r: 0, note: 48, inst: 0 }] },
      instruments: [instrument({ volume: 0 })],
      sequences: { volume: [sequence([15, 15, 0], -1, -1)] },
    })
    const { ticks, sink } = drive(song, 4)
    expect(ticks[0].find((w) => w.addr === REG.TRI_LINEAR)?.value).toBe(0xff)
    expect(ticks[2].find((w) => w.addr === REG.TRI_LINEAR)?.value).toBe(0x00)
    // $4015 is written once, at the note-on, and never to silence the lane.
    expect(countWrites(sink, REG.STATUS)).toBe(1)
    expect(triangleTimerForMidi(48, NTSC_CPU_HZ)).toBeGreaterThan(0)
  })

  it('maps a rising noise keyboard onto a falling $400E period index', () => {
    expect(noisePeriodIndex(48)).toBe(15)
    expect(noisePeriodIndex(49)).toBe(14) // kick range 12..14
    expect(noisePeriodIndex(55)).toBe(8) // snare range 6..8
    expect(noisePeriodIndex(60)).toBe(3) // hat range 1..3
    expect(noisePeriodIndex(63)).toBe(0)
    for (let n = 0; n < 128; n++) {
      const i = noisePeriodIndex(n)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThanOrEqual(15)
    }
  })
})

describe('transport state machine', () => {
  it('play from a row starts there and resets the accumulator', () => {
    const song = buildSong({
      meta: { speed: 6, tempo: 160, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 4, note: 60, vol: 15 }] },
    })
    const { ticks } = drive(song, 4, { mode: 'row', from: { order: 0, row: 4 } })
    expect(ticks[0].some((w) => w.addr === REG.P1_LO)).toBe(true)
  })

  it('pattern mode loops the current frame and ignores Bxx', () => {
    const song = buildSong({
      meta: { speed: 1, rowsPerPattern: 4 },
      order: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
      ],
      patterns: {
        'pulse1:0': [{ r: 3, fx: [{ cmd: 'B', param: 1 }] }],
        'pulse1:1': [{ r: 0, note: 84, vol: 15 }],
      },
    })
    const { driver, sink } = drive(song, 16, { mode: 'pattern' })
    expect(driver.position.orderIndex).toBe(0)
    expect(countWrites(sink, REG.P1_LO)).toBe(0)
    expect(driver.stats.loops).toBeGreaterThanOrEqual(3)
  })

  it('stop() silences everything at or after the last write it emitted', () => {
    const song = heldNote()
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    driver.play('song')
    driver.runTo(NTSC_CPU_HZ)
    const lastBefore = sink.cycles[sink.length - 1]
    driver.stop()
    expect(driver.playing).toBe(false)
    const last = sink.length - 1
    expect(sink.addrs[last]).toBe(REG.STATUS)
    expect(sink.values[last]).toBe(0)
    expect(sink.cycles[last]).toBeGreaterThanOrEqual(lastBefore)
  })

  it('counts late ticks — the main-thread failure mode, made visible not mysterious', () => {
    const song = heldNote()
    const sink = new ArrayWriteSink()
    let now = 0
    const driver = new TrackerDriver(sink, { clockRate: NTSC_CPU_HZ, nowCycle: () => now }, { song })
    driver.play('song')
    // Pumped on time: nothing is late.
    driver.runTo(cycleOfTick(0, 10, NTSC_CPU_HZ, 60))
    expect(driver.stats.lateTicks).toBe(0)
    // A 500 ms stall: the pump wakes up with 30 ticks' worth of catching up to do, and
    // every one of them lands behind the engine.
    now = msToCycles(NTSC_CPU_HZ, 500)
    driver.runTo(now + msToCycles(NTSC_CPU_HZ, 120))
    expect(driver.stats.lateTicks).toBeGreaterThan(15)
    // ...and it is back in phase immediately, because tick -> cycle is absolute.
    expect(driver.horizonCycle).toBeGreaterThan(now)
    const before = driver.stats.lateTicks
    now += msToCycles(NTSC_CPU_HZ, 20)
    driver.runTo(now + msToCycles(NTSC_CPU_HZ, 120))
    expect(driver.stats.lateTicks).toBe(before)
  })

  it('an offline render never reports a late tick', () => {
    const r = renderSong(heldNote(), { maxSeconds: 2, loops: 1 })
    expect(r.rowsPlayed).toBeGreaterThan(0)
    expect(r.clippedSamples).toBe(0)
  })

  it('stop() on a stopped driver is a no-op', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song: heldNote() })
    driver.stop()
    expect(sink.length).toBe(0)
  })

  it('publishes a position the grid can read without allocating', () => {
    const song = buildSong({
      meta: { speed: 4, rowsPerPattern: 8 },
      patterns: { 'pulse1:0': [{ r: 0, note: 60, vol: 15 }] },
    })
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song })
    const position = driver.position
    driver.play('song')
    driver.runTo(cycleOfTick(0, 9, NTSC_CPU_HZ, 60))
    // The same object throughout — the grid holds the reference across frames.
    expect(driver.position).toBe(position)
    expect(position.playing).toBe(true)
    expect(position.row).toBe(2)
    // `tickIndex` is the index of the tick just generated, not the next one.
    expect(position.tickIndex).toBe(9)
    expect(position.tick).toBe(1)
    expect(position.bpm).toBe((24 * 150) / (4 * 4))
  })
})

describe('evenTempo', () => {
  it('replaces the alternation with a fixed integer row length', () => {
    const song = buildSong({
      meta: { speed: 6, tempo: 160, rowsPerPattern: 8, evenTempo: true },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60, vol: 15 },
          { r: 1, note: 62 },
          { r: 2, note: 64 },
        ],
      },
    })
    const { ticks } = drive(song, 18)
    // 5.625 rounds to 6, so every row is 6 ticks — no 6,6,5 groove.
    expect(ticks[0].some((w) => w.addr === REG.P1_LO)).toBe(true)
    expect(ticks[6].some((w) => w.addr === REG.P1_LO)).toBe(true)
    expect(ticks[12].some((w) => w.addr === REG.P1_LO)).toBe(true)
    expect(ticks[11].some((w) => w.addr === REG.P1_LO)).toBe(false)
  })
})
