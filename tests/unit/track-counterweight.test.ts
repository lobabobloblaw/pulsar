/** 05 Counterweight — what makes this piece itself.
 *
 *  The album-wide rules (canonical bytes, loop entry, hardware registers, self-ending
 *  percussion, distinct texture and opening palette) are in `soundtrack.test.ts` and run
 *  over every song. This file pins the composition: the riff and its octave doubling, the
 *  displaced power fifths, the scale-degree inversion that opens the second phase, the
 *  three metric devices, the single metric surprise, the one global peak, and the
 *  eight-voice headroom discipline. Each is a decision a reader of
 *  `tools/songs/compose/05-counterweight.mjs` can find, and each would break if the music
 *  changed in a way that matters. None of them is an automated claim of quality.
 *
 *  Rows are 32nds: 8 to a beat, 32 to a bar, 64 to a frame, so `frame:row` here is two
 *  bars per frame. The JSON is written only by running the generator.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const song = parseSong(
  JSON.parse(readFileSync(join(import.meta.dirname, '../../src/assets/songs/05-counterweight.json'), 'utf8')),
).song
const ROWS = song.meta.rowsPerPattern

type Channel = Song['channels'][number]
interface Cell {
  frame: number
  r: number
  row: number
  note?: number
  inst?: number
  vol?: number
  fx?: Song['patterns'][number]['rows'][number]['fx']
}

/** Every cell the order list reaches on one lane, tagged with frame, local and absolute row. */
function timeline(channel: Channel): Cell[] {
  const lane = song.channels.indexOf(channel)
  return song.order.flatMap((frame, f) => {
    const index = frame[lane]
    const pattern = song.patterns.find((p) => p.channel === channel && p.index === index)
    return (pattern?.rows ?? []).map((c) => ({ ...c, frame: f, row: f * ROWS + c.r }))
  })
}
/** Attacks only — a cut (-1) and a release (-2) are not notes. */
function attacks(channel: Channel): Cell[] {
  return timeline(channel).filter((c) => c.note !== undefined && c.note >= 0)
}
function inFrames(cells: Cell[], lo: number, hi: number): Cell[] {
  return cells.filter((c) => c.frame >= lo && c.frame <= hi)
}
function instrumentsNamed(pattern: RegExp): number[] {
  return song.instruments.map((i, index) => ({ i, index })).filter(({ i }) => pattern.test(i.name)).map(({ index }) => index)
}
interface Qa {
  form: string[]
  loopFrame: number
  key: string
  channels: string[]
  notes: string
}
function qa(): Qa {
  return (song.extra as { qa: Qa }).qa
}

/** The riff cell's rows inside a frame: a 16th gallop on the root, the two-note answer,
 *  a 32nd of air, and the chromatic approach into the next downbeat. */
const CELL_ROWS = [0, 4, 6, 8, 12, 16, 24, 28, 30, 32, 36, 38, 40, 44, 48, 52, 56, 60, 62]

/** Signed scale-step distance of a semitone offset from a mode's root, or null when the
 *  note is chromatic. Used to show that the second phase inverts the riff BY DEGREE —
 *  which is what keeps the inverted riff inside its own mode. */
function stepsFromRoot(semitones: number, scale: readonly number[]): number | null {
  for (let k = -14; k <= 14; k++) {
    const degree = scale[((k % scale.length) + scale.length) % scale.length] + 12 * Math.floor(k / scale.length)
    if (degree === semitones) return k
  }
  return null
}
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10]

