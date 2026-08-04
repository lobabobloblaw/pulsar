/** Parameter → register mapping (plan C3/C4): the audio side's half of the bridge
 *  contract, extracted as pure functions.
 *
 *  Native units cross the UI↔audio boundary (duty index 0..3, level 0..15, sweep
 *  −7..+7, master volume 0..1). Everything that turns one of those numbers into a
 *  2A03 register byte — or into the one value that is not a register write at all —
 *  lives here, and nowhere else. `liveScheduler` emits the writes, `bridge` routes
 *  the calls; both get their arithmetic from this file, so there is exactly one
 *  definition of what a knob means.
 *
 *  No DOM, no AudioContext, no engine: the whole table is testable from a node test
 *  (tests/unit/bridgeMapping.test.ts).
 *
 *  ── the table ──────────────────────────────────────────────────────────────────
 *
 *  pulse1.duty     0..3      $4000  DDLC VVVV, D = duty index. Written on its own,
 *                                   so a duty change on a held note never touches
 *                                   $4003 and the sequencer phase does not reset.
 *  pulse1.envDecay 0..15     $4000  the same byte's VVVV nibble, in CONSTANT-VOLUME
 *                                   mode (C = 1). See the note below — this knob is
 *                                   pulse1's level, and 0 means silent.
 *  pulse1.sweep    −7..+7    $4001  EPPP NSSS. 0 is the canonical "sweep off" byte
 *                                   0x08 (plan B6); ±n enables the unit with shift
 *                                   |n| and sets negate for positive values, because
 *                                   a smaller period is a higher note.
 *  master.volume   0..1      —      NOT a register: the worklet's `masterGain`, sent
 *                                   as a config message. The exp taper the registry
 *                                   declares is applied here, once.
 *
 *  ── why envDecay is a constant-volume level and not an envelope period ─────────
 *
 *  $4000's VVVV nibble is dual-purpose: with C = 1 it is the channel's constant
 *  volume, with C = 0 it is the hardware envelope's decay period. Pulsar takes the
 *  first reading, deliberately:
 *
 *    - velocity. MIDI and the keybed pass a real velocity, and `volumeFor` scales
 *      the knob's level by it. The hardware envelope always restarts at 15, so a
 *      C = 0 mapping would make every note the same loudness — a synth that ignores
 *      how hard you play it.
 *    - held notes. Sustaining a note needs the length-counter halt bit (L = 1), and
 *      L is also the envelope's LOOP flag. C = 0 with L = 1 is not a decay, it is a
 *      repeating sawtooth tremolo; C = 0 with L = 0 decays once but then the length
 *      counter cuts the note after at most ~2.1 s, so a held key would go silent.
 *
 *  The parameter keeps its `pulse1.envDecay` id (renaming it would churn the engine
 *  tests for no behavioural gain) but its label reads `level`, which is what the
 *  register does. A real per-note envelope belongs in the Phase-2 instrument macro
 *  engine, where it can have its own release point rather than fighting one nibble.
 */
import { DEFAULT_MASTER_GAIN } from '../core/constants'
import type { ParamId } from '../params'

/** $4000 / $4004 — pulse control. Channel 0 is pulse1. */
export function pulseControlAddr(channel: number): number {
  return 0x4000 + channel * 4
}

/** $4001 / $4005 — pulse sweep. */
export function pulseSweepAddr(channel: number): number {
  return 0x4001 + channel * 4
}

/** Length-counter halt (bit 5) + constant volume (bit 4). Both are set on every
 *  live note: halt keeps a held key sounding past the length counter, constant
 *  volume makes VVVV mean "level" (see the header note). */
export const PULSE_HALT_CONSTANT = 0x30

/** The canonical "sweep off" byte of plan B6 — disabled, shift 0, no negate. */
export const SWEEP_OFF_BYTE = 0x08

/** Divider period baked into an enabled sweep: 3 → one update every 4 half-frames,
 *  a musical glide rather than a click. The knob controls direction and shift. */
export const SWEEP_PERIOD = 3

export function dutyBits(v: number): number {
  return clampInt(v, 0, 3)
}

export function levelNibble(v: number): number {
  return clampInt(v, 0, 15)
}

/** $4000 DDLC VVVV for a live note: duty, halt, constant volume, level. */
export function pulseControlByte(duty: number, level: number): number {
  return (dutyBits(duty) << 6) | PULSE_HALT_CONSTANT | levelNibble(level)
}

/** The `pulse1.sweep` knob (−7..+7, off at 0) as an $4001 EPPP NSSS byte.
 *  Positive = pitch rises, which on hardware means the negate flag: the sweep unit
 *  subtracts the shifted period, and a smaller period is a higher note. A downward
 *  sweep that pushes the target past $7FF mutes the channel permanently — that is
 *  authentic, and it is why the shift is capped at 7 rather than being unbounded. */
export function sweepByteFor(knob: number): number {
  const v = Math.round(knob)
  if (v === 0) return SWEEP_OFF_BYTE
  const shift = Math.min(7, Math.abs(v))
  return 0x80 | (SWEEP_PERIOD << 4) | (v > 0 ? 0x08 : 0) | shift
}

/** Velocity scales the knob's level; a struck key is never silent unless the knob is
 *  at zero. Native units in, register nibble out. */
export function volumeFor(level: number, velocity: number): number {
  if (level <= 0 || velocity <= 0) return 0
  const v = Math.round((level * velocity) / 127)
  return v < 1 ? 1 : v > 15 ? 15 : v
}

/** `master.volume` 0..1 → the worklet's `masterGain`. The registry declares an exp
 *  taper and `paramFraction` deliberately keeps the knob's TRAVEL linear, so the
 *  curve has to be applied on the audio side — here, exactly once. v² is the
 *  standard perceptual approximation and lands 0.72 at ~52 % of full scale. */
export function masterGainFor(volume: number): number {
  const v = volume < 0 ? 0 : volume > 1 ? 1 : volume
  return DEFAULT_MASTER_GAIN * v * v
}

/** Where a parameter lands. `'none'` is not an error — it is how an id that the
 *  registry knows but this phase does not map yet stays inert instead of writing a
 *  register it should not. */
export type ParamTargetKind = 'pulseControl' | 'pulseSweep' | 'masterGain' | 'none'

export interface ParamTarget {
  readonly kind: ParamTargetKind
  /** Register address, or 0 for targets that are not register writes. */
  readonly addr: number
  /** True when a change may be applied to a sounding note without retriggering it.
   *  Every phase-1 parameter can: none of them writes $4003. */
  readonly live: boolean
}

const TARGETS: Readonly<Record<ParamId, ParamTarget>> = {
  'pulse1.duty': { kind: 'pulseControl', addr: 0x4000, live: true },
  'pulse1.envDecay': { kind: 'pulseControl', addr: 0x4000, live: true },
  'pulse1.sweep': { kind: 'pulseSweep', addr: 0x4001, live: true },
  'master.volume': { kind: 'masterGain', addr: 0, live: true },
}

const NO_TARGET: ParamTarget = { kind: 'none', addr: 0, live: false }

export function paramTarget(id: ParamId): ParamTarget {
  return TARGETS[id] ?? NO_TARGET
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v)
  return n < lo ? lo : n > hi ? hi : n
}
