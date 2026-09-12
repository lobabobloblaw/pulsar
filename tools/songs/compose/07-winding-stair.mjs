#!/usr/bin/env node
/** 07 — Winding Stair. A descent in triple metre: the same turn, again, lower each time.
 *
 *      node tools/songs/compose/07-winding-stair.mjs  -> src/assets/songs/07-winding-stair.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), invented from the
 *  contour and harmony rules of §2.10 / §9.3. Baroque bones, rock energy, chip voices —
 *  an idiom, not a source. Nothing here quotes or paraphrases any published work.
 *
 *  GRID  tempo 150 · speed 6 · rowHighlight 4 (a beat) · rowHighlight2 12 (a 3/4 bar) ·
 *        rowsPerPattern 48 (a frame = 4 bars = 4.8 s) = 150 BPM in 3/4 on 16th rows.
 *  KEY   G minor, declared `g-minor` (the lint's scale is natural minor). Every cadential
 *        D major costs an f#, which is why `accidentalFractionMax` is 0.20.
 *
 *  FORM (28 frames, 112 bars; one pass 134.4 s = 2:14)
 *  | frame | section  | bars | what happens                                              |
 *  |-------|----------|------|-----------------------------------------------------------|
 *  | 0–2   | entries  | 12   | the exposition: S alone on pulse 1, answered at the fifth  |
 *  |       |          |      | below by VRC6 p1 two bars later, the saw entering under    |
 *  |       |          |      | both two bars after that — three lines, three rhythms.     |
 *  |       |          |      | Harmony: one chord per TWO bars, a chain of falling fifths |
 *  | 3–6   | A        | 16   | the stair with the band: S as the tune, harmonic rhythm    |
 *  |       |          |      | doubled to one chord per bar, pulse 2 a suspension chain   |
 *  |       |          |      | on beats 2 and 3 throughout; hemiola cadence at bars 14–15 |
 *  | 7–8   | B        | 8    | the stair itself: a six-link chromatic bass descent under  |
 *  |       |          |      | a held Gm, hats only, phrased 6 + 2 (the asymmetry)        |
 *  | 9–12  | stretto  | 16   | four entries one bar apart down the circle of fifths, then |
 *  |       |          |      | four bars of rhythmic unison — the loudest place — and the |
 *  |       |          |      | second hemiola, unlike the first                           |
 *  | 13–14 | landing  | 8    | two voices and nothing else: S inverted in close canon     |
 *  | 15–18 | A'       | 16   | S in AUGMENTATION in the triangle under S INVERTED above;  |
 *  |       |          |      | the saw rests for eight bars, then S returns at pitch      |
 *  | 19–21 | spiral   | 12   | the sequence driven: two chords a bar, a 5-row cell on     |
 *  |       |          |      | VRC6 p2 carrying its phase, register falling               |
 *  | 22–25 | coda     | 16   | the bottom of the stair: lowest, darkest, the Neapolitan   |
 *  |       |          |      | (A flat) cadence twice, the 5-row cell landing at 22:46    |
 *  | 26–27 | turn     | 8    | the climb back to the top, the piece's peak, then D7 ->    |
 *  |       |          |      | loop at frame 3. No fill at the seam                       |
 *
 *  MOTIFS
 *    S   the subject (4 bars): a rising fourth that turns and walks back down a fifth,
 *        then THE SAME TURN ONE STEP LOWER. Two links; the two links are the stair, and
 *        the piece's whole form is that figure at larger and larger scale.
 *    CS  the countersubject (2 bars): rises where S falls, in even eighths and quarters
 *        where S is quarters and a dotted quarter.
 *    SUS the suspension chain: pulse 2's line in A, struck on beat 3, held across the
 *        bar, resolved down by step on beat 2 — eight suspensions in eight bars.
 *
 *  ALLOCATION (the lead is one voice at a time; every lane rests audibly somewhere)
 *    entries  P1 subject · V1 answer · SAW third entry · TRI+V2 from bar 8 · hats bar 4
 *    A        P1 tune · P2 suspension chain · V1 rising inner line · V2 off-beat stabs ·
 *             SAW running eighths · TRI detached roots an octave under it · full kit
 *    B        TRI chromatic walk · V1/V2 hold · P1 a slow descant · hats only · no saw
 *    stretto  P1 V1 V2 SAW imitate one bar apart · TRI roots · kit + DPCM
 *    landing  P1 and V1 ONLY
 *    A'       TRI augmented S · P1 inverted S · V1 V2 harmony · SAW silent 8 bars
 *    spiral   P1 sequence · V2 the 5-row cell · SAW eighths · TRI roots · P2 answers
 *    coda     SAW low melody · TRI pedal · V1 V2 the Neapolitan · P1 the last descent
 *    turn     everything climbing, thinning to P1 + TRI on the last bar
 *
 *  DEVICES (frame:row; the same list is in extra.qa.notes)
 *    §9.1  STRUCTURAL: a 5-row cell on VRC6 pulse 2 from 19:0, entering 19:0, 20:2, 21:4
 *          and 22:1 — `(-48k) mod 5`, four frames, last attack 22:46, well before the
 *          seam. CADENTIAL: hemiola at 6:24 (3 x 8 rows, inner voices and kit, triangle
 *          holding) and a different one at 12:24 (saw and snare take the 8-row groups
 *          while the kit's backbeat drops out). METRIC SURPRISE: 21:0, a whole bar where
 *          the kit stops and only the 5-row cell keeps time.
 *    §9.2  three independent lines for the whole of `entries` (0:0–2:47); pulse 2 is an
 *          independent suspension chain for the whole of A (3:0–6:47).
 *    §9.3  chromatic bass descent g–f#–f–e–eb–d at 7:0–8:12; Neapolitan bII (A flat) at
 *          23:0 and 25:0. Sequence: falling fifths, seven links, 3:0–3:47.
 *    §9.4  seven kits, eleven fills, no two of either alike; ghosts at vol 4–6; the one
 *          section with no kick and no backbeat at all is B.
 *  HEADROOM  measured, not guessed: the arrangement as first written came in at -20.71
 *            dBFS over two passes, 0.7 dB under gate C's floor, because a contrapuntal
 *            piece spends most of itself in two and three voices. It was lifted by one
 *            column step everywhere (`LIFT`) plus the instrument bodies, and the loud
 *            sections were raised further, which widened the section range as well as the
 *            mean: -17.7 dBFS at the stretto and the turn against -21.0 at `landing`.
 *            Whole file -18.70 dBFS, peak 0.900, zero clamped samples.
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'winding-stair',
  name: 'Winding Stair',
  author: 'pulsar original',
  speed: 6,
  rowsPerPattern: 48,
  rowHighlight: 4,
  rowHighlight2: 12,
})

// =====================================================================================
// the ladder — G natural minor as scale steps, because every device in this piece is a
// DIATONIC transposition: the answer, the inversion, the sequence and the stair itself.
// =====================================================================================
const DEGREES = [0, 2, 3, 5, 7, 8, 10] // g a bb c d eb f
/** `rung(0)` is g1 (MIDI 31); one index = one scale step. */
function rung(i) {
  return 31 + 12 * Math.floor(i / 7) + DEGREES[((i % 7) + 7) % 7]
}
const RUNGS = Array.from({ length: 56 }, (_, i) => rung(i))
/** The ladder index of a G-minor scale tone. Throws on a chromatic note, which is the
 *  point: f#, ab and db are written out by hand and never transposed by accident. */
function idx(note) {
  const midi = n(note)
  const at = RUNGS.indexOf(midi)
  if (at < 0) throw new Error(`idx(${note}): MIDI ${midi} is not a G-minor scale tone`)
  return at
}
/** Diatonic transposition: move every pitch `k` scale steps along the ladder. */
const climb = (events, k) => events.map(([len, note, vol]) => [len, typeof note === 'string' && (note === '-' || note === '~') ? note : rung(idx(note) + k), vol])
/** Chromatic transposition, with `fix` replacing the note at an event INDEX — a tonal
 *  answer's adjustment, written where a reader can see which note moved and why. */
const shift = (events, semis, fix = {}) =>
  events.map(([len, note, vol], i) => [len, fix[i] !== undefined ? n(fix[i]) : note === '-' || note === '~' ? note : n(note) + semis, vol])
/** Rhythmic augmentation: every value twice as long. */
const augment = (events) => events.map(([len, note, vol]) => [len * 2, note, vol])
/** Diatonic inversion about `pivot` — the contour turned upside down, still in key. */
const invert = (events, pivot = 'd5') =>
  events.map(([len, note, vol]) => [len, note === '-' || note === '~' ? note : rung(2 * idx(pivot) - idx(note)), vol])

/** One column step of headroom, applied to every phrase: the arrangement as first
 *  written measured -20.71 dBFS over two passes, 0.7 dB under gate C's floor, because a
 *  contrapuntal piece spends so much of itself in two and three voices. Lifting the parts
 *  is the fix; re-gaining the render is not one (§2.8).
 */
const LIFT = 1

const range = (a, b, step = 1) => Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, i) => a + i * step)

// =====================================================================================
// instruments — the melodic voices are piece-specific so each entry of the subject has
// its own attack; the kit is the shared bank, which is what makes it the album's kit.
// =====================================================================================
/** The upper voice. A 50 % front that narrows to 25 % from the second tick — the pulse's
 *  own articulation — over a body that settles a step under the column, and a zero-sum
 *  scoop (pitch macros ACCUMULATE, so the values sum to 0, not merely end on 0). */
