#!/usr/bin/env node
/** 12 — Headlong. Six eighths to the bar, two beats of three, and the bar keeps coming
 *  apart in the composer's hands.
 *
 *      node tools/songs/compose/12-headlong.mjs  -> src/assets/songs/12-headlong.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), invented from the
 *  contour and harmony rules of §2.10 / §9.3. Compound-metre flight as an idiom, not a
 *  source: nothing here quotes, transcribes or paraphrases any published work.
 *
 *  GRID  tempo 150 · speed 3 · rowHighlight 6 (the dotted-quarter beat) · rowHighlight2 12
 *        (a 6/8 bar) · rowsPerPattern 48 (a frame = 4 bars) = 200.000 BPM.
 *        One row is a 16th, 50 ms. An EIGHTH is two rows, 100 ms, and that is the piece's
 *        unit of motion. A beat is 6 rows, 300 ms; the bar's two beats start at rows 0 and
 *        6. A bar is 600 ms, a frame 2.4 s. Section granularity is 4 bars.
 *  KEY   B natural minor (b c# d e f# g a), declared `b-minor`. The relative major D is
 *        the same seven notes, so `updraft`'s lift costs nothing; the accidentals are the
 *        chromatic dive (a#, g#), the raised third of the real dominant (a#) and the
 *        augmented sixth's e#. Measured: 181 of 2806 melodic notes, 6.45 %, under the
 *        lint's 12 % default — so NO `accidentalFractionMax` is declared. An allowance a
 *        piece does not need is a raised bound.
 *
 *  FORM (51 frames, 204 bars; one pass 122.10 s = 2:02)
 *  | frame | section  | bars | what happens                                             |
 *  |-------|----------|------|----------------------------------------------------------|
 *  | 0–1   | launch   | 8    | the triangle's compound gallop alone, the saw answering   |
 *  |       |          |      | with the head of H an octave down; kit and arpeggio bed   |
 *  |       |          |      | from bar 5; pulse 1 takes the last two eighths as a pickup|
 *  | 2–5   | flight   | 16   | A, THE LOOP TARGET. H on pulse 1 over a stepwise falling  |
 *  |       |          |      | bass, one chord a bar; CADENTIAL HEMIOLA at 5:24          |
 *  | 6–9   | flight2  | 16   | A′: H re-voiced, pulse 2 an independent line for the whole|
 *  |       |          |      | section; the arpeggio bed LEAVES at 6:0 and stays out     |
 *  | 10–13 | chase    | 16   | H displaced one eighth late (+2 rows) against a kit that  |
 *  |       |          |      | is not displaced; the two pulses trade two-bar phrases    |
 *  | 14–17 | dive     | 16   | B: the chromatic bass descent b–a#–a–g#–g–f#, two bars a  |
 *  |       |          |      | link, upper voices holding; no kick for eight bars        |
 *  | 18–22 | three    | 20   | THE HEMIOLA SECTION: H in AUGMENTATION on pulse 1 — every |
 *  |       |          |      | value doubled, so the tune itself lands on a 4-row grid — |
 *  |       |          |      | with V2 and the kit counting three while the triangle     |
 *  |       |          |      | keeps two. One chord per FOUR bars                        |
 *  | 23–24 | hinge    | 8    | the AUGMENTED SIXTH at full speed: g in the bass under b  |
 *  |       |          |      | and e#, resolving outward to f# and throwing the music    |
 *  |       |          |      | into the relative major instead of closing on it          |
 *  | 25–28 | updraft  | 16   | D major. THE SECOND LEAD: the tune leaves pulse 1 for the |
 *  |       |          |      | SAWTOOTH an octave below it; pulse 1 answers above        |
 *  | 29–30 | updraft2 | 8    | the two pulses answer the saw in sixths — the one earned  |
 *  |       |          |      | parallel gesture — and turn the harmony back to b minor   |
 *  | 31–32 | hush     | 8    | two lanes: pulse 1 on its THIN colour and the triangle.   |
 *  |       |          |      | No kit at all; the piece's dynamic floor                  |
 *  | 33–37 | sprint   | 20   | falling fifths, eight links, arriving; a 5-ROW CELL on V2 |
 *  |       |          |      | carrying its phase through the whole five-frame cycle     |
 *  | 38–39 | stall    | 8    | the brake: half-time, then `D00` at 39:41 — a 42-row      |
 *  |       |          |      | frame whose last bar is ONE beat, jumping into the return |
 *  | 40–43 | return   | 16   | A″: H at pitch, the second half re-harmonised             |
 *  | 44–48 | crest    | 20   | the climb, on the lead's THIRD colour (a flat 50 %): the  |
 *  |       |          |      | global peak d6 at 47:6, then the second and different     |
 *  |       |          |      | cadential hemiola at 48:24                                |
 *  | 49–50 | tail     | 8    | thinning to triangle and one pulse over f#, no fill, loop |
 *
 *  §9.1 PHASE TABLE, COMPUTED FOR THIS GRID (48-row frames, not §9.1's 64):
 *        the entry row of frame k for a cell of length c is `(-48k) mod c`, and the cycle
 *        closes after `lcm(c, 48)/48` frames.
 *          c = 5  ->  lcm(5,48)/48 = 5 frames, entry rows (-48k) mod 5 = 2k mod 5
 *                     = 0, 2, 4, 1, 3      <- the cell this piece uses
 *          c = 10 ->  5 frames, entry rows 0, 2, 4, 6, 8
 *          c = 7  ->  7 frames, entry rows 0, 1, 2, 3, 4, 5, 6 — and NOT §9.1's
 *                     0, 6, 5, 4, 3, 2, 1, which is the answer for 64-row frames: 48 mod 7
 *                     is 6 and 64 mod 7 is 1, so the two grids run the same cell in
 *                     opposite directions. This is why §5.3 says compute your own table.
 *        Five rows is 250 ms here — four attacks a second, nothing like the blur §9.1
 *        warns about at 140 BPM on a 64-row 16th grid, where a row is 107 ms. The cell is
 *        judged by its own duration, and 250 ms against a 300 ms beat is the interesting
 *        distance: close enough to be heard as the same pulse walking out of step.
 */
/** MOTIFS
 *    H   the flight (4 bars): each bar climbs three eighths and lands on the second beat.
 *        Bar 1 reaches a5 and bar 3 reaches b5 — the same gesture a third higher, its
 *        landing pulled back one step onto the tonic — and each landing is answered by a
 *        stepwise fall with the last eighth left EMPTY.
 *        The rest is the motif's third limb: at 100 ms an eighth, a phrase that never
 *        stops is a wall of notes, which is this tempo's own failure mode.
 *    H2  the answer (4 bars): where H climbs, H2 falls from the top of its bar, so the two
 *        four-bar limbs of the tune are contrary in contour as well as in harmony.
 *    C   the counter-voice (pulse 2 in `flight2`, 16 bars): it moves in the holes H leaves
 *        — the held beat 2 and the empty last eighth — in quarters and dotted quarters
 *        against H's eighths, and it crosses above the lead exactly once, at 9:30.
 *    G   the gallop: the triangle's compound bass figure, dotted quarter + quarter +
 *        eighth (rows 0, 6, 10), stepwise and never twice the same three notes.
 *
 *  DEVICES (frame:row; the same list is in extra.qa.notes)
 *    §9.1  STRUCTURAL: the 5-row cell on VRC6 pulse 2, unbroken from 33:0 to 37:43, 48
 *          attacks, entering 33:0, 34:2, 35:4, 36:1, 37:3 — the whole five-frame cycle.
 *          WHOLE-SECTION HEMIOLA: `three` (18:0–22:47), 20 bars in which V2, the kit and
 *          the augmented tune all count 3 x 4 rows while the triangle keeps 2 x 6.
 *          CADENTIAL HEMIOLA: 5:24 (pulse 2, V2 and the kick take six 4-row groups over
 *          the last two bars of A while the triangle holds f#) and a different one at
 *          48:24 (the SAW and the snare take the groups, the kick drops out, the hats keep
 *          the beat underneath and pulse 1 holds one note across all 24 rows).
 *          DISPLACEMENT: H and H2 one eighth late through `chase` bars 1–8, 10:2 to 12:1.
 *          METRIC SURPRISE: `D00` at 39:41, one per piece.
 *    §9.2  pulse 2 is an independent line for the whole of `flight2` (6:0–9:47): its own
 *          rhythm — dotted quarters on rows 3 and 9, the beat displaced by half of itself —
 *          and 32 of its 32 attacks on rows pulse 1 does not use. One voice crossing, at
 *          8:9. Written suspensions: the cadential one at 9:45, held through the chord
 *          change at 10:0 and resolved down by step at 10:3, and two 4–3s at 26:0 and 28:0.
 *    §9.3  NON-DIATONIC 1, the chromatic bass descent b–a#–a–g#–g–f# at 14:0, 14:24,
 *          15:0, 15:24, 16:0, 16:24 — six links, two bars each, 1.2 s a link.
 *          NON-DIATONIC 2, the augmented sixth at 23:36, NOT at a cadence: g in the bass
 *          under b and e#, resolving outward at 24:0 to f# in both directions, which is
 *          the launch into D major rather than a close on B.
 *          Third colour, free: the lift to the relative major for `updraft`.
 *          SEQUENCE: falling fifths, eight links, 33:0–34:47, restated 35:0–36:47.
 *          HARMONIC RHYTHM: one chord a bar everywhere except `launch` (four bars of i,
 *          then two a chord), `dive` (two bars a link) and `three` (one per four), which
 *          is the section that differs.
 *    §9.4  fifteen kit postures and thirty fills, no two of either alike (`fill()` in
 *          this file throws on a repeated cell set, so the claim is enforced rather than
 *          asserted); ghosts at vol 3–6; the one section with no kit at all is `hush`; no
 *          fill at the loop seam.
 *
 *  ALLOCATION (the lead is one voice at a time; every lane rests audibly somewhere)
 *    launch    TRI gallop · SAW head of H · V1 bed from bar 5 · kit from bar 5 · P1 pickup
 *    flight    P1 H · P2 answers in the holes · TRI gallop · SAW tenor eighths ·
 *              V1 bed · V2 off-beat thirds · kit · DPCM rests
 *    flight2   P1 H re-voiced · P2 THE COUNTER-VOICE · V1 SILENT · V2 sustained sixths
 *    chase     P1 H displaced · P2 trading phrases · V1 silent · DPCM kick on downbeats
 *    dive      TRI the chromatic walk · V2 holds and breathes on a tremolo · V1 STILL
 *              ABSENT · P1 a slow descant · SAW silent eight bars · hats only, no kick
 *    three     P1 H augmented · V2 the three-count · TRI the two-count · V1 re-enters
 *              varied on 4-row groups · SAW silent eight bars
 *    hinge     everything at full speed; V1 V2 the augmented sixth; P1 the ♯4
 *    updraft   SAW THE TUNE · P1 a descant above it · P2 rests eight bars · V1 V2 pads
 *    updraft2  P1 + P2 in sixths (four bars, earned) · SAW the turn back
 *    hush      P1 thin colour · TRI · nothing else
 *    sprint    P1 the sequence · V2 the 5-row cell · SAW eighths · TRI roots · DPCM snare
 *    stall     SAW + TRI alone, half-time, then the fill and the dropped beat
 *    return    as flight, re-harmonised from bar 9 · DPCM kick doubling
 *    crest     P1 climbing to d6 on the wide colour · V1 V2 fifths · SAW the hemiola ·
 *              crash and toms
 *    tail      thins to TRI + P1 over f#; the kit stops before row 40
 *
 *  HEADROOM  measured, not asserted. As first written the arrangement rendered at -19.59
 *            dBFS over two passes — inside gate C's window by four tenths of a decibel,
 *            which is not a margin — because a fast compound texture is mostly detached
 *            eighths and its average sits far under its peak. Peak 0.695 with zero clamped
 *            samples said there was room, so the PARTS were lifted (see `LIFT` below), per
 *            lane and not flat: the quiet lanes came up three steps and the lead one, which
 *            is why only 21 % of its note events sit at column 15. Final: -18.57 dBFS,
 *            peak 0.787, zero clamped, one pass 122.10 s.
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'headlong',
  name: 'Headlong',
  author: 'pulsar original',
  speed: 3,
  rowsPerPattern: 48,
  rowHighlight: 6,
  rowHighlight2: 12,
})

// =====================================================================================
// the ladder — B natural minor as scale steps, so the augmentation, the sequence and the
// displaced restatements are all DIATONIC transformations of one written figure.
// =====================================================================================
const DEGREES = [0, 2, 3, 5, 7, 8, 10] // b c# d e f# g a
/** `rung(0)` is b1 (MIDI 35); one index is one scale step. rung(21) is b4, rung(28) b5. */
function rung(i) {
  return 35 + 12 * Math.floor(i / 7) + DEGREES[((i % 7) + 7) % 7]
}
const RUNGS = Array.from({ length: 56 }, (_, i) => rung(i))
/** The ladder index of a B-minor scale tone. Throws on a chromatic note, which is the
 *  point: a#, g# and e# are written out by hand and never transposed by accident. */
function idx(note) {
  const midi = n(note)
  const at = RUNGS.indexOf(midi)
  if (at < 0) throw new Error(`idx(${note}): MIDI ${midi} is not a B-minor scale tone`)
  return at
}
const isPitch = (note) => note !== '-' && note !== '~'
/** Diatonic transposition: every pitch `k` scale steps along the ladder. */
const climb = (events, k) =>
  events.map(([len, note, vol]) => [len, isPitch(note) ? rung(idx(note) + k) : note, vol])
/** Chromatic transposition, with `fix` replacing the note at an event INDEX, so a tonal
 *  adjustment is visible as the one note that moved. */
const shift = (events, semis, fix = {}) =>
  events.map(([len, note, vol], i) =>
    [len, fix[i] !== undefined ? n(fix[i]) : isPitch(note) ? n(note) + semis : note, vol])
/** Rhythmic augmentation: every value twice as long. In 6/8 this is the hemiola itself —
 *  an eighth becomes a quarter, so a tune written in 2 x 3 lands on a 3 x 4 grid. */
const augment = (events) => events.map(([len, note, vol]) => [len * 2, note, vol])
/** Diatonic inversion about `pivot`, still in key. */
const invert = (events, pivot = 'f#5') =>
  events.map(([len, note, vol]) => [len, isPitch(note) ? rung(2 * idx(pivot) - idx(note)) : note, vol])

const range = (a, b, step = 1) =>
  Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, i) => a + i * step)

// =====================================================================================
// the harmony vocabulary — spelled once, so a section's progression is one readable line
// and the accompaniment lanes are generated from the same chord the melody was written
// over. `tone(ch, k, floor)` is the chord's k-th member at or above `floor`, which is how
// the inner voices stay in their register while the roots walk.
// =====================================================================================
const chord = (name, root, iv, roman) => ({ name, roman, pc: n(`${root}1`) % 12, iv })
const CH = {
  i: chord('Bm', 'b', [0, 3, 7], 'i'),
  i7: chord('Bm7', 'b', [0, 3, 10], 'i7'),
  ii: chord('C#dim', 'c#', [0, 3, 6], 'ii°'),
  III: chord('D', 'd', [0, 4, 7], 'III'),
  iv: chord('Em', 'e', [0, 3, 7], 'iv'),
  v: chord('F#m', 'f#', [0, 3, 7], 'v'),
  V: chord('F#', 'f#', [0, 4, 7], 'V'), // the raised third a# — the real dominant
  V7: chord('F#7', 'f#', [0, 4, 10], 'V7'),
  VI: chord('G', 'g', [0, 4, 7], 'VI'),
  VII: chord('A', 'a', [0, 4, 7], 'VII'),
  VII7: chord('A7', 'a', [0, 4, 10], 'VII7'),
  // D major's own numerals, for `updraft` — the same seven notes as B natural minor, so
  // the lift to the relative major costs not one accidental (§9.3's free third colour).
  D: chord('D', 'd', [0, 4, 7], 'I/D'),
  G: chord('G', 'g', [0, 4, 7], 'IV/D'),
  A: chord('A', 'a', [0, 4, 7], 'V/D'),
  A7: chord('A7', 'a', [0, 4, 10], 'V7/D'),
  Bm: chord('Bm', 'b', [0, 3, 7], 'vi/D'),
  Em: chord('Em', 'e', [0, 3, 7], 'ii/D'),
  Fsm: chord('F#m', 'f#', [0, 3, 7], 'iii/D'),
  // the augmented sixth, spelled as it sounds: flat six in the bass, the tonic above it
  // and the sharp four above that. g–b–e# resolves OUTWARD to f#, both ways at once.
  It6: chord('It+6', 'g', [0, 4, 10], 'It+6'),
}
/** The chord's `k`-th member at or above `floor` — voicing by register, not by inversion
 *  arithmetic, so an inner lane keeps its octave while the roots move under it. */
function tone(ch, k, floor) {
  const pc = (ch.pc + ch.iv[k % ch.iv.length] + 12 * Math.floor(k / ch.iv.length)) % 12
  const base = n(floor)
  return base + (((pc - base) % 12) + 12) % 12
}
/** The root in the octave at or above `floor`. */
const root = (ch, floor) => tone(ch, 0, floor)

// =====================================================================================
// instruments — the melodic voices are piece-specific, because a lead that never changes
// colour is the reference document's static-instrumentation failure and this piece asks
// one tune to survive 51 frames. Three ticks to a row at speed 3, so every macro below is
// read in THIRDS OF A ROW: a six-value envelope is exactly one eighth note long.
// =====================================================================================
/** THE LEAD (instrument 0, and the album gate compares instrument 0 across every piece).
 *  A 50 % front narrowing to 25 % from the second row, a body that settles two steps
 *  under the column, and a three-tick scoop — the accumulated offset is 3, 1, 0, so the
 *  note is on pitch by the end of its first row (pitch macros ACCUMULATE, so the values
 *  sum to 0 rather than merely ending on 0). At 100 ms an eighth this reads as attack. */
const LEAD = s.instrument('lead', {
  volume: { values: [12, 15, 15, 14, 13, 13], loop: 5 },
  duty: { values: [2, 1, 1], loop: 2 },
  pitch: { values: [3, -2, -1, 0] },
})
/** The lead's SECOND COLOUR. LEAD opens at 50 % and settles at 25 %; this one opens at
 *  25 % and settles at 12.5 %, softer and slower, with no scoop at all — a thinner singer
 *  of the same tune. It takes `hush` (31:0–32:47), where there are two lanes and nothing
 *  else, and the descant over the sawtooth's tune in `updraft`. */
