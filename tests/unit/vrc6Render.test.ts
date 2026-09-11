/** The VRC6 through the shipped signal path: band-limited synthesis, the non-linear
 *  2A03 mix it is added to, and the analog section. Register semantics are in
 *  vrc6.test.ts; what is measured here is audio.
 */
import { describe, expect, it } from 'vitest'
import { Apu2A03 } from '../../src/audio/core/apu2a03'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { VRC6_GAIN } from '../../src/audio/core/mixer'
import { PULSE_LUT } from '../../src/audio/core/tables'
import { VRC6_SAW_STEPS } from '../../src/audio/core/vrc6/vrc6Saw'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { centsBetween, dftFundamentalHz, sameSamples, zeroCrossingHz } from '../helpers/analysis'
import {
  makeApu,
  pulseNoteOnTrace,
  renderTrace,
  renderWith,
  vrc6PulseNoteOnTrace,
  vrc6SawNoteOnTrace,
} from '../helpers/renderTrace'

const SAMPLE_RATE = 48000
const DURATION = 65536

/** Peak-to-peak swing over a window that starts after the high-passes have settled. */
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

describe('rendered pitch', () => {
  it('a VRC6 pulse at P=253 measures 440.4 Hz — fCPU/(16·254), the 2A03 anchor', () => {
    const signal = renderTrace(vrc6PulseNoteOnTrace(0, 0, 253, 7, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    const ideal = NTSC_CPU_HZ / (16 * 254)
    expect(ideal).toBeCloseTo(440.3969, 4)
    const zc = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 4800)
    const dft = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(zc, ideal))).toBeLessThan(0.5)
    expect(Math.abs(centsBetween(dft, ideal))).toBeLessThan(0.5)
  })

  it('a VRC6 saw at P=253 measures fCPU/(14·254) — a DIFFERENT divisor, audibly', () => {
    const signal = renderTrace(vrc6SawNoteOnTrace(0, 253, 42), {
      sampleRate: SAMPLE_RATE,
      durationSamples: DURATION,
    })
    const ideal = NTSC_CPU_HZ / (VRC6_SAW_STEPS * 254)
    expect(ideal).toBeCloseTo(503.3107, 4)
    const dft = dftFundamentalHz(signal, SAMPLE_RATE, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(dft, ideal))).toBeLessThan(1)
    // The saw is 8/7 of the pulse at the same period — the two divisors are not
    // interchangeable, which is what makes this measurement worth taking.
    expect(Math.abs(centsBetween(ideal, NTSC_CPU_HZ / (16 * 254)))).toBeGreaterThan(200)
  })
})

describe('level: VRC6_GAIN calibrates one VRC6 pulse against one lone 2A03 pulse', () => {
  const from = 8192
  const to = 40000
  const vrc6One = renderTrace(vrc6PulseNoteOnTrace(0, 0, 253, 7, 15), {
    sampleRate: SAMPLE_RATE,
    durationSamples: DURATION,
  })
  const apuOne = renderTrace(pulseNoteOnTrace(0, 253, 2, 15), {
    sampleRate: SAMPLE_RATE,
    durationSamples: DURATION,
  })

  it('the gain is PULSE_LUT[15] / 15 exactly, so 15 · gain is one lone 2A03 pulse', () => {
    expect(VRC6_GAIN).toBe(PULSE_LUT[15] / 15)
    expect(15 * VRC6_GAIN).toBe(PULSE_LUT[15])
  })

  it('and the two render the same peak-to-peak swing within 2 % (plan phase 3(b))', () => {
    const ratio = swing(vrc6One, from, to) / swing(apuOne, from, to)
    expect(Math.abs(ratio - 1)).toBeLessThan(0.02)
  })

  it('anti-vacuity: TWO in-phase VRC6 pulses swing twice as far, far outside the band', () => {
    const both = new ArrayWriteSink()
    vrc6PulseNoteOnTrace(0, 0, 253, 7, 15).replayTo(both)
    vrc6PulseNoteOnTrace(0, 1, 253, 7, 15).replayTo(both)
    const signal = renderTrace(both, { sampleRate: SAMPLE_RATE, durationSamples: DURATION })
    const ratio = swing(signal, from, to) / swing(apuOne, from, to)
    expect(ratio).toBeGreaterThan(1.9)
    expect(ratio).toBeLessThan(2.1)
    // i.e. a VRC6_GAIN twice as large would land here and the 2 % gate above would fail.
    expect(Math.abs(ratio - 1)).toBeGreaterThan(0.02)
  })

  it('the VRC6 term is added to the linear mixer mode too', () => {
    const lut = renderTrace(vrc6PulseNoteOnTrace(0, 0, 253, 7, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 16384,
    })
    const linear = renderTrace(vrc6PulseNoteOnTrace(0, 0, 253, 7, 15), {
      sampleRate: SAMPLE_RATE,
      durationSamples: 16384,
      mixerMode: 'linear',
    })
    // Same swing in both modes: the VRC6 is linear either way, and no 2A03 channel
    // sounds here, so the mode changes nothing about this signal.
    expect(swing(linear, from, 16000)).toBeCloseTo(swing(lut, from, 16000), 6)
    expect(swing(lut, from, 16000)).toBeGreaterThan(0.01)
  })
})

