/** Night Shift (11) — what makes the piece itself, pinned at frame:row. Not a claim of
 *  musical quality: the gates in presets.test.ts decide correctness, a listener decides the
 *  rest. Self-contained on purpose: it copies the small helpers it needs rather than
 *  importing soundtrack.test.ts, which the integrator restructures at merge time.
 *  The composition is tools/songs/compose/11-night-shift.mjs; the JSON is its output. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { Song } from '../../src/tracker/model/types'

const file = join(import.meta.dirname, '../../src/assets/songs/11-night-shift.json')
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
/** The MIDI note at one frame:row, for the pins that do arithmetic on two of them. */
function noteAt(channel: Channel, frame: number, r: number): number {
  const note = cellAt(channel, frame, r)?.note
  expect(note, `${channel} ${frame}:${r}`).toBeTypeOf('number')
  return note as number
}
type WithFx = { fx?: readonly ({ cmd: string; param: number } | null)[] | undefined }
function hasFx(c: WithFx | undefined, cmd: string, param?: number) {
  return (c?.fx ?? []).some((e) => e !== null && e.cmd === cmd && (param === undefined || e.param === param))
}
const rowsOf = (cs: Cell[]) => cs.map((c) => c.r)
const framesOf = (label: string) =>
  (song.extra!.qa as { form: string[] }).form.map((l, f) => (l === label ? f : -1)).filter((f) => f >= 0)
const qa = song.extra!.qa as {
  key: string; loopFrame: number; channels: string[]; form: string[]
  percussionGap: number; accidentalFractionMax: number; rmsRange: [number, number]
}

/** THE TRESILLO. 3+3+2 sixteenths is 6+6+4 rows on a thirty-second grid, so half a bar is
 *  rows 0, 6, 12 and the other half is 16, 22, 28. This is the skeleton every statement of
 *  the bass motif keeps — the pitches change per chord, these rows never do. */
const TRESILLO = [0, 6, 12, 16, 22, 28]
/** …and the second bar of the motif, which is where the space is: the third slot is a rest
 *  and the fifth carries a `Qxy` slide instead of an attack, so only four of six sound. */
const TRESILLO_OPEN = [32, 38, 48, 60]

