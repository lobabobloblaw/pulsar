/** LiveScheduler — the P1 write producer (plan B6).
 *
 *  Turns "a key went down" into a canonical register sequence placed at
 *  `nowCycle() + lead` on the engine's timeline. It is the only place in the host that
 *  knows what a note-on looks like in registers; the Phase-2 tracker will be a second
 *  producer against the same `WriteSink`, which is what guarantees tracker playback
 *  ends up bit-identical to live play.
 *
 *  It talks to the engine through the structural `LiveEngine` interface rather than to
 *  `EngineHandle` directly. That is not ceremony: it keeps this module free of DOM
 *  types, so the adaptive-lead controller and the canonical sequences are testable
 *  under tsconfig.test.json with no AudioContext anywhere in sight.
 *
 *  Allocation policy: `noteOn`/`noteOff`/`setParam` are called at keydown and
 *  pointermove rate and allocate nothing — the held-note stack is a preallocated
 *  Int32Array, every register write goes through positional arguments, and the
 *  adaptive controller mutates two numbers.
 *
 *  Monophonic, last-note priority, on pulse1 — and that is the M7 decision, not a
 *  placeholder: the shipped instrument is one voice with a keybed under it, so the
 *  held-key stack below IS the voice policy. Polyphony arrives with the Phase-2
 *  tracker, where a real allocator can assign pulse1/pulse2/triangle per row and call
 *  exactly these writers with a channel index.
 */
import {
  dutyBits,
  levelNibble,
  masterGainFor,
  pulseControlAddr,
  pulseControlByte,
  pulseSweepAddr,
  sweepByteFor,
  volumeFor,
} from './paramMapping'
import { pulseTimerForMidi } from './pitch'
import { REG_STATUS } from '../core/constants'
import { msToCycles } from '../timeline/clockMap'
import type { NesCycle, RegAddr, WriteSink } from '../timeline/types'
import type { ParamId } from '../params'

/** The register arithmetic lives in `paramMapping` — one definition of what a knob
 *  means, shared by the scheduler and the bridge. Re-exported here because this is
 *  where callers (and the M3 tests) already look for it. */
export { sweepByteFor, volumeFor } from './paramMapping'

/** Default scheduling lead. 6 ms ≈ 10 739 NTSC cycles. */
export const DEFAULT_LEAD_MS = 6
/** Plan B6 bounds. Below 3 ms a single scheduler hiccup lands in the past; above
 *  25 ms the instrument stops feeling connected to the keys. */
export const MIN_LEAD_MS = 3
export const MAX_LEAD_MS = 25
/** Adaptation cadence and step sizes: back off fast, recover slowly. */
export const LEAD_ADAPT_INTERVAL_MS = 2000
export const LEAD_UP_MS = 2
export const LEAD_DOWN_MS = 0.5

/** How many keys can be held before the oldest is forgotten. Ten fingers plus slack. */
const HELD_CAPACITY = 16

const PULSE1_ENABLE = 0x01

/** What the scheduler needs from the engine. `EngineHandle` satisfies it; so does a
 *  three-field fake in a test. */
export interface LiveEngine {
  readonly clockRate: number
  /** Read AND written: the adaptive controller lives here, and the engine reports
   *  the current value through `diagnostics()`. */
  leadMs: number
  /** Cycle matching the first output sample the worklet has not rendered yet. */
  nowCycle(): NesCycle
  write(cycle: NesCycle, addr: RegAddr, value: number): void
  /** No-op on the SAB transport; hands the pooled batch over on the fallback. */
  flush(): void
  /** Total late writes the engine has seen. Drives the adaptive lead. */
  lateWrites(): number
  setMasterGain(gain: number): void
}

export interface LiveSchedulerOptions {
  leadMs?: number
  minLeadMs?: number
  maxLeadMs?: number
  /** Off makes the lead a constant — used by determinism tests. */
  adaptive?: boolean
  /** Injected clock, so a test can step 2 s without waiting 2 s. Defaults to
   *  `Date.now`, which is available on every thread and plenty precise for a 2 s
   *  cadence. */
  now?: () => number
  /** Initial duty index 0..3 and volume level 0..15 (the `pulse1.duty` and
   *  `pulse1.envDecay` knobs' defaults live in audio/params.ts). */
  duty?: number
  volume?: number
}

// --- canonical register sequences ------------------------------------------------

