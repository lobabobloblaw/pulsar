#!/usr/bin/env node
/** report.mjs — what a piece actually contains, in numbers.
 *
 *      node tools/songs/compose/report.mjs src/assets/songs/02-cathedral-of-gears.json \
 *           previews/cathedral-of-gears.wav
 *
 *  Facts, no opinions. It never says a piece is good, thin, loud or repetitive; it says
 *  how many attacks each lane takes in each frame, which effects it uses, how its volume
 *  column is distributed, how far outside its declared key it goes, how long the drums
 *  go quiet, what every lane states at the loop seam, and — given the preview WAV —
 *  what the mix measures over time. The judgements are the composer's and the critic's.
 *
 *  The WAV is optional. Render one first with the preview filter:
 *
 *      PULSAR_PREVIEW_ONLY=cathedral-of-gears pnpm preview:songs
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { REPO_ROOT } from './bank.mjs'
import { noteName } from './notes.mjs'
import {
  accidentals, cells, effectHistogram, frameSequence, loopRow, noteStats, percussion, qaOf, timing, volumeHistogram,
} from './analyse.mjs'
import { atFullScale, fmtDb, peak, readWav, rmsDb, zeroCrossingRate } from './wav.mjs'

const out = []
const say = (line = '') => out.push(line)
const pad = (v, w) => String(v).padEnd(w)
const num = (v, w) => String(v).padStart(w)

function resolve(path) {
  return isAbsolute(path) ? path : join(REPO_ROOT, path)
}

function songSection(song) {
  const qa = qaOf(song)
  const t = timing(song, [])
  say(`${song.meta.name} — ${song.meta.author || 'no author'}`)
  say(
    `  ${song.order.length} frames x ${song.meta.rowsPerPattern} rows, speed ${song.meta.speed}, tempo ` +
      `${song.meta.tempo}, highlight ${song.meta.rowHighlight}/${song.meta.rowHighlight2} -> ` +
      `${t.bpm.toFixed(2)} BPM, ${t.rowsPerSecond.toFixed(3)} rows/s, ${t.secondsPerFrame.toFixed(3)} s/frame`,
  )
  say(`  key ${qa.key ?? '(undeclared)'}, loopFrame ${qa.loopFrame ?? '(none)'}, ${song.instruments.length} instruments, ${song.patterns.length} patterns`)
  say(`  declared channels: ${(qa.channels ?? []).join(' ') || '(none)'}`)
  say(`  declared effects:  ${(qa.effects ?? []).join(' ') || '(none)'}`)
}

function notesSection(song, all) {
  say()
  say('-- notes per lane ------------------------------------------------------------')
  say(`${pad('lane', 10)}${num('atk', 5)}${num('cut', 5)}${num('rel', 5)}  range`)
  for (const s of noteStats(song, all)) {
    const range = s.low === null ? '-' : `${noteName(s.low)}..${noteName(s.high)} (${s.low}..${s.high})`
    say(`${pad(s.channel, 10)}${num(s.attacks, 5)}${num(s.cuts, 5)}${num(s.releases, 5)}  ${range}`)
  }
  say()
  say('-- attacks per frame ---------------------------------------------------------')
  const qa = qaOf(song)
  const width = Math.max(6, ...song.order.map((_, f) => String((qa.form ?? [])[f] ?? f).length + 1))
  say(`${pad('frame', 7)}${pad('form', width)}${song.channels.map((c) => num(c.slice(0, 6), 7)).join('')}`)
  const stats = noteStats(song, all)
  song.order.forEach((_, f) => {
    say(
      `${pad(f, 7)}${pad((qa.form ?? [])[f] ?? '', width)}` +
        stats.map((s) => num(s.perFrame[f] === 0 ? '.' : s.perFrame[f], 7)).join(''),
    )
  })

  say()
  say('-- register per frame (MIDI low-high) -----------------------------------------')
  say(`${pad('frame', 7)}${pad('form', width)}${song.channels.map((c) => num(c.slice(0, 6), 9)).join('')}`)
  song.order.forEach((_, f) => {
    const spans = song.channels.map((_c, lane) => {
      const notes = all.filter((x) => x.lane === lane && x.frame === f && x.cell.note !== undefined && x.cell.note >= 0)
        .map((x) => x.cell.note)
      return num(notes.length === 0 ? '.' : `${Math.min(...notes)}-${Math.max(...notes)}`, 9)
    })
    say(`${pad(f, 7)}${pad((qa.form ?? [])[f] ?? '', width)}${spans.join('')}`)
  })
}

function effectsSection(song, all) {
  say()
  say('-- effects per lane ----------------------------------------------------------')
  for (const e of effectHistogram(song, all)) {
    const list = e.counts.map(([cmd, n]) => `${cmd}x${n}`).join(' ')
    say(`${pad(e.channel, 10)}${list || '.'}`)
  }
}

function volumeSection(song, all) {
  say()
  say('-- volume column -------------------------------------------------------------')
  say(`${pad('lane', 10)}${num('stated', 7)}${num('at 15', 7)}${num('%15', 6)}${num('distinct', 10)}  distribution`)
  for (const v of volumeHistogram(song, all)) {
    if (v.attacks === 0) continue
    const dist = v.counts.map(([vol, n]) => `${vol}:${n}`).join(' ')
    say(
      `${pad(v.channel, 10)}${num(v.stated, 7)}${num(v.full, 7)}${num((v.fullFraction * 100).toFixed(0), 6)}` +
        `${num(v.distinct, 10)}  ${dist}`,
    )
  }
}

function keySection(song, all) {
  const a = accidentals(song, all)
  say()
  say('-- key ------------------------------------------------------------------------')
  if (!a.known) {
    say(`  key ${JSON.stringify(a.key)} is not one this report knows (root-mode, mode in major minor dorian phrygian lydian mixolydian)`)
    return
  }
  const cap = qaOf(song).accidentalFractionMax ?? 0.12
  say(`  ${a.outside} of ${a.melodic} melodic notes outside ${a.key} = ${(a.fraction * 100).toFixed(2)}% (declared cap ${(cap * 100).toFixed(0)}%)`)
  for (const l of a.byLane) say(`    ${pad(l.channel, 10)}${num(l.outside, 5)} / ${l.notes}`)
}

function percussionSection(song, all) {
  const p = percussion(song, all)
  say()
  say('-- percussion ------------------------------------------------------------------')
  if (!p.present) {
    say('  no noise lane')
    return
  }
  say(
    `  ${p.events} noise events over ${p.totalRows} rows; longest gap ${p.longest} rows ` +
      `(declared bound ${p.declared}); coverage ${(p.coverage * 100).toFixed(2)}%`,
  )
}

function loopSection(song) {
  const rows = loopRow(song)
  say()
  say('-- loop row --------------------------------------------------------------------')
  if (rows === null) {
    say('  no loopFrame declared')
    return
  }
  for (const r of rows) {
    if (r.cell === null) {
      say(`  ${pad(r.channel, 10)}(nothing)`)
      continue
    }
    const bits = []
    if (r.cell.note !== undefined) bits.push(`note ${noteName(r.cell.note)}`)
    if (r.cell.inst !== undefined) bits.push(`inst ${r.cell.inst} (${song.instruments[r.cell.inst].name})`)
    if (r.cell.vol !== undefined) bits.push(`vol ${r.cell.vol}`)
    for (const e of r.cell.fx ?? []) if (e !== null) bits.push(`${e.cmd}${e.param}`)
    say(`  ${pad(r.channel, 10)}${bits.join(', ')}`)
  }
}

function wavSection(song, all, path) {
  const { samples, sampleRate } = readWav(resolve(path))
  const seconds = samples.length / sampleRate
  const t = timing(song, all)
  say()
  say('-- preview ---------------------------------------------------------------------')
  say(`  ${path}: ${seconds.toFixed(2)} s at ${sampleRate} Hz, ${samples.length} samples`)
  say(`  whole file: rms ${fmtDb(rmsDb(samples))} dBFS, peak ${peak(samples).toFixed(4)}, at/over full scale ${atFullScale(samples)} samples`)
  say()
  say(`${pad('window', 14)}${num('rms dB', 9)}${num('peak', 8)}${num('>=.999', 8)}`)
  const w = Math.round(sampleRate * 5)
  for (let a = 0; a < samples.length; a += w) {
    const b = Math.min(samples.length, a + w)
    say(
      `${pad(`${(a / sampleRate).toFixed(0)}-${(b / sampleRate).toFixed(0)}s`, 14)}` +
        `${num(fmtDb(rmsDb(samples, a, b)), 9)}${num(peak(samples, a, b).toFixed(3), 8)}${num(atFullScale(samples, a, b), 8)}`,
    )
  }

  say()
  if (t.dynamic) say('  (Fxx/Dxx present: the section map below assumes the nominal row rate and will drift)')
  say(`${pad('section', 16)}${pad('frames', 10)}${num('start', 8)}${num('sec', 7)}${num('rms dB', 9)}${num('zcr/s', 9)}`)
  const played = frameSequence(song, seconds, t.secondsPerFrame)
  let i = 0
  while (i < played.length) {
    let j = i
    while (j + 1 < played.length && played[j + 1].label === played[i].label && played[j + 1].frame === played[j].frame + 1) j++
    const start = played[i].start
    const end = j + 1 < played.length ? played[j + 1].start : seconds
    const a = Math.min(samples.length, Math.round(start * sampleRate))
    const b = Math.min(samples.length, Math.round(end * sampleRate))
    say(
      `${pad(played[i].label.slice(0, 15), 16)}${pad(`${played[i].frame}-${played[j].frame}`, 10)}` +
        `${num(start.toFixed(1), 8)}${num((end - start).toFixed(1), 7)}${num(fmtDb(rmsDb(samples, a, b)), 9)}` +
        `${num(zeroCrossingRate(samples, a, b, sampleRate).toFixed(0), 9)}`,
    )
    i = j + 1
  }
}

function main() {
  const [songPath, wavPath] = process.argv.slice(2)
  if (songPath === undefined) {
    process.stderr.write('usage: node tools/songs/compose/report.mjs <song.json> [preview.wav]\n')
    process.exit(2)
  }
  const song = JSON.parse(readFileSync(resolve(songPath), 'utf8'))
  const all = cells(song)
  songSection(song)
  notesSection(song, all)
  effectsSection(song, all)
  volumeSection(song, all)
  keySection(song, all)
  percussionSection(song, all)
  loopSection(song)
  if (wavPath !== undefined) wavSection(song, all, wavPath)
  process.stdout.write(`${out.join('\n')}\n`)
}

main()
