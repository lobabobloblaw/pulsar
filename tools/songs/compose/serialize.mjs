/** the canonical bytes — `serializeSong`'s shape, reproduced.
 *
 *  Key order, pattern sort, row sort, trailing-null trimming, two-space indent and the
 *  trailing newline all come from `src/tracker/model/validate.ts`. Nothing here may be
 *  "tidied": the gate is `serializeSong(parseSong(text)) === text` on the committed file,
 *  so a difference of one key's position is a failure, not a style choice.
 */
import { MACRO_KINDS } from './build.mjs'

/** Shared sequence banks, de-duplicated by VALUE (FamiTracker's own model: sequences are
 *  shared by index across instruments, so two instruments with the same envelope cost
 *  one entry). */
function bankBuilder() {
  const banks = { volume: [], arpeggio: [], pitch: [], hiPitch: [], duty: [] }
  const keys = new Map()
  return {
    banks,
    indexOf(kind, seq) {
      if (seq === null || seq === undefined || seq.values.length === 0) return -1
      const entry = { values: seq.values.slice(), loop: seq.loop, release: seq.release }
      if (kind === 'arpeggio' && seq.mode !== undefined && seq.mode !== 'absolute') entry.mode = seq.mode
      const key = `${kind}:${JSON.stringify(entry)}`
      if (!keys.has(key)) {
        keys.set(key, banks[kind].length)
        banks[kind].push(entry)
      }
      return keys.get(key)
    },
  }
}

/** Per-channel sparse patterns, de-duplicated across the order, plus the order frames
 *  and the effect-column counts those cells imply. */
function patternsOf(frames, channels, rowsPerPattern, instIndex) {
  const byChannel = channels.map(() => ({ keys: new Map(), list: [] }))
  const effectColumns = channels.map(() => 1)
  const order = []
  for (const frame of frames) {
    const line = []
    for (let c = 0; c < channels.length; c++) {
      const cells = []
      for (let r = 0; r < rowsPerPattern; r++) {
        const cell = frame[c][r]
        if (cell === null || cell === undefined) continue
        const out = { r }
        if (cell.note !== undefined) out.note = cell.note
        if (cell.inst !== undefined) out.inst = instIndex.get(cell.inst)
        if (cell.vol !== undefined) out.vol = cell.vol
        if (cell.fx !== undefined && cell.fx.length > 0) {
          out.fx = cell.fx.map((e) => ({ cmd: e.cmd, param: e.param }))
          effectColumns[c] = Math.max(effectColumns[c], out.fx.length)
        }
        // A cell that carries nothing but its row number is not a cell.
        if (Object.keys(out).length === 1) continue
        cells.push(out)
      }
      const key = JSON.stringify(cells)
      const slot = byChannel[c]
      if (!slot.keys.has(key)) {
        slot.keys.set(key, slot.list.length)
        slot.list.push({ channel: channels[c], index: slot.list.length, rows: cells })
      }
      line.push(slot.keys.get(key))
    }
    order.push(line)
  }
  return { patterns: byChannel.flatMap((slot) => slot.list), order, effectColumns }
}

/** Which logical instruments the order actually plays, in declaration order. An
 *  instrument nothing references is a load-time WARNING, and gate A tolerates only the
 *  unreferenced-PATTERN warning — so an unused one is dropped, not shipped. */
function usedInstruments(frames, channels, count) {
  const used = new Set()
  for (const frame of frames) {
    for (let c = 0; c < channels.length; c++) {
      for (const cell of frame[c]) if (cell !== null && cell.inst !== undefined) used.add(cell.inst)
    }
  }
  return [...Array(count).keys()].filter((i) => used.has(i))
}

/** `{ text, doc, patterns, order, instruments }` — the document and its bytes. */
export function serialize({ meta, channels, frames, instruments, samples, extra }) {
  const keep = usedInstruments(frames, channels, instruments.length)
  const instIndex = new Map(keep.map((logical, dense) => [logical, dense]))

  const sampleKeep = []
  for (const i of keep) {
    const map = instruments[i].dpcm
    if (map === undefined) continue
    for (const key of Object.keys(map)) if (!sampleKeep.includes(map[key].sample)) sampleKeep.push(map[key].sample)
  }
  sampleKeep.sort((a, b) => a - b)
  const sampleIndex = new Map(sampleKeep.map((logical, dense) => [logical, dense]))

  const bank = bankBuilder()
  const outInstruments = keep.map((i) => {
    const src = instruments[i]
    const macros = {}
    for (const kind of MACRO_KINDS) macros[kind] = bank.indexOf(kind, src.macros[kind])
    const out = { name: src.name, macros }
    if (src.dpcm !== undefined) {
      const map = {}
      for (const key of Object.keys(src.dpcm)) {
        const a = src.dpcm[key]
        const entry = { sample: sampleIndex.get(a.sample), pitch: a.pitch, loop: a.loop }
        if (a.delta !== undefined) entry.delta = a.delta
        map[key] = entry
      }
      out.dpcm = map
    }
    return out
  })

  const { patterns, order, effectColumns } = patternsOf(frames, channels, meta.rowsPerPattern, instIndex)

  const doc = {
    format: 'pulsar-song',
    version: 1,
    meta,
    channels,
    effectColumns,
    order,
    patterns,
    instruments: outInstruments,
    sequences: bank.banks,
    samples: sampleKeep.map((i) => ({ name: samples[i].name, data: samples[i].data })),
  }
  if (extra !== undefined) doc.extra = extra
  return { text: `${JSON.stringify(doc, null, 2)}\n`, doc, instIndex }
}
