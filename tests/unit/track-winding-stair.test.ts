/** Winding Stair (07) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides
 *  the rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/07-winding-stair.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/07-winding-stair.json')
const text = readFileSync(file, 'utf8')
const song: Song = parseSong(JSON.parse(text)).song
const ROWS = song.meta.rowsPerPattern
type Channel = Song['channels'][number]
type Cell = Song['patterns'][number]['rows'][number] & { row: number; frame: number }

function pattern(channel: Channel, frame: number) {
  const index = song.order[frame][song.channels.indexOf(channel)]
  return song.patterns.find((p) => p.channel === channel && p.index === index)!
}
/** Every cell the order reaches on one lane, tagged with its absolute row. */
function timeline(channel: Channel): Cell[] {
  return song.order.flatMap((_, frame) =>
    pattern(channel, frame).rows.map((cell) => ({ ...cell, row: frame * ROWS + cell.r, frame })))
}
const isAttack = (c: Cell) => c.note !== undefined && c.note >= 0
function attacks(channel: Channel, frames?: number[]): Cell[] {
  return timeline(channel).filter((c) => isAttack(c) && (frames === undefined || frames.includes(c.frame)))
}
function notesByRow(channel: Channel): Map<number, number> {
  return new Map(attacks(channel).map((c) => [c.row, c.note as number]))
}
function cellAt(channel: Channel, frame: number, r: number) {
  return pattern(channel, frame).rows.find((c) => c.r === r)
}
type WithFx = { fx?: readonly ({ cmd: string; param: number } | null)[] | undefined }
function hasFx(c: WithFx | undefined, cmd: string, param?: number) {
  return (c?.fx ?? []).some((e) => e !== null && e.cmd === cmd && (param === undefined || e.param === param))
}
/** `[row, note]` pairs, the shape every motif pin below compares. */
const shape = (cs: Cell[], base = 0) => cs.map((c) => [c.row - base, c.note as number])
const frames = (label: string) =>
  (song.extra!.qa as { form: string[] }).form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
const qa = song.extra!.qa as { key: string; loopFrame: number; channels: string[]; form: string[]; percussionGap: number }

/** THE SUBJECT, as pulse 1 states it at 0:0: `[row, MIDI]`. Its second half is its first
 *  half one G-minor scale step lower — the stair, and the generator of the whole piece. */
const SUBJECT: number[][] = [
  [0, 74], [4, 79], [6, 77], [8, 75], [12, 74], [18, 72], [20, 70],
  [24, 72], [28, 77], [30, 75], [32, 74], [36, 72], [42, 70], [44, 69],
]

