/** a Section — `bars` bars of eight lanes, the unit a composer actually writes.
 *
 *  A section is a flat grid of rows, not a pattern: `Song.order()` slices it into
 *  `rowsPerPattern` frames afterwards and de-duplicates what repeats. That is the whole
 *  reason a sixteen-bar chorus costs the same to write as a four-bar one.
 *
 *  Every setter validates on the spot and throws naming the section, the lane and the
 *  row. A cell that is wrong at 3 a.m. is cheaper to find here than in a gate's checksum.
 */
import { CUT, MAX_EFFECT_COLUMNS, MAX_NOTE, REL, STICKY_EFFECTS, hex, n, nib } from './notes.mjs'

const LANE_NAMES = ['P1', 'P2', 'TRI', 'NOISE', 'DPCM', 'V1', 'V2', 'SAW']

function normaliseFx(fx, where) {
  if (fx === undefined || fx === null) return undefined
  if (!Array.isArray(fx)) throw new Error(`${where}: fx must be a list of [cmd, param] pairs`)
  if (fx.length > MAX_EFFECT_COLUMNS) {
    throw new Error(`${where}: ${fx.length} effects, but a cell holds at most ${MAX_EFFECT_COLUMNS}`)
  }
  return fx.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 1) throw new Error(`${where}: each effect is [cmd, param]`)
    const cmd = String(pair[0]).toUpperCase()
    if (cmd.length !== 1) throw new Error(`${where}: effect command ${JSON.stringify(pair[0])} is not one character`)
    return { cmd, param: hex(pair[1] === undefined ? 0 : pair[1]) }
  })
}

export class Section {
  /** @param {string} name @param {number} bars @param {number} rowsPerBar */
  constructor(name, bars, rowsPerBar) {
    this.name = name
    this.bars = bars
    this.rowsPerBar = rowsPerBar
    this.len = bars * rowsPerBar
    this.lanes = Array.from({ length: 8 }, () => new Array(this.len).fill(null))
  }

  /** Absolute row of `row` inside `bar` — the song's rowHighlight2 is the bar. */
  at(bar, row = 0) {
    return bar * this.rowsPerBar + row
  }

  where(lane, row) {
    return `${this.name}[${LANE_NAMES[lane] ?? lane}] row ${row}`
  }

  /** Merge fields into one cell. `row` is absolute inside the section; `fx` replaces the
   *  cell's whole effect list, because the effect columns are a tuple, not a set. */
  put(lane, row, fields = {}) {
    if (!Number.isInteger(lane) || lane < 0 || lane > 7) throw new Error(`put: lane ${lane} is not 0..7`)
    if (!Number.isInteger(row) || row < 0 || row >= this.len) {
      throw new Error(`${this.where(lane, row)}: outside this ${this.bars}-bar section (0..${this.len - 1})`)
    }
    const where = this.where(lane, row)
    const cell = this.lanes[lane][row] ?? {}
    if (fields.note !== undefined) {
      const note = n(fields.note)
      if (note !== CUT && note !== REL && (note < 0 || note > MAX_NOTE)) {
        throw new Error(`${where}: note ${note} outside 0..${MAX_NOTE}`)
      }
      cell.note = note
    }
    if (fields.inst !== undefined) {
      if (!Number.isInteger(fields.inst) || fields.inst < 0) throw new Error(`${where}: inst ${fields.inst} is not an instrument id`)
      cell.inst = fields.inst
    }
    if (fields.vol !== undefined) {
      if (!Number.isInteger(fields.vol) || fields.vol < 0 || fields.vol > 15) {
        throw new Error(`${where}: vol ${fields.vol} outside 0..15`)
      }
      cell.vol = fields.vol
    }
    const fx = normaliseFx(fields.fx, where)
    if (fx !== undefined) cell.fx = fx
    this.lanes[lane][row] = cell
    return cell
  }

