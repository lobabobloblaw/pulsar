/** 06 Sunward Banner — what makes this piece itself, pinned at frame:row.
 *
 *  The album-wide rules every preset obeys live in `soundtrack.test.ts`; the four gates
 *  live in `presets.test.ts`. This file pins the composition: the devices the generator
 *  `tools/songs/compose/06-sunward-banner.mjs` says it wrote, asserted against the bytes
 *  that shipped. None of it is a claim that the music is good — it is a claim that the
 *  music is the one that was described, so a later edit that quietly loses the phase
 *  carry, the augmented sixth or the independent counter-melody fails here.
 *
 *  House style is anti-vacuity, so two of these prove they could fail: the phase-carry
 *  rows are re-derived from preset-suite §9.1's own formula rather than typed in, and the
 *  unison doubling is checked against `pitch.ts` to show the octave it replaced would
 *  really have beaten.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSong } from '../../src/tracker/model/validate'
import type { ChannelId, Song } from '../../src/tracker/model/types'
import {
  centsBetween, midiToHz, pulseHzForTimer, pulseTimerForMidi, vrc6PulseHzForTimer, vrc6PulseTimerForMidi,
} from '../../src/audio/host/pitch'

const file = join(import.meta.dirname, '../../src/assets/songs/06-sunward-banner.json')
const song: Song = parseSong(JSON.parse(readFileSync(file, 'utf8'))).song
const ROWS = song.meta.rowsPerPattern
const BAR = song.meta.rowHighlight2

type Cell = Song['patterns'][number]['rows'][number]
const patterns = new Map(song.patterns.map((p) => [`${p.channel}:${p.index}`, p]))

/** Every cell the order reaches on one lane, by ABSOLUTE row, so `frame * 64 + row` is
 *  the same coordinate the generator's comments and `extra.qa.notes` cite. */
function lane(channel: ChannelId): Map<number, Cell> {
  const index = song.channels.indexOf(channel)
  const out = new Map<number, Cell>()
  song.order.forEach((frame, f) => {
    const p = patterns.get(`${channel}:${frame[index]}`)
    if (p !== undefined) for (const cell of p.rows) out.set(f * ROWS + cell.r, cell)
  })
  return out
}
/** Absolute row -> note, attacks only (a cut is -1 and a release -2). */
function notes(channel: ChannelId): Map<number, number> {
  return new Map([...lane(channel)]
    .filter(([, c]) => c.note !== undefined && c.note >= 0)
    .map(([row, c]) => [row, c.note as number]))
}
function attacksIn(channel: ChannelId, first: number, last: number): [number, number][] {
  return [...notes(channel)].filter(([row]) => row >= first && row <= last).sort((a, b) => a[0] - b[0])
}
const P1 = notes('pulse1')
const at = (frame: number, row = 0) => frame * ROWS + row

const qa = song.extra!.qa as {
  key: string; loopFrame: number; form: string[]; channels: string[]
  accidentalFractionMax: number; percussionGap: number; durationSec: [number, number]
}
/** The first frame of each named section, so a pin reads as the composer wrote it. */
const frameOf = Object.fromEntries(
  [...new Set(qa.form)].map((name) => [name, qa.form.indexOf(name)]),
) as Record<string, number>

