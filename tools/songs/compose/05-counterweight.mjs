#!/usr/bin/env node
/** 05 — Counterweight. The boss theme: a fight against something larger.
 *
 *      node tools/songs/compose/05-counterweight.mjs   ->  src/assets/songs/05-counterweight.json
 *
 *  Eight voices, D phrygian, 150 BPM on a 32nd-note grid (speed 3, 8 rows a beat, 32 a
 *  bar, 64 a frame = two bars = 3.2 s). One pass is 87 bars, about 2:19; the loop
 *  returns to frame 2. Every note here is invented from the contour and harmony rules
 *  of preset-suite §2.10 / §9.3.
 *
 *  THE PLAN (frames x sections x seconds)
 *
 *    frames  section   bars  s      what happens
 *    0-1     alarm     4     6.4    a two-note saw stab against silence, DPCM kick
 *                                   doubling it, a long crash; bar 3 the kit arrives;
 *                                   bar 4 the riff's head in unison on six lanes
 *    2-9     riff A    16    25.6   ANVIL, the riff: saw + triangle in octaves, VRC6
 *                                   fifths a 32nd late; the lead answers in the tails,
 *                                   pulse 2 answers the lead a fourth below; closes on
 *                                   a phrygian cadence (Eb -> D, contrary motion)
 *    10-17   B         16-1  24.0   D minor. The lead sings over a tonic pedal on the
 *                                   saw and a walking triangle; pulse 2 is a counter-
 *                                   voice for the whole section; the harmony is a
 *                                   descending-fifths chain Dm-Gm-C-F-Bb; a Neapolitan
 *                                   close Eb -> A7 -> Dm. The second phrase is SEVEN
 *                                   bars: D00 drops the last bar (the metric surprise)
 *    18-21   riff A'   8     12.8   re-orchestrated: VRC6 pulse 1 takes the riff an
 *                                   octave up, the saw drops to a root pedal in 8ths,
 *                                   the 2A03 pulses take the fifth stabs, hats double
 *    22-27   bridge    12    19.2   half time. Saw alone on D1 in a tresillo with the
 *                                   DPCM kick; toms on a six-row cell (3:4, the phase
 *                                   carried across all six frames); VRC6 pulse 2 climbs
 *                                   chromatically D3 -> C4 and lands on the new
 *                                   dominant; the lead states the head in quarters
 *    28-35   phase 2   16    25.6   F minor, a minor third up. The riff INVERTED on saw
 *                                   + VRC6 pulse 2, the lead an octave up, snare rolls
 *                                   every two bars; the global peak (Db6, 35:0) at bar 13
 *    36-41   riff A''  12    19.2   D phrygian, everything on; the lead's phrases
 *                                   restated a 16th late; the last three bars are a
 *                                   hemiola (accents every 12 rows) on the VRC6 pulses
 *    42-43   turn      4     6.4    the alarm again, then Bxx -> 2
 *
 *  MOTIF. ANVIL is a two-bar cell: a gallop on the root, up a minor third, the
 *  phrygian second falling back, the flat seventh, a chromatic approach into the
 *  next downbeat; the second bar leaps to the fifth and steps down through the b2 to
 *  the b6, then climbs chromatically home. It is heard on the saw (riff A, A''), on
 *  VRC6 pulse 1 an octave up (A'), inverted and in F minor (phase 2), augmented in
 *  the lead (the tails of riff A; the bridge) and in unison as the alarm's last bar.
 *
 *  DEVICES (§9.1)  tom cell of 6 rows through the bridge (entry rows 0,2,4 — frames
 *  22:0, 23:2, 24:4, re-aligned at 25:0, again 26:2, 27:4); tresillo kick 22:0, 22:12,
 *  22:24; hemiola stabs 40:32 .. 41:52 closing on 42:0; the dropped bar, D00 at 17:31;
 *  fifth stabs displaced a 32nd (2:5); the lead's tail phrase displaced +2 rows (37:2).
 *
 *  HARMONY (§9.3)  Neapolitan bII -> V7 -> i (16:32 Eb -> 17:0 A7 -> 18:0 Dm);
 *  descending fifths Dm Gm C F Bb twice (10:32-12:32, 14:0-16:0); a chromatic inner
 *  ascent D3 -> C4 on VRC6 pulse 2 across the bridge (22:0 -> 27:0); C as pivot — bVII
 *  of D phrygian, V of F minor (27:0 -> 28:0); Eb as the pivot back (35:32).
 *  Contrary-motion cadences, the bass falling as the lead rises: 9:32-9:48 and
 *  35:32-36:0, both saw Eb2 -> D2 under a rising Bb4 C5 D5.
 *
 *  HEADROOM AND THE ARC  The whole mix is built to one shape, measured two-pass:
 *  alarm -23.7, turn -22.4, bridge -21.2, riff A -20.4, riff A'' -19.8, riff A' -19.6,
 *  B -19.5, phase 2 -19.4 dBFS — and phase 2 is also the brightest section by a wide
 *  margin (zero-crossing rate 4457 against 3739-4078), which is what makes the second
 *  phase read as the fight getting harder rather than merely continuing. B is the
 *  breath between riff statements, so its lead sits at 11-12 and its kit at 13; the
 *  riff's lead is 14. Saw 11-12 on the riff, 13 only on the alarm stab, 6-10 as a
 *  pedal; VRC6 pulses 6-11, never above the 2A03 lead; one VRC6 pulse rests whenever
 *  the lead plays over the riff. Result: peak 0.902, zero clamped samples at gain 2.0.
 */
import { CUT, L, REL, Song, hex, n, nib } from './lib.mjs'

const s = new Song({
  id: 'counterweight',
  name: 'Counterweight',
  author: 'pulsar album',
  speed: 3,
  rowsPerPattern: 64,
  rowHighlight: 8,
  rowHighlight2: 32,
})

/** Grid: 32 rows a bar, 8 a beat, 4 an eighth, 2 a sixteenth, 1 a thirty-second. */
const BAR = 32

// --- instruments -------------------------------------------------------------------

/** The riff's articulation on every lane that plays it: full for eight ticks (a 16th
 *  and a bit), then settling to about half — an 8th-note "chug" that breathes without
 *  a cut, while 16ths stay full. The scoop is a pitch macro in each lane's own period
 *  units (a semitone is ~100 units on the saw at D2, ~22 on the triangle at D3, ~44 on
 *  a VRC6 pulse at D3): about 40 cents flat on the trigger tick, in tune by tick 2.
 *
 *  Declared FIRST on purpose: the instrument table keeps declaration order, so
 *  instrument 0 is the voice this piece opens and closes on — the saw carrying the
 *  riff — rather than a shared-bank drum that every album piece also carries. */
const CHUG = { values: [15, 15, 15, 15, 15, 15, 15, 15, 13, 11, 10, 9], loop: 11 }
const SAW_RIFF = s.instrument('saw-riff', { volume: CHUG, pitch: [40, -20, -20, 0] })

// Shared-bank drums and the triangle gate, byte-identical to the fixture.
const [KICK, SNARE, HAT, HAT_OPEN, BASS] = s.bank('kick', 'snare', 'hat-closed', 'hat-open', 'bass')
const KIT = s.dpcmKit()