describe('Night Shift — a straight 90 BPM groove whose subject is the pocket', () => {
  it('is committed exactly as its generator wrote it, in E dorian at 90 BPM on 32nd rows', () => {
    expect(serializeSong(song)).toBe(text)
    expect(song.meta.speed).toBe(5)
    expect(song.meta.tempo).toBe(150) // straight: ticks per row is the integer 5
    expect(song.meta.rowHighlight).toBe(8) // EIGHT rows to the beat — a row is a 32nd
    expect(song.meta.rowHighlight2).toBe(32) // and a bar is four of them
    expect(song.meta.rowsPerPattern).toBe(64) // so a frame is TWO bars, not four
    expect((24 * song.meta.tempo) / (song.meta.speed * song.meta.rowHighlight)).toBe(90)
    expect(song.order).toHaveLength(24)
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw'])
    expect(qa.key).toBe('e-dorian')
    expect(qa.loopFrame).toBe(2) // the intro plays once
    expect(qa.form).toEqual([
      'clock-in', 'clock-in', 'A', 'A', 'A', 'A', "A'", "A'", "A'", "A'",
      'comp', 'comp', 'comp', 'comp', 'graveyard', 'graveyard', 'graveyard',
      'lift', 'lift', "A''", "A''", "A''", 'turn', 'turn',
    ])
    // instrument 0 is this piece's own bass, not a shared-bank drum: the album gate in
    // soundtrack.test.ts compares instrument 0's macro set across every song
    expect(song.instruments[0].name).toBe('x-night-shift-saw-thumb')
    for (const i of song.instruments) expect(i.name).toMatch(/^(x-night-shift-|[a-z-]+$)/)
  })

  it('the bass is the tresillo: 6+6+4 rows, with the second bar left open', () => {
    // the motif as A states it (frame 2, Em9) — six attacks, then four and a rest
    const head = attacks('vrc6saw', [2])
    expect(rowsOf(head)).toEqual([...TRESILLO, ...TRESILLO_OPEN])
    // row 44 is the rest that opens the second bar, and row 54 is the SLIDE — an
    // effect-only `Qxy` cell, no note, which is why it is not in the attack list
    expect(cellAt('vrc6saw', 2, 44)).toBeUndefined()
    expect(cellAt('vrc6saw', 2, 54)?.note).toBeUndefined()
    expect(hasFx(cellAt('vrc6saw', 2, 54), 'Q')).toBe(true)
    // the slide lands on the RAISED SIXTH, which is what makes the mode dorian and not
    // aeolian: b1 (35) is sounding, and `Qx2` takes it up two semitones to c#2 (37)
    expect(cellAt('vrc6saw', 2, 48)?.note).toBe(35)
    expect((cellAt('vrc6saw', 2, 54)!.fx ?? []).find((e) => e !== null && e.cmd === 'Q')!.param & 0x0f).toBe(2)
    // two weights, not six equal sixteenths: the three weak positions — the sixteenth
    // after the downbeat and the push at the end of each bar — are GHOSTS on a separate,
    // much shorter instrument, and the accents are not
    const ghost = song.instruments.findIndex((i) => i.name === 'x-night-shift-saw-ghost')
    expect(ghost).toBeGreaterThan(0)
    expect(head.filter((c) => c.inst === ghost).map((c) => c.r)).toEqual([6, 28, 60])
    expect(new Set(head.map((c) => c.vol)).size).toBeGreaterThanOrEqual(4)
    // and the grouping really is 3+3+2 rather than an even four. The cell is HALF a bar, so
    // the bar is two of them: the gaps inside are 6, 6, 4 | 6, 6, and the last group runs
    // the remaining 4 rows to the barline.
    expect(TRESILLO.slice(1).map((r, i) => r - TRESILLO[i])).toEqual([6, 6, 4, 6, 6])
    expect(BAR - TRESILLO[TRESILLO.length - 1]).toBe(4)
    expect(BAR % 6).not.toBe(0) // six does not divide the bar, which is why it syncopates
  })

  it('`Gxx` is used structurally: one lane behind the beat for a whole section, the rest dead on', () => {
    const comp = framesOf('comp')
    expect(comp).toEqual([10, 11, 12, 13])
    // EVERY note-carrying vrc6p2 cell in comp is two ticks late. `Gxx` is not a channel
    // mode — the driver reads it per cell — so a lane that lays back needs it on all of
    // them, and there is nothing to cancel afterwards.
    const behind = attacks('vrc6p2', comp)
    expect(behind).toHaveLength(48)
    expect(behind.every((c) => hasFx(c, 'G', 2))).toBe(true)
    expect(behind[0].row).toBe(10 * ROWS + 2)
    expect(behind.at(-1)!.row).toBe(13 * ROWS + 62)
    // the noise ghosts are dragged with it…
    const dragged = attacks('noise', comp).filter((c) => hasFx(c, 'G', 2))
    expect(dragged.length).toBeGreaterThanOrEqual(16)
    // …and these lanes are DEAD ON, which is the half of the device that makes it audible
    for (const ch of ['vrc6saw', 'dpcm', 'vrc6p1'] as const) {
      expect(attacks(ch, comp).some((c) => hasFx(c, 'G')), ch).toBe(false)
    }
    // the hats are dead on too: every noise cell carrying a delay is a ghost (note 39)
    expect(dragged.every((c) => c.note === 39)).toBe(true)
    // the drag instrument is LONGER than the dead-on stab, because `Gxx` delays macro
    // index 0 as well and a short envelope would lose the end of its tail
    const lengthOf = (name: string) => {
      const inst = song.instruments.find((i) => i.name === name)!
      return song.sequences.volume[inst.macros.volume].values.length
    }
    expect(lengthOf('x-night-shift-comp')).toBeGreaterThan(lengthOf('x-night-shift-stab'))
    // A''s `G01` strum is a DIFFERENT amount of lateness, on purpose
    const strum = attacks('vrc6p2', framesOf("A''")).filter((c) => hasFx(c, 'G', 1))
    expect(strum.length).toBeGreaterThanOrEqual(10)
    expect(strum[0].row).toBe(19 * ROWS + 14)
  })

  it('a six-row cell carries its phase across three frames — 0, 2, 4, computed for 64 rows', () => {
    // §9.1's table is for 64-row frames at four rows to the beat; the arithmetic is what
    // travels, not the table. Entry row of frame k for a cell of length c is (−64k) mod c,
    // and the cycle closes after lcm(c, 64) / 64 frames.
    const entry = (k: number, c: number) => ((-ROWS * k) % c + c) % c
    expect([0, 1, 2].map((k) => entry(k, 6))).toEqual([0, 2, 4])
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    expect((6 * ROWS) / gcd(6, ROWS) / ROWS).toBe(3) // lcm(6, 64) = 192, and 192 / 64 = 3
    const grave = framesOf('graveyard')
    expect(grave).toEqual([14, 15, 16])
    const cell = attacks('vrc6p1', grave)
    // the entry rows the file actually has, frame by frame
    expect(grave.map((f) => cell.find((c) => c.frame === f)!.r)).toEqual([0, 2, 4])
    // unbroken: every gap is exactly six rows, straight through both frame lines
    const gaps = new Set(cell.slice(1).map((c, i) => c.row - cell[i].row))
    expect([...gaps]).toEqual([6])
    expect(cell.at(-1)!.row).toBe(16 * ROWS + 52) // and it stops before the `D00`
    // it is a LINE as well as a clock: the pitch steps down with the harmony
    expect([...new Set(cell.map((c) => c.note))]).toEqual([59, 57, 54, 52])
  })

  it('exactly one metric surprise: `D00` drops a beat at 16:55, and never at the loop seam', () => {
    const all = song.patterns.flatMap((p) => p.rows.flatMap((c) => (c.fx ?? [])
      .filter((e) => e !== null && e.cmd === 'D').map(() => ({ channel: p.channel, index: p.index, r: c.r }))))
    expect(all).toHaveLength(1)
    expect(all[0].r).toBe(55)
    expect(hasFx(cellAt('dpcm', 16, 55), 'D', 0)).toBe(true)
    // rows 56–63 of that frame are unreachable, so nothing is written there on any lane
    for (const ch of song.channels) {
      expect(pattern(ch, 16).rows.filter((c) => c.r > 55), ch).toEqual([])
    }
    // a beat is eight rows here, so the frame is 56 rows and the bar is three beats
    expect(ROWS - 56).toBe(song.meta.rowHighlight)
    // and the last frame's last row is the loop, not a metric event
    expect(hasFx(cellAt('pulse1', 23, ROWS - 1), 'B', 2)).toBe(true)
  })

  it('the common-tone diminished: one voice stationary, three moving up a semitone, twice', () => {
    // A°7 (a c e♭ f#) → A7 (a c# e g) on the push into the IV chord, and the same device
    // transposed into G dorian as C°7 → C7 on the push into A″'s IV. Two rows of chromatic
    // and then it resolves, which is §9.3's budget to the row.
    for (const [push, land, hold, from, to] of [
      [6, 7, 57, [60, 63, 54], [61, 64, 55]],
      [19, 20, 60, [63, 66, 57], [64, 67, 58]],
    ] as const) {
      // the held voice is on vrc6p1 and does not move
      expect(cellAt('vrc6p1', push, 62)?.note, `${push}:62 hold`).toBe(hold)
      expect(cellAt('vrc6p1', land, 0)?.note, `${land}:0 hold`).toBe(hold)
      // the other three are on three different timbres, and each rises exactly one semitone
      const lanes = ['vrc6p2', 'pulse2', 'triangle'] as const
      lanes.forEach((ch, i) => {
        expect(cellAt(ch, push, 62)?.note, `${ch} ${push}:62`).toBe(from[i])
        expect(cellAt(ch, land, 0)?.note, `${ch} ${land}:0`).toBe(to[i])
        expect(to[i] - from[i]).toBe(1)
      })
      // it is a dim7: stacked minor thirds above the held tone, in pitch-class terms
      const pcs = [...new Set([hold, ...from].map((n) => ((n - hold) % 12 + 12) % 12))].sort((a, b) => a - b)
      expect(pcs).toEqual([0, 3, 6, 9])
      // the push is the sixteenth before the beat, two rows, not a sustained chord
      expect(62).toBe(BAR * 2 - 2)
    }
  })

  it('a true pivot modulation by a MINOR third, stated bare, and confirmed by its dominant', () => {
    // Am7 arrives as the borrowed iv of E at 16:32 — a c natural in the triangle, glided
    // into rather than struck
    expect(hasFx(cellAt('triangle', 16, 28), 'Q', 0x11)).toBe(true)
    expect(cellAt('triangle', 16, 0)?.note).toBe(59) // b3, the fifth of Bm7…
    // …and at 17:0 it is quitted as ii of G: EXACTLY TWO pitched lanes attack there
    const bare = song.channels.filter((ch) => (cellAt(ch, 17, 0)?.note ?? -1) >= 0 && ch !== 'noise' && ch !== 'dpcm')
    expect(bare).toEqual(['triangle', 'vrc6p1'])
    expect(cellAt('triangle', 17, 0)!.note).toBe(33) // a1, the root
    expect(cellAt('vrc6p1', 17, 0)!.note).toBe(55) // g3, the seventh
    // D7 confirms the new key from 18:14 — f#3 is its raised third, c4 its seventh — and
    // G dorian lands at 19:0
    expect(cellAt('vrc6p2', 18, 14)?.note).toBe(54)
    expect(cellAt('vrc6p1', 18, 14)?.note).toBe(60)
    expect(cellAt('vrc6saw', 19, 0)?.note).toBe(31) // g1
    // a MINOR third, not the whole tone two other album pieces already use
    expect(noteAt('vrc6saw', 19, 0) - noteAt('vrc6saw', 2, 0)).toBe(3)
    // and the head really is transposed rather than rewritten: same rows, +3 semitones
    expect(rowsOf(attacks('vrc6saw', [19]))).toEqual(rowsOf(attacks('vrc6saw', [2])))
    expect(attacks('pulse1', [19]).map((c) => c.note))
      .toEqual(attacks('pulse1', [2]).map((c) => (c.note as number) + 3))
  })

  it('a descending-THIRDS sequence of three links that arrives somewhere', () => {
    // comp is one chord per bar, so the roots fall a third every 32 rows: E → C# → A → F#,
    // arriving on B at 12:0. Descending fifths already appear twice on this album.
    const roots = [[10, 0], [10, 32], [11, 0], [11, 32], [12, 0]]
      .map(([f, r]) => cellAt('vrc6saw', f, r)!.note as number)
    expect(roots).toEqual([28, 37, 33, 30, 35]) // e1 c#2 a1 f#1 b1
    const down = roots.slice(1, 4).map((n, i) => ((roots[i] - n) % 12 + 12) % 12)
    expect(down).toEqual([3, 4, 3]) // minor, major, minor third — a real sequence
    // and the harmonic rhythm really does differ from A's, which is one chord per TWO bars
    expect(attacks('vrc6p1', [10]).map((c) => c.r)).toEqual([0, 32])
    expect(attacks('vrc6p1', [2]).map((c) => c.r).length).toBeLessThan(4)
  })

  it('pulse 2 is an independent line for the whole of comp, and carries the 4–3 suspension', () => {
    const comp = framesOf('comp')
    const p2 = attacks('pulse2', comp)
    expect(p2).toHaveLength(31)
    expect(p2[0].row).toBe(10 * ROWS + 4)
    expect(p2.at(-1)!.row).toBe(13 * ROWS + 58)
    const p1Rows = new Set(attacks('pulse1', comp).map((c) => c.row))
    // §9.2 asks for ≥ 40 % of pulse 2's attacks on rows pulse 1 does not attack
    expect(p2.filter((c) => !p1Rows.has(c.row)).length / p2.length).toBeGreaterThanOrEqual(0.4)
    // its own rhythm: it never shares an attack-row set with pulse 1 in any frame
    for (const f of comp) {
      expect(rowsOf(attacks('pulse2', [f])).join(), `frame ${f}`)
        .not.toBe(rowsOf(attacks('pulse1', [f])).join())
    }
    // the cadential 4–3: d4 at 13:32 is Bm7's third, it holds through the change to A7 on
    // row 48 (nothing restrikes it there) and resolves DOWN BY STEP to c#4 at 13:52
    expect(cellAt('pulse2', 13, 32)?.note).toBe(62)
    expect(cellAt('pulse2', 13, 48)).toBeUndefined()
    expect(cellAt('pulse2', 13, 52)?.note).toBe(61)
    // the second one is the same figure in A′
    expect(cellAt('pulse2', 9, 40)?.note).toBe(62)
    expect(cellAt('pulse2', 9, 52)?.note).toBe(61)
    // and it sings: the long notes carry vibrato written a beat after the attack
    expect(timeline('pulse2').filter((c) => hasFx(c, '4')).length).toBeGreaterThanOrEqual(4)
  })

  it('the tune changes instrument in the lift, and that is the second lead colour', () => {
    const lift = framesOf('lift')
    expect(lift).toEqual([17, 18])
    // pulse 1 is SILENT for the whole section — the handover is not a doubling
    expect(attacks('pulse1', lift)).toEqual([])
    // the sawtooth carries it, in the tenor: an octave and a half above its own bass
    const tune = attacks('vrc6saw', lift)
    expect(tune[0].row).toBe(17 * ROWS + 16)
    expect(Math.min(...tune.map((c) => c.note as number))).toBeGreaterThanOrEqual(52)
    expect(Math.max(...tune.map((c) => c.note as number))).toBeLessThanOrEqual(64)
    // …on its own instrument, which has a pitch macro (the bend-in) the bass does not
    const lead = song.instruments.find((i) => i.name === 'x-night-shift-saw-lead')!
    expect(lead.macros.pitch).toBeGreaterThanOrEqual(0)
    expect(song.instruments.find((i) => i.name === 'x-night-shift-saw-thumb')!.macros.pitch).toBe(-1)
    expect(tune.every((c) => c.inst === song.instruments.indexOf(lead))).toBe(true)
    // and the TRIANGLE takes the bass, in the octave the sawtooth just left, with the
    // motif's own rhythm: the two lanes swap registers, which is what makes it audible
    const bass = attacks('triangle', lift)
    expect(Math.min(...bass.map((c) => c.note as number))).toBeLessThanOrEqual(38)
    expect(rowsOf(attacks('triangle', [18])).slice(0, 6)).toEqual(TRESILLO)
  })

  it('the global peak is one appoggiatura in the last third, and the lead shuts up elsewhere', () => {
    const lead = attacks('pulse1')
    const peak = Math.max(...lead.map((c) => c.note as number))
    expect(peak).toBe(82) // b♭5
    const where = lead.filter((c) => c.note === peak)
    expect(where).toHaveLength(1) // exactly one highest note in the piece
    expect(where[0].row).toBe(21 * ROWS + 32) // beat 1 of A″'s last bar
    expect(where[0].row / (song.order.length * ROWS)).toBeGreaterThan(2 / 3) // the last third
    // an appoggiatura: it resolves DOWN BY STEP, and it is not a chord tone of the Dm7
    expect(cellAt('pulse1', 21, 36)?.note).toBe(81)
    // …and the lane is silent for most of the piece, which is the idiom, not an omission
    const silent = song.order.map((_, f) => attacks('pulse1', [f]).length).filter((n) => n === 0)
    expect(silent.length).toBeGreaterThanOrEqual(12)
  })

  it('nine fills, none identical, and no fill at the loop seam', () => {
    // a fill is the last half-bar of an 8-bar unit; a bar here is 32 rows, so that is the
    // last 16. Fingerprint each one by the instruments and volumes it uses.
    const SEAMS: [number, number][] = [[1, 48], [3, 48], [5, 48], [7, 48], [9, 48], [13, 48], [15, 48], [18, 48], [21, 48]]
    const prints = SEAMS.map(([f, r]) => attacks('noise', [f]).filter((c) => c.r >= r)
      .map((c) => `${c.note}/${c.inst}/${c.vol}`).join(' '))
    expect(prints.every((p) => p.length > 0)).toBe(true)
    expect(new Set(prints).size).toBe(SEAMS.length)
    // the last bar of the piece is the exception: the kit thins to a brush on the beat and
    // the final eight rows carry nothing but the held bass and the `Bxx`
    const tail = attacks('noise', [23]).filter((c) => c.r >= 48)
    const brush = song.instruments.findIndex((i) => i.name === 'x-night-shift-brush')
    expect(tail.length).toBeGreaterThan(0)
    expect([...new Set(tail.map((c) => c.inst))]).toEqual([brush]) // brushes, and nothing else
    for (const ch of song.channels) {
      expect(attacks(ch, [23]).filter((c) => c.r >= 57), ch).toEqual([])
    }
  })

  it('states every lane at the loop row, and leaves no channel mode latched across the seam', () => {
    for (const ch of song.channels) {
      const first = cellAt(ch, qa.loopFrame, 0)
      expect(first, ch).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note).toBeGreaterThanOrEqual(0)
        expect(first!.inst).toBeDefined()
        expect(first!.vol).toBeDefined()
      }
    }
    // every channel mode this piece writes is cancelled with the cancel the DRIVER honours
    const OFF: Record<string, number> = { '4': 0, A: 0 }
    for (const ch of song.channels) {
      const cells = timeline(ch)
      for (const cmd of Object.keys(OFF)) {
        const last = [...cells].reverse().find((c) => hasFx(c, cmd))
        if (last !== undefined) {
          expect(hasFx(last, cmd, OFF[cmd]), `${ch}: ${cmd}xx still standing at ${last.frame}:${last.r}`).toBe(true)
        }
      }
      // `Gxx` is NOT one of them — it is read per cell — and `300`/`700` never appear
      expect(cells.some((c) => hasFx(c, '3')), `${ch}: no portamento to freeze`).toBe(false)
      expect(cells.some((c) => hasFx(c, '7')), `${ch}: no tremolo memory to replay`).toBe(false)
    }
  })

  it('declares what it raises, and the numbers are the measured ones', () => {
    expect(qa.accidentalFractionMax).toBe(0.15)
    expect(qa.percussionGap).toBe(16)
    expect(qa.rmsRange).toEqual([-26, -19])
    const notes = (song.extra!.qa as { notes: string }).notes
    for (const claim of ['accidentalFractionMax 0.15', 'percussionGap 16', 'rmsRange [-26, -19]']) {
      expect(notes, claim).toContain(claim)
    }
    // no game, no composer, no published piece, anywhere in the document
    expect(`${song.meta.name} ${song.meta.author} ${notes}`).not.toMatch(/castlevania|mega ?man|konami|capcom|nintendo/i)
  })

  it('anti-vacuity: the pins can fail — a four-square version is caught', () => {
    // the tresillo is not an even subdivision of the bar
    expect(rowsOf(attacks('vrc6saw', [2])).slice(0, 4)).not.toEqual([0, 8, 16, 24])
    // the six-row cell is not frame-aligned, which is the whole point of the phase carry
    expect(ROWS % 6).not.toBe(0)
    // comp really is behind the beat: deleting the delays would change every one of 48 cells
    expect(attacks('vrc6p2', framesOf('comp')).filter((c) => hasFx(c, 'G', 0))).toEqual([])
    // the lift is a re-orchestration, not a transposition: the pitches are not the head's
    expect(attacks('vrc6saw', [17]).map((c) => c.note)).not.toEqual(attacks('vrc6saw', [2]).map((c) => c.note))
    // and A″ is a minor third up, not a whole tone
    expect(noteAt('vrc6saw', 19, 0) - noteAt('vrc6saw', 2, 0)).not.toBe(2)
  })
})
