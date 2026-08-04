/** DMC / DPCM — the delta counter, the memory reader, and the ducking gate.
 *
 *  The M6 gate is the last assertion block: raising the DPCM level must compress the
 *  triangle and noise by exactly the amount TND_LUT predicts, because they share one
 *  table index. Nothing in the engine implements ducking — it falls out of the mixer —
 *  so the test measures a rendered triangle against a number computed from the table.
 */
import { describe, expect, it } from 'vitest'
import {
  DMC_MAX_LEVEL,
  DMC_MEMORY_BASE,
  DMC_MEMORY_SIZE,
  DMC_SAMPLE_BASE,
  DmcChannel,
} from '../../src/audio/core/channels/dmcChannel'
import { DMC_RATE_NTSC, DMC_RATE_PAL, TND_LUT, TRIANGLE_SEQUENCE } from '../../src/audio/core/tables'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { rms, zeroCrossingHz } from '../helpers/analysis'
import { makeApu, renderWith, triangleNoteOnTrace } from '../helpers/renderTrace'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'

const SAMPLE_RATE = 48000

/** 32 KiB of "$8000–$FFFF" with `bytes` laid down at `address`. */
function memoryWith(address: number, bytes: number[]): Uint8Array {
  const mem = new Uint8Array(DMC_MEMORY_SIZE)
  for (let i = 0; i < bytes.length; i++) {
    mem[(address - DMC_MEMORY_BASE + i) % DMC_MEMORY_SIZE] = bytes[i]
  }
  return mem
}

/** A DMC channel primed with one sample and started. Sample lengths are quantised to
 *  16·L + 1 bytes, so anything past `bytes` reads as 0x00. */
function primed(bytes: number[], opts: { loop?: boolean; level?: number } = {}): DmcChannel {
  const dmc = new DmcChannel()
  dmc.setMemory(memoryWith(DMC_SAMPLE_BASE, bytes))
  dmc.writeControl((opts.loop ? 0x40 : 0) | 0x0f, 0) // fastest rate
  dmc.writeAddress(0x00) // → $C000
  dmc.writeLength(Math.ceil((bytes.length - 1) / 16))
  if (opts.level !== undefined) dmc.writeDirectLoad(opts.level)
  dmc.setEnabled(true, 0)
  return dmc
}

describe('register decoding', () => {
  it('$4012 = 0x40 → address $D000', () => {
    const dmc = new DmcChannel()
    dmc.writeAddress(0x40)
    expect(dmc.sampleAddress).toBe(0xd000)
    expect(DMC_SAMPLE_BASE + 0x40 * 64).toBe(0xd000)
    dmc.writeAddress(0xff)
    expect(dmc.sampleAddress).toBe(0xffc0)
  })

  it('$4013 = 0x02 → 33 bytes', () => {
    const dmc = new DmcChannel()
    dmc.writeLength(0x02)
    expect(dmc.sampleLength).toBe(33)
    dmc.writeLength(0x00)
    expect(dmc.sampleLength).toBe(1)
    dmc.writeLength(0xff)
    expect(dmc.sampleLength).toBe(4081)
  })

  it('$4011 = 0x7F → level 127, and bit 7 is ignored', () => {
    const dmc = new DmcChannel()
    dmc.writeDirectLoad(0x7f)
    expect(dmc.out).toBe(127)
    expect(dmc.out).toBe(DMC_MAX_LEVEL)
    dmc.writeDirectLoad(0xff)
    expect(dmc.out).toBe(127)
    dmc.writeDirectLoad(0x00)
    expect(dmc.out).toBe(0)
  })

  it('$4010 splits into IRQ enable, loop and a 4-bit rate index', () => {
    const dmc = new DmcChannel()
    dmc.writeControl(0xcf, 0)
    expect(dmc.irqEnabled).toBe(true)
    expect(dmc.loop).toBe(true)
    expect(dmc.rateIndex).toBe(15)
    expect(dmc.periodCycles).toBe(54)
    dmc.writeControl(0x00, 0)
    expect(dmc.irqEnabled).toBe(false)
    expect(dmc.loop).toBe(false)
    expect(dmc.periodCycles).toBe(428)
  })
})