const SAW_PLAIN = s.instrument('saw-plain', { volume: CHUG })
/** The alarm stab: eight rows of decay, one scoop. */
const SAW_STAB = s.instrument('saw-stab', {
  volume: [15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  pitch: [40, -20, -20, 0],
})
/** A held pedal with the brass-like slow bend up into the note (§12.2). */
const SAW_PEDAL = s.instrument('saw-pedal', {
  volume: { values: [12, 14, 15], loop: 2 },
  pitch: [120, -24, -24, -24, -24, -24, 0],
})
const TRI_RIFF = s.instrument('tri-riff', { volume: { values: [15], loop: 0 }, pitch: [9, -4, -5, 0] })
/** Detached triangle: nine ticks on for pedal 8ths, fifteen for walking quarters. The
 *  triangle has no level (§1), so its dynamics are register and GATE LENGTH — fifteen
 *  ticks of a twenty-four-tick quarter leaves a real gap between steps, which is what
 *  keeps a walking bass a line rather than a wall under the B section's singing lead. */
const TRI_8TH = s.instrument('tri-8th', { volume: [15, 15, 15, 15, 15, 15, 15, 15, 15, 0] })
const TRI_WALK = s.instrument('tri-walk', { volume: [...new Array(15).fill(15), 0] })

/** The singing lead: soft front, duty opening 25 % -> 50 % after two rows, a two-tick
 *  scoop, then straight for ten ticks before a +-2 unit vibrato (loop sums to 0). */
const LEAD = s.instrument('lead', {
  volume: { values: [12, 15, 14, 13, 13, 13, 10, 7, 4, 2, 0], loop: 5, release: 5 },
  duty: { values: [1, 1, 1, 1, 1, 1, 2], loop: 6 },
  pitch: { values: [6, -3, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, -1, -1, -1, -1, 1, 1], loop: 12 },
})
/** The biting lead for the riff sections: thin front opening to 25 %, no vibrato of
 *  its own — `4xy` is written where a note earns it. */
const LEAD_BITE = s.instrument('lead-bite', {
  volume: { values: [15, 15, 14, 13, 13, 12, 12, 9, 6, 3, 0], loop: 6, release: 6 },
  duty: { values: [0, 0, 1, 1, 1], loop: 4 },
  pitch: [6, -3, -3, 0],
})
/** Pulse 2's two colours: the round 50 % answer, and the reedy 12.5 % counter-voice. */
const ANSWER = s.instrument('answer', {
  volume: { values: [10, 12, 11, 10, 10, 10, 7, 4, 2, 0], loop: 5, release: 5 },
  duty: { values: [2], loop: 0 },
})
const VOICE = s.instrument('voice', {
  volume: { values: [9, 11, 10, 10, 10, 7, 4, 2, 0], loop: 4, release: 4 },
  duty: { values: [0], loop: 0 },
  pitch: { values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, -1, -1, -1, -1, 1, 1], loop: 10 },
})
/** Power-fifth stabs: twelve ticks — four rows, half a beat — on a VRC6 pulse at the
 *  bright 25 % (duty 3), the same envelope on a 2A03 pulse at 50 % when the roles swap
 *  in A'. A stab lands every beat and its root changes every beat, so the fifth rings
 *  through the gap and stops clear of the next one: the riff sections get real
 *  sustained harmony from the lanes §12.2 assigns it to, instead of a 29 %-duty tick.
 *  The envelope's shape is unchanged at the front, so the attack peak does not move. */