const LEAD_THIN = s.instrument('lead-thin', {
  volume: { values: [8, 12, 13, 12, 12, 11], loop: 5 },
  duty: { values: [1, 1, 0], loop: 2 },
})
/** The lead's THIRD colour, for the climb. LEAD and LEAD_THIN both narrow; this one does
 *  not move at all — a flat 50 %, the widest duty and the loudest-sounding at equal volume
 *  (§2.3) — so `crest` (44:0–48:47) is a section repaint as well as a register climb, and
 *  the peak at 47:6 is the fattest note in the piece rather than merely the highest. A lead
 *  that carries one duty envelope from the first frame to the last is the master
 *  reference's static-instrumentation failure; three envelopes over fifteen sections is the
 *  cheapest answer this hardware has to it. */
const LEAD_WIDE = s.instrument('lead-wide', {
  volume: { values: [13, 15, 15, 15, 14, 14], loop: 5 },
  duty: { values: [2], loop: 0 },
  pitch: { values: [3, -2, -1, 0] },
})
/** Pulse 2's counter-voice: a 25 % front opening to the round 50 %, the opposite motion to
 *  the lead's, so the two are told apart by their attacks and not by their levels. Its
 *  body sustains, because C holds where the tune moves. */
const COUNTER = s.instrument('counter', {
  volume: { values: [10, 13, 13, 12, 12], loop: 4 },
  duty: { values: [1, 1, 2], loop: 2 },
})
/** Pulse 2 as the thin distant answer in `chase`'s trades: 12.5 % throughout, quiet. */
const ANSWER = s.instrument('answer', {
  volume: { values: [9, 11, 10, 9, 8], loop: 4 },
  duty: { values: [0], loop: 0 },
})
/** The triangle's gallop note: a six-tick gate, exactly one eighth, so the compound bass
 *  is DETACHED at 100 ms and the low end never smears. The triangle has no volume — this
 *  is a gate, and its dynamics are rhythm and register (§1). */
const TRI_8 = s.instrument('tri-eighth', { volume: { values: [15, 15, 15, 15, 15, 0] } })
/** The triangle held: the chromatic walk's two-bar links and the pedals. */
const TRI_HOLD = s.instrument('tri-hold', { volume: { values: [15], loop: 0 } })
/** The triangle as a drum — a note in the low kit register with a steep accumulating drop,
 *  four ticks. One per section at most; it costs the bass note it replaces (§2.6). */
const TRI_THUMP = s.instrument('tri-thump', {
  volume: { values: [15, 15, 15, 0] },
  pitch: { values: [0, 6, 10, 0] },
})
/** The sawtooth's tenor eighths: five sounding ticks of a six-tick eighth, so every note
 *  is detached. Volume 15 on the saw is about twice a pulse at 15 — this lane is written
 *  at 9–11 and never above 12 (§12.2). */
const SAW_RUN = s.instrument('saw-run', { volume: { values: [12, 12, 10, 6, 0] } })
/** THE SAW AS THE TUNE — `updraft`'s second lead. A stepped bend-in (accumulated 4, 2, 1,
 *  0: on pitch by the second row) and a swell into the body, which is how the saw sounds
 *  like a brass voice entering rather than a bass line changing note. */
