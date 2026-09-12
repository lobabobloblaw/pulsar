#!/usr/bin/env node
/** 08 — Blue Hour. The after-hours room: the album's only piece that swings.
 *
 *      node tools/songs/compose/08-blue-hour.mjs   -> src/assets/songs/08-blue-hour.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), written from the
 *  contour and harmony rules of §2.10 / §9.3. Nothing here quotes, transcribes or
 *  paraphrases any published work: the target is an idiom — seventh chords voiced by
 *  their guide tones, ii-V motion that goes somewhere, substitution at a cadence, blue
 *  inflection in the melody — and every note is invented against those rules.
 *
 *  GRID  tempo 150 - speed 5 - rowHighlight 6 -> 120 BPM. rowHighlight2 24 (a bar),
 *        rowsPerPattern 96 (a frame = 4 bars = 8.0 s). SIX rows to the beat, so the
 *        shuffle is EXACT: a swung eighth pair is rows 0 and 4 of a beat (2:1), an
 *        eighth-note triplet is rows 0, 2, 4. Straight sixteenths do not exist on this
 *        grid, and no lane in this piece ever places an off-beat on row 3.
 *  KEY   G mixolydian (the b7, F natural, is free — a dominant-quality tonic needs it).
 *        The blue inflections and the substitutions land at 8.9 % of melodic notes
 *        outside the mode, inside the lint's default 12 %, so accidentalFractionMax is
 *        NOT declared: the brief allowed up to 0.20, it did not require it.
 *
 *  FORM (16 frames of 4 bars; one pass 2:08)
 *  | frame | section | bars | what happens                                             |
 *  |-------|---------|------|----------------------------------------------------------|
 *  | 0     | head-in | 4    | the bass walks alone, ride joins, one comped push: the   |
 *  |       |         |      | room before the tune                                      |
 *  | 1-2   | A       | 8    | the head. M on pulse 1, comping on the "and"s, walking   |
 *  |       |         |      | triangle, ghost kit; section peak a5 at 2:72 over G7      |
 *  | 3-4   | A'      | 8    | M displaced a swung eighth late; V1 starts the 20-row    |
 *  |       |         |      | punch cell; the saw answers in the holes; borrowed iv     |
 *  | 5-6   | bridge  | 8    | saw takes the lead. E7-A7-D7-G7 (frame 5), then ii-V     |
 *  |       |         |      | pairs TWO TO A BAR (frame 6): the harmonic-rhythm change  |
 *  | 7-8   | trade   | 8    | pulse 1 and pulse 2 trade two bars each over a rising     |
 *  |       |         |      | diatonic sequence; §9.2's independent-line section        |
 *  | 9-10  | comp    | 8    | the 4-row cell, 3:2 against the 6-row beat, unbroken on   |
 *  |       |         |      | V2; the kit stops for a whole bar at 10:0                 |
 *  | 11    | hush    | 4    | two lanes: walking triangle + ride. A chromatic descent   |
 *  |       |         |      | c2 -> f1, then the walk back up through the ii-V          |
 *  | 12-13 | A''     | 8    | the head returns; pulse 2 an independent counter-line;    |
 *  |       |         |      | the tritone substitution Ab7 -> G7 at the cadence         |
 *  | 14-15 | out     | 8    | M in augmentation, the global peak b5, then a turnaround  |
 *  |       |         |      | that walks home — no fill at the seam                      |
 *
 *  MOTIFS
 *    M   the head (2 bars). It begins by NOT playing: a beat of silence, then a pickup
 *        on the swung "and" of 1, a leap of a minor sixth up to the peak, a stepwise
 *        fall through the b7, and a note held across the bar line that becomes the #11
 *        of the bVII. The second bar lands on the tonic and leaves a beat of air.
 *        Stated four times: 1:0 (A), 3:4 (A', displaced +4 rows), 12:0 (A'', its cadence
 *        rewritten over the tritone substitution) and 14:0 (out, in augmentation — every
 *        duration doubled, so two bars become four).
 *    N   the answer (2 bars): M's contour two scale steps down, re-harmonised over
 *        Em7 | Am7 — the same shape, a different function. Stated at 2:0 and 13:0.
 *    W   the walk. Four quarter notes a bar on the triangle, states a pitch on every
 *        beat, moves by step, and approaches each change chromatically. It is the
 *        piece's other subject and it never stops except in the two-lane hush.
 *
 *  DEVICES (all cited frame:row)
 *    §9.1  (a) the 4-row cell against the 6-row beat: three attacks in the time of two
 *              beats, a clean 3:2 realigning every 12 rows, unbroken on vrc6p2 from
 *              9:0 to 10:92 — 48 attacks, the whole of `comp`.
 *          (b) the 20-row punch cell on vrc6p1, phase-carried across three frames:
 *              entry rows 3:0, 4:4, 5:8, computed as (-96k) mod 20, not guessed.
 *          (c) the metric surprise: at 10:0 the kit stops for a whole bar and only the
 *              3:2 cell continues (§9.4 allows exactly one).
 *          (d) M displaced a swung eighth (+4 rows) at 3:4 against its 1:0 statement.
 *    §9.2  `trade` (frames 7-8) is pulse 2's section: it answers two bars at a time with
 *          its own contour and its own rhythm, and 100 % of its attacks there land on
 *          rows pulse 1 leaves empty (54 % across the whole piece). In A'' and `out` it
 *          runs a continuous counter-line under the head.
 *          Appoggiatura: the 11th over Cmaj7, f5 on the beat at 1:48, resolved down to
 *          e5 at 1:50 — and the same two rows again at 12:48 in A''.
 *          Suspension: pulse 2 takes c4, the SEVENTH of the Dm7, at 2:66 and holds it
 *          across the bar line into G7, where it is the fourth; it resolves down to b3
 *          at 2:78. Cadential.
 *          The other CADENTIAL 4-3: vrc6p1 takes c4 — the third of the Ab7 substitution —
 *          at 13:70, holds it across into the G7, and resolves it to b3 at 13:78.
 *    §9.3  (a) chained secondaries / three links of descending fifths, E7 -> A7 -> D7 ->
 *              G7, one to a bar at 5:0, 5:24, 5:48, 5:72; the comping lanes take the
 *              guide-tone tritones and walk them down chromatically with it — vrc6p2 at
 *              5:0 g#3, 5:24 g3, 5:48 f#3, 5:72 f3.
 *          (b) tritone substitution at the cadence: Ab7 at 13:48 resolving to G7 at
 *              13:72, both guide tones falling a semitone (gb3 at 13:58 -> f3 at 13:82,
 *              c4 at 13:70 -> b3 at 13:78) while the bass rises ab2 -> g2.
 *          (c) modal interchange, borrowed minor iv: Cm7 at 3:72 and again at 14:72.
 *          (d) chromatic bass descent, eight links c2 -> f1, at 11:0 through 11:42, with
 *              nothing above it but a ride cymbal.
 *          The harmonic rhythm of `bridge` frame 6 is two chords a bar against one chord
 *          a bar everywhere else; no four-chord cycle repeats anywhere in the piece.
 *    §9.4  the kit is ghosts: the ride carries the shuffle, the snare ghosts sit at vol
 *          3-6 between it, the DPCM kick is conversational. Two kit parameters change
 *          every section, each 8-bar seam has a fill, and no two fills are alike. There
 *          is deliberately NO fill at the loop seam (15:72-95 is a turnaround).
 *
 *  ALLOCATION (every lane earns its section or rests audibly)
 *    head-in  TRI alone, then NOISE - V2 pushes once - P1 P2 V1 SAW DPCM rest
 *    A        P1 head - P2 answers in the holes - TRI walk - V1 V2 comp - kit, and NO
 *             crash on the loop row: the head arrives on a ride tick and a bass note
 *    A'       P1 head displaced - V1 the 20-row punch - V2 guide tones - SAW answers
 *    bridge   SAW lead - V1 punch (f5) then comping pairs (f6) - V2 guide tones - P1
 *             answers in f6 only - P2 rests
 *    trade    P1 bars 0-1, 4-5 - P2 bars 2-3, 6-7 - TRI walk - V2 one stab a bar
 *    comp     V2 the 3:2 cell - V1 long guide tones - P1 fragments - P2 SAW rest
 *    hush     TRI + NOISE only. Six lanes silent for four bars.
 *    A''      P1 head - P2 counter-line throughout - V1 V2 anticipations - SAW answers
 *    out      the tutti: P1 augmented head + peak - P2 counter - SAW low counter-line
 *  HEADROOM   the saw is 8-11 with one 12 on its solo's peak (vol 15 on the saw is about
 *             twice a pulse at 15), the VRC6 pulses 6-12, the lead at 14 only on its two
 *             peaks, and the triangle is a gate so its 15s are not a level. 28 % of note
 *             events sit at 15 and every one of them is a triangle or a DPCM hit. The
 *             render peaks at 0.58 and the report's ">= .999" column reads 0 everywhere.
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'blue-hour',
  name: 'Blue Hour',
  author: 'pulsar original',
  speed: 5,
  rowsPerPattern: 96,
  rowHighlight: 6,
  rowHighlight2: 24,
})

// =====================================================================================
// the grid — six rows to the beat, and what may live on each of them
// =====================================================================================
const BEAT = 6
const BARROWS = 24
/** Row inside a bar. `sub` is 0 on the beat, 4 the swung "and" (a 2:1 triplet pair with
 *  the beat), 2 the middle of the eighth-note triplet. Rows 1, 3 and 5 are never used by
 *  any lane: row 3 would be a STRAIGHT eighth and would straighten the whole groove. */
const at = (beat, sub = 0) => beat * BEAT + sub
/** Durations, in rows, spelled so a phrase reads as rhythm. */
const Q = 6 // quarter
const LONG = 4 // the long half of a swung eighth pair
const SHORT = 2 // the short half
const HALF = 12
const DOT = 10 // quarter + swung eighth: the "dotted quarter" of a shuffle

// =====================================================================================
// instruments — the lead first, so instrument 0 is this piece's own (album gate)
// =====================================================================================
/** The lead: a horn that is blown, not struck. A soft front (8 -> 14 over three ticks),
 *  a duty that opens 25 % -> 50 % so the body is round rather than nasal, and a scoop of
 *  three period units that is gone by tick 4. Pitch macros ACCUMULATE, so the values sum
 *  to 0 (3 - 1 - 1 - 1) and not merely end on it. */
