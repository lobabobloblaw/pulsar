/** Cathedral of Gears — eight lanes folded onto four (tools/songs/octet/README.md).
 *
 *  OCTET's arrangement: VRC6 pulse 1 = melody (and pad tones in the intro, B section and
 *  coda), VRC6 pulse 2 = wide-duty inner-harmony chords / pads, saw = bass throughout
 *  (a lead in the B section's middle), triangle = doubling the saw an octave up, 2A03
 *  pulse 1 = counter-melody (A sections) or `0xy` arpeggio chords (B section), 2A03
 *  pulse 2 = a three-row echo of whichever line leads, noise = drums. Speed 6 at tempo
 *  150: a row is a sixteenth, sixteen rows a bar, four bars a pattern, 88 bars.
 *
 *  The fold (priority melody > bass > drums > harmony > counter-melody > echo):
 *
 *    pulse 1   <- VRC6 pulse 1 verbatim (melody, pad tones), except bars 48–53 where the
 *                 saw's solo takes the lane (melody beats a held pad tone).
 *    triangle  <- the saw at the saw's own octave: gallop bass, B-section pedal + running
 *                 line, intro/coda pad roots. Bars 48–53 keep OCTET's own triangle, which
 *                 already carries the gallop under the saw solo. The old triangle
 *                 doubling is dropped everywhere else (doubling is last in priority).
 *    pulse 2   <- the 2A03 pulse-1 counter-melody and its B-section arpeggio chords
 *                 (verbatim), plus the VRC6 pulse-2 harmony wherever the counter-melody
 *                 RESTS: inside the A sections those hits become `0xy` triads spelled
 *                 from the harmony's two alternating tones and the saw's root; in the
 *                 intro and coda, where there is no counter-melody, the pad/harmony
 *                 tones pass through as they are.
 *    noise     <- verbatim (kit, and the coda's Fxx ritardando parked there by OCTET).
 *    dropped   -> the three-row echo lane (echo is the first thing to go), the VRC6
 *                 pulse-2 pads under the B section (the `0xy` chords already spell that
 *                 harmony), the harmony hits that fall on sounding counter-melody notes.
 *
 *  Timbre: VRC6 duties (0–7) go through the port's table, so the lead settles on 25 %
 *  (bright), the 50 % pad stays 50 %, the harmony alternates 25/50 %. The saw solo on
 *  pulse 1 gets 25 %. Saw slides moved to the triangle are scaled by 14/32, the ratio of
 *  the two period tables, so a bar-end slide still lands in the same number of ticks.
 */
import { LANE, OFF, cellFx, vrc6DutyTo2a03, withFx } from './convert.mjs'
import { copyCell, ensureLoopEntry, fold, hasNote, parkGlobalFx, timeline, writeTimeline } from './fold.mjs'

export const id = 'cathedral-of-gears'
export const name = 'Cathedral of Gears'
export const author = 'OCTET demo, rebuilt for pulsar'
export const rowHighlight = 4 // a row is a sixteenth: four to the beat
export const rowHighlight2 = 16 // sixteen to the bar

const BAR = 16
const I = { PAD50: 0, PAD25: 1, LEAD: 2, HARMONY: 3, COUNTER: 4, ECHO: 5, ARP: 6, SAWBASS: 7, SAWLEAD: 8, TRIBASS: 9, TRIPLUCK: 10, SAWPAD: 16 }
/** Bars (absolute) of the saw solo, where OCTET's triangle already plays the gallop. */
const SOLO = [48 * BAR, 54 * BAR]
/** Bars of the two A sections whose counter-melody has half-bar rests to fill. */
const A_SECTIONS = [[8 * BAR, 24 * BAR], [24 * BAR, 40 * BAR], [56 * BAR, 72 * BAR]]

