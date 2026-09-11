/** Render-level VRC6 integration tests, continued from vrc6Integration.test.ts (see
 *  that file's header for the join this whole pair proves). This file: the saw
 *  ceiling, the mode bit, per-lane audibility on the eight-lane fixture, and $9003 —
 *  items 5–8 of the brief, split out at ~300 lines, house style.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Apu2A03 } from '../../src/audio/core/apu2a03'
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { VRC6_GAIN } from '../../src/audio/core/mixer'
import { vrc6PulseHzForTimer, vrc6PulseTimerForMidi } from '../../src/audio/host/pitch'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { TrackerDriver, type DriverClock } from '../../src/tracker/driver/trackerDriver'
import {
  CH_DPCM,
  CH_NOISE,
  CH_PULSE1,
  CH_PULSE2,
  CH_TRIANGLE,
  CH_VRC6P1,
  CH_VRC6P2,
  CH_VRC6SAW,
} from '../../src/tracker/driver/registers'
import type { Song } from '../../src/tracker/model/types'
import { parseSong } from '../../src/tracker/model/validate'
import { renderSong, rmsDb } from '../../src/tracker/offlineRender'
import { dftFundamentalHz } from '../helpers/analysis'
import { renderTrace, vrc6PulseNoteOnTrace } from '../helpers/renderTrace'
import { REG, at, buildSong, drive } from '../fixtures/songs/build'

const SAMPLE_RATE = 48000
const ROOT = join(import.meta.dirname, '..', '..')

// --- 5. saw ceiling ------------------------------------------------------------------

describe('5. saw ceiling — rate 42 is the largest that does not fold', () => {
  it('through the driver, the loudest composed volume (15) writes rate 42', () => {
    const song = buildSong({ lanes: 8, patterns: { 'vrc6saw:0': [{ r: 0, note: 69, vol: 15 }] } })
    const { ticks } = drive(song, 4)
    expect(at(ticks, 0, REG.SAW_RATE)).toBe(42)
  })

  it('rendered through TrackerDriver + Apu2A03, rate 42 walks a clean 7-level ramp', () => {
    const song = buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 32, speed: 6 },
      patterns: { 'vrc6saw:0': [{ r: 0, note: 40, vol: 15 }] },
    })
    const apu = new Apu2A03({ sampleRate: SAMPLE_RATE, clockRate: NTSC_CPU_HZ, maxSamplesPerFrame: 512 })
    const clock: DriverClock = { clockRate: apu.clockRate, nowCycle: () => apu.cycle }
    const driver = new TrackerDriver(apu, clock, { song })
    driver.play('song')
    const levels: number[] = []
    let prev = -1
    for (let c = 1; c <= 60_000; c++) {
      // driver.runTo() only flushes the tracker's own register writes up to `c`; the
      // core's oscillators advance separately, exactly as offlineRender.ts's loop
      // (driver.runTo then apu.endFrame, which calls apu.runTo) treats them as two
      // distinct steps.
      driver.runTo(c)
      apu.runTo(c)
      if (apu.vrc6saw.out !== prev) {
        levels.push(apu.vrc6saw.out)
        prev = apu.vrc6saw.out
      }
    }
    const start = levels.indexOf(0)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(levels.slice(start, start + 7)).toEqual([0, 5, 10, 15, 21, 26, 31])
    expect(Math.max(...levels)).toBe(31)
  })

  it('$B000 = 43 written directly to the core folds the ramp — the documented wrap', () => {
    const apu = new Apu2A03({ sampleRate: SAMPLE_RATE, clockRate: NTSC_CPU_HZ, maxSamplesPerFrame: 512 })
    apu.write(0, 0xb001, 9)
    apu.write(0, 0xb002, 0x80)
    apu.write(0, 0xb000, 43)
    const levels: number[] = []
    let prev = -1
    for (let c = 1; c <= 5000; c++) {
      apu.runTo(c)
      if (apu.vrc6saw.out !== prev) {
        levels.push(apu.vrc6saw.out)
        prev = apu.vrc6saw.out
      }
    }
    const start = levels.indexOf(0)
    const ramp = levels.slice(start, start + 7)
    let fell = false
    for (let i = 1; i < ramp.length; i++) if (ramp[i] < ramp[i - 1]) fell = true
    expect(fell).toBe(true)

    // anti-vacuity: the identical setup at rate 42 (the ceiling) never falls mid-ramp.
    const clean = new Apu2A03({ sampleRate: SAMPLE_RATE, clockRate: NTSC_CPU_HZ, maxSamplesPerFrame: 512 })
    clean.write(0, 0xb001, 9)
    clean.write(0, 0xb002, 0x80)
    clean.write(0, 0xb000, 42)
    let cleanFell = false
    let last = clean.vrc6saw.out
    for (let c = 1; c <= 5000; c++) {
      clean.runTo(c)
      if (clean.vrc6saw.out < last && clean.vrc6saw.step !== 0) cleanFell = true
      last = clean.vrc6saw.out
    }
    expect(cleanFell).toBe(false)
  })
})

// --- 6. mode bit ---------------------------------------------------------------------

/** A driver-driven render with the analog section switchable — offlineRender.ts has no
 *  such knob (the shipped path always filters), so this mirrors its four-line loop
 *  (tests/helpers/renderTrace.ts's renderWith does the same for a raw trace) with one
 *  extra option, entirely inside this test file. */