describe('the delta counter', () => {
  it('takes bits LSB-first: 0b00000001 steps +2 first, then −2 seven times', () => {
    const dmc = primed([0b00000001], { level: 64 })
    const levels: number[] = []
    for (let i = 0; i < 8; i++) {
      dmc.stepTimer()
      levels.push(dmc.out)
    }
    expect(levels).toEqual([66, 64, 62, 60, 58, 56, 54, 52])
  })

  it('0b10000000 waits seven steps before its single +2', () => {
    const dmc = primed([0b10000000], { level: 64 })
    const levels: number[] = []
    for (let i = 0; i < 8; i++) {
      dmc.stepTimer()
      levels.push(dmc.out)
    }
    expect(levels).toEqual([62, 60, 58, 56, 54, 52, 50, 52])
  })

  it('clamps at the top: level 126 with all-ones bits stays at 126', () => {
    const dmc = primed([0xff, 0xff], { level: 126 })
    for (let i = 0; i < 16; i++) dmc.stepTimer()
    expect(dmc.out).toBe(126)
    expect(dmc.out).toBeLessThanOrEqual(DMC_MAX_LEVEL)
  })

  it('clamps at the bottom: level 1 with all-zero bits stays at 1', () => {
    const dmc = primed([0x00, 0x00], { level: 1 })
    for (let i = 0; i < 16; i++) dmc.stepTimer()
    expect(dmc.out).toBe(1)
  })

  it('the guards block the step — they do not saturate to 127 or 0', () => {
    // 127 is reachable only through $4011; ±2 from an odd level keeps it odd.
    const up = primed([0xff], { level: 125 })
    up.stepTimer()
    expect(up.out).toBe(127)
    up.stepTimer()
    expect(up.out).toBe(127)
    const down = primed([0x00], { level: 2 })
    down.stepTimer()
    expect(down.out).toBe(0)
    down.stepTimer()
    expect(down.out).toBe(0)
  })
})

describe('the memory reader', () => {
  it('walks forward one byte per eight output clocks', () => {
    const dmc = primed([0x00, 0xff, 0x00], { level: 64 })
    expect(dmc.currentAddress).toBeGreaterThan(DMC_SAMPLE_BASE)
    for (let i = 0; i < 8; i++) dmc.stepTimer()
    expect(dmc.out).toBe(48) // eight −2 steps from the first byte
    for (let i = 0; i < 8; i++) dmc.stepTimer()
    expect(dmc.out).toBe(64) // eight +2 steps back
  })

  it('wraps $FFFF → $8000 instead of running off the end of the buffer', () => {
    // Start at $FFC0 with 65 bytes: the 64th read lands on $FFFF and the 65th must
    // come from $8000. Everything is 0x00 except that wrapped byte, which is 0xFF —
    // so if the wrap were wrong the level would never climb back.
    const mem = new Uint8Array(DMC_MEMORY_SIZE)
    mem[0x8000 - DMC_MEMORY_BASE] = 0xff
    const dmc = new DmcChannel()
    dmc.setMemory(mem)
    dmc.writeControl(0x0f, 0)
    dmc.writeAddress(0xff) // $FFC0
    dmc.writeLength(0x04) // 65 bytes
    dmc.writeDirectLoad(64)
    dmc.setEnabled(true, 0)
    expect(dmc.currentAddress).toBe(0xffc2)

    let steps = 0
    while (!dmc.isIdle() && steps < 10_000) {
      dmc.stepTimer()
      steps++
    }
    expect(steps).toBe(65 * 8)
    // 64 zero bytes drove the level to 0, then the wrapped 0xFF byte took it to 16.
    expect(dmc.currentAddress).toBe(0x8001)
    expect(dmc.out).toBe(16)
  })

  it('$4013 = 0x02 really does read 33 bytes before stopping', () => {
    const dmc = primed(new Array<number>(33).fill(0x00), { level: 100 })
    expect(dmc.sampleLength).toBe(33)
    expect(dmc.bytesRemaining).toBe(31) // two already pulled: shift register + buffer
    let steps = 0
    while (!dmc.isIdle() && steps < 1000) {
      dmc.stepTimer()
      steps++
    }
    expect(steps).toBe(33 * 8)
  })
})

