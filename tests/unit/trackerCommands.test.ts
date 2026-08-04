/** The command stack (design §4.6) — every mutation and its exact inverse.
 *
 *  Headline assertions:
 *    - every command produces an inverse that restores the document EXACTLY.
 *    - the property test the design names as the gate: apply N random valid commands,
 *      then N undos, and the document is structurally equal to the original; then N
 *      redos and it is equal to the mutated one.
 *    - `applyCommand` never throws, even for a pattern the user just deleted.
 *    - the store's two policies are stated as constants WP10 codes against: a 200-entry
 *      undo cap and a 700 ms same-cell coalescing window.
 */
import { describe, expect, it } from 'vitest'
import {
  COALESCE_MS,
  UNDO_CAP,
  applyCommand,
  applyCommands,
  type Command,
} from '../../src/tracker/model/commands'
import { NOTE_CUT, type Song } from '../../src/tracker/model/types'
import { serializeSong } from '../../src/tracker/model/validate'
import { buildSong, instrument, sequence } from '../fixtures/songs/build'

function base(): Song {
  return buildSong({
    meta: { rowsPerPattern: 8 },
    order: [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0],
    ],
    patterns: {
      'pulse1:0': [
        { r: 0, note: 60, inst: 0, vol: 15 },
        { r: 4, note: 64, fx: [{ cmd: '0', param: 71 }] },
      ],
      'pulse1:1': [{ r: 0, note: 72 }],
    },
    instruments: [instrument({ volume: 0 })],
    sequences: { volume: [sequence([15, 8], -1, -1)] },
  })
}

/** Round-trip through the serializer: structural equality that ignores key order. */
function same(a: Song, b: Song): boolean {
  return serializeSong(a) === serializeSong(b)
}

function roundTrip(song: Song, cmd: Command): void {
  const { song: next, inverse } = applyCommand(song, cmd)
  const back = applyCommand(next, inverse).song
  expect(same(back, song), `inverse of ${cmd.kind}`).toBe(true)
}

const P1 = { channel: 'pulse1', pattern: 0 } as const

describe('every command has a correct inverse', () => {
  const song = base()
  const commands: Command[] = [
    { kind: 'setCell', ...P1, row: 2, cell: { r: 2, note: 62, vol: 9 } },
    { kind: 'setCell', ...P1, row: 0, cell: null },
    { kind: 'setCellField', ...P1, row: 0, field: 'note', value: 65 },
    { kind: 'setCellField', ...P1, row: 0, field: 'vol', value: null },
    { kind: 'setCellField', ...P1, row: 0, field: 'inst', value: 0 },
    { kind: 'setCellField', ...P1, row: 4, field: 'fx', slot: 0, effect: { cmd: '4', param: 71 } },
    { kind: 'setCellField', ...P1, row: 4, field: 'fx', slot: 0, effect: null },
    { kind: 'setCellField', ...P1, row: 4, field: 'fx', slot: 2, effect: { cmd: 'S', param: 3 } },
    { kind: 'clearRow', ...P1, row: 4 },
    { kind: 'insertRow', ...P1, row: 0 },
    { kind: 'deleteRow', ...P1, row: 0 },
    { kind: 'pasteBlock', ...P1, row: 1, cells: [{ r: 0, note: 50 }, { r: 2, note: 51 }] },
    { kind: 'setPatternRows', channel: 'pulse1', pattern: 0, rows: [{ r: 7, note: NOTE_CUT }] },
    { kind: 'setOrderEntry', frame: 1, channel: 0, pattern: 0 },
    { kind: 'insertFrame', frame: 1, value: [0, 0, 0, 0, 0] },
    { kind: 'deleteFrame', frame: 0 },
    { kind: 'setOrder', order: [[1, 0, 0, 0, 0]] },
    { kind: 'setMeta', meta: { tempo: 160, speed: 5 } },
    { kind: 'setInstrument', index: 0, instrument: instrument({ volume: -1 }, 'renamed') },
    { kind: 'setInstrument', index: 1, instrument: instrument({}, 'appended') },
    { kind: 'setSequence', macro: 'volume', index: 0, sequence: sequence([1, 2, 3], 1, -1) },
    { kind: 'setSequence', macro: 'duty', index: 0, sequence: sequence([2, 1], 0, -1) },
  ]

  for (const cmd of commands) {
    it(`${cmd.kind}${'field' in cmd ? ` (${cmd.field})` : ''}${'macro' in cmd ? ` (${cmd.macro})` : ''} inverts`, () => {
      roundTrip(song, cmd)
    })
  }

  it('an append inverts to a pop and a pop inverts to an append', () => {
    const one = applyCommand(song, {
      kind: 'setInstrument',
      index: 1,
      instrument: instrument({}, 'b'),
    })
    expect(one.song.instruments.length).toBe(2)
    expect(one.inverse).toEqual({ kind: 'setInstrument', index: 1, instrument: null })
    const back = applyCommand(one.song, one.inverse).song
    expect(back.instruments.length).toBe(1)
    expect(same(back, song)).toBe(true)
  })
})

