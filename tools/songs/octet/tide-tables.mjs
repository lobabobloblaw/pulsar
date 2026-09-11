/** Tide Tables — eight lanes folded onto four (tools/songs/octet/README.md).
 *
 *  OCTET's arrangement, 5/4 at speed 8 (eight rows a beat, eighty rows = two bars per
 *  pattern, D Dorian, fifteen patterns): triangle = low drones joined by `3xx` glides;
 *  2A03 pulse 1 = struck bell chords (fixed-mode arpeggio instruments), 2A03 pulse 2 =
 *  their echo two beats later; VRC6 pulse 1 = "voice A", the upper of two slow
 *  counterpoint lines (pad envelope, vibrato); VRC6 pulse 2 = "voice B", the lower line,
 *  each note on the beat the other voice leaves free; saw = a soft pad gliding between
 *  chord tones with swells and tremolo; noise = wind and surf on breathing envelopes.
 *  Lanes are sparse (twenty to forty events each), so they fold BY TIME.
 *
 *    triangle  <- verbatim: drones and glides.
 *    pulse 1   <- voice A (the melody, highest priority) and the bell strikes. A strike
 *                 that lands on a voice-A note moves to pulse 2 instead of being lost.
 *    pulse 2   <- those displaced strikes, voice B, the bell echoes, and the pad.
 *                 Priority in that order: chord > counter-line > echo > pad. The pad is
 *                 a background: it is struck where it can be, and RE-ENTERS on its
 *                 current chord tone as soon as a struck sound above it has died (a
 *                 strike dies in eight rows, an echo in eleven; a held voice-B note or a
 *                 ringing bell keeps the lane until it is released).
 *    noise     <- wind and surf, whose OCTET envelopes loop forever, become one-shot
 *                 swells of the same shape re-struck at their own length (16 and 26
 *                 rows), so the breathing continues and every envelope ends on 0 as the
 *                 presets require. The surf tick is one-shot already.
 *    dropped   -> echoes that coincide with a strike or a voice note; the pad while a
 *                 voice-B note or a ringing bell holds pulse 2.
 *
 *  Timbre: voice A keeps VRC6 duty 1 (25 %), voice B duty 0 (12.5 %); the pad gets 50 %
 *  with its own slow envelope and its volume column doubled (3 → 6), because the saw's
 *  weight does not survive the move to a pulse at 3/15.
 */
import { LANE, OFF, REL, cellFx, withFx } from './convert.mjs'
import { copyCell, ensureLoopEntry, fold, hasNote, parkGlobalFx, sustainRows, timeline, writeTimeline } from './fold.mjs'

export const id = 'tide-tables'
export const name = 'Tide Tables'
export const author = 'OCTET demo, rebuilt for pulsar'
export const rowHighlight = 8 // eight rows a beat
export const rowHighlight2 = 40 // one bar of 5/4

const I = { TRI: 0, WIND: 1, SURF: 2, TICK: 3, PAD: 4, VOICE_A: 21, VOICE_B: 22 }
const TICKS_PER_ROW = 8
/** Rows a released pad-envelope voice takes to fade (34-tick tail). */
const RELEASE_ROWS = 5

/** A looping breathing envelope → the same breath once, ending on 0. */
function oneShot(macro) {
  return { values: [...macro.values, 0], loop: -1, release: -1 }
}

