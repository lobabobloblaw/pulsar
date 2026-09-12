/** Crooked Mile (10) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides
 *  the rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/10-crooked-mile.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/10-crooked-mile.json')
const text = readFileSync(file, 'utf8')
const song: Song = parseSong(JSON.parse(text)).song
const ROWS = song.meta.rowsPerPattern
const BAR = song.meta.rowHighlight2
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
function cellAt(channel: Channel, frame: number, r: number) {
  return pattern(channel, frame).rows.find((c) => c.r === r)
}
type WithFx = { fx?: readonly ({ cmd: string; param: number } | null)[] | undefined }
function hasFx(c: WithFx | undefined, cmd: string, param?: number) {
  return (c?.fx ?? []).some((e) => e !== null && e.cmd === cmd && (param === undefined || e.param === param))
}
/** `[row, note]` pairs relative to `base` — the shape every motif pin below compares. */
const shape = (cs: Cell[], base = 0) => cs.map((c) => [c.row - base, c.note as number])
const qa = song.extra!.qa as {
  key: string; loopFrame: number; channels: string[]; form: string[]
  bpmRange: [number, number]; durationSec: [number, number]
}

/** THE THREE GROUPS of a 2+2+3 bar start on these rows; `rowHighlight` also marks row 12,
 *  which is INSIDE the long group — the mismatch the whole piece is written around. */
const HEADS = [0, 4, 8]
const CROOK = 12

/** M, THE SUBJECT, as pulse 1 states it at 1:0: `[row, MIDI]`. A foot, a rising fifth,
 *  then the walk back down; bar 1 has six attacks and closes on the crooked row 12, bar 2
 *  has four and holds the long group whole. */
const M: number[][] = [
  [0, 72], [2, 79], [4, 77], [6, 76], [8, 74], [12, 76],
  [14, 79], [16, 77], [18, 76], [22, 72],
]

