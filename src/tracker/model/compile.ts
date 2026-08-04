/** Pattern / order compilation — the sparse document turned into something the
 *  per-tick loop can read with an offset instead of a search (design §1.2, §2.7).
 *
 *  The authored format is sparse because a hand-written 64-row pattern with four
 *  notes should be four lines of JSON. The driver cannot afford that: a row read must
 *  be an array index, never a linear scan and never an object allocation. So the
 *  document is compiled ONCE on load (and again on any document change — sub-millisecond
 *  at these sizes) into a dense `Int32Array` per pattern:
 *
 *      rows[row · LANES + lane]
 *
 *  with `LANES = 7`: note, inst, vol, fx0..fx3. (Design §2.7 says "6 lanes (note, inst,
 *  vol, fx0..fx3)" — that enumeration is seven lanes; the count is a typo and the
 *  enumeration is what is implemented. Noted in the WP9 report.)
 *
 *  Effects are packed as `cmdIndex << 8 | param`, `-1` for an empty slot. `cmdIndex`
 *  is the character's position in `'0'..'9','A'..'Z'`, so the driver switches on a
 *  small integer while the document keeps the character the user typed.
 */
import {
  CANONICAL_CHANNELS,
  NOTE_NONE,
  type ChannelId,
  type Song,
} from './types'

/** note, inst, vol, fx0, fx1, fx2, fx3. */
export const LANES = 7
export const LANE_NOTE = 0
export const LANE_INST = 1
export const LANE_VOL = 2
export const LANE_FX0 = 3
export const MAX_FX = 4

/** '0'..'9' -> 0..9, 'A'..'Z' -> 10..35, anything else -> -1. */
export function cmdIndex(cmd: string): number {
  if (cmd.length !== 1) return -1
  const c = cmd.charCodeAt(0)
  if (c >= 48 && c <= 57) return c - 48
  if (c >= 65 && c <= 90) return c - 65 + 10
  if (c >= 97 && c <= 122) return c - 97 + 10
  return -1
}

/** Inverse of `cmdIndex`, for diagnostics and for the grid. */
export function cmdChar(index: number): string {
  if (index < 0 || index > 35) return '?'
  return index < 10
    ? String.fromCharCode(48 + index)
    : String.fromCharCode(65 + index - 10)
}

/** Effect command indices the driver switches on. Named so the hot path reads. */
export const FX_ARPEGGIO = cmdIndex('0')
export const FX_SLIDE_UP = cmdIndex('1')
export const FX_SLIDE_DOWN = cmdIndex('2')
export const FX_PORTAMENTO = cmdIndex('3')
export const FX_VIBRATO = cmdIndex('4')
export const FX_TREMOLO = cmdIndex('7')
export const FX_VOLUME_SLIDE = cmdIndex('A')
export const FX_JUMP = cmdIndex('B')
export const FX_HALT = cmdIndex('C')
export const FX_SKIP = cmdIndex('D')
export const FX_SPEED = cmdIndex('F')
export const FX_DELAY = cmdIndex('G')
export const FX_FINE_PITCH = cmdIndex('P')
export const FX_NOTE_SLIDE_UP = cmdIndex('Q')
export const FX_NOTE_SLIDE_DOWN = cmdIndex('R')
export const FX_CUT = cmdIndex('S')
export const FX_DUTY = cmdIndex('V')

export const CMD_SLOTS = 36

export interface CompiledPattern {
  /** Channel index into `song.channels`. */
  readonly channel: number
  readonly index: number
  /** `rowsPerPattern · LANES` entries. */
  readonly rows: Int32Array
}

export interface CompiledSong {
  readonly song: Song
  readonly channels: readonly ChannelId[]
  readonly channelCount: number
  readonly rowsPerPattern: number
  readonly frameCount: number
  /** `frame · channelCount + ch` -> index into `patterns`, or −1 when the frame
   *  references a pattern that does not exist (the validator rejects that, but the
   *  driver must not crash on a document it was handed directly). */
  readonly order: Int32Array
  readonly patterns: readonly CompiledPattern[]
  /** Dense row arrays parallel to `patterns`, so the hot path holds one array of
   *  typed arrays instead of an array of objects. */
  readonly rows: readonly Int32Array[]
  /** Per-channel effect column count, clamped 1..4. */
  readonly effectColumns: Int32Array
}

/** Channel index for an id, or −1. */
export function channelIndex(channels: readonly ChannelId[], id: ChannelId): number {
  for (let i = 0; i < channels.length; i++) if (channels[i] === id) return i
  return -1
}

