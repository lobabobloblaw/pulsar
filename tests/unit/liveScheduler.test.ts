/** LiveScheduler — the P1 write producer: what a key press becomes on the timeline.
 *
 *  The scheduler talks to a structural `LiveEngine`, so everything below runs with no
 *  AudioContext and no worklet: a fake engine records the writes and the test asserts
 *  the canonical sequence, the lead arithmetic and the adaptive controller directly.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LEAD_MS,
  LEAD_ADAPT_INTERVAL_MS,
  LiveScheduler,
  MAX_LEAD_MS,
  MIN_LEAD_MS,
  sweepByteFor,
  volumeFor,
  type LiveEngine,
} from '../../src/audio/host/liveScheduler'
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { msToCycles } from '../../src/audio/timeline/clockMap'
import { pulseTimerForMidi } from '../../src/audio/host/pitch'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import type { NesCycle, RegAddr } from '../../src/audio/timeline/types'

class FakeEngine implements LiveEngine {
  readonly clockRate = NTSC_CPU_HZ
  leadMs = DEFAULT_LEAD_MS
  readonly sink = new ArrayWriteSink()
  now: NesCycle = 0
  late = 0
  flushes = 0
  gain = -1

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
    return this.late
  }

  setMasterGain(gain: number): void {
    this.gain = gain
  }
}

/** A clock the test drives by hand, so 2 s of adaptation costs no wall time. */
function fakeClock(): { now: () => number; advance: (ms: number) => void } {
  let t = 1000
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

describe('canonical note-on', () => {
  it('is five writes on ONE cycle, with $4003 last', () => {
    const engine = new FakeEngine()
    engine.now = 100_000
    const s = new LiveScheduler(engine, { duty: 2, volume: 15, adaptive: false })
    s.noteOn(69, 127)

    const { cycles, addrs, values } = engine.sink
    expect(addrs).toEqual([0x4015, 0x4000, 0x4001, 0x4002, 0x4003])
    // Atomic on the timeline: the APU sees them as one instant.
    for (const c of cycles) expect(c).toBe(cycles[0])
    // $4015 enable comes first, $4003 (latches timer high, resets the duty step,
    // reloads length + envelope) comes last.
    expect(values[0]).toBe(0x01)
    // DDLC VVVV — duty 2, length halt + constant volume, level 15.
    expect(values[1]).toBe((2 << 6) | 0x30 | 15)
    expect(values[2]).toBe(0x08) // sweep off
    const timer = pulseTimerForMidi(69, NTSC_CPU_HZ)
    expect(timer).toBe(253) // A440 → 440.3969 Hz, +1.561 cents
    expect(values[3]).toBe(timer & 0xff)
    expect(values[4]).toBe((timer >> 8) & 0x07)
    expect(engine.flushes).toBe(1)
  })

  it('lands at nowCycle + lead — 6 ms is 10 739 NTSC cycles', () => {
    const engine = new FakeEngine()
    engine.now = 1_000_000
    const s = new LiveScheduler(engine, { adaptive: false })
    expect(s.leadMs).toBe(DEFAULT_LEAD_MS)
    s.noteOn(60, 100)
    expect(msToCycles(NTSC_CPU_HZ, 6)).toBe(10_739)
    expect(engine.sink.cycles[0]).toBe(1_000_000 + 10_739)
    expect(s.lastScheduledCycle).toBe(1_000_000 + 10_739)
  })

  it('velocity scales the level, and a struck key is never silent', () => {
    expect(volumeFor(15, 127)).toBe(15)
    expect(volumeFor(15, 64)).toBe(8)
    expect(volumeFor(15, 1)).toBe(1)
    expect(volumeFor(8, 100)).toBe(6)
    expect(volumeFor(0, 127)).toBe(0) // the knob is at zero: silence is intended
    expect(volumeFor(15, 0)).toBe(0)
  })

  it('note-off is a $4015 clear — one write, authentic hard cut', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(69, 127)
    engine.sink.clear()
    s.noteOff(69)
    expect(engine.sink.addrs).toEqual([0x4015])
    expect(engine.sink.values).toEqual([0x00])
    expect(s.sounding).toBe(-1)
  })
})

