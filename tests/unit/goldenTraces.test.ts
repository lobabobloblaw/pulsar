/** Golden register traces — the fixtures that outlive the implementation.
 *
 *  Each fixture is a plain-text register timeline plus a `.meta.json` sidecar carrying
 *  the expectations. No audio is stored: audio blobs are unreviewable in a diff and
 *  would have to be regenerated on every kernel tweak, while a trace plus a expected
 *  fundamental is readable, portable, and convertible into a 6502 stub for Mesen or
 *  NSFPlay (see tests/fixtures/README.md).
 *
 *  Two layers of assertion per fixture:
 *    1. the expectations in the sidecar — pitch, silence, level — which are claims
 *       about the HARDWARE and should survive any rewrite of the engine;
 *    2. an inline output checksum, which is a claim about THIS engine and is expected
 *       to change deliberately (and never accidentally).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { centsBetween, dftFundamentalHz, hasNonFinite, maxAbs, rms, zeroCrossingHz } from '../helpers/analysis'
import { dBc, goertzel } from '../helpers/dft'
import { makeApu, renderWith } from '../helpers/renderTrace'

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'traces')

interface TraceMeta {
  clockRate: number
  sampleRate: number
  durationCycles: number
  dpcm?: { address: number; runs: [number, number][] }
  expect: Record<string, unknown>
  reference: { renderer: string; notes: string }
}

interface ParsedTrace {
  clockRate: number
  region: string
  durationCycles: number
  writes: ArrayWriteSink
}

/** Every address `Apu2A03.applyWrite` recognises: the 2A03 block and the VRC6's three.
 *  A fixture is a claim about the hardware, so an address no chip in the engine has is
 *  a typo in the fixture, not a write to ignore. */
function isEngineAddress(addr: number): boolean {
  if (addr >= 0x4000 && addr <= 0x4017) return true
  if (addr >= 0x9000 && addr <= 0x9003) return true
  if (addr >= 0xa000 && addr <= 0xa002) return true
  return addr >= 0xb000 && addr <= 0xb002
}

/** Trace format v1: `# ` comments, then `<cycle> <addrHex> <valueHex>` rows, then
 *  `# END <durationCycles>`. */
function parseTrace(text: string): ParsedTrace {
  const lines = text.split('\n')
  let clockRate = 1789773
  let region = 'ntsc'
  let durationCycles = 0
  let sawHeader = false
  const writes = new ArrayWriteSink()
  let lastCycle = -1
  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') continue
    if (line.startsWith('#')) {
      if (line === '# pulsar-trace v1') sawHeader = true
      const rate = /clockRate=(\d+)/.exec(line)
      if (rate) clockRate = Number(rate[1])
      const reg = /region=(\w+)/.exec(line)
      if (reg) region = reg[1]
      const end = /^# END (\d+)$/.exec(line)
      if (end) durationCycles = Number(end[1])
      continue
    }
    const parts = line.split(/\s+/)
    if (parts.length !== 3) throw new Error(`bad trace row: ${line}`)
    const cycle = Number(parts[0])
    const addr = parseInt(parts[1], 16)
    const value = parseInt(parts[2], 16)
    if (!Number.isInteger(cycle) || cycle < lastCycle) {
      throw new Error(`trace rows must be chronological: ${line}`)
    }
    if (!isEngineAddress(addr)) throw new Error(`address out of range: ${line}`)
    if (value < 0 || value > 0xff) throw new Error(`value out of range: ${line}`)
    lastCycle = cycle
    writes.write(cycle, addr, value)
  }
  if (!sawHeader) throw new Error('missing "# pulsar-trace v1" header')
  if (durationCycles === 0) throw new Error('missing "# END <cycles>" footer')
  return { clockRate, region, durationCycles, writes }
}

function loadFixture(name: string): { trace: ParsedTrace; meta: TraceMeta } {
  const trace = parseTrace(readFileSync(join(FIXTURES, `${name}.trace`), 'utf8'))
  const meta = JSON.parse(readFileSync(join(FIXTURES, `${name}.meta.json`), 'utf8')) as TraceMeta
  return { trace, meta }
}

function dpcmMemory(meta: TraceMeta): Uint8Array | null {
  if (meta.dpcm === undefined) return null
  const mem = new Uint8Array(0x8000)
  let at = meta.dpcm.address - 0x8000
  for (const [byte, count] of meta.dpcm.runs) {
    for (let i = 0; i < count; i++) mem[(at + i) % 0x8000] = byte
    at += count
  }
  return mem
}