const UPPER = s.instrument('upper', {
  volume: { values: [13, 15, 15, 14, 14, 14, 14], loop: 6 },
  duty: { values: [2, 1, 1], loop: 2 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** Pulse 2's suspension chain: it must SUSTAIN across a barline without fading, so the
 *  body holds, and duty 0 (thin, nasal) keeps it behind the lead without a level drop. */
const INNER2 = s.instrument('inner2', {
  volume: { values: [10, 14, 14, 14, 14], loop: 4 },
  duty: { values: [1, 0], loop: 1 },
})
/** VRC6 pulse 1, the answering entries: the chip's own attack, duty 7 -> 3 over five
 *  ticks, so an entry is heard as an ENTRY and not as a pad opening. */
const ANSWER_V = s.instrument('answer', {
  volume: { values: [12, 15, 15, 14, 14, 14], loop: 5 },
  duty: { values: [7, 6, 5, 4, 3], loop: 4 },
})
/** VRC6 inner harmony: reedy 12.5 %, quiet, and it breathes rather than sits. */
const INNER_V = s.instrument('innerv', {
  volume: { values: [8, 12, 13, 13, 13, 13], loop: 5 },
  duty: { values: [3, 2, 1], loop: 2 },
})
/** The detached VRC6 stab — five sounding ticks of a six-tick row, so an off-beat stab
 *  never bleeds into the beat after it. Also carries the 5-row cell. */
const PING = s.instrument('ping', {
  volume: { values: [15, 14, 11, 6, 0] },
  duty: { values: [3, 1], loop: 1 },
})
/** The running sawtooth bass: detached, and mixed down before anything else (rate 42/15
 *  per unit — 15 here is about twice a pulse at 15). */
const SAW_RUN = s.instrument('saw-run', {
  volume: { values: [14, 13, 10, 6, 0] },
})
/** The sawtooth as a VOICE — the third entry, and the coda's low melody. A stepped
 *  bend-in (running sum 3 2 1 0: on pitch by tick 4) and a swell into the body. */
const SAW_VOICE = s.instrument('saw-voice', {
  volume: { values: [9, 12, 14, 14, 13, 13], loop: 5 },
  pitch: { values: [3, -1, -1, -1, 0] },
})
/** The sustained sawtooth pedal, kept low: 9 is already a loud lane. */
const SAW_HOLD = s.instrument('saw-hold', { volume: { values: [8, 11, 11], loop: 2 } })
/** The noise riser for fills: the index falls, so the PITCH rises (period index = 47 -
 *  note, and the pitch macro adds to the index and clamps at 0..15). Self-ending. */
const RISER = s.instrument('riser', {
  volume: { values: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 42,
})
/** A tom with a longer drop than the bank's, for the tumbling 3/4 fills. */
const TOM_LONG = s.instrument('tom-long', {
  volume: { values: [15, 14, 12, 10, 8, 6, 4, 2, 0] },
  pitch: { values: [1, 1, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 43,
})
// Shared bank, byte-identical to the fixture: a drum that is the same drum across the
// album is worth more than a lead that is the same lead (§12.6).
const [KICK, SNARE, HAT, OHAT, CRASH, METAL, RIM, TRI_LONG, TRI_SHORT] =
  s.bank('kick', 'snare', 'hat-closed', 'hat-open', 'crash', 'metal', 'rim', 'bass', 'bass-short')
const KIT = s.dpcmKit() // kick 36, snare 39 — used in `stretto` only, where the bass is
                        // already being restruck on every beat, so the TND duck is groove

// =====================================================================================
// writers — rhythm-first notation, so a line reads as durations and pitches
// =====================================================================================
/** A phrase as consecutive events `[rows, note, vol?, fx?]` from `startRow`. `'-'` rests
 *  (a cut), `'~'` extends the previous note. A bare attack cancels whatever channel MODE
 *  the lane still has latched (§12.5) — `line()` does this and a raw `put()` does not, so
 *  the helper every voice goes through has to. Notes at least `vibMin` rows long get a
 *  `4xy` written `vibAfter` rows in, and the next event carries its `400`. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vib = 0, vibMin = 8, vibAfter = 4, fade = 0, fadeAfter = 6, vol: defaultVol = 12, fixedVol, volShift = 0, cutAtEnd = true } = opts
  const level = (v) => fixedVol ?? Math.max(1, Math.min(15, (v ?? defaultVol) + volShift + LIFT))
  // The cancel the DRIVER honours for each mode of §12.5's table, not a zero param: `4x0`
  // for vibrato, `7x0` with x > 0 for tremolo (a bare `700` REPLAYS the effect memory),
  // `100` for a portamento (`300` only freezes it), `A00`, `P80`, `000`. A bare event
  // cancels whatever the lane still has latched, exactly as `line()` does; an event that
  // carries its own effect does not, because that is how a gesture is sustained.
  const CANCEL = { porta: ['1', 0], slide: ['1', 0], arp: ['0', 0], vib: ['4', 0], trem: ['7', 0x10], vol: ['A', 0], pitch: ['P', 0x80] }
  const cancels = (row) => [...sec.latched(lane, row - 1).keys()].map((mode) => CANCEL[mode])
  let row = startRow
  for (const [len, note, vol, fx] of events) {
    if (note === '~') { row += len; continue }
    const list = fx ? [fx] : cancels(row)
    if (note === '-') sec.put(lane, row, { note: CUT, fx: list.length ? list : undefined })
    else sec.put(lane, row, { note: n(note), inst, vol: level(vol), fx: list.length ? list : undefined })
    if (note !== '-' && vib && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
    }
    // `Axy` is INVERTED here (§1): `Ax0` fades, `A0y` swells. A fade written a few rows
    // into a long note is how a held chip note stops being a wall.
    if (note !== '-' && fade && len > fadeAfter && row + fadeAfter < sec.len) {
      sec.put(lane, row + fadeAfter, { fx: [['A', fade]] })
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    const list = cancels(row)
    sec.put(lane, row, { note: CUT, fx: list.length ? list : undefined })
  }
  return row
}

/** The sawtooth's running bass: `bars` is one list of six eighth-note MIDI notes per bar
 *  (rows 0, 2, 4, 6, 8, 10), `null` for a rest. The beat's own eighth is a step louder,
 *  which is the whole of this lane's dynamics. */
function run(sec, firstBar, bars, vol = 10, inst = SAW_RUN) {
  bars.forEach((notes, i) => {
    // the beat's own eighth sits a step above the two between it, and every second bar
    // sits a step under the one before it: a two-bar arc, which is all the dynamics this
    // lane needs to stop reading as a machine
    const lift = i % 2 === 0 ? 1 : 0
    notes.forEach((note, j) => {
      if (note === null) return
      sec.put(L.SAW, sec.at(firstBar + i, j * 2), { note: n(note), inst, vol: vol + lift - (j % 2 === 0 ? 0 : 1) })
    })
  })
}

/** The triangle's detached roots. `beats` are row offsets inside the bar. */
function roots(sec, firstBar, notes, beats = [0, 8], inst = TRI_SHORT) {
  notes.forEach((note, i) => {
    if (note === null) return
    for (const r of beats) sec.put(L.TRI, sec.at(firstBar + i, r), { note: n(note), inst, vol: 15 })
  })
}

/** Closed hats on the rows given, skipping any cell the lane already has (a kick or a
 *  snare on the same row wins — the noise lane is monophonic). */
function hats(sec, bar, rows, opts = {}) {
  const { on = 9, off = 6, inst = HAT, note = 45 } = opts
  for (const r of rows) {
    const row = sec.at(bar, r)
    if (sec.lanes[L.NOISE][row] !== null) continue
    sec.put(L.NOISE, row, { note, inst, vol: r % 4 === 0 ? on : off })
  }
}

// =====================================================================================
// motifs — written once, then transposed, inverted, augmented and re-orchestrated
// =====================================================================================
/** S — THE SUBJECT, four bars. Bar 0 leaps a fourth up to the peak and turns back down;
 *  bars 0–1 walk a fifth down, g–f–eb–d–c–bb. Bars 2–3 are THE SAME FIGURE ONE STEP
 *  LOWER — the stair, in miniature. Over a falling-fifths harmony each link's first note
 *  becomes the new chord's ninth, so the subject writes its own 9–8 suspensions.
 *  Contour: two fourth-leaps, each answered by stepwise descent; everything else steps. */
const SUBJECT = [
  [4, 'd5', 13], [2, 'g5', 14], [2, 'f5', 13], [4, 'eb5', 13],
  [6, 'd5', 13], [2, 'c5', 12], [4, 'bb4', 12],
  [4, 'c5', 13], [2, 'f5', 13], [2, 'eb5', 12], [4, 'd5', 13],
  [6, 'c5', 12], [2, 'bb4', 12], [4, 'a4', 12],
]
/** The head: S's first link, two bars. The unit the stretto stacks. */
const HEAD = SUBJECT.slice(0, 7)

/** The ANSWER — S a real fifth below, for the second entry. Two a-flats survive the
 *  transposition and both earn their place: the first (event 3, a quarter) is the flat
 *  sixth of the C minor it sits over, and it is this piece's first hint of the Neapolitan
 *  that closes the coda; the second (event 9, an eighth between bb and g over F) is a
 *  chromatic passing tone and resolves down by step inside two rows (§9.3). */
const ANSWER = shift(SUBJECT, -7)
/** The third entry, a fifth below THAT. Here two of the four transposed notes are long
 *  enough to be heard as chord tones and get the tonal answer's adjustment: event 3
 *  db4 -> d4 (the thirteenth of the F it sits on) and event 6 ab3 -> a3 (its third). The
 *  two SHORT ones stay: db4 at event 9 is the same chromatic eighth the answer has, and
 *  ab3 at event 12 turns the bar's B flat into a B flat 7 that resolves to E flat. */
const THIRD_ENTRY = shift(SUBJECT, -14, { 3: 'd4', 6: 'a3' })
/** S turned upside down about d5, diatonically, so the stair CLIMBS: the fourth-leaps
 *  fall and the walk rises, and the second link is a step HIGHER instead of lower. */
const INVERSION = invert(SUBJECT)
const INVERTED_HEAD = INVERSION.slice(0, 7)

/** CS — the countersubject, two bars: a rising line in even eighths and quarters against
 *  S's quarters and dotted quarter. Written over an F chord; `climb(CS, -1)` is its next
 *  link, one step lower, exactly as the subject's own second link is. */
const CS = [
  [2, 'a4', 11], [2, 'bb4', 11], [4, 'c5', 12], [4, 'f5', 12],
  [4, 'eb5', 12], [4, 'd5', 11], [2, 'c5', 11], [2, 'bb4', 11],
]

// =====================================================================================
// entries — frames 0–2: the exposition. Three voices, three rhythms, no bass and no kit
// until the counterpoint is complete. Harmony is ONE CHORD PER TWO BARS, which is what
// lets each entry enter a real fifth below the last: Gm · Cm · F · Bb · Eb · A dim · D7,
// seven links of falling fifths (§9.3's "sequence going somewhere").
// =====================================================================================
const entries = s.section('entries', 12)
{
  // P1  the subject alone (bars 0–3), then the countersubject and its next link down
  // (4–7), then the climb to the section's peak and a half cadence with a rest on it.
  phrase(entries, L.P1, UPPER, 0, SUBJECT, { volShift: -2, cutAtEnd: false })
  phrase(entries, L.P1, UPPER, entries.at(4), CS, { volShift: -2, cutAtEnd: false })
  phrase(entries, L.P1, UPPER, entries.at(6), climb(CS, -1), { volShift: -1, cutAtEnd: false })
  phrase(entries, L.P1, UPPER, entries.at(8), [
    [4, 'bb4', 12], [4, 'c5', 12], [4, 'd5', 13],
    [4, 'eb5', 13], [4, 'g5', 15], [4, 'f5', 13], // g5: the section's one peak, on a beat
    [4, 'eb5', 13], [4, 'c5', 12], [4, 'a4', 12], // the A dim triad, spelled downward
    [4, 'd5', 13], [4, 'c5', 12], [4, '-'],       // the breath: five lanes rest on 2:44
  ])
  // V1  the ANSWER, two bars in and a fifth below, while pulse 1 is still speaking; then
  // a countersubject of LONG notes (bars 6–7) so the three lines never share a rhythm;
  // then the inner harmony, ending on the leading tone the lead does not sing.
  phrase(entries, L.V1, ANSWER_V, entries.at(2), ANSWER, { volShift: -2, cutAtEnd: false })
  phrase(entries, L.V1, ANSWER_V, entries.at(6), [
    [8, 'f4', 10], [4, 'eb4', 10],
    [8, 'd4', 10], [4, 'eb4', 10],
    [4, 'g4', 9], [4, 'bb4', 9], [4, 'g4', 9],
    [12, 'bb4', 10],
    [12, 'a4', 10],
    [8, 'f#4', 11], [4, 'a4', 10],
  ])
  // SAW  the third entry, under both, another fifth down (bars 4–7); then it becomes the
  // running bass for the cadence — the moment the exposition turns into a piece.
  phrase(entries, L.SAW, SAW_VOICE, entries.at(4), THIRD_ENTRY, { volShift: -2, cutAtEnd: false })
  run(entries, 8, [
    ['eb3', 'g3', 'bb3', 'g3', 'eb3', 'f3'],
    ['g3', 'f3', 'eb3', 'd3', 'c3', 'bb2'],
    ['a2', 'c3', 'eb3', 'c3', 'a2', 'a2'],
    ['d3', 'f#3', 'a3', 'f#3', 'd3', 'c3'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // TRI  silent for eight bars, then the true bass arrives an octave under the saw.
  entries.put(L.TRI, 0, { note: CUT })
  for (const [bar, one, two] of [[8, 'eb2', 'eb2'], [9, 'eb2', 'bb1'], [10, 'a1', 'c2'], [11, 'd2', 'd2']]) {
    entries.put(L.TRI, entries.at(bar, 0), { note: n(one), inst: TRI_SHORT, vol: 15 })
    entries.put(L.TRI, entries.at(bar, 8), { note: n(two), inst: TRI_SHORT, vol: 15 })
  }
  // P2 / V2  the fourth and fifth voices are held back entirely: V2 joins the cadence as
  // one sustained chord tone a bar, pulse 2 waits for A, where it becomes the piece's
  // counter-voice. A lane that has not spoken yet is the cheapest crescendo there is.
  entries.put(L.P2, 0, { note: CUT })
  phrase(entries, L.V2, INNER_V, entries.at(8), [
    [12, 'bb3', 8], [12, 'g3', 8], [12, 'eb4', 9], [12, 'c4', 9],
  ])
  // NOISE  hats on the beats from bar 4 (the third entry), a short-mode metal tick on the
  // last eighth of bars 5 and 7; the full kit only at bar 8. FILL 1 at bar 11: two toms
  // tumbling into the snare, in the rest pulse 1 leaves.
  for (const bar of [4, 5, 6, 7]) hats(entries, bar, [0, 4, 8], { on: 6, off: 5 })
  for (const bar of [5, 7]) entries.put(L.NOISE, entries.at(bar, 10), { note: 44, inst: METAL, vol: 7 })
  for (const bar of [8, 9, 10, 11]) {
    entries.hits(L.NOISE, KICK, 12, [[bar, 0]])
    entries.hits(L.NOISE, SNARE, 12, [[bar, 8]])
    entries.hits(L.NOISE, SNARE, 4, [[bar, 11]])
    hats(entries, bar, [0, 2, 4, 6, 8, 10], { on: 8, off: 5 })
  }
  for (const r of [8, 9, 10, 11]) entries.lanes[L.NOISE][entries.at(11, r)] = null
  entries.hits(L.NOISE, TOM_LONG, 13, [[11, 8]], 43)
  entries.hits(L.NOISE, TOM_LONG, 13, [[11, 10]], 37)
  entries.hits(L.NOISE, SNARE, 14, [[11, 11]], 41)
  entries.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// A — frames 3–6 (THE LOOP TARGET): the stair with the band. The harmonic rhythm DOUBLES
// to one chord per bar — Gm Cm F Bb Eb Adim D7 Gm, the whole circle inside four bars of
// 3/4 — which is the section whose harmonic rhythm differs from every other (§9.3), and
// it is what turns the subject's link-heads into written 9–8 suspensions.
// =====================================================================================
const VIB = nib(4, 2) // 4xy: the album's medium singing vibrato, written a beat late

/** One bar of the A kit: kick on 1 and on the second eighth of beat 2, the snare on beat
 *  TWO of three (a backbeat that never lands where a 4/4 ear expects it), eighth hats, a
 *  ghost on the last sixteenth pushing into the next downbeat. */
function kitA(sec, bar, opts = {}) {
  const { open = false, crash = false, ghosts = [11] } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 11 })
  else sec.hits(L.NOISE, KICK, 12, [[bar, 0]])
  sec.hits(L.NOISE, SNARE, 12, [[bar, 4]])
  sec.hits(L.NOISE, KICK, 11, [[bar, 6]])
  sec.hits(L.NOISE, SNARE, 4, ghosts.map((r) => [bar, r]))
  if (open) sec.hits(L.NOISE, OHAT, 8, [[bar, 10]])
  hats(sec, bar, [0, 2, 4, 6, 8, 10], { on: 8, off: 5 })
}

const A = s.section('A', 16)
{
  // P1  the subject (0–3); the landing phrase that cadences with the melody RISING a step
  // into bar 7 while the bass falls a fifth (4:36, contrary motion); the subject again
  // with its second link INVERTED — the stair climbs for four bars (8–11) — then the rise
  // to the section's single peak a5 (5:36) and the hemiola.
  phrase(A, L.P1, UPPER, 0, SUBJECT, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(A, L.P1, UPPER, A.at(4), [
    [4, 'bb4', 12], [2, 'c5', 12], [2, 'd5', 12], [4, 'eb5', 13],   // Eb
    [6, 'c5', 12], [2, 'eb5', 12], [4, 'a4', 12],                   // A dim
    [4, 'd5', 13], [2, 'c5', 12], [2, 'bb4', 12], [4, 'a4', 12],    // D7
    [6, 'bb4', 13], [2, 'a4', 12], [4, 'g4', 12],                   // Gm — the cadence
    [4, 'd5', 13], [2, 'g5', 14], [2, 'f5', 13], [4, 'eb5', 13],    // Gm
    [6, 'd5', 13], [2, 'c5', 12], [4, 'bb4', 12],                   // Cm
    [4, 'c5', 13], [2, 'g4', 12], [2, 'a4', 12], [4, 'bb4', 12],    // F — the leap FALLS
    [6, 'c5', 12], [2, 'd5', 12], [4, 'f5', 13],                    // Bb — and the walk rises
    [4, 'eb5', 13], [4, 'f5', 13], [4, 'g5', 14],                   // Eb
    [4, 'a5', 15], [2, 'g5', 13], [2, 'f5', 13], [4, 'eb5', 13],    // Cm — the peak
    [8, 'd5', 14], [8, 'c5', 13], [8, 'bb4', 14],                   // D7 — hemiola, 3 x 8
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  THE SUSPENSION CHAIN, and pulse 2's whole section as an independent voice (§9.2).
  // The subject attacks on rows 0, 4, 6 and 8 of a bar and never on 2 or 10, so the chain
  // is written on exactly those two rows: struck on the LAST EIGHTH of the bar, held
  // through the downbeat into a chord it is dissonant with, resolved down by step two
  // rows later. Every one of pulse 2's attacks in this section falls where pulse 1 has
  // none — §9.2 asks for forty per cent — and the syncopation is its own metre, not the
  // lead's at another interval. The link struck at 4:34 is the cadential 4-3: c4 over the
  // returning tonic, resolving to bb3 at 4:38.
  A.put(L.P2, 0, { note: CUT })
  /** `[strike, resolution]` per bar, the resolution landing on row 2 of the NEXT bar;
   *  `null` is the breath at the first cadence. Over Gm Cm F Bb Eb Adim D7 Gm | Gm Cm F
   *  Bb Eb Cm these are, in order, 9-8, 7-6, 9-8, 7-6, b9-8, b9-8, 4-3, then again. */
  const CHAIN = [
    ['d4', 'c4'], ['eb4', 'd4'], ['c4', 'bb3'], ['d4', 'c4'], ['bb3', 'a3'], ['eb4', 'd4'],
    ['c4', 'bb3'], null, ['d4', 'c4'], ['eb4', 'd4'], ['c4', 'bb3'], ['d4', 'c4'], ['d4', 'c4'],
  ]
  // Each link starts straight and begins to SING exactly on the bar line, where it turns
  // into the dissonance: `431` written on row 0 of the new bar, cancelled with `4x0` — the
  // depth nibble, not a zero param — on the resolution two rows later.
  const SING = nib(3, 1)
  CHAIN.forEach((link, bar) => {
    if (link === null) return
    A.put(L.P2, A.at(bar, 10), { note: n(link[0]), inst: INNER2, vol: 11 })
    A.put(L.P2, A.at(bar + 1, 0), { fx: [['4', SING]] })
    A.put(L.P2, A.at(bar + 1, 2), { note: n(link[1]), inst: INNER2, vol: 10, fx: [['4', 0]] })
    A.put(L.P2, A.at(bar + 1, 6), { note: CUT })
  })
  // in the hemiola pulse 2 takes the 8-row groups too, but HALF A GROUP LATE, so the
  // regrouping is itself in two parts
  ;['c4', 'bb3', 'a3'].forEach((note, i) => {
    A.put(L.P2, A.at(14, 0) + 4 + i * 8, { note: n(note), inst: INNER2, vol: i === 0 ? 11 : 10 })
  })
  A.put(L.P2, A.len - 1, { note: CUT })
  // V1  the inner voice: one held note a bar, rising d4 -> a4 against the subject's fall,
  // the duty opening 7 -> 3 on every change. In the hemiola it restrikes on the 8-row
  // groups instead of the bar, which is what makes the regrouping audible.
  phrase(A, L.V1, ANSWER_V, 0, [
    [12, 'd4', 9], [12, 'eb4', 9], [12, 'f4', 9], [12, 'f4', 9],
    [12, 'g4', 10], [12, 'a4', 10], [12, 'a4', 10], [12, 'g4', 9],
    [12, 'd4', 9], [12, 'eb4', 9], [12, 'f4', 10], [12, 'f4', 10],
    [12, 'g4', 10], [12, 'eb4', 10],
    [8, 'f#4', 11], [8, 'a4', 11], [8, 'f#4', 11],
  ])
  // V2  silent for eight bars and then a detached off-beat ping an octave above V1 — the
  // arrangement THICKENS at the halfway point without one extra sustained voice. Rows 2,
  // 6 and 10 are the three off-eighths of a 3/4 bar, so it lands where nothing else does.
  A.put(L.V2, 0, { note: CUT })
  const A_PING = ['bb4', 'c5', 'c5', 'd5', 'bb4', 'c5'] // the chord's upper tone, bars 8–13
  A_PING.forEach((note, i) => {
    for (const r of [2, 6, 10]) A.put(L.V2, A.at(8 + i, r), { note: n(note), inst: PING, vol: 8 })
  })
  for (const r of [0, 8, 16]) A.put(L.V2, A.at(14, 0) + r, { note: n('d5'), inst: PING, vol: 9 })
  // SAW  the running bass: six detached eighths a bar, the beat's own eighth a step
  // louder. Bars 0–3 arpeggiate the falling fifths, 4–7 walk them by step, 8–13 are a
  // stepwise line that climbs out of the cadence, and in the hemiola the bass HOLDS.
  run(A, 0, [
    ['g2', 'd3', 'bb2', 'd3', 'g2', 'a2'], ['c3', 'g3', 'eb3', 'g3', 'c3', 'd3'],
    ['f2', 'c3', 'a2', 'c3', 'f2', 'g2'], ['bb2', 'f3', 'd3', 'f3', 'bb2', 'c3'],
    ['eb3', 'f3', 'g3', 'f3', 'eb3', 'd3'], ['c3', 'a2', 'c3', 'eb3', 'c3', 'bb2'],
    ['a2', 'c3', 'd3', 'f#3', 'a3', 'g3'], ['g2', 'bb2', 'd3', 'g3', 'd3', 'bb2'],
    ['g2', 'a2', 'bb2', 'c3', 'd3', 'eb3'], ['c3', 'bb2', 'a2', 'g2', 'f2', 'g2'],
    ['f2', 'g2', 'a2', 'c3', 'a2', 'g2'], ['bb2', 'c3', 'd3', 'f3', 'd3', 'c3'],
    ['eb3', 'd3', 'c3', 'bb2', 'g2', 'bb2'], ['c3', 'eb3', 'g3', 'eb3', 'c3', 'bb2'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // a beat of air every fourth bar: the engine of the piece has to be heard stopping, or
  // the report's flat column of 24 attacks a frame is what it actually sounds like
  for (const bar of [3, 7, 11]) for (const r of [8, 10]) A.lanes[L.SAW][A.at(bar, r)] = null
  A.put(L.SAW, A.at(3, 8), { note: CUT })
  A.put(L.SAW, A.at(7, 8), { note: CUT })
  A.put(L.SAW, A.at(11, 8), { note: CUT })
  A.put(L.SAW, A.at(14, 0), { note: n('d3'), inst: SAW_HOLD, vol: 9 })
  A.put(L.SAW, A.at(15, 8), { note: CUT })
  // TRI  detached roots on beats 1 and 3, an octave under the saw so the two basses never
  // hammer one register; under the hemiola it holds the dominant for both bars, which is
  // the pedal the regrouping needs to argue with (§9.1 recipe E).
  const A_ROOTS = ['g1', 'c2', 'f1', 'bb1', 'eb2', 'a1', 'd2', 'g1', 'g1', 'c2', 'f1', 'bb1', 'eb2', 'c2']
  // `G01` on beat 3 only: one tick late against the kit is feel, not a rhythmic event
  // (§2.7 caps humanisation at two ticks and keeps it off a section downbeat).
  A_ROOTS.forEach((note, bar) => {
    A.put(L.TRI, A.at(bar, 0), { note: n(note), inst: TRI_SHORT, vol: 15 })
    A.put(L.TRI, A.at(bar, 8), { note: n(note), inst: TRI_SHORT, vol: 15, fx: [['G', 1]] })
  })
  // and a chromatic-free passing eighth on the last sixteenth of bars 3, 7 and 11, which
  // is the only place this lane ever plays off the beat
  for (const [bar, note] of [[3, 'c2'], [7, 'a1'], [11, 'c2']]) {
    A.put(L.TRI, A.at(bar, 11), { note: n(note), inst: TRI_SHORT, vol: 15 })
  }
  A.put(L.TRI, A.at(14, 0), { note: n('d2'), inst: TRI_LONG, vol: 15 })
  A.put(L.TRI, A.len - 1, { note: CUT })
  // NOISE  the A kit; a crash on the downbeat; FILL 2 at bar 7 (toms tumbling into the
  // high snare) and FILL 3 at 6:44 (a riser alone, four rows, into B) — no two fills in
  // this piece are the same, and the hemiola bars carry the kick on the 8-row groups
  // instead of the bar so the kit regroups with the inner voices.
  for (let bar = 0; bar < 14; bar++) {
    kitA(A, bar, { crash: bar === 0, open: bar % 4 === 3, ghosts: bar % 2 ? [3, 11] : [11] })
    // the ghost pushing into the next downbeat is flammed two ticks late — a third of a
    // row at speed 6, which is feel; `Gxx` is not a channel mode and needs no cancel.
    A.put(L.NOISE, A.at(bar, 11), { fx: [['G', 2]] })
  }
  for (const r of range(6, 12)) A.lanes[L.NOISE][A.at(7, r)] = null
  A.hits(L.NOISE, TOM_LONG, 13, [[7, 6]], 43)
  A.hits(L.NOISE, TOM_LONG, 13, [[7, 8]], 37)
  A.hits(L.NOISE, SNARE, 13, [[7, 10], [7, 11]], 41)
  for (const r of [0, 8, 16]) {
    A.put(L.NOISE, A.at(14, 0) + r, { note: 36, inst: KICK, vol: 12 })
    A.put(L.NOISE, A.at(14, 0) + r + 4, { note: 39, inst: SNARE, vol: 11 })
  }
  hats(A, 14, [2, 6, 10], { on: 6, off: 6 })
  hats(A, 15, [2, 6], { on: 6, off: 6 })
  A.hits(L.NOISE, RISER, 12, [[15, 8]])
  A.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// B — frames 7–8: THE STAIR ITSELF (§9.3 device one). Six bars of a chromatic bass
// descent, g–f#–f–e–eb–d, one link a bar, under upper voices that barely move: the
// harmony is implied by the collision, exactly as the recipe says. Then TWO bars of
// dominant — the 6 + 2 phrasing that is this piece's one asymmetry. Hats and nothing
// else on the kit; the sawtooth is silent for six bars; pulse 2 does not play at all
// until bar 6, so B is the first of the two sections where the arrangement thins.
// =====================================================================================
const B = s.section('B', 8)
{
  // TRI  the walk. Each link is a whole bar, struck on beat 1 and again on beat 3 so the
  // step is heard twice before the next. f#2 and e2 are the two chromatic links.
  const DESCENT = ['g2', 'f#2', 'f2', 'e2', 'eb2', 'd2']
  DESCENT.forEach((note, bar) => {
    B.put(L.TRI, B.at(bar, 0), { note: n(note), inst: TRI_LONG, vol: 15 })
    B.put(L.TRI, B.at(bar, 8), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  B.put(L.TRI, B.at(6, 0), { note: n('d2'), inst: TRI_SHORT, vol: 15 })
  B.put(L.TRI, B.at(6, 8), { note: n('a1'), inst: TRI_SHORT, vol: 15 })
  B.put(L.TRI, B.at(7, 0), { note: n('d2'), inst: TRI_SHORT, vol: 15 })
  B.put(L.TRI, B.at(7, 6), { note: n('d2'), inst: TRI_SHORT, vol: 15 })
  // V1 / V2  the two held voices. V1 sinks d4 -> a3 by step across the six bars and V2
  // shadows it a third or a fourth under; the interesting chords are the ones neither
  // voice writes — Gm over F at 7:24, and the C7 the e2 makes at 7:36.
  phrase(B, L.V1, INNER_V, 0, [
    [12, 'd4', 9], [12, 'd4', 9], [12, 'd4', 9], [12, 'c4', 9], [12, 'bb3', 9], [12, 'a3', 9],
    [12, 'a3', 10], [6, 'a3', 10], [6, 'c4', 10],
  ], { fade: 0x20, fadeAfter: 7 })
  phrase(B, L.V2, INNER_V, 0, [
    [12, 'bb3', 8], [12, 'a3', 8], [12, 'bb3', 8], [12, 'g3', 8], [12, 'g3', 8], [12, 'f#3', 9],
    [12, 'f#3', 9], [6, 'f#3', 9], [6, 'a3', 9],
  ], { fade: 0x20, fadeAfter: 7 })
  // P1  silent for two bars — the descent is the event — then a slow descant in whole
  // bars, then the rising upbeat that hands the subject to the stretto.
  B.put(L.P1, 0, { note: CUT })
  phrase(B, L.P1, UPPER, B.at(2), [
    [12, 'd5', 12], [12, 'c5', 12], [8, 'bb4', 12], [4, 'c5', 11], [12, 'bb4', 12],
    [4, 'a4', 11], [4, 'c5', 12], [4, 'd5', 12],
    [8, 'a4', 12], [2, 'bb4', 12], [2, 'c5', 13],
  ], { vib: VIB, vibMin: 8, vibAfter: 5, cutAtEnd: false })
  // P2  rests through the descent (with the saw, that is two lanes resting for six bars,
  // §2.8's rest-as-mix) and answers only in the two-bar tag.
  B.put(L.P2, 0, { note: CUT })
  phrase(B, L.P2, INNER2, B.at(6), [
    [4, 'd4', 10], [4, 'e4', 10], [4, 'f#4', 11], [6, 'g4', 11], [2, 'f#4', 10], [4, 'a4', 11],
  ])
  // SAW  six bars off, then eighths on the dominant to drive into the stretto.
  B.put(L.SAW, 0, { note: CUT })
  run(B, 6, [['d3', 'a2', 'd3', 'f#3', 'd3', 'a2'], ['d3', 'a2', 'd3', 'a3', 'f#3', 'd3']]
    .map((bar) => bar.map((x) => n(x))), 11)
  // NOISE  hats only for six bars — the one section with no kick and no backbeat — with a
  // short-mode metal tick on the last eighth of each pair of bars. The kit returns for the
  // tag, and FILL 4 (8:44) is four rim ticks, unlike anything else in the piece.
  for (const bar of range(0, 6)) {
    hats(B, bar, [0, 4, 8], { on: 6, off: 5 })
    if (bar % 2 === 1) B.put(L.NOISE, B.at(bar, 10), { note: 44, inst: METAL, vol: 6 })
  }
  for (const bar of [6, 7]) {
    B.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 6]])
    B.hits(L.NOISE, SNARE, 12, [[bar, 4]])
    hats(B, bar, [0, 2, 4, 6, 8, 10], { on: 8, off: 5 })
  }
  for (const r of range(8, 12)) B.lanes[L.NOISE][B.at(7, r)] = null
  B.hits(L.NOISE, RIM, 11, [[7, 8], [7, 9], [7, 10], [7, 11]], 44)
  B.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// stretto — frames 9–12: imitation brought back TRANSFORMED, the entries one bar apart
// instead of two. Four voices take the subject's head down the circle of fifths, each a
// real fifth under the last, one bar later: pulse 1 at 9:0, VRC6 p1 at 9:12, VRC6 p2 at
// 9:24, the sawtooth at 9:36. Then four bars of rhythmic unison — the only parallel
// writing in the piece, and the loudest place in it — and a second hemiola unlike the
// first. This is the section that thickens, and the only one with DPCM.
// =====================================================================================
const stretto = s.section('stretto', 16)
{
  // P1 / V1 / V2 / SAW  the four entries. The transposition adjustments are the same two
  // the exposition made and for the same reasons: a long db becomes d, a long ab becomes
  // a, and the SHORT a-flats stay, because each turns its bar into a seventh chord that
  // resolves down the circle (9:44 makes B flat 7 -> E flat).
  phrase(stretto, L.P1, UPPER, 0, HEAD, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(stretto, L.V1, ANSWER_V, stretto.at(1), shift(HEAD, -7), { cutAtEnd: false })
  stretto.put(L.V2, 0, { note: CUT })
  phrase(stretto, L.V2, INNER_V, stretto.at(2), shift(HEAD, -14, { 3: 'd4' }), { cutAtEnd: false })
  stretto.put(L.SAW, 0, { note: CUT })
  phrase(stretto, L.SAW, SAW_VOICE, stretto.at(3), shift(HEAD, -19), { volShift: -2, cutAtEnd: false })
  // …and the cadence the cascade lands on, bars 4–7, the melody rising a step into bar 7
  // while the bass falls a fifth (10:36, the second contrary-motion cadence).
  phrase(stretto, L.P1, UPPER, stretto.at(4), [
    [4, 'g5', 14], [2, 'f5', 13], [2, 'eb5', 13], [4, 'd5', 13],  // Eb
    [4, 'c5', 13], [4, 'eb5', 13], [4, 'a4', 12],                 // A dim
    [6, 'd5', 13], [2, 'c5', 12], [4, 'a4', 12],                  // D7
    [6, 'bb4', 13], [2, 'a4', 12], [4, 'g4', 12],                 // Gm
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(stretto, L.V1, ANSWER_V, stretto.at(3, 8), [
    [4, 'eb4', 10], [12, 'g4', 10], [12, 'a4', 10], [12, 'f#4', 11], [8, 'g4', 10], [4, 'd4', 10],
  ], { cutAtEnd: false })
  phrase(stretto, L.V2, INNER_V, stretto.at(4), [
    [12, 'bb3', 8], [12, 'c4', 8], [12, 'c4', 9], [12, 'bb3', 9],
  ], { cutAtEnd: false })
  run(stretto, 5, [
    ['a2', 'c3', 'eb3', 'c3', 'a2', 'g2'], ['d3', 'a2', 'f#3', 'a2', 'd3', 'c3'],
    ['g2', 'd3', 'bb2', 'd3', 'g2', 'a2'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // P2  rests through the whole cascade — five imitating voices would be a crowd, not a
  // stretto — and answers alone in bar 13, where the texture has just emptied.
  stretto.put(L.P2, 0, { note: CUT })
  // bars 8–11  THE SLAM: five lanes on the subject's own rhythm at once, spelling one
  // chord a bar down the fall (Cm F Bb Eb). Parallel writing is a rubric failure as a
  // default posture and an earned gesture at four bars (§9.2) — it is earned here by the
  // eight bars of four-voice independence that just happened, and it never returns.
  const SLAM = [
    // [lane, inst, vol, bar 8 (4 2 2 4) · bar 9 (6 2 4) · bar 10 (4 2 2 4) · bar 11 (6 2 4)]
    [L.P1, UPPER, 15, ['c5', 'eb5', 'd5', 'c5'], ['c5', 'bb4', 'a4'], ['bb4', 'd5', 'c5', 'bb4'], ['bb4', 'a4', 'g4']],
    [L.V1, ANSWER_V, 12, ['g4', 'g4', 'bb4', 'g4'], ['a4', 'g4', 'f4'], ['f4', 'f4', 'a4', 'f4'], ['g4', 'f4', 'eb4']],
    [L.V2, INNER_V, 11, ['eb4', 'c4', 'eb4', 'eb4'], ['f4', 'eb4', 'c4'], ['d4', 'bb3', 'd4', 'd4'], ['eb4', 'd4', 'bb3']],
    [L.SAW, SAW_RUN, 12, ['c3', 'c3', 'c3', 'c3'], ['f2', 'f2', 'f2'], ['bb2', 'bb2', 'bb2', 'bb2'], ['eb3', 'eb3', 'eb3']],
    [L.TRI, TRI_SHORT, 15, ['c2', 'c2', 'c2', 'c2'], ['f1', 'f1', 'f1'], ['bb1', 'bb1', 'bb1', 'bb1'], ['eb2', 'eb2', 'eb2']],
  ]
  for (const [lane, inst, vol, b8, b9, b10, b11] of SLAM) {
    for (const [bar, notes, lens] of [[8, b8, [4, 2, 2, 4]], [9, b9, [6, 2, 4]], [10, b10, [4, 2, 2, 4]], [11, b11, [6, 2, 4]]]) {
      let r = stretto.at(bar)
      notes.forEach((note, i) => {
        stretto.put(lane, r, { note: n(note), inst, vol: lens[i] >= 4 ? vol : vol - 1 })
        r += lens[i]
      })
    }
  }
  // bars 12–13  the texture empties to a two-voice question and answer: pulse 1 asks over
  // the C minor, pulse 2 answers alone over the dominant and takes the leading tone.
  phrase(stretto, L.P1, UPPER, stretto.at(12), [[4, 'eb5', 13], [2, 'd5', 12], [2, 'c5', 12], [4, 'bb4', 12]])
  phrase(stretto, L.P2, INNER2, stretto.at(13), [[4, 'a4', 11], [4, 'g4', 11], [4, 'f#4', 12]])
  run(stretto, 12, [['c3', 'g2', 'eb3', 'g2', 'c3', 'bb2'], ['d3', 'a2', 'f#3', 'a2', 'd3', 'a2']]
    .map((bar) => bar.map((x) => n(x))), 11)
  // bars 14–15  HEMIOLA TWO, and deliberately not the first one: there the inner voices
  // and the kick took the 8-row groups over a held bass; here the SAWTOOTH and the snare
  // take them while the hats keep the 4-row beat underneath, so both metres sound at
  // once, the backbeat disappears, and pulse 1 holds one note straight through as if it
  // had not noticed. 24 rows = 3 x 8, closing exactly on the section line.
  phrase(stretto, L.P1, UPPER, stretto.at(14), [[24, 'd5', 13]], { vib: VIB, vibMin: 8, vibAfter: 6 })
  ;[['d3', 0], ['a2', 8], ['d3', 16]].forEach(([note, off]) => {
    stretto.put(L.SAW, stretto.at(14, 0) + off, { note: n(note), inst: SAW_HOLD, vol: 9 })
    stretto.put(L.NOISE, stretto.at(14, 0) + off, { note: 41, inst: SNARE, vol: 12 })
  })
  stretto.put(L.TRI, stretto.at(14, 0), { note: n('d2'), inst: TRI_LONG, vol: 15 })
  stretto.put(L.TRI, stretto.len - 1, { note: CUT })
  stretto.put(L.V1, stretto.at(14, 0), { note: CUT })
  stretto.put(L.V2, stretto.at(14, 0), { note: CUT })
  // TRI  roots on beats 1 and 3 for the cascade; the slam and the hemiola write their own.
  const ST_ROOTS = ['g1', 'c2', 'f1', 'bb1', 'eb2', 'a1', 'd2', 'g1']
  ST_ROOTS.forEach((note, bar) => {
    for (const r of [0, 8]) stretto.put(L.TRI, stretto.at(bar, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  for (const [bar, note] of [[12, 'c2'], [13, 'd2']]) {
    for (const r of [0, 8]) stretto.put(L.TRI, stretto.at(bar, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  }
  // NOISE / DPCM  kit C: the kick alone on beat 1, the HIGH snare (41) cracking on beats
  // 2 AND 3 — a double backbeat that exists nowhere else here — ghosts on the last
  // sixteenth of every beat, and the hats moved onto the off-eighths because the beats
  // are taken. The DPCM pair doubles the kick and snare, and the TND duck it costs the
  // triangle is the pump: it fires where the bass is already being restruck.
  for (const bar of range(0, 14)) {
    if (bar === 0 || bar === 8) stretto.put(L.NOISE, stretto.at(bar, 0), { note: 46, inst: CRASH, vol: 11 })
    else stretto.hits(L.NOISE, KICK, 12, [[bar, 0]])
    stretto.hits(L.NOISE, SNARE, 12, [[bar, 4], [bar, 8]], 41)
    stretto.hits(L.NOISE, SNARE, 4, [[bar, 3], [bar, 7], [bar, 11]])
    hats(stretto, bar, [2, 6, 10], { on: 7, off: 6 })
    stretto.hits(L.DPCM, KIT.inst, 12, [[bar, 0]], KIT.kick)
    // the off-beat kick sits one tick behind — `Gxx` costs this sample a tick of its tail
    // and buys the lane the only articulation a two-sample kit has
    stretto.hits(L.DPCM, KIT.inst, bar % 2 ? 10 : 8, [[bar, 6, 'G', 1]], KIT.kick)
    stretto.hits(L.DPCM, KIT.inst, 11, [[bar, 4]], KIT.snare)
  }
  hats(stretto, 14, [0, 4, 8], { on: 6, off: 6 })
  hats(stretto, 15, [0, 4, 8], { on: 6, off: 6 })
  // FILL 5 (10:44): a sixteenth kick-and-snare stutter, no toms. FILL 6 (11:44): the toms
  // in high–low pairs. Neither is any other fill in the piece.
  for (const r of range(8, 12)) stretto.lanes[L.NOISE][stretto.at(7, r)] = null
  stretto.hits(L.NOISE, KICK, 12, [[7, 8], [7, 9]])
  stretto.hits(L.NOISE, SNARE, 13, [[7, 10], [7, 11]], 41)
  for (const r of range(8, 12)) stretto.lanes[L.NOISE][stretto.at(11, r)] = null
  stretto.hits(L.NOISE, TOM_LONG, 13, [[11, 8]], 43)
  stretto.hits(L.NOISE, TOM_LONG, 13, [[11, 9]], 37)
  stretto.hits(L.NOISE, TOM_LONG, 13, [[11, 10]], 43)
  stretto.hits(L.NOISE, SNARE, 13, [[11, 11]], 41)
  stretto.put(L.NOISE, stretto.at(11, 11), { fx: [['G', 3]] }) // the fill's last hit flams
}

// =====================================================================================
// landing — frames 13–14: TWO VOICES AND NOTHING ELSE. No bass, no kit, no harmony. The
// subject arrives INVERTED, so for eight bars the stair climbs instead of falling, and
// the answer follows at ONE bar and a fourth below — closer than the exposition's two
// bars, which is the same tightening the stretto made, now heard naked. Six lanes rest.
// =====================================================================================
const landing = s.section('landing', 8)
{
  // P1  the subject upside down: every fourth-leap falls, every walk rises, and the
  // second link is a step HIGHER than the first instead of a step lower.
  phrase(landing, L.P1, UPPER, 0, INVERSION, { vib: VIB, vibMin: 6, vibAfter: 3, volShift: -2, cutAtEnd: false })
  phrase(landing, L.P1, UPPER, landing.at(4), [
    [4, 'f5', 12], [4, 'eb5', 12], [4, 'd5', 12],
    [4, 'c5', 12], [4, 'bb4', 12], [4, 'a4', 11],
    [6, 'bb4', 11], [2, 'a4', 11], [4, 'g4', 11],
    [12, 'a4', 11],
  ], { vib: VIB, vibMin: 6, vibAfter: 4, volShift: -2 })
  // the two-voice section ends with the lead falling away under the held leading tone
  landing.put(L.P1, landing.at(7, 7), { fx: [['R', nib(2, 5)]] })
  // V1  the same inversion a bar later, three scale steps down — the answer at the fourth
  // — then three free bars that settle onto the leading tone and hold it, so A' resolves
  // f# -> g across the section line with nothing else sounding.
  landing.put(L.V1, 0, { note: CUT })
  phrase(landing, L.V1, ANSWER_V, landing.at(1), climb(INVERSION, -3), { volShift: -4, cutAtEnd: false })
  phrase(landing, L.V1, ANSWER_V, landing.at(5), [
    [4, 'd5', 10], [4, 'c5', 10], [4, 'bb4', 10],
    [6, 'g4', 10], [2, 'a4', 10], [4, 'bb4', 10],
    [12, 'f#4', 10],
  ], { volShift: -3 })
  // everything else: silent for eight bars. The kit's return in A' is the loudest thing
  // in the piece precisely because nothing here prepares it — and there is no fill on the
  // seam into this section either, for the same reason.
  for (const lane of [L.P2, L.TRI, L.NOISE, L.DPCM, L.V2, L.SAW]) landing.put(lane, 0, { note: CUT })
}

// =====================================================================================
// A' — frames 15–18: imitation a third time, and the transformation the brief asks for.
// For eight bars the TRIANGLE plays the subject in AUGMENTATION three octaves down, one
// note every two beats, while pulse 1 plays it INVERTED above — the bass falls the stair
// in slow motion while the top voice climbs it. The sawtooth is silent for those eight
// bars, which is the second place the arrangement thins. The harmony is whatever the
// augmented bass implies: D Gm | F Eb | Gm/D | Cm Eb/Bb | Cm F | Eb D7 | Cm | Bb Adim.
// =====================================================================================
const AP = s.section("A'", 16)
{
  // TRI  S in augmentation at -36: every value twice as long, so four bars become eight.
  phrase(AP, L.TRI, TRI_LONG, 0, augment(shift(SUBJECT, -36)), { fixedVol: 15, cutAtEnd: false })
  // P1  S inverted (0–3), then a descant that keeps the inversion's rising shape (4–7).
  phrase(AP, L.P1, UPPER, 0, INVERSION, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(AP, L.P1, UPPER, AP.at(4), [
    [4, 'g5', 13], [2, 'f5', 13], [2, 'eb5', 12], [4, 'c5', 12],   // Cm F
    [6, 'bb4', 12], [2, 'c5', 12], [4, 'a4', 12],                  // Eb D7
    [4, 'c5', 12], [2, 'eb5', 12], [2, 'd5', 12], [4, 'c5', 12],   // Cm
    [6, 'd5', 12], [2, 'c5', 12], [4, 'a4', 12],                   // Bb Adim
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // …and S AT PITCH again for bars 8–11, over A's own one-chord-a-bar harmony, so the
  // return is heard as a return; then the close, bars 12–15.
  phrase(AP, L.P1, UPPER, AP.at(8), SUBJECT, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(AP, L.P1, UPPER, AP.at(12), [
    [4, 'eb5', 13], [4, 'd5', 12], [4, 'c5', 12],                  // Eb
    [4, 'eb5', 13], [4, 'c5', 12], [4, 'a4', 12],                  // A dim
    [6, 'c5', 13], [2, 'bb4', 12], [4, 'a4', 12],                  // D7
    [4, 'd5', 13], [2, 'c5', 12], [2, 'bb4', 12], [4, 'a4', 12],   // D7
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  four bars of silence under the two-line canon, then the same chain on the same
  // two rows the subject never uses. Its last link, g4 struck at 18:34 over the dominant
  // and resolving to f#4 at 18:38, is the second cadential 4-3.
  AP.put(L.P2, 0, { note: CUT })
  const AP_CHAIN = [
    [4, 'eb4', 'd4'], [5, 'c4', 'bb3'], [6, 'd4', 'c4'],
    [8, 'd4', 'c4'], [9, 'eb4', 'd4'], [10, 'c4', 'bb3'], [11, 'd4', 'c4'],
    [12, 'bb3', 'a3'], [13, 'eb4', 'd4'], [14, 'g4', 'f#4'],
  ]
  for (const [bar, strike, resolve] of AP_CHAIN) {
    AP.put(L.P2, AP.at(bar, 10), { note: n(strike), inst: INNER2, vol: 11 })
    AP.put(L.P2, AP.at(bar + 1, 0), { fx: [['4', nib(3, 1)]] })
    AP.put(L.P2, AP.at(bar + 1, 2), { note: n(resolve), inst: INNER2, vol: 10, fx: [['4', 0]] })
    AP.put(L.P2, AP.at(bar + 1, 6), { note: CUT })
  }
  // V1  chord tones drawn from what the augmented bass implies, moving by step.
  phrase(AP, L.V1, ANSWER_V, 0, [
    [8, 'f#4', 9], [4, 'g4', 9], [4, 'a4', 9], [8, 'g4', 9], [12, 'g4', 9], [4, 'eb4', 9], [8, 'g4', 9],
    [8, 'eb4', 9], [4, 'a4', 9], [4, 'g4', 9], [8, 'f#4', 10], [12, 'g4', 9], [4, 'f4', 9], [8, 'eb4', 9],
    [12, 'd4', 9], [12, 'eb4', 9], [12, 'f4', 10], [12, 'f4', 10],
    [12, 'g4', 10], [12, 'eb4', 10], [12, 'f#4', 10], [12, 'a4', 10],
  ])
  // V2  the fourth voice UNDER the canon, not over it: an octave below where it sits
  // everywhere else, so the stack reads triangle · V2 · V1 · pulse 1 with a clean fourth
  // or fifth between each. It hands the register to pulse 2 at bar 4 and stays out until
  // the cadence — two voices in one octave is the failure §2.1 names, and this is the
  // section where it would have happened.
  phrase(AP, L.V2, INNER_V, 0, [
    [8, 'a3', 9], [4, 'd4', 9], [4, 'c4', 9], [8, 'bb3', 9], [12, 'bb3', 9], [4, 'c4', 9], [8, 'bb3', 9],
    [96, '-'],
    [12, 'bb4', 9], [12, 'a4', 9], [12, 'd5', 9], [12, 'c5', 9],
  ])
  // SAW  eight bars off — with the triangle three octaves down and the kit at half time,
  // A' opens as the thinnest full-band texture in the piece — then the running bass
  // returns under the subject's return and drives the cadence.
  AP.put(L.SAW, 0, { note: CUT })
  run(AP, 8, [
    ['g2', 'd3', 'bb2', 'd3', 'g2', 'a2'], ['c3', 'g3', 'eb3', 'g3', 'c3', 'd3'],
    ['f2', 'c3', 'a2', 'c3', 'f2', 'g2'], ['bb2', 'f3', 'd3', 'f3', 'bb2', 'c3'],
    ['eb3', 'bb2', 'g3', 'bb2', 'eb3', 'd3'], ['a2', 'eb3', 'c3', 'eb3', 'a2', 'bb2'],
    ['d3', 'a2', 'f#3', 'a2', 'd3', 'c3'], ['d3', 'f#3', 'a3', 'f#3', 'd3', 'a2'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // TRI  the augmented subject ends at bar 8; from there the ordinary detached roots.
  const AP_ROOTS = ['g1', 'c2', 'f1', 'bb1', 'eb2', 'a1', 'd2', 'd2']
  AP_ROOTS.forEach((note, i) => {
    for (const r of [0, 8]) AP.put(L.TRI, AP.at(8 + i, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  // NOISE  kit D, and the two things that make it a different kit: the hats are OPEN and
  // on the three off-eighths, and the backbeat sits on beat 2 with a rim answering it on
  // the last eighth. Bars 0–7 are half time — kick on 1, snare on 3, nothing else — so
  // the augmented bass is audible; bars 8–15 fill in. FILL 7 at 16:44 (kicks into an
  // open hat), FILL 8 at 18:44 (three metal ticks falling away into the spiral).
  for (const bar of range(0, 8)) {
    AP.hits(L.NOISE, KICK, 12, [[bar, 0]])
    AP.hits(L.NOISE, SNARE, 11, [[bar, 8]])
    AP.hits(L.NOISE, OHAT, 7, [[bar, 2], [bar, 6], [bar, 10]])
  }
  for (const bar of range(8, 16)) {
    AP.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 8]])
    AP.hits(L.NOISE, SNARE, 12, [[bar, 4]])
    AP.hits(L.NOISE, SNARE, 5, [[bar, 11]])
    AP.hits(L.NOISE, OHAT, 8, [[bar, 2], [bar, 6]])
    AP.hits(L.NOISE, RIM, 8, [[bar, 10]], 44)
  }
  for (const r of range(8, 12)) AP.lanes[L.NOISE][AP.at(7, r)] = null
  AP.hits(L.NOISE, KICK, 12, [[7, 8], [7, 9]])
  AP.hits(L.NOISE, OHAT, 10, [[7, 10]])
  for (const r of range(8, 12)) AP.lanes[L.NOISE][AP.at(15, r)] = null
  AP.hits(L.NOISE, METAL, 10, [[15, 8]], 44)
  AP.hits(L.NOISE, METAL, 7, [[15, 9]], 44)
  AP.hits(L.NOISE, METAL, 5, [[15, 10]], 44)
  AP.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// spiral — frames 19–21: the sequence driven. The harmonic rhythm doubles again to TWO
// chords a bar, six rows each, two complete circles of falling fifths in eight bars, and
// the register falls with it. VRC6 pulse 2 carries THE STRUCTURAL POLYMETER: one detached
// ping every FIVE rows, unbroken from 19:0 into the coda. Five does not divide 48, so the
// cell enters each frame three rows earlier than the last — 19:0, 20:2, 21:4, 22:1, which
// is `(-48k) mod 5` and not the obvious sequence — and its last attack lands at 22:46,
// three frames before the seam.
// =====================================================================================
/** The chord under each six-row half-bar of `spiral`, then one chord a bar for 8–11, as
 *  three chord tones in VRC6 pulse 2's register. Two circles of fifths, then the close. */
const SPIRAL_CHORDS = [
  ['g3', 'bb3', 'd4'], ['c4', 'eb4', 'g4'], ['f3', 'a3', 'c4'], ['bb3', 'd4', 'f4'],
  ['eb4', 'g4', 'bb4'], ['a3', 'c4', 'eb4'], ['d4', 'f#4', 'a4'], ['g3', 'bb3', 'd4'],
  ['g3', 'bb3', 'd4'], ['c4', 'eb4', 'g4'], ['f3', 'a3', 'c4'], ['bb3', 'd4', 'f4'],
  ['eb4', 'g4', 'bb4'], ['a3', 'c4', 'eb4'], ['d4', 'f#4', 'a4'], ['g3', 'bb3', 'd4'],
]
const SPIRAL_TAIL = [['eb4', 'g4', 'bb4'], ['c4', 'eb4', 'g4'], ['d4', 'f#4', 'c5'], ['d4', 'f#4', 'c5']]
/** Which triad sounds at a given row of `spiral` — the cell, the bass and the inner voice
 *  all read this, so no lane can drift out of the harmony by accident. */
function spiralChord(row) {
  return row < 96 ? SPIRAL_CHORDS[Math.floor(row / 6)] : SPIRAL_TAIL[Math.floor((row - 96) / 12)]
}

const spiral = s.section('spiral', 12)
{
  // V2  the 5-row cell. Its note walks the sounding triad, so it marks the period AND
  // spells the harmony; it never lands on the same beat twice running.
  // `P82` is two raw period units sharp — about ten cents at this register, enough to
  // set the cell fractionally apart from the lanes it is arguing with. It is a channel
  // MODE, so it is RESTATED on the cell's first attack in every frame (19:0, 20:2, 21:4)
  // rather than left standing, and the coda's next bare note cancels it with `P80`.
  let ping = 0
  let frameOfLast = -1
  for (let row = 0; row < spiral.len; row += 5) {
    const frame = Math.floor(row / 48)
    const fx = frame === frameOfLast ? undefined : [['P', 0x82]]
    frameOfLast = frame
    spiral.put(L.V2, row, { note: n(spiralChord(row)[ping % 3]), inst: PING, vol: 11, fx })
    ping++
  }
  // P1  the sequence: a four-row-plus-two figure over each chord, descending one step a
  // bar through the first circle, restated an octave up for the second, then walking down
  // into the coda's register — pulse 1 ends this section lower than it has ever been.
  phrase(spiral, L.P1, UPPER, 0, [
    [4, 'd5', 13], [2, 'c5', 12], [4, 'bb4', 12], [2, 'c5', 12],
    [4, 'c5', 13], [2, 'bb4', 12], [4, 'a4', 12], [2, 'bb4', 12],
    [4, 'bb4', 12], [2, 'a4', 12], [4, 'g4', 12], [2, 'a4', 12],
    [4, 'f#4', 13], [2, 'g4', 12], [4, 'a4', 12], [2, 'bb4', 12],
    [4, 'g5', 14], [2, 'f5', 13], [4, 'eb5', 13], [2, 'd5', 13],
    [4, 'f5', 13], [2, 'eb5', 13], [4, 'd5', 13], [2, 'c5', 12],
    [4, 'eb5', 13], [2, 'd5', 13], [4, 'c5', 12], [2, 'a4', 12],
    [4, 'd5', 13], [2, 'c5', 12], [6, 'bb4', 12],
    [4, 'bb4', 12], [4, 'g4', 12], [4, 'eb4', 12],
    [4, 'g4', 12], [4, 'eb4', 12], [4, 'c4', 11],
    [4, 'd4', 11], [4, 'f#4', 11], [4, 'a4', 11],
    [8, 'd4', 11], [4, '-'],
  ])
  // P2  four bars of rest, then a counter-line that moves on the third sixteenth of each
  // half-bar — between the chord changes, never on one.
  spiral.put(L.P2, 0, { note: CUT })
  phrase(spiral, L.P2, INNER2, spiral.at(4, 3), [
    [6, 'bb4', 10], [6, 'a4', 10], [6, 'a4', 10], [6, 'g4', 10],
    [6, 'g4', 10], [6, 'f#4', 10], [6, 'f#4', 10], [6, 'g4', 10],
    [6, 'g4', 10], [6, 'eb4', 10], [6, 'eb4', 10], [6, 'd4', 10],
    [9, 'c4', 10], [8, 'bb3', 10], [4, '-'],
  ], { cutAtEnd: false })
  // V1  the guide tone of every chord, struck on each change — two a bar, which is the
  // only lane that states the doubled harmonic rhythm outright.
  for (let half = 0; half < 16; half++) {
    spiral.put(L.V1, half * 6, { note: n(SPIRAL_CHORDS[half][1]), inst: ANSWER_V, vol: 11 })
  }
  for (let bar = 8; bar < 12; bar++) {
    spiral.put(L.V1, spiral.at(bar, 0), { note: n(SPIRAL_TAIL[bar - 8][1]), inst: ANSWER_V, vol: 11 })
  }
  spiral.put(L.V1, spiral.len - 1, { note: CUT })
  // SAW  eighths on the chord roots, an octave under the cell.
  for (let half = 0; half < 16; half++) {
    const root = n(SPIRAL_CHORDS[half][0]) - 12
    for (const off of [0, 2, 4]) spiral.put(L.SAW, half * 6 + off, { note: root, inst: SAW_RUN, vol: off === 0 ? 12 : 11 })
  }
  run(spiral, 8, [
    ['eb3', 'bb2', 'g3', 'bb2', 'eb3', 'd3'], ['c3', 'g2', 'eb3', 'g2', 'c3', 'bb2'],
    ['d3', 'a2', 'f#3', 'a2', 'd3', 'c3'], ['d3', 'a2', 'f#3', 'd3', 'a2', 'f#3'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // TRI  the root of each half-bar, two octaves under the saw's line.
  for (let half = 0; half < 16; half++) {
    spiral.put(L.TRI, half * 6, { note: n(SPIRAL_CHORDS[half][0]) - 24, inst: TRI_SHORT, vol: 15 })
  }
  for (const [bar, note] of [[8, 'eb2'], [9, 'c2'], [10, 'd2'], [11, 'd2']]) {
    for (const r of [0, 6]) spiral.put(L.TRI, spiral.at(bar, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  }
  // NOISE  kit E: the kick on both chord changes (rows 0 and 6), the snare on beat 3
  // alone, sixteenth hats through the beat and a metal tick on the off-sixteenth of beat
  // 1. THE METRIC SURPRISE is bar 8 — 21:0 — where the kit stops for a whole bar and the
  // only thing keeping time is the 5-row cell. FILL 9 at 21:42 is a snare roll that gets
  // QUIETER, the one fill in the piece that falls away instead of rising.
  for (const bar of range(0, 12)) {
    if (bar === 8) continue
    spiral.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 6]])
    spiral.hits(L.NOISE, SNARE, 12, [[bar, 8]])
    spiral.put(L.NOISE, spiral.at(bar, 3), { note: 44, inst: METAL, vol: 6 })
    hats(spiral, bar, [2, 4, 5, 10, 11], { on: 7, off: 5 })
  }
  for (const r of range(6, 12)) spiral.lanes[L.NOISE][spiral.at(11, r)] = null
  ;[12, 10, 9, 7, 6, 4].forEach((v, i) => spiral.hits(L.NOISE, SNARE, v, [[11, 6 + i]]))
  spiral.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// coda — frames 22–25: the bottom of the stair. The SAWTOOTH takes the subject two
// octaves down and becomes the piece's lowest melody; pulse 1 answers in the register it
// began in, but only every other four bars, so the texture keeps opening up underneath.
// Harmony: Gm · Cm · Ab · D7 twice — the NEAPOLITAN (§9.3 device two), prepared by the C
// minor that shares two of its three notes, in root position at 23:0 and in first
// inversion (the bass staying on c) at 25:0, each resolving outward to the dominant, and
// each carrying the melody's own a-flat falling by step to g (23:12 and 25:12).
// The 5-row cell from `spiral` finishes here: 22:1, 22:6 … 22:46, then it stops.
// =====================================================================================
const coda = s.section('coda', 16)
{
  // V2  the cell's last ten attacks, entering this frame at row 1 as the phase carry
  // requires, then the section's held harmony from bar 4.
  const CODA_GM = ['g3', 'bb3', 'd4']
  const CODA_CM = ['c4', 'eb4', 'g4']
  let ping = 29 // the cell's attack count so far, so the triad walk continues unbroken
  for (let row = 1; row < 48; row += 5) {
    coda.put(L.V2, row, {
      note: n((row < 24 ? CODA_GM : CODA_CM)[ping % 3]), inst: PING, vol: 9,
      fx: row === 1 ? [['P', 0x82]] : undefined,
    })
    ping++
  }
  // the two a-flat bars carry `742` tremolo — a breathing, unsteady chord, written one
  // step louder because tremolo only ever subtracts (§2.8) — and the next bare note
  // cancels it with `710`, never a bare `700`, which would replay the effect memory.
  // …and then V2 accompanies only the sawtooth's two low statements. Through the A flat
  // bars it is SILENT: the chord is one lane's arpeggio there (below), pulse 1 owns the
  // octave, and a fifth voice in it would be the mud, not the harmony.
  phrase(coda, L.V2, INNER_V, coda.at(8), [
    [12, 'd4', 9], [12, 'g4', 9], [12, 'g4', 9], [12, 'eb4', 9],
  ])
  // SAW  S two octaves down — the lowest statement of the subject in the piece — then the
  // running bass under the Neapolitan; the restatement at bar 8 changes its last note to
  // the tonic, so the two passes do not end the same way (§2.9's varied final bar).
  const LOW_SUBJECT = shift(SUBJECT, -24)
  phrase(coda, L.SAW, SAW_VOICE, 0, LOW_SUBJECT, { volShift: -1, cutAtEnd: false })
  run(coda, 4, [
    ['ab2', 'eb3', 'c3', 'eb3', 'ab2', 'bb2'], ['ab2', 'c3', 'eb3', 'c3', 'ab2', 'g2'],
    ['d3', 'a2', 'f#3', 'a2', 'd3', 'c3'], ['d3', 'a2', 'f#3', 'd3', 'a2', 'f#3'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  // the restatement is the same notes GLIDED rather than struck: `318` on every event
  // after the first makes each note a portamento target, so the lowest voice in the piece
  // groans from step to step instead of walking them. `300` would only FREEZE the mode,
  // so the running bass that follows cancels it with `100` on its first cell.
  phrase(coda, L.SAW, SAW_VOICE, coda.at(8),
    LOW_SUBJECT.map((e, i) => [e[0], i === LOW_SUBJECT.length - 1 ? n('g2') : e[1], e[2], i === 0 ? undefined : ['3', 0x18]]),
    { volShift: -1, cutAtEnd: false })
  run(coda, 12, [
    ['c3', 'eb3', 'ab2', 'eb3', 'c3', 'bb2'], ['ab2', 'eb3', 'c3', 'ab2', 'eb3', 'c3'],
    ['d3', 'c3', 'a2', 'c3', 'd3', 'f#3'], ['d3', 'f#3', 'a3', 'f#3', 'd3', 'a2'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  coda.put(L.SAW, coda.at(12, 0), { fx: [['1', 0]] }) // the glide stops here, hard
  // P1  silent for the subject's two low statements — four bars each, the longest the
  // lead is away — and answering only over the Neapolitan, where its a-flat is the
  // chord's own root falling by step to g.
  coda.put(L.P1, 0, { note: CUT })
  phrase(coda, L.P1, UPPER, coda.at(4), [
    [4, 'eb5', 12], [4, 'c5', 12], [4, 'ab4', 12],
    [6, 'ab4', 12], [2, 'g4', 12], [4, 'eb4', 11],
    [4, 'a4', 12], [2, 'c5', 12], [2, 'bb4', 12], [4, 'f#4', 12],
    [6, 'a4', 12], [2, 'g4', 11], [4, 'f#4', 12],
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  phrase(coda, L.P1, UPPER, coda.at(12), [
    [4, 'c5', 12], [4, 'eb5', 12], [4, 'ab4', 13],
    [6, 'ab4', 13], [2, 'g4', 12], [4, 'eb4', 12],
    [4, 'a4', 12], [4, 'g4', 12], [4, 'f#4', 12],
    [8, 'd4', 11], [4, '-'],
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  coda.put(L.P1, coda.at(15, 4), { fx: [['R', nib(2, 5)]] }) // the lead falls into the turn
  // P2  two short answers only, both under the dominant, both ending on the leading tone.
  coda.put(L.P2, 0, { note: CUT })
  phrase(coda, L.P2, INNER2, coda.at(6), [[6, 'c4', 10], [2, 'bb3', 10], [4, 'a3', 10], [12, 'a3', 10]], { cutAtEnd: true })
  phrase(coda, L.P2, INNER2, coda.at(14), [[6, 'c4', 10], [2, 'bb3', 10], [4, 'a3', 10], [8, 'f#3', 10]])
  // V1  the guide tone, one a bar; the a-flat bars are voiced c and e-flat so the melody
  // and the bass own the flat second between them.
  phrase(coda, L.V1, ANSWER_V, 0, [
    [12, 'bb3', 9], [12, 'd4', 9], [12, 'eb4', 9], [12, 'c4', 9],
    [12, 'c4', 9], [12, 'eb4', 9], [12, 'f#4', 10], [12, 'f#4', 10],
    [12, 'bb3', 9], [12, 'd4', 9], [12, 'eb4', 9], [12, 'c4', 9],
    [12, 'eb4', 10], [12, 'c4', 10], [12, 'f#4', 10], [12, 'a4', 10],
  ])
  // …and the flat-second chord itself, spelled as a `0xy` arpeggio so three notes sound
  // from one lane: `047` (decimal 71) is the root-position A flat at 23:0, `038` (56) the
  // first inversion at 25:0, whose bottom note is the c the bass is already holding. The
  // arpeggio is a channel MODE: each is cancelled with an explicit `000` one bar later.
  // Each chord cell carries the arpeggio AND `742` tremolo, so the flat second arrives
  // unsteady; the cancel a bar later is `000` for the arpeggio and `710` for the tremolo
  // — never a bare `700`, which replays the effect memory instead of clearing it.
  coda.put(L.V1, coda.at(4, 0), { note: n('ab3'), inst: ANSWER_V, vol: 10, fx: [['0', nib(4, 7)], ['7', nib(4, 2)]] })
  coda.put(L.V1, coda.at(6, 0), { note: n('f#4'), inst: ANSWER_V, vol: 10, fx: [['0', 0], ['7', 0x10]] })
  coda.put(L.V1, coda.at(12, 0), { note: n('c4'), inst: ANSWER_V, vol: 11, fx: [['0', nib(3, 8)], ['7', nib(4, 2)]] })
  coda.put(L.V1, coda.at(14, 0), { note: n('f#4'), inst: ANSWER_V, vol: 11, fx: [['0', 0], ['7', 0x10]] })
  // TRI  the roots, half time: A flat in root position first (23:0), then with the bass
  // held on c for the first-inversion Neapolitan at 25:0 — two voicings, not one twice.
  const CODA_ROOTS = ['g1', 'g1', 'c2', 'c2', 'ab1', 'ab1', 'd2', 'd2', 'g1', 'g1', 'c2', 'c2', 'c2', 'c2', 'd2', 'd2']
  CODA_ROOTS.forEach((note, bar) => {
    coda.put(L.TRI, coda.at(bar, 0), { note: n(note), inst: TRI_SHORT, vol: 15 })
    if (bar % 2 === 1) coda.put(L.TRI, coda.at(bar, 8), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  // NOISE  kit F: half time and mostly air — kick on 1, snare on 3, two closed hats, a
  // rim on the off-eighth of beat 2 in odd bars. FILL 10 at 23:44 runs its toms LOW to
  // HIGH, the opposite of every other tom fill here; the section ends on a crash and
  // four rows of nothing, because the turn has to arrive out of silence.
  for (const bar of range(0, 16)) {
    coda.hits(L.NOISE, KICK, 12, [[bar, 0]])
    coda.hits(L.NOISE, SNARE, 11, [[bar, 8]])
    hats(coda, bar, [4, 10], { on: 6, off: 5 })
    if (bar % 2 === 1) coda.put(L.NOISE, coda.at(bar, 6), { note: 44, inst: RIM, vol: 8 })
  }
  for (const r of range(9, 12)) coda.lanes[L.NOISE][coda.at(7, r)] = null
  coda.hits(L.NOISE, TOM_LONG, 12, [[7, 9]], 37)
  coda.hits(L.NOISE, TOM_LONG, 12, [[7, 11]], 43)
  for (const r of range(8, 12)) coda.lanes[L.NOISE][coda.at(15, r)] = null
  coda.put(L.NOISE, coda.at(15, 8), { note: 46, inst: CRASH, vol: 10 })
  coda.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// turn — frames 26–27: the climb back to the top of the stair, and the only place the
// piece goes UP for eight bars together. The subject's head opens it, the line rises
// through a Gm · Bb · Cm · Eb sequence to the piece's global peak b-flat 5 at 26:44, and
// then the dominant takes over and everything thins until only pulse 1 and the triangle
// are left. There is NO fill at the seam (§2.9 rule 5, and the guide's own warning): the
// last bar is a bare dominant, the loop frame's crash is the arrival.
// =====================================================================================
const turn = s.section('turn', 8)
{
  // P1  the head, then the climb, then the fall back to the leading tone and a breath.
  phrase(turn, L.P1, UPPER, 0, [
    [4, 'd5', 13], [2, 'g5', 13], [2, 'f5', 13], [4, 'eb5', 13],   // Gm — the head returns
    [6, 'd5', 13], [2, 'eb5', 13], [4, 'f5', 13],                  // Bb
    [4, 'g5', 14], [2, 'f5', 13], [2, 'eb5', 13], [4, 'g5', 14],   // Cm
    [6, 'f5', 13], [2, 'g5', 14], [4, 'bb5', 15],                  // Eb — the global peak
    [4, 'a5', 14], [4, 'f#5', 13], [4, 'd5', 13],                  // D7
    [4, 'c5', 12], [4, 'bb4', 12], [4, 'a4', 12],
    [6, 'd5', 12], [2, 'c5', 12], [4, 'a4', 12],
    [8, 'f#4', 12], [4, '-'],                                      // the leading tone, then air
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  answers underneath, rising with it, and stops two bars before the seam.
  turn.put(L.P2, 0, { note: CUT })
  phrase(turn, L.P2, INNER2, turn.at(1), [
    [4, 'bb3', 10], [4, 'd4', 10], [4, 'f4', 10],
    [4, 'eb4', 10], [4, 'g4', 10], [4, 'bb4', 11],
    [6, 'a4', 11], [2, 'bb4', 11], [4, 'd5', 11],
    [4, 'c5', 11], [4, 'a4', 10], [4, 'f#4', 10],
    [12, 'a4', 10],
  ])
  // V1 / V2  the rising harmony, a third apart, restruck on every bar; both stop on the
  // dominant in bar 6 so the last bar is two voices and a drum.
  phrase(turn, L.V1, ANSWER_V, 0, [
    [12, 'd4', 9], [12, 'f4', 9], [12, 'g4', 10], [12, 'bb4', 10],
    [12, 'a4', 10], [12, 'a4', 10], [12, 'f#4', 10],
  ])
  phrase(turn, L.V2, INNER_V, 0, [
    [12, 'bb3', 8], [12, 'd4', 8], [12, 'eb4', 9], [12, 'g4', 9],
    [12, 'f#4', 9], [12, 'f#4', 9], [12, 'd4', 9],
  ])
  // SAW  eighths climbing with the sequence, then the dominant, then out.
  run(turn, 0, [
    ['g2', 'bb2', 'd3', 'bb2', 'g2', 'a2'], ['bb2', 'd3', 'f3', 'd3', 'bb2', 'c3'],
    ['c3', 'eb3', 'g3', 'eb3', 'c3', 'd3'], ['eb3', 'g3', 'bb3', 'g3', 'eb3', 'd3'],
    ['d3', 'a2', 'f#3', 'a2', 'd3', 'c3'], ['d3', 'a2', 'f#3', 'd3', 'a2', 'g2'],
    ['d3', 'a2', 'f#3', 'a2', 'd3', 'a2'],
  ].map((bar) => bar.map((x) => n(x))), 11)
  turn.put(L.SAW, turn.at(7, 0), { note: CUT })
  // TRI  the roots climbing, then the dominant alone under the last bar — the one thing
  // besides pulse 1 still sounding when the loop jumps.
  const TURN_ROOTS = ['g1', 'bb1', 'c2', 'eb2', 'd2', 'd2', 'd2', 'd2']
  TURN_ROOTS.forEach((note, bar) => {
    turn.put(L.TRI, turn.at(bar, 0), { note: n(note), inst: TRI_SHORT, vol: 15 })
    if (bar < 7) turn.put(L.TRI, turn.at(bar, 8), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  // NOISE  the kit climbs with everything else and then GETS OUT OF THE WAY: bars 0–5
  // carry the A kit, bar 6 drops to kick and hats, and bar 7 has one kick and nothing
  // after row 4. A roll here would be the most predictable thing in the piece.
  for (const bar of range(0, 6)) {
    turn.hits(L.NOISE, KICK, 12, [[bar, 0]])
    turn.hits(L.NOISE, SNARE, 12, [[bar, 4]])
    turn.hits(L.NOISE, KICK, 11, [[bar, 6]])
    turn.hits(L.NOISE, SNARE, 4, [[bar, 11]])
    hats(turn, bar, [0, 2, 4, 6, 8, 10], { on: 8, off: 5 })
  }
  turn.hits(L.NOISE, KICK, 12, [[6, 0], [6, 6]])
  hats(turn, 6, [0, 2, 4, 8, 10], { on: 7, off: 5 })
  turn.hits(L.NOISE, KICK, 11, [[7, 0]])
  hats(turn, 7, [2, 4], { on: 6, off: 5 })
  turn.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['entries', 'A', 'B', 'stretto', 'landing', "A'", 'spiral', 'coda', 'turn'])
s.loopTo('A')
s.qa({
  key: 'g-minor',
  bpmRange: [148, 152],
  durationSec: [130, 140],
  percussionGap: 32,
  motif: { channel: 'pulse1', patterns: [0, 3, 9, 15], variation: 'answer at the fifth, stretto at one bar, diatonic inversion, augmentation three octaves down in the triangle' },
  notes:
    'G minor in 3/4, 150 BPM on 16th rows: speed 6, rowHighlight 4 (a beat), rowHighlight2 12 (a ' +
    'bar), rowsPerPattern 48 (a frame = 4 bars = 4.8 s); 28 frames, one pass 134.4 s. THE SUBJECT ' +
    'is 4 bars whose second half is its first half one scale step lower, and the whole piece is ' +
    'that figure at larger scale. IMITATION: three entries a real fifth apart and two bars apart ' +
    'at 0:0 (pulse 1, d5), 0:24 (VRC6 p1, g4) and 1:0 (sawtooth, c4), three independent rhythms ' +
    'through 2:47; STRETTO at one bar\'s distance at 9:0, 9:12, 9:24 and 9:36 down the circle of ' +
    'fifths; INVERSION bare in two voices at 13:0 and 13:12 and again at 15:0; AUGMENTATION in ' +
    'the triangle three octaves down from 15:0 to 16:47, under that inversion. Two tonal-answer ' +
    'adjustments, both of them a long note only: d flat -> d and a flat -> a. The SHORT a-flats ' +
    'stay, at 0:32, 1:42, 9:20 and 9:44, because each makes a seventh chord or a flat sixth ' +
    'circle. SEQUENCE (9.3): falling fifths, seven links, Gm Cm F Bb Eb Adim D7 - two bars a link ' +
    'through 0:0-2:23, one bar a link at 3:0-3:47, and two chords a bar at 19:0-20:47, so the ' +
    'harmonic rhythm doubles twice across the piece and A is the section whose rhythm differs. ' +
    'NON-DIATONIC 1: a six-link chromatic bass descent g-f#-f-e-eb-d under held upper voices at ' +
    '7:0, 7:12, 7:24, 7:36, 8:0, 8:12 (f# and e are the chromatic links; the harmony is implied ' +
    'by the collision). NON-DIATONIC 2: the Neapolitan flat II, A flat major, prepared each time ' +
    'by the C minor that shares two of its notes, root position (0xy 047 = 71) at 23:0 and first ' +
    'inversion (038 = 56, over the c the bass is holding) at 25:0, each resolving outward to D7; ' +
    'the melody\'s own a-flat falls by step to g at 23:12-23:18 and 25:12-25:18. METRE (9.1): ' +
    'STRUCTURAL - a 5-row cell on VRC6 pulse 2, unbroken from 19:0 into the coda, entering 19:0, ' +
    '20:2, 21:4 and 22:1, which is (-48k) mod 5 and not 0,1,2,3; 39 attacks, the last at 22:46, ' +
    'four frames of carried phase and well clear of the seam. CADENTIAL - hemiola at 6:24 (two ' +
    'bars regrouped 3 x 8 rows; the inner voices, the lead and the kick take the groups while the ' +
    'triangle holds the dominant) and a different one at 12:24 (the sawtooth and the snare take ' +
    'the groups, the backbeat disappears, the hats keep the 4-row beat underneath and pulse 1 ' +
    'holds one note across all 24 rows). METRIC SURPRISE - 21:0, one whole bar where the kit ' +
    'stops and only the 5-row cell keeps time. The one asymmetry is B phrased 6 + 2 rather than 4 ' +
    '+ 4 (7:0-8:23, then 8:24-8:47). COUNTERPOINT (9.2): three independent lines for the whole ' +
    'exposition; pulse 2 is an independent voice for the whole of A - it attacks only on beats 2 ' +
    'and 3, never on a downbeat, and every beat-3 note is held across the barline and resolved ' +
    'down by step, twelve suspensions from 3:10. Cadential 4-3 suspensions at ' +
    '4:32-4:40 (c4 over the tonic to bb3) and 18:34-18:38 (g4 over D7 to f#4). Contrary-motion ' +
    'cadences at 4:36 and 10:36, the melody rising a step into the downbeat while the bass falls ' +
    'a fifth. The only parallel writing is four bars of five-lane rhythmic unison at 11:0-11:47, ' +
    'earned by the eight bars of four-voice independence before it and never repeated. PEAKS: one ' +
    'per section; A\'s a5 at 6:12 and the piece\'s single b-flat 5 at 26:44, in the last third, at ' +
    'the top of the climb back. EFFECTS, decimal on disk: 0xy chords 047 = 71 and 038 = 56 at ' +
    '23:0 and 25:0; 4xy vibrato 442 = 66 on the lead and 431 = 49 on pulse 2\'s suspensions, ' +
    'always written a beat after the note and cancelled with 4x0 on the next; 742 = 66 tremolo on ' +
    'the two flat-II chords, cancelled with 710 and never a bare 700, which replays the effect ' +
    'memory; A20 = 32 fades on the held voices under the chromatic descent, cancelled with A00; ' +
    'P82 = 130 detune on the 5-row cell, RESTATED on its first attack in every frame rather than ' +
    'left latched, and cancelled with P80; 318 = 24 portamento on the sawtooth\'s second low ' +
    'statement of the subject (24:0-24:47) so the restatement glides where the first was struck, ' +
    'cancelled with 100 at 25:0 because 300 would only freeze it; G01 and G02 humanisation, two ' +
    'ticks at most; R25 = 37 phrase-end falls at 14:43 and 25:40. No Vxx: every melodic ' +
    'instrument here carries a duty macro, which overrides Vxx from the next tick, so a Vxx cell ' +
    'would be a write nothing reads. No raised accidental bound: the piece needs 6.8 % of its ' +
    'melodic notes outside natural G minor, under the 12 % default, so nothing is declared. ' +
    'percussionGap 32 is declared for `landing` (13:0-14:47), eight bars of two voices with no ' +
    'kit at all - the report\'s longest gap, 99 rows, is that section plus the unaccompanied ' +
    'opening of the exposition; coverage is 89 %. There is deliberately no fill on the seam into ' +
    '`landing` or on the loop seam (2.9 rule 5): the turn thins to pulse 1 and the triangle over ' +
    'a bare dominant and the loop frame\'s crash is the arrival. ',
  renderChecksum: 1253412819,
})
s.check()
s.write('src/assets/songs/07-winding-stair.json')