describe('the commands actually change something (anti-vacuity)', () => {
  const song = base()

  it('setCellField writes the field it names', () => {
    const next = applyCommand(song, { kind: 'setCellField', ...P1, row: 0, field: 'vol', value: 3 }).song
    expect(next.patterns.find((p) => p.channel === 'pulse1' && p.index === 0)?.rows[0].vol).toBe(3)
    expect(same(next, song)).toBe(false)
  })

  it('insertRow pushes rows down and the last row falls off the end', () => {
    const full = buildSong({
      meta: { rowsPerPattern: 4 },
      patterns: {
        'pulse1:0': [
          { r: 0, note: 60 },
          { r: 3, note: 63 },
        ],
      },
    })
    const next = applyCommand(full, { kind: 'insertRow', ...P1, row: 0 }).song
    const rows = next.patterns.find((p) => p.channel === 'pulse1')?.rows ?? []
    expect(rows.map((c) => c.r)).toEqual([1])
    expect(rows[0].note).toBe(60)
    // ...and the inverse restores the row that fell off.
    const inverse = applyCommand(full, { kind: 'insertRow', ...P1, row: 0 }).inverse
    expect(same(applyCommand(next, inverse).song, full)).toBe(true)
  })

  it('deleteRow pulls rows up', () => {
    const next = applyCommand(song, { kind: 'deleteRow', ...P1, row: 0 }).song
    const rows = next.patterns.find((p) => p.channel === 'pulse1' && p.index === 0)?.rows ?? []
    expect(rows.map((c) => c.r)).toEqual([3])
  })

  it('pasteBlock offsets the block by the target row and drops what runs off the end', () => {
    const next = applyCommand(song, {
      kind: 'pasteBlock',
      ...P1,
      row: 6,
      cells: [{ r: 0, note: 40 }, { r: 4, note: 41 }],
    }).song
    const rows = next.patterns.find((p) => p.channel === 'pulse1' && p.index === 0)?.rows ?? []
    expect(rows.map((c) => c.r)).toEqual([0, 4, 6])
    expect(rows.find((c) => c.r === 6)?.note).toBe(40)
  })

  it('clearing every field of a cell removes the cell entirely', () => {
    let cur = song
    for (const field of ['note', 'inst', 'vol'] as const) {
      cur = applyCommand(cur, { kind: 'setCellField', ...P1, row: 0, field, value: null }).song
    }
    const rows = cur.patterns.find((p) => p.channel === 'pulse1' && p.index === 0)?.rows ?? []
    expect(rows.map((c) => c.r)).toEqual([4])
  })
})

describe('applyCommand never throws', () => {
  const song = base()

  it('on a pattern that does not exist', () => {
    const r = applyCommand(song, { kind: 'setCell', channel: 'dpcm', pattern: 9, row: 0, cell: null })
    expect(same(r.song, song)).toBe(true)
  })

  it('on an out-of-range frame, order entry, instrument or sequence index', () => {
    for (const cmd of [
      { kind: 'setOrderEntry', frame: 99, channel: 0, pattern: 0 },
      { kind: 'setOrderEntry', frame: 0, channel: 99, pattern: 0 },
      { kind: 'deleteFrame', frame: 99 },
      { kind: 'setInstrument', index: 99, instrument: null },
      { kind: 'setSequence', macro: 'volume', index: 99, sequence: null },
    ] as Command[]) {
      expect(same(applyCommand(song, cmd).song, song), cmd.kind).toBe(true)
    }
  })

  it('refuses to delete the last order frame', () => {
    const one = buildSong({})
    expect(same(applyCommand(one, { kind: 'deleteFrame', frame: 0 }).song, one)).toBe(true)
  })
})