describe('Winding Stair — a descent in triple metre', () => {
  it('is committed exactly as its generator wrote it, in 3/4 at 150 BPM, in G minor', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(6)
    expect(song.meta.rowHighlight).toBe(4) // a beat is four 16th rows
    expect(song.meta.rowHighlight2).toBe(12) // and a bar is THREE of them
    expect(song.meta.rowsPerPattern).toBe(48) // so a frame is four 3/4 bars
    expect(song.order).toHaveLength(28)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('g-minor')
    expect(qa.loopFrame).toBe(3) // the exposition plays once; the loop starts the stair again
    expect(qa.form).toEqual([
      'entries', 'entries', 'entries', 'A', 'A', 'A', 'A', 'B', 'B',
      'stretto', 'stretto', 'stretto', 'stretto', 'landing', 'landing',
      "A'", "A'", "A'", "A'", 'spiral', 'spiral', 'spiral',
      'coda', 'coda', 'coda', 'coda', 'turn', 'turn',
    ])
    // instrument 0 is this piece's own voice, not a shared-bank drum (the album gate in
    // soundtrack.test.ts compares instrument 0's macros across every song)
    expect(song.instruments[0].name).toBe('x-winding-stair-upper')
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-winding-stair-|[a-z-]+$)/)
  })

  it('the exposition: three entries a fifth apart, and three rhythms, not three lanes', () => {
    const HEAD = SUBJECT.slice(0, 7) // the subject's first link, two bars
    // entry 1 — pulse 1 alone at 0:0
    expect(shape(attacks('pulse1', [0])).slice(0, 7)).toEqual(HEAD)
    // entry 2 — VRC6 pulse 1 at 0:24, a real fifth below, while pulse 1 is still sounding
    const answer = attacks('vrc6p1', [0])
    expect(shape(answer, 24)).toEqual(HEAD.map(([r, note]) => [r, note - 7]))
    expect(answer[0].row).toBe(24) // two bars after the subject, not a beat behind it
    // THE THING THAT MAKES IT AN EXPOSITION: pulse 1 does NOT carry on with the subject's
    // second link, because that link is the first link one step lower and would lock to
    // the answer at a constant fifth on every shared row. It hands over to a
    // countersubject whose attacks share NO row with the answer, and the b-flat of 0:20 is
    // tied through the answer's head so the entry is the only thing that moves.
    const answerRows = new Set(answer.map((c) => c.r))
    const cs1 = attacks('pulse1', [0]).filter((c) => c.r >= 24)
    expect(cs1.length).toBeGreaterThanOrEqual(4)
    expect(cs1.filter((c) => answerRows.has(c.r))).toHaveLength(0)
    expect(cellAt('pulse1', 0, 24)).toBeUndefined() // the tie across 0:24
    expect(cellAt('pulse1', 0, 20)?.note).toBe(70)
    // entry 3 — the sawtooth at 1:0, a fifth below THAT, and the only voice that states
    // the whole four-bar stair in this section. Two tonal adjustments, long notes only.
    const third = attacks('vrc6saw', [1, 2]).filter((c) => c.row < 48 + 48)
    const tonal: Record<number, number> = { 8: 62, 20: 57 }
    expect(shape(third, 48)).toEqual(SUBJECT.map(([r, note]) => [r, tonal[r] ?? note - 14]))
    expect(third[9].note).toBe(61) // the short d flat at 1:30 stays: a chromatic passing eighth
    expect(third[12].note).toBe(56) // and the short a flat at 1:42 makes B flat 7 -> E flat
    // …and VRC6 pulse 1 makes the same handover at 1:0, for the same reason
    const sawRows = new Set(attacks('vrc6saw', [1]).filter((c) => c.r < 24).map((c) => c.r))
    const cs2 = attacks('vrc6p1', [1]).filter((c) => c.r < 24)
    expect(cs2.length).toBeGreaterThanOrEqual(4)
    expect(cs2.filter((c) => sawRows.has(c.r))).toHaveLength(0)
    // three lanes, three attack-row sets, and pulse 2 is not one of them
    const rowsOf = (ch: Channel, f: number[]) => attacks(ch, f).map((c) => c.row).join()
    expect(rowsOf('pulse1', [1])).not.toBe(rowsOf('vrc6p1', [1]))
    expect(rowsOf('pulse1', [1])).not.toBe(rowsOf('vrc6saw', [1]))
    expect(attacks('pulse2', [0, 1, 2])).toHaveLength(0)
  })

  it('the lead has two colours, and the bare sections get the second one', () => {
    const duty = (inst: number) => {
      const i = song.instruments[inst].macros.duty
      return i < 0 ? [] : [...song.sequences.duty[i].values]
    }
    const wide = song.instruments.findIndex((i) => i.name === 'x-winding-stair-upper')
    const thin = song.instruments.findIndex((i) => i.name === 'x-winding-stair-upper-thin')
    expect(wide).toBe(0) // the album gate compares instrument 0's macros across every song
    expect(duty(wide)).toEqual([2, 1, 1]) // 50 % narrowing to 25 %
    expect(duty(thin)).toEqual([1, 1, 0]) // 25 % narrowing to 12.5 % — a different singer
    // `landing` (two voices and nothing else) and the coda's two answers over the flat II
    for (const f of [13, 14, 23, 25]) {
      const cs = attacks('pulse1', [f])
      expect(cs.length, `pulse1 in frame ${f}`).toBeGreaterThan(0)
      for (const c of cs) expect(c.inst, `pulse1 ${c.frame}:${c.r}`).toBe(thin)
    }
    // and the sections that carry the subject keep the first colour
    for (const c of attacks('pulse1', [0, 3, 9, 15, 26])) expect(c.inst).toBe(wide)
  })

  it('A: pulse 2 is an independent suspension chain for the whole section', () => {
    const A = frames('A')
    const p2 = attacks('pulse2', A)
    expect(p2.length).toBeGreaterThanOrEqual(24)
    const p1Rows = new Set(attacks('pulse1', A).map((c) => c.row))
    // §9.2 asks that 40 % of pulse 2's attacks fall where pulse 1 has none. Every one of
    // them does: the chain lives on rows 2 and 10 of the bar, which the subject never uses.
    const free = p2.filter((c) => !p1Rows.has(c.row)).length
    expect(free / p2.length).toBe(1)
    for (const c of p2.filter((x) => x.row < 14 * 12)) expect([2, 10]).toContain(c.row % 12)
    // and it stays below the lead wherever both sound
    const p1At = notesByRow('pulse1')
    for (const c of p2) if (p1At.has(c.row)) expect(c.note!).toBeLessThan(p1At.get(c.row)!)
    // the chain itself: struck on the last eighth of a bar, held through the downbeat
    // (nothing on it), resolved DOWN BY STEP two rows into the new chord
    const byRow = new Map(p2.map((c) => [c.row, c.note as number]))
    const struck = p2.filter((c) => c.row % 12 === 10)
    expect(struck.length).toBeGreaterThanOrEqual(12)
    for (const c of struck) {
      expect(byRow.has(c.row + 2), `pulse2 ${c.frame}:${c.r} is restruck on the bar line`).toBe(false)
      const next = byRow.get(c.row + 4)
      expect(next, `the suspension at ${c.frame}:${c.r} resolves`).toBeDefined()
      expect(c.note! - next!, `${c.frame}:${c.r} resolves DOWN by step`).toBeGreaterThan(0)
      expect(c.note! - next!).toBeLessThanOrEqual(2)
    }
    // the cadential 4-3 over the returning tonic: c4 at 4:34, bb3 at 4:38
    expect(cellAt('pulse2', 4, 34)?.note).toBe(60)
    expect(cellAt('pulse2', 4, 36)?.note).toBeUndefined() // held over the bar line…
    expect(hasFx(cellAt('pulse2', 4, 36), '4', 0x31)).toBe(true) // …and singing on it
    expect(cellAt('pulse2', 4, 38)?.note).toBe(58)
    expect(hasFx(cellAt('pulse2', 4, 38), '4', 0)).toBe(true) // the vibrato stops on the resolution
    // contrary motion at that cadence: the melody rises a step into 4:36 while the bass
    // falls a fifth
    expect(cellAt('pulse1', 4, 32)?.note).toBe(69)
    expect(cellAt('pulse1', 4, 36)?.note).toBe(70)
    expect(cellAt('vrc6saw', 4, 24)!.note!).toBeGreaterThan(cellAt('vrc6saw', 4, 36)!.note!)
  })

  it('B: a six-link chromatic bass descent under voices that barely move', () => {
    const walk = [[7, 0, 43], [7, 12, 42], [7, 24, 41], [7, 36, 40], [8, 0, 39], [8, 12, 38]]
    for (const [f, r, note] of walk) expect(cellAt('triangle', f, r)?.note, `${f}:${r}`).toBe(note)
    // it is chromatic, not a scale: every link is exactly one semitone
    for (let i = 1; i < walk.length; i++) expect(walk[i - 1][2] - walk[i][2]).toBe(1)
    // the upper voices hold — one attack a bar each, and they FADE rather than sit
    for (const ch of ['vrc6p1', 'vrc6p2'] as const) {
      expect(attacks(ch, [7])).toHaveLength(4)
      expect(timeline(ch).some((c) => c.frame === 7 && hasFx(c, 'A', 0x20))).toBe(true)
    }
    // the one section with no kick and no backbeat: hats and metal ticks only, six bars
    const kit = attacks('noise', [7])
    expect(kit.every((c) => c.note === 45 || c.note === 44)).toBe(true)
    // and two lanes are silent through it
    expect(attacks('vrc6saw', [7])).toHaveLength(0)
    expect(attacks('pulse2', [7])).toHaveLength(0)
  })

  it('stretto: the same four entries one bar apart, each a fifth under the last', () => {
    const head = SUBJECT.slice(0, 7)
    const entries: [Channel, number, number][] = [
      ['pulse1', 0, 0], ['vrc6p1', 12, -7], ['vrc6p2', 24, -14], ['vrc6saw', 36, -19],
    ]
    for (const [ch, at, semis] of entries) {
      const cs = attacks(ch, [9, 10]).filter((c) => c.row >= 9 * ROWS + at && c.row < 9 * ROWS + at + 24)
      const expected = head.map(([r, note]) => [r, at === 24 && r === 8 ? 62 : note + semis])
      expect(shape(cs, 9 * ROWS + at), `${ch} enters at 9:${at}`).toEqual(expected)
    }
    // four voices, four different bars, and the kit is at its densest here
    expect(attacks('dpcm', frames('stretto')).length).toBeGreaterThanOrEqual(36)
    expect(attacks('dpcm', frames('A'))).toHaveLength(0) // DPCM is this section's alone
    // the slam: five lanes on ONE attack-row set for four bars, and only there
    const slamRows = (ch: Channel) => attacks(ch, [11]).map((c) => c.r).join()
    const p1 = slamRows('pulse1')
    for (const ch of ['vrc6p1', 'vrc6p2', 'vrc6saw', 'triangle'] as const) expect(slamRows(ch), ch).toBe(p1)
    expect(slamRows('pulse1')).not.toBe(attacks('pulse1', [10]).map((c) => c.r).join())
  })

  it('the two hemiolas regroup two bars as 3 x 8 rows, and they do it differently', () => {
    const groups = [0, 8, 16]
    // 6:24 — the inner voices, the lead and the kick take the groups; the triangle holds
    for (const ch of ['pulse1', 'vrc6p1', 'vrc6p2'] as const) {
      expect(attacks(ch, [6]).filter((c) => c.r >= 24).map((c) => c.r - 24), ch).toEqual(groups)
    }
    for (const r of groups) expect(cellAt('noise', 6, 24 + r)?.note, `kick at 6:${24 + r}`).toBe(36)
    expect(attacks('triangle', [6]).filter((c) => c.r >= 24)).toHaveLength(1)
    // 12:24 — the sawtooth and the SNARE take the groups instead, the backbeat is gone,
    // the hats keep the 4-row beat underneath, and pulse 1 holds one note through all 24
    expect(attacks('vrc6saw', [12]).filter((c) => c.r >= 24).map((c) => c.r - 24)).toEqual(groups)
    for (const r of groups) expect(cellAt('noise', 12, 24 + r)?.note, `snare at 12:${24 + r}`).toBe(41)
    expect(attacks('noise', [12]).filter((c) => c.r >= 24 && c.note === 36)).toHaveLength(0)
    // the 4-row beat still runs underneath, alternating snare and hat, all six of it
    const beat = attacks('noise', [12]).filter((c) => c.r >= 24).map((c) => c.r)
    expect([24, 28, 32, 36, 40, 44].every((r) => beat.includes(r))).toBe(true)
    expect(beat.filter((r) => r % 4 !== 0)).toHaveLength(0)
    expect(attacks('pulse1', [12]).filter((c) => c.r >= 24)).toHaveLength(1)
    // the two are not the same cells
    expect(attacks('vrc6p1', [12]).filter((c) => c.r >= 24)).toHaveLength(0)
  })

  it('landing: two voices and nothing else, and the subject is upside down', () => {
    for (const ch of ['pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p2', 'vrc6saw'] as const) {
      expect(attacks(ch, [13, 14]), ch).toHaveLength(0)
    }
    // the diatonic inversion about d5: every scale step of the subject mirrored, so the
    // fourth-leaps fall and the walk rises. In G minor the mirror of rung i is rung 50 - i.
    const LADDER = [0, 2, 3, 5, 7, 8, 10]
    const rung = (i: number) => 31 + 12 * Math.floor(i / 7) + LADDER[((i % 7) + 7) % 7]
    const index = (midi: number) => Array.from({ length: 56 }, (_, i) => rung(i)).indexOf(midi)
    expect(shape(attacks('pulse1', [13]), 13 * ROWS)).toEqual(SUBJECT.map(([r, note]) => [r, rung(50 - index(note))]))
    // and VRC6 pulse 1 answers it a BAR later — closer than the exposition's two
    const answer = attacks('vrc6p1', [13, 14]).filter((c) => c.row >= 13 * ROWS + 12 && c.row < 13 * ROWS + 60)
    expect(answer[0].row - 13 * ROWS).toBe(12)
    expect(answer[0].note).toBe(69) // three scale steps under the inversion's d5
  })

  it("A': the subject in augmentation in the triangle under the subject inverted above", () => {
    // every value twice as long, three octaves down: four bars become eight
    const aug = attacks('triangle', [15, 16])
    expect(shape(aug, 15 * ROWS)).toEqual(SUBJECT.map(([r, note]) => [r * 2, note - 36]))
    expect(aug.at(-1)!.row - 15 * ROWS).toBe(88) // the last note lands in bar 8, not past it
    // the sawtooth is silent for exactly those eight bars — the thinnest full-band texture
    expect(attacks('vrc6saw', [15, 16])).toHaveLength(0)
    // pulse 1 has the inversion over it, then the subject returns AT PITCH at 17:0, which
    // the pattern de-duplicator proves is literally A's own pattern
    const p1 = song.channels.indexOf('pulse1')
    expect(song.order[17][p1]).toBe(song.order[3][p1])
    // the second cadential suspension: g4 at 18:32 over the dominant, f#4 at 18:40
    expect(cellAt('pulse2', 18, 34)?.note).toBe(67)
    expect(cellAt('pulse2', 18, 38)?.note).toBe(66)
  })

  it('the 5-row cell carries its phase across four frames and stops before the seam', () => {
    const cell = attacks('vrc6p2', [19, 20, 21, 22])
    const base = 19 * ROWS
    // one attack every five rows, unbroken from 19:0 to 22:46 — 39 of them
    expect(cell.map((c) => c.row - base)).toEqual(Array.from({ length: 39 }, (_, i) => i * 5))
    // the entry rows are (-48k) mod 5, which is 0, 2, 4, 1 — not 0, 1, 2, 3
    expect([19, 20, 21, 22].map((f) => attacks('vrc6p2', [f])[0].r)).toEqual([0, 2, 4, 1])
    expect(cell.at(-1)!.frame).toBe(22)
    expect(cell.at(-1)!.r).toBe(46)
    // `Pxx` is a channel mode, so the detune is RESTATED on the cell's first attack in
    // every frame rather than left latched across three of them
    for (const f of [19, 20, 21, 22]) {
      const first = attacks('vrc6p2', [f])[0]
      expect(hasFx(first, 'P', 0x82), `P82 restated at ${f}:${first.r}`).toBe(true)
    }
    expect(cell.filter((c) => hasFx(c, 'P'))).toHaveLength(4)
    // THE METRIC SURPRISE: one whole bar at 21:0 where the kit stops and only the cell keeps time
    expect(attacks('noise', [21]).filter((c) => c.r < 12)).toHaveLength(0)
    expect(cell.filter((c) => c.frame === 21 && c.r < 12).length).toBeGreaterThanOrEqual(2)
  })

  it('the coda: the Neapolitan twice, in two voicings, each cancelled a bar later', () => {
    // root position at 23:0 — `047` is decimal 71 — and first inversion at 25:0 — `038` is 56
    expect(cellAt('vrc6p1', 23, 0)?.note).toBe(56) // ab3
    expect(hasFx(cellAt('vrc6p1', 23, 0), '0', 71)).toBe(true)
    expect(cellAt('vrc6p1', 25, 0)?.note).toBe(60) // c4, the note the bass is already holding
    expect(hasFx(cellAt('vrc6p1', 25, 0), '0', 56)).toBe(true)
    // both breathe: 742 tremolo, cancelled with 7x0 where x > 0 and never a bare 700
    for (const f of [23, 25]) {
      expect(hasFx(cellAt('vrc6p1', f, 0), '7', 0x42)).toBe(true)
      expect(hasFx(cellAt('vrc6p1', f, 24), '0', 0)).toBe(true)
      expect(hasFx(cellAt('vrc6p1', f, 24), '7', 0x10)).toBe(true)
    }
    // the bass under the two chords: A flat in root position, then c held for the inversion
    expect(cellAt('triangle', 23, 0)?.note).toBe(32) // ab1
    expect(cellAt('triangle', 25, 0)?.note).toBe(36) // c2
    // the melody's own a-flat falls by step to g in both
    for (const f of [23, 25]) {
      expect(cellAt('pulse1', f, 12)?.note, `${f}:12`).toBe(68)
      expect(cellAt('pulse1', f, 18)?.note, `${f}:18`).toBe(67)
    }
    // the sawtooth states the subject two octaves down, and the RESTATEMENT glides where
    // the first was struck: `3xx` on every note after the first, cancelled with `100`
    expect(shape(attacks('vrc6saw', [22]), 22 * ROWS)).toEqual(SUBJECT.map(([r, note]) => [r, note - 24]))
    const glide = attacks('vrc6saw', [24])
    expect(glide.slice(1).every((c) => hasFx(c, '3', 0x18))).toBe(true)
    expect(hasFx(cellAt('vrc6saw', 24, 0), '3')).toBe(false)
    expect(hasFx(cellAt('vrc6saw', 25, 0), '1', 0)).toBe(true)
  })

  it('the turn climbs to the piece\'s one highest note and hands back a bare dominant', () => {
    const all = attacks('pulse1')
    const peak = Math.max(...all.map((c) => c.note!))
    const where = all.filter((c) => c.note === peak)
    expect(peak).toBe(82) // b flat 5
    expect(where).toHaveLength(1)
    expect(where[0].frame).toBe(26)
    expect(where[0].r).toBe(44)
    expect(where[0].frame).toBeGreaterThanOrEqual((song.order.length * 2) / 3) // the last third
    // no fill at the seam: the last bar carries one kick and nothing after the second beat
    const last = song.order.length - 1
    const tail = attacks('noise', [last]).filter((c) => c.r >= 36)
    expect(tail.map((c) => c.r)).toEqual([36, 38, 40])
    expect(attacks('noise', [last]).filter((c) => c.r >= 41)).toHaveLength(0)
    // and only two lanes are still sounding into it
    for (const ch of ['vrc6saw', 'pulse2'] as const) expect(attacks(ch, [last]).some((c) => c.r >= 36)).toBe(false)
  })

  it('states every lane at the loop row, and nothing is latched across the seam', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // every channel mode this piece writes is cancelled with the cancel the DRIVER
    // honours: 4x0, 000, A00, P80, 100 (never 300) and 7x0 with x > 0 (never 700)
    const OFF: Record<string, number> = { '4': 0, '0': 0, A: 0, P: 0x80, '1': 0, '7': 0x10 }
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of Object.keys(OFF)) {
        const last = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (last !== undefined) {
          expect(hasFx(last, cmd, OFF[cmd]), `${ch}: ${cmd}xx still standing at ${last.frame}:${last.r}`).toBe(true)
        }
      }
      expect(cells.some((c) => hasFx(c, '3', 0)), `${ch}: 300 only FREEZES a portamento`).toBe(false)
      expect(cells.some((c) => hasFx(c, '7', 0)), `${ch}: 700 REPLAYS the tremolo memory`).toBe(false)
    }
  })

  it('anti-vacuity: the pins can fail — a straightened stair is caught', () => {
    // the subject's two halves really are one scale step apart, not a literal repeat
    expect(SUBJECT.slice(7).map(([, n]) => n)).not.toEqual(SUBJECT.slice(0, 7).map(([, n]) => n))
    // the cell really is 5 rows and not the frame-aligned 6 a 48-row frame would hide
    const cell = attacks('vrc6p2', [19]).map((c) => c.r)
    expect(cell[1] - cell[0]).toBe(5)
    expect(48 % (cell[1] - cell[0])).not.toBe(0)
    // and the inversion is not the subject
    expect(shape(attacks('pulse1', [13]), 13 * ROWS)).not.toEqual(SUBJECT)
  })
})