const STAB_ENV = [15, 15, 14, 13, 12, 11, 9, 7, 5, 3, 1, 0]
const FIFTH = s.instrument('fifth', { volume: STAB_ENV, duty: { values: [3], loop: 0 } })
const STAB2 = s.instrument('stab2', { volume: STAB_ENV, duty: { values: [2], loop: 0 } })
const FIFTH_LONG = s.instrument('fifth-long', {
  volume: [15, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  duty: { values: [3], loop: 0 },
})
/** Sustained VRC6 harmony with the chip's own attack, 7 -> 5 -> 3, and a release. */
const HARM = s.instrument('harm', {
  volume: { values: [13, 15, 15, 11, 8, 5, 2, 0], loop: 2, release: 2 },
  duty: { values: [7, 7, 5, 5, 3, 3, 3], loop: 6 },
})
/** The riff on a VRC6 pulse: the chug envelope, the chip attack, its own scoop. */
const V_RIFF = s.instrument('v-riff', { volume: CHUG, duty: { values: [7, 5, 3, 3], loop: 3 }, pitch: [18, -9, -9, 0] })
const V_PLAIN = s.instrument('v-plain', { volume: CHUG, duty: { values: [3], loop: 0 } })
/** How each doubling lane reads the saw's instrument overrides in the riff material. */
const TRI_MAP = { [SAW_RIFF]: TRI_RIFF, [SAW_PLAIN]: TRI_8TH }
const V_MAP = { [SAW_RIFF]: V_RIFF, [SAW_PLAIN]: V_PLAIN }
/** The bridge's chromatic climb: a fat square that swells in over two rows. */
const CLIMB = s.instrument('climb', {
  volume: { values: [0, 3, 6, 9, 11, 12, 12, 9, 6, 3, 0], loop: 6, release: 6 },
  duty: { values: [7], loop: 0 },
})
const RUN = s.instrument('run', { volume: { values: [15, 15, 15], loop: 2 }, duty: { values: [3], loop: 0 } })

// Noise. Every envelope ends on 0 and never loops (self-ending percussion, §2.6).
const TOM_HI = s.instrument('tom-hi', { note: 43, volume: [15, 13, 10, 7, 5, 3, 1, 0], pitch: [1, 1, 1, 0] })
const TOM_LO = s.instrument('tom-lo', { note: 37, volume: [15, 14, 11, 8, 6, 4, 2, 0], pitch: [1, 1, 1, 1, 0] })
/** One note is one roll: the envelope re-articulates every other tick for six rows
 *  while the pitch macro walks the period index down (up in pitch) — the brief's
 *  "snare roll built from a pitch macro". */
const ROLL = s.instrument('roll', {
  note: 40,
  volume: [15, 7, 14, 6, 13, 5, 12, 4, 11, 3, 10, 3, 9, 2, 8, 2, 7, 0],
  pitch: [-1, -1, -1, -1, -1, -1, -1, 0],
})
/** A crash that rings sixteen rows (48 ticks) and ends itself. */
const CRASH_LONG = s.instrument('crash-long', {
  note: 46,
  volume: [...Array.from({ length: 13 }, (_, i) => [13 - i, 13 - i, 13 - i]).flat(), 0],
})

// --- helpers -----------------------------------------------------------------------
const STICKY = ['0', '3', '4', '7']

/** A line written from `bar0`, in rows from the start of that bar, transposed by
 *  `semis`. Events are `[row, note, cmd?, param?, inst?, vol?]`; a note of `'---'`
 *  cuts and `'==='` releases (both untransposed). Sticky effects (0/3/4/7) are
 *  cancelled on the next event that carries none, so a vibrato never runs into the
 *  next phrase or across the seam — the same rule `line()` keeps. */
function play(sec, lane, bar0, inst, vol, events, semis = 0, map = null) {
  const pending = new Set()
  for (const [row, note, cmd, param, instOverride, volOverride] of events) {
    const abs = sec.at(bar0) + row
    const midi = n(note)
    // An event's instrument override is written for the saw; a doubling lane passes a
    // `map` from the saw's instruments to its own and falls back to its default.
    const which = instOverride === undefined ? inst : map === null ? instOverride : (map[instOverride] ?? inst)
    const fields = midi < 0 ? { note: midi } : { note: midi + semis, inst: which, vol: volOverride ?? vol }
    if (cmd !== undefined) {
      const upper = String(cmd).toUpperCase()
      fields.fx = [[upper, param ?? 0]]
      if (STICKY.includes(upper)) (param ?? 0) === 0 ? pending.delete(upper) : pending.add(upper)
    } else if (pending.size > 0) {
      fields.fx = [...pending].sort().map((c) => [c, 0])
      pending.clear()
    }
    sec.put(lane, abs, fields)
  }
  if (pending.size > 0) throw new Error(`${sec.name}: a sticky effect is still latched at the end of a phrase — end it`)
}

/** Power fifths as `0xy` with param 7 (`007`: root, root, fifth on a three-tick cycle
 *  — one row here, so it reads as a buzzing fifth). `list` is `[row, root]` from
 *  `bar0`; `semis` transposes. */
function fifths(sec, lane, inst, vol, bar0, list, semis = 0) {
  for (const [row, root] of list) {
    const abs = sec.at(bar0) + row
    sec.put(lane, abs, { note: n(root) + semis, inst, vol, fx: [['0', nib(0, 7)]] })
  }
}

/** Drum hits inside one bar: `[row, inst, vol, note?]`. */
function kit(sec, bar, hits) {
  for (const [row, inst, vol, note] of hits) {
    sec.put(L.NOISE, sec.at(bar, row), { note: note ?? s.instruments[inst].note, inst, vol })
  }
}
/** Clear the noise lane's second half-bar so a fill replaces the groove there. */
function wipe(sec, bar, from = 16, to = BAR) {
  for (let r = from; r < to; r++) sec.lanes[L.NOISE][sec.at(bar, r)] = null
}
/** DPCM kick and snare inside one bar: `[row, 'kick' | 'snare']`. */
function dpcm(sec, bar, hits) {
  for (const [row, drum] of hits) sec.put(L.DPCM, sec.at(bar, row), { note: KIT[drum], inst: KIT.inst, vol: 15 })
}

// --- the motif ---------------------------------------------------------------------
/** ANVIL, the riff: two bars in the saw's octave. Rows are 32nds. The 16th-note
 *  gallop on the root; up a minor third and the phrygian second falling to the root;
 *  a 32nd of air; the flat seventh with a chromatic approach (C C# | D). Bar two leaps
 *  to the fifth and steps down through F to the Eb, which FALLS to D (`Rf1` — the
 *  phrygian sigh), then the b6 climbs home chromatically (Bb C C# | D). The C#s are
 *  the riff's only accidentals. The 32nd approach notes take the plain saw so they do
 *  not scoop. */
const ANVIL = [
  [0, 'd2'], [4, 'd2'], [6, 'd2'],
  [8, 'f2'], [12, 'eb2'],
  [16, 'd2'], [22, '---'],
  [24, 'c2'], [28, 'c2'], [30, 'c#2', undefined, undefined, SAW_PLAIN],
  [32, 'd2'], [36, 'd2'], [38, 'd2'],
  [40, 'a2'], [44, 'g2'],
  [48, 'f2'], [51, '---'], [52, 'eb2', 'R', hex('f1')],
  [56, 'bb1'], [60, 'c2', undefined, undefined, SAW_PLAIN], [62, 'c#2', undefined, undefined, SAW_PLAIN],
]
/** The tail after each cell: a root pedal in 8ths with a scoop on the beats, and a
 *  four-note chromatic climb (A Bb C C#) into the next cell. Three variants. */
const APPROACH = [[56, 'a1'], [58, 'bb1'], [60, 'c2', undefined, undefined, SAW_PLAIN], [62, 'c#2', undefined, undefined, SAW_PLAIN]]
const pedal8ths = (rows, note = 'd2') => rows.map((r) => [r, note, undefined, undefined, r % 16 === 0 ? SAW_RIFF : SAW_PLAIN])
const TAIL_PEDAL = [...pedal8ths([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52]), ...APPROACH]
/** Octave-leaping variant: D2 D3 alternating. */
const TAIL_OCTAVE = [
  ...[0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52].map((r, i) => [r, i % 2 ? 'd3' : 'd2', undefined, undefined, i % 2 ? SAW_PLAIN : SAW_RIFF]),
  ...APPROACH,
]
/** The section's cadence: a bar of pedal, then Eb (bII) falling to D — the bass side
 *  of a phrygian cadence, the lead rising against it. */
const TAIL_CADENCE = [
  ...pedal8ths([0, 4, 8, 12, 16, 20, 24, 28]),
  [32, 'eb2'], [36, 'eb2', undefined, undefined, SAW_PLAIN], [40, 'eb2'], [44, 'eb2', undefined, undefined, SAW_PLAIN],
  [48, 'd2'], [56, 'd2'],
]
/** Fifth stabs under the cell, one 32nd AFTER the riff's off-beat 8ths so they smack
 *  (the brief's displacement), following the riff's implied roots. */
const CELL_STABS = [[5, 'd4'], [13, 'eb4'], [21, 'd4'], [29, 'c4'], [37, 'd4'], [45, 'd4'], [53, 'eb4'], [61, 'bb3']]
/** Sparser stabs under the tail, where the lead speaks. */
const TAIL_STABS = [[5, 'd4'], [13, 'd4'], [37, 'd4'], [45, 'd4']]

// --- alarm (frames 0-1) and turn (42-43) --------------------------------------------
/** Four bars. Bars 1-2: the two-note saw stab (D2 then Eb2, vol 13 — the only place
 *  the saw reaches 13) against silence, the DPCM kick doubling both notes, a long
 *  crash on the first. Bar 2's Eb falls back to D (`Rf1`). Bar 3: the stab again and
 *  the kit arrives under it. Bar 4: the riff's head in unison on six lanes, then a
 *  snare roll into the riff. `variant` 'turn' swaps both fills so the reprise is not
 *  the intro verbatim (§9.4: no two fills identical). */
function alarmBars(sec, variant) {
  const STAB = [[0, 'd2'], [4, 'eb2']]
  play(sec, L.SAW, 0, SAW_STAB, 13, STAB)
  play(sec, L.SAW, 1, SAW_STAB, 13, [[0, 'd2'], [3, '---'], [4, 'eb2', 'R', hex('f1')]])
  play(sec, L.SAW, 2, SAW_STAB, 13, STAB)
  for (const bar of [0, 1, 2]) dpcm(sec, bar, [[0, 'kick'], [4, 'kick']])
  kit(sec, 0, [[0, CRASH_LONG, 12]])
  // The kit arrives in bar 3: kick on 1 and the "and" of 2, snare on 2 and 4, hats on
  // the free 8ths, a ghost pushing into bar 4.
  kit(sec, 2, [[0, KICK, 13], [4, HAT, 7], [8, SNARE, 14], [12, KICK, 13], [16, HAT, 7], [20, HAT, 7], [24, SNARE, 14], [28, HAT, 7], [30, SNARE, 4]])
  dpcm(sec, 2, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [24, 'snare']])
  if (variant === 'turn') {
    // the reprise: a tom figure across beat 4 instead of the plain hats
    kit(sec, 2, [[24, TOM_HI, 13], [26, TOM_HI, 10], [28, TOM_LO, 13], [30, TOM_LO, 10]])
  }
  // Bar 4: the head of ANVIL in unison — D D D F Eb D — on six lanes, six octaves of
  // the same six notes, then a 32nd of air before the roll.
  const HEAD = ANVIL.slice(0, 7)
  play(sec, L.SAW, 3, SAW_RIFF, 12, HEAD)
  play(sec, L.TRI, 3, TRI_RIFF, 15, HEAD, 12)
  play(sec, L.V2, 3, V_RIFF, 8, HEAD, 12)
  play(sec, L.V1, 3, V_RIFF, 9, HEAD, 24)
  play(sec, L.P2, 3, ANSWER, 11, HEAD, 24)
  play(sec, L.P1, 3, LEAD_BITE, 13, HEAD, 36)
  kit(sec, 3, [[0, KICK, 14], [4, HAT, 7], [8, SNARE, 14], [12, KICK, 13], [16, KICK, 13], [20, HAT, 7]])
  dpcm(sec, 3, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [16, 'kick'], [24, 'snare']])
  if (variant === 'turn') {
    // the macro roll: one note, six rows of re-articulation rising in pitch
    kit(sec, 3, [[24, ROLL, 14]])
  } else {
    // a written roll: 32nds climbing the period table, the volume column swelling
    // (the snare's own arpeggio rises two steps, so 45 is the highest safe note)
    kit(sec, 3, [24, 25, 26, 27, 28, 29, 30, 31].map((r, i) => [r, SNARE, 8 + i, 38 + i]))
  }
}

const alarm = s.section('alarm', 4)
alarmBars(alarm, 'intro')

// --- riff A (frames 2-9): four units of cell + tail -----------------------------------
/** The lead's three tail phrases — the head of ANVIL augmented into 8ths and quarters
 *  two octaves up (unit 2), sequenced a third higher (unit 3), and the section's peak
 *  phrase falling from Bb5 into the cadence (unit 4). Each breathes for a beat. */
const PHRASE_1 = [[0, 'd5'], [4, 'd5'], [6, 'd5'], [8, 'f5', undefined, undefined, undefined, 15], [16, 'eb5'], [20, 'd5', '4', hex('42'), undefined, 13], [30, '---']]
const PHRASE_2 = [[0, 'f5'], [4, 'f5'], [6, 'f5'], [8, 'a5', undefined, undefined, undefined, 15], [16, 'g5'], [20, 'f5', '4', hex('42'), undefined, 13], [30, '---']]
/** Pulse 2's answers, a diatonic fourth below, in the bar the lead leaves empty. */
const ANSWER_1 = [[32, 'a4'], [36, 'a4'], [38, 'a4'], [40, 'c5'], [48, 'bb4'], [52, 'a4'], [62, '---']]
const ANSWER_2 = [[32, 'c5'], [36, 'c5'], [38, 'c5'], [40, 'eb5'], [48, 'd5'], [52, 'c5'], [62, '---']]
/** The peak phrase: Bb5 on the downbeat, stepping down a whole bar, then the cadence
 *  line Bb4 C5 D5 RISING while the bass falls Eb -> D (contrary motion), the D held
 *  under vibrato and released before B. */
