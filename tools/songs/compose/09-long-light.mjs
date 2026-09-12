#!/usr/bin/env node
/** 09 — Long Light. Altitude, distance, late afternoon: the album's unhurried bright one.
 *
 *      node tools/songs/compose/09-long-light.mjs  -> src/assets/songs/09-long-light.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), invented from the
 *  contour and harmony rules of §2.10 / §9.3. Nothing here quotes, transcribes or
 *  paraphrases any published work (§0.1).
 *
 *  Its discipline is SPACE. Every lead phrase ends in a rest of a beat or more; one whole
 *  section is two lanes; the densest bar in the piece is preceded by a bar in which the
 *  kit and the harmony both stop. A lead that never stops has no phrasing and gives the
 *  second voice nothing to answer.
 *
 *  GRID  tempo 150 · speed 9 = 100 BPM on 16th rows; rowHighlight 4 (a beat),
 *        rowHighlight2 16 (a bar), rowsPerPattern 64 (a frame = 4 bars = 9.6 s).
 *        Nine ticks a row is a slow grid: every attack is shaped by macro, not by column.
 *  KEY   F lydian — the album's first lydian and its first piece rooted on F. The raised
 *        fourth (B natural) is the colour and it is HEARD: the peak of the tune's last
 *        phrase is b5 over G major (the lydian II), and the bed spells that G with its
 *        own B. Colour beyond the mode: the chromatic mediant bVI... no — bIII, Ab major,
 *        with c4 held as the common tone (B section), and an Italian augmented sixth
 *        Db–F–B resolving outward to C, the dominant, one bar before the peak.
 *
 *  FORM (16 frames = 2:34 end to end; loop @ 1, so the looping body is 15 frames = 2:24)
 *  | frame | section | bars | what happens                                               |
 *  |-------|---------|------|------------------------------------------------------------|
 *  | 0     | horizon | 4    | TWO LANES: a sawtooth pedal on F swelling in, and the fast   |
 *  |       |         |      | `0xy` arpeggio bed that spells the harmony for the next      |
 *  |       |         |      | three frames. No kit, no lead, no bass.                      |
 *  | 1–2   | A       | 8    | the tune L on pulse 1 over F · G/F · Am · Dm · G · C · G · C→F|
 *  |       |         |      | the 5-row cell enters on vrc6p2 (1:0, 2:1); triangle bass;   |
 *  |       |         |      | the kit is rim and hats only                                 |
 *  | 3–4   | A'      | 8    | THE BED IS TAKEN AWAY at 3:0 — the removal is the event, and |
 *  |       |         |      | the ear keeps the harmony that is no longer being spelled.   |
 *  |       |         |      | L reharmonised (Dm · G/D · Em · Am · F · C/E · Dm G · C);    |
 *  |       |         |      | pulse 2 answers in the tune's rests; cell 3:2, 4:3           |
 *  | 5–6   | B       | 8    | the turn: two chords a bar (the piece's other harmonic       |
 *  |       |         |      | rhythm), the chromatic mediant Ab major against F with c4    |
 *  |       |         |      | held, and L re-orchestrated onto the sawtooth as a brass     |
 *  |       |         |      | statement with a bend-in. Pulse 2 is an INDEPENDENT LINE for |
 *  |       |         |      | the whole section (§9.2). Cell 5:4, then it RESTS for bars   |
 *  |       |         |      | 2–3 as the tune's phrase ends and the harmony falls to C;    |
 *  |       |         |      | back at 6:0                                                  |
 *  | 7     | air     | 4    | TWO LANES: pulse 1 and the triangle, alone. No kit at all,   |
 *  |       |         |      | no cell, no harmony — the widest silence in the piece        |
 *  | 8     | answer  | 4    | the two pulses trade phrases — free imitation a fourth below |
 *  |       |         |      | IN the lead's rests, never over it; the cell returns at 8:2  |
 *  |       |         |      | on the grid it kept counting through; rim only               |
 *  | 9–10  | build   | 8    | the descending-fifths sequence Am–Dm–G–C–F — four links that |
 *  |       |         |      | GO somewhere — then Dm · G; the kit and the DPCM pair arrive |
 *  |       |         |      | in stages. The last bar (10:48) is the METRIC SURPRISE: the  |
 *  |       |         |      | kit, the DPCM, vrc6p1 and the sawtooth all stop and the      |
 *  |       |         |      | 5-row cell plays on under an Italian augmented sixth that    |
 *  |       |         |      | resolves outward to C at 10:56. Cell 9:3, then it RESTS for  |
 *  |       |         |      | bars 1–3 as the kick and vrc6p1 enter; back at 10:4          |
 *  | 11–13 | light   | 12   | the peak: L in RHYTHMIC AUGMENTATION (every value doubled)   |
 *  |       |         |      | for eight bars, then the tune at speed for four; eight lanes;|
 *  |       |         |      | the sawtooth doubles the tune an octave down for the last    |
 *  |       |         |      | four bars; the global peak d6 at 13:40; cell 11:0 12:1 13:2  |
 *  | 14–15 | descent | 8    | the tune returns DISPLACED ONE ROW LATE (14:1, recipe F)     |
 *  |       |         |      | over a bass, a bell and a kit that stay on the grid, then    |
 *  |       |         |      | back on it for the last frame. The arrangement leaves in the |
 *  |       |         |      | order it arrived; the lydian                                 |
 *  |       |         |      | cadence G/F → F; the bed returns for the last two bars so    |
 *  |       |         |      | the seam hands straight back to A. Cell 14:3, 15:4, its last |
 *  |       |         |      | attack at 15:59 — four rows clear of the seam                |
 *
 *  MOTIFS
 *    L  the tune, 8 bars. Two two-bar phrases (a rise of a fourth c5–f5 held, answered a
 *       third lower), then the same pair sequenced a step up, the last of them reaching
 *       the section's one peak — b5, the raised fourth, on beat 3 of bar 6 over G major —
 *       and falling to the tonic. Every phrase but the last ends in two or three beats of
 *       air. Stated five times: 1:0 (pulse 1), 3:0 (reharmonised), 5:0 (sawtooth brass,
 *       an octave down), 11:0 (augmented ×2, the peak), 14:1 (displaced one row late).
 *    O  the 5-row cell: a three-note figure on vrc6p2 attacking every five rows, its
 *       pitch drawn from the bar's chord but its FIGURE advancing on its own count, so
 *       the same three notes never land on the same three beats twice. It rests three
 *       times in the middle third (5:32–5:63, frame 7, 9:16–9:63) and never re-anchors.
 *    TIMBRE  the tune changes duty between passes, which is the anti-monotony tool the
 *       master reference names first. Three voices carry it: `lead` (12.5 % opening to
 *       25 %) at 1:0, 9:0 and 11:0; `lead-round` (25 % opening to 50 %) at 3:0, so the
 *       second pass of the same eight bars is a warmer telling; `lead-open` (50 %
 *       throughout) at 7:0 and at the displaced close, 14:1.
 *    K  the answer: pulse 2's own four-note shape — step up, step up, fall a third —
 *       written only into the tune's rests (3:24, 3:52, 4:24, 4:60, 14:24, 14:52). B's
 *       independent line is a different animal: a continuous off-8th counter-voice.
 *
 *  DEVICES (frame:row)
 *    §9.1  recipe B, the 5-row cell. Its GRID is carried across every frame of the loop
 *          body; its ATTACKS rest three times in the middle third, so each return is
 *          heard as a return: B bars 2–3 (5:32–5:63), the two-lane frame 7, and build
 *          bars 1–3 (9:16–9:63). No rest re-anchors it: entry rows 1:0 2:1 3:2 4:3 5:4 |
 *          6:0 (7 rests) 8:2 9:3 10:4 | 11:0 12:1 13:2 14:3 15:4 — three complete cycles of
 *          five, computed as (−64k) mod 5 from the loop row, never guessed, and the returns
 *          after the rests are rows the grid already owned. 960 rows is 192 whole cells,
 *          so the cell's phase REPEATS exactly on pass 2 rather than evolving further —
 *          deliberate: three cycles of five inside one pass is the device stated in full,
 *          and a seam that arrives mid-cell would cost more than the fourth cycle is
 *          worth. Recipe F as well: the tune's
 *          last statement is displaced +1 row at 14:1 against a bass, a bell and a kit
 *          that do not move. The metric surprise is 10:48: for one whole bar the kit, the
 *          DPCM pair, vrc6p1 and the sawtooth all stop, and the only things left are the
 *          five-row cell and the three voices spelling the augmented sixth — nine
 *          attacks (the sixth struck at 48 and resolved at 56, three strokes of the cell)
 *          where the bar before it had thirty-one.
 *    §9.2  pulse 2 is an independent line for the whole of B (5:0–6:63): its own rhythm
 *          — every attack on an off-8th, never a row the sawtooth attacks — its own
 *          contour, and three leaning suspensions at 5:6, 6:6 and 6:22, each held across
 *          a chord change and resolved down a semitone two rows later.
 *    §9.3  chromatic mediant bIII at 5:8: the bass rises f2 → ab2, vrc6p1 restrikes c4
 *          WITHOUT MOVING (the common tone), and pulse 2's suspended a4 resolves down a
 *          semitone to ab4 at 5:10. Italian augmented sixth at 10:48 — db3 on the
 *          triangle, f4 on pulse 2, b5 on pulse 1 — whose outer voices resolve OUTWARD
 *          to c3 and c6 at 10:56. A four-link descending-fifths sequence Am–Dm–G–C–F
 *          across 9:0–10:15. Three harmonic rhythms: one chord a bar (A and A'), two a
 *          bar (B), one per two bars (the augmented half of `light`).
 *    §9.4  the kit changes every section and is never a rock kit: rim and hats in A, an
 *          open hat on the "and" of 4 in A', a tom pulse in B, nothing in air, the full
 *          pair only from the build on. Three different fills, none at the seam.
 *
 *  ALLOCATION (every lane rests audibly somewhere)
 *    horizon  SAW pedal · V1 arpeggio bed                                     (2 lanes)
 *    A        P1 tune · TRI bass · V1 bed · V2 cell · NOISE rim+hats
 *    A'       P1 tune · P2 answers in the rests · TRI · V2 cell · NOISE       (no bed)
 *    B        SAW tune · P2 independent line · P1 rests · V1 held mediant · V2 cell
 *             (resting bars 2–3) · TRI · NOISE toms
 *    air      P1 · TRI                                                        (2 lanes)
 *    answer   P1 · P2 imitation in its rests · TRI · V2 cell · NOISE rim
 *    build    P1 · P2 · TRI · V1 · V2 cell (resting bars 1–3) · NOISE · DPCM
 *    light    all eight; SAW doubles the tune an octave down for bars 4–11 only
 *    descent  the reverse of the build; SAW out first, then DPCM, then P2
 *  HEADROOM  the sawtooth never above 12 and never sustained above 10; the VRC6 pair at
 *            6–10; the lead's 15 only at its two peaks. This is the album's open piece
 *            and it renders quiet — `rmsRange` is declared, not re-gained (§2.8).
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'long-light',
  name: 'Long Light',
  author: 'pulsar original',
  speed: 9,
  rowsPerPattern: 64,
  rowHighlight: 4,
  rowHighlight2: 16,
})

// =====================================================================================
// instruments — the piece-specific ones FIRST, so instrument 0 is this piece's own lead
// and not a shared-bank drum every album piece would share (soundtrack.test.ts pins the
// macro set of instrument 0 as unique across the album).
// =====================================================================================

/** The tune. A four-tick scoop from below that SUMS TO ZERO (pitch macros accumulate, so
 *  a scoop that does not sum to zero leaves the note flat forever), a 12.5 % front that
 *  opens to 25 % on the third tick, and a body one step under the column so the written
 *  volume is the attack and not the sustain. */