/** Canonical note-on (plan B6), every write on the SAME cycle so it is atomic on the
 *  timeline: enable first, then $4000, $4001, $4002, and $4003 LAST — $4003 latches
 *  the timer high bits, loads the length counter, resets the duty step and restarts
 *  the envelope, so everything it depends on must already be in place.
 *
 *  `enableMask` is the whole $4015 byte, not one bit: writing a single bit would
 *  silence every other channel, which is exactly the bug polyphony would hit first. */
export function writePulseNoteOn(
  sink: WriteSink,
  cycle: NesCycle,
  channel: number,
  timer: number,
  duty: number,
  volume: number,
  sweepByte: number,
  enableMask: number,
): void {
  const base = pulseControlAddr(channel)
  sink.write(cycle, REG_STATUS, enableMask)
  // DDLC VVVV — length halt (L) and constant volume (C) both set for a held note.
  sink.write(cycle, base, pulseControlByte(duty, volume))
  sink.write(cycle, base + 1, sweepByte & 0xff)
  sink.write(cycle, base + 2, timer & 0xff)
  sink.write(cycle, base + 3, (timer >> 8) & 0x07)
}

/** Authentic hard cut — clear the channel's $4015 bit and let the analog
 *  high-passes absorb the step. */
export function writeNoteOff(sink: WriteSink, cycle: NesCycle, enableMask: number): void {
  sink.write(cycle, REG_STATUS, enableMask)
}

/** $4000 only: changes duty and level WITHOUT resetting the sequencer phase, which is
 *  what makes a duty knob sweep continuously instead of clicking. */
export function writePulseControl(
  sink: WriteSink,
  cycle: NesCycle,
  channel: number,
  duty: number,
  volume: number,
): void {
  sink.write(cycle, pulseControlAddr(channel), pulseControlByte(duty, volume))
}

export function writePulseSweep(
  sink: WriteSink,
  cycle: NesCycle,
  channel: number,
  sweepByte: number,
): void {
  sink.write(cycle, pulseSweepAddr(channel), sweepByte & 0xff)
}

// --- the scheduler ---------------------------------------------------------------

export class LiveScheduler {
  private readonly engine: LiveEngine
  private readonly minLeadMs: number
  private readonly maxLeadMs: number
  private readonly adaptive: boolean
  private readonly now: () => number

  /** Held keys, oldest first — last-note priority with fallback to the note under it. */
  private readonly held = new Int32Array(HELD_CAPACITY)
  private heldCount = 0
  private soundingNote = -1

  private duty: number
  private level: number
  private sweepByte = 0x08
  private enableMask = 0

  /** Monotonic guard: the drain stops at the first write past the limit, so the ring
   *  must stay sorted. A lead that shrinks between two keystrokes could otherwise
   *  emit an earlier cycle than the write already queued. */
  private lastCycle: NesCycle = 0

  private lastAdaptMs: number
  private lastLateWrites = 0

  constructor(engine: LiveEngine, opts: LiveSchedulerOptions = {}) {
    this.engine = engine
    this.minLeadMs = opts.minLeadMs ?? MIN_LEAD_MS
    this.maxLeadMs = opts.maxLeadMs ?? MAX_LEAD_MS
    this.adaptive = opts.adaptive ?? true
    this.now = opts.now ?? Date.now
    this.duty = opts.duty ?? 2
    this.level = opts.volume ?? 15
    engine.leadMs = clamp(opts.leadMs ?? engine.leadMs, this.minLeadMs, this.maxLeadMs)
    this.lastAdaptMs = this.now()
    this.lastLateWrites = engine.lateWrites()
  }

  get leadMs(): number {
    return this.engine.leadMs
  }

  set leadMs(ms: number) {
    this.engine.leadMs = clamp(ms, this.minLeadMs, this.maxLeadMs)
  }

  /** MIDI note number currently sounding, or −1. */
  get sounding(): number {
    return this.soundingNote
  }

  get heldNotes(): number {
    return this.heldCount
  }

  /** The cycle the most recent event was placed on — monotonic by construction. */
  get lastScheduledCycle(): NesCycle {
    return this.lastCycle
  }

  noteOn(note: number, velocity = 127): void {
    this.tick()
    this.pushHeld(note)
    this.trigger(note, velocity)
    this.engine.flush()
  }

