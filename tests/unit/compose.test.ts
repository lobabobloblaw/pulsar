/** gates for the authoring library (`tools/songs/compose/lib.mjs`).
 *
 *  The library writes the bytes that ship, so its contract is the same one the preset
 *  gates enforce on the committed file: `serializeSong(parseSong(text)) === text`, bank
 *  instruments byte-identical to the fixture, `x-<id>-` names for everything else, and
 *  the §2.9 loop convention on every lane.
 *
 *  House anti-vacuity applies to `check()` in particular: every fault it claims to catch
 *  gets one test that builds a song carrying exactly that fault and asserts the code
 *  fires. A pre-flight that cannot fail is decoration.
 *
 *  The library is a plain `.mjs` tool, not part of the app's module graph, so it is
 *  loaded through a computed dynamic import — `tsconfig.test.json` has no `allowJs` and
 *  a static specifier would not resolve.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseSong, serializeSong } from '../../src/tracker/model/validate'
import type { ChannelId, Song } from '../../src/tracker/model/types'

const ROOT = join(import.meta.dirname, '..', '..')
const COMPOSE = join(ROOT, 'tools', 'songs', 'compose')
const BANK = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'songs', 'shared-bank.json'), 'utf8')) as {
  rev: number
  sequences: Record<string, { name: string; values: number[]; loop: number; release: number; mode?: string }[]>
  instruments: { name: string; macros: Record<string, number>; dpcm?: Record<string, unknown> }[]
}

/** The library is untyped by design (it is a node tool). One alias, used deliberately,
 *  keeps that fact in one place instead of scattering casts through the suite. */
type Any = any

let lib: Any
let check: Any

beforeAll(async () => {
  lib = await import(pathToFileURL(join(COMPOSE, 'lib.mjs')).href)
  check = await import(pathToFileURL(join(COMPOSE, 'check.mjs')).href)
})

/** A four-bar, two-frame song with something on every lane — small enough to build in a
 *  millisecond, complete enough to round-trip. */
function tiny(mutate?: (s: Any) => void): Any {
  const s = new lib.Song({ id: 'unit-piece', name: 'Unit Piece', author: 'test', speed: 6, rowsPerPattern: 32, rowHighlight: 4, rowHighlight2: 16 })
  const [LEAD, BASS, KICK, HAT] = s.bank('lead-bright', 'bass', 'kick', 'hat-closed')
  const PAD = s.instrument('pad', { volume: { values: [10, 10], loop: 1 }, duty: [7, 5, 3, 2] })
  const a = s.section('A', 2)
  const b = s.section('B', 2)
  for (const sec of [a, b]) {
    sec.line(lib.L.P1, LEAD, 12, [[0, 0, 'e4'], [0, 8, 'g4'], [1, 0, 'b4'], [1, 8, 'e5']])
    sec.echo(lib.L.P1, lib.L.P2, 2, LEAD, 8)
    for (const [row, note] of [[0, 'e2'], [8, 'e3'], [16, 'b1'], [24, 'b2']] as [number, string][]) {
      sec.put(lib.L.TRI, row, { note: lib.n(note), inst: BASS, vol: 15 })
    }
    sec.hits(lib.L.NOISE, KICK, 13, [[0, 0], [1, 0]])
    sec.hits(lib.L.NOISE, HAT, 8, [[0, 8], [1, 8]])
    sec.chord(lib.L.V2, PAD, 10, 0, 0, 'e3', [3, 7])
    sec.chord(lib.L.V2, PAD, 10, 0, 8, 'g3', [4, 7])
    sec.chord(lib.L.V2, PAD, 10, 1, 0, 'c3', [4, 7])
    sec.chord(lib.L.V2, PAD, 10, 1, 8, 'b2', [4, 8])
  }
  mutate?.(s)
  s.order(['A', 'B'])
  s.loopTo('A')
  s.qa({ key: 'e-minor', bpmRange: [148, 152], durationSec: [10, 30], notes: 'unit fixture' })
  return s
}

function docOf(s: Any): Song {
  return parseSong(JSON.parse(s.build().text)).song
}

