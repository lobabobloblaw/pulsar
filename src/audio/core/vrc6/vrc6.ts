/** The Konami VRC6's expansion audio: two pulses and one sawtooth, written from the
 *  NESdev wiki's "VRC6 audio" page. Mapper 24's register layout is the only one
 *  implemented — mapper 26 swaps the two address lines, which is a cartridge wiring
 *  difference and not an audio one.
 *
 *  Everything here runs at the CPU clock (no /2 divider anywhere) and the three
 *  outputs sum LINEARLY — there is no resistor ladder on the cartridge, just the
 *  expansion pin. That is why the chip reaches the cartridge audio bus at all, and it
 *  is why `Apu2A03.emit()` adds `(v1 + v2 + saw) · VRC6_GAIN` to whichever 2A03 mix is
 *  selected rather than folding the VRC6 into the non-linear tables.
 *
 *  This object owns the two registers that are NOT per-channel — $9003's halt bit and
 *  frequency shift — and pushes them into all three channels. The channels themselves
 *  are named fields, and `Apu2A03` aliases them so its run loop's min scan reads them
 *  with one load each, exactly like the 2A03's six sources.
 *
 *    $9000-$9002  pulse 1        $A000-$A002  pulse 2        $B000-$B002  sawtooth
 *    $9003  ---- -X21   bit 0 halt all three; bit 1 period >> 4; bit 2 period >> 8
 *                       (bit 2 wins over bit 1)
 *
 *  Power-up: all three disabled, $9003 = 0. A song that never writes the chip is
 *  silent here and adds exactly 0.0 to the mix, which is what keeps every 2A03 golden
 *  checksum byte-identical.
 */
import type { NesCycle } from '../../timeline/types'
import { Vrc6Pulse } from './vrc6Pulse'
import { Vrc6Saw } from './vrc6Saw'

/** $9003 bit 0. */
export const VRC6_HALT_BIT = 0x01
/** $9003 bit 1 — period >> 4. */
export const VRC6_SHIFT4_BIT = 0x02
/** $9003 bit 2 — period >> 8, and it wins over bit 1. */
export const VRC6_SHIFT8_BIT = 0x04

export class Vrc6 {
  readonly pulse1 = new Vrc6Pulse()
  readonly pulse2 = new Vrc6Pulse()
  readonly saw = new Vrc6Saw()

  /** $9003 bit 0 — every oscillator frozen where it stands. */
  halt = false
  /** 0, 4 or 8: the right shift applied to all three period registers. */
  shift = 0

  reset(): void {
    this.pulse1.reset()
    this.pulse2.reset()
    this.saw.reset()
    this.halt = false
    this.shift = 0
  }

  /** $9003 — frequency control. Applies to all three channels at once; neither the
   *  halt bit nor the shift moves a running divider's expiry, and neither zeroes a
   *  held output level. */
  writeFrequencyControl(value: number, cycle: NesCycle): void {
    const halt = (value & VRC6_HALT_BIT) !== 0
    const shift =
      (value & VRC6_SHIFT8_BIT) !== 0 ? 8 : (value & VRC6_SHIFT4_BIT) !== 0 ? 4 : 0
    this.halt = halt
    this.shift = shift
    this.pulse1.setFrequencyControl(halt, shift, cycle)
    this.pulse2.setFrequencyControl(halt, shift, cycle)
    this.saw.setFrequencyControl(halt, shift, cycle)
  }

  /** Move every armed timer with the timeline (`Apu2A03.seekTo`), so relative phase
   *  survives a reposition. Shape mirrors `FrameCounter.shiftBy`. */
  shiftBy(delta: number): void {
    shiftVrc6Source(this.pulse1, delta)
    shiftVrc6Source(this.pulse2, delta)
    shiftVrc6Source(this.saw, delta)
  }
}

function shiftVrc6Source(
  ch: { nextCycle: NesCycle; stepCycle: NesCycle },
  delta: number,
): void {
  if (ch.nextCycle !== Infinity) ch.nextCycle += delta
  ch.stepCycle += delta
}
