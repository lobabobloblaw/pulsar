#!/usr/bin/env node
/** 11 — Night Shift. The groove piece: slow, heavy, straight, and mostly empty.
 *
 *      node tools/songs/compose/11-night-shift.mjs   -> src/assets/songs/11-night-shift.json
 *
 *  An original piece for the eight-voice machine (preset-suite §12), written from the
 *  contour and harmony rules of §2.10 / §9.3. Nothing here quotes or paraphrases any
 *  published work. The subject is the POCKET: where an attack sits inside the beat, and
 *  how much of the bar is left empty.
 *
 *  GRID  tempo 150 · speed 5 · rowHighlight 8 = 90.000 BPM on THIRTY-SECOND rows.
 *        rowHighlight2 32 (a bar, 2.667 s), rowsPerPattern 64 (a frame = TWO bars, 5.333 s).
 *        1 row = 83.33 ms · 16th = 2 rows · 8th = 4 · beat = 8 · bar = 32.
 *        Beats at rows 0, 8, 16, 24; backbeats at 8 and 24; the push (the 16th before a
 *        beat) at 6, 14, 22, 30. `Gxx` at speed 5: G01 = 16.7 ms, G02 = 33.3 ms, max G04.
 *
 *  PHASE-CARRY TABLE, computed for a 64-row frame (shared sheet §5.3, not §9.1's table):
 *        entry row of frame k for a cell of length c is (−64·k) mod c, and the cycle closes
 *        after lcm(c,64)/64 frames.
 *          c = 6:  lcm(6,64)/64 = 192/64 = 3 frames; entry rows 0, 2, 4.
 *          c = 16 (the tresillo half-bar): 16 divides 64, so entry row 0 always — the
 *            tresillo is a GROUPING, not a phase device, and carries no phase at all.
 *        Both agree with the brief's arithmetic.
 *
 *  KEY   E dorian (E F# G A B C# D). The raised sixth C# against the minor third G is the
 *        mode's whole point and the bass keeps proving it. Two non-diatonic devices, in
 *        different sections: a COMMON-TONE DIMINISHED (A°7 → A7, the held A with C→C#,
 *        E♭→E, F#→G all moving up a semitone) in A′, and a TRUE PIVOT MODULATION BY A
 *        THIRD (Am7 as borrowed iv of E, quitted as ii of G, confirmed D7 → Gm) that lands
 *        A″ a minor third up in G dorian. Every chromatic note sounds ≤ 2 rows and resolves
 *        by step in the same direction (§9.3).
 *
 *  FORM (24 frames of two bars = 48 bars; one pass ≈ 2:07)
 *  | frame | section    | bars | what happens                                             |
 *  |-------|------------|------|----------------------------------------------------------|
 *  | 0–1   | clock-in   | 4    | the kit alone on an 8th hat and a DPCM kick; the saw's    |
 *  |       |            |      | shift M enters in bar 2; bar 1 is one note and a rest     |
 *  | 2–5   | A          | 8    | the head. M on the saw over Em9 · A13 · Gmaj7 · Bm7→A7    |
 *  |       |            |      | (one chord per TWO bars); the lick L on pulse 1 then       |
 *  |       |            |      | silence; two-voice VRC6 stabs on the push; ghost kit       |
 *  | 6–9   | A′         | 8    | second telling: Em9 · A13 · F#m7 · Bm7→A7 — the third cell |
 *  |       |            |      | changes, so the four-chord cycle never repeats past eight  |
 *  |       |            |      | bars; the COMMON-TONE DIMINISHED pushes into the A13 at    |
 *  |       |            |      | 6:62; L extended with an `Rxy` fall and then inverted;     |
 *  |       |            |      | the triangle takes a tenor counter-line                    |
 *  | 10–13 | comp       | 8    | THE POCKET SECTION: vrc6p2's comping and the snare ghosts |
 *  |       |            |      | laid two ticks behind the beat (`G02`) for the whole       |
 *  |       |            |      | section while the bass and both kicks stay dead on; pulse  |
 *  |       |            |      | 2 is an independent line throughout (§9.2); ONE CHORD PER  |
 *  |       |            |      | BAR — the harmonic rhythm doubles — and the descending-    |
 *  |       |            |      | thirds chain Em7 → C#m7♭5 → A7 → F#m7 → Bm7               |
 *  | 14–16 | graveyard  | 6    | thin: a SIX-ROW cell on vrc6p1 phase-carrying 0, 2, 4     |
 *  |       |            |      | across three frames (3:4 against the beat); the bass in    |
 *  |       |            |      | augmentation; brush on the beat; the metric surprise       |
 *  |       |            |      | `D00` at 16:55 drops the last beat into the lift          |
 *  | 17–18 | lift       | 4    | SECOND LEAD COLOUR: the tune leaves pulse 1 for the SAW   |
 *  |       |            |      | in the tenor (MIDI 52–64) while the TRIANGLE takes the     |
 *  |       |            |      | bass and M with it; Am7 stated bare (two voices) at 17:0   |
 *  |       |            |      | — the pivot — then D7                                      |
 *  | 19–21 | A″         | 6    | the head a MINOR THIRD UP in G dorian: Gm9 · C7 · B♭maj7 |
 *  |       |            |      | · Dm7→C7; full kit, 16th hats, horn stabs one tick late    |
 *  |       |            |      | (`G01`); vrc6p1 doubles the tune AT PITCH; the diminished  |
 *  |       |            |      | restated as C°7 → C7 at 19:62; the global peak b♭5 is an   |
 *  |       |            |      | appoggiatura at 21:32                                      |
 *  | 22–23 | turn       | 4    | Gm7 · Am7 · D7 · D7 thinning to a bare D — V of G heard   |
 *  |       |            |      | as ♭VII of E, so the seam reads D7 → Em. `B02` at 23:63   |
 *
 *  MOTIFS
 *    M  the shift — TWO BARS of 16th-level tresillo (3+3+2 sixteenths = 6+6+4 rows, so
 *       attacks at rows 0, 6, 12 and 16, 22, 28 of each 32-row bar), the first bar full and
 *       the second left open: four attacks, a rest on the third slot, and a `Qxy` slide into
 *       the raised sixth. The rhythm is fixed; every chord keeps it and changes only its
 *       pitches, which is what makes it a motif rather than a riff. Stated six times:
 *       1:0 (the bass alone), 2:0 (A, the statement), 6:0 (A′, with an added ghost
 *       sixteenth), 10:0 (comp, in AUGMENTATION — the tresillo broadened to the 8th level,
 *       12+12+8 rows), 17:16 (lift, RE-ORCHESTRATED onto the triangle) and 19:0 (A″,
 *       TRANSPOSED a minor third up into G dorian). 23:0 states it once more over the D7.
 *    L  the lick — pulse 1, two bars: a syncopated entry on the "and of 2", a third up to
 *       the peak on beat 3, then stepwise down and a bar and a half of silence. The space
 *       is the idiom. Stated at 2:12, RE-HARMONISED unchanged over Gmaj7 at 4:12 (peaking a
 *       step lower, so section A has exactly one highest note), EXTENDED with an `Rxy` fall
 *       at 6:12, INVERTED at 8:12, a fifth up at 12:12, and a minor third up in G dorian at
 *       19:12 — six statements, four of them genuine variations.
 *
 *  DEVICES (frame:row)
 *    §9.1  (C) the 16th-level tresillo on the sawtooth, 6+6+4 rows, from 1:0 to 23:0 —
 *            §9.1 rates it ideal at 90–130 BPM and 90 is the floor, where it is most
 *            deliberate; the kit stays square above it.
 *          (D) a six-row cell on vrc6p1 through graveyard, unbroken from 14:0 to 16:52,
 *            entry rows 14:0, 15:2, 16:4 — three frames, after which the carry would return
 *            to entry row 0; the cell stops at 16:52, before the `D00`.
 *          (G) `G02` used structurally: vrc6p2's comping (48 cells, 10:2 to 13:62) and the
 *            noise ghosts (19 cells) through the whole of comp. Dead on, deliberately: the
 *            sawtooth bass, the DPCM kick and snare, the noise hats and vrc6p1's held guide
 *            tone. A″'s `G01` on the horn stabs (11 cells from 19:14) is decorative, not
 *            structural, and is a different amount of lateness on purpose.
 *          (H) the metric surprise, exactly one: `D00` at 16:55 drops the last beat of
 *            graveyard (a 56-row frame — a beat is eight rows here), so the lift arrives a
 *            whole beat early. Not at the
 *            loop seam.
 *    §9.2  pulse 2 is an independent line for the whole of comp — 31 attacks from 10:4 to
 *            13:58, its own off-sixteenth rhythm and its own contour — and it carries the
 *            cadential 4–3 SUSPENSION: d4 at 13:32 holds through the change to A7 at 13:48
 *            and resolves down to c#4 at 13:52. The second is the same 4–3 in A′: d4 at
 *            9:40 across the change to A7 at 9:48, resolving to c#4 at 9:52.
 *    §9.3  common-tone diminished at 6:62 → 7:0 (A°7 → A7) and again, transposed, at
 *            19:62 → 20:0 (C°7 → C7); true pivot modulation by a MINOR THIRD — Am7 arrives
 *            as the borrowed iv of E at 16:32, stands bare on two voices at 17:0 where it
 *            turns into ii of G, D7 confirms at 18:0, and Gm lands at 19:0; descending
 *            THIRDS E → C# → A → F#, three links at 10:0 · 10:32 · 11:0 · 11:32, arriving
 *            on Bm7 at 12:0 (descending fifths already appear twice on this album); comp is
 *            the section whose harmonic rhythm differs — one chord per bar against A's one
 *            per two.
 *    §9.4  the kit changes at least two parameters every section (hat subdivision, hat
 *            instrument, kick placement, snare timbre 39↔41, ghost density, the metal tick);
 *            nine fills, none identical, and NONE at the loop seam — the last bar thins.
 *
 *  ALLOCATION (one lead at a time; every lane rests audibly somewhere)
 *    clock-in   NOISE hat · DPCM kick · SAW from bar 2 · everything else silent
 *    A          SAW M · P1 lick · V1/V2 stabs on the push · TRI accents · NOISE ghosts ·
 *               DPCM kick+snare · P2 rests
 *    A′         SAW M popped · P1 lick extended · TRI tenor counter-line · P2 the dim7's
 *               E♭→E and two answers · V1/V2 stabs + the dim7
 *    comp       P2 the independent line · V2 comping BEHIND · V1 one held guide tone ·
 *               SAW augmented M · P1 two bars only · TRI rests · leanest kit
 *    graveyard  V1 the six-row cell · SAW half notes · P2 one sigh · TRI enters at bar 4 ·
 *               NOISE brush · P1, V2 rest
 *    lift       SAW the tune in the tenor · TRI the bass · V1/V2 the pivot, bare at 17:0 ·
 *               P1, P2 rest
 *    A″         P1 the tune · V1 doubling AT PITCH · V2 horn stabs · SAW M in G · TRI the
 *               backbeat chank · full kit · P2 only the diminished chord's own semitone
 *    turn       SAW · TRI · V1/V2 the D7 · NOISE thinning · P1 one tail phrase
 *  HEADROOM  the saw is 9–13 and never sustains above 12 (vol 15 on the saw is about twice
 *            a pulse at 15); the VRC6 pulses sit at 7–10; the lead reaches 14 only on the
 *            two section peaks. The piece is deliberately quiet and declares its rmsRange.
 */
