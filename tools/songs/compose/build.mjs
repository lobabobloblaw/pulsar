/** sections + an order list -> the canonical song document.
 *
 *  The output is written in exactly the shape `src/tracker/model/validate.ts`'s
 *  `serializeSong` emits — key order, pattern sort, row sort, trailing-null trimming,
 *  two-space indent, trailing newline — so gate A's byte-identical round trip holds on
 *  the committed file. `tools/songs/octet/convert.mjs` does the same for the ported
 *  pieces; this is the same contract reached from a generator instead of a converter.
 */
import { CHANNELS, CUT, MAX_EFFECT_COLUMNS, REL } from './notes.mjs'

const MACRO_KINDS = ['volume', 'arpeggio', 'pitch', 'hiPitch', 'duty']

function copyCell(cell) {
  if (cell === null) return null
  const out = {}
  if (cell.note !== undefined) out.note = cell.note
  if (cell.inst !== undefined) out.inst = cell.inst
  if (cell.vol !== undefined) out.vol = cell.vol
  if (cell.fx !== undefined) out.fx = cell.fx.map((e) => ({ cmd: e.cmd, param: e.param }))
  return out
}

/** The order list, flattened into dense frames of eight lanes. A section longer than one
 *  pattern becomes consecutive frames; a section named twice is written out twice, and
 *  the two copies are independent from here on (the `Bxx` that ends the piece belongs to
 *  the LAST frame, not to every frame that section produced). */
export function flatten(song) {
  const rows = song.meta.rowsPerPattern
  const frames = []
  const form = []
  const firstFrameOf = new Map()
  for (const name of song.orderNames) {
    const sec = song.sections.get(name)
    if (sec === undefined) throw new Error(`order names "${name}", which is not a section`)
    if (sec.len % rows !== 0) {
      throw new Error(
        `section "${name}" is ${sec.len} rows (${sec.bars} bars x ${sec.rowsPerBar}), which is ` +
          `not a whole number of ${rows}-row patterns`,
      )
    }
    if (!firstFrameOf.has(name)) firstFrameOf.set(name, frames.length)
    for (let f = 0; f < sec.len / rows; f++) {
      frames.push(sec.lanes.map((lane) => lane.slice(f * rows, (f + 1) * rows).map(copyCell)))
      form.push(name)
    }
  }
  if (frames.length === 0) throw new Error('order() produced no frames')
  return { frames, form, firstFrameOf }
}

/** Walk the frames up to `stop`, returning each lane's state at that seam: the note,
 *  instrument and volume in force, and whether anything is still sounding. */
function stateAt(frames, stop) {
  const state = Array.from({ length: 8 }, () => ({ note: -1, inst: -1, vol: -1, sounding: false }))
  for (let f = 0; f < stop; f++) {
    for (let lane = 0; lane < 8; lane++) {
      for (const cell of frames[f][lane]) {
        if (cell === null) continue
        const s = state[lane]
        if (cell.inst !== undefined) s.inst = cell.inst
        if (cell.vol !== undefined) s.vol = cell.vol
        if (cell.note === undefined) continue
        if (cell.note >= 0) {
          s.note = cell.note
          s.sounding = true
        } else {
          // A cut silences the lane; a release lets the macro tail ring on, and §2.9
          // rule 4 wants nothing ringing across the seam either way.
          s.sounding = false
        }
      }
    }
  }
  return state
}

/** §2.9's loop convention, mechanically: `Bxx` on the last frame's last row, and an
 *  explicit note/inst/vol — or a cut — on EVERY sounding lane at the loop row.
 *  Returns `{ loopFrame, bLane, entries }`. */
export function closeLoop(frames, rowsPerPattern, loopFrame, lanesThatSound, bLane) {
  const lastRow = rowsPerPattern - 1
  const last = frames[frames.length - 1]
  let lane = bLane
  if (lane === undefined) {
    lane = lanesThatSound.find((c) => (last[c][lastRow]?.fx ?? []).length < MAX_EFFECT_COLUMNS)
    if (lane === undefined) throw new Error('loopTo: no lane has room for Bxx on the last row')
  }
  const cell = last[lane][lastRow] ?? {}
  cell.fx = [...(cell.fx ?? []), { cmd: 'B', param: loopFrame }]
  if (cell.fx.length > MAX_EFFECT_COLUMNS) throw new Error('loopTo: the last row already carries four effects')
  last[lane][lastRow] = cell

  const state = stateAt(frames, loopFrame)
  const entries = []
  for (const c of lanesThatSound) {
    const target = frames[loopFrame][c][0] ?? {}
    const explicit = target.note !== undefined && target.note >= 0 && target.inst !== undefined && target.vol !== undefined
    if (explicit || target.note === CUT) {
      entries.push({ lane: c, action: 'kept' })
      continue
    }
    const s = state[c]
    if (!s.sounding && target.note === undefined) {
      target.note = CUT
      entries.push({ lane: c, action: 'cut' })
    } else {
      if (target.note === undefined) target.note = s.note >= 0 ? s.note : CUT
      if (target.note !== CUT && target.note !== REL) {
        if (target.inst === undefined) target.inst = s.inst
        if (target.vol === undefined) target.vol = s.vol
        if (target.inst < 0 || target.vol < 0) {
          throw new Error(
            `loopTo: lane ${CHANNELS[c]} sounds across the seam but has no instrument or volume to restate — ` +
              'write an explicit note/inst/vol on the loop row yourself',
          )
        }
      }
      entries.push({ lane: c, action: 'restated' })
    }
    frames[loopFrame][c][0] = target
  }
  return { loopFrame, bLane: lane, entries }
}

/** Lanes carrying at least one attack anywhere in the order. */
export function soundingLanes(frames) {
  const out = []
  for (let lane = 0; lane < 8; lane++) {
    const any = frames.some((f) => f[lane].some((c) => c !== null && c.note !== undefined && c.note >= 0))
    if (any) out.push(lane)
  }
  return out
}

/** The channel PREFIX this song declares. Floored at the 2A03's five, because that is
 *  what a document has always been; reaching a VRC6 lane pulls every lane before it in,
 *  empty pattern and all (`CANONICAL_CHANNELS` is a prefix, not a set). */
export function channelPrefix(frames) {
  let last = 4
  for (let lane = 7; lane > 4; lane--) {
    if (frames.some((f) => f[lane].some((c) => c !== null))) {
      last = lane
      break
    }
  }
  return CHANNELS.slice(0, last + 1)
}

export { MACRO_KINDS }
