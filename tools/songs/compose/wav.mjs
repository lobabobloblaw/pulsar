/** just enough RIFF to read a preview back: PCM16 mono, the shape `encodeWavPcm16`
 *  writes and `pnpm preview:songs` leaves in `previews/`.
 *
 *  The preview is the mix — no normalisation, no limiting, no extra gain — so every
 *  number taken off it is a number about the arrangement. int16 has already clamped,
 *  which is why the peak count below is called an ESTIMATE: it counts samples that came
 *  back at or past full scale, not the excursion that was thrown away.
 */
import { readFileSync } from 'node:fs'

const FULL_SCALE = 32767

export function readWav(path) {
  const buf = readFileSync(path)
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`)
  }
  let format = null
  let data = null
  let at = 12
  while (at + 8 <= buf.length) {
    const id = buf.toString('latin1', at, at + 4)
    const size = buf.readUInt32LE(at + 4)
    const body = at + 8
    if (id === 'fmt ') {
      format = {
        code: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(buf.length, body + size))
    }
    at = body + size + (size % 2)
  }
  if (format === null || data === null) throw new Error(`${path}: missing fmt or data chunk`)
  if (format.code !== 1 || format.channels !== 1 || format.bits !== 16) {
    throw new Error(`${path}: expected PCM16 mono, got code ${format.code}, ${format.channels} ch, ${format.bits} bit`)
  }
  const samples = new Float32Array(Math.floor(data.length / 2))
  for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2) / FULL_SCALE
  return { samples, sampleRate: format.sampleRate }
}

export function rmsDb(samples, from = 0, to = samples.length) {
  let sum = 0
  const count = Math.max(0, to - from)
  if (count === 0) return -Infinity
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / count)
  return rms === 0 ? -Infinity : 20 * Math.log10(rms)
}

export function peak(samples, from = 0, to = samples.length) {
  let max = 0
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(samples[i]))
  return max
}

/** Samples that came back at or past full scale. Not a clip count — a clip already
 *  happened somewhere upstream — but the only evidence a PCM16 file still carries. */
export function atFullScale(samples, from = 0, to = samples.length, threshold = 0.999) {
  let count = 0
  for (let i = from; i < to; i++) if (Math.abs(samples[i]) >= threshold) count++
  return count
}

/** Zero crossings per second: a crude brightness proxy. A saw bass under a 50 % pulse
 *  crosses far less often than a hat pattern, and that is all this measures. */
export function zeroCrossingRate(samples, from, to, sampleRate) {
  let crossings = 0
  for (let i = from + 1; i < to; i++) if ((samples[i - 1] < 0) !== (samples[i] < 0)) crossings++
  const seconds = (to - from) / sampleRate
  return seconds > 0 ? crossings / seconds : 0
}

export function fmtDb(db) {
  return Number.isFinite(db) ? db.toFixed(2) : '-inf'
}