import { CUT, L, Song, n, nib } from './lib.mjs'

const s = new Song({
  id: 'night-shift',
  name: 'Night Shift',
  author: 'pulsar preset album',
  speed: 5,
  rowsPerPattern: 64,
  rowHighlight: 8,
  rowHighlight2: 32,
})

// =====================================================================================
// instruments
// =====================================================================================
/** THE BASS, and instrument 0 — the album gate in `soundtrack.test.ts` compares the macro
 *  set of every song's instrument 0, so this is declared first and it sounds first. A
 *  thumbed sawtooth: full for two ticks, then a body that settles at two thirds of the
 *  column so a sustained note sits under the accents without a volume change. */
const SAW_THUMB = s.instrument('saw-thumb', {
  volume: { values: [15, 15, 14, 13, 12, 11, 10], loop: 6 },
})
/** The ghost bass — the same lane, a fifth of the length: a muted 16th that is felt more
 *  than heard. It is what makes the tresillo a groove instead of six equal notes. */
const SAW_GHOST = s.instrument('saw-ghost', {
  volume: { values: [15, 11, 6, 2, 0] },
})
/** The saw as the lift's lead: a stepped bend-in (the macro ACCUMULATES, so the offset the
 *  ear hears is the running sum 5 3 2 1 0 — on pitch by tick 5) under a slow swell. */
const SAW_LEAD = s.instrument('saw-lead', {
  volume: { values: [9, 11, 13, 14, 15, 15, 14], loop: 6 },
  pitch: { values: [5, -2, -1, -1, -1, 0] },
})
/** The lead. A duty macro that opens 12.5 % → 25 % → 50 % and narrows again: the "wah" the
 *  brief asks for, one per note, so the lick's colour moves without a `Vxx` anywhere. */
const LEAD = s.instrument('lead', {
  volume: { values: [12, 15, 14, 13, 13, 12, 11], loop: 6 },
  duty: { values: [0, 1, 2, 2, 1], loop: 4 },
  pitch: { values: [4, -2, -1, -1, 0] },
})
/** The lead's second colour, for the tail phrases: 50 % throughout, no scoop — rounder and
 *  plainer, so a restatement can be quieter without being smaller. */
const LEAD_ROUND = s.instrument('lead-round', {
  volume: { values: [10, 13, 13, 12, 12, 11], loop: 5 },
  duty: { values: [2], loop: 0 },
})
/** Pulse 2's voice: the thin 12.5 % that sits above the mix without volume (§2.3), with a
 *  short front so its off-16ths read as a separate player rather than a harmony. */
const VOICE = s.instrument('voice', {
  volume: { values: [11, 13, 12, 11, 10, 9, 8], loop: 6 },
  duty: { values: [0], loop: 0 },
})
/** The horn stab: the VRC6's own attack, duty 7 (fat 50 %) narrowing to 3 (bright 25 %)
 *  over four ticks, and an envelope that ends itself in a row and a half. */
const STAB = s.instrument('stab', {
  volume: { values: [15, 15, 13, 10, 7, 4, 2, 0] },
  duty: { values: [7, 6, 5, 4, 3], loop: 4 },
})
/** The comping stab — the one that plays BEHIND the beat. Two ticks longer than STAB
 *  because `Gxx` delays macro index 0 too (§9.1's caveat), so a `G02` cell would otherwise
 *  lose the end of its tail to the next attack. Thin (duty 1) so it is a scratch, not a
 *  chord. */
const COMP = s.instrument('comp', {
  volume: { values: [13, 14, 12, 10, 8, 6, 4, 3, 2, 0] },
  duty: { values: [3, 2, 1], loop: 2 },
})
/** The held guide tone: a slow VRC6 swell that never fully stops, for one sustained note
 *  under a section. Duty 7 — the fat 50 % is the warmest thing the chip has. */
const HOLD = s.instrument('hold', {
  volume: { values: [4, 6, 8, 9, 10, 10, 9], loop: 6 },
  duty: { values: [7], loop: 0 },
})
/** The graveyard's clock: a six-row cell needs a voice that is gone before the next one
 *  arrives. Four ticks, thin, and nothing else. */
const TICK = s.instrument('tick', {
  volume: { values: [12, 8, 4, 0] },
  duty: { values: [1], loop: 0 },
})
/** The triangle is a GATE, not a level (§1): its dynamics are rhythm and register. Two
 *  lengths, so the same lane can play a short accent and a held tenor note. */
const TRI_SHORT = s.instrument('tri-short', { volume: { values: [15, 15, 15, 15, 0] } })
const TRI_HOLD = s.instrument('tri-hold', { volume: { values: [15], loop: 0 } })

// Shared bank, by name and byte-identical to the fixture (§3.1, §12.6): a drum that is the
// same drum across the album is worth more than a lead that is the same lead.
// No `kick`: the DPCM pair carries every kick in the piece (the brief's design, and its
// TND duck is the mix tool that takes weight FROM the triangle and the noise), so the noise
// lane is left entirely to hats, ghosts, toms and the metal tick. Asking the bank for an
// instrument nothing plays would be dropped from the file and then declared in `qa.bank`,
// which gate B rejects.
const [SNARE, TOM, HAT, OHAT, CRASH, METAL] =
  s.bank('snare', 'tom', 'hat-closed', 'hat-open', 'crash', 'metal')
const KIT = s.dpcmKit() // kick 36, snare 39 on the dpcm lane

/** The brush: graveyard needs the noise lane to keep time without a hat's click, so this
 *  is a closed hat with a tail — six ticks, ending on 0 and never looping, which is what
 *  the lane needs to release at all (§1). */
const BRUSH = s.instrument('brush', {
  volume: { values: [9, 7, 5, 3, 2, 0] },
  duty: { values: [0], loop: 0 },
  note: 45,
})
/** The riser: the PITCH macro ramps the period index DOWN, which on the noise lane is
 *  pitch going UP (§1 — the pitch macro adds to the index and does not wrap; the arpeggio
 *  macro would). It ends on 0, as every pitch macro must, because they ACCUMULATE. */
const RISER = s.instrument('riser', {
  volume: { values: [4, 5, 7, 8, 10, 11, 13, 14, 15, 0] },
  pitch: { values: [-1, -1, -1, -1, -1, -1, -1, -1, 0] },
  duty: { values: [0], loop: 0 },
  note: 42,
})

// =====================================================================================
// helpers — the piece's rhythmic vocabulary, so a section reads as placement and pitch
// =====================================================================================
const VIB = nib(3, 2) // 4xy: a slow, narrow singing vibrato, always written a beat late
/** How the lead is always played: vibrato on anything held a beat or longer, written a
 *  beat late, and one volume step above the arc the motif tables spell — the tables carry
 *  the SHAPE of each phrase and this carries the lane's level, so the two can be adjusted
 *  without touching each other. */
const SUNG = { vib: VIB, vibMin: 8, vibAfter: 4, volShift: 1 }
const PUSH = [6, 14, 22, 30] // the 16th before each beat — where a stab lands
const range = (a, b, step = 1) => Array.from({ length: Math.max(0, Math.ceil((b - a) / step)) }, (_, i) => a + i * step)

/** M's rhythm, once: the 16th-level tresillo 3+3+2 sixteenths = 6+6+4 rows, twice over a
 *  32-row bar, over two bars. Twelve slots; the pitches change per chord, the rows never
 *  do. Slot 8 (bar 2, row 44) is the rest that makes the second bar breathe. */
const TRESILLO = [0, 6, 12, 16, 22, 28, 32, 38, 44, 48, 54, 60]
/** The same figure in AUGMENTATION for `comp`: 3+3+2 at the EIGHTH level — 12+12+8 rows,
 *  so one cell fills a whole bar instead of half of one. Six slots over two bars. */
const TRESILLO_WIDE = [0, 12, 24, 32, 44, 56]

/** Write one two-bar statement of M at `bar`. `slots` is twelve entries, one per tresillo
 *  row: `null` rests, `[note, vol]` attacks, and `{ q }` writes an effect-only `Qxy` that
 *  slides the sounding note up `q` semitones into its target.
 *
 *  A slot at vol ≤ `ghostAt` is played on the GHOST instrument — a fifth of the length — so
 *  the lane has two weights rather than six equal sixteenths. The threshold is 9, which in
 *  every cell below ghosts exactly the three weak positions: the sixteenth after the
 *  downbeat and the two pushes at the ends of the bars. That is the difference between a
 *  tresillo and a groove. */
function shift(sec, bar, slots, opts = {}) {
  const { rows = TRESILLO, lane = L.SAW, inst = SAW_THUMB, ghost = SAW_GHOST, slideSpeed = 8, volShift = 0, ghostAt = 9 } = opts
  slots.forEach((slot, i) => {
    if (slot === null || slot === undefined) return
    const row = sec.at(bar) + rows[i]
    if (slot.q !== undefined) {
      // Qxy: x is the SPEED (2x+1 period units a tick) and y the semitones. It clears the
      // arpeggio, slide and portamento modes and latches none of its own, so there is
      // nothing to cancel afterwards — unlike `3xx`, which `300` only freezes.
      sec.put(lane, row, { fx: [['Q', nib(slideSpeed, slot.q)]] })
      return
    }
    const [note, vol] = slot
    const v = Math.max(1, Math.min(15, vol + volShift))
    sec.put(lane, row, { note: n(note), inst: v <= ghostAt ? ghost : inst, vol: v })
  })
}

