/** Long Light (09) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides
 *  the rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/09-long-light.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/09-long-light.json')
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
function cellAt(channel: Channel, frame: number, r: number) {
  return pattern(channel, frame).rows.find((c) => c.r === r)
}
type WithFx = { fx?: readonly ({ cmd: string; param: number } | null)[] | undefined }
function hasFx(c: WithFx | undefined, cmd: string, param?: number) {
  return (c?.fx ?? []).some((e) => e !== null && e.cmd === cmd && (param === undefined || e.param === param))
}
const frames = (label: string) =>
  (song.extra!.qa as { form: string[] }).form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
/** Which lanes actually sound in a frame — the two-lane sections are the piece's mix. */
const lanesIn = (frame: number) => song.channels.filter((c) => attacks(c, [frame]).length > 0)
const qa = song.extra!.qa as {
  key: string; loopFrame: number; channels: string[]; form: string[]
  rmsRange: [number, number]; percussionGap: number
}

describe('Long Light — altitude, distance, late afternoon', () => {
  it('is committed exactly as its generator wrote it, on a 100 BPM grid, in F lydian', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(9) // 24 * 150 / (9 * 4) = 100 BPM on 16th rows
    expect(song.meta.rowHighlight).toBe(4)
    expect(song.meta.rowHighlight2).toBe(16)
    expect(song.order).toHaveLength(16)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('f-lydian')
    expect(qa.loopFrame).toBe(1)
    expect(qa.form).toEqual([
      'horizon', 'A', 'A', "A'", "A'", 'B', 'B', 'air', 'answer', 'build', 'build',
      'light', 'light', 'light', 'descent', 'descent',
    ])
    // the open piece declares its own level window and its one long kit silence
    expect(qa.rmsRange[0]).toBeGreaterThanOrEqual(-30)
    expect(qa.percussionGap).toBe(32)
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-long-light-|[a-z-]+$)/)
    // instrument 0 is this piece's own lead, not a shared-bank drum every album piece has
    expect(song.instruments[0].name).toBe('x-long-light-lead')
  })

  it('the 5-row cell: an unbroken five-row grid on vrc6p2, entering (k-1) mod 5 each frame', () => {
    // §9.1 recipe B. The cell is anchored at the LOOP ROW, so frame k's first attack sits
    // at (-64(k-1)) mod 5 = (k-1) mod 5 — computed, not guessed, and not 0,1,2,3,4 by luck:
    // 64 ≡ 4 (mod 5) is what makes the sequence come out in order here.
    const entry: Record<number, number> = {
      1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 0, 8: 2, 9: 3, 10: 4, 11: 0, 12: 1, 13: 2, 14: 3, 15: 4,
    }
    for (const [frame, row] of Object.entries(entry)) {
      const inFrame = attacks('vrc6p2', [Number(frame)])
      expect(inFrame[0]?.r, `vrc6p2 enters frame ${frame}`).toBe(row)
      // and every attack in the frame is on that same five-row grid
      for (const c of inFrame) expect((c.r - row) % 5, `vrc6p2 ${frame}:${c.r} is off the cell`).toBe(0)
    }
    expect(attacks('vrc6p2', [0]), 'the cell has not started in the intro').toHaveLength(0)
    expect(attacks('vrc6p2', [7]), 'the cell rests for the whole two-lane section').toHaveLength(0)
    // the loop body is 15 frames = 960 rows = 192 cells exactly, so the phase is
    // continuous across the seam: the last attack is at 15:59 and the next is the loop row
    const last = attacks('vrc6p2', [15]).at(-1)!
    expect(last.r).toBe(59)
    expect(cellAt('vrc6p2', qa.loopFrame, 0)?.note).toBeGreaterThanOrEqual(0)
    expect(attacks('vrc6p2')).toHaveLength(192 - 13) // three cycles, less the frame it rests
  })

  it('L: the tune, its raised-fourth peak at 2:40, and every phrase ending in air', () => {
    const A = frames('A')
    expect(attacks('pulse1', [1]).map((c) => [c.r, c.note])).toEqual([
      [0, 72], [4, 74], [8, 77], [16, 76], [20, 74], [32, 69], [36, 72], [40, 74], [48, 72],
    ])
    // b5 = 83 is the raised fourth, over G major, on beat 3 — the section's only peak
    expect(cellAt('pulse1', 2, 40)?.note).toBe(83)
    expect(attacks('pulse1', A).filter((c) => c.note === 83)).toHaveLength(1)
    // every phrase ends in a rest of at least a beat: a cut with four or more clear rows
    const cuts = timeline('pulse1').filter((c) => c.note === -1 && A.includes(c.frame))
    expect(cuts.length).toBeGreaterThanOrEqual(3)
    const rows = new Set(attacks('pulse1', A).map((c) => c.row))
    for (const cut of cuts) {
      for (let d = 0; d < 4; d++) expect(rows.has(cut.row + d), `pulse1 rests from ${cut.frame}:${cut.r}`).toBe(false)
    }
  })

  it('the arpeggio bed spells the harmony, is TAKEN AWAY at 3:0, and returns only at 15:32', () => {
    const bedFrames = song.order
      .map((_, f) => (pattern('vrc6p1', f).rows.some((c) => hasFx(c, '0') && !hasFx(c, '0', 0)) ? f : -1))
      .filter((f) => f >= 0)
    expect(bedFrames).toEqual([0, 1, 2, 15]) // three frames, then nothing for eleven
    const back = pattern('vrc6p1', 15).rows.filter((c) => hasFx(c, '0') && !hasFx(c, '0', 0))
    expect(back[0].r).toBe(32) // the last two bars, so the seam hands one bed to another
    // 047 = 71 is a major triad, decimal on disk
    expect(hasFx(cellAt('vrc6p1', 1, 0), '0', 71)).toBe(true)
  })

  it('space as mix: two lanes in the intro, two in `air`, and one bar where only the cell moves', () => {
    expect(lanesIn(0)).toEqual(['vrc6p1', 'vrc6saw'])
    expect(lanesIn(7)).toEqual(['pulse1', 'triangle'])
    // the metric surprise (§9.4): at 10:48 the kit, the DPCM pair, vrc6p1 and the
    // sawtooth all stop for a whole bar and the five-row cell is what marks the time
    const stopBar = song.channels.filter((c) =>
      pattern(c, 10).rows.some((x) => x.r >= 48 && x.note !== undefined && x.note >= 0))
    expect(stopBar).toEqual(['pulse1', 'pulse2', 'triangle', 'vrc6p2'])
    expect(attacks('vrc6p2', [10]).filter((c) => c.r >= 48).length).toBeGreaterThanOrEqual(3)
  })

  it('§9.3 device 1 — the chromatic mediant at 5:8, entered on a stationary common tone', () => {
    // F major -> Ab major: the bass rises f2 -> ab2, vrc6p1 RESTRIKES c4 without moving,
    // and pulse 2's suspended a4 resolves down a semitone to ab4 two rows later.
    expect(cellAt('triangle', 5, 0)?.note).toBe(41) // f2
    expect(cellAt('triangle', 5, 8)?.note).toBe(44) // ab2 — the flat third of the key
    expect(cellAt('vrc6p1', 5, 0)?.note).toBe(60)
    expect(cellAt('vrc6p1', 5, 8)?.note).toBe(60) // c4, struck again, unmoved
    expect(cellAt('pulse2', 5, 6)?.note).toBe(69) // a4, the third of F …
    expect(cellAt('pulse2', 5, 10)?.note).toBe(68) // … resolving to ab4 over the new chord
    expect(hasFx(cellAt('pulse2', 5, 8), '4')).toBe(true) // the suspension leans
    expect(hasFx(cellAt('pulse2', 5, 10), '4', 0)).toBe(true) // and stops leaning on resolution
  })

  it('§9.3 device 2 — an Italian augmented sixth at 10:48 resolving outward into C', () => {
    expect(cellAt('triangle', 10, 48)?.note).toBe(49) // db3, the flat sixth, in the bass
    expect(cellAt('pulse2', 10, 48)?.note).toBe(65) // f4
    expect(cellAt('pulse1', 10, 48)?.note).toBe(83) // b5 — db to b is the augmented sixth
    // outward by semitone, both directions, onto the dominant
    expect(cellAt('triangle', 10, 56)?.note).toBe(48) // c3
    expect(cellAt('pulse1', 10, 56)?.note).toBe(84) // c6
    expect(cellAt('pulse2', 10, 56)?.note).toBe(64) // e4
  })

  it('§9.2 — pulse 2 is an independent line for the whole of B, on rows the lead never uses', () => {
    const B = frames('B')
    const line = attacks('pulse2', B)
    expect(line).toHaveLength(29)
    for (const c of line) expect(c.r % 4, `pulse2 ${c.frame}:${c.r} is on an off-8th`).toBe(2)
    // the sawtooth carries the tune here and attacks only on beats: no shared attack row
    const sawRows = new Set(attacks('vrc6saw', B).map((c) => c.row))
    for (const c of line) expect(sawRows.has(c.row), `pulse2 ${c.frame}:${c.r} doubles the saw`).toBe(false)
    expect(attacks('pulse1', B), 'pulse 1 is silent: the sawtooth IS the lead here').toHaveLength(0)
  })

  it('the peak: L in rhythmic augmentation, then the global peak d6 at 13:40, once', () => {
    // every row of the A statement doubled, note for note — that is the variation
    const stated = attacks('pulse1', [1]).map((c) => [c.r * 2, c.note])
    const augmented = attacks('pulse1', [11, 12]).map((c) => [c.row - 11 * ROWS, c.note])
    expect(augmented).toEqual(stated)
    const all = attacks('pulse1')
    const peak = Math.max(...all.map((c) => c.note!))
    expect(peak).toBe(86) // d6
    const where = all.filter((c) => c.note === peak)
    expect(where).toHaveLength(1)
    expect(where[0].frame).toBe(13)
    expect(where[0].r).toBe(40)
    expect(where[0].frame).toBeGreaterThanOrEqual((song.order.length * 2) / 3) // the last third
    // the sawtooth doubles the tune an octave down for four bars and no more
    const sawFrames = song.order.map((_, f) => attacks('vrc6saw', [f]).length).map((n, f) => (n ? f : -1)).filter((f) => f >= 0)
    expect(sawFrames).toEqual([0, 5, 6, 13])
  })

  it('states every lane at the loop row, and nothing arpeggiates, wobbles or slides across the seam', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // every channel mode written is cancelled later on its own lane, with the cancel the
    // driver honours: 000, 4x0, A00, and 7x0 with x > 0 (a bare 700 replays the memory)
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of ['0', '4', 'A']) {
        const last = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (last !== undefined) expect(hasFx(last, cmd, 0), `${ch}: ${cmd}xy still latched`).toBe(true)
      }
      const trem = [...cells].reverse().find((c) => hasFx(c, '7'))
      if (trem !== undefined) {
        const e = (trem.fx ?? []).find((x) => x !== null && x.cmd === '7')!
        expect(e.param & 0x0f, `${ch}: 7xy still latched`).toBe(0)
        expect(e.param, `${ch}: 700 would replay the remembered depth`).toBeGreaterThan(0)
      }
    }
  })

  it('the tune changes duty between passes, and the peak kit is not one bar four times', () => {
    // §2.3 move 1: three timbres across five statements of L. Instrument 0 is the thin
    // lead; A' restates the same eight bars on a voice that opens to 50 % instead of
    // narrowing to 25 %, and the displaced close uses the exposed 50 % voice.
    const dutyOf = (inst: number) => {
      const i = song.instruments[inst].macros.duty
      return i < 0 ? [] : [...song.sequences.duty[i].values]
    }
    const voiceAt = (frame: number, r: number) => song.instruments[cellAt('pulse1', frame, r)!.inst!].name
    expect(voiceAt(1, 0)).toBe('x-long-light-lead')
    expect(voiceAt(3, 0)).toBe('x-long-light-lead-round')
    expect(voiceAt(7, 4)).toBe('x-long-light-lead-open')
    expect(voiceAt(11, 0)).toBe('x-long-light-lead')
    expect(voiceAt(14, 1)).toBe('x-long-light-lead-open')
    expect(dutyOf(0)).toEqual([0, 0, 1, 1]) // thin, opening to 25 %
    const round = song.instruments.findIndex((i) => i.name === 'x-long-light-lead-round')
    expect(dutyOf(round)).toEqual([1, 1, 2, 2]) // 25 %, opening to 50 %
    // the middle frame of the peak drops two downbeat kicks and ghosts one backbeat, on
    // both percussion lanes, while frames 11 and 13 keep the plain kit (§9.4)
    for (const lane of ['noise', 'dpcm'] as const) {
      for (const r of [16, 48]) {
        expect(cellAt(lane, 12, r), `${lane} 12:${r} still kicks`).toBeUndefined()
        expect(cellAt(lane, 11, r), `${lane} 11:${r}`).toBeDefined()
      }
    }
    expect(cellAt('noise', 12, 36)?.vol).toBe(5) // the ghosted backbeat
    expect(cellAt('noise', 11, 36)?.vol).toBe(11)
    expect(cellAt('noise', 12, 30)?.inst).toBe(song.instruments.findIndex((i) => i.name === 'hat-open'))
  })

  it('the lead breathes everywhere, the build included, and the answer never overlaps it', () => {
    // §2.10, unqualified: no phrase runs on. Measured across the whole order, cuts included.
    const line = timeline('pulse1').filter((c) => c.note !== undefined)
    let longest = 0
    let start: number | null = null
    for (const c of line) {
      if (c.note === -1) {
        if (start !== null) longest = Math.max(longest, c.row - start)
        start = null
      } else if (start === null) start = c.row
    }
    expect(longest, 'the lead never runs four bars without a rest').toBeLessThanOrEqual(64)
    expect(cellAt('pulse1', 9, 60)?.note).toBe(-1) // a beat before the sequence lands on F
    expect(cellAt('pulse1', 10, 44)?.note).toBe(-1) // the augmented sixth arrives out of air
    // `answer`: the second voice speaks only where the first is silent — tails included
    const spansIn8 = (lane: Channel): [number, number][] => {
      const spans: [number, number][] = []
      let from: number | null = null
      for (const c of timeline(lane).filter((x) => x.frame === 8 && x.note !== undefined)) {
        if (from !== null) spans.push([from, c.row])
        from = c.note === -1 ? null : c.row
      }
      if (from !== null) spans.push([from, 9 * ROWS])
      return spans
    }
    for (const [a1, b1] of spansIn8('pulse1')) {
      for (const [a2, b2] of spansIn8('pulse2')) {
        expect(a1 < b2 && a2 < b1, `answer overlaps ${a1}-${b1} with ${a2}-${b2}`).toBe(false)
      }
    }
  })

  it('recipe F: the last statement of the tune is displaced one row late at 14:1', () => {
    // frame 14's pulse 1 is frame 1's, note for note, every row plus one …
    const stated = attacks('pulse1', [1]).map((c) => [c.r + 1, c.note])
    expect(attacks('pulse1', [14]).map((c) => [c.r, c.note])).toEqual(stated)
    // … while the lanes that carry the bar do not move: the bell and the bass stay put
    expect(attacks('vrc6p2', [14])[0].r).toBe(3)
    expect(cellAt('triangle', 14, 0)?.note).toBe(41)
    expect(cellAt('noise', 14, 4)).toBeDefined()
    // and the last frame comes back onto the grid, so nothing wraps past the seam
    expect(attacks('pulse1', [15])[0].r).toBe(0)
  })

  it('anti-vacuity: the pins can fail — an unphased cell and an unaugmented peak are caught', () => {
    // the cell really is off the bar: if it were on the beat these would all be 0
    const offGrid = attacks('vrc6p2', [3]).filter((c) => c.r % 4 !== 0)
    expect(offGrid.length).toBeGreaterThan(8)
    // and the augmented statement really is stretched, not merely transposed
    const stated = attacks('pulse1', [1]).map((c) => [c.r, c.note])
    const augmented = attacks('pulse1', [11, 12]).map((c) => [c.row - 11 * ROWS, c.note])
    expect(augmented).not.toEqual(stated)
    // and the displaced statement really is displaced, not merely a copy
    expect(attacks('pulse1', [14]).map((c) => [c.r, c.note])).not.toEqual(stated)
  })
})
