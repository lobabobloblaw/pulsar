/** The song store's undo policy over WP9's command layer — design §4.6.
 *
 *  Headline assertions:
 *    - the undo stack is capped at 200 and drops from the OLDEST end;
 *    - consecutive `setCellField`s on the same cell inside 700 ms coalesce into
 *      ONE entry, and that entry's inverse is the value before the first
 *      keystroke — typing `1`,`0`,`5` is one undo, not three;
 *    - a new edit invalidates the redo stack;
 *    - a multi-command edit (a paste, a row insert across lanes) is ONE entry,
 *      applied in order and unwound in reverse;
 *    - the property test §6.4's WP10 gate names: N random valid commands, then
 *      N undos, is structurally the original document; then N redos is
 *      structurally the mutated one.
 *
 *  It tests `src/state/songModel.ts` rather than `song.svelte.ts` on purpose:
 *  the reactive wrapper is a five-line skin, the policy is all here, and runes
 *  cannot be imported into vitest's node environment. The COMMANDS themselves
 *  are WP9's and are pinned by `tests/unit/trackerCommands.test.ts`; what is
 *  pinned here is the stack built on top of them.
 *
 *  Anti-vacuity: `applies at all` proves the commands actually change the
 *  document, so a no-op command layer cannot pass the round-trip tests by
 *  doing nothing.
 */
import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  cellAt,
  cellFieldCommand,
  COALESCE_MS,
  createEmptySong,
  edit,
  EMPTY_HISTORY,
  emptyInstrument,
  ensurePattern,
  readField,
  redoStep,
  rowsOf,
  UNDO_CAP,
  undoStep,
  type CellField,
  type ChannelId,
  type Command,
  type History,
  type Song,
} from '../../src/state/songModel'

function field(
  song: Song,
  channel: ChannelId,
  pattern: number,
  row: number,
  id: 'note' | 'inst' | 'vol',
): number | null {
  return readField(cellAt(rowsOf(song, channel, pattern), row), { kind: id })
}

function setNote(row: number, value: number | null, channel: ChannelId = 'pulse1'): Command {
  return { kind: 'setCellField', channel, pattern: 0, row, field: 'note', value }
}