describe('06 Sunward Banner', () => {
  it('is a 150 BPM anthem on a 16th grid: 23 frames of four bars, looping past its fanfare', () => {
    expect(song.meta.speed).toBe(6)
    expect(song.meta.tempo).toBe(150)
    expect([song.meta.rowsPerPattern, song.meta.rowHighlight, song.meta.rowHighlight2]).toEqual([64, 4, 16])
    expect(song.order).toHaveLength(23)
    expect(song.channels).toEqual([
      'pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2', 'vrc6saw',
    ])
    expect(qa.key).toBe('d-major')
    expect(qa.accidentalFractionMax).toBe(0.2) // the modulation to E is most of it
    expect(qa.loopFrame).toBe(frameOf.theme)
    expect(qa.form.slice(0, 2)).toEqual(['fanfare', 'fanfare'])
    expect(qa.form.at(-1)).toBe('coda')
    // every lane earns its claim, dpcm included: this is the album's only eight-voice
    // piece that plays the generated kit rather than declaring an empty dpcm lane
    expect(qa.channels).toEqual(song.channels)
  })

  it('opens with the three-voice VRC6 chorale: no 2A03 pulse or triangle sounds until the theme', () => {
    const fanfareEnd = at(frameOf.theme) - 1
    for (const quiet of ['pulse1', 'pulse2', 'triangle'] as const) {
      expect(attacksIn(quiet, 0, fanfareEnd), quiet).toEqual([])
    }
    for (const brass of ['vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(attacksIn(brass, 0, fanfareEnd).length, brass).toBeGreaterThanOrEqual(8)
    }
    // ...and the kit is there under them, so the section is a chorale, not a silence
    expect(attacksIn('noise', 0, fanfareEnd).length).toBeGreaterThanOrEqual(24)
  })

  it('states the head, inverts it for the chorus and sequences it up a step through the build', () => {
    // the head: d5 held, a falling fourth, two rising steps (the tune, at the loop frame)
    const head = attacksIn('pulse1', at(frameOf.theme), at(frameOf.theme, 15)).map(([, n]) => n)
    expect(head).toEqual([74, 69, 71, 73])
    expect(head[1] - head[0]).toBe(-5) // the signature falling fourth
    // its tail is sequenced a step lower two bars later, which widens the leap to a fifth
    const sequenced = attacksIn('pulse1', at(frameOf.theme, 32), at(frameOf.theme, 47)).map(([, n]) => n)
    expect(sequenced).toEqual([74, 67, 69, 71])
    expect(sequenced.slice(1).map((n, i) => n - head[i + 1])).toEqual([-2, -2, -2])
    // the chorus inverts it: the fourth rises, and it lands on the tresillo instead
    const chorusHead = attacksIn('pulse1', at(frameOf.chorus), at(frameOf.chorus, 15))
    expect(chorusHead.map(([, n]) => n)).toEqual([69, 74, 76])
    expect(chorusHead[1][1] - chorusHead[0][1]).toBe(5)
    // the build sequences the head's own bar up one scale step every bar, six times
    const heads = [0, 1, 2, 3, 4, 5].map((bar) =>
      attacksIn('pulse1', at(frameOf.build) + bar * BAR, at(frameOf.build) + bar * BAR + 15).map(([, n]) => n))
    expect(heads.map((h) => h[0])).toEqual([74, 76, 78, 79, 81, 83])
    for (const h of heads) expect(h).toHaveLength(4)
  })

  it('modulates up a whole step: the final chorus is the chorus transposed, note for note', () => {
    const first = attacksIn('pulse1', at(frameOf.chorus), at(frameOf.bridge) - 1)
    const final = attacksIn('pulse1', at(frameOf.chorusP), at(frameOf.coda) - 1)
    expect(first.length).toBeGreaterThan(40)
    expect(final).toHaveLength(first.length)
    const offset = at(frameOf.chorusP) - at(frameOf.chorus)
    for (let i = 0; i < first.length; i++) {
      expect(final[i][0] - offset, `row ${i}`).toBe(first[i][0])
      expect(final[i][1] - first[i][1], `note ${i}`).toBe(2)
    }
  })

  it('carries a six-row cell across three frames at the entry rows §9.1 derives, not typed ones', () => {
    // preset-suite §9.1: a cell of length c enters frame k at local row (-64k) mod c.
    const expected = [0, 1, 2].map((k) => (((-ROWS * k) % 6) + 6) % 6)
    expect(expected).toEqual([0, 2, 4]) // the table's own row for c = 6
    const frames = [frameOf.bridge, frameOf.bridge + 1, frameOf.build]
    frames.forEach((frame, k) => {
      const rows = attacksIn('vrc6saw', at(frame), at(frame, ROWS - 1)).map(([row]) => row % ROWS)
      expect(rows[0], `frame ${frame} entry row`).toBe(expected[k])
      const gaps = new Set(rows.slice(1).map((row, i) => row - rows[i]))
      expect([...gaps], `frame ${frame} gaps`).toEqual([6])
    })
    // ...and it really is 3-against-4: the cell visits all eight 8th-note positions of
    // the bar while the vrc6p2 stabs it argues with never leave beats 2 and 4
    const bridgeRows = attacksIn('vrc6saw', at(frameOf.bridge), at(frameOf.build) - 1)
    expect(new Set(bridgeRows.map(([row]) => row % BAR)).size).toBe(8)
    const stabs = attacksIn('vrc6p2', at(frameOf.bridge), at(frameOf.build) - 1)
    expect([...new Set(stabs.map(([row]) => row % BAR))].sort((a, b) => a - b)).toEqual([4, 12])
  })

  it('builds the chorus tune on a 6+6+4 tresillo and restates it two rows late', () => {
    const bars = (frame: number, count: number) => Array.from({ length: count }, (_, bar) =>
      attacksIn('pulse1', at(frame) + bar * BAR, at(frame) + bar * BAR + 15).map(([row]) => row % BAR))
    // bars 0-2 and 4-6 of the chorus: the 8th-level tresillo, dotted-dotted-quarter
    expect(bars(frameOf.chorus, 3)).toEqual([[0, 6, 12], [0, 6, 12], [0, 6, 12]])
    expect(bars(frameOf.chorus + 1, 3)).toEqual([[0, 6, 12], [0, 6, 12], [0, 6, 12]])
    // 12:0 and 12:16 — the same cell, displaced an 8th late (§9.1 Recipe F)
    expect(bars(frameOf.chorus + 2, 2)).toEqual([[2, 8, 14], [2, 8, 14]])
    // ...and it snaps back so the section's peak can land on a downbeat
    expect(bars(frameOf.chorus + 2, 4).slice(2)).toEqual([[0, 6, 12], [0, 6, 12]])
  })

  it('cadences the chorus through an Italian sixth that resolves outward by a semitone', () => {
    const chord = (row: number) => ({
      bass: notes('vrc6saw').get(row), tonic: notes('vrc6p2').get(row),
      raised: notes('vrc6p1').get(row), lead: notes('pulse1').get(row),
    })
    // 13:32 — bass Bb2, the tonic d4 above it, and the raised fourth g#4 a tritone over
    // the bass on vrc6p1, doubled by pulse 2; the lead holds d5
    expect(chord(at(13, 32))).toEqual({ bass: 46, tonic: 62, raised: 68, lead: 74 })
    expect(notes('pulse2').get(at(13, 32))).toBe(68)
    expect(68 - 46).toBe(22) // an augmented sixth, not a minor seventh: 22 semitones
    // 13:36 — Bb2 falls to A2 while g#4 rises to a4: the sixth resolves outward onto V
    const resolved = chord(at(13, 36))
    expect(resolved.bass).toBe(45)
    expect(resolved.raised).toBe(69)
    expect(resolved.tonic).toBe(61)
    expect(notes('pulse2').get(at(13, 36))).toBe(69)
    // the final chorus keeps the device a whole step up, with pulse 2 carrying the
    // raised fourth alone because vrc6p1 is doubling the lead by then
    expect(notes('vrc6saw').get(at(21, 32))).toBe(48)
    expect(notes('pulse2').get(at(21, 32))).toBe(70)
    expect(notes('vrc6saw').get(at(21, 36))).toBe(47)
    expect(notes('pulse2').get(at(21, 36))).toBe(71)
  })

  it('gives pulse 2 a tune of its own for both choruses, not the lead at another interval', () => {
    for (const [first, last] of [
      [at(frameOf.chorus), at(frameOf.bridge) - 1],
      [at(frameOf.chorusP), at(frameOf.coda) - 1],
    ]) {
      const lead = attacksIn('pulse1', first, last)
      const counter = attacksIn('pulse2', first, last)
      const leadRows = new Set(lead.map(([row]) => row))
      // §9.2 wants 40 % of pulse 2's attacks where pulse 1 has none; this writes 78 %
      const alone = counter.filter(([row]) => !leadRows.has(row)).length
      expect(alone / counter.length).toBeGreaterThan(0.7)
      // the two lanes never share an attack-row SET, and pulse 2 never rises above the
      // lead's sounding note — it is the second voice, not a descant
      expect(counter.map(([row]) => row)).not.toEqual(lead.map(([row]) => row))
      for (const [row, note] of counter) {
        const sounding = lead.filter(([r]) => r <= row).at(-1)
        if (sounding !== undefined) expect(note, `pulse2 at ${row}`).toBeLessThanOrEqual(sounding[1])
      }
    }
    // the written 4-3: d4 is prepared as the fifth of G at 11:32, held over the A that
    // arrives at 11:40, and resolves down a step to c#4 at 11:44
    expect(notes('pulse2').get(at(11, 32))).toBe(62)
    expect(notes('pulse2').get(at(11, 36))).toBeUndefined()
    expect(notes('pulse2').get(at(11, 44))).toBe(61)
    expect(notes('vrc6saw').get(at(11, 40))).toBe(45) // the A the suspension leans on
  })

  it('doubles the lead in UNISON in the final chorus, because the octave above would beat', () => {
    const lead = notes('pulse1')
    const doubled = attacksIn('vrc6p1', at(20), at(frameOf.coda) - 1)
    expect(doubled.length).toBeGreaterThanOrEqual(20)
    for (const [row, note] of doubled) expect(note, `vrc6p1 at ${row}`).toBe(lead.get(row))
    // before that, vrc6p1 is harmony: it sits under the lead and moves on its own rows
    const harmony = attacksIn('vrc6p1', at(frameOf.chorusP), at(20) - 1)
    expect(harmony.length).toBeGreaterThan(0)
    for (const [row, note] of harmony) {
      const above = [...lead].filter(([r]) => r <= row).sort((a, b) => a[0] - b[0]).at(-1)
      if (above !== undefined) expect(note, `vrc6p1 at ${row}`).toBeLessThan(above[1])
    }
    // the reason, measured: a VRC6 pulse and a 2A03 pulse divide by the same 16, so the
    // unison is an EXACT double — while an octave above this tune lands where the 12-bit
    // divider is coarse enough to put the pair out by more than a cent.
    let worstUnison = 0
    let worstOctave = 0
    for (const [, note] of doubled) {
      expect(vrc6PulseTimerForMidi(note), `timer ${note}`).toBe(pulseTimerForMidi(note))
      worstUnison = Math.max(worstUnison, Math.abs(centsBetween(
        vrc6PulseHzForTimer(vrc6PulseTimerForMidi(note)), pulseHzForTimer(pulseTimerForMidi(note)))))
      worstOctave = Math.max(worstOctave, Math.abs(centsBetween(
        vrc6PulseHzForTimer(vrc6PulseTimerForMidi(note + 12)), 2 * midiToHz(note))
        - centsBetween(pulseHzForTimer(pulseTimerForMidi(note)), midiToHz(note))))
    }
    expect(worstUnison).toBe(0)
    expect(worstOctave, 'the octave this replaced is audibly narrow').toBeGreaterThan(10)
  })

  it('stops the kit dead for one bar — the piece’s single metric surprise', () => {
    const hole: [number, number] = [at(15, 48), at(15, 63)]
    expect(attacksIn('noise', hole[0], hole[1])).toEqual([])
    expect(attacksIn('dpcm', hole[0], hole[1])).toEqual([])
    // the cell and the stabs keep time through it, which is what makes it a surprise
    // rather than a gap: three sawtooth attacks six rows apart and two stabs
    expect(attacksIn('vrc6saw', hole[0], hole[1]).map(([row]) => row % ROWS)).toEqual([50, 56, 62])
    expect(attacksIn('vrc6p2', hole[0], hole[1]).map(([row]) => row % ROWS)).toEqual([52, 60])
    // it is the only gap that needs the declared bound: 16 rows, and nothing longer
    expect(qa.percussionGap).toBe(16)
    const rows = [...notes('noise').keys()].sort((a, b) => a - b)
    const gaps = rows.slice(1).map((row, i) => row - rows[i] - 1)
    expect(Math.max(...gaps)).toBe(16)
    expect(gaps.filter((g) => g === 16)).toHaveLength(1)
  })

  it('hands the loop row a sounding dominant and a pickup, not a row of silence', () => {
    // §2.9 rule 5. The coda's last row is 200 ms of wall clock, because the ritardando
    // has reached speed 12 by then: whatever it holds is what the seam sounds like.
    const last = song.order.length - 1
    const seam = at(last, ROWS - 1)
    // the three lanes the loop row leaves silent are cut there, and only those three
    for (const ch of ['pulse2', 'vrc6p1', 'vrc6p2'] as const) {
      expect(lane(ch).get(seam)?.note, ch).toBe(-1)
      expect(notes(ch).get(at(qa.loopFrame)), ch).toBeUndefined()
    }
    // the five the loop row restrikes sound straight through it — no cut, no release
    for (const ch of ['pulse1', 'triangle', 'vrc6saw', 'noise', 'dpcm'] as const) {
      const tail = [...lane(ch)].filter(([row]) => row >= at(last))
      expect(tail.some(([, c]) => c.note !== undefined && c.note < 0), ch).toBe(false)
      expect(notes(ch).get(at(qa.loopFrame)), ch).toBeGreaterThan(0)
    }
    // ...and the ritardando's final hit lands ON that row, as a pickup into the theme
    expect(notes('noise').get(seam)).toBe(36)
    expect(notes('dpcm').get(seam)).toBe(36)
  })

  it('reaches the loop row with no sticky effect still latched on any lane', () => {
    // The driver keeps 0xy/3xx/4xy/7xy/Qxy/Rxy/Axy per CHANNEL, and a note trigger does
    // NOT clear them (`applyRowEffect`), so one left latched at the last row plays over
    // the whole of every pass after the first. Walk the order and read the state out.
    const STICKY = ['0', '3', '4', '7', 'Q', 'R', 'A']
    const CLEARS_ARP = ['1', '2', '3', 'Q', 'R'] // these zero arpParam as a side effect
    const stateOf = (ch: ChannelId): Map<string, number> => {
      const state = new Map<string, number>()
      for (const [, cell] of [...lane(ch)].sort((a, b) => a[0] - b[0])) {
        for (const e of cell.fx ?? []) {
          if (e === null) continue
          if (CLEARS_ARP.includes(e.cmd)) state.set('0', 0)
          if (STICKY.includes(e.cmd)) state.set(e.cmd, e.param)
        }
      }
      return state
    }
    for (const ch of song.channels) {
      expect([...stateOf(ch)].filter(([, param]) => param !== 0), ch).toEqual([])
    }
    // anti-vacuity: the piece really does latch every sticky effect it uses, so the loop
    // above is reading cancellations rather than an absence of effects
    const fx = (ch: ChannelId, cmd: string) => [...lane(ch)]
      .flatMap(([row, c]) => (c.fx ?? []).filter((e) => e !== null && e.cmd === cmd).map((e) => [row, e!.param] as const))
    expect(fx('vrc6p2', '0').filter(([, p]) => p !== 0).length).toBeGreaterThan(8) // the bridge stabs
    expect(fx('pulse1', '4').filter(([, p]) => p !== 0).length).toBeGreaterThan(20) // delayed vibrato
    expect(fx('vrc6p1', 'A').filter(([, p]) => p !== 0).length).toBeGreaterThan(0) // the brass swells
    for (const [ch, cmd] of [['vrc6p2', '0'], ['pulse1', '4'], ['vrc6p1', 'A']] as const) {
      expect(fx(ch, cmd).filter(([, p]) => p === 0).length, `${ch} ${cmd}`).toBeGreaterThan(0)
    }
  })

  it('slows into the loop and restores its own speed on the loop row', () => {
    const last = song.order.length - 1
    const rit = [...lane('noise')]
      .filter(([row]) => row >= at(last))
      .flatMap(([, c]) => (c.fx ?? []).filter((e) => e !== null && e.cmd === 'F').map((e) => e!.param))
    expect(rit).toEqual([7, 9, 12]) // it only ever slows down, and never repeats a speed
    expect(rit).toEqual([...rit].sort((a, b) => a - b))
    // ...and the loop target restates speed 6, because a tempo survives the seam
    const entry = lane('noise').get(at(qa.loopFrame))
    expect(entry?.fx?.some((e) => e !== null && e.cmd === 'F' && e.param === song.meta.speed)).toBe(true)
  })

  it('puts its one global peak in the last third and phrases the volume column', () => {
    const peak = Math.max(...P1.values())
    const where = [...P1].filter(([, note]) => note === peak).map(([row]) => row)
    expect(peak).toBe(85) // c#6, the modulated chorus's appoggiatura over the dominant
    expect(where).toEqual([at(20, 48)])
    expect(where[0] / (song.order.length * ROWS)).toBeGreaterThan(2 / 3)
    expect(where[0] % song.meta.rowHighlight).toBe(0) // on a strong beat
    // §2.8's histogram: the triangle is a gate, so 15 everywhere is correct there; every
    // other lane is phrased, and the piece as a whole is nowhere near constant-15 fatigue
    const all = song.patterns.flatMap((p) => p.rows
      .filter((c) => c.note !== undefined && c.note >= 0 && c.vol !== undefined)
      .map((c) => [p.channel, c.vol as number] as const))
    expect(all.filter(([, v]) => v === 15).length / all.length).toBeLessThan(0.45)
    expect(new Set(all.map(([, v]) => v)).size).toBeGreaterThanOrEqual(5)
    for (const ch of ['pulse1', 'pulse2', 'vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(new Set(all.filter(([c]) => c === ch).map(([, v]) => v)).size, ch).toBeGreaterThanOrEqual(3)
    }
    expect(new Set(all.filter(([c]) => c === 'triangle').map(([, v]) => v))).toEqual(new Set([15]))
  })
})
