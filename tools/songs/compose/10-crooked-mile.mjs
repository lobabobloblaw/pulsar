#!/usr/bin/env node
/** 10 — Crooked Mile. Seven eighths to the bar, grouped 2+2+3: a walk with a hitch in it.
 *
 *      node tools/songs/compose/10-crooked-mile.mjs  -> src/assets/songs/10-crooked-mile.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), invented from the
 *  contour and harmony rules of §2.10 / §9.3. Bright, light-footed, outdoors; an idiom and
 *  an energy, never a source. Nothing here quotes or paraphrases any published work.
 *
 *  GRID  tempo 150 · speed 7 · rowHighlight 4 (a beat) · rowHighlight2 14 (a 7/8 bar) ·
 *        rowsPerPattern 56 (a frame = 4 bars) = 128.571 BPM on 16th rows.
 *        one row 116.67 ms · one bar 1.6333 s · one frame 6.5333 s.
 *        VERIFIED against lib.mjs before a note was written: 24·150/(7·4) = 128.571 and
 *        56/14 = 4, so a section's length must be a multiple of FOUR bars.
 *
 *  THE BAR  eighths at rows 0 2 4 6 8 10 12; the three groups start at rows 0, 4 and 8 and
 *        the third is six rows long (8–13). `rowHighlight: 4` marks 0, 4, 8 and 12 — the
 *        first three are group heads and the 12 falls INSIDE the long group. That
 *        mismatch is the piece: row 12 is the crooked step, and every lane uses it.
 *
 *  PHASE-CARRY TABLE, computed for 56-row frames rather than copied from §9.1's 64-row
 *  one. Cell length `c`, entry row of frame k = `(−56k) mod c`, cycle closes after
 *  `lcm(c, 56)/56` frames:
 *        c = 3 (dotted 8th)  3 frames  entry rows 0, 1, 2   — realigns with the BAR every 3 bars
 *        c = 4 (quarter)     1 frame   entry row  0         — realigns with the BAR every 2 bars
 *        c = 5               5 frames  entry rows 0,4,3,2,1
 *        c = 6               3 frames  entry rows 0,4,2
 *  The piece uses c = 3 on VRC6 pulse 1 (`walk`, three frames, the full cycle) and c = 4
 *  on 2A03 pulse 2 (`stile`, a quarter-note counter-line that lands on the group heads in
 *  even bars and between them in odd ones). Both agree with the brief.
 *
 *  FORM (20 frames, 80 bars, one pass 130.67 s = 2:11 — 1120 rows)
 *  | frame | section | bars | what happens                                                |
 *  |-------|---------|------|-------------------------------------------------------------|
 *  | 0     | gate    | 4    | the limp alone: the triangle states 2+2+3 with no kit at    |
 *  |       |         |      | all, hats join on the three group heads, V2 establishes C    |
 *  |       |         |      | major as `0xy` triads — the ONLY arpeggio bed in the piece,  |
 *  |       |         |      | dropped for good at bar 4 because the ear now has the key    |
 *  | 1–3   | walk    | 12   | THE LOOP TARGET. M on pulse 1; the 3-row cell runs on V1     |
 *  |       |         |      | for three whole frames, entering 1:0, 2:1, 3:2 and resolving |
 *  |       |         |      | onto the downbeat at 4:0. Three 4-bar phrases, each ending   |
 *  |       |         |      | in a rest; the saw enters at bar 4 and takes the long group   |
 *  | 4–5   | stile   | 8    | TWO CHORDS A BAR (rows 0 and 8 — the head of the long        |
 *  |       |         |      | group), the only section whose harmonic rhythm differs. The  |
 *  |       |         |      | chained secondaries E7 A7 D7 G7 C, and pulse 2 independent   |
 *  |       |         |      | for the whole section on a 4-row cell                        |
 *  | 6–7   | broad   | 8    | THE 7/4 REGROUPING: the same 56-row frame heard as two bars  |
 *  |       |         |      | of 7/4, accents every 4 rows, half-time. M in AUGMENTATION,  |
 *  |       |         |      | a held common tone on V2, and the borrowed flat VII          |
 *  | 8–10  | walk2   | 12   | the tune LEAVES pulse 1: the sawtooth has M at pitch an      |
 *  |       |         |      | octave down for eight bars while pulse 1 answers in long     |
 *  |       |         |      | notes; pulse 1 takes it back for the last four                |
 *  | 11–12 | hollow  | 8    | the thinnest place: the CHROMATIC MEDIANT, E major on a      |
 *  |       |         |      | stationary e, quitted to F and never to Am. No kick          |
 *  | 13–15 | climb   | 12   | the build: M's rhythm sequenced up a step at a time. The     |
 *  |       |         |      | the accelerating snare roll simply ends. NO metric           |
 *  |       |         |      | surprise: one beat of air carries into `crest`               |
 *  | 16–17 | crest   | 8    | the peak: M in octaves on pulse 1 and V1 for four bars, the  |
 *  |       |         |      | global high d6 at 17:18, a flat VII–IV–I plagal close        |
 *  | 18–19 | turn    | 8    | walking away: descending fifths, the lanes leaving one at a  |
 *  |       |         |      | time, a bare G7 into the loop. NO fill at the seam           |
 *
 *  MOTIFS
 *    M   the subject, two bars. Bar 1: a foot, then a RISING FIFTH, then the walk back
 *        down — and the long group opens with a quarter and closes with a single eighth on
 *        row 12, the crooked step. Bar 2: four attacks only, the long group held whole.
 *        Six attacks then four: the motif contains its own breath.
 *          c5 · g5 · f5 · e5 | d5 —— · e5   ‖   g5 · f5 · e5 —— | c5 ——————
 *        Contour: one fifth (the signature leap), everything else a step or a third;
 *        8 of its 9 intervals are 3 semitones or less.
 *    MA  M in augmentation — every value doubled, so the two bars become one 7/4 bar plus
 *        one. This is what `broad` plays, which is why the regrouping is structural and
 *        not a gimmick: the broad hearing IS the tune, slowed.
 *    MS  M's head sequenced up the scale one step per bar (`climb`).
 *    Q   the quarter-note counter-line: pulse 2's own voice in `stile`, an attack every
 *        four rows against a seven-row bar.
 *
 *  ALLOCATION (one lead at a time; every lane rests audibly somewhere)
 *    gate    TRI the metre · NOISE hats on the heads · V2 `0xy` triads · V1 head pings ·
 *            SAW a four-note pickup · P1 P2 DPCM silent
 *    walk    P1 M · V1 the 3-row cell · TRI the walking bass · V2 held guide tones ·
 *            P2 two-note answers in the long group (bars 0–3, 8–11) · SAW from bar 4 ·
 *            kit walking, DPCM silent
 *    stile   P1 suspensions over the changes · P2 the 4-row cell, independent throughout ·
 *            V1 + V2 the chain's two chromatic guide-tone lines · TRI two roots a bar ·
 *            SAW off-beat tenor · DPCM on row 8 of every bar
 *    broad   P1 MA · V2 one held common tone · V1 the quarter grid · TRI half-time ·
 *            SAW from the third 7/4 bar · P2 four bars of earned sixths · kit in quarters
 *    walk2   SAW M an octave down · P1 long answers then the tune back · V1 SILENT for the
 *            saw's eight bars · V2 guide tones · TRI the walk with chromatic approaches ·
 *            P2 silent to bar 8
 *    hollow  P1 bare · V2 the stationary e · V1 the g# · TRI three notes · no kick, no
 *            saw until bar 6, no DPCM
 *    climb   P1 MS · everything rising · DPCM from bar 8 · the roll ends bar 11, no cut
 *    crest   P1 + V1 M in octaves · SAW the bass · full kit + DPCM · P2 sixths
 *    turn    everything leaving; the last bar is pulse 1 and the triangle over G7
 *
 *  DEVICES (frame:row — the same list is in extra.qa.notes)
 *    §9.1  STRUCTURAL 1: the 3-row dotted-eighth cell on V1, 56 attacks unbroken from
 *          1:0 to 3:53, entering 1:0, 2:1, 3:2 — `(−56k) mod 3` — and resolving onto the
 *          downbeat at 4:0, three full frames of carried phase.
 *          STRUCTURAL 2: the 7/4 regrouping at 6:0–7:55, four 28-row bars accented every
 *          four rows by the kit, the bass and V1 together.
 *          Also: pulse 2's 4-row cell at 4:0–5:52 (realigns with the bar every 2 bars).
 *          NO metric surprise: the piece carries no Dxx pattern break anywhere. The
 *          snare roll in `climb` bar 11 simply ends; one beat of air runs into `crest`.
 *    §9.2  pulse 2 is an independent line for the whole of `stile` (4:0–5:55): its own
 *          4-row rhythm, its own contour, and it falls at the cadence (5:8) while pulse 1
 *          rises. Suspensions at 4:4 (resolving 4:12) and, at the cadence, 5:40
 *          (resolving 5:42); an appoggiatura on the a5 at 1:32, resolving down at 1:34.
 *    §9.3  NON-DIATONIC 1: chained secondaries E7 (4:36) A7 (4:42) D7 (4:50) G7 (5:0)
 *          C (5:8), the two guide-tone lines chromatic on V1 (d4 c#4 c4 b3 c4) and V2
 *          (g#3 g3 f#3 f3 e3). NON-DIATONIC 2: the chromatic mediant E major at 11:28,
 *          e stationary on V2 from 11:0, quitted to F at 12:0 and never to Am.
 *          Third colour, modal interchange, which counts as ONE and is neither of the
 *          two: the borrowed flat VII, B flat, at 6:28 and again at 17:14.
 *          SEQUENCES: descending fifths Am Dm G7 C at 3:0–3:55 and Em Am Dm G at
 *          18:0–18:55; a rising step sequence C Dm Em F at 13:0–13:55.
 *    §9.4  every section has its own kit and five change again inside the section, and no
 *          frame from 13 to 18 is kick/snare/closed-hat only — metal ticks at 13:41 and
 *          15:27, an open hat at 14:24, a crash and toms at 16:0 and 16:52, open hats at
 *          17:24 and 18:24. Eleven fills, no two alike, one at the end of every 8-bar
 *          unit; ghost snares at 4–6 against backbeats at 14–15, written RAW outside the
 *          mix lift; the one section with no kick at all is `hollow`; no fill on the seam.
 *    §5.2  SECOND LEAD COLOUR: the sawtooth takes M at pitch an octave below from 8:0 to
 *          9:55, eight bars, while pulse 1 drops to long answers. Pulse 1 itself also
 *          carries two duty envelopes — `step` (12.5 % opening to 50 %) and `step-open`
 *          (50 % narrowing to 12.5 %) — and they alternate by phrase, never by piece.
 *
 *  HEADROOM  measured, not guessed. See extra.qa.notes for the final numbers and for what
 *            was lowered to get there; the sawtooth was mixed down first, as §12.2 says.
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'crooked-mile',
  name: 'Crooked Mile',
  author: 'pulsar original',
  speed: 7,
  rowsPerPattern: 56,
  rowHighlight: 4,
  rowHighlight2: 14,
})

// =====================================================================================
// the bar — named once so no lane has to re-derive 2+2+3 from row numbers
// =====================================================================================
/** The seven eighths of a 7/8 bar. */
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12]
/** The heads of the three groups: two even steps and the long one. */
const HEADS = [0, 4, 8]
/** The crooked step: `rowHighlight` marks it, but it is INSIDE the long group. */
const CROOK = 12

// =====================================================================================
// harmony — C major, spelled as triads and sevenths so every accompaniment lane voices
// the same chord and no lane has to be told its notes twice
// =====================================================================================
const PC = { c: 0, 'c#': 1, d: 2, eb: 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, bb: 10, b: 11 }
const CHORD = {
  C: ['c', 'e', 'g'],
  Dm: ['d', 'f', 'a'],
  Dm7: ['d', 'f', 'a', 'c'],
  Em: ['e', 'g', 'b'],
  F: ['f', 'a', 'c'],
  G: ['g', 'b', 'd'],
  G7: ['g', 'b', 'd', 'f'],
  Am: ['a', 'c', 'e'],
  // the three applied dominants of `stile`, each raising one note by a semitone
  E7: ['e', 'g#', 'b', 'd'],
  A7: ['a', 'c#', 'e', 'g'],
  D7: ['d', 'f#', 'a', 'c'],
  // the chromatic mediant (`hollow`) and the borrowed flat VII (`broad`, `crest`)
  E: ['e', 'g#', 'b'],
  Bb: ['bb', 'd', 'f'],
}

/** The `i`-th voice of `chord` counting upward from MIDI `low` — so an accompaniment lane
 *  asks for "the third one up from here" and gets a note in its own register. */
function voice(chord, i, low) {
  const pcs = new Set((CHORD[chord] ?? []).map((x) => PC[x]))
  if (pcs.size === 0) throw new Error(`voice(): no chord "${chord}"`)
  let seen = 0
  for (let m = low; m < 120; m++) {
    if (!pcs.has(m % 12)) continue
    if (seen === i) return m
    seen++
  }
  throw new Error(`voice(${chord}, ${i}, ${low}): ran off the top`)
}

// =====================================================================================
// instruments — the melodic voices are piece-specific, so the lead has two colours and
// the clockwork has an envelope no other lane shares; the kit is the shared bank, because
// a drum that is the same drum across the album is worth more than a lead that is (§12.6)
// =====================================================================================
/** THE LEAD, colour one, and instrument 0 of this song — declared first and played from
 *  1:0, so the album gate that compares instrument 0's macros across every piece sees
 *  this piece's own voice and not a shared-bank drum. Staccato by construction: the body
 *  is ten ticks of a fourteen-tick eighth, so every note lets go before the next one, and
 *  the duty opens 12.5 -> 25 -> 50 % over the first three ticks, which is the springy
 *  front a walking tune needs. */
const STEP = s.instrument('step', {
  volume: { values: [14, 15, 15, 15, 14, 13, 11, 8, 4, 0] },
  duty: { values: [0, 1, 2], loop: 2 },
  pitch: { values: [0, 0, 0, 0, 0, 0, 1, 1, -1, -1, -1, -1, 1, 1], loop: 6 },
})
/** THE LEAD, colour two. STEP opens thin and fills out; this one opens at 50 % and
 *  narrows to 12.5 %, with a softer front and a longer body — a rounder singer of the
 *  same tune. The two alternate by PHRASE (`walk` bars 4–7 and 8–11 differ; `hollow` and
 *  `walk2`'s return are entirely this one), because one duty envelope for a whole piece
 *  is the reference document's static-instrumentation failure. */
const STEP_OPEN = s.instrument('step-open', {
  volume: { values: [12, 15, 15, 15, 15, 14, 14, 13, 11, 8, 4, 0] },
  duty: { values: [2, 2, 1, 0], loop: 3 },
  pitch: { values: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, -1, -1, -1, -1, 1, 1], loop: 8 },
})
/** Pulse 2 as a VOICE (§9.2): quarter notes that hold, so the line reads as a line and
 *  not as a set of stabs. Duty 1 -> 0 keeps it behind the lead without a level drop. */
