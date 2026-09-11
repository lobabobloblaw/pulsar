#!/usr/bin/env node
/** 04 — Tailwind. The bright stage theme: the run that is going well.
 *
 *      node tools/songs/compose/04-tailwind.mjs     -> src/assets/songs/04-tailwind.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), written from the
 *  contour and harmony rules of §2.10 / §9.3. Nothing here quotes or paraphrases any
 *  published work.
 *
 *  GRID  tempo 150 · speed 5 = 180 BPM on 16th rows; rowHighlight 4 (a beat), rowHighlight2
 *        16 (a bar), rowsPerPattern 64 (a frame = 4 bars = 5.33 s).
 *  KEY   A major. Colour: a bVII push (G) in the pre-chorus, a borrowed iv (Dm) at the
 *        chorus cadence, a chain of secondaries (B7 → E7 → A) then F#7 as the pivot into the
 *        final chorus, which is a whole step up in B major. accidentalFractionMax 0.2.
 *
 *  FORM (24 frames, the tag truncated to two bars; one pass ≈ 2:05)
 *  | frame | section | bars | what happens                                                    |
 *  |-------|---------|------|-----------------------------------------------------------------|
 *  | 0     | intro   | 4    | unison riff R on saw + triangle + both pulses in octaves; roll    |
 *  | 1–4   | A       | 16   | hook H on pulse 1, echo canon on pulse 2 (3 rows, −5, duty 0);   |
 *  |       |         |      | saw gallop answered by the triangle on the off-16ths; VRC6 thirds |
 *  | 5–8   | A′      | 16   | H on the saw as a brass lead (bend-in), pulse 1 counter-hook,     |
 *  |       |         |      | triangle takes the bass, V2 stabs on a 6-row cell (2:3), open hats|
 *  | 9–10  | pre     | 8    | 3+3-bar phrase over G · D/F# · E (the asymmetry), then a 2-bar    |
 *  |       |         |      | snare-roll build with the VRC6 harmony climbing                   |
 *  | 11–14 | chorus  | 16   | the big tune C; pulse 2 is an independent voice throughout (§9.2);|
 *  |       |         |      | VRC6 sixths; DPCM kick on every beat; iv (Dm) at the cadence      |
 *  | 15    | break   | 4    | half-time: saw alone + DPCM; a hat-only bar; tom fill             |
 *  | 16–18 | A″      | 12   | H displaced +2 rows (bars 0–3), on the grid (4–7), then B7 · E7 · |
 *  |       |         |      | A · F#7 with a 6-row hemiola across the last three bars           |
 *  | 19–22 | chorus′ | 16   | C in B major, lead doubled by V1 an octave up at vol 9            |
 *  | 23    | tag     | 2    | R in B, a unison fall onto E7, `B01`+`D00` at row 31 → frame 1    |
 *
 *  MOTIFS  R  the riff (2 bars): a rising tonic arpeggio that falls back by step, 3+3+2.
 *          H  the hook (8 bars): a 3+3+2 pickup to the peak, answered a step higher, then
 *             inverted (bar 4) and closed by a turn; stated 5 times — pulse 1 (A), the saw
 *             (A′, re-orchestrated an octave lower), displaced +2 rows (A″), on the grid
 *             with the B7 turn (A″), and the riff's own restatement in B (tag).
 *          C  the chorus tune (16 bars): long notes with delayed vibrato, one peak, a
 *             borrowed-iv appoggiatura at the cadence; restated a whole step up.
 *
 *  DEVICES (frame:row in the report)
 *    §9.1  a 6-row V2 stab cell across A′ (2:3 against the kit, phase carried over both
 *          frames: entry rows 0 then 2); the hemiola in A″ bars 9–11; H displaced +2 rows in
 *          A″ bars 0–3; the metric surprise is the two-bar tag (`D00`).
 *    §9.2  pulse 2 is a voice for the whole chorus: own rhythm, 9–8 and 4–3 suspensions,
 *          a cadential 4–3 over the final A, contrary motion at both chorus cadences.
 *    §9.3  modal interchange (bVII, iv), chained secondaries (B7 → E7 → A), the F#7 pivot
 *          into B major; a descending-fifths chain C#m7 → F#m → Bm7 → E7 in the chorus.
 *    §9.4  kit changes every section; a fill every 8 bars, none repeated; the open hat on
 *          the "and" of 4 is the signature; snare rolls into both choruses and the loop.
 *
 *  ALLOCATION (lead = one voice at a time; every lane rests somewhere)
 *    intro   P1 P2 TRI SAW unison · NOISE kick on the riff, roll · DPCM kick · V1 V2 rest
 *    A       P1 hook · P2 echo · SAW gallop · TRI off-16ths · V1 V2 thirds · kit + DPCM
 *    A′      SAW hook · P1 counter-hook · P2 rests · TRI gallop bass · V1 pad · V2 6-row stabs
 *    pre     P1 tune · P2 rests then the rising build · V2 0xy stabs · V1 rising pad · SAW · TRI
 *    chorus  all eight: P1 15 · P2 11 · SAW 11 · V1 V2 8–9 · TRI · kit · DPCM every beat
 *    break   SAW alone + DPCM · NOISE only in bar 2 · P1 P2 V1 V2 TRI rest
 *    A″      as A, hook displaced; SAW + V2 hemiola; TRI holds; P2 echo
 *    chorus′ all eight; V1 doubles the lead an octave up, V2 sixths below
 *    tag     unison riff; V2 stabs the E7; roll
 *  HEADROOM  the saw never above 11, VRC6 pulses ≤ 9 under the full 2A03 mix, the lead's
 *            15s only on peaks; the report's ≥ .999 column must read 0 everywhere.
 */
import { CUT, L, REL, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'tailwind',
  name: 'Tailwind',
  author: 'pulsar preset album',
  speed: 5,
  rowsPerPattern: 64,
  rowHighlight: 4,
  rowHighlight2: 16,
})

// =====================================================================================
// instruments
// =====================================================================================
// Shared bank, by name (byte-identical to the fixture).
const [KICK, SNARE, TOM, HAT, OHAT, CRASH, BASS, BASS_SHORT] =
  s.bank('kick', 'snare', 'tom', 'hat-closed', 'hat-open', 'crash', 'bass', 'bass-short')
const KIT = s.dpcmKit() // kick 36, snare 39 on the dpcm lane

/** The lead. A zero-sum pitch scoop (6 units flat, on pitch by tick 4 — pitch macros
 *  ACCUMULATE and add to the period, so the values must sum to 0, not merely end on 0),
 *  a thin-to-25 % duty front, and a body that settles a step under the column. */
const LEAD = s.instrument('lead', {
  volume: { values: [13, 15, 15, 14, 13, 13, 12], loop: 6 },
  duty: { values: [0, 0, 1], loop: 2 },
  pitch: { values: [6, -2, -2, -1, -1, 0] },
})
/** The echo: duty 0 (thin, "distant"), a body that sits at half and never fully stops
 *  until the next echo or a copied cut. */
const ECHO = s.instrument('echo', {
  volume: { values: [12, 10, 9, 8, 8, 7], loop: 5 },
  duty: { values: [0], loop: 0 },
})
/** The counter-voice for pulse 2 in the chorus: 50 % duty (round, sits under the lead),
 *  a soft front so it reads as a second singer rather than a second lead. */
