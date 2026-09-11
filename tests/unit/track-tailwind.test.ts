/** Tailwind (04) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides
 *  the rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/04-tailwind.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/04-tailwind.json')
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
function dutyOf(inst: number): number[] {
  const i = song.instruments[inst].macros.duty
  return i < 0 ? [] : [...song.sequences.duty[i].values]
}
function pitchOf(inst: number): number[] {
  const i = song.instruments[inst].macros.pitch
  return i < 0 ? [] : [...song.sequences.pitch[i].values]
}
const frames = (label: string) =>
  (song.extra!.qa as { form: string[] }).form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
const qa = song.extra!.qa as {
  key: string; loopFrame: number; accidentalFractionMax: number; channels: string[]; form: string[]
}

describe('Tailwind — the bright stage theme', () => {
  it('is committed exactly as its generator wrote it, on the album grid, in A major', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(5) // 180 BPM on 16th rows
    expect(song.meta.rowHighlight).toBe(4)
    expect(song.meta.rowHighlight2).toBe(16)
    expect(song.order).toHaveLength(24)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.channels).toContain('dpcm') // the DPCM kit sounds here, unlike the ported pieces
    expect(qa.key).toBe('a-major')
    expect(qa.accidentalFractionMax).toBe(0.2)
    expect(qa.loopFrame).toBe(1)
    expect(qa.form).toEqual([
      'intro', 'A', 'A', 'A', 'A', "A'", "A'", "A'", "A'", 'pre', 'pre', 'chorus', 'chorus', 'chorus', 'chorus',
      'break', "A''", "A''", "A''", "chorus'", "chorus'", "chorus'", "chorus'", 'tag',
    ])
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-tailwind-|[a-z-]+$)/)
  })

  it('the lead scoops from below with a zero-sum pitch macro and a thin-to-25 % duty front', () => {
    const lead = song.instruments.findIndex((i) => i.name === 'x-tailwind-lead')
    const pitch = pitchOf(lead)
    expect(pitch[0]).toBeGreaterThan(0) // starts flat (period up), arrives on pitch
    expect(pitch.reduce((a, b) => a + b, 0)).toBe(0) // and stays there: the macro accumulates
    expect(dutyOf(lead)).toEqual([0, 0, 1])
    // delayed vibrato: every 4xy sits on a row with no attack, a beat or less after one
    const p1 = timeline('pulse1')
    const vib = p1.filter((c) => hasFx(c, '4') && !hasFx(c, '4', 0))
    expect(vib.length).toBeGreaterThanOrEqual(20)
    const p1Rows = notesByRow('pulse1')
    for (const c of vib) {
      expect(isAttack(c), `4xy at ${c.frame}:${c.r} shares its row with an attack`).toBe(false)
      expect([3, 4].some((d) => p1Rows.has(c.row - d)), `4xy at ${c.frame}:${c.r} follows a note`).toBe(true)
    }
  })

  it('A: the hook on pulse 1, an echo canon three rows behind at −5 on a duty-0 instrument', () => {
    const A = frames('A')
    const lead = notesByRow('pulse1')
    const echo = attacks('pulse2', A)
    expect(echo.length).toBeGreaterThan(60)
    for (const c of echo) {
      expect(lead.get(c.row - 3), `pulse2 ${c.frame}:${c.r} echoes a lead note three rows earlier`).toBe(c.note)
      expect(dutyOf(c.inst!)).toEqual([0])
    }
    const leadVol = attacks('pulse1', A).map((c) => c.vol!)
    const echoVol = echo.map((c) => c.vol!)
    expect(Math.max(...echoVol)).toBeLessThanOrEqual(Math.min(...leadVol) - 3)
    // the hook's single peak, a5 on beat 3 of the first bar, once per statement of H
    expect(cellAt('pulse1', 1, 8)?.note).toBe(81)
    expect(attacks('pulse1', A).filter((c) => c.note === 81)).toHaveLength(1)
  })

  it('A: the saw gallop (8th + two 16ths) with the triangle answering on the off-16th an octave up', () => {
    const saw = attacks('vrc6saw', [1])
    expect(saw).toHaveLength(48)
    expect(saw.every((c) => [0, 2, 3].includes(c.r % 4))).toBe(true)
    const tri = attacks('triangle', [1])
    expect(tri).toHaveLength(16)
    const sawAt = notesByRow('vrc6saw')
    for (const c of tri) {
      expect(c.r % 4).toBe(1)
      expect(c.note! - sawAt.get(c.row - 1)!).toBe(12)
    }
    // the gallop's own dynamics: the beat sits above its two sixteenths
    expect(new Set(saw.map((c) => c.vol)).size).toBeGreaterThanOrEqual(2)
    expect(cellAt('vrc6saw', 1, 0)!.vol!).toBeGreaterThan(cellAt('vrc6saw', 1, 2)!.vol!)
  })

  it("A′: the hook re-orchestrated onto the saw an octave lower, pulse 2 silent, V2 on a six-row cell", () => {
    const hookA = attacks('pulse1', [1, 2, 3, 4])
    const hookSaw = attacks('vrc6saw', [5, 6, 7, 8])
    expect(hookSaw.map((c) => [c.row - 4 * ROWS, c.note! + 12])).toEqual(hookA.map((c) => [c.row, c.note]))
    expect(hookSaw.every((c) => c.vol === 11)).toBe(true)
    expect(attacks('pulse2', [5, 6, 7, 8])).toHaveLength(0)
    // the triangle takes the gallop while the saw sings
    expect(attacks('triangle', [5])).toHaveLength(48)
    // V2: attacks every six rows, phase carried across the frame boundary (0 then 2)
    const v2 = attacks('vrc6p2', [5, 6])
    expect(v2.map((c) => c.row - 5 * ROWS)).toEqual(Array.from({ length: 22 }, (_, i) => i * 6))
    expect(v2[0].r).toBe(0)
    expect(attacks('vrc6p2', [6])[0].r).toBe(2)
    for (const c of v2) expect(hasFx(c, '0') && !hasFx(c, '0', 0), `0xy at ${c.frame}:${c.r}`).toBe(true)
  })

  it('pre-chorus: the bVII push (g-naturals), off-beat V2 stabs, a two-bar roll and the build', () => {
    const tune = attacks('pulse1', [9, 10])
    expect(tune.some((c) => c.note! % 12 === 7)).toBe(true) // g natural in A major
    const stabs = attacks('vrc6p2', [9, 10])
    expect(stabs.every((c) => [2, 6, 10, 14].includes(c.r % 16))).toBe(true)
    expect(stabs.every((c) => hasFx(c, '0') && !hasFx(c, '0', 0))).toBe(true)
    // the roll: every row of the last two bars, volume never falling, high snare at the top
    const rollRows = attacks('noise', [10]).filter((c) => c.r >= 32)
    expect(rollRows.map((c) => c.r)).toEqual(Array.from({ length: 32 }, (_, i) => 32 + i))
    for (let i = 1; i < rollRows.length; i++) expect(rollRows[i].vol!).toBeGreaterThanOrEqual(rollRows[i - 1].vol!)
    expect(rollRows.at(-1)!.note).toBe(41)
    // pulse 2 rests through the phrase and climbs two octaves under the roll
    const build = attacks('pulse2', [9, 10])
    expect(build.every((c) => c.row >= 10 * ROWS + 32)).toBe(true)
    expect(build.map((c) => c.note)).toEqual([64, 68, 71, 74, 76, 80, 83])
  })

  it('chorus: pulse 2 is a VOICE for the whole section — complementary rhythm, below, suspensions', () => {
    const C = frames('chorus')
    const p1 = attacks('pulse1', C)
    const p2 = attacks('pulse2', C)
    const p1Rows = new Set(p1.map((c) => c.row))
    const free = p2.filter((c) => !p1Rows.has(c.row)).length
    expect(free / p2.length).toBeGreaterThanOrEqual(0.4) // §9.2
    const p1At = notesByRow('pulse1')
    for (const c of p2) if (p1At.has(c.row)) expect(c.note!).toBeLessThan(p1At.get(c.row)!)
    expect(dutyOf(p2[0].inst!)).toEqual([2]) // a different singer: 50 % duty
    // 9–8 over D (bar 2): e5 struck on bar 1 beat 4, held across the change, d5 on beat 2
    expect(cellAt('pulse2', 11, 28)?.note).toBe(76)
    expect(cellAt('pulse2', 11, 32)).toBeUndefined()
    expect(cellAt('pulse2', 11, 36)?.note).toBe(74)
    // 4–3 over E (bar 3): a4 held from D, g#4 on beat 2
    expect(cellAt('pulse2', 11, 44)?.note).toBe(69)
    expect(cellAt('pulse2', 11, 48)).toBeUndefined()
    expect(cellAt('pulse2', 11, 52)?.note).toBe(68)
    // the cadential 4–3 over the final A (bar 15): d4 held from the borrowed iv, c#4 on beat 2
    expect(cellAt('pulse2', 14, 40)?.note).toBe(62)
    expect(cellAt('pulse2', 14, 48)).toBeUndefined()
    expect(cellAt('pulse2', 14, 52)?.note).toBe(61)
    // contrary motion at that cadence: the tune rises d5 -> e5 while the saw falls D -> A
    expect(cellAt('pulse1', 14, 40)?.note).toBe(74)
    expect(cellAt('pulse1', 14, 48)?.note).toBe(76)
    expect(cellAt('vrc6saw', 14, 32)?.note).toBe(38)
    expect(cellAt('vrc6saw', 14, 48)?.note).toBe(33)
    // the f-natural appoggiatura over the borrowed iv, resolving down by step on beat 2
    expect(cellAt('pulse1', 14, 32)?.note).toBe(77)
    expect(cellAt('pulse1', 14, 36)?.note).toBe(76)
    // DPCM kick on every beat (the last frame's final bar is the kit's half-bar of air), the
    // VRC6 sixths under it
    for (const f of C.slice(0, 3)) expect(attacks('dpcm', [f]).filter((c) => c.note === 36).map((c) => c.r)).toEqual(Array.from({ length: 16 }, (_, i) => i * 4))
    expect(attacks('dpcm', [C[3]]).filter((c) => c.note === 36 && c.r < 48).map((c) => c.r)).toEqual(Array.from({ length: 12 }, (_, i) => i * 4))
    const v1 = notesByRow('vrc6p1'), v2 = notesByRow('vrc6p2')
    const sixths = [...v1].filter(([row]) => row >= 11 * ROWS && row < 15 * ROWS && v2.has(row)).map(([row, hi]) => hi - v2.get(row)!)
    expect(sixths.length).toBeGreaterThanOrEqual(12)
    expect(sixths.every((d) => [8, 9, 5, 3].includes(d))).toBe(true) // the iv bar is root + fifth
  })

  it('break: half-time, the saw alone under the DPCM pair, one hat-only bar, then the tom fill', () => {
    for (const lane of ['pulse1', 'pulse2', 'triangle', 'vrc6p1', 'vrc6p2'] as const) expect(attacks(lane, [15])).toHaveLength(0)
    const noise = attacks('noise', [15])
    expect(noise.filter((c) => c.r < 32).map((c) => c.r)).toEqual([8, 24]) // the layered snare on 3
    expect(noise.filter((c) => c.r >= 32 && c.r < 48).map((c) => c.r)).toEqual(Array.from({ length: 16 }, (_, i) => 32 + i))
    expect(noise.filter((c) => c.r >= 32 && c.r < 48).every((c) => c.note === 45)).toBe(true)
    const tom = song.instruments.findIndex((i) => i.name === 'x-tailwind-tom')
    expect(noise.filter((c) => c.r >= 48 && c.inst === tom).map((c) => c.r)).toEqual([48, 50, 52, 54])
    expect(pitchOf(tom).at(-1)).toBe(0)
  })

  it("A″: the hook displaced two rows late, then the turn B7 → E7 → A → F#7 under a six-row hemiola", () => {
    // the displaced statement: the same notes as A's first four bars, every row +2
    const original = attacks('pulse1', [1]).filter((c) => c.r < 64)
    const displaced = attacks('pulse1', [16]).filter((c) => c.r < 66)
    expect(displaced[0].r).toBe(2)
    expect(displaced.map((c) => [c.r - 2, c.note])).toEqual(original.map((c) => [c.r, c.note]))
    // back on the grid for bars 4–7: the echo is only there
    expect(attacks('pulse2', [17]).every((c) => c.r < 64)).toBe(true)
    expect(attacks('pulse2', [16])).toHaveLength(0)
    // the raised thirds of the chain: d# over B7 (bar 8), a# over F#7 (bar 11)
    expect(cellAt('pulse1', 18, 4)?.note).toBe(75)
    expect(cellAt('pulse1', 18, 56)?.note).toBe(70)
    expect(cellAt('vrc6saw', 18, 0)?.note).toBe(35) // B1 under B7
    // the hemiola: saw and V2 every six rows from 18:16, eight groups closing on 19:0
    const rows = Array.from({ length: 8 }, (_, i) => 16 + i * 6)
    const saw = attacks('vrc6saw', [18]).filter((c) => c.r >= 16)
    expect(saw.map((c) => c.r)).toEqual(rows)
    expect(saw.map((c) => c.note)).toEqual([40, 40, 40, 33, 33, 33, 42, 42])
    expect(attacks('vrc6p2', [18]).filter((c) => c.r >= 16).map((c) => c.r)).toEqual(rows)
    // while the kit keeps the four-row beat and the triangle holds the roots
    expect(attacks('dpcm', [18]).filter((c) => c.r >= 16 && c.r % 16 === 0)).toHaveLength(3)
    expect(attacks('triangle', [18]).filter((c) => c.r >= 16).map((c) => c.r)).toEqual([16, 32, 48])
  })

  it("chorus′: the tune a whole step up in B major, doubled an octave above by V1 at 9", () => {
    const a = attacks('pulse1', frames('chorus'))
    const b = attacks('pulse1', frames("chorus'"))
    expect(b.map((c) => [c.row - 8 * ROWS, c.note! - 2])).toEqual(a.map((c) => [c.row, c.note]))
    const p1 = notesByRow('pulse1')
    const double = attacks('vrc6p1', frames("chorus'"))
    expect(double.length).toBe(b.length)
    for (const c of double) {
      expect(c.note! - p1.get(c.row)!).toBe(12)
      expect(c.vol).toBe(9)
    }
    // the piece's single highest lead note, b5, is here — in the last third
    const all = attacks('pulse1')
    const peak = Math.max(...all.map((c) => c.note!))
    const where = all.filter((c) => c.note === peak)
    expect(where).toHaveLength(1)
    expect(where[0].frame).toBe(19)
    expect(where[0].frame).toBeGreaterThanOrEqual(song.order.length * 2 / 3)
  })

  it('tag: two bars of the riff in B, a unison fall onto E7, then B01 + D00 home at row 31', () => {
    const last = song.order.length - 1
    const jump = song.channels.map((ch) => cellAt(ch, last, 31)).find((c) => hasFx(c, 'B'))
    expect(jump).toBeDefined()
    expect(hasFx(jump, 'B', 1)).toBe(true)
    expect(hasFx(jump, 'D', 0)).toBe(true)
    // the library's Bxx on the last row satisfies the gate; nothing sounds after row 31
    expect(song.channels.some((ch) => hasFx(cellAt(ch, last, ROWS - 1), 'B', 1))).toBe(true)
    for (const ch of song.channels) expect(attacks(ch, [last]).every((c) => c.r <= 31), ch).toBe(true)
    // the riff in B: the intro's saw riff, every note two semitones up
    const intro = attacks('vrc6saw', [0]).filter((c) => c.r < 16)
    const tagRiff = attacks('vrc6saw', [last]).filter((c) => c.r < 16)
    expect(tagRiff.map((c) => [c.r, c.note! - 2])).toEqual(intro.map((c) => [c.r, c.note]))
    // the unison fall b -> a -> g# -> f# -> e, the same on four lanes an octave apart
    const fall = [47, 45, 44, 42, 40]
    for (const [ch, up] of [['vrc6saw', 0], ['triangle', 12], ['pulse1', 24], ['pulse2', 36]] as const) {
      expect(attacks(ch, [last]).filter((c) => c.r >= 16).map((c) => c.note)).toEqual(fall.map((x) => x + up))
    }
    // the E7 stab that turns B major back into A's dominant
    expect(hasFx(cellAt('vrc6p2', last, 24), '0', 74)).toBe(true)
  })

  it('states every lane at the loop row, and nothing wobbles or arpeggiates across the seam', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // every sticky effect written is cancelled later on its own lane (4xy, 0xy)
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of ['4', '0']) {
        const last = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (last !== undefined) expect(hasFx(last, cmd, 0), `${ch}: ${cmd}xy still latched at the end`).toBe(true)
      }
    }
  })

  it('anti-vacuity: the pins can fail — an undisplaced A″ and an unmoved chorus′ are caught', () => {
    const shifted = attacks('pulse1', [16]).map((c) => ({ ...c, r: c.r - 2 }))
    expect(shifted[0].r).not.toBe(2)
    const untransposed = attacks('pulse1', frames("chorus'")).map((c) => [c.row - 8 * ROWS, c.note])
    expect(untransposed).not.toEqual(attacks('pulse1', frames('chorus')).map((c) => [c.row, c.note]))
  })
})
