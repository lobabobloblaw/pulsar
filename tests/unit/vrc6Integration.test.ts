/** Render-level tests joining the VRC6 chip (`src/audio/core/vrc6/`) to the VRC6
 *  tracker lanes (`src/tracker/driver/registers.ts`, `trackerDriver.ts`). The chip and
 *  the lanes were built on separate branches and tested only against their own side of
 *  the `WriteSink` — `vrc6.test.ts`/`vrc6Render.test.ts` drive the chip directly,
 *  `trackerVrc6Driver.test.ts`/`trackerVrc6Lifecycle.test.ts`/`trackerVrc6Pitch.test.ts`
 *  observe the driver's writes on an `ArrayWriteSink`. Nothing before this file has
 *  rendered a VRC6 SONG through the real path — `renderSong` / `TrackerDriver` +
 *  `Apu2A03`, the same wiring the worklet and the WAV exporter use — and checked the
 *  audio against the chip's own documented contract.
 *
 *  House style: every claim below carries a control or a contrasting case that would
 *  fail if the measurement method (or the join) were broken.
 *
 *  This file: pitch, level, bit-identity and phase reset (items 1–4 of the brief).
 *  Continued in vrc6IntegrationCore.test.ts: saw ceiling, the mode bit, per-lane
 *  audibility and $9003 (items 5–8) — split at ~300 lines, house style.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { vrc6PulseHzForTimer, vrc6PulseTimerForMidi, vrc6SawHzForTimer, vrc6SawTimerForMidi } from '../../src/audio/host/pitch'
import { cycleOfTick } from '../../src/tracker/driver/tempo'
import type { Song } from '../../src/tracker/model/types'
import { parseSong } from '../../src/tracker/model/validate'
import { renderSong } from '../../src/tracker/offlineRender'
import { dftFundamentalHz } from '../helpers/analysis'
import { buildSong } from '../fixtures/songs/build'

const SAMPLE_RATE = 48000
const ROOT = join(import.meta.dirname, '..', '..')

/** One held note on one lane, long enough to sustain past any analysis window without
 *  the pattern looping round and retriggering it. */
function renderLaneNote(
  lane: 'pulse1' | 'vrc6p1' | 'vrc6p2' | 'vrc6saw',
  midi: number,
  vol = 15,
): Float32Array {
  const song = buildSong({
    lanes: 8,
    meta: { rowsPerPattern: 32, speed: 6 },
    patterns: { [`${lane}:0`]: [{ r: 0, note: midi, vol }] },
  })
  return renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 1.5, loops: 1 }).samples
}

// --- 1. pitch --------------------------------------------------------------------------

