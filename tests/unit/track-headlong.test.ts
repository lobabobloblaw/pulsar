/** Headlong (12) — what makes the piece itself, pinned at frame:row. Not a claim of musical
 *  quality: the gates in presets.test.ts decide correctness, a listener decides the rest.
 *  Self-contained on purpose: it copies the small helpers it needs rather than importing
 *  soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/12-headlong.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/12-headlong.json')
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
/** `[row, note]` pairs relative to `base` — the shape every motif pin below compares. */
const shape = (cs: Cell[], base = 0) => cs.map((c) => [c.row - base, c.note as number])
const frames = (label: string) =>
  (song.extra!.qa as { form: string[] }).form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
const qa = song.extra!.qa as { key: string; loopFrame: number; channels: string[]; form: string[] }

/** H, THE FLIGHT, as pulse 1 states it at 2:0: `[row, MIDI]`. Every bar climbs three
 *  eighths (2 rows each) and lands on the second beat (row 6 of the bar); both landings are
 *  answered by a stepwise fall whose last eighth is a rest, which is why rows 20-23 and
 *  44-47 carry no attack. Bar 3 is bar 1 one scale step higher — the peak b5 is the fourth
 *  link of one gesture, not a new idea. */
const H: number[][] = [
  [0, 71], [2, 74], [4, 78], [6, 81],
  [12, 79], [14, 78], [16, 76], [18, 78],
  [24, 74], [26, 78], [28, 81], [30, 83],
  [36, 79], [38, 76], [40, 73], [42, 74],
]
/** B natural minor as a ladder, for the inversion pin: one index is one scale step. */
const LADDER = [0, 2, 3, 5, 7, 8, 10]
const rung = (i: number) => 35 + 12 * Math.floor(i / 7) + LADDER[((i % 7) + 7) % 7]
const RUNGS = Array.from({ length: 56 }, (_, i) => rung(i))
const idx = (midi: number) => RUNGS.indexOf(midi)