const VOICE = s.instrument('voice', {
  volume: { values: [10, 13, 14, 14, 13, 12], loop: 5 },
  duty: { values: [2], loop: 0 },
})
/** The saw bass: every sixteenth detached — four sounding ticks of a five-tick row. */
const SAW_BASS = s.instrument('saw-bass', {
  volume: { values: [15, 15, 12, 7, 0] },
})
/** The saw held (the break's half-time line). */
const SAW_HOLD = s.instrument('saw-hold', {
  volume: { values: [15], loop: 0 },
})
/** The saw as a brass lead: a slow bend-in from 8 units flat over eight ticks, a swell. */
const SAW_LEAD = s.instrument('saw-lead', {
  volume: { values: [10, 12, 14, 15, 15, 15, 14, 14], loop: 7 },
  pitch: { values: [8, -1, -1, -1, -1, -1, -1, -1, -1, 0] },
})
/** The VRC6 pad: the chip's own attack, a duty that opens 7 → 3 on every chord change. */
const PAD = s.instrument('pad', {
  volume: { values: [9, 12, 14, 15], loop: 3 },
  duty: { values: [7, 6, 5, 4, 3], loop: 4 },
})
/** VRC6 chord stabs (`0xy`): bright 25 %, self-ending. */
const STAB = s.instrument('stab', {
  volume: { values: [15, 14, 11, 8, 5, 2, 0] },
  duty: { values: [3], loop: 0 },
})
/** V1 doubling the lead an octave up in the last chorus: thin, so it is a shimmer. */
const DOUBLE = s.instrument('double', {
  volume: { values: [12, 14, 14, 13, 12], loop: 4 },
  duty: { values: [3, 2, 1], loop: 2 },
})
/** Noise: a tom with a longer drop than the bank's, and a riser (index falling = pitch
 *  rising) for the fills. Both self-ending. */
const TOM_LONG = s.instrument('tom', {
  volume: { values: [15, 15, 13, 11, 9, 7, 5, 3, 0] },
  pitch: { values: [1, 1, 1, 1, 1, 1, 0] },
  duty: { values: [0], loop: 0 },
  note: 43,
})
const RISER = s.instrument('riser', {
  volume: { values: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 42,
})

// =====================================================================================
// helpers — rhythm-first notation, so a phrase reads as durations and pitches
// =====================================================================================
const VIB = nib(4, 2) // 4xy: the album's medium "singing" vibrato, written a beat late

/** A phrase as consecutive events `[rows, note, vol?, fx?]` from `startRow`. `'-'` is a
 *  rest (a cut), `'~'` extends the previous note. Notes ≥ `vibMin` rows long get a `4xy`
 *  written `vibAfter` rows in, and the next attack (or cut) carries the `400` cancel, so
 *  nothing wobbles into the next phrase or across the seam (§2.9 rule 3). Returns the row
 *  after the last event. `transpose` moves every pitch; `fixedVol` overrides the
 *  events' own volumes (a re-orchestration keeps the rhythm and pitches, not the level). */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vib = 0, vibMin = 8, vibAfter = 4, transpose = 0, cutAtEnd = true, vol: defaultVol = 12, fixedVol } = opts
  let row = startRow
  let pendingCancel = false
  const cancel = () => (pendingCancel ? [['4', 0]] : [])
  for (const [len, note, vol, fx] of events) {
    if (note === '~') {
      row += len
      continue
    }
    if (note === '-') {
      sec.put(lane, row, { note: CUT, fx: cancel().length ? cancel() : undefined })
      pendingCancel = false
      row += len
      continue
    }
    const own = fx ? [fx] : []
    const list = [...cancel(), ...own]
    sec.put(lane, row, { note: n(note) + transpose, inst, vol: fixedVol ?? vol ?? defaultVol, fx: list.length ? list : undefined })
    pendingCancel = false
    if (vib && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
      pendingCancel = true
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    sec.put(lane, row, { note: CUT, fx: cancel().length ? cancel() : undefined })
    pendingCancel = false
  }
  if (pendingCancel) sec.put(lane, Math.min(row, sec.len) - 1, { fx: [['4', 0]] })
  return row
}

/** §2.2's echo, copying the CUTS as well as the attacks so the echo breathes with the
 *  lead instead of ringing through its rests. Never overwrites a cell the target has. */
function echoWithCuts(sec, from, to, delay, inst, vol, opts = {}) {
  const { transpose = 0, fromRow = 0, toRow = sec.len } = opts
  for (let r = fromRow; r < toRow; r++) {
    const src = sec.lanes[from][r]
    if (src === null || src.note === undefined) continue
    const at = r + delay
    if (at >= sec.len || sec.lanes[to][at] !== null) continue
    if (src.note === CUT) sec.put(to, at, { note: CUT })
    else if (src.note >= 0) sec.put(to, at, { note: src.note + transpose, inst, vol })
  }
}

/** The saw gallop: attacks on rows 0, 2, 3 of every beat (an 8th and two 16ths), on the
 *  root written for that bar. `roots` is one MIDI note per bar (or null to rest);
 *  `accent` lifts the beat's own attack above the two sixteenths. */
function gallop(sec, lane, inst, vol, roots, opts = {}) {
  const { pattern = [0, 2, 3], firstBar = 0, accent = 0 } = opts
  roots.forEach((root, i) => {
    if (root === null) return
    const bar = firstBar + i
    for (let beat = 0; beat < 4; beat++) {
      for (const r of pattern) {
        sec.put(lane, sec.at(bar, beat * 4 + r), { note: root, inst, vol: r === 0 ? vol + accent : vol })
      }
    }
  })
}

/** The triangle answering on the off-16th (row 1 of every beat), an octave above. */
function offbeats(sec, roots, opts = {}) {
  const { firstBar = 0, up = 12, rows = [1], inst = BASS_SHORT } = opts
  roots.forEach((root, i) => {
    if (root === null) return
    const bar = firstBar + i
    for (let beat = 0; beat < 4; beat++) {
      for (const r of rows) sec.put(L.TRI, sec.at(bar, beat * 4 + r), { note: root + up, inst, vol: 15 })
    }
  })
}

/** One held VRC6 pad note per chord: `chords` is `[bar, row, v1Note, v2Note, len?]`. */
function pad(sec, chords, vol = 9, inst = PAD) {
  for (const [bar, row, v1, v2] of chords) {
    if (v1 !== null) sec.put(L.V1, sec.at(bar, row), { note: n(v1), inst, vol })
    if (v2 !== null) sec.put(L.V2, sec.at(bar, row), { note: n(v2), inst, vol })
  }
}

/** A rising snare roll: alternating rows, ascending volume, high snare on the last beat. */
function roll(sec, bar, opts = {}) {
  const { from = 0, to = 16, lo = 4, hi = 15, high = false } = opts
  for (let r = from; r < to; r++) {
    const v = Math.min(15, Math.round(lo + ((hi - lo) * (r - from)) / Math.max(1, to - from - 1)))
    const note = high && r >= to - 4 ? 41 : 39
    sec.put(L.NOISE, sec.at(bar, r), { note, inst: SNARE, vol: v })
  }
}

/** Hats on the rows given, alternating vol on/off the beat, skipping cells already
 *  taken by a kick or a snare on the same lane. */
function hats(sec, bar, rows, opts = {}) {
  const { on = 8, off = 6, inst = HAT } = opts
  for (const r of rows) {
    const row = sec.at(bar, r)
    if (sec.lanes[L.NOISE][row] !== null) continue
    sec.put(L.NOISE, row, { note: 45, inst, vol: r % 4 === 0 ? on : off })
  }
}

const range = (a, b, step = 1) => Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, i) => a + i * step)
const midi = (name) => n(name)

// =====================================================================================
// motifs — written once, as rhythm + pitch, then placed, transposed and re-voiced
// =====================================================================================
/** R — the riff, two bars, spelled in the saw's register; other lanes transpose. A
 *  rising tonic arpeggio that falls back by step (3+3+2 | 3+3+2), then a breath. */
const RIFF = [
  [3, 'a1'], [3, 'c#2'], [2, 'e2'], [3, 'd2'], [3, 'c#2'], [2, 'b1'],
  [4, 'a1'], [2, 'e2'], [2, 'f#2'], [4, 'e2'], [4, '-'],
]

/** H — the hook, eight bars over A · A · F#m · D · E · C#m · D · E.
 *  bar 0  the 3+3+2 pickup to the peak a5 on beat 3, then back down
 *  bar 1  the answer settles on the third and breathes (a beat of air)
 *  bar 2  the pickup a third lower over vi
 *  bar 3  the answer a step higher than bar 1
 *  bar 4  the pickup INVERTED (falling) over V
 *  bar 5  down to the section's floor, g#4
 *  bar 6  a turn over IV
 *  bar 7  the half cadence on the fifth of E, then air */