const LEAD = s.instrument('lead', {
  volume: { values: [9, 13, 15, 14, 13, 13, 12], loop: 6 },
  duty: { values: [1, 1, 2], loop: 2 },
  pitch: { values: [3, -1, -1, -1, 0] },
})
/** Pulse 2's voice — the second horn. Duty 2 (50 %, hollow and clarinet-ish) for the
 *  whole note, so the listener hears a different player and not a quieter copy of the
 *  first. Its front is softer still: this voice answers, it does not announce. */
const VOICE = s.instrument('voice', {
  volume: { values: [7, 11, 14, 13, 12, 12], loop: 5 },
  duty: { values: [2], loop: 0 },
})
/** The upright. Triangle has no level, only a gate (§1), so its dynamics are rhythmic:
 *  26 ticks of the 30 a quarter note gets at speed 5, which detaches every walking note
 *  by about an eighth of a beat — the thud and release of a plucked string. */
const UPRIGHT = s.instrument('upright', {
  volume: { values: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 0] },
})
/** The comping stab — the chip's own attack (duty 7 -> 3 over four ticks) over a decay
 *  16 ticks long, a little over half a beat at speed 5. MEASURED: at six ticks the chords
 *  read as clicks and the whole mix sat 3 dB under the album, because nothing but the
 *  triangle was ever sounding between attacks. A comped chord rings; this one rings for
 *  half a beat and is gone before the next one. Both VRC6 pulses use it — the difference
 *  between them is register and which guide tone they carry, never timbre. */
const COMP = s.instrument('comp', {
  volume: { values: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] },
  duty: { values: [7, 5, 3, 3], loop: 3 },
})
/** The punch: the 20-row cell's voice. Longer than the stab and thinner (duty settles on
 *  3, the bright 25 %), so the cell reads as a section punching across the bar rather
 *  than as the comping getting busier. */
const PUNCH = s.instrument('punch', {
  volume: { values: [12, 14, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] },
  duty: { values: [7, 6, 4, 3], loop: 3 },
})
/** A held guide tone: swells in over half a beat and sits. Used where the harmony has to
 *  be stated under something else that is doing the talking. */
const HOLD = s.instrument('hold', {
  volume: { values: [4, 8, 11, 13, 13, 12, 12], loop: 6 },
  duty: { values: [3], loop: 0 },
})
/** The saw as a brass lead: a four-unit bend-in (sum 0) over five ticks and a swell.
 *  Its volume column is an accumulator RATE, so it is written low — 9 to 11 — and still
 *  sits on top of the 2A03 mix. */
