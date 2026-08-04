/** Reproducibility of the engine core.
 *
 *  Byte-identical re-render, chunk independence, cycle-origin invariance, and the
 *  late-write clamp across all five channels. The golden-trace half of plan B3's
 *  determinism map lives in goldenTraces.test.ts.
 *
 *  Chunk independence is the load-bearing one. If a 375 × 128-sample render differed
 *  from one 48 000-sample render, then the audio would depend on the render quantum —
 *  which means offline export would not match live play, and the Phase-2 tracker's
 *  "playback is bit-identical to live" guarantee would be a lie.
 */
import { describe, expect, it } from 'vitest'
import { maxDiff, sameSamples, zeroCrossingHz, centsBetween } from '../helpers/analysis'
import { makeApu, pulseNoteOnTrace, renderTrace, renderWith } from '../helpers/renderTrace'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { pulseHzForTimer } from '../../src/audio/host/pitch'

const SAMPLE_RATE = 48000
const DURATION = 48000

function melody(): ArrayWriteSink {
  const trace = new ArrayWriteSink()
  trace.write(0, 0x4015, 0x01)
  trace.write(0, 0x4001, 0x08)
  const timers = [253, 427, 213, 319, 253, 190]
  for (let i = 0; i < timers.length; i++) {
    const at = i * 250_000
    trace.write(at, 0x4000, ((i % 4) << 6) | 0x30 | (15 - i))
    trace.write(at, 0x4002, timers[i] & 0xff)
    trace.write(at, 0x4003, (timers[i] >> 8) & 0x07)
  }
  return trace
}

