/** Effect tables and the pure arithmetic every effect funnels through (design §3.2,
 *  §3.3, §3.6). The stateful half lives in `trackerDriver.ts`; everything here is a
 *  table or a pure function, so it is testable one value at a time.
 *
 *  Source discipline (design §3): plan-file §5/§6, the official FamiTracker CHM help
 *  manual, FamiStudio's public docs, the 0CC readme, NESdev threads. **No FamiTracker,
 *  0CC, Dn or Furnace source was read.** Items marked [ours] are ours because no
 *  licence-safe source documents them; every one is pinned by a test and listed in
 *  docs/deviations.md so a future contributor knows exactly what to re-check.
 */

// --- vibrato / tremolo (D-TK3) ------------------------------------------------------

/** Peak deviation, in raw period units, for each `4xy` depth `y`. */
export const VIB_AMP: readonly number[] = [
  0, 1, 2, 3, 4, 6, 8, 11, 14, 18, 23, 29, 36, 44, 54, 64,
]

/** Quarter-wave phase resolution: 16 steps from 0 to the peak. */
export const VIB_PHASES = 16

/** 16 depths × 16 phases, `round(AMP[d] · sin(i·π/30))` — the quarter wave the
 *  4-quadrant reconstruction below turns into a full bipolar cycle.
 *
 *  **D-TK3, and an honest note.** Design §3.2 gives this formula AND cites a
 *  corroborating published FamiTracker row for depth 7,
 *  `00 01 02 03 04 05 06 07 08 09 09 0a 0b 0b 0b 0b`. The formula reproduces 14 of
 *  those 16 values; it yields `0a` where the citation has `09` (i = 10) and `0a`
 *  where it has `0b` (i = 12). The FORMULA is what is implemented, because it is
 *  complete (it defines all 16 rows; the citation defines one) and because it is the
 *  artifact the design pins with a snapshot test. Both rows are written down in
 *  docs/deviations.md so whoever gets a definitive answer knows exactly which two
 *  cells to look at and which test will tell them they changed it. */
export const VIB_TABLE: Int32Array = buildVibratoTable()

function buildVibratoTable(): Int32Array {
  const t = new Int32Array(VIB_AMP.length * VIB_PHASES)
  for (let d = 0; d < VIB_AMP.length; d++) {
    for (let i = 0; i < VIB_PHASES; i++) {
      t[d * VIB_PHASES + i] = Math.round(VIB_AMP[d] * Math.sin((i * Math.PI) / 30))
    }
  }
  return t
}

/** The 6-bit accumulator's signed output.
 *
 *  `acc = (acc + speed) & 0x3F` every tick; `idx = acc & 0x0F` picks the phase and
 *  `quad = (acc >> 4) & 3` picks the quadrant: 0 forward, 1 backward, 2 forward
 *  inverted, 3 backward inverted. A full bipolar cycle takes 64 ticks at speed 1 and
 *  the four quadrants join continuously at every seam (asserted in
 *  trackerVibrato.test.ts).
 *
 *  `acc` is a 6-bit counter, never a cycle value — bitwise ops are legal on it. */
export function vibratoValue(acc: number, depth: number): number {
  const d = depth < 0 ? 0 : depth > 15 ? 15 : depth
  const idx = acc & 0x0f
  const quad = (acc >> 4) & 3
  const phase = quad === 1 || quad === 3 ? 15 - idx : idx
  const v = VIB_TABLE[d * VIB_PHASES + phase]
  // `0 - v` rather than `-v`: negating a zero would return -0, which is a real value
  // in JS and would leak into every downstream comparison.
  return quad >= 2 ? 0 - v : v
}

export const VIB_ACC_MASK = 0x3f

// --- volume composition (D-TK4, design §3.3) ---------------------------------------

/** Volume column resolution. `Axy` moves the column in eighths, so it is tracked at
 *  8× and shifted down for composition. */
export const CHAN_VOL_SCALE = 8
export const MAX_CHAN_VOL8 = 15 * CHAN_VOL_SCALE // 120

