#!/usr/bin/env node
/** 06 — Sunward Banner: the anthem. Heroic, melodic, eight voices.
 *
 *      node tools/songs/compose/06-sunward-banner.mjs
 *          -> src/assets/songs/06-sunward-banner.json  (the shipped artifact; never hand-edited)
 *
 *  Original music, invented for this project from the contour and harmony rules of
 *  docs/preset-suite.md §2.10 and §9.3. It names no game, no composer, no published piece.
 *
 *  GRID   tempo 150 · speed 6 -> 150 BPM, 16th-note rows, 16 rows a bar, 64 rows a frame
 *         (4 bars = 6.4 s). 23 frames; one pass ~2:29 including the coda's ritardando.
 *
 *  KEY    D major. Colour, in four different sections: (1) chained secondaries — E major
 *         (V/V) at 4:32 -> A (V) at 4:48, the lydian g#5 at 4:40, and then the V is
 *         QUITTED to IV (G at 5:0), the section's authentic cadence coming later at
 *         5:32-5:48; (2) modal interchange — borrowed bVI (Bb) and bVII (C) through the
 *         whole lift, 8:0-9:31; (3) an ITALIAN SIXTH on bVI at chorus 13:32 (bass Bb2,
 *         d4 in vrc6p2, g#4 in vrc6p1, d5 in the lead) resolving outward to A at 13:36 —
 *         bass falls a semitone, g# rises a semitone; (4) a true pivot modulation — the
 *         PIVOT CHORD is the A of 17:0-17:15, V in D and IV in E; the sequence turns
 *         chromatic over it at 17:16 and B7 is held from 17:32 to confirm the new key,
 *         and the final chorus is UP A WHOLE STEP in E major. The
 *         coda's E -> A7 -> D is a descending-fifths turnaround back into the loop, and
 *         `accidentalFractionMax` is declared at 0.2 to pay for all of it.
 *
 *  FORM   frame  section   bars   what happens
 *         0-1    fanfare    8     three-voice VRC6 chorale (V1 V2 SAW), 2A03 silent, with
 *                                 prepared 4-3s and a 9-8 at its first cadence; snare
 *                                 rolls, DPCM kick on 1 and 3, crash on the downbeats
 *         2-5    theme     16     THE TUNE on pulse 1, echo on pulse 2 three rows behind;
 *                                 the saw a WALKING 8th line that leans into every chord
 *                                 by step, the triangle's root and octave above it; 8th
 *                                 hats; the VRC6 thirds wait until bar 8 so the tune
 *                                 arrives on bare pulses               (loop frame 2)
 *         6-7    theme'     8     the tune's second phrase re-orchestrated onto the SAW
 *                                 (vol 11, bend-in attack); pulse 1 a descant a sixth
 *                                 above; pulse 2 rests; the triangle is the bass alone
 *         8-9    lift       8     bVI-bVII (Bb, C) as a 3+3 SIX-BAR phrase (the piece's
 *                                 asymmetry) whose HARMONIC RHYTHM DOUBLES — two bars a
 *                                 chord, then one — under a lead that climbs d5 e5 f5 g5,
 *                                 a saw walking in D aeolian and a 4-3 chain in the brass;
 *                                 8th -> 16th hats, then two bars of the dominant
 *         10-13  chorus    16     the big tune on a 6+6+4 tresillo; pulse 2 an INDEPENDENT
 *                                 counter-melody for the whole section; V1/V2 a two-voice
 *                                 chorale that holds common tones and hangs a 9-8 at the
 *                                 deceptive and the authentic cadence; the saw walks; all
 *                                 eight lanes on
 *         14-15  bridge     8     B minor, quiet: the tune's head INVERTED on pulse 1 at
 *                                 vol 9; the saw on a 6-row cell (3 against 4) under VRC6
 *                                 stabs; pulse 2, triangle and DPCM rest; the kit stops
 *                                 for the last bar — the piece's one metric surprise
 *         16-17  build      8     the head sequenced up a step a bar over a rising bass
 *                                 (d e f# g a b), the 6-row cell carried one more frame,
 *                                 then the saw walking into B7 under a snare roll
 *         18-21  chorus'   16     E major, entered on a 9-8 over the new tonic; the lead
 *                                 doubled in unison by VRC6 pulse 1 from 20:0; the
 *                                 counter-melody returns transposed; global peak c#6 at
 *                                 20:48; the kit at its busiest
 *         22     coda       4     the fanfare chorale in E, then A7 with an Fxx
 *                                 ritardando, and Bxx back to frame 2
 *
 *  MOTIF  the HEAD, two bars: the tonic an octave up (d5), a FALLING FOURTH to a4,
 *         two rising steps (b4 c#5), then an appoggiatura e5 on the downbeat resolving
 *         down to d5. Recurrences and variations: theme 2:0 (statement), 2:32 (its tail sequenced a step
 *         lower under a held tonic head, so the leap widens to a fifth), 4:0 (restated,
 *         then climbing to the section peak), theme' 6:0 (RE-ORCHESTRATED onto the sawtooth), chorus 10:0 (INVERTED —
 *         the falling fourth becomes a rising one — and re-rhythmed as 6+6+4), 12:0
 *         (the chorus head DISPLACED two rows late), bridge 14:0 (the inversion again, in
 *         B minor, quiet), build 16:0 (a true TRANSPOSITION sequence, up a step a bar),
 *         chorus' 18:0 (the whole chorus up a whole step, the lead doubled at 20:0).
 *
 *  METRE  §9.1. (a) Recipe D, a 6-row cell on the sawtooth carried across THREE frames —
 *         entry rows 14:0, 15:2, 16:4, the phase-carry table's own values — two bass
 *         attacks per three beats under a straight kit. (b) Recipe C, the 8th-level
 *         tresillo 6+6+4 that the whole chorus tune is built on (attacks at rows 0, 6, 12
 *         of every bar, 10:0 on), restated DISPLACED two rows late at 12:0 and 12:16
 *         (Recipe F).
 *         (c) the lift's 3+3 six-bar phrase, 8:0-9:31. The metric surprise: 15:48, where
 *         the kit stops for a whole bar and only the 6-row cell and the stabs continue.
 *
 *  BASS   the sawtooth WALKS wherever it is the bass (theme, lift, both choruses, the
 *         build's last four bars): root on the chord's first attack, chord tones on the
 *         beats, passing and neighbour notes only on the weak 8ths and only moving on by
 *         step, and the last attack before every chord change a step from the coming root.
 *         The octave leap it used to pump is kept as one gesture among ten named figures.
 *         `sawLine` enforces those rules and throws on a figure that breaks one. The
 *         fanfare and coda hold whole-bar roots and the bridge keeps its 6-row cell.
 *
 *  DRUMS  §9.4 signature: the kick on 1 and the 'and' of 2 (on 1 and 3 in the choruses),
 *         the snare on 2 and 4 doubled by the DPCM snare, and a vol-4 ghost on the last
 *         16th pushing into the next downbeat. Every section changes at least two of: hat
 *         subdivision (8ths -> off-beats -> 16ths -> none), hat instrument, kick
 *         placement, snare timbre (39 <-> 41) and ghost density. Seven fill shapes —
 *         roll, toms, push, burst, riser, rim and a written flam pair — placed so no two
 *         consecutive eight-bar seams close the same way, and a shape that returns comes
 *         back on the other snare (`toms` and `burst`) or, where it carries no snare at
 *         all, on other drums and other rows (`rim`). No fill bar is written twice.
 *
 *  HEADROOM (render gain 2.0; the VRC6 adds linearly, and a saw at 15 is twice a pulse at
 *         15). The saw never exceeds 11, the VRC6 pulses never exceed 9 under a full 2A03
 *         mix — the single 12 is in the fanfare, where the 2A03 is silent — and the lead's
 *         column tops out at 14, and it reaches it only in the lift's last bar and the
 *         two choruses. Measured at gain 2.0 over the two-pass render: unclamped peak
 *         0.889, 0 clamped samples, RMS -17.57 dBFS (re-measured after the bass became a
 *         line; it was 0.909 and -17.59 as a pump), longest exact-zero run 59 ms (a tom
 *         break, not a seam).
 */
import { CUT, L, REL, Song, n } from './lib.mjs'

const s = new Song({
  id: 'sunward-banner',
  name: 'Sunward Banner',
  author: 'pulsar original',
  speed: 6,
  rowsPerPattern: 64,
  rowHighlight: 4,
  rowHighlight2: 16,
})

// --- instruments ---------------------------------------------------------------------
// The lead is declared FIRST so instrument 0 is this piece's own voice: the album's
// distinctness gate compares each song's opening timbre, and a shared-bank instrument in
// slot 0 is a timbre another piece could also open with.

/** LEAD (2A03 pulse 1). A two-tick scoop from below (the macro's prefix sums to 0, so the
 *  note arrives in tune), a 25 % bite opening to a 50 % body, and a release tail so `===`
 *  ends a phrase instead of chopping it. Its vibrato is written by hand and delayed. */
const LEAD = s.instrument('lead', {
  volume: { values: [13, 15, 14, 13, 13, 13, 9, 6, 3, 0], loop: 5, release: 5 },
  duty: { values: [1, 1, 2, 2, 2], loop: 4 },
  pitch: { values: [6, -3, -2, -1, 0] },
})
/** COUNTER (2A03 pulse 2 in the choruses). A different singer, not a shadow: the round
 *  50 % duty against the lead's bite, and a softer front with no scoop. */
const COUNTER = s.instrument('counter', {
  volume: { values: [11, 13, 12, 12, 12, 8, 5, 2, 0], loop: 4, release: 4 },
  duty: { values: [2] },
})
/** BRASS (VRC6 pulses). The chip's own attack is a duty macro: 7 (the fat 50 % square)
 *  narrowing to 5, over a short swell, so a chord blooms rather than clicks. */
const BRASS = s.instrument('brass', {
  volume: { values: [9, 12, 15, 14, 13, 13, 13, 9, 5, 2, 0], loop: 6, release: 6 },
  duty: { values: [7, 7, 6, 5], loop: 3 },
})
/** REED (VRC6 pulses under a 2A03 lead). Duty 3 is the bright 25 %: it sits inside the
 *  mix without fighting the lead's own 25 % bite, because it never opens to 50 %. */
const REED = s.instrument('reed', {
  volume: { values: [12, 15, 14, 14, 14, 9, 4, 0], loop: 4, release: 4 },
  duty: { values: [3] },
})
/** STAB (VRC6 pulses, the bridge). One-shot, wide then thin — the chord is gone before
 *  the next 16th, which is what lets the 6-row cell underneath stay legible. */
const STAB = s.instrument('stab', {
  volume: { values: [15, 13, 10, 7, 4, 2, 0] },
  duty: { values: [7, 5, 3, 3] },
})
/** SAWBASS. A fast front and a settled body so a gallop of 8ths stays articulate. */
const SAWBASS = s.instrument('sawbass', {
  volume: { values: [15, 15, 13, 11, 10, 10], loop: 5, release: 5 },
})
/** SAWLEAD (theme'). The brass-like bend-in attack of §12.2: about 70 cents flat at the
 *  strike, arriving in tune over eight ticks. The prefix sums to 0 — pitch accumulates. */
const SAWLEAD = s.instrument('sawlead', {
  volume: { values: [12, 14, 15, 15, 14, 14, 13, 13, 9, 5, 2, 0], loop: 7, release: 7 },
  pitch: { values: [12, -3, -3, -2, -2, -1, -1, 0] },
})
/** ROLL (noise). Short, and its pitch macro walks the period index DOWN, so a roll rises
 *  in pitch as its volume column rises. Note 40 is index 7; the macro takes it to 5. */
const ROLL = s.instrument('roll', {
  volume: { values: [13, 11, 8, 5, 2, 0] },
  pitch: { values: [-1, -1, 0] },
  duty: { values: [0] },
  note: 40,
})
/** TOM (noise). A deeper period drop than the bank's tom, for the fills at the seams. */
const TOM = s.instrument('tom', {
  volume: { values: [15, 14, 12, 10, 8, 6, 4, 2, 0] },
  pitch: { values: [2, 2, 1, 1, 0] },
  duty: { values: [0] },
  note: 39,
})

// Shared bank, by name and byte-identical to the fixture (§3.1).
const [HARM, ECHO, BASS, BASS_SHORT, KICK, SNARE, HAT, HAT_OPEN, CRASH, METAL] =
  s.bank('harm-soft', 'echo-thin', 'bass', 'bass-short', 'kick', 'snare', 'hat-closed',
    'hat-open', 'crash', 'metal')
// The snare's timbre is its NOTE, not a second instrument: 39 is the mid-band body and 41
// the cracking backbeat (§2.6's kit table, index 8 and 6). Sections swap between them.
const SNARE_LO = 39
const SNARE_HI = 41
const KIT = s.dpcmKit() // the generated kick (36) and snare (39) on the dpcm lane

