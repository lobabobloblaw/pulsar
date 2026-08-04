/** Per-quantum cost of the engine, against the plan-B2 budget.
 *
 *  The deadline is one 128-frame render quantum at 48 kHz = 2.67 ms. The gate is 10 %
 *  of it: **p99 ≤ 267 µs per quantum** across four scenarios, from an idle engine
 *  (which still steps the frame counter) to plan B2's worst case of roughly 800
 *  band-limited deltas per quantum.
 *
 *  A fifth row is measured and reported but held to the full deadline rather than the
 *  10 % gate: every channel set to the fastest rate its registers allow. It is not a
 *  musical state — the pulses and the triangle are ultrasonic there — but it is
 *  reachable by writing registers, so it is worth knowing that it still renders in real
 *  time. If it ever stops doing so, plan B2's escalation ladder starts with halving the
 *  kernel half-width (H = 16 → 8, still −102 dBc).
 *
 *  The percentile table is computed at module scope: vitest 4 does not run `beforeAll`
 *  or `afterAll` hooks in benchmark mode (verified), and a percentile over per-quantum
 *  wall time is the number the audio thread cares about — not tinybench's mean over a
 *  batch. The `bench()` blocks below then produce the familiar ops/sec report.
 */
import { bench, describe } from 'vitest'
import { Apu2A03 } from '../../src/audio/core/apu2a03'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'

const SAMPLE_RATE = 48000
const QUANTUM = 128
/** 10 % of the 2.67 ms deadline (plan B2). */
const BUDGET_US = 267
/** The deadline itself — the ceiling scenario is held to this instead. */
const DEADLINE_US = (QUANTUM / SAMPLE_RATE) * 1e6

interface Scenario {
  name: string
  /** false for the register-space ceiling, which is held to the full deadline. */
  gated: boolean
  build(): Apu2A03
}

function apu(): Apu2A03 {
  return new Apu2A03({
    sampleRate: SAMPLE_RATE,
    clockRate: NTSC_CPU_HZ,
    maxSamplesPerFrame: 512,
  })
}

/** 32 KiB of alternating bits — every DMC output clock moves the level, so every one
 *  of them emits a delta. */
function dpcmMemory(): Uint8Array {
  const mem = new Uint8Array(0x8000)
  for (let i = 0; i < mem.length; i++) mem[i] = 0b01010101
  return mem
}

const SCENARIOS: Scenario[] = [
  {
    name: 'silence (frame counter only)',
    gated: true,
    build: () => apu(),
  },
  {
    name: 'one pulse, A440 duty 2',
    gated: true,
    build: () => {
      const a = apu()
      a.write(0, 0x4015, 0x01)
      a.write(0, 0x4000, 0xbf)
      a.write(0, 0x4001, 0x08)
      a.write(0, 0x4002, 253)
      a.write(0, 0x4003, 0x00)
      return a
    },
  },
  {
    name: 'all five channels, musical',
    gated: true,
    build: () => {
      const a = apu()
      a.setDpcmMemory(dpcmMemory())
      a.write(0, 0x4015, 0x0f)
      a.write(0, 0x4000, 0xbf)
      a.write(0, 0x4001, 0x08)
      a.write(0, 0x4002, 253)
      a.write(0, 0x4003, 0x00)
      a.write(0, 0x4004, 0x76)
      a.write(0, 0x4005, 0x08)
      a.write(0, 0x4006, 169)
      a.write(0, 0x4007, 0x00)
      a.write(0, 0x4008, 0xff)
      a.write(0, 0x400a, 253)
      a.write(0, 0x400b, 0x00)
      a.write(0, 0x400c, 0x36)
      a.write(0, 0x400e, 0x08)
      a.write(0, 0x400f, 0x00)
      a.write(0, 0x4010, 0x4a)
      a.write(0, 0x4012, 0x00)
      a.write(0, 0x4013, 0xff)
      a.write(0, 0x4015, 0x1f)
      return a
    },
  },
  {
    name: 'worst case (~800 deltas: bright noise + two top-octave pulses + dpcm)',
    gated: true,
    build: () => {
      const a = apu()
      a.setDpcmMemory(dpcmMemory())
      a.write(0, 0x4015, 0x0f)
      // Both pulses at timer 8 — one below is muted by the sweep's period check.
      a.write(0, 0x4000, 0xbf)
      a.write(0, 0x4001, 0x08)
      a.write(0, 0x4002, 8)
      a.write(0, 0x4003, 0x00)
      a.write(0, 0x4004, 0x7f)
      a.write(0, 0x4005, 0x08)
      a.write(0, 0x4006, 8)
      a.write(0, 0x4007, 0x00)
      // Triangle at A440 — a musical pitch, unlike the ceiling scenario below.
      a.write(0, 0x4008, 0xff)
      a.write(0, 0x400a, 126)
      a.write(0, 0x400b, 0x00)
      // Noise at period index 0: an LFSR clock every 4 CPU cycles, 447 kHz.
      a.write(0, 0x400c, 0x3f)
      a.write(0, 0x400e, 0x00)
      a.write(0, 0x400f, 0x00)
      // DPCM at rate index 15 with alternating bits.
      a.write(0, 0x4010, 0x4f)
      a.write(0, 0x4012, 0x00)
      a.write(0, 0x4013, 0xff)
      a.write(0, 0x4015, 0x1f)
      return a
    },
  },
  {
    name: 'register-space ceiling (triangle at t=2 — ultrasonic, not musical)',
    gated: false,
    build: () => {
      const a = apu()
      a.setDpcmMemory(dpcmMemory())
      a.write(0, 0x4015, 0x0f)
      a.write(0, 0x4000, 0xbf)
      a.write(0, 0x4001, 0x08)
      a.write(0, 0x4002, 8)
      a.write(0, 0x4003, 0x00)
      a.write(0, 0x4004, 0x7f)
      a.write(0, 0x4005, 0x08)
      a.write(0, 0x4006, 8)
      a.write(0, 0x4007, 0x00)
      // Timer 2 is the fastest the triangle can run: one below is frozen by D-T1.
      a.write(0, 0x4008, 0xff)
      a.write(0, 0x400a, 2)
      a.write(0, 0x400b, 0x00)
      a.write(0, 0x400c, 0x3f)
      a.write(0, 0x400e, 0x00)
      a.write(0, 0x400f, 0x00)
      a.write(0, 0x4010, 0x4f)
      a.write(0, 0x4012, 0x00)
      a.write(0, 0x4013, 0xff)
      a.write(0, 0x4015, 0x1f)
      return a
    },
  },
]