describe('loop versus silence', () => {
  it('a looping sample never goes idle', () => {
    const dmc = primed([0b01010101], { loop: true, level: 64 })
    for (let i = 0; i < 800; i++) dmc.stepTimer()
    expect(dmc.isIdle()).toBe(false)
    expect(dmc.nextCycle).not.toBe(Infinity)
    expect(dmc.bytesRemaining).toBeGreaterThan(0)
  })

  it('a one-shot sample goes silent and drops out of the min scan', () => {
    const dmc = primed([0b01010101], { level: 64 })
    let steps = 0
    while (!dmc.isIdle() && steps < 100) {
      dmc.stepTimer()
      steps++
    }
    // Eight steps, not sixteen: deviation D-P3 starts the output cycle at the restart
    // rather than waiting for the bit counter to reload.
    expect(steps).toBe(8)
    expect(dmc.nextCycle).toBe(Infinity)
    // The level is HELD, exactly like the triangle's — never zeroed.
    expect(dmc.out).toBe(64)
  })

  it('sets the IRQ flag at the end of a one-shot when $4010 bit 7 is set', () => {
    const dmc = new DmcChannel()
    dmc.setMemory(memoryWith(DMC_SAMPLE_BASE, [0x00]))
    dmc.writeControl(0x8f, 0) // IRQ enabled, no loop
    dmc.writeAddress(0)
    dmc.writeLength(0)
    dmc.setEnabled(true, 0)
    expect(dmc.irqFlag).toBe(true) // the reader hit the end immediately
    dmc.writeControl(0x0f, 0) // clearing the enable clears the flag
    expect(dmc.irqFlag).toBe(false)
  })
})

describe('$4015 bit 4 semantics', () => {
  it('clear → bytesRemaining = 0; set → restart only if it had finished', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.setDpcmMemory(memoryWith(DMC_SAMPLE_BASE, new Array<number>(64).fill(0x0f)))
    apu.write(0, 0x4010, 0x0f)
    apu.write(0, 0x4012, 0x00)
    apu.write(0, 0x4013, 0x03) // 49 bytes
    apu.write(0, 0x4015, 0x10)
    expect(apu.dmc.bytesRemaining).toBeGreaterThan(0)
    const remaining = apu.dmc.bytesRemaining

    // Setting the bit again mid-sample must NOT restart it.
    apu.runTo(5000)
    const midway = apu.dmc.bytesRemaining
    expect(midway).toBeLessThan(remaining)
    apu.write(5000, 0x4015, 0x10)
    expect(apu.dmc.bytesRemaining).toBe(midway)

    // Clearing the bit stops it dead.
    apu.write(6000, 0x4015, 0x00)
    expect(apu.dmc.bytesRemaining).toBe(0)
  })

  it('reads back through $4015 bit 4 and clears the DMC IRQ flag on write', () => {
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.setDpcmMemory(memoryWith(DMC_SAMPLE_BASE, new Array<number>(64).fill(0x00)))
    apu.write(0, 0x4010, 0x0f)
    apu.write(0, 0x4013, 0x03)
    apu.write(0, 0x4015, 0x10)
    expect(apu.readStatus(0) & 0x10).toBe(0x10)
    apu.dmc.irqFlag = true
    expect(apu.readStatus(0) & 0x80).toBe(0x80) // a READ does not clear it
    apu.write(0, 0x4015, 0x10)
    expect(apu.dmc.irqFlag).toBe(false) // a WRITE does
  })
})