describe('command layer', () => {
  it('applies at all — the anti-vacuity floor for everything below', () => {
    const song = createEmptySong()
    const { song: next } = applyCommand(song, setNote(4, 60))
    expect(field(song, 'pulse1', 0, 4, 'note')).toBeNull()
    expect(field(next, 'pulse1', 0, 4, 'note')).toBe(60)
    expect(next).not.toBe(song)
    // Structural sharing: an untouched lane is the SAME object, not a copy.
    expect(next.instruments).toBe(song.instruments)
  })

  it('keeps rows sparse, sorted and unique', () => {
    let song = createEmptySong()
    for (const r of [8, 2, 5, 2]) song = applyCommand(song, setNote(r, 60 + r)).song
    const rows = rowsOf(song, 'pulse1', 0)
    expect(rows.map((c) => c.r)).toEqual([2, 5, 8])
    expect(rows.length).toBe(3)
  })

  it('clearing the last field of a cell removes the cell, not just its value', () => {
    let song = applyCommand(createEmptySong(), setNote(3, 60)).song
    expect(rowsOf(song, 'pulse1', 0)).toHaveLength(1)
    song = applyCommand(song, setNote(3, null)).song
    expect(rowsOf(song, 'pulse1', 0)).toHaveLength(0)
  })

  it('every command inverts', () => {
    const base = createEmptySong()
    const cases: Command[] = [
      setNote(0, 60),
      { kind: 'setCellField', channel: 'pulse2', pattern: 0, row: 3, field: 'inst', value: 7 },
      {
        kind: 'setCellField',
        channel: 'pulse1',
        pattern: 0,
        row: 3,
        field: 'fx',
        slot: 0,
        effect: { cmd: '4', param: 0x47 },
      },
      { kind: 'setCell', channel: 'triangle', pattern: 0, row: 9, cell: { r: 9, note: 36, vol: 12 } },
      { kind: 'clearRow', channel: 'pulse1', pattern: 0, row: 0 },
      { kind: 'insertRow', channel: 'pulse1', pattern: 0, row: 2 },
      { kind: 'deleteRow', channel: 'pulse1', pattern: 0, row: 2 },
      { kind: 'setPatternRows', channel: 'noise', pattern: 0, rows: [{ r: 1, note: 40 }] },
      { kind: 'setOrderEntry', frame: 0, channel: 1, pattern: 3 },
      { kind: 'insertFrame', frame: 1, value: [1, 1, 1, 1, 1] },
      { kind: 'setMeta', meta: { speed: 4, tempo: 160 } },
      { kind: 'setInstrument', index: 1, instrument: emptyInstrument('bass') },
      { kind: 'setSequence', macro: 'pitch', index: 0, sequence: { values: [1, 2], loop: -1, release: -1 } },
    ]
    for (const cmd of cases) {
      const seeded = applyCommand(base, setNote(0, 48)).song
      const { song: after, inverse } = applyCommand(seeded, cmd)
      expect(applyCommand(after, inverse).song, cmd.kind).toEqual(seeded)
    }
  })

  it('deleteFrame refuses to empty the order list', () => {
    const song = createEmptySong()
    expect(applyCommand(song, { kind: 'deleteFrame', frame: 0 }).song.order).toHaveLength(1)
  })

  it('insertRow drops what falls off the end and undo puts it back', () => {
    let song = createEmptySong()
    const last = song.meta.rowsPerPattern - 1
    song = applyCommand(song, setNote(last, 60)).song
    const { song: shifted, inverse } = applyCommand(song, {
      kind: 'insertRow',
      channel: 'pulse1',
      pattern: 0,
      row: 0,
    })
    expect(field(shifted, 'pulse1', 0, last, 'note')).toBeNull()
    expect(applyCommand(shifted, inverse).song).toEqual(song)
  })

  it('the store materialises a pattern the order list names but the document lacks', () => {
    // Commands only ever REWRITE a pattern, so "add frame" would otherwise hand
    // the grid five lanes it cannot type into.
    const song = createEmptySong()
    expect(applyCommand(song, setNote(0, 60, 'pulse1')).song.patterns).toHaveLength(5)

    const missing: Command = { kind: 'setCellField', channel: 'pulse1', pattern: 7, row: 0, field: 'note', value: 60 }
    expect(applyCommand(song, missing).song).toEqual(song)

    const ready = ensurePattern(song, 'pulse1', 7)
    expect(field(applyCommand(ready, missing).song, 'pulse1', 7, 0, 'note')).toBe(60)
    // Sorted by (channel, index), so the document still serialises canonically.
    expect(ready.patterns.map((p) => `${p.channel}:${p.index}`)).toEqual([
      'pulse1:0',
      'pulse1:7',
      'pulse2:0',
      'triangle:0',
      'noise:0',
      'dpcm:0',
    ])
    expect(ensurePattern(ready, 'pulse1', 7)).toBe(ready)
  })
})

describe('the effect adapter the grid edits through', () => {
  const target = { channel: 'pulse1', pattern: 0, row: 3 } as const
  const cmd = (cell: Parameters<typeof cellFieldCommand>[0], f: CellField, v: number | null): Command =>
    cellFieldCommand(cell, target, f, v)

  it('a command character keeps the param already in the slot', () => {
    const cell = { r: 3, fx: [{ cmd: '0', param: 0x47 }] }
    expect(cmd(cell, { kind: 'fx', slot: 0, part: 'cmd' }, 'F'.charCodeAt(0))).toEqual({
      kind: 'setCellField',
      ...target,
      field: 'fx',
      slot: 0,
      effect: { cmd: 'F', param: 0x47 },
    })
  })

  it('a param digit into an empty slot gets the neutral 0 command', () => {
    expect(cmd(null, { kind: 'fx', slot: 1, part: 'param' }, 0x12)).toEqual({
      kind: 'setCellField',
      ...target,
      field: 'fx',
      slot: 1,
      effect: { cmd: '0', param: 0x12 },
    })
  })

  it('clearing either column clears the whole effect — there is no half effect', () => {
    const cell = { r: 3, fx: [{ cmd: 'F', param: 6 }] }
    for (const part of ['cmd', 'param'] as const) {
      expect(cmd(cell, { kind: 'fx', slot: 0, part }, null)).toEqual({
        kind: 'setCellField',
        ...target,
        field: 'fx',
        slot: 0,
        effect: null,
      })
    }
  })

  it('reads back the two columns the way the hex editor typed them', () => {
    const cell = { r: 3, fx: [null, { cmd: 'S', param: 0x0c }] }
    expect(readField(cell, { kind: 'fx', slot: 1, part: 'cmd' })).toBe('S'.charCodeAt(0))
    expect(readField(cell, { kind: 'fx', slot: 1, part: 'param' })).toBe(0x0c)
    expect(readField(cell, { kind: 'fx', slot: 0, part: 'cmd' })).toBeNull()
  })

  it('note, inst and vol pass straight through', () => {
    expect(cmd(null, { kind: 'vol' }, 9)).toEqual({ kind: 'setCellField', ...target, field: 'vol', value: 9 })
  })
})

