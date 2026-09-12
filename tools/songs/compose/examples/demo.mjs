#!/usr/bin/env node
/** a throwaway generator that exercises every helper in `lib.mjs`.
 *
 *      node tools/songs/compose/examples/demo.mjs [out.json]
 *
 *  It writes to a temporary file by default and NEVER to `src/assets/songs/` — this is
 *  not an album piece and must not become one. It exists so a composer can read a
 *  working generator end to end, and so `tests/unit/compose.test.ts` has something that
 *  uses the whole surface: bank, instrument, dpcmKit, section, at, put, line, hits,
 *  chord, fx, echo, order, loopTo, qa, check, write, and the helpers n, hex, nib,
 *  noteName, CUT, REL and L.
 *
 *  Grid: speed 5 at tempo 150 = 180 BPM, rowHighlight 4 (16th rows), rowHighlight2 16
 *  (one bar), rowsPerPattern 64 = four bars a pattern.
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CUT, L, REL, Song, hex, n, nib, noteName } from '../lib.mjs'

const s = new Song({
  id: 'compose-demo',
  name: 'Compose Demo',
  author: 'pulsar authoring library',
  speed: 5,
  rowsPerPattern: 64,
  rowHighlight: 4,
  rowHighlight2: 16,
})

// --- instruments -------------------------------------------------------------------
// Four shared-bank entries, byte-identical to tests/fixtures/songs/shared-bank.json,
// plus two piece-specific ones the library names `x-compose-demo-*`.
const [LEAD, ECHO, BASS, KICK, SNARE, HAT] = s.bank('lead-bright', 'echo-thin', 'bass', 'kick', 'snare', 'hat-closed')
const KIT = s.dpcmKit()

/** The VRC6 lead: the chip's own attack is a duty macro that opens wide and narrows. */
const SAW = s.instrument('saw-bass', { volume: { values: [11, 12, 12, 11, 10], loop: 4 } })
const PAD = s.instrument('pad', {
  volume: { values: [0, 4, 7, 9, 10, 10], loop: 5, release: 5 },
  duty: { values: [7, 6, 5, 4, 3], loop: 4 },
  pitch: { values: [-4, 2, 1, 1, 0] },
})

// --- sections ----------------------------------------------------------------------
// E minor. The intro states the motif bare; A answers it over the gallop; B lifts the
// harmony to the relative major for four bars and hands the lead to the sawtooth.

const intro = s.section('intro', 4)
intro.line(L.P1, LEAD, 12, [
  [0, 0, 'e4'], [0, 8, 'g4'], [1, 0, 'b4', '4', hex('32')], [1, 12, 'a4'],
  [2, 0, 'g4'], [2, 8, 'e4'], [3, 0, 'b3'], [3, 12, '---'],
])
intro.echo(L.P1, L.P2, 3, ECHO, 8)
intro.hits(L.NOISE, HAT, 9, [[0, 0], [0, 8], [1, 0], [1, 8], [2, 0], [2, 8], [3, 0], [3, 8]])
intro.put(L.TRI, intro.at(0, 0), { note: n('e2'), inst: BASS, vol: 15 })
intro.put(L.TRI, intro.at(2, 0), { note: n('c2'), inst: BASS, vol: 15 })