/** A phrase as consecutive events `[rows, note, vol?, fx?]`. `'-'` is a rest (a cut) and
 *  `'~'` extends the previous note. Notes at least `vibMin` rows long bloom into vibrato
 *  `vibAfter` rows in — delayed vibrato is the professional move (§2.5) — and the next
 *  attack or cut carries the `4x0` cancel, so nothing wobbles into the next section or
 *  across the loop seam (§2.9 rule 3). Returns the row after the last event. */
function phrase(sec, lane, inst, startRow, events, opts = {}) {
  const { vib = 0, vibMin = 8, vibAfter = 4, transpose = 0, cutAtEnd = true, vol: defaultVol = 12, fixedVol, volShift = 0 } = opts
  let row = startRow
  let pending = false
  const cancel = () => (pending ? [['4', 0]] : [])
  for (const [len, note, vol, fx] of events) {
    if (note === '~') {
      row += len
      continue
    }
    if (note === '-') {
      const c = cancel()
      sec.put(lane, row, { note: CUT, ...(c.length ? { fx: c } : {}) })
      pending = false
      row += len
      continue
    }
    const list = [...cancel(), ...(fx ? [fx] : [])]
    const level = fixedVol ?? Math.max(1, Math.min(15, (vol ?? defaultVol) + volShift))
    sec.put(lane, row, { note: n(note) + transpose, inst, vol: level, ...(list.length ? { fx: list } : {}) })
    pending = false
    if (vib && len >= vibMin && row + vibAfter < sec.len) {
      sec.put(lane, row + vibAfter, { fx: [['4', vib]] })
      pending = true
    }
    row += len
  }
  if (cutAtEnd && row < sec.len) {
    const c = cancel()
    sec.put(lane, row, { note: CUT, ...(c.length ? { fx: c } : {}) })
    pending = false
  }
  if (pending) sec.put(lane, Math.min(row, sec.len) - 1, { fx: [['4', 0]] })
  return row
}

/** A two-voice VRC6 stab: the chord's guide tones, vrc6p1 above vrc6p2, short envelopes.
 *  `delay` puts BOTH voices behind the beat by that many ticks (`Gxx` is not a channel
 *  mode — the driver reads it per cell, so every note-carrying cell needs its own and
 *  nothing cancels it); `strum` adds one extra tick to the lower voice only, which is a
 *  horn section not quite arriving together. */
function stab(sec, bar, row, hi, lo, opts = {}) {
  const { vol = 9, inst = STAB, delay = 0, strum = 0, fx = null } = opts
  const at = sec.at(bar, row)
  const g = (d) => (d > 0 ? [['G', d]] : [])
  if (hi !== null) sec.put(L.V1, at, { note: n(hi), inst, vol, ...(fx || g(delay).length ? { fx: [...g(delay), ...(fx ? [fx] : [])] } : {}) })
  if (lo !== null) sec.put(L.V2, at, { note: n(lo), inst, vol, ...(g(delay + strum).length ? { fx: g(delay + strum) } : {}) })
}

/** The kit, one bar at a time. The noise lane is monophonic, so precedence matters and is
 *  written down here in one place: crash, toms and snares, then the open hat and the metal
 *  tick, then the ghosts, then the hats — each later kind SKIPPING a row an earlier one has
 *  already taken. Two reasons, and the second one cost a gate run: a hat must never displace
 *  a backbeat, and `put()` MERGES, so an accent written over a ghost would keep the ghost's
 *  `Gxx` and be dragged behind the beat without anything saying so.
 *  `ghostDelay` is the `G02` that lays the ghosts behind the beat in `comp`. */
function kit(sec, bar, opts = {}) {
  const {
    hats = '8th', hatOn = 7, hatOff = 5, hatInst = HAT,
    ghosts = [], ghostVol = 4, ghostDelay = 0, snares = [], snareVol = 12, snareNote = 39,
    open = [], openVol = 8, metal = [], crash = false, toms = [],
  } = opts
  if (crash) sec.put(L.NOISE, sec.at(bar, 0), { note: 46, inst: CRASH, vol: 11 })
  for (const [r, note, vol] of toms) sec.put(L.NOISE, sec.at(bar, r), { note, inst: TOM, vol })
  for (const r of snares) sec.put(L.NOISE, sec.at(bar, r), { note: snareNote, inst: SNARE, vol: snareVol })
  for (const r of open) sec.put(L.NOISE, sec.at(bar, r), { note: 46, inst: OHAT, vol: openVol })
  for (const r of metal) sec.put(L.NOISE, sec.at(bar, r), { note: 44, inst: METAL, vol: 7 })
  for (const r of ghosts) {
    if (sec.lanes[L.NOISE][sec.at(bar, r)] !== null) continue
    sec.put(L.NOISE, sec.at(bar, r), {
      note: 39, inst: SNARE, vol: ghostVol, ...(ghostDelay ? { fx: [['G', ghostDelay]] } : {}),
    })
  }
  const rows = hats === 'off' ? []
    : hats === '16th' ? range(0, 32, 2)
      : hats === '8th' ? range(0, 32, 4)
        : hats === 'beat' ? [0, 8, 16, 24]
          : hats === 'offbeat' ? [4, 12, 20, 28]
            : hats // an explicit row list
  for (const r of rows) {
    const at = sec.at(bar, r)
    if (sec.lanes[L.NOISE][at] !== null) continue
    sec.put(L.NOISE, at, { note: 45, inst: hatInst, vol: r % 8 === 0 ? hatOn : hatOff })
  }
}

/** The DPCM pair: the kick and snare backbeat, and the lane whose TND duck takes weight
 *  FROM the triangle and the noise — which is exactly what a backbeat wants (§2.8). */
function pair(sec, bar, kicks, snares = []) {
  for (const r of kicks) sec.put(L.DPCM, sec.at(bar, r), { note: KIT.kick, inst: KIT.inst, vol: 15 })
  for (const r of snares) sec.put(L.DPCM, sec.at(bar, r), { note: KIT.snare, inst: KIT.inst, vol: 14 })
}

// =====================================================================================
// the material — M's twelve slots per chord, the guide-tone voicings, and the lick
// =====================================================================================
/** M, per chord. The rows never change; only the pitches do. Slot 8 is always the rest
 *  that opens the second bar, slot 10 is usually the `Qxy` slide, and the accented slots
 *  (13, 12) against the ghosts (7, 9, 10) are the whole difference between a groove and
 *  six equal sixteenths. Every cell keeps the bass inside MIDI 28–48. */
const M = {
  // i — the root, the third, the ♭7 leaping a minor seventh up, then the slide into the
  // RAISED SIXTH (c#2), which is the one note that says dorian rather than aeolian.
  em: [['e1', 13], ['e1', 7], ['g1', 11], ['e1', 12], ['d2', 11], ['b1', 9],
    ['e1', 13], ['e2', 10], null, ['b1', 11], { q: 2 }, ['b1', 9]],
  // IV — the same figure over A, where c#2 is now the chord's own third and the slide
  // lands on f#2, the thirteenth. The mode's brightener, stated as bass.
  a13: [['a1', 13], ['a1', 7], ['c#2', 11], ['a1', 12], ['g2', 11], ['e2', 9],
    ['a1', 13], ['a2', 10], null, ['e2', 11], { q: 2 }, ['e2', 9]],
  // III — G, the flat side; the major seventh f#2 in the bass is the colour.
  gmaj: [['g1', 13], ['g1', 7], ['b1', 11], ['g1', 12], ['f#2', 11], ['d2', 9],
    ['g1', 13], ['g2', 10], null, ['d2', 11], { q: 2 }, ['d2', 9]],
  // ii — no slide here: c#2 + 2 would be d#, a chromatic note with nowhere to resolve.
  fsm: [['f#1', 13], ['f#1', 7], ['a1', 11], ['f#1', 12], ['e2', 11], ['c#2', 9],
    ['f#1', 13], ['f#2', 10], null, ['c#2', 11], null, ['b1', 9]],
  // v → IV — the cadence cell. The second bar abandons the tresillo's leaps for a
  // STEPWISE DESCENT a1 · g1 · f#1 into the next section's e1, under a rising lead:
  // contrary motion at the cadence (§2.10), and the plagal A7 → Em that closes A.
  cadence: [['b1', 13], ['b1', 7], ['d2', 11], ['b1', 12], ['a2', 11], ['f#2', 9],
    ['a1', 13], ['a1', 7], null, ['g1', 12], null, ['f#1', 10]],
  // A″, a minor third up in G dorian: the same six shapes transposed, note for note.
  gm: [['g1', 13], ['g1', 7], ['bb1', 11], ['g1', 12], ['f2', 11], ['d2', 9],
    ['g1', 13], ['g2', 10], null, ['d2', 11], { q: 2 }, ['d2', 9]],
  c7: [['c2', 13], ['c2', 7], ['e2', 11], ['c2', 12], ['bb2', 11], ['g2', 9],
    ['c2', 13], ['c3', 10], null, ['g2', 11], { q: 2 }, ['g2', 9]],
  bbcad: [['bb1', 13], ['bb1', 7], ['d2', 11], ['bb1', 12], ['a2', 11], ['f2', 9],
    ['d2', 13], ['d2', 7], null, ['c2', 12], null, ['bb1', 10]],
}

/** M in AUGMENTATION for `comp` — six slots over two bars on `TRESILLO_WIDE`, one chord
 *  per bar. The bass says less exactly where the comping says more, which is why the
 *  section can double its harmonic rhythm without getting louder. */
const M_WIDE = {
  em_csm: [['e1', 13], ['b1', 10], ['g1', 11], ['c#2', 13], ['g1', 10], ['b1', 11]],
  a_fsm: [['a1', 13], ['e2', 10], ['c#2', 11], ['f#1', 13], ['c#2', 10], ['a1', 11]],
  bm_em: [['b1', 13], ['f#2', 10], ['d2', 11], ['e1', 13], ['b1', 10], ['g1', 11]],
  g_bm: [['g1', 13], ['b1', 10], ['f#1', 11], ['b1', 13], ['d2', 10], ['a1', 11]],
}

/** Guide tones, vrc6p1 above vrc6p2 — the third and the seventh, the two notes that
 *  define a chord (§2.10). The root is the bass's job and is never doubled here. */
const GUIDE = {
  em: ['d4', 'g3'], // ♭7 over ♭3
  a13: ['g4', 'c#4'], // ♭7 over 3 — the raised sixth again, now as a chord tone
  gmaj: ['f#4', 'b3'], // maj7 over 3
  bm: ['a4', 'd4'],
  fsm: ['e4', 'a3'],
  csm7b5: ['b3', 'g3'], // ♭7 over ♭5 — the tritone spelled bare
  dmaj: ['c#4', 'f#3'],
  am: ['g4', 'c4'], // the borrowed iv, and the pivot
  d7: ['c4', 'f#3'],
  gm: ['f4', 'bb3'],
  c7: ['bb4', 'e4'],
  bbmaj: ['a4', 'd4'],
  dm: ['c4', 'f3'],
}

