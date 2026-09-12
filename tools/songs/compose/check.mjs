/** `check()` — the same structural questions the gates ask, asked before the render.
 *
 *  Every rule here is one a gate or a lint already enforces (`tests/unit/presets.test.ts`,
 *  `tests/unit/soundtrack.test.ts`, `src/tracker/model/validate.ts`). None of them is a
 *  taste judgement: a composer may write anything that passes, and nothing that passes
 *  here is thereby good. The point is that a fault found at generate time costs a second
 *  and the same fault found at gate time costs a two-minute render.
 *
 *  Each problem carries a stable `code`, so `tests/unit/compose.test.ts` can prove that
 *  every one of them can actually fire — a check that cannot fail is not a check.
 */
import { ALLOWED_EFFECTS, CHANNELS, LANE_FLOOR, L, MAX_NOTE, NOISE_MAX, NOISE_MIN, noteName } from './notes.mjs'
import { MACRO_KINDS } from './build.mjs'
import { loadBank } from './bank.mjs'
import { STICKY_MODES, applyCell, spell, statedBy } from './sticky.mjs'

const PULSE_LANES = [L.P1, L.P2]
const VRC6_LANES = [L.V1, L.V2, L.SAW]

function resolved(macros, sequences) {
  const out = {}
  for (const kind of MACRO_KINDS) {
    const i = macros[kind]
    if (i < 0) {
      out[kind] = null
      continue
    }
    const s = sequences[kind][i]
    out[kind] = s === undefined
      ? 'MISSING'
      : { values: [...s.values], loop: s.loop, release: s.release, mode: s.mode ?? 'absolute' }
  }
  return out
}

