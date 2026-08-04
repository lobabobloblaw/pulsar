/** The bridge's half of the UI↔audio contract: what a knob in native units becomes
 *  in 2A03 registers (plan C3/C4, WP6/M7).
 *
 *  `src/audio/bridge.ts` itself needs an AudioContext, so the mapping was extracted
 *  into `host/paramMapping.ts` — pure arithmetic, no DOM — and both the bridge and
 *  the LiveScheduler import it. That is what these tests pin: the table, and the fact
 *  that the writes the scheduler actually emits agree with it.
 *
 *  The two invariants worth stating out loud:
 *    - a live parameter change NEVER retriggers a note. Nothing here writes $4003
 *      (which would reset the duty phase and reload the length counter) or $4015.
 *    - $4000 is shared by duty and level, so writing one must carry the other.
 */
import { describe, expect, it } from 'vitest'
import {
  PULSE_HALT_CONSTANT,
  SWEEP_OFF_BYTE,
  dutyBits,
  levelNibble,
  masterGainFor,
  paramTarget,
  pulseControlAddr,
  pulseControlByte,
  pulseSweepAddr,
  sweepByteFor,
  volumeFor,
} from '../../src/audio/host/paramMapping'
import { LiveScheduler, type LiveEngine } from '../../src/audio/host/liveScheduler'
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { PARAMS, PHASE1_KNOBS, type ParamId } from '../../src/audio/params'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import type { NesCycle, RegAddr } from '../../src/audio/timeline/types'

/** The same three-field fake the M3 scheduler tests use: no AudioContext anywhere. */
class FakeEngine implements LiveEngine {
  readonly clockRate = NTSC_CPU_HZ
  leadMs = 6
  readonly sink = new ArrayWriteSink()
  now: NesCycle = 100_000
  gain = -1

  nowCycle(): NesCycle {
    return this.now
  }

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.sink.write(cycle, addr, value)
  }

  flush(): void {}

  lateWrites(): number {
    return 0
  }

  setMasterGain(gain: number): void {
    this.gain = gain
  }
}

function sounding(opts: { duty?: number; volume?: number } = {}): {
  engine: FakeEngine
  s: LiveScheduler
} {
  const engine = new FakeEngine()
  const s = new LiveScheduler(engine, {
    duty: opts.duty ?? 2,
    volume: opts.volume ?? 15,
    adaptive: false,
  })
  s.noteOn(69, 127)
  engine.sink.clear()
  return { engine, s }
}

describe('the parameter table', () => {
  it('covers every phase-1 knob, and only lands on registers a live change may touch', () => {
    for (const id of PHASE1_KNOBS) {
      const t = paramTarget(id)
      expect(t.kind).not.toBe('none')
      expect(t.live).toBe(true)
      // $4002/$4003 latch the timer and reload the length counter; $4015 gates the
      // channel. A knob that wrote any of them would retrigger the note.
      expect([0x0000, 0x4000, 0x4001]).toContain(t.addr)
    }
  })

  it('routes duty and level to $4000, sweep to $4001, master volume to no register', () => {
    expect(paramTarget('pulse1.duty')).toEqual({ kind: 'pulseControl', addr: 0x4000, live: true })
    expect(paramTarget('pulse1.envDecay')).toEqual({
      kind: 'pulseControl',
      addr: 0x4000,
      live: true,
    })
    expect(paramTarget('pulse1.sweep')).toEqual({ kind: 'pulseSweep', addr: 0x4001, live: true })
    expect(paramTarget('master.volume')).toEqual({ kind: 'masterGain', addr: 0, live: true })
    // pulse2 would be channel 1 — the addresses are +4, which is the whole reason
    // the writers take a channel index rather than a base address.
    expect(pulseControlAddr(0)).toBe(0x4000)
    expect(pulseSweepAddr(0)).toBe(0x4001)
    expect(pulseControlAddr(1)).toBe(0x4004)
    expect(pulseSweepAddr(1)).toBe(0x4005)
  })

  it('maps the registry defaults onto the bytes the engine starts from', () => {
    const duty = PARAMS['pulse1.duty'].default
    const level = PARAMS['pulse1.envDecay'].default
    expect(duty).toBe(2)
    expect(level).toBe(8)
    expect(pulseControlByte(duty, level)).toBe(0xb8) // 10 111000: duty 2, halt, const, 8
    expect(sweepByteFor(PARAMS['pulse1.sweep'].default)).toBe(SWEEP_OFF_BYTE)
    expect(masterGainFor(PARAMS['master.volume'].default)).toBeCloseTo(
      DEFAULT_MASTER_GAIN * 0.72 * 0.72,
      12,
    )
  })
})

describe('$4000 DDLC VVVV', () => {
  it('puts duty in bits 7-6 and always sets halt + constant volume', () => {
    for (let d = 0; d < 4; d++) {
      const byte = pulseControlByte(d, 15)
      expect(byte >> 6).toBe(d)
      // Bit 5 (halt) keeps a held key sounding past the length counter; bit 4
      // (constant volume) is what makes VVVV a level rather than an envelope period.
      expect(byte & PULSE_HALT_CONSTANT).toBe(PULSE_HALT_CONSTANT)
    }
  })

  it('is a constant-volume level for every value the knob can reach', () => {
    for (let v = 0; v <= 15; v++) {
      const byte = pulseControlByte(2, v)
      expect(byte & 0x0f).toBe(v)
      expect(byte & 0x10).toBe(0x10)
    }
  })

  it('clamps rather than masks, so an out-of-range value cannot wrap into another field', () => {
    expect(dutyBits(-1)).toBe(0)
    expect(dutyBits(4)).toBe(3)
    expect(dutyBits(1.4)).toBe(1)
    expect(levelNibble(-5)).toBe(0)
    expect(levelNibble(40)).toBe(15)
    // The masking version of this would have been (16 & 0x0f) === 0: silence at the
    // top of the knob's travel.
    expect(pulseControlByte(9, 16)).toBe((3 << 6) | PULSE_HALT_CONSTANT | 15)
  })
})

