/** Tempo arithmetic — the part of the driver that must not drift (design §2.2, §2.3).
 *
 *  Two independent clocks live here and neither one accumulates error:
 *
 *    tick -> cycle    a CLOSED FORM of the tick index. `cycleOfTick(n)` depends only
 *                     on `n`, so no amount of arithmetic history can make it drift; a
 *                     main-thread stall produces a burst of late writes and is
 *                     immediately back in phase, never a tempo error.
 *    tick -> row      an INTEGER Bresenham accumulator over `num = 5·E·S`,
 *                     `den = 2·T`. `ticksPerRow = 2.5·E·S/T` is kept as an exact
 *                     integer ratio; there is not a float anywhere in the row advance.
 *
 *  The headline vector (design §2.3): E=60 S=6 T=160 must produce row lengths
 *  6,6,5,6,6,5,6,5 and return the accumulator to zero after 8 rows — character for
 *  character the sequence FamiTracker's own documentation gives for `F06` at tempo
 *  160. `trackerTempo.test.ts` asserts exactly that.
 *
 *  No `|0`, `<<`, `>>` or `&` touches a cycle value anywhere in this file (phase-1
 *  standing rule: int32 wraps at 2^31 cycles ≈ 20 minutes of audio).
 */
import type { NesCycle } from '../../audio/timeline/types'

/** Cycle of the driver's tick `n`, counted from the driver's own origin.
 *
 *  Exactness: an hour at 60 Hz is 216 000 ticks and `n · clockRate` = 3.87e11, exact
 *  in a double by a factor of ~23 000. Ten hours at engineSpeed 400 gives 2.6e13 —
 *  still exact. See `exactTickLimit`. */
export function cycleOfTick(
  originCycle: NesCycle,
  n: number,
  clockRate: number,
  engineHz: number,
): NesCycle {
  return originCycle + Math.floor((n * clockRate) / engineHz)
}

/** Largest tick index for which `n · clockRate` is still an exact f64 integer.
 *  Asserted, not assumed — design §2.2 says "assert this". */
export function exactTickLimit(clockRate: number): number {
  return Math.floor(Number.MAX_SAFE_INTEGER / clockRate)
}

/** The exact integer ratio behind `ticksPerRow = 2.5 · E · S / T`. Both halves are
 *  integers for every legal (E, S, T), which is the whole point. */
export function tempoRatio(
  engineSpeed: number,
  speed: number,
  tempo: number,
): { num: number; den: number } {
  return { num: 5 * engineSpeed * speed, den: 2 * tempo }
}

export function ticksPerRow(engineSpeed: number, speed: number, tempo: number): number {
  const { num, den } = tempoRatio(engineSpeed, speed, tempo)
  return num / den
}

/** `evenTempo: true` replaces the accumulator with this fixed integer (§2.3). It is a
 *  musical convenience, not an accuracy mode: 6.43 → 6 is +7 % tempo. */
export function evenTicksPerRow(engineSpeed: number, speed: number, tempo: number): number {
  const { num, den } = tempoRatio(engineSpeed, speed, tempo)
  const n = Math.round(num / den)
  return n < 1 ? 1 : n
}

/** `ticksPerRow` is an exact integer iff `tempo === 2.5 · engineSpeed` — hence NTSC's
 *  default 150 and PAL's 125. This identity is why "keep tempo at 150 and change only
 *  speed" is the authored-music discipline that avoids alternation entirely. */
export function isEvenTempo(engineSpeed: number, tempo: number): boolean {
  return 2 * tempo === 5 * engineSpeed
}

/** BPM readout. Both published forms are implemented and asserted against each other:
 *    bpm = 60·E / (ticksPerRow · rowHighlight)
 *    bpm = 24·T / (S · rowHighlight)            (E cancels)
 *  A single test pins them together so a future edit cannot break them apart. */
export function bpmFromTicks(
  engineSpeed: number,
  speed: number,
  tempo: number,
  rowHighlight: number,
): number {
  const tpr = ticksPerRow(engineSpeed, speed, tempo)
  return (60 * engineSpeed) / (tpr * rowHighlight)
}