function renderLaneRaw(song: Song, durationSamples: number, analogFilters: boolean): Float32Array {
  const apu = new Apu2A03({
    sampleRate: SAMPLE_RATE,
    clockRate: NTSC_CPU_HZ,
    maxSamplesPerFrame: 512,
    analogFilters,
  })
  const clock: DriverClock = { clockRate: apu.clockRate, nowCycle: () => apu.cycle }
  const driver = new TrackerDriver(apu, clock, { song })
  driver.play('song')
  const out = new Float32Array(durationSamples)
  let written = 0
  const quantum = 128
  while (written < out.length) {
    const want = Math.min(quantum, out.length - written)
    const target = apu.cycle + apu.cyclesForSamples(want)
    driver.runTo(target)
    apu.endFrame(target)
    const got = apu.readSamples(out, written, want)
    if (got === 0) break
    written += got
  }
  return out.subarray(0, written)
}

describe('6. mode bit — a duty macro of 8 bypasses the sequencer for a constant level', () => {
  const DURATION = 8192
  const SETTLE = 500

  function laneSong(dutyParam: 7 | 8): Song {
    return buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 96, speed: 6 },
      patterns: {
        'vrc6p1:0': [{ r: 0, note: 69, vol: 15, fx: [{ cmd: 'V', param: dutyParam }] }],
      },
    })
  }

  it('control: an isolated silent song’s raw mix (no analog section) is exactly 0', () => {
    const silent = buildSong({ lanes: 8, patterns: {} })
    const signal = renderLaneRaw(silent, DURATION, false)
    let max = 0
    for (let i = 0; i < signal.length; i++) max = Math.max(max, Math.abs(signal[i]))
    expect(max).toBe(0)
  })

  // A lone VRC6 pulse at volume 15, held constant (mode bit), adds exactly
  // 15 · VRC6_GAIN · masterGain to an otherwise all-zero raw mix (measured: 0.2976
  // at the default masterGain of 2.0). Duty 7's LOW steps land within band-limited
  // step synthesis's edge ringing of true 0 (measured up to ~0.039 of overshoot,
  // never anywhere near the duty-8 plateau), so the two are separated by a wide
  // band rather than a single fragile threshold.
  const DUTY8_LEVEL = 15 * VRC6_GAIN * DEFAULT_MASTER_GAIN

  it('duty 7 (the sequencer): the raw mix returns to (near) the silent level during the note', () => {
    const signal = renderLaneRaw(laneSong(7), DURATION, false)
    let min = Infinity
    for (let i = SETTLE; i < signal.length; i++) min = Math.min(min, signal[i])
    expect(Math.abs(min)).toBeLessThan(DUTY8_LEVEL * 0.25)
  })

  it('duty 8 (mode bit): the raw mix NEVER returns anywhere near the silent level during the note', () => {
    const signal = renderLaneRaw(laneSong(8), DURATION, false)
    let min = Infinity
    for (let i = SETTLE; i < signal.length; i++) min = Math.min(min, signal[i])
    expect(min).toBeGreaterThan(DUTY8_LEVEL * 0.75)
  })
})

// --- 7. every lane audible -------------------------------------------------------------