/** Render a fixture through the shipped signal path. */
function render(name: string): { signal: Float32Array; meta: TraceMeta; clipped: number } {
  const { trace, meta } = loadFixture(name)
  const durationSamples = Math.floor((meta.durationCycles * meta.sampleRate) / meta.clockRate)
  const apu = makeApu({
    sampleRate: meta.sampleRate,
    clockRate: meta.clockRate,
    durationSamples,
  })
  const mem = dpcmMemory(meta)
  if (mem !== null) apu.setDpcmMemory(mem)
  const signal = renderWith(apu, trace.writes, {
    sampleRate: meta.sampleRate,
    durationSamples,
  })
  return { signal, meta, clipped: apu.stats.clippedSamples }
}

/** FNV-1a over samples quantised to 1e-6 — tight enough to catch any real change,
 *  loose enough to survive last-bit differences in Math.sin/exp across platforms. */
function checksum(signal: Float32Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < signal.length; i++) {
    let v = Math.round(signal[i] * 1e6)
    for (let b = 0; b < 4; b++) {
      h ^= v & 0xff
      h = Math.imul(h, 0x01000193)
      v >>= 8
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

describe('fixture hygiene', () => {
  it('every .trace has a .meta.json and vice versa', () => {
    const files = readdirSync(FIXTURES)
    const traces = files.filter((f) => f.endsWith('.trace')).map((f) => f.slice(0, -6))
    const metas = files.filter((f) => f.endsWith('.meta.json')).map((f) => f.slice(0, -10))
    expect(traces.sort()).toEqual(metas.sort())
    expect(traces.length).toBe(9)
  })

  it('the parser rejects malformed traces', () => {
    expect(() => parseTrace('0 4000 FF\n# END 100')).toThrow(/header/)
    expect(() => parseTrace('# pulsar-trace v1\n0 4000 FF')).toThrow(/END/)
    expect(() => parseTrace('# pulsar-trace v1\n0 3FFF FF\n# END 100')).toThrow(/address/)
    // The VRC6 ranges are exact, not a blanket "anything above $4017": $9004, $A003
    // and $B003 are unmapped and a fixture naming one is wrong.
    expect(() => parseTrace('# pulsar-trace v1\n0 9004 FF\n# END 100')).toThrow(/address/)
    expect(() => parseTrace('# pulsar-trace v1\n0 A003 FF\n# END 100')).toThrow(/address/)
    expect(() => parseTrace('# pulsar-trace v1\n0 B003 FF\n# END 100')).toThrow(/address/)
    expect(() => parseTrace('# pulsar-trace v1\n0 9002 FF\n# END 100')).not.toThrow()
    expect(() => parseTrace('# pulsar-trace v1\n10 4000 FF\n0 4000 00\n# END 100')).toThrow(
      /chronological/,
    )
  })

  it('round-trips the format: parse → replay → identical register stream', () => {
    const { trace } = loadFixture('pulse1-a440-duty2')
    expect(trace.clockRate).toBe(1789773)
    expect(trace.region).toBe('ntsc')
    expect(trace.durationCycles).toBe(1789773)
    expect(trace.writes.length).toBe(5)
    expect(trace.writes.addrs).toEqual([0x4015, 0x4000, 0x4001, 0x4002, 0x4003])
    expect(trace.writes.values).toEqual([0x01, 0xbf, 0x08, 0xfd, 0x00])
  })
})

describe('pulse1-a440-duty2', () => {
  const { signal, meta } = render('pulse1-a440-duty2')

  it('sounds A440 within the sidecar tolerance', () => {
    const hz = zeroCrossingHz(signal, meta.sampleRate, 0.25, 4800)
    expect(Math.abs(centsBetween(hz, meta.expect.fundamentalHz as number))).toBeLessThan(
      meta.expect.toleranceCents as number,
    )
    expect(rms(signal, 4800, 43200)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(hasNonFinite(signal)).toBe(false)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"63e66e7f"`)
  })
})

describe('pulse-sweep-mute', () => {
  const { signal, meta } = render('pulse-sweep-mute')
  const sampleAt = (cycle: number): number =>
    Math.floor((cycle * meta.sampleRate) / meta.clockRate)

  it('sounds for the first half-frame, then goes permanently silent', () => {
    const before = rms(signal, 32, sampleAt(14913))
    expect(before).toBeGreaterThan(meta.expect.rmsMin as number)
    const after = rms(signal, sampleAt(meta.expect.silentAfterCycle as number), signal.length)
    expect(after).toBeLessThan(1e-3)
    expect(after).toBeLessThan(before / 100)
  })

  it('and the mute is the sweep unit, not the length counter', () => {
    const { trace, meta: m } = loadFixture('pulse-sweep-mute')
    const apu = makeApu({ sampleRate: m.sampleRate, durationSamples: 128 })
    trace.writes.replayTo(apu)
    apu.runTo(14913)
    expect(apu.pulse1.length.active).toBe(true)
    expect(apu.pulse1.timer).toBe(0x600)
    expect(apu.pulse1.sweep.isMuting(apu.pulse1.timer)).toBe(true)
    expect(apu.pulse1.isSilent()).toBe(true)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"bd5e3511"`)
  })
})

describe('triangle-a440', () => {
  const { signal, meta } = render('triangle-a440')

  it('sounds A440 and is a triangle, not a square', () => {
    const hz = zeroCrossingHz(signal, meta.sampleRate, 0.25, 4800)
    expect(Math.abs(centsBetween(hz, meta.expect.fundamentalHz as number))).toBeLessThan(
      meta.expect.toleranceCents as number,
    )
    expect(rms(signal, 12000, 43200)).toBeGreaterThan(meta.expect.rmsMin as number)

    function magnitude(harmonic: number): number {
      let re = 0
      let im = 0
      for (let k = 0; k < 16384; k++) {
        const w = (2 * Math.PI * harmonic * 440.3969 * k) / meta.sampleRate
        re += signal[12000 + k] * Math.cos(w)
        im += signal[12000 + k] * Math.sin(w)
      }
      return Math.hypot(re, im)
    }
    const dbc = 20 * Math.log10(magnitude(3) / magnitude(1))
    expect(dbc).toBeLessThan(meta.expect.thirdHarmonicDbcMax as number)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"4aaaab26"`)
  })
})

describe('noise-modes', () => {
  const { signal, meta } = render('noise-modes')

  it('is broadband in long mode and tonal in short mode', () => {
    const half = Math.floor(signal.length / 2)
    expect(rms(signal, 1000, half)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(rms(signal, half + 1000, signal.length)).toBeGreaterThan(
      meta.expect.rmsMin as number,
    )
    // Short mode's 93-step cycle is a pitch: 1789773 / (64 · 93) = 300.7 Hz.
    const hz = dftFundamentalHz(signal, meta.sampleRate, half + 2000, 16384, 200, 500)
    expect(
      Math.abs(centsBetween(hz, meta.expect.shortModeFundamentalHz as number)),
    ).toBeLessThan(meta.expect.shortModeToleranceCents as number)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"86e145fb"`)
  })
})

describe('dmc-ramp', () => {
  const { signal, meta } = render('dmc-ramp')

  it('loops the 33-byte sample at the rate the table predicts', () => {
    const hz = zeroCrossingHz(signal, meta.sampleRate, 0.25, 8192)
    expect(Math.abs(centsBetween(hz, meta.expect.fundamentalHz as number))).toBeLessThan(
      meta.expect.toleranceCents as number,
    )
    expect(rms(signal, 4800, signal.length)).toBeGreaterThan(meta.expect.rmsMin as number)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"b093c29d"`)
  })
})

describe('all-channels-mix', () => {
  const { signal, meta, clipped } = render('all-channels-mix')

  it('plays all five channels without clipping or NaN', () => {
    expect(rms(signal, 4800, signal.length)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(maxAbs(signal)).toBeLessThanOrEqual(meta.expect.peakMax as number)
    expect(clipped).toBeLessThanOrEqual(meta.expect.clippedSamplesMax as number)
    expect(hasNonFinite(signal)).toBe(false)
  })

  it('really has five sources contributing', () => {
    const { trace, meta: m } = loadFixture('all-channels-mix')
    const mem = dpcmMemory(m)
    const apu = makeApu({ sampleRate: m.sampleRate, durationSamples: 128 })
    if (mem !== null) apu.setDpcmMemory(mem)
    trace.writes.replayTo(apu)
    apu.runTo(1_000_000)
    expect(apu.pulse1.isSilent()).toBe(false)
    expect(apu.pulse2.isSilent()).toBe(false)
    expect(apu.triangle.isSilent()).toBe(false)
    expect(apu.noise.isSilent()).toBe(false)
    expect(apu.dmc.isIdle()).toBe(false)
    expect(apu.readStatus(1_000_000) & 0x1f).toBe(0x1f)
  })

  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"17fba1f6"`)
  })
})