export function bpmFromTempo(speed: number, tempo: number, rowHighlight: number): number {
  return (24 * tempo) / (speed * rowHighlight)
}

/** How many ticks the row starting with accumulator residue `accum` will last.
 *  Closed form of the `while` loop below, used by `Gxx` and `Sxx` to make
 *  "if xx > speed, speed is used" exact in the fractional case (§3.2). */
export function ticksInRow(accum: number, num: number, den: number): number {
  return Math.ceil((num - accum) / den)
}

/** The row accumulator itself. Integer-only, and it CARRIES across rows, patterns,
 *  order jumps and `Fxx` — it is reset only by `stop()` and by `play from row`.
 *  Resetting it on a jump is the classic wrong implementation.
 *
 *  Zero-allocation: one object per driver, mutated in place. */
export class RowAccumulator {
  /** invariant 0 <= accum < num */
  accum = 0
  num = 1800
  den = 300

  /** Rows the last `step()` completed. Normally 0 or 1; larger only when `Fxx`
   *  shrinks `num` below the residue, which is what makes `F01` feel instant. */
  pending = 0

  setRatio(engineSpeed: number, speed: number, tempo: number): void {
    const r = tempoRatio(engineSpeed, speed, tempo)
    this.num = r.num
    this.den = r.den
    // A ratio change keeps the residue (§2.3). If the new `num` is smaller than the
    // residue the backlog is emitted on the next step, exactly as hardware does.
  }

  reset(): void {
    this.accum = 0
    this.pending = 0
  }

  /** End of a tick. Returns how many row boundaries were crossed. */
  step(): number {
    this.accum += this.den
    let rows = 0
    while (this.accum >= this.num) {
      this.accum -= this.num
      rows++
    }
    this.pending = rows
    return rows
  }

  /** Ticks the row that is about to start will last, given the current residue. */
  ticksThisRow(): number {
    return ticksInRow(this.accum, this.num, this.den)
  }
}

// --- the pump window (design §2.5) --------------------------------------------------

/** Visible-and-playing pump period. 20 ms, 6× under the lookahead. */
export const PUMP_MS = 20
/** Hidden-tab pump period. Chrome aligns background timers to ~1 Hz for non-audible
 *  pages; audible pages are exempt but we do not RELY on the exemption. */
export const HIDDEN_PUMP_MS = 250
/** Visible lookahead. Also the live-input latency during playback (§2.6), which the
 *  UI states rather than pretending otherwise. */
export const LOOKAHEAD_MS = 120
/** Hidden-tab lookahead ceiling. */
export const MAX_HIDDEN_LOOKAHEAD_MS = 1500
/** Worst-case writes per tick: 5 channels × 4 registers + one $4015. */
export const WORST_WRITES_PER_TICK = 21
/** Ring slots the lookahead is allowed to occupy, of the ring's 4096. */
export const RING_OCCUPANCY_BUDGET = 3000

/** Hidden-tab lookahead: `min(1500 ms, 3000 / (21 · engineHz) s)`.
 *
 *  This is the ring-occupancy bound made explicit rather than left as a constant —
 *  at 21 writes/tick, `lookahead_s · engineHz · 21` must stay under ~3 000 of the
 *  ring's 4 096 slots. At E=60 the cap is 2 381 ms so 1 500 wins; at E=400 it is
 *  357 ms and the cap wins. Unit-tested at E = 60, 120, 240, 400. */
export function hiddenLookaheadMs(engineHz: number): number {
  const capMs = (1000 * RING_OCCUPANCY_BUDGET) / (WORST_WRITES_PER_TICK * engineHz)
  return Math.min(MAX_HIDDEN_LOOKAHEAD_MS, capMs)
}

/** Ring slots a lookahead of `ms` can occupy at worst. The bound the cap enforces. */
export function worstRingOccupancy(ms: number, engineHz: number): number {
  return (ms / 1000) * engineHz * WORST_WRITES_PER_TICK
}