const a = s.section('A', 8)
// Pulse 2 is silent on the downbeat of A — the echo lands three rows later — so it says
// so with a cut rather than inheriting whatever the previous pass left in the register
// file (§2.9 rule 2). Row 0 of A is the loop row.
a.put(L.P2, a.at(0, 0), { note: CUT })
// Lead: the motif, answered by its own inversion in the second four bars.
a.line(L.P1, LEAD, 13, [
  [0, 0, 'e4'], [0, 8, 'g4'], [1, 0, 'b4'], [1, 8, 'c5', '4', hex('32')], [2, 0, 'b4'], [2, 12, 'a4'],
  [3, 0, 'g4'], [3, 12, 'e4'],
  [4, 0, 'b4'], [4, 8, 'g4'], [5, 0, 'e4'], [5, 8, 'd4'], [6, 0, 'e4'], [6, 12, 'f#4'],
  [7, 0, 'g4'], [7, 12, '---'],
])
a.echo(L.P1, L.P2, 3, ECHO, 8)
// Bass: a sixteenth gallop on the VRC6 sawtooth, the triangle doubling an octave up.
for (let bar = 0; bar < 8; bar++) {
  const root = [n('e2'), n('e2'), n('c2'), n('d2'), n('e2'), n('e2'), n('c2'), n('b1')][bar]
  for (const row of [0, 3, 6, 8, 11, 14]) a.put(L.SAW, a.at(bar, row), { note: root, inst: SAW, vol: 11 })
  a.put(L.TRI, a.at(bar, 0), { note: root + 12, inst: BASS, vol: 15 })
  a.put(L.TRI, a.at(bar, 8), { note: root + 12, inst: BASS, vol: 15 })
}
// Harmony: one held chord a bar on VRC6 pulse 2, spelled as a 0xy triad.
for (let bar = 0; bar < 8; bar++) {
  const [root, third] = bar % 4 === 2 ? [n('c4'), 4] : [n('e4'), 3]
  a.chord(L.V2, PAD, 10, bar, 0, root, [third, 7])
}
// Drums: kick and snare on the noise lane over the DPCM pair, a fill every fourth bar.
for (let bar = 0; bar < 8; bar++) {
  a.hits(L.NOISE, KICK, 13, [[bar, 0], [bar, 10]])
  a.hits(L.NOISE, SNARE, 14, [[bar, 8]])
  a.hits(L.NOISE, HAT, 8, [[bar, 4], [bar, 12]])
  a.hits(L.DPCM, KIT.inst, 15, [[bar, 0]], KIT.kick)
  a.hits(L.DPCM, KIT.inst, 15, [[bar, 8]], KIT.snare)
  if (bar % 4 === 3) a.hits(L.NOISE, SNARE, 15, [[bar, 13], [bar, 14], [bar, 15]])
}

const b = s.section('B', 4)
// The lift: G major, the sawtooth taking the tune and the pulses answering underneath.
b.line(L.SAW, SAW, 12, [
  [0, 0, 'g3'], [0, 8, 'd4'], [1, 0, 'b3'], [1, 8, 'g3'],
  [2, 0, 'c4'], [2, 8, 'a3'], [3, 0, 'b3'], [3, 12, 'g3'],
])
b.line(L.P1, LEAD, 10, [
  [0, 0, 'b4'], [0, 12, 'a4'], [1, 0, 'g4'], [1, 12, 'd4'],
  [2, 0, 'e4'], [2, 12, 'g4'], [3, 0, 'd4'], [3, 12, '---'],
])
for (let bar = 0; bar < 4; bar++) {
  b.chord(L.V1, PAD, 9, bar, 0, n('g3') + (bar === 2 ? 5 : 0), [4, 7])
  b.chord(L.V1, PAD, 8, bar, 8, n('b3') + (bar === 2 ? 2 : 0), [3, 8])
  b.put(L.TRI, b.at(bar, 0), { note: n('g2'), inst: BASS, vol: 15 })
  b.put(L.TRI, b.at(bar, 8), { note: n('d3'), inst: BASS, vol: 15 })
  b.hits(L.NOISE, KICK, 13, [[bar, 0], [bar, 8]])
  b.hits(L.NOISE, HAT, 8, [[bar, 4], [bar, 12]])
  b.hits(L.DPCM, KIT.inst, 15, [[bar, 0]], KIT.kick)
}
// An effect-only cell: fade the pad out under the last bar of the lift...
b.fx(L.V1, 3, 8, 'A', nib(2, 0))
// ...release it into its macro tail...
b.put(L.V1, b.at(3, 12), { note: REL })
// ...and cut it, so nothing from B rings into the repeat of A.
b.put(L.V1, b.at(3, 15), { note: CUT })

// --- form --------------------------------------------------------------------------
s.order(['intro', 'A', 'B', 'A'])
s.loopTo('A')
s.qa({
  key: 'e-minor',
  bpmRange: [178, 182],
  durationSec: [10, 40],
  notes:
    'Demonstration piece for tools/songs/compose/lib.mjs — not an album track. E minor, ' +
    '180 BPM on 16th rows; the B section lifts to the relative major and hands the lead ' +
    'to the VRC6 sawtooth.',
})

s.check()
const summary = s.write(process.argv[2] ?? join(tmpdir(), 'pulsar-compose-demo.json'))
process.stdout.write(
  `  ${s.bpm.toFixed(2)} BPM, one bar = ${s.rowsPerBar} rows, bar 2 beat 3 = row ${s.at(2, 8)}, ` +
    `lead entry ${noteName(n('e4'))}, loop frame ${summary.loopFrame}\n`,
)
