/** NES CPU cycles since engine start. Integer-valued, stored as a double.
 *  t = 0 is the first output sample frame the worklet renders.
 *  BANNED on any NesCycle value: |0, <<, >>, & — int32 wraps at 2^31 ≈ 20 min of audio. */
export type NesCycle = number

/** Full APU register address 0x4000..0x4017. */
export type RegAddr = number

export interface RegisterWrite {
  readonly cycle: NesCycle
  readonly addr: RegAddr
  readonly value: number
}

/** Wire encoding: 16 bits. Register offset (0x00..0x17) in the high byte, value low. */
export const encodeWrite = (addr: RegAddr, value: number): number =>
  ((addr & 0x1f) << 8) | (value & 0xff)
export const decodeAddr = (code: number): RegAddr => 0x4000 | ((code >> 8) & 0x1f)
export const decodeValue = (code: number): number => code & 0xff

/** The one thing every producer implements: live play (P1), the tracker tick
 *  scheduler (P2), and the WAV export driver (P3). One consumer: the APU core.
 *  This interface is the single-timeline principle — treat changes as breaking
 *  and mirror them into docs/register-timeline.md. */
export interface WriteSink {
  write(cycle: NesCycle, addr: RegAddr, value: number): void
}