describe('$4001 EPPP NSSS', () => {
  it('is the canonical off byte at 0, and enables with negate for a rising sweep', () => {
    expect(sweepByteFor(0)).toBe(0x08)
    expect(sweepByteFor(-0.4)).toBe(0x08) // quantised knob dust still reads as off
    for (let n = 1; n <= 7; n++) {
      const up = sweepByteFor(n)
      const down = sweepByteFor(-n)
      expect(up & 0x80).toBe(0x80) // enabled
      expect(up & 0x07).toBe(n) // shift
      expect(up & 0x08).toBe(0x08) // negate: a smaller period is a higher note
      expect(down & 0x08).toBe(0) // add: the period grows, the pitch falls
      expect(down & 0x07).toBe(n)
      expect((up >> 4) & 0x07).toBe(3) // divider period
    }
  })

  it('clamps the shift at 7 — the register has three bits and nothing more', () => {
    expect(sweepByteFor(99)).toBe(sweepByteFor(7))
    expect(sweepByteFor(-99)).toBe(sweepByteFor(-7))
    expect(sweepByteFor(7) & 0xff).toBe(sweepByteFor(7))
  })
})

describe('master volume', () => {
  it('applies the exp taper exactly once, and only here', () => {
    expect(masterGainFor(0)).toBe(0)
    expect(masterGainFor(1)).toBeCloseTo(DEFAULT_MASTER_GAIN, 12)
    expect(masterGainFor(0.5)).toBeCloseTo(DEFAULT_MASTER_GAIN * 0.25, 12)
    expect(masterGainFor(-1)).toBe(0)
    expect(masterGainFor(2)).toBeCloseTo(DEFAULT_MASTER_GAIN, 12)
    // The registry declares the taper; `paramFraction` keeps the knob's travel
    // linear on purpose, so if the curve were also applied UI-side it would be
    // squared twice and 0.5 would land at 6 % of full scale instead of 25 %.
    expect(PARAMS['master.volume'].taper).toBe('exp')
  })

  it('reaches the mixer as a gain, never as a register write', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.setParam('master.volume', 0.72)
    expect(engine.gain).toBeCloseTo(masterGainFor(0.72), 12)
    expect(engine.sink.length).toBe(0)
  })
})

describe('velocity', () => {
  it('scales the level nibble and never silences a struck key by accident', () => {
    expect(volumeFor(15, 127)).toBe(15)
    expect(volumeFor(15, 1)).toBe(1)
    expect(volumeFor(1, 1)).toBe(1)
    expect(volumeFor(0, 127)).toBe(0) // the knob is at zero: silence is intended
  })
})

describe('live changes never retrigger', () => {
  it('writes $4000 alone for duty, carrying the current level with it', () => {
    const { engine, s } = sounding({ duty: 2, volume: 9 })
    s.setParam('pulse1.duty', 3)
    expect(engine.sink.addrs).toEqual([0x4000])
    expect(engine.sink.values[0]).toBe(pulseControlByte(3, 9))
  })

  it('writes $4000 alone for level, carrying the current duty with it', () => {
    const { engine, s } = sounding({ duty: 1, volume: 15 })
    s.setParam('pulse1.envDecay', 4)
    expect(engine.sink.addrs).toEqual([0x4000])
    // The shared-register hazard: a naive `(0 << 6) | level` here would silently
    // reset duty to 12.5 % every time the level knob moved.
    expect(engine.sink.values[0]).toBe(pulseControlByte(1, 4))
  })

  it('writes $4001 alone for sweep', () => {
    const { engine, s } = sounding()
    s.setParam('pulse1.sweep', -3)
    expect(engine.sink.addrs).toEqual([0x4001])
    expect(engine.sink.values[0]).toBe(sweepByteFor(-3))
  })

  it('touches no timer, length or enable register for ANY parameter', () => {
    const { engine, s } = sounding()
    const values: Record<ParamId, number[]> = {
      'pulse1.duty': [0, 1, 2, 3],
      'pulse1.envDecay': [0, 7, 15],
      'pulse1.sweep': [-7, 0, 7],
      'master.volume': [0, 0.5, 1],
    }
    for (const id of PHASE1_KNOBS) {
      for (const v of values[id]) s.setParam(id, v)
    }
    for (const addr of engine.sink.addrs) {
      expect(addr === 0x4000 || addr === 0x4001).toBe(true)
    }
    expect(s.sounding).toBe(69) // still the same note, never re-triggered
  })

  it('holds a parameter set while silent and applies it to the next note-on', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { duty: 0, volume: 15, adaptive: false })
    s.setParam('pulse1.duty', 3)
    s.setParam('pulse1.envDecay', 6)
    s.setParam('pulse1.sweep', 2)
    expect(engine.sink.length).toBe(0) // nothing sounds: nothing to write
    s.noteOn(60, 127)
    expect(engine.sink.addrs).toEqual([0x4015, 0x4000, 0x4001, 0x4002, 0x4003])
    expect(engine.sink.values[1]).toBe(pulseControlByte(3, volumeFor(6, 127)))
    expect(engine.sink.values[2]).toBe(sweepByteFor(2))
  })
})