export function reduce(doc) {
  const original = JSON.parse(JSON.stringify(doc))
  const length = doc.order.length * doc.rowsPerPattern
  const inst = doc.instruments

  // --- instruments -----------------------------------------------------------------------
  inst[I.WIND].volume = oneShot(inst[I.WIND].volume)
  inst[I.SURF].volume = oneShot(inst[I.SURF].volume)
  inst[I.PAD].duty = { values: [2], loop: -1, release: -1 }
  // voice A/B duties 1 and 0 are already 2A03 values under the port's table

  const tri = timeline(doc, LANE.TRI).map(copyCell)
  const strikes = timeline(doc, LANE.P1).map(copyCell)
  const echoes = timeline(doc, LANE.P2).map(copyCell)
  const voiceA = timeline(doc, LANE.V1).map(copyCell)
  const voiceB = timeline(doc, LANE.V2).map(copyCell)
  const pad = timeline(doc, LANE.SAW).map((cell) => {
    if (!cell) return null
    const out = copyCell(cell)
    if (out[2] !== null) out[2] = Math.min(15, out[2] * 2)
    return out
  })
  const noise = timeline(doc, LANE.NOISE).map(copyCell)

  // --- noise: re-strike the breathing envelopes at their own length ---------------------
  const period = (i) => Math.floor(inst[i].volume.values.length / TICKS_PER_ROW)
  let current = null
  for (let r = 0; r < length; r++) {
    const cell = noise[r]
    if (hasNote(cell)) {
      current = cell[0] >= 0 && (cell[1] === I.WIND || cell[1] === I.SURF) ? { row: r, cell } : null
      continue
    }
    if (current && (r - current.row) % period(current.cell[1]) === 0) {
      const again = [current.cell[0], current.cell[1], current.cell[2], null, null]
      noise[r] = withFx(again, cellFx(cell))
    }
  }
  writeTimeline(doc, LANE.NOISE, noise)

  // --- pulse 1: voice A over the bell strikes; strikes it displaces go to pulse 2 -------
  const pulse1 = fold(length, [
    { name: 'voice A', cells: voiceA },
    { name: 'strikes', cells: strikes },
  ])
  const displaced = new Array(length).fill(null)
  for (const d of pulse1.displaced) if (d.layer === 'strikes') displaced[d.row] = copyCell(d.cell)
  writeTimeline(doc, LANE.P1, pulse1.cells)

  // --- pulse 2: displaced strikes > voice B > echoes > pad -------------------------------
  const pulse2 = fold(length, [
    { name: 'strikes', cells: displaced },
    { name: 'voice B', cells: voiceB },
    { name: 'echoes', cells: echoes },
    { name: 'pad', cells: pad },
  ]).cells

  // The pad's own timeline, for re-entries: which chord tone it holds at each row.
  const padTone = new Array(length).fill(null)
  let tone = null
  for (let r = 0; r < length; r++) {
    const cell = pad[r]
    if (hasNote(cell)) tone = cell[0] >= 0 ? { note: cell[0], vol: cell[2] ?? tone?.vol ?? 6 } : null
    else if (cell && cell[2] !== null && tone) tone = { ...tone, vol: cell[2] }
    padTone[r] = tone
  }
  // Re-enter the pad when whatever displaced it has died: struck sounds by their
  // envelope, held voice notes and ringing bells only after a release.
  let busyUntil = -1
  let owner = null
  for (let r = 0; r < length; r++) {
    const cell = pulse2[r]
    if (hasNote(cell)) {
      if (cell[0] === OFF) busyUntil = r
      else if (cell[0] === REL) busyUntil = r + RELEASE_ROWS
      else {
        owner = cell[1] ?? owner
        busyUntil = owner === I.PAD ? -1 : r + sustainRows(inst[owner], TICKS_PER_ROW)
      }
      continue
    }
    if (owner !== I.PAD && busyUntil >= 0 && r >= busyUntil && padTone[r] && !cell) {
      pulse2[r] = [padTone[r].note, I.PAD, padTone[r].vol, null, null]
      owner = I.PAD
      busyUntil = -1
    }
  }
  // A pad glide (`3xx`) only makes sense from the pad's own previous note; after a bell
  // or a voice it would glide from that sound's pitch, so it becomes a plain strike.
  let last = null
  for (let r = 0; r < length; r++) {
    const cell = pulse2[r]
    if (!hasNote(cell) || cell[0] < 0) continue
    const fx = cellFx(cell)
    if (cell[1] === I.PAD && last !== I.PAD && fx.some(([cmd]) => cmd === '3')) {
      pulse2[r] = withFx(cell, fx.filter(([cmd]) => cmd !== '3'))
    }
    last = cell[1] ?? last
  }
  writeTimeline(doc, LANE.P2, pulse2)

  // --- the lanes that no longer exist, and the bookkeeping the target needs -------------
  for (const lane of [LANE.V1, LANE.V2, LANE.SAW]) for (const p of doc.patterns) p.rows[lane].fill(null)
  parkGlobalFx(original, doc)
  // The final drone (D-1, held through the seam) is restated on the loop row so every
  // lane declares itself; the pulses were silent across the seam and get a cut.
  ensureLoopEntry(doc, 0, { [LANE.P1]: 'cut', [LANE.P2]: 'cut', [LANE.TRI]: [tri[length - doc.rowsPerPattern][0], I.TRI, 15], [LANE.NOISE]: 'cut' })
  return doc
}

export const qa = {
  key: 'd-dorian',
  channels: ['pulse1', 'pulse2', 'triangle', 'noise'],
  effects: ['3', '4', '7', 'A', 'B', 'F', 'G', 'S'],
  bpmRange: [55, 58],
  durationSec: [150, 180],
  loopFrame: 0,
  percussionGap: 32,
  rmsRange: [-27, -20],
  form: [
    'low water', 'drift', 'pad rises', 'answer', 'bells', 'struck', 'counterpoint', 'open water',
    'slack water', 'flood', 'building', 'high water', 'running out', 'releasing', 'one note',
  ],
  notes:
    'Slow ambient piece in 5/4 at 56 BPM (speed 8, eighty rows = two bars a pattern), D Dorian over a Dm-G-Am-C cycle. Triangle drones glide with 3xx; struck bell chords are fixed-mode arpeggio instruments answered by quieter echoes; two slow voices trade beats. The noise lane is wind and surf, not drums: breathing swells re-struck every 16 and 26 rows (their own length) with a surf tick now and then, which is why percussionGap is at the cap. The tempo dips to 110 for the slack-water pattern and returns. It is the quiet piece of the set by design: drones, a soft pad and slow voices with long envelopes, no drum kit, so the two-pass mix sits near -25 dBFS (rmsRange declared, nothing is normalised).',
  renderChecksum: 189548977,
}