// --- helpers -------------------------------------------------------------------------

/** A held note on any lane: the attack, then a release `len` rows later so the
 *  instrument's own tail ends it and nothing rings into the next chord (§2.9 rule 4). */
function hold(sec, lane, inst, vol, bar, row, note, len, fx) {
  const fields = { note: n(note), inst, vol }
  if (fx !== undefined) fields.fx = fx
  sec.put(lane, sec.at(bar, row), fields)
  const end = sec.at(bar, row) + len
  if (end < sec.len) sec.put(lane, end, { note: REL })
}

/** SAWTOOTH BASS — a written line, not a root and its octave.
 *
 *  The piece first shipped with the saw pumping each root and its octave in 8ths: 58 % of
 *  its bars held exactly two pitches and 7 % of its motion moved by step, which is the
 *  sound of a bass nobody wrote. Its RHYTHM was right, and it is unchanged — every attack
 *  row and every volume is where it was — so everything below only chooses pitches, and
 *  it chooses them the way a bass player does:
 *
 *   1. the chord's root on the chord's first attack (the downbeat, or beat 3 of a split);
 *   2. chord tones on the beats, rows 0 4 8 12, so the harmony is never in doubt;
 *   3. the weak 8ths, rows 2 6 10 14, free to pass, to neighbour or to lean — a note off
 *      the chord is allowed only there, and only if the next note is a step away;
 *   4. and the last attack before every chord change a STEP from the coming root — a
 *      tone or a semitone, diatonic or chromatic, from above or below. The line always
 *      knows where it is going next, which is what makes it a line.
 *
 *  The octave leap that WAS the whole bass survives as one gesture among several: about
 *  one bar in two still jumps to the octave, and then walks back down instead of jumping.
 *
 *  A bar is written as a FIGURE, a list of tokens read over the bar's chord and scale:
 *    R 3 5 8     chord tones above the root: root, third, fifth, octave
 *    5- 3-       the fifth / third BELOW the root, for a line that turns downward
 *    p           a passing tone: the one scale step between the notes either side of it
 *    u  l        upper / lower diatonic neighbour of the note before
 *    A           approach the next root by diatonic step from the side the line is on;
 *                if that step is the note already sounding, the chromatic semitone on the
 *                same side; if that is too, the diatonic step from the other side
 *    A+ A-       approach from above / below by diatonic step
 *    C+ C-       approach from above / below by a chromatic semitone
 *  `sawLine` throws on a figure that breaks rule 1, 3 or 4, so the rules are enforced by
 *  the generator rather than hoped for; `check()` still owns the saw's MIDI-24 floor.
 */
const PC = { c: 0, 'c#': 1, d: 2, 'd#': 3, e: 4, f: 5, 'f#': 6, g: 7, 'g#': 8, a: 9, 'a#': 10, b: 11 }
const scale = (...names) => names.map((name) => PC[name])
const D_MAJOR = scale('d', 'e', 'f#', 'g', 'a', 'b', 'c#')
const D_LYDIAN = scale('d', 'e', 'f#', 'g#', 'a', 'b', 'c#') // the V/V bar: E major's g#
const D_AEOLIAN = scale('d', 'e', 'f', 'g', 'a', 'a#', 'c') // the lift's borrowed bVI and bVII
const E_MAJOR = scale('e', 'f#', 'g#', 'a', 'b', 'c#', 'd#') // the build's B and B7, V of E
const QUALITY = { maj: [0, 4, 7], min: [0, 3, 7], dom7: [0, 4, 7, 10] }
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14]
const FIRST_HALF = [0, 2, 4, 6]
const SECOND_HALF = [8, 10, 12, 14]

/** The bar figures, named for what the line does. Each is eight tokens on the 8ths. */
const FIG = {
  // the old octave kept as a gesture: a neighbour above the root, the leap on the 'and'
  // of 2, then down the triad through a passing tone and in by step
  leap: ['R', 'u', 'R', '8', '5', 'p', '3', 'A'],
  // the same with the neighbour BELOW the root, for a bar whose upper voices hold the
  // second degree, which the bass must not double
  dip: ['R', 'l', 'R', '8', '5', 'p', '3', 'A'],
  // up the scale to the fifth, an upper neighbour, and in
  climb: ['R', 'p', '3', 'p', '5', 'u', '5', 'A'],
  // the octave at once, then the whole way down the scale to the root, and in
  fall: ['R', '8', '5', 'p', '3', 'p', 'R', 'A'],
  // a turn around the root, above and below, then up the triad, and in
  turn: ['R', 'u', 'R', 'l', 'R', '3', '5', 'A'],
  // up the triad to the octave and back down it, and in
  arch: ['R', 'p', '3', '5', '8', '5', '3', 'A'],
  // up the scale to the fifth and back down it to the third, and in
  wave: ['R', 'p', '3', 'p', '5', 'p', '3', 'A'],
  // up the triad, then down through the root to the third below, and in
  cascade: ['R', '3', '5', '3', 'R', '5-', '3-', 'A'],
  // up the scale to the fifth, back down the triad to the root, and in
  rise: ['R', 'p', '3', 'p', '5', '3', 'R', 'A'],
  // the octave at once, down the triad and on below the root, and in
  plunge: ['R', '8', '5', '3', 'R', '5-', '3-', 'A'],
}
/** A figure with its last token — the lean into the next root — chosen for this bar. */
const lean = (figure, token) => [...figure.slice(0, -1), token]
/** Half-bar figures, four tokens, for the chorus bars that carry two chords. */
const HALF = {
  step: ['R', 'p', '3', 'A'], // root, passing tone, third, lean into the next root
  octave: ['R', '8', '5', 'A'], // the octave, down to the fifth, and across into the next
  triad: ['R', '3', '5', 'A'], // straight up the triad, and in
}
/** The lift's six-attack `drive` rhythm, rows 0 4 6 8 12 14: quarters plus the two
 *  off-8ths, so the saw is never in lockstep with the triangle's plain quarters. */
const DRIVE_ROWS = [0, 4, 6, 8, 12, 14]
const DRIVE = {
  rise: ['R', '3', 'p', '5', '3', 'A'], // third, passing tone, fifth, back to the third
  octave: ['R', 'R', '8', '5', '3', 'A'], // the octave on the 'and' of 2, then down the triad
  low: ['R', '5-', 'u', '5-', 'R', 'A'], // down to the fifth below, a neighbour, home
  peak: ['R', '5', 'u', '5', 'R', 'A'], // up to the fifth, its upper neighbour, home
}

const pcOf = (midi) => ((midi % 12) + 12) % 12
function stepAbove(pcs, midi) {
  for (let m = midi + 1; ; m++) if (pcs.includes(pcOf(m))) return m
}
function stepBelow(pcs, midi) {
  for (let m = midi - 1; ; m--) if (pcs.includes(pcOf(m))) return m
}

/** Resolve one span — one chord — into MIDI notes. `target` is the root that follows.
 *  Chord tones first, then everything that depends on its neighbours, left to right. */
function resolveSpan(where, root, quality, pcs, figure, target) {
  const r = n(root)
  const shape = QUALITY[quality]
  const chord = shape.map((i) => pcOf(r + i))
  for (const pc of chord) {
    if (!pcs.includes(pc)) throw new Error(`${where}: chord tone ${pc} of ${root} ${quality} is not in the scale`)
  }
  if (figure[0] !== 'R') throw new Error(`${where}: a span opens on its root`)
  const TONE = { R: 0, 3: shape[1], 5: 7, 8: 12, '5-': -5, '3-': shape[1] - 12 }
  const out = figure.map((token) => (token in TONE ? r + TONE[token] : null))
  figure.forEach((token, i) => {
    if (out[i] !== null) return
    const prev = out[i - 1]
    if (prev === undefined || prev === null) throw new Error(`${where}: '${token}' needs a note before it`)
    if (token === 'p') {
      const next = out[i + 1]
      if (next === undefined || next === null) throw new Error(`${where}: 'p' needs a chord tone after it`)
      const between = []
      for (let m = Math.min(prev, next) + 1; m < Math.max(prev, next); m++) if (pcs.includes(pcOf(m))) between.push(m)
      if (between.length !== 1) throw new Error(`${where}: 'p' between ${prev} and ${next} is not one scale step`)
      out[i] = between[0]
    } else if (token === 'u') out[i] = stepAbove(pcs, prev)
    else if (token === 'l') out[i] = stepBelow(pcs, prev)
    else if (token === 'C+') out[i] = target + 1
    else if (token === 'C-') out[i] = target - 1
    else if (token === 'A+') out[i] = stepAbove(pcs, target)
    else if (token === 'A-') out[i] = stepBelow(pcs, target)
    else if (token === 'A') {
      const above = prev > target
      const diatonic = above ? stepAbove(pcs, target) : stepBelow(pcs, target)
      const chromatic = target + (above ? 1 : -1)
      const across = above ? stepBelow(pcs, target) : stepAbove(pcs, target)
      out[i] = diatonic !== prev ? diatonic : chromatic !== prev ? chromatic : across
    } else throw new Error(`${where}: unknown token '${token}'`)
  })
  return { notes: out, chord }
}

/** Write the saw's line for one bar. `spans` has one entry per chord in the bar,
 *  `{ root, quality, scale, figure, rows }` (rows default to the eight 8ths), and `next`
 *  is the root the bar leans into. `t` transposes all of it, scale included. */
function sawLine(sec, bar, spans, next, { vol, t = 0 }) {
  const written = []
  spans.forEach((span, k) => {
    const target = n(k + 1 < spans.length ? spans[k + 1].root : next) + t
    const where = `${sec.name} bar ${bar} span ${k}`
    const rows = span.rows ?? EIGHTHS
    if (rows.length !== span.figure.length) throw new Error(`${where}: ${rows.length} rows, ${span.figure.length} tokens`)
    const pcs = span.scale.map((pc) => (pc + t) % 12)
    const { notes, chord } = resolveSpan(where, n(span.root) + t, span.quality, pcs, span.figure, target)
    notes.forEach((note, i) => written.push({ row: rows[i], note, chord, where, target, last: i === notes.length - 1 }))
  })
  written.forEach(({ row, note, chord, where, target, last }, i) => {
    const following = i + 1 < written.length ? written[i + 1].note : target
    if (!chord.includes(pcOf(note))) {
      if (row % 4 !== 2) throw new Error(`${where}: non-chord tone ${note} on beat row ${row}`)
      const d = Math.abs(following - note)
      if (d < 1 || d > 2) throw new Error(`${where}: non-chord tone ${note} at row ${row} does not move on by step`)
    }
    const d = Math.abs(target - note)
    if (last && (d < 1 || d > 2)) throw new Error(`${where}: ends on ${note}, not a step from the next root ${target}`)
    sec.put(L.SAW, sec.at(bar, row), { note, inst: SAWBASS, vol })
  })
}
/** One bar, one chord: the common case. */
const walk = (sec, bar, root, quality, pcs, figure, next, opts) =>
  sawLine(sec, bar, [{ root, quality, scale: pcs, figure }], next, opts)

/** Triangle. 'double' states the bar's root an octave above the saw's, in quarters, with
 *  its own octave on beat 3, while the saw walks beneath; 'lead' is the triangle as
 *  the bass on its own, in detached 8ths with its own octave leap; 'hold' is one note. */
function triBar(sec, bar, root, style, opts = {}) {
  const r = n(root) + (opts.octave ?? 12)
  const put = (row, note, inst = BASS) => sec.put(L.TRI, sec.at(bar, row), { note, inst, vol: 15 })
  if (style === 'double') {
    for (const row of [0, 4, 8, 12]) put(row, row === 8 ? r + 12 : r)
  } else if (style === 'split') {
    const r2 = n(opts.second) + (opts.octave ?? 12)
    for (const [row, note] of [[0, r], [4, r + 12], [8, r2], [12, r2 + 12]]) put(row, note)
  } else if (style === 'lead') {
    for (const [row, note] of [[0, r], [2, r], [4, r + 12], [6, r], [8, r], [10, r + 12], [12, r], [14, r + 12]]) {
      put(row, note, BASS_SHORT)
    }
  } else if (style === 'hold') {
    put(0, r)
  }
  if (opts.approach !== undefined) put(14, n(opts.approach) + (opts.octave ?? 12), BASS_SHORT)
  if (opts.restAt !== undefined) sec.put(L.TRI, sec.at(bar, opts.restAt), { note: CUT })
}

/** The seven fills, one per shape, so no two 8-bar seams close the same way (§9.4). Each
 *  owns the bar's last half; `drumBar` suppresses the ordinary kit there.
 *
 *  A shape that returns comes back CHANGED, and `alt` is where that is written: three of
 *  the seven are used twice, and without it the two instances are byte-identical rows —
 *  a returning fill that is literally the same bar is a copy, not a reprise. `alt` moves
 *  the shape onto the other snare (39 <-> 41), or, where the shape carries no snare,
 *  onto other drums and other rows. */