describe('the property test the design names as the gate', () => {
  /** A tiny deterministic PRNG, so a failure is reproducible from its seed. */
  function rng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 0x100000000
    }
  }

  function randomCommand(random: () => number, song: Song): Command {
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)]
    const row = Math.floor(random() * song.meta.rowsPerPattern)
    const pattern = pick([0, 1])
    const kind = Math.floor(random() * 10)
    switch (kind) {
      case 0:
        return { kind: 'setCell', channel: 'pulse1', pattern, row, cell: { r: row, note: 40 + Math.floor(random() * 40) } }
      case 1:
        return { kind: 'setCellField', channel: 'pulse1', pattern, row, field: 'vol', value: Math.floor(random() * 16) }
      case 2:
        return { kind: 'setCellField', channel: 'pulse1', pattern, row, field: 'note', value: random() < 0.2 ? null : 60 }
      case 3:
        return {
          kind: 'setCellField',
          channel: 'pulse1',
          pattern,
          row,
          field: 'fx',
          slot: Math.floor(random() * 4),
          effect: random() < 0.3 ? null : { cmd: pick(['0', '4', 'A', 'S']), param: Math.floor(random() * 256) },
        }
      case 4:
        return { kind: 'clearRow', channel: 'pulse1', pattern, row }
      case 5:
        return { kind: random() < 0.5 ? 'insertRow' : 'deleteRow', channel: 'pulse1', pattern, row }
      case 6:
        return { kind: 'setOrderEntry', frame: Math.floor(random() * song.order.length), channel: 0, pattern }
      case 7:
        return random() < 0.5
          ? { kind: 'insertFrame', frame: Math.floor(random() * (song.order.length + 1)), value: [pattern, 0, 0, 0, 0] }
          : { kind: 'deleteFrame', frame: Math.floor(random() * song.order.length) }
      case 8:
        return { kind: 'setMeta', meta: { tempo: 32 + Math.floor(random() * 200), speed: 1 + Math.floor(random() * 30) } }
      default:
        return {
          kind: 'pasteBlock',
          channel: 'pulse1',
          pattern,
          row,
          cells: [{ r: 0, note: 55 }, { r: 1, vol: 4 }],
        }
    }
  }

  it('N random commands then N undos is the original; N redos is the mutated one', () => {
    for (const seed of [1, 7, 42, 1337, 90210]) {
      const random = rng(seed)
      const original = base()
      const commands: Command[] = []
      let cur = original
      for (let i = 0; i < 60; i++) {
        const cmd = randomCommand(random, cur)
        commands.push(cmd)
        cur = applyCommand(cur, cmd).song
      }
      const { song: mutated, inverses } = applyCommands(original, commands)
      expect(same(mutated, cur), `seed ${seed}`).toBe(true)

      // N undos, newest first.
      let undone = mutated
      const redos: Command[] = []
      for (const inverse of inverses) {
        const r = applyCommand(undone, inverse)
        undone = r.song
        redos.unshift(r.inverse)
      }
      expect(same(undone, original), `seed ${seed} undo`).toBe(true)

      // N redos.
      let redone = undone
      for (const redo of redos) redone = applyCommand(redone, redo).song
      expect(same(redone, mutated), `seed ${seed} redo`).toBe(true)
    }
  })

  it('anti-vacuity: 60 random commands genuinely change the document', () => {
    const random = rng(3)
    const original = base()
    const commands: Command[] = []
    let cur = original
    for (let i = 0; i < 60; i++) {
      const cmd = randomCommand(random, cur)
      commands.push(cmd)
      cur = applyCommand(cur, cmd).song
    }
    expect(same(cur, original)).toBe(false)
  })
})

describe('the policies WP10 codes against', () => {
  it('states the undo cap and the coalescing window as constants', () => {
    expect(UNDO_CAP).toBe(200)
    expect(COALESCE_MS).toBe(700)
  })
})