describe('undo policy', () => {
  it('coalesces consecutive edits to the same cell inside the window', () => {
    let song = createEmptySong()
    const history: History = EMPTY_HISTORY
    song = applyCommand(song, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'vol', value: 1 }).song

    const at = 1000
    let r = edit(song, history, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'vol', value: 0x1 }, at)
    expect(r.coalesced).toBe(false)
    r = edit(r.song, r.history, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'vol', value: 0x0 }, at + 200)
    expect(r.coalesced).toBe(true)
    r = edit(r.song, r.history, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'vol', value: 0x5 }, at + 400)
    expect(r.coalesced).toBe(true)

    expect(r.history.undo).toHaveLength(1)
    expect(field(r.song, 'pulse1', 0, 0, 'vol')).toBe(5)

    // ONE undo returns to the value before the first keystroke of the run.
    const back = undoStep(r.song, r.history)
    expect(field(back.song, 'pulse1', 0, 0, 'vol')).toBe(1)
    expect(back.history.undo).toHaveLength(0)
    // …and ONE redo replays the whole run, not just its last keystroke.
    const forward = redoStep(back.song, back.history)
    expect(field(forward.song, 'pulse1', 0, 0, 'vol')).toBe(5)
  })

  it('a coalesced run over several sub-fields survives undo AND redo', () => {
    // Writing a note also writes the cell's instrument, so this is not an edge
    // case — it is what every note entry does.
    const song = createEmptySong()
    let r = edit(song, EMPTY_HISTORY, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'note', value: 60 }, 0)
    r = edit(r.song, r.history, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'inst', value: 3 }, 50)
    r = edit(r.song, r.history, { kind: 'setCellField', channel: 'pulse1', pattern: 0, row: 0, field: 'vol', value: 15 }, 100)
    expect(r.history.undo).toHaveLength(1)

    const filled = r.song
    const back = undoStep(filled, r.history)
    expect(cellAt(rowsOf(back.song, 'pulse1', 0), 0), 'undo left something behind').toBeNull()

    const forward = redoStep(back.song, back.history)
    expect(forward.song, 'redo dropped part of the run').toEqual(filled)
  })

  it('does not coalesce past the window, or across cells', () => {
    const song = createEmptySong()
    let r = edit(song, EMPTY_HISTORY, setNote(0, 60), 0)
    r = edit(r.song, r.history, setNote(0, 61), COALESCE_MS + 1)
    expect(r.coalesced).toBe(false)
    expect(r.history.undo).toHaveLength(2)

    r = edit(r.song, r.history, setNote(1, 62), COALESCE_MS + 2)
    expect(r.coalesced).toBe(false)

    // A different lane at the same row is a different cell.
    r = edit(r.song, r.history, setNote(1, 63, 'pulse2'), COALESCE_MS + 3)
    expect(r.coalesced).toBe(false)
    expect(r.history.undo).toHaveLength(4)
  })

  it('never coalesces anything that is not a cell edit', () => {
    const song = createEmptySong()
    let r = edit(song, EMPTY_HISTORY, { kind: 'setMeta', meta: { speed: 5 } }, 0)
    r = edit(r.song, r.history, { kind: 'setMeta', meta: { speed: 6 } }, 10)
    expect(r.history.undo).toHaveLength(2)
  })

  it('a list of commands is ONE entry, applied in order and unwound in reverse', () => {
    // What a paste and a cross-lane row insert both are.
    const song = createEmptySong()
    const r = edit(
      song,
      EMPTY_HISTORY,
      [setNote(0, 60), setNote(1, 62, 'pulse2'), { kind: 'setMeta', meta: { speed: 9 } }],
      0,
    )
    expect(r.history.undo).toHaveLength(1)
    expect(r.coalesced).toBe(false)
    expect(field(r.song, 'pulse1', 0, 0, 'note')).toBe(60)
    expect(field(r.song, 'pulse2', 0, 1, 'note')).toBe(62)
    expect(r.song.meta.speed).toBe(9)

    const back = undoStep(r.song, r.history)
    expect(back.song, 'one undo did not unwind the whole list').toEqual(song)
    expect(redoStep(back.song, back.history).song).toEqual(r.song)
  })

  it('caps at 200 entries and drops the oldest', () => {
    let song = createEmptySong()
    let history: History = EMPTY_HISTORY
    // Distinct cells and distinct times, so nothing coalesces.
    for (let i = 0; i < UNDO_CAP + 40; i++) {
      const r = edit(song, history, setNote(i % 64, 40 + (i % 40)), i * (COALESCE_MS + 1))
      song = r.song
      history = r.history
    }
    expect(history.undo).toHaveLength(UNDO_CAP)
    // The survivors are the NEWEST 200: an editor that forgets your last 200
    // edits instead of your first 200 is an editor nobody trusts.
    expect(history.undo[history.undo.length - 1]?.at).toBe((UNDO_CAP + 39) * (COALESCE_MS + 1))
    expect(history.undo[0]?.at).toBe(40 * (COALESCE_MS + 1))
  })

  it('a new edit invalidates the redo stack', () => {
    let r = edit(createEmptySong(), EMPTY_HISTORY, setNote(0, 60), 0)
    r = edit(r.song, r.history, setNote(1, 62), 5000)
    const back = undoStep(r.song, r.history)
    expect(back.history.redo).toHaveLength(1)

    const fresh = edit(back.song, back.history, setNote(2, 64), 10000)
    expect(fresh.history.redo).toHaveLength(0)
    expect(redoStep(fresh.song, fresh.history).moved).toBe(false)
  })

  it('undo and redo are no-ops on empty stacks', () => {
    const song = createEmptySong()
    expect(undoStep(song, EMPTY_HISTORY).moved).toBe(false)
    expect(redoStep(song, EMPTY_HISTORY).moved).toBe(false)
  })
})

