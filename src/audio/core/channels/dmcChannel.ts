/** DMC / DPCM channel — $4010–$4013.
 *
 *  Not a synthesiser: a 1-bit delta decoder driving a 7-bit DAC. Each output clock
 *  consumes one bit of the shift register LSB-first and moves the level by ±2, with
 *  hard guards at both ends — the level is clamped, never wrapped, so a 1 bit at level
 *  126 leaves it at 126 and a 0 bit at level 1 leaves it at 1. Those two edges are the
 *  entire dynamic-range behaviour of DPCM and are asserted directly in dmc.test.ts.
 *
 *  The memory reader walks a user-supplied 32 KiB buffer standing in for $8000–$FFFF:
 *  $4012 gives the start address as $C000 + A·64, $4013 the length as L·16 + 1 bytes,
 *  and the address wraps $FFFF → $8000 rather than leaving the buffer. When the last
 *  byte is consumed the sample either loops or stops (setting the DMC IRQ flag if
 *  enabled — read-back only, deviation D-D2).
 *
 *  Ducking is not implemented here and must not be: the DMC level shares TND_LUT's
 *  index with the triangle and noise (`3·tri + 2·noise + dmc`), so raising the DPCM
 *  level compresses their contribution automatically. That is measured against the
 *  table's own prediction in dmc.test.ts.
 *
 *  Deviations: D-D1 (no DMA cycle stealing — there is no CPU to stall), D-P3 (an idle
 *  output unit is frozen rather than clocked, and a restart begins its output cycle
 *  immediately instead of waiting up to 8 output clocks for the bit counter to reload).
 *
 *  Bitwise operators act on 8-bit sample bytes, the 7-bit level and 16-bit addresses —
 *  never on cycle counts (plan B5).
 */
import { DMC_RATE_NTSC, DMC_RATE_PAL } from '../tables'
import type { NesCycle } from '../../timeline/types'
import type { ChannelEventSource } from './types'

/** First address the memory reader can see; also where $FFFF wraps back to. */
export const DMC_MEMORY_BASE = 0x8000
/** Size of the user buffer standing in for $8000–$FFFF. */
export const DMC_MEMORY_SIZE = 0x8000
/** Base of the $4012 sample-address window. */
export const DMC_SAMPLE_BASE = 0xc000
/** Highest level the delta counter can hold. */
export const DMC_MAX_LEVEL = 127

export class DmcChannel implements ChannelEventSource {
  /** $4010 bit 7 — read-back only (D-D2). */
  irqEnabled = false
  /** $4010 bit 6. */
  loop = false
  /** $4010 bits 3–0. */
  rateIndex = 0
  /** Set when a non-looping sample ends with IRQs enabled; cleared by any $4015 write. */
  irqFlag = false

  /** $4012 → $C000 + A·64. */
  sampleAddress = DMC_SAMPLE_BASE
  /** $4013 → L·16 + 1. */
  sampleLength = 1

  currentAddress = DMC_SAMPLE_BASE
  bytesRemaining = 0

  sampleBuffer = 0
  sampleBufferEmpty = true
  shiftRegister = 0
  bitsRemaining = 8
  silence = true

  /** The 7-bit DAC level, 0..127 — this channel's `out`. Held, never zeroed. */
  out = 0
  nextCycle: NesCycle = Infinity
  stepCycle: NesCycle = 0

  /** 32 KiB of $8000–$FFFF supplied by the host. Null reads as silence (zero bytes). */
  memory: Uint8Array | null = null

  private rates: Uint16Array = DMC_RATE_NTSC

  setRegion(region: 'ntsc' | 'pal'): void {
    this.rates = region === 'pal' ? DMC_RATE_PAL : DMC_RATE_NTSC
  }

  setMemory(mem: Uint8Array | null): void {
    this.memory = mem
  }

  reset(): void {
    this.irqEnabled = false
    this.loop = false
    this.rateIndex = 0
    this.irqFlag = false
    this.sampleAddress = DMC_SAMPLE_BASE
    this.sampleLength = 1
    this.currentAddress = DMC_SAMPLE_BASE
    this.bytesRemaining = 0
    this.sampleBuffer = 0
    this.sampleBufferEmpty = true
    this.shiftRegister = 0
    this.bitsRemaining = 8
    this.silence = true
    this.out = 0
    this.nextCycle = Infinity
    this.stepCycle = 0
  }