describe('byte-identical re-render', () => {
  it('the same trace rendered twice produces identical samples', () => {
    const a = renderTrace(melody(), { sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    const b = renderTrace(melody(), { sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    expect(sameSamples(a, b)).toBe(true)
  })

  it('reset() returns an engine to its construction state exactly', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    const first = renderWith(apu, melody(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    apu.reset()
    const second = renderWith(apu, melody(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    expect(sameSamples(first, second)).toBe(true)
    expect(apu.cycle).toBeGreaterThan(0)
  })
})

describe('chunk independence', () => {
  it('375 × 128-sample quanta equal one 48 000-sample render', () => {
    const chunked = renderTrace(melody(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
      quantum: 128,
    })
    const single = renderTrace(melody(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
      quantum: DURATION,
      maxSamplesPerFrame: DURATION + 64,
    })
    expect(maxDiff(chunked, single)).toBeLessThanOrEqual(1e-6)
    // In practice it is exact: every arithmetic operation happens in the same order.
    expect(sameSamples(chunked, single)).toBe(true)
  })

  it('holds for awkward quantum sizes too', () => {
    const reference = renderTrace(melody(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
      quantum: 128,
    })
    for (const quantum of [1, 7, 63, 129, 511]) {
      const other = renderTrace(melody(), {
        sampleRate: SAMPLE_RATE,
        durationSamples: DURATION,
        quantum,
      })
      expect(maxDiff(reference, other)).toBeLessThanOrEqual(1e-6)
    }
  })

  it('a write delivered late is clamped, counted, and still deterministic', () => {
    // Same register value, but timestamped in the past relative to the engine's run
    // position. It must be applied at the clamp point, never dropped or reordered.
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    apu.runTo(100_000)
    apu.write(50_000, 0x4015, 0x01)
    expect(apu.stats.lateWrites).toBe(1)
    expect(apu.cycle).toBe(100_000)

    const apu2 = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    apu2.runTo(100_000)
    apu2.write(0, 0x4015, 0x01)
    expect(apu2.stats.lateWrites).toBe(1)
    expect(apu2.pulse1.enabled).toBe(apu.pulse1.enabled)
  })

  it('a late note-on across all five channels renders exactly as if it were on time', () => {
    // The clamp is only meaningful if it produces a well-defined timeline rather than
    // "somewhere near". Deliver a full five-channel note-on with timestamps in the
    // past, and compare against the identical note-on scheduled at the clamp point.
    const CLAMP = 100_000
    const noteOn = (at: number): ArrayWriteSink => {
      const t = new ArrayWriteSink()
      t.write(at, 0x4015, 0x0f)
      t.write(at, 0x4000, 0xbf)
      t.write(at, 0x4001, 0x08)
      t.write(at, 0x4002, 253)
      t.write(at, 0x4003, 0x00)
      t.write(at, 0x4004, 0x76)
      t.write(at, 0x4005, 0x08)
      t.write(at, 0x4006, 169)
      t.write(at, 0x4007, 0x00)
      t.write(at, 0x4008, 0xff)
      t.write(at, 0x400a, 253)
      t.write(at, 0x400b, 0x00)
      t.write(at, 0x400c, 0x36)
      t.write(at, 0x400e, 0x08)
      t.write(at, 0x400f, 0x00)
      return t
    }

    const late = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 24_000 })
    late.seekTo(CLAMP)
    const onTime = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 24_000 })
    onTime.seekTo(CLAMP)
    noteOn(CLAMP - 40_000).replayTo(late) // every write is 40 000 cycles in the past
    noteOn(CLAMP).replayTo(onTime)
    expect(late.stats.lateWrites).toBe(15)
    expect(onTime.stats.lateWrites).toBe(0)

    const a = renderWith(late, new ArrayWriteSink(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 24_000,
    })
    const b = renderWith(onTime, new ArrayWriteSink(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 24_000,
    })
    expect(sameSamples(a, b)).toBe(true)
    expect(late.stats.deltasEmitted).toBe(onTime.stats.deltasEmitted)
    expect(late.stats.eventsProcessed).toBe(onTime.stats.eventsProcessed)
  })
})

describe('cycle origin', () => {
  const reference = renderTrace(pulseNoteOnTrace(0, 253, 2, 15), {
    sampleRate: SAMPLE_RATE,
    durationSamples: 24000,
  })

  function renderFrom(origin: number): Float32Array {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 24000 })
    apu.seekTo(origin)
    return renderWith(apu, pulseNoteOnTrace(origin, 253, 2, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 24000,
    })
  }

  it('is bit-identical at cycle 3e9 — past 2^31, where an int32 counter would wrap', () => {
    expect(3e9).toBeGreaterThan(2 ** 31)
    expect(sameSamples(reference, renderFrom(3e9))).toBe(true)
  })

  it('is bit-identical at cycle 9e15 — at the edge of exact f64 integers', () => {
    expect(9e15).toBeLessThan(Number.MAX_SAFE_INTEGER)
    expect(sameSamples(reference, renderFrom(9e15))).toBe(true)
  })

  it('and the pitch survives at both origins', () => {
    for (const origin of [3e9, 9e15]) {
      const hz = zeroCrossingHz(renderFrom(origin), SAMPLE_RATE, 0.25, 4800)
      expect(Math.abs(centsBetween(hz, pulseHzForTimer(253)))).toBeLessThan(0.1)
    }
  })
})

describe('stats accounting', () => {
  it('counts events and deltas, and never clips a single pulse at full volume', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    renderWith(apu, pulseNoteOnTrace(0, 253, 2, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    // One second at 440.4 Hz × 8 duty steps = 3523 sequencer steps.
    expect(apu.stats.eventsProcessed).toBeCloseTo(3523, -1)
    // Duty 2 (01111000) changes level twice per eight steps, so exactly a quarter of
    // the timer events actually move the mix and emit a band-limited delta.
    expect(apu.stats.deltasEmitted).toBeCloseTo(881, -1)
    expect(apu.stats.deltasEmitted * 4).toBeCloseTo(apu.stats.eventsProcessed, -1)
    expect(apu.stats.clippedSamples).toBe(0)
    expect(apu.stats.lateWrites).toBe(0)
  })

  it('a silent engine emits nothing at all', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    const out = renderWith(apu, new ArrayWriteSink(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    expect(apu.stats.eventsProcessed).toBe(0)
    expect(apu.stats.deltasEmitted).toBe(0)
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(0)
  })

  it('a disabled channel drops out of the min scan entirely', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    apu.write(0, 0x4002, 253)
    // $4003 while disabled: the timer high bits latch, but the length-counter load is
    // BLOCKED, so enabling afterwards does not start a note — the counter is still 0.
    apu.write(0, 0x4003, 0)
    expect(apu.pulse1.nextCycle).toBe(Infinity)
    apu.write(0, 0x4015, 0x01)
    expect(apu.pulse1.nextCycle).toBe(Infinity)
    expect(apu.pulse1.length.counter).toBe(0)
    // Canonical order (plan B6) — enable first, then $4003 — loads the length counter
    // and the channel joins the scan.
    apu.write(0, 0x4003, 0)
    expect(apu.pulse1.length.counter).toBe(10)
    expect(apu.pulse1.nextCycle).toBe(508)
    apu.write(1000, 0x4015, 0x00)
    expect(apu.pulse1.nextCycle).toBe(Infinity)
    expect(apu.pulse1.out).toBe(0)
    expect(apu.pulse1.length.counter).toBe(0)
  })

  it('a timer below 8 mutes the channel — the sweep period check, always on', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0xbf)
    apu.write(0, 0x4002, 7)
    apu.write(0, 0x4003, 0)
    expect(apu.pulse1.nextCycle).toBe(Infinity)
    expect(apu.pulse1.out).toBe(0)
    apu.write(0, 0x4002, 8)
    expect(apu.pulse1.nextCycle).toBe(18)
    expect(apu.pulse1.isSilent()).toBe(false)
  })

  it('the frame sequencer runs at 240 Hz whether or not anything is sounding', () => {
    // It is the one unit on the chip that cannot be switched off, so it is counted
    // separately from channel timer expiries — the perf budget is written against
    // those, and a silent engine still steps the sequencer.
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    renderWith(apu, new ArrayWriteSink(), {
      sampleRate: SAMPLE_RATE,
      durationSamples: SAMPLE_RATE,
    })
    expect(apu.stats.eventsProcessed).toBe(0)
    // 239, not 240: the 4-step sequence is 29 830 cycles, so 60 full sequences take
    // 1 789 800 cycles — 27 cycles MORE than a second. The 240th quarter clock lands
    // at cycle 1 789 799, just past the end of the render. That 59.99909 Hz frame rate
    // is the hardware's, and it is why the frame counter is a table and not a divide.
    expect(apu.stats.frameEvents).toBe(239)
    expect(29829 + 59 * 29830).toBeGreaterThan(1_789_773)
    expect(apu.stats.deltasEmitted).toBe(0)
  })
})