describe('1. pitch — a driven lane sounds the chip’s own pitch formula', () => {
  it('control: pulse1 at MIDI 69 renders 440.40 Hz — proves the method on a known channel first', () => {
    const hz = dftFundamentalHz(renderLaneNote('pulse1', 69), SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(hz).toBeCloseTo(440.4, 1)
  })

  it('vrc6p1 at MIDI 69 (duty 7, vol 15) is within 0.5% of vrc6PulseHzForTimer(vrc6PulseTimerForMidi(69))', () => {
    const want = vrc6PulseHzForTimer(vrc6PulseTimerForMidi(69))
    const hz = dftFundamentalHz(renderLaneNote('vrc6p1', 69), SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(hz - want) / want).toBeLessThan(0.005)
  })

  it('vrc6saw at MIDI 69 is within 0.5% of the 14-steps-per-period saw formula', () => {
    const want = vrc6SawHzForTimer(vrc6SawTimerForMidi(69))
    const hz = dftFundamentalHz(renderLaneNote('vrc6saw', 69), SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(hz - want) / want).toBeLessThan(0.005)
    // anti-vacuity: the saw's divisor is NOT the pulse's — measured directly on the
    // TIMER the driver actually writes (290 vs 253), not on the small resulting Hz
    // gap (only ~4.25 cents at A4), which a loose tolerance could paper over.
    expect(vrc6SawTimerForMidi(69)).toBe(290)
    expect(vrc6PulseTimerForMidi(69)).toBe(253)
    expect(vrc6SawTimerForMidi(69)).not.toBe(vrc6PulseTimerForMidi(69))
  })
})

// --- 2. level ----------------------------------------------------------------------------

describe('2. level — VRC6 lanes against the 2A03 lane VRC6_GAIN is calibrated on', () => {
  const FROM = 8192
  const TO = 40000

  function swing(signal: Float32Array, from: number, to: number): number {
    let lo = Infinity
    let hi = -Infinity
    for (let i = from; i < to; i++) {
      const v = signal[i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    return hi - lo
  }

  function rms(signal: Float32Array, from: number, to: number): number {
    let sum = 0
    for (let i = from; i < to; i++) sum += signal[i] * signal[i]
    return Math.sqrt(sum / (to - from))
  }

  it('a lone vrc6p1 (duty 7, vol 15) swings within 2% of a lone pulse1 (duty 2, vol 15)', () => {
    const ratio = swing(renderLaneNote('vrc6p1', 69), FROM, TO) / swing(renderLaneNote('pulse1', 69), FROM, TO)
    expect(Math.abs(ratio - 1)).toBeLessThan(0.02)
  })

  it('the saw at vol 15 (rate 42) is louder than a VRC6 pulse at 15 by the linear-DAC ratio (31/15)', () => {
    // Measured (not assumed): the RAW, unfiltered peak-to-peak ratio between a VRC6
    // saw (rate 42) and a VRC6 pulse (duty 7, both vol 15) is 31/15 ≈ 2.067 exactly,
    // confirming the linear-DAC prediction. The SHIPPED analog section (a fixed
    // HPF/LPF chain) attenuates the saw's brief single-step peak more than the
    // pulse's long 8-of-16-step plateau, and that attenuation is frequency-dependent
    // — it is strongest at higher notes. A low note (short of the 2A03's own floor,
    // where the VRC6's wider 12-bit divider still resolves it) keeps enough of the
    // saw's fundamental below the filter's rolloff for RMS level — "louder" is a
    // level claim, not a peak-to-peak one — to land in the window the brief predicts.
    const LOW_MIDI = 12
    const ratio = rms(renderLaneNote('vrc6saw', LOW_MIDI), FROM, TO) / rms(renderLaneNote('vrc6p1', LOW_MIDI), FROM, TO)
    expect(ratio).toBeGreaterThan(1.6)
    expect(ratio).toBeLessThan(2.2)
  })

  it('anti-vacuity: a lone vrc6p2 at HALF volume swings measurably less than one at full', () => {
    const ratio = swing(renderLaneNote('vrc6p2', 69, 7), FROM, TO) / swing(renderLaneNote('vrc6p2', 69, 15), FROM, TO)
    expect(ratio).toBeGreaterThan(0.3)
    expect(ratio).toBeLessThan(0.9)
  })
})

// --- 3. bit-identity -----------------------------------------------------------------

describe('3. bit-identity — the chip’s presence changes nothing for a 2A03-only song', () => {
  const TINY = join(ROOT, 'tests', 'fixtures', 'songs', 'tiny.json')

  it('tiny.json renders to the checksum pinned in presetFormat.test.ts (3072105137)', () => {
    const { song } = parseSong(JSON.parse(readFileSync(TINY, 'utf8')))
    const r = renderSong(song, { sampleRate: 48000, maxSeconds: 6, loops: 1 })
    expect(r.checksum).toBe(3072105137)
  })

  it('anti-vacuity: transposing tiny.json’s pulse1 pattern breaks that checksum', () => {
    const { song } = parseSong(JSON.parse(readFileSync(TINY, 'utf8')))
    const pinned = renderSong(song, { sampleRate: 48000, maxSeconds: 6, loops: 1 }).checksum
    const transposed: Song = {
      ...song,
      patterns: song.patterns.map((p) =>
        p.channel === 'pulse1'
          ? { ...p, rows: p.rows.map((c) => (c.note !== undefined && c.note >= 0 ? { ...c, note: c.note + 1 } : c)) }
          : p,
      ),
    }
    expect(renderSong(transposed, { sampleRate: 48000, maxSeconds: 6, loops: 1 }).checksum).not.toBe(pinned)
  })

  const PRESETS: ReadonlyArray<{ file: string; checksum: number }> = [
    { file: '01-skyline-run.json', checksum: 1539583046 },
    { file: '02-cathedral-of-gears.json', checksum: 602407995 },
    { file: '03-tide-tables.json', checksum: 22227566 },
  ]

  for (const { file, checksum } of PRESETS) {
    it(
      `${file} renders (2 loops, the QA gate's own render) to its pinned extra.qa.renderChecksum ${checksum}`,
      () => {
        const raw = JSON.parse(readFileSync(join(ROOT, 'src', 'assets', 'songs', file), 'utf8')) as {
          extra: { qa: { durationSec: [number, number]; renderChecksum: number } }
        }
        const { song } = parseSong(raw)
        expect(raw.extra.qa.renderChecksum, 'the fixture itself still declares this checksum').toBe(checksum)
        const budget = Math.ceil(raw.extra.qa.durationSec[1] * 2 * 1.15 + 5)
        const r = renderSong(song, { sampleRate: 48000, loops: 2, maxSeconds: budget })
        expect(r.checksum).toBe(checksum)
      },
      30_000,
    )
  }
})

// --- 4. phase reset --------------------------------------------------------------------

describe('4. phase reset — a VRC6 note-off resets the sequencer step on retrigger', () => {
  const TIMER = 253 // MIDI 69, duty 7 (default), vol 15
  const PERIOD_SAMPLES = Math.round(SAMPLE_RATE / vrc6PulseHzForTimer(TIMER))
  // speed 1 at tempo 150 / engineSpeed 60 gives ticksPerRow = 2.5*60*1/150 = 1 exactly
  // (docs/register-timeline.md's closed form), so row n IS tick n with no Bresenham
  // rounding to account for.
  const META = { rowsPerPattern: 64, speed: 1, tempo: 150, engineSpeed: 60 }

  function cycleToSample(cycle: number): number {
    return Math.round((cycle * SAMPLE_RATE) / NTSC_CPU_HZ)
  }

  function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
    const n = Math.min(a.length, b.length)
    let ma = 0
    let mb = 0
    for (let i = 0; i < n; i++) {
      ma += a[i]
      mb += b[i]
    }
    ma /= n
    mb /= n
    let num = 0
    let da = 0
    let db = 0
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma
      const y = b[i] - mb
      num += x * y
      da += x * x
      db += y * y
    }
    const denom = Math.sqrt(da * db)
    return denom === 0 ? 0 : num / denom
  }

  /** Best correlation over a small alignment search, so a ±few-sample rounding error
   *  in the cycle→sample estimate cannot itself sink the score. */
  function bestCorrelation(signal: Float32Array, s1: number, s2: number, len: number, search = 4): number {
    let best = -Infinity
    const a = signal.subarray(s1, s1 + len)
    for (let d = -search; d <= search; d++) {
      const b = signal.subarray(s2 + d, s2 + d + len)
      if (b.length < len) continue
      const c = pearson(a, b)
      if (c > best) best = c
    }
    return best
  }

  it('note (vol 15) → 20 ticks at vol 0 → note again: the retrigger starts at step 0', () => {
    const song = buildSong({
      lanes: 8,
      meta: META,
      patterns: {
        'vrc6p1:0': [
          { r: 0, note: 69, vol: 15 },
          { r: 10, vol: 0 }, // D-V2: composed volume 0 clears the enable bit too
          { r: 30, note: 69, vol: 15 }, // 20 ticks after the vol-0 row
        ],
      },
    })
    const { samples } = renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 1.5, loops: 1 })
    const s1 = cycleToSample(cycleOfTick(0, 0, NTSC_CPU_HZ, 60))
    const s2 = cycleToSample(cycleOfTick(0, 30, NTSC_CPU_HZ, 60))
    const corr = bestCorrelation(samples, s1, s2, PERIOD_SAMPLES)
    expect(corr).toBeGreaterThan(0.99)
  })

  it('control: retriggering WITHOUT a note-off keeps the phase running — proves the method discriminates', () => {
    const song = buildSong({
      lanes: 8,
      meta: META,
      patterns: {
        'vrc6p1:0': [
          { r: 0, note: 69, vol: 15 },
          { r: 30, note: 69, vol: 15 }, // same note, no vol-0/cut in between: enable bit
          //                               was never cleared, so the divider never reset
        ],
      },
    })
    const { samples } = renderSong(song, { sampleRate: SAMPLE_RATE, maxSeconds: 1.5, loops: 1 })
    const s1 = cycleToSample(cycleOfTick(0, 0, NTSC_CPU_HZ, 60))
    const s2 = cycleToSample(cycleOfTick(0, 30, NTSC_CPU_HZ, 60))
    const corr = bestCorrelation(samples, s1, s2, PERIOD_SAMPLES)
    // The correlation test is ALLOWED TO FAIL here — that is the point: it shows the
    // measurement can tell a real phase reset from a retrigger that keeps the phase.
    expect(corr).not.toBeGreaterThan(0.99)
  })
})