const HOOK = [
  [3, 'e5', 13], [3, 'f#5', 13], [2, 'g#5', 13], [4, 'a5', 15], [2, 'g#5', 13], [2, 'e5', 12],
  [6, 'c#5', 13], [2, 'd5', 12], [4, 'e5', 14], [4, '-'],
  [3, 'c#5', 13], [3, 'e5', 13], [2, 'f#5', 13], [4, 'e5', 14], [2, 'd5', 12], [2, 'c#5', 12],
  [6, 'd5', 13], [2, 'e5', 12], [4, 'f#5', 14], [4, '-'],
  [3, 'g#5', 14], [3, 'f#5', 13], [2, 'e5', 13], [4, 'd5', 13], [2, 'c#5', 12], [2, 'b4', 12],
  [6, 'c#5', 13], [2, 'b4', 12], [4, 'g#4', 13], [4, '-'],
  [2, 'a4', 12], [2, 'b4', 12], [4, 'd5', 13], [2, 'c#5', 12], [2, 'b4', 12], [4, 'a4', 12],
  [4, 'b4', 13], [4, 'g#4', 12], [4, 'b4', 14], [4, '-'],
]
/** H′ — the hook's second statement: no second peak (the pickup turns under a5), and the
 *  last two bars become the authentic cadence Bm7 → E7 that opens A′. */
const HOOK_2 = [
  [3, 'e5', 13], [3, 'f#5', 13], [2, 'g#5', 13], [4, 'f#5', 14], [2, 'e5', 13], [2, 'c#5', 12],
  ...HOOK.slice(6, 30),
  [2, 'b4', 12], [2, 'c#5', 12], [4, 'd5', 13], [4, 'f#5', 14], [4, '-'],
  [4, 'e5', 14], [4, 'd5', 13], [4, 'b4', 12], [4, '-'],
]
/** Chord roots under H (one per bar), and the second statement's cadence. */
const HOOK_ROOTS = ['a1', 'a1', 'f#2', 'd2', 'e2', 'c#2', 'd2', 'e2'].map(midi)
const HOOK_ROOTS_2 = ['a1', 'a1', 'f#2', 'd2', 'e2', 'c#2', 'b1', 'e2'].map(midi)
/** VRC6 thirds under H: [bar, row, V1, V2] — the third of the chord on top, moving by
 *  step; the same voicing serves both statements. */
const HOOK_THIRDS = [
  [0, 0, 'e4', 'c#4'], [2, 0, 'c#4', 'a3'], [3, 0, 'd4', 'a3'], [4, 0, 'e4', 'b3'],
  [5, 0, 'e4', 'c#4'], [6, 0, 'f#4', 'd4'], [7, 0, 'g#4', 'e4'],
]
const HOOK_THIRDS_2 = [...HOOK_THIRDS.slice(0, 6), [6, 0, 'f#4', 'd4'], [7, 0, 'g#4', 'd4']]

/** C — the chorus tune, sixteen bars over
 *    A · A/C# · D · E · C#m7 · F#m · Bm7 · E7 ‖ A · A/C# · D · E · C#m7 · F#m Bm7 · Dm · A.
 *  Long notes bloom into vibrato a beat in; the single peak is a5 on bar 0 beat 3; the
 *  second half restarts under the peak; the borrowed iv carries an f-natural appoggiatura
 *  and the tune RISES d5 → e5 onto the tonic while the bass falls D → A. */
const CHORUS = [
  [4, 'c#5', 14], [4, 'e5', 14], [8, 'a5', 15],
  [4, 'g#5', 13], [2, 'f#5', 13], [2, 'e5', 13], [8, 'f#5', 14],
  [4, 'f#5', 13], [4, 'e5', 13], [4, 'd5', 13], [4, '-'],
  [4, 'b4', 12], [4, 'c#5', 13], [8, 'e5', 14],
  [4, 'g#5', 14], [4, 'e5', 13], [4, 'c#5', 13], [4, 'b4', 12],
  [8, 'a4', 12], [4, 'b4', 12], [4, 'c#5', 13],
  [4, 'd5', 13], [4, 'c#5', 12], [8, 'b4', 13],
  [4, 'g#4', 12], [4, 'b4', 13], [4, 'd5', 13], [4, '-'],
  [4, 'c#5', 14], [4, 'e5', 14], [8, 'g#5', 14],
  [4, 'f#5', 13], [2, 'e5', 13], [2, 'd5', 13], [8, 'e5', 14],
  [4, 'f#5', 13], [4, 'e5', 13], [4, 'd5', 13], [4, '-'],
  [4, 'b4', 12], [4, 'c#5', 13], [8, 'e5', 14],
  [4, 'g#5', 14], [4, 'e5', 13], [4, 'c#5', 13], [4, 'b4', 12],
  [4, 'a4', 12], [4, 'c#5', 13], [4, 'd5', 13], [4, 'f#5', 14],
  [4, 'f5', 14], [4, 'e5', 13], [8, 'd5', 13],
  [8, 'e5', 14], [8, '-'],
]
/** Pulse 2 through the chorus — a VOICE (§9.2): it moves where the tune holds or rests,
 *  keeps its own 8th-note rhythm, sits below the tune, and carries the written
 *  suspensions: 9–8 over D (bar 2, e5 held from A, resolves to d5 on beat 2), 4–3 over E
 *  (bar 3, a4 held from D, resolves to g#4), the tritone with the tune's d5 on the E7,
 *  and the cadential 4–3 over the final A (bar 15, d4 held from Dm, resolves to c#4). */
const COUNTER = [
  [4, 'a4', 10], [4, '-'], [2, 'e4', 10], [2, 'f#4', 10], [4, 'g#4', 11],
  [4, 'a4', 11], [2, '-'], [2, 'c#5', 10], [4, 'a4', 10], [4, 'e5', 11],
  [4, '~'], [4, 'd5', 11], [2, '-'], [2, 'f#4', 10], [4, 'a4', 11],
  [4, '~'], [4, 'g#4', 11], [4, '-'], [2, 'b4', 10], [2, 'd5', 11],
  [4, 'c#5', 11], [2, '-'], [2, 'b4', 10], [4, 'g#4', 11], [4, '-'],
  [4, '-'], [2, 'f#4', 10], [2, 'e4', 10], [4, 'f#4', 11], [4, 'a4', 10],
  [4, 'f#4', 11], [4, 'a4', 10], [4, '-'], [2, 'f#4', 10], [2, 'e4', 10],
  [4, 'e4', 11], [4, '-'], [4, 'g#4', 11], [2, 'b4', 11], [2, 'a4', 10],
  [4, 'a4', 10], [4, '-'], [2, 'e4', 10], [2, 'f#4', 10], [4, 'e4', 11],
  [4, 'a4', 11], [2, '-'], [2, 'c#5', 10], [4, 'a4', 10], [4, 'c#5', 11],
  [4, '~'], [4, 'b4', 11], [2, '-'], [2, 'f#4', 10], [4, 'a4', 11],
  [4, '~'], [4, 'g#4', 11], [4, '-'], [2, 'b4', 10], [2, 'd5', 11],
  [4, 'c#5', 11], [2, '-'], [2, 'b4', 10], [4, 'g#4', 11], [4, '-'],
  [4, 'e4', 10], [4, 'f#4', 11], [4, 'f#4', 10], [4, 'd4', 11],
  [4, 'f4', 11], [4, '-'], [8, 'd4', 11],
  [4, '~'], [4, 'c#4', 11], [8, '-'],
]
/** Chorus bass roots per bar, and the VRC6 sixths [bar, row, V1, V2] (V1 a sixth above
 *  V2, both under the tune; the iv bar is voiced root + fifth so the tune's f-natural
 *  appoggiatura is the only f, and its resolution to e is heard clean). */