/** L — the lick. Two bars: it enters on the "and of 2" (row 12) rather than a downbeat,
 *  climbs a third to the peak on beat 3, falls back by step, and then SHUTS UP for a bar
 *  and a half. Eleven rows of tune in sixty-four; the rest is the idiom. */
const LICK = [
  [12, '-'], [2, 'b4', 12], [2, 'd5', 13], [4, 'e5', 14], [4, 'd5', 12],
  [4, 'b4', 12], [4, 'a4', 11], [8, 'g4', 11], [24, '-'],
]
/** L′ — the extension for A′: the same entry and peak, but the answer keeps going down
 *  through f#4 to a held e4 that an `Rxy` then bends away from. The fall is written as its
 *  OWN effect-only cell two rows after the note, because a note sharing its row with `Rxy`
 *  does not retrigger (§1) — it would bend the note before it instead. */
const LICK_2 = [
  [12, '-'], [2, 'b4', 12], [2, 'd5', 13], [4, 'e5', 14], [2, 'd5', 12], [2, 'b4', 12],
  [4, 'a4', 12], [4, 'b4', 12], [4, 'g4', 11], [4, 'f#4', 11],
  [8, 'e4', 12], [16, '-'],
]

// =====================================================================================
// clock-in — frames 0–1: the pocket before there is anything in it
// =====================================================================================
const intro = s.section('clock-in', 4)
{
  // NOISE  an eighth-note hat and nothing else for two bars: the listener is given the
  // grid before the groove, which is why the tresillo reads as syncopation when it lands.
  kit(intro, 0, { hats: '8th', hatOn: 6, hatOff: 4 })
  // bar 1 is THE EMPTY BAR — a hat on the beat, one kick, and three beats of air. It is
  // the piece's thesis and the first of the "two or more voices rest" moments (§2.8).
  kit(intro, 1, { hats: 'beat', hatOn: 6 })
  // bars 2–3: the kit fills in as the bass arrives; ghosts appear between the backbeats.
  kit(intro, 2, { hats: '8th', hatOn: 7, hatOff: 5, ghosts: [20, 30] })
  kit(intro, 3, { hats: '8th', hatOn: 7, hatOff: 5, ghosts: [6] })
  // DPCM  the kick on 1 and the "and of 2" (row 12) — the placement the whole piece keeps;
  // the snare joins on the backbeats only once the bass is in.
  pair(intro, 0, [0, 12])
  pair(intro, 1, [0])
  pair(intro, 2, [0, 12], [8, 24])
  pair(intro, 3, [0, 12], [8, 24])
  // SAW  M, alone, bars 2–3: six attacks, four attacks, one slide, and a rest. The motif
  // is stated by the instrument that owns it before any harmony explains it.
  shift(intro, 2, M.em)
  // FILL 1 (bar 3, rows 24–31): two toms falling into a ghost — the only tom pair in the
  // piece that is not answered by a snare.
  for (const r of range(24, 32)) intro.lanes[L.NOISE][intro.at(3, r)] = null
  intro.put(L.NOISE, intro.at(3, 24), { note: 43, inst: TOM, vol: 11 })
  intro.put(L.NOISE, intro.at(3, 28), { note: 37, inst: TOM, vol: 11 })
  intro.put(L.NOISE, intro.at(3, 30), { note: 39, inst: SNARE, vol: 6 })
}

// =====================================================================================
// A — frames 2–5: the head. One chord per TWO bars; the loop target
// =====================================================================================
/** Where the two VRC6 voices stab, per two-bar cell: the push into beat 3 of bar 1, the
 *  push into the next bar, and the push into beat 4 of bar 2. Three stabs in sixty-four
 *  rows — the horns say the chord and then stop. */
const STABS_A = [[0, 14], [0, 30], [1, 22]]
/** The triangle's two-note answer, in the rest the second bar leaves. A tenor voice, not
 *  a doubling: the saw never plays these rows and never plays these pitches. */
const TRI_A = { em: ['b3', 'a3'], a13: ['a3', 'g3'], gmaj: ['b3', 'g3'], fsm: ['c#4', 'a3'], cadence: ['e3', 'f#3'] }

/** The head's four two-bar cells, in order, as [chord key, guide-tone key]. A and A′ differ
 *  in their third cell, so the four-chord cycle never repeats past eight bars (§9.3). */
const HEAD_A = [['em', 'em'], ['a13', 'a13'], ['gmaj', 'gmaj'], ['cadence', 'bm']]
const HEAD_A2 = [['em', 'em'], ['a13', 'a13'], ['fsm', 'fsm'], ['cadence', 'bm']]

/** Everything a head cell shares between A and A′: the bass, the stabs and the triangle's
 *  answer. The lead and the kit are written per section, because that is what differs. */
function headCell(sec, cell, chord, guide, opts = {}) {
  const { stabVol = 10, stabs = STABS_A, tri = TRI_A, hiccup = false } = opts
  const bar = cell * 2
  // SAW  M on this chord.
  shift(sec, bar, M[chord])
  // …A′'s variation: one extra ghost sixteenth after the downbeat, so the second telling
  // of the same cell is not the same pattern index as the first.
  if (hiccup) sec.put(L.SAW, sec.at(bar, 2), { note: n(M[chord][0][0]), inst: SAW_GHOST, vol: 7 })
  // V1 / V2  the chord's seventh over its third, dead on the grid, on the push.
  const [hi, lo] = GUIDE[guide]
  for (const [b, r] of stabs) stab(sec, bar + b, r, hi, lo, { vol: stabVol })
  // TRI  the answer, in the hole the bass leaves at rows 42 and 52 of the cell.
  const [t1, t2] = tri[chord]
  sec.put(L.TRI, sec.at(bar + 1, 10), { note: n(t1), inst: TRI_SHORT, vol: 15 })
  sec.put(L.TRI, sec.at(bar + 1, 20), { note: n(t2), inst: TRI_SHORT, vol: 15 })
}

/** L over Gmaj7 — the same shape re-harmonised, and deliberately peaking a step LOWER
 *  (d5, not e5) so section A has exactly one highest note (§2.10). */
const LICK_G = [
  [12, '-'], [2, 'a4', 11], [2, 'b4', 12], [4, 'd5', 13], [4, 'b4', 12],
  [4, 'a4', 11], [4, 'g4', 11], [8, 'f#4', 11], [24, '-'],
]
/** The rising answer over the cadence cell: while the bass walks DOWN a1 · g1 · f#1 to the
 *  tonic, the lead climbs f#4 · a4 · b4 · c#5 — contrary motion at the cadence, and the
 *  c#5 is the raised sixth handing A′ its first note. */
const ANSWER_A = [
  [8, '-'], [8, 'f#4', 11], [8, 'a4', 12], [6, 'b4', 12], [2, 'c#5', 13],
]

const A = s.section('A', 8)
{
  // Every lane that sounds anywhere in the piece states itself at the loop row (§2.9
  // rule 2): the bass and the kit attack, and the four lanes that are resting say so.
  for (const lane of [L.P1, L.P2, L.V1, L.V2, L.TRI]) A.put(lane, 0, { note: CUT })
  HEAD_A.forEach(([chord, guide], cell) => headCell(A, cell, chord, guide))
  // P1  the lick at the top of the head and again over Gmaj7, where the same seven notes
  // are a different chord: re-harmonisation is the cheapest true variation there is. Over
  // A13 (bars 2–3) the lane is SILENT — the space is the idiom, and it is what gives the
  // stabs and the bass room to be heard as the subject.
  phrase(A, L.P1, LEAD, 0, LICK, SUNG)
  phrase(A, L.P1, LEAD, A.at(4), LICK_G, SUNG)
  phrase(A, L.P1, LEAD_ROUND, A.at(7), ANSWER_A, { ...SUNG, vib: 0, cutAtEnd: false })
  // NOISE / DPCM  the A kit: eighth hats, the kick on 1 and the "and of 2", the DPCM pair
  // carrying the backbeat, and ghosts on the off-sixteenths between them (§9.4). The
  // ghost density thickens across the second four bars.
  for (let bar = 0; bar < 8; bar++) {
    kit(A, bar, {
      hats: '8th', hatOn: 8, hatOff: 6,
      ghosts: bar < 4 ? [6, 20, 30] : [6, 14, 20, 30],
      open: bar === 5 || bar === 6 ? [28] : [],
      crash: bar === 0,
    })
    pair(A, bar, bar % 4 === 3 ? [0, 12, 22] : [0, 12], [8, 24])
  }
  // FILL 2 (bar 3, rows 24–31): a ghost roll that swells into the A13 — four snares at
  // rising volume, no toms, nothing like fill 1.
  for (const r of range(24, 32)) A.lanes[L.NOISE][A.at(3, r)] = null
  ;[[24, 5], [26, 7], [28, 9], [30, 12]].forEach(([r, v]) => A.put(L.NOISE, A.at(3, r), { note: 39, inst: SNARE, vol: v }))
  // FILL 3 (bar 7, rows 16–31): the riser alone for a beat, then an open hat and silence —
  // a fill that gets quieter, so A′ enters into a hole.
  for (const r of range(16, 32)) A.lanes[L.NOISE][A.at(7, r)] = null
  A.put(L.NOISE, A.at(7, 16), { note: 42, inst: RISER, vol: 11 })
  A.put(L.NOISE, A.at(7, 26), { note: 46, inst: OHAT, vol: 7 })
  for (const r of range(20, 32)) A.lanes[L.DPCM][A.at(7, r)] = null
}

// =====================================================================================
// A′ — frames 6–9: the second telling, and the common-tone diminished
// =====================================================================================
/** L inverted, over F#m7: the lick's shape is a third UP then stepwise down, so this is a
 *  third DOWN then stepwise up, closing on the raised sixth. */
const LICK_INV = [
  [12, '-'], [2, 'a4', 12], [2, 'f#4', 12], [4, 'e4', 13], [4, 'f#4', 12],
  [4, 'a4', 12], [4, 'b4', 12], [8, 'c#5', 13], [24, '-'],
]