describe('Headlong — 6/8 at 200, and the bar keeps coming apart', () => {
  it('is committed exactly as its generator wrote it, in compound duple at 200 BPM', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(3)
    expect(song.meta.rowHighlight).toBe(6) // a dotted-quarter BEAT is six 16th rows…
    expect(song.meta.rowHighlight2).toBe(12) // …and a 6/8 bar is TWO of them, not three
    expect(song.meta.rowsPerPattern).toBe(48) // so a frame is four 6/8 bars, 2.4 s
    expect((24 * song.meta.tempo) / (song.meta.speed * song.meta.rowHighlight)).toBe(200)
    expect(song.order).toHaveLength(51)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('b-minor')
    expect(qa.loopFrame).toBe(2) // the launch plays once; the loop starts the flight again
    expect(qa.form.filter((l, i) => qa.form[i - 1] !== l)).toEqual([
      'launch', 'flight', 'flight2', 'chase', 'dive', 'three', 'hinge',
      'updraft', 'updraft2', 'hush', 'sprint', 'stall', 'return', 'crest', 'tail',
    ])
    // instrument 0 is this piece's own lead, not a shared-bank drum: the album gate in
    // soundtrack.test.ts compares instrument 0's macro set across every song
    expect(song.instruments[0].name).toBe('x-headlong-lead')
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-headlong-|[a-z-]+$)/)
  })

  it('the tune is a compound-metre tune: eighths, a landing on beat 2, and a rest', () => {
    expect(shape(attacks('pulse1', [2]), 2 * ROWS)).toEqual(H)
    // the landings are dotted quarters on the bar's SECOND beat (row 6), held six rows
    for (const bar of [0, 2]) expect(H.find(([r]) => r === bar * 12 + 6)).toBeDefined()
    // and the last eighth of each answering bar is empty — the rest is part of the motif
    const struck = new Set(attacks('pulse1', [2]).map((c) => c.r))
    for (const r of [20, 22, 44, 46]) expect(struck.has(r), `2:${r} is the breath`).toBe(false)
    expect(cellAt('pulse1', 2, 22)?.note).toBe(-1) // and the breath is a written cut
    // every attack is on an even row: 16ths are ornaments here, not the motion
    expect(H.filter(([r]) => r % 2 !== 0)).toHaveLength(0)
    // bar 3 is bar 1 TWO scale steps higher with its landing pulled back one step onto the
    // tonic — the tonal adjustment that makes the peak the key's own note and the fourth
    // link of one gesture rather than a new idea
    const bar1 = H.slice(0, 4).map(([, n]) => idx(n))
    const bar3 = H.slice(8, 12).map(([, n]) => idx(n))
    expect(bar3.slice(0, 3)).toEqual(bar1.slice(0, 3).map((i) => i + 2))
    expect(bar3[3]).toBe(bar1[3] + 1)
    expect(RUNGS[bar3[3]] % 12).toBe(11) // b, the tonic
  })

  it('chase: the tune one eighth late against a kit that is not', () => {
    // H displaced +2 rows from 10:2, and H2 after it: eight bars behind the beat
    const displaced = attacks('pulse1', [10, 11]).filter((c) => c.row < 10 * ROWS + 48)
    expect(shape(displaced, 10 * ROWS)).toEqual(H.map(([r, n]) => [r + 2, n]))
    // the kit did NOT move: the kick is still on row 0 of every bar of the displacement
    for (const f of [10, 11]) for (const r of [0, 12, 24, 36]) {
      expect(cellAt('noise', f, r)?.note, `kick at ${f}:${r}`).toBe(36)
    }
    // and the bar snaps back at 13:0, where the tune is on the grid again
    expect(attacks('pulse1', [13])[0].r).toBe(0)
  })

  it('three: the hemiola is the tune, not an accent pattern', () => {
    const F = frames('three')
    expect(F).toEqual([18, 19, 20, 21, 22])
    // H AUGMENTED: every value doubled, which in 6/8 lands every attack on a 4-row grid
    const aug = attacks('pulse1', [18, 19]).filter((c) => c.row < 18 * ROWS + 96)
    expect(shape(aug, 18 * ROWS)).toEqual(H.map(([r, n]) => [r * 2, n]))
    expect(aug.every((c) => (c.row - 18 * ROWS) % 4 === 0)).toBe(true)
    // and then the same thing upside down about f#5, still on the 4-row grid
    const inv = attacks('pulse1', [20, 21]).filter((c) => c.row < 20 * ROWS + 96)
    expect(shape(inv, 20 * ROWS)).toEqual(H.map(([r, n]) => [r * 2, rung(2 * idx(78) - idx(n))]))
    // V2 counts THREE for twenty bars — rows 0, 4, 8 of every bar
    for (const f of [18, 19, 20, 21]) {
      expect(attacks('vrc6p2', [f]).map((c) => c.r)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44])
    }
    // V1 takes the same three groups an eighth later, a second offset three-count
    expect(attacks('vrc6p1', [19]).map((c) => c.r)).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46])
    // the kit agrees: kick on group 1, snare on groups 2 and 3, and NO attack on row 6
    for (const f of [18, 19]) {
      const kit = attacks('noise', [f]).filter((c) => c.r < 12)
      expect(kit.map((c) => c.r)).toEqual([0, 4, 8, 10])
      expect(kit[0].note).toBe(36)
      expect(kit[1].note).toBe(39)
    }
    // …and it does not play that cell for twenty bars: all five frames are different
    // patterns, the third group becomes a KICK in bars 8–11, and bars 12–15 whisper a metal
    // tick on row 6 — the bar's real second beat — while V1 is away
    expect(new Set(F.map((f) => song.order[f][song.channels.indexOf('noise')])).size).toBe(5)
    expect(cellAt('noise', 20, 8)?.note).toBe(36)
    expect(cellAt('noise', 21, 6)?.note).toBe(44)
    expect(cellAt('noise', 18, 6)).toBeUndefined()
    // V1 leaves for four bars at 21:0 and returns at 22:0 with its three-note cell REVERSED:
    // bars 0–11 run root · third · fifth, bars 16–19 run fifth · third · root
    expect(attacks('vrc6p1', [21])).toHaveLength(0)
    expect([2, 6, 10].map((r) => cellAt('vrc6p1', 18, r)!.note! % 12)).toEqual([11, 2, 6]) // b d f# = Bm
    expect([2, 6, 10].map((r) => cellAt('vrc6p1', 22, r)!.note! % 12)).toEqual([1, 10, 6]) // c# a# f# = F# reversed
    // …while the TRIANGLE keeps two: the two beats, rows 0 and 6, and nothing else
    for (const f of [18, 19, 20, 21]) {
      expect(attacks('triangle', [f]).map((c) => c.r % 12)).toEqual([0, 6, 0, 6, 0, 6, 0, 6])
    }
  })

  it('the two cadential hemiolas regroup two bars as six 4-row quarters, differently', () => {
    const groups = [24, 28, 32, 36, 40, 44]
    // 5:24 — pulse 2, V2 and the KICK take the groups; the triangle holds f# and the saw is out
    for (const ch of ['pulse1', 'pulse2', 'vrc6p2'] as const) {
      expect(attacks(ch, [5]).filter((c) => c.r >= 24).map((c) => c.r), ch).toEqual(groups)
    }
    for (const r of groups) expect(cellAt('noise', 5, r)?.note, `kick at 5:${r}`).toBe(36)
    expect(attacks('triangle', [5]).filter((c) => c.r >= 24).map((c) => c.r)).toEqual([24, 36, 46])
    expect(attacks('vrc6saw', [5]).filter((c) => c.r >= 24)).toHaveLength(0)
    // 48:24 — the SAWTOOTH and the SNARE take them, there is no kick at all, the hats keep
    // the two beats underneath, and pulse 1 holds ONE note across all twenty-four rows
    expect(attacks('vrc6saw', [48]).filter((c) => c.r >= 24).map((c) => c.r)).toEqual(groups)
    for (const r of groups) expect(cellAt('noise', 48, r)?.note, `snare at 48:${r}`).toBe(41)
    expect(attacks('noise', [48]).filter((c) => c.r >= 24 && c.note === 36)).toHaveLength(0)
    expect(attacks('noise', [48]).filter((c) => c.r >= 24 && c.note === 45).map((c) => c.r)).toEqual([30, 42])
    expect(attacks('pulse1', [48]).filter((c) => c.r >= 24)).toHaveLength(1)
    // the two are not the same cells: the first has a kick on every group, the second none
    expect(attacks('vrc6p2', [48]).filter((c) => c.r >= 24)).toHaveLength(0)
  })

  it('the 5-row cell carries its phase through the whole five-frame cycle', () => {
    const F = [33, 34, 35, 36, 37]
    const cell = attacks('vrc6p2', F)
    const base = 33 * ROWS
    // one attack every five rows, unbroken from 33:0 to 37:43 — 48 of them
    expect(cell.map((c) => c.row - base)).toEqual(Array.from({ length: 48 }, (_, i) => i * 5))
    // the entry rows are (-48k) mod 5 = 2k mod 5, which is 0, 2, 4, 1, 3 — not 0,1,2,3,4
    expect(F.map((f) => attacks('vrc6p2', [f])[0].r)).toEqual([0, 2, 4, 1, 3])
    expect(F.map((_, k) => ((-48 * k) % 5 + 5) % 5)).toEqual([0, 2, 4, 1, 3])
    // the cycle closes after lcm(5,48)/48 = 5 frames, which is why the section is five long
    expect(frames('sprint')).toEqual(F)
    // the last attack lands well before the seam (§9.8) and the lane is then silent
    expect(cell.at(-1)!.frame).toBe(37)
    expect(cell.at(-1)!.r).toBe(43)
    // …and the lane goes back to one note a bar the moment the cycle closes
    expect(attacks('vrc6p2', [38]).map((c) => c.r)).toEqual([0, 12, 24, 36])
    // the phase cycle is a timbre cycle: the instrument alternates per frame
    expect(new Set(F.map((f) => attacks('vrc6p2', [f])[0].inst)).size).toBe(2)
  })

  it('the loop body closes on a bar line: no Dxx anywhere, 2352 rows = 196 bars', () => {
    // a cut that is not a whole bar makes every loop pass re-enter out of phase with the one
    // before it — an earlier draft cut D00 here, six rows short of closing a bar, and the
    // build now refuses any piece whose loop body is not a whole number of bars (check.mjs's
    // `loop-metre` rule). So: no Dxx anywhere, the frame it used to cut short stays silent
    // instead, and the loop body itself lands exactly on a bar line.
    const allD = song.channels.flatMap((ch) => timeline(ch).filter((c) => hasFx(c, 'D')))
    expect(allD).toHaveLength(0)
    // rows 42-47 of frame 39 are the beat of silence `stall` is named for — empty on every lane
    for (const ch of song.channels) {
      expect(pattern(ch, 39).rows.filter((c) => c.r >= 42), ch).toHaveLength(0)
    }
    // the loop body is every frame from the loop row to the end; with no cuts left, each one
    // contributes a full rowsPerPattern, so the total must divide evenly into whole bars
    let loopRows = 0
    for (let f = qa.loopFrame; f < song.order.length; f++) loopRows += ROWS
    expect(loopRows % song.meta.rowHighlight2).toBe(0)
    expect(loopRows).toBe(2352)
    expect(loopRows / song.meta.rowHighlight2).toBe(196)
    // the silence still lands on the return of the theme: frame 40 row 0 restates H
    expect(shape(attacks('pulse1', [40]))).toEqual(H.map(([r, n]) => [r + 40 * ROWS, n]))
  })

  it('the chromatic dive: six links, two bars each, under voices that barely move', () => {
    const walk: [number, number, number][] = [
      [14, 0, 35], [14, 24, 34], [15, 0, 33], [15, 24, 32], [16, 0, 31], [16, 24, 30],
    ]
    for (const [f, r, note] of walk) expect(cellAt('triangle', f, r)?.note, `${f}:${r}`).toBe(note)
    // it is chromatic, not a scale: every link is exactly one semitone
    for (let i = 1; i < walk.length; i++) expect(walk[i - 1][2] - walk[i][2]).toBe(1)
    // a link lasts TWO BARS — 24 rows, 1.2 s — and the triangle holds its pitch class for
    // all of them except the last eighth, which steps to the NEXT link a bar early
    walk.forEach(([f, r, note], i) => {
      const within = attacks('triangle', [f]).filter((c) => c.r >= r && c.r < r + 22)
      expect(within.map((c) => c.note! % 12), `${f}:${r}`).toEqual(within.map(() => note % 12))
      expect(within[0].note).toBe(note)
      const announce = cellAt('triangle', f, r + 22)
      expect(announce?.note, `${f}:${r + 22} announces the next link`).toBe(walk[i + 1]?.[2] ?? 35)
    })
    // the descant above it oscillates a semitone while the bass falls six
    const descant = attacks('pulse1', [14, 15]).map((c) => c.note as number)
    expect(new Set(descant)).toEqual(new Set([74, 73]))
    // and the kit has no kick and no snare for nearly eight bars — hats alone until the
    // fill at 15:42 brings the kick back in on the last sixteenth of the eighth bar
    const kit = attacks('noise', [14, 15])
    expect(kit.filter((c) => c.note !== 45 && c.note !== 46).map((c) => `${c.frame}:${c.r}`)).toEqual(['15:47'])
    // the sawtooth is silent for those eight bars, which is what makes a fall a fall
    expect(attacks('vrc6saw', [14, 15])).toHaveLength(0)
  })

  it('the augmented sixth is mid-flight, not cadential, and resolves outward', () => {
    // g in the bass, b above it, e# above that — §9.3's own three-voice spelling
    expect(cellAt('triangle', 23, 36)?.note).toBe(31) // g1, the flat sixth
    expect(cellAt('pulse2', 23, 36)?.note).toBe(71) // b4, the tonic
    expect(cellAt('pulse1', 23, 36)?.note).toBe(77) // e#5, the sharp fourth
    expect(cellAt('vrc6p2', 23, 36)?.note).toBe(65) // e#4, doubling it an octave down
    // …and the whole chord as one 0xy cell: 04a = decimal 74, g-b-e#
    expect(cellAt('vrc6p1', 23, 36)?.note).toBe(55)
    expect(hasFx(cellAt('vrc6p1', 23, 36), '0', 74)).toBe(true)
    expect(hasFx(cellAt('vrc6p1', 24, 0), '0', 0)).toBe(true) // cancelled on the resolution
    // THE RESOLUTION IS OUTWARD: g falls a semitone, e# rises a semitone, both onto f#
    expect(cellAt('triangle', 24, 0)?.note).toBe(30) // f#1
    expect(cellAt('pulse1', 24, 0)?.note).toBe(78) // f#5
    // it is NOT a cadence: the kit runs straight through the chord…
    expect(attacks('noise', [23]).filter((c) => c.r >= 36).length).toBeGreaterThanOrEqual(4)
    // …and the f# it resolves to is re-heard as the THIRD of D, not as a dominant: the next
    // section opens on D and the sawtooth has the tune
    expect(cellAt('triangle', 25, 0)?.note! % 12).toBe(2) // d
    expect(attacks('vrc6saw', [25])[0].r).toBe(0)
  })

  it('the second lead colour: the tune leaves pulse 1 for the sawtooth at 25:0', () => {
    // H an octave below the register pulse 1 has sung it in for twenty-five frames
    expect(shape(attacks('vrc6saw', [25]), 25 * ROWS)).toEqual(H.map(([r, n]) => [r, n - 12]))
    const saw = song.instruments.findIndex((i) => i.name === 'x-headlong-saw-lead')
    for (const c of attacks('vrc6saw', [25, 26])) expect(c.inst, `${c.frame}:${c.r}`).toBe(saw)
    // and pulse 1 is demoted to a descant on its OWN second colour — a different duty
    // envelope, so the two pulse voices are told apart by their attacks
    const lead = song.instruments.findIndex((i) => i.name === 'x-headlong-lead')
    const thin = song.instruments.findIndex((i) => i.name === 'x-headlong-lead-thin')
    const duty = (inst: number) => {
      const i = song.instruments[inst].macros.duty
      return i < 0 ? [] : [...song.sequences.duty[i].values]
    }
    const wide = song.instruments.findIndex((i) => i.name === 'x-headlong-lead-wide')
    expect(lead).toBe(0)
    expect(duty(lead)).toEqual([2, 1, 1]) // 50 % narrowing to 25 %
    expect(duty(thin)).toEqual([1, 1, 0]) // 25 % narrowing to 12.5 % — a thinner singer
    expect(duty(wide)).toEqual([2]) // and one that does not narrow at all: a flat 50 %
    for (const c of attacks('pulse1', [25, 26, 27, 28])) expect(c.inst, `${c.frame}:${c.r}`).toBe(thin)
    // the climb is a section repaint: the whole of `crest` is the third colour
    for (const c of attacks('pulse1', frames('crest'))) expect(c.inst, `${c.frame}:${c.r}`).toBe(wide)
    // …and the sections that state the subject keep the first
    for (const c of attacks('pulse1', [2, 6, 10, 18, 40])) expect(c.inst, `${c.frame}:${c.r}`).toBe(lead)
    // the descant is sparse: one or two notes a bar against the saw's eighths
    expect(attacks('pulse1', [25]).length).toBeLessThan(attacks('vrc6saw', [25]).length / 2)
    // `hush` gets the thin colour too, and it is the only other place pulse 1 uses it
    const thinFrames = new Set(attacks('pulse1').filter((c) => c.inst === thin).map((c) => c.frame))
    expect([...thinFrames].sort((a, b) => a - b)).toEqual([25, 26, 27, 28, 31, 32])
    // three colours, and no one of them carries the piece
    expect(new Set(attacks('pulse1').map((c) => c.inst)).size).toBe(3)
  })

  it('flight2: pulse 2 is an independent line for the whole section', () => {
    const F = frames('flight2')
    const p2 = attacks('pulse2', F)
    expect(p2).toHaveLength(32)
    // its rhythm is the beat displaced by half of itself: rows 3 and 9 of every bar
    expect(p2.every((c) => c.r % 12 === 3 || c.r % 12 === 9)).toBe(true)
    // so not one of its attacks shares a row with pulse 1, which uses even rows only
    const p1Rows = new Set(attacks('pulse1', F).map((c) => c.row))
    expect(p2.filter((c) => p1Rows.has(c.row))).toHaveLength(0)
    // one voice crossing, and exactly one: d5 over the lead's held b4 at 8:9
    expect(cellAt('pulse2', 8, 9)?.note).toBe(74)
    expect(cellAt('pulse1', 8, 6)?.note).toBe(71)
    // the section ends on a SUSPENSION: e4 struck at 9:45 over the dominant, nothing on the
    // chord change at 10:0, resolved down by step to d4 at 10:3
    expect(cellAt('pulse2', 9, 45)?.note).toBe(64)
    expect(cellAt('pulse2', 9, 47)).toBeUndefined()
    expect(cellAt('pulse2', 10, 0)).toBeUndefined()
    expect(cellAt('pulse2', 10, 3)?.note).toBe(62)
    // and the arpeggio bed is GONE for the whole section — the declared absence
    expect(attacks('vrc6p1', F)).toHaveLength(0)
  })

  it('the arpeggio bed is established, taken away for twelve frames, and returns changed', () => {
    const bed = new Set(attacks('vrc6p1').map((c) => c.frame))
    for (const f of [1, 2, 3, 4, 5]) expect(bed.has(f), `bed in frame ${f}`).toBe(true)
    for (let f = 6; f <= 17; f++) expect(bed.has(f), `bed silent in frame ${f}`).toBe(false)
    expect(bed.has(18)).toBe(true)
    // it comes back as something else: three sixteenths on beat 1 in A, three 4-row groups
    // displaced by an eighth in `three`
    expect(attacks('vrc6p1', [2]).map((c) => c.r).slice(0, 3)).toEqual([0, 2, 4])
    expect(attacks('vrc6p1', [18]).map((c) => c.r).slice(0, 3)).toEqual([2, 6, 10])
  })

  it('hush is two lanes, and it is the only section with no kit at all', () => {
    for (const ch of ['pulse2', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(attacks(ch, [31, 32]), ch).toHaveLength(0)
    }
    expect(attacks('pulse1', [31, 32]).length).toBeGreaterThan(8)
    expect(attacks('triangle', [31, 32]).length).toBeGreaterThan(8)
    // every other section has percussion
    for (let f = 0; f < song.order.length; f++) {
      if (f === 31 || f === 32 || f === 0) continue
      expect(attacks('noise', [f]).length, `noise in frame ${f}`).toBeGreaterThan(0)
    }
  })

  it('the peak is struck once, in the last third, on a strong beat', () => {
    const all = attacks('pulse1')
    const peak = Math.max(...all.map((c) => c.note!))
    const where = all.filter((c) => c.note === peak)
    expect(peak).toBe(86) // d6
    expect(where).toHaveLength(1)
    expect(where[0].frame).toBe(47)
    expect(where[0].r).toBe(6) // the bar's SECOND beat — a strong beat in 6/8
    expect(where[0].frame).toBeGreaterThanOrEqual((song.order.length * 2) / 3)
  })

  it('states every lane at the loop row, and leaves nothing latched across the seam', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // no fill at the seam: the kit's last event in the final frame is at 50:28, and the
    // last twenty rows of the piece carry no percussion at all
    const last = song.order.length - 1
    expect(attacks('noise', [last]).at(-1)!.r).toBe(28)
    // every channel mode this piece writes is cancelled with the cancel the DRIVER honours:
    // 4x0, 000, A00, 100 (never 300) and 7x0 with x > 0 (never 700)
    const OFF: Record<string, number> = { '4': 0, '0': 0, A: 0, '1': 0, '7': 0x10 }
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of Object.keys(OFF)) {
        const lastOf = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (lastOf !== undefined) {
          expect(hasFx(lastOf, cmd, OFF[cmd]), `${ch}: ${cmd}xx still standing at ${lastOf.frame}:${lastOf.r}`).toBe(true)
        }
      }
      expect(cells.some((c) => hasFx(c, '3', 0)), `${ch}: 300 only FREEZES a portamento`).toBe(false)
      expect(cells.some((c) => hasFx(c, '7', 0)), `${ch}: 700 REPLAYS the tremolo memory`).toBe(false)
    }
  })

  it('anti-vacuity: the pins can fail — a squared-up Headlong is caught', () => {
    // the cell really is five rows, and five really does not divide a 48-row frame
    const cell = attacks('vrc6p2', [33]).map((c) => c.r)
    expect(cell[1] - cell[0]).toBe(5)
    expect(48 % (cell[1] - cell[0])).not.toBe(0)
    // the displacement is a displacement: chase's tune is NOT on the grid
    expect(shape(attacks('pulse1', [10]).slice(0, 4), 10 * ROWS)).not.toEqual(H.slice(0, 4))
    // the augmentation is not the original, and the inversion is not the augmentation
    expect(shape(attacks('pulse1', [18]), 18 * ROWS)).not.toEqual(H)
    expect(shape(attacks('pulse1', [20]), 20 * ROWS)).not.toEqual(shape(attacks('pulse1', [18]), 18 * ROWS))
    // the hemiola section really disagrees with itself: V2's 4-row grid never lands on the
    // triangle's second beat, and the triangle never lands on V2's middle group
    const v2 = new Set(attacks('vrc6p2', [19]).map((c) => c.r % 12))
    const tri = new Set(attacks('triangle', [19]).map((c) => c.r % 12))
    expect([...v2]).toEqual([0, 4, 8])
    expect([...tri]).toEqual([0, 6])
    expect([...v2].filter((r) => tri.has(r))).toEqual([0])
    // and the piece is genuinely in six: no section could be re-barred into 4/4 without
    // loss, because the bass states two dotted-quarter beats, not four quarters
    expect(song.meta.rowHighlight2 / song.meta.rowHighlight).toBe(2)
  })
})
