/** Lane audit: the source document's events against the shipped song's, lane by lane.
 *
 *      node tools/songs/octet/audit.mjs [--octet <dir>]
 *
 *  The port is supposed to be the same music, so every lane must carry the same number of
 *  note attacks, cuts and releases as OCTET's own document. The only permitted differences
 *  are the corrections the song modules document, declared below as `CORRECTIONS` — a
 *  delta that is not in the table (or a declared one that did not happen) fails the run.
 *  Both sides are counted by WALKING THE ORDER, so a de-duplicated pattern that two frames
 *  share counts twice on both sides.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANNELS, loadOctet } from './convert.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const flag = process.argv.indexOf('--octet')
const OCTET = flag > 0 ? process.argv[flag + 1] : resolve(ROOT, '..', 'octet')

/** `[octet document, shipped song]` for the pieces the audit covers. */
const SONGS = [
  ['cathedral-of-gears', '02-cathedral-of-gears.json'],
  ['tide-tables', '03-tide-tables.json'],
]

/** What each module's header comment says it adds, as `lane: { notes, cuts, releases }`.
 *  Everything else must match exactly. */
const CORRECTIONS = {
  'cathedral-of-gears': {
    // loop entry: the echo lane is silent across the seam and says so
    pulse2: { cuts: 1 },
  },
  'tide-tables': {
    // the wind and surf swells re-struck at their own envelope length
    noise: { notes: 44 },
    // loop entry: the held drone restated, the five silent lanes cut
    pulse1: { cuts: 1 },
    pulse2: { cuts: 1 },
    triangle: { notes: 1 },
    vrc6p1: { cuts: 1 },
    vrc6p2: { cuts: 1 },
    vrc6saw: { cuts: 1 },
  },
}

const KINDS = ['notes', 'cuts', 'releases']
const zero = () => ({ notes: 0, cuts: 0, releases: 0 })

function tally(bucket, note) {
  if (note === null || note === undefined) return
  if (note >= 0) bucket.notes++
  else if (note === -1) bucket.cuts++
  else bucket.releases++
}

/** The OCTET document's events per lane, over the order walk. */
function octetCounts(doc) {
  const out = CHANNELS.map(() => zero())
  for (const p of doc.order) {
    for (let c = 0; c < CHANNELS.length; c++) {
      for (const cell of doc.patterns[p].rows[c]) if (cell) tally(out[c], cell[0])
    }
  }
  return out
}

/** The shipped song's events per lane, over the order walk. */
function pulsarCounts(song) {
  const byKey = new Map(song.patterns.map((p) => [`${p.channel}:${p.index}`, p.rows]))
  const out = CHANNELS.map(() => zero())
  for (const frame of song.order) {
    for (let c = 0; c < song.channels.length; c++) {
      const rows = byKey.get(`${song.channels[c]}:${frame[c]}`) ?? []
      for (const cell of rows) tally(out[CHANNELS.indexOf(song.channels[c])], cell.note)
    }
  }
  return out
}

let failures = 0
for (const [id, file] of SONGS) {
  const doc = loadOctet(join(OCTET, 'demos', `${id}.json`))
  const song = JSON.parse(readFileSync(join(ROOT, 'src', 'assets', 'songs', file), 'utf8'))
  const before = octetCounts(doc)
  const after = pulsarCounts(song)
  const expected = CORRECTIONS[id] ?? {}
  const seen = new Set()

  console.log(`\n${id}`)
  console.log('  lane       notes  cuts  rel  |  notes  cuts  rel  |  delta')
  for (let c = 0; c < CHANNELS.length; c++) {
    const lane = CHANNELS[c]
    const want = expected[lane] ?? {}
    const delta = []
    for (const kind of KINDS) {
      const d = after[c][kind] - before[c][kind]
      const w = want[kind] ?? 0
      if (d !== w) {
        failures++
        delta.push(`${kind} ${d >= 0 ? '+' : ''}${d} (documented ${w >= 0 ? '+' : ''}${w})  <-- UNDOCUMENTED`)
      } else if (d !== 0) {
        delta.push(`${kind} ${d > 0 ? '+' : ''}${d}`)
      }
    }
    if (Object.keys(want).length > 0) seen.add(lane)
    const col = (b) => KINDS.map((k) => String(b[k]).padStart(5)).join(' ')
    console.log(`  ${lane.padEnd(9)} ${col(before[c])}  | ${col(after[c])}  |  ${delta.join(', ') || '—'}`)
  }
  for (const lane of Object.keys(expected)) {
    if (!seen.has(lane)) {
      failures++
      console.log(`  ${lane}: a correction is declared for a lane that does not exist`)
    }
  }
}

console.log(failures === 0 ? '\nevery lane matches the source document up to its documented corrections' : `\n${failures} undocumented difference(s)`)
process.exit(failures === 0 ? 0 : 1)