const LEAD = s.instrument('lead', {
  volume: { values: [11, 13, 14, 14, 13, 13, 12], loop: 6 },
  duty: { values: [0, 0, 1, 1], loop: 3 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** The exposed lead, for the two-lane section: 50 % from the first tick — round, hollow,
 *  no bite — and a slower swell. With one other voice in the mix it does not need to cut,
 *  and the duty change is what tells the ear this is the same singer in a bigger room. */
const LEAD_OPEN = s.instrument('lead-open', {
  volume: { values: [8, 10, 12, 13, 13, 12, 12], loop: 6 },
  duty: { values: [2, 2, 2, 1], loop: 3 },
  pitch: { values: [3, -1, -1, -1, 0] },
})
/** The tune's SECOND timbre, for its second pass (A'). The same envelope as LEAD, but
 *  the duty runs the other way — it starts at 25 % and OPENS to 50 % instead of starting
 *  thin and narrowing — so the restatement is a warmer, rounder telling of the same eight
 *  bars while the harmony underneath it changes. Duty modulation between repetitions is
 *  the anti-monotony tool the master reference names first (§2.3 move 1). */
const LEAD_ROUND = s.instrument('lead-round', {
  volume: { values: [11, 13, 14, 14, 13, 13, 12], loop: 6 },
  duty: { values: [1, 1, 2, 2], loop: 3 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** Pulse 2's voice: a round 50 % attack settling to 25 %, so the second singer is known
 *  by its front rather than by its level (§2.3 move 1). */
const VOICE = s.instrument('voice', {
  volume: { values: [9, 11, 12, 12, 11, 10], loop: 5 },
  duty: { values: [2, 1], loop: 1 },
})
/** The `0xy` arpeggio bed on vrc6p1: bright 25 %, a soft front and a level that holds, so
 *  three tones cycling every three ticks fuse into one chord (§2.4). */
const BED = s.instrument('bed', {
  volume: { values: [5, 7, 8, 8, 7], loop: 4 },
  duty: { values: [3], loop: 0 },
})
/** The sustained VRC6 harmony that replaces the bed: the chip's own attack, a duty
 *  narrowing 7 → 3 over five ticks, and a slow swell into the note. */
const PAD = s.instrument('pad', {
  volume: { values: [6, 8, 10, 11, 11], loop: 4 },
  duty: { values: [7, 6, 5, 4, 3], loop: 4 },
})
/** The 5-row cell's voice: a struck bell that ends itself in twelve ticks — about one and
 *  a third rows at speed 9, so each attack rings into the next but never blurs two. The
 *  duty opens bright and thins to 12.5 %, which is what makes it read as distance. */
const BELL = s.instrument('bell', {
  volume: { values: [12, 13, 11, 9, 8, 7, 6, 5, 4, 3, 2, 0] },
  duty: { values: [3, 3, 2, 1], loop: 3 },
})
/** The sawtooth as a slow pedal: a five-tick swell, so the note arrives rather than
 *  starts. Sustained saw is capped at 10 in the column (§12.2 — 15 on the saw is roughly
 *  twice a pulse at 15). */
const SAW_PAD = s.instrument('saw-pad', {
  volume: { values: [4, 7, 10, 13, 15], loop: 4 },
})
/** The sawtooth as a brass lead: a stepped bend-in, on pitch by tick 6, zero-sum. */
const SAW_BRASS = s.instrument('saw-brass', {
  volume: { values: [8, 11, 13, 15, 15, 14, 14], loop: 6 },
  pitch: { values: [5, -1, -1, -1, -1, -1, 0] },
})
/** A brushed ghost on the noise lane — quieter and shorter than the bank's snare, and it
 *  ends on 0 with no loop, or the lane would never release (§1). */
const BRUSH = s.instrument('brush', {
  volume: { values: [6, 4, 3, 2, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 45,
})
/** The fill riser: the noise PITCH macro walks the period index down, which is upward in
 *  pitch, and holds (a drum sweep is an accumulating macro that ends held, not summed). */
const RISER = s.instrument('riser', {
  volume: { values: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 41,
})

// Shared bank, by name, byte-identical to the fixture (§3.1). The kit is the thing worth
// sharing across an album; this piece uses the quiet end of it.
const [KICK, SNARE, TOM, HAT, OHAT, CRASH, RIM, TRI_LONG, TRI_SHORT] =
  s.bank('kick', 'snare', 'tom', 'hat-closed', 'hat-open', 'crash', 'rim', 'bass', 'bass-short')
const KIT = s.dpcmKit() // kick 36, snare 39 on the dpcm lane

// =====================================================================================
// helpers — a phrase is durations and pitches, so the tune reads as a tune
// =====================================================================================
const VIB = nib(4, 2) // 4xy — the album's medium singing vibrato, always written LATE
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i)

/** A melodic phrase as consecutive `[rows, note, vol?, fx?]` events from `startRow`.
 *  `'-'` is a rest (a cut), `'~'` extends the previous note by more rows. Notes at least
 *  `vibMin` rows long get a `4xy` written `vibAfter` rows in — delayed vibrato, the thing
 *  that makes a held square sing (§2.5) — and the next event carries the `400` that
 *  cancels it, because `4xy` is a channel mode that outlives its note (§12.5).
 *  `stretch` multiplies every duration: rhythmic augmentation for the price of a flag. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const {
    vib = 0, vibMin = 8, vibAfter = 6, transpose = 0, stretch = 1,
    vol: defaultVol = 12, fixedVol, volShift = 0, volMax = 15, cutAtEnd = true,
  } = opts
  let row = startRow
  let pending = false
  const cancel = () => (pending ? [['4', 0]] : [])
  const level = (v) => fixedVol ?? Math.max(1, Math.min(volMax, (v ?? defaultVol) + volShift))
  for (const [rawLen, note, vol, fx] of events) {
    const len = rawLen * stretch
    if (note === '~') {
      row += len
      continue
    }
    if (row >= sec.len) break
    if (note === '-') {
      sec.put(lane, row, { note: CUT, ...(pending ? { fx: cancel() } : {}) })
      pending = false
      row += len
      continue
    }
    const list = [...cancel(), ...(fx ? [fx] : [])]
    sec.put(lane, row, {
      note: n(note) + transpose, inst, vol: level(vol), ...(list.length ? { fx: list } : {}),
    })
    pending = false
    if (vib && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
      pending = true
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    sec.put(lane, row, { note: CUT, ...(pending ? { fx: cancel() } : {}) })
    pending = false
  }
  if (pending) sec.put(lane, Math.min(row, sec.len) - 1, { fx: [['4', 0]] })
  return row
}

/** The triangle bass: `[bar, row, note]` triples, gated at 15 because the triangle has no
 *  level at all (§1) — its dynamics are register and rest, never volume. */
function bass(sec, events, inst, opts = {}) {
  const { transpose = 0 } = opts
  for (const [bar, row, note] of events) {
    sec.put(L.TRI, sec.at(bar, row), { note: note === '-' ? CUT : n(note) + transpose, inst, vol: 15 })
  }
}

/** The `0xy` arpeggio bed on vrc6p1: `[bar, row, root, x, y]`, one cell per strike. `0xy`
 *  is a channel MODE, so the section that starts it cancels it — the library seals the
 *  last one on the section's final row and `line()` cancels on the next bare event. */
function bedStrikes(sec, strikes, vol = 8) {
  for (const [bar, row, root, x, y] of strikes) {
    sec.put(L.V1, sec.at(bar, row), { note: n(root), inst: BED, vol, fx: [['0', nib(x, y)]] })
  }
}

/** Sustained VRC6 notes: `[bar, row, v1, v2]`, `null` to leave a lane holding. */
function held(sec, chords, vol = 9, inst = PAD) {
  for (const [bar, row, v1, v2] of chords) {
    if (v1 !== null && v1 !== undefined) sec.put(L.V1, sec.at(bar, row), { note: n(v1), inst, vol })
    if (v2 !== null && v2 !== undefined) sec.put(L.V2, sec.at(bar, row), { note: n(v2), inst, vol })
  }
}

// =====================================================================================
// O — the 5-row cell (§9.1 recipe B), the spine of the piece
// =====================================================================================
/** Chord tone triples for the cell, in its own register (e4–d5, MIDI 64–74). Each triple
 *  is a SHAPE — high, low, high — not a chord spelling: the figure's third note is always
 *  the top one, so the ear hears one bell figure walking through the harmony. */
const CELL_TONES = {
  F: ['a4', 'f4', 'c5'],
  G: ['b4', 'g4', 'd5'],
  Am: ['a4', 'e4', 'c5'],
  Dm: ['a4', 'f4', 'd5'],
  C: ['g4', 'e4', 'c5'],
  Em: ['b4', 'e4', 'g4'],
  Ab: ['ab4', 'eb4', 'c5'], // the chromatic mediant: c5 is the tone it shares with F
  // the Italian sixth spelled by the cell itself, db–f–b, in the one bar it sounds
  It6: ['f4', 'db4', 'b4'],
}

/** The figure's own counter. It is NOT reset at a bar, a frame or a section: that is the
 *  entire point. Three notes on a five-row cell against a sixteen-row bar means the same
 *  three pitches never land on the same three beats twice inside one pass. It advances
 *  once for every grid slot cellRun walks, struck or skipped (see `skip` below); `air`
 *  never calls cellRun, so the count stands still through frame 7. */
let cellStep = 0

/** Write the cell into `sec`, whose first order frame is `startFrame`.
 *
 *  The attack rows are `r ≡ (4 + startFrame) (mod 5)`, which is the phase-carry table of
 *  §9.1 solved rather than guessed: the cell is anchored at the LOOP ROW (frame 1 row 0),
 *  so frame k's entry row is `(−64·(k−1)) mod 5 = (k−1) mod 5`, and inside a section the
 *  same arithmetic reads `(4 + startFrame) mod 5` because 64 ≡ 4 (mod 5). The loop body
 *  is fifteen frames = 960 rows = 192 cells exactly, so the phase is continuous across
 *  the seam as well as across every frame boundary.
 *
 *  `chords` is one chord name per bar, or a function of the row. `skip` lists the
 *  SECTION's bars the cell sits out. A skipped bar withholds only the attacks: `r` keeps
 *  walking the same five-row grid, so nothing re-anchors, and the first attack after
 *  the rest is on the row the unbroken grid gives it (6:0 after B's, 10:4 after the
 *  build's).
 *
 *  `cellStep` keeps turning through a skipped bar too, one step per silent slot. That
 *  was chosen over "advance only on an attack" so that a rest is a pure subtraction:
 *  every attack after it plays the pitch it would have played had the bell never
 *  stopped, so a rest cannot re-voice everything that follows it, and the figure's
 *  three-against-five count stays locked to the grid. The two readings agree when the
 *  silent slots are a multiple of three (B's rest is six); the build's is ten, and
 *  this choice is why the bell comes back at 10:4 on an accented f4, the tonic, rather
 *  than on a4. `air` is a different kind of rest: it never calls cellRun, so there the
 *  grid counts on and the figure does not. */
function cellRun(sec, startFrame, chords, opts = {}) {
  const { vol = 8, accent = 2, skip = [], inst = BELL, until = sec.len } = opts
  const first = (4 + startFrame) % 5
  for (let r = first; r < until; r += 5) {
    const bar = Math.floor(r / sec.rowsPerBar)
    if (skip.includes(bar)) {
      cellStep++ // the figure keeps counting through a rest, so it returns where it would be
      continue
    }
    // `chords` is one name per bar, or a function of the row where a section changes
    // chord inside the bar (B and the build both do).
    const name = typeof chords === 'function' ? chords(r) : chords[bar]
    const tones = CELL_TONES[name]
    if (tones === undefined) throw new Error(`cellRun: no tones for chord ${name} at row ${r}`)
    // On the beat it is a little louder: that is what makes the drift audible, because
    // the accent walks around the bar with the cell instead of staying on beat 1.
    sec.put(L.V2, r, {
      note: n(tones[cellStep % 3]), inst, vol: r % 4 === 0 ? Math.min(15, vol + accent) : vol,
    })
    cellStep++
  }
}

// =====================================================================================
// the kit — light by brief: rim, hats and brushed ghosts more than a rock kit, and the
// pattern changes every section (§9.4). The 2A03 noise lane carries all of it until the
// build, where the DPCM pair arrives and the piece finally has weight.
// =====================================================================================
/** Hats on the given rows of `bar`, skipping any row the lane already uses. */
function hats(sec, bar, rows, opts = {}) {
  const { inst = HAT, on = 7, off = 5, note = 45 } = opts
  for (const r of rows) {
    const row = sec.at(bar, r)
    if (sec.lanes[L.NOISE][row] !== null) continue
    sec.put(L.NOISE, row, { note, inst, vol: r % 4 === 0 ? on : off })
  }
}
/** A rising roll on the snare: alternating rows, ascending volume. */
function roll(sec, bar, from, to, lo = 4, hi = 13) {
  for (let r = from; r < to; r++) {
    const v = Math.min(15, Math.round(lo + ((hi - lo) * (r - from)) / Math.max(1, to - from - 1)))
    sec.put(L.NOISE, sec.at(bar, r), { note: r >= to - 2 ? 41 : 39, inst: SNARE, vol: v })
  }
}
/** Clear a span of the noise lane so a fill can replace whatever the pattern put there. */
function clearKit(sec, bar, from, to) {
  for (const r of range(from, to)) sec.lanes[L.NOISE][sec.at(bar, r)] = null
}

// =====================================================================================
// L — the tune. Eight bars, four two-bar phrases, and air at the end of every one of
// them but the last. Phrase 1 rises a fourth (c5 → f5) and holds; phrase 2 answers a
// third lower and lands on the sixth; phrases 3 and 4 are the same pair sequenced a
// step up, and phrase 4 reaches the section's single peak — b5, the RAISED FOURTH, on
// beat 3 over G major — before falling to the tonic. 82 % of its intervals are a
// whole tone or smaller; each of its three leaps turns back stepwise the other way.
// =====================================================================================
const TUNE = [
  /* b0 */ [4, 'c5', 12], [4, 'd5', 12], [8, 'f5', 14],
  /* b1 */ [4, 'e5', 12], [4, 'd5', 11], [8, '-'],
  /* b2 */ [4, 'a4', 11], [4, 'c5', 12], [8, 'd5', 13],
  /* b3 */ [4, 'c5', 12], [12, '-'],
  /* b4 */ [4, 'd5', 12], [4, 'e5', 13], [8, 'g5', 14],
  /* b5 */ [4, 'f5', 13], [4, 'e5', 12], [8, '-'],
  /* b6 */ [4, 'e5', 13], [4, 'g5', 14], [8, 'b5', 15],
  /* b7 */ [8, 'e5', 13], [4, 'f5', 14], [4, '-'],
]
/** L′ — the same tune under different chords (A′), with its last two bars rewritten so
 *  the restatement is not literal: the peak moves off the raised fourth onto a5 and the
 *  phrase turns down instead of resolving, ending on a 4–3 appoggiatura over C. */
const TUNE_2 = [
  ...TUNE.slice(0, 16),
  /* b6 */ [4, 'e5', 13], [4, 'g5', 14], [4, 'a5', 15], [4, 'g5', 13],
  /* b7 */ [8, 'f5', 13], [4, 'e5', 12], [4, '-'],
]

// =====================================================================================
// horizon — frame 0: two lanes. The light before anything is in it.
// =====================================================================================
const horizon = s.section('horizon', 4)
{
  // SAW  a low F pedal that SWELLS IN rather than starting (the instrument's five-tick
  // volume ramp does it), restruck once a bar so the swell is heard four times, and cut
  // before A so the sawtooth is not in the mix when the tune arrives.
  for (const bar of range(0, 4)) {
    horizon.put(L.SAW, horizon.at(bar, 0), { note: n('f2'), inst: SAW_PAD, vol: bar < 2 ? 8 : 10 })
  }
  // `A10` from 3:4 fades the last pedal to nothing over eight rows — `Axy` is INVERTED
  // here (`Ax0` fades, `A0y` swells, §1) — and the cut carries the `A00` that cancels the
  // slide, because a volume slide is a channel mode that would otherwise outlive it.
  horizon.put(L.SAW, horizon.at(3, 4), { fx: [['A', nib(1, 0)]] })
  horizon.put(L.SAW, horizon.at(3, 12), { note: CUT, fx: [['A', 0]] })
  // V1  the `0xy` arpeggio bed: F · F · G · G, struck on beats 1 and 3, three tones on a
  // three-tick rotation so the ear fuses them into a chord (§2.4). The G is spelled with
  // its own B natural — the raised fourth is in the harmony from the eighth bar of the
  // piece, before the tune ever sings it.
  bedStrikes(horizon, [
    [0, 0, 'f3', 4, 7], [0, 8, 'f3', 4, 7],
    [1, 0, 'f3', 4, 7], [1, 8, 'f3', 4, 7],
    [2, 0, 'g3', 4, 7], [2, 8, 'g3', 4, 7],
    [3, 0, 'g3', 4, 7], [3, 8, 'g3', 4, 7],
  ], 7)
  // Nothing else. No kit, no bass, no lead: the first 9.6 s of the piece is two voices,
  // which is what makes the triangle's entrance at 1:0 an event rather than a default.
}

// =====================================================================================
// A — frames 1–2: the tune, over F · G/F · Am · Dm · G · C · G · C→F
// =====================================================================================
/** One chord per bar (the piece's home harmonic rhythm; B halves it and `light` doubles
 *  it). Bar 7 carries C on beats 1–2 and F on beats 3–4: the cadence. */
const A_CHORDS = ['F', 'G', 'Am', 'Dm', 'G', 'C', 'G', 'C']
/** The bass: root on beat 1, a second chord tone on beat 3, and a STEPWISE approach on
 *  beat 4 into the next bar's root — so every barline is crossed by a step, and the line
 *  is a line rather than a list of roots (§2.10, and the master reference's first demand
 *  after the hook). */
const A_BASS = [
  [0, 0, 'f2'], [0, 8, 'c3'], [0, 12, 'g2'],
  [1, 0, 'f2'], [1, 8, 'd3'], [1, 12, 'g2'],
  [2, 0, 'a2'], [2, 8, 'e3'], [2, 12, 'c3'],
  [3, 0, 'd3'], [3, 8, 'a2'], [3, 12, 'f2'],
  [4, 0, 'g2'], [4, 8, 'd3'], [4, 12, 'b2'],
  [5, 0, 'c3'], [5, 8, 'g2'], [5, 12, 'a2'],
  [6, 0, 'g2'], [6, 8, 'b2'], [6, 12, 'd3'],
  [7, 0, 'c3'], [7, 8, 'f2'], [7, 12, '-'],
]

const A = s.section('A', 8)
{
  // P1  the tune, with delayed vibrato on every note of a beat or longer: the 4xy is
  // written six rows after the attack, so the note starts straight and blooms (§2.5).
  phrase(A, L.P1, LEAD, 0, TUNE, { vib: VIB, vibMin: 8, vibAfter: 6 })
  // P2  silent for the whole section, and it says so on the loop row (§2.9 rule 2). The
  // second voice does not appear until A′, where the tune's rests have been established
  // as the place it will speak.
  A.put(L.P2, 0, { note: CUT })
  // TRI  the bass described above. The triangle has no level, so its dynamics are the
  // rests: it stops on the last beat of bar 7 with the lead, which is the section's
  // "two or more voices resting" bar (§2.8).
  bass(A, A_BASS, TRI_LONG)
  // V1  the bed continues from the intro — two strikes a bar, then three — and the
  // harmony it spells is the harmony the ear will have to supply for itself from 3:0.
  bedStrikes(A, A_CHORDS.flatMap((name, bar) => {
    const root = { F: ['f3', 4, 7], G: ['g3', 4, 7], Am: ['a3', 3, 7], Dm: ['f3', 4, 9], C: ['g3', 5, 9] }[name]
    // Two strikes a bar while the tune is low, three (0 · 6 · 12, a dotted push) from bar
    // 4 on: the bed leans forward under the half of the tune that climbs.
    return (bar < 4 ? [0, 8] : [0, 6, 12]).map((row) => [bar, row, ...root])
  }), 8)
  // V2  the 5-row cell enters here, on the loop row itself, and from here its grid runs
  // unbroken to 15:59. Its attacks rest three times on the way: B bars 2–3, the whole
  // of `air`, and build bars 1–3.
  cellRun(A, 1, A_CHORDS, { vol: 7 })
  // NOISE  rim on beats 2 and 4, hats on the off-8ths only, nothing on the downbeat
  // except in bar 0 — a brushed pulse, not a kit. No kick anywhere in this section.
  for (const bar of range(0, 8)) {
    A.hits(L.NOISE, RIM, bar % 2 ? 7 : 8, [[bar, 4], [bar, 12]])
    hats(A, bar, bar % 4 === 3 ? [2, 6, 10, 14] : [2, 10], { on: 6, off: 5 })
    if (bar % 4 === 1) A.hits(L.NOISE, BRUSH, 5, [[bar, 7]])
  }
  A.put(L.NOISE, 0, { note: 45, inst: HAT, vol: 6 }) // the loop row states this lane too
  // fill 1 (bar 7, last beat): two brushed ghosts and a rim, no snare — the lightest
  // fill in the piece, because everything after it is louder.
  clearKit(A, 7, 12, 16)
  A.hits(L.NOISE, BRUSH, 6, [[7, 12], [7, 14]])
  A.hits(L.NOISE, RIM, 8, [[7, 15]])
}

// =====================================================================================
// A' — frames 3–4: the bed is taken away, and pulse 2 takes the rests it leaves
// =====================================================================================
/** The same eight bars of tune under a different harmony: Dm for F, C/E for Am, and a
 *  half cadence on C instead of the plagal close. Reharmonisation is a true variation
 *  (§2.10) and it costs nothing on a chip — the lead does not move a note. */
const A2_CHORDS = ['Dm', 'G', 'C', 'Am', 'F', 'Dm', 'G', 'C']
const A2_BASS = [
  [0, 0, 'd3'], [0, 8, 'a2'], [0, 12, 'c3'],
  [1, 0, 'd3'], [1, 8, 'b2'], [1, 12, 'd3'],
  [2, 0, 'e3'], [2, 8, 'c3'], [2, 12, 'b2'],
  [3, 0, 'a2'], [3, 8, 'e3'], [3, 12, 'g2'],
  [4, 0, 'f2'], [4, 8, 'c3'], [4, 12, 'e3'],
  [5, 0, 'd3'], [5, 8, 'a2'], [5, 12, 'f2'],
  [6, 0, 'g2'], [6, 8, 'd3'], [6, 12, 'b2'],
  [7, 0, 'c3'], [7, 8, 'g2'], [7, 12, 'e2'],
]
/** K — pulse 2's answer: up a step, up a step, down a third. It is written only into the
 *  tune's rests, which is the whole argument for making the tune rest (§2.10). */
const A2_ANSWERS = [
  [1, 8, ['g4', 'a4', 'b4', 'g4'], 9],
  [3, 4, ['a4', 'b4', 'c5', 'a4'], 10],
  [5, 8, ['d4', 'e4', 'f4', 'd4'], 9],
  [7, 12, ['e4', 'g4'], 10],
]

const A2 = s.section("A'", 8)
{
  // P1  the tune again, note for note, so the ear hears the CHORDS change and nothing
  // else — until bars 6–7, which turn instead of resolving. On LEAD_ROUND, whose duty
  // opens 25 % → 50 % where the first pass narrowed 12.5 % → 25 %: the second telling is
  // the same notes in a different colour, which is what lets a tune bear a second pass.
  // One step down in the column: 50 %% duty is the loudest-sounding of the four (§2.3),
  // so the warmer voice is written a notch quieter to keep A' under the build.
  phrase(A2, L.P1, LEAD_ROUND, 0, TUNE_2, { vib: VIB, vibMin: 8, vibAfter: 6, volShift: -1 })
  // P2  the answer motif K, in the rests only: four attacks on the off-8ths of bar 1,
  // bar 3, bar 5 and a two-note tag in bar 7. Not one of them shares a row with the lead.
  for (const [bar, row, notes, vol] of A2_ANSWERS) {
    notes.forEach((note, i) => A2.put(L.P2, A2.at(bar, row + i * 2), { note: n(note), inst: VOICE, vol }))
  }
  // TRI  the bass, reharmonised with it.
  bass(A2, A2_BASS, TRI_LONG)
  // V1  SILENT. This is the piece's second device: the arpeggio bed that has spelled
  // every chord for three frames stops at 3:0 and never returns until the last two bars
  // of the piece. Nothing replaces it — the bass and the tune are left to imply the
  // harmony, and the removal is the event (§2.4: drop the arpeggio once it has done its
  // work and the listener fills in the blanks).
  // V2  the cell, through all eight bars of this section, entering this frame two rows in.
  cellRun(A2, 3, A2_CHORDS, { vol: 8 })
  // NOISE  the kit answers the bed's disappearance by arriving: a soft kick on beat 1,
  // the rim still on 2 and 4, and an OPEN HAT on the "and" of 4 — this section's
  // signature, and the first thing in the piece with a tail (§9.4).
  for (const bar of range(0, 8)) {
    A2.hits(L.NOISE, KICK, 10, [[bar, 0], ...(bar % 2 ? [[bar, 10]] : [])])
    A2.hits(L.NOISE, RIM, 8, [[bar, 4], [bar, 12]])
    A2.hits(L.NOISE, OHAT, 7, [[bar, 14]])
    hats(A2, bar, [2, 6, 10], { on: 6, off: 5 })
    if (bar % 4 === 2) A2.hits(L.NOISE, BRUSH, 5, [[bar, 7], [bar, 11]])
  }
  // fill 2 (bar 7, last half-bar): three toms falling, which is nothing like fill 1.
  clearKit(A2, 7, 8, 16)
  A2.hits(L.NOISE, TOM, 11, [[7, 8]], 43)
  A2.hits(L.NOISE, TOM, 11, [[7, 11]], 39)
  A2.hits(L.NOISE, TOM, 12, [[7, 14]], 37)
}

// =====================================================================================
// B — frames 5–6: the turn. Two chords a bar, the chromatic mediant, and the tune on
// the sawtooth. Pulse 1 is silent for the whole section: the lead is the sawtooth now.
// =====================================================================================
/** Half-bar harmony: F Ab | Ab G | G F | Dm C | F Ab | Ab G | Am G | G.
 *  Ab major is the chromatic mediant (bIII). Its voice leading is the point: a4 → ab4 by
 *  semitone in pulse 2, c4 STATIONARY in vrc6p1, f2 → ab2 in the bass. Then Ab → G moves
 *  every voice down by a step, which is how the piece gets back into the mode. */
const B_CHORD_AT = (row) => {
  const half = Math.floor(row / 8)
  return ['F', 'Ab', 'Ab', 'G', 'G', 'F', 'Dm', 'C', 'F', 'Ab', 'Ab', 'G', 'Am', 'G', 'G', 'G'][half]
}
/** L re-orchestrated: the same rhythm, bar for bar, an octave down on the sawtooth, with
 *  three pitches changed where the mediant demands them — eb4 for f5 over Ab (bar 0), b3
 *  for d5 over G (bar 1), and g4 held as a common tone from Abmaj7 into G (bars 4–5). */
const TUNE_BRASS = [
  /* b0 */ [4, 'c4', 9], [4, 'd4', 9], [8, 'eb4', 10],
  /* b1 */ [4, 'c4', 9], [4, 'b3', 9], [8, '-'],
  /* b2 */ [4, 'g3', 8], [4, 'b3', 9], [8, 'd4', 10],
  /* b3 */ [4, 'c4', 9], [12, '-'],
  /* b4 */ [4, 'd4', 9], [4, 'e4', 10], [8, 'g4', 11],
  /* b5 */ [4, 'g4', 10], [4, 'f4', 9], [8, '-'],
  /* b6 */ [4, 'e4', 9], [4, 'g4', 10], [8, 'b4', 11],
  /* b7 */ [8, 'g4', 10], [4, 'a4', 9], [4, '-'],
]
/** vrc6p1 — the inner voice that holds still. c4 over F is the fifth and over Ab the
 *  third, so it is restruck at the chord change WITHOUT MOVING: that is what makes a
 *  chromatic mediant glow rather than lurch. Over G it is a fourth, and it resolves down
 *  to b3 — a written 4–3. */
const B_INNER = [
  [0, 0, 'c4'], [0, 8, 'c4'], [1, 0, 'c4'], [1, 8, 'b3'],
  [2, 0, 'b3'], [2, 8, 'a3'], [3, 0, 'a3'], [3, 8, 'g3'],
  [4, 0, 'c4'], [4, 8, 'c4'], [5, 0, 'c4'], [5, 8, 'b3'],
  [6, 0, 'c4'], [6, 8, 'b3'], [7, 0, 'b3'],
]
/** pulse 2, the independent line (§9.2): four attacks a bar, every one of them on an
 *  off-8th, so it shares no attack row with the sawtooth's on-beat phrasing anywhere in
 *  the section. It carries both suspensions and the chromatic semitone. */
const B_LINE = [
  [0, 6, 'a4', 10], [0, 10, 'ab4', 11], [0, 14, 'c5', 10],
  [1, 2, 'eb5', 11], [1, 6, 'c5', 10], [1, 10, 'b4', 11], [1, 14, 'd5', 10],
  [2, 2, 'd5', 10], [2, 6, 'b4', 10], [2, 10, 'a4', 11], [2, 14, 'c5', 10],
  [3, 2, 'a4', 10], [3, 6, 'f4', 10], [3, 10, 'e4', 10], [3, 14, 'g4', 10],
  [4, 6, 'a4', 11], [4, 10, 'ab4', 12], [4, 14, 'c5', 11],
  [5, 2, 'eb5', 12], [5, 6, 'c5', 11], [5, 10, 'b4', 12], [5, 14, 'a4', 11],
  [6, 2, 'c5', 11], [6, 6, 'a4', 11], [6, 10, 'b4', 12], [6, 14, 'g4', 11],
  [7, 2, 'a4', 11], [7, 6, 'g4', 11], [7, 10, 'b4', 10],
]
const B_BASS = [
  [0, 0, 'f2'], [0, 8, 'ab2'],
  [1, 0, 'ab2'], [1, 8, 'g2'],
  [2, 0, 'g2'], [2, 8, 'f2'], [2, 12, 'c3'],
  [3, 0, 'd3'], [3, 8, 'c3'], [3, 12, 'g2'],
  [4, 0, 'f2'], [4, 8, 'ab2'],
  [5, 0, 'ab2'], [5, 8, 'g2'],
  [6, 0, 'a2'], [6, 8, 'g2'], [6, 12, 'f2'],
  [7, 0, 'g2'], [7, 8, 'b2'], [7, 12, '-'],
]

const B = s.section('B', 8)
{
  // SAW  the tune, an octave down, as a brass statement: the instrument's pitch macro
  // bends in over six ticks and settles, and the column stays at 11 so the sawtooth —
  // which is about twice a pulse at the same number — never becomes the loudest thing.
  phrase(B, L.SAW, SAW_BRASS, 0, TUNE_BRASS, { volMax: 11 })
  // P1  silent for the whole section. The lead being GONE is what makes the sawtooth a
  // re-orchestration rather than a doubling.
  B.put(L.P1, 0, { note: CUT })
  // P2  its own line, its own rhythm, for the whole section (§9.2). The a4 at 5:6 is
  // held across the chord change at 5:8 and resolves down a semitone to ab4 at 5:10 —
  // that suspension IS the chromatic mediant. The c5 at 6:22 does the same over the
  // cadential G at 6:24, resolving to b4: a written 4–3.
  for (const [bar, row, note, vol] of B_LINE) B.put(L.P2, B.at(bar, row), { note: n(note), inst: VOICE, vol: vol - 1 })
  // Each suspension leans: a delayed `441` two rows into the held note, cancelled by
  // `400` on the note it resolves to, so the tremble belongs to the dissonance alone.
  for (const [bar, row] of [[0, 6], [4, 6], [5, 6]]) {
    B.put(L.P2, B.at(bar, row + 2), { fx: [['4', nib(4, 1)]] })
    B.put(L.P2, B.at(bar, row + 4), { fx: [['4', 0]] })
  }
  B.put(L.P2, B.at(7, 14), { note: CUT })
  // TRI  the bass takes the mediant's root: f2 → ab2 and back, twice.
  bass(B, B_BASS, TRI_SHORT)
  // V1  the stationary common tone (see B_INNER).
  held(B, B_INNER.map(([bar, row, note]) => [bar, row, note, null]), 9)
  // `732` makes the held tone breathe for the whole section (tremolo SUBTRACTS only, so
  // the column is written one higher to pay for it, §2.8). Cancelled with `710`, not
  // `700` — a bare `700` replays the remembered depth instead of clearing it (§12.5).
  // Restated at the top of each of B's two frames: a mode that stands for longer than
  // one order frame is a mode that has outlived its section (§12.5 finding 3), and the
  // gate counts it as notes sounding under an effect they never asked for.
  B.put(L.V1, B.at(0, 0), { fx: [['7', nib(3, 2)]] })
  B.put(L.V1, B.at(4, 0), { fx: [['7', nib(3, 2)]] })
  B.put(L.V1, B.at(7, 12), { note: CUT, fx: [['7', nib(1, 0)]] })
  // V2  the cell, following the half-bar harmony, and its first rest outside `air`. It
  // states the mediant and the fall back to G (5:4–5:29), then withholds its attacks
  // for bars 2–3 (5:32–5:63): G · F | Dm · C, the end of the tune's second phrase,
  // which the sawtooth closes with three beats of air while pulse 2's line, the inner
  // voice's stepwise fall (b3 · a3 · g3) and the bass carry the harmony down to C. The
  // grid keeps counting, so the bell returns at 6:0 on its own row as the next phrase
  // starts over F, eight rows before the mediant is struck again at 6:8.
  cellRun(B, 5, B_CHORD_AT, { vol: 8, skip: [2, 3] })
  // NOISE  a tom pulse instead of a kick: low tom on beat 1, rim on 3, hats only on the
  // second half of each bar. Nothing here has a backbeat — the section floats.
  for (const bar of range(0, 8)) {
    B.hits(L.NOISE, TOM, 10, [[bar, 0]], 37)
    B.hits(L.NOISE, RIM, 8, [[bar, 8]])
    hats(B, bar, [6, 10, 14], { on: 6, off: 5 })
    if (bar % 2) B.hits(L.NOISE, BRUSH, 4, [[bar, 3]])
  }
  // fill 3 (bar 7): a pitch-macro riser on the last beat, the third distinct fill.
  clearKit(B, 7, 12, 16)
  B.hits(L.NOISE, RISER, 10, [[7, 12]])
}

// =====================================================================================
// air — frame 7: two lanes. The widest space in the piece, and the only frame the
// 5-row cell sits out; its removal is what makes the return at 8:2 an arrival.
// =====================================================================================
const air = s.section('air', 4)
{
  // P1  L's opening contour INVERTED — where the tune rose a step then a third, this
  // falls a step then a third — on the round 50 % instrument, with a beat of silence
  // before each of its two phrases and two beats after each.
  phrase(air, L.P1, LEAD_OPEN, 0, [
    /* b0 */ [4, '-'], [4, 'g5', 11], [4, 'f5', 11], [4, 'd5', 12],
    /* b1 */ [8, 'c5', 11], [8, '-'],
    /* b2 */ [4, '-'], [4, 'e5', 11], [4, 'd5', 11], [4, 'b4', 12],
    /* b3 */ [8, 'a4', 11], [8, '-'],
  ], { vib: VIB, vibMin: 8, vibAfter: 5 })
  // The phrase turn: the last note falls. `R24` at 7:53 cancels that note's vibrato and
  // bends it down four semitones, a4 → f4, over the four rows before the cut — the one
  // gesture in the piece where a pitch moves without a new attack.
  air.put(L.P1, air.at(3, 5), { fx: [['4', 0], ['R', nib(2, 4)]] })
  // TRI  one note a bar, gated and held: c3 · a2 · g2 · f2, a stepwise descent that is
  // the entire harmony of the section. Two voices, four chords, no chord played.
  bass(air, [[0, 0, 'c3'], [1, 0, 'a2'], [2, 0, 'g2'], [3, 0, 'f2'], [3, 12, '-']], TRI_LONG)
  // Every other lane rests: no kit at all (the declared `percussionGap`), no cell, no
  // harmony lanes, no sawtooth. The last four rows of the frame are silent outright.
}

// =====================================================================================
// answer — frame 8: the second voice comes back, and the two pulses trade phrases
// =====================================================================================
const ANSWER_CHORDS = ['F', 'Am', 'Dm', 'G']
const answer = s.section('answer', 4)
{
  // P1  a four-bar phrase built from the tune's second half, and it stops for a whole
  // bar at the end.
  phrase(answer, L.P1, LEAD, 0, [
    /* b0 */ [4, 'f5', 12], [4, 'e5', 11], [8, 'c5', 12],
    /* b1 */ [8, '-'], [4, 'a4', 11], [4, 'c5', 11],
    /* b2 */ [4, 'd5', 12], [4, 'f5', 12], [8, 'e5', 13],
    /* b3 */ [16, '-'],
  ], { vib: VIB, vibMin: 8, vibAfter: 5 })
  // P2  free imitation, not canon: it answers each phrase a fourth lower IN THE GAP the
  // lead leaves, so the two voices are never simultaneous. One frame of fifteen uses
  // imitation at all, well inside §9.2's one-third allowance.
  // The first answer is a DIMINUTION of the lead's shape — a quarter and two sixteenths
  // where the lead had two quarters and a half — so all three of its notes fit inside the
  // eight rows the lead leaves, and its cut lands on the row the lead returns.
  phrase(answer, L.P2, VOICE, answer.at(1, 0), [[4, 'c5', 10], [2, 'b4', 10], [2, 'g4', 11]])
  // The second answer has the whole of bar 3 to itself; its last note is a row short so
  // it is cut at 8:63 and nothing of it crosses into the build's downbeat.
  phrase(answer, L.P2, VOICE, answer.at(3, 0), [[4, 'b4', 11], [4, 'a4', 10], [7, 'f4', 11]])
  // TRI  the bass walks F · Am · Dm · G, the G carrying an f in pulse 2 above it: the
  // lydian II turning into a II7 that then REFUSES to resolve as a dominant, stepping up
  // to the build's Am instead.
  bass(answer, [
    [0, 0, 'f2'], [0, 8, 'c3'], [0, 12, 'g2'],
    [1, 0, 'a2'], [1, 8, 'e3'], [1, 12, 'c3'],
    [2, 0, 'd3'], [2, 8, 'a2'], [2, 12, 'f2'],
    [3, 0, 'g2'], [3, 8, 'd3'], [3, 12, 'b2'],
  ], TRI_LONG)
  // V2  the cell returns, two rows into the frame, exactly where it would have been had
  // it never stopped — the GRID counted through the rest. The figure did not: `air`
  // never calls cellRun, so 8:2 plays the figure's next note after 6:60.
  cellRun(answer, 8, ANSWER_CHORDS, { vol: 7 })
  // NOISE  a rim on beat 3 and one brushed ghost a bar: the kit re-enters at its
  // quietest, which is the only way the build can be a build.
  for (const bar of range(0, 4)) {
    answer.hits(L.NOISE, RIM, 7, [[bar, 8]])
    answer.hits(L.NOISE, BRUSH, 4, [[bar, 14]])
  }
}

// =====================================================================================
// build — frames 9–10: a descending-fifths sequence, the kit and the DPCM pair, and
// then one bar in which everything stops but the cell
// =====================================================================================
/** Am → Dm → G → C → F: four links of descending fifths, one per bar, a progression
 *  that GOES somewhere instead of looping (§9.3). Bars 5–6 push back up to the dominant
 *  and bar 7 is the augmented sixth. */
const BUILD_CHORD_AT = (row) => {
  const bar = Math.floor(row / 16)
  if (bar < 7) return ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'G'][bar]
  return row < 56 ? 'It6' : 'C'
}
const BUILD_LEAD = [
  /* b0 Am */ [4, 'a4', 11], [4, 'c5', 12], [8, 'e5', 12],
  /* b1 Dm */ [4, 'd5', 12], [4, 'f5', 12], [8, 'a5', 13],
  /* b2 G  */ [4, 'g4', 12], [4, 'b4', 12], [8, 'd5', 13],
  /* b3 C  */ [4, 'c5', 12], [4, 'e5', 13], [4, 'g5', 13], [4, '-'],
  /* b4 F  */ [4, 'f5', 13], [4, 'a5', 13], [8, 'g5', 14],
  /* b5 Dm */ [4, 'a5', 13], [4, 'f5', 13], [8, 'd5', 13],
  /* b6 G  */ [4, 'b4', 12], [4, 'd5', 13], [4, 'g5', 14], [4, '-'],
  /* b7    */ [8, 'b5', 14], [8, 'c6', 15],
]
/** pulse 2 falls through every bar the lead climbs: contrary motion for seven bars, on
 *  the off-8ths, in its own register under the tune. */
const BUILD_LINE = [
  ['e5', 'c5', 'a4', 'b4'], ['d5', 'a4', 'f4', 'a4'], ['d5', 'b4', 'g4', 'b4'],
  ['e5', 'c5', 'g4', 'e4'], ['c5', 'a4', 'f4', 'a4'], ['d5', 'a4', 'f4', 'd4'],
  ['b4', 'g4', 'd4', 'g4'],
]
const BUILD_BASS = [
  [0, 0, 'a2'], [0, 8, 'e3'], [0, 12, 'c3'],
  [1, 0, 'd3'], [1, 8, 'a2'], [1, 12, 'f2'],
  [2, 0, 'g2'], [2, 8, 'd3'], [2, 12, 'b2'],
  [3, 0, 'c3'], [3, 8, 'g2'], [3, 12, 'e3'],
  [4, 0, 'f2'], [4, 8, 'c3'], [4, 12, 'a2'],
  [5, 0, 'd3'], [5, 8, 'a2'], [5, 12, 'c3'],
  [6, 0, 'g2'], [6, 8, 'b2'], [6, 12, 'd3'],
  [7, 0, 'db3'], [7, 8, 'c3'],
]

const build = s.section('build', 8)
{
  // P1  the sequence, one rising three-note cell a bar, each a fifth below the last, the
  // volume column climbing 11 → 15 across the eight bars.
  phrase(build, L.P1, LEAD, 0, BUILD_LEAD, { vib: VIB, vibMin: 8, vibAfter: 5, cutAtEnd: false })
  // P2  the falling counter-line: every bar of the sequence has the two pulses moving in
  // opposite directions, which is the cheapest way to make a rising line sound bigger.
  BUILD_LINE.forEach((notes, bar) => {
    notes.forEach((note, i) => {
      build.put(L.P2, build.at(bar, 2 + i * 4), { note: n(note), inst: VOICE, vol: 9 + Math.floor(bar / 3) })
    })
  })
  // bar 7: the ITALIAN AUGMENTED SIXTH. db3 in the triangle (the flat sixth), f4 in pulse
  // 2, b5 in the lead (the raised fourth) — the interval between the outer voices is the
  // augmented sixth itself, and it resolves OUTWARD by semitone into C: db3 → c3 falling,
  // b5 → c6 rising. Nothing else sounds: no kit, no DPCM, no harmony lane, no sawtooth.
  build.put(L.P2, build.at(7, 0), { note: n('f4'), inst: VOICE, vol: 11 })
  build.put(L.P2, build.at(7, 8), { note: n('e4'), inst: VOICE, vol: 11 })
  build.put(L.P2, build.at(7, 15), { note: CUT })
  // TRI  the sequence's roots, stepwise into the flat sixth: d3 → db3 at 10:48.
  bass(build, BUILD_BASS, TRI_SHORT)
  // V1  enters a third of the way in and holds one chord tone a bar — the harmony lane
  // arriving is part of the crescendo, and it leaves again for the stop bar.
  held(build, [[2, 0, 'b3', null], [3, 0, 'e4', null], [4, 0, 'a3', null],
    [5, 0, 'f3', null], [6, 0, 'b3', null]], 9)
  build.put(L.V1, build.at(6, 15), { note: CUT })
  // V2  the cell's second rest outside `air`. It marks the sequence's first link, Am,
  // then withholds its attacks for bars 1–3 (9:16–9:63), the links Dm · G · C, where
  // the bass states a new root every bar, the two pulses move in contrary motion and,
  // at 9:32, the kick on 1 and 3 and vrc6p1 both enter: the sequence is the clock
  // there. The grid keeps counting, so the bell returns at 10:4 on the sequence's goal,
  // F, as the snare and the DPCM pair arrive, and then plays through the stop bar,
  // where it is the only thing left moving. That bar is the piece's ONE metric surprise
  // (§9.4): the bar itself is intact, but nothing marks it except a figure that does
  // not agree with it, which is why the cell never rests there.
  cellRun(build, 9, BUILD_CHORD_AT, { vol: 8, accent: 3, skip: [1, 2, 3] })
  // NOISE  the only section with a conventional backbeat, and it arrives in stages:
  // rim and hats (bars 0–1), a kick on 1 and 3 (2–3), the snare on 2 and 4 (4–5), a roll
  // (6), silence (7).
  for (const bar of range(0, 7)) {
    if (bar >= 2) build.hits(L.NOISE, KICK, 11, [[bar, 0], [bar, 8]])
    if (bar >= 4) build.hits(L.NOISE, SNARE, 11, [[bar, 4], [bar, 12]])
    else build.hits(L.NOISE, RIM, 8, [[bar, 4], [bar, 12]])
    hats(build, bar, bar >= 4 ? range(0, 16).filter((r) => r % 2 === 0) : [2, 6, 10, 14], { on: 7, off: 5 })
    if (bar >= 4) build.hits(L.NOISE, BRUSH, 5, [[bar, 7], [bar, 15]])
  }
  // fill 4 (bar 6): the roll, rising, into the silence rather than into a downbeat.
  clearKit(build, 6, 8, 16)
  roll(build, 6, 8, 16, 6, 14)
  // DPCM  the weight arrives with the second frame of the build and ducks the triangle
  // and the noise on every hit (§1) — which is exactly the pump this piece has not had.
  for (const bar of range(4, 7)) {
    build.hits(L.DPCM, KIT.inst, 14, [[bar, 0], [bar, 8]], KIT.kick)
    build.hits(L.DPCM, KIT.inst, 13, [[bar, 4], [bar, 12]], KIT.snare)
  }
}

// =====================================================================================
// light — frames 11–13: the peak. Twelve bars, the only twelve-bar section in the piece.
// L is stated in RHYTHMIC AUGMENTATION — every duration doubled, so its first four bars
// take eight — and then the tune gathers its own speed for the last four and reaches the
// piece's global peak, d6, at 13:40. This is the loudest and densest music here, and it
// is in the last third of the form because that is where a build is supposed to arrive.
// =====================================================================================
/** The four bars the tune plays at speed after eight bars of augmentation. Bar 10 is L's
 *  peak bar transposed up a third — the same rising shape, g5 · b5 · d6 — so the lydian
 *  b that was the tune's ceiling in A becomes a passing note on the way to the real one. */
const LIGHT_TAIL = [
  /* b8  G */ [4, 'd5', 13], [4, 'e5', 14], [8, 'g5', 14],
  /* b9  C */ [4, 'f5', 14], [4, 'e5', 13], [8, '-'],
  /* b10 G */ [4, 'g5', 14], [4, 'b5', 15], [8, 'd6', 15],
  /* b11 C→F */ [8, 'e5', 13], [4, 'f5', 14], [4, '-'],
]
const LIGHT_CHORDS = ['F', 'F', 'G', 'G', 'Am', 'Am', 'Dm', 'Dm', 'G', 'C', 'G', 'C']
/** One chord per TWO bars for the augmented half — a third harmonic rhythm, slower than
 *  A's one-per-bar and four times slower than B's two-per-bar — then back to one a bar. */
const LIGHT_LINE = [
  ['a4', 'c5', 'a4', 'f4'], ['g4', 'a4', 'c5', 'd5'],
  ['b4', 'd5', 'b4', 'g4'], ['a4', 'b4', 'd5', 'b4'],
  ['c5', 'a4', 'e4', 'a4'], ['b4', 'c5', 'e5', 'c5'],
  ['d5', 'a4', 'f4', 'a4'], ['a4', 'd5', 'f4', 'd5'],
  ['b4', 'd5', 'g4', 'b4'], ['c5', 'g4', 'e4', 'g4'],
  ['d5', 'b4', 'g4', 'd5'], ['c5', 'a4', 'g4', 'a4'],
]
const LIGHT_INNER = ['a3', 'c4', 'b3', 'd4', 'c4', 'e4', 'f3', 'a3', 'b3', 'e4', 'd4', 'e4']
const LIGHT_BASS = [
  [0, 0, 'f2'], [0, 8, 'c3'], [0, 12, 'a2'],
  [1, 0, 'f2'], [1, 8, 'a2'], [1, 12, 'g2'],
  [2, 0, 'g2'], [2, 8, 'd3'], [2, 12, 'b2'],
  [3, 0, 'g2'], [3, 8, 'b2'], [3, 12, 'a2'],
  [4, 0, 'a2'], [4, 8, 'e3'], [4, 12, 'c3'],
  [5, 0, 'a2'], [5, 8, 'c3'], [5, 12, 'b2'],
  [6, 0, 'd3'], [6, 8, 'a2'], [6, 12, 'f2'],
  [7, 0, 'd3'], [7, 8, 'f2'], [7, 12, 'g2'],
  [8, 0, 'g2'], [8, 8, 'd3'], [8, 12, 'b2'],
  [9, 0, 'c3'], [9, 8, 'g2'], [9, 12, 'e3'],
  [10, 0, 'g2'], [10, 8, 'b2'], [10, 12, 'd3'],
  [11, 0, 'c3'], [11, 8, 'f2'], [11, 12, '-'],
]

const light = s.section('light', 12)
{
  // P1  bars 0–7: L's first four bars with every value doubled (`stretch: 2`), so the
  // held notes are four beats long and the vibrato has room to bloom. Bars 8–11: the
  // tune at its own speed, and the peak.
  phrase(light, L.P1, LEAD, 0, TUNE.slice(0, 11), { stretch: 2, vib: VIB, vibMin: 12, vibAfter: 8, cutAtEnd: false })
  phrase(light, L.P1, LEAD, light.at(8, 0), LIGHT_TAIL, { vib: VIB, vibMin: 8, vibAfter: 5 })
  // P2  a counter-line on the off-8ths for all twelve bars: it moves while the augmented
  // tune holds, which is the entire reason the tune can afford to hold for four beats.
  LIGHT_LINE.forEach((notes, bar) => {
    notes.forEach((note, i) => {
      light.put(L.P2, light.at(bar, 2 + i * 4), { note: n(note), inst: VOICE, vol: bar < 8 ? 10 : 11 })
    })
  })
  light.put(L.P2, light.at(11, 14), { note: CUT })
  // TRI  the busiest bass in the piece, three attacks a bar, still stepwise across every
  // barline; the cadence at bar 11 falls c3 → f2 while the tune rises e5 → f5.
  bass(light, LIGHT_BASS, TRI_SHORT)
  // `G02` on every beat-4 pickup: two ticks of nine, so the bass leans a hair behind the
  // kit exactly where the kit is busiest. Humanisation, never on a section downbeat (§2.7).
  for (const bar of range(0, 11)) light.put(L.TRI, light.at(bar, 12), { fx: [['G', 2]] })
  // V1  one sustained chord third a bar, the chip's own 7 → 3 duty attack on each.
  held(light, LIGHT_INNER.map((note, bar) => [bar, 0, note, null]), 10)
  light.put(L.V1, light.at(11, 8), { note: n('a3'), inst: PAD, vol: 8 })
  // V2  the cell, at its loudest and with its accent widened, entering on the downbeat
  // of the section (11:0) because this cycle of five starts where the section does.
  cellRun(light, 11, LIGHT_CHORDS, { vol: 10, accent: 3 })
  // A one-unit shimmer on the bell for this section only — the cell's ring widens at the
  // peak and narrows again after it. `4x0` is the off switch, on the cell's last attack.
  // Restated on the first cell attack of each of light's three frames — 11:0, 12:1 and
  // 13:2, which are the cell's own entry rows — so the shimmer never stands for longer
  // than the frame that asked for it, and cancelled on the cell's last attack here.
  for (const row of [0, 65, 130]) light.put(L.V2, row, { fx: [['4', nib(3, 1)]] })
  light.put(L.V2, 190, { fx: [['4', 0]] })
  // SAW  doubles the tune an octave down for the last four bars only. Four bars is the
  // whole of its appearance here: an octave double is a lift precisely because it costs
  // the harmony, and a lift that lasts is just a thicker texture (§2.1 break 4).
  phrase(light, L.SAW, SAW_BRASS, light.at(8, 0), LIGHT_TAIL, { transpose: -12, volShift: -4, volMax: 11 })
  // NOISE  the full kit at last — kick on 1 and 3, snare on 2 and 4, hats on the 8ths —
  // and a crash on each of the section's two downbeats.
  // The middle frame of the peak (12:0–12:63, bars 4–7) is NOT the same bar four times:
  // the downbeat kick is dropped in bars 5 and 7 so those bars float, the backbeat at
  // 12:36 is a ghost at vol 5 instead of a hit, and the open hat marks the "and" of 4 in
  // bar 5. Frames 11 and 13 keep the plain kit, so the variation is heard as a lift and
  // a return rather than as a different groove (§9.4: per-section kit variation is not
  // optional, and this is the one piece briefed to keep the kit light).
  const noKick = [5, 7] // bars whose downbeat is left to the DPCM and the bass alone
  const ghost = [[6, 4]] // the backbeat that becomes a ghost note, at 12:36
  for (const bar of range(0, 12)) {
    if (bar === 0 || bar === 8) light.put(L.NOISE, light.at(bar, 0), { note: 46, inst: CRASH, vol: 10 })
    else if (!noKick.includes(bar)) light.hits(L.NOISE, KICK, 11, [[bar, 0]])
    light.hits(L.NOISE, KICK, 11, [[bar, 8]])
    for (const r of [4, 12]) {
      const isGhost = ghost.some(([b, gr]) => b === bar && gr === r)
      light.hits(L.NOISE, SNARE, isGhost ? 5 : bar % 4 === 3 ? 12 : 11, [[bar, r]])
    }
    hats(light, bar, [2, 6, 10, 14], { on: 7, off: 6 })
    if (bar === 5) light.put(L.NOISE, light.at(bar, 14), { note: 46, inst: OHAT, vol: 7 })
  }
  // fill 5 (bar 7): toms falling into the tune's return at speed — nothing like fill 2,
  // which fell in three steps on the beat; this one is a triplet-feel six-row group.
  clearKit(light, 7, 10, 16)
  light.hits(L.NOISE, TOM, 12, [[7, 10]], 43)
  light.hits(L.NOISE, TOM, 12, [[7, 13, 'G', 2]], 39)
  light.hits(L.NOISE, TOM, 13, [[7, 15]], 37)
  // fill 6 (bar 11): a DECRESCENDO fill — brushes and one open hat, handing the piece
  // down to the descent instead of throwing it forward (§9.4: no two fills alike, and
  // nothing dramatic near the seam).
  clearKit(light, 11, 8, 16)
  light.hits(L.NOISE, BRUSH, 6, [[11, 8], [11, 11]])
  light.hits(L.NOISE, OHAT, 7, [[11, 14]])
  // DPCM  the pair under the kit for ten bars, then only the downbeat kick: the weight
  // starts leaving before the section does.
  for (const bar of range(0, 12)) {
    // bars 5 and 7 give up their downbeat kick on this lane too, so those two bars have
    // no kick at all: the floating bars are floating on both percussion lanes at once.
    const kicks = noKick.includes(bar) ? [[bar, 8]] : bar < 10 ? [[bar, 0], [bar, 8]] : [[bar, 0]]
    light.hits(L.DPCM, KIT.inst, bar < 10 ? 14 : 12, kicks, KIT.kick)
    if (bar < 10) light.hits(L.DPCM, KIT.inst, bar === 6 ? 11 : 13, [[bar, 4], [bar, 12]], KIT.snare)
  }
}

// =====================================================================================
// descent — frames 14–15: the arrangement leaves in the order it arrived, and the last
// bar is the lydian II over the tonic pedal, leaning straight into the loop row's F.
// =====================================================================================
const DESCENT_CHORDS = ['F', 'G', 'Am', 'Dm', 'F', 'C', 'Dm', 'G']
const descent = s.section('descent', 8)
{
  // P1  the tune once more, DISPLACED ONE ROW LATE (§9.1 recipe F, which is audible at
  // 90–105 BPM and nowhere faster). Its first four bars are the A statement shifted to
  // 14:1 while the triangle, the bell and the kit all stay exactly where they were, so
  // the restatement arrives a sixteenth behind the bar it used to own. Nothing wraps:
  // the phrase's closing rest is shortened by a row so the displaced half ends on 14:63
  // and the last frame starts back on the grid — recipe F's option (b), the safe one.
  // …on LEAD_OPEN, the round 50 % voice the two-lane section used: the last statement is
  // displaced in TIME and repainted in TIMBRE, so neither dimension repeats.
  phrase(descent, L.P1, LEAD_OPEN, 1, [
    /* b0 */ [4, 'c5', 11], [4, 'd5', 11], [8, 'f5', 12],
    /* b1 */ [4, 'e5', 11], [4, 'd5', 10], [8, '-'],
    /* b2 */ [4, 'a4', 10], [4, 'c5', 11], [8, 'd5', 11],
    /* b3 */ [4, 'c5', 10], [11, '-'],
  ], { vib: VIB, vibMin: 8, vibAfter: 6, cutAtEnd: false })
  // … and back on the grid for the last four bars: a two-note bar, a whole bar of rest,
  // then a three-note close on a4 — the third of the F the loop row lands on, so the
  // last melodic note of the piece is already home.
  phrase(descent, L.P1, LEAD_OPEN, descent.at(4, 0), [
    /* b4 */ [8, 'a4', 10], [8, 'c5', 11],
    /* b5 */ [16, '-'],
    /* b6 */ [4, 'e5', 11], [4, 'd5', 10], [8, 'c5', 11],
    /* b7 */ [8, 'a4', 10], [8, '-'],
  ], { vib: VIB, vibMin: 8, vibAfter: 6 })
  // P2  answers twice more, in the same two rests it used in A′ and displaced with the
  // tune, and then stops for the whole of the last frame: the counter-voice leaves first.
  for (const [bar, row, notes, vol] of [
    [1, 9, ['g4', 'a4', 'b4', 'g4'], 9],
    [3, 5, ['a4', 'b4', 'c5', 'a4'], 8],
  ]) notes.forEach((note, i) => descent.put(L.P2, descent.at(bar, row + i * 2), { note: n(note), inst: VOICE, vol }))
  descent.put(L.P2, descent.at(3, 13), { note: CUT })
  // TRI  the bass, and then the pedal: from 15:48 it holds f2 under the G, so the bass
  // note the loop row restrikes is the note already sounding (§2.9 rule 4).
  bass(descent, [
    [0, 0, 'f2'], [0, 8, 'c3'], [0, 12, 'g2'],
    [1, 0, 'g2'], [1, 8, 'd3'], [1, 12, 'b2'],
    [2, 0, 'a2'], [2, 8, 'e3'], [2, 12, 'c3'],
    [3, 0, 'd3'], [3, 8, 'a2'], [3, 12, 'f2'],
    [4, 0, 'f2'], [4, 8, 'c3'], [4, 12, 'a2'],
    [5, 0, 'c3'], [5, 8, 'g2'], [5, 12, 'e3'],
    [6, 0, 'd3'], [6, 8, 'a2'], [6, 12, 'c3'],
    [7, 0, 'f2'],
  ], TRI_LONG)
  // V1  the arpeggio bed RETURNS for the last two bars (15:32), five and a half frames
  // after it was taken away. It is the piece's first texture and its last, so the seam
  // hands one bed straight to another and the loop is inaudible as a join.
  bedStrikes(descent, [
    [6, 0, 'f3', 4, 9], [6, 8, 'f3', 4, 9], [7, 0, 'g3', 4, 7], [7, 8, 'g3', 4, 7],
  ], 7)
  // V2  the cell's third and last cycle: entry 14:3, 15:4, and its final attack at 15:59
  // — four rows clear of the seam, where the next attack of the unbroken five-row grid
  // is the loop row itself (15 frames = 960 rows = 192 cells exactly).
  cellRun(descent, 14, DESCENT_CHORDS, { vol: 7 })
  // NOISE  back to rim and hats for four bars, then rim alone, then nothing: the last
  // percussion event is at 15:31 and the kit is silent into the loop, which is what
  // stops the seam sounding like a downbeat.
  for (const bar of range(0, 4)) {
    descent.hits(L.NOISE, RIM, 7, [[bar, 4], [bar, 12]])
    hats(descent, bar, [2, 10], { on: 6, off: 5 })
  }
  descent.hits(L.NOISE, RIM, 6, [[4, 8], [5, 8]])
  descent.hits(L.NOISE, BRUSH, 4, [[5, 15]])
  // DPCM and SAW rest for the whole section.
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['horizon', 'A', "A'", 'B', 'air', 'answer', 'build', 'light', 'descent'])
s.loopTo('A')
s.qa({
  key: 'f-lydian',
  bpmRange: [98, 102],
  durationSec: [148, 158],
  rmsRange: [-24, -12],
  percussionGap: 32,
  motif: {
    channel: 'pulse1',
    patterns: [1, 3, 5, 11, 14],
    variation: 'reharmonised (3:0), re-orchestrated onto the sawtooth an octave down (5:0), inverted (7:4), augmented x2 (11:0), displaced +1 row (14:1)',
  },
  notes:
    'F lydian at 100 BPM on 16th rows, 16 frames of four bars, loop @ 1. One pass is ' +
    '153.6 s — the whole order, which is what gate C measures — and the looping body ' +
    'from frame 1 is 960 rows = 144.0 s. ' +
    'rmsRange floor -24: this is the album\'s OPEN piece and it renders at -21.4 dBFS, ' +
    'under the default -20 floor, because a whole section is two lanes (frame 7), the ' +
    'intro is two lanes (frame 0), every lead phrase ends in a beat or more of rest and ' +
    'the kit is rim, brushes and hats until frame 9. Lowering the arrangement is the ' +
    'composition; the level was not re-gained to meet the default, per section 2.8. ' +
    'The dynamic arc is a single long build and one deep dip, measured per section: ' +
    'horizon -27.3, A -22.1, A-prime -21.1, B -21.1, air -24.8, answer -22.9, build ' +
    '-20.8, light -19.7 (the loudest music in the piece, in the last third), descent ' +
    '-23.1. Peak 0.664, zero clamped samples, so no clip allowance is declared. ' +
    'percussionGap 32: frame 7 (air) drops the kit entirely for its four bars, which is ' +
    'the piece\'s widest silence and the point of the section; the report tool measures ' +
    'the longest gap as 75 rows, which is that frame plus the eight rows before the ' +
    'answer section\'s first rim, and coverage still reads 86.4% against the 80% floor. ' +
    'The bar at 10:48 also stops the kit, deliberately (below). ' +
    'DEVICES. Metric, section 9.1 recipe B: an ostinato attacking every FIVE rows on ' +
    'vrc6p2, anchored at the loop row. Its GRID is carried unbroken through the loop ' +
    'body, so frame k enters at (-64(k-1)) mod 5 = (k-1) mod 5; its ATTACKS rest three ' +
    'times in the middle third, so that each return is heard as a return: 5:32 to 5:63 ' +
    '(B bars 2-3, where the tune ends a phrase and the harmony falls to C), all of ' +
    'frame 7, and ' +
    '9:16 to 9:63 (build bars 1-3, where the kick and vrc6p1 enter). No rest re-anchors ' +
    'it: the bell returns at 6:0 and 10:4, on the rows the grid always gave it, both ' +
    'times on an accented f4. Measured entry rows, frame:row: ' +
    '1:0 2:1 3:2 4:3 5:4 | 6:0, frame 7 rests, 8:2 9:3 10:4 | 11:0 12:1 13:2 14:3 15:4 ' +
    '- three complete cycles of five; frame 5 attacks only in its first two bars and ' +
    'frame 9 only in its first. 163 attacks: 192 grid slots less 13 in frame 7 and 16 ' +
    'in the two bar rests, so the cell sounds in 51 of the 64 bars. ' +
    'The loop body is 15 frames = 960 rows = 192 cells ' +
    'exactly, so the grid is continuous across the seam too: the last attack is 15:59 ' +
    'and the next one is the loop row itself. Its three-note figure advances on its own ' +
    'count and is never reset by a bar, a frame or a section; it keeps turning through ' +
    'the two bar rests and stands still through frame 7, which the cell sits out ' +
    'entirely. The one metric surprise ' +
    '(section 9.4) is 10:48 - a whole bar in which noise, dpcm, vrc6p1 and vrc6saw all ' +
    'stop and only the five-row cell marks time. Recipe F is here too: the tune\'s last ' +
    'statement is DISPLACED one row late at 14:1 - frame 14\'s pulse 1 is frame 1\'s, note ' +
    'for note, every row plus one - while the triangle, the bell and the kit stay exactly ' +
    'where they were, and the last frame comes back onto the grid. That is recipe F ' +
    'option (b): the displaced phrase\'s closing rest is a row shorter, so nothing wraps ' +
    'past 14:63. ' +
    'Non-diatonic, section 9.3, two distinct devices in different sections: (1) the ' +
    'chromatic mediant bIII, Ab major, at 5:8 and again at 6:8 - the bass rises f2 to ' +
    'ab2, vrc6p1 RESTRIKES c4 without moving (the common tone that makes it glow rather ' +
    'than lurch), and pulse 2\'s suspended a4 resolves down a semitone to ab4 at 5:10; ' +
    'Ab then falls to the lydian II with every voice moving down a step. (2) an Italian ' +
    'augmented sixth at 10:48 - db3 on the triangle, f4 on pulse 2, b5 on pulse 1 - ' +
    'whose outer voices resolve OUTWARD by semitone to c3 and c6 at 10:56, into the ' +
    'dominant, one bar before the peak section. Positives: a four-link descending-fifths ' +
    'sequence Am-Dm-G-C-F at 9:0, 9:16, 9:32, 9:48, 10:0; three different harmonic ' +
    'rhythms (one chord a bar in A and A-prime, two a bar in B, one per two bars in the ' +
    'augmented half of light); no four-chord cycle is repeated anywhere. Only 2.1% of ' +
    'melodic notes are outside the mode, against the 12% default, so no allowance is raised. ' +
    'Counterpoint, section 9.2: pulse 2 is an independent line for the whole of B ' +
    '(5:0 to 6:63) - every one of its 29 attacks is on an off-8th, so it shares no ' +
    'attack row with the sawtooth anywhere in the section - and it carries three leaning ' +
    'suspensions at 5:6, 6:6 and 6:22, each held across a chord change and resolved down ' +
    'a semitone two rows later, the last of them a 4-3 over the cadential G. Contrary ' +
    'motion at both authentic cadences: 2:56 (tune e5 to f5 rising, bass c3 to f2 ' +
    'falling) and 13:56 (the same cadence at the end of the peak). Pulse 2 falls through ' +
    'every bar of the build that pulse 1 climbs, 9:2 to 10:46. ' +
    'The bed and its removal: the fast 0xy arpeggio bed spells the harmony on vrc6p1 in ' +
    'frames 0, 1 and 2 and is TAKEN AWAY at 3:0, where nothing replaces it - the ear ' +
    'keeps the harmony the bass and the tune only imply. It returns at 15:32 for the ' +
    'last two bars, so the loop seam hands one bed straight to another. 0xy params are ' +
    'decimal: 047 = 71 (major triad), 037 = 55 (minor), 049 = 73 (first-inversion minor ' +
    'over a moving bass), 059 = 89 (second-inversion major). 4xy 442 = 66 is the ' +
    'delayed vibrato, always written five or six rows after the note it colours, never ' +
    'on its attack; 441 = 65 is the narrower one on pulse 2\'s suspensions and 431 = 49 ' +
    'the shimmer on the bell through light. 732 = 50 is the tremolo on the held inner ' +
    'voice in B, cancelled with 710 = 16 at 6:60 rather than 700, which would replay the ' +
    'remembered depth. A10 = 16 fades the intro pedal from 0:52 and A00 cancels it on the ' +
    'cut; R24 = 36 at 7:53 bends the last note of the two-lane section down four ' +
    'semitones; G02 leans eleven triangle pickups two ticks of nine behind the kit in ' +
    'light, and G03 flams one tom in the fill at 12:61. ' +
    'Register and mix: pulse 2 (62-76) and the vrc6p2 cell (63-74) share an octave by ' +
    'design, not by accident. They are separable because they are different in kind - ' +
    'the cell is a twelve-tick bell that decays inside one and a third rows on a duty ' +
    'macro thinning to 12.5%, pulse 2 is a sustaining 50%-to-25% voice on the other ' +
    'chip - and because their rhythms never coincide: the cell is on a five-row grid and ' +
    'pulse 2 is on the off-8ths. The sawtooth never exceeds 11 and is at 10 wherever it ' +
    'sustains, since 15 on the saw is about twice a pulse at 15. '+
    'The tune changes DUTY between passes, which is the first anti-monotony tool the ' +
    'master reference names: x-long-light-lead (12.5% opening to 25%) states it at 1:0, ' +
    '9:0 and 11:0; x-long-light-lead-round (25% opening to 50%) restates it at 3:0, so ' +
    'the second pass of the same eight bars is a warmer telling under a changed harmony; ' +
    'x-long-light-lead-open (50% throughout) carries the exposed two-lane section at 7:0 ' +
    'and the displaced close at 14:1. The kit varies by section and inside the peak: ' +
    '12:16 and 12:48 drop the downbeat kick on both the noise and the DPCM lane, 12:36 ' +
    'turns the backbeat into a vol-5 ghost and 12:30 puts an open hat on the "and" of 4, ' +
    'while frames 11 and 13 keep the plain kit so the change reads as a lift and a ' +
    'return. Two bars exceed section 9.8\'s 28-attack density ceiling, which was written ' +
    'for five lanes: 10:32 at 31 (the snare roll that ends the build) and 13:0 at 29 ' +
    '(the crash bar where the tune returns at speed); both are arrival bars and no ' +
    'sustained passage reaches the ceiling. The lead rests inside the build as it does ' +
    'everywhere else: a beat at 9:60 before the sequence lands on F, and a beat at 10:44 ' +
    'so the augmented sixth arrives out of air rather than out of a continuous line. ' +
    'Only 15.9% of note ' +
    'events are at volume 15, and all but four of those are the triangle, which has no ' +
    'level at all and whose 15 is a gate.',
  renderChecksum: 130662813,
})
s.check()
s.write('src/assets/songs/09-long-light.json')