  noteOff(note: number): void {
    this.tick()
    this.removeHeld(note)
    if (this.soundingNote !== note) {
      // A note that was already superseded: nothing sounds it, nothing to cut.
      this.engine.flush()
      return
    }
    if (this.heldCount > 0) {
      this.trigger(this.held[this.heldCount - 1], 127)
    } else {
      this.silence()
    }
    this.engine.flush()
  }

  /** The stuck-note guard (plan C8) and the MIDI hot-plug path both land here. */
  allNotesOff(): void {
    this.heldCount = 0
    this.silence()
    this.engine.flush()
  }

  /** Native units in — the register mapping is the audio side's business (plan C3). */
  setParam(id: ParamId, value: number): void {
    switch (id) {
      case 'pulse1.duty': {
        this.duty = dutyBits(value)
        if (this.soundingNote >= 0) {
          writePulseControl(this.engine, this.at(), 0, this.duty, this.level)
        }
        break
      }
      case 'pulse1.envDecay': {
        this.level = levelNibble(value)
        if (this.soundingNote >= 0) {
          writePulseControl(this.engine, this.at(), 0, this.duty, this.level)
        }
        break
      }
      case 'pulse1.sweep': {
        this.sweepByte = sweepByteFor(value)
        if (this.soundingNote >= 0) {
          writePulseSweep(this.engine, this.at(), 0, this.sweepByte)
        }
        break
      }
      case 'master.volume': {
        // The exp taper lives in paramMapping rather than in the knob's travel
        // (plan C4) — and in exactly that one place.
        this.engine.setMasterGain(masterGainFor(value))
        break
      }
      default:
        return
    }
    this.engine.flush()
  }

  /** Adaptive lead (plan B6). Every 2 s: any late write since the last check pushes
   *  the lead up 2 ms (capped at 25); a clean interval walks it back down 0.5 ms
   *  (floored at 3). Backing off fast and recovering slowly is deliberate — a lead
   *  that oscillates is worse than one that is 1 ms too long.
   *
   *  Safe and cheap to call from the UI's rAF; it is also called from every note
   *  event, so the controller still converges with no external pump. */
  tick(): void {
    if (!this.adaptive) return
    const now = this.now()
    if (now - this.lastAdaptMs < LEAD_ADAPT_INTERVAL_MS) return
    this.lastAdaptMs = now
    const late = this.engine.lateWrites()
    const fresh = late - this.lastLateWrites
    this.lastLateWrites = late
    const lead = this.engine.leadMs
    this.engine.leadMs =
      fresh > 0
        ? Math.min(this.maxLeadMs, lead + LEAD_UP_MS)
        : Math.max(this.minLeadMs, lead - LEAD_DOWN_MS)
  }

  /** End of an input burst. Public because a caller that batches a chord into one
   *  event can defer it; every method above already flushes on its own. */
  flush(): void {
    this.engine.flush()
  }

  // --- internals -----------------------------------------------------------------

  /** The cycle the next event belongs on, clamped monotonic. */
  private at(): NesCycle {
    const c = this.engine.nowCycle() + msToCycles(this.engine.clockRate, this.engine.leadMs)
    if (c < this.lastCycle) return this.lastCycle
    this.lastCycle = c
    return c
  }

  private trigger(note: number, velocity: number): void {
    const timer = pulseTimerForMidi(note, this.engine.clockRate)
    this.enableMask |= PULSE1_ENABLE
    writePulseNoteOn(
      this.engine,
      this.at(),
      0,
      timer,
      this.duty,
      volumeFor(this.level, velocity),
      this.sweepByte,
      this.enableMask,
    )
    this.soundingNote = note
  }

  private silence(): void {
    if (this.soundingNote < 0 && this.enableMask === 0) return
    this.enableMask &= ~PULSE1_ENABLE
    writeNoteOff(this.engine, this.at(), this.enableMask)
    this.soundingNote = -1
  }

  private pushHeld(note: number): void {
    this.removeHeld(note)
    if (this.heldCount >= HELD_CAPACITY) {
      // Drop the oldest rather than the newest: the key the player just pressed is
      // the one they expect to hear.
      for (let i = 1; i < HELD_CAPACITY; i++) this.held[i - 1] = this.held[i]
      this.heldCount = HELD_CAPACITY - 1
    }
    this.held[this.heldCount] = note
    this.heldCount++
  }

  private removeHeld(note: number): void {
    const held = this.held
    let w = 0
    for (let i = 0; i < this.heldCount; i++) {
      const n = held[i]
      if (n === note) continue
      held[w] = n
      w++
    }
    this.heldCount = w
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
