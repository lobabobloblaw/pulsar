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
 *         (V/V) -> A (V) -> D at theme 4:32-5:0, the lydian g#5 at 4:40;
 *         (2) modal interchange — borrowed bVI (Bb) and bVII (C) through the whole lift,
 *         8:0-9:31; (3) an ITALIAN SIXTH on bVI at chorus 13:32 (bass Bb2, d4 in vrc6p2,
 *         g#4 in vrc6p1, d5 in the lead) resolving outward to A at 13:36 — bass falls a
 *         semitone, g# rises a semitone; (4) a true pivot modulation — A is V in D and IV
 *         in E, so the build quits D through A and confirms E with B7 (pivot at 17:16,
 *         B7 at 17:32-17:63), and the final chorus is UP A WHOLE STEP in E major. The
 *         coda's E -> A7 -> D is a descending-fifths turnaround back into the loop, and
 *         `accidentalFractionMax` is declared at 0.2 to pay for all of it.
 *
 *  FORM   frame  section   bars   what happens
 *         0-1    fanfare    8     three-voice VRC6 chorale (V1 V2 SAW), 2A03 silent; snare
 *                                 rolls, DPCM kick on 1 and 3, crash on the downbeats
 *         2-5    theme     16     THE TUNE on pulse 1, echo on pulse 2 three rows behind;
 *                                 saw 8th bass with octave leaps, triangle an octave up,
 *                                 8th hats; the VRC6 thirds wait until bar 8 so the tune
 *                                 arrives on bare pulses               (loop frame 2)
 *         6-7    theme'     8     the tune's second phrase re-orchestrated onto the SAW
 *                                 (vol 11, bend-in attack); pulse 1 a descant a sixth
 *                                 above; pulse 2 rests; the triangle is the bass alone
 *         8-9    lift       8     bVI-bVII (Bb, C) as a 3+3 SIX-BAR phrase (the piece's
 *                                 asymmetry), a 4-3 suspension chain in the brass, march
 *                                 -> 16th hats, then two bars of the dominant
 *         10-13  chorus    16     the big tune on a 6+6+4 tresillo; pulse 2 an INDEPENDENT
 *                                 counter-melody for the whole section; V1/V2 a two-voice
 *                                 chorale that holds common tones; all eight lanes on
 *         14-15  bridge     8     B minor, quiet: the tune's head INVERTED on pulse 1 at
 *                                 vol 9; the saw on a 6-row cell (3 against 4) under VRC6
 *                                 stabs; pulse 2, triangle and DPCM rest; the kit stops
 *                                 for the last bar — the piece's one metric surprise
 *         16-17  build      8     the head sequenced up a step a bar over a rising bass
 *                                 (d e f# g a b), the 6-row cell carried one more frame,
 *                                 then B7 under a snare roll
 *         18-21  chorus'   16     E major; the lead doubled in unison by VRC6 pulse 1; the
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
 *  DRUMS  §9.4 signature: the kick on 1 and the 'and' of 2 (on 1 and 3 in the choruses),
 *         the snare on 2 and 4 doubled by the DPCM snare, and a vol-4 ghost on the last
 *         16th pushing into the next downbeat. Every section changes at least two of: hat
 *         subdivision (8ths -> off-beats -> 16ths -> none), hat instrument, kick
 *         placement, snare timbre (39 <-> 41) and ghost density. Seven fill shapes —
 *         roll, toms, push, burst, riser, rim and a written flam pair — placed so no two
 *         consecutive eight-bar seams close the same way, and a shape that returns comes
 *         back on the other snare.
 *
 *  HEADROOM (render gain 2.0; the VRC6 adds linearly, and a saw at 15 is twice a pulse at
 *         15). The saw never exceeds 11, the VRC6 pulses never exceed 9 under a full 2A03
 *         mix — the single 12 is in the fanfare, where the 2A03 is silent — and the lead's
 *         column tops out at 14. Measured at gain 2.0: peak 0.947, 0 clamped samples.
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

/** Sawtooth bass, one bar, rooted on a note name in octave 2 (the saw floor is MIDI 24).
 *  'eighths' is the march: the root on every 8th with the octave leap on the 'and' of 2
 *  and on 4. 'march' is quarters, 'hold' one long note, 'split' two chords in the bar.
 *  `approach` adds a chromatic approach note on the last 8th, into the next bar's root. */
function sawBar(sec, bar, root, style, opts = {}) {
  const r = n(root)
  const vol = opts.vol ?? 10
  const put = (row, note) => sec.put(L.SAW, sec.at(bar, row), { note, inst: SAWBASS, vol })
  if (style === 'eighths') {
    for (const [row, note] of [[0, r], [2, r], [4, r], [6, r + 12], [8, r], [10, r], [12, r + 12], [14, r]]) put(row, note)
  } else if (style === 'split') {
    const r2 = n(opts.second)
    for (const [row, note] of [[0, r], [2, r], [4, r + 12], [6, r], [8, r2], [10, r2], [12, r2 + 12], [14, r2]]) put(row, note)
  } else if (style === 'march') {
    for (const [row, note] of [[0, r], [4, r], [8, r + 12], [12, r]]) put(row, note)
  } else if (style === 'hold') {
    put(0, r)
  }
  if (opts.approach !== undefined) put(14, n(opts.approach))
  if (opts.restAt !== undefined) sec.put(L.SAW, sec.at(bar, opts.restAt), { note: CUT })
}

/** Triangle. 'double' doubles the saw an octave up in quarters; 'lead' is the triangle as
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

/** The six fills, one per shape, so no two 8-bar seams close the same way (§9.4). Each
 *  owns the bar's last half; `drumBar` suppresses the ordinary kit there. */
const FILLS = {
  // a snare roll thickening from 8ths to 16ths, 7 -> 13
  roll: (hit, ds, _dk, snare) => {
    for (let i = 0; i < 4; i++) hit(8 + 2 * i, SNARE, 7 + 2 * i, snare)
    hit(9, SNARE, 5, snare); hit(11, SNARE, 6, snare); hit(13, SNARE, 8, snare)
    hit(15, SNARE, 13, SNARE_HI); ds(8); ds(14)
  },
  // a tom run down the kit, high to low, snare on the last 16th
  toms: (hit, ds, dk, snare) => {
    hit(8, TOM, 14, 43); hit(10, TOM, 13, 43); hit(11, TOM, 12, 41); hit(12, TOM, 14, 37)
    hit(14, TOM, 13, 37); hit(15, SNARE, 12, snare); dk(12); ds(15)
  },
  // open hats pushing the off-beats, a light snare answer
  push: (hit, ds, dk, snare) => {
    hit(8, KICK, 12, 36); hit(10, HAT_OPEN, 9, 46); hit(12, SNARE, 13, snare)
    hit(14, HAT_OPEN, 9, 46); hit(15, SNARE, 9, SNARE_HI); dk(8); ds(12)
  },
  // a 16th burst on the last beat only
  burst: (hit, ds, dk, snare) => {
    hit(8, KICK, 12, 36); hit(12, SNARE, 13, snare); hit(13, SNARE, 8, snare)
    hit(14, SNARE, 11, snare); hit(15, SNARE, 14, snare); dk(8); ds(12); ds(14)
  },
  // a riser: the ROLL instrument's pitch macro climbs while the column does
  riser: (hit, ds) => {
    for (let i = 0; i < 8; i++) hit(8 + i, ROLL, 5 + i, 36 + i)
    ds(15)
  },
  // the metal tick (noise mode 1) against two kicks — the driest fill in the piece
  rim: (hit, ds, dk) => {
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
    fill = null, crash = false, hatVol = 0, dpcmKick = null,
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
  if (fill !== null) FILLS[fill](hit, dpcm ? ds : () => {}, dpcm ? dk : () => {}, snare)
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
// 2 and 6: d5 is prepared as a chord tone of G, held over the A chord, and steps down to
// c#5. Chords: D G A(4-3) D | Bm G A(4-3) A. Kit: DPCM kick on 1 and 3 with the noise
// kick under it, crash on the downbeats of bars 0 and 4, an 8th roll in bar 3 and a
// whole-bar 16th roll in bar 7 that hands over to the tune.
// =====================================================================================
const fanfare = s.section('fanfare', 8)
{
  // [bar, saw bass, V2 middle, V1 top, the suspension's resolution]
  const chorale = [
    [0, 'd2', 'f#4', 'a4'], [1, 'g2', 'g4', 'b4'], [2, 'a2', 'e4', 'd5', 'c#5'], [3, 'd2', 'f#4', 'd5'],
    [4, 'b2', 'f#4', 'd5'], [5, 'g2', 'g4', 'd5'], [6, 'a2', 'e4', 'd5', 'c#5'], [7, 'a2', 'g4', 'c#5', 'e5'],
  ]
  for (const [bar, bass, mid, top, resolution] of chorale) {
    const len = bar === 7 ? 15 : bar === 2 || bar === 6 ? 16 : 12 // breathe, except through a suspension
    hold(fanfare, L.SAW, SAWBASS, 10, bar, 0, bass, len)
    hold(fanfare, L.V2, BRASS, 9, bar, 0, mid, len)
    if (resolution === undefined) hold(fanfare, L.V1, BRASS, 9, bar, 0, top, len)
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
// of echo is well inside §9.2's one-third budget. The sawtooth marches in 8ths with the
// octave leap on the 'and' of 2 and on 4, with a chromatic approach note into bars 4, 10
// and 15; the triangle doubles it an octave up in quarters. V1/V2 sustain diatonic thirds
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
  bass.forEach(([root, approach], bar) => {
    sawBar(theme, bar, root, 'eighths', { vol: 10, approach })
    triBar(theme, bar, root, 'double', { approach })
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
// major, laid out as a 3 + 3 SIX-BAR phrase — the piece's one asymmetry, placed at a
// section boundary — and then two bars of the dominant under a tom break. V1/V2 carry a
// chain of written 4-3 suspensions: over Bb the top holds d#4 and steps to d4, over C it
// holds f4 and steps to e4, over A it holds d4 and steps to c#4, each one prepared as a
// chord tone of the chord before it. Pulse 1 holds the two common tones (d5 is the third
// of Bb, e5 the third of C) under a slow vibrato; pulse 2 rests. Saw and triangle march
// in quarters and then hold. Kit: 8ths for three bars, 16ths from bar 3, the cracking
// snare at note 41, the burst fill at bar 5 and the tom run at bar 7.
// =====================================================================================
const lift = s.section('lift', 8)
{
  sing(lift, L.P1, LEAD, 12, [[0, 0, 'd5', '4', 0x31], [2, 12, '---'], [3, 0, 'e5', '4', 0x31], [5, 12, '---']])
  lift.put(L.P2, 0, { note: CUT })
  const bass = ['a#2', 'a#2', 'a#2', 'c3', 'c3', 'c3', 'a2', 'a2']
  bass.forEach((root, bar) => {
    sawBar(lift, bar, root, bar < 6 ? 'march' : 'hold', { vol: 10, restAt: bar === 7 ? 8 : undefined })
    triBar(lift, bar, root, bar < 6 ? 'double' : 'hold', { restAt: bar === 7 ? 8 : undefined })
  })
  // [bar, V2's chord tone, V1's suspended note, V1's resolution]
  const brass = [
    [0, 'a#3', 'd#4', 'd4'], [1, 'a#3', 'd4'], [2, 'd4', 'f4'],
    [3, 'c4', 'f4', 'e4'], [4, 'g3', 'e4'], [5, 'g3', 'd4'],
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
    /* 11 */ [[0, 'b5'], [6, 'a5', '4', 0x43], [12, 'f#5']],
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
// 12, so 27 of its 32 attacks fall on rows the lead leaves empty; it is an arch of its
// own (f#4 up to b4, down to d4, back up to b4 and home); it carries a written 4-3
// SUSPENSION at bar 6 — d4 prepared as the fifth of G, held across into the A chord where
// it is the fourth, resolving down to c#4 on row 12; and it turns against the lead at
// both cadences: bar 7 (the lead falls c#5 -> b4, the counter rises c#4 -> d4) and bar 15
// (the lead rises c#5 -> d5, the counter falls a4 -> f#4). It never rises above the lead.
// =====================================================================================
function counterMelody(t = 0) {
  const rows = [
    /*  0 */ [[4, 'f#4'], [10, 'a4']],
    /*  1 */ [[4, 'b4'], [10, 'a4']],
    /*  2 */ [[4, 'g4'], [10, 'b4']],
    /*  3 */ [[0, 'a4'], [8, 'f#4']],
    /*  4 */ [[4, 'd4'], [10, 'f#4']],
    /*  5 */ [[4, 'a4'], [10, 'f#4']],
    /*  6 */ [[0, 'd4'], [12, 'c#4']], // the 4-3 suspension: d4 held across the bar's A
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

  // Bass: the saw marches in 8ths with the octave leap, the triangle in quarters above
  // it. A two-element root splits the bar into two chords — the section's own harmonic
  // rhythm change (§9.3), against one chord a bar everywhere else in the piece.
  roots.forEach((root, bar) => {
    if (bar === 14) return // the augmented-sixth bar is written by hand below
    const [first, second] = Array.isArray(root) ? root : [root, undefined]
    sawBar(sec, bar, first, second === undefined ? 'eighths' : 'split', { vol: sawVol, second })
    triBar(sec, bar, first, second === undefined ? 'double' : 'split', { second })
  })
  // Bar 14, the Italian sixth: the bass takes bVI for one beat under the raised fourth a
  // tritone above it, then both fall a semitone onto the dominant on row 4.
  const [flat6, dom] = roots[14]
  for (const row of [0, 2]) sec.put(L.SAW, sec.at(14, row), { note: n(flat6), inst: SAWBASS, vol: sawVol })
  for (const [row, up] of [[4, 0], [6, 12], [8, 0], [10, 0], [12, 12], [14, 0]]) {
    sec.put(L.SAW, sec.at(14, row), { note: n(dom) + up, inst: SAWBASS, vol: sawVol })
  }
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
  const lower = [
    [0, 0, 'a3', 16], [1, 0, 'b3', 24], [2, 8, 'c#4', 8], [3, 0, 'a3', 16],
    [4, 0, 'b3', 16], [5, 0, 'a3', 16], [6, 0, 'b3', 8], [6, 8, 'c#4', 8],
    [7, 0, 'b3', 16], [8, 0, 'a3', 16], [9, 0, 'b3', 32], [11, 0, 'c#4', 16],
    [12, 0, 'd4', 32], [14, 0, 'd4', 4], [14, 4, 'c#4', 12], [15, 0, 'd4', 14],
  ]
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
  ], { brassVol: 9 })
  const fills = { 3: 'rim', 7: 'flam', 11: 'burst', 15: 'roll' }
  // the chorus brass sits one column above the theme's, which is as far as the headroom
  // goes with the saw, both 2A03 pulses and the DPCM pair all sounding (§12.2)
  for (let bar = 0; bar < 16; bar++) {
    drumBar(chorus, bar, {
      hats: '16ths', kick: [0, 8], snare: SNARE_HI, ghosts: [6, 10, 14],
      fill: fills[bar] ?? null, crash: bar % 4 === 0,
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
// metre resolves onto the downbeat exactly where the bass starts driving. The kit goes
// from beat kicks to a rising 8th-then-16th snare roll, and the brass swells with A0y.
// =====================================================================================
const build = s.section('build', 8)
{
  const head = (bar, root, third, fourth, fifth) => [
    [bar, 0, root], [bar, 6, third], [bar, 8, fourth], [bar, 12, fifth],
  ]
  sing(build, L.P1, LEAD, 12, [
    ...head(0, 'd5', 'a4', 'b4', 'c#5'),
    ...head(1, 'e5', 'b4', 'c#5', 'd5'),
    ...head(2, 'f#5', 'c#5', 'd5', 'e5'),
    ...head(3, 'g5', 'd5', 'e5', 'f#5'),
    ...head(4, 'a5', 'e5', 'f#5', 'g5'),
    ...head(5, 'b5', 'f#5', 'g#5', 'a#5'),
    [6, 0, 'b4'], [6, 4, 'd#5'], [6, 8, 'f#5'], [6, 12, 'a5'],
    [7, 0, 'f#5', '4', 0x43], [7, 8, '---'],
  ])
  // pulse 2 in octaves under the lead, bars 2-5 only
  build.put(L.P2, 0, { note: CUT })
  for (const [bar, row, note] of [
    ...head(2, 'f#4', 'c#4', 'd4', 'e4'), ...head(3, 'g4', 'd4', 'e4', 'f#4'),
    ...head(4, 'a4', 'e4', 'f#4', 'g4'), ...head(5, 'b4', 'f#4', 'g#4', 'a#4'),
  ]) build.put(L.P2, build.at(bar, row), { note: n(note), inst: COUNTER, vol: 11 })
  build.put(L.P2, build.at(6, 0), { note: CUT })

  const roots = ['d2', 'e2', 'f#2', 'g2', 'a2', 'b2', 'b2', 'b2']
  const cell = [0, 7, 12]
  // frame 16: the cell, entry row 4, its phase carried from the bridge
  for (let row = 4, i = 0; row < 64; row += 6, i++) {
    build.put(L.SAW, row, { note: n(roots[Math.floor(row / 16)]) + cell[i % 3], inst: SAWBASS, vol: 10 })
  }
  // frame 17: the cell resolves and the bass drives in 8ths
  for (let bar = 4; bar < 8; bar++) sawBar(build, bar, roots[bar], 'eighths', { vol: 10 })
  roots.forEach((root, bar) => triBar(build, bar, root, bar < 4 ? 'double' : 'lead'))

  // brass: sixths climbing with the bass, then B7 held under an A0y swell
  const brass = [
    [0, 'a3', 'f#4'], [1, 'b3', 'g4'], [2, 'c#4', 'a4'], [3, 'd4', 'b4'],
    [4, 'e4', 'c#5'], [5, 'f#4', 'd#5'],
  ]
  for (const [bar, lo, hi] of brass) {
    hold(build, L.V2, BRASS, 8, bar, 0, lo, 16)
    hold(build, L.V1, BRASS, 8, bar, 0, hi, 16)
  }
  hold(build, L.V2, BRASS, 7, 6, 0, 'f#4', 30)
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
  ], { brassVol: 8, doubleFrom: 8, doubleVol: 9 })
  const fills = { 3: 'push', 7: 'riser', 11: 'rim', 15: 'toms' }
  for (let bar = 0; bar < 16; bar++) {
    drumBar(chorusP, bar, {
      hats: '16ths', hatVol: 1, kick: [0, 6, 8], dpcmKick: [0, 8], snare: SNARE_HI,
      ghosts: [10, 14], fill: fills[bar] ?? null, crash: bar % 4 === 0,
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
// =====================================================================================
const coda = s.section('coda', 4)
{
  // With only two brass voices, spell the chord with the two tones that define it: the
  // dominant gets its third and its seventh (c#4 and g4, a tritone apart), the root left
  // to the bass pair. b3 -> c#4 rises a step as g#4 -> g4 falls a semitone.
  const chords = [[0, 'e2', 'b3', 'g#4'], [1, 'e2', 'b3', 'g#4'], [2, 'a2', 'c#4', 'g4'], [3, 'a2', 'c#4', 'g4']]
  for (const [bar, bass, mid, top] of chords) {
    const len = bar === 3 ? 13 : 16
    hold(coda, L.SAW, SAWBASS, 10, bar, 0, bass, len)
    coda.put(L.TRI, coda.at(bar, 0), { note: n(bass) + 12, inst: BASS, vol: 15 })
    if (bar === 3) coda.put(L.TRI, coda.at(3, 13), { note: CUT })
    hold(coda, L.V2, BRASS, 9, bar, 0, mid, len)
    hold(coda, L.V1, BRASS, 9, bar, 0, top, len)
  }
  const tune = [
    [0, 0, 'e5'], [1, 0, 'f#5'], [1, 8, 'g#5'], [2, 0, 'a5'], [2, 8, 'g5'],
    [3, 0, 'e5', '4', 0x42], [3, 13, '---'],
  ]
  sing(coda, L.P1, LEAD, 13, tune)
  for (const [bar, row, note] of tune) {
    coda.put(L.P2, coda.at(bar, row), note === '---' ? { note: CUT } : { note: n(note) - 12, inst: COUNTER, vol: 10 })
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
  // the last bar: four hits getting further apart as the tempo falls away
  for (const [row, inst, vol, note] of [[0, CRASH, 11, 46], [4, SNARE, 11, SNARE_LO], [10, SNARE, 9, SNARE_LO], [14, KICK, 12, 36]]) {
    coda.put(L.NOISE, coda.at(3, row), { note, inst, vol })
  }
  coda.put(L.DPCM, coda.at(3, 0), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  coda.put(L.DPCM, coda.at(3, 14), { note: KIT.kick, inst: KIT.inst, vol: 12 })
  for (const [row, speed] of [[48, 7], [56, 9], [60, 12]]) {
    const cell = coda.lanes[L.NOISE][row]
    coda.put(L.NOISE, row, { fx: [...(cell?.fx ?? []), ['F', speed]] })
  }
  // nothing rings across the seam (§2.9 rule 4)
  for (const lane of [L.P1, L.P2, L.TRI, L.V1, L.V2, L.SAW]) coda.put(lane, coda.len - 1, { note: CUT })
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
    'each in a different section. (1) Chained secondaries, E (V/V) -> A (V) -> D across',
    '4:32-5:0, with the tune reaching the lydian g#5 at 4:40. (2) Modal interchange: a',
    'borrowed bVI (Bb) and bVII (C) for the whole lift, 8:0-9:31, under a suspension',
    'chain. (3) An Italian sixth at 13:32 — bass Bb2 with d4 on vrc6p2, g#4 on vrc6p1 and',
    'd5 in the lead — resolving outward onto A at 13:36, the bass falling a semitone as',
    'the g#4 rises one. (4) A true pivot modulation at 17:16-17:63: A is V in D and IV in',
    'E, so the build leaves D through its own dominant and B7 confirms E, and the final',
    'chorus is a whole step up, which is most of the accidental count on its own.',
    'Written suspensions and appoggiaturas: 5:28-5:36, the lead strikes d5 over D/F#,',
    'holds it over the A that arrives at 5:32 and resolves to c#5 at 5:36, with vrc6p2',
    'doing the same underneath; the brass chain at 8:0 (d#4 -> d4), 8:48 (f4 -> e4) and',
    '9:32 (d4 -> c#4); 10:48, where the lead attacks g5 — the fourth over D — on the',
    'downbeat and resolves to f#5 at 10:52; and 11:32-11:44, where pulse 2 prepares d4 as',
    'the fifth of G, holds it over the A of 11:40 and resolves down to c#4.',
    'Effect params are DECIMAL: 66 is the grid\'s 442 vibrato, 67 is 443, 49 is 431, and',
    'the vrc6p2 stabs use 55 = 037, 71 = 047 and 56 = 038 (F# major in first inversion,',
    'because 0xy only builds upward from the written note). percussionGap is 16 rather',
    'than the default 8 for exactly one gap, 15:48-15:63: the bar where the kit stops dead',
    'under the sawtooth cell and the stabs, which is the piece\'s one metric surprise',
    '(§9.4). The Fxx ritardando slows speed 6 -> 7 -> 9 -> 12 over 22:48-22:63, and the',
    'loop row restores speed 6 at 2:0 because a tempo survives the seam as an effect does.',
  ].join(' '),
  renderChecksum: 1819303205,
})
s.check()
s.write('src/assets/songs/06-sunward-banner.json')