const CHORUS_ROOTS = [
  'a1', 'c#2', 'd2', 'e2', 'c#2', 'f#2', 'b1', 'e2',
  'a1', 'c#2', 'd2', 'e2', 'c#2', 'f#2', 'd2', 'a1',
].map(midi)
const CHORUS_SIXTHS = [
  [0, 0, 'c#4', 'e3'], [1, 0, 'e4', 'g#3'], [2, 0, 'f#4', 'a3'], [3, 0, 'g#4', 'b3'],
  [4, 0, 'e4', 'g#3'], [5, 0, 'f#4', 'a3'], [6, 0, 'd4', 'f#3'], [7, 0, 'e4', 'g#3'],
  [8, 0, 'c#4', 'e3'], [9, 0, 'e4', 'g#3'], [10, 0, 'f#4', 'a3'], [11, 0, 'g#4', 'b3'],
  [12, 0, 'e4', 'g#3'], [13, 0, 'f#4', 'a3'], [13, 8, 'd4', 'f#3'], [14, 0, 'd4', 'a3'],
  [15, 0, 'e4', 'c#4'],
]

// =====================================================================================
// intro — frame 0: the riff in unison, four octaves deep, and the roll that lifts A
// =====================================================================================
const intro = s.section('intro', 4)
{
  const riffTwice = [...RIFF, ...RIFF.slice(0, 6)] // bars 0–2: R, then R's first bar again
  // SAW  the riff in its own register (a1–f#2), the detached gallop instrument.
  phrase(intro, L.SAW, SAW_BASS, 0, riffTwice, { vol: 11, cutAtEnd: false })
  // TRI  the riff an octave up, gated (it holds between attacks, so the rests are cuts).
  phrase(intro, L.TRI, BASS, 0, riffTwice, { vol: 15, transpose: 12, cutAtEnd: false })
  // P1 / P2  the riff two and three octaves up — "both pulses in octaves" (§2.1 break 4).
  phrase(intro, L.P1, LEAD, 0, riffTwice, { vol: 13, transpose: 24, cutAtEnd: false })
  phrase(intro, L.P2, ECHO, 0, riffTwice, { vol: 11, transpose: 36, cutAtEnd: false })
  // bar 3: every voice holds the dominant for two beats, then only the roll is left —
  // the first "two or more voices rest" moment, and the pickup into A.
  for (const [lane, inst, vol, note] of [
    [L.SAW, SAW_HOLD, 10, 'e2'], [L.TRI, BASS, 15, 'e3'], [L.P1, LEAD, 13, 'e4'], [L.P2, ECHO, 11, 'e5'],
  ]) {
    intro.put(lane, intro.at(3, 0), { note: n(note), inst, vol })
    intro.put(lane, intro.at(3, 8), { note: CUT })
  }
  // V1 / V2  silent until the held dominant: they enter on the E chord so A's thirds
  // are not the first thing the chip's pulses say.
  pad(intro, [[3, 0, 'g#4', 'e4']], 7)
  intro.put(L.V1, intro.at(3, 8), { note: CUT })
  intro.put(L.V2, intro.at(3, 8), { note: CUT })
  // NOISE  the kick doubles every riff attack (the riff gets its front from the noise),
  // then the roll rises through the last three beats of bar 3, high snare at the top.
  for (const [bar, rows] of [[0, [0, 3, 6, 8, 11, 14]], [1, [0, 4, 6, 8]], [2, [0, 3, 6, 8, 11, 14]]]) {
    intro.hits(L.NOISE, KICK, 12, rows.map((r) => [bar, r]))
  }
  roll(intro, 3, { from: 4, to: 16, lo: 5, hi: 15, high: true })
  // DPCM  kick under the riff's downbeats and half-bars; the snare answers once.
  intro.hits(L.DPCM, KIT.inst, 15, [[0, 0], [0, 8], [1, 0], [2, 0], [2, 8], [3, 0]], KIT.kick)
  intro.hits(L.DPCM, KIT.inst, 15, [[1, 8], [3, 4]], KIT.snare)
}

// =====================================================================================
// A — frames 1–4: the hook, the echo canon, the gallop and its off-beat answer
// =====================================================================================
/** The A kit: kick on 1, snare on 2 and 4 (layered over the DPCM pair), ghosts on the
 *  "a" of 2 and 3, the open hat on the "and" of 4 — the signature — and 16th hats. */
function kitA(sec, bar, opts = {}) {
  const { ghosts = [10], open = true, crash = false, kickRows = [0] } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 12 })
  else sec.hits(L.NOISE, KICK, 12, kickRows.map((r) => [bar, r]))
  sec.hits(L.NOISE, SNARE, 12, [[bar, 4], [bar, 12]])
  sec.hits(L.NOISE, SNARE, 5, ghosts.map((r) => [bar, r]))
  if (open) sec.hits(L.NOISE, OHAT, 9, [[bar, 14]])
  hats(sec, bar, range(0, 16))
}
/** DPCM under A: kick on 1 and 3 (and the "and" of 2 every other bar), snare on 2 and 4. */
function dpcmA(sec, bar, push) {
  sec.hits(L.DPCM, KIT.inst, 15, [[bar, 0], [bar, 8], ...(push ? [[bar, 6]] : [])], KIT.kick)
  sec.hits(L.DPCM, KIT.inst, 15, [[bar, 4], [bar, 12]], KIT.snare)
}

const A = s.section('A', 16)
{
  // P1  the hook twice; delayed vibrato only on the six-row notes.
  phrase(A, L.P1, LEAD, 0, HOOK, { vib: VIB, vibMin: 6, vibAfter: 3 })
  phrase(A, L.P1, LEAD, A.at(8), HOOK_2, { vib: VIB, vibMin: 6, vibAfter: 3 })
  // P2  the echo canon: three rows behind, five quieter, duty 0, cuts copied so it
  // breathes with the lead. Silent on the loop row, and it says so (§2.9 rule 2).
  A.put(L.P2, 0, { note: CUT })
  echoWithCuts(A, L.P1, L.P2, 3, ECHO, 8)
  // SAW  the gallop on the chord roots — the engine of the piece, never stopping.
  gallop(A, L.SAW, SAW_BASS, 10, HOOK_ROOTS, { accent: 1 })
  gallop(A, L.SAW, SAW_BASS, 10, HOOK_ROOTS_2, { firstBar: 8, accent: 1 })
  // TRI  answers on the off-16th of every beat, an octave above the saw: the hocket
  // fills the gallop's one empty sixteenth. Explicit cut on the loop row.
  A.put(L.TRI, 0, { note: CUT })
  offbeats(A, HOOK_ROOTS)
  offbeats(A, HOOK_ROOTS_2, { firstBar: 8 })
  // V1 / V2  sustained thirds, the pad opening (7 → 3) on every chord change; a notch
  // louder the second time round.
  pad(A, HOOK_THIRDS, 8)
  pad(A, HOOK_THIRDS_2.map(([b, r, v1, v2]) => [b + 8, r, v1, v2]), 9)
  // NOISE / DPCM  the A kit; a crash on the section downbeat; fills at bars 7 and 15,
  // different from each other (toms with the bank's drop, then the riser + roll).
  for (let bar = 0; bar < 16; bar++) {
    kitA(A, bar, { crash: bar === 0, ghosts: bar % 2 ? [6, 10] : [10], kickRows: bar % 4 === 3 ? [0, 6] : [0] })
    dpcmA(A, bar, bar % 2 === 1)
  }
  // fill 1 (bar 7, last half-bar): high tom, low tom, snare — the drop macro does the pitch.
  for (const r of [8, 9, 10, 11, 12, 13, 14, 15]) A.lanes[L.NOISE][A.at(7, r)] = null
  A.hits(L.NOISE, TOM, 13, [[7, 8], [7, 10]], 43)
  A.hits(L.NOISE, TOM, 13, [[7, 11], [7, 12]], 37)
  A.hits(L.NOISE, SNARE, 14, [[7, 13], [7, 14], [7, 15]])
  // fill 2 (bar 15, last half-bar): the riser under a four-row roll into A′.
  for (const r of [8, 9, 10, 11, 12, 13, 14, 15]) A.lanes[L.NOISE][A.at(15, r)] = null
  A.hits(L.NOISE, RISER, 13, [[15, 8]])
  roll(A, 15, { from: 11, to: 16, lo: 8, hi: 15, high: true })
}