const COUNTER = s.instrument('counter', {
  volume: { values: [11, 14, 14, 13, 13, 13], loop: 5 },
  duty: { values: [1, 1, 0], loop: 2 },
})
/** Pulse 2's two-note answers in the long group: short, bright, gone before row 0. */
const ANSWER = s.instrument('answer', {
  volume: { values: [15, 14, 12, 9, 6, 3, 0] },
  duty: { values: [1, 0], loop: 1 },
})
/** THE CLOCKWORK — the 3-row cell's voice, and nothing else plays it. Five sounding ticks
 *  of a seven-tick row, so a dotted-eighth attack is over before the next one starts and
 *  the cell reads as a mechanism rather than a melody. VRC6 duty 3 (the bright 25 %)
 *  narrowing to 1 (the thin 12.5 %): a tick with a pitch. */
const CLOCK = s.instrument('clock', {
  volume: { values: [15, 14, 10, 5, 0] },
  duty: { values: [3, 3, 1], loop: 2 },
})
/** V1 as inner harmony and, in `crest`, as the lead's octave. The chip's own attack:
 *  duty 7 (the fat 50 %) narrowing to 3 over four ticks. */
const SHEEN = s.instrument('sheen', {
  volume: { values: [13, 15, 15, 15, 15, 15], loop: 5 },
  duty: { values: [7, 6, 5, 3], loop: 3 },
})
/** V2, the reed: quiet, sustaining, and it breathes rather than sits — 12.5 % with a
 *  slow open to 25 % so a held guide tone changes colour while it is held. */
const REED = s.instrument('reed', {
  volume: { values: [9, 12, 13, 13, 13, 12, 12, 13], loop: 4 },
  duty: { values: [1, 1, 1, 1, 3, 3, 3, 3], loop: 0 },
})
/** V2's chord stab, for `gate`'s triads and `crest`'s lift. Seven ticks: one row. */
const STAB = s.instrument('stab-v2', {
  volume: { values: [15, 15, 13, 10, 6, 2, 0] },
  duty: { values: [3, 2], loop: 1 },
})
/** The sawtooth as a WALKING TENOR — detached, and mixed down before anything else,
 *  because the saw's column is an accumulator rate and 15 here is about twice a pulse at
 *  15 (§12.2). Nothing in this piece writes the saw above 12. */
const SAW_STEP = s.instrument('saw-step', {
  volume: { values: [12, 11, 9, 6, 2, 0] },
})
/** The sawtooth as the SECOND LEAD (`walk2`, 8:0–9:55): a stepped bend-in whose values
 *  sum to zero — pitch macros ACCUMULATE — and a body that swells instead of decaying, so
 *  the saw sings the tune rather than plucking it. */
const SAW_LEAD = s.instrument('saw-lead', {
  volume: { values: [9, 12, 13, 13, 12, 12, 12], loop: 6 },
  pitch: { values: [3, -1, -1, -1, 0] },
})
/** The sawtooth sustaining under the broad hearing, kept low: 9 is already a loud lane. */
const SAW_HOLD = s.instrument('saw-hold', { volume: { values: [8, 10, 10], loop: 2 } })
/** The walking bass. The triangle has no volume, only a gate (§1), so its dynamics are
 *  register and rhythm: fourteen ticks is exactly two rows at speed 7, which makes an
 *  eighth-note bass that lets go on the sixteenth before the next eighth. */
const WALK_BASS = s.instrument('walk-bass', {
  volume: { values: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0] },
})
/** The noise RISER, for the fills that lift: the pitch macro drives the period index
 *  DOWN, and a lower index is a higher pitch (index = 47 − note), so this rises. It ends
 *  on 0 and never loops, or the lane would never release. */
