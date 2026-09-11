/** Tide Tables — the eight-voice piece, ported directly (tools/songs/octet/README.md).
 *
 *  OCTET's arrangement, carried over untouched. 5/4 at speed 8 (eight rows a beat, eighty
 *  rows = two bars per pattern, D Dorian, fifteen patterns): triangle = low drones joined
 *  by `3xx` glides; 2A03 pulse 1 = struck bell chords (fixed-mode arpeggio instruments),
 *  2A03 pulse 2 = their echo two beats later; VRC6 pulse 1 = "voice A", the upper of two
 *  slow counterpoint lines (duty 1, pad envelope with a release point, vibrato); VRC6
 *  pulse 2 = "voice B", the lower line at duty 0, each note on the beat the other voice
 *  leaves free; VRC6 saw = a soft pad at volume 3 gliding between chord tones with `3xx`,
 *  swells and tremolo; noise = wind and surf. Nothing is re-voiced.
 *
 *  TWO corrections are made here, both the target driver's rather than the music's:
 *
 *  1. Self-ending noise. OCTET's wind and surf envelopes loop forever; pulsar's presets
 *     require a noise envelope that ends on 0 (a looping one never releases the lane, and
 *     the gate reads the last value). Each becomes the same breath once, ending on 0, and
 *     is RE-STRUCK at its own length so the breathing continues unchanged — 15 rows for the
 *     wind, 26 for the surf, from the envelopes' own tick counts. The surf tick is a
 *     one-shot already and is left alone.
 *  2. Loop entry. The final `B00` returns to frame 0 and pulsar's presets state every lane
 *     explicitly on that row. The noise lane already strikes the wind there with its
 *     instrument and volume; the triangle's drone is held across the seam and is restated;
 *     the bells, their echoes and the three VRC6 voices are silent across the seam (the
 *     voices and the pad release in the penultimate pattern and the last pattern is one
 *     held note), so those five get a cut.
 *
 *  The engine differences shared by every song (the `Axy` nibble swap, the `7xy` tremolo
 *  re-expression, the `100` after a glide) are applied by `convert.mjs`, on the VRC6 lanes
 *  exactly as on the 2A03 pulses. Voice A, voice B and the pad all carry release points, so
 *  their `===` cells survive the port as releases.
 *
 *  The 2026-09-11 release folded this piece onto four 2A03 lanes because pulsar had no VRC6
 *  yet; docs/soundtrack.md records that arrangement and the commit that holds it.
 */
import {
  LANE,
  cellFx,
  ensureLoopEntry,
  expectLanes,
  hasNote,
  timeline,
  withFx,
  writeTimeline,
} from './convert.mjs'

export const id = 'tide-tables'
export const name = 'Tide Tables'
export const author = 'OCTET demo, rebuilt for pulsar'
export const rowHighlight = 8 // eight rows a beat
export const rowHighlight2 = 40 // one bar of 5/4

const I = { TRI: 0, WIND: 1, SURF: 2 }
const TICKS_PER_ROW = 8
/** The frame the final `Bxx` returns to: this piece has no intro to skip. */
const LOOP_FRAME = 0

/** A looping breathing envelope → the same breath once, ending on 0. */
function oneShot(macro) {
  return { values: [...macro.values, 0], loop: -1, release: -1 }
}

/** The last cell on a lane that leaves a note sounding, or null if the lane ends silent. */
function lastSounding(cells) {
  for (let r = cells.length - 1; r >= 0; r--) {
    if (!hasNote(cells[r])) continue
    return cells[r][0] >= 0 ? cells[r] : null
  }
  return null
}

export function reduce(doc) {
  const length = doc.order.length * doc.rowsPerPattern
  const inst = doc.instruments

  // --- 1. the breathing envelopes, once each, re-struck at their own length -------------
  inst[I.WIND].volume = oneShot(inst[I.WIND].volume)
  inst[I.SURF].volume = oneShot(inst[I.SURF].volume)
  const period = (i) => Math.floor(inst[i].volume.values.length / TICKS_PER_ROW)
  const noise = timeline(doc, LANE.NOISE)
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

  // --- 2. explicit state on every sounding lane at the loop row -------------------------
  const drone = lastSounding(timeline(doc, LANE.TRI))
  if (drone === null) throw new Error('the triangle drone that carries across the seam is missing')
  const written = ensureLoopEntry(doc, LOOP_FRAME, {
    [LANE.P1]: 'cut',
    [LANE.P2]: 'cut',
    [LANE.TRI]: [drone[0], drone[1], drone[2]],
    [LANE.NOISE]: 'cut',
    [LANE.V1]: 'cut',
    [LANE.V2]: 'cut',
    [LANE.SAW]: 'cut',
  })
  expectLanes('loop entry', written, [LANE.P1, LANE.P2, LANE.TRI, LANE.V1, LANE.V2, LANE.SAW])
  return doc
}

export const qa = {
  key: 'd-dorian',
  channels: ['pulse1', 'pulse2', 'triangle', 'noise', 'vrc6p1', 'vrc6p2', 'vrc6saw'],
  effects: ['1', '3', '4', '7', 'A', 'B', 'F', 'G', 'S'],
  bpmRange: [55, 58],
  durationSec: [150, 180],
  loopFrame: 0,
  percussionGap: 32,
  rmsRange: [-26, -21],
  form: [
    'low water', 'drift', 'pad rises', 'answer', 'bells', 'struck', 'counterpoint', 'open water',
    'slack water', 'flood', 'building', 'high water', 'running out', 'releasing', 'one note',
  ],
  notes:
    'Slow ambient piece in 5/4 at 56 BPM (speed 8, eighty rows = two bars a pattern), D Dorian over a Dm-G-Am-C cycle, eight voices. Triangle drones join by 3xx glide. Struck bell chords on fixed-mode arpeggio instruments ring on pulse 1 and are answered two beats later by quieter echoes on pulse 2. The two VRC6 pulses are slow counterpoint voices — voice A above at duty 1 (12.5%), voice B below at duty 0 (6.25%) — and no row carries both: each takes the beats the other leaves free. The VRC6 sawtooth is a soft pad held at volume 3, gliding between chord tones with 3xx under Axy swells and a 7xy tremolo. The noise lane is wind and surf, not drums: their breathing envelopes are one-shot swells re-struck every 15 and 26 rows, their own length, with a surf tick now and then, which is why percussionGap is at the cap. The tempo dips to 110 for the slack-water pattern and returns. It is the quiet piece of the set by design — drones, a soft pad and slow voices with long envelopes, no drum kit, and the low drones sit under the 90 Hz post-DAC high-pass — so the two-pass mix sits near -24 dBFS (rmsRange declared, nothing is normalised).',
  renderChecksum: 22227566,
}
