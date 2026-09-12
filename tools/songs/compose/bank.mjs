/** the shared instrument bank, read from the fixture and copied VERBATIM.
 *
 *  preset-suite §3.1: a song embeds only the bank entries it uses, densely renumbered,
 *  NAMES PRESERVED, and §7.1's drift check resolves every canonical name back to these
 *  values. So this module never retypes a value — it reads
 *  `tests/fixtures/songs/shared-bank.json` and deep-copies. A bank instrument that
 *  reaches a song through `s.bank('kick')` is byte-identical to the fixture by
 *  construction, which is the only way that check can stay meaningful.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(HERE, '..', '..', '..')
const BANK_PATH = join(REPO_ROOT, 'tests', 'fixtures', 'songs', 'shared-bank.json')

let cached = null

/** `{ rev, sequences: {kind: [{name, values, loop, release, mode?}]}, instruments, samples }` */
export function loadBank() {
  if (cached === null) cached = JSON.parse(readFileSync(BANK_PATH, 'utf8'))
  return cached
}

/** The canonical noise note for each kit instrument (preset-suite §3.4's table, and
 *  §10.3 for `rim`). `hits()` uses it when the caller names no note, so a drum line
 *  reads as rhythm rather than as a column of period arithmetic. `tom` has two notes in
 *  the table, 37 and 43; the low one is the default and the high one is written out. */
export const KIT_NOTES = Object.freeze({
  kick: 36,
  snare: 39,
  tom: 37,
  'hat-closed': 45,
  'hat-open': 46,
  crash: 46,
  metal: 44,
  rim: 44,
})

/** The bank instrument that carries the DPCM key map, and the notes it answers to. */
export const DPCM_KIT_NAME = 'dpcm-kit'

export function bankInstrument(name) {
  const found = loadBank().instruments.find((i) => i.name === name)
  if (found === undefined) {
    const names = loadBank().instruments.map((i) => i.name).join(', ')
    throw new Error(`shared bank has no instrument "${name}". It has: ${names}`)
  }
  return found
}

/** One bank sequence, as the song format wants it: no `name`, and `mode` only when it
 *  is not the default. The fixture's sequences carry a name the format does not have. */
export function bankSequence(kind, index) {
  const seq = loadBank().sequences[kind][index]
  if (seq === undefined) throw new Error(`shared bank has no ${kind} sequence ${index}`)
  const out = { values: seq.values.slice(), loop: seq.loop, release: seq.release }
  if (kind === 'arpeggio' && seq.mode !== undefined && seq.mode !== 'absolute') out.mode = seq.mode
  return out
}

/** Deep copy of a DPCM key map, preserving the fixture's key order inside each
 *  assignment (`sample, pitch, loop, delta`) — which is the order `parseDpcm` rebuilds
 *  and therefore the order the byte-identical round trip needs. */
export function copyDpcmMap(map) {
  const out = {}
  for (const key of Object.keys(map)) {
    const a = map[key]
    const entry = { sample: a.sample, pitch: a.pitch, loop: a.loop }
    if (a.delta !== undefined) entry.delta = a.delta
    out[key] = entry
  }
  return out
}