// =====================================================================================
// A′ — frames 5–8: the hook re-orchestrated onto the saw, a counter-hook above it
// =====================================================================================
/** CH — the counter-hook for pulse 1 over the saw's statement of H: off-beat stabs where
 *  the hook is busy, a moving line where it holds, and it fills every rest the hook
 *  leaves (bars 1, 3, 5, 7: the last beat). Eight bars; the second statement changes
 *  its last two bars for the Bm7 → E7 cadence. */
const COUNTER_HOOK = [
  [6, '-'], [2, 'e5', 11], [4, '-'], [2, 'c#5', 11], [2, 'e5', 11],
  [4, 'f#5', 12], [2, 'e5', 11], [2, 'd5', 11], [4, '-'], [4, 'c#5', 12],
  [6, '-'], [2, 'c#5', 11], [4, '-'], [2, 'b4', 11], [2, 'c#5', 11],
  [4, 'd5', 12], [2, 'e5', 11], [2, 'f#5', 11], [4, '-'], [4, 'a5', 13],
  [6, '-'], [2, 'g#5', 11], [4, '-'], [2, 'f#5', 11], [2, 'g#5', 11],
  [4, 'f#5', 12], [2, 'e5', 11], [2, 'd5', 11], [4, '-'], [4, 'e5', 12],
  [6, '-'], [2, 'd5', 11], [2, '-'], [2, 'e5', 11], [4, '-'],
  [4, 'f#5', 12], [4, '-'], [4, 'e5', 11], [4, 'd5', 12],
]
const COUNTER_HOOK_2 = [
  ...COUNTER_HOOK.slice(0, 30),
  [4, 'd5', 11], [2, 'e5', 11], [2, 'f#5', 12], [4, '-'], [4, 'd5', 11],
  [4, 'e5', 12], [4, 'd5', 11], [4, 'b4', 11], [4, '-'],
]
/** The V2 stab chords under A′, one per bar: root in octave 3 plus the `0xy` intervals. */
const STAB_CHORDS = [
  ['a3', 4, 7], ['a3', 4, 7], ['f#3', 3, 7], ['d3', 4, 7], ['e3', 4, 7], ['c#3', 3, 7], ['d3', 4, 7], ['e3', 4, 7],
  ['a3', 4, 7], ['a3', 4, 7], ['f#3', 3, 7], ['d3', 4, 7], ['e3', 4, 7], ['c#3', 3, 7], ['b2', 3, 7], ['e3', 4, 10],
]

/** The A′ kit: the open hat moves onto every "and" (the disco lift), closed on the beats,
 *  no sixteenths — the section gets lighter on top while the triangle drives below. */
function kitA2(sec, bar, opts = {}) {
  const { crash = false, ghosts = [] } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 12 })
  else sec.hits(L.NOISE, KICK, 12, [[bar, 0]])
  sec.hits(L.NOISE, SNARE, 12, [[bar, 4], [bar, 12]])
  sec.hits(L.NOISE, SNARE, 5, ghosts.map((r) => [bar, r]))
  hats(sec, bar, [2, 6, 10, 14], { inst: OHAT, on: 8, off: 8 })
  hats(sec, bar, [0, 8], { on: 8 })
}

const A2 = s.section("A'", 16)
{
  // SAW  the hook, an octave under the pulse statement, as a brass lead with the
  // bend-in attack; one level (11) so the saw never crowds the mix.
  phrase(A2, L.SAW, SAW_LEAD, 0, HOOK, { transpose: -12, fixedVol: 11 })
  phrase(A2, L.SAW, SAW_LEAD, A2.at(8), HOOK_2, { transpose: -12, fixedVol: 11 })
  // P1  the counter-hook above it.
  phrase(A2, L.P1, LEAD, 0, COUNTER_HOOK)
  phrase(A2, L.P1, LEAD, A2.at(8), COUNTER_HOOK_2)
  // P2  rests for the whole section — the saw's arrival is the event, and a silent
  // lane is the cheapest way to make the pre-chorus's entrance count.
  A2.put(L.P2, 0, { note: CUT })
  // TRI  takes the bass: the gallop, an octave under where the saw galloped in A.
  gallop(A2, L.TRI, BASS_SHORT, 15, HOOK_ROOTS)
  gallop(A2, L.TRI, BASS_SHORT, 15, HOOK_ROOTS_2, { firstBar: 8 })
  // V1  the held upper third of each chord, as in A.
  pad(A2, HOOK_THIRDS.map(([b, r, v1]) => [b, r, v1, null]), 8)
  pad(A2, HOOK_THIRDS_2.map(([b, r, v1]) => [b + 8, r, v1, null]), 8)
  // V2  chord stabs on a SIX-ROW cell (§9.1 recipe D: 2 against the kit's 3): rows
  // 0, 6, 12 … through bars 0–7 and again through 8–15, so the cell enters frame 6 (and
  // frame 8) at local row 2 — the phase carried across the frame boundary.
  for (const start of [0, A2.at(8)]) {
    for (let row = start; row < start + 128; row += 6) {
      const bar = Math.floor(row / 16)
      const [root, x, y] = STAB_CHORDS[bar]
      A2.put(L.V2, row, { note: n(root), inst: STAB, vol: 9, fx: [['0', nib(x, y)]] })
    }
  }
  A2.put(L.V2, A2.len - 1, { fx: [['0', 0]] }) // the arpeggio latch does not cross into pre
  // NOISE / DPCM  the A′ kit; fills at bars 7 and 15, neither like A's.
  for (let bar = 0; bar < 16; bar++) {
    kitA2(A2, bar, { crash: bar === 0 || bar === 8, ghosts: bar % 4 === 2 ? [7, 15] : [] })
    A2.hits(L.DPCM, KIT.inst, 15, [[bar, 0], [bar, 8], ...(bar % 4 === 3 ? [[bar, 10]] : [])], KIT.kick)
    A2.hits(L.DPCM, KIT.inst, 15, [[bar, 4], [bar, 12]], KIT.snare)
  }
  // fill 3 (bar 7): tom high–low pairs on the last beat, the crash lands on bar 8.
  for (const r of [12, 13, 14, 15]) A2.lanes[L.NOISE][A2.at(7, r)] = null
  A2.hits(L.NOISE, TOM, 13, [[7, 12], [7, 13]], 43)
  A2.hits(L.NOISE, TOM_LONG, 13, [[7, 14]], 37)
  A2.hits(L.NOISE, SNARE, 13, [[7, 15]])
  // fill 4 (bar 15): an eight-row roll into the pre-chorus, no riser this time.
  for (const r of range(8, 16)) A2.lanes[L.NOISE][A2.at(15, r)] = null
  roll(A2, 15, { from: 8, to: 16, lo: 6, hi: 14 })
}

// =====================================================================================
// pre-chorus — frames 9–10: the bVII push, a 3+3-bar phrase, then the two-bar build
// =====================================================================================
/** The pre-chorus tune: a three-bar unit (G · D/F# · E) stated, then sequenced a fourth
 *  higher to the section's peak a5 on beat 3 of bar 3; the g-naturals are the borrowed
 *  bVII (modal interchange, §9.3), each resolving by step — the last one a 4–3
 *  appoggiatura over D/F# (bar 4 beat 1, g5 → f#5). */
const PRE = [
  [4, 'd5', 12], [4, 'e5', 12], [4, 'g5', 13], [4, '-'],
  [4, 'f#5', 13], [4, 'e5', 12], [4, 'd5', 12], [4, '-'],
  [2, 'e5', 12], [2, 'f#5', 12], [4, 'g#5', 13], [8, '-'],
  [4, 'e5', 13], [4, 'g5', 13], [4, 'a5', 14], [4, '-'],
  [4, 'g5', 13], [4, 'f#5', 12], [4, 'd5', 12], [4, '-'],
  [2, 'd5', 12], [2, 'e5', 12], [4, 'g#5', 13], [8, '-'],
]
const PRE_ROOTS = ['g2', 'f#2', 'e2', 'g2', 'f#2', 'e2', 'e2', 'e2'].map(midi)
/** V2's off-beat `0xy` stabs: [root, x, y] per bar — G, D in first inversion (f# a d =
 *  `038`), E, then E7 (`04a`) under the build. */