/** `[2,2,2,…]` → `[2]`: a constant macro after the duty mapping collapses. */
function collapse(macro) {
  const same = macro.values.every((v) => v === macro.values[0])
  return same && macro.values.length > 0 ? { values: [macro.values[0]], loop: -1, release: -1 } : macro
}

/** A saw period step re-expressed for the triangle's period table (14/32 of the saw's). */
function scaleSlide([cmd, param]) {
  if (cmd === 'Q' || cmd === 'R') {
    const x = (param >> 4) & 15
    const step = (2 * x + 1) * (14 / 32)
    return [cmd, (Math.max(1, Math.round((step - 1) / 2)) << 4) | (param & 15)]
  }
  if (cmd === '1' || cmd === '2' || (cmd === '3' && param !== 0)) return [cmd, Math.max(1, Math.round(param * (14 / 32)))]
  return [cmd, param]
}

export function reduce(doc) {
  const original = JSON.parse(JSON.stringify(doc))
  const length = doc.order.length * doc.rowsPerPattern

  // --- instruments: VRC6 duties onto the 2A03, the saw solo voiced for a pulse ---------
  for (const i of [I.PAD50, I.PAD25, I.LEAD, I.HARMONY]) {
    doc.instruments[i].duty = collapse({ ...doc.instruments[i].duty, values: vrc6DutyTo2a03(doc.instruments[i].duty.values) })
  }
  doc.instruments[I.SAWLEAD].duty = { values: [1], loop: -1, release: -1 }

  const v1 = timeline(doc, LANE.V1).map(copyCell)
  const v2 = timeline(doc, LANE.V2).map(copyCell)
  const saw = timeline(doc, LANE.SAW).map(copyCell)
  const p1 = timeline(doc, LANE.P1).map(copyCell)
  const tri = timeline(doc, LANE.TRI).map(copyCell)

  // --- pulse 1: the melody lane, the saw solo taking over for its six bars -------------
  const solo = saw.map((cell, r) => (r >= SOLO[0] && r < SOLO[1] ? cell : null))
  const pulse1 = fold(length, [
    { name: 'saw solo', cells: solo, from: SOLO[0], to: SOLO[1] },
    { name: 'vrc6 pulse 1', cells: v1, to: SOLO[0] },
    { name: 'vrc6 pulse 1', cells: v1, from: SOLO[1] },
  ])
  // the pad tone that was sounding into bar 48 must not hang under the solo's rests
  writeTimeline(doc, LANE.P1, pulse1.cells)

  // --- triangle: the saw's bass at the saw's octave; OCTET's own gallop under the solo ---
  const triangle = saw.map((cell, r) => {
    if (r >= SOLO[0] && r < SOLO[1]) return tri[r]
    return cell ? withFx(cell, cellFx(cell).map(scaleSlide)) : null
  })
  // the saw's lead instrument never reaches the triangle; its bass rows keep their own
  writeTimeline(doc, LANE.TRI, triangle)

  // --- pulse 2: counter-melody first; harmony only where the counter-melody rests -------
  // A rest runs from an OFF to the next note (the B-section arpeggio chords sustain, so
  // the VRC6 pads under them never qualify — the chords already spell that harmony).
  const sounding = new Array(length).fill(false)
  let on = false
  for (let r = 0; r < length; r++) {
    if (hasNote(p1[r])) on = p1[r][0] >= 0
    sounding[r] = on
  }
  const inA = (r) => A_SECTIONS.some(([a, b]) => r >= a && r < b)
  const harmony = v2.map((cell, r) => {
    if (!cell || sounding[r]) return null
    if (!hasNote(cell) || cell[0] < 0 || !inA(r)) return copyCell(cell)
    // A struck harmony tone inside an A-section rest becomes a `0xy` triad: base = this
    // tone, the offsets reach the tone it alternates with and the saw's root for the bar.
    const base = cell[0]
    const barStart = r - (r % BAR)
    let other = null
    for (let k = r + 1; k < barStart + BAR && other === null; k++) {
      if (hasNote(v2[k]) && v2[k][0] >= 0 && v2[k][0] !== base) other = v2[k][0]
    }
    const rootCell = saw[barStart]
    const root = hasNote(rootCell) && rootCell[0] >= 0 ? rootCell[0] : null
    const ivs = new Set()
    if (other !== null) ivs.add((((other - base) % 12) + 12) % 12)
    if (root !== null) ivs.add((((root - base) % 12) + 12) % 12)
    ivs.delete(0)
    const sorted = [...ivs].sort((a, b) => a - b)
    if (sorted.length === 0) return copyCell(cell)
    const param = sorted.length === 1 ? sorted[0] : (sorted[0] << 4) | sorted[1]
    return withFx([base, cell[1], cell[2], null, null], [['0', param], ...cellFx(cell)])
  })
  // the counter's OFF that opens a rest gives way to the chord struck on that row
  const counter = p1.map((cell, r) => (cell && cell[0] === OFF && hasNote(harmony[r]) ? null : cell))
  const pulse2 = fold(length, [
    { name: 'counter-melody', cells: counter },
    { name: 'harmony', cells: harmony },
  ]).cells
  // `0xy` is sticky: the first plain note after a chord cancels it, as OCTET's own
  // cancelSticky pass did for the lines it wrote.
  let arpOn = false
  for (let r = 0; r < length; r++) {
    const cell = pulse2[r]
    if (!cell) continue
    const fx = cellFx(cell)
    const arp = fx.find(([cmd]) => cmd === '0')
    if (arp) arpOn = arp[1] !== 0
    else if (hasNote(cell) && cell[0] >= 0 && arpOn) {
      pulse2[r] = withFx(cell, [['0', 0], ...fx])
      arpOn = false
    }
  }
  writeTimeline(doc, LANE.P2, pulse2)

  // --- the lanes that no longer exist, and the bookkeeping the target needs -------------
  for (const lane of [LANE.V1, LANE.V2, LANE.SAW]) for (const p of doc.patterns) p.rows[lane].fill(null)
  parkGlobalFx(original, doc)
  ensureLoopEntry(doc, 2, { [LANE.P1]: 'cut', [LANE.P2]: 'cut', [LANE.TRI]: 'cut', [LANE.NOISE]: 'cut' })
  return doc
}