/** Which lanes each instrument is played on, so a duty range can be judged per chip. */
function lanesPerInstrument(doc) {
  const byIndex = new Map()
  const patterns = new Map(doc.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
  for (const frame of doc.order) {
    for (let c = 0; c < doc.channels.length; c++) {
      const p = patterns.get(`${doc.channels[c]}:${frame[c]}`)
      if (p === undefined) continue
      for (const cell of p.rows) {
        if (cell.inst === undefined) continue
        if (!byIndex.has(cell.inst)) byIndex.set(cell.inst, new Set())
        byIndex.get(cell.inst).add(c)
      }
    }
  }
  return byIndex
}

/** Every cell the order reaches, tagged with its lane and absolute row. */
function playedCells(doc) {
  const rows = doc.meta.rowsPerPattern
  const patterns = new Map(doc.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
  const out = []
  doc.order.forEach((frame, f) => {
    for (let c = 0; c < doc.channels.length; c++) {
      const p = patterns.get(`${doc.channels[c]}:${frame[c]}`)
      if (p === undefined) continue
      for (const cell of p.rows) out.push({ lane: c, frame: f, row: f * rows + cell.r, cell })
    }
  })
  return out
}

export function checkDoc(doc, id, loopFrame) {
  const problems = []
  const add = (code, message) => problems.push({ code, message })
  const cells = playedCells(doc)

  // --- notes: every lane's own register window (preset-suite §1) --------------------
  for (const { lane, frame, row, cell } of cells) {
    const note = cell.note
    if (note === undefined || note < 0) continue
    const where = `${CHANNELS[lane]} frame ${frame} row ${row % doc.meta.rowsPerPattern}`
    if (note > MAX_NOTE) add('note-range', `${where}: note ${note} is above MIDI ${MAX_NOTE}`)
    if (PULSE_LANES.includes(lane) && note < LANE_FLOOR[lane]) {
      add('pulse-floor', `${where}: ${noteName(note)} (${note}) is under the pulse floor 33 — it would sound a1`)
    }
    if (lane === L.TRI && note < LANE_FLOOR[L.TRI]) {
      add('triangle-floor', `${where}: ${noteName(note)} (${note}) is under the triangle floor 21`)
    }
    for (const v of VRC6_LANES) {
      if (lane === v && note < LANE_FLOOR[v]) {
        add('vrc6-floor', `${where}: ${noteName(note)} (${note}) is under the ${CHANNELS[v]} floor ${LANE_FLOOR[v]}`)
      }
    }
    if (lane === L.NOISE && (note < NOISE_MIN || note > NOISE_MAX)) {
      add('noise-window', `${where}: noise note ${note} is outside ${NOISE_MIN}..${NOISE_MAX}, where the period index wraps`)
    }
  }

  // --- effects: the album set, decimal params, at most four columns -----------------
  for (const { lane, frame, row, cell } of cells) {
    const fx = cell.fx ?? []
    if (fx.length > 4) add('effect-columns', `${CHANNELS[lane]} frame ${frame}: ${fx.length} effects in one cell`)
    for (const e of fx) {
      if (e === null) continue
      const where = `${CHANNELS[lane]} frame ${frame} row ${row % doc.meta.rowsPerPattern}`
      if (!ALLOWED_EFFECTS.includes(e.cmd)) {
        add('effect-unsupported', `${where}: effect ${e.cmd} is not in the album set ${ALLOWED_EFFECTS.join(' ')}`)
      }
      if (!Number.isInteger(e.param) || e.param < 0 || e.param > 255) {
        add('param-decimal', `${where}: ${e.cmd} param ${JSON.stringify(e.param)} is not a decimal integer 0..255`)
      }
    }
  }

  // --- macros ----------------------------------------------------------------------
  const lanesOf = lanesPerInstrument(doc)
  for (let i = 0; i < doc.instruments.length; i++) {
    const inst = doc.instruments[i]
    const lanes = lanesOf.get(i) ?? new Set()
    const dutyIndex = inst.macros.duty
    if (dutyIndex >= 0) {
      const values = doc.sequences.duty[dutyIndex].values
      const max = Math.max(...values)
      if ([...lanes].some((c) => VRC6_LANES.includes(c)) && max > 7) {
        add('vrc6-duty', `instrument "${inst.name}": duty ${max} sets the VRC6's mode bit — constant output, a click and silence`)
      }
      if ([...lanes].some((c) => PULSE_LANES.includes(c)) && max > 3) {
        add('pulse-duty', `instrument "${inst.name}": duty ${max} is masked to &3 on a 2A03 pulse`)
      }
      if (lanes.has(L.NOISE) && max > 1) {
        add('noise-duty', `instrument "${inst.name}": the noise lane's duty is the LFSR mode bit, 0 or 1`)
      }
    }
    if (lanes.has(L.NOISE)) {
      const vol = inst.macros.volume
      if (vol < 0) add('noise-envelope', `instrument "${inst.name}" plays noise with no volume envelope — the lane never releases`)
      else {
        const seq = doc.sequences.volume[vol]
        if (seq.loop >= 0) add('noise-envelope', `instrument "${inst.name}": a looping noise envelope never releases the lane`)
        if (seq.values[seq.values.length - 1] !== 0) {
          add('noise-envelope', `instrument "${inst.name}": a noise envelope must end on 0 (self-ending percussion)`)
        }
      }
    }
  }
  for (const kind of ['pitch', 'hiPitch']) {
    doc.sequences[kind].forEach((seq, i) => {
      if (seq.loop >= 0) {
        const sum = seq.values.slice(seq.loop).reduce((a, b) => a + b, 0)
        if (sum !== 0) add('pitch-tail', `${kind} sequence ${i}: the loop segment sums to ${sum}, so the note drifts forever`)
      } else if (seq.values[seq.values.length - 1] !== 0) {
        add('pitch-tail', `${kind} sequence ${i}: ends on ${seq.values[seq.values.length - 1]} — pitch macros ACCUMULATE, so it must end on 0`)
      }
    })
  }

  // --- instruments: the shared bank by name, or `x-<id>-` ---------------------------
  const bank = loadBank()
  const byName = new Map(bank.instruments.map((b) => [b.name, b]))
  for (const inst of doc.instruments) {
    const canonical = byName.get(inst.name)
    if (canonical === undefined) {
      if (!inst.name.startsWith(`x-${id}-`)) {
        add('instrument-name', `instrument "${inst.name}" is not in the shared bank and is not named x-${id}-*`)
      }
      continue
    }
    const mine = { ...resolved(inst.macros, doc.sequences), dpcm: inst.dpcm ?? null }
    const theirs = { ...resolved(canonical.macros, bank.sequences), dpcm: canonical.dpcm ?? null }
    if (JSON.stringify(mine) !== JSON.stringify(theirs)) {
      add('instrument-name', `instrument "${inst.name}" carries the shared bank's name but not its values`)
    }
  }

  // --- the loop seam (§2.9) --------------------------------------------------------
  if (loopFrame !== undefined) {
    const patterns = new Map(doc.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
    for (let c = 0; c < doc.channels.length; c++) {
      const sounds = cells.some((x) => x.lane === c && x.cell.note !== undefined && x.cell.note >= 0)
      if (!sounds) continue
      const first = patterns.get(`${doc.channels[c]}:${doc.order[loopFrame][c]}`).rows.find((r) => r.r === 0)
      const ok = first !== undefined
        && (first.note === -1 || (first.note !== undefined && first.note >= 0 && first.inst !== undefined && first.vol !== undefined))
      if (!ok) add('loop-row', `${CHANNELS[c]}: no explicit note/inst/vol (or cut) at the loop row, frame ${loopFrame} row 0`)
    }
  }

  // --- the channel modes a note trigger does not clear (§12.5) ----------------------
  // `trigger()` resets the phases and nothing else, so an arpeggio, a slide, a
  // portamento, a vibrato, a tremolo, a volume slide or a fine pitch outlives its note,
  // its pattern, its frame and the loop. Two moments change what the piece SOUNDS like:
  // the end of the order, which is where pass 2 begins, and the loop row, which pass 1
  // reaches in whatever state the frames before it left. `stickyLint` is the album gate
  // for the same table; asking it here costs a second instead of a two-minute render.
  {
    const byKey = new Map(doc.patterns.map((p) => [`${p.channel}:${p.index}`, p]))
    const ledgers = doc.channels.map(() => new Map())
    const rowsOf = (f, c) => [...(byKey.get(`${doc.channels[c]}:${doc.order[f][c]}`)?.rows ?? [])].sort((a, b) => a.r - b.r)
    let arriving = null
    for (let f = 0; f < doc.order.length; f++) {
      // Snapshot BEFORE the loop frame's own row 0, which is allowed to state its modes.
      if (f === loopFrame) arriving = ledgers.map((l) => new Map(l))
      for (let c = 0; c < doc.channels.length; c++) {
        for (const cell of rowsOf(f, c)) applyCell(ledgers[c], cell, `frame ${f} row ${cell.r}`)
      }
    }
    for (let c = 0; c < doc.channels.length; c++) {
      const set = (info) => `${spell(info.cmd, info.param)} at ${info.where}`
      for (const [field, info] of ledgers[c]) {
        add('sticky-latched', `${CHANNELS[c]}: ${STICKY_MODES[field].name} is still latched at the end of the ` +
          `order — ${set(info)}. Pass 2 starts under it, so it never sounds like pass 1. Cancel it with ` +
          `${STICKY_MODES[field].text}.`)
      }
      if (arriving === null) continue
      // §12.5 rule 1: a loop row that states the mode itself is clean, however it got there.
      const stated = statedBy(rowsOf(loopFrame, c).find((r) => r.r === 0))
      for (const [field, info] of arriving[c]) {
        if (stated.has(field)) continue
        add('sticky-loop', `${CHANNELS[c]}: ${STICKY_MODES[field].name} reaches the loop row (frame ${loopFrame} ` +
          `row 0) latched — ${set(info)}, and the loop row does not state it. Cancel it with ` +
          `${STICKY_MODES[field].text}, or state it on the loop row.`)
      }
    }
  }

  // --- what the lint will say about the claim --------------------------------------
  const qa = (doc.extra ?? {}).qa ?? {}
  for (const c of qa.channels ?? []) {
    const lane = doc.channels.indexOf(c)
    const notes = cells.filter((x) => x.lane === lane && x.cell.note !== undefined && x.cell.note >= 0).length
    if (notes < 8) add('thin-lane', `${c} is claimed but carries only ${notes} note events — the lint wants 8`)
  }

  const bpm = (24 * doc.meta.tempo) / (doc.meta.speed * doc.meta.rowHighlight)
  if (qa.bpmRange === undefined) add('qa-missing', 'extra.qa.bpmRange is missing — the lint requires it')
  else if (bpm < qa.bpmRange[0] || bpm > qa.bpmRange[1]) {
    add('bpm-range', `computed BPM ${bpm.toFixed(2)} is outside the declared ${qa.bpmRange.join('..')}`)
  }
  if (qa.key === undefined) add('qa-missing', 'extra.qa.key is missing — the lint requires it')
  if (qa.durationSec === undefined) add('qa-missing', 'extra.qa.durationSec is missing — gate C requires it')
  // Every raised bound and every declared allowance needs a justification the critic and
  // the next reader can check (§5, and the lint says so in four places).
  const needsNotes = ['accidentalFractionMax', 'rmsRange', 'clippedSamplesMax', 'percussionGap', 'percussionMinEvents', 'percussionCoverage']
  for (const field of needsNotes) {
    if (qa[field] !== undefined && !qa.notes) add('qa-justification', `extra.qa.${field} is declared but extra.qa.notes is empty`)
  }

  return problems
}