const PHRASE_PEAK = [
  [0, 'bb5', undefined, undefined, undefined, 15], [8, 'a5'], [12, 'g5'], [16, 'f5'], [24, 'eb5'], [28, 'd5'], [30, '---'],
  [32, 'bb4', undefined, undefined, undefined, 12], [40, 'c5', undefined, undefined, undefined, 13], [48, 'd5', '4', hex('42')], [62, '---'],
]
/** Under the cadence pulse 2 holds the third of each chord: G over Eb, F over D. */
const CADENCE_VOICE = [[32, 'g4'], [48, 'f4'], [62, '---']]

/** The kit's bar for the riff sections. Kick on 1 and the "and" of 2 (rows 0, 12),
 *  snare on 2 and 4, closed hats on the free 8ths, snare ghosts on off-16ths. */
function riffKit(sec, bar, { push = false, open = false } = {}) {
  kit(sec, bar, [
    [0, KICK, 15], [4, open ? HAT_OPEN : HAT, 8], [8, SNARE, 15], [12, KICK, 13], [14, SNARE, 4],
    [16, HAT, 8], [20, open ? HAT_OPEN : HAT, 8], [24, SNARE, 15], [28, HAT, 8], [30, SNARE, 4],
  ])
  if (push) kit(sec, bar, [[6, KICK, 12], [22, KICK, 12]])
  dpcm(sec, bar, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [24, 'snare']])
}
/** Four different fills for the last half-bar of a four-bar unit. */
const FILLS = {
  build: (sec, bar) => { wipe(sec, bar); kit(sec, bar, [16, 18, 20, 22, 24, 26, 28, 30].map((r, i) => [r, SNARE, 9 + Math.min(6, i)])) },
  toms: (sec, bar) => { wipe(sec, bar); kit(sec, bar, [[16, SNARE, 14], [20, TOM_HI, 12], [22, TOM_HI, 10], [24, TOM_LO, 13], [26, TOM_LO, 11], [28, KICK, 13], [30, SNARE, 12]]) },
  faller: (sec, bar) => { wipe(sec, bar, 24); kit(sec, bar, [24, 25, 26, 27, 28, 29, 30, 31].map((r, i) => [r, SNARE, 15 - i, 45 - i])) },
  rolls: (sec, bar) => { wipe(sec, bar); kit(sec, bar, [[16, SNARE, 14], [20, ROLL, 13], [26, ROLL, 15]]) },
}

const riffA = s.section('riff-A', 16)
{
  const TAILS = [TAIL_PEDAL, TAIL_OCTAVE, TAIL_PEDAL, TAIL_CADENCE]
  const LEADS = [null, PHRASE_1, PHRASE_2, PHRASE_PEAK]
  const ANSWERS = [null, ANSWER_1, ANSWER_2, CADENCE_VOICE]
  const FILL = [FILLS.build, FILLS.toms, FILLS.faller, FILLS.rolls]
  // Unit 1 is the riff alone with no lead over it, so it enters a step under the rest:
  // the section's main voice grows into its own level instead of arriving flat.
  const SAW_VOL = [11, 12, 12, 12]
  for (let u = 0; u < 4; u++) {
    const b = 4 * u
    // Saw: the cell, then this unit's tail. Triangle: the same an octave up.
    play(riffA, L.SAW, b, SAW_RIFF, SAW_VOL[u], ANVIL)
    play(riffA, L.SAW, b + 2, SAW_RIFF, SAW_VOL[u], TAILS[u])
    play(riffA, L.TRI, b, TRI_RIFF, 15, ANVIL, 12, TRI_MAP)
    play(riffA, L.TRI, b + 2, TRI_RIFF, 15, TAILS[u], 12, TRI_MAP)
    // VRC6 fifths, a 32nd late, both pulses under the cell (V1 an octave above V2);
    // under the tail only V2 continues once the lead has entered (unit 1 has no lead,
    // so both stay).
    fifths(riffA, L.V1, FIFTH, 9, b, CELL_STABS)
    fifths(riffA, L.V2, FIFTH, 9, b, CELL_STABS, -12)
    fifths(riffA, L.V2, FIFTH, 9, b + 2, TAIL_STABS, -12)
    if (u === 0) fifths(riffA, L.V1, FIFTH, 9, b + 2, TAIL_STABS)
    // The lead and its answer live in the tail; unit 1 exposes the riff alone.
    if (LEADS[u]) play(riffA, L.P1, b + 2, LEAD_BITE, 14, LEADS[u])
    if (ANSWERS[u]) play(riffA, L.P2, b + 2, ANSWER, 10, ANSWERS[u])
    // Drums: the groove, two changes per unit, and a different fill each time.
    for (let bar = b; bar < b + 4; bar++) riffKit(riffA, bar, { push: u >= 1, open: u === 2 })
    FILL[u](riffA, b + 3)
  }
}

// --- B (frames 10-17): D minor, the lead sings ----------------------------------------
/** One chord a bar (riff A changed every two beats — the harmonic rhythm is the
 *  contrast). Phrase 1 is eight bars ending on a half cadence; phrase 2 is SEVEN — the
 *  descending-fifths chain Dm Gm C F Bb runs straight into the Neapolitan Eb and the
 *  dominant, a bar early. Bar 15 (index) exists only because a section is whole
 *  frames; `D00` on bar 14's last row skips it (the metric surprise, 17:31). */
const B_CHORDS = ['Dm', 'Dm', 'Gm', 'C7', 'F', 'Bb', 'Gm', 'A7', 'Dm', 'Gm', 'C7', 'F', 'Bb', 'Eb', 'A7']
/** Each chord's third (VRC6 pulse 1 sustains it) and the tone VRC6 pulse 2 comps. */
const B_THIRD = { Dm: 'f3', Gm: 'bb3', C7: 'e4', F: 'a3', Bb: 'd4', Eb: 'g3', A7: 'c#4' }
const B_COMP = { Dm: 'a3', Gm: 'd4', C7: 'bb3', F: 'c4', Bb: 'f4', Eb: 'bb3', A7: 'g3' }
/** The walking triangle: chord tones and passing tones in quarters, the E naturals of
 *  D minor on the way, C# only in the dominant bars. */
const B_WALK = [
  ['d3', 'a2', 'd3', 'e3'], ['f3', 'e3', 'd3', 'a2'], ['g2', 'bb2', 'd3', 'f3'], ['c3', 'e3', 'g3', 'bb2'],
  ['f3', 'c3', 'a2', 'f2'], ['bb2', 'd3', 'f3', 'd3'], ['g2', 'bb2', 'd3', 'e3'], ['a2', 'c#3', 'e3', 'g3'],
  ['d3', 'a2', 'f3', 'e3'], ['g2', 'bb2', 'd3', 'f3'], ['e3', 'g3', 'bb2', 'c3'], ['f3', 'c3', 'a2', 'f2'],
  ['bb2', 'd3', 'f3', 'g3'], ['eb3', 'g3', 'bb2', 'g2'], ['a2', 'c#3', 'e3'],
]