describe('7. every lane audible — vrc6.json solo channels (mirrors presetFormat.test.ts)', () => {
  function loudestWindow(samples: Float32Array, seconds: number, rate = SAMPLE_RATE): number {
    const w = Math.round(rate * seconds)
    if (samples.length < w) return rmsDb(samples)
    let best = -Infinity
    const hop = Math.max(1, Math.round(w / 4))
    for (let a = 0; a + w <= samples.length; a += hop) best = Math.max(best, rmsDb(samples, a, a + w))
    return best
  }

  const raw = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'songs', 'vrc6.json'), 'utf8'))
  const { song } = parseSong(raw)

  // From the fixture (tests/fixtures/songs/README.md): pulse1, vrc6p1, vrc6p2 and
  // vrc6saw carry notes; pulse2/triangle/noise/dpcm patterns are empty.
  const USED: ReadonlyArray<[string, number]> = [
    ['pulse1', CH_PULSE1],
    ['vrc6p1', CH_VRC6P1],
    ['vrc6p2', CH_VRC6P2],
    ['vrc6saw', CH_VRC6SAW],
  ]
  const SILENT: ReadonlyArray<[string, number]> = [
    ['pulse2', CH_PULSE2],
    ['triangle', CH_TRIANGLE],
    ['noise', CH_NOISE],
    ['dpcm', CH_DPCM],
  ]

  for (const [name, ch] of USED) {
    it(`${name} (channel ${ch}) is above -40 dBFS in its loudest half-second`, () => {
      const r = renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 2, loops: 1, soloChannel: ch })
      expect(loudestWindow(r.samples, 0.5)).toBeGreaterThan(-40)
    })
  }

  for (const [name, ch] of SILENT) {
    it(`${name} (channel ${ch}), unused in this fixture, is below -90 dBFS`, () => {
      const r = renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 2, loops: 1, soloChannel: ch })
      expect(rmsDb(r.samples)).toBeLessThan(-90)
    })
  }
})

// --- 8. $9003 ----------------------------------------------------------------------------

describe('8. $9003 — the frequency-control register, through the driver and direct to the core', () => {
  it("after the driver's one-time $9003 = 0, a vrc6p1 note renders at its written pitch", () => {
    const song = buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 32, speed: 6 },
      patterns: { 'vrc6p1:0': [{ r: 0, note: 69, vol: 15 }] },
    })
    const { samples } = renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 1.5, loops: 1 })
    const want = vrc6PulseHzForTimer(vrc6PulseTimerForMidi(69))
    const hz = dftFundamentalHz(samples, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(hz - want) / want).toBeLessThan(0.005)
  })

  it('$9003 = 0x02 written directly to the core shifts the same note by exactly the >>4 ratio', () => {
    const PERIOD = 253
    const wantOriginal = vrc6PulseHzForTimer(PERIOD)
    const wantShifted = vrc6PulseHzForTimer(PERIOD >> 4)
    const expectedRatio = wantShifted / wantOriginal
    // Not exactly 16×: >>4 truncates 253 to 15, not 253/16, so the ratio the chip
    // actually produces is 254/16 = 15.875 — asserted explicitly so a future reader
    // does not "fix" the test to expect a clean 16.
    expect(expectedRatio).toBeCloseTo(15.875, 6)

    const originalSignal = renderTrace(vrc6PulseNoteOnTrace(0, 0, PERIOD, 7, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 65536,
    })
    const shiftedTrace = new ArrayWriteSink()
    vrc6PulseNoteOnTrace(0, 0, PERIOD, 7, 15).replayTo(shiftedTrace)
    shiftedTrace.write(0, 0x9003, 0x02)
    const shiftedSignal = renderTrace(shiftedTrace, { sampleRate: SAMPLE_RATE, durationSamples: 65536 })

    const original = dftFundamentalHz(originalSignal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(original - wantOriginal) / wantOriginal).toBeLessThan(0.005)

    // wantShifted ≈ 6991 Hz — comfortably below Nyquist, so this is the "measurable"
    // branch, not the "muted" one; search a band around the predicted shifted tone.
    const shifted = dftFundamentalHz(
      shiftedSignal,
      SAMPLE_RATE,
      8192,
      32768,
      wantShifted * 0.5,
      Math.min(wantShifted * 2, SAMPLE_RATE / 2 - 1),
    )
    const measuredRatio = shifted / original
    expect(Math.abs(measuredRatio - expectedRatio) / expectedRatio).toBeLessThan(0.01)
  })
})