/** §9.3's COMMON-TONE DIMINISHED, written out. A°7 is A C E♭ F#; the target A7 is
 *  A C# E G. One voice holds the A and the other three all move UP A SEMITONE at once —
 *  C → C#, E♭ → E, F# → G — which is the least-used device on this album and the one that
 *  belongs in a piece built on stabs. The dim7 sits on the PUSH, the sixteenth before the
 *  chord change, so the two chromatic notes (c4 and e♭4) sound for exactly two rows and
 *  each resolves by step in the same direction (§9.3's rule, to the row).
 *
 *  Transposed into G dorian for A″ it is C°7 (C E♭ G♭ A) → C7 (C E G B♭): the held C, and
 *  E♭ → E, G♭ → G, A → B♭. Same device, new key, same two-row budget. */
function commonToneDim(sec, bar, kind) {
  const spec = kind === 'a'
    ? { hold: 'a3', from: ['c4', 'eb4', 'f#3'], to: ['c#4', 'e4', 'g3'] }
    : { hold: 'c4', from: ['eb4', 'gb4', 'a3'], to: ['e4', 'g4', 'bb3'] }
  const push = sec.at(bar, 30) // the sixteenth before the next bar
  const land = sec.at(bar + 1, 0)
  // V1  the common tone, restated rather than tied so a reader can see it does not move.
  sec.put(L.V1, push, { note: n(spec.hold), inst: STAB, vol: 8 })
  sec.put(L.V1, land, { note: n(spec.hold), inst: STAB, vol: 9 })
  // V2 and P2 carry two of the three moving voices; the triangle takes the third, which
  // puts one semitone step in each of three different timbres.
  sec.put(L.V2, push, { note: n(spec.from[0]), inst: STAB, vol: 8 })
  sec.put(L.V2, land, { note: n(spec.to[0]), inst: STAB, vol: 9 })
  sec.put(L.P2, push, { note: n(spec.from[1]), inst: VOICE, vol: 9 })
  sec.put(L.P2, land, { note: n(spec.to[1]), inst: VOICE, vol: 10 })
  sec.put(L.P2, sec.at(bar + 1, 4), { note: CUT })
  sec.put(L.TRI, push, { note: n(spec.from[2]), inst: TRI_SHORT, vol: 15 })
  sec.put(L.TRI, land, { note: n(spec.to[2]), inst: TRI_HOLD, vol: 15 })
  sec.put(L.TRI, sec.at(bar + 1, 6), { note: CUT })
}

const A2 = s.section("A'", 8)
{
  A2.put(L.P2, 0, { note: CUT })
  HEAD_A2.forEach(([chord, guide], cell) => headCell(A2, cell, chord, guide, { hiccup: true, stabVol: 10 }))
  // §9.3 device 1 — the common-tone diminished on the push into the IV chord (6:62 → 7:0).
  commonToneDim(A2, 1, 'a')
  // P1  L′: the same entry and the same peak, then a longer descent and a written fall.
  // The `Rxy` is its own effect-only cell because a note on the same row as `Rxy` does not
  // retrigger — it would bend the note before it instead (§1).
  phrase(A2, L.P1, LEAD, 0, LICK_2, SUNG)
  A2.put(L.P1, 44, { fx: [['R', nib(3, 5)]] })
  // …then silence over the IV, and the lick INVERTED over the ii. Two variations of one
  // eleven-row idea, and the lane is quiet for twenty-four of every thirty-two rows.
  phrase(A2, L.P1, LEAD, A2.at(4), LICK_INV, SUNG)
  phrase(A2, L.P1, LEAD_ROUND, A2.at(7), ANSWER_A, { ...SUNG, vib: 0, cutAtEnd: false })
  // P2  a sparse second voice: two answers in the holes the lick leaves, and the written
  // 4–3 SUSPENSION at the cadence — d4 is Bm7's third, it is held across the change to A7
  // at bar 7 row 16, and it resolves down to c#4 four rows later (§9.2).
  phrase(A2, L.P2, VOICE, A2.at(3, 20), [[6, 'c#4', 10], [6, 'b3', 9], [4, '-']])
  phrase(A2, L.P2, VOICE, A2.at(5, 16), [[6, 'b3', 10], [6, 'a3', 9], [4, '-']])
  phrase(A2, L.P2, VOICE, A2.at(7, 8), [[12, 'd4', 11], [8, 'c#4', 10], [4, '-']])
  // TRI  one extra tenor figure over the ii, so the triangle is a line in A′ and only an
  // answer in A.
  phrase(A2, L.TRI, TRI_SHORT, A2.at(4, 24), [[4, 'c#4'], [4, 'b3'], [4, 'a3'], [4, '-']], { fixedVol: 15 })
  // NOISE / DPCM  the A′ kit: SIXTEENTH hats from beat 3 on (eighths before it), the high
  // snare 41 cracking on beat 4, an extra kick on the push into beat 4, ghosts moved to
  // rows 4 and 26. Four parameters changed, where §9.4 asks for two.
  const A2_HATS = [0, 4, 8, 12, 16, 18, 20, 22, 24, 26, 28, 30]
  for (let bar = 0; bar < 8; bar++) {
    kit(A2, bar, {
      hats: A2_HATS, hatOn: 8, hatOff: 6,
      snares: bar % 2 === 1 ? [24] : [], snareVol: 10, snareNote: 41,
      ghosts: [4, 26], open: bar === 4 ? [30] : [],
      metal: bar % 4 === 2 ? [14] : [],
    })
    pair(A2, bar, [0, 12, 22], [8, 24])
  }
  // FILL 4 (bar 3, rows 30–31): a FLAM and nothing else — two snares a thirty-second
  // apart, the second one pushed two ticks later still by `G02`, so the pair lands wide.
  for (const r of range(28, 32)) A2.lanes[L.NOISE][A2.at(3, r)] = null
  A2.put(L.NOISE, A2.at(3, 30), { note: 39, inst: SNARE, vol: 8 })
  A2.put(L.NOISE, A2.at(3, 31), { note: 41, inst: SNARE, vol: 12, fx: [['G', 2]] })
  // FILL 5 (bar 7, rows 20–31): toms high to low and a metal tick, then air.
  for (const r of range(20, 32)) A2.lanes[L.NOISE][A2.at(7, r)] = null
  A2.put(L.NOISE, A2.at(7, 20), { note: 43, inst: TOM, vol: 11 })
  A2.put(L.NOISE, A2.at(7, 24), { note: 37, inst: TOM, vol: 11 })
  A2.put(L.NOISE, A2.at(7, 28), { note: 44, inst: METAL, vol: 8 })
  for (const r of range(26, 32)) A2.lanes[L.DPCM][A2.at(7, r)] = null
}

// =====================================================================================
// comp — frames 10–13: THE POCKET. One chord per bar, and one lane laid behind the beat
// =====================================================================================
/** `Gxx` is NOT a channel mode: `applyRowEffect` returns the delay and `pendTick`
 *  schedules that cell's trigger, clamped to `ticksThisRow − 1` (so at speed 5 the
 *  ceiling is `G04`). A lane that lays back therefore needs the effect on EVERY cell that
 *  carries a note, and there is nothing to cancel afterwards. Two ticks at speed 5 is
 *  33.3 ms — a quarter of a sixteenth, which is exactly the amount a player drags by.
 *
 *  WHAT IS BEHIND: vrc6p2's comping and the noise ghosts, for all eight bars.
 *  WHAT IS DEAD ON, deliberately: the sawtooth bass, the DPCM kick and snare, the noise
 *  hats, and vrc6p1's held guide tone. The contrast is the device; a whole mix moved back
 *  two ticks is the same mix. */
const DRAG = 2
/** The comping rows: the two sixteenths after each beat, plus the push into the next bar.
 *  Off the beat everywhere, so the drag is heard against the hats rather than against
 *  itself. */
const COMP_ROWS = [2, 6, 14, 18, 22, 30]
/** comp's harmony, ONE CHORD PER BAR — the section whose harmonic rhythm differs (§9.3).
 *  Bars 0–3 are the DESCENDING-THIRDS SEQUENCE E → C# → A → F#, three links falling a
 *  third each, and bar 4 is where it arrives: Bm7, the dominant of the mode. A sequence
 *  that goes somewhere, not a loop that returns to its start. */
const COMP_BARS = ['em', 'csm7b5', 'a13', 'fsm', 'bm', 'em', 'gmaj', 'bm']
/** Pulse 2's line through the whole section (§9.2): its own off-sixteenth rhythm, its own
 *  contour — rising over bars 0, 2 and 4, falling over 1, 3 and 5 — its own breath at bar 5
 *  where pulse 1 finally speaks, and the cadential 4–3 SUSPENSION in bar 7: d4 is Bm7's
 *  third, it is held through the change to A7 on row 16, and it resolves down to c#4. */
const COMP_VOICE = [
  [4, '-'], [6, 'b3', 10], [8, 'd4', 10], [8, 'e4', 11], [6, 'g4', 11],
  [2, '-'], [8, 'g4', 11], [10, 'e4', 10], [8, 'c#4', 10], [4, 'b3', 9],
  [4, '-'], [8, 'c#4', 10], [6, 'e4', 11], [4, 'g4', 11], [10, 'a4', 12],
  [2, '-'], [10, 'a4', 12], [8, 'f#4', 11], [8, 'e4', 10], [4, 'c#4', 10],
  [4, '-'], [8, 'b3', 10], [8, 'd4', 10], [6, 'f#4', 11], [6, 'a4', 11],
  [2, '-'], [6, 'g4', 11], [6, '-'], [8, 'e4', 10], [8, 'd4', 10], [2, 'b3', 9],
  [4, '-'], [8, 'b3', 10], [6, 'd4', 10], [8, 'c#4', 10], [6, 'a3', 9],
  [20, 'd4', 11], [6, 'c#4', 10], [6, 'b3', 9],
]
/** L a fifth up, over Bm7 → Em7 — the same eleven rows, the same shape, a new register.
 *  Its peak (g5) stays under the piece's global peak, which belongs to the last third. */
const LICK_5 = [
  [12, '-'], [2, 'd5', 12], [2, 'f#5', 13], [4, 'g5', 13], [4, 'f#5', 12],
  [4, 'd5', 12], [4, 'b4', 11], [8, 'a4', 11], [24, '-'],
]

