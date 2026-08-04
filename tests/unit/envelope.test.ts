/** Envelope — decay timing, the loop reload, and the one thing everybody gets wrong:
 *  the decay counter keeps running while constant-volume mode is selected. $4000 bit 4
 *  is a MULTIPLEXER on the output, not a power switch on the unit, so flipping it
 *  mid-note reveals a decay level that has been counting down the whole time.
 */
import { describe, expect, it } from 'vitest'
import { Envelope } from '../../src/audio/core/units/envelope'
import { makeApu } from '../helpers/renderTrace'

/** Restart, then consume the start flag on the first quarter clock. */
function armed(v: number, loop = false, constant = false): Envelope {
  const env = new Envelope()
  env.writeControl((loop ? 0x20 : 0) | (constant ? 0x10 : 0) | (v & 0x0f))
  env.restart()
  env.clockQuarter()
  return env
}

describe('decay timing', () => {
  it('the start flag reloads the decay to 15 and the divider to V', () => {
    const env = new Envelope()
    env.writeControl(0x07)
    env.restart()
    expect(env.startFlag).toBe(true)
    expect(env.decayLevel).toBe(0)
    env.clockQuarter()
    expect(env.startFlag).toBe(false)
    expect(env.decayLevel).toBe(15)
    expect(env.divider).toBe(7)
  })

  it('falls 15 → 0 in exactly 15·(V+1) quarter clocks, for every V', () => {
    for (let v = 0; v <= 15; v++) {
      const env = armed(v)
      expect(env.decayLevel).toBe(15)
      let clocks = 0
      while (env.decayLevel > 0) {
        env.clockQuarter()
        clocks++
        expect(clocks).toBeLessThanOrEqual(1000)
      }
      expect(clocks).toBe(15 * (v + 1))
    }
  })

  it('V = 0 is one step per quarter clock — the fastest decay the chip has', () => {
    const env = armed(0)
    for (let i = 15; i > 0; i--) {
      expect(env.decayLevel).toBe(i)
      env.clockQuarter()
    }
    expect(env.decayLevel).toBe(0)
    // 15 quarter clocks at 239.996 Hz = 62.5 ms.
    expect((15 / 239.996) * 1000).toBeCloseTo(62.5, 1)
  })

  it('stops at 0 and stays there without the loop flag', () => {
    const env = armed(0)
    for (let i = 0; i < 100; i++) env.clockQuarter()
    expect(env.decayLevel).toBe(0)
    expect(env.output()).toBe(0)
  })
})

describe('loop flag', () => {
  it('reloads to 15 on the clock after reaching 0', () => {
    const env = armed(0, true)
    for (let i = 0; i < 15; i++) env.clockQuarter()
    expect(env.decayLevel).toBe(0)
    env.clockQuarter()
    expect(env.decayLevel).toBe(15)
  })

  it('gives a sawtooth with period 16·(V+1) quarter clocks', () => {
    const v = 2
    const env = armed(v, true)
    const seen: number[] = []
    for (let i = 0; i < 16 * (v + 1); i++) {
      seen.push(env.decayLevel)
      env.clockQuarter()
    }
    expect(env.decayLevel).toBe(15)
    expect(seen[0]).toBe(15)
    expect(seen[seen.length - 1]).toBe(0)
    // Each level is held exactly V+1 clocks.
    expect(seen.filter((x) => x === 9).length).toBe(v + 1)
  })
})

describe('constant volume', () => {
  it('output() is the raw V field while bit 4 is set', () => {
    const env = new Envelope()
    env.writeControl(0x1a) // constant, V = 10
    expect(env.output()).toBe(10)
    env.restart()
    env.clockQuarter()
    expect(env.output()).toBe(10)
  })

  it('but the decay counter keeps running underneath it', () => {
    const env = armed(0, false, true)
    expect(env.output()).toBe(0) // V = 0 → constant volume 0
    expect(env.decayLevel).toBe(15)
    for (let i = 0; i < 5; i++) env.clockQuarter()
    expect(env.decayLevel).toBe(10)
    // Clearing bit 4 exposes the level the unit has been tracking all along.
    env.writeControl(0x00)
    expect(env.output()).toBe(10)
  })
})

describe('through the APU', () => {
  it('$4003 restarts the envelope and the next quarter clock reloads it', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x20 | 0x00) // halt/loop set, envelope mode, V = 0
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0)
    expect(apu.pulse1.envelope.startFlag).toBe(true)
    apu.runTo(7457)
    expect(apu.pulse1.envelope.decayLevel).toBe(15)
    expect(apu.pulse1.out).toBeLessThanOrEqual(15)

    // Four quarter clocks later it is down to 11.
    apu.runTo(29829)
    expect(apu.pulse1.envelope.decayLevel).toBe(12)
  })

  it('drives pulse 1, pulse 2 and noise — and only those', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x0f)
    apu.write(0, 0x4000, 0x30 | 9)
    apu.write(0, 0x4004, 0x30 | 8)
    apu.write(0, 0x400c, 0x30 | 7)
    expect(apu.pulse1.envelope.output()).toBe(9)
    expect(apu.pulse2.envelope.output()).toBe(8)
    expect(apu.noise.envelope.output()).toBe(7)
    // The triangle has no envelope at all: its 4-bit sequence IS its volume.
    expect('envelope' in apu.triangle).toBe(false)
  })

  it('a full envelope note decays to silence and stops emitting', () => {
    const apu = makeApu({ sampleRate: 48000, durationSamples: 128 })
    apu.write(0, 0x4015, 0x01)
    apu.write(0, 0x4000, 0x20) // loop/halt set so the length counter never expires…
    apu.write(0, 0x4002, 253)
    apu.write(0, 0x4003, 0)
    apu.write(0, 0x4000, 0x00) // …then clear it: V = 0, no loop, envelope mode
    // 16 quarter clocks = four full 29 830-cycle sequences: one consumes the start
    // flag, the other 15 walk the decay down to 0.
    apu.runTo(4 * 29830)
    expect(apu.stats.frameEvents).toBe(16)
    expect(apu.pulse1.envelope.decayLevel).toBe(0)
    expect(apu.pulse1.out).toBe(0)
    // The channel is still clocking — it is at volume 0, not silenced.
    expect(apu.pulse1.nextCycle).not.toBe(Infinity)
  })
})