const B = s.section('B', 16)
{
  // Saw: a tonic pedal on D2, re-struck every two bars with the slow bend, resting for
  // the dominant bar of phrase 1; at the close it takes the Neapolitan root and the
  // dominant itself — Eb2, then A1 with the chromatic pickup A Bb C C# rising into the
  // riff's D. The lead falls E5 -> D5 against that rise: the contrary-motion cadence.
  // The pedal is the section's dynamic floor and it GROWS: 6 through phrase 1, 8 from
  // bar 8, 10 at the Neapolitan and the dominant. B is the piece's breath, so it must
  // enter under riff A and arrive over it, not start at the riff's weight.
  for (const bar of [0, 2, 4, 6]) play(B, L.SAW, bar, SAW_PEDAL, 6, [[0, 'd2']])
  for (const bar of [8, 10, 12]) play(B, L.SAW, bar, SAW_PEDAL, 8, [[0, 'd2']])
  play(B, L.SAW, 7, SAW_PEDAL, 6, [[0, '---']])
  play(B, L.SAW, 13, SAW_PEDAL, 10, [[0, 'eb2']])
  play(B, L.SAW, 14, SAW_PEDAL, 10, [[0, 'a1'], [24, 'a1', undefined, undefined, SAW_PLAIN, 11], [26, 'bb1', undefined, undefined, SAW_PLAIN, 11], [28, 'c2', undefined, undefined, SAW_PLAIN, 11], [30, 'c#2', undefined, undefined, SAW_PLAIN, 11]])
  // Triangle: the walking bass, slightly detached quarters; the last beat of bar 14
  // doubles the saw's pickup in 16ths.
  B_WALK.forEach((bar, i) => play(B, L.TRI, i, TRI_WALK, 15, bar.map((note, q) => [8 * q, note])))
  play(B, L.TRI, 14, TRI_8TH, 15, [[24, 'a2'], [26, 'bb2'], [28, 'c3'], [30, 'c#3']])
  // VRC6 pulse 1: the third of each chord, sustained, released four rows before the
  // change. VRC6 pulse 2: a soft comp on the off-beat 8ths — the harmony lanes share
  // the chords but not a rhythm.
  B_CHORDS.forEach((chord, bar) => {
    play(B, L.V1, bar, HARM, bar < 8 ? 6 : 8, [[0, B_THIRD[chord]], [28, '===']])
    play(B, L.V2, bar, FIFTH, bar < 8 ? 6 : 8, [4, 12, 20, 28].map((r) => [r, B_COMP[chord]]))
  })

  // Pulse 1, the lead (D minor: the E naturals are its colour). Four phrases, and each
  // of the first three ends with a whole beat of rest — bar 1, bar 3, bar 5 and bar 9
  // all cut on row 24 — so the singer breathes and pulse 2's counter-voice has the gap
  // to speak into (§9.2: both of those rests are filled, at 12:52 and 14:60). Only the
  // last phrase, bars 12-14, drives unbroken into the Neapolitan cadence, which is what
  // makes that cadence sound like an arrival rather than another line ending. Pulse 2
  // attacks inside both of the new rests, at 12:60 and 14:60.
  // An appoggiatura Bb over A7 on the downbeat of bar 7 (13:32 -> 13:36); the section's
  // one peak, G5, on the downbeat of bar 10 (15:0); the last bar holds E5 and turns
  // through C# to the D5 that lands on A' — falling while the bass rises.
  // Column 12, not 13: the lead is a 50 %-duty pulse holding a sustained macro, which
  // makes it the loudest single thing in the piece (2.5 dB of this section, measured by
  // muting it), and B is the breath between the riff sections, not the climax.
  const B_LEAD = [
    [[0, 'a4'], [16, 'f4'], [24, 'e4']],
    [[0, 'd4'], [24, '---']],
    [[0, 'g4'], [8, 'a4'], [16, 'bb4']],
    [[0, 'a4'], [8, 'g4'], [16, 'e4'], [24, '---']],
    [[0, 'f4'], [4, 'g4'], [8, 'a4'], [16, 'c5']],
    [[0, 'd5'], [8, 'c5'], [16, 'bb4'], [24, '---']],
    [[0, 'bb4'], [8, 'a4'], [16, 'g4']],
    [[0, 'bb4'], [4, 'a4'], [16, 'c#5'], [24, 'e5']],
    [[0, 'f5'], [16, 'e5'], [24, 'd5']],
    [[0, 'd5'], [8, 'bb4'], [16, 'g4'], [24, '---']],
    [[0, 'g5', undefined, undefined, undefined, 15], [16, 'e5'], [24, 'c5']],
    [[0, 'f5'], [8, 'c5'], [16, 'a4'], [24, 'bb4'], [28, '---']],
    [[0, 'd5'], [8, 'f5'], [16, 'd5'], [24, 'bb4']],
    [[0, 'eb5'], [8, 'd5'], [16, 'bb4'], [24, 'c5']],
    [[0, 'e5', undefined, undefined, undefined, 14], [16, 'f5'], [20, 'e5'], [24, 'c#5']],
  ]
  B_LEAD.forEach((bar, i) => play(B, L.P1, i, LEAD, i < 8 ? 11 : 12, bar))
  // Pulse 2, the counter-voice for the whole section: it moves while the lead holds,
  // falls when the lead rises, and is always below it; most of its attacks sit on the
  // off-beat 8ths the lead leaves free (§9.2's complementary rhythm). Written
  // suspensions: D4 held from Gm (11:20) into C7, resolving to C4 (11:40, a 9-8); D4
  // held from Gm (13:4) into A7, resolving to C#4 (13:40, the cadential 4-3); Eb4 held
  // from the Neapolitan (16:52) into A7, resolving to C#4 (17:8, b2 -> leading tone).
  // Cut before the dead bar.
  const B_VOICE = [
    [[4, 'd4'], [8, 'e4'], [12, 'f4'], [20, 'a3'], [28, 'c4']],
    [[4, 'a3'], [12, 'bb3'], [20, 'a3'], [28, 'g3']],
    [[4, 'd4'], [12, 'bb3'], [20, 'd4']],
    [[8, 'c4'], [20, 'g3'], [28, 'bb3']],
    [[0, 'a3'], [6, 'g3'], [12, 'f3']],
    [[4, 'g3'], [12, 'bb3'], [20, 'd4'], [28, 'c4']],
    [[4, 'd4']],
    [[8, 'c#4'], [12, 'a3'], [20, 'g3']],
    [[4, 'f3'], [12, 'a3'], [20, 'd4'], [28, 'f4']],
    [[4, 'bb3'], [12, 'd4'], [28, 'c4']],
    [[8, 'e4'], [20, 'g4'], [28, 'bb3']],
    [[4, 'a3'], [12, 'c4'], [20, 'f4'], [28, 'e4']],
    [[4, 'f4'], [12, 'd4'], [20, 'bb3'], [28, 'g3']],
    [[0, 'g3'], [12, 'bb3'], [20, 'eb4']],
    [[8, 'c#4'], [12, 'a3'], [30, '---']],
  ]
  B_VOICE.forEach((bar, i) => play(B, L.P2, i, VOICE, 10, bar))
  // Kit: the snare moves up to 41, hats on the off-beats only (two changes from riff
  // A), ghosts at 3; phrase 2 adds a 16th kick push. Fill at the half cadence (toms
  // low-high), and the double macro roll into A'.
  //
  // The first two bars are the drop the riff earns: kick on 1, a softer backbeat, no
  // ghosts, and the DPCM lane resting — which also lifts the ducking off the triangle
  // and the noise (§1's shared TND index), so the walking bass arrives brighter as the
  // arrangement thins. Everything else enters in bar 2.
  for (let bar = 0; bar < 15; bar++) {
    // The backbeat is the high snare (41) but it is not hammered: 13 here against the
    // riff sections' 15, because a singing section that keeps the riff's kit is just
    // the riff with a tune over it.
    const open = bar < 2
    kit(B, bar, [[0, KICK, open ? 12 : 13], [4, HAT, 7], [8, SNARE, open ? 11 : 13, 41], [20, HAT, 7], [24, SNARE, open ? 11 : 13, 41], [28, HAT, 7]])
    if (!open) kit(B, bar, [[12, KICK, 12], [14, SNARE, 3, 41], [30, SNARE, 3, 41]])
    if (bar >= 8) kit(B, bar, [[6, KICK, 11]])
    if (!open) dpcm(B, bar, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [24, 'snare']])
  }
  wipe(B, 7)
  kit(B, 7, [[16, TOM_LO, 12], [18, TOM_LO, 10], [20, TOM_HI, 12], [22, TOM_HI, 10], [24, SNARE, 14, 41], [26, TOM_LO, 12], [28, TOM_HI, 12], [30, SNARE, 12, 41]])
  wipe(B, 14)
  kit(B, 14, [[16, SNARE, 14, 41], [18, ROLL, 12], [24, ROLL, 15]])
  // The dropped bar: end the frame after bar 14's last row, next frame from row 0.
  B.fx(L.DPCM, 14, 31, 'D', 0)
}