describe('held notes', () => {
  it('is last-note priority and falls back to the note underneath', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    s.noteOn(64, 127)
    expect(s.sounding).toBe(64)
    expect(s.heldNotes).toBe(2)

    engine.sink.clear()
    s.noteOff(64)
    expect(s.sounding).toBe(60)
    // Retriggered, not silenced.
    expect(engine.sink.addrs).toEqual([0x4015, 0x4000, 0x4001, 0x4002, 0x4003])
    expect(engine.sink.values[4]).toBe((pulseTimerForMidi(60, NTSC_CPU_HZ) >> 8) & 0x07)

    engine.sink.clear()
    s.noteOff(60)
    expect(s.sounding).toBe(-1)
    expect(engine.sink.addrs).toEqual([0x4015])
  })

  it('releasing a note that was already superseded changes nothing audible', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    s.noteOn(64, 127)
    engine.sink.clear()
    s.noteOff(60)
    expect(engine.sink.length).toBe(0)
    expect(s.sounding).toBe(64)
    expect(s.heldNotes).toBe(1)
  })

  it('allNotesOff cuts everything, and is idempotent', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    s.noteOn(67, 127)
    engine.sink.clear()
    s.allNotesOff()
    expect(engine.sink.addrs).toEqual([0x4015])
    expect(s.heldNotes).toBe(0)
    engine.sink.clear()
    s.allNotesOff()
    expect(engine.sink.length).toBe(0)
  })

  it('a repeated key does not stack up in the held list', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    s.noteOn(60, 127)
    expect(s.heldNotes).toBe(1)
    s.noteOff(60)
    expect(s.sounding).toBe(-1)
  })
})

describe('scheduled cycles stay sorted', () => {
  it('never goes backwards, even when the lead shrinks between two events', () => {
    const engine = new FakeEngine()
    engine.now = 500_000
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    const first = s.lastScheduledCycle
    // The adaptive controller just dropped the lead; `now` has barely moved.
    engine.leadMs = 3
    engine.now = 500_010
    s.noteOn(62, 127)
    expect(s.lastScheduledCycle).toBeGreaterThanOrEqual(first)
    // The ring's drain stops at the first future write, so an out-of-order cycle
    // would stall everything behind it.
    const cycles = engine.sink.cycles
    for (let i = 1; i < cycles.length; i++) expect(cycles[i]).toBeGreaterThanOrEqual(cycles[i - 1])
  })
})

describe('adaptive lead (plan B6)', () => {
  it('walks down 0.5 ms per clean 2 s interval, floored at 3 ms', () => {
    const engine = new FakeEngine()
    const clock = fakeClock()
    const s = new LiveScheduler(engine, { now: clock.now })
    expect(s.leadMs).toBe(6)

    clock.advance(LEAD_ADAPT_INTERVAL_MS)
    s.tick()
    expect(s.leadMs).toBe(5.5)
    clock.advance(LEAD_ADAPT_INTERVAL_MS)
    s.tick()
    expect(s.leadMs).toBe(5)

    for (let i = 0; i < 20; i++) {
      clock.advance(LEAD_ADAPT_INTERVAL_MS)
      s.tick()
    }
    expect(s.leadMs).toBe(MIN_LEAD_MS)
  })

  it('does nothing before the 2 s interval is up', () => {
    const engine = new FakeEngine()
    const clock = fakeClock()
    const s = new LiveScheduler(engine, { now: clock.now })
    clock.advance(LEAD_ADAPT_INTERVAL_MS - 1)
    s.tick()
    expect(s.leadMs).toBe(6)
    clock.advance(1)
    s.tick()
    expect(s.leadMs).toBe(5.5)
  })

  it('backs off 2 ms on any late write, and caps at 25 ms', () => {
    const engine = new FakeEngine()
    const clock = fakeClock()
    const s = new LiveScheduler(engine, { now: clock.now })

    engine.late = 1
    clock.advance(LEAD_ADAPT_INTERVAL_MS)
    s.tick()
    expect(s.leadMs).toBe(8)

    // Only NEW late writes count — the counter is monotonic, the delta is what matters.
    clock.advance(LEAD_ADAPT_INTERVAL_MS)
    s.tick()
    expect(s.leadMs).toBe(7.5)

    for (let i = 0; i < 30; i++) {
      engine.late += 3
      clock.advance(LEAD_ADAPT_INTERVAL_MS)
      s.tick()
    }
    expect(s.leadMs).toBe(MAX_LEAD_MS)
  })

  it('converges to the floor under sustained clean play — the M3 soak claim', () => {
    const engine = new FakeEngine()
    const clock = fakeClock()
    const s = new LiveScheduler(engine, { now: clock.now })
    // Five minutes of key mashing with a healthy engine.
    for (let i = 0; i < 5 * 60 * 20; i++) {
      engine.now += 1789 // ~1 ms of cycles between events
      s.noteOn(60 + (i % 12), 100)
      s.noteOff(60 + (i % 12))
      clock.advance(50)
    }
    expect(s.leadMs).toBe(MIN_LEAD_MS)
    expect(engine.late).toBe(0)
  })

  it('is inert when switched off', () => {
    const engine = new FakeEngine()
    const clock = fakeClock()
    const s = new LiveScheduler(engine, { now: clock.now, adaptive: false })
    engine.late = 99
    clock.advance(LEAD_ADAPT_INTERVAL_MS * 10)
    s.tick()
    expect(s.leadMs).toBe(DEFAULT_LEAD_MS)
  })

  it('clamps an out-of-range starting lead into the B6 window', () => {
    const low = new FakeEngine()
    expect(new LiveScheduler(low, { leadMs: 0.5 }).leadMs).toBe(MIN_LEAD_MS)
    const high = new FakeEngine()
    expect(new LiveScheduler(high, { leadMs: 1000 }).leadMs).toBe(MAX_LEAD_MS)
  })
})