function faults(s: Any): string[] {
  const built = s.build()
  return (check.checkDoc(built.doc, s.id, built.loopFrame) as { code: string }[]).map((p) => p.code)
}

// --- the byte shape -----------------------------------------------------------------

describe('the canonical bytes', () => {
  it('round-trips a generated song through parseSong/serializeSong, byte for byte', () => {
    const text = tiny().build().text as string
    expect(serializeSong(parseSong(JSON.parse(text)).song)).toBe(text)
    expect(text.endsWith('}\n')).toBe(true)
  })

  it('parses with zero errors and only the unreferenced-pattern warning gate A tolerates', () => {
    const { diagnostics } = parseSong(JSON.parse(tiny().build().text as string))
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(diagnostics.filter((d) => !d.message.includes('never referenced by the order list'))).toEqual([])
  })

  it('writes the eight-lane demo generator and round-trips that too', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pulsar-compose-'))
    try {
      const out = join(dir, 'demo.json')
      execFileSync(process.execPath, [join(COMPOSE, 'examples', 'demo.mjs'), out], { encoding: 'utf8' })
      const text = readFileSync(out, 'utf8')
      const { song, diagnostics } = parseSong(JSON.parse(text))
      expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
      expect(serializeSong(song)).toBe(text)
      expect(song.channels).toHaveLength(8)
      expect(song.samples.map((s) => s.name)).toEqual(['dpcm-kick', 'dpcm-snare'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fixes the album grid at tempo 150 / 60 Hz and derives the BPM from it', () => {
    const song = docOf(tiny())
    expect(song.meta.tempo).toBe(150)
    expect(song.meta.engineSpeed).toBe(60)
    expect(song.meta.region).toBe('ntsc')
    expect(24 * song.meta.tempo / (song.meta.speed * song.meta.rowHighlight)).toBe(150)
  })
})

// --- the shared bank ----------------------------------------------------------------

describe('the shared bank', () => {
  it('imports instruments by name with the fixture values, not a retyped copy', () => {
    const song = docOf(tiny())
    for (const name of ['lead-bright', 'bass', 'kick', 'hat-closed']) {
      const mine = song.instruments.find((i) => i.name === name)!
      const theirs = BANK.instruments.find((i) => i.name === name)!
      expect(mine, name).toBeDefined()
      for (const kind of ['volume', 'arpeggio', 'pitch', 'hiPitch', 'duty'] as const) {
        const a = mine.macros[kind]
        const b = theirs.macros[kind]
        if (b < 0) {
          expect(a, `${name}.${kind}`).toBe(-1)
          continue
        }
        const seq = song.sequences[kind][a]
        const ref = BANK.sequences[kind][b]
        expect({ values: [...seq.values], loop: seq.loop, release: seq.release }, `${name}.${kind}`)
          .toEqual({ values: ref.values, loop: ref.loop, release: ref.release })
      }
    }
  })

  it('names everything else x-<id>- and refuses to invent a bank entry', () => {
    const song = docOf(tiny())
    const local = song.instruments.filter((i) => !BANK.instruments.some((b) => b.name === i.name))
    expect(local.length).toBeGreaterThan(0)
    for (const i of local) expect(i.name).toMatch(/^x-unit-piece-/)
    expect(() => tiny().bank('no-such-instrument')).toThrow(/shared bank has no instrument/)
  })

  it('carries the generated DPCM samples and the bank key map, not a new one', () => {
    const s = new lib.Song({ id: 'kit-piece', speed: 6, rowsPerPattern: 16, rowHighlight: 4, rowHighlight2: 16 })
    const kit = s.dpcmKit()
    expect(kit.kick).toBe(36)
    expect(kit.snare).toBe(39)
    const a = s.section('A', 1)
    a.hits(lib.L.DPCM, kit.inst, 15, [[0, 0], [0, 4], [0, 8], [0, 12]], kit.kick)
    a.hits(lib.L.DPCM, kit.inst, 15, [[0, 2], [0, 6], [0, 10], [0, 14]], kit.snare)
    s.order(['A', 'A'])
    s.loopTo('A')
    s.qa({ key: 'c-major', bpmRange: [148, 152], durationSec: [1, 10] })
    const song = docOf(s)
    const printed = JSON.parse(
      execFileSync(process.execPath, [join(ROOT, 'tools', 'songs', 'makeDpcm.mjs'), '--json'], { encoding: 'utf8' }),
    ) as { name: string; data: string }[]
    expect(song.samples.map((x) => [x.name, x.data])).toEqual(printed.map((x) => [x.name, x.data]))
    const kitInst = song.instruments.find((i) => i.name === 'dpcm-kit')!
    expect(kitInst.dpcm).toEqual(BANK.instruments.find((i) => i.name === 'dpcm-kit')!.dpcm)
  })
})

// --- de-duplication and derivation ---------------------------------------------------

describe('what the library derives', () => {
  it('de-duplicates identical per-lane patterns and identical sequences', () => {
    const song = docOf(tiny())
    // A and B are written identically, so every lane costs ONE pattern across two frames
    // — except pulse 1, whose last frame carries the loop Bxx.
    const perChannel = new Map<string, number>()
    for (const p of song.patterns) perChannel.set(p.channel, (perChannel.get(p.channel) ?? 0) + 1)
    expect(perChannel.get('triangle')).toBe(1)
    expect(perChannel.get('noise')).toBe(1)
    expect(perChannel.get('vrc6p2')).toBe(1)
    expect(song.order[0][song.channels.indexOf('triangle')]).toBe(song.order[1][song.channels.indexOf('triangle')])
    // The two bank drums share `dut-noise-long`, and `kick`/`hat-closed` differ only in
    // their volume envelope: one duty entry, two volume entries, no duplicates anywhere.
    for (const kind of ['volume', 'arpeggio', 'pitch', 'hiPitch', 'duty'] as const) {
      const keys = song.sequences[kind].map((s) => JSON.stringify(s))
      expect(new Set(keys).size, kind).toBe(keys.length)
    }
  })

  it('derives the channel prefix, the effect columns, and qa channels/effects/form', () => {
    const built = tiny().build()
    const song = docOf(tiny())
    const qa = song.extra!.qa as { channels: string[]; effects: string[]; form: string[]; loopFrame: number; bank: { rev: number } }
    // Reaching vrc6p2 pulls every lane before it in, dpcm included and empty.
    expect(song.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm', 'vrc6p1', 'vrc6p2'])
    expect(qa.channels).toEqual(['pulse1', 'pulse2', 'triangle', 'noise', 'vrc6p2'])
    expect(qa.effects).toEqual(['0', 'B'])
    expect(qa.form).toEqual(['A', 'B'])
    expect(qa.form).toHaveLength(song.order.length)
    expect(qa.loopFrame).toBe(built.loopFrame)
    expect(qa.bank.rev).toBe(BANK.rev)
    expect(song.effectColumns).toHaveLength(song.channels.length)
    expect(song.effectColumns.every((c) => c >= 1 && c <= 4)).toBe(true)
  })

  it('drops an instrument nothing plays, because an unused one is a load warning', () => {
    const s = tiny((song) => {
      song.instrument('never-used', { volume: [15, 0] })
    })
    const song = docOf(s)
    expect(song.instruments.some((i) => i.name === 'x-unit-piece-never-used')).toBe(false)
    const { diagnostics } = parseSong(JSON.parse(s.build().text))
    expect(diagnostics.filter((d) => d.message.includes('instrument is never referenced'))).toEqual([])
  })

  it('clears every latched effect line() started, with the cancel the DRIVER honours', () => {
    const s = new lib.Song({ id: 'sticky', speed: 6, rowsPerPattern: 32, rowHighlight: 4, rowHighlight2: 16 })
    const LEAD = s.bank('lead-bright')[0]
    const a = s.section('A', 2)
    // 0xy then 4xy latch independently; the next bare event has to cancel BOTH, and a
    // still-latched mode is cancelled on the section's last row.
    a.line(lib.L.P1, LEAD, 12, [
      [0, 0, 'e4', '0', lib.nib(4, 7)], [0, 8, 'g4', '4', 0x32], [1, 0, 'b4'], [1, 8, 'e5', '3', 0x10],
    ])
    s.order(['A', 'A'])
    s.loopTo('A')
    s.qa({ key: 'e-minor', bpmRange: [148, 152], durationSec: [5, 30] })
    const p = docOf(s).patterns.find((x) => x.channel === 'pulse1' && x.index === 0)!
    const fxAt = (r: number) => p.rows.find((c) => c.r === r)?.fx?.map((e) => `${e!.cmd}${e!.param}`) ?? []
    expect(fxAt(0)).toEqual(['071'])
    expect(fxAt(8)).toEqual(['450'])
    expect(fxAt(16), 'both latched modes cancelled on the next bare event').toEqual(['00', '40'])
    expect(fxAt(24)).toEqual(['316'])
    // §12.5's first trap: `300` sets portaEnabled = 1 like any other param and only
    // FREEZES the glide. `100` is what `applyRowEffect` clears portaEnabled on.
    expect(fxAt(31), '3xx is cancelled with 100, not with 300').toEqual(['10'])
    expect(faults(s), 'and the piece is clean once it is').toEqual([])
  })

  it('stores effect params as DECIMAL, which is what the grid hides', () => {
    expect(lib.hex(0x47)).toBe(71)
    expect(lib.hex('047')).toBe(71)
    expect(lib.nib(4, 7)).toBe(71)
    expect(lib.n('c4')).toBe(60)
    expect(lib.n('c#4')).toBe(61)
    expect(lib.n('a4')).toBe(69)
    expect(lib.n('---')).toBe(lib.CUT)
    expect(lib.n('===')).toBe(lib.REL)
    const song = docOf(tiny())
    const v2 = song.patterns.find((p) => p.channel === 'vrc6p2')!
    expect(v2.rows[0].fx).toEqual([{ cmd: '0', param: 55 }])
    expect(v2.rows.find((c) => c.r === 16)!.fx).toEqual([{ cmd: '0', param: 71 }])
    // FamiTracker spells A-4; this library does not, and says so rather than reading it
    // as octave minus four.
    expect(() => lib.n('A-4')).toThrow(/Octaves take no separator/)
  })
})

// --- the loop convention (§2.9) ------------------------------------------------------

describe('loopTo', () => {
  it('writes Bxx on the last row and explicit state on every lane that sounds', () => {
    const built = tiny().build()
    const song = docOf(tiny())
    const lastRow = song.meta.rowsPerPattern - 1
    const found: number[] = []
    for (let c = 0; c < song.channels.length; c++) {
      const p = song.patterns.find((x) => x.channel === song.channels[c] && x.index === song.order[song.order.length - 1][c])!
      for (const e of p.rows.find((r) => r.r === lastRow)?.fx ?? []) if (e !== null && e.cmd === 'B') found.push(e.param)
    }
    expect(found, 'exactly one Bxx, on the last frame last row').toEqual([built.loopFrame])

    for (let c = 0; c < song.channels.length; c++) {
      const channel = song.channels[c]
      const sounds = song.patterns.some((p) => p.channel === channel && p.rows.some((r) => r.note !== undefined && r.note >= 0))
      if (!sounds) continue
      const p = song.patterns.find((x) => x.channel === channel && x.index === song.order[built.loopFrame][c])!
      const first = p.rows.find((r) => r.r === 0)
      expect(first, `${channel}: explicit state at the loop row`).toBeDefined()
      if (first!.note !== -1) {
        expect(first!.note, channel).toBeGreaterThanOrEqual(0)
        expect(first!.inst, channel).toBeDefined()
        expect(first!.vol, channel).toBeDefined()
      }
    }
  })

  it('cuts a lane that is silent across the seam rather than leaving it inherited', () => {
    // Pulse 2 carries only the echo, which lands two rows after each attack and never on
    // row 0, so the loop row is where the library has to say something about it.
    const built = tiny().build()
    const frame = built.frames[built.loopFrame] as ({ note?: number } | null)[][]
    const entry = frame[lib.L.P2][0]!
    expect(entry.note === lib.CUT || entry.note! >= 0).toBe(true)
    expect(built.loopEntries.length).toBeGreaterThan(0)
  })

  it('refuses to build without a loop target', () => {
    const s = new lib.Song({ id: 'no-loop', speed: 6, rowsPerPattern: 16, rowHighlight: 4, rowHighlight2: 16 })
    const a = s.section('A', 1)
    a.put(lib.L.P1, 0, { note: lib.n('e4'), inst: s.bank('lead-bright')[0], vol: 12 })
    s.order(['A'])
    expect(() => s.build()).toThrow(/loopTo/)
  })
})

// --- check(): one test per fault, because a check that cannot fail is decoration ------

describe('check', () => {
  it('passes a clean song and reports nothing', () => {
    expect(faults(tiny())).toEqual([])
    expect(() => tiny().check()).not.toThrow()
  })

  it('catches a pulse note under the floor, which would silently sound a1', () => {
    expect(faults(tiny((s) => {
      s.sections.get('A').put(lib.L.P1, 4, { note: 32, inst: s.bank('lead-bright')[0], vol: 12 })
    }))).toContain('pulse-floor')
  })

  it('catches a noise note outside 32..47, where the period index wraps', () => {
    expect(faults(tiny((s) => {
      s.sections.get('A').put(lib.L.NOISE, 4, { note: 50, inst: s.bank('kick')[0], vol: 13 })
    }))).toContain('noise-window')
  })

  it('catches a VRC6 duty above 7, which sets the mode bit and silences the lane', () => {
    expect(faults(tiny((s) => {
      const bad = s.instrument('dc', { volume: [12, 0], duty: [8] })
      s.sections.get('A').put(lib.L.V1, 0, { note: lib.n('e3'), inst: bad, vol: 12 })
    }))).toContain('vrc6-duty')
  })

  it('catches an effect outside the album set — Cxx halts playback', () => {
    expect(faults(tiny((s) => {
      s.sections.get('A').put(lib.L.P1, 4, { fx: [['C', 0]] })
    }))).toContain('effect-unsupported')
  })

  it('catches a param that is not a decimal integer 0..255', () => {
    expect(faults(tiny((s) => {
      const cell = s.sections.get('A').put(lib.L.P1, 4, { fx: [['4', 0x32]] })
      cell.fx[0].param = 0.5
    }))).toContain('param-decimal')
    // ...and the setter refuses the same thing up front, which is where it is cheapest.
    expect(() => tiny((s) => s.sections.get('A').put(lib.L.P1, 4, { fx: [['4', 300]] }))).toThrow(/0\.\.255/)
  })

  it('catches a pitch macro that does not end on 0 — pitch macros ACCUMULATE', () => {
    expect(faults(tiny((s) => {
      const drift = s.instrument('drift', { volume: [12, 0], pitch: [0, 4] })
      s.sections.get('A').put(lib.L.P1, 4, { note: lib.n('e4'), inst: drift, vol: 12 })
    }))).toContain('pitch-tail')
    // A looping pitch macro is bounded only if its looped segment sums to zero.
    expect(faults(tiny((s) => {
      const drift = s.instrument('creep', { volume: [12, 0], pitch: { values: [0, 1, 1], loop: 1 } })
      s.sections.get('A').put(lib.L.P1, 4, { note: lib.n('e4'), inst: drift, vol: 12 })
    }))).toContain('pitch-tail')
  })

  it('catches a noise envelope that loops or does not end on 0 — it never releases', () => {
    expect(faults(tiny((s) => {
      const forever = s.instrument('forever', { volume: { values: [15, 10, 5], loop: 0 } })
      s.sections.get('A').put(lib.L.NOISE, 4, { note: 40, inst: forever, vol: 13 })
    }))).toContain('noise-envelope')
    expect(faults(tiny((s) => {
      const hangs = s.instrument('hangs', { volume: [15, 10, 5] })
      s.sections.get('A').put(lib.L.NOISE, 4, { note: 40, inst: hangs, vol: 13 })
    }))).toContain('noise-envelope')
  })

  it('catches a lane with no state at the loop row', () => {
    const built = tiny().build()
    const c = built.doc.channels.indexOf('triangle')
    const p = built.doc.patterns.find((x: Any) => x.channel === 'triangle' && x.index === built.doc.order[built.loopFrame][c])
    p.rows = p.rows.filter((r: Any) => r.r !== 0)
    const codes = (check.checkDoc(built.doc, 'unit-piece', built.loopFrame) as { code: string }[]).map((x) => x.code)
    expect(codes).toContain('loop-row')
  })

  it('catches an instrument that is neither the bank value nor named x-<id>-', () => {
    expect(faults(tiny((s) => {
      // The name stays `kick`; one envelope value moves. That is exactly what §7.1's
      // bank-drift check exists to refuse.
      s.instruments[s.bank('kick')[0]].macros.volume.values[0] = 14
    }))).toContain('instrument-name')
    const built = tiny().build()
    built.doc.instruments[0].name = 'not-a-bank-name'
    const codes = (check.checkDoc(built.doc, 'unit-piece', built.loopFrame) as { code: string }[]).map((x) => x.code)
    expect(codes).toContain('instrument-name')
  })

  it('catches a declared bracket the document does not meet, and a missing one', () => {
    const wrong = tiny()
    wrong.qa({ bpmRange: [100, 110] })
    expect(faults(wrong)).toContain('bpm-range')
    const bare = tiny()
    bare.declared = {}
    expect(faults(bare)).toContain('qa-missing')
  })
})

// --- the channel modes a note trigger does not clear (preset-suite §12.5) -------------
//
// `trigger()` resets the phases and nothing else, so `0xy`, `1xx`/`2xx`, `3xx`, `4xy`,
// `7xy`, `Axy` and `Pxx` outlive the note, the pattern, the frame and the loop. A piece
// with 132 uncancelled `0xy` cells is what put §12.5 in the annex, and `chord()` is the
// library's own `0xy` helper, so every claim here is about a fault that has happened.

describe('channel modes', () => {
  /** An intro plus a looping section — the shape that makes both seams reachable: the
   *  END of the order, where pass 2 begins, and the LOOP ROW, which pass 1 reaches in
   *  whatever state the intro left. Pulse 1 carries eight attacks a section so no lane
   *  under test has to meet the lint's thin-lane floor on its own. */
  function modeSong(write: (secs: { intro: Any; a: Any }, ids: Any) => void): Any {
    const s = new lib.Song({ id: 'modes', speed: 6, rowsPerPattern: 32, rowHighlight: 4, rowHighlight2: 16 })
    const [LEAD] = s.bank('lead-bright')
    const PAD = s.instrument('pad', { volume: { values: [10, 10], loop: 1 }, duty: [7, 5, 3, 2] })
    const intro = s.section('intro', 2)
    const a = s.section('A', 2)
    for (const sec of [intro, a]) {
      sec.line(lib.L.P1, LEAD, 12, [
        [0, 0, 'e4'], [0, 4, 'g4'], [0, 8, 'b4'], [0, 12, 'e5'],
        [1, 0, 'e4'], [1, 4, 'g4'], [1, 8, 'b4'], [1, 12, 'e5'],
      ])
    }
    write({ intro, a }, { LEAD, PAD })
    s.order(['intro', 'A'])
    s.loopTo('A')
    s.qa({ key: 'e-minor', bpmRange: [148, 152], durationSec: [5, 30] })
    return s
  }

  /** Four chords a bar on vrc6p2 in both sections: eight attacks, the lint's floor. */
  const chords = (sec: Any, PAD: number): void => {
    for (const bar of [0, 1]) {
      sec.chord(lib.L.V2, PAD, 10, bar, 0, 'e3', [3, 7])
      sec.chord(lib.L.V2, PAD, 10, bar, 8, 'g3', [4, 7])
    }
  }

  /** A mode set on A's LAST row. There is no later row to cancel it on, so the library's
   *  own seal steps aside and `check()` is all that stands between the composer and a
   *  second pass that does not sound like the first. */
  const latchedToTheEnd = (cmd: string, param: number): string[] =>
    faults(modeSong(({ a }) => { a.fx(lib.L.P1, 1, 15, cmd, param) }))

  /** The same mode set mid-section and cancelled by hand on A's last row — the row the
   *  seal would have used, so this proves the CANCEL and not the seal. */
  const cancelledWith = (cmd: string, param: number, by: [string, number]): string[] =>
    faults(modeSong(({ a }) => {
      a.fx(lib.L.P1, 0, 4, cmd, param)
      a.fx(lib.L.P1, 1, 15, by[0], by[1])
    }))

  it('catches a chord nobody cancels — the defect that cost an album piece a revision', () => {
    const s = modeSong(({ intro, a }, { PAD }) => {
      chords(intro, PAD)
      chords(a, PAD)
      // One more on A's last row, where the seal cannot help: from here the arpeggio
      // voices every note the lane plays on pass 2, and the loop never clears it.
      a.chord(lib.L.V2, PAD, 10, 1, 15, 'b2', [4, 8])
    })
    expect(faults(s)).toContain('sticky-latched')
    expect(() => s.check()).toThrow(/0xy arpeggio/)
  })

  it('cancels a chord where the lane next plays something that is not part of it', () => {
    const s = modeSong(({ intro, a }, { LEAD, PAD }) => {
      for (const sec of [intro, a]) {
        chords(sec, PAD)
        // A bare `line()` event is the lane playing something else, so it carries the 000.
        sec.line(lib.L.V2, LEAD, 11, [[1, 12, 'e4']])
      }
    })
    expect(faults(s)).toEqual([])
    const p = docOf(s).patterns.find((x) => x.channel === 'vrc6p2')!
    expect(p.rows.find((r) => r.r === 28)!.fx).toEqual([{ cmd: '0', param: 0 }])
  })

  it('cancels a chord on the section last row when nothing else does', () => {
    const s = modeSong(({ intro, a }, { PAD }) => {
      chords(intro, PAD)
      chords(a, PAD)
    })
    expect(faults(s)).toEqual([])
    const p = docOf(s).patterns.find((x) => x.channel === 'vrc6p2')!
    expect(p.rows.find((r) => r.r === 31)!.fx, 'the seal, on the last row').toEqual([{ cmd: '0', param: 0 }])
  })

  it('fails if the cancels the library writes are deleted from the document', () => {
    const s = modeSong(({ intro, a }, { PAD }) => {
      chords(intro, PAD)
      chords(a, PAD)
    })
    const built = s.build()
    const last = built.doc.meta.rowsPerPattern - 1
    const sealed = built.doc.patterns.filter(
      (p: Any) => p.channel === 'vrc6p2' && p.rows.some((r: Any) => r.r === last && r.fx !== undefined),
    )
    expect(sealed.length, 'the library cancels the chord on each section last row').toBeGreaterThan(0)
    expect(check.checkDoc(built.doc, s.id, built.loopFrame), 'clean while they are there').toEqual([])
    for (const p of sealed) p.rows = p.rows.filter((r: Any) => r.r !== last)
    const codes = (check.checkDoc(built.doc, s.id, built.loopFrame) as { code: string }[]).map((x) => x.code)
    expect(codes, 'and the check is what catches their absence').toContain('sticky-latched')
  })

  it('reports every mode the library can emit and accepts each documented cancel', () => {
    // sticky.mjs's table, restated: the param that latches, and the cell that cancels it.
    const modes: [string, number, [string, number]][] = [
      ['0', 0x47, ['0', 0x00]], // 0xy arpeggio     -> 000
      ['1', 0x08, ['1', 0x00]], // 1xx slide up     -> 100
      ['2', 0x08, ['2', 0x00]], // 2xx slide down   -> 200
      ['3', 0x10, ['1', 0x00]], // 3xx portamento   -> 100 (NOT 300)
      ['4', 0x32, ['4', 0x00]], // 4xy vibrato      -> 4x0
      ['7', 0xa4, ['7', 0x10]], // 7xy tremolo      -> 7x0, x > 0 (NOT 700)
      ['A', 0x20, ['A', 0x00]], // Axy volume slide -> A00
      ['P', 0x90, ['P', 0x80]], // Pxx fine pitch   -> P80 (0x80 is in tune)
    ]
    for (const [cmd, param, by] of modes) {
      expect(latchedToTheEnd(cmd, param), `${cmd}${param.toString(16)} left latched`).toContain('sticky-latched')
      expect(cancelledWith(cmd, param, by), `${cmd}${param.toString(16)} cancelled by ${by[0]}${by[1].toString(16)}`)
        .toEqual([])
    }
  })

  it('refuses 300 and 700 as cancels, which is where §12.5 says a composer loses', () => {
    // `FX_PORTAMENTO` sets portaEnabled = 1 for every param — `300` freezes the glide,
    // it does not end it — and `7` is in MEMORY_COMMANDS but not in OFF_ON_ZERO_COMMANDS,
    // so `resolveParam` turns a bare `700` back into the last tremolo depth.
    expect(cancelledWith('3', 0x10, ['3', 0x00])).toContain('sticky-latched')
    expect(cancelledWith('7', 0xa4, ['7', 0x00])).toContain('sticky-latched')
  })

  it('leaves Vxx alone, because the driver gives dutyOverride no off value', () => {
    // §12.5's eighth row: `V00` is duty 0, a real duty. A pre-flight that demanded a
    // cancel here could not be satisfied; `stickyLint` reports it at album level, where
    // the remedy that exists — restate it on the loop row — is available.
    expect(latchedToTheEnd('V', 0x02)).toEqual([])
  })

  it('catches a mode that reaches the loop row, which the end of the order does not see', () => {
    const s = modeSong(({ intro, a }) => {
      intro.fx(lib.L.P1, 1, 15, '4', 0x32) // latched on the intro's last row...
      a.fx(lib.L.P1, 1, 15, '4', 0x00) // ...and cancelled before the order ends
    })
    const codes = faults(s)
    expect(codes, 'pass 1 plays A under a vibrato pass 2 does not have').toContain('sticky-loop')
    expect(codes, 'and the end of the order is clean, so only this seam reports it').not.toContain('sticky-latched')
  })

  it('accepts a mode the loop row states itself (§12.5 rule 1)', () => {
    const s = modeSong(({ intro, a }) => {
      intro.fx(lib.L.P1, 1, 15, '4', 0x32)
      a.put(lib.L.P1, 0, { fx: [['4', 0x32]] }) // the loop row owns its own state
      a.fx(lib.L.P1, 1, 15, '4', 0x00)
    })
    expect(faults(s)).toEqual([])
  })
})

// --- and it has to make a sound ------------------------------------------------------

describe('the output is playable, not merely valid', () => {
  it('renders through the real offline renderer with audible level on every claimed lane', async () => {
    const { renderSong, rmsDb } = await import('../../src/tracker/offlineRender')
    const song = docOf(tiny())
    const r = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: 30 })
    expect(r.rowsPlayed).toBe(song.order.length * song.meta.rowsPerPattern)
    expect(r.noteOns).toBeGreaterThan(0)
    expect(rmsDb(r.samples)).toBeGreaterThan(-40)
    const qa = song.extra!.qa as { channels: ChannelId[] }
    for (const c of qa.channels) {
      const solo = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: 30, soloChannel: song.channels.indexOf(c) })
      expect(rmsDb(solo.samples), `${c} is claimed but silent`).toBeGreaterThan(-60)
    }
  })

  it('renders the eight-lane demo, VRC6 and DPCM included, without clipping', async () => {
    const { renderSong, rmsDb } = await import('../../src/tracker/offlineRender')
    const dir = mkdtempSync(join(tmpdir(), 'pulsar-compose-'))
    try {
      const out = join(dir, 'demo.json')
      execFileSync(process.execPath, [join(COMPOSE, 'examples', 'demo.mjs'), out], { encoding: 'utf8' })
      const { song } = parseSong(JSON.parse(readFileSync(out, 'utf8')))
      const r = renderSong(song, { sampleRate: 48000, loops: 2, maxSeconds: 120 })
      expect(r.noteOns).toBeGreaterThan(100)
      expect(rmsDb(r.samples)).toBeGreaterThan(-30)
      expect(r.clippedSamples, 'the demo arrangement must fit under the knob at maximum').toBeLessThanOrEqual(8)
      for (const c of ['vrc6p1', 'vrc6p2', 'vrc6saw', 'dpcm'] as const) {
        const solo = renderSong(song, { sampleRate: 48000, loops: 1, maxSeconds: 120, soloChannel: song.channels.indexOf(c) })
        expect(rmsDb(solo.samples), c).toBeGreaterThan(-60)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 120_000)
})
