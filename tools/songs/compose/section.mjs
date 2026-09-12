/** a Section — `bars` bars of eight lanes, the unit a composer actually writes.
 *
 *  A section is a flat grid of rows, not a pattern: `Song.order()` slices it into
 *  `rowsPerPattern` frames afterwards and de-duplicates what repeats. That is the whole
 *  reason a sixteen-bar chorus costs the same to write as a four-bar one.
 *
 *  Every setter validates on the spot and throws naming the section, the lane and the
 *  row. A cell that is wrong at 3 a.m. is cheaper to find here than in a gate's checksum.
 */
import { CUT, MAX_EFFECT_COLUMNS, MAX_NOTE, REL, hex, n, nib } from './notes.mjs'
import { applyCell, cancelsFor } from './sticky.mjs'

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

  /** This lane's sticky-effect ledger through `upToRow` inclusive: which channel modes
   *  of preset-suite §12.5 are latched there, and the cell that latched each.
   *
   *  It is DERIVED from the grid rather than tracked alongside it, so one ledger serves
   *  every writer — `line()`, `chord()`, a bare `put()` — and a cell written out of row
   *  order still reads correctly. Effect memory is per channel and per MODE, so two
   *  latched modes are two separate things to cancel. */
  latched(lane, upToRow = this.len - 1) {
    const ledger = new Map()
    for (let r = 0; r <= upToRow && r < this.len; r++) {
      applyCell(ledger, this.lanes[lane][r], this.where(lane, r))
    }
    return ledger
  }

  /** §12.5's rule for a composer, applied: *every channel mode you turn on, turn off in
   *  the section that turned it on.* Whatever each lane still has latched at the end of
   *  the section is cancelled on its last row. A last row that already carries effects of
   *  its own is left alone — `check()` reports it, because guessing which of four columns
   *  to displace is not the library's call. Idempotent: `Song.build()` runs it. */
  sealSticky() {
    for (let lane = 0; lane < 8; lane++) {
      const held = this.latched(lane)
      if (held.size === 0) continue
      const last = this.lanes[lane][this.len - 1]
      if (last === null || last.fx === undefined) this.put(lane, this.len - 1, { fx: cancelsFor(held) })
    }
    return this
  }

  /** An effect-only cell at `bar`:`row` — a `Bxx` loop, an `Fxx` tempo event, an `A00`
   *  that cancels a fade without restriking anything. */
  fx(lane, bar, row, cmd, param = 0) {
    return this.put(lane, this.at(bar, row), { fx: [[cmd, param]] })
  }

  /** A melodic line. `events` are `[bar, row, note, cmd?, param?]`; the note may be a
   *  name, a MIDI number, `'---'` (cut) or `'==='` (release).
   *
   *  Channel modes — the §12.5 table in `sticky.mjs` — are cancelled on the next event
   *  that carries no effect of its own, each with the cancel the DRIVER honours and not
   *  merely a zero param, and anything still latched at the end of the section is
   *  cancelled on its last row by `sealSticky()`. A mode survives its note, a section
   *  boundary and the loop seam (§2.9 rule 3), so a hook that wobbles once must not
   *  wobble forever. */
  line(lane, inst, vol, events) {
    for (const [bar, row, note, cmd, param] of events) {
      const at = this.at(bar, row)
      const fields = { note, inst, vol }
      if (cmd !== undefined && cmd !== null) {
        fields.fx = [[String(cmd).toUpperCase(), param === undefined ? 0 : param]]
      } else {
        // A bare event is the lane playing something that is not part of whatever came
        // before it, so it cancels every mode still standing — including one a `chord()`
        // or a raw `put()` left there, not merely this call's own.
        const held = this.latched(lane, at - 1)
        if (held.size > 0) fields.fx = cancelsFor(held)
      }
      this.put(lane, at, fields)
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
   *  is the root plus a major third and a fifth — the grid's `047`, stored as 71.
   *
   *  `0xy` is a channel MODE, not a one-row effect: it is the same latch `line()` cancels,
   *  and a chord that is never cancelled voices every later note on the lane and the whole
   *  second pass of the piece. So a chord enters the same per-lane ledger — the next bare
   *  `line()` event on the lane cancels it, and `sealSticky()` cancels it on the section's
   *  last row if nothing else did. The chord's own cell carries an effect, so, exactly
   *  like `line()`'s effect branch, it does not itself cancel what came before it. */
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