// --- riff A' (frames 18-21): the riff re-orchestrated ------------------------------------
const riffA2 = s.section("riff-A'", 8)
{
  // Saw: down to a root pedal in 8ths on D2 (a phrygian pedal under the riff's Eb and
  // C), with the chromatic climb at the end of each two bars; the last one drops the
  // saw an octave onto the bridge's D1.
  // The pedal keeps the riff's level (12): A' is an escalation, and the saw giving up
  // the tune must not also give up the weight — the change the ear is meant to hear is
  // the riff moving an octave up onto a VRC6 pulse, not the bass getting quieter.
  for (const b of [0, 2, 4, 6]) play(riffA2, L.SAW, b, SAW_RIFF, 12, TAIL_PEDAL)
  // VRC6 pulse 1 takes ANVIL an octave up at vol 10: three cells, then the octave-
  // leaping tail. Pulse 2 holds a high A (the fifth) under slow vibrato for four bars,
  // then doubles the riff an octave above pulse 1 for the lift into the bridge.
  for (const b of [0, 2, 4]) play(riffA2, L.V1, b, V_RIFF, 11, ANVIL, 12, V_MAP)
  play(riffA2, L.V1, 6, V_RIFF, 11, TAIL_OCTAVE, 12, V_MAP)
  play(riffA2, L.V2, 0, HARM, 8, [[0, 'a4', '4', hex('42')], [3 * BAR + 28, '===', '4', 0]])
  play(riffA2, L.V2, 4, V_RIFF, 9, ANVIL, 24, V_MAP)
  play(riffA2, L.V2, 6, V_RIFF, 9, TAIL_OCTAVE, 24, V_MAP)
  // Triangle: the pedal an octave above the saw for four bars, then in unison with
  // pulse 1's riff — the bass thins first and thickens into the bridge.
  for (const b of [0, 2]) play(riffA2, L.TRI, b, TRI_8TH, 15, [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60].map((r) => [r, 'd3']))
  play(riffA2, L.TRI, 4, TRI_RIFF, 15, ANVIL, 12, TRI_MAP)
  play(riffA2, L.TRI, 6, TRI_RIFF, 15, TAIL_OCTAVE, 12, TRI_MAP)
  // The 2A03 pulses take the fifth stabs (50 % duty), a 32nd late as before; pulse 1
  // first lands the D5 that resolves B's E5, and hands over.
  play(riffA2, L.P1, 0, LEAD, 12, [[0, 'd5']])
  for (const b of [0, 2, 4]) {
    fifths(riffA2, L.P1, STAB2, 11, b, CELL_STABS)
    fifths(riffA2, L.P2, STAB2, 10, b, CELL_STABS, -12)
  }
  fifths(riffA2, L.P1, STAB2, 11, 6, TAIL_STABS)
  fifths(riffA2, L.P2, STAB2, 10, 6, TAIL_STABS, -12)
  // Kit: double-time hats (16ths, accents on the 8ths), snare back on 39, ghosts on
  // the last 16th of beats 2 and 4. A tom climb in 32nds at bar 4; a snare figure and
  // the macro roll into the bridge.
  for (let bar = 0; bar < 8; bar++) {
    kit(riffA2, bar, [
      [0, KICK, 15], [2, HAT, 6], [4, HAT, 8], [6, HAT, 6], [8, SNARE, 15], [10, HAT, 6], [12, KICK, 13], [14, SNARE, 4],
      [16, HAT, 8], [18, HAT, 6], [20, HAT, 8], [22, HAT, 6], [24, SNARE, 15], [26, HAT, 6], [28, HAT, 8], [30, SNARE, 4],
    ])
    dpcm(riffA2, bar, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [24, 'snare']])
  }
  wipe(riffA2, 3, 24)
  kit(riffA2, 3, [[24, TOM_LO, 13], [25, TOM_LO, 11], [26, TOM_LO, 12], [27, TOM_LO, 10], [28, TOM_HI, 13], [29, TOM_HI, 11], [30, TOM_HI, 12], [31, TOM_HI, 10]])
  wipe(riffA2, 7)
  kit(riffA2, 7, [[16, SNARE, 15], [18, SNARE, 12], [20, SNARE, 15], [22, SNARE, 12], [24, ROLL, 15]])
}

// --- bridge (frames 22-27): half time ------------------------------------------------------
const bridge = s.section('bridge', 12)
{
  // Saw alone in the bass: D1 struck on the tresillo (rows 0, 12, 24 — 3+3+2 at the
  // 8th level, the broad form for this tempo), the brass bend on every strike. Bars 9-10
  // move to Bb1 and 11-12 to C2: bVI, bVII — and C is the pivot, the dominant of F.
  const TRESILLO = [0, 12, 24]
  for (let bar = 0; bar < 12; bar++) {
    const root = bar < 8 ? 'd1' : bar < 10 ? 'bb1' : 'c2'
    play(bridge, L.SAW, bar, SAW_PEDAL, 12, TRESILLO.map((r) => [r, root]))
    dpcm(bridge, bar, [[0, 'kick'], [12, 'kick'], [16, 'snare'], [24, 'kick']])
  }
  // Toms on a six-row cell for the whole section: 64 attacks, low/high alternating,
  // louder where a cell lands on a beat. 384 rows is six frames; the cell enters each
  // frame at rows 0, 2, 4, 0, 2, 4 — 3:4 against the kit, phase carried throughout.
  for (let r = 0; r < bridge.len; r += 6) {
    bridge.put(L.NOISE, r, { note: (r / 6) % 2 === 0 ? 37 : 43, inst: (r / 6) % 2 === 0 ? TOM_LO : TOM_HI, vol: r % 8 === 0 ? 13 : 10 })
  }
  // VRC6 pulse 2: a chromatic ascent in whole notes, D3 to C4 over eleven bars, each
  // note swelling in and released before the next; it arrives on C — the new dominant —
  // and holds it two bars.
  const CLIMB_NOTES = ['d3', 'eb3', 'e3', 'f3', 'f#3', 'g3', 'g#3', 'a3', 'bb3', 'b3', 'c4']
  CLIMB_NOTES.forEach((note, bar) => play(bridge, L.V2, bar, CLIMB, 9, [[0, note], ...(bar < 10 ? [[28, '===']] : [])]))
  play(bridge, L.V2, 11, CLIMB, 9, [[28, '===']])
  // The lead returns for the last four bars with ANVIL's head in half notes — the motif
  // augmented four times over, its F on the strong beat (26:48) — then holds C over the
  // dominant. Pulse 2 and the triangle rest for the whole bridge; pulse 1 for its first
  // eight bars.
  play(bridge, L.P1, 8, LEAD, 12, [[0, 'd5'], [16, 'd5']])
  play(bridge, L.P1, 9, LEAD, 12, [[0, 'd5'], [16, 'f5', undefined, undefined, undefined, 13]])
  play(bridge, L.P1, 10, LEAD, 12, [[0, 'eb5'], [16, 'd5']])
  play(bridge, L.P1, 11, LEAD, 12, [[0, 'c5'], [28, '===']])
  // VRC6 pulse 1: silent until a 32nd-note F-minor run up two octaves in the last
  // half-bar, straight into phase 2's downbeat (the fast run the grid is for).
  const RUN_NOTES = ['c4', 'db4', 'eb4', 'f4', 'g4', 'ab4', 'bb4', 'c5', 'db5', 'eb5', 'f5', 'g5', 'ab5', 'bb5', 'c6']
  play(bridge, L.V1, 11, RUN, 9, RUN_NOTES.map((note, i) => [16 + i, note]))
  // The toms give way to three macro rolls under the run.
  wipe(bridge, 11, 12)
  kit(bridge, 11, [[12, ROLL, 11], [18, ROLL, 13], [24, ROLL, 15]])
}

// --- phase 2 (frames 28-35): F minor, the riff inverted ------------------------------------
/** ANVIL upside down, in F minor (F G Ab Bb C Db Eb). Degree by degree the contour
 *  is mirrored around the root: the gallop stays; "up a third, the b2 falling to 1"
 *  becomes "down to the 6th, the 7th rising to 1" (Db Eb F); the b7 with its
 *  chromatic climb from below becomes the 2nd with a chromatic fall from above
 *  (G G Gb | F); bar two's leap up to the fifth becomes a leap down to the fourth,
 *  stepping up through Db to an Eb that RISES to F (`Qf1`, the sigh inverted); the
 *  b6-b7-#7 climb home becomes 3-2-b2 falling home (Ab G Gb | F). */
const ANVIL_INV = [
  [0, 'f2'], [4, 'f2'], [6, 'f2'],
  [8, 'db2'], [12, 'eb2'],
  [16, 'f2'], [22, '---'],
  [24, 'g2'], [28, 'g2'], [30, 'gb2', undefined, undefined, SAW_PLAIN],
  [32, 'f2'], [36, 'f2'], [38, 'f2'],
  [40, 'bb1'], [44, 'c2'],
  [48, 'db2'], [51, '---'], [52, 'eb2', 'Q', hex('f1')],
  [56, 'ab2'], [60, 'g2', undefined, undefined, SAW_PLAIN], [62, 'gb2', undefined, undefined, SAW_PLAIN],
]
/** The inverted tail: an F pedal in 8ths, the approach FALLING into it (Bb Ab G Gb). */
const APPROACH_INV = [[56, 'bb2'], [58, 'ab2'], [60, 'g2', undefined, undefined, SAW_PLAIN], [62, 'gb2', undefined, undefined, SAW_PLAIN]]
const TAIL_PEDAL_INV = [...pedal8ths([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52], 'f2'), ...APPROACH_INV]
/** The pivot back: a bar of F pedal, then Eb — bVII of F minor, bII of D phrygian —
 *  held into the D that opens riff A''. */
