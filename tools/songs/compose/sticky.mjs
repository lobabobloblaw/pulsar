/** the channel modes a note trigger does not clear — preset-suite §12.5, as one table.
 *
 *  `trackerDriver.ts`'s `trigger()` resets the PHASES — `arpStep`, `slideAccum`,
 *  `pitchAccum`, `portaTarget`, `vibAcc`, `tremAcc` — and nothing else. The MODE each of
 *  those phases is stepping lives in a separate per-channel field that only
 *  `applyRowEffect` writes and only `resetChannels()` — a stop, never a loop — clears. So
 *  a mode outlives the note that was sounding when it was set, outlives the note after
 *  it, outlives the pattern, outlives the order frame and outlives the loop; `---` does
 *  not clear one either. A piece with 132 `0xy` cells and no `000` anywhere is the defect
 *  that put §12.5 in the annex: its second pass did not sound like its first.
 *
 *  | mode    | set by        | cancelled by                                        |
 *  | ---     | ---           | ---                                                 |
 *  | `arp`   | `0xy`         | `000`, or any `1xx` `2xx` `3xx` `Qxy` `Rxy`         |
 *  | `slide` | `1xx` `2xx`   | `100` / `200`, or `3xx` `Qxy` `Rxy`                 |
 *  | `porta` | `3xx`         | `1xx` `2xx` `Qxy` `Rxy` — **`300` FREEZES it**      |
 *  | `vib`   | `4xy`         | `4x0`: the depth nibble is the off switch           |
 *  | `trem`  | `7xy`         | `7x0` with x > 0 — **`700` replays effect memory**  |
 *  | `vol`   | `Axy`         | `A00`                                               |
 *  | `pitch` | `Pxx`         | `P80` (0x80 is in tune)                             |
 *
 *  Every row is the driver's, read off `applyRowEffect` and `effects.ts`'s
 *  `OFF_ON_ZERO_COMMANDS` rather than off §12.5's prose, and the two doc and driver agree
 *  on the two traps: `3` is in `OFF_ON_ZERO_COMMANDS` but `FX_PORTAMENTO` sets
 *  `portaEnabled = 1` for every param, and `7` is in `MEMORY_COMMANDS` and NOT in
 *  `OFF_ON_ZERO_COMMANDS`, so a bare `700` resolves to the last tremolo param.
 *
 *  `Vxx` is §12.5's eighth row and is deliberately absent here. `dutyOverride` has no off
 *  value at all — `V00` is duty 0, a real duty — so a pre-flight that demanded a `Vxx` be
 *  cancelled could not be satisfied. `stickyLint` reports it at album level, where §12.5
 *  rule 1's remedy (restate it ON the loop row) is the one that exists.
 */

/** In the order a cancel list is built, widest first: one `100` cancels the portamento,
 *  the pitch slide and the arpeggio together, so three latched modes cost one column. */
export const STICKY_FIELDS = Object.freeze(['porta', 'slide', 'arp', 'vib', 'trem', 'vol', 'pitch'])

/** `finePitchOffset()`: "80 means in tune", so `P80` is the neutral fine pitch. */
const FINE_PITCH_CENTRE = 0x80

/** The name of each mode and the cell that cancels it: `fx` for a generator to write,
 *  `text` for the message a composer reads. */
export const STICKY_MODES = Object.freeze({
  porta: { name: '3xx portamento', fx: ['1', 0], text: '100 or 200 — 300 only FREEZES it' },
  slide: { name: '1xx/2xx pitch slide', fx: ['1', 0], text: '100 or 200' },
  arp: { name: '0xy arpeggio', fx: ['0', 0], text: '000' },
  vib: { name: '4xy vibrato', fx: ['4', 0], text: '4x0 — the depth nibble is the off switch' },
  trem: { name: '7xy tremolo', fx: ['7', 0x10], text: '7x0 with x > 0 — 700 replays the effect memory' },
  vol: { name: 'Axy volume slide', fx: ['A', 0], text: 'A00' },
  pitch: { name: 'Pxx fine pitch', fx: ['P', 0x80], text: 'P80' },
})

/** What ONE effect cell does to a lane's modes, written the way `applyRowEffect` is
 *  written: the modes it clears as a side effect, then the mode it leaves latched.
 *  `null` for a command that is not a channel mode at all. */
export function stickyStep(cmd, param) {
  switch (cmd) {
    case '0':
      return { clears: ['arp'], set: param === 0 ? null : 'arp' }
    case '1':
    case '2':
      return { clears: ['arp', 'porta', 'slide'], set: param === 0 ? null : 'slide' }
    case '3':
      return { clears: ['arp', 'slide'], set: 'porta' }
    case '4':
      return { clears: ['vib'], set: (param & 0x0f) === 0 ? null : 'vib' }
    case '7':
      return { clears: ['trem'], set: (param & 0x0f) === 0 && param !== 0 ? null : 'trem' }
    case 'A':
      return { clears: ['vol'], set: param === 0 ? null : 'vol' }
    case 'P':
      return { clears: ['pitch'], set: param === FINE_PITCH_CENTRE ? null : 'pitch' }
    case 'Q':
    case 'R':
      return { clears: ['arp', 'porta', 'slide'], set: null }
    default:
      return null
  }
}

/** The grid's spelling of a cell, for a message: `['0', 71]` reads back as `047`. */
export function spell(cmd, param) {
  return `${cmd}${param.toString(16).toUpperCase().padStart(2, '0')}`
}

/** Apply one cell to a lane's ledger, in row order. The ledger maps a latched mode to
 *  the cell that latched it, because that is the row a composer has to edit. */
export function applyCell(ledger, cell, where) {
  for (const e of cell?.fx ?? []) {
    if (e === null || e === undefined) continue
    const step = stickyStep(e.cmd, e.param)
    if (step === null) continue
    for (const f of step.clears) ledger.delete(f)
    if (step.set !== null) ledger.set(step.set, { cmd: e.cmd, param: e.param, where })
  }
  return ledger
}

/** The modes a cell STATES — sets or cancels — so a loop row that owns its own state
 *  counts as clean (§12.5 rule 1). */
export function statedBy(cell) {
  const out = new Set()
  for (const e of cell?.fx ?? []) {
    if (e === null || e === undefined) continue
    const step = stickyStep(e.cmd, e.param)
    if (step === null) continue
    for (const f of step.clears) out.add(f)
    if (step.set !== null) out.add(step.set)
  }
  return out
}

/** The fewest `[cmd, param]` cells that cancel everything in `ledger`, in
 *  `STICKY_FIELDS` order. Each chosen cancel is applied before the next field is
 *  considered, so the side effects in the table above are spent rather than repeated. */
export function cancelsFor(ledger) {
  const left = new Set(ledger.keys())
  const out = []
  for (const field of STICKY_FIELDS) {
    if (!left.has(field)) continue
    const [cmd, param] = STICKY_MODES[field].fx
    out.push([cmd, param])
    for (const f of stickyStep(cmd, param).clears) left.delete(f)
  }
  return out
}