const PRE_STABS = [['g3', 4, 7], ['f#3', 3, 8], ['e3', 4, 7], ['g3', 4, 7], ['f#3', 3, 8], ['e3', 4, 10], ['e3', 4, 10], ['e3', 4, 10]]

const pre = s.section('pre', 8)
{
  // P1  the tune; silent through the build so the roll is the only thing on top.
  phrase(pre, L.P1, LEAD, 0, PRE)
  // P2  silent through the phrase, then the rising line that IS the build (bars 6–7):
  // an E7 arpeggio climbing two octaves under the roll.
  pre.put(L.P2, 0, { note: CUT })
  phrase(pre, L.P2, VOICE, pre.at(6), [
    [4, 'e4', 9], [4, 'g#4', 10], [4, 'b4', 11], [4, 'd5', 12],
    [4, 'e5', 13], [4, 'g#5', 13], [4, 'b5', 14], [4, '-'],
  ])
  // SAW  the gallop under the phrase; straight 8ths (a pump) under the build.
  gallop(pre, L.SAW, SAW_BASS, 10, PRE_ROOTS.slice(0, 6), { accent: 1 })
  gallop(pre, L.SAW, SAW_BASS, 11, PRE_ROOTS.slice(6), { firstBar: 6, pattern: [0, 2] })
  // TRI  off-beat answers under the phrase; a held E under the build.
  offbeats(pre, PRE_ROOTS.slice(0, 6))
  pre.put(L.TRI, pre.at(6, 0), { note: n('e3'), inst: BASS, vol: 15 })
  pre.put(L.TRI, pre.at(7, 12), { note: CUT })
  // V1  the rising harmony: one held note per bar climbing b3 → b4, then the two build
  // notes; the duty opening on each step.
  pad(pre, [[0, 0, 'b3', null], [1, 0, 'd4', null], [2, 0, 'e4', null], [3, 0, 'g4', null],
    [4, 0, 'a4', null], [5, 0, 'b4', null], [6, 0, 'g#4', null], [7, 0, 'b4', null]], 9)
  pre.put(L.V1, pre.at(7, 12), { note: CUT })
  // V2  chord stabs on the off-beat 8ths — the skank that pushes the phrase forward.
  for (let bar = 0; bar < 8; bar++) {
    const [root, x, y] = PRE_STABS[bar]
    for (const r of [2, 6, 10, 14]) pre.put(L.V2, pre.at(bar, r), { note: n(root), inst: STAB, vol: 10, fx: [['0', nib(x, y)]] })
  }
  pre.put(L.V2, pre.len - 1, { fx: [['0', 0]] })
  // NOISE  8th hats only (the kit thins under the push), snare 2 and 4, then the
  // two-bar roll — a snare roll into every chorus.
  for (let bar = 0; bar < 6; bar++) {
    if (bar === 0) pre.put(L.NOISE, 0, { note: 46, inst: CRASH, vol: 12 })
    else pre.hits(L.NOISE, KICK, 12, [[bar, 0]])
    pre.hits(L.NOISE, SNARE, 12, [[bar, 4], [bar, 12]])
    pre.hits(L.NOISE, SNARE, 5, [[bar, 14]])
    hats(pre, bar, [0, 2, 6, 8, 10], { on: 8, off: 7 })
  }
  roll(pre, 6, { from: 0, to: 16, lo: 4, hi: 10 })
  roll(pre, 7, { from: 0, to: 16, lo: 10, hi: 15, high: true })
  // DPCM  kick 1 and 3, snare 2 and 4; four to the floor under the build.
  for (let bar = 0; bar < 8; bar++) {
    const kicks = bar < 6 ? [[bar, 0], [bar, 8]] : [[bar, 0], [bar, 4], [bar, 8], [bar, 12]]
    pre.hits(L.DPCM, KIT.inst, 15, kicks, KIT.kick)
    if (bar < 6) pre.hits(L.DPCM, KIT.inst, 15, [[bar, 4], [bar, 12]], KIT.snare)
  }
}

// =====================================================================================
// chorus — frames 11–14: the big tune, all eight voices, pulse 2 as a voice throughout
// =====================================================================================
/** The chorus kit: sixteenth hats, the high snare (41) cracking on 2 and 4, a ghost on
 *  the last sixteenth pushing into every downbeat, the open hat on the "and" of 4. */
function kitChorus(sec, bar, opts = {}) {
  const { crash = false } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 12 })
  else sec.hits(L.NOISE, KICK, 12, [[bar, 0]])
  sec.hits(L.NOISE, SNARE, 13, [[bar, 4], [bar, 12]], 41)
  sec.hits(L.NOISE, SNARE, 5, [[bar, 15]])
  sec.hits(L.NOISE, OHAT, 9, [[bar, 14]])
  hats(sec, bar, range(0, 16), { on: 8, off: 6 })
}
/** Everything the chorus does except the tune and the counter-voice, so chorus′ can
 *  reuse it a whole step up. `transpose` moves the bass and the harmony. */
function chorusBed(sec, transpose, opts = {}) {
  const { padVol = 9, v1 = true } = opts
  // SAW  the gallop on the roots; TRI doubles them an octave up on the beats only, so
  // the two never hammer the same octave.
  gallop(sec, L.SAW, SAW_BASS, 11, CHORUS_ROOTS.map((r) => r + transpose), { accent: 1 })
  sec.put(L.TRI, 0, { note: CUT })
  offbeats(sec, CHORUS_ROOTS.map((r) => r + transpose), { rows: [0], inst: BASS_SHORT })
  // V1 / V2  sixths, the pad opening on each change. When V1 is doubling the tune
  // (chorus′), V2 alone carries the harmony and takes the upper, colour-tone line.
  if (v1) pad(sec, CHORUS_SIXTHS.map(([b, r, hi, lo]) => [b, r, n(hi) + transpose, n(lo) + transpose]), padVol)
  else pad(sec, CHORUS_SIXTHS.map(([b, r, hi]) => [b, r, null, n(hi) + transpose]), padVol)
  // NOISE / DPCM  the chorus kit; the DPCM kick on EVERY beat (the lane is monophonic,
  // so here the backbeat is the noise lane's high snare alone); fills at bars 7 and 15.
  for (let bar = 0; bar < 16; bar++) {
    kitChorus(sec, bar, { crash: bar === 0 || bar === 8 })
    sec.hits(L.DPCM, KIT.inst, 15, [[bar, 0], [bar, 4], [bar, 8], [bar, 12]], KIT.kick)
  }
}

const chorus = s.section('chorus', 16)
{
  // P1  the tune, singing: vibrato a beat into every note held two beats or longer.
  phrase(chorus, L.P1, LEAD, 0, CHORUS, { vib: VIB })
  // the tune's last note falls away into the break (`Rxy`, a phrase-end fall)
  chorus.put(L.P1, chorus.at(15, 5), { fx: [['R', nib(2, 5)]] })
  // P2  the counter-voice (§9.2), a second singer at 50 % duty.
  phrase(chorus, L.P2, VOICE, 0, COUNTER)
  chorusBed(chorus, 0, { padVol: 10 })
  // fill 5 (bar 7): a rising tom line (low, low, high) and the crash on bar 8.
  for (const r of range(10, 16)) chorus.lanes[L.NOISE][chorus.at(7, r)] = null
  chorus.hits(L.NOISE, TOM_LONG, 13, [[7, 10], [7, 12]], 37)
  chorus.hits(L.NOISE, TOM_LONG, 13, [[7, 14]], 43)
  chorus.hits(L.NOISE, SNARE, 14, [[7, 15]], 41)
  // fill 6 (bar 15): the kit stops on beat 3 — a half-bar of air before the break's
  // half-time, the second "voices rest" moment.
  for (const r of range(8, 16)) chorus.lanes[L.NOISE][chorus.at(15, r)] = null
  for (const r of range(4, 16)) chorus.lanes[L.DPCM][chorus.at(15, r)] = null
  chorus.put(L.DPCM, chorus.at(15, 4), { note: KIT.snare, inst: KIT.inst, vol: 15 })
  chorus.put(L.NOISE, chorus.at(15, 8), { note: 46, inst: CRASH, vol: 11 })
}