describe('property: N commands, N undos, N redos', () => {
  /** Deterministic PRNG — a failing seed has to be reproducible. */
  function rng(seed: number): () => number {
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      return s / 0x7fffffff
    }
  }

  function randomCommand(song: Song, rnd: () => number): Command {
    const lane = Math.floor(rnd() * song.channels.length)
    const channel = song.channels[lane] as ChannelId
    const pattern = song.order[0]?.[lane] ?? 0
    const row = Math.floor(rnd() * song.meta.rowsPerPattern)
    switch (Math.floor(rnd() * 9)) {
      case 0:
        return { kind: 'setCellField', channel, pattern, row, field: 'note', value: Math.floor(rnd() * 96) }
      case 1:
        return { kind: 'setCellField', channel, pattern, row, field: 'inst', value: Math.floor(rnd() * 8) }
      case 2:
        return { kind: 'setCellField', channel, pattern, row, field: 'vol', value: Math.floor(rnd() * 16) }
      case 3:
        return {
          kind: 'setCellField',
          channel,
          pattern,
          row,
          field: 'fx',
          slot: 0,
          effect: { cmd: '4', param: Math.floor(rnd() * 256) },
        }
      case 4:
        return { kind: 'clearRow', channel, pattern, row }
      case 5:
        return rnd() > 0.5
          ? { kind: 'insertRow', channel, pattern, row }
          : { kind: 'deleteRow', channel, pattern, row }
      case 6:
        return { kind: 'setOrderEntry', frame: 0, channel: lane, pattern: Math.floor(rnd() * 4) }
      case 7:
        return rnd() > 0.5
          ? { kind: 'insertFrame', frame: 0, value: [0, 0, 0, 0, 0] }
          : { kind: 'deleteFrame', frame: 0 }
      default:
        return { kind: 'setMeta', meta: { speed: 1 + Math.floor(rnd() * 30) } }
    }
  }

  it('N undos restore the original and N redos restore the mutation', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rnd = rng(seed * 7919)
      const original = createEmptySong()
      const N = 60
      let song = original
      let history: History = EMPTY_HISTORY
      for (let i = 0; i < N; i++) {
        // Times far apart so nothing coalesces — coalescing is tested above and
        // would make "N commands, N undos" a different claim.
        const r = edit(song, history, randomCommand(song, rnd), i * 10_000)
        song = r.song
        history = r.history
      }
      const mutated = song
      expect(mutated, `seed ${seed} changed nothing`).not.toEqual(original)
      expect(history.undo).toHaveLength(N)

      for (let i = 0; i < N; i++) {
        const r = undoStep(song, history)
        song = r.song
        history = r.history
      }
      expect(song, `seed ${seed}: undo`).toEqual(original)

      for (let i = 0; i < N; i++) {
        const r = redoStep(song, history)
        song = r.song
        history = r.history
      }
      expect(song, `seed ${seed}: redo`).toEqual(mutated)
    }
  })
})