export const qa = {
  key: 'd-minor',
  accidentalFractionMax: 0.2,
  channels: ['pulse1', 'pulse2', 'triangle', 'noise'],
  effects: ['0', '3', '4', '7', 'A', 'B', 'F', 'Q', 'R'],
  bpmRange: [148, 152],
  durationSec: [135, 155],
  loopFrame: 2,
  percussionGap: 16,
  percussionCoverage: 0.75,
  form: [
    'intro', 'intro',
    'A', 'A', 'A', 'A',
    'A repeat', 'A repeat', 'A repeat', 'A repeat',
    'B', 'B', 'B', 'B',
    "A'", "A'", "A'", "A'",
    'coda', 'coda', 'coda', 'coda',
  ],
  notes:
    'Gothic action theme, 150 BPM, sixteen rows a bar. D minor with the harmonic-minor raised seventh (C#) at the cadences and a Phrygian bII chord in the theme; the A-prime section restates the theme a minor third up in F minor, and the coda pivots back through Eb, Bb and Gm, which is where the accidental allowance goes. Pulse 1 carries the lead (and the saw solo of the B section), the triangle the gallop bass at the sawtooth register, pulse 2 the counter-melody with the inner harmony as 0xy triads in its rests; the coda ritardando is Fxx on the noise lane. The drums stop where the piece stops them: the intro has two crashes and a snare roll, the coda thins the kit bar by bar and then holds chords under the ritardando, so 22% of the rows are drum-free (percussionCoverage 0.75, percussionGap 16 for the thinning bars).',
  renderChecksum: 4235929224,
}
