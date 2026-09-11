/** Skyline Run — the 2A03-only piece, ported directly (tools/songs/octet/README.md).
 *
 *  Nothing is re-voiced: pulse 1 keeps the hook, pulse 2 its two-row echo, the diatonic
 *  thirds and the `0xy` chord stabs, the triangle its bass and phrase-start thump, the
 *  noise its kit, and the DMC lane the two synthesized samples byte for byte. Two things
 *  the target driver needs are added here, and only here:
 *
 *  1. Loop entry. The final Bxx returns to frame 2 (the first A frame, skipping the intro);
 *     pulsar's presets state every lane explicitly on that row. Pulse 2 carries an
 *     effect-only cell there (the echo of the previous bar's last note lands two rows
 *     later), so it gets a cut; the DMC cell gets a volume it ignores.
 *  2. DPCM restarts. OCTET toggles $4015 to restart a sample that is still playing; pulsar
 *     keeps the old one. Where a hit follows within the previous sample's length (the
 *     kick two rows before a snare, the two snares of a fill), the row before the new hit
 *     carries an `Sxx` cut on its last tick so the new sample can start.
 */
import { LANE, OFF, cellFx, withFx } from './convert.mjs'

export const id = 'skyline-run'
export const name = 'Skyline Run'
export const author = 'OCTET demo, rebuilt for pulsar'
export const rowHighlight = 8 // speed 3: a row is a 32nd note, eight rows to the beat
export const rowHighlight2 = 32 // two bars per pattern
export const dpcmDelta = 64 // both samples start and end at level 64, as OCTET's $4011 preload

/** Ticks a one-shot sample plays: 8 bits per byte at the $4010 rate (rate 15 = 54 cycles). */
const DMC_RATE_CYCLES = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54]
function sampleTicks(bytes, rate) {
  return (bytes * 8 * DMC_RATE_CYCLES[rate]) / 29780.5
}

export function reduce(doc) {
  const rows = doc.rowsPerPattern
  const lengths = doc.dpcm.map((s) => Buffer.from(s.data, 'base64').length)

  // 2. gate a DMC hit whose successor arrives before the sample ends. `Sxx` only fires
  //    inside its own row (xx < ticks per row), so the cut goes on the row BEFORE the
  //    next hit as an effect-only cell, at that row's last tick: the sample plays until
  //    one tick before it is replaced, the closest the driver comes to OCTET's restart.
  const speedAt = [] // ticks per row, per absolute row, following Fxx across the order
  let speed = doc.speed
  for (const p of doc.order) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 8; c++) {
        for (const [cmd, param] of cellFx(doc.patterns[p].rows[c][r])) if (cmd === 'F' && param < 0x20) speed = param
      }
      speedAt.push(speed)
    }
  }
  const hits = [] // [absolute row, frame, row, cell]
  doc.order.forEach((p, f) => {
    doc.patterns[p].rows[LANE.DMC].forEach((cell, r) => {
      if (cell && cell[0] !== null && cell[0] >= 0) hits.push([f * rows + r, f, r, cell])
    })
  })
  // The loop seam is a pair too: the final Bxx returns to frame 2, whose first row
  // carries a kick, and the last frame ends on a fill snare two rows earlier.
  const loopFrame = cellFx(doc.patterns[doc.order.at(-1)].rows[LANE.P2][rows - 1]).find(([cmd]) => cmd === 'B')?.[1] ?? 0
  const first = hits.find(([, f]) => f === loopFrame)
  if (first) hits.push([doc.order.length * rows + first[2], -1, first[2], first[3]])
  for (let i = 0; i + 1 < hits.length; i++) {
    const [row, , , cell] = hits[i]
    const [next] = hits[i + 1]
    let ticks = 0
    for (let r = row; r < next; r++) ticks += speedAt[r]
    if (ticks >= sampleTicks(lengths[cell[1] ?? 0], cell[0] & 15)) continue
    const gateRow = next - 1
    const lane = doc.patterns[doc.order[Math.floor(gateRow / rows)]].rows[LANE.DMC]
    const at = lane[gateRow % rows]
    if (at && at[0] !== null) continue // a hit sits there: nothing to gate
    lane[gateRow % rows] = withFx(at, [...cellFx(at), ['S', speedAt[gateRow] - 1]])
  }

  // 1. explicit state on every lane at the loop frame
  const loop = doc.patterns[doc.order[2]].rows
  const p2 = loop[LANE.P2][0]
  if (!p2 || p2[0] === null) loop[LANE.P2][0] = withFx([OFF, null, null, null, null], cellFx(p2))
  const dmc = loop[LANE.DMC][0]
  if (dmc && dmc[0] !== null && dmc[2] === null) loop[LANE.DMC][0] = [dmc[0], dmc[1], 15, dmc[3], dmc[4]]
  return doc
}

export const qa = {
  key: 'a-minor',
  accidentalFractionMax: 0.2,
  channels: ['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm'],
  effects: ['0', '3', '4', 'B', 'F', 'Q', 'S'],
  bpmRange: [148, 152],
  durationSec: [120, 140],
  loopFrame: 2,
  form: [
    'intro', 'intro',
    'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A',
    'B', 'B', 'B', 'B', 'B', 'B', 'B', 'B',
    'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A2',
    'bridge', 'bridge', 'bridge', 'bridge', 'bridge', 'bridge', 'bridge', 'bridge',
    'A3', 'A3', 'A3', 'A3', 'A3', 'A3', 'A3', 'A3',
  ],
  notes:
    'Action-stage theme at 150 BPM on a 32nd-note grid (speed 3). A minor verse with an echo canon on pulse 2; the chorus is C major borrowing bVI, bVII and iv from the parallel minor, and the bridge modulates up a fourth to D minor with a half-time breakdown (F06/F03), which is where the chromatic allowance goes. Drum kit: noise hat/snare/kick/crash over synthesized DPCM kick and snare; the triangle doubles phrase starts with a pitch-dive thump.',
  renderChecksum: 1539583046,
}