const RISER = s.instrument('riser', {
  volume: { values: [4, 6, 8, 10, 12, 14, 15, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 40,
})
/** The noise FALLER, for the fills that land: the index climbs, so the pitch drops. */
const FALLER = s.instrument('faller', {
  volume: { values: [14, 12, 10, 8, 6, 4, 2, 0] },
  pitch: { values: [1, 1, 1, 1, 1, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 44,
})
// Shared bank, byte-identical to the fixture.
const [KICK, SNARE, HAT, OHAT, CRASH, METAL, RIM, TOM, TRI_HOLD, TRI_TAP] =
  s.bank('kick', 'snare', 'hat-closed', 'hat-open', 'crash', 'metal', 'rim', 'tom', 'bass', 'bass-short')
const KIT = s.dpcmKit() // kick 36, snare 39 — structural accents only; it ducks the
                        // triangle and the noise through the shared TND index, so it is
                        // spent on the head of the long group and on downbeats, nowhere else

// =====================================================================================
// writers — every lane goes through one of these, so a cell is never typed as coordinates
// =====================================================================================
/** The cancel the DRIVER honours for each channel mode of §12.5's table, not a zero
 *  param: `4x0` for vibrato, `7x0` with x > 0 for tremolo (a bare `700` REPLAYS the
 *  effect memory), `100` for a portamento (`300` only FREEZES it), `A00`, `P80`, `000`. */
const CANCEL = { porta: ['1', 0], slide: ['1', 0], arp: ['0', 0], vib: ['4', 0], trem: ['7', 0x10], vol: ['A', 0], pitch: ['P', 0x80] }

/** A melodic phrase as consecutive events `[rows, note, vol?, [cmd, param]?]` from
 *  `startRow`. `'-'` rests (a cut) and `'~'` extends the previous note. A bare event
 *  cancels whatever channel mode the lane still has latched, exactly as `line()` does; an
 *  event carrying its own effect does not, because that is how a gesture is sustained.
 *  Notes at least `vibMin` rows long get a `4xy` written `vibAfter` rows in — a chip note
 *  that starts straight and blooms sounds sung, where instant vibrato sounds synthetic —
 *  and the next event carries its `4x0`. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vol: defVol = 12, shift = 0, vib = 0, vibMin = 8, vibAfter = 4, cutAtEnd = true, gate = false } = opts
  const cancels = (row) => [...sec.latched(lane, row - 1).keys()].map((mode) => CANCEL[mode])
  const trim = lane === L.P1 ? LEAD_TRIM : 0
  const level = (v) => (gate ? 15 : lv(Math.max(1, Math.min(15, (v ?? defVol) + shift + trim))))
  let row = startRow
  for (const [len, note, vol, fx] of events) {
    if (note === '~') {
      row += len
      continue
    }
    const list = fx ? [fx] : cancels(row)
    const fields = note === '-' ? { note: CUT } : { note: n(note), inst, vol: level(vol) }
    if (list.length > 0) fields.fx = list
    sec.put(lane, row, fields)
    if (note !== '-' && vib > 0 && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    const list = cancels(row)
    sec.put(lane, row, list.length > 0 ? { note: CUT, fx: list } : { note: CUT })
  }
  return row
}

/** ONE BAR WRITTEN AS ITS SEVEN EIGHTH SLOTS — rows 0 2 4 6 8 10 12 — with `|` marking
 *  the 2+2+3 boundaries, so the source lines up with the metre and a bass line can be
 *  read as a rhythm instead of decoded from row numbers. A token is a note name, `.` for
 *  no attack, `-` for a cut, and a trailing `+` delays the attack by ONE ROW: a 16th
 *  push, which is how this bass syncopates against the groups without leaving the grid.
 *  The three group heads sound one column step above the eighths between them, which on
 *  the triangle is nothing (it is a gate) and on the saw is this lane's whole dynamic. */
function slotBar(sec, lane, bar, inst, vol, text, opts = {}) {
  const { gate = false, accent = 1 } = opts
  const tokens = text.split(/[\s|]+/).filter((t) => t.length > 0)
  if (tokens.length !== 7) throw new Error(`slotBar(${sec.name} bar ${bar}): ${tokens.length} slots, need 7`)
  tokens.forEach((tok, i) => {
    if (tok === '.') return
    const push = tok.endsWith('+')
    const name = push ? tok.slice(0, -1) : tok
    const at = sec.at(bar, EIGHTHS[i] + (push ? 1 : 0))
    if (name === '-') {
      sec.put(lane, at, { note: CUT })
      return
    }
    const head = HEADS.includes(EIGHTHS[i])
    sec.put(lane, at, { note: n(name), inst, vol: gate ? 15 : lv(vol + (head ? accent : 0)) })
  })
}

/** A whole section's worth of slot bars, one string per bar from `firstBar`. */
function slotLine(sec, lane, firstBar, inst, vol, bars, opts = {}) {
  bars.forEach((text, i) => {
    if (text !== null) slotBar(sec, lane, firstBar + i, inst, vol, text, opts)
  })
  return sec
}

/** THE 3-ROW CELL — the dotted-eighth engine, an attack every three rows on VRC6 pulse 1.
 *  It is written straight through the section's flat 168-row grid, so the phase carries
 *  itself across the frame boundaries: 56 = 18·3 + 2, so the attacks land at local rows
 *  0, 3 … 54 in the first frame, 1, 4 … 55 in the second and 2, 5 … 53 in the third, and
 *  the next attack after that falls exactly on the downbeat of the frame after — which is
 *  `stile`'s row 0, where V1 states it as the resolution.
 *
 *  The pitch comes from a FIVE-step walk through the bar's chord, so the melodic period
 *  (15 rows) disagrees with the cell (3), with the bar (14) and with the frame (56): no
 *  two of the four three-bar alignment cycles in this section are identical. An attack
 *  that happens to land on a group head sounds one column step louder, which is what
 *  makes the phasing audible — the accent moves around the bar as the cell walks. */
function cell3(sec, chordOfBar, opts = {}) {
  const { from = 0, to = sec.len, vol = 8, low = 62, steps = [0, 2, 1, 2, 3] } = opts
  let k = 0
  for (let r = from; r < to; r += 3, k++) {
    const chord = chordOfBar[Math.floor(r / sec.rowsPerBar)]
    const head = HEADS.includes(r % sec.rowsPerBar)
    sec.put(L.V1, r, { note: voice(chord, steps[k % steps.length], low), inst: CLOCK, vol: lv(vol + (head ? 2 : 0)) })
  }
  return sec
}

/** Closed hats on the rows given, skipping any cell the lane already holds — the noise
 *  lane is monophonic, so a kick or a snare on the same row wins. */
function hats(sec, bar, rows, opts = {}) {
  const { on = 8, off = 5, inst = HAT, note = 45 } = opts
  for (const r of rows) {
    const at = sec.at(bar, r)
    if (sec.lanes[L.NOISE][at] !== null) continue
    sec.put(L.NOISE, at, { note, inst, vol: lv(HEADS.includes(r) || r === CROOK ? on : off) })
  }
  return sec
}

/** THE WALKING KIT, one bar. The kick takes the heads of groups ONE and THREE — the two
 *  steps the walk leans on — and the snare takes the head of group TWO, so the backbeat
 *  never lands where a 4/4 ear reaches for it. Eighth hats between, and a ghost snare at
 *  vol 3–5 on the crooked row 13 pushing into the next downbeat. */
function kitWalk(sec, bar, opts = {}) {
  const { ghost: ghostRow = 13, open = false, kicks = [0, 8], snares = [4], hatRows = EIGHTHS, on = 8, off = 5, kickVol = 12, snareVol = 12 } = opts
  const GHOST = ghost(4)
  sec.hits(L.NOISE, KICK, lv(kickVol), kicks.map((r) => [bar, r]))
  sec.hits(L.NOISE, SNARE, lv(snareVol), snares.map((r) => [bar, r]))
  // `G01` — one tick, 16.7 ms at speed 7: the ghost sits behind the beat, which is feel
  // rather than a rhythmic event (§2.7's two-tick ceiling). The snare's 12-tick envelope
  // loses one tick of tail to it, which is inaudible.
  if (ghostRow !== null) sec.hits(L.NOISE, SNARE, GHOST, [[bar, ghostRow, 'G', 1]])
  if (open) sec.hits(L.NOISE, OHAT, lv(7), [[bar, 10]])
  hats(sec, bar, hatRows, { on, off })
  return sec
}

const range = (a, b, step = 1) => Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, i) => a + i * step)
/** ONE COLUMN STEP OF HEADROOM, applied to every written volume through `lv()`. The
 *  arrangement as first composed rendered at -22.02 dBFS over two passes — two full dB
 *  under gate C's -20 floor — because a walking piece in 7/8 spends most of itself in five
 *  or six lanes at moderate levels and leaves the long group deliberately empty. Lifting
 *  the PARTS is the fix; re-gaining the render is not one (§2.8, gate C's own rule). The
 *  sawtooth is excluded from the benefit in the one place it would have exceeded 12.
 */
const LIFT = 3
/** The lead is the one lane the lift would FLATTEN. Its written columns already span
 *  10–15, so +3 clamps four fifths of them to 15 and the phrase arc — approach notes at
 *  11–12, the peak at 15, the resolution at 13 — is gone, which is the reference
 *  document's "no dynamics" exactly. Pulse 1 is therefore written two steps lower and
 *  lands at 11–15 with all six of its distinct values intact. Measured: 81 % of the
 *  lead's attacks sat at 15 without this, 11 % with it. */
const LEAD_TRIM = -2
/** A written volume, lifted and clamped. `lv(15)` is still 15, so the triangle's gate and
 *  the DPCM lane (whose column the engine ignores entirely) are untouched by it. */
const lv = (v) => Math.max(1, Math.min(15, v + LIFT))
/** A GHOST is written raw, OUTSIDE the lift. The lift is a mix correction for the whole
 *  arrangement, and applying it to the ghost layer compressed the very thing that layer is
 *  for: under `lv()` the ghosts sat at 7–8 beneath backbeats at 15, which is not a ghost,
 *  it is a quiet snare. §9.4 asks for 3–6 and that is what these write, so the distance
 *  between a ghost and the hit it decorates is a factor of three rather than of two. */
const ghost = (v) => Math.max(1, Math.min(15, v))

/** The album's medium singing vibrato, written a beat after the note (§2.5). */
const VIB = nib(4, 2)

// =====================================================================================
// M — THE SUBJECT, two bars. A foot, a rising fifth, then the walk back down; the long
// group opens with a quarter and closes with one eighth on the crooked row 12. The second
// bar has four attacks where the first has six and holds the long group whole, so the
// motif contains its own breath and pulse 2 has somewhere to answer.
// =====================================================================================
const M = [
  [2, 'c5', 13], [2, 'g5', 14], [2, 'f5', 13], [2, 'e5', 12], [4, 'd5', 13], [2, 'e5', 12],
  [2, 'g5', 13], [2, 'f5', 12], [4, 'e5', 13], [6, 'c5', 12],
]
/** M's first bar alone — the head, the unit every later section sequences. */
const HEAD = M.slice(0, 6)
/** M an octave down, for the sawtooth's eight bars as the second lead. */
const octaveDown = (events) => events.map(([len, note, vol]) => [len, note === '-' || note === '~' ? note : n(note) - 12, vol])
/** M in AUGMENTATION: every value twice as long, so two 7/8 bars become one 7/4 bar and
 *  one. `broad` plays this, which is why its regrouping is the tune and not a trick. */
const augment = (events) => events.map(([len, note, vol]) => [len * 2, note, vol])

// =====================================================================================
// gate — frame 0. The limp, stated bare and then dressed. The triangle takes the three
// group heads alone for a whole bar with NO kit at all, which is the only way to make a
// listener count 2+2+3 before anything distracts them; the hats join on the heads, the
// crooked row 12 appears in bar 1, and V2 spells C major as `0xy` triads. That arpeggio
// bed is the ONLY one in the piece: the guide is explicit that an arp bed is dropped once
// the harmony is established, so it is cancelled at 0:48 and never returns.
// Harmony: C · C · F · G — a half cadence into the tune.
// =====================================================================================
const GATE_CHORDS = ['C', 'C', 'F', 'G']
const gate = s.section('gate', 4)
{
  // TRI  the metre itself: an attack on each group head, the crooked row 12 added in bar
  // 1, and a leading tone b2 at the end of bar 3 that steps up into the tune's c3.
  slotLine(gate, L.TRI, 0, WALK_BASS, 15, [
    'c2  .  | g2  .  | e2  .  .',
    'c2  .  | g2  .  | e2  .  f2',
    'f2  .  | c3  .  | a2  .  g2',
    'g2  .  | b2  .  | d3  .  b2',
  ], { gate: true })
  // V1  doubles the heads an octave up from bar 2 at the chip's fat 50 %, so the group
  // heads gain weight exactly as the kit arrives. Four attacks; the clockwork proper is
  // still holding its breath.
  slotLine(gate, L.V1, 2, SHEEN, 9, [
    'f3  .  | c4  .  | a3  .  .',
    'g3  .  | b3  .  | d4  .  .',
  ])
  // V2  C major as `0xy` triads, one a bar, root position (047 = 71) and, in bar 3, the
  // dominant (also 047 on g). The `000` on 0:48 is the cancel the driver honours, and it
  // is the last arpeggio in the piece.
  gate.chord(L.V2, STAB, 8, 0, 0, 'c3', [4, 7])
  gate.chord(L.V2, STAB, 8, 1, 0, 'c3', [4, 7])
  gate.chord(L.V2, STAB, 9, 1, 8, 'c3', [4, 7])
  gate.chord(L.V2, STAB, 8, 2, 0, 'f3', [4, 7])
  gate.chord(L.V2, STAB, 9, 2, 8, 'f3', [4, 7])
  gate.chord(L.V2, STAB, 9, 3, 0, 'g3', [4, 7])
  gate.put(L.V2, gate.at(3, 8), { note: CUT, fx: [CANCEL.arp] })
  // SAW  four notes, and only four: a rising pickup in the last bar's long group that
  // hands the downbeat to pulse 1. Volume 9 — the saw's column is an accumulator rate and
  // 15 here is about twice a pulse at 15 (§12.2), so this lane is mixed down first.
  phrase(gate, L.SAW, SAW_STEP, gate.at(3, 6), [[2, 'd3', 8], [2, 'e3', 9], [2, 'f3', 9], [2, 'g3', 10]], { cutAtEnd: false })
  // NOISE  bar 0 silent — the bass has to be alone for the metre to land. Bar 1 hats on
  // the three heads only; bar 2 eighth hats and the first kick; bar 3 the full walking
  // kit and FILL 1, two toms tumbling through the long group into a high snare.
  hats(gate, 1, HEADS, { on: 6, off: 5 })
  kitWalk(gate, 2, { ghost: null, on: 7, off: 5, kickVol: 11, snareVol: 11 })
  kitWalk(gate, 3, { ghost: null, hatRows: [0, 2, 4, 6], on: 8, off: 5 })
  gate.hits(L.NOISE, TOM, lv(12), [[3, 8]], 37)
  gate.hits(L.NOISE, TOM, lv(12), [[3, 10]], 43)
  gate.hits(L.NOISE, SNARE, ghost(6), [[3, 11]])
  gate.hits(L.NOISE, SNARE, lv(13), [[3, 12]], 41)
  // DPCM  silent here, and explicitly so: a sample holds the DAC where it left it (§1),
  // so every section states this lane rather than inheriting it.
  gate.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// walk — frames 1–3, and THE LOOP TARGET. The tune, and the clockwork under it.
//
// M states itself (bars 0–1) and sequences its head up a step (bar 2); the second phrase
// (bars 4–7) is the same material on the lead's OTHER duty envelope, rhythm cells rebuilt
// so the long group is a quarter-plus-two rather than a quarter-plus-one; the third
// (bars 8–11) is a descending melodic sequence over a descending-fifths harmony, closing
// with the melody rising c5–e5–g5 while the bass falls d3–c3 — contrary motion at the
// cadence. Every phrase ends in a rest, which is what gives pulse 2 somewhere to speak.
//
// Harmony, one chord per bar: C F Dm G · C F G Em · Am Dm G7 C. No four-chord group is
// repeated, and the last four are a descending-fifths chain that arrives.
// =====================================================================================
const WALK_CHORDS = ['C', 'F', 'Dm', 'G', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G7', 'C']
const walk = s.section('walk', 12)
{
  // P1  phrase 1 on STEP (12.5 % opening to 50 %). M, then its head a step up: the a5 at
  // 1:4 is this section's one peak and it lands on a group head, approached by step and
  // quitted by step — an appoggiatura over Dm resolving down to g5.
  phrase(walk, L.P1, STEP, 0, [
    ...M,
    [2, 'd5', 12], [2, 'e5', 12], [2, 'a5', 15], [2, 'g5', 13], [4, 'f5', 12], [2, 'e5', 12], // bar 2, Dm
    [2, 'g5', 12], [2, 'f5', 12], [4, 'd5', 12], [6, '-'],                                    // bar 3, G — the breath
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // P1  phrase 2 on STEP_OPEN (50 % narrowing to 12.5 %) — the same walk, a different
  // singer. The long group is now a quarter and two eighths, so the hitch moves.
  phrase(walk, L.P1, STEP_OPEN, walk.at(4), [
    [4, 'e5', 12], [4, 'g5', 13], [2, 'f5', 12], [2, 'e5', 11], [2, 'd5', 11],  // bar 4, C
    [4, 'f5', 12], [4, 'g5', 13], [2, 'f5', 12], [2, 'e5', 11], [2, 'c5', 11],  // bar 5, F
    [2, 'd5', 12], [4, 'g5', 13], [2, 'f5', 12], [4, 'd5', 12], [2, 'b4', 11],  // bar 6, G — attacks across the group line
    [2, 'e5', 12], [2, 'd5', 11], [4, 'b4', 12], [6, '-'],                      // bar 7, Em — the breath
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // P1  phrase 3 back on STEP: three bars of the same rhythm falling a step each time,
  // which is the melodic half of the descending-fifths sequence under it, then the
  // cadence — the melody rises while the bass falls.
  phrase(walk, L.P1, STEP, walk.at(8), [
    [2, 'a4', 11], [2, 'e5', 12], [2, 'd5', 12], [2, 'c5', 11], [4, 'b4', 12], [2, 'c5', 11], // bar 8, Am
    [2, 'd5', 12], [2, 'f5', 13], [2, 'e5', 12], [2, 'd5', 11], [4, 'c5', 12], [2, 'd5', 11], // bar 9, Dm
    [2, 'e5', 12], [2, 'd5', 12], [2, 'c5', 11], [2, 'b4', 11], [4, 'a4', 12], [2, 'b4', 11], // bar 10, G7
    [2, 'c5', 13], [2, 'e5', 13], [8, 'g5', 14], [2, '-'],                                     // bar 11, C — the arrival
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // V1  THE 3-ROW CELL, 56 attacks, unbroken from 1:0 to 3:53. It enters 1:0, 2:1, 3:2 —
  // `(−56k) mod 3`, computed at the head of this file and not guessed — and the attack
  // after its last one falls exactly on `stile`'s downbeat, where V1 states it.
  cell3(walk, WALK_CHORDS, { vol: lv(7), low: 59 })
  // TRI  the walk. Bars 0–3 take the heads and the crooked row 12; bars 4–7 fill in the
  // eighths and descend a whole octave by step; bars 8–11 push two attacks a sixteenth
  // late (`+`) so the bass limps against the very groups it is stating. Chromatic
  // approaches into every change the scale does not already step into: c#3 into Dm at
  // 1:41, f#2 into G at 2:13 and 3:23.
  slotLine(walk, L.TRI, 0, WALK_BASS, 15, [
    'c3  .  | g2  .  | e2  .  f2',    // C   -> F
    'f2  .  | a2  .  | c3  .  c#3',   // F   -> Dm, chromatic
    'd3  .  | a2  .  | f2  .  f#2',   // Dm  -> G,  chromatic
    'g2  .  | d3  .  | g2  .  b2',    // G   -> C
    'c3  b2 | a2  g2 | e2  .  f2',    // C   -> F, the octave descent begins
    'f2  g2 | a2  .  | c3+ .  b2',    // F   -> G/B, the first sixteenth push
    'b2  .  | a2  .  | g2  .  f#2',   // G   -> Em, chromatic
    'e2  .  | b2  .  | g2  .  a2',    // Em  -> Am
    'a2  b2 | c3  .  | e3  .  c#3',   // Am  -> Dm, chromatic
    'd3  .  | a2  .  | f2+ .  f#2',   // Dm  -> G7, chromatic, pushed
    'g2  a2 | b2  .  | d3  .  d3',    // G7
    'c3  .  | g2  .  | e2  .  g2',    // C   — the bass falls d3 -> c3 as the tune rises
  ], { gate: true })
  // V2  the harmonic floor: one held guide tone a bar for the first phrase, then two —
  // the second on the head of the long group, so the inner voice limps too. The line is
  // written for its own sake: e3 f3 a3 b3 c4 … and G7's f3 falling to C's e3 at the end.
  phrase(walk, L.V2, REED, 0, [
    [14, 'e3', 9], [14, 'f3', 9], [14, 'a3', 9], [14, 'b3', 9],
    [8, 'c4', 9], [6, 'g3', 8], [8, 'a3', 9], [6, 'c4', 8],
    [8, 'b3', 9], [6, 'a3', 8], [8, 'g3', 9], [6, 'b3', 8],
    [8, 'a3', 9], [6, 'c4', 8], [8, 'a3', 9], [6, 'f3', 8],
    [8, 'f3', 10], [6, 'b3', 9], [8, 'c4', 9], [6, 'e3', 8],
  ])
  // P2  the default posture the metre hands you for free: pulse 1 asks across the 2+2 and
  // pulse 2 answers inside the 3. Two notes, rows 10 and 12, and only where the lead has
  // stopped. It rests for the whole second phrase — a lane that stops is mix — and
  // returns in the third rising against the lead's descent.
  for (const [bar, a, b] of [[0, 'g4', 'e4'], [1, 'a4', 'f4'], [2, 'f4', 'd4'], [3, 'd4', 'b3']]) {
    walk.put(L.P2, walk.at(bar, 10), { note: n(a), inst: ANSWER, vol: lv(9) })
    walk.put(L.P2, walk.at(bar, 12), { note: n(b), inst: ANSWER, vol: lv(8), fx: [['G', 1]] })
  }
  for (const [bar, a, b] of [[8, 'e4', 'c4'], [9, 'd4', 'f4'], [10, 'f4', 'd4'], [11, 'e4', 'g4']]) {
    walk.put(L.P2, walk.at(bar, 8), { note: n(a), inst: ANSWER, vol: lv(9) })
    walk.put(L.P2, walk.at(bar, 12), { note: n(b), inst: ANSWER, vol: lv(9), fx: [['G', 1]] })
  }
  // SAW  silent for four bars — and it says so, because `gate`'s pickup is still ringing
  // and the loop row must not inherit it (§2.9 rule 2). Then it takes the LONG GROUP and
  // nothing else (bars 4–7):
  // the extra step gets its own colour. From bar 8 it moves to the heads and doubles the
  // triangle a tenth above at the cadence.
  walk.put(L.SAW, 0, { note: CUT })
  walk.put(L.P2, 0, { note: CUT })
  slotLine(walk, L.SAW, 4, SAW_STEP, 9, [
    '.   .  | .   .  | c4  b3 g3',
    '.   .  | .   .  | c4  a3 f3',
    '.   .  | .   .  | b3  a3 g3',
    '.   .  | .   .  | b3  g3 e3',
    'a3  .  | c4  .  | e4  .  c4',
    'd4  .  | a3  .  | f4  .  d4',
    'g3  .  | b3  .  | d4  .  f4',
    'c4  .  | g3  .  | e4  .  c4',
  ])
  // NOISE  the walking kit: the kick on the heads of groups ONE and THREE — the two steps
  // the walk leans on — the snare on the head of group TWO, so the backbeat never lands
  // where a 4/4 ear reaches for it, eighth hats, and a ghost at vol 4 on the crooked row
  // 13. Bars 4–7 change two things (a third kick on row 6, an open hat on row 10); bars
  // 8–11 change two more (the hats thin to the heads and the long group, the ghost moves
  // to row 11) so the saw and the cadence can be heard. FILL 2 at bar 7, a noise riser
  // through the long group; FILL 3 at bar 11, toms falling into a rim.
  for (const bar of range(0, 3)) kitWalk(walk, bar)
  kitWalk(walk, 3, { ghost: 11 })
  walk.hits(L.NOISE, RIM, ghost(6), [[3, 13]])
  for (const bar of [4, 5, 6]) kitWalk(walk, bar, { kicks: [0, 6, 8], open: bar % 2 === 0, hatRows: [0, 2, 4, 8, 12] })
  kitWalk(walk, 7, { kicks: [0, 6], ghost: null, hatRows: [0, 2, 4] })
  walk.hits(L.NOISE, RISER, lv(10), [[7, 8], [7, 10]], 40)
  walk.hits(L.NOISE, SNARE, lv(13), [[7, 12]], 41)
  for (const bar of [8, 9, 10]) kitWalk(walk, bar, { ghost: 11, hatRows: [0, 4, 8, 10, 12], on: 7, off: 5 })
  kitWalk(walk, 11, { ghost: null, hatRows: [0, 4], snares: [4] })
  walk.hits(L.NOISE, TOM, lv(12), [[11, 8]], 43)
  walk.hits(L.NOISE, TOM, lv(12), [[11, 10]], 37)
  walk.hits(L.NOISE, RIM, lv(10), [[11, 12]])
  walk.hits(L.NOISE, RIM, ghost(5), [[11, 13]])
  walk.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// stile — frames 4–5. The section whose HARMONIC RHYTHM differs: two chords a bar,
// changing at rows 0 and 8 — the head of the long group — where the rest of the piece
// holds one chord a bar or one for two. Every other section is built on that contrast.
//
// Inside it, the piece's first non-diatonic device: CHAINED SECONDARIES, four applied
// dominants that arrive. E7 (4:36) -> A7 (4:42) -> D7 (4:50) -> G7 (5:0) -> C (5:8). Each
// link raises one note by a semitone and the raised tone is always in an INNER voice, so
// the tune stays singable and diatonic throughout. The chain is voiced as the two lines a
// dominant seventh actually has: V1 takes d4 c#4 c4 b3 c4 (the sevenths falling into the
// next chord's third) and V2 takes g#3 g3 f#3 f3 e3 (five chromatic links), the pair a
// tritone apart and resolving by contrary step at every change. The bass doubles E7's own
// raised third as a chromatic approach at 4:38.
//
// And pulse 2 is a VOICE here for the whole section (§9.2): a 4-ROW CELL against a 7-row
// bar, so it lands on the three group heads in even bars and between them in odd ones,
// realigning every two bars. 28 attacks, its own contour, and at the cadence (5:8) it
// falls e4 while pulse 1 rises b4-d5-e5.
// =====================================================================================
/** Two chords a bar: the first from row 0, the second from row 8. */
const STILE_CHORDS = [
  ['C', 'Am'], ['Dm', 'G'], ['C', 'E7'], ['A7', 'D7'],
  ['G7', 'C'], ['F', 'Dm'], ['G', 'G7'], ['C', 'G'],
]
const stile = s.section('stile', 8)
{
  // P1  long notes over the changes, because the harmony is what is moving. Two written
  // suspensions: d5 held from 4:4 across the change to Am and resolved down to c5 at
  // 4:12, under an `A20` fade so the held note thins rather than sits; and the cadential
  // one at 5:40, G7's seventh f5 held to the barline and resolving down to e5 at 5:42.
  phrase(stile, L.P1, STEP_OPEN, 0, [
    [4, 'e5', 12], [8, 'd5', 13], [2, 'c5', 12],                                 // bar 0, C / Am
    [4, 'f5', 12], [4, 'e5', 12], [4, 'g5', 13], [2, 'f5', 12],                  // bar 1, Dm / G
    [4, 'e5', 12], [4, 'g5', 13], [6, 'e5', 12],                                 // bar 2, C / E7 — e5 the common tone
    [4, 'a5', 15], [4, 'g5', 13], [4, 'a5', 14], [2, 'c5', 12],                  // bar 3, A7 / D7 — the peak
    [4, 'b4', 12], [4, 'd5', 13], [6, 'e5', 13],                                 // bar 4, G7 / C — the arrival
    [2, 'f5', 12], [2, 'e5', 12], [4, 'd5', 12], [4, 'f5', 12], [2, 'e5', 11],   // bar 5, F / Dm
    [4, 'd5', 12], [4, 'b4', 11], [4, 'd5', 12], [2, 'f5', 12],                  // bar 6, G / G7 — the seventh
    [4, 'e5', 12], [4, 'c5', 12], [2, 'd5', 11], [4, '-'],                       // bar 7, C / G — the breath
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // `A20` (param 32) is a FADE, not a swell — `Axy` is inverted here (§1) — written four
  // rows into the suspension so the held note gives way to the chord change under it. The
  // next bare event on the lane carries its `A00`.
  stile.put(L.P1, stile.at(0, 8), { fx: [['A', 0x20]] })
  // ...and its `A00` on the resolution, BY HAND. `phrase()` cancels whatever the lane has
  // latched when it runs, and this fade is written after it, so the helper never sees it:
  // gate B2 caught twelve later notes sounding under a volume slide they never asked for.
  // BOTH cancels on that row, not one: `put()` replaces a cell's whole effect list, so
  // writing the `A00` here alone deleted the `400` the phrase had already put there and
  // left the vibrato latched from 4:7 through 4:42 — nine notes wobbling that nothing
  // asked to wobble. A cell holds four effects; this one needs two.
  stile.put(L.P1, stile.at(0, 12), { fx: [['4', 0], ['A', 0]] })
  // P2  THE 4-ROW CELL, 28 attacks from 4:0 to 5:52, its own line: g4 e4 a4 g4 f4 d4 …
  // It never shares a rhythm with pulse 1 (which attacks on 0, 4, 8 and 12 of some bars
  // and 0, 2, 4, 8, 12 of others), it stays under pulse 1 throughout, and it falls at the
  // cadence while the lead rises.
  const Q_LINE = [
    'g4', 'e4', 'a4', 'g4', 'f4', 'd4', 'd4',   // bars 0–1: C / Am / Dm / G
    'e4', 'g4', 'b4', 'e4', 'e4', 'g4', 'a4',   // bars 2–3: C / E7 / A7 / D7
    'b4', 'g4', 'e4', 'c4', 'f4', 'a4', 'g4',   // bars 4–5: G7 / C / F / Dm — the cadence falls
    'f4', 'd4', 'f4', 'd4', 'e4', 'g4', 'd4',   // bars 6–7: G / G7 / C / G
  ]
  Q_LINE.forEach((note, i) => {
    const at = i * 4
    const head = HEADS.includes(at % stile.rowsPerBar)
    // the cadence (4:56–4:68) is the line's loudest moment and the only place it reaches 11
    const vol = lv((at >= 56 && at <= 68 ? 10 : 9) + (head ? 1 : 0))
    stile.put(L.P2, at, { note: n(note), inst: COUNTER, vol })
  })
  stile.put(L.P2, stile.len - 1, { note: CUT })
  // V1  the last dotted-eighth of `walk`'s 3-row cell lands here, on 4:0 — the phase
  // resolving onto a downbeat after three frames — and then V1 becomes the chain's upper
  // guide-tone line: d4 (E7's 7th) c#4 (A7's raised 3rd) c4 (D7's 7th) b3 (G7's 3rd) c4.
  stile.put(L.V1, 0, { note: n('c4'), inst: CLOCK, vol: lv(10) })
  phrase(stile, L.V1, SHEEN, stile.at(0, 8), [
    [6, 'c4', 9],                             // Am
    [8, 'd4', 9], [6, 'b3', 9],               // bar 1: Dm / G
    [8, 'c4', 9], [6, 'd4', 10],              // bar 2: C / E7 — the seventh
    [8, 'c#4', 11], [6, 'c4', 10],            // bar 3: A7 raised third / D7 seventh
    [8, 'b3', 10], [6, 'c4', 9],              // bar 4: G7 third / C — the chain lands
    [8, 'a3', 9], [6, 'a3', 8],               // bar 5: F / Dm
    [8, 'b3', 9], [6, 'd4', 9],               // bar 6: G / G7
    [8, 'c4', 9], [6, 'b3', 8],               // bar 7: C / G
  ])
  // V2  the chain's lower line, five chromatic links: g#3 (E7's raised third) g3 (A7's
  // seventh) f#3 (D7's raised third) f3 (G7's seventh) e3 (C's third). Against V1 above it
  // the pair is the dominant's tritone, resolving outward and inward at every link.
  phrase(stile, L.V2, REED, 0, [
    [8, 'e3', 9], [6, 'e3', 8],               // bar 0: C / Am — e is common to both
    [8, 'f3', 9], [6, 'd3', 8],               // bar 1: Dm / G
    [8, 'e3', 9], [6, 'g#3', 11],             // bar 2: C / E7 — THE RAISED THIRD
    [8, 'g3', 10], [6, 'f#3', 11],            // bar 3: A7 seventh / D7 RAISED THIRD
    [8, 'f3', 10], [6, 'e3', 9],              // bar 4: G7 seventh / C third — the resolution
    [8, 'f3', 9], [6, 'a3', 8],               // bar 5: F / Dm
    [8, 'g3', 9], [6, 'f3', 9],               // bar 6: G / G7
    [8, 'e3', 9], [6, 'd3', 8],               // bar 7: C / G
  ])
  // TRI  two roots a bar, following the doubled harmonic rhythm rather than fighting it,
  // with the long group filled in from bar 4 so the bass gets busier as the chain arrives.
  // g#2 at 4:38 is the chromatic approach into A7 and E7's own raised third in the bass.
  slotLine(stile, L.TRI, 0, WALK_BASS, 15, [
    'c3  .  | .   .  | a2  .  c#3',   // C / Am   -> Dm, chromatic
    'd3  .  | .   .  | g2  .  b2',    // Dm / G   -> C
    'c3  .  | .   .  | e2  .  g#2',   // C / E7   -> A7, chromatic
    'a2  .  | .   .  | d3  .  a2',    // A7 / D7  -> G7
    'g2  .  | .   .  | c3  b2 g2',    // G7 / C
    'f2  .  | .   .  | d3  c3 a2',    // F / Dm
    'g2  .  | .   .  | f2  e2 b2',    // G / G7   -> C, leading tone
    'c3  .  | .   .  | g2  a2 b2',    // C / G    -> broad
  ], { gate: true })
  // SAW  the second eighth of every group — rows 2, 6 and 10 — which is a rhythmic
  // position no other lane in this section touches. Diatonic throughout: the raised tones
  // belong to the inner pulses, not to a lane this loud.
  slotLine(stile, L.SAW, 0, SAW_STEP, 8, [
    '.   g3 | .   e4 | .   a3 .',
    '.   a3 | .   d4 | .   b3 .',
    '.   g3 | .   e4 | .   b3 .',
    '.   a3 | .   e4 | .   a3 .',
    '.   b3 | .   f4 | .   e4 .',
    '.   a3 | .   c4 | .   f4 .',
    '.   b3 | .   d4 | .   f4 .',
    '.   g3 | .   e4 | .   d4 .',
  ])
  // NOISE  a different kit: the kick moves to rows 0 and 6 (so it pushes into the long
  // group instead of landing on it), the snare takes rows 4 and 10, the hats thin to three
  // a bar, and a short-mode metal tick answers on row 13. FILL 4 at bar 7 — an open hat
  // and two snares climbing into `broad`, which is nothing like fills 1, 2 or 3.
  for (const bar of range(0, 7)) {
    stile.hits(L.NOISE, KICK, lv(12), [[bar, 0], [bar, 6]])
    stile.hits(L.NOISE, SNARE, lv(11), [[bar, 4]])
    stile.hits(L.NOISE, SNARE, bar % 2 === 0 ? 9 : 5, [[bar, 10]])
    stile.hits(L.NOISE, METAL, lv(7), [[bar, 13]])
    hats(stile, bar, [2, 8, 12], { on: 7, off: 5 })
  }
  stile.hits(L.NOISE, KICK, lv(12), [[7, 0]])
  stile.hits(L.NOISE, SNARE, lv(10), [[7, 4]])
  stile.hits(L.NOISE, OHAT, lv(8), [[7, 6]])
  stile.hits(L.NOISE, SNARE, lv(12), [[7, 8]], 41)
  stile.hits(L.NOISE, SNARE, lv(13), [[7, 10]], 41)
  stile.hits(L.NOISE, METAL, lv(9), [[7, 12]])
  // DPCM  the head of the long group, every bar, and nowhere else in this section: the
  // sample's weight marks the step the metre is named for, and the duck it puts on the
  // triangle and the noise through the shared TND index lands where the bass is already
  // being restruck, so it reads as the groove rather than as a hole.
  stile.put(L.DPCM, 0, { note: CUT })
  stile.hits(L.DPCM, KIT.inst, 15, range(0, 8).map((bar) => [bar, 8]), KIT.snare)
}

// =====================================================================================
// broad — frames 6–7. THE 7/4 REGROUPING, and the piece's release valve. Nothing about
// the grid changes: the same 56-row frame is simply heard as TWO BARS OF 7/4, 28 rows
// each, accented every four rows — rows 0 4 8 12 16 20 24 — instead of every two. The kit
// is what makes the re-hearing legible: an event on every one of the seven quarters and
// NOTHING between them, the kick on quarters 1 and 4, the snare on 3 and 6, hats on the
// rest. V1 states the same seven quarters as a rising-falling arch, and the bass moves
// once every two quarters, which is half-time by any hearing.
//
// It is the tune that authorises it: pulse 1 plays M IN AUGMENTATION, every value doubled,
// so M's two 7/8 bars become one 7/4 bar and one. The broad hearing IS the subject, slowed
// — which is why this section is structure and not a trick. One note is changed: M's e5
// becomes d5 over the flat VII, where e would be a tritone from the root.
//
// Harmony, one chord per 7/4 bar: C · B flat · F · G. The B flat is the borrowed flat VII
// — MODAL INTERCHANGE, which the brief counts as ONE device and which is therefore neither
// of the piece's two; it is here because a broad half-time bar wants a chord from outside
// the key, and it returns at the plagal close of `crest`.
// =====================================================================================
const broad = s.section('broad', 8)
{
  const SEVEN = [0, 4, 8, 12, 16, 20, 24] // the quarters of a 28-row 7/4 bar
  // P1  M in augmentation: attacks at 0 4 8 12 16 24 of the first 7/4 bar and 0 4 8 16 of
  // the second, so the augmented subject states the quarter grid itself. The a5 at 7:0 is
  // this section's one peak.
  phrase(broad, L.P1, STEP, 0, [
    [4, 'c5', 12], [4, 'g5', 13], [4, 'f5', 12], [4, 'e5', 12], [8, 'd5', 13], [4, 'e5', 12], // 7/4 bar 1, C
    [4, 'g5', 13], [4, 'f5', 12], [8, 'd5', 12], [12, 'c5', 12],                              // 7/4 bar 2, B flat
    [4, 'a5', 14], [4, 'g5', 13], [4, 'f5', 12], [8, 'e5', 12], [8, 'f5', 12],                // 7/4 bar 3, F
    [4, 'g5', 13], [4, 'f5', 12], [4, 'e5', 12], [4, 'd5', 12], [12, 'b4', 12],               // 7/4 bar 4, G
  ], { vib: VIB, vibMin: 8, vibAfter: 4 })
  // V2  ONE HELD COMMON TONE: c4 sounds unbroken from 6:0 to 7:27 — the root of C, the
  // ninth of the B flat, the fifth of the F — and only moves when the harmony reaches G,
  // where it steps down to b3. A `732` tremolo four rows in makes the held note breathe
  // rather than sit; `7xy` only subtracts, so the column is written two steps high to
  // compensate, and the next bare event carries its `710` — never a bare `700`, which
  // replays the effect memory instead of cancelling it.
  phrase(broad, L.V2, REED, 0, [[84, 'c4', 10], [28, 'b3', 9]])
  broad.put(L.V2, 8, { fx: [['7', nib(3, 2)]] })
  // The `710` goes on the note that ends the held tone, by hand and for the same reason:
  // a bare `700` would REPLAY the last tremolo depth instead of cancelling it.
  broad.put(L.V2, 84, { fx: [['7', 0x10]] })
  // V1  the seven quarters, as a rising-falling arch through the chord: seven attacks a
  // 7/4 bar, which is what a listener counts the regrouping by. The same 4-row cell that
  // phased against the 7/8 bar in `stile` here AGREES with the bar — 28 divides by 4 — and
  // that is the whole contrast between the two sections.
  ;[['C', 60], ['Bb', 58], ['F', 57], ['G', 59]].forEach(([chord, low], b) => {
    ;[0, 1, 2, 3, 2, 1, 0].forEach((step, q) => {
      broad.put(L.V1, b * 28 + SEVEN[q], { note: voice(chord, step, low), inst: SHEEN, vol: lv(q === 0 ? 8 : 6) })
    })
  })
  broad.put(L.V1, broad.len - 1, { note: CUT })
  // TRI  half-time: one note every two quarters, legato on the sustaining bank bass, so
  // the floor moves four times where it moved five or six times a bar before.
  ;[['c2', 'g2', 'e2', 'g2'], ['bb1', 'f2', 'd2', 'f2'], ['f2', 'c3', 'a2', 'c3'], ['g2', 'd3', 'b2', 'd3']]
    .forEach((notes, b) => notes.forEach((note, i) => {
      broad.put(L.TRI, b * 28 + i * 8, { note: n(note), inst: TRI_HOLD, vol: lv(15) })
    }))
  broad.put(L.TRI, broad.len - 1, { note: CUT })
  // SAW  silent for the first two 7/4 bars — fourteen seconds of the loudest lane not
  // playing is this piece's widest dynamic — then two sustained tenor notes a bar.
  broad.put(L.SAW, 0, { note: CUT })
  // The whole of `broad` sits under the sections either side of it, and the second half of
  // it too: pulse 2's sixths alone moved frame 7 by 0.28 dB, which is not a release, so the
  // quarter arch and the entering saw come down with them.
  phrase(broad, L.SAW, SAW_HOLD, 56, [[14, 'a3', 6], [14, 'c4', 6], [14, 'b3', 6], [14, 'd4', 6]])
  // P2  four bars of PARALLEL DIATONIC SIXTHS under the augmented tune, and the only
  // parallel writing in the piece: §9.2 allows it once the two voices have been
  // demonstrably independent for eight bars, which is exactly what `stile` was, and for no
  // more than four bars, which is exactly this. It is the lift into the second half.
  broad.put(L.P2, 0, { note: CUT })
  ;[[56, 'c5'], [60, 'b4'], [64, 'a4'], [68, 'g4'], [76, 'a4'],
    [84, 'b4'], [88, 'a4'], [92, 'g4'], [96, 'f4'], [100, 'd4']].forEach(([row, note]) => {
    broad.put(L.P2, row, { note: n(note), inst: COUNTER, vol: lv(6) })
  })
  broad.put(L.P2, broad.len - 1, { note: CUT })
  // NOISE  the quarter grid, and nothing off it: an event on each of the seven quarters,
  // the kick on 1 and 4, the snare on 3 and 6, closed hats on 2, 5 and 7 with the last one
  // open. Two parameters changed from `stile` and four from `walk`. FILL 5 fills the last
  // 7/4 bar's second half with broad toms — the slowest fill in the piece.
  for (const b of range(0, 4)) {
    const base = b * 28
    broad.put(L.NOISE, base + 0, { note: 36, inst: KICK, vol: lv(12) })
    broad.put(L.NOISE, base + 4, { note: 45, inst: HAT, vol: lv(7) })
    broad.put(L.NOISE, base + 8, { note: 39, inst: SNARE, vol: lv(12) })
    broad.put(L.NOISE, base + 12, { note: 36, inst: KICK, vol: lv(11) })
    broad.put(L.NOISE, base + 16, { note: 45, inst: HAT, vol: lv(6) })
    broad.put(L.NOISE, base + 20, { note: 39, inst: SNARE, vol: lv(11) })
    if (b < 3) broad.put(L.NOISE, base + 24, { note: 46, inst: OHAT, vol: lv(7) })
  }
  broad.hits(L.NOISE, TOM, lv(12), [[6, 12]], 43)   // row 96 — the fill starts on quarter 4
  broad.hits(L.NOISE, TOM, lv(12), [[7, 2]], 37)    // row 100 — quarter 5
  broad.hits(L.NOISE, FALLER, lv(11), [[7, 6]], 44) // row 104
  broad.hits(L.NOISE, SNARE, lv(13), [[7, 10]], 41) // row 108
  // DPCM  one kick on the downbeat of each 7/4 bar: four hits that tell the ear where the
  // broad bar begins, which is the one thing the regrouping needs stated.
  broad.put(L.DPCM, 0, { note: CUT })
  broad.hits(L.DPCM, KIT.inst, 15, [[0, 0], [2, 0], [4, 0], [6, 0]], KIT.kick)
}

// =====================================================================================
// walk2 — frames 8–10. THE TUNE LEAVES PULSE 1. The sawtooth takes M at pitch an octave
// below for eight bars (8:0–9:55) — a different lane, a different register and a different
// envelope, the saw bending into each note where the pulse springs off it — while pulse 1
// drops to single long answers in the long group, one a bar, and says nothing at all for
// the first two. That handover is §5.2's second lead colour, and it is also the loudest
// piece of evidence that this arrangement is not one instrument from first frame to last.
// Pulse 1 takes the tune back at 10:0 on its OTHER duty envelope.
//
// Harmony: C F Dm G · C Em Am F · Dm G7 C G. The first four are `walk`'s, because the
// subject is the same and it is the ORCHESTRATION that varies; the rest is new.
// =====================================================================================
const walk2 = s.section('walk2', 12)
{
  // SAW  M an octave down, then its head a step up, then the second phrase — eight bars,
  // vol 10–11, which on a lane that reaches twice a pulse's level is a lead and not a
  // shout. It sits at 59–71 rather than the tenor 48–67 the brief suggests, because M an
  // octave under the tune is exactly that register; the triangle owns everything under 52
  // and the two never meet.
  phrase(walk2, L.SAW, SAW_LEAD, 0, [
    ...octaveDown(M),
    [2, 'd4', 10], [2, 'e4', 10], [2, 'a4', 12], [2, 'g4', 11], [4, 'f4', 10], [2, 'e4', 10], // bar 2, Dm
    [2, 'g4', 10], [2, 'f4', 10], [4, 'd4', 10], [6, '-'],                                    // bar 3, G
    [4, 'e4', 10], [4, 'g4', 11], [2, 'f4', 10], [2, 'e4', 10], [2, 'd4', 9],                 // bar 4, C
    [4, 'g4', 10], [4, 'b4', 11], [2, 'a4', 10], [2, 'g4', 10], [2, 'e4', 9],                 // bar 5, Em
    [2, 'a4', 10], [4, 'e4', 10], [2, 'd4', 9], [4, 'c4', 10], [2, 'b3', 9],                  // bar 6, Am
    [2, 'a4', 10], [2, 'g4', 10], [4, 'f4', 10], [6, '-'],                                    // bar 7, F
  ], { vib: nib(3, 1), vibMin: 6, vibAfter: 3, cutAtEnd: false, shift: -4 })
  // A phrase-end FALL: `R24` bends the sounding c5 down four semitones across rows 10–11
  // and the rest at row 12 ends it, so a slide that has not arrived cannot steal the next
  // attack. This and 12:52 are the piece's only note slides (9:52 and 12:52).
  walk2.put(L.P1, walk2.at(7, 10), { fx: [['R', nib(2, 4)]] })
  // P1  silent for two bars — the handover has to be audible — then ONE long note a bar,
  // placed in the long group where the saw's tune has its own rest. Its rhythm is nothing
  // like the tune's: this is a counter-voice, not a harmoniser.
  walk2.put(L.P1, 0, { note: CUT })
  phrase(walk2, L.P1, STEP, walk2.at(2), [
    [8, '-'], [6, 'a5', 12],                                   // bar 2
    [4, 'g5', 12], [4, 'f5', 11], [6, 'd5', 12],               // bar 3
    [8, '-'], [6, 'e5', 11],                                   // bar 4
    [8, '-'], [6, 'g5', 12],                                   // bar 5
    [4, 'e5', 11], [4, '-'], [6, 'c5', 11],                    // bar 6
    [4, 'f5', 12], [2, 'e5', 11], [2, '-'], [4, 'c5', 11], [2, '-'], // bar 7
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // P1  the tune back, on STEP_OPEN: the sequence head, the dominant, then M's own first
  // bar at 10:28 — the third full statement of the subject — and a half cadence out.
  phrase(walk2, L.P1, STEP_OPEN, walk2.at(8), [
    [2, 'd5', 12], [2, 'a5', 14], [2, 'g5', 13], [2, 'f5', 12], [4, 'e5', 12], [2, 'd5', 12], // bar 8, Dm
    [2, 'g5', 13], [2, 'f5', 12], [4, 'd5', 12], [6, 'b4', 12],                                // bar 9, G7
    [2, 'c5', 13], [2, 'g5', 14], [2, 'f5', 13], [2, 'e5', 12], [4, 'd5', 13], [2, 'e5', 12],  // bar 10, C — M
    [2, 'd5', 12], [2, 'f5', 12], [4, 'd5', 12], [4, 'b4', 11], [2, '-'],                      // bar 11, G
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // V1  silent while the saw has the tune (four bars), then inner harmony on the head and
  // in the long group. A lane that has stopped is the cheapest crescendo there is.
  // ...for ALL EIGHT of them, not four. V1's harmony at 64–72 sat inside the sawtooth
  // lead's own octave (59–71) and a column louder than it, so the inner voice covered the
  // second lead colour in the one section that exists to show it off. Dropping V1 an
  // octave would have put it on top of V2's held tones instead; the arrangement's answer
  // is that the lane simply stays out until pulse 1 comes back, which also makes the
  // return at 10:0 an entrance rather than a continuation.
  walk2.put(L.V1, 0, { note: CUT })
  ;[[8, 'a4', 'f4'], [9, 'b4', 'f4'], [10, 'g4', 'e4'], [11, 'b4', 'd4']].forEach(([bar, a, b]) => {
    walk2.put(L.V1, walk2.at(bar, 0), { note: n(a), inst: SHEEN, vol: lv(9) })
    walk2.put(L.V1, walk2.at(bar, 8), { note: n(b), inst: SHEEN, vol: lv(8) })
  })
  walk2.put(L.V1, walk2.len - 1, { note: CUT })
  // V2  the harmonic floor, one held guide tone a bar, voice-leading by step wherever the
  // chords allow it: e3 f3 a3 b3 c4 b3 a3 c4 f3 f3 e3 d3.
  phrase(walk2, L.V2, REED, 0, [
    [14, 'e3', 9], [14, 'f3', 9], [14, 'a3', 9], [14, 'b3', 9],
    [14, 'c4', 9], [14, 'b3', 9], [14, 'a3', 9], [14, 'c4', 9],
    [14, 'f3', 9], [14, 'f3', 10], [14, 'e3', 9], [14, 'd3', 9],
  ])
  // TRI  the walk at its most active, and the section where its chromatic approaches are
  // the point: c#3 into Dm (8:26 and 9:54), f#2 into G (8:40), g#2 into Am (9:24), plus two
  // sixteenth pushes (`+`) at 8:36 and 9:50 that put the bass a 16th behind the long
  // group's head while the kit lands on it.
  slotLine(walk2, L.TRI, 0, WALK_BASS, 15, [
    'c3  .  | g2  .  | e2  g2 f2',    // C   -> F
    'f2  a2 | c3  .  | a2  .  c#3',   // F   -> Dm, chromatic
    'd3  .  | f2  a2 | d3+ .  f#2',   // Dm  -> G,  chromatic, pushed
    'g2  .  | b2  d3 | g2  .  b2',    // G   -> C
    'c3  b2 | a2  g2 | e2  .  f2',    // C   -> Em
    'e2  .  | b2  .  | g2  .  g#2',   // Em  -> Am, chromatic
    'a2  b2 | c3  .  | e3  .  g2',    // Am  -> F
    'f2  g2 | a2  .  | c3+ .  c#3',   // F   -> Dm, chromatic, pushed
    'd3  .  | a2  .  | f2  .  f#2',   // Dm  -> G7, chromatic
    'g2  a2 | b2  .  | d3  .  b2',    // G7  -> C
    'c3  .  | e3  .  | g2  .  a2',    // C   -> G
    'g2  .  | d3  .  | g2  .  b2',    // G   -> hollow's C
  ], { gate: true })
  // P2  silent for eight bars, then the long-group answers again for the tune's return.
  walk2.put(L.P2, 0, { note: CUT })
  for (const [bar, a, b] of [[8, 'f4', 'd4'], [9, 'd4', 'b3'], [10, 'g4', 'e4'], [11, 'd4', 'b3']]) {
    walk2.put(L.P2, walk2.at(bar, 8), { note: n(a), inst: ANSWER, vol: lv(9) })
    walk2.put(L.P2, walk2.at(bar, 12), { note: n(b), inst: ANSWER, vol: lv(8), fx: [['G', 1]] })
  }
  // NOISE  a third kit: bars 0–3 thin right down so the saw's tune has the room the lead
  // used to take (kick on the first head only, snare on the second, three hats); bars 4–7
  // put a SIXTEENTH FLUTTER in the long group — rows 8 9 10 11, the only place in the piece
  // the hats leave the eighth grid — and bars 8–11 restore the walking kit with open hats.
  // FILL 6 at bar 7 is that flutter turned into snares; FILL 7 at bar 11 is a tom, a
  // faller and a riser in three consecutive eighths, and nothing else in the piece is that.
  for (const bar of range(0, 4)) {
    walk2.hits(L.NOISE, KICK, lv(11), [[bar, 0]])
    walk2.hits(L.NOISE, SNARE, lv(11), [[bar, 4]])
    walk2.hits(L.NOISE, SNARE, ghost(4), [[bar, 13]])
    hats(walk2, bar, [2, 6, 10], { on: 7, off: 5 })
  }
  for (const bar of [4, 5, 6]) {
    walk2.hits(L.NOISE, KICK, lv(12), [[bar, 0], [bar, 8]])
    walk2.hits(L.NOISE, SNARE, lv(11), [[bar, 4]])
    walk2.hits(L.NOISE, SNARE, ghost(4), [[bar, 13]])
    hats(walk2, bar, [2, 6, 9, 10, 11], { on: 7, off: 4 })
  }
  walk2.hits(L.NOISE, KICK, lv(12), [[7, 0]])
  walk2.hits(L.NOISE, SNARE, lv(11), [[7, 4]])
  hats(walk2, 7, [2, 6], { on: 7, off: 5 })
  walk2.hits(L.NOISE, SNARE, lv(9), [[7, 8], [7, 10]])
  walk2.hits(L.NOISE, SNARE, lv(13), [[7, 9], [7, 11]], 41)
  walk2.hits(L.NOISE, RIM, lv(9), [[7, 12], [7, 13]])
  for (const bar of [8, 9, 10]) kitWalk(walk2, bar, { open: bar === 9, hatRows: [0, 2, 4, 6, 8, 12] })
  kitWalk(walk2, 11, { ghost: null, hatRows: [0, 2, 4], snares: [4] })
  walk2.hits(L.NOISE, TOM, lv(12), [[11, 8]], 37)
  walk2.hits(L.NOISE, FALLER, lv(11), [[11, 10]], 44)
  walk2.hits(L.NOISE, RISER, lv(12), [[11, 12]], 40)
  walk2.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// hollow — frames 11–12. The thinnest place in the piece, and the second non-diatonic
// device: the CHROMATIC MEDIANT. From C major, take E MAJOR — a triad a third away whose
// quality is not the diatonic one, iii being minor — and keep E STATIONARY as the common
// tone: V2 sounds e3 from 11:0 through 11:55, so the chord changes underneath a note that
// does not move. V1 supplies the g#4 that makes the triad major.
//
// The trap the brief names is real and it is avoided here: E major resolving to A minor is
// a secondary dominant, which would collapse this device into the same one `stile` already
// owns. So the E is QUITTED TO F at 12:0 — the stationary e rising a semitone to f, which
// is the only stepwise way out of it — and Am is not touched anywhere in the section.
//
// No kick at all, no DPCM, no saw until bar 6, and pulse 2 silent for four bars: this is
// the piece's bar (four of them) where two or more voices rest together.
// Harmony: C · C · E · E · F · F · Dm · G7.
// =====================================================================================
const hollow = s.section('hollow', 8)
{
  // P1  bare, on the rounder envelope, two attacks a bar and a rest in every group-two:
  // the tune's own material stripped to its skeleton. The a5 at 12:36 is the peak.
  phrase(hollow, L.P1, STEP_OPEN, 0, [
    [4, 'e5', 11], [4, '-'], [6, 'g5', 11],                    // bar 0, C
    [4, 'e5', 11], [4, 'd5', 10], [6, 'c5', 11],               // bar 1, C
    [4, 'b4', 11], [4, '-'], [6, 'e5', 11],                    // bar 2, E MAJOR
    [4, 'e5', 11], [4, 'b4', 10], [6, 'e5', 11],               // bar 3, E MAJOR
    [4, 'f5', 12], [4, 'e5', 11], [6, 'c5', 11],               // bar 4, F — the e resolves up to f under it
    [4, 'c5', 11], [4, 'd5', 11], [6, 'f5', 12],               // bar 5, F
    [2, 'e5', 11], [2, 'd5', 11], [4, 'f5', 12], [6, 'a5', 14], // bar 6, Dm — the peak
    [4, 'g5', 13], [4, 'f5', 12], [4, 'd5', 12], [2, '-'],     // bar 7, G7
    // ...and the whole section a step under everything around it: `hollow` is the piece's
    // floor and it has to MEASURE as the floor, not merely contain fewer lanes. Sustained
    // voices carry more energy per note than staccato ones, so without this the thinnest
    // section rendered as loud as the busiest (-18.7 dBFS against `crest`'s -18.3).
  ], { vib: VIB, vibMin: 6, vibAfter: 3, shift: -1 })
  // The section's own phrase-end fall, on the last note before the rest at 12:54.
  hollow.put(L.P1, hollow.at(7, 10), { fx: [['R', nib(2, 3)]] })
  // V2  THE STATIONARY TONE. e3 sounds unbroken across both chords — the third of the C
  // and the root of the E major — for four whole bars, and moves only when the harmony
  // quits to F, where it rises a semitone to f3. That is the device in one line.
  phrase(hollow, L.V2, REED, 0, [[56, 'e3', 10], [28, 'f3', 10], [14, 'f3', 10], [14, 'd3', 10]],
    { vib: nib(2, 1), vibMin: 14, vibAfter: 4, shift: -2 })
  // V1  the g#4 that makes the mediant major, sounding through both E bars and resolving
  // UP by step to a4 over the F. Before and after it V1 holds plain chord tones, so the one
  // chromatic note in the section is the only thing the ear has to notice.
  phrase(hollow, L.V1, SHEEN, 0, [
    [14, 'g4', 9], [14, 'e4', 9],                              // bars 0–1, C
    [14, 'g#4', 11], [14, 'g#4', 11],                          // bars 2–3, THE RAISED THIRD
    [14, 'a4', 10], [14, 'c5', 9],                             // bars 4–5, F — g# resolves up to a
    [14, 'a4', 9], [14, 'b4', 10],                             // bars 6–7, Dm / G7
  ], { vib: nib(2, 1), vibMin: 14, vibAfter: 4, shift: -2 })
  // TRI  three notes and a cadence: the bass moves c2 -> e2 -> f2, a stepwise rise that
  // makes the common tone the floor as well as the inner voice, then d2 and g2 for the
  // half cadence. Sustained, not walking: the walk stops here.
  ;[[0, 'c2'], [1, 'c2'], [2, 'e2'], [3, 'e2'], [4, 'f2'], [5, 'f2'], [6, 'd2'], [7, 'g2']]
    .forEach(([bar, note]) => hollow.put(L.TRI, hollow.at(bar, 0), { note: n(note), inst: TRI_HOLD, vol: lv(15) }))
  for (const bar of [4, 5, 6, 7]) hollow.put(L.TRI, hollow.at(bar, 8), { note: n(bar === 7 ? 'd3' : bar === 6 ? 'a2' : 'c3'), inst: TRI_TAP, vol: lv(15) })
  hollow.put(L.TRI, hollow.len - 1, { note: CUT })
  // P2  silent for four bars, then a counter-line in contrary motion: it falls a4 g4 f4
  // while pulse 1 climbs to its peak.
  hollow.put(L.P2, 0, { note: CUT })
  phrase(hollow, L.P2, COUNTER, hollow.at(4), [
    [8, 'a4', 9], [6, 'g4', 9], [8, 'f4', 9], [6, 'a4', 9],
    [8, 'g4', 9], [6, 'f4', 9], [8, 'd4', 10], [6, 'b3', 9],
  ], { shift: -2 })
  // SAW  silent for six bars, then it glides into the cadence with a `3xx` portamento —
  // the one glide in the piece, cancelled with `100` on the next note, because `300` would
  // only FREEZE the portamento and leave the lane taking targets instead of attacks.
  hollow.put(L.SAW, 0, { note: CUT })
  phrase(hollow, L.SAW, SAW_HOLD, hollow.at(6), [
    [8, 'd3', 8], [6, 'f3', 8, ['3', 0x18]], [8, 'g3', 9, ['1', 0]], [6, 'b3', 9],
  ], { shift: -2 })
  // NOISE  no kick anywhere: closed hats on the three group heads at vol 4–5 and a
  // short-mode metal tick on the crooked row 12, which is the whole kit for six bars. The
  // snare returns at bar 6 for the cadence. FILL 8 is two metal ticks and nothing else —
  // the quietest fill in the piece, which is the only kind this section can carry.
  for (const bar of range(0, 6)) {
    hats(hollow, bar, HEADS, { on: 5, off: 4 })
    hollow.hits(L.NOISE, METAL, lv(6), [[bar, 12]])
  }
  hats(hollow, 6, [0, 4, 8, 12], { on: 6, off: 5 })
  hollow.hits(L.NOISE, SNARE, lv(9), [[6, 4]])
  hats(hollow, 7, [0, 2, 4, 6], { on: 7, off: 5 })
  hollow.hits(L.NOISE, SNARE, lv(10), [[7, 4]])
  hollow.hits(L.NOISE, METAL, lv(8), [[7, 8]])
  hollow.hits(L.NOISE, METAL, lv(10), [[7, 12]])
  hollow.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// climb — frames 13–15. The build, and MS: M's first bar sequenced UP THE SCALE one step
// per bar, c5 d5 e5 as its three starting notes (13:0, 13:14, 13:28), over a harmony that
// rises with it — C Dm Em F. Everything thickens: the saw joins the bass on the heads from
// bar 4, the DPCM kick from bar 8, the kit gains a third kick.
//
// NO metric surprise: the piece carries no `Dxx` pattern break anywhere. The snare roll
// in bar 11 (FILL 10) simply ends under the lead's highest note so far (b5 at 15:42), and
// one beat of air carries over the seam into `crest`. Harmony: C Dm Em F · G Am F G · Em F Dm G7.
// =====================================================================================
const climb = s.section('climb', 12)
{
  // P1  MS. Bars 0–2 are M's first bar starting a step higher each time; bars 3–7 drive it;
  // bars 8–10 push the line to the top of its range, and bar 11 — the ten-row bar — states
  // the section's peak b5 and is cut off under it.
  phrase(climb, L.P1, STEP, 0, [
    [2, 'c5', 12], [2, 'g5', 13], [2, 'f5', 12], [2, 'e5', 12], [4, 'd5', 12], [2, 'e5', 12], // bar 0, C
    [2, 'd5', 12], [2, 'a5', 13], [2, 'g5', 13], [2, 'f5', 12], [4, 'e5', 12], [2, 'f5', 12], // bar 1, Dm — MS link 2
    [2, 'e5', 13], [2, 'a5', 14], [2, 'g5', 13], [2, 'f5', 12], [4, 'e5', 12], [2, 'g5', 13], // bar 2, Em — MS link 3
    [2, 'a5', 13], [2, 'g5', 13], [4, 'f5', 12], [6, 'a5', 13],                               // bar 3, F
    [2, 'g5', 13], [2, 'a5', 13], [2, 'g5', 13], [2, 'f5', 12], [4, 'd5', 12], [2, 'b4', 11], // bar 4, G
    [2, 'a5', 13], [2, 'g5', 12], [2, 'e5', 12], [2, 'c5', 11], [4, 'a4', 11], [2, 'c5', 11], // bar 5, Am — the release
    [4, 'f5', 12], [4, 'a5', 13], [2, 'g5', 12], [2, 'f5', 12], [2, 'e5', 11],                // bar 6, F
    [4, 'd5', 12], [4, 'f5', 12], [6, '-'],                                                   // bar 7, G — the breath
    // ...and the build is written to ARRIVE, so 13:0–14:55 sits a column step under what
    // follows it. Frames 13–18 measured within 1.1 dB of each other before this, which
    // meant the peak was carried by register and octave doubling but not by level.
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false, shift: -1 })
  phrase(climb, L.P1, STEP, climb.at(8), [
    [2, 'e5', 12], [2, 'g5', 13], [2, 'a5', 13], [2, 'g5', 13], [4, 'e5', 12], [2, 'a5', 13], // bar 8, Em
    [2, 'a5', 13], [2, 'g5', 13], [2, 'a5', 13], [2, 'g5', 13], [4, 'f5', 12], [2, 'a5', 13], // bar 9, F
    [4, 'a5', 14], [4, 'g5', 13], [2, 'f5', 13], [2, 'e5', 12], [2, 'd5', 12],                // bar 10, Dm
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // bar 11, the TEN-ROW bar: four attacks and no vibrato and no trailing cut, because rows
  // 164–167 of this section are never played.
  phrase(climb, L.P1, STEP, climb.at(11), [
    [2, 'b5', 15], [2, 'a5', 14], [2, 'g5', 13], [4, 'd5', 13],
  ], { cutAtEnd: false })
  // V1  inner harmony on the first head and in the long group, rising with everything else.
  ;[[0, 'g4', 'e4'], [1, 'a4', 'f4'], [2, 'b4', 'g4'], [3, 'c5', 'a4'],
    [4, 'd5', 'b4'], [5, 'c5', 'a4'], [6, 'c5', 'f4'], [7, 'b4', 'd4'],
    [8, 'b4', 'g4'], [9, 'c5', 'a4'], [10, 'a4', 'f4'], [11, 'b4', 'f4']].forEach(([bar, a, b]) => {
    climb.put(L.V1, climb.at(bar, 0), { note: n(a), inst: SHEEN, vol: lv(bar < 8 ? 8 : 9) })
    climb.put(L.V1, climb.at(bar, 8), { note: n(b), inst: SHEEN, vol: lv(bar < 8 ? 7 : 8) })
  })
  // V2  one held guide tone a bar, walking up in step with the harmony and holding G7's f3
  // across the truncated bar into `crest`.
  phrase(climb, L.V2, REED, 0, [
    [14, 'e3', 9], [14, 'f3', 9], [14, 'g3', 9], [14, 'a3', 9],
    [14, 'b3', 9], [14, 'c4', 9], [14, 'a3', 9], [14, 'b3', 9],
    [14, 'g3', 9], [14, 'a3', 9], [14, 'f3', 10], [14, 'f3', 10],
  ])
  // TRI  the walk, with a chromatic approach into six of the eleven changes: c#3 (13:12),
  // f#2 (13:40, 14:36, 14:50), g#2 (14:12), c#3 (15:22), f#2 (15:36).
  slotLine(climb, L.TRI, 0, WALK_BASS, 15, [
    'c3  .  | g2  .  | e2  .  c#3',   // C   -> Dm, chromatic
    'd3  .  | a2  .  | f2  .  d2',    // Dm  -> Em
    'e2  .  | b2  .  | g2  .  e2',    // Em  -> F
    'f2  a2 | c3  .  | a2  .  f#2',   // F   -> G,  chromatic
    'g2  .  | d3  .  | b2  .  g#2',   // G   -> Am, chromatic
    'a2  .  | e3  .  | c3  .  g2',    // Am  -> F
    'f2  g2 | a2  .  | c3  .  f#2',   // F   -> G,  chromatic
    'g2  .  | b2  .  | d3  .  f#2',   // G   -> Em, chromatic
    'e2  .  | b2  .  | g2  .  e2',    // Em  -> F
    'f2  a2 | c3  .  | a2  .  c#3',   // F   -> Dm, chromatic
    'd3  .  | a2  .  | f2  .  f#2',   // Dm  -> G7, chromatic
    'g2  .  | b2  .  | d3  .  .',     // G7 — nothing after row 8: the bar is ten rows long
  ], { gate: true })
  // P2  its own position again — rows 6 and 10, the second eighth of groups two and three —
  // from bar 4 to bar 10, and silent in the truncated bar.
  ;[[4, 'b3', 'd4'], [5, 'c4', 'e4'], [6, 'c4', 'a3'], [7, 'd4', 'b3'],
    [8, 'e4', 'g4'], [9, 'f4', 'a4'], [10, 'f4', 'd4']].forEach(([bar, a, b]) => {
    climb.put(L.P2, climb.at(bar, 6), { note: n(a), inst: ANSWER, vol: lv(8) })
    climb.put(L.P2, climb.at(bar, 10), { note: n(b), inst: ANSWER, vol: lv(9) })
  })
  climb.put(L.P2, 0, { note: CUT })
  // SAW  the group heads from bar 4, a tenth above the triangle: the bass doubled, which is
  // what makes a build sound like weight rather than like more notes.
  slotLine(climb, L.SAW, 4, SAW_STEP, 9, [
    'g3  .  | b3  .  | d4  .  .',
    'a3  .  | c4  .  | e4  .  .',
    'f3  .  | a3  .  | c4  .  .',
    'g3  .  | b3  .  | d4  .  .',
    'e3  .  | g3  .  | b3  .  .',
    'f3  .  | a3  .  | c4  .  .',
    'd3  .  | f3  .  | a3  .  .',
    'g3  .  | b3  .  | d4  .  .',   // bar 11: rows 0, 4 and 8 only
  ])
  climb.put(L.SAW, 0, { note: CUT })
  // NOISE  three kits in one section: bars 0–3 a single kick with eighth hats, bars 4–6 the
  // kick back on the long group with an open hat, bars 8–10 a third kick on row 6 and the
  // hats thinned to two. FILL 9 at bar 7 is a triple riser; FILL 10 at bar 11 is an
  // accelerating snare roll that simply ends — no cut, no metric surprise.
  for (const bar of range(0, 4)) {
    climb.hits(L.NOISE, KICK, lv(11), [[bar, 0]])
    climb.hits(L.NOISE, SNARE, lv(11), [[bar, 4]])
    if (bar === 2) climb.hits(L.NOISE, METAL, lv(6), [[bar, 13]])   // FRAME 13's colour:
    else climb.hits(L.NOISE, SNARE, ghost(4), [[bar, 13]])          // one short-mode tick
    hats(climb, bar, [2, 6, 8, 10, 12], { on: 7, off: 5 })
  }
  for (const bar of [4, 5, 6]) {
    climb.hits(L.NOISE, KICK, lv(12), [[bar, 0], [bar, 8]])
    climb.hits(L.NOISE, SNARE, lv(12), [[bar, 4]])
    climb.hits(L.NOISE, SNARE, ghost(5), [[bar, 13]])
    if (bar === 5) climb.hits(L.NOISE, OHAT, lv(8), [[bar, 10]])
    hats(climb, bar, [2, 6, 10, 12], { on: 8, off: 5 })
  }
  climb.hits(L.NOISE, KICK, lv(12), [[7, 0]])
  climb.hits(L.NOISE, SNARE, lv(11), [[7, 4]])
  hats(climb, 7, [2], { on: 7, off: 5 })
  climb.hits(L.NOISE, RISER, lv(9), [[7, 8]], 40)
  climb.hits(L.NOISE, RISER, lv(11), [[7, 10]], 40)
  climb.hits(L.NOISE, RISER, lv(13), [[7, 12]], 40)
  for (const bar of [8, 9, 10]) {
    climb.hits(L.NOISE, KICK, lv(11), [[bar, 0], [bar, 6], [bar, 8]])
    climb.hits(L.NOISE, SNARE, lv(11), [[bar, 4], [bar, 12]])
    if (bar === 9) climb.hits(L.NOISE, METAL, lv(7), [[bar, 13]])   // and FRAME 15's
    else climb.hits(L.NOISE, SNARE, ghost(5), [[bar, 13]])
    hats(climb, bar, [2, 10], { on: 8, off: 6 })
  }
  climb.hits(L.NOISE, KICK, lv(12), [[11, 0]])
  climb.hits(L.NOISE, SNARE, lv(10), [[11, 2]])
  climb.hits(L.NOISE, SNARE, lv(12), [[11, 4]])
  climb.hits(L.NOISE, SNARE, lv(13), [[11, 6]], 41)
  climb.hits(L.NOISE, KICK, lv(13), [[11, 8]])
  // The roll's last drum. It USED to carry `D00`, which ended the frame four rows early
  // and left a bar of five eighths — but four rows is not a whole 7/8 bar, so the loop
  // body came out 75.71 bars and every pass re-entered ten rows out of phase with the
  // one before it (check.mjs `loop-metre`). The rows the cut discarded were empty, so
  // the roll now simply stops and one beat of air carries into `crest`.
  climb.hits(L.NOISE, SNARE, lv(14), [[11, 9]], 41)
  // DPCM  the downbeat of the last four bars, which is where the build needs weight the
  // triangle cannot spare.
  climb.put(L.DPCM, 0, { note: CUT })
  climb.hits(L.DPCM, KIT.inst, 15, [[8, 0], [9, 0], [10, 0], [11, 0]], KIT.kick)
}

// =====================================================================================
// crest — frames 16–17. The peak. M in OCTAVES on pulse 1 and VRC6 pulse 1 for four bars —
// §2.1's fourth sanctioned break, which costs all the harmony those two lanes were carrying
// and is exactly why it reads as a lift — and then V1 goes back to inner harmony so the
// last four bars can be harmonised again. The sawtooth doubles the triangle a tenth up
// throughout, the DPCM kick marks every downbeat, and the global peak d6 lands at 17:18 on
// the head of group two, in the piece's last third.
//
// The close is PLAGAL and it brings the borrowed flat VII back: B flat (17:14) -> F -> C,
// the same modal colour `broad` introduced, so the piece's brightest cadence is the one
// chord from outside the key.
// Harmony: C F Am G · C B flat F C.
// =====================================================================================
const CREST_TUNE = [
  [2, 'c5', 13], [2, 'g5', 14], [2, 'f5', 13], [2, 'e5', 13], [4, 'd5', 13], [2, 'e5', 13], // bar 0, C — M
  [2, 'g5', 14], [2, 'a5', 14], [4, 'c6', 15], [6, 'a5', 14],                               // bar 1, F
  [2, 'a5', 14], [2, 'g5', 13], [2, 'e5', 13], [2, 'a5', 14], [4, 'g5', 13], [2, 'e5', 13], // bar 2, Am
  [2, 'd5', 13], [2, 'g5', 14], [2, 'b5', 15], [2, 'a5', 14], [4, 'g5', 13], [2, 'f5', 13], // bar 3, G
]
const crest = s.section('crest', 8)
{
  // P1  M, then the tune at its widest. The peak d6 at 17:18 is the highest note in the
  // piece and it is quitted by step downward, as a peak should be.
  phrase(crest, L.P1, STEP, 0, [
    ...CREST_TUNE,
    [2, 'e5', 13], [2, 'g5', 14], [2, 'c6', 15], [2, 'b5', 14], [4, 'a5', 14], [2, 'g5', 13], // bar 4, C
    [2, 'f5', 13], [2, 'a5', 14], [4, 'd6', 15], [6, 'c6', 14],                               // bar 5, B FLAT — the peak
    [2, 'c6', 14], [2, 'a5', 14], [2, 'g5', 13], [2, 'f5', 13], [4, 'e5', 13], [2, 'f5', 13], // bar 6, F
    [2, 'g5', 14], [2, 'e5', 13], [4, 'c5', 13], [6, '-'],                                    // bar 7, C — the plagal arrival
  ], { vib: VIB, vibMin: 6, vibAfter: 3 })
  // V1  the tune an OCTAVE BELOW for four bars and not a bar more, then inner harmony again.
  // The doubling is the lift; keeping it would cost the harmony for the whole section.
  phrase(crest, L.V1, SHEEN, 0, octaveDown(CREST_TUNE).map(([len, note, vol]) => [len, note, vol - 3]), { cutAtEnd: false })
  ;[[4, 'g4', 'e4'], [5, 'd4', 'f4'], [6, 'c5', 'a4'], [7, 'g4', 'e4']].forEach(([bar, a, b]) => {
    crest.put(L.V1, crest.at(bar, 0), { note: n(a), inst: SHEEN, vol: lv(10) })
    crest.put(L.V1, crest.at(bar, 8), { note: n(b), inst: SHEEN, vol: lv(9) })
  })
  crest.put(L.V1, crest.len - 1, { note: CUT })
  // V2  chord stabs on the first head and on the head of the long group: one row of sound
  // each, so the harmony is stated without a pad sitting under the tune. No `0xy` — the
  // arpeggio bed was spent in `gate` and the ear has not needed it since.
  ;[[0, 'e3', 'g3'], [1, 'f3', 'a3'], [2, 'a3', 'c4'], [3, 'b3', 'd4'],
    [4, 'c4', 'e3'], [5, 'd4', 'f3'], [6, 'a3', 'c4'], [7, 'g3', 'e3']].forEach(([bar, a, b]) => {
    crest.put(L.V2, crest.at(bar, 0), { note: n(a), inst: STAB, vol: lv(10) })
    crest.put(L.V2, crest.at(bar, 8), { note: n(b), inst: STAB, vol: lv(9) })
  })
  // TRI  the walk at full strength.
  slotLine(crest, L.TRI, 0, WALK_BASS, 15, [
    'c3  .  | g2  .  | e2  g2 f2',    // C  -> F
    'f2  a2 | c3  .  | a2  .  g2',    // F  -> Am
    'a2  .  | e3  .  | c3  .  b2',    // Am -> G
    'g2  .  | d3  .  | b2  .  g2',    // G  -> C
    'c3  b2 | a2  g2 | e2  .  f2',    // C  -> B flat
    'bb2 .  | f2  .  | d3  .  c3',    // B FLAT -> F
    'f2  .  | c3  .  | a2  .  g2',    // F  -> C
    'c3  .  | g2  .  | e2  .  g2',    // C  -> turn's Em
  ], { gate: true })
  // SAW  the triangle doubled a tenth above on the three group heads: weight, not notes.
  slotLine(crest, L.SAW, 0, SAW_STEP, 9, [
    'c4  .  | g3  .  | e3  .  .',
    'f3  .  | c4  .  | a3  .  .',
    'a3  .  | e4  .  | c4  .  .',
    'g3  .  | d4  .  | b3  .  .',
    'c4  .  | a3  .  | e3  .  .',
    'bb3 .  | f3  .  | d4  .  .',
    'f3  .  | c4  .  | a3  .  .',
    'c4  .  | g3  .  | e4  .  .',
  ])
  // P2  a stepwise descent on rows 6 and 12 through the last four bars — its own rhythm and
  // contrary to the lead, which is climbing to the peak above it. Not sixths: the four bars
  // of parallel writing this piece is allowed were spent in `broad`.
  crest.put(L.P2, 0, { note: CUT })
  ;[[4, 'b4', 'g4'], [5, 'a4', 'f4'], [6, 'g4', 'e4'], [7, 'e4', 'c4']].forEach(([bar, a, b]) => {
    crest.put(L.P2, crest.at(bar, 6), { note: n(a), inst: ANSWER, vol: lv(9) })
    crest.put(L.P2, crest.at(bar, 12), { note: n(b), inst: ANSWER, vol: lv(8) })
  })
  // NOISE  the loudest kit: a crash on the first downbeat, the kick on both long steps, the
  // snare on the head of group two AND on the crooked row 12, eighth hats, ghosts. FILL 11
  // at bar 3 is a tom pair in the long group; bar 7 has NO fill — the arrival is the tune's,
  // and the section after it has to start from almost nothing.
  crest.put(L.NOISE, 0, { note: 46, inst: CRASH, vol: lv(11) })
  for (const bar of range(0, 7)) {
    crest.hits(L.NOISE, KICK, lv(12), bar === 0 ? [[bar, 8]] : [[bar, 0], [bar, 8]])
    crest.hits(L.NOISE, SNARE, lv(12), [[bar, 4], [bar, 12]])
    crest.hits(L.NOISE, SNARE, ghost(4), [[bar, 13]])
    hats(crest, bar, [2, 6, 10], { on: 8, off: 6 })
  }
  crest.hits(L.NOISE, TOM, lv(12), [[3, 10]], 43)
  crest.hits(L.NOISE, TOM, lv(13), [[3, 12]], 37)
  crest.hits(L.NOISE, SNARE, ghost(6), [[3, 13]], 41)
  // FRAME 17 gets the open hat the first half of the section has not had: row 10 of bar
  // 5, which is where `walk`, `walk2` and `climb` put theirs, so it is this album's move
  // and not a new one. Without it frames 13, 15, 17, 18 and 19 are kick, snare and closed
  // hat for thirty-nine seconds, which §9.4 names as a failure at section level.
  crest.hits(L.NOISE, OHAT, lv(7), [[5, 10]])
  crest.hits(L.NOISE, KICK, lv(11), [[7, 0]])
  crest.hits(L.NOISE, SNARE, lv(11), [[7, 4]])
  hats(crest, 7, [2, 6], { on: 7, off: 5 })
  // DPCM  every downbeat of the section: the one place the piece spends its weight freely.
  crest.put(L.DPCM, 0, { note: CUT })
  crest.hits(L.DPCM, KIT.inst, 15, range(0, 8).map((bar) => [bar, 0]), KIT.kick)
}

// =====================================================================================
// turn — frames 18–19. Walking away. A descending-fifths sequence — Em Am Dm G, four links
// (18:0, 18:14, 18:28, 18:42) — and the lanes leave one at a time: the sawtooth at 19:0,
// pulse 2 at 19:14, V1 at 19:28, V2 at 19:42, the kit thinning across the last two bars
// until the final bar is pulse 1 and the triangle over a bare G7.
//
// THERE IS NO FILL AT THE SEAM (§2.9 rule 5, and the reference document names a fill at the
// loop point as the most fatiguing thing a loop can do). What leads back is harmony and
// contrary motion instead: the triangle falls d3 -> c3 into `walk`'s downbeat while the
// lead's b4 rises a semitone to c5, a dominant resolving across the join.
// Harmony: Em Am Dm G · C Am Dm7 G7.
// =====================================================================================
const turn = s.section('turn', 8)
{
  // P1  the tune dissolving: M's contour for two bars, then longer notes, then two notes and
  // a rest. The last sounding note is b4, the leading tone, and the loop answers it.
  phrase(turn, L.P1, STEP_OPEN, 0, [
    [2, 'e5', 12], [2, 'g5', 13], [2, 'f5', 12], [2, 'e5', 12], [4, 'd5', 12], [2, 'b4', 11], // bar 0, Em
    [2, 'c5', 12], [2, 'e5', 12], [2, 'd5', 12], [2, 'c5', 11], [4, 'b4', 11], [2, 'a4', 11], // bar 1, Am
    [2, 'd5', 12], [2, 'f5', 12], [4, 'e5', 12], [6, 'd5', 12],                               // bar 2, Dm
    [2, 'b4', 11], [2, 'd5', 12], [4, 'c5', 11], [6, 'b4', 11],                               // bar 3, G
    [2, 'c5', 12], [2, 'e5', 12], [2, 'g5', 13], [2, 'e5', 12], [4, 'c5', 12], [2, 'd5', 11], // bar 4, C
    [4, 'e5', 12], [4, 'c5', 11], [6, 'a4', 11],                                              // bar 5, Am
    [4, 'f5', 12], [4, 'e5', 11], [6, 'd5', 11],                                              // bar 6, Dm7
    [4, 'd5', 12], [4, 'b4', 11], [6, '-'],                                                   // bar 7, G7 — and the loop
  ], { vib: VIB, vibMin: 6, vibAfter: 3, cutAtEnd: false })
  // TRI  the last lane standing. The descending fifths in the bass, and at the very end
  // g2 b2 d3 so the seam is a dominant that falls to the tonic as the melody rises to it.
  slotLine(turn, L.TRI, 0, WALK_BASS, 15, [
    'e2  .  | b2  .  | g2  .  a2',    // Em  -> Am
    'a2  .  | e3  .  | c3  .  c#3',   // Am  -> Dm, chromatic
    'd3  .  | a2  .  | f2  .  f#2',   // Dm  -> G,  chromatic
    'g2  .  | d3  .  | b2  .  b2',    // G   -> C
    'c3  .  | g2  .  | e2  .  g2',    // C   -> Am
    'a2  .  | e2  .  | c3  .  c#3',   // Am  -> Dm7, chromatic
    'd3  .  | a2  .  | f2  .  f#2',   // Dm7 -> G7, chromatic
    'g2  .  | b2  .  | d3  .  .',     // G7  -> the loop: d3 falls to c3 as b4 rises to c5
  ], { gate: true })
  // V2  one held guide tone a bar, and it goes silent on the last long group so the final
  // bar is two lanes: b3 a3 f3 d3 e3 c4 a3 f3.
  phrase(turn, L.V2, REED, 0, [
    [14, 'b3', 9], [14, 'a3', 9], [14, 'f3', 9], [14, 'd3', 9],
    [14, 'e3', 9], [14, 'c4', 9], [14, 'a3', 9], [8, 'f3', 9], [6, '-'],
  ], { cutAtEnd: false })
  // V1  inner harmony for six bars, then gone.
  ;[[0, 'g4', 'e4'], [1, 'a4', 'e4'], [2, 'f4', 'd4'], [3, 'b4', 'g4'],
    [4, 'g4', 'e4'], [5, 'e4', 'c4']].forEach(([bar, a, b]) => {
    turn.put(L.V1, turn.at(bar, 0), { note: n(a), inst: SHEEN, vol: lv(9) })
    turn.put(L.V1, turn.at(bar, 8), { note: n(b), inst: SHEEN, vol: lv(8) })
  })
  turn.put(L.V1, turn.at(6, 0), { note: CUT })
  // P2  the long-group answers for five bars, then gone.
  for (const [bar, a, b] of [[0, 'g4', 'e4'], [1, 'e4', 'c4'], [2, 'a4', 'f4'], [3, 'd4', 'b3'], [4, 'g4', 'e4']]) {
    turn.put(L.P2, turn.at(bar, 10), { note: n(a), inst: ANSWER, vol: lv(9) })
    turn.put(L.P2, turn.at(bar, 12), { note: n(b), inst: ANSWER, vol: lv(8), fx: [['G', 1]] })
  }
  turn.put(L.P2, turn.at(5, 0), { note: CUT })
  // SAW  four bars on the group heads, then gone — the first lane to leave.
  slotLine(turn, L.SAW, 0, SAW_STEP, 9, [
    'e3  .  | b3  .  | g3  .  .',
    'a3  .  | e4  .  | c4  .  .',
    'd3  .  | a3  .  | f3  .  .',
    'g3  .  | d4  .  | b3  .  .',
  ])
  turn.put(L.SAW, turn.at(4, 0), { note: CUT })
  // NOISE  the walking kit for five bars, then it thins bar by bar: bar 5 loses the second
  // kick, bar 6 loses the snare, bar 7 is one kick and two hats and stops at row 4. Nothing
  // in the last eight rows of the piece — the seam is silence and a dominant.
  // ...and FRAME 18 gets one on bar 1, the last open hat in the piece: after it the kit
  // only ever loses things.
  for (const bar of range(0, 5)) kitWalk(turn, bar, { hatRows: [0, 2, 4, 6, 8, 10, 12], on: 7, off: 5, open: bar === 1 })
  kitWalk(turn, 5, { kicks: [0], ghost: 13, hatRows: [2, 6, 10] })
  turn.hits(L.NOISE, KICK, lv(10), [[6, 0]])
  hats(turn, 6, [2, 4, 6], { on: 6, off: 5 })
  turn.hits(L.NOISE, KICK, lv(9), [[7, 0]])
  hats(turn, 7, [2, 4], { on: 6, off: 5 })
  turn.put(L.DPCM, 0, { note: CUT })
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['gate', 'walk', 'stile', 'broad', 'walk2', 'hollow', 'climb', 'crest', 'turn'])
s.loopTo('walk')
s.qa({
  key: 'c-major',
  bpmRange: [128, 129],
  durationSec: [127, 134],
  motif: {
    channel: 'pulse1',
    patterns: [0, 5, 9, 14],
    variation: 'augmented into 7/4, re-orchestrated onto the sawtooth an octave down, sequenced up the scale, doubled in octaves',
  },
  notes:
    'C major in 7/8 grouped 2+2+3, 128.571 BPM on 16th rows: speed 7, rowHighlight 4 (a beat), ' +
    'rowHighlight2 14 (a seven-eighth bar), rowsPerPattern 56 (a frame = 4 bars = 6.533 s); 20 ' +
    'frames, one pass 130.67 s, which is 1120 rows exactly. THE BAR: eighths at ' +
    'rows 0 2 4 6 8 10 12, the three groups starting at 0, 4 and 8, the third six rows long. ' +
    'rowHighlight marks 0, 4, 8 and 12, and the 12 is INSIDE the long group - that mismatch is ' +
    'the piece, and every lane uses row 12 as a step the metre does not have. THE SUBJECT M is ' +
    'two bars: a foot, a rising fifth, the walk back down, six attacks closing on row 12; then ' +
    'four attacks with the long group held whole. Stated at 1:0. VARIATIONS: AUGMENTATION at 6:0 ' +
    '(every value doubled, so M\'s two 7/8 bars become one 7/4 bar and one - one note moves, M\'s ' +
    'e5 to d5, which would be a tritone over the flat VII); RE-ORCHESTRATION at 8:0 (the sawtooth ' +
    'at pitch an octave down for eight bars); SEQUENCE at 13:0, 13:14 and 13:28 (M\'s first bar ' +
    'starting a scale step higher each time, c5 d5 e5); OCTAVES at 16:0 (pulse 1 and VRC6 pulse 1 ' +
    'on the same line an octave apart, four bars and no more). METRE (9.1), and the phase table ' +
    'computed for 56-row frames rather than copied from 9.1\'s 64-row one: entry row of frame k ' +
    'for a cell of length c is (-56k) mod c and the cycle closes after lcm(c,56)/56 frames, so ' +
    'c=3 gives 3 frames and entry rows 0, 1, 2. STRUCTURAL 1: the 3-row dotted-eighth cell on ' +
    'VRC6 pulse 1, 56 attacks unbroken from 1:0 to 3:53, entering 1:0, 2:1 and 3:2, realigning ' +
    'with the 14-row bar every 3 bars and resolving onto the downbeat at 4:0, where V1 states it ' +
    'on the clockwork instrument one last time. Its pitch walks a FIVE-step figure through the ' +
    'bar\'s chord, so the melodic period (15 rows) disagrees with the cell, the bar and the frame ' +
    'and no two of the four alignment cycles are alike; an attack that lands on a group head ' +
    'sounds a step louder, which is how the phasing is heard. STRUCTURAL 2: the 7/4 regrouping at ' +
    '6:0-7:55 - the same 56-row frame heard as two 28-row bars accented every four rows, stated ' +
    'by the kit (an event on each of the seven quarters and none between them), by the bass ' +
    'moving once every two quarters and by V1\'s seven-attack arch. A third, smaller one: pulse ' +
    '2\'s 4-row cell at 4:0-5:52, a quarter against a seven-row bar, on the group heads in even ' +
    'bars and between them in odd ones. NO metric surprise of the Dxx kind anywhere in the piece: ' +
    'a `D00` pattern break once sat at 15:51, cutting frame 15 four rows short, but four rows is ' +
    'not a whole 7/8 bar (14 rows) and left the loop body 10 rows short of closing, so every pass ' +
    'would have re-entered out of phase. The cut is gone; the snare roll in `climb` bar 11 simply ' +
    'ends, and one beat of air carries into `crest`. NON-DIATONIC 1 (9.3): ' +
    'chained secondaries, four applied dominants that arrive - E7 at 4:36, A7 at 4:42, D7 at ' +
    '4:50, G7 at 5:0, C at 5:8. Voiced as the two lines a dominant seventh has: VRC6 pulse 1 ' +
    'takes d4 c#4 c4 b3 c4 (each seventh falling a semitone into the next chord\'s third) and VRC6 ' +
    'pulse 2 takes g#3 g3 f#3 f3 e3, five chromatic links a tritone under it, the pair resolving ' +
    'by contrary step at every change. Every raised tone is in one of those INNER voices; the ' +
    'lead is diatonic through the whole chain, and the bass doubles E7\'s own g# as a chromatic ' +
    'approach at 4:40. NON-DIATONIC 2: the chromatic mediant, E major from C at 11:28 and 11:42, ' +
    'with e STATIONARY as the common tone - VRC6 pulse 2 attacks e3 once at 11:0 and holds it ' +
    'through the whole frame while the chord changes under it, and the triangle\'s only pitch ' +
    'classes in that frame are c and e. VRC6 pulse 1 supplies the g#4 that makes the triad major. ' +
    'It is quitted to F at 12:0, the stationary e rising a semitone to f and the g# up to a, and ' +
    'A minor is not touched anywhere in the section - E major into A minor would be a secondary ' +
    'dominant and would collapse the two devices into one. THIRD COLOUR, counted as ONE device ' +
    'and therefore neither of the two: modal interchange, the borrowed flat VII (B flat) at 6:28 ' +
    'and again at 17:14, where it makes the plagal close flat VII - IV - I. HARMONIC RHYTHM: ' +
    '`stile` (4:0-5:55) is the section whose rhythm differs - two chords a bar, changing at rows ' +
    '0 and 8, the head of the long group - against one chord a bar elsewhere and one per 28 rows ' +
    'in `broad`. No four-chord cycle repeats anywhere: the longest identical run is four bars. ' +
    'SEQUENCES that go somewhere: descending fifths Am Dm G7 C at 3:0-3:55 and Em Am Dm G at ' +
    '18:0-18:55, and a rising step sequence C Dm Em F at 13:0-13:55. COUNTERPOINT (9.2): pulse 2 ' +
    'is an independent line for the whole of `stile` - 28 attacks on its own 4-row grid, its own ' +
    'contour, never the lead\'s rhythm, half of its attacks on rows pulse 1 does not use, and at ' +
    'the cadence (5:8) it falls g4 to e4 while pulse 1 rises b4 d5 e5. Contrary-motion cadences ' +
    'at 3:42 (the melody rising c5 e5 g5 while the bass falls d3 to c3), at 5:0-5:8 and across ' +
    'the loop seam at 19:55, where the triangle falls d3 to c3 as the lead\'s b4 rises to c5. ' +
    'Written suspensions at 4:4 (d5 held across the change to A minor, resolving down to c5 at ' +
    '4:12, under an A20 fade so the held note thins) and at 5:40 (G7\'s seventh f5 held to the ' +
    'barline and resolving to e5 at 5:42 - the cadential one); an appoggiatura on the a5 at 1:32, ' +
    'resolving down by step at 1:34. The only parallel writing is four bars of diatonic sixths at ' +
    '7:0-7:44, earned by the eight bars of independence in `stile` before it and never repeated. ' +
    'SECOND LEAD COLOUR: the tune leaves pulse 1 at 8:0 and the sawtooth carries M an octave ' +
    'below for eight bars to 9:55, a different lane, register and envelope (a stepped bend-in ' +
    'whose values sum to zero, against the pulse\'s springy front); pulse 1 says nothing for two ' +
    'bars and then answers in single long notes, and VRC6 pulse 1 is silent for all eight - its ' +
    'harmony sat at 64-72, inside the saw lead\'s own 59-71 and a column louder than it, so the ' +
    'inner voice was covering the second lead in the one section that exists to show it off. ' +
    'Dropping it an octave would have put it on V2\'s held tones instead; the lane stays out until ' +
    'pulse 1 returns at 10:0, which also makes that return an entrance. Pulse 1 itself carries ' +
    'TWO duty envelopes that alternate by phrase, not by piece - `step` opens 12.5 to 50 %, ' +
    '`step-open` opens at 50 % and narrows to 12.5 % - and both are heard inside `walk` alone ' +
    '(1:0 and 2:0). DRUMS (9.4): every section has its own kit and five change again inside the ' +
    'section, each changing at least two of kick placement, snare placement, hat density, hat ' +
    'instrument, metal ticks and ghost density, and no frame from 13 to 18 is kick/snare/closed- ' +
    'hat only - metal ticks at 13:41 and 15:27, an open hat at 14:24, a crash and toms at 16:0 ' +
    'and 16:52, open hats at 17:24 and 18:24. Eleven fills, no two alike, one at the end of every ' +
    '8-bar unit. GHOST SNARES at 4-6 against backbeats at 14-15, one tick behind the beat, and ' +
    'written RAW through a ghost() helper that is deliberately outside the mix lift: a uniform ' +
    'lift is the one correction that destroys the ghost layer it is lifting, and with the lift ' +
    'applied the ghosts sat at 7-8 under hits at 15, which is not a ghost but a quiet snare. 47 ' +
    'cells now sit in 3-6 where 3 did (G01 = 16.7 ms at speed 7, inside 2.7\'s two-tick ceiling); ' +
    'and NO FILL AT THE LOOP SEAM - the last half-bar of frame 19 has no drum at all. EFFECTS, ' +
    'decimal on disk: 0xy arpeggio 047 = 71, used only in `gate` to establish C major and ' +
    'cancelled with 000 at 0:50, because the reference document is explicit that an arpeggio bed ' +
    'is dropped once the harmony is established; 4xy vibrato 442 = 66 on the lead and 421 = 33 on ' +
    'the two held inner voices and 431 = 49 on the sawtooth\'s eight bars as the lead, always ' +
    'written three or four rows AFTER the note so it blooms rather than starts, and always ' +
    'cancelled with 4x0 on the next event; 732 = 50 tremolo on the 84-row held common tone at ' +
    '6:8, cancelled with 710 = 16 at 7:28 and never a bare 700, which replays the effect memory; ' +
    'A20 = 32 fade on the suspension at 4:8, cancelled at 4:12 by a cell carrying BOTH 400 and ' +
    'A00 - put() replaces a cell\'s whole effect list, so writing the A00 there alone deleted the ' +
    '400 the phrase had already placed and left the vibrato latched from 4:7 to 4:42; 318 = 24 ' +
    'portamento on the sawtooth at 12:36, cancelled with 100 at 12:42 because 300 would only ' +
    'FREEZE it; R24 = 36 and R23 = 35 phrase- end falls at 9:52 and 12:52, both written on an ' +
    'effect-only cell over a sounding note and both followed by a rest, so a slide that has not ' +
    'arrived cannot steal the next attack; G01 humanisation, one tick; Bxx the loop; no D00 ' +
    'anywhere in the piece. No Vxx: every melodic instrument here carries a duty macro, which ' +
    'overrides Vxx from the next tick, so a Vxx cell would be a write nothing reads. NO RAISED ' +
    'BOUND: the ' +
    'piece needs 3.0 % of its melodic notes outside C major against the 12 % default, its longest ' +
    'percussion gap is 14 rows with 97.9 % of played rows inside a gap of 8 or less against the ' +
    '80 % floor, and it clamps zero samples against the allowance of eight - so ' +
    'accidentalFractionMax, percussionGap, percussionCoverage, clippedSamplesMax and rmsRange are ' +
    'all left at their defaults, because an allowance a piece does not use is still a raised ' +
    'bound. HEADROOM, measured rather than asserted: the arrangement as first composed rendered ' +
    'at -22.02 dBFS over two passes, two dB under gate C\'s floor, because a staccato walk in 7/8 ' +
    'spends most of itself in five or six lanes and leaves the long group deliberately empty. ' +
    'Every written volume was lifted three column steps through one lv() helper (the triangle\'s ' +
    'gate and the DPCM lane are unaffected, being 15 and ignored respectively), the piece- ' +
    'specific instruments\' volume MACROS were raised about a step and a half so the level lives ' +
    'in the instrument bodies rather than in the columns, and the lead was trimmed two steps ' +
    'before the lift so the lift could not clamp its phrase arc: 81 % of pulse 1\'s attacks sat at ' +
    '15 without that trim and 11 % with it, over five distinct column values and the sawtooth\'s ' +
    'eight bars as the second lead were shifted down four first, so the loudest lane on the ' +
    'machine never exceeds 12: the saw\'s column is an accumulator rate and 15 there is about ' +
    'twice a pulse at 15. Two sections were then taken back DOWN, because a sustained voice ' +
    'carries more energy per note than a staccato one and the two thinnest sections were ' +
    'rendering as loud as the busiest: `hollow` and `broad` lost one to two steps on their held ' +
    'inner voices. 32 % of all note events sit at 15 - counting the triangle\'s gate and the DPCM ' +
    'lane, whose columns are a gate and an ignored field respectively; 21 % without them. The arc ' +
    'was then measured frame by frame and corrected twice more: 13:0-14:55 came down a column ' +
    'step on pulse 1 and VRC6 pulse 1 and the last four bars\' kit came down one, so `crest` ' +
    '(-18.30) now leads `climb` (-18.70) instead of trailing it by 0.05; and `broad`\'s release, ' +
    'which pulse 2\'s sixths alone moved by only 0.28 dB, took the quarter arch and the entering ' +
    'saw down with them until frame 7 sat 0.46 dB under `stile` and the section 1.21 dB under it. ' +
    'Final: -19.56 dBFS whole file, peak 0.891, zero clamped. Section range: -18.42 at `crest`, ' +
    '-18.56 at `stile`, -18.77 at `climb`, -19.77 at `broad`, -19.84 at `walk2`, -20.04 at ' +
    '`turn`, -20.10 at `hollow`, -20.63 at `walk`, -23.95 at `gate`. The floor was met by lifting ' +
    'the parts, never by re-gaining the render. ',
  renderChecksum: 1231770164,
})
s.check()
s.write('src/assets/songs/10-crooked-mile.json')
