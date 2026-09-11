/** NES CPU cycles since engine start. Integer-valued, stored as a double.
 *  t = 0 is the first output sample frame the worklet renders.
 *  BANNED on any NesCycle value: |0, <<, >>, & — int32 wraps at 2^31 ≈ 20 min of audio. */
export type NesCycle = number

/** Full register address. The 2A03 block is `0x4000..0x4017`; the VRC6 expansion
 *  audio block is `0x9000..0x9003 | 0xA000..0xA002 | 0xB000..0xB002`. */
export type RegAddr = number

export interface RegisterWrite {
  readonly cycle: NesCycle
  readonly addr: RegAddr
  readonly value: number
}

/** Wire encoding: 24 bits. The WHOLE 16-bit address sits above the value byte —
 *  `(addr & 0xffff) << 8 | value` — because the VRC6 block lives at $9000/$A000/$B000
 *  and does not fit the five-bit `$4000 + offset` field the 2A03-only encoding used.
 *  The widest code is `0xffffff`, so an Int32 slot on either transport still carries a
 *  write without truncation, and both slots stay non-negative.
 *  Bitwise operators here act on register ADDRESSES and 8-bit values only — never on
 *  a NesCycle, which travels in its own f64 slot. */
export const encodeWrite = (addr: RegAddr, value: number): number =>
  ((addr & 0xffff) << 8) | (value & 0xff)
export const decodeAddr = (code: number): RegAddr => (code >>> 8) & 0xffff
export const decodeValue = (code: number): number => code & 0xff

/** The one thing every producer implements: live play (P1), the tracker tick
 *  scheduler (P2), and the WAV export driver (P3). One consumer: the APU core.
 *  This interface is the single-timeline principle — treat changes as breaking
 *  and mirror them into docs/register-timeline.md. */
export interface WriteSink {
  write(cycle: NesCycle, addr: RegAddr, value: number): void
}
