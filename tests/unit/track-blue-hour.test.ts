/** Blue Hour (08) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides
 *  the rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/08-blue-hour.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/08-blue-hour.json')
const text = readFileSync(file, 'utf8')
const song: Song = parseSong(JSON.parse(text)).song
const ROWS = song.meta.rowsPerPattern
const BEAT = song.meta.rowHighlight // six rows, and that is the whole groove
const BAR = song.meta.rowHighlight2 // twenty-four
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
function macroOf(kind: 'pitch' | 'duty' | 'volume', inst: number): number[] {
  const i = song.instruments[inst].macros[kind]
  return i < 0 ? [] : [...song.sequences[kind][i].values]
}
const named = (name: string) => song.instruments.findIndex((i) => i.name === name)
const qa = song.extra!.qa as {
  key: string; loopFrame: number; channels: string[]; form: string[]
  accidentalFractionMax?: number; rmsRange: [number, number]
}
const frames = (label: string) => qa.form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
/** Rows of a pitch sequence relative to the first one — the shape, free of where it sits. */
const shape = (cells: Cell[]) => cells.map((c) => [c.r - cells[0].r, c.note] as const)

describe('Blue Hour — the after-hours room', () => {
  it('is committed exactly as its generator wrote it, on a SIX-row beat, in G mixolydian', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(5)
    expect(song.meta.tempo).toBe(150) // an even five ticks a row: the swing is WRITTEN, not fractional
    expect(BEAT).toBe(6) // so a swung eighth pair is rows 0 and 4, an exact 2:1
    expect(BAR).toBe(24)
    expect(ROWS).toBe(96) // a frame is four bars, 8.0 s at 120 BPM
    expect(song.order).toHaveLength(16) // one pass 2:08
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('g-mixolydian')
    expect(qa.loopFrame).toBe(1)
    expect(qa.rmsRange[0]).toBeGreaterThanOrEqual(-30)
    // the accidental cap is NOT raised: the piece stays inside the default 12 %
    expect(qa.accidentalFractionMax).toBeUndefined()
    expect(qa.form).toEqual([
      'head-in', 'A', 'A', "A'", "A'", 'bridge', 'bridge', 'trade', 'trade',
      'comp', 'comp', 'hush', "A''", "A''", 'out', 'out',
    ])
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-blue-hour-|[a-z-]+$)/)
  })

  it('THE GROOVE: every lane swings — no attack anywhere lands on row 3 of a beat', () => {
    // Rows 0, 2 and 4 of the six-row beat are the eighth-note triplet; row 4 is the swung
    // "and". Row 3 is the STRAIGHT eighth, and one lane placing an off-beat there would
    // fight the whole arrangement. This is the pin the brief asked for.
    for (const ch of song.channels) {
      const off = attacks(ch).filter((c) => c.r % BEAT !== 0 && c.r % BEAT !== 2 && c.r % BEAT !== 4)
      expect(off.map((c) => `${c.frame}:${c.r}`), `${ch} places an attack off the triplet grid`).toEqual([])
      expect(attacks(ch).some((c) => c.r % BEAT === 3), `${ch} straightens its eighths`).toBe(false)
    }
    // and the swung "and" is actually used, on every lane that plays a line
    for (const ch of ['pulse1', 'pulse2', 'triangle', 'noise', 'vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(attacks(ch).filter((c) => c.r % BEAT === 4).length, `${ch} never plays the swung "and"`)
        .toBeGreaterThan(8)
    }
  })

  it('the lead scoops in on a zero-sum pitch macro and opens 25 % -> 50 %', () => {
    const lead = named('x-blue-hour-lead')
    expect(lead).toBe(0) // the album gate compares instrument 0 of every piece
    const pitch = macroOf('pitch', lead)
    expect(pitch[0]).toBeGreaterThan(0) // starts flat (period up), arrives on pitch
    expect(pitch.reduce((a, b) => a + b, 0)).toBe(0) // and stays: the macro ACCUMULATES
    expect(macroOf('duty', lead)).toEqual([1, 1, 2])
    // delayed vibrato: every 4xy sits on a row with no attack of its own, and the last
    // one on the lane is the 400 that cancels it
    const p1 = timeline('pulse1')
    const vib = p1.filter((c) => hasFx(c, '4') && !hasFx(c, '4', 0))
    expect(vib.length).toBeGreaterThanOrEqual(10)
    for (const c of vib) expect(isAttack(c), `4xy at ${c.frame}:${c.r} shares its row with an attack`).toBe(false)
  })

  it('M: the head starts late, leaps a minor sixth to its peak, and leaves a hole', () => {
    const M = attacks('pulse1', [1]).filter((c) => c.r < 48)
    expect(M.map((c) => [c.r, c.note])).toEqual([
      [4, 71], //  the swung "and" of 1 — the pickup, b4, the third of G7
      [6, 79], //  beat 2: g5, up a minor sixth, the motif's peak
      [10, 77], // and straight back down by step: f5, the b7
      [12, 76], [16, 74],
      [18, 71], // beat 4, held across the bar line: b4 becomes the #11 of Fmaj7
      [30, 72], [34, 69],
      [36, 67], // the landing, g4
    ])
    // beat 1 is silent, and so is the last beat of bar 1: the holes are the tune
    expect(M.some((c) => c.r < 4)).toBe(false)
    expect(cellAt('pulse1', 1, 42)?.note).toBe(-1)
    // the leap is answered by stepwise motion in the opposite direction
    expect(M[1].note! - M[0].note!).toBe(8)
    expect(M[2].note! - M[1].note!).toBe(-2)
  })

  it("M displaced a swung eighth in A', and augmented in `out`", () => {
    const M = attacks('pulse1', [1]).filter((c) => c.r < 48)
    // A' states the same nine pitches four rows late — an eighth, on this grid
    const displaced = attacks('pulse1', [3]).filter((c) => c.r < 52)
    expect(displaced.map((c) => [c.r - 4, c.note])).toEqual(M.map((c) => [c.r, c.note]))
    expect(displaced[0].r).toBe(8)
    // `out` states the same nine pitches with every duration doubled
    const augmented = attacks('pulse1', [14]).filter((c) => c.r <= 72)
    expect(augmented.map((c) => [c.r / 2, c.note])).toEqual(M.map((c) => [c.r, c.note]))
    expect(augmented[0].r).toBe(8)
  })

  it('§9.1 (a): the 4-row cell, 3:2 against the six-row beat, unbroken through `comp`', () => {
    const co = frames('comp')
    expect(co).toEqual([9, 10])
    const cell = attacks('vrc6p2', co)
    expect(cell).toHaveLength(48) // eight bars, six a bar, no rest and no skipped cell
    expect(cell.every((c) => c.r % 4 === 0)).toBe(true)
    // consecutive: every attack is exactly four rows after the one before it
    const rows = cell.map((c) => c.row)
    expect(rows.every((r, i) => i === 0 || r - rows[i - 1] === 4)).toBe(true)
    // the pitch figure is three notes long, so the 12-row 3:2 cycle and the pitch cycle
    // agree instead of fighting, and the column accents whichever lands on the beat
    expect(cell.slice(0, 6).map((c) => [c.r, c.note, c.vol])).toEqual([
      [0, 59, 11], [4, 64, 8], [8, 67, 8], [12, 59, 11], [16, 64, 8], [20, 67, 8],
    ])
    expect(cell.filter((c) => c.r % BEAT === 0).every((c) => c.vol === 11)).toBe(true)
  })

  it('§9.1 (b): the 20-row punch cell carries its phase across three frames', () => {
    // entry row of frame k is (-96k) mod 20, which is 0, 4, 8 — computed, not guessed
    for (const [frame, entry] of [[3, 0], [4, 4], [5, 8]] as const) {
      const punch = attacks('vrc6p1', [frame])
      expect(punch[0].r, `punch entry row of frame ${frame}`).toBe(entry)
      const rows = punch.map((c) => c.r)
      expect(rows.every((r, i) => i === 0 || r - rows[i - 1] === 20), `frame ${frame} spacing`).toBe(true)
      expect(punch.every((c) => song.instruments[c.inst!].name === 'x-blue-hour-punch')).toBe(true)
    }
    // and it stops at the frame line where the harmonic rhythm doubles
    expect(attacks('vrc6p1', [6]).some((c) => c.r === 28)).toBe(false)
  })

  it('§9.1 (c): the metric surprise — the kit stops for a whole bar and the cell plays on', () => {
    for (const ch of ['noise', 'dpcm'] as const) {
      expect(attacks(ch, [10]).filter((c) => c.r < BAR), `${ch} at 10:0`).toEqual([])
    }
    expect(attacks('vrc6p2', [10]).filter((c) => c.r < BAR)).toHaveLength(6)
    // exactly two bars in the piece carry no percussion at all: bar 0, where the bass
    // walks in alone before the kit exists, and bar 40, which is this surprise.
    const kit = new Set([...attacks('noise'), ...attacks('dpcm')].map((c) => Math.floor(c.row / BAR)))
    const silent = Array.from({ length: (song.order.length * ROWS) / BAR }, (_, b) => b).filter((b) => !kit.has(b))
    expect(silent).toEqual([0, (10 * ROWS) / BAR])
  })

  it('§9.3 (a): three links of descending fifths, and the guide tones walk down with them', () => {
    // E7 -> A7 -> D7 -> G7, one to a bar. vrc6p2 takes each chord's lower guide tone and
    // the four of them descend chromatically: g#3, g3, f#3, f3.
    expect(attacks('vrc6p2', [5]).map((c) => [c.r, c.note])).toEqual([[0, 56], [24, 55], [48, 54], [72, 53]])
    // the bass states each new root on the bar line: e2, a1, d2, g2
    const bass = attacks('triangle', [5]).filter((c) => c.r % BAR === 0)
    expect(bass.map((c) => c.note)).toEqual([40, 33, 38, 43])
    // and the second frame of the bridge moves TWO chords a bar, which nothing else does
    expect(attacks('vrc6p2', [6])).toHaveLength(8)
    expect(attacks('vrc6p2', [6]).map((c) => c.r % BAR)).toEqual([4, 16, 4, 16, 4, 16, 4, 16])
  })

  it('§9.3 (b): the tritone substitution Ab7 -> G7, both guide tones falling a semitone', () => {
    // the bass spells the substitution at 13:48 — ab2, gb2, eb2, c2
    expect(attacks('triangle', [13]).filter((c) => c.r >= 48 && c.r < 72).map((c) => c.note))
      .toEqual([44, 42, 39, 36])
    // gb3 -> f3 on vrc6p2, c4 -> b3 on vrc6p1: contrary to a bass that rises ab2 -> g2
    expect(cellAt('vrc6p2', 13, 58)?.note).toBe(54)
    expect(cellAt('vrc6p2', 13, 82)?.note).toBe(53)
    expect(cellAt('vrc6p1', 13, 70)?.note).toBe(60)
    expect(cellAt('vrc6p1', 13, 78)?.note).toBe(59)
    expect(cellAt('triangle', 13, 72)?.note).toBe(43)
    // THE CADENTIAL 4-3: c4 is taken on the "and" of 4 of the Ab7 bar, held across the
    // bar line into G7 where it is the fourth, and resolved down by step on beat 2.
    expect(hasFx(cellAt('vrc6p1', 13, 70), '0', 0), 'the suspension cancels V1 arpeggio by hand').toBe(true)
    expect(attacks('vrc6p1', [13]).some((c) => c.r > 70 && c.r < 78)).toBe(false)
  })

  it('§9.2: pulse 2 is a voice — it trades whole phrases, and never shares a row', () => {
    const tr = frames('trade')
    expect(tr).toEqual([7, 8])
    const p1 = new Set(attacks('pulse1', tr).map((c) => c.row))
    const p2 = attacks('pulse2', tr)
    expect(p2.length).toBeGreaterThanOrEqual(20)
    expect(p2.every((c) => !p1.has(c.row)), 'pulse 2 answers where pulse 1 is silent').toBe(true)
    // two bars each, in turn: pulse 1 owns bars 0-1 and 4-5, pulse 2 bars 2-3 and 6-7
    const barsOf = (cs: Cell[]) => new Set(cs.map((c) => Math.floor((c.row - tr[0] * ROWS) / BAR)))
    expect([...barsOf(attacks('pulse1', tr))].sort((a, b) => a - b)).toEqual([0, 1, 4, 5])
    expect([...barsOf(p2)].sort((a, b) => a - b)).toEqual([2, 3, 6, 7])
    // and its two answers are two answers, not one answer twice
    expect(attacks('pulse2', [7]).map((c) => c.r)).not.toEqual(attacks('pulse2', [8]).map((c) => c.r))
    // the other cadential suspension: c4, the seventh of Dm7, held into G7 and resolved
    expect(cellAt('pulse2', 2, 66)?.note).toBe(60)
    expect(cellAt('pulse2', 2, 78)?.note).toBe(59)
    expect(attacks('pulse2', [2]).some((c) => c.r > 66 && c.r < 78)).toBe(false)
    // across the whole piece pulse 2 keeps its own rows, well over §9.2's 40 % floor
    const allP1 = new Set(attacks('pulse1').map((c) => c.row))
    const allP2 = attacks('pulse2')
    expect(allP2.filter((c) => !allP1.has(c.row)).length / allP2.length).toBeGreaterThan(0.4)
  })

  it('the walking bass: a pitch on every beat, and an eight-link chromatic descent in `hush`', () => {
    // the triangle states a note on all four beats of nearly every bar it plays
    const onBeats = attacks('triangle').filter((c) => c.r % BEAT === 0)
    expect(onBeats.length).toBeGreaterThan(240)
    // `hush` is two lanes: the walk and a ride cymbal, nothing else, for four bars
    const sounding = song.channels.filter((ch) => attacks(ch, [11]).length > 0)
    expect(sounding).toEqual(['triangle', 'noise'])
    // and the walk descends by semitone for eight links, c2 down to f1
    expect(attacks('triangle', [11]).filter((c) => c.r <= 42).map((c) => [c.r, c.note]))
      .toEqual([[0, 36], [6, 35], [12, 34], [18, 33], [24, 32], [30, 31], [36, 30], [42, 29]])
  })

  it('the tune has one peak a section, and the global peak is b5 in the last third', () => {
    const all = attacks('pulse1')
    const peak = Math.max(...all.map((c) => c.note!))
    expect(peak).toBe(83) // b5
    const where = all.filter((c) => c.note === peak)
    expect(where).toHaveLength(1)
    expect(where[0].frame).toBe(15)
    expect(where[0].frame).toBeGreaterThanOrEqual((song.order.length * 2) / 3)
    expect(where[0].r % BEAT).toBe(0) // and it lands on a beat
    // A's own peak is a5 on beat 1 of its last bar, over the G7 the bass falls onto
    expect(cellAt('pulse1', 2, 72)?.note).toBe(81)
    expect(cellAt('triangle', 2, 66)?.note).toBe(44) // ab2 …
    expect(cellAt('triangle', 2, 72)?.note).toBe(43) // … falling to g2 while the tune rises
  })

  it('the kit is ghosts, and there is no fill at the loop seam', () => {
    // ghosts live at vol 3-6 and there are plenty of them
    const ghosts = attacks('noise').filter((c) => (c.vol ?? 0) >= 3 && (c.vol ?? 0) <= 6)
    expect(ghosts.length).toBeGreaterThan(140)
    // no kick on the noise lane anywhere: the DPCM pair carries every kick
    expect(song.instruments.some((i) => i.name === 'kick')).toBe(false)
    // the last bar before the loop is ride and one ghost — no tom, no crash, no roll
    const lastBar = attacks('noise', [15]).filter((c) => c.r >= 72)
    expect(lastBar.length).toBeLessThanOrEqual(8)
    expect(new Set(lastBar.map((c) => song.instruments[c.inst!].name))).toEqual(new Set(['hat-closed', 'snare']))
    // and the loop row itself is not a cymbal: the head arrives on a ride tick
    expect(song.instruments[cellAt('noise', 1, 0)!.inst!].name).toBe('hat-closed')
  })

  it('states every lane at the loop row, and nothing arpeggiates or wobbles across it', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // the four lanes that are silent at the head's downbeat say so with a cut
    for (const ch of ['pulse1', 'pulse2', 'vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(cellAt(ch, 1, 0)?.note, ch).toBe(-1)
    }
    // every sticky mode this piece writes is cancelled later on its own lane
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of ['4', '0']) {
        const last = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (last !== undefined) expect(hasFx(last, cmd, 0), `${ch}: ${cmd}xy still latched at the end`).toBe(true)
      }
    }
  })

  it('anti-vacuity: the pins can fail — a straightened eighth and an undisplaced head', () => {
    const straightened = attacks('pulse1', [1]).map((c) => ({ ...c, r: c.r === 4 ? 3 : c.r }))
    expect(straightened.some((c) => c.r % BEAT === 3)).toBe(true)
    const undisplaced = attacks('pulse1', [3]).filter((c) => c.r < 52).map((c) => [c.r, c.note])
    expect(undisplaced).not.toEqual(attacks('pulse1', [1]).filter((c) => c.r < 48).map((c) => [c.r, c.note]))
    // and the augmentation is a real one: halving the rows is not the identity
    const aug = attacks('pulse1', [14]).filter((c) => c.r <= 72)
    expect(shape(aug)).not.toEqual(shape(attacks('pulse1', [1]).filter((c) => c.r < 48)))
  })
})
