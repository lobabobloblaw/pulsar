/** The behavioural expectations of blargg's APU test ROMs, as plan-file Phase 1 (e)
 *  states them: "length-counter table values, duty phase-reset produces click-then-
 *  silence, triangle stops in phase rather than zeroing its DAC".
 *
 *  The ROMs themselves cannot run here — there is no 6502 — so each item is asserted
 *  the way the ROM observes it: through the register file, at exact cycle counts, with
 *  the frame counter doing the clocking. The individual units have their own files;
 *  this one exists so the acceptance items are in one place and cannot quietly stop
 *  being checked.
 */
import { describe, expect, it } from 'vitest'
import { LENGTH_TABLE } from '../../src/audio/core/tables'
import { rms } from '../helpers/analysis'
import { makeApu, pulseNoteOnTrace, renderWith, triangleNoteOnTrace } from '../helpers/renderTrace'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'

const SAMPLE_RATE = 48000

/** CPU cycle of the k-th half-frame clock (k ≥ 1) in 4-step mode. Half clocks land on
 *  sequence steps 2 and 4, at 14913 and 29829, and the sequence is 29830 long. */
function halfFrameCycle(k: number): number {
  return k % 2 === 1 ? 14913 + ((k - 1) / 2) * 29830 : 29829 + ((k - 2) / 2) * 29830
}

describe('(e1) length counter — the table, observed through $4015', () => {
  it('the k-th half-frame clock leaves exactly (length − k) on the counter', () => {
    expect(halfFrameCycle(1)).toBe(14913)
    expect(halfFrameCycle(2)).toBe(29829)
    expect(halfFrameCycle(3)).toBe(44743)
    expect(halfFrameCycle(4)).toBe(59659)

    for (const index of [3, 0, 15, 31]) {
      const length = LENGTH_TABLE[index]
      const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
      apu.write(0, 0x4015, 0x01)
      apu.write(0, 0x4000, 0x1f) // constant volume 15, halt CLEAR
      apu.write(0, 0x4002, 253)
      apu.write(0, 0x4003, index << 3)
      expect(apu.pulse1.length.counter).toBe(length)

      // One clock short of the end the channel is still sounding…
      apu.runTo(halfFrameCycle(length - 1))
      expect(apu.pulse1.length.counter).toBe(1)
      expect(apu.readStatus(halfFrameCycle(length - 1)) & 0x01).toBe(0x01)

      // …and on the next half-frame clock it stops, to the cycle.
      apu.runTo(halfFrameCycle(length))
      expect(apu.pulse1.length.counter).toBe(0)
      expect(apu.readStatus(halfFrameCycle(length)) & 0x01).toBe(0x00)
      expect(apu.pulse1.out).toBe(0)
      expect(apu.pulse1.nextCycle).toBe(Infinity)
    }
  })

  it('all 32 indices load the documented value and read back as active', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f)
    apu.write(0, 0x4002, 253)
    for (let index = 0; index < 32; index++) {
      apu.write(0, 0x4003, index << 3)
      expect(apu.pulse1.length.counter).toBe(LENGTH_TABLE[index])
      expect(apu.readStatus(0) & 0x01).toBe(0x01)
    }
  })

  it('a halted counter never clears its $4015 bit', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f) // halt SET
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x03 << 3) // length 2 — would expire in 8.3 ms
    apu.runTo(halfFrameCycle(20))
    expect(apu.pulse1.length.counter).toBe(2)
    expect(apu.readStatus(halfFrameCycle(20)) & 0x01).toBe(0x01)
  })
})

