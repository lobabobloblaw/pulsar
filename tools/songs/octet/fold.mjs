/** Time-folding helpers for the two VRC6 pieces (tools/songs/octet/README.md).
 *
 *  Everything works on a LANE TIMELINE: the lane's cells laid end to end across the order
 *  list (`absolute row = frame · rowsPerPattern + row`). Both VRC6 demos use an identity
 *  order (frame f plays pattern f), so a timeline maps back onto the patterns one-to-one;
 *  `timeline()` asserts that.
 */
import { LANE, OFF, cellFx, isEmptyCell, withFx } from './convert.mjs'

export function assertIdentityOrder(doc) {
  doc.order.forEach((p, f) => {
    if (p !== f) throw new Error(`order[${f}] = ${p}: the fold helpers need an identity order`)
  })
}

/** The lane's cells across the whole order, as one array (cells are shared, not copied). */
export function timeline(doc, lane) {
  assertIdentityOrder(doc)
  const out = []
  for (const p of doc.order) for (const cell of doc.patterns[p].rows[lane]) out.push(cell)
  return out
}

export function writeTimeline(doc, lane, cells) {
  const rows = doc.rowsPerPattern
  for (let i = 0; i < cells.length; i++) {
    doc.patterns[doc.order[Math.floor(i / rows)]].rows[lane][i % rows] = cells[i] ?? null
  }
}

export function clearLane(doc, lane) {
  for (const p of doc.patterns) p.rows[lane].fill(null)
}

export function hasNote(cell) {
  return !!cell && cell[0] !== null && cell[0] !== undefined
}

/** A note event copied onto another lane: same note, instrument, volume and effects. */
export function copyCell(cell) {
  return cell ? cell.map((v) => (Array.isArray(v) ? v.map((e) => e.slice()) : v)) : null
}

/** Rows until an instrument's volume macro first reaches 0, or Infinity when it loops or
 *  never does. Used to know when a struck sound has died and a background may return. */
export function sustainRows(inst, ticksPerRow) {
  const v = inst.volume
  const zero = v.values.indexOf(0)
  if (v.loop >= 0 && (zero < 0 || v.loop <= zero)) return Infinity
  if (zero < 0) return Infinity
  return Math.ceil((zero + 1) / ticksPerRow)
}

/**
 * Fold several timelines onto one lane by row. `layers` are in PRIORITY order; each is
 * `{ name, cells, from?, to? }` (absolute-row window, default whole song). Rule: on a row
 * where several layers carry a note, the first wins and the others' events are reported as
 * `displaced`; a layer's effect-only rows are kept only while that layer owns the lane
 * (its last note is the lane's current note). Returns `{ cells, displaced, owner }` where
 * `owner[row]` is the name of the layer sounding at that row.
 */
export function fold(length, layers) {
  const cells = new Array(length).fill(null)
  const owner = new Array(length).fill(null)
  const displaced = []
  let current = null
  for (let r = 0; r < length; r++) {
    let winner = null
    for (const layer of layers) {
      const cell = layer.cells[r]
      if (!cell || r < (layer.from ?? 0) || r >= (layer.to ?? length)) continue
      if (hasNote(cell)) {
        if (winner === null) winner = layer
        else displaced.push({ row: r, layer: layer.name, cell, winner: winner.name })
      }
    }
    if (winner !== null) {
      cells[r] = copyCell(winner.cells[r])
      current = winner.cells[r][0] === OFF ? null : winner.name
    } else {
      // effect-only rows: only the owner's survive, plus global flow effects from anyone
      for (const layer of layers) {
        const cell = layer.cells[r]
        if (!cell || r < (layer.from ?? 0) || r >= (layer.to ?? length)) continue
        const fx = cellFx(cell).filter(([cmd]) => layer.name === current || 'BCDF'.includes(cmd))
        if (fx.length === 0 && (cell[1] === null || layer.name !== current)) continue
        const keep = layer.name === current ? [null, cell[1], cell[2], null, null] : [null, null, null, null, null]
        const merged = withFx(keep, [...cellFx(cells[r]), ...fx])
        if (merged) cells[r] = merged
      }
    }
    owner[r] = current
  }
  return { cells, displaced, owner }
}

/** Every Bxx/Cxx/Dxx/Fxx anywhere in the ORIGINAL eight lanes must survive on one of the
 *  five kept lanes at the same row. Missing ones are parked on the first lane in `prefer`
 *  with a free effect slot (an extra column if necessary). */
export function parkGlobalFx(original, doc, prefer = [LANE.NOISE, LANE.TRI, LANE.P2, LANE.P1]) {
  const rows = doc.rowsPerPattern
  for (const p of doc.order) {
    for (let r = 0; r < rows; r++) {
      const wanted = []
      for (let c = 0; c < 8; c++) {
        for (const [cmd, param] of cellFx(original.patterns[p].rows[c][r])) {
          if ('BCDF'.includes(cmd)) wanted.push([cmd, param])
        }
      }
      for (const [cmd, param] of wanted) {
        const present = [0, 1, 2, 3, 4].some((c) =>
          cellFx(doc.patterns[p].rows[c][r]).some(([k, v]) => k === cmd && v === param),
        )
        if (present) continue
        const lane = prefer.find((c) => cellFx(doc.patterns[p].rows[c][r]).length === 0) ?? prefer[0]
        const cell = doc.patterns[p].rows[lane][r]
        doc.patterns[p].rows[lane][r] = withFx(cell, [...cellFx(cell), [cmd, param]])
      }
    }
  }
}

/** Row 0 of the loop frame must state note, instrument and volume on every kept lane.
 *  `policy[lane]` is `'cut'` (nothing was sounding there) or `[note, inst, vol]` (restate
 *  the note that carries across the seam). */
export function ensureLoopEntry(doc, frame, policy) {
  const pattern = doc.patterns[doc.order[frame]]
  for (const [laneKey, rule] of Object.entries(policy)) {
    const lane = Number(laneKey)
    const cell = pattern.rows[lane][0] ?? [null, null, null, null, null]
    if (hasNote(cell) && cell[0] >= 0 && cell[1] !== null && cell[2] !== null) continue
    if (hasNote(cell) && cell[0] === OFF) continue
    const next = cell.slice()
    while (next.length < 5) next.push(null)
    if (rule === 'cut') {
      if (!hasNote(next)) next[0] = OFF
    } else {
      if (!hasNote(next)) next[0] = rule[0]
      if (next[1] === null) next[1] = rule[1]
      if (next[2] === null) next[2] = rule[2]
    }
    pattern.rows[lane][0] = isEmptyCell(next) ? null : next
  }
}