export function canonicalChannelIndex(id: ChannelId): number {
  return channelIndex(CANONICAL_CHANNELS, id)
}

/** Compile a document. Pure; allocates freely (this runs on load, not per tick). */
export function compileSong(song: Song): CompiledSong {
  const channels = song.channels
  const channelCount = channels.length
  const rowsPerPattern = song.meta.rowsPerPattern

  const patterns: CompiledPattern[] = []
  const rowArrays: Int32Array[] = []
  // (channel, index) -> slot in `patterns`.
  const slotOf = new Map<string, number>()

  for (const pattern of song.patterns) {
    const ch = channelIndex(channels, pattern.channel)
    if (ch < 0) continue
    const rows = new Int32Array(rowsPerPattern * LANES)
    rows.fill(-1)
    for (let r = 0; r < rowsPerPattern; r++) rows[r * LANES + LANE_NOTE] = NOTE_NONE
    for (const cell of pattern.rows) {
      if (cell.r < 0 || cell.r >= rowsPerPattern) continue
      const base = cell.r * LANES
      if (cell.note !== undefined) rows[base + LANE_NOTE] = cell.note
      if (cell.inst !== undefined) rows[base + LANE_INST] = cell.inst
      if (cell.vol !== undefined) rows[base + LANE_VOL] = cell.vol
      const fx = cell.fx
      if (fx !== undefined) {
        const n = fx.length < MAX_FX ? fx.length : MAX_FX
        for (let i = 0; i < n; i++) {
          const e = fx[i]
          if (e === null || e === undefined) continue
          const ci = cmdIndex(e.cmd)
          if (ci < 0) continue
          rows[base + LANE_FX0 + i] = (ci << 8) | (e.param & 0xff)
        }
      }
    }
    slotOf.set(`${pattern.channel}:${pattern.index}`, patterns.length)
    patterns.push({ channel: ch, index: pattern.index, rows })
    rowArrays.push(rows)
  }

  const frameCount = song.order.length
  const order = new Int32Array(Math.max(1, frameCount) * channelCount)
  order.fill(-1)
  for (let f = 0; f < frameCount; f++) {
    const frame = song.order[f]
    for (let ch = 0; ch < channelCount; ch++) {
      const idx = frame[ch]
      if (idx === undefined) continue
      const slot = slotOf.get(`${channels[ch]}:${idx}`)
      order[f * channelCount + ch] = slot === undefined ? -1 : slot
    }
  }

  const effectColumns = new Int32Array(channelCount)
  for (let ch = 0; ch < channelCount; ch++) {
    const n = song.effectColumns[ch] ?? 1
    effectColumns[ch] = n < 1 ? 1 : n > MAX_FX ? MAX_FX : n
  }

  return {
    song,
    channels,
    channelCount,
    rowsPerPattern,
    frameCount,
    order,
    patterns,
    rows: rowArrays,
    effectColumns,
  }
}

/** Every (frame, channel) the order walk can reach from frame 0 by normal advance and
 *  by following `Bxx`/`Dxx`. Used by the preset lint's "no dead frames" gate and by
 *  the note-event count the offline render is checked against. */
export function reachableFrames(compiled: CompiledSong): Set<number> {
  const seen = new Set<number>()
  const stack: number[] = [0]
  while (stack.length > 0) {
    const f = stack.pop()
    if (f === undefined || f < 0 || f >= compiled.frameCount || seen.has(f)) continue
    seen.add(f)
    let halted = false
    let jumped = false
    for (let ch = 0; ch < compiled.channelCount && !halted; ch++) {
      const slot = compiled.order[f * compiled.channelCount + ch]
      if (slot < 0) continue
      const rows = compiled.rows[slot]
      for (let r = 0; r < compiled.rowsPerPattern; r++) {
        const base = r * LANES
        for (let i = 0; i < MAX_FX; i++) {
          const packed = rows[base + LANE_FX0 + i]
          if (packed < 0) continue
          const ci = packed >> 8
          const param = packed & 0xff
          if (ci === FX_HALT) halted = true
          else if (ci === FX_JUMP) {
            stack.push(param)
            jumped = true
          } else if (ci === FX_SKIP) {
            stack.push(f + 1)
            jumped = true
          }
        }
      }
    }
    if (!halted && !jumped) stack.push(f + 1 >= compiled.frameCount ? 0 : f + 1)
  }
  return seen
}