// =====================================================================================
// break — frame 15: half-time, the saw alone, a bar of hat, the tom fill
// =====================================================================================
const brk = s.section('break', 4)
{
  // SAW  held, half-time, alone: the same roots the chorus cadence just left (A, then
  // the walk D → E → F# up into A″'s return). Vol 10 — a lone saw is loud.
  phrase(brk, L.SAW, SAW_HOLD, 0, [
    [12, 'a1'], [4, 'c#2'],
    [12, 'd2'], [2, 'e2'], [2, 'f#2'],
    [16, '-'],
    [8, '-'], [2, 'e2'], [2, 'e2'], [2, 'e2'], [2, 'e2'],
  ], { vol: 10, cutAtEnd: false })
  // the pickup gallop in bar 3 is detached, like A's bass
  for (const r of [8, 10, 12, 14]) brk.put(L.SAW, brk.at(3, r), { inst: SAW_BASS, vol: 11 })
  // P1 P2 TRI V1 V2  all rest: the break is a dynamic, not a texture.
  for (const lane of [L.P1, L.P2, L.TRI, L.V1, L.V2]) brk.put(lane, 0, { note: CUT })
  // DPCM  the half-time pair: kick on 1, snare on 3 (bars 0, 1, 3).
  brk.hits(L.DPCM, KIT.inst, 15, [[0, 0], [1, 0], [3, 0], [3, 8]], KIT.kick)
  brk.hits(L.DPCM, KIT.inst, 15, [[0, 8], [1, 8], [3, 4]], KIT.snare)
  // NOISE  only the layered snare on 3 in bars 0–1; bar 2 is a hat and nothing else
  // (the third "voices rest" moment — seven lanes silent); bar 3 the tom fill from the
  // long-drop tom, high to low, then the roll that brings A″ back.
  brk.hits(L.NOISE, SNARE, 12, [[0, 8], [1, 8]])
  hats(brk, 2, range(0, 16), { on: 8, off: 5 })
  brk.hits(L.NOISE, TOM_LONG, 14, [[3, 0], [3, 2]], 43)
  brk.hits(L.NOISE, TOM_LONG, 14, [[3, 4], [3, 6]], 37)
  roll(brk, 3, { from: 8, to: 16, lo: 6, hi: 15, high: true })
}

// =====================================================================================
// A″ — frames 16–18: the hook displaced, then on the grid, then the turn and the hemiola
// =====================================================================================
/** The turn: four bars over B7 · E7 · A · F#7 — chained secondaries (V/V → V → I) and
 *  the pivot dominant of B. The d# and a# are the raised thirds; each resolves by step. */
const TURN = [
  [4, 'b4', 12], [4, 'd#5', 13], [8, 'f#5', 13],
  [4, 'g#5', 14], [4, 'e5', 13], [8, 'd5', 13],
  [8, 'e5', 13], [8, 'c#5', 12],
  [4, 'e5', 13], [4, 'c#5', 13], [4, 'a#4', 12], [4, 'c#5', 13],
]
const TURN_ROOTS = ['b1', 'e2', 'a1', 'f#2'].map(midi)
/** Hemiola stabs across the last three bars (48 rows, every 6 rows: eight groups closing
 *  on chorus′'s downbeat): [root, x, y] follows the bar's chord. */
const TURN_STABS = [['e3', 4, 10], ['a3', 4, 7], ['f#3', 4, 10]]

const A3 = s.section("A''", 12)
{
  // P1  the hook DISPLACED two rows late for its first four bars (§9.1 recipe F — at
  // 180 BPM an 8th-note lag is the audible unit), back on the grid for bars 4–7, then
  // the turn.
  phrase(A3, L.P1, LEAD, 2, HOOK.slice(0, 20), { vib: VIB, vibMin: 6, vibAfter: 3 })
  phrase(A3, L.P1, LEAD, A3.at(4), HOOK.slice(20), { vib: VIB, vibMin: 6, vibAfter: 3 })
  phrase(A3, L.P1, LEAD, A3.at(8), TURN, { vib: VIB })
  // P2  the echo canon again, but only under the on-grid statement (bars 4–7) — under
  // the displaced bars the echo would blur the lag — and the raised thirds of the turn
  // as a third below the tune (bars 8–11).
  A3.put(L.P2, 0, { note: CUT })
  echoWithCuts(A3, L.P1, L.P2, 3, ECHO, 8, { fromRow: A3.at(4), toRow: A3.at(8) })
  phrase(A3, L.P2, VOICE, A3.at(8), [
    [4, '-'], [4, 'b4', 10], [8, 'd#5', 11],
    [4, 'e5', 11], [4, '-'], [8, 'b4', 10],
    [8, 'c#5', 11], [8, 'a4', 10],
    [4, 'c#5', 11], [4, 'a#4', 11], [4, 'f#4', 10], [4, 'a#4', 11],
  ])
  // SAW  the gallop under the hook; under the turn, B7 gallops, then the HEMIOLA: one
  // root every six rows through E7 · A · F#7 (§9.1 recipe E), the last landing on row 42
  // of the span so the downbeat of chorus′ is the resolution.
  gallop(A3, L.SAW, SAW_BASS, 10, [...HOOK_ROOTS, TURN_ROOTS[0]], { accent: 1 })
  for (let i = 0; i < 8; i++) {
    const row = A3.at(9) + i * 6
    const bar = Math.floor(row / 16) - 9
    A3.put(L.SAW, row, { note: TURN_ROOTS[bar + 1], inst: SAW_HOLD, vol: 11 })
    A3.put(L.SAW, row + 4, { note: CUT })
  }
  // TRI  off-beats under the hook; under the hemiola it HOLDS the roots so the bar
  // stays audible while the saw and V2 argue with it.
  A3.put(L.TRI, 0, { note: CUT })
  offbeats(A3, [...HOOK_ROOTS, TURN_ROOTS[0]])
  for (let bar = 9; bar < 12; bar++) A3.put(L.TRI, A3.at(bar, 0), { note: TURN_ROOTS[bar - 8] + 12, inst: BASS, vol: 15 })
  A3.put(L.TRI, A3.at(11, 12), { note: CUT })
  // V1  thirds as in A, then the B7's d# on top and one held colour tone per bar of the
  // hemiola (V2 is the stab lane there, so the pad's lower voice drops out).
  pad(A3, HOOK_THIRDS, 8)
  pad(A3, [[8, 0, 'd#4', 'b3'], [9, 0, 'd4', null], [10, 0, 'c#4', null], [11, 0, 'c#4', null]], 9)
  // V2  under the hemiola: `0xy` stabs on the same six-row cell as the saw.
  for (let i = 0; i < 8; i++) {
    const row = A3.at(9) + i * 6
    const [root, x, y] = TURN_STABS[Math.floor(row / 16) - 9]
    A3.put(L.V2, row, { note: n(root), inst: STAB, vol: 9, fx: [['0', nib(x, y)]] })
  }
  A3.put(L.V2, A3.len - 1, { fx: [['0', 0]] })
  // NOISE / DPCM  the A kit with the high snare, kick placement changed (1, the "and"
  // of 2, 3); the kit keeps the four-row beat straight through the hemiola.
  for (let bar = 0; bar < 12; bar++) {
    if (bar === 0) A3.put(L.NOISE, 0, { note: 46, inst: CRASH, vol: 12 })
    else A3.hits(L.NOISE, KICK, 12, [[bar, 0]])
    A3.hits(L.NOISE, SNARE, 12, [[bar, 4], [bar, 12]], 41)
    A3.hits(L.NOISE, SNARE, 5, bar % 2 ? [[bar, 6], [bar, 14]] : [[bar, 10]])
    A3.hits(L.NOISE, OHAT, 9, [[bar, 14]])
    hats(A3, bar, [0, 2, 4, 6, 8, 10, 12, 14], { on: 8, off: 6 })
    A3.hits(L.DPCM, KIT.inst, 15, [[bar, 0], [bar, 6], [bar, 8]], KIT.kick)
    A3.hits(L.DPCM, KIT.inst, 15, [[bar, 4], [bar, 12]], KIT.snare)
  }
  // fill 7 (bar 7): the riser alone for a whole beat, then two snares.
  for (const r of range(8, 16)) A3.lanes[L.NOISE][A3.at(7, r)] = null
  A3.hits(L.NOISE, RISER, 13, [[7, 8]])
  A3.hits(L.NOISE, SNARE, 13, [[7, 14], [7, 15]], 41)
  // fill 8 (bar 11): the roll that lifts into B major.
  for (const r of range(4, 16)) A3.lanes[L.NOISE][A3.at(11, r)] = null
  roll(A3, 11, { from: 4, to: 16, lo: 5, hi: 15, high: true })
}