describe('(e2) duty phase reset — click, then silence', () => {
  it('$4003 forces the sequencer to step 0, whose output is 0 for duties 0–2', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0xbf) // duty 2 = 01111000
    apu.write(0, 0x4001, 0x08)
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x00)
    expect(apu.pulse1.sequencer.step).toBe(0)
    expect(apu.pulse1.out).toBe(0)

    apu.runTo(508 * 3)
    expect(apu.pulse1.sequencer.step).toBe(3)
    expect(apu.pulse1.out).toBe(15)

    // The click: rewriting $4003 mid-waveform yanks the level back to 0 immediately.
    apu.write(508 * 3, 0x4003, 0x00)
    expect(apu.pulse1.sequencer.step).toBe(0)
    expect(apu.pulse1.out).toBe(0)
  })

  it('and the timer divider is NOT reset — the phase, not the clock, is what moves', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0xbf)
    apu.write(0, 0x4001, 0x08)
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x00)
    expect(apu.pulse1.nextCycle).toBe(508)
    apu.write(300, 0x4003, 0x00) // mid-period
    expect(apu.pulse1.nextCycle).toBe(508) // unchanged: a down-counter reloads on underflow
    apu.write(300, 0x4002, 100) // even a period change does not re-arm it
    expect(apu.pulse1.nextCycle).toBe(508)
  })

  it('repeating the reset at the step rate silences the channel completely', () => {
    // A held note, and the same note with $4003 rewritten once per duty step (508
    // cycles at timer 253). Each rewrite undoes the step the timer just took, at the
    // same cycle, so the two band-limited deltas cancel exactly: the click, and then
    // nothing at all. This is the phase reset doing it — the channel is enabled, its
    // length counter is loaded and its timer is still running.
    const held = pulseNoteOnTrace(0, 253, 2, 15)
    const hammered = pulseNoteOnTrace(0, 253, 2, 15)
    for (let c = 508; c < 48_000 * 4; c += 508) hammered.write(c, 0x4003, 0x00)

    const heldSignal = renderWith(
      makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 }),
      held,
      { sampleRate: SAMPLE_RATE, durationSamples: 4096 },
    )
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 4096 })
    const hammeredSignal = renderWith(apu, hammered, {
      sampleRate: SAMPLE_RATE,
      durationSamples: 4096,
    })

    const heldRms = rms(heldSignal, 1024, 4096)
    const hammeredRms = rms(hammeredSignal, 1024, 4096)
    expect(heldRms).toBeGreaterThan(0.1)
    expect(hammeredRms).toBeLessThan(1e-9)
    // It is the phase reset doing it, not a mute: the channel is still enabled, its
    // length counter is loaded, and its timer is still stepping.
    expect(apu.pulse1.length.active).toBe(true)
    expect(apu.pulse1.isSilent()).toBe(false)
    expect(apu.pulse1.nextCycle).not.toBe(Infinity)
    expect(apu.pulse1.sequencer.step).toBe(0)
    expect(apu.stats.eventsProcessed).toBeGreaterThan(100)
    expect(apu.stats.deltasEmitted).toBeGreaterThan(100)
  })

  it('duty 3 (10011111) is the exception — its step 0 is 1, so it clicks UP', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0xff) // duty 3
    apu.write(0, 0x4001, 0x08)
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0x00)
    expect(apu.pulse1.sequencer.step).toBe(0)
    expect(apu.pulse1.out).toBe(15)
  })
})

describe('(e3) triangle stops in phase and does not zero its DAC', () => {
  it('note-off holds the level, the step and the silence', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    const trace = triangleNoteOnTrace(0, 253)
    trace.replayTo(apu)
    apu.runTo(7457 + 254 * 9) // past the linear-counter reload, nine steps in
    const heldOut = apu.triangle.out
    const heldStep = apu.triangle.step
    expect(heldOut).not.toBe(0)

    apu.write(7457 + 254 * 9, 0x4015, 0x00)
    expect(apu.triangle.out).toBe(heldOut)
    expect(apu.triangle.step).toBe(heldStep)

    const deltas = apu.stats.deltasEmitted
    apu.runTo(7457 + 254 * 9 + 100_000)
    expect(apu.stats.deltasEmitted).toBe(deltas)
    expect(apu.triangle.out).toBe(heldOut)
  })

  it('the held DC is removed by the analog high-passes, not by the channel', () => {
    // Render a triangle note, stop it, and let the output settle: the signal returns to
    // zero because of the 90/440 Hz high-passes, while the channel's DAC stays put.
    const trace = new ArrayWriteSink()
    triangleNoteOnTrace(0, 253).replayTo(trace)
    trace.write(200_000, 0x4015, 0x00)
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 24_000 })
    const signal = renderWith(apu, trace, {
      sampleRate: SAMPLE_RATE,
      durationSamples: 24_000,
    })
    expect(rms(signal, 1000, 5000)).toBeGreaterThan(0.01)
    expect(rms(signal, 16_000, 24_000)).toBeLessThan(1e-3)
    expect(apu.triangle.out).toBeGreaterThan(0)
    expect(apu.triangle.isSilent()).toBe(true)
  })
})

describe('(e4) sweep muting fires even when the sweep is disabled', () => {
  it('a period below 8 mutes with $4001 = 0x00 and with the enable bit clear', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f)
    apu.write(0, 0x4001, 0x00) // sweep DISABLED, shift 0
    apu.write(0, 0x4002, 7)
    apu.write(0, 0x4003, 0x00)
    expect(apu.pulse1.sweep.enabled).toBe(false)
    expect(apu.pulse1.length.active).toBe(true)
    expect(apu.pulse1.isSilent()).toBe(true)
    expect(apu.pulse1.out).toBe(0)
  })

  it('and so does a target above $7FF, which shift 0 reaches at any period ≥ $400', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x3f)
    apu.write(0, 0x4001, 0x00) // shift 0, no negate → target = 2 × period
    apu.write(0, 0x4002, 0x00)
    apu.write(0, 0x4003, 0x04) // timer 0x400
    expect(apu.pulse1.sweep.targetPeriod(0x400)).toBe(0x800)
    expect(apu.pulse1.isSilent()).toBe(true)
    // One below the threshold it sounds again.
    apu.write(0, 0x4002, 0xff)
    apu.write(0, 0x4003, 0x03) // timer 0x3FF
    expect(apu.pulse1.isSilent()).toBe(false)
  })
})