const TAIL_PIVOT = [
  ...pedal8ths([0, 4, 8, 12, 16, 20, 24, 28], 'f2'),
  [32, 'eb2'], [36, 'eb2', undefined, undefined, SAW_PLAIN], [40, 'eb2'], [44, 'eb2', undefined, undefined, SAW_PLAIN], [48, 'eb2'],
]
/** Fifths under the inverted cell, after the riff's implied roots. */
const CELL_STABS_INV = [[5, 'f4'], [13, 'eb4'], [21, 'f4'], [29, 'g4'], [37, 'f4'], [45, 'f4'], [53, 'eb4'], [61, 'ab4']]
/** The lead's phase-2 phrases (F minor, an octave above B's register). Unit 1 is the
 *  head augmented (PHRASE_1 up a minor third); unit 2 falls from Ab; unit 3 rises to
 *  Bb; unit 4 is the global peak, C6 on the downbeat of bar 14 (35:0), falling a whole
 *  bar, then the cadence line Bb4 C5 rising into A''s D against the bass Eb -> D. */
const PHRASE_P2_FALL = [[0, 'ab5', undefined, undefined, undefined, 15], [4, 'g5'], [8, 'f5'], [12, 'eb5'], [16, 'db5'], [20, 'c5', '4', hex('42'), undefined, 13], [30, '---']]
const ANSWER_P2_FALL = [[32, 'eb5'], [36, 'db5'], [40, 'c5'], [44, 'bb4'], [48, 'ab4'], [52, 'g4'], [62, '---']]
const PHRASE_P2_RISE = [[0, 'ab5'], [4, 'ab5'], [6, 'ab5'], [8, 'bb5', undefined, undefined, undefined, 15], [16, 'ab5'], [20, 'g5', '4', hex('42'), undefined, 13], [30, '---']]
const ANSWER_P2_RISE = [[32, 'eb5'], [36, 'eb5'], [38, 'eb5'], [40, 'f5'], [48, 'eb5'], [52, 'db5'], [62, '---']]
/** The global peak: Db6, F minor's b6, struck on the downbeat of bar 14 and then
 *  walked down a whole bar by step. It is the only note in the piece above C6 — the
 *  bridge's run stops ON C6 (27:62), so the ceiling is touched once, here, at 80 % of
 *  the way through a pass. */
const PHRASE_P2_PEAK = [
  [0, 'db6', undefined, undefined, undefined, 15], [8, 'c6'], [12, 'bb5'], [16, 'ab5'], [24, 'g5'], [28, 'f5'], [30, '---'],
  [32, 'bb4', undefined, undefined, undefined, 12], [40, 'c5', '4', hex('42'), undefined, 13], [62, '---'],
]
const CADENCE_VOICE_P2 = [[32, 'g4'], [62, '---']]

const phase2 = s.section('phase-2', 16)
{
  const TAILS = [TAIL_PEDAL_INV, TAIL_PEDAL_INV, TAIL_PEDAL_INV, TAIL_PIVOT]
  const LEADS = [PHRASE_1, PHRASE_P2_FALL, PHRASE_P2_RISE, PHRASE_P2_PEAK]
  const SEMIS = [3, 0, 0, 0]
  const ANSWERS = [ANSWER_1, ANSWER_P2_FALL, ANSWER_P2_RISE, CADENCE_VOICE_P2]
  for (let u = 0; u < 4; u++) {
    const b = 4 * u
    // Saw + triangle in octaves on the inverted cell and its tail; VRC6 pulse 2
    // doubles the saw an octave up throughout (the riff's third voice). VRC6 pulse 1
    // stabs fifths under the cell only, so one VRC6 pulse rests whenever the lead plays.
    play(phase2, L.SAW, b, SAW_RIFF, 12, ANVIL_INV)
    play(phase2, L.SAW, b + 2, SAW_RIFF, 12, TAILS[u])
    play(phase2, L.TRI, b, TRI_RIFF, 15, ANVIL_INV, 12, TRI_MAP)
    play(phase2, L.TRI, b + 2, TRI_RIFF, 15, TAILS[u], 12, TRI_MAP)
    play(phase2, L.V2, b, V_RIFF, 10, ANVIL_INV, 12, V_MAP)
    play(phase2, L.V2, b + 2, V_RIFF, 10, TAILS[u], 12, V_MAP)
    fifths(phase2, L.V1, FIFTH, 9, b, CELL_STABS_INV)
    play(phase2, L.P1, b + 2, LEAD_BITE, 14, LEADS[u], SEMIS[u])
    play(phase2, L.P2, b + 2, ANSWER, 10, ANSWERS[u], SEMIS[u])
  }
  // Kit: 16th hats with the open hat on every off-beat 8th, a third kick on the last
  // 16th of beat 3, the high snare, ghosts; a macro roll closes every second bar; a
  // long crash opens the section.
  for (let bar = 0; bar < 16; bar++) {
    kit(phase2, bar, [
      [0, KICK, 15], [2, HAT, 6], [4, HAT_OPEN, 7], [6, KICK, 12], [8, SNARE, 15, 41], [10, HAT, 6], [12, KICK, 13], [14, SNARE, 4, 41],
      [16, HAT, 8], [18, HAT, 6], [20, HAT_OPEN, 7], [22, KICK, 12], [24, SNARE, 15, 41], [26, HAT, 6], [28, HAT_OPEN, 7], [30, SNARE, 4, 41],
    ])
    dpcm(phase2, bar, [[0, 'kick'], [8, 'snare'], [12, 'kick'], [24, 'snare']])
    if (bar % 2 === 1) {
      wipe(phase2, bar, 26)
      kit(phase2, bar, [[26, ROLL, 13]])
    }
  }
  kit(phase2, 0, [[0, CRASH_LONG, 11]])
  wipe(phase2, 7)
  kit(phase2, 7, [[16, TOM_HI, 13], [18, TOM_LO, 13], [20, ROLL, 13], [26, ROLL, 15]])
  wipe(phase2, 15)
  kit(phase2, 15, [[16, TOM_HI, 13], [18, TOM_HI, 11], [20, TOM_LO, 13], [22, TOM_LO, 11], [24, ROLL, 14]])
}

