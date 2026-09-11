/** facts read off a song document. No thresholds, no verdicts.
 *
 *  Every number here is one a gate, a lint or the critic rubric already cares about
 *  (`tests/unit/presets.test.ts`, preset-suite §5/§6/§9.5), computed the same way so the
 *  report and the gate never disagree about what the file says.
 */
import { CHANNELS, MELODIC_LANES } from './notes.mjs'

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
}
const ROOTS = {
  c: 0, 'c#': 1, db: 1, d: 2, 'd#': 3, eb: 3, e: 4, f: 5, 'f#': 6, gb: 6,
  g: 7, 'g#': 8, ab: 8, a: 9, 'a#': 10, bb: 10, b: 11,
}

export function scaleOf(key) {
  const [root, mode] = String(key ?? '').split('-')
  const r = ROOTS[root]
  const s = SCALES[mode ?? 'major']
  return r === undefined || s === undefined ? null : new Set(s.map((d) => (d + r) % 12))
}

export function qaOf(song) {
  return (song.extra ?? {}).qa ?? {}
}

/** Every cell the order reaches: `{ lane, channel, frame, r, row, cell }`, in played
 *  order. `row` is the ABSOLUTE row of one pass, which is what the percussion gap and
 *  the form map are measured in. */
export function cells(song) {
  const rows = song.meta.rowsPerPattern
  const byKey = new Map(song.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
  const out = []
  song.order.forEach((frame, f) => {
    song.channels.forEach((channel, lane) => {
      const p = byKey.get(`${channel}:${frame[lane]}`)
      if (p === undefined) return
      for (const cell of p.rows) out.push({ lane, channel, frame: f, r: cell.r, row: f * rows + cell.r, cell })
    })
  })
  return out.sort((a, b) => a.row - b.row || a.lane - b.lane)
}

const isAttack = (c) => c.cell.note !== undefined && c.cell.note >= 0

/** Per lane: attacks, the note range, and the attack count in each frame. */
export function noteStats(song, all) {
  return song.channels.map((channel, lane) => {
    const mine = all.filter((c) => c.lane === lane && isAttack(c))
    const notes = mine.map((c) => c.cell.note)
    const perFrame = song.order.map((_, f) => mine.filter((c) => c.frame === f).length)
    return {
      channel,
      lane,
      attacks: mine.length,
      cuts: all.filter((c) => c.lane === lane && c.cell.note === -1).length,
      releases: all.filter((c) => c.lane === lane && c.cell.note === -2).length,
      low: notes.length ? Math.min(...notes) : null,
      high: notes.length ? Math.max(...notes) : null,
      perFrame,
    }
  })
}

/** Per lane, how many cells carry each effect command. */
export function effectHistogram(song, all) {
  return song.channels.map((channel, lane) => {
    const counts = new Map()
    for (const c of all.filter((x) => x.lane === lane)) {
      for (const e of c.cell.fx ?? []) if (e !== null) counts.set(e.cmd, (counts.get(e.cmd) ?? 0) + 1)
    }
    return { channel, lane, counts: [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)) }
  })
}

/** Volume-column use on the attacks of each lane: the distribution, the share sitting at
 *  15, and how many distinct values the lane ever asks for. A melodic lane that only
 *  ever writes 15 has no dynamics (§2.8). */
export function volumeHistogram(song, all) {
  return song.channels.map((channel, lane) => {
    const mine = all.filter((c) => c.lane === lane && isAttack(c) && c.cell.vol !== undefined)
    const counts = new Map()
    for (const c of mine) counts.set(c.cell.vol, (counts.get(c.cell.vol) ?? 0) + 1)
    const attacks = all.filter((c) => c.lane === lane && isAttack(c)).length
    return {
      channel,
      lane,
      melodic: MELODIC_LANES.includes(lane),
      stated: mine.length,
      attacks,
      full: counts.get(15) ?? 0,
      fullFraction: attacks > 0 ? (counts.get(15) ?? 0) / attacks : 0,
      distinct: counts.size,
      counts: [...counts.entries()].sort((a, b) => b[0] - a[0]),
    }
  })
}

/** Melodic notes outside the declared key, counted exactly as the lint counts them. */
export function accidentals(song, all) {
  const key = qaOf(song).key
  const scale = scaleOf(key)
  if (scale === null) return { key, known: false, melodic: 0, outside: 0, fraction: 0, byLane: [] }
  let melodic = 0
  let outside = 0
  const byLane = []
  for (const lane of MELODIC_LANES) {
    if (lane >= song.channels.length) continue
    const mine = all.filter((c) => c.lane === lane && isAttack(c))
    const off = mine.filter((c) => !scale.has(c.cell.note % 12))
    melodic += mine.length
    outside += off.length
    if (mine.length > 0) byLane.push({ channel: song.channels[lane], notes: mine.length, outside: off.length })
  }
  return { key, known: true, melodic, outside, fraction: melodic > 0 ? outside / melodic : 0, byLane }
}

/** Noise-lane gaps, in the lint's own arithmetic: the longest silence, and the share of
 *  played rows that are NOT inside a gap longer than the declared bound. */
export function percussion(song, all) {
  const lane = song.channels.indexOf('noise')
  const totalRows = song.order.length * song.meta.rowsPerPattern
  if (lane < 0) return { present: false, totalRows }
  const hits = all.filter((c) => c.lane === lane && isAttack(c)).map((c) => c.row)
  const declared = qaOf(song).percussionGap ?? 8
  let longest = 0
  let inLongGap = 0
  let prev = -1
  for (const r of [...hits, totalRows]) {
    const len = r - prev - 1
    longest = Math.max(longest, len)
    if (len > declared) inLongGap += len
    prev = r
  }
  return {
    present: true,
    events: hits.length,
    declared,
    longest,
    coverage: 1 - inLongGap / Math.max(1, totalRows),
    totalRows,
  }
}

/** The cell each lane carries at the loop row — the §2.9 seam, lane by lane. */
export function loopRow(song) {
  const qa = qaOf(song)
  if (qa.loopFrame === undefined) return null
  const byKey = new Map(song.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
  return song.channels.map((channel, lane) => ({
    channel,
    cell: byKey.get(`${channel}:${song.order[qa.loopFrame][lane]}`)?.rows.find((r) => r.r === 0) ?? null,
  }))
}

/** Rows a second, seconds a frame, and the BPM the lint computes — all from `meta`.
 *  `Fxx` and `Dxx` move these locally; `dynamic` says whether any are present. */
export function timing(song, all) {
  const rowsPerSecond = song.meta.tempo / (2.5 * song.meta.speed)
  const dynamic = all.some((c) => (c.cell.fx ?? []).some((e) => e !== null && (e.cmd === 'F' || e.cmd === 'D')))
  return {
    rowsPerSecond,
    secondsPerFrame: song.meta.rowsPerPattern / rowsPerSecond,
    bpm: (24 * song.meta.tempo) / (song.meta.speed * song.meta.rowHighlight),
    dynamic,
  }
}

/** The frames a render of `seconds` plays: one pass, then from `loopFrame` onward. */
export function frameSequence(song, seconds, secondsPerFrame) {
  const qa = qaOf(song)
  const loopFrame = qa.loopFrame ?? 0
  const frames = song.order.length
  const out = []
  let t = 0
  let f = 0
  while (t < seconds - 1e-6 && out.length < frames * 64) {
    out.push({ frame: f, label: (qa.form ?? [])[f] ?? `frame ${f}`, start: t })
    t += secondsPerFrame
    f = f + 1 >= frames ? loopFrame : f + 1
  }
  return out
}

export { CHANNELS }