const out = new Float32Array(QUANTUM)

/** Exactly what the worklet's `process()` does, minus the transport. */
function renderQuantum(a: Apu2A03): void {
  const target = a.cycle + a.cyclesForSamples(QUANTUM)
  a.endFrame(target)
  a.readSamples(out, 0, QUANTUM)
}

interface Measurement {
  name: string
  gated: boolean
  mean: number
  p50: number
  p99: number
  max: number
  events: number
  deltas: number
}

function measure(scenario: Scenario, quanta: number, warmup = 1000): Measurement {
  const a = scenario.build()
  for (let i = 0; i < warmup; i++) renderQuantum(a)
  const events0 = a.stats.eventsProcessed
  const deltas0 = a.stats.deltasEmitted
  const times = new Float64Array(quanta)
  for (let i = 0; i < quanta; i++) {
    const t0 = performance.now()
    renderQuantum(a)
    times[i] = (performance.now() - t0) * 1000
  }
  const sorted = Float64Array.from(times).sort()
  let sum = 0
  for (let i = 0; i < quanta; i++) sum += times[i]
  return {
    name: scenario.name,
    gated: scenario.gated,
    mean: sum / quanta,
    p50: sorted[Math.floor(quanta * 0.5)],
    p99: sorted[Math.floor(quanta * 0.99)],
    max: sorted[quanta - 1],
    events: (a.stats.eventsProcessed - events0) / quanta,
    deltas: (a.stats.deltasEmitted - deltas0) / quanta,
  }
}

function report(): void {
  const rows = SCENARIOS.map((s) => measure(s, s.gated ? 4000 : 1500))
  const pad = (s: string, n: number): string => s.padEnd(n)
  const num = (v: number, n = 8): string => v.toFixed(2).padStart(n)
  const lines: string[] = ['']
  lines.push(
    `µs per ${QUANTUM}-frame quantum at ${SAMPLE_RATE} Hz — deadline ${DEADLINE_US.toFixed(0)} µs, gate ${BUDGET_US} µs (p99)`,
  )
  lines.push(
    `${pad('scenario', 62)}${pad('mean', 10)}${pad('p50', 10)}${pad('p99', 10)}${pad('max', 10)}${pad('events', 10)}${pad('deltas', 9)}`,
  )
  for (const r of rows) {
    lines.push(
      `${pad(r.name, 62)}${num(r.mean)}  ${num(r.p50)}  ${num(r.p99)}  ${num(r.max)}  ${num(r.events)}  ${num(r.deltas, 7)}`,
    )
  }
  const failures: string[] = []
  for (const r of rows) {
    const limit = r.gated ? BUDGET_US : DEADLINE_US
    const pct = ((100 * r.p99) / DEADLINE_US).toFixed(2)
    lines.push(
      `  ${r.gated ? 'GATE ' : 'info '}${r.name}: p99 ${r.p99.toFixed(2)} µs = ${pct} % of the deadline (limit ${limit.toFixed(0)} µs)`,
    )
    if (r.p99 > limit) {
      failures.push(`"${r.name}" p99 ${r.p99.toFixed(2)} µs > ${limit.toFixed(0)} µs`)
    }
  }
  lines.push('')
  console.log(lines.join('\n'))
  if (failures.length > 0) throw new Error(`process() budget exceeded: ${failures.join('; ')}`)
}

report()

describe('Apu2A03 process() budget', () => {
  for (const scenario of SCENARIOS) {
    const engine = scenario.build()
    for (let i = 0; i < 200; i++) renderQuantum(engine)
    bench(scenario.name, () => {
      renderQuantum(engine)
    })
  }
})