const other = (snare) => (snare === SNARE_HI ? SNARE_LO : SNARE_HI)
const FILLS = {
  // a snare roll thickening from 8ths to 16ths, 7 -> 13
  roll: (hit, ds, _dk, snare) => {
    for (let i = 0; i < 4; i++) hit(8 + 2 * i, SNARE, 7 + 2 * i, snare)
    hit(9, SNARE, 5, snare); hit(11, SNARE, 6, snare); hit(13, SNARE, 8, snare)
    hit(15, SNARE, 13, SNARE_HI); ds(8); ds(14)
  },
  // a tom run down the kit, high to low, snare on the last 16th. `alt` runs a wider
  // spread of toms, one hit later, and lands on the other snare.
  toms: (hit, ds, dk, snare, alt) => {
    if (alt) {
      hit(8, TOM, 14, 44); hit(10, TOM, 13, 42); hit(12, TOM, 12, 40); hit(13, TOM, 14, 38)
      hit(14, TOM, 13, 36); hit(15, SNARE, 12, other(snare)); dk(12); ds(15)
      return
    }
    hit(8, TOM, 14, 43); hit(10, TOM, 13, 43); hit(11, TOM, 12, 41); hit(12, TOM, 14, 37)
    hit(14, TOM, 13, 37); hit(15, SNARE, 12, snare); dk(12); ds(15)
  },
  // open hats pushing the off-beats, a light snare answer
  push: (hit, ds, dk, snare) => {
    hit(8, KICK, 12, 36); hit(10, HAT_OPEN, 9, 46); hit(12, SNARE, 13, snare)
    hit(14, HAT_OPEN, 9, 46); hit(15, SNARE, 9, SNARE_HI); dk(8); ds(12)
  },
  // a 16th burst on the last beat only. `alt` puts it on the other snare and starts it a
  // 16th earlier, so the burst is five hits instead of four.
  burst: (hit, ds, dk, snare, alt) => {
    const s = alt ? other(snare) : snare
    hit(8, KICK, 12, 36)
    if (alt) hit(11, SNARE, 7, s)
    hit(12, SNARE, 13, s); hit(13, SNARE, 8, s)
    hit(14, SNARE, 11, s); hit(15, SNARE, 14, s); dk(8); ds(12); ds(14)
  },
  // a riser: the ROLL instrument's pitch macro climbs while the column does
  riser: (hit, ds) => {
    for (let i = 0; i < 8; i++) hit(8 + i, ROLL, 5 + i, 36 + i)
    ds(15)
  },
  // the metal tick (noise mode 1) against two kicks — the driest fill in the piece. It
  // carries no snare, so `alt` changes what it does change: the ticks move to a higher
  // period index and onto different rows, and the kick lands on the last 16th instead.
  rim: (hit, ds, dk, _snare, alt) => {
    if (alt) {
      hit(8, METAL, 11, 43); hit(9, METAL, 9, 43); hit(11, METAL, 12, 44)
      hit(13, METAL, 10, 43); hit(15, KICK, 13, 36); dk(15); ds(11)
      return
    }
    hit(8, METAL, 11, 44); hit(10, METAL, 9, 44); hit(11, METAL, 12, 44)
    hit(12, KICK, 13, 36); hit(14, METAL, 10, 44); dk(12); ds(15)
  },
  // written flams: a quiet grace strike a 16th before each accent. At 150 BPM a Gxx
  // tick reads as timbre rather than time (§2.7), so the flam is spelled out in rows.
  flam: (hit, ds, dk, snare) => {
    hit(8, KICK, 13, 36); hit(9, SNARE, 7, snare); hit(10, SNARE, 13, snare)
    hit(12, TOM, 13, 43); hit(13, SNARE, 6, snare); hit(14, SNARE, 14, snare)
    dk(8); ds(10); ds(14)
  },
}

/** One bar of kit: noise plus the DPCM pair. The signature is kick on 1 and the 'and' of
 *  2, snare on 2 and 4 layered with the DPCM snare, and a vol-4 ghost on the last 16th
 *  pushing into the next downbeat. `hats` picks the subdivision, `snare` the timbre note,
 *  `fill` one of the six shapes above for the bar's last half. */