/** A single known frequency's magnitude, measured a quarter second in. */
function partial(signal: Float32Array, sampleRate: number, hz: number): number {
  return goertzel(signal, sampleRate, hz, 12_000, 32_768)
}

describe('vrc6-pulse-a440', () => {
  const { signal, meta } = render('vrc6-pulse-a440')

  it('sounds A440 off the VRC6, at the 2A03 pulse anchor', () => {
    const hz = zeroCrossingHz(signal, meta.sampleRate, 0.25, 4800)
    expect(Math.abs(centsBetween(hz, meta.expect.fundamentalHz as number))).toBeLessThan(
      meta.expect.toleranceCents as number,
    )
    expect(rms(signal, 4800, 43200)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(hasNonFinite(signal)).toBe(false)
  })

  it('and duty 7 really is the 50 % square: the even harmonics are gone', () => {
    const f = meta.expect.fundamentalHz as number
    const h1 = partial(signal, meta.sampleRate, f)
    expect(dBc(partial(signal, meta.sampleRate, 2 * f), h1)).toBeLessThan(-60)
    expect(dBc(partial(signal, meta.sampleRate, 3 * f), h1)).toBeGreaterThan(-12)
  })

  // measured: fundamental 440.398 Hz (zero-crossing) / 440.394 Hz (DFT) against the
  // ideal 440.3969; peak-to-peak 0.287 at the default 2.0 master gain, rms 0.107 —
  // the same swing as the lone 2A03 pulse fixture, which is what VRC6_GAIN is for.
  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"624d498e"`)
  })
})

describe('vrc6-saw-e5', () => {
  const { signal, meta } = render('vrc6-saw-e5')

  it('sounds fCPU/(14·254) — the sawtooth divisor, not the pulse one', () => {
    const hz = dftFundamentalHz(signal, meta.sampleRate, 8192, 32768, 100, 2000)
    expect(Math.abs(centsBetween(hz, meta.expect.fundamentalHz as number))).toBeLessThan(
      meta.expect.toleranceCents as number,
    )
    expect(rms(signal, 4800, 43200)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(hasNonFinite(signal)).toBe(false)
  })

  it('and it is a RAMP, not a square: the second harmonic is right behind the first', () => {
    const f = meta.expect.fundamentalHz as number
    const h1 = partial(signal, meta.sampleRate, f)
    // A 50 % square has no second harmonic at all (−153 dBc on the pulse fixture
    // above). A seven-level ramp has one about 4.6 dB down.
    expect(dBc(partial(signal, meta.sampleRate, 2 * f), h1)).toBeGreaterThan(-10)
  })

  // measured: fundamental 503.312 Hz (zero-crossing) / 503.308 Hz (DFT) against the
  // ideal 503.3107; second harmonic −4.59 dBc, third −7.49 dBc; rms 0.163, peak 0.554.
  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"3ea5af69"`)
  })
})