describe('rates', () => {
  it('both rate tables have 16 entries and fall monotonically', () => {
    for (const table of [DMC_RATE_NTSC, DMC_RATE_PAL]) {
      expect(table.length).toBe(16)
      for (let i = 1; i < 16; i++) expect(table[i]).toBeLessThan(table[i - 1])
    }
    expect(DMC_RATE_NTSC[0]).toBe(428)
    expect(DMC_RATE_NTSC[15]).toBe(54)
  })

  it('index 0 is 4181.7 Hz and index 15 is 33 143.9 Hz', () => {
    expect(NTSC_CPU_HZ / DMC_RATE_NTSC[0]).toBeCloseTo(4181.71, 2)
    expect(NTSC_CPU_HZ / DMC_RATE_NTSC[15]).toBeCloseTo(33_143.94, 2)
  })

  it('a 0x0F byte loop plays a square wave at clock / (8 · rate)', () => {
    // 0b00001111 LSB-first is four +2 steps then four −2: one period per byte.
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 128 })
    apu.setDpcmMemory(memoryWith(DMC_SAMPLE_BASE, [0x0f]))
    const trace = new ArrayWriteSink()
    trace.write(0, 0x4011, 0x40)
    trace.write(0, 0x4010, 0x48) // loop, rate index 8 → 190 cycles
    trace.write(0, 0x4012, 0x00)
    trace.write(0, 0x4013, 0x00) // 1 byte, looping
    trace.write(0, 0x4015, 0x10)
    const signal = renderWith(apu, trace, {
      sampleRate: SAMPLE_RATE,
      durationSamples: 32768,
    })
    const expected = NTSC_CPU_HZ / (8 * DMC_RATE_NTSC[8])
    expect(expected).toBeCloseTo(1177.48, 2)
    const hz = zeroCrossingHz(signal, SAMPLE_RATE, 0.25, 8192)
    expect(hz).toBeCloseTo(expected, 0)
  })
})

describe('M6 gate — DPCM ducking matches the TND_LUT prediction', () => {
  /** AC RMS of the 32-step triangle sequence as seen through TND_LUT at a given
   *  constant DPCM level. Pure table arithmetic — no engine involved. */
  function predictedAcRms(dmcLevel: number): number {
    const vals = new Float64Array(32)
    let mean = 0
    for (let i = 0; i < 32; i++) {
      vals[i] = TND_LUT[3 * TRIANGLE_SEQUENCE[i] + dmcLevel]
      mean += vals[i]
    }
    mean /= 32
    let sum = 0
    for (let i = 0; i < 32; i++) sum += (vals[i] - mean) * (vals[i] - mean)
    return Math.sqrt(sum / 32)
  }

  /** Measured AC RMS of a rendered A440 triangle with the DPCM DAC parked at a level. */
  function measuredAcRms(dmcLevel: number): number {
    const trace = triangleNoteOnTrace(0, 126)
    if (dmcLevel > 0) trace.write(0, 0x4011, dmcLevel)
    const apu = makeApu({ sampleRate: SAMPLE_RATE, durationSamples: 32768 })
    const signal = renderWith(apu, trace, {
      sampleRate: SAMPLE_RATE,
      durationSamples: 32768,
    })
    return rms(signal, 16384, 32768)
  }

  it('the table itself predicts a 34 % reduction at DPCM level 64', () => {
    const ratio = (TND_LUT[75 + 64] - TND_LUT[64]) / TND_LUT[75]
    expect(ratio).toBeCloseTo(0.659183, 6)
    expect(TND_LUT[75]).toBeCloseTo(0.385662446, 9)
  })

  it('a rendered triangle ducks by the predicted ratio at every DPCM level', () => {
    const quiet = measuredAcRms(0)
    expect(quiet).toBeGreaterThan(0.01)
    for (const level of [16, 32, 64, 96, 127]) {
      const predicted = predictedAcRms(level) / predictedAcRms(0)
      const measured = measuredAcRms(level) / quiet
      expect(predicted).toBeLessThan(1)
      expect(measured / predicted).toBeCloseTo(1, 2)
    }
  })

  it('and it is audible: level 127 takes 6.5 dB off the triangle', () => {
    const db = 20 * Math.log10(measuredAcRms(127) / measuredAcRms(0))
    expect(db).toBeLessThan(-5)
    expect(db).toBeGreaterThan(-8)
  })

  it('no code implements it — the shared TND index is the whole mechanism', () => {
    // Same triangle level, same noise level, different DMC: one table lookup apart.
    expect(TND_LUT[3 * 15 + 2 * 15 + 0]).toBeCloseTo(0.385662446, 9)
    expect(TND_LUT[3 * 15 + 2 * 15 + 64]).toBeCloseTo(0.595101363, 9)
    // The triangle+noise increment shrinks from 0.3857 to 0.2542 once the DMC is on.
    expect(TND_LUT[139] - TND_LUT[64]).toBeCloseTo(0.254222063, 9)
  })
})