const comp = s.section('comp', 8)
{
  // SAW  M in AUGMENTATION: the tresillo broadened to the eighth level, 12+12+8 rows, so
  // the bass states one chord per bar in three notes and leaves the sixteenths to vrc6p2.
  ;[['em_csm', 0], ['a_fsm', 2], ['bm_em', 4], ['g_bm', 6]].forEach(([key, bar]) => {
    shift(comp, bar, M_WIDE[key], { rows: TRESILLO_WIDE })
  })
  // V1  one held guide tone per bar, DEAD ON the downbeat: the reference the drag is heard
  // against. It is written AN OCTAVE BELOW the voicing everywhere else in the piece, because
  // vrc6p2's comp (55–69) and pulse 2's line (57–69) already occupy that octave and three
  // voices in one register is the mud §2.1 warns about — in the section whose whole subject
  // is hearing exactly where an attack sits. Down an octave it is a floor, not a rival.
  // V2  the comp, BEHIND — six scratches a bar at `G02`.
  COMP_BARS.forEach((chord, bar) => {
    const [hi, lo] = GUIDE[chord]
    comp.put(L.V1, comp.at(bar, 0), { note: n(hi) - 12, inst: HOLD, vol: 9 })
    COMP_ROWS.forEach((r, i) => {
      // The comp alternates the chord's two guide tones, so it is a line and not a pedal,
      // and it is ACCENTED on the pushes (rows 6, 22, 30) and ghosted on the sixteenths
      // after the beat: a comping hand has two weights, and the volume column is the only
      // place this machine keeps them.
      const vol = r === 6 || r === 22 || r === 30 ? 11 : 8
      comp.put(L.V2, comp.at(bar, r), { note: n(i % 2 === 0 ? lo : hi), inst: COMP, vol, fx: [['G', DRAG]] })
    })
  })
  comp.put(L.V1, comp.len - 1, { note: CUT })
  comp.put(L.V2, comp.len - 1, { note: CUT })
  // P2  the independent line, all eight bars.
  phrase(comp, L.P2, VOICE, 0, COMP_VOICE, { vib: VIB, vibMin: 10, vibAfter: 6, cutAtEnd: false })
  comp.put(L.P2, comp.len - 1, { note: CUT })
  // P1  two bars out of eight, a fifth above where the lick lives: the lead's whole job in
  // this section is to prove it is a different voice from pulse 2 and then stop.
  comp.put(L.P1, 0, { note: CUT })
  phrase(comp, L.P1, LEAD, comp.at(4), LICK_5, SUNG)
  // TRI  rests for the whole section. Eight lanes make channel economy harder, not easier:
  // the triangle has nothing to add under a bass this exposed, so it says nothing.
  comp.put(L.TRI, 0, { note: CUT })
  // NOISE / DPCM  the leanest kit in the piece: hats on the OFF-eighths only, the kick
  // moved to the push into beat 3 (row 14), a metal tick every other bar, and the ghosts
  // dragged with the comp.
  for (let bar = 0; bar < 8; bar++) {
    kit(comp, bar, {
      // Bars 4–5 are the only two where pulse 1 speaks, and the hat opens into sixteenths
      // across their back half to meet it. It is the one change the kit makes INSIDE the
      // section, and it is what stops four frames of constant density from being four
      // identical frames — the rest of the variation here is pitch and placement.
      hats: bar === 4 || bar === 5 ? [4, 12, 18, 20, 22, 26, 28, 30] : 'offbeat',
      hatOn: 6, hatOff: 6,
      ghosts: bar % 2 === 0 ? [10, 26] : [6, 18, 30], ghostVol: 5, ghostDelay: DRAG,
      open: bar === 5 ? [28] : [], openVol: 7,
      metal: bar % 2 === 1 ? [22] : [],
    })
    pair(comp, bar, [0, 14], [8, 24])
  }
  // FILL 6 (bar 7, rows 16–31): the kit STOPS. One open hat on beat 3 and then a whole
  // half-bar of nothing — a fill that is a hole, which is the one kind this idiom has that
  // the rest of the album does not.
  for (const r of range(16, 32)) comp.lanes[L.NOISE][comp.at(7, r)] = null
  for (const r of range(16, 32)) comp.lanes[L.DPCM][comp.at(7, r)] = null
  comp.put(L.NOISE, comp.at(7, 16), { note: 46, inst: OHAT, vol: 8 })
}

// =====================================================================================
// graveyard — frames 14–16: six rows against eight, and the pivot arriving
// =====================================================================================
const grave = s.section('graveyard', 6)
{
  // V1  THE SIX-ROW CELL (§9.1 recipe D, and the phase-carry table in this file's header).
  // Unbroken from section row 0 to row 180 — thirty-one ticks every three sixteenths
  // against a beat of four, so it enters each frame two rows later than the last: 14:0,
  // 15:2, 16:4, and the cycle would close on 17:0. Restarting it at a frame line would
  // throw the carry away, which is the whole point of writing it straight through.
  // Its pitch steps down with the harmony — b3 · a3 · f#3 · e3 — so the cell is a line as
  // well as a clock.
  const CLOCK = [[0, 'b3'], [64, 'a3'], [128, 'f#3'], [160, 'e3']]
  for (let row = 0; row <= 180; row += 6) {
    const note = CLOCK.filter(([at]) => at <= row).at(-1)[1]
    grave.put(L.V1, row, { note: n(note), inst: TICK, vol: 7 })
  }
  // SAW  the bass in further augmentation: two half notes a bar, root then fifth. Em7 for
  // two bars, Dmaj7 (♭VII) for two, then Bm7 and the borrowed iv — the harmony walks down
  // e · d · b · a while the cell above it refuses to agree with the bar.
  const ROOTS = [['e1', 'b1'], ['e1', 'g1'], ['d2', 'a1'], ['d2', 'f#1'], ['b1', 'f#2'], ['a1', 'e2']]
  ROOTS.forEach(([a, b], bar) => {
    grave.put(L.SAW, grave.at(bar, 0), { note: n(a), inst: SAW_THUMB, vol: 11 })
    grave.put(L.SAW, grave.at(bar, 16), { note: n(b), inst: SAW_THUMB, vol: 10 })
  })
  // P2  one sigh over the ♭VII, and nothing else.
  grave.put(L.P2, 0, { note: CUT })
  phrase(grave, L.P2, VOICE, grave.at(3, 8), [[12, 'f#4', 9], [8, 'e4', 8], [4, '-']])
  // TRI  silent until the pivot is in sight: it enters at bar 4 with the tenor line that
  // walks b3 → c4, and that c-natural is the borrowed iv arriving. It is a CHORD TONE of
  // Am7, not a passing chromatic, so it is held (declared in qa.notes).
  grave.put(L.TRI, 0, { note: CUT })
  grave.put(L.TRI, grave.at(4, 0), { note: n('b3'), inst: TRI_HOLD, vol: 15 })
  // …and the note does not restrike into the iv, it GLIDES: `Q11` slides the held b3 up one
  // semitone to c4 over about a row, so the borrowed iv arrives by the smallest move the
  // hardware has. `Qxy` clears the arpeggio, slide and portamento modes and latches none of
  // its own, unlike `3xx`, which `300` only freezes (§12.5).
  grave.put(L.TRI, grave.at(4, 28), { fx: [['Q', nib(1, 1)]] })
  grave.put(L.TRI, grave.at(5, 20), { note: CUT })
  // P1 / V2  rest for the whole section — four lanes of the eight are silent here, which is
  // what makes the lift loud without anything getting louder.
  grave.put(L.P1, 0, { note: CUT })
  grave.put(L.V2, 0, { note: CUT })
  // NOISE  the brush on the beat: a closed hat with a tail, the quietest timekeeping in the
  // piece. Bars 4–5 add the off-eighths as the section starts to move again.
  for (let bar = 0; bar < 6; bar++) {
    kit(grave, bar, {
      hats: bar < 4 ? 'beat' : '8th', hatOn: 8, hatOff: 6, hatInst: BRUSH,
      open: bar === 2 ? [0] : [], ghosts: bar === 5 ? [12, 20] : [], ghostVol: 5,
    })
    pair(grave, bar, bar < 4 ? [0, 16] : [0, 12], bar < 4 ? [] : [8, 24])
  }
  // FILL 7 (bar 3, rows 26–31): two brushes and a low tom — the quietest fill of the nine.
  grave.put(L.NOISE, grave.at(3, 26), { note: 45, inst: BRUSH, vol: 6 })
  grave.put(L.NOISE, grave.at(3, 30), { note: 37, inst: TOM, vol: 9 })
  // THE METRIC SURPRISE (§9.1 recipe H, §9.4's one-per-piece): `D00` at 16:55 ends the
  // frame after row 55, so graveyard's last bar is THREE beats and the lift arrives an
  // beat early. Rows 56–63 of frame 16 are silent by construction and no playthrough
  // reaches them. Placed at the seam into the modulation, and never at the loop seam.
  grave.put(L.DPCM, grave.at(5, 23), { fx: [['D', 0]] })
}

// clean-up: rows 56–63 of frame 16 are past the `D00` and no playthrough reaches them, so
// nothing is written there. Anything the per-bar helpers put in bar 5's last eight rows is
// removed, which keeps the document honest about what it actually plays.
for (let lane = 0; lane < 8; lane++) {
  for (let r = grave.at(5, 24); r < grave.len; r++) grave.lanes[lane][r] = null
}

// =====================================================================================
// lift — frames 17–18: the pivot, and the tune changes instrument
// =====================================================================================
/** M re-orchestrated onto the TRIANGLE, which has no volume column at all: the ghosts of
 *  the sawtooth version become pure rhythm and register, which is the only dynamic the lane
 *  has (§1). Bar 0's first half-bar is left out of the cell — that is where the pivot chord
 *  stands bare. */
const M_TRI_AM = [null, null, null, ['a1', 15], ['e2', 15], ['c2', 15],
  ['a1', 15], ['a2', 15], null, ['e2', 15], null, ['e2', 15]]
const M_TRI_D7 = [['d2', 15], ['d2', 15], ['f#2', 15], ['d2', 15], ['c3', 15], ['a2', 15],
  ['d2', 15], ['d3', 15], null, ['a2', 15], null, ['c3', 15]]
/** The SECOND LEAD COLOUR: the tune on the sawtooth, in the tenor (MIDI 52–64) — an octave
 *  and a half above the register it has occupied for sixteen frames, on the bend-in
 *  instrument, while the triangle takes the bass underneath it. A different lane, a
 *  different register and a different timbre, all at once (shared sheet §5.2). */
const LIFT_TUNE = [
  [6, 'c4', 11], [6, 'e4', 12], [4, 'd4', 11],
  [8, 'c4', 12], [8, 'a3', 11], [8, 'g3', 11], [8, 'e3', 11],
  [6, 'f#3', 12], [6, 'a3', 11], [4, 'c4', 11], [8, 'd4', 13], [8, 'c4', 11],
  [8, 'a3', 12], [8, 'f#3', 11], [8, 'd4', 12], [8, 'c4', 11],
]