const SAW_LEAD = s.instrument('saw-lead', {
  volume: { values: [9, 12, 13, 13, 12, 12], loop: 5 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** The sustained sawtooth, for the pedals and the half-time brake: 8 is already loud. */
const SAW_HOLD = s.instrument('saw-hold', { volume: { values: [8, 10, 10], loop: 2 } })
/** V1's ARPEGGIO BED: a four-tick ping, bright 25 % narrowing to 12.5 %, written out as
 *  actual 16th rows rather than an `0xy` so the arpeggio IS a line and can be taken away.
 *  It is established in `launch` and `flight` and then leaves at 6:0 (§2.4, and the
 *  master reference: drop the arpeggio once the harmony is established). */
const BED = s.instrument('bed', {
  volume: { values: [12, 10, 6, 0] },
  duty: { values: [3, 1], loop: 1 },
})
/** The VRC6 pulses' sustained harmony: the chip's own attack, duty 7 -> 2 over four ticks,
 *  which is an entrance rather than a pad opening. Duty 0–7 only; 8 sets the mode bit. */
const HARM = s.instrument('harm', {
  volume: { values: [8, 11, 11, 11], loop: 3 },
  duty: { values: [7, 5, 3, 2], loop: 3 },
})
/** The VRC6 stab — four sounding ticks, so an off-beat stab never bleeds into the beat
 *  after it. It carries the off-beat thirds, the hemiola's three-count and the 5-row cell. */
const STAB = s.instrument('stab', {
  volume: { values: [13, 11, 6, 0] },
  duty: { values: [3, 1], loop: 1 },
})
/** The thin VRC6 tick for the 5-row cell's quieter frames: 12.5 %, three ticks, one row. */
const TICK = s.instrument('tick', {
  volume: { values: [11, 7, 0] },
  duty: { values: [1], loop: 0 },
})
/** The fill riser: the period INDEX falls, so the pitch rises (index = 47 − note, and the
 *  pitch macro adds to the index and clamps 0..15 without wrapping — the arpeggio macro
 *  would wrap every 16 semitones, which is why drum sweeps are never written there). Nine
 *  ticks is three rows, half a beat: a riser this tempo can actually hear. Self-ending. */
const RISER = s.instrument('riser', {
  volume: { values: [4, 6, 7, 9, 10, 11, 12, 13, 13, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 41,
})
/** Its opposite, for the fills that fall instead of rise: the index climbs four steps. */
const FALLER = s.instrument('faller', {
  volume: { values: [13, 12, 10, 8, 6, 4, 2, 0] },
  pitch: { values: [1, 1, 1, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 43,
})
/** The roll grain: two ticks, so two adjacent rows read as two distinct strokes at 50 ms.
 *  Rolls are the material this tempo gives away for free (§2.6). */
const ROLL = s.instrument('roll', {
  volume: { values: [14, 8, 0] },
  duty: { values: [0], loop: 0 },
  note: 40,
})
/** A long tom for the tumbling fills — the bank's tom is three ticks, this one is seven. */
const TOM_LONG = s.instrument('tom-long', {
  volume: { values: [15, 14, 12, 10, 7, 4, 0] },
  pitch: { values: [1, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 43,
})
// The shared bank, byte-identical to the fixture: a drum that is the same drum across the
// album is worth more than a lead that is the same lead (§12.6).
const [KICK, SNARE, TOM, HAT, OHAT, CRASH, METAL, RIM] =
  s.bank('kick', 'snare', 'tom', 'hat-closed', 'hat-open', 'crash', 'metal', 'rim')
const KIT = s.dpcmKit() // kick 36, snare 39 — sparse, and only where weight is wanted

// =====================================================================================
// writers — rhythm-first, so every line below reads as durations and pitches
// =====================================================================================
/** The cancel the DRIVER honours for each channel mode of §12.5, not a zero param: `4x0`
 *  for vibrato, `7x0` with x > 0 for tremolo (a bare `700` REPLAYS the effect memory),
 *  `100` for a portamento (`300` only freezes it), `A00`, `P80`, `000`. */
const CANCEL = {
  porta: ['1', 0], slide: ['1', 0], arp: ['0', 0], vib: ['4', 0],
  trem: ['7', 0x10], vol: ['A', 0], pitch: ['P', 0x80],
}

/** A phrase as consecutive events `[rows, note, vol?, fx?]` from `startRow`. `'-'` rests
 *  (a cut) and `'~'` extends the previous note. A bare event cancels whatever mode the
 *  lane still has latched, exactly as `line()` does; an event carrying its own effect does
 *  not, because that is how a gesture is sustained across notes.
 *
 *  `vib` writes a `4xy` `vibAfter` rows into any note at least `vibMin` rows long and
 *  cancels it on the next event — delayed vibrato, the professional form (§2.5). At 50 ms
 *  a row only the dotted-quarter landings are long enough, which is exactly where the tune
 *  wants it. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vib = 0, vibMin = 6, vibAfter = 3, fade = 0, fadeAfter = 6, vol: defaultVol = 12,
    fixedVol, volShift = 0, cutAtEnd = true } = opts
  const level = (v) => fixedVol ?? Math.max(1, Math.min(15, (v ?? defaultVol) + volShift))
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
    // `Axy` is INVERTED (§1): `Ax0` fades, `A0y` swells. A fade written into a long note is
    // how a held chip note stops being a wall.
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

/** THE GALLOP. One bar of compound bass: `rows` are the attack rows inside the bar and
 *  `notes` the pitches on them, one per row. The default figure is dotted quarter, quarter,
 *  eighth — rows 0, 6, 10 — which is the 6/8 bass this piece lives on. */
const G_LONG = [0, 6, 10]      // dotted quarter · quarter · eighth
const G_RUN = [0, 2, 4, 6, 8, 10] // six even eighths — the running bar
const G_WIDE = [0, 6]          // the two beats, bare
const G_PUSH = [0, 4, 6, 10]   // an eighth early into beat 2, then the push
const G_THREE = [0, 4, 8]      // three quarters — the hemiola's count
function gallop(sec, bar, notes, rows = G_LONG, inst = TRI_8, vol = 15) {
  rows.forEach((r, i) => {
    const note = notes[i % notes.length]
    if (note === null) return
    sec.put(L.TRI, sec.at(bar, r), { note: n(note), inst, vol })
  })
  return sec
}

/** Closed hats on the rows given, skipping any cell the lane already holds — the noise
 *  lane is monophonic, so a kick or a snare on the same row wins. */
function hats(sec, bar, rows, opts = {}) {
  const { on = 8, off = 5, inst = HAT, note = 45 } = opts
  for (const r of rows) {
    const row = sec.at(bar, r)
    if (sec.lanes[L.NOISE][row] !== null) continue
    // the two beats of the bar are the accents; everything between them is a ghost
    sec.put(L.NOISE, row, { note, inst, vol: r % 6 === 0 ? on : off })
  }
  return sec
}

/** The arpeggio bed as WRITTEN 16TH ROWS, three notes to a beat, so it is a line and not a
 *  texture: `0xy` at speed 3 cycles in a third of a row and would read as a buzz (§2.4).
 *  Twelve rows a bar, four notes a beat at the 16th — too many; so three notes on rows
 *  0, 2, 4 of each beat, which is the beat's own three eighths spelling the chord. */
function bed(sec, bar, ch, floor = 'd4', vol = 9, offsets = [0, 1, 2], beats = [0, 6]) {
  for (const beat of beats) {
    offsets.forEach((k, i) => {
      // the group's first note carries the accent and the second beat's group sits a step
      // under the first: two columns a bar, which is the difference between an arpeggio and
      // a machine holding one level for four hundred notes
      sec.put(L.V1, sec.at(bar, beat + i * 2), { note: tone(ch, k, floor), inst: BED, vol: vol + (i === 0 ? 1 : 0) - (beat === 0 ? 0 : 1) })
    })
  }
  return sec
}

// =====================================================================================
// the fill library — §9.4 wants a fill in the last 8 rows of every 8-bar unit and NO TWO
// FILLS ALIKE. That is a claim a generator can enforce instead of asserting: every fill
// goes through `fill()`, which records its exact cells and throws on a repeat. The list
// is also what the track test pins, so the claim cannot rot.
// =====================================================================================
const FILL_LOG = []
/** Write one fill. `cells` are `[row, inst, vol, note?]` inside `bar`; the signature is the
 *  cells themselves, so two fills that differ only in a volume column are two fills, and
 *  two calls that would sound identical are a build error. */
function fill(sec, bar, name, cells) {
  const sig = cells.map(([r, inst, vol, note]) => `${r}:${inst}:${vol}:${note ?? '-'}`).join(' ')
  const clash = FILL_LOG.find((f) => f.sig === sig)
  if (clash !== undefined) {
    throw new Error(`fill "${name}" at ${sec.name} bar ${bar} is identical to "${clash.name}" at ${clash.where} (§9.4)`)
  }
  FILL_LOG.push({ name, where: `${sec.name} bar ${bar}`, sig, section: sec.name })
  for (const [r, inst, vol, note] of cells) {
    sec.put(L.NOISE, sec.at(bar, r), { note: note ?? sec.defaultNote(inst, L.NOISE), inst, vol })
  }
  return sec
}
/** Clear the kit from `row` to the end of `bar`, so a fill replaces the groove there
 *  rather than being buried under it. */
function clearKit(sec, bar, from = 4) {
  for (const r of range(from, 12)) sec.lanes[L.NOISE][sec.at(bar, r)] = null
  return sec
}
/** A 16th roll: `notes` alternate, the volume column walks. Rolls are what 50 ms rows give
 *  away for free, and the volume column is the whole difference between a roll and a mess. */
const rollCells = (from, notes, vols) => vols.map((v, i) => [from + i, ROLL, v, notes[i % notes.length]])
/** Toms tumbling down the kit window (43 → 37), one per eighth. */
const tomCells = (from, notes, vols, inst = TOM_LONG) => notes.map((note, i) => [from + i * 2, inst, vols[i], note])

/** Sparse events on one lane: `[bar, row, note, vol, rows?]` — the note, and a cut `rows`
 *  later, so an answering voice is silent between its answers instead of ringing under the
 *  lead. A bare attack cancels whatever channel mode the lane still has latched (§12.5).
 */
function answers(sec, lane, inst, list, gate = 2) {
  for (const [bar, row, note, vol, len = gate] of list) {
    const at = sec.at(bar, row)
    const held = [...sec.latched(lane, at - 1).keys()].map((m) => CANCEL[m])
    sec.put(lane, at, { note: n(note), inst, vol, fx: held.length ? held : undefined })
    const off = at + len
    if (off < sec.len && sec.lanes[lane][off] === null) sec.put(lane, off, { note: CUT })
  }
  return sec
}

/** THE SPLIT BASS. The triangle takes the two beats and the last eighth (rows 0, 6, 10);
 *  the sawtooth takes the eighths between them (rows 2, 4, 8). Together they are the bar's
 *  six eighths in two timbres an octave and a half apart — which is why the saw here is a
 *  SECOND VOICE and not a doubling of the triangle (the doubled-gallop posture belongs to
 *  another piece on this album and is not borrowed). The saw's rows carry the chord's third
 *  and fifth, so the split is harmonic as well as rhythmic.
 */
const SAW_OFF = [2, 4, 8]
function sawTenor(sec, bar, ch, floor = 'd3', vol = 10, rows = SAW_OFF, degrees = [1, 2, 1]) {
  rows.forEach((r, i) => {
    // the eighth before a beat sits a step under the one after it: a two-note arc per bar,
    // which is all the dynamics a detached lane needs to stop reading as a machine
    sec.put(L.SAW, sec.at(bar, r), { note: tone(ch, degrees[i % degrees.length], floor), inst: SAW_RUN, vol: r === 4 ? vol : vol - 1 })
  })
  return sec
}

/** V2's push: the LAST SIXTEENTH of each beat, an odd row nothing else uses, so the inner
 *  harmony arrives a 16th early and shoves the beat forward. Two attacks a bar. */
function push(sec, bar, ch, floor = 'f#3', vol = 9, rows = [5, 11], degrees = [1, 2]) {
  rows.forEach((r, i) => {
    // the first push of the bar is the accent; the second answers it a step quieter
    sec.put(L.V2, sec.at(bar, r), { note: tone(ch, degrees[i % degrees.length], floor), inst: STAB, vol: vol - i })
  })
  return sec
}

/** One bar of sustained VRC6 harmony: an attack on each beat, held, with a fade written
 *  into the second one so the pair breathes instead of sitting. */
function hold(sec, lane, bar, ch, k, floor, vol = 10, rows = [0, 6]) {
  rows.forEach((r) => sec.put(lane, sec.at(bar, r), { note: tone(ch, k, floor), inst: HARM, vol }))
  return sec
}

// =====================================================================================
// motifs — written once, then displaced, augmented, re-orchestrated and re-harmonised
// =====================================================================================
/** H — THE FLIGHT, four bars. Every bar climbs three eighths and LANDS on the second beat;
 *  bar 3 is bar 1 TWO scale steps higher with its landing pulled back one step onto the
 *  tonic, which makes the peak b5 the fourth link of one gesture rather than a new idea and
 *  keeps it the key's own note rather than a c#6 nobody asked for. Both landings are answered by a stepwise fall whose last
 *  eighth is a REST: at 100 ms an eighth, the rest is the third limb of the motif and the
 *  only reason the tune is singable at this tempo. Contour: one leap of a fifth (d5 -> a5,
 *  bar 3) and one of a fourth (b4 -> ... via the arpeggio); everything else steps or
 *  thirds, and both leaps are answered by stepwise motion the other way. */
const H = [
  [2, 'b4', 12], [2, 'd5', 12], [2, 'f#5', 13], [6, 'a5', 14],
  [2, 'g5', 13], [2, 'f#5', 12], [2, 'e5', 12], [4, 'f#5', 13], [2, '-'],
  [2, 'd5', 12], [2, 'f#5', 13], [2, 'a5', 13], [6, 'b5', 15],
  [2, 'g5', 13], [2, 'e5', 12], [2, 'c#5', 12], [4, 'd5', 13], [2, '-'],
]
/** The head: H's first bar and a half, the unit the trades and the pickups use. */
const HEAD = H.slice(0, 4)

/** H2 — the answer, four bars. It FALLS from the top of each bar where H climbs to it, so
 *  the tune's two four-bar limbs are contrary in contour as well as in harmony; its own
 *  rise (bar 2) is the one place the two agree. Written over Em · D · C#dim · F#m.
 *
 *  Its last bar ends on the SECOND EIGHTH and leaves the whole of beat 2 empty — a rest of
 *  a full dotted quarter, 300 ms, where H's own breaths are a single eighth. That is the
 *  eight-bar phrase mark: the tune stops, and pulse 2 answers into the hole (flight 3:42,
 *  flight2 7:42, chase 11:44, return 41:42). At 100 ms an eighth a lead that never stops is the reference document's
 *  wall of notes, and this is where the wall is deliberately broken. */
const H2 = [
  [2, 'g5', 13], [2, 'f#5', 12], [2, 'e5', 12], [6, 'b4', 12],
  [2, 'd5', 12], [2, 'e5', 12], [2, 'f#5', 13], [4, 'a5', 14], [2, '-'],
  [2, 'g5', 13], [2, 'e5', 12], [2, 'c#5', 12], [6, 'e5', 12],
  [2, 'f#5', 13], [2, 'e5', 12], [2, 'c#5', 12], [6, '-'],
]

// =====================================================================================
// launch — frames 0–1 (8 bars). The piece starts already moving: the triangle's gallop
// alone for two bars, the sawtooth answering with the head of H an octave and a half
// below where the tune will sing it, then the kit and the arpeggio bed. Harmony: four bars
// of i, two of VI, two of v — one chord per two bars, the slowest rhythm in the piece, so
// that A's one-chord-a-bar reads as an acceleration. Pulse 2, V2 and the DPCM lane have
// not spoken yet, which is the cheapest crescendo there is.
// =====================================================================================
const launch = s.section('launch', 8)
{
  const HARMONY = [CH.i, CH.i, CH.i, CH.i, CH.VI, CH.VI, CH.v, CH.v]
  // TRI  the gallop, rows 0 · 6 · 10 — dotted quarter, quarter, eighth. Stepwise and never
  // the same three notes twice: the bass is the only voice for two bars and has to carry
  // the metre on its own.
  const WALK = [
    ['b1', 'f#2', 'a1'], ['b1', 'd2', 'f#2'], ['b1', 'f#2', 'g2'], ['f#2', 'e2', 'd2'],
    ['g1', 'd2', 'b1'], ['g1', 'a1', 'b1'], ['f#1', 'c#2', 'e2'], ['f#1', 'a1', 'c#2'],
  ]
  WALK.forEach((notes, bar) => gallop(launch, bar, notes))
  // SAW  bars 2–3: the head of H, two octaves and a fifth under the pulse's register, so
  // the tune is recognised before it is sung. Bars 4–7: the tenor eighths that split the
  // bar's six eighths with the triangle (rows 2, 4, 8 against its 0, 6, 10).
  phrase(launch, L.SAW, SAW_LEAD, launch.at(2), [...shift(HEAD, -12), [2, 'g4', 10], [2, 'f#4', 10], [2, 'e4', 10], [6, 'f#4', 11]], { volShift: -2 })
  for (const bar of [4, 5, 6, 7]) sawTenor(launch, bar, HARMONY[bar], 'd3', 10)
  // V1  the arpeggio bed ESTABLISHES the harmony from bar 4, six notes a bar — the full
  // density, affordable only because two pulses are silent. It will leave at 6:0.
  for (const bar of [4, 5, 6, 7]) bed(launch, bar, HARMONY[bar], 'd4', 9)
  // NOISE  kit 1: hats on the two beats from bar 4, the kick joining at bar 5, the snare
  // only at bar 6 — three steps of entry, so the groove arrives in stages rather than
  // switching on. FILL 1 at bar 7: a rising roll into A.
  for (const bar of [4, 5, 6, 7]) hats(launch, bar, [0, 4, 6, 10], { on: 7, off: 5 })
  for (const bar of [5, 6, 7]) launch.hits(L.NOISE, KICK, 12, [[bar, 0]])
  for (const bar of [6, 7]) launch.hits(L.NOISE, SNARE, 11, [[bar, 6]])
  clearKit(launch, 7, 4)
  fill(launch, 7, 'rise-into-A', [...rollCells(4, [40, 42], [6, 7, 9, 10]), [8, RISER, 11, 41], [11, SNARE, 13, 41]])
  // P1  two eighths of pickup and nothing else: the tune's first note belongs to A.
  phrase(launch, L.P1, LEAD, launch.at(7, 8), [[2, 'f#4', 11], [2, 'a4', 12]], { cutAtEnd: false })
  // P2 / V2 / DPCM  silent. Stated as cuts so the lanes are explicit, not merely empty.
  for (const lane of [L.P2, L.V2, L.DPCM]) launch.put(lane, 0, { note: CUT })
}

// =====================================================================================
// flight — frames 2–5 (16 bars), THE LOOP TARGET. The tune, over a bass that falls one
// scale step a bar: Bm A G F#m | Em D C#dim F#m | Bm A G D | Em C#dim F# F#. One chord a
// bar, which is the piece's normal harmonic rhythm and the yardstick `dive` and `three`
// are heard against. The last two bars are the CADENTIAL HEMIOLA.
// =====================================================================================
const FLIGHT_HARMONY = [
  CH.i, CH.VII, CH.VI, CH.v, CH.iv, CH.III, CH.ii, CH.v,
  CH.i, CH.VII, CH.VI, CH.III, CH.iv, CH.ii, CH.V, CH.V,
]
/** The lead's closing six bars of A: H's first bar at pitch, then the line lifted a step
 *  at a time — b4 d5 f#5 a5 · g5 f#5 e5 d5 · b4 d5 f#5 g5 — so the third statement of the
 *  climb arrives on the subdominant instead of the tonic and the section has somewhere
 *  left to go. */
const FLIGHT_CLOSE = [
  [2, 'b4', 12], [2, 'd5', 12], [2, 'f#5', 13], [6, 'a5', 14],
  [2, 'g5', 13], [2, 'f#5', 12], [2, 'e5', 12], [4, 'd5', 13], [2, '-'],
  [2, 'b4', 12], [2, 'd5', 12], [2, 'f#5', 13], [6, 'g5', 14],
  [2, 'f#5', 13], [2, 'e5', 12], [2, 'd5', 12], [4, 'f#5', 13], [2, '-'],
  [2, 'e5', 12], [2, 'f#5', 13], [2, 'g5', 13], [6, 'a5', 14],
  [2, 'g5', 13], [2, 'e5', 12], [2, 'c#5', 12], [6, '-'],
]
/** THE CADENTIAL HEMIOLA, two bars of F# major regrouped as six 4-row quarters: the lead
 *  climbs the dominant seventh c#–e–f#–a# and falls back, and the bar has dissolved. */
const HEMIOLA_A = [
  [4, 'c#5', 13], [4, 'e5', 13], [4, 'f#5', 14],
  [4, 'a#5', 14], [4, 'f#5', 13], [4, 'c#5', 12],
]
const flight = s.section('flight', 16)
{
  // P1  H (bars 0–3), H2 (4–7), the closing six (8–13), the hemiola (14–15). The delayed
  // vibrato lands only on the dotted-quarter arrivals, which at 50 ms a row are the only
  // notes long enough to sing (§2.5); it is cancelled by the next bare event.
  const VIB = nib(5, 2) // 452: medium-fast, depth 2 — the album's singing vibrato, quicker
  phrase(flight, L.P1, LEAD, 0, H, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(flight, L.P1, LEAD, flight.at(4), H2, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(flight, L.P1, LEAD, flight.at(8), FLIGHT_CLOSE, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(flight, L.P1, LEAD, flight.at(14), HEMIOLA_A, { cutAtEnd: false })
  // P2  answers ONLY in the holes H leaves — the rows inside a held landing (8, 10) and
  // the empty last eighth of a falling bar (22 of the two-bar unit). Every one of its
  // attacks is on a row pulse 1 does not use, which is the §9.2 floor met by construction
  // rather than by counting. It stays a sixth or more below the lead throughout.
  answers(flight, L.P2, COUNTER, [
    [0, 8, 'e4', 10], [0, 10, 'f#4', 10], [1, 10, 'g4', 10, 4],
    [2, 8, 'd4', 10], [2, 10, 'e4', 10], [3, 10, 'f#4', 10, 4],
    [4, 8, 'b3', 10], [4, 10, 'c#4', 10], [5, 10, 'd4', 10, 4],
    [6, 8, 'a3', 10], [6, 10, 'b3', 10], [7, 10, 'c#4', 10, 4],
    [8, 8, 'e4', 11], [8, 10, 'f#4', 11], [9, 10, 'a4', 11, 4],
    [10, 8, 'd4', 11], [10, 10, 'e4', 11], [11, 10, 'g4', 11, 4],
    [12, 8, 'b3', 11], [12, 10, 'd4', 11], [13, 10, 'e4', 11, 4],
  ])
  // …and in the hemiola pulse 2 takes the six 4-row groups a tenth under the lead, so the
  // regrouping is stated by two voices at once.
  answers(flight, L.P2, COUNTER, [
    [14, 0, 'a3', 11, 4], [14, 4, 'c#4', 11, 4], [14, 8, 'f#4', 11, 4],
    [15, 0, 'e4', 11, 4], [15, 4, 'c#4', 11, 4], [15, 8, 'a3', 11, 4],
  ])
  // TRI  the gallop, one chord a bar, stepwise and active; in the hemiola it HOLDS f#,
  // which is what lets the metre dissolve above it, and the last eighth rises a1 -> b1
  // into A′ while the melody falls c#5 -> b4: contrary motion at the cadence.
  const WALK = [
    ['b1', 'f#2', 'a1'], ['a1', 'e2', 'g2'], ['g1', 'd2', 'b1'], ['f#1', 'c#2', 'e2'],
    ['e1', 'b1', 'd2'], ['d2', 'a1', 'f#2'], ['c#2', 'g1', 'e2'], ['f#1', 'c#2', 'a1'],
    ['b1', 'f#2', 'd2'], ['a1', 'e2', 'c#2'], ['g1', 'd2', 'f#2'], ['d2', 'a1', 'e2'],
    ['e1', 'b1', 'g2'], ['c#2', 'e2', 'g1'],
  ]
  WALK.forEach((notes, bar) => gallop(flight, bar, notes))
  flight.put(L.TRI, flight.at(14, 0), { note: n('f#1'), inst: TRI_HOLD, vol: 15 })
  flight.put(L.TRI, flight.at(15, 0), { note: n('f#1'), inst: TRI_HOLD, vol: 15 })
  flight.put(L.TRI, flight.at(15, 10), { note: n('a1'), inst: TRI_8, vol: 15 })
  // SAW  the other half of the bar's six eighths (rows 2, 4, 8), a third and a fifth above
  // the triangle's roots. It rests through the hemiola, so the cadence loses its low end
  // and the four-row groups are heard without competition.
  for (const bar of range(0, 14)) sawTenor(flight, bar, FLIGHT_HARMONY[bar], 'd3', 10)
  flight.put(L.SAW, flight.at(14, 0), { note: CUT })
  // V1  the bed, beat 1 only — three sixteenths spelling the chord — and the whole bar
  // every fourth bar as a lift. It has one section left before it disappears.
  for (const bar of range(0, 14)) bed(flight, bar, FLIGHT_HARMONY[bar], 'd4', 8, [0, 1, 2], bar % 4 === 3 ? [0, 6] : [0])
  flight.put(L.V1, flight.at(14, 0), { note: CUT })
  // V2  the push: the last SIXTEENTH of each beat, an odd row nothing else uses, so the
  // inner harmony always arrives early. In the hemiola it takes the 4-row groups.
  for (const bar of range(0, 14)) push(flight, bar, FLIGHT_HARMONY[bar], 'f#3', 9)
  for (const bar of [14, 15]) {
    for (const r of [0, 4, 8]) {
      flight.put(L.V2, flight.at(bar, r), { note: tone(CH.V, r === 0 ? 0 : r === 4 ? 1 : 2, 'f#3'), inst: STAB, vol: 10 })
    }
  }
  // NOISE  kit A: kick on 1, hats on the off-eighths 4 and 10, snare on beat 2, a ghost on
  // the last sixteenth pushing into the next bar. The kick doubles on row 8 every fourth
  // bar. FILL 2 at bar 7 and FILL 3 at bar 13 — the second unit's fill comes two bars
  // early because bars 14–15 belong to the hemiola, where the kick takes the groups.
  for (const bar of range(0, 14)) {
    flight.hits(L.NOISE, KICK, 12, [[bar, 0]])
    flight.hits(L.NOISE, SNARE, 12, [[bar, 6]])
    flight.hits(L.NOISE, SNARE, 4, [[bar, 11]])
    if (bar % 4 === 2) flight.hits(L.NOISE, KICK, 10, [[bar, 8]])
    hats(flight, bar, [4, 10], { on: 7, off: 6 })
  }
  clearKit(flight, 7, 6)
  fill(flight, 7, 'tom-tumble', tomCells(6, [43, 41, 39], [13, 12, 12]).concat([[10, SNARE, 13, 41], [11, SNARE, 6, 39]]))
  clearKit(flight, 13, 4)
  fill(flight, 13, 'ghost-crescendo', [4, 5, 6, 7, 8, 9, 10, 11].map((r, i) => [r, SNARE, 3 + i, 39]))
  for (const bar of [14, 15]) for (const r of [0, 4, 8]) flight.hits(L.NOISE, KICK, r === 0 ? 13 : 11, [[bar, r]])
  for (const bar of [14, 15]) hats(flight, bar, [2, 6, 10], { on: 6, off: 5 })
  // DPCM  rests: the sample lane is saved for `chase`, where the arrangement wants weight.
  flight.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// flight2 — frames 6–9 (16 bars). A′. The tune is the same for four bars and everything
// under it has changed: the arpeggio bed LEAVES at 6:0 and does not come back for eleven
// frames (the master reference's instruction — once the harmony is established the
// listener's ear supplies it), the triangle breaks into running eighths for four bars
// while the sawtooth sustains instead of running, and pulse 2 becomes THE COUNTER-VOICE
// for the whole section. H2's four bars are re-harmonised: G Bm Em F# under the same
// notes, so the answer arrives in a different light.
// =====================================================================================
const FLIGHT2_HARMONY = [
  CH.i, CH.VII, CH.VI, CH.v, CH.VI, CH.i, CH.iv, CH.V,
  CH.i, CH.VI, CH.VII, CH.v, CH.iv, CH.VII, CH.III, CH.V,
]
/** A′'s closing eight bars: the line that answers the tune by staying UNDER it, so the
 *  displaced restatement in `chase` arrives in a register the ear has been missing. */
const FLIGHT2_CLOSE = [
  [2, 'f#5', 12], [2, 'e5', 12], [2, 'd5', 12], [6, 'b4', 12],
  [2, 'd5', 12], [2, 'b4', 11], [2, 'g4', 11], [4, 'b4', 12], [2, '-'],
  [2, 'c#5', 12], [2, 'e5', 13], [2, 'a5', 13], [6, 'g5', 14],
  [2, 'f#5', 13], [2, 'e5', 12], [2, 'c#5', 12], [4, 'a4', 12], [2, '-'],
  [2, 'b4', 12], [2, 'e5', 12], [2, 'g5', 13], [6, 'f#5', 13],
  [2, 'e5', 12], [2, 'c#5', 12], [2, 'a4', 11], [4, 'b4', 12], [2, '-'],
  [2, 'd5', 12], [2, 'e5', 12], [2, 'f#5', 13], [6, 'a5', 14],
  [2, 'g5', 13], [2, 'f#5', 12], [2, 'e5', 12], [4, 'c#5', 12], [2, '-'],
]
/** C — THE COUNTER-VOICE. Two notes a bar on rows 3 and 9: the beat displaced by half of
 *  itself, so pulse 2's dotted quarters fall exactly between pulse 1's and the two lines
 *  never share a row in sixteen bars. Its contour answers H bar by bar — it falls where
 *  the tune climbs and climbs where the tune falls — and it crosses ABOVE the lead exactly
 *  once, at 8:9, where the tune is sitting on its lowest held note. */
const C = [
  ['f#4', 'e4'], ['e4', 'g4'], ['d4', 'b3'], ['c#4', 'e4'],
  ['b3', 'd4'], ['f#4', 'd4'], ['e4', 'g4'], ['a#3', 'c#4'],
  ['d4', 'd5'], ['g3', 'b3'], ['e4', 'c#4'], ['c#4', 'f#4'],
  ['g4', 'e4'], ['c#4', 'e4'], ['f#4', 'd4'], ['c#4', 'e4'],
]
const flight2 = s.section('flight2', 16)
{
  const VIB = nib(5, 2)
  // P1  H at pitch for four bars — the pattern de-duplicator proves it is literally A's
  // own pulse-1 pattern — then H2 under new chords, then the closing eight.
  phrase(flight2, L.P1, LEAD, 0, H, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(flight2, L.P1, LEAD, flight2.at(4), H2, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(flight2, L.P1, LEAD, flight2.at(8), FLIGHT2_CLOSE, { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  C, thirty-two attacks, none of them on a row pulse 1 uses. The last one is a
  // SUSPENSION: e4 struck at 9:45 over the dominant, held through the chord change at
  // 10:0 and resolved down by step to d4 at 10:3, which is the section's cadence.
  C.forEach((pair, bar) => {
    const gate = bar === 15 ? 6 : 6
    answers(flight2, L.P2, COUNTER, [[bar, 3, pair[0], 10, gate], [bar, 9, pair[1], 10, gate]])
  })
  flight2.lanes[L.P2][flight2.at(15, 9) + 6] = null // the suspension rings into `chase`
  // TRI  the gallop for eight bars, then RUNNING EIGHTHS for four (bars 8–11) — the one
  // place in the piece the triangle plays all six eighths itself — and back.
  const WALK2 = [
    ['b1', 'f#2', 'a1'], ['a1', 'e2', 'c#2'], ['g1', 'd2', 'b1'], ['f#1', 'c#2', 'e2'],
    ['g1', 'd2', 'b1'], ['b1', 'f#2', 'd2'], ['e1', 'b1', 'g2'], ['f#1', 'c#2', 'e2'],
  ]
  WALK2.forEach((notes, bar) => gallop(flight2, bar, notes))
  const RUN2 = [
    ['b1', 'c#2', 'd2', 'e2', 'f#2', 'g2'], ['g1', 'a1', 'b1', 'c#2', 'd2', 'b1'],
    ['a1', 'b1', 'c#2', 'd2', 'e2', 'c#2'], ['f#1', 'g1', 'a1', 'b1', 'c#2', 'a1'],
  ]
  RUN2.forEach((notes, i) => gallop(flight2, 8 + i, notes, G_RUN))
  const WALK2B = [['e1', 'b1', 'd2'], ['a1', 'e2', 'c#2'], ['d2', 'a1', 'f#2'], ['f#1', 'c#2', 'a1']]
  WALK2B.forEach((notes, i) => gallop(flight2, 12 + i, notes))
  // SAW  tenor eighths where the triangle galloped; SUSTAINED where the triangle runs, so
  // the two never both subdivide. Held at 8 — the saw's 15 is about twice a pulse's.
  for (const bar of [0, 1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15]) sawTenor(flight2, bar, FLIGHT2_HARMONY[bar], 'd3', 10)
  for (const bar of [8, 9, 10, 11]) {
    for (const r of [0, 6]) {
      flight2.put(L.SAW, flight2.at(bar, r), { note: tone(FLIGHT2_HARMONY[bar], r === 0 ? 1 : 2, 'd3'), inst: SAW_HOLD, vol: 8 })
    }
  }
  // V1  SILENT for the whole section. This is the arpeggio bed's declared absence (6:0);
  // it re-enters, changed, at 18:0.
  flight2.put(L.V1, 0, { note: CUT })
  // V2  sustained thirds and sixths on the beats — a pad where A had stabs, which is the
  // other half of why the same tune sounds different here.
  for (const bar of range(0, 16)) {
    hold(flight2, L.V2, bar, FLIGHT2_HARMONY[bar], bar % 2 === 0 ? 1 : 2, 'f#3', 9)
    flight2.put(L.V2, flight2.at(bar, 9), { fx: [['A', 0x20]] }) // Ax0 FADES (§1), cancelled by the next attack
  }
  flight2.put(L.V2, flight2.len - 1, { fx: [['A', 0]] })
  // NOISE  kit B, four parameters different from A: the snare is the high one (41), the
  // hats move to the second eighth of each beat (2 and 8), the kick is pushed on the last
  // sixteenth of bar 4 of each unit, and an open hat closes every fourth bar.
  for (const bar of range(0, 16)) {
    flight2.hits(L.NOISE, KICK, 12, [[bar, 0]])
    flight2.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    if (bar % 4 === 3) flight2.hits(L.NOISE, OHAT, 8, [[bar, 10]])
    if (bar % 4 === 1) flight2.hits(L.NOISE, KICK, 10, [[bar, 11]])
    hats(flight2, bar, [2, 8], { on: 7, off: 6 })
  }
  clearKit(flight2, 7, 6)
  fill(flight2, 7, 'metal-stagger', [[6, METAL, 10, 44], [7, METAL, 7, 44], [9, METAL, 10, 44], [10, SNARE, 12, 41], [11, SNARE, 8, 39]])
  clearKit(flight2, 15, 4)
  fill(flight2, 15, 'roll-down', rollCells(4, [42, 40], [12, 9, 11, 8, 10, 7]).concat([[10, TOM_LONG, 13, 39], [11, RISER, 11, 41]]))
  // DPCM  still silent. Three sections in, the sample lane has not been heard.
  flight2.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// chase — frames 10–13 (16 bars). The same tune, ONE EIGHTH LATE. H and H2 are written
// from row 2 of the section instead of row 0 (§9.1 recipe F: at 140–160 BPM use ±2 rows,
// and at 200 an eighth is the smallest displacement the ear can still call late rather
// than wrong) while the kit, the bass and the inner voices stay exactly on the grid. For
// eight bars the tune is behind its own accompaniment; the two pulses then trade two-bar
// phrases on the grid, and the last four bars snap the bar back into place.
// The DPCM pair speaks here for the first time — four sections in, which is why it reads
// as weight arriving rather than as a drum machine that was always on.
// =====================================================================================
const CHASE_HARMONY = [
  CH.i, CH.VII, CH.VI, CH.v, CH.iv, CH.III, CH.ii, CH.v,
  CH.VI, CH.III, CH.iv, CH.V, CH.i, CH.VI, CH.ii, CH.V,
]
const chase = s.section('chase', 16)
{
  const VIB = nib(5, 2)
  // P2  the suspension from 9:45 resolves here, down by step onto the new chord's ninth.
  answers(chase, L.P2, COUNTER, [[0, 3, 'd4', 10, 4]])
  // P1  H and H2, both displaced two rows. The section's own rest pattern moves with them,
  // so the breath lands on a downbeat instead of before one — the displacement is audible
  // in the silence as well as in the notes.
  phrase(chase, L.P1, LEAD, 2, H, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(chase, L.P1, LEAD, chase.at(4) + 2, H2, { vib: VIB, vibMin: 6, vibAfter: 3 })
  // bars 8–9: pulse 1 takes the first half of the trade, on the grid again
  phrase(chase, L.P1, LEAD, chase.at(8), [
    [2, 'b4', 12], [2, 'd5', 13], [2, 'g5', 13], [6, 'f#5', 13],
    [2, 'e5', 12], [2, 'd5', 12], [2, 'c#5', 12], [4, 'd5', 12], [2, '-'],
  ])
  // bars 12–15: the snap-back — H's head at pitch, on the grid, then the cadence
  phrase(chase, L.P1, LEAD, chase.at(12), [
    [2, 'b4', 13], [2, 'd5', 13], [2, 'f#5', 14], [6, 'a5', 14],
    [2, 'g5', 13], [2, 'd5', 13], [2, 'b4', 12], [4, 'd5', 13], [2, '-'],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'g5', 14], [6, 'e5', 13],
    [2, 'f#5', 13], [2, 'e5', 13], [2, 'c#5', 13], [4, 'f#5', 14], [2, '-'],
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  bars 10–11: the second half of the trade, in pulse 1's own register on the THIN
  // 12.5 % answer instrument, so the phrase changes singer rather than changing octave.
  phrase(chase, L.P2, ANSWER, chase.at(10), [
    [2, 'e5', 11], [2, 'd5', 11], [2, 'b4', 11], [6, 'c#5', 11],
    [2, 'd5', 11], [2, 'c#5', 11], [2, 'a#4', 11], [4, 'c#5', 11], [2, '-'],
  ])
  // TRI  a new bass figure: rows 0 · 4 · 6 · 10, an eighth EARLY into the second beat, so
  // the bass is pushing while the tune is late.
  const WALK3 = [
    ['b1', 'd2', 'f#2', 'a1'], ['a1', 'c#2', 'e2', 'g2'], ['g1', 'b1', 'd2', 'b1'], ['f#1', 'a1', 'c#2', 'e2'],
    ['e1', 'g1', 'b1', 'd2'], ['d2', 'f#2', 'a1', 'f#2'], ['c#2', 'e2', 'g1', 'e2'], ['f#1', 'a1', 'c#2', 'a1'],
    ['g1', 'b1', 'd2', 'b1'], ['d2', 'f#2', 'a1', 'f#2'], ['e1', 'g1', 'b1', 'g1'], ['f#1', 'a#1', 'c#2', 'a#1'],
    ['b1', 'd2', 'f#2', 'a1'], ['g1', 'b1', 'd2', 'b1'], ['c#2', 'e2', 'g1', 'e2'], ['f#1', 'a#1', 'c#2', 'e2'],
  ]
  WALK3.forEach((notes, bar) => gallop(chase, bar, notes, G_PUSH))
  // SAW  just the two eighths the triangle leaves (rows 2 and 8) — the split bass again,
  // but with the split moved, so the composite six-eighth line has a different seam.
  for (const bar of range(0, 16)) sawTenor(chase, bar, CHASE_HARMONY[bar], 'd3', 10, [2, 8], [1, 2])
  // V1  still absent.
  chase.put(L.V1, 0, { note: CUT })
  // V2  the earliest push yet: the SECOND sixteenth of each beat (rows 1 and 7), which is
  // the one subdivision neither the melody nor the kit ever occupies.
  for (const bar of range(0, 16)) push(chase, bar, CHASE_HARMONY[bar], 'f#3', 9, [1, 7], [1, 2])
  // NOISE  kit C: the kick on BOTH beats, the snare late on row 9 only, metal ticks on the
  // off-eighths, a ghost pushing the barline. Three parameters away from kit B.
  for (const bar of range(0, 16)) {
    chase.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 6]])
    chase.hits(L.NOISE, SNARE, 12, [[bar, 9]], 39)
    chase.put(L.NOISE, chase.at(bar, 4), { note: 44, inst: METAL, vol: 7 })
    chase.put(L.NOISE, chase.at(bar, 10), { note: 44, inst: METAL, vol: 6 })
    if (bar % 4 === 3) chase.hits(L.NOISE, SNARE, 4, [[bar, 11]], 39)
  }
  clearKit(chase, 7, 6)
  fill(chase, 7, 'rim-and-riser', [[6, RIM, 12, 44], [7, RIM, 8, 44], [8, RIM, 11, 44], [9, RISER, 12, 40], [11, SNARE, 13, 41]])
  clearKit(chase, 11, 6)
  fill(chase, 11, 'open-hat-turn', [[6, OHAT, 9, 46], [8, SNARE, 11, 39], [9, SNARE, 5, 39], [10, SNARE, 13, 41], [11, KICK, 12, 36]])
  clearKit(chase, 15, 4)
  fill(chase, 15, 'tom-and-tumble', tomCells(4, [43, 41, 39, 37], [12, 12, 13, 13], TOM).concat([[11, RISER, 12, 41]]))
  // DPCM  the bank's kick on the downbeat of every second bar, and its snare on the last
  // sixteenth of each four-bar unit. It ducks the triangle and the noise through the shared
  // TND index, and because the triangle is being restruck on that row anyway the duck reads
  // as the groove's own accent rather than as a hole (§2.8).
  chase.hits(L.DPCM, KIT.inst, 13, range(0, 16, 2).map((bar) => [bar, 0]), KIT.kick)
  chase.hits(L.DPCM, KIT.inst, 11, [[3, 11], [7, 11], [11, 11], [15, 11]], KIT.snare)
}

// =====================================================================================
// dive — frames 14–17 (16 bars). NON-DIATONIC DEVICE 1: a six-link chromatic bass descent,
// b – a# – a – g# – g – f#, TWO BARS a link, 1.2 s each. The harmonic rhythm halves here
// against A's one chord a bar, and the upper voices barely move — the descant oscillates
// d5–c#5 while the bass falls six semitones — so each chord is what the collision implies:
//   b  · Bm          the tonic
//   a# · F# over a#  the real dominant in first inversion (the a# is the raised third)
//   a  · A7          the subtonic, its seventh in the descant
//   g# · G#dim       a common-tone diminished sharing b AND d with the tonic
//   g  · G           the flat sixth, diatonic and dark
//   f# · F#          the dominant in root position — and the dive has landed
// At 600 ms a bar this is not a slow contrapuntal descent. It is a fall: the bass drops an
// octave-and-a-semitone of chromatic steps in 7.2 s while the kit has no kick at all.
// =====================================================================================
const dive = s.section('dive', 16)
{
  // TRI  the walk itself. Each link galloping in octaves on its own root, and the SECOND
  // bar of each link ends on the next link's root an eighth early, so the descent is
  // announced before it arrives — which is what makes six links read as one gesture.
  const LINKS = ['b1', 'a#1', 'a1', 'g#1', 'g1', 'f#1']
  LINKS.forEach((low, link) => {
    const next = LINKS[link + 1] ?? 'b1'
    gallop(dive, link * 2, [low, n(low) + 12, low])
    gallop(dive, link * 2 + 1, [low, n(low) + 12, next])
  })
  // bars 12–15: the landing. The gallop comes back to B minor and starts to climb.
  const LAND = [['b1', 'f#2', 'd2'], ['e1', 'b1', 'g2'], ['f#1', 'c#2', 'a1'], ['b1', 'd2', 'f#2']]
  LAND.forEach((notes, i) => gallop(dive, 12 + i, notes))
  // P1  the descant: four notes in eight bars, each two bars long, moving a semitone at a
  // time against the bass's six. Delayed vibrato on every one of them (they are the only
  // notes in the piece long enough to bloom) and an `Ax0` fade — INVERTED direction, x
  // fades — so a 1.2 s chip note is a diminuendo instead of a wall.
  phrase(dive, L.P1, LEAD, 0, [[24, 'd5', 13], [24, 'c#5', 13], [24, 'c#5', 12], [24, 'd5', 13]], {
    vib: nib(4, 3), vibMin: 12, vibAfter: 6, fade: 0x20, fadeAfter: 14, cutAtEnd: false,
  })
  // bars 8–11: the climb out, one note a bar
  phrase(dive, L.P1, LEAD, dive.at(8), [[12, 'd5', 13], [12, 'e5', 13], [12, 'f#5', 14], [12, 'g5', 14]], {
    vib: nib(5, 2), vibMin: 8, vibAfter: 4, cutAtEnd: false,
  })
  // bars 12–15: the arrival, and the first eighths the lead has played in eight bars
  phrase(dive, L.P1, LEAD, dive.at(12), [
    [2, 'f#5', 13], [2, 'd5', 13], [2, 'b4', 12], [6, 'f#5', 14],
    [2, 'g5', 13], [2, 'f#5', 13], [2, 'e5', 12], [4, 'b4', 12], [2, '-'],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'a4', 12], [6, 'f#5', 14],
    [2, 'e5', 13], [2, 'd5', 13], [2, 'c#5', 13], [4, 'd5', 13], [2, '-'],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3 })
  // P2  silent for twelve bars — the dive is a thin texture on purpose — then two bars of
  // thirds under the arrival, which is the band coming back.
  dive.put(L.P2, 0, { note: CUT })
  answers(dive, L.P2, COUNTER, [
    [14, 0, 'a4', 10, 4], [14, 6, 'g4', 10, 4], [15, 0, 'f#4', 10, 4], [15, 6, 'a4', 10, 6],
  ])
  // V1  still absent: nine frames without the arpeggio bed, and the harmony has been
  // carried by two voices and a walking bass the whole time.
  dive.put(L.V1, 0, { note: CUT })
  // V2  the one sustaining voice, holding the tone each link collides with, breathing on a
  // `7xy` tremolo (unipolar and downward only, so the column is written a step high to
  // compensate) and cancelled with `7x0` where x > 0 — a bare `700` replays the effect
  // memory instead of clearing it.
  const V2_HOLD = [
    ['f#3', 'a3'], ['f#3', 'a#3'], ['e4', 'c#4'], ['d4', 'b3'], ['d4', 'b3'], ['c#4', 'a#3'],
  ]
  V2_HOLD.forEach((pair, link) => {
    pair.forEach((note, i) => {
      const bar = link * 2 + i
      dive.put(L.V2, dive.at(bar, 0), { note: n(note), inst: HARM, vol: 10 })
      dive.put(L.V2, dive.at(bar, 4), { fx: [['7', nib(3, 2)]] })
    })
  })
  dive.put(L.V2, dive.at(11, 10), { fx: [['7', 0x10]] })
  for (const bar of [12, 13, 14, 15]) push(dive, bar, [CH.i, CH.iv, CH.V, CH.i][bar - 12], 'f#3', 9)
  // SAW  silent for eight bars — the lowest voice leaving is what makes a falling bass
  // sound like a fall — then sustained under the last two links, then the tenor eighths.
  dive.put(L.SAW, 0, { note: CUT })
  for (const bar of [8, 9, 10, 11]) {
    dive.put(L.SAW, dive.at(bar, 0), { note: n(bar < 10 ? 'd3' : 'c#3'), inst: SAW_HOLD, vol: 8 })
    dive.put(L.SAW, dive.at(bar, 6), { note: n(bar < 10 ? 'b2' : 'a#2'), inst: SAW_HOLD, vol: 8 })
  }
  // the climb out, written into the lane rather than into the columns: `A0y` SWELLS (the
  // direction is inverted — `Ax0` fades and `A0y` swells, §1), so the sawtooth grows under
  // the last two links of the descent. Cancelled with `A00` where the eighths take over.
  dive.put(L.SAW, dive.at(8, 3), { fx: [['A', 0x03]] })
  dive.put(L.SAW, dive.at(12, 0), { note: tone(CH.i, 1, 'd3'), inst: SAW_RUN, vol: 10, fx: [['A', 0]] })
  for (const bar of [12, 13, 14, 15]) sawTenor(dive, bar, [CH.i, CH.iv, CH.V, CH.i][bar - 12], 'd3', 10)
  // NOISE  kit D: NO KICK AND NO SNARE for eight bars, hats alone on the two beats and the
  // last eighth — the kit steps out of the way of the descent. The kick returns at bar 8
  // with the saw, the snare at bar 10, and the full kit only at the landing.
  for (const bar of range(0, 8)) hats(dive, bar, [0, 6, 10], { on: 7, off: 5 })
  for (const bar of range(8, 12)) {
    dive.hits(L.NOISE, KICK, 12, [[bar, 0]])
    if (bar >= 10) dive.hits(L.NOISE, SNARE, 11, [[bar, 6]], 39)
    hats(dive, bar, [2, 4, 6, 10], { on: 7, off: 5 })
  }
  for (const bar of range(12, 16)) {
    dive.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 8]])
    dive.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    dive.hits(L.NOISE, SNARE, 4, [[bar, 11]], 39)
    hats(dive, bar, [2, 4, 10], { on: 7, off: 6 })
  }
  clearKit(dive, 7, 6)
  fill(dive, 7, 'hat-to-kick', [[6, HAT, 6, 45], [8, HAT, 7, 45], [10, OHAT, 10, 46], [11, KICK, 11, 36]])
  clearKit(dive, 11, 6)
  fill(dive, 11, 'faller-into-landing', [[6, FALLER, 12, 43], [9, TOM, 12, 37], [10, TOM, 12, 39], [11, SNARE, 14, 41]])
  clearKit(dive, 15, 4)
  fill(dive, 15, 'roll-up', rollCells(4, [41, 43], [7, 8, 10, 11, 12, 13]).concat([[10, SNARE, 12, 39], [11, SNARE, 14, 41]]))
  dive.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// three — frames 18–22 (20 bars). THE HEMIOLA SECTION, and the piece's structural device
// for §9.5 axis 11. The 12-row bar is heard as 3 x 4 rows instead of 2 x 6 for twenty bars
// at once: V2, V1, the kit and the TUNE ITSELF count three while the triangle, the sawtooth
// and pulse 2 keep two. The tune counts three because it is H IN AUGMENTATION — every
// value doubled — and doubling a 6/8 melody lands every one of its attacks on a multiple of
// four rows. The augmentation is not decoration of the device; it IS the device.
// Bars 8–15 are H AUGMENTED AND INVERTED about f#5, so the climb falls and the falls climb.
// Harmonic rhythm: ONE CHORD PER FOUR BARS — Bm · Em · D · F#m · F# — a quarter of A's
// speed, which is the section whose harmonic rhythm differs (§9.3), and the closing F# hands
// over to `hinge`'s flat sixth as a deceptive V -> VI.
// =====================================================================================
const three = s.section('three', 20)
{
  const H_AUG = augment(H)                 // 96 rows = 8 bars, every attack on a 4-row grid
  const H_AUG_INV = augment(invert(H, 'f#5')) // the same, upside down about f#5
  const CHORDS_4 = [CH.i, CH.iv, CH.III, CH.v, CH.V] // one per four bars
  const chordAt = (bar) => CHORDS_4[Math.min(4, Math.floor(bar / 4))]
  // P1  the tune on the 4-row grid for sixteen bars, then four bars that snap back into two
  phrase(three, L.P1, LEAD, 0, H_AUG, { vib: nib(4, 2), vibMin: 12, vibAfter: 5, cutAtEnd: false })
  phrase(three, L.P1, LEAD, three.at(8), H_AUG_INV, { vib: nib(4, 2), vibMin: 12, vibAfter: 5, cutAtEnd: false })
  phrase(three, L.P1, LEAD, three.at(16), [
    [4, 'f#5', 13], [4, 'a5', 14], [4, 'c#6', 15],   // still in three…
    [4, 'a#5', 14], [4, 'f#5', 13], [4, 'c#5', 13],
    [2, 'd5', 13], [2, 'e5', 13], [2, 'f#5', 13], [6, 'a5', 14], // …and back into two
    [2, 'g5', 13], [2, 'f#5', 13], [2, 'e5', 13], [4, 'c#5', 13], [2, '-'],
  ])
  // P2  silent for eight bars, then sustained notes on the two BEATS (rows 0 and 6) — it
  // is one of the three voices arguing for the bar while everything above it counts three.
  three.put(L.P2, 0, { note: CUT })
  for (const bar of range(8, 16)) {
    answers(three, L.P2, COUNTER, [
      [bar, 0, tone(chordAt(bar), 1, 'b3'), 10, 6], [bar, 6, tone(chordAt(bar), 2, 'b3'), 10, 6],
    ])
    // pulse 2's own articulation: a delayed `432` three rows into each of its dotted
    // quarters, so the voice arguing for the bar is the one that SINGS while the voices
    // counting three are struck and detached. Each is cancelled by the next bare attack.
    for (const r of [3, 9]) three.put(L.P2, three.at(bar, r), { fx: [['4', nib(3, 2)]] })
  }
  // TRI  TWO, bare: the two beats and nothing else, an active pedal under a static chord —
  // root, fifth, octave, third, so four bars of one harmony still move.
  const PEDAL = [
    ['b1', 'f#2'], ['b1', 'd2'], ['b2', 'f#2'], ['b1', 'a1'],
    ['e1', 'b1'], ['e1', 'g2'], ['e2', 'b1'], ['e1', 'd2'],
    ['d2', 'a1'], ['d2', 'f#2'], ['d2', 'a2'], ['d2', 'c#2'],
    ['f#1', 'c#2'], ['f#1', 'a1'], ['f#2', 'c#2'], ['f#1', 'e2'],
    ['f#1', 'c#2'], ['f#1', 'a#1'], ['f#2', 'c#2'], ['f#1', 'a#1'],
  ]
  PEDAL.forEach((notes, bar) => gallop(three, bar, notes, G_WIDE))
  // SAW  silent for eight bars, then the tenor eighths — in TWO, with the triangle, which
  // is what makes the section bi-metric rather than simply regrouped.
  three.put(L.SAW, 0, { note: CUT })
  for (const bar of range(8, 20)) sawTenor(three, bar, chordAt(bar), 'd3', 10)
  // V1  THE ARPEGGIO BED RETURNS at 18:0, twelve frames after it left, and it is not the
  // same bed: instead of three sixteenths on beat 1 it takes the three 4-row groups
  // DISPLACED BY AN EIGHTH (rows 2, 6, 10), a second three-count offset from V2's.
  for (const bar of range(0, 20)) {
    [2, 6, 10].forEach((r, i) => {
      three.put(L.V1, three.at(bar, r), { note: tone(chordAt(bar), i, 'd4'), inst: BED, vol: r === 2 ? 9 : 8 })
    })
  }
  // V2  the three-count itself: rows 0, 4, 8, every bar, twenty bars. The lane the hemiola
  // is carried by (§4a of the brief), stepping up through the chord so the groups are three
  // different pitches and not one note hammered.
  for (const bar of range(0, 20)) {
    [0, 4, 8].forEach((r, i) => {
      three.put(L.V2, three.at(bar, r), { note: tone(chordAt(bar), i, 'f#3'), inst: STAB, vol: r === 0 ? 11 : 9 })
    })
  }
  // NOISE  the hemiola kit: kick on the first group, snare on the second and third, the hat
  // on the last eighth of the bar as the only thing still admitting the bar exists.
  for (const bar of range(0, 20)) {
    three.hits(L.NOISE, KICK, 12, [[bar, 0]])
    three.hits(L.NOISE, SNARE, 11, [[bar, 4]], 39)
    three.hits(L.NOISE, SNARE, 8, [[bar, 8]], 39)
    hats(three, bar, [10], { on: 6, off: 6 })
  }
  clearKit(three, 7, 4)
  fill(three, 7, 'three-count-toms', [[4, TOM, 12, 43], [6, TOM, 12, 41], [8, TOM, 13, 39], [10, TOM, 13, 37], [11, SNARE, 6, 39]])
  clearKit(three, 15, 4)
  fill(three, 15, 'three-count-roll', rollCells(4, [40, 43], [9, 11, 8, 12, 10, 13]).concat([[10, METAL, 9, 44], [11, RISER, 12, 41]]))
  clearKit(three, 19, 4)
  fill(three, 19, 'snap-back', [[4, KICK, 12, 36], [6, SNARE, 12, 41], [7, SNARE, 5, 39], [8, KICK, 12, 36], [10, OHAT, 10, 46]])
  three.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// hinge — frames 23–24 (8 bars). NON-DIATONIC DEVICE 2: the AUGMENTED SIXTH, and it is not
// a cadence. Two pieces on this album put an Italian sixth at a close; this one puts it
// mid-flight, at 23:36, with the kit running through it at full speed. The voicing is
// §9.3's own: the triangle takes the flat sixth (g), pulse 2 the tonic (b) and pulse 1 the
// sharp fourth (e#), with the VRC6 pair doubling the outer two. At 24:0 it resolves OUTWARD
// — g falls to f#, e# rises to f# — and then the piece refuses to treat that f# as a
// dominant: bars 6–7 strip the chord to bare f# octaves and `updraft` reads the same note
// as the THIRD of D major. The augmented sixth throws the music forward into the relative
// major instead of closing it onto the tonic, which is the whole difference between a hinge
// and a cadence.
// =====================================================================================
const hinge = s.section('hinge', 8)
{
  // TRI  three bars of gallop on the flat sixth, the aug-6 bar holding g, then f#
  const H_WALK = [['g1', 'd2', 'b1'], ['g1', 'b1', 'd2'], ['g1', 'd2', 'e2']]
  H_WALK.forEach((notes, bar) => gallop(hinge, bar, notes))
  hinge.put(L.TRI, hinge.at(3, 0), { note: n('g1'), inst: TRI_HOLD, vol: 15 })
  hinge.put(L.TRI, hinge.at(3, 6), { note: n('g1'), inst: TRI_HOLD, vol: 15 })
  gallop(hinge, 4, ['f#1', 'c#2', 'a#1'])
  gallop(hinge, 5, ['f#1', 'a#1', 'c#2'])
  for (const bar of [6, 7]) gallop(hinge, bar, ['f#1', 'f#2', 'f#1'])
  // P1  the driving line over the flat sixth, then THE SHARP FOURTH held across the
  // augmented sixth (23:36, e#5) and resolving UP to f#5 at 24:0 — the upper half of the
  // outward resolution, written in the lane the ear is following.
  phrase(hinge, L.P1, LEAD, 0, [
    [2, 'g5', 13], [2, 'b5', 14], [2, 'd5', 13], [6, 'g5', 14],
    [2, 'a5', 14], [2, 'g5', 13], [2, 'f#5', 13], [4, 'd5', 13], [2, '-'],
    [2, 'b4', 13], [2, 'd5', 13], [2, 'g5', 14], [6, 'e5', 13],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(hinge, L.P1, LEAD, hinge.at(3), [[12, 'e#5', 14]], { cutAtEnd: false }) // the sharp fourth
  phrase(hinge, L.P1, LEAD, hinge.at(4), [
    [6, 'f#5', 15], [2, 'a#5', 14], [2, 'c#6', 15], [2, 'a#5', 14],  // resolved, and launching
    [2, 'f#5', 14], [2, 'c#5', 13], [2, 'a#4', 13], [6, 'f#5', 14],
    [12, 'f#5', 14],
    [6, 'f#5', 14], [2, '-'], [4, 'f#5', 13],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // P2  the tonic b, the augmented sixth's middle voice: struck at 23:36 and held through
  // the resolution, where it becomes the fourth of F# and then the sixth of D.
  answers(hinge, L.P2, COUNTER, [
    [0, 6, 'd4', 10, 6], [1, 6, 'g4', 10, 6], [2, 6, 'b4', 10, 6],
    [3, 0, 'b4', 12, 12],
    [4, 0, 'a#4', 11, 6], [4, 6, 'c#5', 11, 6], [5, 0, 'a#4', 11, 6], [5, 6, 'f#4', 11, 6],
    [6, 0, 'f#4', 11, 12], [7, 0, 'f#4', 11, 6],
  ])
  // SAW  eighths on the flat sixth, OUT for the augmented sixth itself — three voices and a
  // bass, nothing else, so the chord is heard as the chord — and back on the resolution.
  for (const bar of [0, 1, 2]) sawTenor(hinge, bar, CH.VI, 'd3', 10)
  hinge.put(L.SAW, hinge.at(3, 0), { note: CUT })
  for (const bar of [4, 5]) sawTenor(hinge, bar, CH.V, 'd3', 11)
  for (const bar of [6, 7]) {
    for (const r of [0, 4, 8]) hinge.put(L.SAW, hinge.at(bar, r), { note: n(r === 4 ? 'c#3' : 'f#3'), inst: SAW_RUN, vol: 11 })
  }
  // V1  doubles the flat sixth's tonic an octave under pulse 2, and the resolution's f#
  for (const bar of [0, 1, 2]) bed(hinge, bar, CH.VI, 'd4', 9, [0, 1, 2], [0])
  // …and spells the whole augmented sixth on one lane as an `0xy` arpeggio: rooted on g3
  // with offsets 4 and 10 — `04a`, decimal 74 — which is g · b · e#, because an augmented
  // sixth is enharmonically a dominant seventh and the 3-tick rotation at speed 3 fuses the
  // three into one chord. Cancelled with `000` on the resolution, where the mode would
  // otherwise voice every later note on the lane (§12.5).
  hinge.put(L.V1, hinge.at(3, 0), { note: n('g3'), inst: HARM, vol: 10, fx: [['0', nib(4, 10)]] })
  hinge.put(L.V1, hinge.at(3, 6), { note: n('g3'), inst: HARM, vol: 10, fx: [['0', nib(4, 10)]] })
  for (const bar of [4, 5, 6, 7]) hold(hinge, L.V1, bar, CH.V, bar < 6 ? 2 : 0, 'c#4', 9)
  hinge.put(L.V1, hinge.at(4, 0), { fx: [['0', 0]] })
  // V2  the sharp fourth doubled an octave down (e#4), resolving up to f#4 with pulse 1
  for (const bar of [0, 1, 2]) push(hinge, bar, CH.VI, 'f#3', 9)
  hinge.put(L.V2, hinge.at(3, 0), { note: n('e#4'), inst: HARM, vol: 11 })
  hinge.put(L.V2, hinge.at(3, 6), { note: n('e#4'), inst: HARM, vol: 11 })
  for (const bar of [4, 5]) push(hinge, bar, CH.V, 'f#3', 10)
  for (const bar of [6, 7]) {
    hinge.put(L.V2, hinge.at(bar, 0), { note: n('f#4'), inst: HARM, vol: 10 })
    hinge.put(L.V2, hinge.at(bar, 6), { note: n('c#4'), inst: HARM, vol: 10 })
  }
  // NOISE  kit E: the kick on the beat and the last sixteenth of beat 1, the snare on beat
  // 2, sixteenth hats on the off-beats — and it DOES NOT STOP for the augmented sixth. A
  // crash on the resolution at 24:0 is the only new colour.
  for (const bar of range(0, 8)) {
    hinge.hits(L.NOISE, KICK, 12, [[bar, 0]])
    hinge.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    if (bar !== 4) hinge.hits(L.NOISE, KICK, 10, [[bar, 5]])
    hats(hinge, bar, [3, 9, 11], { on: 7, off: 6 })
  }
  hinge.put(L.NOISE, hinge.at(4, 0), { note: 46, inst: CRASH, vol: 11 })
  clearKit(hinge, 3, 8)
  fill(hinge, 3, 'into-the-sixth', [[8, SNARE, 8, 39], [9, SNARE, 10, 39], [10, SNARE, 12, 41], [11, SNARE, 14, 41]])
  clearKit(hinge, 7, 6)
  fill(hinge, 7, 'unison-push', [[6, KICK, 12, 36], [8, SNARE, 12, 41], [10, KICK, 12, 36], [11, RISER, 13, 41]])
  // DPCM  one hit, on the resolution: the weight arrives exactly where the chord opens out.
  hinge.hits(L.DPCM, KIT.inst, 13, [[4, 0], [6, 0]], KIT.kick)
  hinge.hits(L.DPCM, KIT.inst, 11, [[7, 6]], KIT.snare)
}

// =====================================================================================
// updraft — frames 25–28 (16 bars). THE SECOND LEAD COLOUR, and the section where it takes
// over: at 25:0 the tune leaves pulse 1 for the VRC6 SAWTOOTH, an octave below where the
// pulse sang it, on an instrument with a stepped bend-in instead of a duty front. Pulse 1
// is still there, on its THIN colour, as a descant above the tune — so the ear hears the
// same melody sung by a different voice in a different register with a different attack,
// which is §5.2's requirement met three ways at once. The key is the relative major: D
// major is B natural minor's own seven notes, so the lift costs nothing in accidentals and
// everything in colour (§9.3's free third device).
// =====================================================================================
const UPDRAFT_HARMONY = [
  CH.D, CH.A, CH.G, CH.D, CH.Em, CH.D, CH.A7, CH.D,
  CH.G, CH.D, CH.Em, CH.A, CH.D, CH.Bm, CH.G, CH.A,
]
/** The saw's own eight bars, still the tune's material — each bar climbs three eighths to a
 *  landing — but now in D, and reaching up to b4 where H reached b5. */
const SAW_CLOSE = [
  [2, 'b3', 11], [2, 'd4', 11], [2, 'g4', 11], [6, 'b4', 12],
  [2, 'a4', 11], [2, 'f#4', 11], [2, 'd4', 10], [4, 'f#4', 11], [2, '-'],
  [2, 'e4', 11], [2, 'g4', 11], [2, 'b4', 11], [6, 'a4', 12],
  [2, 'g4', 11], [2, 'e4', 10], [2, 'c#4', 10], [4, 'e4', 11], [2, '-'],
  [2, 'd4', 11], [2, 'f#4', 11], [2, 'a4', 11], [6, 'b4', 12],
  [2, 'a4', 11], [2, 'f#4', 11], [2, 'd4', 10], [4, 'f#4', 11], [2, '-'],
  [2, 'g4', 11], [2, 'a4', 11], [2, 'b4', 11], [6, 'a4', 12],
  [2, 'g4', 11], [2, 'f#4', 11], [2, 'e4', 10], [4, 'c#4', 11], [2, '-'],
]
const updraft = s.section('updraft', 16)
{
  // SAW  THE TUNE: H and H2 an octave below pulse 1's register, then its own eight bars.
  phrase(updraft, L.SAW, SAW_LEAD, 0, shift(H, -12), { volShift: -2, cutAtEnd: false })
  phrase(updraft, L.SAW, SAW_LEAD, updraft.at(4), shift(H2, -12), { volShift: -2, cutAtEnd: false })
  phrase(updraft, L.SAW, SAW_LEAD, updraft.at(8), SAW_CLOSE)
  // P1  the descant, on LEAD_THIN — one note a bar over the tune, so the pulse is an
  // atmosphere and the saw is the singer. Two of its notes are WRITTEN 4–3 SUSPENSIONS,
  // struck on the downbeat as the fourth of the chord and resolved down by step to the
  // third two rows later: a5 -> g5 over Em at 26:0 and g5 -> f#5 over D at 28:0.
  answers(updraft, L.P1, LEAD_THIN, [
    [0, 0, 'f#5', 11, 10], [1, 6, 'e5', 11, 6], [2, 0, 'd5', 11, 10], [3, 6, 'f#5', 11, 6],
    [4, 0, 'a5', 11, 2], [4, 2, 'g5', 11, 8], [5, 6, 'd5', 11, 6], [6, 0, 'e5', 11, 10],
    [7, 6, 'f#5', 11, 6],
    [8, 0, 'g5', 12, 10], [9, 6, 'f#5', 12, 6], [10, 0, 'b5', 12, 10], [11, 6, 'a5', 12, 6],
    [12, 0, 'g5', 12, 2], [12, 2, 'f#5', 12, 8], [13, 6, 'd5', 12, 6],
    [14, 0, 'g5', 12, 10], [15, 6, 'a5', 12, 6],
  ])
  // P2  silent for eight bars. Nothing the arrangement needs is missing, and the lane has
  // somewhere to come back from.
  updraft.put(L.P2, 0, { note: CUT })
  answers(updraft, L.P2, COUNTER, [
    [8, 3, 'd4', 10, 6], [8, 9, 'b3', 10, 6], [9, 3, 'a3', 10, 6], [9, 9, 'f#4', 10, 6],
    [10, 3, 'g4', 10, 6], [10, 9, 'e4', 10, 6], [11, 3, 'c#4', 10, 6], [11, 9, 'e4', 10, 6],
    [12, 3, 'f#4', 10, 6], [12, 9, 'd4', 10, 6], [13, 3, 'd4', 10, 6], [13, 9, 'b3', 10, 6],
    [14, 3, 'b3', 10, 6], [14, 9, 'd4', 10, 6], [15, 3, 'c#4', 10, 6], [15, 9, 'e4', 10, 6],
  ])
  // TRI  the gallop in D, and it is the bass again: the saw has the tune, so the triangle
  // covers all six eighths itself in the bars where the saw is holding a landing.
  const D_WALK = [
    ['d2', 'a1', 'f#2'], ['a1', 'e2', 'c#2'], ['g1', 'd2', 'b1'], ['d2', 'f#2', 'a1'],
    ['e1', 'b1', 'g2'], ['d2', 'a1', 'f#2'], ['a1', 'e2', 'g2'], ['d2', 'f#2', 'a1'],
    ['g1', 'd2', 'b1'], ['d2', 'a1', 'f#2'], ['e1', 'b1', 'g2'], ['a1', 'e2', 'c#2'],
    ['d2', 'a1', 'f#2'], ['b1', 'f#2', 'd2'], ['g1', 'd2', 'b1'], ['a1', 'e2', 'g2'],
  ]
  D_WALK.forEach((notes, bar) => gallop(updraft, bar, notes))
  // V1  the bed in its FIRST form again — three sixteenths on beat 1 — which is the arc the
  // lane has travelled: established, taken away for eleven frames, returned displaced in
  // three, and only now the thing it was at the start.
  for (const bar of range(0, 16)) bed(updraft, bar, UPDRAFT_HARMONY[bar], 'd4', 8, [0, 1, 2], bar % 4 === 3 ? [0, 6] : [0])
  // V2  sustained thirds on the beats, the major third of D where B minor had a minor one
  for (const bar of range(0, 16)) hold(updraft, L.V2, bar, UPDRAFT_HARMONY[bar], bar % 2 === 0 ? 1 : 2, 'f#3', 9)
  // NOISE  kit F, the brightest in the piece: the open hat on the last eighth of every bar,
  // the kick on beat 1 and the second eighth of beat 2, the snare on beat 2 with a ghost
  // ahead of it — four parameters away from kit E.
  for (const bar of range(0, 16)) {
    updraft.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 8]])
    updraft.hits(L.NOISE, SNARE, 12, [[bar, 6]], 39)
    updraft.hits(L.NOISE, SNARE, 4, [[bar, 5]], 39)
    updraft.hits(L.NOISE, OHAT, 7, [[bar, 10]])
    hats(updraft, bar, [2, 4], { on: 7, off: 6 })
  }
  clearKit(updraft, 7, 6)
  fill(updraft, 7, 'open-and-tom', [[6, OHAT, 10, 46], [8, TOM, 12, 43], [9, TOM, 11, 41], [10, TOM, 13, 39], [11, TOM, 13, 37]])
  clearKit(updraft, 15, 6)
  fill(updraft, 15, 'roll-into-sixths', rollCells(6, [43, 41, 40], [10, 11, 12, 13]).concat([[10, SNARE, 13, 41], [11, CRASH, 9, 46]]))
  updraft.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// updraft2 — frames 29–30 (8 bars). The two pulses answer the sawtooth IN SIXTHS, which is
// the only parallel writing in the piece: four bars of it (29:0–29:47), earned by sixteen
// bars in which pulse 2 was either an independent line or silent, and never repeated.
// Bars 4–7 turn the harmony home — D · Bm · F# · F# — so `hush` opens back in B minor.
// =====================================================================================
const updraft2 = s.section('updraft2', 8)
{
  const U2 = [CH.D, CH.G, CH.A, CH.D, CH.III, CH.i, CH.V, CH.V]
  // P1 / P2  the sixths: pulse 1 on top, pulse 2 a sixth under it, identical rhythm, four
  // bars only. It reads as a lift because nothing else in the piece does it.
  const SIXTHS = [
    [[2, 'd5'], [2, 'f#5'], [2, 'a5'], [6, 'f#5']],
    [[2, 'g5'], [2, 'b5'], [2, 'd5'], [6, 'b4']],
    [[2, 'c#5'], [2, 'e5'], [2, 'a5'], [6, 'g5']],
    [[2, 'f#5'], [2, 'a5'], [2, 'd5'], [6, 'a5']],
  ]
  SIXTHS.forEach((barEvents, bar) => {
    phrase(updraft2, L.P1, LEAD, updraft2.at(bar), barEvents.map(([len, note]) => [len, note, 13]), { cutAtEnd: false })
    phrase(updraft2, L.P2, COUNTER, updraft2.at(bar), barEvents.map(([len, note]) => [len, rung(idx(note) - 5), 10]), { vib: nib(4, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  })
  // and the turn home: pulse 1 alone, falling to the dominant
  phrase(updraft2, L.P1, LEAD, updraft2.at(4), [
    [2, 'f#5', 13], [2, 'e5', 13], [2, 'd5', 13], [6, 'f#5', 14],
    [2, 'g5', 13], [2, 'f#5', 13], [2, 'e5', 12], [4, 'd5', 13], [2, '-'],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'a#5', 14], [6, 'f#5', 14],
    [2, 'e5', 13], [2, 'c#5', 13], [2, 'a#4', 13], [4, 'c#5', 13], [2, '-'],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3 })
  answers(updraft2, L.P2, COUNTER, [
    [4, 3, 'a4', 10, 6], [4, 9, 'f#4', 10, 6], [5, 3, 'b4', 10, 6], [5, 9, 'g4', 10, 6],
    [6, 3, 'c#5', 10, 6], [6, 9, 'a#4', 10, 6], [7, 3, 'c#5', 10, 6], [7, 9, 'e4', 10, 6],
  ])
  // TRI  the gallop, turning from D back to B minor over four bars
  const U2_WALK = [
    ['d2', 'a1', 'f#2'], ['g1', 'd2', 'b1'], ['a1', 'e2', 'c#2'], ['d2', 'f#2', 'a1'],
    ['d2', 'a1', 'f#2'], ['b1', 'f#2', 'd2'], ['f#1', 'c#2', 'a#1'], ['f#1', 'a#1', 'c#2'],
  ]
  U2_WALK.forEach((notes, bar) => gallop(updraft2, bar, notes))
  // SAW  the phrase the pulses are answering, two bars of it, then the tenor eighths
  phrase(updraft2, L.SAW, SAW_LEAD, updraft2.at(0, 6), [
    [2, 'd4', 11], [2, 'f#4', 11], [2, 'a4', 11], [6, 'b4', 12], [6, 'a4', 11],
  ], { cutAtEnd: false })
  for (const bar of [2, 3, 4, 5, 6, 7]) sawTenor(updraft2, bar, U2[bar], 'd3', 10)
  // V1 / V2  the pad, thinning across the turn so the sixths are the loudest thing
  for (const bar of range(0, 8)) {
    bed(updraft2, bar, U2[bar], 'd4', 8, [0, 1, 2], [0])
    hold(updraft2, L.V2, bar, U2[bar], bar % 2 === 0 ? 2 : 1, 'f#3', 9)
  }
  // NOISE  kit G: the sixths get the busiest hats in the piece (every eighth for four bars,
  // the one place that density is affordable because the melody is in long values), then
  // eighth hats drop to the beats for the turn.
  for (const bar of range(0, 4)) {
    updraft2.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 6]])
    updraft2.hits(L.NOISE, SNARE, 11, [[bar, 3], [bar, 9]], 41)
    hats(updraft2, bar, [2, 4, 8, 10], { on: 7, off: 6 })
  }
  for (const bar of range(4, 8)) {
    updraft2.hits(L.NOISE, KICK, 12, [[bar, 0]])
    updraft2.hits(L.NOISE, SNARE, 12, [[bar, 6]], 39)
    hats(updraft2, bar, [4, 10], { on: 7, off: 6 })
  }
  clearKit(updraft2, 3, 6)
  fill(updraft2, 3, 'sixths-turnaround', [[6, SNARE, 9, 39], [7, SNARE, 6, 39], [8, SNARE, 12, 41], [10, TOM, 13, 43], [11, TOM, 13, 37]])
  clearKit(updraft2, 7, 4)
  fill(updraft2, 7, 'into-the-hush', [[4, HAT, 6, 45], [6, SNARE, 8, 39], [8, RIM, 10, 44], [10, RIM, 7, 44]])
  updraft2.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// hush — frames 31–32 (8 bars). Two lanes and nothing else: pulse 1 on its thin colour and
// the triangle. No kit at all, no VRC6, no sawtooth — the only place in 51 frames where
// five lanes rest at once, and the reason the sprint that follows sounds like an attack.
// The tune is H's own head, an octave below where it has always been sung and slowed to
// quarters and dotted quarters; the harmony is i · i · iv · iv · VI · V · i · V.
// =====================================================================================
const hush = s.section('hush', 8)
{
  // P1  H's head in the low register on LEAD_THIN, at volume 8–10: the piece's floor
  phrase(hush, L.P1, LEAD_THIN, 0, [
    [4, 'b3', 9], [4, 'd4', 9], [4, 'f#4', 10],
    [6, 'a4', 10], [6, 'f#4', 9],
    [4, 'g4', 9], [4, 'e4', 9], [4, 'b3', 9],
    [6, 'e4', 10], [6, 'g4', 9],
    [4, 'b4', 10], [4, 'g4', 10], [4, 'd4', 9],
    [6, 'c#4', 10], [6, 'a#3', 9],
    [4, 'b3', 10], [4, 'd4', 10], [4, 'f#4', 10],
    [6, 'c#4', 10], [4, 'a#3', 10, ['R', 0x14]], [2, '-'],
  ], { vib: nib(3, 2), vibMin: 6, vibAfter: 3 })
  // TRI  two notes a bar, held: the bass alone under a whisper, and the only other voice
  const HUSH_BASS = [
    ['b1', 'f#2'], ['b1', 'd2'], ['e1', 'b1'], ['e1', 'g1'],
    ['g1', 'd2'], ['f#1', 'c#2'], ['b1', 'f#2'], ['f#1', 'a#1'],
  ]
  HUSH_BASS.forEach((notes, bar) => {
    notes.forEach((note, i) => hush.put(L.TRI, hush.at(bar, i * 6), { note: n(note), inst: TRI_HOLD, vol: 15 }))
  })
  // every other lane rests, stated as a cut so the silence is written and not merely empty
  for (const lane of [L.P2, L.NOISE, L.DPCM, L.V1, L.V2, L.SAW]) hush.put(lane, 0, { note: CUT })
}

// =====================================================================================
// sprint — frames 33–37 (20 bars). The sequence that goes somewhere: falling fifths, eight
// links, a complete circle — Bm · Em · A · D · G · C#dim · F# · Bm — one chord a bar, so it
// arrives on the tonic in 4.8 s. It is stated twice, the second time stalling on the
// dominant instead of arriving, and the four bars after that are the approach to the brake.
//
// THE 5-ROW CELL lives here: VRC6 pulse 2 attacks every five rows, unbroken from 33:0 to
// 37:43 — 48 attacks, 250 ms apart against a 300 ms beat. Its entry rows are (-48k) mod 5
// = 0, 2, 4, 1, 3 and the cycle closes in exactly five frames, which is why the section is
// five frames long and not four. The cell's instrument alternates per frame, so the phase
// cycle is a timbre cycle too, and its pitches are the current bar's chord tones — the
// device carries the harmony instead of sitting beside it.
// =====================================================================================
const sprint = s.section('sprint', 20)
{
  const FIFTHS = [
    CH.i, CH.iv, CH.VII, CH.III, CH.VI, CH.ii, CH.V, CH.i,
    CH.i, CH.iv, CH.VII, CH.III, CH.VI, CH.VI, CH.V, CH.V,
    CH.iv, CH.III, CH.ii, CH.V,
  ]
  // V2  THE CELL. One attack every five rows for 240 rows; the last lands at 37:43, five
  // rows clear of the section end and eighteen frames clear of the loop seam (§9.8).
  const CELL = 5
  for (let row = 0; row < sprint.len; row += CELL) {
    const step = row / CELL
    const bar = Math.floor(row / 12)
    const inst = [STAB, TICK][Math.floor(row / 48) % 2]
    sprint.put(L.V2, row, {
      note: tone(FIFTHS[bar], step % 3, 'f#3'),
      inst,
      vol: [11, 9, 9][step % 3],
    })
  }
  // P1  the sequence's own line: each link climbs a fourth and falls back a third, so the
  // tune descends with the circle while every bar rises inside itself.
  phrase(sprint, L.P1, LEAD, 0, [
    [2, 'f#5', 13], [2, 'a5', 14], [2, 'b5', 14], [6, 'f#5', 13],
    [2, 'e5', 13], [2, 'g5', 13], [2, 'a5', 13], [6, 'e5', 13],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'a5', 14], [6, 'c#5', 13],
    [2, 'd5', 13], [2, 'f#5', 13], [2, 'a5', 13], [6, 'd5', 13],
    [2, 'b4', 13], [2, 'd5', 13], [2, 'g5', 13], [6, 'b4', 13],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'g5', 13], [6, 'c#5', 13],
    [2, 'a#4', 13], [2, 'c#5', 13], [2, 'f#5', 14], [6, 'a#5', 14],
    [2, 'b5', 15], [2, 'f#5', 14], [2, 'd5', 13], [4, 'b4', 14], [2, '-'],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(sprint, L.P1, LEAD, sprint.at(8), [
    [2, 'b4', 13], [2, 'd5', 13], [2, 'f#5', 13], [4, 'b4', 13], [2, '-'],
    [2, 'b4', 13], [2, 'e5', 13], [2, 'g5', 13], [4, 'b4', 13], [2, '-'],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'a5', 13], [4, 'c#5', 13], [2, '-'],
    [2, 'd5', 13], [2, 'f#5', 13], [2, 'a5', 13], [4, 'd5', 13], [2, '-'],
    [2, 'b4', 13], [2, 'd5', 14], [2, 'g5', 14], [6, 'd5', 13],
    [2, 'g5', 14], [2, 'b5', 15], [2, 'g5', 14], [6, 'd5', 13],
    [2, 'c#5', 13], [2, 'f#5', 14], [2, 'a#5', 14], [6, 'c#6', 15],
    [2, 'a#5', 14], [2, 'f#5', 13], [2, 'c#5', 13], [4, 'a#4', 13], [2, '-'],
  ], { vib: nib(5, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(sprint, L.P1, LEAD, sprint.at(16), [
    [2, 'b4', 13], [2, 'e5', 13], [2, 'g5', 13], [6, 'b4', 13],
    [2, 'a4', 13], [2, 'd5', 13], [2, 'f#5', 13], [6, 'a4', 13],
    [2, 'g4', 13], [2, 'c#5', 13], [2, 'e5', 13], [6, 'g4', 13],
    [2, 'f#4', 13], [2, 'c#5', 14], [2, 'a#4', 13], [6, 'f#5', 14],
  ])
  // P2  the sequence's counter-line, moving where the lead holds — the fifth of each link
  // struck on the last sixteenth and resolved down by step onto the next link's third.
  for (const bar of range(0, 16)) {
    answers(sprint, L.P2, COUNTER, [
      [bar, 4, tone(FIFTHS[bar], 2, 'a3'), 10, 4], [bar, 10, tone(FIFTHS[bar], 1, 'a3'), 10, 4],
    ])
  }
  for (const bar of range(16, 20)) {
    answers(sprint, L.P2, COUNTER, [[bar, 4, tone(FIFTHS[bar], 1, 'a3'), 11, 8]])
  }
  // TRI  the circle in the bass: root and fifth on the two beats plus the eighth that steps
  // down a fourth into the next link, which is what makes eight chords one gesture.
  for (const bar of range(0, 20)) {
    const ch = FIFTHS[bar]
    const next = FIFTHS[bar + 1] ?? CH.i
    gallop(sprint, bar, [root(ch, 'b1'), tone(ch, 2, 'b1'), root(next, 'b1')])
  }
  // SAW  the tenor eighths, filling the triangle's gaps as in A — the split bass is the
  // piece's normal texture and the sprint is where it is loudest.
  for (const bar of range(0, 20)) sawTenor(sprint, bar, FIFTHS[bar], 'd3', 11)
  // V1  the bed on beat 1, the harmony spelled once a bar under a sequence that moves fast
  // enough that the ear needs the help
  for (const bar of range(0, 20)) bed(sprint, bar, FIFTHS[bar], 'd4', 8, [0, 1, 2], [0])
  // NOISE  kit H, the densest: the kick on beat 1 and the last sixteenth of beat 2, the
  // snare on beat 2, hats on the remaining off-eighths, a ghost before every barline.
  for (const bar of range(0, 20)) {
    sprint.hits(L.NOISE, KICK, 12, [[bar, 0]])
    sprint.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    sprint.hits(L.NOISE, KICK, 11, [[bar, 9]])
    sprint.hits(L.NOISE, SNARE, 5, [[bar, 11]], 39)
    hats(sprint, bar, [2, 4], { on: 8, off: 6 })
  }
  clearKit(sprint, 7, 6)
  fill(sprint, 7, 'arrival-roll', rollCells(6, [40, 42, 43], [11, 12, 13, 14, 12, 15]).concat([]))
  clearKit(sprint, 15, 6)
  fill(sprint, 15, 'stall-on-the-dominant', [[6, TOM, 13, 43], [7, TOM, 8, 43], [8, TOM, 13, 39], [10, SNARE, 14, 41], [11, SNARE, 7, 39]])
  clearKit(sprint, 19, 4)
  fill(sprint, 19, 'into-the-brake', [[4, SNARE, 12, 41], [5, SNARE, 6, 39], [6, KICK, 13, 36], [8, FALLER, 13, 43], [11, CRASH, 10, 46]])
  // DPCM  the arrivals: the kick where the circle lands on the tonic, the snare on the two
  // links that stall. Sparse, and placed where the bass is being restruck anyway.
  sprint.hits(L.DPCM, KIT.inst, 13, [[0, 0], [7, 0], [8, 0], [12, 0]], KIT.kick)
  sprint.hits(L.DPCM, KIT.inst, 11, [[14, 6], [15, 6], [19, 6]], KIT.snare)
}

// =====================================================================================
// stall — frames 38–39 (8 bars). The brake, and THE METRIC SURPRISE. Half-time: one bass
// attack a bar, a kick on the barline and nothing on the off-eighths, so a piece that has
// been moving in 100 ms eighths for ninety seconds suddenly has 600 ms to think in.
// `D00` at 39:41 ends the frame after row 41, which makes frame 39 forty-two rows long and
// its last bar SIX ROWS — one beat instead of two. The music jumps half a bar forward into
// the return of the main theme, and the theme lands early. One per piece (§9.4), placed at
// the seam where it does something, and never at the loop seam.
// Everything this section latches is cancelled before row 41, because rows 42–47 of frame
// 39 are never played and a cancel written there would never happen. The assertion at the
// bottom of this file proves it on the built document rather than trusting the comment.
// =====================================================================================
const stall = s.section('stall', 8)
{
  const S_HARMONY = [CH.i, CH.i, CH.VI, CH.VI, CH.iv, CH.iv, CH.V, CH.V]
  // P1  two notes a bar, falling: the lead marking time. No vibrato and no fade in the last
  // two bars, so nothing needs cancelling in the rows the `D00` skips.
  phrase(stall, L.P1, LEAD, 0, [
    [6, 'f#5', 13], [6, 'd5', 12], [6, 'b4', 12], [6, 'd5', 12],
    [6, 'g5', 13], [6, 'e5', 12], [6, 'b4', 12], [6, 'g4', 12],
    [6, 'e5', 12], [6, 'b4', 12], [6, 'g4', 12], [6, 'e4', 12],
  ], { vib: nib(4, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(stall, L.P1, LEAD, stall.at(6), [
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'f#5', 14], [6, 'a#5', 14],
    [2, 'f#5', 14], [2, 'c#5', 13], [2, 'a#4', 13],
  ], { cutAtEnd: false })
  // P2  one sustained note a bar under it, and out before the jump
  for (const bar of range(0, 6)) {
    answers(stall, L.P2, COUNTER, [[bar, 0, tone(S_HARMONY[bar], 1, 'b3'), 10, 10]])
  }
  answers(stall, L.P2, COUNTER, [[6, 0, 'c#4', 11, 10], [7, 0, 'a#3', 11, 5]])
  // TRI  half-time: one attack a bar, held for the whole bar
  const S_BASS = ['b1', 'b1', 'g1', 'g1', 'e1', 'e1', 'f#1', 'f#1']
  S_BASS.forEach((note, bar) => stall.put(L.TRI, stall.at(bar, 0), { note: n(note), inst: TRI_HOLD, vol: 15 }))
  // SAW  sustained under it, two notes a bar, at 8 — the brake's low end
  for (const bar of range(0, 7)) {
    stall.put(L.SAW, stall.at(bar, 0), { note: tone(S_HARMONY[bar], 2, 'd3'), inst: SAW_HOLD, vol: 8 })
    stall.put(L.SAW, stall.at(bar, 6), { note: tone(S_HARMONY[bar], 1, 'd3'), inst: SAW_HOLD, vol: 8 })
  }
  // the brake itself: from bar 4 the saw GLIDES between its notes instead of striking them
  // — `3xx` portamento, the machine slowing down — cancelled with `100` at bar 7, because
  // `300` only freezes a portamento and leaves the next note a glide target with no attack.
  for (const bar of [4, 5, 6]) {
    for (const r of [0, 6]) stall.put(L.SAW, stall.at(bar, r), { fx: [['3', 0x14]] })
  }
  stall.put(L.SAW, stall.at(7, 0), { note: n('f#3'), inst: SAW_RUN, vol: 11, fx: [['1', 0]] })
  stall.put(L.SAW, stall.at(7, 2), { note: n('a#3'), inst: SAW_RUN, vol: 11 })
  stall.put(L.SAW, stall.at(7, 4), { note: n('c#4'), inst: SAW_RUN, vol: 11 })
  // V1  the bed drops to one chord a bar on the downbeat, and carries the `D00`
  for (const bar of range(0, 7)) bed(stall, bar, S_HARMONY[bar], 'd4', 8, [0, 1, 2], [0])
  // V2  one held tone a bar
  for (const bar of range(0, 7)) {
    stall.put(L.V2, stall.at(bar, 0), { note: tone(S_HARMONY[bar], 1, 'f#3'), inst: HARM, vol: 9 })
  }
  // NOISE  half-time: a kick on the barline, a snare on beat 2 of every second bar, no hats
  // at all for four bars — and then the fill that sets up the dropped beat.
  for (const bar of range(0, 7)) {
    stall.hits(L.NOISE, KICK, 12, [[bar, 0]])
    if (bar % 2 === 1) stall.hits(L.NOISE, SNARE, 12, [[bar, 6]], 39)
    if (bar >= 4) hats(stall, bar, [4, 10], { on: 7, off: 6 })
  }
  clearKit(stall, 6, 6)
  fill(stall, 6, 'brake-roll', rollCells(6, [43, 41, 40], [9, 10, 11, 12, 13, 14]))
  fill(stall, 7, 'dropped-beat', [[0, KICK, 13, 36], [2, SNARE, 12, 41], [4, SNARE, 14, 41]])
  // THE DROPPED BEAT. `D00` on row 41 of frame 39 — the section's row 89, bar 7 row 5 —
  // ends the frame there. Rows 42–47 of that frame do not exist in playback.
  stall.put(L.V1, stall.at(7, 5), { fx: [['D', 0]] })
  stall.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// return — frames 40–43 (16 bars). A″. H and H2 at pitch, and the closing six bars of A
// RE-HARMONISED note for note: the same melody over Em · C#dim · D · Bm · Em · A where A
// had Bm · A · G · D · Em · C#dim, which is §2.10's fourth kind of variation — the tune
// unchanged and its meaning moved. The arrangement is at its fullest here: the six-note bed
// is back, the DPCM kick doubles the noise kick, and every lane is playing.
// =====================================================================================
const RETURN_HARMONY = [
  CH.i, CH.VII, CH.VI, CH.v, CH.i, CH.iv, CH.ii, CH.V,
  CH.iv, CH.ii, CH.III, CH.i, CH.iv, CH.VII, CH.V, CH.V,
]
const ret = s.section('return', 16)
{
  const VIB = nib(5, 2)
  phrase(ret, L.P1, LEAD, 0, H, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(ret, L.P1, LEAD, ret.at(4), H2, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(ret, L.P1, LEAD, ret.at(8), FLIGHT_CLOSE, { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // the cadence that replaces A's hemiola: the melody RISES a step into the last bar while
  // the bass falls a fifth — the second contrary-motion cadence (§2.10)
  phrase(ret, L.P1, LEAD, ret.at(14), [
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'f#5', 14], [6, 'e5', 13],
    [2, 'f#5', 14], [2, 'a#5', 14], [2, 'c#6', 15], [4, 'b5', 15], [2, '-'],
  ])
  // P2  back to answering in the holes, but a third higher than in A and with its own
  // rhythm in the re-harmonised bars, where it takes the chord tone the new harmony needs
  answers(ret, L.P2, COUNTER, [
    [0, 8, 'e4', 11], [0, 10, 'f#4', 11], [1, 10, 'g4', 11, 4],
    [2, 8, 'd4', 11], [2, 10, 'e4', 11], [3, 10, 'f#4', 11, 4],
    [4, 8, 'd4', 11], [4, 10, 'f#4', 11], [5, 10, 'g4', 11, 4],
    [6, 8, 'e4', 11], [6, 10, 'g4', 11], [7, 10, 'a#4', 11, 4],
    [8, 3, 'b3', 11, 6], [8, 9, 'g4', 11, 6], [9, 3, 'e4', 11, 6], [9, 9, 'g4', 11, 6],
    [10, 3, 'f#4', 11, 6], [10, 9, 'a4', 11, 6], [11, 3, 'd4', 11, 6], [11, 9, 'f#4', 11, 6],
    [12, 3, 'g4', 11, 6], [12, 9, 'b4', 11, 6], [13, 3, 'c#5', 11, 6], [13, 9, 'a4', 11, 6],
    [14, 8, 'a#4', 11], [14, 10, 'c#5', 11], [15, 8, 'f#4', 12], [15, 10, 'a#4', 12, 2],
  ])
  // TRI  the split bass, the falling walk answering the new harmony
  const R_WALK = [
    ['b1', 'f#2', 'a1'], ['a1', 'e2', 'g2'], ['g1', 'd2', 'b1'], ['f#1', 'c#2', 'e2'],
    ['b1', 'f#2', 'd2'], ['e1', 'b1', 'g2'], ['c#2', 'g1', 'e2'], ['f#1', 'c#2', 'a#1'],
    ['e1', 'b1', 'd2'], ['c#2', 'e2', 'g1'], ['d2', 'a1', 'f#2'], ['b1', 'f#2', 'd2'],
    ['e1', 'b1', 'g2'], ['a1', 'e2', 'c#2'], ['f#1', 'c#2', 'a#1'], ['f#1', 'a#1', 'c#2'],
  ]
  R_WALK.forEach((notes, bar) => gallop(ret, bar, notes))
  for (const bar of range(0, 16)) sawTenor(ret, bar, RETURN_HARMONY[bar], 'd3', 11)
  // V1  the bed at its fullest — six notes in the even bars, three in the odd ones, which
  // keeps the densest section of the piece inside §9.8's attacks-per-bar ceiling and gives
  // the lane a two-bar arc it did not have in A.
  for (const bar of range(0, 16)) bed(ret, bar, RETURN_HARMONY[bar], 'd4', 8, [0, 1, 2], bar % 2 === 0 ? [0, 6] : [0])
  for (const bar of range(0, 16)) push(ret, bar, RETURN_HARMONY[bar], 'f#3', 9)
  // NOISE  kit I: A's kit with the ghost moved to the second sixteenth of beat 2 and the
  // hat pattern inverted (on the beats instead of between them), under a DPCM kick.
  for (const bar of range(0, 16)) {
    ret.hits(L.NOISE, KICK, 12, [[bar, 0]])
    ret.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    ret.hits(L.NOISE, SNARE, 4, [[bar, 7]], 39)
    if (bar % 2 === 1) ret.hits(L.NOISE, KICK, 11, [[bar, 10]])
    hats(ret, bar, [2, 4, 8], { on: 8, off: 6 })
  }
  clearKit(ret, 7, 6)
  fill(ret, 7, 'return-toms', tomCells(6, [37, 39, 41], [12, 13, 13], TOM).concat([[11, SNARE, 14, 41]]))
  clearKit(ret, 15, 6)
  fill(ret, 15, 'return-crescendo', [[6, SNARE, 6, 39], [7, SNARE, 8, 39], [8, SNARE, 10, 41], [9, SNARE, 12, 41], [10, KICK, 13, 36], [11, RISER, 14, 41]])
  // DPCM  the kick doubling the noise kick on every barline: the section's weight
  ret.hits(L.DPCM, KIT.inst, 12, range(0, 16).map((bar) => [bar, 0]), KIT.kick)
  ret.hits(L.DPCM, KIT.inst, 11, [[7, 6], [15, 6]], KIT.snare)
}

// =====================================================================================
// crest — frames 44–48 (20 bars). The climb. Each four-bar unit starts a third above the
// last, and the GLOBAL PEAK — d6, MIDI 86 — lands at 47:6, on the second beat of its bar,
// in the last third of the piece (frame 47 of 51). Then the line falls back and the last
// two bars are THE SECOND CADENTIAL HEMIOLA, and it is nothing like the first: at 48:24 the
// SAWTOOTH and the SNARE take the six 4-row groups, the kick disappears entirely, the hats
// keep the two beats underneath so the conflict is audible, and pulse 1 holds ONE NOTE
// across all twenty-four rows. A's hemiola was pulse 2, V2 and the kick over a held bass;
// this one is the bass itself regrouping under a held melody — the same device inverted.
// =====================================================================================
const crest = s.section('crest', 20)
{
  const C_HARMONY = [
    CH.i, CH.III, CH.iv, CH.V, CH.VI, CH.VII, CH.i, CH.III,
    CH.iv, CH.V, CH.VI, CH.VII, CH.i, CH.VI, CH.iv, CH.V,
    CH.i, CH.VI, CH.V, CH.V,
  ]
  const VIB = nib(5, 2)
  phrase(crest, L.P1, LEAD_WIDE, 0, [
    [2, 'b4', 13], [2, 'd5', 13], [2, 'f#5', 14], [6, 'a5', 14],
    [2, 'a5', 14], [2, 'f#5', 13], [2, 'd5', 13], [4, 'f#5', 13], [2, '-'],
    [2, 'b4', 13], [2, 'e5', 13], [2, 'g5', 14], [6, 'b5', 15],
    [2, 'a#5', 14], [2, 'f#5', 13], [2, 'c#5', 13], [4, 'f#5', 14], [2, '-'],
    [2, 'd5', 13], [2, 'g5', 14], [2, 'b5', 14], [6, 'a5', 14],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'a5', 14], [4, 'g5', 14], [2, '-'],
    [2, 'd5', 13], [2, 'f#5', 14], [2, 'b5', 15], [6, 'c#6', 15],
    [2, 'b5', 14], [2, 'a5', 14], [2, 'f#5', 13], [4, 'a5', 14], [2, '-'],
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(crest, L.P1, LEAD_WIDE, crest.at(8), [
    [2, 'e5', 13], [2, 'g5', 14], [2, 'b5', 14], [6, 'a5', 14],
    [2, 'c#6', 15], [2, 'a#5', 14], [2, 'f#5', 14], [4, 'a#5', 14], [2, '-'],
    [2, 'd5', 13], [2, 'g5', 14], [2, 'b5', 14], [6, 'a5', 14],
    [2, 'b5', 14], [2, 'a5', 14], [2, 'e5', 13], [4, 'a5', 14], [2, '-'],
    [2, 'f#5', 14], [2, 'a5', 14], [2, 'b5', 15], [6, 'd6', 15], // THE PEAK, 47:6
    [2, 'b5', 15], [2, 'a5', 14], [2, 'g5', 14], [4, 'b5', 14], [2, '-'],
    [2, 'g5', 14], [2, 'e5', 13], [2, 'b4', 13], [6, 'g5', 14],
    [2, 'f#5', 14], [2, 'e5', 13], [2, 'c#5', 13], [4, 'a#5', 14], [2, '-'],
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  phrase(crest, L.P1, LEAD_WIDE, crest.at(16), [
    [2, 'b5', 14], [2, 'a5', 14], [2, 'f#5', 13], [6, 'd5', 13],
    [2, 'g5', 14], [2, 'f#5', 13], [2, 'e5', 13], [4, 'd5', 13], [2, '-'],
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // the held note across the whole hemiola — 24 rows, 1.2 s, with the vibrato blooming a
  // beat in and an `Ax0` fade under it, so a melody that has just peaked steps out of the
  // way of the metric argument underneath it
  phrase(crest, L.P1, LEAD_WIDE, crest.at(18), [[24, 'c#5', 13]], {
    vib: nib(4, 3), vibMin: 12, vibAfter: 6, fade: 0x10, fadeAfter: 14, cutAtEnd: false,
  })
  // P2  the counter-line, a sixth or a tenth under the climb, moving where the lead holds
  for (const bar of range(0, 18)) {
    answers(crest, L.P2, COUNTER, [
      [bar, 8, tone(C_HARMONY[bar], 1, 'b3'), 11, 4], [bar, 10, tone(C_HARMONY[bar], 2, 'b3'), 11, 4],
    ])
  }
  answers(crest, L.P2, COUNTER, [[18, 2, 'f#4', 11, 4], [18, 6, 'a#4', 11, 4], [19, 2, 'c#5', 11, 4], [19, 6, 'a#4', 11, 6]])
  // TRI  the split bass, climbing with the harmony; it HOLDS through the hemiola
  for (const bar of range(0, 18)) {
    const ch = C_HARMONY[bar]
    gallop(crest, bar, [root(ch, 'b1'), tone(ch, 2, 'b1'), tone(ch, 1, 'b1')])
  }
  for (const bar of [18, 19]) crest.put(L.TRI, crest.at(bar, 0), { note: n('f#1'), inst: TRI_HOLD, vol: 15 })
  // SAW  the tenor eighths, and then THE HEMIOLA CARRIER: the six 4-row groups of bars
  // 18–19, rising through the dominant and falling back
  for (const bar of range(0, 18)) sawTenor(crest, bar, C_HARMONY[bar], 'd3', 11)
  const GROUPS = [['f#3', 'a#3', 'c#4'], ['f#4', 'c#4', 'a#3']]
  GROUPS.forEach((notes, i) => {
    notes.forEach((note, g) => {
      crest.put(L.SAW, crest.at(18 + i, g * 4), { note: n(note), inst: SAW_RUN, vol: g === 0 ? 12 : 11 })
    })
  })
  // V1  the bed through the climb, six notes in the even bars and three in the odd, silent
  // for the hemiola
  for (const bar of range(0, 18)) bed(crest, bar, C_HARMONY[bar], 'd4', 8, [0, 1, 2], bar % 2 === 0 ? [0, 6] : [0])
  crest.put(L.V1, crest.at(18, 0), { note: CUT })
  // V2  fifths on the beats, rising; silent for the hemiola so the saw has it alone
  for (const bar of range(0, 18)) hold(crest, L.V2, bar, C_HARMONY[bar], bar % 2 === 0 ? 2 : 1, 'f#3', 10)
  crest.put(L.V2, crest.at(18, 0), { note: CUT })
  // NOISE  kit J through the climb: the kick on the barline and the second eighth of beat 2,
  // an open hat every fourth bar, a crash where each unit begins. THE HEMIOLA'S KIT has no
  // kick at all — the snare takes the six groups and the hats keep the two beats.
  for (const bar of range(0, 18)) {
    crest.hits(L.NOISE, KICK, 12, [[bar, 0], [bar, 8]])
    crest.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    crest.hits(L.NOISE, SNARE, 4, [[bar, 11]], 39)
    hats(crest, bar, [2, 4, 10], { on: 8, off: 6 })
    if (bar % 8 === 0) crest.put(L.NOISE, crest.at(bar, 0), { note: 46, inst: CRASH, vol: 10 })
  }
  for (const bar of [18, 19]) {
    for (const r of [0, 4, 8]) crest.hits(L.NOISE, SNARE, r === 0 ? 13 : 11, [[bar, r]], 41)
    hats(crest, bar, [6], { on: 7, off: 7 })
  }
  clearKit(crest, 7, 6)
  fill(crest, 7, 'crest-tumble', tomCells(6, [43, 41, 39, 37], [12, 12, 13, 14], TOM_LONG))
  clearKit(crest, 15, 6)
  fill(crest, 15, 'crest-riser', [[6, RISER, 12, 40], [9, SNARE, 13, 41], [10, SNARE, 8, 39], [11, SNARE, 14, 41]])
  clearKit(crest, 17, 6)
  fill(crest, 17, 'into-the-second-hemiola', [[6, SNARE, 10, 39], [8, SNARE, 12, 41], [9, SNARE, 7, 39], [10, TOM_LONG, 13, 43], [11, TOM_LONG, 13, 37]])
  // DPCM  the kick under the climb's crashes and the peak; nothing in the hemiola
  crest.hits(L.DPCM, KIT.inst, 13, [[0, 0], [8, 0], [12, 0], [12, 6], [16, 0]], KIT.kick)
  crest.hits(L.DPCM, KIT.inst, 11, [[7, 11], [15, 11]], KIT.snare)
}

// =====================================================================================
// tail — frames 49–50 (8 bars). The turn back. Bm · G · C#dim · F# and then four bars of
// the bare dominant, thinning a lane at a time until only the triangle and one pulse are
// left. THERE IS NO FILL HERE (§2.9 rule 5 and §9.4): the kit's last event is at 50:28 and
// the loop row's own kick is the arrival. The `Bxx` the library writes on the last row
// points at frame 2, so the launch plays once and the flight begins again.
// =====================================================================================
const tail = s.section('tail', 8)
{
  const T_HARMONY = [CH.i, CH.VI, CH.ii, CH.V, CH.V, CH.V, CH.V, CH.V]
  phrase(tail, L.P1, LEAD, 0, [
    [2, 'b4', 13], [2, 'd5', 13], [2, 'f#5', 13], [6, 'b5', 14],
    [2, 'a5', 14], [2, 'g5', 13], [2, 'd5', 13], [4, 'b4', 13], [2, '-'],
    [2, 'c#5', 13], [2, 'e5', 13], [2, 'g5', 13], [6, 'e5', 13],
    [2, 'c#5', 13], [2, 'a#4', 13], [2, 'c#5', 13], [4, 'f#5', 13], [2, '-'],
    [6, 'c#5', 12], [6, 'a#4', 12],
    [6, 'f#4', 12], [6, 'a#4', 12],
    [12, 'c#5', 12],
    [12, 'f#4', 11], // held to the seam: the loop row restrikes it, so nothing is stranded
  ], { vib: nib(4, 2), vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // P2  two bars of thirds and then out: the second voice leaves first
  answers(tail, L.P2, COUNTER, [
    [0, 8, 'f#4', 11], [0, 10, 'g4', 11], [1, 10, 'b4', 11, 4],
    [2, 8, 'e4', 11], [2, 10, 'g4', 11], [3, 10, 'a#4', 11, 4],
    [4, 0, 'c#4', 10, 10], [5, 0, 'a#3', 10, 10],
  ])
  // TRI  the gallop for four bars, then the dominant held: the one voice besides pulse 1
  // still sounding when the loop jumps, and it hands over to A's own b1
  const T_WALK = [['b1', 'f#2', 'd2'], ['g1', 'd2', 'b1'], ['c#2', 'g1', 'e2'], ['f#1', 'c#2', 'a#1']]
  T_WALK.forEach((notes, bar) => gallop(tail, bar, notes))
  for (const bar of [4, 5, 6]) {
    tail.put(L.TRI, tail.at(bar, 0), { note: n('f#1'), inst: TRI_HOLD, vol: 15 })
    if (bar < 6) tail.put(L.TRI, tail.at(bar, 6), { note: n('c#2'), inst: TRI_8, vol: 15 })
  }
  // the last bar is a TURNAROUND, not a stop (§2.9 rule 5): the dominant holds for a beat
  // and then two eighths climb a#1 -> c#2 into A's own b1, so the loop is entered by a bass
  // line rather than by a silence. Measured: the last 0.3 s of a pass is -23.4 dBFS against
  // the -38.6 the first draft left when every lane but the triangle had already stopped.
  tail.put(L.TRI, tail.at(7, 0), { note: n('f#1'), inst: TRI_HOLD, vol: 15 })
  tail.put(L.TRI, tail.at(7, 6), { note: n('f#1'), inst: TRI_8, vol: 15 })
  tail.put(L.TRI, tail.at(7, 8), { note: n('a#1'), inst: TRI_8, vol: 15 })
  tail.put(L.TRI, tail.at(7, 10), { note: n('c#2'), inst: TRI_8, vol: 15 })
  // SAW  eighths for four bars, one sustained dominant, then out
  for (const bar of range(0, 4)) sawTenor(tail, bar, T_HARMONY[bar], 'd3', 11)
  tail.put(L.SAW, tail.at(4, 0), { note: n('c#3'), inst: SAW_HOLD, vol: 8 })
  tail.put(L.SAW, tail.at(5, 0), { note: n('a#2'), inst: SAW_HOLD, vol: 8 })
  tail.put(L.SAW, tail.at(6, 0), { note: CUT })
  // V1 / V2  the bed and the inner voice leave at bar 4 and bar 6
  for (const bar of range(0, 4)) bed(tail, bar, T_HARMONY[bar], 'd4', 8, [0, 1, 2], [0])
  tail.put(L.V1, tail.at(4, 0), { note: CUT })
  for (const bar of range(0, 6)) hold(tail, L.V2, bar, T_HARMONY[bar], bar % 2 === 0 ? 1 : 2, 'f#3', 9)
  tail.put(L.V2, tail.at(6, 0), { note: CUT })
  // NOISE  the kit thins and STOPS: full for four bars, kick and hats for two, one kick and
  // one hat in bar 6, and silence from 50:28 to the seam. No roll, no crash, no fill.
  for (const bar of range(0, 4)) {
    tail.hits(L.NOISE, KICK, 12, [[bar, 0]])
    tail.hits(L.NOISE, SNARE, 12, [[bar, 6]], 41)
    hats(tail, bar, [2, 4, 8, 10], { on: 8, off: 6 })
  }
  for (const bar of [4, 5]) {
    tail.hits(L.NOISE, KICK, 11, [[bar, 0]])
    hats(tail, bar, [4, 6, 10], { on: 7, off: 6 })
  }
  tail.hits(L.NOISE, KICK, 10, [[6, 0]])
  hats(tail, 6, [4], { on: 6, off: 6 })
  tail.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// HEADROOM, measured rather than guessed. The arrangement as first written rendered at
// -19.59 dBFS over two passes — inside gate C's window by 0.4 dB, which is not a margin,
// and thin for a piece whose subject is speed. A fast 6/8 texture spends most of its time
// in detached eighths, so the average sits well under the peak: peak 0.695 with zero
// clamped samples says there is room. The fix is to lift the PARTS, once, everywhere
// (§2.8: clipping is re-voiced and level is never re-gained), so every balance decision
// above is preserved relative to every other. One column step on the five level-carrying
// melodic lanes; the triangle is a gate and has no level, and the kit is left where it was
// so the drums do not creep up on the tune.
// =====================================================================================
// PER-LANE, because a flat lift is not a mix: the lead is already the loudest thing in the
// piece and pushing it further would put two thirds of its note events at column 15, which
// is §2.8's constant-15 fatigue arriving by the back door. The accompaniment is what has
// room — the arpeggio bed most of all — so the quiet lanes come up and the lead comes up
// least. The sawtooth is lifted one step only, because volume 15 on the saw is about twice
// a pulse at 15 and it is the first lane to clamp the mix (§12.2).
const LIFT = { [L.P1]: 1, [L.P2]: 2, [L.V1]: 3, [L.V2]: 2, [L.SAW]: 1, [L.NOISE]: 2 }
for (const sec of s.sections.values()) {
  for (const [lane, step] of Object.entries(LIFT)) {
    for (const cell of sec.lanes[lane]) {
      if (cell != null && cell.vol !== undefined) cell.vol = Math.min(15, cell.vol + step)
    }
  }
}

// =====================================================================================
// self-checks — the three claims in this file a reader cannot verify by reading it
// =====================================================================================
// 1. THE PHASE TABLE, computed rather than quoted. The 5-row cell's entry row in frame k is
//    `(-48k) mod 5`; the cycle closes after lcm(5,48)/48 = 5 frames. If the arithmetic in
//    the header is wrong, the build fails here instead of shipping a wrong comment.
{
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  const rows = s.meta.rowsPerPattern
  const cell = 5
  const cycle = (cell * rows) / gcd(cell, rows) / rows
  const entries = range(0, cycle).map((k) => ((-rows * k) % cell + cell) % cell)
  if (cycle !== 5 || entries.join() !== '0,2,4,1,3') {
    throw new Error(`the 5-row phase table is ${entries.join()} over ${cycle} frames, not 0,2,4,1,3 over 5`)
  }
  const attacks = sprint.lanes[L.V2].map((c, r) => (c !== null && c.note >= 0 ? r : -1)).filter((r) => r >= 0)
  const wanted = range(0, sprint.len, cell)
  if (attacks.join() !== wanted.join()) throw new Error('the 5-row cell is not unbroken every five rows')
  const perFrame = range(0, 5).map((k) => attacks.find((r) => r >= k * rows) - k * rows)
  if (perFrame.join() !== entries.join()) throw new Error(`the cell's entry rows are ${perFrame.join()}`)
}
// 2. THE DROPPED BEAT. `D00` at 39:41 means rows 42–47 of that frame never play, so nothing
//    may be written there — least of all a channel-mode cancel, which would never happen.
{
  const first = stall.at(7, 6)
  for (let lane = 0; lane < 8; lane++) {
    for (let row = first; row < stall.len; row++) {
      if (stall.lanes[lane][row] !== null) throw new Error(`stall lane ${lane} row ${row} is inside the rows D00 skips`)
    }
    if (stall.latched(lane, stall.at(7, 5)).size > 0) {
      throw new Error(`stall lane ${lane} still has a channel mode latched at the dropped beat`)
    }
  }
}
// 3. THIRTY FILLS, none of them alike — `fill()` throws on a repeat, so reaching here is the
//    proof; this only pins the count the notes claim.
if (FILL_LOG.length !== 30) throw new Error(`${FILL_LOG.length} fills, not 30`)

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order([
  'launch', 'flight', 'flight2', 'chase', 'dive', 'three', 'hinge',
  'updraft', 'updraft2', 'hush', 'sprint', 'stall', 'return', 'crest', 'tail',
])
s.loopTo('flight')
s.qa({
  key: 'b-minor',
  bpmRange: [199, 201],
  durationSec: [119, 126],
  motif: {
    channel: 'pulse1',
    patterns: [0, 6, 10, 18, 40],
    variation: 'displaced one eighth late, augmented onto a 4-row grid, augmented and inverted about f#5, re-orchestrated onto the sawtooth an octave down, and re-harmonised note for note',
  },
  notes:
    'B minor in 6/8 at 200 BPM, the album\'s fastest piece and its only compound metre: speed 3, ' +
    'rowHighlight 6 (the dotted-quarter beat), rowHighlight2 12 (a bar), rowsPerPattern 48 (a frame ' +
    '= 4 bars = 2.4 s). One row is a 16th at 50 ms and an EIGHTH IS TWO ROWS, which is the piece\'s ' +
    'unit of motion; 51 frames, 204 bars, one pass 122.10 s. THE MOTIF H is four bars in which every ' +
    'bar climbs three eighths and LANDS on the second beat, and every landing is answered by a ' +
    'stepwise fall whose last eighth is a REST — at 100 ms an eighth the rest is the third limb of ' +
    'the motif and the only reason the tune is singable at this tempo. H is stated at 2:0 and its ' +
    'variations are: DISPLACED one eighth late at 10:2 (H) and 11:2 (H2), against a kit and a bass ' +
    'that stay on the grid, resolving at 13:0 where the bar snaps back; AUGMENTED at 18:0, every ' +
    'value doubled, which in 6/8 puts every attack of the tune on a 4-row grid and makes the melody ' +
    'itself the hemiola; AUGMENTED AND INVERTED about f#5 at 20:0, so the climbs fall; ' +
    'RE-ORCHESTRATED at 25:0 onto the VRC6 sawtooth an octave below the pulse\'s register (the ' +
    'second lead colour); and RE-HARMONISED at 40:8, where A\'s closing six bars are repeated note ' +
    'for note over Em C#dim D Bm Em A instead of Bm A G D Em C#dim. METRE (9.1), with the phase ' +
    'table COMPUTED FOR 48-ROW FRAMES rather than taken from 9.1\'s 64-row one: the entry row of ' +
    'frame k for a cell of length c is (-48k) mod c and the cycle closes after lcm(c,48)/48 frames, ' +
    'so a 5-row cell takes 5 frames and enters at rows 0, 2, 4, 1, 3 — not 0,1,2,3,4. STRUCTURAL: ' +
    'that cell, on VRC6 pulse 2, unbroken every five rows from 33:0 to 37:43, 48 attacks, entering ' +
    '33:0, 34:2, 35:4, 36:1 and 37:3 — the whole five-frame cycle, which is why `sprint` is five ' +
    'frames long. Five rows is 250 ms here against a 300 ms beat: 9.1\'s warning that a 5-row cell ' +
    'blurs above 140 BPM is written for 64-row 16th grids where a row is 107 ms, and the cell is ' +
    'judged by its own duration. Its instrument alternates per frame so the phase cycle is a timbre ' +
    'cycle, and its pitches are the current bar\'s chord tones. WHOLE-SECTION HEMIOLA: `three` ' +
    '(18:0-22:47), twenty bars in which VRC6 pulse 2 (rows 0, 4, 8 of every bar), V1 (the same three ' +
    'groups displaced an eighth, rows 2, 6, 10), the kit and the augmented tune all count 3 x 4 rows ' +
    'while the triangle, the sawtooth and pulse 2 keep 2 x 6 — the section is bi-metric, not merely ' +
    'regrouped. CADENTIAL HEMIOLA twice, and differently: at 5:24 pulse 1, pulse 2, V2 and the KICK ' +
    'take six 4-row groups over the last two bars of A while the triangle holds f# and the sawtooth ' +
    'rests; at 48:24 the SAWTOOTH and the SNARE take the groups, the kick disappears, the hats keep ' +
    'the two beats underneath and pulse 1 holds ONE NOTE across all twenty-four rows. METRIC ' +
    'SURPRISE, exactly one: D00 at 39:41, which makes that frame 42 rows and its last bar six rows — ' +
    'one beat instead of two — jumping a half-bar forward into the return of the theme. Rows 42-47 ' +
    'of frame 39 are therefore never played, so nothing is written there and every channel mode ' +
    '`stall` sets is cancelled before row 41; the generator asserts both on the built grid. ' +
    'HARMONY (9.3): NON-DIATONIC 1 is a six-link chromatic bass descent b-a#-a-g#-g-f# at 14:0, ' +
    '14:24, 15:0, 15:24, 16:0 and 16:24, TWO BARS a link — 1.2 s each — under a descant that ' +
    'oscillates d5-c#5 and a kit with no kick at all for eight bars, so each chord is what the ' +
    'collision implies: Bm, F#/a#, A7, G#dim (a common-tone diminished sharing b AND d with the ' +
    'tonic), G, F#. NON-DIATONIC 2 is an AUGMENTED SIXTH at 23:36 and it is NOT a cadence: g in the ' +
    'triangle, b in pulse 2, e# in pulse 1 and the whole chord as an 0xy arpeggio (04a = decimal 74, ' +
    'because an augmented sixth is enharmonically a dominant seventh) on V1, with the kit running ' +
    'through it at full speed. It resolves OUTWARD at 24:0 — g falls to f#, e# rises to f# — and ' +
    'then the piece refuses to hear that f# as a dominant: 24:24 strips the chord to bare f# octaves ' +
    'and `updraft` reads the same note as the THIRD of D major, so the resolution launches instead ' +
    'of closing. Third colour, free: the lift to the relative major for `updraft` (25:0-30:47), ' +
    'which is B natural minor\'s own seven notes and costs no accidental. SEQUENCE: falling fifths, ' +
    'eight links, Bm Em A D G C#dim F# Bm at 33:0-34:47, restated and stalled on the dominant at ' +
    '35:0-36:47. HARMONIC RHYTHM: one chord a bar everywhere except `launch` (four bars of i, then ' +
    'two a chord), `dive` (two bars a link) and `three` (ONE PER FOUR BARS - Bm Em D F#m F#), which ' +
    'is the section that differs. No four-chord cycle repeats at all, let alone for eight ' +
    'consecutive bars: the only group that recurs is Bm Em A D at 33:0 and 35:0, and four bars of ' +
    'different harmony stand between the two statements. COUNTERPOINT (9.2): pulse ' +
    '2 is an independent line for the whole of `flight2` (6:0-9:47) — dotted quarters on rows 3 and ' +
    '9, the beat displaced by half of itself, so all 32 of its attacks fall on rows pulse 1 does not ' +
    'use, its contour answers H bar by bar, and it crosses above the lead exactly once, at 8:9. ' +
    'Written suspensions and appoggiaturas: the cadential suspension at 9:45, e4 over the dominant ' +
    'held through the chord change at 10:0 and resolved down by step to d4 at 10:3; two 4-3 ' +
    'suspensions in the descant over the sawtooth\'s tune, a5 to g5 over Em at 26:0 and g5 to f#5 ' +
    'over D at 28:0. Contrary-motion cadences at 5:44 (the melody falls c#5 to b4 into 6:0 while the ' +
    'triangle rises a1 to b1) and at 48:44 (the held c#5 falls to b4 into 49:0 while the triangle ' +
    'rises f#1 to b1). The only parallel writing is four bars of sixths at 29:0-29:47, earned by ' +
    'sixteen bars in which pulse 2 was either independent or silent, and never repeated. PEAKS: one ' +
    'per section, and the global peak d6 is struck ONCE, at 47:6, on the second beat of its bar, in ' +
    'frame 47 of 51. BREATH, because this tempo\'s failure mode is a wall of notes: the lead rests ' +
    'one eighth at every two-bar mark and a FULL DOTTED QUARTER at every eight-bar mark (3:42, ' +
    '7:42, 11:44, 41:42 and the section closes), and it is silent for 13.5 % of the piece\'s rows. ' +
    'CONTOUR, measured within phrases rather than across them: 69.2 % of the lead\'s 539 intervals ' +
    'are three semitones or less, 84.0 % four or less and 94.4 % five or less, and the widest ' +
    'interval anywhere in the lead is a major sixth. The 70 % floor of 2.10 is missed by eight ' +
    'tenths of a point because the motif\'s own climb is an arpeggio — b-d-f#-a — so a major third ' +
    'is this tune\'s step, and stating it otherwise would be a different tune. CHANNEL ECONOMY: the arpeggio bed is established in `launch` and A and then ' +
    'LEAVES at 6:0, staying out for twelve frames through `flight2`, `chase` and `dive`; it returns ' +
    'CHANGED at 18:0 as the offset three-count of the hemiola and only reaches its original form ' +
    'again at 25:0. THE LEAD HAS THREE COLOURS and none of them carries the piece: x-headlong-lead ' +
    'opens at 50 % and settles to 25 %, x-headlong-lead-thin opens at 25 % and settles to 12.5 % ' +
    'and takes `updraft`\'s descant (25:0) and `hush` (31:0), and x-headlong-lead-wide does not ' +
    'narrow at all — a flat 50 %, the widest duty and the loudest-sounding at equal volume — and ' +
    'takes the whole of `crest` (44:0-48:47), so the climb is a section repaint as well as a ' +
    'register climb and the peak at 47:6 is the fattest note in the piece as well as the highest. ' +
    '`hush` (31:0-32:47) is two lanes and nothing else — the one place five lanes ' +
    'rest at once and the only section with no kit. DRUMS (9.4): fifteen kit postures and thirty ' +
    'fills, and no two fills are alike by construction — the generator records every fill\'s cells ' +
    'and throws on a repeat. Ghosts at vol 4-6; no fill at the loop seam, where the kit stops at ' +
    '50:28 and the loop row\'s own kick is the arrival. EFFECTS, decimal on disk: 0xy 04a = 74 at ' +
    '23:36 and 23:42, cancelled with 000 at 24:0; 4xy vibrato 452 = 82 on the lead\'s dotted-quarter ' +
    'landings and 432 = 50 on pulse 2\'s held notes in `three`, always written three rows after the ' +
    'note and cancelled with 4x0 — the depth nibble, not a zero param — on the next bare event; 7xy ' +
    'tremolo 732 = 50 on the held inner voice through the chromatic descent, cancelled at 16:46 with ' +
    '710 and never a bare 700, which replays the effect memory; Ax0 fades on the long lead notes and ' +
    'the sustained inner voice and A03 = 3 SWELLING (the direction is inverted: Ax0 fades, A0y ' +
    'swells) on the sawtooth\'s climb out of the dive at 16:3, each cancelled with A00; 314 = 20 ' +
    'portamento on the sawtooth through the brake at 39:0-39:30, cancelled with 100 at 39:36 ' +
    'because 300 only FREEZES a portamento; R14 = 20 as a one-shot phrase-end fall at 32:42; D00 at ' +
    '39:41; B02 as the loop. NOT USED, deliberately: Vxx, because every melodic instrument here ' +
    'carries a duty macro and a macro overrides Vxx from the next tick, so the cell would be a write ' +
    'nothing reads; Gxx, because at speed 3 a tick is a sixth of an eighth and reads as timbre ' +
    'rather than as time; Fxx, because the piece is about one tempo. NOTHING IS DECLARED THAT THE ' +
    'PIECE DOES NOT NEED: the accidentals measure 181 of 2806 melodic notes (6.45 %) against the ' +
    'lint\'s 12 % default, so no accidentalFractionMax; the longest percussion gap is the 97 rows of ' +
    '`hush` and coverage is 92.4 % of played rows inside a gap of 8 or less, over the 80 % floor, so ' +
    'no percussion bound is raised; the render is -18.57 dBFS with peak 0.787 and ZERO clamped ' +
    'samples, so neither rmsRange nor clippedSamplesMax is declared. DEVIATIONS, stated because an ' +
    'unexplained one is a finding: (1) A\'s two fills are at 3:42 and 5:16 — the second unit takes ' +
    'its fill two bars early because bars 15-16 of that section belong to the cadential ' +
    'hemiola, where the kick takes the 4-row groups and a fill would bury the device; (2) the ' +
    'sawtooth\'s LEAD statements reach b4 (MIDI 71), above the 48-67 window the tenor writing keeps ' +
    'to, because the brief asks for the tune an octave below the pulse and that is where an octave ' +
    'below puts it; its tenor and bass writing stays at 46-62; (3) 9.8\'s ceiling of 28 note attacks ' +
    'a bar was written for five lanes — measured across all eight here the densest frame is 27.0 ' +
    'attacks a bar (frame 29), and the V1 bed alternates six notes a bar with three specifically to ' +
    'keep it there.',
  renderChecksum: 3080584180,
})
s.check()
s.write('src/assets/songs/12-headlong.json')
