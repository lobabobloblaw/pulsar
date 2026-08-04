/** Minimal PCM16 mono WAV encoder (preset-suite §7.2).
 *
 *  This lives in `src/`, not in `tests/`, for the same reason `offlineRender.ts` does:
 *  **phase 3's WAV export is this function** plus a `Blob` and a download link. Putting
 *  it under `tests/` would guarantee it gets rewritten, and then there would be two
 *  encoders that disagree about a header.
 *
 *  DOM-free, dependency-free, allocation is one `Uint8Array`. No dithering, no
 *  normalisation, no gain: `round(clamp(x, −1, 1) · 32767)` and nothing else, because
 *  the preview is supposed to be the mix. If it is quiet, the arrangement is quiet.
 *
 *  The header is the canonical 44-byte RIFF/WAVE:
 *
 *      0  "RIFF"      4  36 + dataBytes     8  "WAVE"
 *     12  "fmt "     16  16 (PCM chunk)    20  1 (PCM)   22  channels
 *     24  sampleRate 28  byteRate          32  blockAlign  34  bitsPerSample
 *     36  "data"     40  dataBytes         44  samples, little-endian
 */

const HEADER_BYTES = 44
const BITS_PER_SAMPLE = 16
const CHANNELS = 1

/** Mono PCM16 WAV bytes for `samples`, ready to write to disk or wrap in a `Blob`. */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new RangeError(`sampleRate ${sampleRate} is not a positive number`)
  }
  const rate = Math.round(sampleRate)
  const bytesPerSample = BITS_PER_SAMPLE / 8
  const blockAlign = CHANNELS * bytesPerSample
  const dataBytes = samples.length * bytesPerSample
  const out = new Uint8Array(HEADER_BYTES + dataBytes)
  const view = new DataView(out.buffer)

  ascii(out, 0, 'RIFF')
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true)
  ascii(out, 8, 'WAVE')
  ascii(out, 12, 'fmt ')
  view.setUint32(16, 16, true) // PCM fmt chunk size
  view.setUint16(20, 1, true) // format 1 = PCM integer
  view.setUint16(22, CHANNELS, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * blockAlign, true) // byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, BITS_PER_SAMPLE, true)
  ascii(out, 36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < samples.length; i++) {
    const x = samples[i]
    // NaN would encode as 0 through `Math.round`, but say so explicitly: a silent
    // sample is a better failure than a full-scale one.
    const clamped = Number.isNaN(x) ? 0 : x < -1 ? -1 : x > 1 ? 1 : x
    view.setInt16(HEADER_BYTES + i * bytesPerSample, Math.round(clamped * 32767), true)
  }
  return out
}

function ascii(out: Uint8Array, at: number, text: string): void {
  for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i)
}
