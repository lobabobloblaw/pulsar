/** The instrument macro engine (design §3.4).
 *
 *  Five sequences per instrument — volume, arpeggio, pitch, hiPitch, duty — shared by
 *  index across instruments out of a common bank, exactly FamiTracker's model. One
 *  value per tick; the index starts at 0 ON THE TRIGGER TICK, so the first macro value
 *  is heard on the note's first tick.
 *
 *  The three rules that are [ours] because no licence-safe source documents them, each
 *  pinned by a test in trackerMacros.test.ts:
 *    - with no loop point the index stops at the last value and HOLDS it forever — it
 *      does not zero and it does not end the note (the tracker convention);
 *    - an instrument change without a note swaps the macro SET and keeps the macro
 *      INDICES;
 *    - after a release the loop point no longer applies: the tail runs to the end and
 *      holds the last value.
 *
 *  The documented rule that surprises people, and which is implemented literally: the
 *  VOLUME sequence decides whether a release is possible at all. A pitch macro with a
 *  release point and a volume macro without one still produces a cut.
 *
 *  Zero allocation per tick: the bank is flattened into typed arrays once on load and
 *  every per-channel index lives in an Int32Array.
 */
import { MACRO_KINDS, type ArpMode, type Song } from '../model/types'

export const MACRO_COUNT = 5
export const MACRO_VOLUME = 0
export const MACRO_ARPEGGIO = 1
export const MACRO_PITCH = 2
export const MACRO_HI_PITCH = 3
export const MACRO_DUTY = 4

export const ARP_ABSOLUTE = 0
export const ARP_FIXED = 1
export const ARP_RELATIVE = 2
export const ARP_SCHEME = 3

export function arpModeCode(mode: ArpMode | undefined): number {
  switch (mode) {
    case 'fixed':
      return ARP_FIXED
    case 'relative':
      return ARP_RELATIVE
    case 'scheme':
      return ARP_SCHEME
    default:
      return ARP_ABSOLUTE
  }
}

/** One macro kind's whole bank, flattened. Sequence `s` occupies
 *  `values[offset[s] .. offset[s] + length[s])`. */
export interface CompiledBank {
  readonly values: Int32Array
  readonly offset: Int32Array
  readonly length: Int32Array
  readonly loop: Int32Array
  readonly release: Int32Array
  readonly mode: Int32Array
  readonly count: number
}

export interface CompiledInstruments {
  /** `instrument · MACRO_COUNT + kind` -> sequence index in that kind's bank, or −1. */
  readonly macros: Int32Array
  readonly count: number
}

export interface CompiledMacros {
  readonly banks: readonly CompiledBank[]
  readonly instruments: CompiledInstruments
}

function compileBank(seqs: readonly { values: readonly number[]; loop: number; release: number; mode?: ArpMode }[]): CompiledBank {
  let total = 0
  for (const s of seqs) total += s.values.length
  const values = new Int32Array(total)
  const offset = new Int32Array(seqs.length)
  const length = new Int32Array(seqs.length)
  const loop = new Int32Array(seqs.length)
  const release = new Int32Array(seqs.length)
  const mode = new Int32Array(seqs.length)
  let at = 0
  for (let i = 0; i < seqs.length; i++) {
    const s = seqs[i]
    offset[i] = at
    length[i] = s.values.length
    loop[i] = s.loop
    release[i] = s.release
    mode[i] = arpModeCode(s.mode)
    for (let j = 0; j < s.values.length; j++) values[at + j] = s.values[j]
    at += s.values.length
  }
  return { values, offset, length, loop, release, mode, count: seqs.length }
}

export function compileMacros(song: Song): CompiledMacros {
  const banks: CompiledBank[] = []
  for (const kind of MACRO_KINDS) banks.push(compileBank(song.sequences[kind] ?? []))
  const count = song.instruments.length
  const macros = new Int32Array(count * MACRO_COUNT)
  macros.fill(-1)
  for (let i = 0; i < count; i++) {
    const inst = song.instruments[i]
    for (let k = 0; k < MACRO_COUNT; k++) {
      const idx = inst.macros[MACRO_KINDS[k]]
      const bank = banks[k]
      macros[i * MACRO_COUNT + k] =
        typeof idx === 'number' && idx >= 0 && idx < bank.count ? idx : -1
    }
  }
  return { banks, instruments: { macros, count } }
}

/** Per-channel macro cursors. One instance per driver, sized at load. */
export class MacroState {
  /** `ch · MACRO_COUNT + kind` -> sequence index, or −1 for "no macro". */
  readonly seq: Int32Array
  /** Index the NEXT read will use. */
  readonly pos: Int32Array
  /** 1 once the note has been released and the tail is running. */
  readonly released: Int32Array
  /** Running semitone offset for a `relative` arpeggio macro. */
  readonly relArp: Int32Array

  constructor(channelCount: number) {
    this.seq = new Int32Array(channelCount * MACRO_COUNT)
    this.pos = new Int32Array(channelCount * MACRO_COUNT)
    this.released = new Int32Array(channelCount * MACRO_COUNT)
    this.relArp = new Int32Array(channelCount)
    this.seq.fill(-1)
  }
}