function drumBar(sec, bar, opts = {}) {
  const {
    hats = '8ths', kick = [0, 6], snare = SNARE_LO, dpcm = true, ghosts = [10, 15],
    fill = null, fillAlt = false, crash = false, hatVol = 0, dpcmKick = null,
  } = opts
  const hit = (row, inst, vol, note) => sec.put(L.NOISE, sec.at(bar, row), { note, inst, vol })
  const dk = (row) => sec.put(L.DPCM, sec.at(bar, row), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  const ds = (row) => sec.put(L.DPCM, sec.at(bar, row), { note: KIT.snare, inst: KIT.inst, vol: 12 })
  const limit = fill === null ? 16 : 8
  const rows = hats === '16ths' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    : hats === '8ths' ? [0, 2, 4, 6, 8, 10, 12, 14]
      : hats === 'off' || hats === 'open' ? [2, 6, 10, 14] : []
  for (const row of rows) {
    if (row >= limit) continue
    const open = hats === 'open' && (row === 6 || row === 14)
    const vol = (hats === '16ths' ? (row % 4 === 0 ? 8 : row % 2 === 0 ? 6 : 4) : row % 4 === 0 ? 8 : 6) + hatVol
    hit(row, open ? HAT_OPEN : HAT, vol, open ? 46 : 45)
  }
  const doubled = dpcmKick ?? kick
  for (const row of kick) if (row < limit) { hit(row, KICK, row === 0 ? 13 : 12, 36); if (dpcm && doubled.includes(row)) dk(row) }
  for (const row of [4, 12]) if (row < limit) { hit(row, SNARE, 13, snare); if (dpcm) ds(row) }
  if (fill === null) for (const row of ghosts) hit(row, SNARE, 4, snare)
  if (crash) hit(0, CRASH, 12, 46)
  if (fill !== null) FILLS[fill](hit, dpcm ? ds : () => {}, dpcm ? dk : () => {}, snare, fillAlt)
}

/** `line()` with DELAYED vibrato (§2.5, "the professional move"): an event written with a
 *  `4xy` gets its note straight and the effect two rows later, so the tone blooms instead
 *  of wobbling from the attack, and `400` cancels it on the next event. A note too short
 *  to bloom is left straight. Everything else is an ordinary `line()` event. */
function sing(sec, lane, inst, vol, events, delay = 2) {
  sec.line(lane, inst, vol, events.map(([bar, row, note]) => [bar, row, note]))
  events.forEach(([bar, row, , cmd, param], i) => {
    if (cmd !== '4') return
    const at = sec.at(bar, row) + delay
    const next = events[i + 1]
    const nextAt = next === undefined ? sec.len : sec.at(next[0], next[1])
    if (at >= nextAt) return
    sec.put(lane, at, { fx: [['4', param]] })
    const cancelAt = next === undefined ? sec.len - 1 : nextAt
    const cell = sec.lanes[lane][cancelAt]
    if (cell === null || cell.fx === undefined) sec.put(lane, cancelAt, { fx: [['4', 0]] })
  })
}

/** `echo()` copies attacks only, so the echo would keep singing through the lead's rests.
 *  Copy the rests too, `delay` rows behind: the echo speaks INTO the rest and then stops,
 *  which is the whole point of §2.10's "every phrase ends with a beat of rest". */
function echoCuts(sec, from, to, delay) {
  for (let r = 0; r < sec.len - delay; r++) {
    const c = sec.lanes[from][r]
    if (c !== null && c.note === CUT && sec.lanes[to][r + delay] === null) sec.put(to, r + delay, { note: CUT })
  }
}

// =====================================================================================
// FANFARE — frames 0-1, 8 bars. The VRC6 alone as a brass section: V1 on top, V2 in the
// middle, the sawtooth as the bass, one chord a bar. The 2A03 pulses and the triangle are
// silent for the whole section — their entrance IS the theme's downbeat, and a section
// with three lanes resting is the piece's first dynamic (§2.8). A 4-3 suspension in bars
// 2 and 6: d5 is prepared as a chord tone of G (V1 climbs to it at 0:24 and at 1:16),
// held over the A chord, and steps down to c#5. And a 9-8 at the first cadence, bar 3:
// V2 keeps the A's e4 over the D and falls to d4 (0:48 -> 0:52). Chords: D G A(4-3)
// D(9-8) | Bm G A(4-3) A. Kit: DPCM kick on 1 and 3 with the noise
// kick under it, crash on the downbeats of bars 0 and 4, an 8th roll in bar 3 and a
// whole-bar 16th roll in bar 7 that hands over to the tune.
// =====================================================================================
const fanfare = s.section('fanfare', 8)
{
  // [bar, saw bass, V2 middle, V1 top, the suspension's resolution]
  // A voice is one note for the bar, or a list of [row, note, end?] moves inside it, each
  // held until the next move (or `end`). Two voices move inside a bar, both for a
  // suspension. Bar 1's top voice climbs b4 -> d5 on beat 3 and HOLDS it to the barline,
  // so the d5 of bar 2 is prepared — consonant as the fifth of G at 0:24, a fourth over
  // the A at 0:32, resolving to c#5 at 0:36 — rather than leapt onto. And bar 3's middle
  // voice re-strikes bar 2's e4 (the fifth of A, 0:32) over the D: a 9-8 at the chorale's
  // first cadence, e4 at 0:48 falling to the root d4 at 0:52, then up to the third, f#4.
  const chorale = [
    [0, 'd2', 'f#4', 'a4'], [1, 'g2', 'g4', [[0, 'b4'], [8, 'd5', 16]]], [2, 'a2', 'e4', 'd5', 'c#5'],
    [3, 'd2', [[0, 'e4'], [4, 'd4'], [8, 'f#4']], 'd5'],
    [4, 'b2', 'f#4', 'd5'], [5, 'g2', 'g4', 'd5'], [6, 'a2', 'e4', 'd5', 'c#5'], [7, 'a2', 'g4', 'c#5', 'e5'],
  ]
  const voice = (lane, bar, part, len) => {
    const moves = Array.isArray(part) ? part : [[0, part]]
    moves.forEach(([row, note, end], i) => {
      hold(fanfare, lane, BRASS, 9, bar, row, note, (end ?? moves[i + 1]?.[0] ?? len) - row)
    })
  }
  for (const [bar, bass, mid, top, resolution] of chorale) {
    const len = bar === 7 ? 15 : bar === 2 || bar === 6 ? 16 : 12 // breathe, except through a suspension
    hold(fanfare, L.SAW, SAWBASS, 10, bar, 0, bass, len)
    voice(L.V2, bar, mid, len)
    if (resolution === undefined) voice(L.V1, bar, top, len)
    else {
      fanfare.put(L.V1, fanfare.at(bar, 0), { note: n(top), inst: BRASS, vol: 9 })
      hold(fanfare, L.V1, BRASS, bar === 7 ? 12 : 9, bar, bar === 7 ? 8 : 4, resolution, bar === 7 ? 7 : len - 4)
    }
  }
  // bar 7, over the dominant: the brass swells under the roll. A01 climbs an eighth of a
  // volume step a tick, so a column of 7 reaches about 13 by row 8, where A00 holds it.
  fanfare.put(L.V1, fanfare.at(7, 0), { vol: 7, fx: [['A', 1]] })
  fanfare.put(L.V2, fanfare.at(7, 0), { vol: 7, fx: [['A', 1]] })
  fanfare.fx(L.V1, 7, 8, 'A', 0)
  fanfare.put(L.V2, fanfare.at(7, 8), { fx: [['A', 0]] })
  for (const lane of [L.V1, L.V2, L.SAW]) fanfare.put(lane, fanfare.at(7, 15), { note: CUT })

  for (let bar = 0; bar < 8; bar++) {
    for (const row of [0, 8]) {
      fanfare.put(L.DPCM, fanfare.at(bar, row), { note: KIT.kick, inst: KIT.inst, vol: 12 })
      fanfare.put(L.NOISE, fanfare.at(bar, row), { note: 36, inst: KICK, vol: 11 })
    }
  }
  for (const bar of [0, 4]) fanfare.put(L.NOISE, fanfare.at(bar, 0), { note: 46, inst: CRASH, vol: 12 })
  for (let i = 0; i < 4; i++) fanfare.put(L.NOISE, fanfare.at(3, 8 + 2 * i), { note: 40, inst: ROLL, vol: 6 + 2 * i })
  for (let row = 0; row < 16; row++) {
    fanfare.put(L.NOISE, fanfare.at(7, row), { note: 40, inst: ROLL, vol: Math.min(15, 5 + Math.floor(row * 0.7)) })
  }
  for (const row of [12, 14]) fanfare.put(L.DPCM, fanfare.at(7, row), { note: KIT.snare, inst: KIT.inst, vol: 12 })
}

// =====================================================================================
// THE TUNE — written first and made to stand alone on one pulse with no accompaniment.
// Sixteen bars, two eight-bar phrases, 91 % of its intervals stepwise or a small leap.
//
// Phrase 1. The HEAD (bars 0-1): d5 held through the beat, a FALLING FOURTH to a4, two
// rising steps b4 c#5, then the appoggiatura e5 on the downbeat resolving down to d5.
// Bars 2-3 sequence that tail a step lower under a held tonic head, widening the leap
// to a fifth. Bars 4-7 answer with a long descent f#5 -> a4 and a rise back to the half
// cadence on c#5 over A.
//
// Phrase 2. The head returns (bars 8-9), then climbs e5 f#5 g#5 — the lydian fourth, and
// the third of the E major that is V/V — to the section's one peak, a5, on the downbeat
// of bar 11 over the dominant. Bars 12-15 fall home: d5 is left hanging from bar 13 over
// the A chord (a written 4-3 suspension) and resolves to c#5, then rises b4 c#5 d5 into
// the perfect cadence while the bass falls a2 -> d2 — contrary motion at the cadence.
// Every phrase ends with at least a beat of rest, which is where the echo speaks.
//
// `t` transposes the whole tune; `bars` is an inclusive range so the second phrase can be
// reused on its own. A trailing `'4', xy` on an event asks `sing()` for delayed vibrato.
// =====================================================================================
function theTune(t = 0, bars = [0, 15]) {
  const rows = [
    /*  0 */ [[0, 'd5'], [6, 'a4'], [8, 'b4'], [12, 'c#5']],
    /*  1 */ [[0, 'e5'], [4, 'd5', '4', 0x42], [12, '---']],
    /*  2 */ [[0, 'd5'], [6, 'g4'], [8, 'a4'], [12, 'b4']],
    /*  3 */ [[0, 'd5'], [4, 'c#5', '4', 0x42], [12, '---']],
    /*  4 */ [[0, 'f#5'], [6, 'e5'], [8, 'd5'], [12, 'c#5']],
    /*  5 */ [[0, 'b4'], [4, 'a4', '4', 0x42], [12, '---']],
    /*  6 */ [[0, 'g4'], [6, 'a4'], [8, 'b4'], [12, 'c#5']],
    /*  7 */ [[0, 'e5'], [6, 'd5'], [8, 'c#5', '4', 0x42], [12, '---']],
    /*  8 */ [[0, 'd5'], [6, 'a4'], [8, 'b4'], [12, 'c#5']],
    /*  9 */ [[0, 'e5'], [4, 'd5', '4', 0x42], [12, '---']],
    /* 10 */ [[0, 'e5'], [4, 'f#5'], [8, 'g#5', '4', 0x42]],
    /* 11 */ [[0, 'a5', '4', 0x43], [8, 'f#5'], [12, 'e5']],
    /* 12 */ [[0, 'd5'], [6, 'b4'], [8, 'c#5'], [12, 'd5']],
    /* 13 */ [[0, 'f#5', '4', 0x42], [8, 'e5'], [12, 'd5']],
    /* 14 */ [[4, 'c#5'], [8, 'b4'], [12, 'c#5']], // d5 hangs over from bar 13: the 4-3
    /* 15 */ [[0, 'd5', '4', 0x43], [12, '---']],
  ]
  const out = []
  for (let bar = bars[0]; bar <= bars[1]; bar++) {
    for (const [row, note, cmd, param] of rows[bar]) {
      out.push([bar - bars[0], row, note === '---' ? '---' : n(note) + t, cmd, param])
    }
  }
  return out
}

// =====================================================================================
// THEME — frames 2-5, 16 bars, the loop target. Pulse 1 sings the tune at 13. Pulse 2 is
// its echo three rows behind at 8 on the thin 12.5 % duty (§2.2), silenced three rows
// after each rest so it answers into the gap rather than smearing across it; four frames
// of echo is well inside §9.2's one-third budget. The sawtooth WALKS in 8ths — root on the
// downbeat, chord tones on the beats, passing and neighbour notes between, and every bar
// leaning into the next root by step — while the triangle keeps the plain root and octave
// in quarters above it, so the pair is an outline and a line. V1/V2 sustain diatonic thirds
// on the reed, a sixth and more below the tune, and V2 writes the cadential 4-3 in bar 14.
// Chords: D D G A | Bm F#m G A(half) | D Bm E(V/V) A | G F#m A(4-3) D.
// Kit: 8th hats, the signature, the roll fill at bar 7 and the tom run at bar 15.
// =====================================================================================
const theme = s.section('theme', 16)
{
  sing(theme, L.P1, LEAD, 13, theTune())
  theme.echo(L.P1, L.P2, 3, ECHO, 8)
  echoCuts(theme, L.P1, L.P2, 3)
  const bass = [
    ['d2'], ['d2'], ['g2'], ['a2', 'a#2'], ['b2'], ['f#2'], ['g2'], ['a2', 'c#2'],
    ['d2'], ['b2', 'd#2'], ['e2'], ['a2', 'g#2'], ['g2'], ['f#2'], ['a2', 'c#2'], ['d2'],
  ]
  bass.forEach(([root, approach], bar) => triBar(theme, bar, root, 'double', { approach }))
  // The saw's line, [quality, scale, figure] a bar over the roots above. Where the triangle
  // has an approach note (bars 3 7 9 11 14) the saw leans in on the same pitch class, so
  // the two bass lanes never approach one root from two different notes.
  const line = [
    // d2 e2 d2 d3 a2 g2 f#2 e2 — the octave kept on the 'and' of 2, then down into d
    /*  0 D   */ ['maj', D_MAJOR, FIG.leap],
    // d2 e2 f#2 g2 a2 b2 a2 f#2 — a scale up against the tune's falling e5 d5, in on f#
    /*  1 D   */ ['maj', D_MAJOR, lean(FIG.climb, 'A-')],
    // g2 a2 g2 g3 d3 c#3 b2 g2 — the octave again, walking down, in on the root below a
    /*  2 G   */ ['maj', D_MAJOR, lean(FIG.leap, 'A-')],
    // a2 b2 c#3 e3 a3 e3 c#3 a#2 — the triad's arch, then the chromatic a# into Bm
    /*  3 A   */ ['maj', D_MAJOR, lean(FIG.arch, 'C-')],
    // b2 c#3 d3 e3 f#3 d3 b2 g2 — up to the fifth under the tune's long descent, in from g
    /*  4 Bm  */ ['min', D_MAJOR, FIG.rise],
    // f#2 g2 a2 b2 c#3 d3 c#3 a2 — a climb that steps back over a into G
    /*  5 F#m */ ['min', D_MAJOR, FIG.climb],
    // g2 a2 b2 d3 g3 d3 b2 g2 — rises with the tune's g a b c#, turns away, in from g
    /*  6 G   */ ['maj', D_MAJOR, lean(FIG.arch, 'A-')],
    // a2 a3 e3 d3 c#3 b2 a2 e2 — the half cadence falls a whole octave and steps onto d
    /*  7 A   */ ['maj', D_MAJOR, FIG.fall],
    // d2 e2 d2 d3 a2 g2 f#2 a2 — bar 0's opening, because the head returns; in on a to b
    /*  8 D   */ ['maj', D_MAJOR, FIG.leap],
    // b2 d3 f#3 d3 b2 f#2 d2 d#2 — down the Bm triad and chromatically up into the E
    /*  9 Bm  */ ['min', D_MAJOR, lean(FIG.cascade, 'C-')],
    // e2 f#2 g#2 a2 b2 c#3 b2 g#2 — the V/V bar climbs its own lydian scale, g# into a
    /* 10 E   */ ['maj', D_LYDIAN, lean(FIG.climb, 'A-')],
    // a2 a3 e3 d3 c#3 b2 a2 g#2 — the peak bar falls an octave, g# sliding down to g
    /* 11 A   */ ['maj', D_MAJOR, lean(FIG.fall, 'C+')],
    // g2 a2 g2 f#2 g2 b2 d3 g2 — a turn around g, then the triad, stepping down to f#
    /* 12 G   */ ['maj', D_MAJOR, FIG.turn],
    // f#2 f#3 c#3 b2 a2 g2 f#2 b2 — down the octave and in from above, b to a
    /* 13 F#m */ ['min', D_MAJOR, lean(FIG.fall, 'A+')],
    // a2 b2 c#3 e3 a3 e3 c#3 c#2 — no d under the 4-3; the leading tone dropped an octave
    /* 14 A   */ ['maj', D_MAJOR, lean(FIG.arch, 'A-')],
    // d2 e2 f#2 g2 a2 b2 a2 c#3 — the cadence bar climbs to c#, the leading tone of the d
    // the triangle states at theme', where the saw leaves the bass to sing the tune
    /* 15 D   */ ['maj', D_MAJOR, FIG.climb],
  ]
  line.forEach(([quality, pcs, figure], bar) => {
    walk(theme, bar, bass[bar][0], quality, pcs, figure, bass[bar + 1]?.[0] ?? 'd3', { vol: 10 })
  })
  const thirds = [
    ['d4', 'f#4'], ['d4', 'f#4'], ['b3', 'd4'], ['c#4', 'e4'], ['d4', 'f#4'], ['a3', 'c#4'], ['b3', 'd4'], ['c#4', 'e4'],
    ['d4', 'f#4'], ['d4', 'f#4'], ['e4', 'g#4'], ['c#4', 'e4'], ['b3', 'd4'], ['a3', 'c#4'], ['d4', 'e4'], ['d4', 'f#4'],
  ]
  // The brass rests for the theme's whole first phrase: after the fanfare's chorale the
  // tune arrives on bare pulses over the bass pair, and the VRC6 returns at bar 8 as the
  // arrangement thickens into the second phrase (§2.10's thin/thicken quota).
  thirds.forEach(([lo, hi], bar) => {
    if (bar < 8) return
    const len = bar === 15 ? 14 : 16
    hold(theme, L.V1, REED, 8, bar, 0, hi, len)
    if (bar === 14) {
      // d4 is a chord tone of D/F# in bar 12-13 and the fourth over this A: 4-3, resolved
      hold(theme, L.V2, REED, 8, bar, 0, lo, 4)
      hold(theme, L.V2, REED, 8, bar, 4, 'c#4', 12)
    } else hold(theme, L.V2, REED, 8, bar, 0, lo, len)
  })
  // The theme's kit is deliberately the lighter one: 8th hats a step under the chorus's
  // 16ths, and the DPCM kick only on beat 1, so its weight is held back for the chorus.
  for (let bar = 0; bar < 16; bar++) {
    drumBar(theme, bar, {
      hats: '8ths', hatVol: -1, dpcmKick: [0],
      fill: bar === 7 ? 'roll' : bar === 15 ? 'toms' : null, crash: bar === 0 || bar === 8,
    })
  }
  // The coda leaves the engine slow; the loop row restores the piece's own speed (§2.9).
  theme.put(L.NOISE, 0, { fx: [['F', 6]] })
}

// =====================================================================================
// THEME' — frames 6-7, 8 bars. The tune's second phrase RE-ORCHESTRATED onto the
// sawtooth at 11 with its bend-in attack: the first genuine variation, and the saw is the
// top-sounding melodic line here, not an inner voice. Pulse 1 answers a sixth ABOVE in a
// slower rhythm — two notes a bar on the strong beats, so it reads as a descant rather
// than a doubling — and falls to the third at the cadence while the saw rises to the
// tonic. Pulse 2 rests for the whole section and says so on its first row. The triangle
// is the bass alone, in detached 8ths with its own octave leap: the saw has the tune, so
// the other half of the bass pair leads (§12.2's allocation doctrine). V1/V2 rest for
// four bars, then return as brass thirds thickening into the lift.
// Kit: off-beat hats — a new subdivision — with the push fill at bar 7.
// =====================================================================================
const themeP = s.section('themeP', 8)
{
  sing(themeP, L.SAW, SAWLEAD, 11, theTune(0, [8, 15]))
  // The descant keeps its own rhythm — two notes a bar against the saw's four — and its
  // one peak, b5, lands on the downbeat of bar 2 over the secondary dominant. Bar 3 is
  // the section's resting bar: both 2A03 pulses are silent while the saw takes the tune's
  // own peak alone, which is what makes the re-orchestration read as the lead.
  const descant = [
    [0, 0, 'a5'], [0, 8, 'f#5'],
    [1, 0, 'g5'], [1, 4, 'f#5', '4', 0x42], [1, 12, '---'],
    [2, 0, 'b5', '4', 0x42],
    [3, 0, '---'],
    [4, 0, 'g5'], [4, 8, 'e5'],
    [5, 0, 'a5', '4', 0x42], [5, 8, 'f#5'],
    [6, 0, 'a5'], [6, 4, 'g5'], [6, 8, 'f#5'], [6, 12, 'e5'],
    [7, 0, 'f#5', '4', 0x43], [7, 12, '---'],
  ]
  sing(themeP, L.P1, HARM, 12, descant)
  themeP.put(L.P2, 0, { note: CUT })
  const bass = [['d2'], ['b2', 'd#2'], ['e2'], ['a2', 'g#2'], ['g2'], ['f#2'], ['a2', 'c#2'], ['d2']]
  bass.forEach(([root, approach], bar) => triBar(themeP, bar, root, 'lead', { approach }))
  const thirds = [['b3', 'd4'], ['a3', 'c#4'], ['d4', 'e4'], ['d4', 'f#4']]
  thirds.forEach(([lo, hi], i) => {
    const bar = 4 + i
    hold(themeP, L.V1, BRASS, 8, bar, 0, hi, bar === 7 ? 14 : 16)
    if (bar === 6) {
      hold(themeP, L.V2, BRASS, 8, bar, 0, lo, 4) // the 4-3 again, now in the brass
      hold(themeP, L.V2, BRASS, 8, bar, 4, 'c#4', 12)
    } else hold(themeP, L.V2, BRASS, 8, bar, 0, lo, bar === 7 ? 14 : 16)
  })
  for (let bar = 0; bar < 8; bar++) {
    drumBar(themeP, bar, { hats: 'open', kick: [0, 8], ghosts: [15], fill: bar === 7 ? 'push' : null, crash: bar === 0 })
  }
}

// =====================================================================================
// LIFT — frames 8-9, 8 bars. Modal interchange: borrowed bVI and bVII (Bb and C) in D
// major as a 3 + 3 SIX-BAR phrase — the piece's one asymmetry, placed at a section
// boundary — and then two bars of the dominant under a tom break.
//
// A lift has to LIFT, so nothing here sits still for three bars. The harmonic rhythm
// DOUBLES across the phrase: Bb Bb | C C | Bb C, two bars a chord and then one, arriving
// at the dominant with the chorus already accelerating. The lead holds d5 through the
// first three bars (the third of Bb, the ninth over the C of bar 2) and then climbs with
// the chords, e5 f5 g5 — a stepwise ascent through the borrowed f natural, which is the
// same modal interchange the chords are — one note a bar. And the bass pair stops
// marching in lockstep: the sawtooth takes the `drive` rhythm (quarters plus the two
// off-8ths) against the triangle's plain quarters, and walks it in D aeolian — the scale
// the borrowed chords come from — leaning into every chord change by step.
//
// V1/V2 carry a chain of FOUR written 4-3 suspensions, one at every chord that can hold
// one: 8:0 over Bb (d#4 -> d4), 8:32 over C (f4 -> e4), 9:16 over C again (f4 -> e4) and
// 9:32 over A (d4 -> c#4). The two C suspensions are properly prepared — f4 is the fifth
// of the Bb in the bar before each of them. Pulse 2 rests for the whole section.
// Kit: 8ths for three bars, 16ths from bar 3, the cracking snare at note 41, the burst
// fill at bar 5 and the tom run at bar 7.
// =====================================================================================
const lift = s.section('lift', 8)
{
  sing(lift, L.P1, LEAD, 12, [
    [0, 0, 'd5', '4', 0x31], [2, 12, '---'],
    [3, 0, 'e5'], [4, 0, 'f5'], [5, 0, 'g5', '4', 0x31], [5, 12, '---'],
  ])
  // the column climbs with the line: the lift is the one place the piece is allowed to
  // get louder bar by bar, and it is what hands the chorus a crescendo to land on
  lift.put(L.P1, lift.at(4, 0), { vol: 13 })
  lift.put(L.P1, lift.at(5, 0), { vol: 14 })
  lift.put(L.P2, 0, { note: CUT })
  const bass = ['a#2', 'a#2', 'c3', 'c3', 'a#2', 'c3', 'a2', 'a2']
  bass.forEach((root, bar) => {
    triBar(lift, bar, root, bar < 6 ? 'double' : 'hold', { restAt: bar === 7 ? 8 : undefined })
  })
  // The saw, one figure a bar over the six-bar phrase. Bars 1 and 3 are one shape a step
  // apart — the second bar of each two-bar chord, so the sequence marks the 3 + 3 — and
  // the one-bar chords of bars 4 and 5 turn tighter around their roots.
  const drive = [
    // bb2 d3 e3 f3 d3 c3 — up the Bb triad through a passing e, then down into the repeat
    /* 0 Bb */ DRIVE.rise,
    // bb2 bb2 bb3 f3 d3 bb2 — the octave on the 'and' of 2, down the triad, up to c
    /* 1 Bb */ lean(DRIVE.octave, 'A-'),
    // c3 g2 a2 g2 c3 bb2 — below the root to g and its neighbour, home, bb into C again
    /* 2 C  */ DRIVE.low,
    // c3 c3 c4 g3 e3 a2 — bar 1's shape a step higher, in on a from below the Bb
    /* 3 C  */ lean(DRIVE.octave, 'A-'),
    // bb2 f2 g2 f2 bb2 d3 — down to f and back, then d above the coming c
    /* 4 Bb */ lean(DRIVE.low, 'A+'),
    // c3 g3 a3 g3 c3 bb2 — up to g and its neighbour, home, bb falling onto the dominant
    /* 5 C  */ DRIVE.peak,
  ]
  drive.forEach((figure, bar) => {
    const span = { root: bass[bar], quality: 'maj', scale: D_AEOLIAN, figure, rows: DRIVE_ROWS }
    sawLine(lift, bar, [span], bass[bar + 1], { vol: 10 })
  })
  // bars 6-7, the dominant under the tom break: one held a2, cut halfway through bar 7
  for (const bar of [6, 7]) lift.put(L.SAW, lift.at(bar, 0), { note: n('a2'), inst: SAWBASS, vol: 10 })
  lift.put(L.SAW, lift.at(7, 8), { note: CUT })
  // [bar, V2's chord tone, V1's suspended note, V1's resolution]. V1 is always above V2
  // and the pair never moves in parallel for two chords running.
  const brass = [
    [0, 'a#3', 'd#4', 'd4'], [1, 'd4', 'f4'], [2, 'c4', 'f4', 'e4'],
    [3, 'e4', 'g4'], [4, 'd4', 'f4'], [5, 'c4', 'f4', 'e4'],
    [6, 'a3', 'd4', 'c#4'], [7, 'a3', 'c#4'],
  ]
  for (const [bar, mid, top, resolution] of brass) {
    const len = bar === 7 ? 8 : 16
    hold(lift, L.V2, BRASS, 8, bar, 0, mid, len)
    if (resolution === undefined) hold(lift, L.V1, BRASS, 9, bar, 0, top, len)
    else {
      hold(lift, L.V1, BRASS, 9, bar, 0, top, 4)
      hold(lift, L.V1, BRASS, 9, bar, 4, resolution, len - 4)
    }
  }
  for (let bar = 0; bar < 8; bar++) {
    drumBar(lift, bar, {
      hats: bar < 3 ? '8ths' : '16ths', snare: SNARE_HI, ghosts: bar < 3 ? [10, 15] : [6, 10, 14],
      fill: bar === 5 ? 'burst' : bar === 7 ? 'toms' : null, crash: bar === 0 || bar === 3,
    })
  }
}

// =====================================================================================
// THE CHORUS TUNE — the head INVERTED (the falling fourth becomes a rising one) and
// re-rhythmed onto the 8th-level tresillo, 6 + 6 + 4: attacks on rows 0, 6 and 12 of
// every bar, which is §9.1 Recipe C at the tempo the table says to use it (140-160 BPM,
// where the 16th-level grouping only gallops). Bars 8-9 restate the head DISPLACED two
// rows late (Recipe F) and bar 10 snaps back so the peak can land on a downbeat.
//
// Bar 3 is an appoggiatura: g5, the fourth over D, attacked ON the downbeat and resolved
// down by step within four rows. Phrase 1 ends deceptively on vi at bar 7 with two and a
// half beats of rest; phrase 2 rides the descending-fifths chain F#m-Bm-Em-A-D to the
// section's one peak, b5, on the downbeat of bar 11 over the dominant, and cadences
// through the Italian sixth of bar 14. `t` transposes it for the final chorus.
//
// The second eight bars get ONE breath, and it is placed where it means something: the
// peak bar ends on row 12 (12:60, and 20:60 in the final chorus) instead of holding into
// bar 12, so the descent home begins after a beat of air rather than out of a line that
// has sung eight bars without stopping. The four same-direction leaps at 10:6, 10:38,
// 12:8 and 12:38 are the hook and are left exactly as they are.
// =====================================================================================
function chorusTune(t = 0) {
  const rows = [
    /*  0 */ [[0, 'a4'], [6, 'd5'], [12, 'e5']],
    /*  1 */ [[0, 'f#5'], [6, 'e5'], [12, 'd5']],
    /*  2 */ [[0, 'b4'], [6, 'e5'], [12, 'f#5']],
    /*  3 */ [[0, 'g5'], [4, 'f#5', '4', 0x42], [10, '---']],
    /*  4 */ [[0, 'b4'], [6, 'd5'], [12, 'f#5']],
    /*  5 */ [[0, 'e5'], [6, 'c#5'], [12, 'a4']],
    /*  6 */ [[0, 'b4'], [6, 'd5'], [12, 'c#5']],
    /*  7 */ [[0, 'b4', '4', 0x42], [6, '---']],
    /*  8 */ [[2, 'a4'], [8, 'c#5'], [14, 'e5']],
    /*  9 */ [[2, 'f#5'], [8, 'e5'], [14, 'd5']],
    /* 10 */ [[0, 'b4'], [6, 'e5'], [12, 'g5']],
    /* 11 */ [[0, 'b5'], [6, 'a5', '4', 0x43], [12, '---']], // the peak, then a beat of air
    /* 12 */ [[0, 'a5'], [6, 'f#5'], [12, 'd5']],
    /* 13 */ [[0, 'e5'], [6, 'd5'], [12, 'b4']],
    /* 14 */ [[0, 'd5'], [8, 'c#5']],
    /* 15 */ [[0, 'd5', '4', 0x43], [12, '---']],
  ]
  return rows.flatMap((bar, i) => bar.map(([row, note, cmd, param]) =>
    [i, row, note === '---' ? '---' : n(note) + t, cmd, param]))
}

// =====================================================================================
// THE COUNTER-MELODY — pulse 2's own tune for the whole chorus (§9.2). It is not the
// lead at another interval: it moves on rows 4 and 10 where the lead moves on 0, 6 and
// 12, so four fifths of its attacks fall on rows the lead leaves empty; it is an arch of
// its own (f#4 up to b4, down to d4, back up to b4 and home); it carries a written 4-3
// SUSPENSION at bar 6 — d4 prepared as the fifth of G, held across into the A chord where
// it is the fourth, resolving down to c#4 on row 12; and it turns against the lead at
// both cadences: bar 7 (the lead falls c#5 -> b4, the counter rises c#4 -> d4) and bar 15
// (the lead rises c#5 -> d5, the counter falls a4 -> f#4). It never rises above the lead.
//
// It also has a PHRASE, which is the difference between a second tune and an obbligato:
// it cuts at 11:16 and rests the whole of that bar, then enters a beat late at 11:36
// straight into the suspension, answering the lead's own twelve-row rest at 11:54. Two
// attacks in every bar for sixteen bars is an accompaniment figure, not a singer.
// =====================================================================================
function counterMelody(t = 0) {
  const rows = [
    /*  0 */ [[4, 'f#4'], [10, 'a4']],
    /*  1 */ [[4, 'b4'], [10, 'a4']],
    /*  2 */ [[4, 'g4'], [10, 'b4']],
    /*  3 */ [[0, 'a4'], [8, 'f#4']],
    /*  4 */ [[4, 'd4'], [10, 'f#4']],
    /*  5 */ [[0, '---']],             // the counter's one whole bar of rest: 11:16-11:35
    /*  6 */ [[4, 'd4'], [12, 'c#4']], // a beat late, into the 4-3 it already owns
    /*  7 */ [[0, 'd4'], [8, 'f#4'], [14, '---']],
    /*  8 */ [[4, 'a4'], [10, 'f#4']],
    /*  9 */ [[4, 'd4'], [10, 'f#4']],
    /* 10 */ [[4, 'g4'], [10, 'e4']],
    /* 11 */ [[4, 'c#4'], [10, 'g4']], // g4 over A: the seventh, so the dominant is A7
    /* 12 */ [[0, 'f#4'], [8, 'a4']],
    /* 13 */ [[4, 'b4'], [10, 'g4']],
    /* 14 */ [[0, 'g#4'], [4, 'a4']], // the augmented sixth above the bass, resolving up
    /* 15 */ [[0, 'f#4'], [8, 'd4'], [14, '---']],
  ]
  return rows.flatMap((bar, i) => bar.map(([row, note, cmd, param]) =>
    [i, row, note === '---' ? '---' : n(note) + t, cmd, param]))
}

/** The chorus, written once so the final one can be the same music a whole step up.
 *  `t` is the transposition, `bassRoots` the roots in the right octave for that key, and
 *  `double` asks VRC6 pulse 1 to double the lead in unison instead of holding harmony.
 *
 *  Harmony, one chord a bar except where two are marked: D | G | Em A | D | Bm | F#m |
 *  G A | Bm (deceptive) || F#m | Bm | Em | A | D | G | Bb(+6) A | D. Bars 8-12 are a
 *  descending-fifths chain of four links that arrives rather than looping, which is what
 *  §9.3 asks for, and no four-chord cycle repeats anywhere in the section.
 *
 *  The Italian sixth at bar 14: the bass takes bVI for one beat while vrc6p1 holds the
 *  raised fourth a tritone above it and vrc6p2 the tonic; the pair resolves outward by a
 *  semitone each onto the dominant on row 4 — bass down, raised fourth up.
 */
function writeChorus(sec, t, roots, opts = {}) {
  const T = (name) => n(name) + t
  const sawVol = opts.sawVol ?? 10
  const brassVol = opts.brassVol ?? 8
  sing(sec, L.P1, LEAD, opts.leadVol ?? 14, chorusTune(t))
  sec.line(L.P2, COUNTER, opts.counterVol ?? 11, counterMelody(t))

  // Bass. The triangle keeps the roots in quarters, root and octave; the saw WALKS under
  // it in 8ths. A two-element root splits the bar into two chords — the section's own
  // harmonic rhythm change (§9.3), against one chord a bar everywhere else in the piece.
  roots.forEach((root, bar) => {
    if (bar === 14) return // the augmented-sixth bar is written by hand below
    const [first, second] = Array.isArray(root) ? root : [root, undefined]
    triBar(sec, bar, first, second === undefined ? 'double' : 'split', { second })
  })
  // The saw's line, written in D and moved by `t`: one span per chord, [root, quality,
  // scale, figure, rows?]. Note names below are the D chorus; the final one is a step up.
  // Where vrc6p2 hangs a 9-8 (bars 7 and 12 of both choruses, bar 0 of the final one) the
  // bass never doubles the suspended note while it hangs.
  const span = (root, quality, pcs, figure, rows) => (rows === undefined
    ? { root, quality, scale: pcs, figure } : { root, quality, scale: pcs, figure, rows })
  const bassLine = [
    // d2 c#2 d2 d3 a2 g2 f#2 a2 — the octave, with the neighbour BELOW the root: the final
    // chorus enters on a suspended second degree, and the bass must not double it
    /*  0 D     */ [span('d2', 'maj', D_MAJOR, FIG.dip)],
    // g2 g3 d3 c#3 b2 a2 g2 d2 — a whole octave down the scale, d stepping up into e
    /*  1 G     */ [span('g2', 'maj', D_MAJOR, lean(FIG.fall, 'A-'))],
    // e2 f#2 g2 b2 | a2 c#3 e3 e2 — passing f# to the third, b falling onto a; then up the
    // A triad and its fifth dropped an octave, a step above the d
    /*  2 Em A  */ [span('e2', 'min', D_MAJOR, lean(HALF.step, 'A+'), FIRST_HALF),
      span('a2', 'maj', D_MAJOR, HALF.triad, SECOND_HALF)],
    // d2 e2 d2 c#2 d2 f#2 a2 c#3 — a turn around the root, up the triad, c# above the b
    /*  3 D     */ [span('d2', 'maj', D_MAJOR, lean(FIG.turn, 'A+'))],
    // b2 c#3 d3 e3 f#3 d3 b2 e2 — up to the fifth and back; in from e BELOW the f# that
    // three upper voices are holding, so the approach is a ninth against them, not a rub
    /*  4 Bm    */ [span('b2', 'min', D_MAJOR, lean(FIG.rise, 'A-'))],
    // f#2 g2 a2 b2 c#3 b2 a2 f#2 — up the scale to c# and back, the root stepping to g
    /*  5 F#m   */ [span('f#2', 'min', D_MAJOR, lean(FIG.wave, 'A-'))],
    // g2 g3 d3 b2 | a2 a3 e3 c#3 — two octave half-bars, b onto a and c# onto the deceptive
    // b; no c# until row 14, after pulse 2 has resolved its own 4-3 onto c#4 at row 12
    /*  6 G A   */ [span('g2', 'maj', D_MAJOR, HALF.octave, FIRST_HALF),
      span('a2', 'maj', D_MAJOR, HALF.octave, SECOND_HALF)],
    // b2 d3 f#3 d3 b2 f#2 d2 e2 — down through the Bm triad under vrc6p2's 9-8, e into f#
    /*  7 Bm    */ [span('b2', 'min', D_MAJOR, FIG.cascade)],
    // f#2 e2 f#2 f#3 c#3 b2 a2 c#3 — the displaced head's bar: the octave, down, c# above b
    /*  8 F#m   */ [span('f#2', 'min', D_MAJOR, lean(FIG.dip, 'A+'))],
    // b2 b3 f#3 e3 d3 c#3 b2 f#2 — a full octave down the scale, f# above the e
    /*  9 Bm    */ [span('b2', 'min', D_MAJOR, FIG.fall)],
    // e2 f#2 g2 a2 b2 c#3 b2 g2 — a climb to c# under the chain, g below the a
    /* 10 Em    */ [span('e2', 'min', D_MAJOR, lean(FIG.climb, 'A-'))],
    // a2 b2 a2 a3 e3 d3 c#3 c#2 — the peak bar keeps its octave; the leading tone drops an
    // octave onto the d, which is where vrc6p2 holds its 9-8
    /* 11 A     */ [span('a2', 'maj', D_MAJOR, lean(FIG.leap, 'A-'))],
    // d2 f#2 a2 f#2 d2 a1 f#1 f#2 — the descent home starts at the bottom of the register:
    // down the triad to f#1 and up the octave to f#, below the g. No e while e4 hangs above
    /* 12 D     */ [span('d2', 'maj', D_MAJOR, FIG.cascade)],
    // g2 a2 b2 d3 g3 d3 b2 a2 — an arch, then a rising to the bVI's b-flat
    /* 13 G     */ [span('g2', 'maj', D_MAJOR, FIG.arch)],
    // bb2 bb2 | a2 a3 e3 c#3 a2 e2 — bVI for one beat under the raised fourth, the semitone
    // fall onto A, then the octave and down the chord, e above the d
    /* 14 Bb A  */ [span('a#2', 'maj', D_AEOLIAN, ['R', 'R'], [0, 2]),
      span('a2', 'maj', D_MAJOR, ['R', '8', '5', '3', 'R', 'A'], [4, 6, 8, 10, 12, 14])],
    // d2 d3 a2 g2 f#2 e2 d2 c#2 — down the scale; c#2 leads into the bridge's b1 here, and a
    // step up, d#2 into the coda's e2
    /* 15 D     */ [span('d2', 'maj', D_MAJOR, FIG.fall)],
  ]
  bassLine.forEach((spans, bar) => {
    // the saw and the triangle read the same roots, so a later edit cannot split them
    const tri = [roots[bar]].flat().map((root) => n(root))
    const saw = spans.map(({ root }) => n(root) + t)
    if (saw.join() !== tri.join()) throw new Error(`chorus bar ${bar}: saw roots ${saw} but triangle roots ${tri}`)
    const next = bar + 1 < bassLine.length ? bassLine[bar + 1][0].root : n(opts.exit) - t
    sawLine(sec, bar, spans, next, { vol: sawVol, t })
  })
  // Bar 14, the Italian sixth: the bass takes bVI for one beat under the raised fourth a
  // tritone above it, then both fall a semitone onto the dominant on row 4.
  const [flat6, dom] = roots[14]
  sec.put(L.TRI, sec.at(14, 0), { note: n(flat6) + 12, inst: BASS, vol: 15 })
  for (const [row, up] of [[4, 12], [8, 24], [12, 12]]) sec.put(L.TRI, sec.at(14, row), { note: n(dom) + up, inst: BASS, vol: 15 })

  // vrc6p1, the upper brass voice. It holds f#4 across three whole bars twice (bars 3-5
  // and 7-9) while vrc6p2 moves underneath: that oblique motion is what keeps the two
  // harmony lanes from collapsing into parallel sixths for the whole section (§9.2).
  const upper = [
    [0, 0, 'f#4', 16], [1, 0, 'g4', 24], [2, 8, 'a4', 8], [3, 0, 'f#4', 48],
    [6, 0, 'g4', 8], [6, 8, 'a4', 8], [7, 0, 'f#4', 48], [10, 0, 'g4', 16],
    [11, 0, 'a4', 16], [12, 0, 'f#4', 16], [13, 0, 'g4', 16],
    [14, 0, 'g#4', 4], [14, 4, 'a4', 12], [15, 0, 'f#4', 14],
  ]
  // vrc6p2, the lower voice, with its own held spans so the two never move in lockstep.
  // It carries the section's two cadential 9-8 SUSPENSIONS, each prepared as a chord tone
  // of the A before it, held over the change, and resolved down a step four rows later:
  //  - bar 7, the deceptive cadence: c#4, the third of the A at 6:8, hangs over the Bm as
  //    its ninth and falls to b3 (chorus 11:48 -> 11:52, final chorus 19:48 -> 19:52);
  //  - bar 12, the authentic cadence that opens the descent home: e4, the fifth of the A
  //    through bar 11, hangs over the D and falls to d4 (13:0 -> 13:4, 21:0 -> 21:4).
  const lower = [
    [0, 0, 'a3', 16], [1, 0, 'b3', 24], [2, 8, 'c#4', 8], [3, 0, 'a3', 16],
    [4, 0, 'b3', 16], [5, 0, 'a3', 16], [6, 0, 'b3', 8], [6, 8, 'c#4', 8],
    [7, 0, 'c#4', 4], [7, 4, 'b3', 12], // 9-8 over Bm
    [8, 0, 'a3', 16], [9, 0, 'b3', 32], [11, 0, 'e4', 16],
    [12, 0, 'e4', 4], [12, 4, 'd4', 28], // 9-8 over D
    [14, 0, 'd4', 4], [14, 4, 'c#4', 12], [15, 0, 'd4', 14],
  ]
  // ...and the final chorus opens on a third 9-8, at the cadence that confirms the new
  // key: the build holds f#4, the fifth of its B7, to the barline (17:32-17:63), and the
  // lower voice keeps it over the E at 18:0 before falling to e4 at 18:4 (in D: e4 -> d4).
  if (opts.suspendEntry) lower.splice(0, 1, [0, 0, 'e4', 4], [0, 4, 'd4', 12])
  for (const [bar, row, note, len] of lower) hold(sec, L.V2, BRASS, brassVol, bar, row, T(note), len)
  for (const [bar, row, note, len] of upper) {
    if (opts.doubleFrom !== undefined && bar >= opts.doubleFrom) continue
    hold(sec, L.V1, BRASS, brassVol, bar, row, T(note), len)
  }

  // The final chorus doubles the lead on vrc6p1 from `doubleFrom` on — eight bars, which
  // is §2.1's limit for the unison gesture, so the harmony survives the first half.
  if (opts.doubleFrom !== undefined) {
    for (const [bar, row, note] of chorusTune(t)) {
      if (bar < opts.doubleFrom) continue
      if (note === '---') sec.put(L.V1, sec.at(bar, row), { note: CUT })
      else sec.put(L.V1, sec.at(bar, row), { note, inst: REED, vol: opts.doubleVol ?? 9 })
    }
  }
}

// =====================================================================================
// CHORUS — frames 10-13, 16 bars, every lane sounding. The tune, the counter-melody and
// the two-voice brass chorale are written above; what belongs here is the section's own
// kit and the roots the bass walks. Kit: 16th hats (a third subdivision), the cracking
// snare at note 41 layered with the DPCM snare on 2 and 4, ghosts on three off-16ths, a
// crash every four bars, and four different fills at the four-bar seams.
// =====================================================================================
const chorus = s.section('chorus', 16)
{
  writeChorus(chorus, 0, [
    'd2', 'g2', ['e2', 'a2'], 'd2', 'b2', 'f#2', ['g2', 'a2'], 'b2',
    'f#2', 'b2', 'e2', 'a2', 'd2', 'g2', ['a#2', 'a2'], 'd2',
  ], { brassVol: 9, exit: 'b1' })
  // `burst` returns here from the lift (9:24) and comes back on the other snare, a hit
  // wider; `rim` is heard here first and returns altered in the final chorus.
  const fills = { 3: 'rim', 7: 'flam', 11: 'burst', 15: 'roll' }
  // the chorus brass sits one column above the theme's, which is as far as the headroom
  // goes with the saw, both 2A03 pulses and the DPCM pair all sounding (§12.2)
  for (let bar = 0; bar < 16; bar++) {
    drumBar(chorus, bar, {
      hats: '16ths', kick: [0, 8], snare: SNARE_HI, ghosts: [6, 10, 14],
      fill: fills[bar] ?? null, fillAlt: bar === 11, crash: bar % 4 === 0,
    })
  }
}

// =====================================================================================
// BRIDGE — frames 14-15, 8 bars, B minor (the relative: no accidental but the leading
// tone a#, which the F# major dominant needs). The quiet place. Pulse 2, the triangle and
// the DPCM lane all rest for the whole section, so three of the eight voices are silent
// at once; the lead states the head INVERTED at 9 — the falling fourth becomes a rising
// one, the rising steps fall — and its one peak, g5, lands on the downbeat of bar 4.
//
// Underneath it: the sawtooth on a SIX-ROW cell, rotating root, fifth, octave. Six rows
// against a sixteen-row bar is two attacks per three beats (§9.1 Recipe D), and it is
// written straight through so its phase carries — entry row 0 in frame 14, row 2 in frame
// 15 and row 4 in frame 16, which are the phase-carry table's own values for c = 6 — while
// vrc6p2's stabs stay square on beats 2 and 4. vrc6p1 is silent until bar 6, where it
// rises into the build over A, the pivot home. Bar 7 is the one metric surprise: the kit stops for
// a whole bar and only the cell and the stabs keep time.
// =====================================================================================
const bridge = s.section('bridge', 8)
{
  sing(bridge, L.P1, LEAD, 9, [
    [0, 0, 'b4'], [0, 6, 'f#5'], [0, 8, 'e5'], [0, 12, 'd5'],
    [1, 0, 'c#5'], [1, 4, 'b4', '4', 0x42], [1, 12, '---'],
    [2, 0, 'g4'], [2, 6, 'd5'], [2, 8, 'c#5'], [2, 12, 'b4'],
    [3, 0, 'a#4'], [3, 4, 'b4', '4', 0x42], [3, 12, '---'],
    [4, 0, 'g5'], [4, 6, 'f#5'], [4, 8, 'e5'], [4, 12, 'd5'],
    [5, 0, 'e5'], [5, 6, 'd5'], [5, 12, 'b4'],
    [6, 0, 'c#5'], [6, 6, 'a#4'], [6, 12, 'f#4', '4', 0x42],
    [7, 0, '---'],
  ])
  bridge.put(L.P2, 0, { note: CUT })
  bridge.put(L.TRI, 0, { note: CUT })
  // the 6-row cell, straight through both frames and on into the build's first frame
  const roots = ['b1', 'b1', 'g1', 'f#1', 'b1', 'e2', 'f#1', 'a1']
  const cell = [0, 7, 12]
  for (let row = 0, i = 0; row < bridge.len; row += 6, i++) {
    const root = n(roots[Math.floor(row / 16)]) + cell[i % 3]
    bridge.put(L.SAW, row, { note: root, inst: SAWBASS, vol: 9 })
  }
  // vrc6p2's stabs, square on beats 2 and 4 against the cell — the 3-against-4 argument
  // 0xy builds UPWARD from the written note, so an inversion is chosen by the bass note:
  // a#3 + 038 is F# major in first inversion, which keeps the stabs inside one octave.
  const stabs = [['b3', 3, 7], ['b3', 3, 7], ['g3', 4, 7], ['a#3', 3, 8], ['b3', 3, 7], ['e3', 3, 7], ['a#3', 3, 8], ['a3', 4, 7]]
  stabs.forEach(([root, x, y], bar) => {
    for (const row of [4, 12]) bridge.chord(L.V2, STAB, 9, bar, row, root, [x, y])
  })
  bridge.put(L.V2, bridge.len - 1, { fx: [['0', 0]] }) // 0xy latches per channel (§2.9 rule 3)
  // vrc6p1 enters only for the last two bars, rising into the build
  for (const [bar, row, note, len] of [[6, 0, 'c#4', 16], [7, 0, 'e4', 8], [7, 8, 'a4', 8]]) {
    hold(bridge, L.V1, BRASS, 8, bar, row, note, len)
  }
  // kit: off-beat hats at 5, one snare on beat 4, a metal tick on the 'and' of 3, ghosts
  for (let bar = 0; bar < 7; bar++) {
    for (const row of [2, 6, 10, 14]) bridge.put(L.NOISE, bridge.at(bar, row), { note: 45, inst: HAT, vol: 5 })
    bridge.put(L.NOISE, bridge.at(bar, 12), { note: SNARE_LO, inst: SNARE, vol: 9 })
    bridge.put(L.NOISE, bridge.at(bar, 8), { note: 44, inst: METAL, vol: 7 })
    if (bar % 2 === 1) bridge.put(L.NOISE, bridge.at(bar, 15), { note: SNARE_LO, inst: SNARE, vol: 4 })
  }
  // ...and the last kit event before the hole, on the last 16th of bar 6
  bridge.put(L.NOISE, bridge.at(6, 15), { note: SNARE_LO, inst: SNARE, vol: 5 })
}

// =====================================================================================
// BUILD — frames 16-17, 8 bars. The head becomes a TRANSPOSITION sequence: its first bar
// restated up one scale step every bar over a bass that climbs d e f# g a b — six links
// going somewhere, not a loop (§9.3). Bars 2-5 (16:32-17:31) are a power gesture: pulse 2
// doubles the lead an octave below for exactly four bars (§2.10's ceiling). Bar 5 turns
// the sequence chromatic — B major's g# and a# — and bars 6-7 hold B7, which is V of E:
// the modulation is a true pivot, because the A of bar 4 is V in D and IV in E, so the
// piece leaves D through its own dominant and is confirmed in E by B7's d#.
//
// The sawtooth carries the 6-row cell one frame further (entry row 4 of frame 16, the
// third value in the phase-carry table) and only then snaps to 8ths at bar 4, so the
// metre resolves onto the downbeat exactly where the bass starts driving — and it drives
// as a line, walking the pivot in D and the B chords in E, and stepping into the final
// chorus's e2. vrc6p2 holds the B7's f#4 to the barline, for chorus' to suspend over the
// E. The kit goes from beat kicks to a rising 8th-then-16th snare roll, and the brass
// swells with A0y.
//
// The lead rests the last beat of bars 1, 3 and 5 — the second bar of each two-bar unit
// — and the brass re-swells on exactly those rows (16:28, 16:60, 17:28). A sequence that
// climbs for seven bars without a breath is the generic version of this gesture.
// =====================================================================================
const build = s.section('build', 8)
{
  const head = (bar, root, third, fourth, fifth) => [
    [bar, 0, root], [bar, 6, third], [bar, 8, fourth], [bar, 12, fifth],
  ]
  // §2.10: a line has to breathe, and a sequence that never stops for seven bars is a
  // machine. The SECOND bar of each two-bar unit drops its fifth and rests the last
  // beat; the brass, which re-swells on that row, is what answers into the gap.
  const breathe = (bar, root, third, fourth) => [
    [bar, 0, root], [bar, 6, third], [bar, 8, fourth], [bar, 12, '---'],
  ]
  // 13, a column above the lift and a column under the choruses: the breathing above
  // costs the section three notes, and a build that comes out quieter than the chorus it
  // is building towards has been made worse, not better.
  sing(build, L.P1, LEAD, 13, [
    ...head(0, 'd5', 'a4', 'b4', 'c#5'),
    ...breathe(1, 'e5', 'b4', 'c#5'),
    ...head(2, 'f#5', 'c#5', 'd5', 'e5'),
    ...breathe(3, 'g5', 'd5', 'e5'),
    ...head(4, 'a5', 'e5', 'f#5', 'g5'),
    ...breathe(5, 'b5', 'f#5', 'g#5'),
    [6, 0, 'b4'], [6, 4, 'd#5'], [6, 8, 'f#5'], [6, 12, 'a5'],
    [7, 0, 'f#5', '4', 0x43], [7, 8, '---'],
  ])
  // pulse 2 in octaves under the lead, bars 2-5 only — it rests where the lead rests, or
  // the breath is not a breath
  build.put(L.P2, 0, { note: CUT })
  for (const [bar, row, note] of [
    ...head(2, 'f#4', 'c#4', 'd4', 'e4'), ...breathe(3, 'g4', 'd4', 'e4'),
    ...head(4, 'a4', 'e4', 'f#4', 'g4'), ...breathe(5, 'b4', 'f#4', 'g#4'),
  ]) build.put(L.P2, build.at(bar, row), note === '---' ? { note: CUT } : { note: n(note), inst: COUNTER, vol: 11 })
  build.put(L.P2, build.at(6, 0), { note: CUT })

  const roots = ['d2', 'e2', 'f#2', 'g2', 'a2', 'b2', 'b2', 'b2']
  const cell = [0, 7, 12]
  // frame 16: the cell, entry row 4, its phase carried from the bridge
  for (let row = 4, i = 0; row < 64; row += 6, i++) {
    build.put(L.SAW, row, { note: n(roots[Math.floor(row / 16)]) + cell[i % 3], inst: SAWBASS, vol: 10 })
  }
  // frame 17: the cell resolves and the bass walks in 8ths
  const drive = [
    // a2 b2 c#3 d3 e3 f#3 e3 c#3 — the pivot climbs its scale, the last d natural, c# into b
    /* 4 A  */ ['maj', D_MAJOR, FIG.climb],
    // b2 c#3 d#3 f#3 b3 f#3 d#3 c#3 — up the B triad to the octave and back, d# for d
    /* 5 B  */ ['maj', E_MAJOR, FIG.arch],
    // b2 c#3 b2 a2 b2 d#3 f#3 c#3 — a turn through the seventh, a, then up the chord
    /* 6 B7 */ ['dom7', E_MAJOR, FIG.turn],
    // b2 b3 f#3 d#3 b2 f#2 d#2 f#2 — down the chord to the leading tone, f# above the e
    /* 7 B7 */ ['dom7', E_MAJOR, FIG.plunge],
  ]
  drive.forEach(([quality, pcs, figure], i) => {
    const bar = 4 + i
    walk(build, bar, roots[bar], quality, pcs, figure, roots[bar + 1] ?? 'e2', { vol: 10 })
  })
  roots.forEach((root, bar) => triBar(build, bar, root, bar < 4 ? 'double' : 'lead'))

  // brass: sixths climbing with the bass, then B7 held under an A0y swell
  const brass = [
    [0, 'a3', 'f#4'], [1, 'b3', 'g4'], [2, 'c#4', 'a4'], [3, 'd4', 'b4'],
    [4, 'e4', 'c#5'], [5, 'f#4', 'd#5'],
  ]
  for (const [bar, lo, hi] of brass) {
    hold(build, L.V2, BRASS, 8, bar, 0, lo, 16)
    hold(build, L.V1, BRASS, 8, bar, 0, hi, 16)
    // ...and on the beat the lead gives back, the brass re-swells into the gap. BRASS's
    // envelope is a bloom (9 -> 15 -> 13), so a restrike IS a swell and costs no effect.
    if (bar % 2 === 1) {
      build.put(L.V2, build.at(bar, 12), { note: n(lo), inst: BRASS, vol: 8 })
      build.put(L.V1, build.at(bar, 12), { note: n(hi), inst: BRASS, vol: 8 })
    }
  }
  hold(build, L.V2, BRASS, 7, 6, 0, 'f#4', 32) // held to the barline: chorus' suspends it
  hold(build, L.V1, BRASS, 7, 6, 0, 'd#5', 30)
  for (const lane of [L.V1, L.V2]) {
    build.put(lane, build.at(6, 0), { fx: [['A', 1]] })
    build.put(lane, build.at(7, 8), { fx: [['A', 0]] })
  }

  for (let bar = 0; bar < 6; bar++) {
    drumBar(build, bar, {
      hats: bar < 2 ? 'off' : '8ths', kick: bar < 4 ? [0, 8] : [0, 4, 8, 12], dpcmKick: [0, 8],
      snare: SNARE_HI, ghosts: bar < 4 ? [14] : [6, 14], crash: bar === 0 || bar === 4,
    })
  }
  // bars 6-7: the roll. 8ths thickening to 16ths, the column climbing 5 -> 15, the DPCM
  // snare joining on the last beat, and a crash landing on the modulation's downbeat.
  for (let i = 0; i < 8; i++) build.put(L.NOISE, build.at(6, 2 * i), { note: 40, inst: ROLL, vol: 5 + i })
  for (let row = 0; row < 16; row++) build.put(L.NOISE, build.at(7, row), { note: 40, inst: ROLL, vol: Math.min(15, 6 + Math.floor(row * 0.6)) })
  for (const row of [0, 8]) build.put(L.DPCM, build.at(6, row), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  for (const row of [8, 12, 14]) build.put(L.DPCM, build.at(7, row), { note: KIT.snare, inst: KIT.inst, vol: 12 })
}

// =====================================================================================
// CHORUS' — frames 18-21, 16 bars, the same music a WHOLE STEP UP in E major, which is
// the piece's emotional peak and where its global melodic peak lands (c#6, 20:48). Three
// things change besides the key. VRC6 pulse 1 leaves the harmony at bar 8 and doubles the
// lead IN UNISON for the last eight bars: unison, not the octave the sketch asked for,
// because a 2A03 pulse and a VRC6 pulse share the same 16-step divider and therefore the
// same timer for the same note — an exact double — while an octave above this tune lands
// on MIDI 90-95, where that divider quantises 9 to 15 cents flat and the pair would beat
// at the loudest notes of the piece. vrc6p2 keeps the harmony alone under it, which is
// §2.1's sanctioned "both leads in unison for a final chorus" and its eight-bar ceiling.
// The kit is at its busiest: 16th hats a step louder, a third kick on the 'and' of 2, and
// four fills the first chorus did not use.
// =====================================================================================
const chorusP = s.section('chorusP', 16)
{
  writeChorus(chorusP, 2, [
    'e2', 'a2', ['f#2', 'b2'], 'e2', 'c#3', 'g#2', ['a2', 'b2'], 'c#3',
    'g#2', 'c#3', 'f#2', 'b2', 'e2', 'a2', ['c3', 'b2'], 'e2',
  ], { brassVol: 8, doubleFrom: 8, doubleVol: 9, exit: 'e2', suspendEntry: true })
  // both returning shapes come back changed: `rim` on higher ticks and a last-16th kick,
  // `toms` on a wider spread and the other snare (§9.4 — a reprise, not a copy)
  const fills = { 3: 'push', 7: 'riser', 11: 'rim', 15: 'toms' }
  for (let bar = 0; bar < 16; bar++) {
    drumBar(chorusP, bar, {
      hats: '16ths', hatVol: 1, kick: [0, 6, 8], dpcmKick: [0, 8], snare: SNARE_HI,
      ghosts: [10, 14], fill: fills[bar] ?? null, fillAlt: bar === 11 || bar === 15,
      crash: bar % 4 === 0,
    })
  }
}

// =====================================================================================
// CODA — frame 22, 4 bars. The fanfare's chorale returns in the new key: the sawtooth
// under the triangle an octave up, the two VRC6 pulses as the inner brass, the lead on
// top and pulse 2 an octave below it — four bars of octave doubling, the piece's last
// power gesture. Two bars of E, then A7, left hanging on its own tritone (c#4 and g4 in
// the two VRC6 pulses) so the loop resolves it: E -> A7 -> D is a descending-fifths
// turnaround, and the theme's bare d answers the leading tone. An Fxx
// ritardando slows the last bar from speed 6 to 12 under decelerating drum hits, and the
// loop row restores speed 6 (§2.9 rule 3 — a tempo, like an effect, survives the seam).
//
// THE SEAM. At speed 12 one row is 200 ms, so what the last row holds is not a detail.
// Nothing releases inside the last bar and the A7 sounds through 22:63; the final kick
// lands ON 22:63 as a pickup; and only pulse 2, vrc6p1 and vrc6p2 — the three lanes the
// loop row leaves silent — are cut there. The dominant is still sounding when the theme
// answers it, which is the difference between a loop and a stop.
// =====================================================================================
const coda = s.section('coda', 4)
{
  // With only two brass voices, spell the chord with the two tones that define it: the
  // dominant gets its third and its seventh (c#4 and g4, a tritone apart), the root left
  // to the bass pair. b3 -> c#4 rises a step as g#4 -> g4 falls a semitone.
  // No lane releases inside the last bar. At speed 12 one row is 200 ms, so a chord that
  // lets go three rows early leaves a hole where the turnaround should be (§2.9 rule 5).
  const chords = [[0, 'e2', 'b3', 'g#4'], [1, 'e2', 'b3', 'g#4'], [2, 'a2', 'c#4', 'g4'], [3, 'a2', 'c#4', 'g4']]
  for (const [bar, bass, mid, top] of chords) {
    hold(coda, L.SAW, SAWBASS, 10, bar, 0, bass, 16)
    coda.put(L.TRI, coda.at(bar, 0), { note: n(bass) + 12, inst: BASS, vol: 15 })
    hold(coda, L.V2, BRASS, 9, bar, 0, mid, 16)
    hold(coda, L.V1, BRASS, 9, bar, 0, top, 16)
  }
  const tune = [
    [0, 0, 'e5'], [1, 0, 'f#5'], [1, 8, 'g#5'], [2, 0, 'a5'], [2, 8, 'g5'],
    [3, 0, 'e5', '4', 0x42],
  ]
  sing(coda, L.P1, LEAD, 13, tune)
  for (const [bar, row, note] of tune) {
    coda.put(L.P2, coda.at(bar, row), { note: n(note) - 12, inst: COUNTER, vol: 10 })
  }
  for (const [row, inst, vol, note] of [[0, CRASH, 12, 46], [0, KICK, 13, 36], [8, KICK, 12, 36]]) {
    coda.put(L.NOISE, coda.at(0, row), { note, inst, vol })
  }
  for (let bar = 1; bar < 3; bar++) {
    for (const [row, inst, vol, note] of [[0, KICK, 13, 36], [4, SNARE, 12, SNARE_LO], [8, KICK, 12, 36], [12, SNARE, 12, SNARE_LO]]) {
      coda.put(L.NOISE, coda.at(bar, row), { note, inst, vol })
    }
    for (const row of [0, 8]) coda.put(L.DPCM, coda.at(bar, row), { note: KIT.kick, inst: KIT.inst, vol: 12 })
    for (const row of [4, 12]) coda.put(L.DPCM, coda.at(bar, row), { note: KIT.snare, inst: KIT.inst, vol: 12 })
  }
  coda.put(L.NOISE, coda.at(2, 0), { note: 46, inst: CRASH, vol: 12 })
  // the last bar: four hits getting further apart as the tempo falls away, the last of
  // them ON the loop row, so the seam gets a pickup into the theme's downbeat
  for (const [row, inst, vol, note] of [[0, CRASH, 11, 46], [4, SNARE, 11, SNARE_LO], [10, SNARE, 9, SNARE_LO], [15, KICK, 12, 36]]) {
    coda.put(L.NOISE, coda.at(3, row), { note, inst, vol })
  }
  coda.put(L.DPCM, coda.at(3, 0), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  coda.put(L.DPCM, coda.at(3, 15), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  for (const [row, speed] of [[48, 7], [56, 9], [60, 12]]) {
    const cell = coda.lanes[L.NOISE][row]
    coda.put(L.NOISE, row, { fx: [...(cell?.fx ?? []), ['F', speed]] })
  }
  // §2.9 rule 4 is "nothing rings across the seam UNRESOLVED", not "everything stops".
  // The loop row restrikes pulse 1 (d5), the triangle (d3), the sawtooth (d2), the crash
  // and the DPCM kick, so those five may sound straight through 22:63 and be answered
  // rather than cut — which is what keeps the last 200 ms of the ritardando from being
  // digital silence. Only the three lanes the loop row leaves silent are cut here.
  for (const lane of [L.P2, L.V1, L.V2]) coda.put(lane, coda.len - 1, { note: CUT })
}

// --- the order, the declaration, the file ---------------------------------------------
s.order([
  'fanfare', 'theme', 'themeP', 'lift', 'chorus', 'bridge', 'build', 'chorusP', 'coda',
])
s.loopTo('theme')
s.qa({
  key: 'd-major',
  accidentalFractionMax: 0.2,
  bpmRange: [148, 152],
  durationSec: [145, 152],
  percussionGap: 16,
  notes: [
    'D major. The raised chromatic allowance covers four prepared and resolved devices,',
    'each in a different section. (1) Chained secondaries in the theme: E (V/V) at 4:32',
    'resolves to A (V) at 4:48, with the tune reaching the lydian g#5 at 4:40. That V is',
    'then QUITTED to IV — the chord at 5:0 is G, not D — and the section\'s authentic',
    'cadence is the A of 5:32 falling to the D of 5:48 under contrary motion. (2) Modal',
    'interchange: borrowed bVI (Bb) and bVII (C) for the whole lift, 8:0-9:31, a chord a',
    'bar over its second half, under a suspension chain. (3) An Italian sixth at 13:32 —',
    'bass Bb2 with d4 on vrc6p2, g#4 on vrc6p1 and',
    'd5 in the lead — resolving outward onto A at 13:36, the bass falling a semitone as',
    'the g#4 rises one. (4) A true pivot modulation: the pivot chord is the A of',
    '17:0-17:15, which is V in D and IV in E; the sequence turns chromatic over it at',
    '17:16 (g#5, a#5) and B7 is held from 17:32 to confirm E, so the build leaves D',
    'through its own dominant and the final',
    'chorus is a whole step up, which is most of the accidental count on its own.',
    'Written suspensions and appoggiaturas: 5:28-5:36, the lead strikes d5 over D/F#,',
    'holds it over the A that arrives at 5:32 and resolves to c#5 at 5:36, while vrc6p2',
    'strikes d4 fresh on that beat as an appoggiatura and falls to c#4 with it; the brass',
    'chain at 8:0 (d#4 -> d4), 8:32 (f4 -> e4),',
    '9:16 (f4 -> e4) and 9:32 (d4 -> c#4), the two f4 suspensions each prepared as the',
    'fifth of the Bb in the bar before it; 10:48, where the lead attacks g5 — the fourth',
    'over D — on the downbeat and resolves to f#5 at 10:52; and 11:36-11:44, where pulse 2',
    'enters a beat late on d4, the fifth of G, holds it over the A of 11:40 and resolves',
    'down to c#4.',
    'PREPARED 9-8 SUSPENSIONS on vrc6p2, each consonant when struck, held or re-struck over',
    'the chord change and resolved down a step four rows later: 0:48, e4 (the fifth of the A',
    'at 0:32) over D, to d4 at 0:52; 11:48, c#4 (the third of the A at 11:40) over the',
    'deceptive Bm, to b3 at 11:52; 13:0, e4 (the fifth of the A at 12:48) over D, to d4 at',
    '13:4; and 18:0, f#4 (the fifth of the B7, held from 17:32) over the new E tonic, to e4',
    'at 18:4. The final chorus sounds the first chorus pair a step up, 19:48 (d#4 to c#4)',
    'and 21:0 (f#4 to e4). The fanfare 4-3 at 0:32 is prepared as well: vrc6p1 climbs to d5',
    'at 0:24 and holds it over the change.',
    'THE BASS is a written line, not a root-and-octave pump. Wherever the sawtooth walks',
    '(theme, 8:0-9:31, both choruses, 17:0-17:63) it plays the root on the first attack of',
    'each chord, chord tones on the beats, passing and neighbour notes only on weak 8ths and',
    'only moving on by step, and it leans into every chord change from a step away, diatonic',
    'or chromatic, above or below. Its attack rows and volumes are the ones the pump had;',
    'about one walking bar in two keeps an octave leap, and the rest of its motion is steps',
    'and chord tones. The fanfare, coda and 9:32-9:63 hold roots; the bridge keeps its cell.',
    'TWO DECLARED DEVIATIONS. (a) This piece carries NINE x- instruments against §3.1\'s',
    'cap of three. Eight lanes on two chips is the reason: the 2A03 lead, its counter-',
    'voice, the VRC6 brass, the bright reed that sits under a 2A03 lead, the one-shot',
    'stab, the saw bass, the saw lead with its bend-in attack, and the two noise voices',
    '(roll, tom) the shared kit has no equivalent of. Every one of them is played in at',
    'least two sections; none duplicates a bank timbre, and the bank is used by name for',
    'the other ten. Raising the cap for eight-voice pieces is a question for the director,',
    'not something this piece should decide. (b) The final chorus doubles the lead in',
    'UNISON on vrc6p1 from 20:0, not the octave the sketch asked for: a 2A03 pulse and a',
    'VRC6 pulse share the same 16-step divider, so a unison is exact, while the octave',
    'above this tune lands on MIDI 90-95 where that divider quantises the pair 9-15 cents',
    'apart and they would beat at the loudest notes in the piece. The pin in',
    'tests/unit/track-sunward-banner.test.ts measures both.',
    'Effect params are DECIMAL: 66 is the grid\'s 442 vibrato, 67 is 443, 49 is 431, and',
    'the vrc6p2 stabs use 55 = 037, 71 = 047 and 56 = 038 (F# major in first inversion,',
    'because 0xy only builds upward from the written note). percussionGap is 16 rather',
    'than the default 8 for exactly one gap, 15:48-15:63: the bar where the kit stops dead',
    'under the sawtooth cell and the stabs, which is the piece\'s one metric surprise',
    '(§9.4). The Fxx ritardando slows speed 6 -> 7 -> 9 -> 12 over 22:48-22:63, and the',
    'loop row restores speed 6 at 2:0 because a tempo survives the seam as an effect does.',
  ].join(' '),
  renderChecksum: 3629895864,
})
s.check()
s.write('src/assets/songs/06-sunward-banner.json')