// --- riff A'' (frames 36-41): everything on, then the hemiola --------------------------------
const riffA3 = s.section("riff-A''", 12)
{
  const shift = (events, rows) => events.map(([r, ...rest]) => [r + rows, ...rest])
  // Units 1-2 as riff A: cell + tail on saw and triangle, fifths on both VRC6 pulses
  // under the cell and on pulse 2 under the tail, the lead's phrases in the tails —
  // the first RESTATED A 16TH LATE (37:2), its answer where it was, so the call and
  // the answer sit closer than before.
  for (const [u, tail, phrase, answer] of [[0, TAIL_PEDAL, shift(PHRASE_1, 2), ANSWER_1], [1, TAIL_OCTAVE, PHRASE_2, ANSWER_2]]) {
    const b = 4 * u
    play(riffA3, L.SAW, b, SAW_RIFF, 12, ANVIL)
    play(riffA3, L.SAW, b + 2, SAW_RIFF, 12, tail)
    play(riffA3, L.TRI, b, TRI_RIFF, 15, ANVIL, 12, TRI_MAP)
    play(riffA3, L.TRI, b + 2, TRI_RIFF, 15, tail, 12, TRI_MAP)
    fifths(riffA3, L.V1, FIFTH, 10, b, CELL_STABS)
    fifths(riffA3, L.V2, FIFTH, 10, b, CELL_STABS, -12)
    fifths(riffA3, L.V2, FIFTH, 10, b + 2, TAIL_STABS, -12)
    play(riffA3, L.P1, b + 2, LEAD_BITE, 14, phrase)
    play(riffA3, L.P2, b + 2, ANSWER, 10, answer)
    for (let bar = b; bar < b + 4; bar++) riffKit(riffA3, bar, { push: true, open: true })
  }
  // Bar 1 opens with the D5 that resolves phase 2's C5 — attacked, then falling away
  // over three rows (the phrase-end fall, `R24`) and cut before the tail's phrase.
  play(riffA3, L.P1, 0, LEAD_BITE, 12, [[0, 'd5'], [12, '---']])
  riffA3.fx(L.P1, 0, 4, 'R', hex('24'))
  wipe(riffA3, 3)
  kit(riffA3, 3, [[16, SNARE, 10], [18, SNARE, 11], [20, TOM_HI, 12], [22, TOM_HI, 13], [24, TOM_LO, 14], [26, TOM_LO, 15], [28, ROLL, 15]])
  wipe(riffA3, 7)
  kit(riffA3, 7, [[16, ROLL, 12], [22, ROLL, 13], [28, SNARE, 15], [30, SNARE, 15]])

  // Unit 3. Bars 9-10: the cell once more, the lead's peak phrase over it (Bb5 on the
  // downbeat of bar 9, the section's one peak). From bar 10 the VRC6 pulses and pulse 2
  // leave the off-beats for a HEMIOLA: accents every 12 rows across the last three
  // bars — eight of them, closing exactly on the turn's downbeat — while the saw keeps
  // the riff and then pumps the pedal, and the triangle holds. The accent roots close
  // Eb Eb -> D: the phrygian cadence that ends the section.
  play(riffA3, L.SAW, 8, SAW_RIFF, 12, ANVIL)
  play(riffA3, L.SAW, 10, SAW_RIFF, 12, pedal8ths([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60]))
  play(riffA3, L.TRI, 8, TRI_RIFF, 15, ANVIL, 12, TRI_MAP)
  play(riffA3, L.TRI, 10, BASS, 15, [[0, 'd3'], [60, '---']])
  fifths(riffA3, L.V1, FIFTH, 10, 8, CELL_STABS.slice(0, 4))
  fifths(riffA3, L.V2, FIFTH, 10, 8, CELL_STABS.slice(0, 4), -12)
  const HEMIOLA = [[0, 'd4'], [12, 'eb4'], [24, 'd4'], [36, 'eb4'], [48, 'c4'], [60, 'bb3'], [72, 'eb4'], [84, 'eb4']]
  fifths(riffA3, L.V1, FIFTH_LONG, 11, 9, HEMIOLA)
  fifths(riffA3, L.V2, FIFTH_LONG, 10, 9, HEMIOLA, -12)
  fifths(riffA3, L.P2, STAB2, 9, 9, HEMIOLA)
  play(riffA3, L.P1, 8, LEAD_BITE, 14, [[0, 'bb5', undefined, undefined, undefined, 15], [8, 'a5'], [12, 'g5'], [16, 'f5'], [24, 'eb5'], [28, 'd5'], [30, '---']])
  play(riffA3, L.P1, 10, LEAD, 12, [[0, 'd5'], [56, '===']])
  // The kit keeps its backbeat under the hemiola and puts a kick and a DPCM kick on
  // every accent; a long crash opens bar 9.
  for (let bar = 8; bar < 12; bar++) riffKit(riffA3, bar, { push: false, open: true })
  kit(riffA3, 9, [[0, CRASH_LONG, 11]])
  for (const [r] of HEMIOLA) {
    riffA3.put(L.NOISE, riffA3.at(9) + r, { note: 36, inst: KICK, vol: 14 })
    riffA3.put(L.DPCM, riffA3.at(9) + r, { note: KIT.kick, inst: KIT.inst, vol: 15 })
  }
}

// --- turn (frames 42-43): the alarm again, then the loop ----------------------------------
const turn = s.section('turn', 4)
alarmBars(turn, 'turn')

// --- form ----------------------------------------------------------------------------------
s.order(['alarm', 'riff-A', 'B', "riff-A'", 'bridge', 'phase-2', "riff-A''", 'turn'])
s.loopTo('riff-A')
s.qa({
  key: 'd-phrygian',
  accidentalFractionMax: 0.15,
  bpmRange: [148, 152],
  durationSec: [136, 142],
  rmsRange: [-21, -9],
  percussionGap: 16,
  notes:
    'D phrygian, 150 BPM on a 32nd grid (speed 3, 8 rows a beat, 32 a bar, 64 a frame = 2 bars). ' +
    'Accidentals: phase 2 (frames 28-35) is in F minor, a minor third up, the riff inverted — its ' +
    'Ab, Db and Gb are outside D phrygian; B (10-17) is D minor with E naturals and C# at both ' +
    'dominants; the riff itself carries one C# per chromatic approach; the bridge vrc6p2 line ' +
    'climbs chromatically. Non-diatonic devices: Neapolitan bII -> V7 -> i closing B (16:32 Eb, ' +
    '17:0 A7, resolving 18:0 Dm); a descending-fifths chain Dm Gm C F Bb twice (10:32-12:32 and ' +
    '14:0-16:0, read off the thirds on vrc6p1); a chromatic inner ascent D3 -> C4 on vrc6p2 ' +
    'across the bridge (22:0 through 27:0, a step every bar), landing on C — the pivot, bVII of ' +
    'D phrygian and V of F minor — into phase 2 at 28:0; Eb as the pivot back (35:32, bVII of F ' +
    'minor = bII of D phrygian). Suspensions on pulse 2: D4 11:20 -> C4 11:40 (9-8 over the C7 ' +
    'whose third enters 11:32), D4 13:4 -> C#4 13:40 (the cadential 4-3 over A7), Eb4 16:52 -> ' +
    'C#4 17:8 (the Neapolitan b2 to the leading tone); appoggiatura Bb4 13:32 -> A4 13:36 in the ' +
    'lead. Contrary motion at three cadences, all of them the phrygian bII -> i with the bass ' +
    'falling as the lead rises: riff A closes 9:32-9:48, saw Eb2 -> D2 under the lead Bb4 C5 D5; ' +
    "phase 2 closes 35:32 -> 36:0, saw Eb2 -> D2 under the lead Bb4 -> C5 -> riff A''s D5; and at " +
    "B's Neapolitan the saw falls Eb2 -> A1 (16:32 -> 17:0) while the lead rises C5 -> E5 (16:56 " +
    '-> 17:0). Metric: a 6-row tom cell ' +
    'carried unbroken through all six bridge frames, entering at 22:0, 23:2, 24:4, 25:0, 26:2, ' +
    '27:4; a tresillo on the saw and the DPCM kick, rows 0/12/24 of every bridge bar (22:0 on); ' +
    'hemiola accents every 12 rows, eight of them from 40:32 to 41:52, closing exactly on 42:0; ' +
    'the metric surprise is the dropped bar, D00 at 17:31, which makes B 8 + 7 bars; the fifth ' +
    'stabs sit a 32nd behind the riff (first at 2:5 against the riff at 2:4); the lead\'s first ' +
    "tail phrase is restated two rows late in A'' (37:2 against 5:0). The global peak is Db6, " +
    'pulse 1 at 35:0, the only note above C6 and 80 % of the way through a pass. percussionGap 16 ' +
    'with coverage 94 %: the report tool measures three gaps over 16 rows, and all three are ' +
    'composed. 0:1-0:63 and 42:1-42:63 are the alarm and the turn, where the saw stab answers ' +
    'itself over a crash and nothing else plays; 17:25-17:63 is an artifact of counting document ' +
    'rows — D00 at 17:31 ends that frame, so the gap actually played is seven rows. The bridge ' +
    'is covered by its tom cell every six rows. 0xy param 7 = 007, a fifth; 4x42 = 442; Rf1/Qf1 = ' +
    'a one-semitone fall/scoop at speed 15; R24 = a four-semitone fall at speed 2. rmsRange floor ' +
    '-21: the two-pass mix measures -20.05 dBFS with an unclamped peak of 0.902 and zero clamped ' +
    'samples, because the alarm, the turn and the half-time bridge rest on purpose (-23.7, -22.4, ' +
    '-21.2) while the driving sections run -20.4 to -19.4. The arrangement is mixed to that arc ' +
    'rather than raised to meet -20: phase 2 is both the loudest section (-19.42) and by far the ' +
    'brightest (zero-crossing rate 4457 against 3739-4078 everywhere else), which is what makes ' +
    'the second phase read as an escalation. The sawtooth stays at 12 for the riff and 13 only ' +
    'for the alarm stab, and the VRC6 pulses at 8-11, per the eight-voice headroom rule in §12.2.',
  renderChecksum: 1598448341,
})
s.check()
s.write('src/assets/songs/05-counterweight.json')