describe('05 Counterweight — the boss theme', () => {
  it('is a 32nd-note grid at 150 BPM: 44 frames of two bars, looping past the alarm', () => {
    expect(song.meta.tempo).toBe(150)
    expect(song.meta.speed).toBe(3)
    expect(song.meta.rowHighlight).toBe(8)
    expect(song.meta.rowHighlight2).toBe(32)
    expect(song.meta.rowsPerPattern).toBe(64)
    expect((24 * song.meta.tempo) / (song.meta.speed * song.meta.rowHighlight)).toBe(150)
    expect(song.order).toHaveLength(44)
    // The alarm plays once; the loop returns to the riff.
    expect(qa().loopFrame).toBe(2)
    expect(qa().form[0]).toBe('alarm')
    expect(qa().form[2]).toBe('riff-A')
    expect(qa().key).toBe('d-phrygian')
  })

  it('sounds all eight lanes, the DPCM pair beside the VRC6 three', () => {
    expect(song.channels).toEqual([
      'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
    ])
    // Unlike the two ported VRC6 pieces, this one plays the sample lane rather than
    // carrying it empty to satisfy the channel prefix, so `dpcm` is claimed.
    expect(qa().channels).toEqual([...song.channels])
    for (const channel of song.channels) expect(attacks(channel).length, channel).toBeGreaterThanOrEqual(8)
    // The kit is the bank's kick and snare through the shared dpcm-kit instrument.
    expect(new Set(attacks('dpcm').map((c) => c.note))).toEqual(new Set([36, 39]))
  })

  it('the riff is the sawtooth doubled by the triangle an octave up, on the same rows', () => {
    // Bass doctrine at eight voices (§12.2): one of the two leads and the other doubles.
    // Every row where both strike in a riff or phase-2 frame is an exact octave.
    const saw = new Map(inFrames(attacks('vrc6saw'), 2, 9).concat(inFrames(attacks('vrc6saw'), 28, 35)).map((c) => [c.row, c.note as number]))
    const shared = inFrames(attacks('triangle'), 2, 9).concat(inFrames(attacks('triangle'), 28, 35)).filter((c) => saw.has(c.row))
    expect(shared.length).toBeGreaterThan(250)
    expect(shared.filter((c) => (c.note as number) - (saw.get(c.row) as number) === 12)).toHaveLength(shared.length)
    // and the sawtooth is the lowest voice in the piece, under the triangle
    expect(Math.min(...attacks('vrc6saw').map((c) => c.note as number)))
      .toBeLessThan(Math.min(...attacks('triangle').map((c) => c.note as number)))
  })

  it('states the riff cell in full at least ten times across four sections', () => {
    const cellFrames = song.order
      .map((_, f) => f)
      .filter((f) => {
        const rows = inFrames(attacks('vrc6saw'), f, f).map((c) => c.r)
        return rows.length === CELL_ROWS.length && rows.every((r, i) => r === CELL_ROWS[i])
      })
    expect(cellFrames.length).toBeGreaterThanOrEqual(10)
    // riff A, phase 2 and riff A'' all carry it; the re-orchestration hands it to a VRC6
    // pulse instead, which is why frames 18-21 are not in this list.
    expect(cellFrames.some((f) => f >= 2 && f <= 9)).toBe(true)
    expect(cellFrames.some((f) => f >= 28 && f <= 35)).toBe(true)
    expect(cellFrames.some((f) => f >= 36 && f <= 41)).toBe(true)
    expect(cellFrames.filter((f) => f >= 18 && f <= 21)).toEqual([])
    const reorchestrated = [18, 19, 20].filter((f) => inFrames(attacks('vrc6p1'), f, f).length >= CELL_ROWS.length - 1)
    expect(reorchestrated.length, "riff A' moves the riff onto VRC6 pulse 1").toBeGreaterThanOrEqual(3)
  })

  it('the power fifths are 0xy sevenths sitting a 32nd behind the riff', () => {
    const stabs = [...attacks('vrc6p1'), ...attacks('vrc6p2'), ...attacks('pulse1'), ...attacks('pulse2')]
      .filter((c) => (c.fx ?? []).some((e) => e !== null && e.cmd === '0' && e.param === 7))
    expect(stabs.length).toBeGreaterThanOrEqual(150)
    // A beat is eight rows and the riff's 8ths land on rows 0 and 4 of it. Every stab
    // that accompanies the riff is at row 5 of its beat: one 32nd late, so it smacks
    // against the riff instead of doubling it.
    const withRiff = stabs.filter((c) => c.row < 40 * ROWS + 32)
    expect([...new Set(withRiff.map((c) => c.r % 8))]).toEqual([5])
    // The only fifths written anywhere else are the closing hemiola's, which are on the
    // 12-row grid on purpose — that is the whole point of the last three bars.
    expect(stabs.length - withRiff.length).toBeGreaterThanOrEqual(16)
    for (const c of stabs.filter((c) => c.row >= 40 * ROWS + 32)) expect((c.row - (40 * ROWS + 32)) % 12).toBe(0)
    // 007 is a bare fifth — root and fifth on a three-tick rotation, no third.
    for (const c of stabs) expect((c.fx ?? []).filter((e) => e !== null && e.cmd === '0')).toHaveLength(1)
  })

  it('phase 2 inverts the riff by SCALE DEGREE, a minor third up into F minor', () => {
    const original = inFrames(attacks('vrc6saw'), 2, 2)
    const inverted = inFrames(attacks('vrc6saw'), 28, 28)
    expect(original.map((c) => c.r)).toEqual(CELL_ROWS)
    expect(inverted.map((c) => c.r)).toEqual(CELL_ROWS)
    // The roots are a minor third apart: D2 -> F2.
    expect((inverted[0].note as number) - (original[0].note as number)).toBe(3)
    for (let i = 0; i < CELL_ROWS.length; i++) {
      const up = (original[i].note as number) - (original[0].note as number)
      const down = (inverted[i].note as number) - (inverted[0].note as number)
      const a = stepsFromRoot(up, PHRYGIAN)
      const b = stepsFromRoot(down, NATURAL_MINOR)
      if (a === null || b === null) {
        // The one chromatic note in each cell is the approach, and its direction is
        // mirrored too: a semitone under the root becomes a semitone over it.
        expect([up, down], `row ${CELL_ROWS[i]}`).toEqual([-1, 1])
      } else {
        expect(b, `row ${CELL_ROWS[i]}: degree ${a} should mirror to ${-a}`).toBe(a === 0 ? 0 : -a)
      }
    }
  })

  it('the bridge carries a six-row tom cell unbroken across all six of its frames', () => {
    // 6 rows against an 8-row beat is 4:3, and 64 is not a multiple of 6, so the cell
    // enters each frame two rows later until it re-aligns every third frame. The phase
    // is carried by writing straight through, never restarted at a frame boundary.
    const toms = inFrames(attacks('noise'), 22, 27).filter((c) => instrumentsNamed(/-tom-/).includes(c.inst as number))
    expect(toms.length).toBeGreaterThanOrEqual(60)
    expect([22, 23, 24, 25, 26, 27].map((f) => toms.find((c) => c.frame === f)?.r)).toEqual([0, 2, 4, 0, 2, 4])
    const spacing = new Set(toms.slice(1).map((c, i) => c.row - toms[i].row))
    expect([...spacing], 'one unbroken cell, never re-entered').toEqual([6])
  })

  it('the bridge bass and its DPCM kick are a tresillo', () => {
    // 3+3+2 at the 8th level: rows 0, 12 and 24 of a 32-row bar, the broad grouping
    // §9.1 recipe C asks for at this tempo.
    expect([...new Set(inFrames(attacks('vrc6saw'), 22, 26).map((c) => c.r % 32))].sort((a, b) => a - b)).toEqual([0, 12, 24])
    const kick = inFrames(attacks('dpcm'), 22, 26).filter((c) => c.note === 36)
    expect([...new Set(kick.map((c) => c.r % 32))].sort((a, b) => a - b)).toEqual([0, 12, 24])
  })

  it('the last three bars are a hemiola that lands exactly on the turn', () => {
    // Eight accents twelve rows apart across 96 rows: 3 against 4, closing on 42:0.
    const accents = attacks('vrc6p1').filter((c) => c.row >= 40 * ROWS + 32 && c.row < 42 * ROWS)
    expect(accents.map((c) => `${c.frame}:${c.r}`)).toEqual([
      '40:32', '40:44', '40:56', '41:4', '41:16', '41:28', '41:40', '41:52',
    ])
    expect((accents.at(-1) as Cell).row + 12).toBe(42 * ROWS)
    // The kit puts a kick on every one of them, so the regrouping is heard, not implied.
    const kicks = new Set(attacks('noise').filter((c) => c.note === 36).map((c) => c.row))
    for (const a of accents) expect(kicks.has(a.row), `kick at ${a.frame}:${a.r}`).toBe(true)
  })

  it('has exactly one metric surprise: the bar B drops at 17:31', () => {
    const skips = song.patterns.flatMap((p) =>
      p.rows.flatMap((c) => (c.fx ?? []).filter((e) => e !== null && e.cmd === 'D').map(() => ({ channel: p.channel, index: p.index, r: c.r }))))
    expect(skips).toHaveLength(1)
    // D00 on the LAST ROW OF THE BAR, not of the frame: the frame ends after row 31, so
    // the whole of its second bar is skipped and B's closing phrase is seven bars.
    expect(skips[0].r).toBe(31)
    // It is on the frame the form calls the end of B.
    const lane = song.channels.indexOf(skips[0].channel)
    expect(song.order[17][lane]).toBe(skips[0].index)
    expect(qa().form[17]).toBe('B')
    expect(qa().form[18]).toBe("riff-A'")
    // Cxx halts playback and never belongs in a looping piece.
    for (const p of song.patterns) for (const c of p.rows) for (const e of c.fx ?? []) expect(e?.cmd).not.toBe('C')
  })

  it("riff A'' restates the lead's first tail phrase two rows late", () => {
    const first = inFrames(attacks('pulse1'), 5, 5)
    const late = inFrames(attacks('pulse1'), 37, 37)
    expect(first.map((c) => c.note)).toEqual(late.map((c) => c.note))
    expect(late.map((c) => c.r)).toEqual(first.map((c) => c.r + 2))
  })

  it('touches its ceiling once, in the last third', () => {
    const melodic = (['pulse1', 'pulse2', 'triangle', 'vrc6p1', 'vrc6p2', 'vrc6saw'] as const)
      .flatMap((c) => attacks(c).map((cell) => ({ channel: c, ...cell })))
    const top = Math.max(...melodic.map((c) => c.note as number))
    const peak = melodic.filter((c) => c.note === top)
    expect(peak).toHaveLength(1)
    expect(peak[0].channel).toBe('pulse1')
    expect(`${peak[0].frame}:${peak[0].r}`).toBe('35:0')
    expect(peak[0].frame / song.order.length).toBeGreaterThan(2 / 3)
    // Nothing else in the piece reaches within a semitone of it: the bridge's rising run
    // and the peak phrase's own second note both stop at C6, one semitone under.
    const second = Math.max(...melodic.filter((c) => c.note !== top).map((c) => c.note as number))
    expect(top - second).toBe(1)
    expect(melodic.filter((c) => c.note === second)).toHaveLength(2)
  })

  it('mixes the expansion down: the sawtooth reaches 13 only for the alarm stab', () => {
    // Volume 15 on the saw is about twice a pulse at 15 (§12.2), so it is the first
    // thing held back. 13 belongs to the two-note stab that opens and closes the piece.
    const saw = attacks('vrc6saw')
    expect([...new Set(saw.filter((c) => c.vol === 13).map((c) => c.frame))].sort((a, b) => a - b)).toEqual([0, 1, 42, 43])
    expect(Math.max(...saw.filter((c) => c.frame > 1 && c.frame < 42).map((c) => c.vol as number))).toBe(12)
    // The VRC6 pulses stay under the 2A03 lead; neither ever asks for more than 11.
    expect(Math.max(...[...attacks('vrc6p1'), ...attacks('vrc6p2')].map((c) => c.vol as number))).toBeLessThanOrEqual(11)
    // Duty 8-15 sets the VRC6's mode bit: constant output, a click, then silence.
    for (const i of song.instruments) {
      const duty = i.macros.duty
      if (duty >= 0) for (const v of song.sequences.duty[duty].values) expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('lets the singer breathe, and answers every breath on pulse 2', () => {
    // §2.10: a phrase that never rests has no phrasing, and §9.2: the rests are what
    // give the counter-voice somewhere to speak. Both are checkable here.
    const breaths = inFrames(timeline('pulse1'), 10, 17).filter((c) => c.note === -1)
    expect(breaths.length).toBeGreaterThanOrEqual(4)
    const answers = attacks('pulse2').map((c) => c.row)
    for (const b of breaths) {
      expect(answers.some((r) => r > b.row && r <= b.row + 8), `breath at ${b.frame}:${b.r}`).toBe(true)
    }
    // ...and through the whole of B pulse 2 is a voice, not a harmoniser: most of its
    // attacks fall on rows pulse 1 does not touch (§9.2 asks for 40 %).
    const leadRows = new Set(inFrames(attacks('pulse1'), 10, 17).map((c) => c.row))
    const voice = inFrames(attacks('pulse2'), 10, 17)
    expect(voice.filter((c) => !leadRows.has(c.row)).length / voice.length).toBeGreaterThan(0.8)
  })

  it('escalates: the second phase is the busiest section and the alarm the sparsest', () => {
    const perFrame = (lo: number, hi: number) => inFrames(attacks('noise'), lo, hi).length / (hi - lo + 1)
    expect(perFrame(28, 35)).toBeGreaterThan(perFrame(2, 9)) // phase 2 over riff A
    expect(perFrame(2, 9)).toBeGreaterThan(perFrame(10, 17)) // riff A over the singing B
    expect(perFrame(22, 27)).toBeLessThan(perFrame(10, 17)) // the half-time bridge drops
    expect(perFrame(0, 0)).toBeLessThan(perFrame(22, 27)) // the alarm's first bars are the floor
    expect(perFrame(0, 0)).toBeLessThan(2) // one crash under the stab, and nothing else
    // Every noise envelope ends on 0 and never loops, so a drum releases its own lane.
    for (const c of attacks('noise')) {
      const env = song.sequences.volume[song.instruments[c.inst as number].macros.volume]
      expect(env.loop).toBe(-1)
      expect(env.values.at(-1)).toBe(0)
    }
  })
})