const lift = s.section('lift', 4)
{
  // §9.3 device 2, the TRUE PIVOT MODULATION BY A THIRD. Am7 arrived at 16:32 as the
  // borrowed iv of E — the bright A13 of the head gone minor. Here it is STATED BARE, two
  // pitched voices and nothing else: the triangle's a1 and vrc6p1's g3, root and seventh.
  // From this row it is heard as ii of G, D7 confirms the new key at 18:0, and A″ lands a
  // MINOR THIRD UP in G dorian. Two pieces on this album already lift a last chorus by a
  // whole tone; this one does not.
  lift.put(L.TRI, 0, { note: n('a1'), inst: TRI_HOLD, vol: 15 })
  lift.put(L.TRI, lift.at(0, 14), { note: CUT })
  lift.put(L.V1, 0, { note: n('g3'), inst: HOLD, vol: 8 })
  lift.put(L.V1, lift.at(0, 14), { note: CUT })
  for (const lane of [L.P1, L.P2, L.V2]) lift.put(lane, 0, { note: CUT })
  // TRI  then the bass, with M's rhythm.
  shift(lift, 0, M_TRI_AM, { lane: L.TRI, inst: TRI_SHORT, ghost: TRI_SHORT })
  shift(lift, 2, M_TRI_D7, { lane: L.TRI, inst: TRI_SHORT, ghost: TRI_SHORT })
  // SAW  the tune. It enters half a bar after the pivot so the bare chord is heard first.
  phrase(lift, L.SAW, SAW_LEAD, lift.at(0, 16), LIFT_TUNE, { cutAtEnd: false })
  // V1 / V2  the chords as stabs once the bare statement has done its work: Am7 through
  // bar 1, then D7 — and a written `A0y` SWELL on the last one, which is how a horn enters
  // (`Axy` is inverted: `A0y` swells, `Ax0` fades, `A00` cancels).
  for (const [bar, chord, rows] of [[1, 'am', [14, 30]], [2, 'd7', [14, 30]], [3, 'd7', [6, 22]]]) {
    const [hi, lo] = GUIDE[chord]
    for (const r of rows) stab(lift, bar, r, hi, lo, { vol: 10 })
  }
  lift.put(L.V1, lift.at(3, 22), { note: n('c4'), inst: HOLD, vol: 4, fx: [['A', nib(0, 5)]] })
  lift.put(L.V1, lift.at(3, 30), { fx: [['A', 0]] }) // A00 — the one cancel `Axy` answers to
  // NOISE / DPCM  the build: a brush alone under the bare chord, eighths, then sixteenths.
  kit(lift, 0, { hats: [0, 16, 24], hatOn: 8, hatOff: 7, hatInst: BRUSH })
  kit(lift, 1, { hats: '8th', hatOn: 7, hatOff: 5, ghosts: [20, 30], ghostVol: 5 })
  kit(lift, 2, { hats: '16th', hatOn: 7, hatOff: 4, ghosts: [6, 22], ghostVol: 5, snares: [24], snareVol: 10, snareNote: 41 })
  kit(lift, 3, { hats: '16th', hatOn: 7, hatOff: 4 })
  pair(lift, 0, [0])
  for (const bar of [1, 2, 3]) pair(lift, bar, [0, 12], [8, 24])
  // FILL 8 (bar 3, rows 20–31): the piece's only snare roll, and the loudest thing in it —
  // it exists to make the modulation arrive rather than merely occur.
  for (const r of range(20, 32)) lift.lanes[L.NOISE][lift.at(3, r)] = null
  ;[[20, 5], [22, 7], [24, 8], [26, 10], [28, 12]].forEach(([r, v]) => lift.put(L.NOISE, lift.at(3, r), { note: 39, inst: SNARE, vol: v }))
  lift.put(L.NOISE, lift.at(3, 30), { note: 41, inst: SNARE, vol: 13 })
}

// =====================================================================================
// A″ — frames 19–21: the head a minor third up, in G dorian
// =====================================================================================
/** vrc6p1 doubling the tune AT PITCH: the two chips take the same timer at unison
 *  (f = fCPU / 16·(t+1) on both), so the pair locks instead of beating, and the lead is
 *  thickened rather than harmonised — §2.1's fourth sanctioned break, for six bars. */
const DOUBLE = s.instrument('double', {
  volume: { values: [10, 12, 12, 11, 11, 10], loop: 5 },
  duty: { values: [7, 5, 3], loop: 2 },
})
/** L a minor third up, in G dorian: the same eleven rows, note for note. */
const LICK_G3 = LICK.map(([len, note, vol]) => [len, note === '-' || note === '~' ? note : n(note) + 3, vol])
/** The climb to the piece's GLOBAL PEAK and the appoggiatura that is its top note: b♭5 is
 *  attacked on beat 1 of A″'s last bar over Dm7, where it is not a chord tone, and resolves
 *  down by step to a5. In the last third of the piece, on a strong beat, once. */
const PEAK = [
  [8, 'd5', 12], [8, 'f5', 12], [8, 'g5', 13], [8, 'a5', 13],
  [4, 'bb5', 14], [4, 'a5', 13], [8, 'g5', 13], [8, 'f5', 12], [8, 'd5', 12],
]