/** The one formula every volume funnels through.
 *
 *    chanVol8  0..120  volume column at 8× resolution, mutated by Axy
 *    macroVol  0..15   current output of the instrument's volume macro (15 if none)
 *    trem      >= 0    current unipolar tremolo magnitude from 7xy (0 if none)
 *
 *  Documented: the column and the macro compose MULTIPLICATIVELY (FamiStudio states
 *  it plainly; the FamiTracker wiki's Volume page lists the three contributors).
 *  [ours] and pinned by the 16×16 table in trackerVolume.test.ts: the exact integer
 *  rounding `(a·(b+1)) >> 4`, the never-round-a-live-note-to-silence guard, and
 *  tremolo applying AFTER the multiply. */
export function composeVolume(chanVol8: number, macroVol: number, trem: number): number {
  const chanVol = chanVol8 >> 3
  let v = (chanVol * (macroVol + 1)) >> 4
  if (v === 0 && chanVol > 0 && macroVol > 0) v = 1
  v = v - trem
  return v < 0 ? 0 : v > 15 ? 15 : v
}

/** `Axy`: x slides DOWN, y slides UP, both as fractions of 8 — the opposite of the
 *  ProTracker convention and the single most likely implementation bug in the table.
 *  Documented by the manual: "Use A0y to slide up and Ax0 to slide down." */
export function volumeSlideStep(chanVol8: number, param: number): number {
  const down = (param >> 4) & 0x0f
  const up = param & 0x0f
  const v = chanVol8 + up - down
  return v < 0 ? 0 : v > MAX_CHAN_VOL8 ? MAX_CHAN_VOL8 : v
}

// --- pitch bounds -------------------------------------------------------------------

/** Below timer 8 the sweep unit's period check mutes a pulse channel anyway. */
export const MIN_PULSE_PERIOD = 8
/** Triangle keeps its own floor: below 2 the core freezes the sequencer (D-T1). */
export const MIN_TRIANGLE_PERIOD = 2
export const MAX_PERIOD = 0x7ff
/** Noise "period" is a 4-bit index into the period table, not an 11-bit timer. */
export const MAX_NOISE_INDEX = 15

export function clampPeriod(period: number, min: number): number {
  const p = Math.round(period)
  return p < min ? min : p > MAX_PERIOD ? MAX_PERIOD : p
}

export function clampNoiseIndex(index: number): number {
  const i = Math.round(index)
  return i < 0 ? 0 : i > MAX_NOISE_INDEX ? MAX_NOISE_INDEX : i
}

// --- effect memory (design §3.5) ----------------------------------------------------

/** Letters that keep a per-channel memory of their last non-zero param. */
export const MEMORY_COMMANDS = '1234' + '7' + 'AQR'

/** Letters whose `00` is a DOCUMENTED off value and therefore never consults memory.
 *
 *  Design §3.5 enumerates eight memory letters and says a `00` re-uses the last
 *  non-zero param "where 00 is not a documented off value"; §3.2 then documents `00`
 *  as off for `1xx` ("cancel"), `2xx`, `3xx` ("use 00 to disable" / "300 freezes"),
 *  `4xy` ("0 to disable" / "400 disables") and `Axy` ("A00 stops and holds"). Those
 *  five therefore never consult memory; `7xy`, `Qxy` and `Rxy` — for which §3.2
 *  documents no off value at all — do. Every documented off-switch keeps working,
 *  which is what a musician needs, and both halves of §3.5 are honoured.
 *  Pinned by the effect-memory table in trackerEffects.test.ts. */
export const OFF_ON_ZERO_COMMANDS = '1234A'

// --- Qxy / Rxy ----------------------------------------------------------------------

/** "x is the speed and y is the number of semitones" (x and y in that order — easy to
 *  swap by accident). The glide runs at 2x+1 period units per tick [snippet]. */
export function noteSlideStep(x: number): number {
  return 2 * x + 1
}

// --- Pxx ----------------------------------------------------------------------------

/** "Sets the fine pitch in xx pitch units. 80 means in tune." Constant period offset;
 *  `< 0x80` and `> 0x80` are the two directions. */
export const FINE_PITCH_CENTRE = 0x80

export function finePitchOffset(param: number): number {
  return param - FINE_PITCH_CENTRE
}

// --- 0xy ----------------------------------------------------------------------------

/** Offset table `[0, x, y]` indexed by `arpStep % 3`; the first tick of a fresh note
 *  is therefore the unmodified note. */
export function arpeggioOffset(param: number, step: number): number {
  const phase = step % 3
  if (phase === 0) return 0
  if (phase === 1) return (param >> 4) & 0x0f
  return param & 0x0f
}