describe('setParam', () => {
  it('changes duty through $4000 alone — no $4003, so the phase does not reset', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { duty: 2, volume: 15, adaptive: false })
    s.noteOn(69, 127)
    engine.sink.clear()
    s.setParam('pulse1.duty', 3)
    expect(engine.sink.addrs).toEqual([0x4000])
    expect(engine.sink.values[0]).toBe((3 << 6) | 0x30 | 15)
  })

  it('changes level through $4000, and clamps to the register nibble', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { duty: 0, volume: 15, adaptive: false })
    s.noteOn(69, 127)
    engine.sink.clear()
    s.setParam('pulse1.envDecay', 40)
    expect(engine.sink.values[0]).toBe(0x30 | 15)
    engine.sink.clear()
    s.setParam('pulse1.envDecay', -5)
    expect(engine.sink.values[0]).toBe(0x30 | 0)
  })

  it('maps the sweep knob onto $4001 EPPP NSSS, 0 = the canonical off byte', () => {
    expect(sweepByteFor(0)).toBe(0x08)
    // Positive = pitch rises = the negate flag: a smaller period is a higher note.
    expect(sweepByteFor(3)).toBe(0x80 | 0x30 | 0x08 | 3)
    expect(sweepByteFor(-3)).toBe(0x80 | 0x30 | 3)
    expect(sweepByteFor(7)).toBe(0x80 | 0x30 | 0x08 | 7)
    expect(sweepByteFor(99)).toBe(0x80 | 0x30 | 0x08 | 7)

    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(69, 127)
    engine.sink.clear()
    s.setParam('pulse1.sweep', -2)
    expect(engine.sink.addrs).toEqual([0x4001])
    expect(engine.sink.values[0]).toBe(sweepByteFor(-2))
  })

  it('applies a sweep set while silent to the NEXT note-on', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.setParam('pulse1.sweep', 4)
    expect(engine.sink.length).toBe(0)
    s.noteOn(69, 127)
    expect(engine.sink.values[2]).toBe(sweepByteFor(4))
  })

  it('routes master volume to the mixer gain, not to a register', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.setParam('master.volume', 1)
    expect(engine.gain).toBeCloseTo(DEFAULT_MASTER_GAIN, 12)
    s.setParam('master.volume', 0.5)
    expect(engine.gain).toBeCloseTo(DEFAULT_MASTER_GAIN * 0.25, 12)
    s.setParam('master.volume', 2)
    expect(engine.gain).toBeCloseTo(DEFAULT_MASTER_GAIN, 12)
    expect(engine.sink.length).toBe(0)
  })

  it('flushes at the end of every input event', () => {
    const engine = new FakeEngine()
    const s = new LiveScheduler(engine, { adaptive: false })
    s.noteOn(60, 127)
    s.setParam('pulse1.duty', 1)
    s.noteOff(60)
    s.allNotesOff()
    expect(engine.flushes).toBe(4)
  })
})