describe('D-V1 — a silent VRC6 oscillator freezes its divider', () => {
  const PERIOD = 253
  const STEP = PERIOD + 1

  function enabledAt(cycle: number): Apu2A03 {
    const a = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    a.write(cycle, 0x9000, (7 << 4) | 15)
    a.write(cycle, 0x9001, PERIOD & 0xff)
    a.write(cycle, 0x9002, 0x80)
    return a
  }

  it('a freshly enabled channel steps on the very next cycle, then every P+1', () => {
    const a = enabledAt(0)
    expect(a.vrc6p1.nextCycle).toBe(1)
    a.runTo(1)
    expect(a.vrc6p1.stepCycle).toBe(1)
    expect(a.vrc6p1.nextCycle).toBe(1 + STEP)
    a.runTo(1 + STEP)
    expect(a.vrc6p1.nextCycle).toBe(1 + 2 * STEP)
  })

  it('halt freezes it, and release restarts the divider rather than resuming it', () => {
    const a = enabledAt(0)
    a.runTo(250)
    const armed = a.vrc6p1.nextCycle
    expect(armed).toBe(1 + STEP) // 5 cycles of the current step still to run
    a.write(250, 0x9003, 0x01)
    expect(a.vrc6p1.nextCycle).toBe(Infinity)
    a.runTo(9_999)
    a.write(10_000, 0x9003, 0x00)

    // Frozen: the divider restarts one cycle after the release.
    expect(a.vrc6p1.nextCycle).toBe(10_001)
    // Anti-vacuity: real hardware keeps the partial period, so it would have expired
    // at release + (armed − haltCycle) = 10 005. The two answers differ, which is
    // exactly what makes this a deviation worth a ledger entry rather than a detail.
    const hardware = 10_000 + (armed - 250)
    expect(hardware).toBe(10_005)
    expect(a.vrc6p1.nextCycle).not.toBe(hardware)
    // The cost is bounded by one step: never more than P+1 cycles of phase.
    expect(Math.abs(a.vrc6p1.nextCycle - hardware)).toBeLessThanOrEqual(STEP)
  })

  it('but the disable → enable case is hardware-exact: a disable zeroes the timer', () => {
    const a = enabledAt(0)
    a.runTo(600)
    a.write(600, 0x9002, 0x00)
    expect(a.vrc6p1.nextCycle).toBe(Infinity)
    a.runTo(5_000)
    a.write(5_000, 0x9002, 0x80)
    // Hardware: timer = 0 at the disable, so the first clock after the enable expires.
    expect(a.vrc6p1.nextCycle).toBe(5_001)
    expect(a.vrc6p1.step).toBe(0)
  })

  it('a channel that is never written contributes NOTHING to the min scan', () => {
    const a = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    a.write(0, 0x4015, 0x01)
    a.write(0, 0x4000, 0xbf)
    a.write(0, 0x4002, 253)
    a.write(0, 0x4003, 0x00)
    const before = a.stats.eventsProcessed
    a.runTo(100_000)
    const withoutVrc6 = a.stats.eventsProcessed - before
    const b = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    b.write(0, 0x4015, 0x01)
    b.write(0, 0x4000, 0xbf)
    b.write(0, 0x4002, 253)
    b.write(0, 0x4003, 0x00)
    b.write(0, 0x9000, 0x7f) // control only: no enable bit, so still nothing to step
    b.runTo(100_000)
    expect(b.stats.eventsProcessed).toBe(withoutVrc6)
  })
})

describe('determinism with the VRC6 in the mix', () => {
  function eightVoices(origin: number): ArrayWriteSink {
    const trace = new ArrayWriteSink()
    pulseNoteOnTrace(origin, 253, 2, 15).replayTo(trace)
    trace.write(origin, 0x4015, 0x07)
    trace.write(origin, 0x4004, 0x76)
    trace.write(origin, 0x4005, 0x08)
    trace.write(origin, 0x4006, 169)
    trace.write(origin, 0x4007, 0x00)
    trace.write(origin, 0x4008, 0xff)
    trace.write(origin, 0x400a, 253)
    trace.write(origin, 0x400b, 0x00)
    vrc6PulseNoteOnTrace(origin, 0, 213, 7, 15).replayTo(trace)
    vrc6PulseNoteOnTrace(origin, 1, 319, 5, 12).replayTo(trace)
    vrc6SawNoteOnTrace(origin, 190, 42).replayTo(trace)
    trace.write(origin + 400_000, 0x9002, 0x00)
    trace.write(origin + 400_000, 0x9001, 190 & 0xff)
    trace.write(origin + 400_000, 0x9002, 0x80)
    return trace
  }

  it('the same VRC6 trace rendered twice is bit-identical', () => {
    const opts = { sampleRate: SAMPLE_RATE, durationSamples: 48_000 }
    const a = renderTrace(eightVoices(0), opts)
    const b = renderTrace(eightVoices(0), opts)
    expect(sameSamples(a, b)).toBe(true)
    let energy = 0
    for (let i = 0; i < a.length; i++) energy += Math.abs(a[i])
    expect(energy).toBeGreaterThan(1)
  })

  it('and survives seekTo past 2^31, where an int32 timer would have wrapped', () => {
    const opts = { sampleRate: SAMPLE_RATE, durationSamples: 48_000 }
    const reference = renderTrace(eightVoices(0), opts)
    const origin = 3e9
    expect(origin).toBeGreaterThan(2 ** 31)
    const apu = makeApu(opts)
    apu.seekTo(origin)
    const moved = renderWith(apu, eightVoices(origin), opts)
    expect(sameSamples(reference, moved)).toBe(true)
  })
})