  /** Output-unit period in CPU cycles. */
  get periodCycles(): number {
    return this.rates[this.rateIndex]
  }

  /** True when nothing can change the level until the next register write. */
  isIdle(): boolean {
    return this.silence && this.sampleBufferEmpty && this.bytesRemaining === 0
  }

  get active(): boolean {
    return this.bytesRemaining > 0
  }

  /** $4010 — IL-- RRRR. Clearing the IRQ enable also clears the flag. */
  writeControl(value: number, cycle: NesCycle): void {
    this.irqEnabled = (value & 0x80) !== 0
    this.loop = (value & 0x40) !== 0
    this.rateIndex = value & 0x0f
    if (!this.irqEnabled) this.irqFlag = false
    this.refresh(cycle)
  }

  /** $4011 — -DDD DDDD. Writes the DAC level straight through; this is how games play
   *  raw PCM and how a click gets made. */
  writeDirectLoad(value: number): void {
    this.out = value & 0x7f
  }

  /** $4012 — sample address = $C000 + A·64. */
  writeAddress(value: number): void {
    this.sampleAddress = DMC_SAMPLE_BASE + (value & 0xff) * 64
  }

  /** $4013 — sample length = L·16 + 1 bytes. */
  writeLength(value: number): void {
    this.sampleLength = (value & 0xff) * 16 + 1
  }

  /** $4015 bit 4. Clear stops the sample by zeroing the byte counter; set restarts it
   *  only if it had already finished. */
  setEnabled(on: boolean, cycle: NesCycle): void {
    if (!on) {
      this.bytesRemaining = 0
    } else if (this.bytesRemaining === 0) {
      this.startPlayback()
    }
    this.refresh(cycle)
  }

  stepTimer(): void {
    const at = this.nextCycle
    this.stepCycle = at

    if (!this.silence) {
      if ((this.shiftRegister & 1) === 1) {
        if (this.out <= DMC_MAX_LEVEL - 2) this.out += 2
      } else {
        if (this.out >= 2) this.out -= 2
      }
    }
    this.shiftRegister >>= 1
    this.bitsRemaining--

    if (this.bitsRemaining === 0) {
      this.bitsRemaining = 8
      if (this.sampleBufferEmpty) {
        this.silence = true
      } else {
        this.silence = false
        this.shiftRegister = this.sampleBuffer
        this.sampleBufferEmpty = true
        this.fillBuffer()
      }
    }

    this.nextCycle = this.isIdle() ? Infinity : at + this.rates[this.rateIndex]
  }

  /** Restart from $4012/$4013 and begin an output cycle immediately (D-P3). */
  private startPlayback(): void {
    this.currentAddress = this.sampleAddress
    this.bytesRemaining = this.sampleLength
    this.fillBuffer()
    if (this.silence && !this.sampleBufferEmpty) {
      this.silence = false
      this.shiftRegister = this.sampleBuffer
      this.sampleBufferEmpty = true
      this.bitsRemaining = 8
      this.fillBuffer()
    }
  }

  /** The memory reader. No DMA stall (D-D1): the byte is simply there. */
  private fillBuffer(): void {
    if (!this.sampleBufferEmpty || this.bytesRemaining === 0) return
    const mem = this.memory
    this.sampleBuffer = mem === null ? 0 : mem[this.currentAddress - DMC_MEMORY_BASE] & 0xff
    this.sampleBufferEmpty = false
    this.currentAddress =
      this.currentAddress === 0xffff ? DMC_MEMORY_BASE : this.currentAddress + 1
    this.bytesRemaining--
    if (this.bytesRemaining === 0) {
      if (this.loop) {
        this.currentAddress = this.sampleAddress
        this.bytesRemaining = this.sampleLength
      } else if (this.irqEnabled) {
        this.irqFlag = true
      }
    }
  }

  private refresh(cycle: NesCycle): void {
    const wasIdle = this.nextCycle === Infinity
    if (this.isIdle()) {
      this.nextCycle = Infinity
      return
    }
    if (wasIdle) {
      this.stepCycle = cycle
      this.nextCycle = cycle + this.rates[this.rateIndex]
    }
  }
}