const HORN = s.instrument('horn', {
  volume: { values: [7, 10, 13, 14, 14, 13], loop: 5 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** The saw's short answer: no bend, self-ending, for the two-note fills it drops into
 *  the lead's holes. */
const HORN_SHORT = s.instrument('horn-short', {
  volume: { values: [13, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 0] },
})

// The kit is the shared bank's, by name and byte-identical (§12.6: a drum that is the
// same drum across the album is worth more than a lead that is). `rim` is the short-mode
// LFSR tick — the cross-stick this piece uses instead of a backbeat in its quiet halves.
// There is no noise kick: the DPCM pair carries every kick and every accented snare, and
// the noise lane is free to be nothing but ride, brushes and fills all night.
const [SNARE, TOM, HAT, OHAT, CRASH, RIM] =
  s.bank('snare', 'tom', 'hat-closed', 'hat-open', 'crash', 'rim')
const KIT = s.dpcmKit() // kick 36, snare 39 on the dpcm lane

// =====================================================================================
// harmony — every chord is its BASS ROOT plus the two tones that define it
// =====================================================================================
/** `hi` goes to vrc6p1, `lo` to vrc6p2: third and seventh, or seventh and third,
 *  whichever voice-leads. Neither lane ever takes the root — the walking bass has it, and
 *  three voices on one root is a wasted lane (§2.10). `arp` is the `0xy` param for the
 *  few stabs that want the whole chord in one cell. */
const CH = {
  G7: { hi: 'f4', lo: 'b3', arp: nib(4, 10) }, //  I7   b + f
  G7low: { hi: 'b3', lo: 'f3', arp: nib(4, 10) }, //     the cadential voicing: f stays, c falls to b
  Fmaj7: { hi: 'e4', lo: 'a3', arp: nib(4, 11) }, // bVII  a + e (the tune's b natural makes it #11)
  Cmaj7: { hi: 'e4', lo: 'b3', arp: nib(4, 11) }, // IV    e + b
  Am7: { hi: 'c4', lo: 'g3', arp: nib(3, 10) }, //   ii    c + g
  Bm7b5: { hi: 'd4', lo: 'a3', arp: nib(3, 10) }, // iii   d + a
  Dm7: { hi: 'c4', lo: 'f3', arp: nib(3, 10) }, //   v     f + c
  Em7: { hi: 'd4', lo: 'g3', arp: nib(3, 10) }, //   vi    g + d
  E7: { hi: 'd4', lo: 'gs3', arp: nib(4, 10) }, //   V/vi  g# + d
  A7: { hi: 'cs4', lo: 'g3', arp: nib(4, 10) }, //   V/v   c# + g
  D7: { hi: 'c4', lo: 'fs3', arp: nib(4, 10) }, //   V/I   f# + c
  Ab7: { hi: 'c4', lo: 'gb3', arp: nib(4, 10) }, //  bII7  the tritone sub: c + gb, both fall a semitone into G7
  Cm7: { hi: 'eb4', lo: 'bb3', arp: nib(3, 10) }, // iv    borrowed: eb + bb, both rise a semitone into G7
}
const note = (name) => n(name.replace('s', '#'))

/** The chord in force at an absolute row of a section. `changes` is `[[bar, row, name]]`
 *  in order; a lookup past the end holds the last chord. */
function chordAt(changes, row) {
  let found = changes[0]
  for (const c of changes) {
    if (c[0] * BARROWS + c[1] <= row) found = c
    else break
  }
  return CH[found[2]]
}

// =====================================================================================
// helpers — rhythm-first notation, so every line reads as durations and pitches
// =====================================================================================
const VIB = nib(4, 2) // 4xy: the medium "singing" vibrato, always written a beat late
const VIB_SLOW = nib(3, 1) // the saw's slower, narrower warmth on its long notes

/** A phrase as consecutive events `[rows, note, vol, fx?]` from `startRow`. `'-'` rests
 *  (a cut) and `'~'` extends the previous note. A note at least `vibMin` rows long blooms
 *  into vibrato `vibAfter` rows in, and the next attack or cut carries the `4x0` cancel,
 *  so nothing wobbles into the next phrase, the next section or across the loop seam
 *  (§2.9 rule 3, §12.5). Returns the row after the last event. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vib = 0, vibMin = 10, vibAfter = 6, transpose = 0, cutAtEnd = true, vol: dflt = 11, volShift = 0, volMax = 15 } = opts
  let row = startRow
  let pending = false
  const cancel = () => (pending ? [['4', 0]] : [])
  for (const [len, name, vol, fx] of events) {
    if (name === '~') {
      row += len
      continue
    }
    if (name === '-') {
      if (row < sec.len) sec.put(lane, row, { note: CUT, fx: cancel().length ? cancel() : undefined })
      pending = false
      row += len
      continue
    }
    const list = [...cancel(), ...(fx ? [fx] : [])]
    sec.put(lane, row, {
      note: note(name) + transpose,
      inst,
      vol: Math.max(0, Math.min(volMax, (vol ?? dflt) + volShift)),
      fx: list.length ? list : undefined,
    })
    pending = false
    if (vib && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
      pending = true
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    sec.put(lane, row, { note: CUT, fx: cancel().length ? cancel() : undefined })
    pending = false
  }
  if (pending) sec.put(lane, Math.min(row, sec.len) - 1, { fx: [['4', 0]] })
  return row
}

/** W — the walk. One array of four note names per bar, placed on the four beats; `null`
 *  rests a beat. `extras` are `[bar, row, note]` for the pickups, triplets and octave
 *  drops that keep the line from being a metronome. `G01` on every third bar is one tick
 *  of drag against the ride — the bass player sitting back (§2.7). */
function walk(sec, firstBar, bars, extras = [], opts = {}) {
  const { inst = UPRIGHT, drag = 3 } = opts
  bars.forEach((line, i) => {
    const bar = firstBar + i
    line.forEach((name, beat) => {
      if (name === null) return
      const fx = drag > 0 && (bar % drag) === drag - 1 && beat === 2 ? [['G', 1]] : undefined
      sec.put(L.TRI, sec.at(bar, at(beat)), { note: note(name), inst, vol: 15, ...(fx ? { fx } : {}) })
    })
  })
  for (const [bar, row, name] of extras) {
    sec.put(L.TRI, sec.at(bar, row), { note: note(name), inst, vol: 15 })
  }
}

/** Comping stabs. `pattern` is `[row, lane, vol, push?]` repeated in every bar of the
 *  span: `push` looks the chord up two rows later, so a stab on the "and" of 4 carries
 *  the NEXT bar's harmony — the anticipation that makes comping sound played rather than
 *  metronomic. The pattern changes in every section; that is this piece's anti-monotony
 *  engine. */
function stabs(sec, changes, firstBar, nBars, pattern, opts = {}) {
  const { inst = COMP, arp = false, drag = 0, skip = () => false } = opts
  for (let b = 0; b < nBars; b++) {
    const bar = firstBar + b
    for (const [row, lane, vol, push] of pattern) {
      if (skip(b, row, lane)) continue
      const abs = sec.at(bar, row)
      const c = chordAt(changes, abs + (push ? 2 : 0))
      // `0xy` is a channel MODE (§12.5). Every stab in an arped call restates it, and
      // `sealSticky()` cancels it on the section's last row, so it never outlives the
      // section that asked for it — and a plain `put()` afterwards cancels by hand.
      const fx = [...(arp ? [['0', c.arp]] : []), ...(drag ? [['G', drag]] : [])]
      sec.put(lane, abs, { note: note(lane === L.V1 ? c.hi : c.lo), inst, vol, ...(fx.length ? { fx } : {}) })
    }
  }
}

/** The kit. The backbeat is not the drum part: the ride carries the shuffle — 1, 2, the
 *  "and" of 2, 3, 4, the "and" of 4 — the snare ghosts sit at vol 3-6 on the swung
 *  off-beats between it, and the DPCM kick is conversational rather than metric. Every
 *  option here is something a section changes (§9.4 wants at least two per section). */
const RIDE = [at(0), at(1), at(1, 4), at(2), at(3), at(3, 4)]
function kit(sec, bar, opts = {}) {
  const {
    ride = RIDE, rideVol = 8, ghosts = [at(0, 4), at(2, 4)], ghostVol = 4,
    open = [], rim = [], snare = [], kick = [at(0)], dsnare = [], crash = false, drag = true,
  } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 10 })
  for (const r of ride) {
    if (crash && r === 0) continue
    const accent = r === at(1, 4) || r === at(3, 4) ? 1 : 0
    sec.put(L.NOISE, sec.at(bar, r), { note: 45, inst: HAT, vol: rideVol + accent })
  }
  for (const r of open) sec.put(L.NOISE, sec.at(bar, r), { note: 46, inst: OHAT, vol: 7 })
  for (const r of rim) sec.put(L.NOISE, sec.at(bar, r), { note: 44, inst: RIM, vol: 8 })
  for (const r of snare) sec.put(L.NOISE, sec.at(bar, r), { note: 39, inst: SNARE, vol: 10 })
  for (const r of ghosts) {
    sec.put(L.NOISE, sec.at(bar, r), { note: 39, inst: SNARE, vol: ghostVol, ...(drag ? { fx: [['G', 1]] } : {}) })
  }
  for (const r of kick) sec.put(L.DPCM, sec.at(bar, r), { note: KIT.kick, inst: KIT.inst, vol: 15 })
  for (const r of dsnare) sec.put(L.DPCM, sec.at(bar, r), { note: KIT.snare, inst: KIT.inst, vol: 15 })
}

/** A fill in a bar's last two beats. Each of the five is written once and used once —
 *  §9.4 forbids two identical fills, and there is deliberately none at the loop seam. */
function fill(sec, bar, kind) {
  for (let r = 12; r < 24; r++) sec.lanes[L.NOISE][sec.at(bar, r)] = null
  if (kind === 'toms') {
    sec.hits(L.NOISE, TOM, 11, [[bar, at(2)], [bar, at(2, 4)]], 43)
    sec.hits(L.NOISE, TOM, 11, [[bar, at(3)], [bar, at(3, 4)]], 37)
  } else if (kind === 'ghost-roll') {
    for (const [r, v] of [[at(2), 5], [at(2, 2), 4], [at(2, 4), 6], [at(3), 5], [at(3, 2), 7], [at(3, 4), 9]]) {
      sec.put(L.NOISE, sec.at(bar, r), { note: 39, inst: SNARE, vol: v })
    }
  } else if (kind === 'rim-triplets') {
    for (const r of [at(2), at(2, 2), at(2, 4), at(3), at(3, 2), at(3, 4)]) {
      sec.put(L.NOISE, sec.at(bar, r), { note: 44, inst: RIM, vol: r % BEAT === 0 ? 9 : 6 })
    }
  } else if (kind === 'open-answer') {
    sec.put(L.NOISE, sec.at(bar, at(2)), { note: 39, inst: SNARE, vol: 8 })
    sec.put(L.NOISE, sec.at(bar, at(2, 4)), { note: 46, inst: OHAT, vol: 8 })
    sec.put(L.NOISE, sec.at(bar, at(3, 4)), { note: 39, inst: SNARE, vol: 10 })
  } else if (kind === 'tom-drop') {
    sec.hits(L.NOISE, TOM, 10, [[bar, at(2)]], 43)
    sec.hits(L.NOISE, TOM, 10, [[bar, at(2, 4)]], 40)
    sec.hits(L.NOISE, TOM, 11, [[bar, at(3)]], 37)
    sec.put(L.NOISE, sec.at(bar, at(3, 4)), { note: 39, inst: SNARE, vol: 9 })
  } else if (kind === 'evaporate') {
    // the only fill that gets QUIETER: the kit thinning itself out of the way of `hush`
    sec.put(L.NOISE, sec.at(bar, at(2)), { note: 45, inst: HAT, vol: 7 })
    for (const [r, v] of [[at(3), 6], [at(3, 2), 4], [at(3, 4), 3]]) {
      sec.put(L.NOISE, sec.at(bar, r), { note: 39, inst: SNARE, vol: v })
    }
  } else if (kind === 'tom-rim') {
    sec.hits(L.NOISE, TOM, 11, [[bar, at(2)], [bar, at(3)]], 40)
    for (const r of [at(2, 4), at(3, 2), at(3, 4)]) {
      sec.put(L.NOISE, sec.at(bar, r), { note: 44, inst: RIM, vol: r === at(3, 4) ? 9 : 6 })
    }
  } else if (kind === 'triplet-ghosts') {
    sec.put(L.NOISE, sec.at(bar, at(2)), { note: 44, inst: RIM, vol: 8 })
    sec.put(L.NOISE, sec.at(bar, at(2, 4)), { note: 45, inst: HAT, vol: 7 })
    for (const [r, v] of [[at(3), 4], [at(3, 2), 6], [at(3, 4), 9]]) {
      sec.put(L.NOISE, sec.at(bar, r), { note: 39, inst: SNARE, vol: v })
    }
  }
}

// =====================================================================================
// the motifs, written once as rhythm + pitch
// =====================================================================================
/** M — the head, two bars over G7 | Fmaj7. It opens by not playing. The pickup is the
 *  third; the leap to the peak is a minor sixth and it is answered immediately by
 *  stepwise motion in the opposite direction; the b7 (f5) lands on a beat, which is the
 *  mixolydian signature; the b4 held across the bar line becomes the #11 of the bVII;
 *  and the phrase ends a beat early, which is the hole pulse 2 and the saw answer in. */
const M = [
  [LONG, '-'], //            beat 1: silence. The tune starts late on purpose.
  [SHORT, 'b4', 9], //       the swung "and" of 1 — the pickup, the third of G7
  [LONG, 'g5', 13], //       beat 2: up a minor sixth to the motif's peak
  [SHORT, 'f5', 12], //      and straight back down by step — the b7
  [LONG, 'e5', 12], //       beat 3
  [SHORT, 'd5', 11], //      the "and" of 3
  [HALF, 'b4', 12], //       beat 4, held across the bar line: the #11 of Fmaj7
  [LONG, 'c5', 11], //       bar 1, beat 2
  [SHORT, 'a4', 10], //      the "and" of 2
  [Q, 'g4', 12], //          beat 3: the landing, low
  [Q, '-'], //               beat 4: the hole
]
/** N — the answer, two bars over Em7 | Am7: M's contour two scale steps down, so the
 *  same shape now begins on the third of vi and ends on the fifth of ii. A variation by
 *  transposition and re-harmonisation, not a repeat. */
const N = [
  [LONG, '-'],
  [SHORT, 'g4', 9],
  [LONG, 'e5', 12],
  [SHORT, 'd5', 11],
  [LONG, 'c5', 11],
  [SHORT, 'b4', 10],
  [HALF, 'g4', 11],
  [LONG, 'a4', 10],
  [SHORT, 'g4', 10],
  [Q, 'e4', 11],
  [Q, '-'],
]

// =====================================================================================
// head-in — frame 0: the room before the tune
// =====================================================================================
const CHANGES_IN = [[0, 0, 'G7'], [1, 0, 'G7'], [2, 0, 'Am7'], [3, 0, 'D7']]
const headIn = s.section('head-in', 4)
{
  // TRI  the walk, alone for two bars. The piece's first sound is the bass player.
  walk(headIn, 0, [
    ['g1', 'b1', 'd2', 'e2'],
    ['f2', 'e2', 'd2', 'b1'],
    ['a1', 'c2', 'e2', 'g2'],
    ['d2', 'c2', 'b1', 'fs1'], // f#1 -> g1: the chromatic approach into the head
  ], [[1, at(3, 4), 'c2'], [3, at(3, 4), 'g1']], { drag: 0 })
  // NOISE  the ride joins on bar 1 — nothing announces it, it is simply there.
  kit(headIn, 1, { ghosts: [], kick: [], rideVol: 5 })
  kit(headIn, 2, { ghosts: [at(2, 4)], kick: [at(0)], rideVol: 6 })
  kit(headIn, 3, { ghosts: [at(0, 4), at(2, 4)], kick: [at(0), at(2, 4)], rideVol: 6 })
  // V1 / V2  one comped push into the head: the seventh on beat 4, the third of the D7 a
  // swung eighth later. The only VRC6 notes before the tune, and they are already off the
  // beat, which is where every chord in this piece lands.
  headIn.put(L.V1, headIn.at(3, at(3)), { note: note('c4'), inst: COMP, vol: 7 })
  headIn.put(L.V2, headIn.at(3, at(3, 4)), { note: note('fs3'), inst: COMP, vol: 8 })
}

// =====================================================================================
// A — frames 1-2: the head
// =====================================================================================
/** A's changes: one to a bar, and it goes somewhere. bVII and IV either side of the
 *  tonic, then Em7 - Am7 - Dm7 - G7, three links of descending fifths landing home. */
const CHANGES_A = [
  [0, 0, 'G7'], [1, 0, 'Fmaj7'], [2, 0, 'Cmaj7'], [3, 0, 'G7'],
  [4, 0, 'Em7'], [5, 0, 'Am7'], [6, 0, 'Dm7'], [7, 0, 'G7'],
]
/** The head's second half. Bars 2-3 answer M with a 9-8 suspension over Cmaj7 (a5 held
 *  from the G7 before it, resolving down to g5 two rows later) and an appoggiatura f5 on
 *  the beat. Bars 6-7 are the cadence: the line climbs while the bass falls, and the
 *  section's single peak — a5, the ninth of G7 — lands on beat 1 of bar 7. */
const A_ANSWER = [
  [SHORT, 'f5', 12], //      bar 2 beat 1: APPOGGIATURA — the 11th over Cmaj7, on the beat
  [LONG, 'e5', 12], //       resolved down by step two rows later, on the triplet
  [LONG, 'g5', 12], //       beat 2
  [SHORT, 'e5', 11],
  [Q, 'd5', 11], //          beat 3
  [Q, '-'], //               beat 4: air
  [LONG, 'd5', 10], //       bar 3 beat 1
  [SHORT, 'f5', 12], //      the blue turn: up to the b7
  [LONG, 'e5', 11],
  [SHORT, 'd5', 10],
  [HALF, 'b4', 11], //       beat 3, held into the second half of the head
]
const A_CADENCE = [
  [LONG, '-'], //            bar 6 beat 1: the hole again, so the cadence has a running start
  [SHORT, 'd5', 10],
  [LONG, 'f5', 11], //       beat 2
  [SHORT, 'g5', 12],
  [LONG, 'e5', 11], //       beat 3
  [SHORT, 'g5', 12],
  [Q, 'f5', 12], //          beat 4 — every step of this bar rises against a falling bass
  [Q, 'a5', 14], //          bar 7 beat 1: THE SECTION PEAK, the ninth of G7, on a strong beat
  [LONG, 'g5', 13], //       beat 2
  [SHORT, 'f5', 12],
  [LONG, 'd5', 11], //       beat 3
  [SHORT, 'b4', 10],
  [Q, '-'], //               beat 4: hand over to A'
]
const A = s.section('A', 8)
{
  // P1  the head: M, its answer, N (M two steps down), then the cadence phrase.
  phrase(A, L.P1, LEAD, 0, M, { vib: VIB })
  phrase(A, L.P1, LEAD, A.at(2), A_ANSWER, { vib: VIB })
  phrase(A, L.P1, LEAD, A.at(4), N, { vib: VIB })
  phrase(A, L.P1, LEAD, A.at(6), A_CADENCE, { vib: VIB })
  // P2  short answers, and only in the holes M leaves. Never the lead's rhythm at
  // another interval (§9.2): two notes, its own shape, out again.
  A.put(L.P2, 0, { note: CUT }) // the loop row: this lane is silent here and says so
  phrase(A, L.P2, VOICE, A.at(1, at(3)), [[LONG, 'd4', 8], [SHORT, 'e4', 9], [Q, 'g4', 11], [Q, '-']])
  phrase(A, L.P2, VOICE, A.at(3, at(3)), [[LONG, 'g4', 9], [SHORT, 'bb4', 9], [Q, 'b4', 10], [Q, '-']]) // bb -> b: the blue third, resolved up by step
  phrase(A, L.P2, VOICE, A.at(5, at(3)), [[LONG, 'e4', 8], [SHORT, 'f4', 9], [Q, 'a4', 11], [Q, '-']])
  // the cadential suspension: c4 is the SEVENTH of the Dm7 in bar 6, held across the
  // change into bar 7 where it is G7's fourth, and resolved down by step to the third on
  // beat 2. Two beats of dissonance on a pulse channel, and it costs one row placement.
  phrase(A, L.P2, VOICE, A.at(6, at(3)), [[HALF, 'c4', 10], [HALF, 'b3', 11], [Q, '-']], { vib: VIB, vibMin: 12, vibAfter: 6 })
  // TRI  the walk: a pitch on every beat, chromatic approaches into bars 2, 5 and 6.
  walk(A, 0, [
    ['g1', 'b1', 'd2', 'e2'],
    ['f2', 'e2', 'c2', 'b1'],
    ['c2', 'e2', 'g2', 'fs2'], // f#2 -> g2, from below
    ['g2', 'f2', 'e2', 'd2'],
    ['e2', 'd2', 'c2', 'b1'],
    ['a1', 'c2', 'e2', 'eb2'], // eb2 -> d2, from above
    ['d2', 'f2', 'a2', 'ab2'], // ab2 -> g2, from above
    ['g2', 'd2', 'b1', 'a1'],
  ], [[3, at(3, 4), 'cs2'], [7, at(3, 4), 'a1']])
  // V1 / V2  comping on the "and" of 2 and the "and" of 4, the second one carrying the
  // NEXT bar's chord: pushed into the bar, never on the downbeat. `G02` lays every stab
  // two ticks behind the ride — the comping sits back, which is most of "played".
  // Both lanes state a CUT on row 0: this is the loop row, nothing is comped on the
  // head's downbeat, and a lane that is silent at the seam has to say so (§2.9 rule 2).
  A.put(L.V1, 0, { note: CUT })
  A.put(L.V2, 0, { note: CUT })
  stabs(A, CHANGES_A, 0, 8, [
    [at(1, 4), L.V2, 9],
    [at(3, 4), L.V1, 8, true],
  ], { drag: 2 })
  // and two half-bar answers where the tune rests, so the comping converses
  stabs(A, CHANGES_A, 0, 8, [[at(2, 4), L.V1, 7]], { skip: (b) => b % 2 === 0, drag: 2 })
  // NOISE / DPCM  ride and ghosts; the hat opens on the "and" of 4 every fourth bar;
  // fill 1 at bar 3 (toms), fill 2 at bar 7 (a ghost roll) — different from each other.
  for (let bar = 0; bar < 8; bar++) {
    kit(A, bar, {
      // NO crash on bar 0: this is the loop row, and a cymbal there would announce the
      // seam on every pass. The head arrives on a ride tick and a bass note.
      ghosts: bar % 2 ? [at(0, 4), at(2, 4), at(3, 4)] : [at(0, 4), at(2, 4)],
      rim: bar === 4 ? [at(1)] : [],
      kick: bar % 2 ? [at(0), at(2, 4)] : [at(0), at(1, 4)],
      dsnare: bar === 4 ? [at(2)] : [],
    })
  }
  fill(A, 3, 'toms')
  fill(A, 7, 'ghost-roll')
}

// =====================================================================================
// A' — frames 3-4: the head a swung eighth late, and the punch cell starts
// =====================================================================================
/** A' keeps M and moves the harmony: the bVII-IV pair now falls to the BORROWED MINOR
 *  IV (Cm7) at bar 3, whose eb and bb both rise a semitone into G7's b and f. */
const CHANGES_A2 = [
  [0, 0, 'G7'], [1, 0, 'Fmaj7'], [2, 0, 'Cmaj7'], [3, 0, 'Cm7'],
  [4, 0, 'G7'], [5, 0, 'Am7'], [6, 0, 'Dm7'], [7, 0, 'G7low'],
]
/** The second half of A': a blue inflection — bb4 as a chromatic lower neighbour into
 *  b4 — over the borrowed iv, and a descent that hands the piece to the saw. */
const A2_SECOND = [
  [LONG, 'eb5', 11], //      bar 3 beat 1, over Cm7: the borrowed flat third of the chord
  [SHORT, 'd5', 11],
  [LONG, 'c5', 10], //       beat 2
  [SHORT, 'bb4', 10], //     the blue note, held two rows
  [Q, 'b4', 11], //          resolves UP by step, on the beat, into G7's third
  [Q, '-'],
  [LONG, 'd5', 10], //       bar 4
  [SHORT, 'e5', 11],
  [DOT, 'g5', 12], //        beat 2 through the "and" of 3
  [SHORT, 'f5', 11],
  [Q, 'e5', 11],
  [Q, '-'],
]
const A2 = s.section("A'", 8)
{
  // P1  M DISPLACED +4 rows — a swung eighth late against its 1:0 statement (§9.1
  // recipe F). Everything after it stays displaced until the phrase closes.
  phrase(A2, L.P1, LEAD, 4, M, { vib: VIB })
  phrase(A2, L.P1, LEAD, A2.at(3), A2_SECOND, { vib: VIB })
  phrase(A2, L.P1, LEAD, A2.at(5), [
    [LONG, '-'], [SHORT, 'c5', 10], [LONG, 'e5', 11], [SHORT, 'g5', 12],
    [Q, 'a5', 12], [Q, '-'],
    [LONG, 'f5', 11], [SHORT, 'e5', 11], [Q, 'd5', 11], [HALF, 'b4', 11],
  ], { vib: VIB })
  // P2  rests for the whole section. The lane that spoke in A is the one the ear misses.
  A2.put(L.P2, 0, { note: CUT })
  // TRI  the walk drops an octave at bar 1 and climbs back: the same line, more room.
  walk(A2, 0, [
    ['g1', 'a1', 'b1', 'd2'],
    ['f2', 'e2', 'c2', 'a1'],
    ['c2', 'b1', 'c2', 'd2'],
    ['c2', 'eb2', 'g2', 'ab2'], // borrowed iv spelled in the bass, ab2 -> g2
    ['g2', 'f2', 'd2', 'b1'],
    ['a1', 'b1', 'c2', 'e2'],
    ['d2', 'f2', 'a1', 'fs1'],
    ['g1', 'b1', 'd2', 'f2'],
  ], [[1, at(3, 4), 'g1'], [5, at(3, 4), 'fs2']])
  // V1  THE 20-ROW PUNCH CELL (§9.1). Ten attacks, every 20 rows from row 0: 20 rows is
  // ten triplet-eighths against the bar's twelve, so the figure walks backwards through
  // the bar by four rows each bar and never lands where it landed before. Its entry row
  // per frame is (-96k) mod 20 — 0 here, 4 in frame 4, 8 when it carries on into the
  // bridge. Computed, not guessed. Pitch follows the changes: it always punches the
  // chord's upper guide tone.
  for (let row = 0; row < A2.len; row += 20) {
    const c = chordAt(CHANGES_A2, row)
    A2.put(L.V1, row, { note: note(c.hi), inst: PUNCH, vol: 9 })
  }
  // V2  holds the lower guide tone under the punch: one note a bar, entering on the
  // "and" of 1 so the harmony is stated off the beat, as the rest of the piece is.
  // and it leans in for the second half of the section: 8 under the displaced head,
  // 10 once the saw has entered and the borrowed iv has been heard.
  stabs(A2, CHANGES_A2, 0, 4, [[at(0, 4), L.V2, 8]], { inst: HOLD })
  stabs(A2, CHANGES_A2, 4, 4, [[at(0, 4), L.V2, 10]], { inst: HOLD })
  // SAW  its first entrance: two-note answers dropped into the lead's holes, never
  // doubling the bass and never above 10.
  phrase(A2, L.SAW, HORN_SHORT, A2.at(1, at(3)), [[LONG, 'd4', 9], [SHORT, 'f4', 9], [Q, 'e4', 9], [Q, '-']])
  phrase(A2, L.SAW, HORN_SHORT, A2.at(4, at(3)), [[LONG, 'b3', 9], [SHORT, 'c4', 9], [Q, 'd4', 10], [Q, '-']])
  phrase(A2, L.SAW, HORN_SHORT, A2.at(6, at(2)), [[LONG, 'a3', 9], [SHORT, 'c4', 9], [LONG, 'd4', 10], [SHORT, 'f4', 10], [Q, 'e4', 10], [Q, '-']])
  // NOISE / DPCM  the kit opens up: the hat is open on the "and" of 4, the ghosts move
  // to the "and" of 1 and 3, the kick pushes the bar line. Fill 3 at bar 7.
  for (let bar = 0; bar < 8; bar++) {
    kit(A2, bar, {
      ghosts: [at(0, 4), at(2, 4)],
      ghostVol: bar % 2 ? 5 : 4,
      open: [at(3, 4)],
      ride: [at(0), at(1), at(1, 4), at(2), at(3)],
      kick: bar % 4 === 3 ? [at(0), at(1, 4), at(3, 4)] : [at(0), at(2, 4)],
      rim: bar % 4 === 2 ? [at(2)] : [],
    })
  }
  fill(A2, 7, 'rim-triplets')
}

// =====================================================================================
// bridge — frames 5-6: the saw takes it, and the harmony chains
// =====================================================================================
/** Frame 5 is three links of descending fifths made of secondary dominants — E7 (V/vi)
 *  to A7 (V/v) to D7 (V/I) to G7 — one to a bar. Each link raises one note a semitone,
 *  and the two comping lanes carry the guide-tone tritones DOWN chromatically with it:
 *  d4/g#3, c#4/g3, c4/f#3, b3/f3. Four bars of strict parallel motion, which §9.2 allows
 *  exactly this once, as an earned gesture, because it IS the sound of the chain.
 *
 *  Frame 6 changes the harmonic rhythm: TWO chords a bar, ii-V pairs stepping down.
 *  Nothing else in the piece moves faster than one chord a bar. */
const CHANGES_BR = [
  // bar 3 takes the LOW G7 voicing so the chain's guide tones complete their chromatic
  // descent instead of jumping back up: vrc6p2 walks g#3 - g3 - f#3 - f3 and vrc6p1
  // d4 - c#4 - c4 - b3, four links each, one a bar.
  [0, 0, 'E7'], [1, 0, 'A7'], [2, 0, 'D7'], [3, 0, 'G7low'],
  [4, 0, 'Em7'], [4, at(2), 'A7'],
  [5, 0, 'Dm7'], [5, at(2), 'G7'],
  [6, 0, 'Cmaj7'], [6, at(2), 'Bm7b5'],
  [7, 0, 'Am7'], [7, at(2), 'D7'],
]
const bridge = s.section('bridge', 8)
{
  // SAW  the lead for the whole section: a horn solo over the chain, long notes with a
  // slow vibrato, its phrases ending early so the comping can answer. Volume 9-11 — the
  // saw's column is an accumulator rate and reaches roughly twice a pulse's level.
  phrase(bridge, L.SAW, HORN, 0, [
    [LONG, '-'], [SHORT, 'b3', 9], //                bar 0, E7: pickup on the "and" of 1
    [LONG, 'e4', 11], [SHORT, 'gs4', 11], //         the raised third — the event of the link
    [DOT, 'b4', 11], [SHORT, 'a4', 10],
    [Q, 'gs4', 10], //                               beat 4
    [Q, 'e4', 10], //                                bar 1, A7
    [LONG, 'cs5', 11], [SHORT, 'b4', 10], //         the next raised third, a step above the last
    [LONG, 'a4', 10], [SHORT, 'g4', 10],
    [Q, 'e4', 8],
    [Q, '-'], //                                     the hole
    [LONG, 'a4', 10], [SHORT, 'c5', 10], //          bar 2, D7
    [LONG, 'fs5', 12], [SHORT, 'e5', 11], //         the third link's raised third, on top
    [Q, 'd5', 11],
    [Q, 'c5', 10],
    [HALF, 'b4', 11], //                             bar 3, G7: the chain lands on the third
    [LONG, 'g4', 10], [SHORT, 'a4', 10],
    [Q, 'b4', 10],
  ], { vib: VIB_SLOW, vibMin: 10, vibAfter: 6 })
  phrase(bridge, L.SAW, HORN, bridge.at(4), [
    [LONG, '-'], [SHORT, 'd4', 9], //                bar 4
    [LONG, 'g4', 10], [SHORT, 'b4', 10],
    [LONG, 'cs5', 11], [SHORT, 'b4', 10], //         over the A7 half of the bar
    [Q, 'a4', 10],
    [LONG, 'f4', 10], [SHORT, 'a4', 10], //          bar 5, Dm7
    [LONG, 'c5', 10], [SHORT, 'b4', 10],
    [DOT, 'd5', 11], [SHORT, 'b4', 10], //           over the G7 half
    [Q, '-'],
    [LONG, 'e5', 11], [SHORT, 'd5', 10], //          bar 6, Cmaj7 | Bm7b5
    [LONG, 'c5', 10], [SHORT, 'b4', 10],
    [Q, 'a4', 10],
    [Q, 'd5', 10],
    [LONG, 'c5', 10], [SHORT, 'a4', 10], //          bar 7, Am7 | D7
    [Q, 'fs4', 9],
    [HALF, 'g4', 8], //                             the solo signs off under the comping
  ], { vib: VIB_SLOW, vibMin: 10, vibAfter: 6 })
  // V1  the punch cell carries on from A' for one more frame — entry row 8, computed —
  // then stops at the frame line, where the harmonic rhythm doubles.
  for (let row = 8; row < 96; row += 20) {
    const c = chordAt(CHANGES_BR, row)
    bridge.put(L.V1, row, { note: note(c.hi), inst: PUNCH, vol: 9 })
  }
  // V2  the lower guide tone on each link, on the beat for once: the chromatic tritone
  // descent g#3 - g3 - f#3 - f3 is the chain's own bass, and it wants to be square.
  stabs(bridge, CHANGES_BR, 0, 4, [[at(0), L.V2, 9]], { inst: HOLD })
  // frame 6: both lanes comp the ii-V pairs, V1 on the beat, V2 pushed a swung eighth.
  stabs(bridge, CHANGES_BR, 4, 2, [[at(0, 4), L.V2, 9], [at(2, 4), L.V2, 9]], { arp: true })
  stabs(bridge, CHANGES_BR, 6, 2, [[at(0, 4), L.V2, 12], [at(2, 4), L.V2, 11]], { arp: true })
  stabs(bridge, CHANGES_BR, 4, 4, [[at(1), L.V1, 8], [at(3), L.V1, 8]], { drag: 1 })
  // P1  silent through the chain, then answers the saw in the second frame — four short
  // phrases in the saw's holes, an octave above it.
  bridge.put(L.P1, 0, { note: CUT })
  phrase(bridge, L.P1, LEAD, bridge.at(5, at(3)), [[LONG, 'g5', 11], [SHORT, 'f5', 11], [Q, 'e5', 11], [Q, '-']])
  phrase(bridge, L.P1, LEAD, bridge.at(7, at(1)), [[LONG, 'c5', 10], [SHORT, 'b4', 10], [Q, 'a4', 10], [Q, 'fs5', 12], [Q, '-']])
  // P2 rests. SAW is the lead here; two leads at once is the one thing eight voices
  // makes easy and §12.2 forbids.
  bridge.put(L.P2, 0, { note: CUT })
  // TRI  the walk under the chain: each bar states the new root and approaches the next
  // one chromatically — the chain is audible in the bass alone.
  walk(bridge, 0, [
    ['e2', 'gs2', 'b1', 'bb1'], //         E7: root, third, fifth, then bb1 -> a1
    ['a1', 'cs2', 'e2', 'eb2'], //         A7 -> d2
    ['d2', 'fs2', 'a2', 'ab2'], //         D7 -> g2
    ['g2', 'f2', 'd2', 'b1'], //           G7
    ['e2', 'd2', 'a1', 'cs2'], //          Em7 | A7
    ['d2', 'c2', 'b1', 'g1'], //           Dm7 | G7
    ['c2', 'e2', 'd2', 'b1'], //           Cmaj7 | Bm7b5
    ['a1', 'c2', 'd2', 'fs2'], //          Am7 | D7 -> g
  ], [[3, at(3, 4), 'a1'], [7, at(3, 4), 'a2']])
  // NOISE / DPCM  the section's kit change: the ride thins to the beat plus the "and" of
  // 4 and the cross-stick takes the backbeat, so the chain has room. Fill 4 at bar 7.
  for (let bar = 0; bar < 8; bar++) {
    kit(bridge, bar, {
      ride: bar < 4 ? [at(0), at(1), at(2), at(3), at(3, 4)] : RIDE,
      rideVol: 6,
      ghosts: bar < 4 ? [at(2, 4)] : [at(0, 4), at(2, 4)],
      rim: bar < 4 ? [at(1), at(3)] : [],
      kick: bar % 2 ? [at(0), at(1, 4)] : [at(0)],
      crash: bar === 0,
      dsnare: bar === 4 ? [at(0)] : [],
    })
  }
  fill(bridge, 7, 'open-answer')
}

// =====================================================================================
// trade — frames 7-8: pulse 1 and pulse 2 answer each other, two bars each
// =====================================================================================
/** The changes rise by step — G7, Am7, Bm7b5, Cmaj7, Dm7, Em7 — then turn home through
 *  Am7 - D7. An ascending diatonic sequence, the mirror of the bridge's descent, and it
 *  is what keeps a trading section from being a vamp with a solo over it. */
const CHANGES_TR = [
  [0, 0, 'G7'], [1, 0, 'Am7'], [2, 0, 'Bm7b5'], [3, 0, 'Cmaj7'],
  [4, 0, 'Dm7'], [5, 0, 'Em7'], [6, 0, 'Am7'], [7, 0, 'D7'],
]
const trade = s.section('trade', 8)
{
  // P1  bars 0-1 and 4-5. Arching phrases that start on the beat and end early.
  phrase(trade, L.P1, LEAD, 0, [
    [Q, 'd5', 11], [LONG, 'e5', 11], [SHORT, 'g5', 12],
    [LONG, 'f5', 12], [SHORT, 'e5', 11], [Q, 'd5', 11],
    [LONG, 'c5', 10], [SHORT, 'e5', 11], [DOT, 'g5', 12], [SHORT, 'f5', 11],
    [Q, 'e5', 11], [Q, '-'],
  ], { vib: VIB })
  phrase(trade, L.P1, LEAD, trade.at(4), [
    [LONG, '-'], [SHORT, 'f5', 11], //         bar 4
    [LONG, 'g5', 12], [SHORT, 'e5', 11],
    [Q, 'd5', 11], [Q, '-'], //                and it stops, a whole beat early
    [Q, 'a5', 13], //                          bar 5 beat 1: trade's peak, leapt into from
    [LONG, 'g5', 12], [SHORT, 'e5', 11], //    the silence, then walked back down by step
    [LONG, 'd5', 11], [SHORT, 'b4', 11],
    [Q, '-'],
  ], { vib: VIB })
  // P2  bars 2-3 and 6-7 — its own section (§9.2). A different register (a sixth below),
  // a different contour (it descends where pulse 1 arched), and a different rhythm: it
  // starts on the "and" and runs in triplets where pulse 1 ran in swung eighths. Every
  // one of its attacks here falls on a row pulse 1 leaves empty.
  trade.put(L.P2, 0, { note: CUT })
  phrase(trade, L.P2, VOICE, trade.at(2, at(0, 4)), [
    [SHORT, 'd5', 10], [SHORT, 'c5', 10], [SHORT, 'b4', 10], //  a triplet, off the beat
    [LONG, 'a4', 10], [SHORT, 'b4', 10],
    [Q, 'd5', 12], [Q, '-'],
    [LONG, 'e4', 8], [SHORT, 'g4', 9], [LONG, 'b4', 11], [SHORT, 'c5', 12],
    [DOT, 'b4', 11], [SHORT, '-'],
  ], { vib: VIB, vibMin: 10, vibAfter: 6 })
  // its second answer takes a different entrance and a different subdivision from its
  // first — on the beat rather than the "and", a hole where the first one ran on, and the
  // triplet moved to the downbeat of bar 7. Two answers, not one answer twice.
  phrase(trade, L.P2, VOICE, trade.at(6, at(0)), [
    [Q, 'c5', 10], //                                              bar 6 beat 1
    [LONG, 'a4', 10], [SHORT, 'g4', 10],
    [Q, '-'], //                                                   beat 3: the hole
    [LONG, 'e4', 10], [SHORT, 'g4', 10],
    [SHORT, 'fs4', 9], [SHORT, 'a4', 11], [SHORT, 'c5', 12], //    bar 7: the triplet, on the beat
    [LONG, 'b4', 11], [SHORT, 'a4', 11],
    [HALF, 'g4', 11], //                                           and it hands back to the head
  ], { vib: VIB, vibMin: 10, vibAfter: 6 })
  // TRI  the walk climbs with the sequence, one octave over eight bars.
  walk(trade, 0, [
    ['g1', 'b1', 'd2', 'f2'],
    ['a1', 'c2', 'e2', 'g2'],
    ['b1', 'd2', 'f2', 'a2'],
    ['c2', 'b1', 'a1', 'g1'],
    ['d2', 'f2', 'a2', 'c3'],
    ['e2', 'd2', 'c2', 'b1'],
    ['a1', 'c2', 'e2', 'g2'],
    ['d2', 'fs2', 'a2', 'c3'],
  ], [[3, at(3, 4), 'fs1'], [7, at(3, 4), 'b2']])
  // V2  one stab a bar, on the "and" of 1 and nowhere else: the sparsest comping in the
  // piece, because two horns are talking.
  stabs(trade, CHANGES_TR, 0, 8, [[at(0, 4), L.V2, 8]])
  // V1  answers only in the bars where a horn hands over — bars 1, 3, 5, 7, on the
  // "and" of 4, carrying the next bar's chord.
  stabs(trade, CHANGES_TR, 0, 8, [[at(3, 4), L.V1, 8, true]], { skip: (b) => b % 2 === 0 })
  // NOISE / DPCM  brushes: the ride keeps the shuffle, the ghosts double to three a bar,
  // and the hat opens on the hand-overs. Fill 5 at bar 7.
  for (let bar = 0; bar < 8; bar++) {
    kit(trade, bar, {
      ghosts: [at(0, 4), at(1, 4), at(2, 4)],
      ghostVol: bar % 2 ? 5 : 3,
      open: bar % 2 ? [at(3, 4)] : [],
      rideVol: 6,
      kick: bar % 2 ? [at(0), at(2)] : [at(0), at(2, 4)],
      dsnare: bar === 0 || bar === 4 ? [at(3, 4)] : [],
    })
  }
  fill(trade, 7, 'tom-drop')
}

// =====================================================================================
// comp — frames 9-10: the 3:2, unbroken, and the bar the kit does not play
// =====================================================================================
/** A stepwise descent — Cmaj7, Bm7b5, Am7, G7, Fmaj7, Em7 — turning home through Am7 and
 *  D7. One chord a bar, so the only thing arguing with the metre is the cell. */
const CHANGES_CO = [
  [0, 0, 'Cmaj7'], [1, 0, 'Bm7b5'], [2, 0, 'Am7'], [3, 0, 'G7'],
  [4, 0, 'Fmaj7'], [5, 0, 'Em7'], [6, 0, 'Am7'], [7, 0, 'D7'],
]
const comp = s.section('comp', 8)
{
  // V2  THE 4-ROW CELL (§9.1). Six attacks a bar at rows 0, 4, 8, 12, 16 and 20 — four
  // rows is two triplet-eighths against the beat's three, a clean 3:2 that realigns with
  // the beat every 12 rows and with the bar every 24. Unbroken for all eight bars: 48
  // attacks, no rest, no skipped cell. The PITCH shape is three notes long (lower guide
  // tone, upper, the chord's fifth), so the pitch cycle is 12 rows and lands with the
  // 3:2 rather than fighting it, and the volume column accents whichever of the three
  // happens to fall on a beat.
  const FIFTH = { Cmaj7: 'g4', Bm7b5: 'f4', Am7: 'e4', G7: 'd4', Fmaj7: 'c4', Em7: 'b3', D7: 'a3' }
  for (let row = 0; row < comp.len; row += 4) {
    const name = ['Cmaj7', 'Bm7b5', 'Am7', 'G7', 'Fmaj7', 'Em7', 'Am7', 'D7'][Math.floor(row / BARROWS)]
    const c = CH[name]
    const step = (row / 4) % 3
    const pitch = step === 0 ? c.lo : step === 1 ? c.hi : FIFTH[name]
    comp.put(L.V2, row, { note: note(pitch), inst: COMP, vol: row % BEAT === 0 ? 11 : 8 })
  }
  // V1  one long guide tone a bar, entering on the beat: the harmony held still so the
  // cell has something to be measured against.
  // 9 while the cell is the only thing happening, 7 once the lead starts dropping
  // fragments in: the held harmony gets out of the way rather than holding its ground.
  stabs(comp, CHANGES_CO, 0, 4, [[at(0), L.V1, 9]], { inst: HOLD })
  stabs(comp, CHANGES_CO, 4, 4, [[at(0), L.V1, 6]], { inst: HOLD })
  // P1  fragments only — two or three notes a phrase, then out. The lead is not the
  // subject of this section and it says so by stopping.
  comp.put(L.P1, 0, { note: CUT })
  phrase(comp, L.P1, LEAD, comp.at(1, at(1)), [[LONG, 'd5', 10], [SHORT, 'f5', 11], [Q, 'e5', 10], [Q, '-']])
  phrase(comp, L.P1, LEAD, comp.at(3, at(2)), [[LONG, 'b4', 10], [SHORT, 'd5', 10], [Q, 'f5', 11], [Q, '-']])
  phrase(comp, L.P1, LEAD, comp.at(5, at(1)), [[LONG, 'g5', 11], [SHORT, 'e5', 10], [LONG, 'd5', 10], [SHORT, 'b4', 10], [Q, 'g4', 10], [Q, '-']])
  phrase(comp, L.P1, LEAD, comp.at(7, at(1)), [[LONG, 'c5', 10], [SHORT, 'a4', 10], [Q, 'fs5', 12], [Q, '-']])
  // P2 and SAW rest for the whole section.
  comp.put(L.P2, 0, { note: CUT })
  comp.put(L.SAW, 0, { note: CUT })
  // TRI  the walk keeps four to the bar underneath, so the cell has a metre to cross.
  walk(comp, 0, [
    ['c2', 'b1', 'a1', 'g1'],
    ['b1', 'a1', 'g1', 'fs1'],
    ['a1', 'c2', 'e2', 'g2'],
    ['g2', 'f2', 'e2', 'd2'],
    ['f2', 'e2', 'd2', 'c2'],
    ['e2', 'g2', 'b2', 'a2'],
    ['a1', 'c2', 'e2', 'g2'],
    ['d2', 'c2', 'b1', 'a1'],
  ], [[1, at(3, 4), 'f1'], [5, at(3, 4), 'g2']])
  // NOISE / DPCM  THE METRIC SURPRISE (§9.4, exactly one per piece): at 10:0 — bar 4,
  // the top of the second frame — the kit stops for a whole bar and only the 3:2 cell
  // is left. It comes back on bar 5 as if nothing happened.
  for (let bar = 0; bar < 8; bar++) {
    if (bar === 4) continue
    kit(comp, bar, {
      ride: bar < 4 ? [at(0), at(1, 4), at(2), at(3, 4)] : RIDE,
      rideVol: 6,
      ghosts: bar === 3 || bar === 7 ? [at(0, 4), at(1, 4), at(2, 4)] : [at(2, 4)],
      ghostVol: 4,
      rim: bar % 2 === 1 ? [at(1), at(3)] : [],
      kick: bar < 4 ? [at(0)] : [at(0), at(2, 4)],
      open: bar === 5 ? [at(3, 4)] : [],
    })
  }
  // fill 6 at bar 7: the only fill in the piece that decrescendos, because what follows
  // it is four bars of two lanes.
  fill(comp, 7, 'evaporate')
}

// =====================================================================================
// hush — frame 11: two lanes
// =====================================================================================
const hush = s.section('hush', 4)
{
  // TRI  alone but for the ride. Bars 0-1 are a CHROMATIC BASS DESCENT (§9.3), eight
  // links from c2 down to f1, one a beat, with no harmony above it at all: the collision
  // is implied and the ear supplies it. Bars 2-3 walk back up through the ii-V that sets
  // up the head's return.
  walk(hush, 0, [
    ['c2', 'b1', 'bb1', 'a1'], //  the descent begins
    ['ab1', 'g1', 'fs1', 'f1'], // and lands on the b7, an octave under the tune
    ['a1', 'c2', 'e2', 'g2'], //   Am7, climbing
    ['d2', 'fs2', 'a2', 'c3'], //  D7 — the dominant, arriving at the top of its arpeggio
  ], [[1, at(3, 4), 'g1'], [3, at(3, 4), 'b2']], { drag: 2 })
  // NOISE  the ride and nothing else — no ghosts, no kick, no DPCM. Six lanes silent for
  // four bars: this is the piece's dynamic floor, and what makes A'' sound like a return.
  for (let bar = 0; bar < 4; bar++) {
    kit(hush, bar, {
      ride: bar === 3 ? RIDE : [at(0), at(1, 4), at(2), at(3, 4)],
      rideVol: bar === 3 ? 7 : 5,
      ghosts: bar === 3 ? [at(2, 4)] : [],
      ghostVol: 4,
      kick: [],
    })
  }
}

// =====================================================================================
// A'' — frames 12-13: the head returns, and the cadence is substituted
// =====================================================================================
/** A'''s changes are A's until the cadence, where the Dm7 is replaced by Ab7 — the
 *  TRITONE SUBSTITUTION (§9.3). Ab7 shares its guide tones with D7 inverted: c4 and gb3
 *  both fall a semitone into G7's b3 and f3, so the substitution resolves by contrary
 *  motion against a bass that rises ab2 -> g2. */
const CHANGES_A3 = [
  [0, 0, 'G7'], [1, 0, 'Fmaj7'], [2, 0, 'Cmaj7'], [3, 0, 'G7'],
  [4, 0, 'Em7'], [5, 0, 'Am7'], [6, 0, 'Ab7'], [7, 0, 'G7low'],
]
const A3 = s.section("A''", 8)
{
  // P1  the head, on the grid again, with its cadence rewritten over the substitution:
  // the tune's gb5 at bar 6 is the sub's own seventh and it resolves down to f5.
  phrase(A3, L.P1, LEAD, 0, M, { vib: VIB })
  phrase(A3, L.P1, LEAD, A3.at(2), A_ANSWER, { vib: VIB })
  phrase(A3, L.P1, LEAD, A3.at(4), N, { vib: VIB })
  phrase(A3, L.P1, LEAD, A3.at(6), [
    [LONG, '-'], [SHORT, 'eb5', 11], //      bar 6 beat 1, over Ab7: the sub's flat ninth region
    [LONG, 'gb5', 12], [SHORT, 'f5', 12], // the sub's seventh, resolved down by step
    [Q, 'eb5', 11],
    [Q, 'c5', 11],
    [Q, 'b4', 12], //                        bar 7: G7 arrives, the tune on its third
    [LONG, 'd5', 11], [SHORT, 'f5', 12],
    [DOT, 'a5', 13], //                      beat 3: A'''s single peak, on a strong beat
    [SHORT, 'g5', 12],
    [Q, '-'],
  ], { vib: VIB })
  // P2  an independent counter-line for the WHOLE section (§9.2): its own rhythm — it
  // moves on the beats the tune holds through and rests where the tune moves — its own
  // contour, and it stays a sixth or more below. Six of its eight phrases begin on a row
  // pulse 1 has no attack on.
  A3.put(L.P2, 0, { note: CUT })
  phrase(A3, L.P2, VOICE, A3.at(0, at(1)), [
    [Q, 'd4', 9], [LONG, 'e4', 9], [SHORT, 'f4', 9], [Q, 'd4', 9],
    [Q, 'c4', 9], [LONG, 'a3', 8], [SHORT, 'c4', 9], [Q, 'e4', 11], [Q, '-'],
  ])
  phrase(A3, L.P2, VOICE, A3.at(2, at(1)), [
    [LONG, 'g4', 10], [SHORT, 'f4', 9], [Q, 'e4', 9], [Q, '-'],
    [Q, 'd4', 9], [LONG, 'f4', 10], [SHORT, 'e4', 9], [Q, 'd4', 9], [Q, '-'],
  ])
  phrase(A3, L.P2, VOICE, A3.at(4, at(1)), [
    [Q, 'b3', 9], [LONG, 'd4', 9], [SHORT, 'e4', 9], [Q, 'g4', 10],
    [Q, 'e4', 11], [LONG, 'c4', 9], [SHORT, 'b3', 9], [Q, 'a3', 8], [Q, '-'],
  ])
  phrase(A3, L.P2, VOICE, A3.at(6, at(1)), [
    [LONG, 'c4', 10], [SHORT, 'eb4', 10], [Q, 'gb4', 10], [Q, 'f4', 10],
    [Q, 'd4', 10], [HALF, 'b3', 10], [Q, '-'],
  ])
  // TRI  the walk, with ab2 rising into g2 under the substitution.
  walk(A3, 0, [
    ['g1', 'b1', 'd2', 'e2'],
    ['f2', 'e2', 'c2', 'b1'],
    ['c2', 'e2', 'g2', 'fs2'],
    ['g2', 'f2', 'e2', 'd2'],
    ['e2', 'd2', 'c2', 'b1'],
    ['a1', 'c2', 'e2', 'g2'],
    ['ab2', 'gb2', 'eb2', 'c2'], // Ab7 spelled out
    ['g2', 'd2', 'b1', 'g1'],
  ], [[5, at(3, 4), 'ab2'], [7, at(3, 4), 'f1']])
  // V1 / V2  every chord anticipated: the stab lands on the "and" of 4 of the bar BEFORE
  // the change, and a second, quieter one confirms it on the "and" of 2. At 13:72 V1's
  // c4 — the seventh of the substitution — is held across the bar line and resolves down
  // to b3: the CADENTIAL 4-3, the only suspension in the piece that lands on a cadence.
  // bar 6's anticipation is skipped: V1 has a suspension to prepare there instead.
  stabs(A3, CHANGES_A3, 0, 8, [[at(3, 4), L.V1, 9, true]], { arp: true, skip: (b) => b === 6 })
  stabs(A3, CHANGES_A3, 0, 8, [[at(1, 4), L.V2, 8]], { drag: 2 })
  // THE CADENTIAL 4-3 (§9.2). c4 is the THIRD of the Ab7 substitution; V1 takes it on the
  // "and" of 4 of bar 6, holds it across the bar line into the G7 — where the same pitch
  // is now the fourth, a dissonance — and resolves it down by step to b3 on beat 2. A
  // single voice, so it cancels V1's arpeggio by hand with `000`, the cancel the driver
  // honours (§12.5), and the held instrument sustains until the resolution restrikes.
  A3.put(L.V1, A3.at(6, at(3, 4)), { note: note('c4'), inst: HOLD, vol: 9, fx: [['0', 0]] })
  A3.put(L.V1, A3.at(7, at(1)), { note: note('b3'), inst: COMP, vol: 9 })
  // SAW  answers in the tune's holes, low, and doubles the cadence's descent.
  phrase(A3, L.SAW, HORN_SHORT, A3.at(1, at(3)), [[LONG, 'a3', 9], [SHORT, 'c4', 9], [Q, 'b3', 9], [Q, '-']])
  phrase(A3, L.SAW, HORN_SHORT, A3.at(5, at(3)), [[LONG, 'e4', 9], [SHORT, 'd4', 9], [Q, 'c4', 10], [Q, '-']])
  phrase(A3, L.SAW, HORN_SHORT, A3.at(7, at(2)), [[LONG, 'g3', 9], [SHORT, 'a3', 9], [Q, 'b3', 10], [Q, '-']])
  // NOISE / DPCM  the kit comes back up: ghosts on all three off-beats, the kick on the
  // bar line and the "and" of 3, the hat open at the hand-over into `out`. Fill 6 at
  // bar 3 (the toms again, but low-to-high, the reverse of A's).
  for (let bar = 0; bar < 8; bar++) {
    kit(A3, bar, {
      crash: bar === 0,
      ghosts: [at(0, 4), at(1, 4), at(2, 4)],
      ghostVol: bar % 2 ? 5 : 4,
      open: bar === 7 ? [at(3, 4)] : [],
      kick: bar % 2 ? [at(0), at(2, 4)] : [at(0), at(1, 4)],
      dsnare: bar === 4 ? [at(2)] : [],
      rim: bar === 6 ? [at(1), at(3)] : [],
    })
  }
  // fill 7 at bar 3: A's tom fill reversed — low to high instead of high to low, and
  // written UNDER the ride rather than replacing it, so it reads as an answer.
  A3.hits(L.NOISE, TOM, 11, [[3, at(2)], [3, at(2, 4)]], 37)
  A3.hits(L.NOISE, TOM, 11, [[3, at(3)], [3, at(3, 4)]], 43)
  // fill 8 at bar 7: toms answered by the cross-stick, into `out`.
  fill(A3, 7, 'tom-rim')
}

// =====================================================================================
// out — frames 14-15: the last chorus and the turnaround home
// =====================================================================================
/** `out` states M in AUGMENTATION — every value doubled, so the two-bar head becomes
 *  four — then reaches the piece's global peak and walks home. Its last two bars are the
 *  turnaround Am7 - D7 and they carry no fill: §2.9 rule 5 wants the loop to arrive, and
 *  a fill at the seam is the one thing that makes a loop predictable. */
const CHANGES_OUT = [
  [0, 0, 'G7'], [1, 0, 'G7'], [2, 0, 'Fmaj7'], [3, 0, 'Cm7'],
  [4, 0, 'G7'], [5, 0, 'Em7'], [6, 0, 'Am7'], [7, 0, 'D7'],
]
const out = s.section('out', 8)
{
  // P1  M augmented: the pickup is a whole beat, the leap takes two, the held note takes
  // four. The same tune, heard slowly, is the piece admitting it is nearly over.
  phrase(out, L.P1, LEAD, 0, [
    [Q + SHORT, '-'], //         bar 0: the silence, doubled
    [LONG, 'b4', 10], //         the pickup, doubled
    [Q + SHORT, 'g5', 13], //    the leap, doubled
    [LONG, 'f5', 12],
    [Q + SHORT, 'e5', 12], //    bar 1
    [LONG, 'd5', 11],
    [BARROWS, 'b4', 12], //      a whole bar on the #11-to-come
    [Q + SHORT, 'c5', 11], //    bar 3
    [LONG, 'a4', 10],
    [HALF, 'g4', 12],
    [HALF, '-'],
  ], { vib: VIB, vibMin: 12, vibAfter: 8 })
  // the peak phrase: the piece's highest note, b5, on beat 1 of bar 5 — the last third
  // of the order, over Em7, and the bass falls e2 -> b1 under it.
  phrase(out, L.P1, LEAD, out.at(4, at(2)), [
    [LONG, 'd5', 11], [SHORT, 'g5', 12], //  bar 4, beats 3-4: the run up
    [Q, 'a5', 13],
    [Q, 'b5', 14], //                        bar 5 beat 1: THE GLOBAL PEAK
    [LONG, 'a5', 13], [SHORT, 'g5', 12],
    [LONG, 'e5', 12], [SHORT, 'd5', 11],
    [Q, 'b4', 11],
    [LONG, 'c5', 11], [SHORT, 'a4', 10], //  bar 6, Am7
    [Q, 'g4', 10], [Q, 'e4', 10],
    [Q, 'fs4', 11], //                       bar 7, D7: the leading tone
    [LONG, 'a4', 11], [SHORT, 'c5', 11],
    [HALF, 'd5', 11], //                     and the turnaround leaves on the fifth
  ], { vib: VIB })
  // P2  a counter-line under the augmented head: it moves in swung eighths exactly where
  // the lead is holding whole bars, which is the whole argument of §9.2.
  out.put(L.P2, 0, { note: CUT })
  phrase(out, L.P2, VOICE, out.at(1, at(0)), [
    [LONG, 'd4', 9], [SHORT, 'e4', 9], [Q, 'f4', 10], [Q, 'e4', 9], [Q, 'd4', 9],
    [LONG, 'c4', 9], [SHORT, 'd4', 10], [Q, 'e4', 12], [Q, '-'],
  ])
  phrase(out, L.P2, VOICE, out.at(3, at(0)), [
    [LONG, 'bb3', 10], [SHORT, 'c4', 10], [Q, 'eb4', 10], [Q, 'd4', 10],
    [Q, 'b3', 10], [HALF, 'g3', 10], [Q, '-'],
  ], { vib: VIB, vibMin: 12, vibAfter: 6 })
  phrase(out, L.P2, VOICE, out.at(6, at(0)), [
    [LONG, 'e4', 10], [SHORT, 'c4', 10], [Q, 'a3', 10], [Q, '-'],
    [LONG, 'fs4', 10], [SHORT, 'e4', 10], [HALF, 'c4', 10],
  ], { vib: VIB, vibMin: 12, vibAfter: 6 })
  // SAW  a low counter-melody under the augmented head — the only place the saw is a
  // middle voice rather than a lead or an answer, and it is an octave clear of the bass.
  phrase(out, L.SAW, HORN_SHORT, out.at(0, at(2)), [
    [LONG, 'g3', 9], [SHORT, 'f3', 9], [Q, 'e3', 9], [Q, '-'],
    [LONG, 'd3', 9], [SHORT, 'e3', 9], [Q, 'g3', 10], [Q, 'a3', 10], [Q, '-'],
  ])
  phrase(out, L.SAW, HORN_SHORT, out.at(3, at(2)), [[LONG, 'eb3', 9], [SHORT, 'd3', 9], [Q, 'b2', 10], [Q, '-']])
  phrase(out, L.SAW, HORN_SHORT, out.at(7, at(0)), [[LONG, 'a2', 9], [SHORT, 'c3', 9], [Q, 'd3', 10], [Q, '-']])
  // TRI  the walk, and the last bar climbs a1 - b1 - c2 - f1 so the loop row's g1 is
  // approached from a fourth below: the turnaround arrives rather than restarts.
  walk(out, 0, [
    ['g1', 'a1', 'b1', 'd2'],
    ['f2', 'e2', 'd2', 'c2'],
    ['f1', 'a1', 'c2', 'e2'],
    ['c2', 'eb2', 'g2', 'bb2'],
    ['g2', 'f2', 'd2', 'b1'],
    ['e2', 'g2', 'b1', 'a1'],
    ['a1', 'c2', 'e2', 'g2'],
    ['d2', 'c2', 'b1', 'f1'],
  ], [[5, at(3, 4), 'g1'], [7, at(3, 4), 'fs1']])
  // V1 / V2  back to A's placement — the "and" of 2 and the pushed "and" of 4 — so the
  // piece ends where its comping began. The last bar comps the D7 twice and stops.
  stabs(out, CHANGES_OUT, 0, 8, [[at(1, 4), L.V2, 9]], { arp: true })
  stabs(out, CHANGES_OUT, 0, 8, [[at(3, 4), L.V1, 8, true]], { drag: 2 })
  stabs(out, CHANGES_OUT, 0, 8, [[at(2, 4), L.V1, 7]], { skip: (b) => b % 2 === 1, drag: 2 })
  // NOISE / DPCM  the fullest kit in the piece for six bars, then it thins: bar 7 is ride
  // and one ghost, no kick on the last beat, and NO FILL. The loop arrives on a walking
  // bass note and a ride cymbal, which is how the piece started.
  for (let bar = 0; bar < 8; bar++) {
    kit(out, bar, {
      ghosts: bar === 7 ? [at(2, 4)] : [at(0, 4), at(1, 4), at(2, 4)],
      ghostVol: bar === 7 ? 4 : 5,
      open: bar === 1 || bar === 5 ? [at(3, 4)] : [],
      rideVol: bar === 7 ? 6 : 7,
      kick: bar === 7 ? [at(0)] : bar % 2 ? [at(0), at(2, 4)] : [at(0), at(1, 4)],
      dsnare: bar === 5 ? [at(0), at(2)] : [],
      rim: bar === 2 ? [at(1), at(3)] : [],
    })
  }
  fill(out, 3, 'triplet-ghosts')
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['head-in', 'A', "A'", 'bridge', 'trade', 'comp', 'hush', "A''", 'out'])
s.loopTo('A')
s.qa({
  key: 'g-mixolydian',
  bpmRange: [118, 122],
  durationSec: [124, 132],
  rmsRange: [-25, -9],
  motif: {
    channel: 'pulse1',
    patterns: [1, 3, 12, 14],
    variation: 'displaced +4 rows (3:4), transposed two steps down as N (1:96), reharmonised under the tritone substitution (12:0), augmented (14:0)',
  },
  notes:
    'G mixolydian at 120 BPM, tempo 150 / speed 5 with rowHighlight 6, so a beat is SIX ' +
    'rows and the shuffle is exact rather than a fractional-tempo lilt: a swung eighth ' +
    'pair is rows 0 and 4 of the beat (2:1), an eighth-note triplet is rows 0, 2 and 4, ' +
    'and no lane in the piece ever places an attack on row 1, 3 or 5. Straight sixteenths ' +
    'do not exist on this grid, which is why the piece cannot drift into a rock feel. ' +
    'rmsRange floor -25: the render measures -22.2 dBFS with a peak of 0.58 and zero ' +
    'clamped samples, and that is the arrangement, not a gain. Five lanes sound at once at ' +
    'most; the kit is ghosts at vol 3-6; frame 0 is a bass alone at -33.9 dBFS, frame 11 is ' +
    'two lanes at -30.7, and the loudest section (trade, frames 7-8) reaches -20.0 — a 14 dB ' +
    'arc that raising the columns would flatten. Raising them was measured: +2 on every ' +
    'VRC6 comping column bought 0.24 dB, because the swing staggers every lane off the ' +
    'beat and the mix never stacks. Clipping is re-voiced and quietness is not re-gained ' +
    '(§2.8), so the floor is declared instead. accidentalFractionMax is NOT declared: the ' +
    'piece measures 8.9 % of melodic notes outside g-mixolydian, inside the default 12 %, ' +
    'and the brief allowed up to 20 % rather than requiring it. percussionGap is left at ' +
    'the default 8 as well; the report shows one 25-row gap, from 9:94 to 10:24, which is the ' +
    'metric surprise (the kit stops for the whole bar at 10:0 and only the 3:2 cell plays ' +
    'on), and coverage still measures 92 %. Devices: the 4-row cell against the 6-row ' +
    'beat, 3:2, unbroken on vrc6p2 for all 48 attacks from 9:0 to 10:92; the 20-row punch ' +
    'cell on vrc6p1, phase-carried with entry rows 3:0, 4:4 and 5:8, computed as ' +
    '(-96k) mod 20; the head displaced a swung eighth at 3:4 against 1:0; the head ' +
    'augmented at 14:0. Harmony: three links of descending fifths as secondary dominants, ' +
    'E7 - A7 - D7 - G7 at 5:0, 5:24, 5:48 and 5:72, with the guide-tone tritones walking ' +
    'down chromatically on vrc6p2 (g#3, g3, f#3, f3); the tritone substitution Ab7 at ' +
    '13:48 into G7 at 13:72, gb3 falling to f3 and c4 to b3 while the bass rises ab2 to ' +
    'g2; the borrowed minor iv Cm7 at 3:72 and 14:72; an eight-link chromatic bass descent ' +
    'c2 to f1 at 11:0-11:42 under nothing but a ride. bridge frame 6 moves TWO chords a ' +
    'bar where every other section moves one, and no four-chord cycle repeats anywhere. ' +
    'Counterpoint: the cadential 4-3 on pulse 2, c4 taken at 2:66 as the seventh of Dm7 ' +
    'and resolved to b3 at 2:78; the second cadential 4-3 on vrc6p1, c4 at 13:70 (the ' +
    "third of the substitution) resolved to b3 at 13:78; an appoggiatura, Cmaj7's 11th, at " +
    '1:48 resolving at 1:50 and again at 12:48. Contrary motion at both cadences: the ' +
    'tune rises f5 to a5 at 2:66-2:72 while the bass falls ab2 to g2, and falls c5 to b4 ' +
    'at 13:66-13:72 while the bass rises c2 to g2. Effect params are DECIMAL: 4xy vibrato ' +
    '442 = 66 on the lead and 431 = 49 on the saw, always written a beat after the note it ' +
    'colours and cancelled by 400 on the next attack; 0xy chords are 04a = 74 (dominant ' +
    'seventh, no fifth), 04b = 75 (major seventh) and 03a = 58 (minor seventh); G01 and ' +
    'G02 lay the ghosts, the comping and every third walking bar one or two ticks behind ' +
    'the ride, which is under the two-tick humanisation limit and never on a section ' +
    'downbeat. The noise lane carries no kick at all: the DPCM pair plays every kick and ' +
    'every accented snare, so the noise lane is nothing but ride, brushes and fills.',
  renderChecksum: 2583797571,
})
s.check()
s.write('src/assets/songs/08-blue-hour.json')