const A3 = s.section("A''", 6)
{
  // SAW  M transposed into G dorian, cell for cell: Gm9 · C7 · B♭maj7 → Dm7.
  shift(A3, 0, M.gm)
  shift(A3, 2, M.c7)
  shift(A3, 4, M.bbcad)
  // P1  the tune, then the climb and the peak. Bars 2–3 are silent: even the loudest
  // section of this piece leaves the lead out for a quarter of it.
  phrase(A3, L.P1, LEAD, 0, LICK_G3, SUNG)
  phrase(A3, L.P1, LEAD, A3.at(4), PEAK, { ...SUNG, cutAtEnd: false })
  // V1  doubles every note of the tune at pitch. Written from the lead's own cells so the
  // two can never drift apart, and skipped wherever the lead is resting.
  for (let r = 0; r < A3.len; r++) {
    const src = A3.lanes[L.P1][r]
    if (src === null || src.note === undefined) continue
    // the lead's CUTS are copied too, or the double would hold through every rest the
    // tune takes — and the rests are half of what the tune is
    if (src.note === CUT) A3.put(L.V1, r, { note: CUT })
    else if (src.note >= 0) A3.put(L.V1, r, { note: src.note, inst: DOUBLE, vol: 9 })
  }
  // §9.3 device 1 again, transposed: C°7 → C7, the held c4 with e♭4 → e4, g♭4 → g4 and
  // a3 → b♭3. It overwrites the double's cells at 19:62 and 20:0, where the lead is silent.
  commonToneDim(A3, 1, 'c')
  // V2  the horn stabs, one tick late (`G01`) against a dead-on kick: a section that is
  // almost together, which is a different use of the delay from comp's structural drag and
  // is decorative on purpose.
  for (const [bar, chord, rows] of [[0, 'gm', [14, 30]], [1, 'gm', [22]], [2, 'c7', [14, 30]],
    [3, 'c7', [6, 22]], [4, 'bbmaj', [14, 30]], [5, 'dm', [6, 22]]]) {
    const [, lo] = GUIDE[chord]
    for (const r of rows) A3.put(L.V2, A3.at(bar, r), { note: n(lo), inst: STAB, vol: 11, fx: [['G', 1]] })
  }
  // TRI  the backbeat chank: the chord's fifth, short, in the tenor, on beats 2 and 4 —
  // exactly where the DPCM snare fires, so the shared TND index DUCKS it on every hit and
  // the lane pumps instead of sustaining (§2.8).
  const CHANK = ['d4', 'd4', 'g3', 'g3', 'f3', 'a3']
  A3.put(L.TRI, 0, { note: CUT })
  CHANK.forEach((note, bar) => {
    for (const r of [8, 24]) A3.put(L.TRI, A3.at(bar, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  })
  // P2  rests through A″ except for the diminished chord's own semitone — the lane that
  // owned comp is deliberately absent from the climax.
  A3.put(L.P2, 0, { note: CUT })
  // NOISE / DPCM  the fullest kit in the piece: sixteenth hats, the high snare layered on
  // the backbeat, ghosts on four off-sixteenths, the kick on 1, the "and of 2" and the push
  // into beat 4.
  for (let bar = 0; bar < 6; bar++) {
    kit(A3, bar, {
      hats: '16th', hatOn: 9, hatOff: 6,
      snares: [8, 24], snareVol: 12, snareNote: 41,
      ghosts: [6, 14, 20, 30], ghostVol: 5,
      open: bar % 2 === 1 ? [28] : [], crash: bar === 0,
    })
    pair(A3, bar, [0, 12, 22], [8, 24])
  }
  // FILL 9 (bar 5, rows 24–31): the last fill — a tom pair under the resolving peak, then
  // a crash-free handover, because the turn has to get quieter, not louder.
  for (const r of range(24, 32)) A3.lanes[L.NOISE][A3.at(5, r)] = null
  A3.put(L.NOISE, A3.at(5, 24), { note: 43, inst: TOM, vol: 11 })
  A3.put(L.NOISE, A3.at(5, 27), { note: 37, inst: TOM, vol: 10 })
  A3.put(L.NOISE, A3.at(5, 30), { note: 39, inst: SNARE, vol: 7 })
}

// =====================================================================================
// turn — frames 22–23: G leaves by the door it came in, and the seam is hidden
// =====================================================================================
/** The turnaround is the pivot run backwards. Gm7 is still the new tonic; Am7 is ii of G
 *  one last time; then D7 — which is V of G, and is ALSO ♭VII7 of E. The loop lands on
 *  Em, so the seam is heard as D7 → Em, a cadence and not a restart. Nothing big happens
 *  here: no fill, no crash, three lanes gone by the last bar. */
const TURN_TAIL = [
  [8, 'd5', 12], [8, 'c5', 12], [8, 'bb4', 11], [8, 'a4', 11],
  [8, 'c5', 11], [8, 'a4', 11], [8, 'g4', 11], [8, 'e4', 11],
]

const turn = s.section('turn', 4)
{
  // P1  the tune's last eight notes, stepping out of G and into E: the b♭ of bar 0 is the
  // last note that belongs only to G dorian, and by bar 1 every pitch is shared by both
  // keys. Then the lead stops, two bars before the loop.
  phrase(turn, L.P1, LEAD_ROUND, 0, TURN_TAIL, { volShift: 1 })
  // SAW  half notes under bars 0–1, then M's rhythm one last time over the D7, then a
  // held d2 that the loop row restrikes as e1 (§2.9 rule 4).
  ;[['g1', 'd2'], ['a1', 'e2']].forEach(([a, b], bar) => {
    turn.put(L.SAW, turn.at(bar, 0), { note: n(a), inst: SAW_THUMB, vol: 12 })
    turn.put(L.SAW, turn.at(bar, 16), { note: n(b), inst: SAW_THUMB, vol: 11 })
  })
  shift(turn, 2, [['d2', 12], ['d2', 7], ['f#2', 11], ['d2', 11], ['c3', 10], ['a2', 9],
    ['d2', 12], null, null, ['a1', 11], null, null])
  // TRI  the chank for two bars, then out.
  turn.put(L.TRI, 0, { note: CUT })
  for (const [bar, note] of [[0, 'd4'], [1, 'c4'], [2, 'a3']]) {
    for (const r of [8, 24]) turn.put(L.TRI, turn.at(bar, r), { note: n(note), inst: TRI_SHORT, vol: 15 })
  }
  // V1 / V2  one stab a bar, and both lanes are cut before the last half-bar so nothing is
  // ringing at the seam.
  turn.put(L.P2, 0, { note: CUT })
  for (const [bar, chord, rows] of [[0, 'gm', [14]], [1, 'am', [14]], [2, 'd7', [14, 30]], [3, 'd7', [6]]]) {
    const [hi, lo] = GUIDE[chord]
    for (const r of rows) stab(turn, bar, r, hi, lo, { vol: 10 })
  }
  turn.put(L.V1, turn.at(3, 16), { note: CUT })
  turn.put(L.V2, turn.at(3, 16), { note: CUT })
  turn.put(L.TRI, turn.at(3, 0), { note: CUT })
  // NOISE / DPCM  the kit thins bar by bar and stops early: NO FILL AT THE LOOP SEAM
  // (§2.9, §9.4). The last eight rows of the piece carry nothing but the sawtooth's held
  // d2 and the `Bxx`, so pass 2's first downbeat is the loudest thing either side of it.
  kit(turn, 0, { hats: '8th', hatOn: 7, hatOff: 5, ghosts: [6, 20, 30], ghostVol: 5 })
  kit(turn, 1, { hats: '8th', hatOn: 7, hatOff: 5, ghosts: [20], ghostVol: 5 })
  kit(turn, 2, { hats: 'beat', hatOn: 7, hatInst: BRUSH, ghosts: [30], ghostVol: 4 })
  kit(turn, 3, { hats: [0, 8, 16, 24], hatOn: 6, hatOff: 6, hatInst: BRUSH })
  pair(turn, 0, [0, 12], [8, 24])
  pair(turn, 1, [0, 12], [8, 24])
  pair(turn, 2, [0], [8])
  pair(turn, 3, [0])
}

// =====================================================================================
// form, declarations, and the file
// =====================================================================================
s.order(['clock-in', 'A', "A'", 'comp', 'graveyard', 'lift', "A''", 'turn'])
s.loopTo('A')
s.qa({
  key: 'e-dorian',
  accidentalFractionMax: 0.15,
  bpmRange: [89, 91],
  durationSec: [124, 132],
  rmsRange: [-26, -19],
  percussionGap: 16,
  motif: {
    channel: 'vrc6saw',
    patterns: [1, 2, 6, 10, 17, 19],
    variation: 'augmented to the 8th level in comp, re-orchestrated onto the triangle in lift, transposed a minor third up in A″',
  },
  notes:
    'E dorian, 90.000 BPM on THIRTY-SECOND rows (speed 5, rowHighlight 8), so a bar is 32 ' +
    'rows and an order frame is TWO bars. The subject is the pocket. Devices, at frame:row. ' +
    '(1) Gxx USED STRUCTURALLY: vrc6p2 comps and the noise ghosts sit two ticks (33.3 ms) ' +
    'behind the beat for the whole of comp - 48 G02 cells on vrc6p2 from 10:2 to 13:62 and ' +
    '18 on the noise ghosts - while the sawtooth bass, the DPCM kick and snare, the hats and ' +
    "vrc6p1's held guide tone stay DEAD ON. Gxx is not a channel mode (applyRowEffect " +
    'returns the delay and pendTick schedules that cell, clamped to ticksThisRow-1, so G04 ' +
    'is the ceiling at speed 5): every note-carrying cell carries its own and there is ' +
    'nothing to cancel. The comp instrument is two ticks longer than the dead-on stab ' +
    "because Gxx delays macro index 0 too. A''s G01 on the horn stabs (11 cells from 19:14) " +
    'is a decorative strum, a different amount of lateness on purpose, and the one remaining ' +
    'G02, at 7:63, is a flam: the second of two snares a thirty-second apart. ' +
    '(2) 16TH-LEVEL TRESILLO on the sawtooth, 3+3+2 sixteenths = 6+6+4 rows, attacks at rows ' +
    '0, 6, 12 and 16, 22, 28 of every bar, from 1:0 to 23:0, with the kit square above it; ' +
    'broadened to the 8th level (12+12+8 rows) through comp. ' +
    '(3) A SIX-ROW CELL on vrc6p1 through graveyard, unbroken from 14:0 to 16:52. Computed ' +
    'for a 64-row frame, not read off 9.1s 64/4 table: entry row of frame k is (-64k) mod 6 ' +
    '= 0, 2, 4 and the cycle closes after lcm(6,64)/64 = 3 frames. Verified in the file: ' +
    'first attacks 14:0, 15:2, 16:4. ' +
    '(4) THE ONE METRIC SURPRISE: D00 at 16:55 ends that frame after row 55, so graveyards ' +
    'last bar is three beats and the lift arrives a whole beat early (a beat is eight rows ' +
    'here). Frame 16 rows 56-63 are ' +
    'empty on all eight lanes and no playthrough reaches them. Not at the loop seam. ' +
    'Harmony (9.3), two distinct devices in different sections. COMMON-TONE DIMINISHED: ' +
    'A07 (a c eb f#) -> A7 (a c# e g) at 6:62 -> 7:0, vrc6p1 holding a3 stationary while ' +
    'vrc6p2 c4->c#4, pulse2 eb4->e4 and the triangle f#3->g3 all rise a semitone; restated ' +
    'transposed as C07 -> C7 at 19:62 -> 20:0 (c4 held; eb4->e4, gb4->g4, a3->bb3). ' +
    'TRUE PIVOT MODULATION BY A MINOR THIRD: Am7 arrives as the borrowed iv of E at 16:32, ' +
    'stands bare on two pitched voices at 17:0 (triangle a1 + vrc6p1 g3) where it turns into ' +
    'ii of G, D7 confirms at 18:0, and G dorian lands at 19:0 - not the whole tone two other ' +
    'album pieces already use. Sequence: descending THIRDS E -> C# -> A -> F#, three links at ' +
    '10:0, 10:32, 11:0, 11:32, arriving on Bm7 at 12:0 (descending fifths appear twice ' +
    'already). comp is the section whose harmonic rhythm differs: one chord per bar against ' +
    "A's one per two. Written suspensions: 4-3 at 13:32 resolving 13:52, and 4-3 at 9:40 " +
    'resolving 9:52. Appoggiatura and global peak: bb5 attacked on beat 1 of 21:32 over Dm7, ' +
    'where it is not a chord tone, resolving down by step to a5 - one occurrence, in the last ' +
    'third. SECOND LEAD COLOUR (mandatory): the tune leaves pulse 1 at 17:16 for the ' +
    'SAWTOOTH in the tenor, MIDI 52-64, an octave and a half above the register it has ' +
    'occupied for sixteen frames, on a bend-in instrument, while the TRIANGLE takes the bass ' +
    "and M's rhythm with it; pulse 1 is silent for the whole of lift. In A'' vrc6p1 doubles " +
    'the tune AT PITCH for six bars (2.1s fourth sanctioned break) - a unison thickening, ' +
    'not a second lead, and the two chips take the same timer at unison so the pair locks. ' +
    'Params are DECIMAL: 4xy vibrato 432 = 50 (written a beat after the note it colours); ' +
    'Qxy note-slide 82 = 130 on the bass (x is the speed, 2x+1 period units a tick, y the ' +
    'semitones) and 11 = 17 on the triangle glide into the borrowed iv at 16:28; Rxy 35 = 53 ' +
    'for the falls; A05 = 5 is the horn swell at 18:54 and A00 = 0 cancels it at 18:62. ' +
    'DECLARED BOUNDS. accidentalFractionMax 0.15: measured 12.09% (67 of 554 melodic notes). ' +
    'The bulk is the G-dorian sections (19-21 and 22:0) plus the borrowed Am7 and the ' +
    'confirming D7 - every one of those notes is a CHORD TONE of a named chord, which is ' +
    'modal interchange rather than melodic chromaticism. The only true passing chromatics are ' +
    "the diminished chords' two semitones, and each sounds for exactly two rows and resolves " +
    "by step in the same direction, to the row. DEVIATION DECLARED: 9.3's 'no chromatic note " +
    "held longer than two rows' is a rule about melodic chromaticism; the c-naturals of the " +
    'borrowed iv and of D7 are harmony and are held as harmony. percussionGap 16: the longest ' +
    'noise gap is 15 rows (1.25 s), at 17:0-17:16, where the pivot chord stands bare under a ' +
    'single brush; coverage at that bound is 100.00%. rmsRange [-26, -19]: measured -24.06 ' +
    'dBFS whole-file, peak 0.697, zero clamped samples. The piece is deliberately the most ' +
    'spacious groove on the album - a bar can be one note and a rest - and the level is an ' +
    'ARC rather than a setting: clock-in -32.1, A -25.2, comp -24.6, graveyard -26.4, lift ' +
    "-21.2, A'' -21.7, turn -24.4 dBFS, measured per section on the two-pass preview; the " +
    'zero-crossing rate moves with it, 2713/s in graveyard against 5379/s in A\'\', so the ' +
    'piece changes colour as well as level. Density ' +
    'is 24.9 note attacks a bar across all eight lanes, p90 35, max 43. DEVIATION DECLARED: ' +
    "9.4's 'fill in the last 8 rows of each 8-bar unit' was written for 16-row bars; a bar " +
    'here is 32 rows, so the nine fills occupy the last 16 rows - the same musical length - ' +
    'and none of them is at the loop seam, where the kit thins to a brush on the beat and the ' +
    'last eight rows of the piece carry nothing but the held d2 and the Bxx.',
  renderChecksum: 432685576,
})
s.check()
s.write('src/assets/songs/11-night-shift.json')