// =====================================================================================
// chorus′ — frames 19–22: the tune a whole step up, in B major, doubled an octave above
// =====================================================================================
const chorus2 = s.section("chorus'", 16)
{
  const UP = 2 // A major → B major: the modulation the turn's F#7 prepared
  // P1  the tune in B; its peak, b5 on bar 0 beat 3, is the piece's global peak.
  phrase(chorus2, L.P1, LEAD, 0, CHORUS, { vib: VIB, transpose: UP })
  chorus2.put(L.P1, chorus2.at(15, 5), { fx: [['R', nib(2, 5)]] })
  // P2  the counter-voice in B, suspensions and all.
  phrase(chorus2, L.P2, VOICE, 0, COUNTER, { transpose: UP })
  // V1  doubles the tune an octave up at 9 — a thin shimmer over the lead, no vibrato
  // of its own (two vibratos a beat apart would smear the octave).
  phrase(chorus2, L.V1, DOUBLE, 0, CHORUS, { transpose: UP + 12, fixedVol: 9 })
  // SAW TRI V2 NOISE DPCM  the chorus bed, a step up; V2 alone carries the harmony.
  chorusBed(chorus2, UP, { v1: false, padVol: 10 })
  // fill 9 (bar 7): four toms falling, high to low.
  for (const r of range(8, 16)) chorus2.lanes[L.NOISE][chorus2.at(7, r)] = null
  chorus2.hits(L.NOISE, TOM, 13, [[7, 8], [7, 10]], 43)
  chorus2.hits(L.NOISE, TOM_LONG, 13, [[7, 12], [7, 14]], 37)
  // fill 10 (bar 15): the crash-and-roll that hands over to the tag.
  for (const r of range(8, 16)) chorus2.lanes[L.NOISE][chorus2.at(15, r)] = null
  chorus2.put(L.NOISE, chorus2.at(15, 8), { note: 46, inst: CRASH, vol: 11 })
  roll(chorus2, 15, { from: 12, to: 16, lo: 8, hi: 14 })
}

// =====================================================================================
// tag — frame 23, two bars: the riff in B, a unison fall onto E7, and the jump home
// =====================================================================================
/** The fall: b → a → g# → f# by 8ths, then E held under the roll. The a-natural and the
 *  g# turn B major back into A's dominant in half a bar. */
const FALL = [[2, 'b2'], [2, 'a2'], [2, 'g#2'], [2, 'f#2'], [8, 'e2']]

const tag = s.section('tag', 4)
{
  const riffB = RIFF.slice(0, 6)
  for (const [lane, inst, vol, up] of [
    [L.SAW, SAW_BASS, 11, 0], [L.TRI, BASS, 15, 12], [L.P1, LEAD, 13, 24], [L.P2, ECHO, 11, 36],
  ]) {
    // bar 0: the riff's first bar in B (the intro's unison, a step up) …
    phrase(tag, lane, inst, 0, riffB, { vol, transpose: up + 2, cutAtEnd: false })
    // … bar 1: the fall, in unison, held on E for the roll.
    phrase(tag, lane, lane === L.SAW ? SAW_HOLD : inst, tag.at(1), FALL, { vol, transpose: up, cutAtEnd: false })
  }
  // V1 / V2  rest through the riff; the E7 stab under the roll says where we are going.
  tag.put(L.V1, 0, { note: CUT })
  tag.put(L.V2, 0, { note: CUT })
  tag.put(L.V2, tag.at(1, 8), { note: n('e3'), inst: STAB, vol: 10, fx: [['0', nib(4, 10)]] })
  tag.put(L.V2, tag.at(1, 12), { note: n('e3'), inst: STAB, vol: 10, fx: [['0', nib(4, 10)]] })
  tag.put(L.V2, tag.at(1, 15), { note: CUT, fx: [['0', 0]] })
  // NOISE  the kick doubles the riff, then the last roll — into the loop.
  tag.hits(L.NOISE, KICK, 12, [[0, 0], [0, 3], [0, 6], [0, 8], [0, 11], [0, 14], [1, 0], [1, 2], [1, 4], [1, 6]])
  roll(tag, 1, { from: 8, to: 16, lo: 6, hi: 15, high: true })
  tag.hits(L.DPCM, KIT.inst, 15, [[0, 0], [0, 8], [1, 0]], KIT.kick)
  tag.hits(L.DPCM, KIT.inst, 15, [[1, 4]], KIT.snare)
  // THE METRIC SURPRISE (§9.1 recipe H, §9.4): the tag is two bars, not four. `B01` and
  // `D00` on one row jump to frame 1, row 0 — the driver reads the pair as FamiTracker
  // does. The library's own `Bxx` on row 63 stays for gate B's last-row check and is
  // never reached. Rows 32–63 of this frame are silent by construction.
  tag.put(L.DPCM, tag.at(1, 15), { fx: [['B', 1], ['D', 0]] })
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['intro', 'A', "A'", 'pre', 'chorus', 'break', "A''", "chorus'", 'tag'])
s.loopTo('A')
s.qa({
  key: 'a-major',
  accidentalFractionMax: 0.2,
  bpmRange: [178, 182],
  durationSec: [120, 130],
  percussionGap: 16,
  motif: { channel: 'pulse1', patterns: [1, 2], variation: 'saw re-orchestration, +2-row displacement, B7 turn, riff in B' },
  notes:
    'A major, 180 BPM on 16th rows. accidentalFractionMax 0.2 for the modulation: the final ' +
    'chorus (frames 19-22) and the tag (23) are in B major, prepared by B7 -> E7 -> A -> F#7 ' +
    'across frames 18:0-18:63; the pre-chorus (9-10) borrows bVII (G) and the chorus cadence ' +
    '(14:32) borrows iv (Dm) with an f-natural appoggiatura. percussionGap 16 for the break ' +
    '(frame 15): half-time with the layered snare only on beat 3 of bars 0-1, a hat-only bar, ' +
    'then the tom fill; the intro riff carries the kick on its own attacks. Devices: a six-row ' +
    "V2 stab cell through A' (5:0, entering 6:2 and 8:2), the hook displaced +2 rows at 16:2, " +
    'a six-row hemiola in the saw and V2 from 18:16 to 18:58, a two-bar tag ending with B01+D00 ' +
    'at 23:31. Suspensions on pulse 2: 9-8 at 11:32-36, 4-3 at 11:48-52, cadential 4-3 at ' +
    '14:48-52 (and the same a step up in chorus\'). 0xy params are decimal: 047 = 71, 037 = 55, ' +
    '038 = 56, 04a = 74. 4xy vibrato 442 = 66, written a beat after the note it colours.',
  renderChecksum: 2060058519,
})
s.check()
s.write('src/assets/songs/04-tailwind.json')