describe('vrc6-eight-voice', () => {
  const { signal, meta, clipped } = render('vrc6-eight-voice')

  it('plays all eight voices without clipping or NaN', () => {
    expect(rms(signal, 4800, signal.length)).toBeGreaterThan(meta.expect.rmsMin as number)
    expect(maxAbs(signal)).toBeLessThanOrEqual(meta.expect.peakMax as number)
    expect(clipped).toBeLessThanOrEqual(meta.expect.clippedSamplesMax as number)
    expect(hasNonFinite(signal)).toBe(false)
  })

  it('really has eight sources contributing', () => {
    const { trace, meta: m } = loadFixture('vrc6-eight-voice')
    const mem = dpcmMemory(m)
    const apu = makeApu({ sampleRate: m.sampleRate, durationSamples: 128 })
    if (mem !== null) apu.setDpcmMemory(mem)
    trace.writes.replayTo(apu)
    apu.runTo(1_000_000)
    expect(apu.pulse1.isSilent()).toBe(false)
    expect(apu.pulse2.isSilent()).toBe(false)
    expect(apu.triangle.isSilent()).toBe(false)
    expect(apu.noise.isSilent()).toBe(false)
    expect(apu.dmc.isIdle()).toBe(false)
    expect(apu.vrc6p1.isSilent()).toBe(false)
    expect(apu.vrc6p2.isSilent()).toBe(false)
    expect(apu.vrc6saw.isSilent()).toBe(false)
    expect(meta.expect.channelsSounding).toBe(8)
  })

  it('and each VRC6 voice is audible at its own frequency, beside the 2A03 ones', () => {
    const sr = meta.sampleRate
    const carrier = partial(signal, sr, 440.3969) // 2A03 pulse 1
    expect(dBc(partial(signal, sr, 553.7664), carrier)).toBeGreaterThan(-12) // vrc6 p1 C#5
    expect(dBc(partial(signal, sr, 880.7938), carrier)).toBeGreaterThan(-15) // vrc6 p2 A5
    expect(dBc(partial(signal, sr, 329.4869), carrier)).toBeGreaterThan(-12) // vrc6 saw E4
    // Anti-vacuity: a frequency no voice occupies is far below all of them.
    expect(dBc(partial(signal, sr, 1500), carrier)).toBeLessThan(-25)
  })

  // measured: with the 2A03 pulse 1 (A440) as the carrier, the VRC6 partials land at
  // C#5 553.77 Hz −4.39 dBc, A5 880.79 Hz −7.93 dBc and saw E4 329.49 Hz −4.51 dBc;
  // the whole mix peaks at 0.813 with rms 0.192 and zero clipped samples.
  it('has a stable output checksum', () => {
    expect(checksum(signal)).toMatchInlineSnapshot(`"87864a3c"`)
  })
})