export class MacroEngine {
  private macros: CompiledMacros
  readonly state: MacroState

  constructor(channelCount: number, macros: CompiledMacros) {
    this.macros = macros
    this.state = new MacroState(channelCount)
  }

  setMacros(macros: CompiledMacros): void {
    this.macros = macros
  }

  get banks(): readonly CompiledBank[] {
    return this.macros.banks
  }

  /** Sequence index this instrument uses for `kind`, or −1. */
  sequenceOf(instrument: number, kind: number): number {
    const inst = this.macros.instruments
    if (instrument < 0 || instrument >= inst.count) return -1
    return inst.macros[instrument * MACRO_COUNT + kind]
  }

  /** A fresh note: reset every index to 0 and clear the relative-arpeggio offset. */
  trigger(channel: number, instrument: number): void {
    const st = this.state
    const base = channel * MACRO_COUNT
    for (let k = 0; k < MACRO_COUNT; k++) {
      st.seq[base + k] = this.sequenceOf(instrument, k)
      st.pos[base + k] = 0
      st.released[base + k] = 0
    }
    st.relArp[channel] = 0
  }

  /** Instrument change WITHOUT a note: the macro set swaps, the indices carry over.
   *  A shorter sequence clamps rather than restarting — restarting would be an
   *  audible retrigger, which is exactly what this path must not do. [ours] */
  swapInstrument(channel: number, instrument: number): void {
    const st = this.state
    const base = channel * MACRO_COUNT
    for (let k = 0; k < MACRO_COUNT; k++) {
      const s = this.sequenceOf(instrument, k)
      st.seq[base + k] = s
      if (s < 0) continue
      const len = this.macros.banks[k].length[s]
      if (st.pos[base + k] >= len) st.pos[base + k] = len > 0 ? len - 1 : 0
    }
  }

  /** Does this instrument's VOLUME sequence have a release point? That single question
   *  decides whether a `===` releases or cuts, for all five macros. */
  canRelease(instrument: number): boolean {
    const s = this.sequenceOf(instrument, MACRO_VOLUME)
    if (s < 0) return false
    return this.macros.banks[MACRO_VOLUME].release[s] >= 0
  }

  /** `===`: every macro jumps to `release + 1` and runs its tail. A macro with no
   *  release point of its own simply keeps running — there is nothing to jump to. */
  release(channel: number): void {
    const st = this.state
    const base = channel * MACRO_COUNT
    for (let k = 0; k < MACRO_COUNT; k++) {
      const s = st.seq[base + k]
      st.released[base + k] = 1
      if (s < 0) continue
      const bank = this.macros.banks[k]
      const rel = bank.release[s]
      const len = bank.length[s]
      if (rel < 0 || len === 0) continue
      const next = rel + 1
      st.pos[base + k] = next >= len ? len - 1 : next
    }
  }

  /** Current output of one macro, or `fallback` when the channel has no such macro. */
  read(channel: number, kind: number, fallback: number): number {
    const st = this.state
    const slot = channel * MACRO_COUNT + kind
    const s = st.seq[slot]
    if (s < 0) return fallback
    const bank = this.macros.banks[kind]
    const len = bank.length[s]
    if (len === 0) return fallback
    let p = st.pos[slot]
    if (p >= len) p = len - 1
    return bank.values[bank.offset[s] + p]
  }

  /** Arpeggio mode of the channel's current arpeggio macro. */
  arpMode(channel: number): number {
    const st = this.state
    const s = st.seq[channel * MACRO_COUNT + MACRO_ARPEGGIO]
    if (s < 0) return ARP_ABSOLUTE
    return this.macros.banks[MACRO_ARPEGGIO].mode[s]
  }

  /** True when the channel has a macro of this kind at all. */
  has(channel: number, kind: number): boolean {
    return this.state.seq[channel * MACRO_COUNT + kind] >= 0
  }

  /** End of a tick: advance every index by one, honouring loop and release. */
  advance(channel: number): void {
    const st = this.state
    const base = channel * MACRO_COUNT
    for (let k = 0; k < MACRO_COUNT; k++) {
      const slot = base + k
      const s = st.seq[slot]
      if (s < 0) continue
      const bank = this.macros.banks[k]
      const len = bank.length[s]
      if (len === 0) continue
      const loop = bank.loop[s]
      const rel = bank.release[s]
      const released = st.released[slot] === 1
      let p = st.pos[slot] + 1
      if (!released && rel >= 0) {
        // Held, with a release point: never advance past it.
        if (p > rel) p = loop >= 0 && loop <= rel ? loop : rel
      } else if (released && rel >= 0) {
        // The tail: no loop, run to the end and hold the last value.
        if (p >= len) p = len - 1
      } else {
        if (p >= len) p = loop >= 0 ? loop : len - 1
      }
      st.pos[slot] = p
    }
  }
}