describe('Crooked Mile — seven eighths, grouped 2+2+3', () => {
  it('is committed exactly as its generator wrote it, in 7/8 at 128.571 BPM, in C major', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(7)
    expect(song.meta.rowHighlight).toBe(4) // a beat is four 16th rows
    expect(song.meta.rowHighlight2).toBe(14) // and a bar is SEVEN EIGHTHS, not eight
    expect(song.meta.rowsPerPattern).toBe(56) // so a frame is four 7/8 bars
    expect((24 * song.meta.tempo) / (song.meta.speed * song.meta.rowHighlight)).toBeCloseTo(128.571, 3)
    expect(song.order).toHaveLength(20)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('c-major')
    expect(qa.loopFrame).toBe(1) // the intro plays once; the loop starts the walk again
    expect(qa.form).toEqual([
      'gate', 'walk', 'walk', 'walk', 'stile', 'stile', 'broad', 'broad',
      'walk2', 'walk2', 'walk2', 'hollow', 'hollow', 'climb', 'climb', 'climb',
      'crest', 'crest', 'turn', 'turn',
    ])
    // the section lengths are deliberately unequal: 1, 3, 2, 2, 3, 2, 3, 2, 2 frames
    const lengths = [...new Set(qa.form)].map((label) => qa.form.filter((l) => l === label).length)
    expect(new Set(lengths).size).toBeGreaterThan(1)
    // instrument 0 is this piece's own lead, not a shared-bank drum (the album gate in
    // soundtrack.test.ts compares instrument 0's macros across every song)
    expect(song.instruments[0].name).toBe('x-crooked-mile-step')
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-crooked-mile-|[a-z-]+$)/)
  })

  it('M: a rising fifth and a walk back down, with the hitch on the crooked row 12', () => {
    expect(shape(attacks('pulse1', [1]).slice(0, 10), ROWS)).toEqual(M)
    // the signature leap is a FIFTH and it is the only interval in M wider than a third
    const steps = M.slice(1).map(([, note], i) => note - M[i][1])
    expect(steps[0]).toBe(7)
    expect(steps.slice(1).filter((d) => Math.abs(d) > 3)).toHaveLength(1) // the final e5 -> c5
    // bar 1 ends ON row 12 — inside the long group, where rowHighlight marks a beat the
    // metre does not have — and bar 2 answers with four attacks and a held long group
    expect(M.filter(([r]) => r < BAR).map(([r]) => r)).toEqual([0, 2, 4, 6, 8, CROOK])
    expect(M.filter(([r]) => r >= BAR).map(([r]) => r - BAR)).toEqual([0, 2, 4, 8])
  })

  it('M is augmented into 7/4, re-orchestrated onto the sawtooth, and doubled in octaves', () => {
    // AUGMENTATION — `broad` at 6:0: every value twice as long, so M's two 7/8 bars become
    // one 7/4 bar and one, and the augmented subject states the quarter grid itself.
    const aug = shape(attacks('pulse1', [6]), 6 * ROWS)
    expect(aug.map(([r]) => r)).toEqual(M.map(([r]) => r * 2))
    // one note moves: M's e5 would be a tritone over the borrowed flat VII, so it is d5
    aug.forEach(([, note], i) => expect(note).toBe(i === 8 ? M[i][1] - 2 : M[i][1]))
    // RE-ORCHESTRATION — `walk2` at 8:0: the sawtooth has M at pitch an octave down, which
    // is the second lead colour, and pulse 1 says almost nothing for two whole frames.
    expect(shape(attacks('vrc6saw', [8]).slice(0, 10), 8 * ROWS)).toEqual(M.map(([r, note]) => [r, note - 12]))
    expect(attacks('pulse1', [8]).length + attacks('pulse1', [9]).length).toBeLessThan(12)
    expect(attacks('vrc6saw', [8]).length + attacks('vrc6saw', [9]).length).toBeGreaterThan(30)
    // OCTAVES — `crest` at 16:0: pulse 1 and VRC6 pulse 1 on the same line an octave apart,
    // for four bars and not a bar more (§2.1's fourth sanctioned break).
    const lead = attacks('pulse1', [16]).filter((c) => c.r < 4 * BAR)
    const under = attacks('vrc6p1', [16]).filter((c) => c.r < 4 * BAR)
    expect(under.map((c) => [c.r, c.note])).toEqual(lead.map((c) => [c.r, (c.note as number) - 12]))
    expect(attacks('vrc6p1', [16]).filter((c) => c.r >= 4 * BAR).length).toBeLessThan(under.length)
  })

  it('the 3-row cell carries its phase across three frames and resolves onto a downbeat', () => {
    // The dotted-eighth engine: an attack every THREE rows on VRC6 pulse 1, written straight
    // through `walk`'s flat 168-row grid, so 56 = 18*3 + 2 carries the phase by itself.
    const cell = attacks('vrc6p1', [1, 2, 3])
    expect(cell).toHaveLength(56)
    for (const c of cell) expect((c.row - ROWS) % 3).toBe(0)
    // entry row of frame k is `(-56k) mod 3` — 0, 1, 2, and NOT a guess
    expect([1, 2, 3].map((f) => attacks('vrc6p1', [f])[0].r)).toEqual([0, 1, 2])
    expect([0, 1, 2]).toEqual([0, 1, 2].map((k) => ((-56 * k) % 3 + 3) % 3))
    // the last attack is 3:53, and the next one in the cycle lands on the DOWNBEAT of the
    // frame after — 4:0, where V1 states it on the clockwork instrument one last time
    expect(cell[cell.length - 1].row).toBe(3 * ROWS + 53)
    const resolution = cellAt('vrc6p1', 4, 0)!
    expect(resolution.note).toBe(60)
    expect(song.instruments[resolution.inst as number].name).toBe('x-crooked-mile-clock')
    // and the cell does not run anywhere else: no other frame has V1 on a 3-row grid
    expect(attacks('vrc6p1', [4]).length).toBeLessThan(12)
  })

  it('the 7/4 regrouping: the kit states seven quarters and nothing between them', () => {
    // `broad` hears the same 56-row frame as TWO BARS OF 7/4 — 28 rows each, accents every
    // four rows. The kit is what makes that legible, so EVERY noise attack in the section
    // lands on a quarter and none between.
    const kit = attacks('noise', [6, 7])
    expect(kit.length).toBeGreaterThan(24)
    for (const c of kit) expect(c.r % 4).toBe(0)
    // seven quarters a bar, four bars of 7/4 across the two frames
    for (const frame of [6, 7]) {
      for (const half of [0, 28]) {
        const q = attacks('noise', [frame]).filter((c) => c.r >= half && c.r < half + 28)
        expect(q.length).toBeGreaterThanOrEqual(6)
      }
    }
    // the held common tone: VRC6 pulse 2 attacks ONCE in the whole of frame 6 and sustains
    expect(attacks('vrc6p2', [6])).toHaveLength(1)
    expect(cellAt('vrc6p2', 6, 0)!.note).toBe(60) // c4 — root of C, ninth of the flat VII
    // and the section is the only place the piece leaves the key for a whole bar
    expect(attacks('triangle', [6]).some((c) => (c.note as number) % 12 === 10)).toBe(true) // b flat
  })

  it('pulse 2 is an independent voice for the whole of stile, on a 4-row cell', () => {
    const q = attacks('pulse2', [4, 5])
    expect(q).toHaveLength(28)
    // a QUARTER against a SEVEN-row bar: it lands on the group heads in even bars and
    // between them in odd ones, realigning every two bars
    for (const c of q) expect((c.row - 4 * ROWS) % 4).toBe(0)
    const inBar = (c: Cell) => (c.row - 4 * ROWS) % BAR
    expect(q.filter((c) => HEADS.includes(inBar(c))).length).toBeGreaterThan(6)
    expect(q.filter((c) => !HEADS.includes(inBar(c)) && inBar(c) !== CROOK).length).toBeGreaterThan(6)
    // its own rhythm: at least 40 % of its attacks fall where pulse 1 has none (§9.2)
    const leadRows = new Set(attacks('pulse1', [4, 5]).map((c) => c.row))
    expect(q.filter((c) => !leadRows.has(c.row)).length / q.length).toBeGreaterThanOrEqual(0.4)
    // and its own contour: at the cadence (5:8) it FALLS while pulse 1 rises
    const at = (row: number) => q.find((c) => c.row === 5 * ROWS + row)!.note as number
    expect(at(4)).toBeGreaterThan(at(8))
    const lead = (row: number) => cellAt('pulse1', 5, row)!.note as number
    expect(lead(0)).toBeLessThan(lead(4))
    expect(lead(4)).toBeLessThan(lead(8))
  })

  it('device 1: four chained secondaries, voiced as two chromatic guide-tone lines', () => {
    // E7 (4:36) -> A7 (4:42) -> D7 (4:50) -> G7 (5:0) -> C (5:8). VRC6 pulse 1 takes the
    // sevenths falling into the next chord's third; VRC6 pulse 2 takes five chromatic links
    // a tritone under it. Every raised tone is in one of those INNER voices — the lead
    // never leaves the key.
    const chain: [number, number][] = [[4, 36], [4, 42], [4, 50], [5, 0], [5, 8]]
    expect(chain.map(([f, r]) => cellAt('vrc6p1', f, r)!.note)).toEqual([62, 61, 60, 59, 60]) // d4 c#4 c4 b3 c4
    expect(chain.map(([f, r]) => cellAt('vrc6p2', f, r)!.note)).toEqual([56, 55, 54, 53, 52]) // g#3 g3 f#3 f3 e3
    // over each of the four dominants the two lines ARE that dominant's tritone; on the
    // fifth chord, the tonic they arrive at, they have resolved outward to a major sixth
    const gap = ([f, r]: [number, number]) =>
      (cellAt('vrc6p1', f, r)!.note as number) - (cellAt('vrc6p2', f, r)!.note as number)
    expect(chain.slice(0, 4).map(gap)).toEqual([6, 6, 6, 6])
    expect(gap(chain[4])).toBe(8)
    // the lead is diatonic through the whole chain
    for (const c of attacks('pulse1', [4, 5])) expect([0, 2, 4, 5, 7, 9, 11]).toContain((c.note as number) % 12)
    // stile is the section whose HARMONIC RHYTHM differs: the chords change at rows 0 and 8
    expect(cellAt('triangle', 4, 0)).toBeDefined()
    expect(cellAt('triangle', 4, 8)).toBeDefined()
  })

  it('device 2: a chromatic mediant on a stationary e, quitted to F and never to A minor', () => {
    // E major from C: VRC6 pulse 2 sounds e3 ONCE at 11:0 and holds it through the whole
    // frame, so the chord changes under a note that does not move.
    expect(attacks('vrc6p2', [11])).toHaveLength(1)
    expect(cellAt('vrc6p2', 11, 0)!.note).toBe(52) // e3
    // the raised third that makes the triad major, in an inner voice, for two bars
    expect(cellAt('vrc6p1', 11, 2 * BAR)!.note).toBe(68) // g#4
    expect(cellAt('vrc6p1', 11, 3 * BAR)!.note).toBe(68)
    // it is quitted to F — the stationary e rising a semitone to f — at 12:0, and A minor
    // is not touched: the bass of `hollow` is only c, e and then f, d, g
    expect(cellAt('vrc6p2', 12, 0)!.note).toBe(53) // f3
    expect(cellAt('vrc6p1', 12, 0)!.note).toBe(69) // a4 — the g# resolves up
    expect([...new Set(attacks('triangle', [11]).map((c) => (c.note as number) % 12))].sort()).toEqual([0, 4])
    // and the section is the thinnest in the piece: no kick anywhere in frame 11
    const kickId = song.instruments.findIndex((i) => i.name === 'kick')
    expect(attacks('noise', [11]).some((c) => c.inst === kickId)).toBe(false)
  })

  it('one metric surprise: D00 at 15:51 makes a last bar of five eighths', () => {
    const d = pattern('noise', 15).rows.find((c) => hasFx(c, 'D'))!
    expect(d.r).toBe(51)
    expect(hasFx(d, 'D', 0)).toBe(true)
    expect(d.note).toBeGreaterThanOrEqual(0) // it rides the last drum of an unfinished roll
    // 51 is row 9 of that frame's fourth bar, so the bar is TEN rows — five eighths, 2+3
    expect(51 - 3 * BAR).toBe(9)
    // nothing is written in rows 52-55 of frame 15 on any lane: the driver never reaches
    // them, so a cancel placed there would never fire
    for (const channel of song.channels) {
      expect(pattern(channel, 15).rows.filter((c) => c.r >= 52)).toHaveLength(0)
    }
    // and it is the ONLY Dxx in the piece
    expect(song.channels.flatMap((ch) => timeline(ch)).filter((c) => hasFx(c, 'D'))).toHaveLength(1)
  })

  it('two lead colours, and the loop seam carries no fill', () => {
    // the two duty envelopes pulse 1 alternates by phrase: one opens 12.5 -> 50 %, the
    // other opens at 50 % and narrows to 12.5 %. One instrument from first frame to last
    // would be the static-instrumentation failure.
    const duty = (name: string) => {
      const inst = song.instruments.find((i) => i.name === name)!
      return [...song.sequences.duty[inst.macros.duty].values]
    }
    expect(duty('x-crooked-mile-step')).toEqual([0, 1, 2])
    expect(duty('x-crooked-mile-step-open')).toEqual([2, 2, 1, 0])
    const leadIds = ['x-crooked-mile-step', 'x-crooked-mile-step-open']
      .map((name) => song.instruments.findIndex((i) => i.name === name))
    const used = (frames: number[]) => new Set(attacks('pulse1', frames).map((c) => c.inst))
    expect(used([1]).has(leadIds[0])).toBe(true)
    expect(used([2]).has(leadIds[1])).toBe(true) // the colour changes between PHRASES —
    expect(used([3]).has(leadIds[0])).toBe(true) // twice inside `walk` alone
    expect(used([4, 5])).toEqual(new Set([leadIds[1]])) // stile is the rounder one throughout
    // NO FILL AT THE SEAM (§2.9 rule 5): the last half-bar of the piece has no drum at all,
    // and the final frame's Bxx points at the loop frame.
    expect(attacks('noise', [19]).filter((c) => c.r >= ROWS - 8)).toHaveLength(0)
    const b = song.channels.flatMap((ch) => timeline(ch)).filter((c) => hasFx(c, 'B'))
    expect(b).toHaveLength(1)
    expect(b[0].frame).toBe(song.order.length - 1)
    expect(b[0].fx!.find((e) => e !== null && e.cmd === 'B')!.param).toBe(qa.loopFrame)
    // every lane that sounds states itself at the loop row, note/inst/vol or a cut
    for (const channel of song.channels) {
      if (attacks(channel).length === 0) continue
      const first = cellAt(channel, qa.loopFrame, 0)!
      expect(first, channel).toBeDefined()
      expect(first.note === -1 || (first.inst !== undefined && first.vol !== undefined), channel).toBe(true)
    }
  })

  it('the global peak is held back to the last third, and reached once', () => {
    const all = attacks('pulse1')
    const top = Math.max(...all.map((c) => c.note as number))
    expect(top).toBe(86) // d6
    const hits = all.filter((c) => c.note === top)
    expect(hits).toHaveLength(1)
    expect(hits[0].frame).toBe(17) // `crest`, frame 17 of 20
    expect(hits[0].r % BAR).toBe(4) // and it lands on the head of a group, not between
    expect(hits[0].frame / song.order.length).toBeGreaterThan(2 / 3)
  })
})