  /** An effect-only cell at `bar`:`row` — a `Bxx` loop, an `Fxx` tempo event, an `A00`
   *  that cancels a fade without restriking anything. */
  fx(lane, bar, row, cmd, param = 0) {
    return this.put(lane, this.at(bar, row), { fx: [[cmd, param]] })
  }

  /** A melodic line. `events` are `[bar, row, note, cmd?, param?]`; the note may be a
   *  name, a MIDI number, `'---'` (cut) or `'==='` (release).
   *
   *  Sticky effects — `0xy` arpeggio, `3xx` portamento, `4xy` vibrato, `7xy` tremolo —
   *  are cleared with a zero param on the next event that carries no effect of its own,
   *  and, if one is still latched at the end, on the section's last row. Effect memory
   *  is per channel and per letter and it survives a section boundary and the loop seam
   *  (§2.9 rule 3), so a hook that wobbles once must not wobble forever. */
  line(lane, inst, vol, events) {
    // Effect memory is per channel and per LETTER, so two latched effects are two
    // separate things to cancel — clearing only the most recent one leaves the other
    // running into the next section and across the loop seam.
    const pending = new Set()
    const clears = () => [...pending].sort().map((cmd) => [cmd, 0])
    for (const [bar, row, note, cmd, param] of events) {
      const fields = { note, inst, vol }
      if (cmd !== undefined && cmd !== null) {
        const upper = String(cmd).toUpperCase()
        const value = param === undefined ? 0 : param
        fields.fx = [[upper, value]]
        if (STICKY_EFFECTS.includes(upper)) {
          if (value === 0) pending.delete(upper)
          else pending.add(upper)
        }
      } else if (pending.size > 0) {
        fields.fx = clears()
        pending.clear()
      }
      this.put(lane, this.at(bar, row), fields)
    }
    if (pending.size > 0) {
      const last = this.lanes[lane][this.len - 1]
      if (last === null || last.fx === undefined) this.put(lane, this.len - 1, { fx: clears() })
    }
    return this
  }

  /** Drum hits at `[bar, row]` positions, all on one instrument at one volume. `note`
   *  defaults to the instrument's registered note — the kit table of §3.4 for a shared
   *  bank drum, or whatever `s.instrument(..., { note })` declared. */
  hits(lane, inst, vol, positions, note = undefined) {
    const pitch = note === undefined ? this.defaultNote(inst, lane) : note
    for (const [bar, row, cmd, param] of positions) {
      const fields = { note: pitch, inst, vol }
      if (cmd !== undefined && cmd !== null) fields.fx = [[cmd, param === undefined ? 0 : param]]
      this.put(lane, this.at(bar, row), fields)
    }
    return this
  }

  /** A chord as one `0xy` arpeggio cell: `chord(lane, inst, vol, bar, row, 'c4', [4, 7])`
   *  is the root plus a major third and a fifth — the grid's `047`, stored as 71. */
  chord(lane, inst, vol, bar, row, root, offsets) {
    if (!Array.isArray(offsets) || offsets.length !== 2) {
      throw new Error(`${this.where(lane, this.at(bar, row))}: a 0xy chord takes exactly two offsets, [x, y]`)
    }
    return this.put(lane, this.at(bar, row), {
      note: root, inst, vol, fx: [['0', nib(offsets[0], offsets[1])]],
    })
  }

  /** §2.2's echo trick: copy every attack on `from` onto `to`, `delay` rows later, at a
   *  lower volume and a different instrument. Never overwrites a cell `to` already has. */
  echo(from, to, delay, inst, vol) {
    for (let r = this.len - 1; r >= 0; r--) {
      const src = this.lanes[from][r]
      if (src === null || src.note === undefined || src.note < 0) continue
      const at = r + delay
      if (at >= this.len || this.lanes[to][at] !== null) continue
      this.put(to, at, { note: src.note, inst, vol })
    }
    return this
  }

  /** Set by `Song`, which owns the instrument table. */
  defaultNote() {
    throw new Error('hits(): no note given and this section is not attached to a song')
  }
}
