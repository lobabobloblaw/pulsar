/** Static 2A03 tables. Everything here is built once at module load and never
 *  mutated, so nothing in this file is reachable from `process()` at runtime.
 *
 *  Bitwise operators in this file act on 3-bit sequencer steps and 8-bit register
 *  values only — never on NES cycle counts (plan B5).
 */

/** Pulse duty OUTPUT waveforms, indexed `duty * 8 + step` with an INCREMENTING step
 *  (NESdev "Pulse" — output waveform column). $4003/$4007 reset step to 0.
 *    d0 01000000 (12.5%)  d1 01100000 (25%)  d2 01111000 (50%)  d3 10011111 (25% neg)
 */
export const DUTY_BITSTRINGS: readonly string[] = ['01000000', '01100000', '01111000', '10011111']

function packDuty(rows: readonly string[]): Uint8Array {
  const t = new Uint8Array(rows.length * 8)
  for (let d = 0; d < rows.length; d++) {
    const row = rows[d]
    for (let i = 0; i < 8; i++) t[d * 8 + i] = row.charCodeAt(i) === 49 ? 1 : 0
  }
  return t
}

/** Flat 4×8 duty output table. `DUTY_OUTPUT[duty * 8 + step]` ∈ {0, 1}. */
export const DUTY_OUTPUT: Uint8Array = packDuty(DUTY_BITSTRINGS)

/** The same four waveforms as the hardware's DECREMENTING sequencer lookup.
 *  Identity (asserted in tests): `DUTY_OUTPUT[d*8+i] === DUTY_LOOKUP[d*8+((8-i)&7)]`. */
export const DUTY_LOOKUP: Uint8Array = ((): Uint8Array => {
  const t = new Uint8Array(32)
  for (let d = 0; d < 4; d++) {
    for (let i = 0; i < 8; i++) t[d * 8 + ((8 - i) & 7)] = DUTY_OUTPUT[d * 8 + i]
  }
  return t
})()

/** Length-counter load table, indexed by the 5-bit field in $4003/$4007/$400B/$400F.
 *  Two interleaved musical series: the even indices are note lengths at 60 Hz
 *  (linear-ish), the odd indices count 1..30 in halves. blargg's length-counter test
 *  reads exactly these 32 values back through $4015 (NESdev "APU Length Counter"). */
export const LENGTH_TABLE: Uint8Array = Uint8Array.of(
  10, 254, 20, 2, 40, 4, 80, 6,
  160, 8, 60, 10, 14, 12, 26, 14,
  12, 16, 24, 18, 48, 20, 96, 22,
  192, 24, 72, 26, 16, 28, 32, 30,
)

/** Triangle 32-step output sequence: 15 down to 0, then 0 back up to 15.
 *  The doubled 0 and the doubled 15 are what make it a symmetric triangle rather
 *  than a sawtooth, and are why the sequence is 32 steps and not 30. */
export const TRIANGLE_SEQUENCE: Uint8Array = ((): Uint8Array => {
  const t = new Uint8Array(32)
  for (let i = 0; i < 16; i++) {
    t[i] = 15 - i
    t[16 + i] = i
  }
  return t
})()

/** Noise timer periods in CPU CYCLES, indexed by $400E bits 3–0 (NESdev "APU Noise").
 *  Index 0 clocks the LFSR every 4 CPU cycles → 1 789 773 / 4 = 447 443.25 Hz. */
export const NOISE_PERIOD_NTSC: Uint16Array = Uint16Array.of(
  4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068,
)

/** 2A07 (PAL) noise periods — different table, not a scaled version of the NTSC one. */
export const NOISE_PERIOD_PAL: Uint16Array = Uint16Array.of(
  4, 8, 14, 30, 60, 88, 118, 148, 188, 236, 354, 472, 708, 944, 1890, 3778,
)

/** DMC output-unit periods in CPU CYCLES, indexed by $4010 bits 3–0. Index 0 is the
 *  slowest (428 cycles → 4181.7 Hz sample rate), index 15 the fastest (54 → 33 143.9 Hz). */
export const DMC_RATE_NTSC: Uint16Array = Uint16Array.of(
  428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54,
)

/** 2A07 (PAL) DMC periods. */
export const DMC_RATE_PAL: Uint16Array = Uint16Array.of(
  398, 354, 316, 298, 276, 236, 210, 198, 176, 148, 132, 118, 98, 78, 66, 50,
)

/** Pulse mixer lookup: `PULSE_LUT[pulse1 + pulse2]`, 31 entries.
 *  `n ≥ 1 → 95.52 / (8128 / n + 100)`; entry 0 is exactly 0.
 *  Constant −0.375 % versus the exact 95.88-numerator formula — an intentional
 *  renormalisation so PULSE_LUT[30] + TND_LUT[202] lands on ~1.0 (deviation D-M2). */
export const PULSE_LUT: Float64Array = ((): Float64Array => {
  const t = new Float64Array(31)
  for (let n = 1; n < 31; n++) t[n] = 95.52 / (8128 / n + 100)
  return t
})()

/** Triangle/noise/DMC mixer lookup: `TND_LUT[3*triangle + 2*noise + dmc]`, 203 entries.
 *  `n ≥ 1 → 163.67 / (24329 / n + 100)`; entry 0 is exactly 0. NESdev documents this
 *  approximation as accurate "within 4 %" — measured max relative error 4.66 % at
 *  index 1 (deviation D-M1). DPCM ducking of triangle/noise falls out of the shared
 *  index for free. */
export const TND_LUT: Float64Array = ((): Float64Array => {
  const t = new Float64Array(203)
  for (let n = 1; n < 203; n++) t[n] = 163.67 / (24329 / n + 100)
  return t
})()
