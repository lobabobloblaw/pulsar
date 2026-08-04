/** WAV previews — the part of the pipeline that is for the user's ears (preset-suite §7.2).
 *
 *  The gates prove the songs are CORRECT. Only the user can say they are GOOD, so every
 *  registered song renders to a listenable file:
 *
 *      pnpm preview:songs      ->  previews/<id>.wav  +  a level table on stdout
 *
 *  Inert in the default `pnpm test` run. The file matches `tests/**\/*.test.ts` and is
 *  collected, but `describe.skipIf` keeps it from doing anything without `PULSAR_PREVIEW=1`
 *  — which is what keeps ~30 s of rendering and a directory of build artifacts out of CI
 *  without a second vitest config.
 *
 *  NO NORMALISATION, NO LIMITING, NO EXTRA GAIN. The preview is the mix. If it is quiet,
 *  the arrangement is quiet, and that is information the user needs rather than something
 *  to hide behind a fader.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { parseSong } from '../../src/tracker/model/validate'
import { renderSong, rmsDb } from '../../src/tracker/offlineRender'
import { encodeWavPcm16 } from '../../src/tracker/wav'

const ROOT = join(import.meta.dirname, '..', '..')
const SONG_DIR = join(ROOT, 'src', 'assets', 'songs')
const OUT_DIR = join(ROOT, 'previews')
const SAMPLE_RATE = 48000
const LOOPS = 2

const enabled = process.env.PULSAR_PREVIEW === '1'

function songs(): { id: string; raw: unknown }[] {
  return readdirSync(SONG_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({
      id: f.replace(/\.json$/, '').replace(/^\d{2}-/, ''),
      raw: JSON.parse(readFileSync(join(SONG_DIR, f), 'utf8')) as unknown,
    }))
}

describe.skipIf(!enabled)('song previews', () => {
  const list = songs()
  mkdirSync(OUT_DIR, { recursive: true })

  const table: string[] = [
    'id                      dur      rms      peak   clip  checksum',
  ]

  it.each(list)('renders $id to previews/$id.wav', ({ id, raw }) => {
    const { song } = parseSong(raw)
    const r = renderSong(song, { sampleRate: SAMPLE_RATE, loops: LOOPS, maxSeconds: 600 })
    const wav = encodeWavPcm16(r.samples, r.sampleRate)
    writeFileSync(join(OUT_DIR, `${id}.wav`), wav)

    let peak = 0
    for (let i = 0; i < r.samples.length; i++) peak = Math.max(peak, Math.abs(r.samples[i]))
    const seconds = r.samples.length / r.sampleRate
    table.push(
      `${id.padEnd(22)} ${seconds.toFixed(1).padStart(6)}s ${rmsDb(r.samples).toFixed(2).padStart(7)}` +
        ` ${peak.toFixed(3).padStart(7)} ${String(r.clippedSamples).padStart(5)}  ${r.checksum}`,
    )

    // A preview that is not a playable file is worse than no preview: check the header
    // this encoder just wrote, in the file's own units.
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...wav.subarray(8, 12))).toBe('WAVE')
    expect(view.getUint16(20, true), 'format 1 = PCM integer').toBe(1)
    expect(view.getUint16(22, true), 'mono').toBe(1)
    expect(view.getUint32(24, true), 'sample rate').toBe(SAMPLE_RATE)
    expect(view.getUint16(34, true), 'bits per sample').toBe(16)
    expect(view.getUint32(40, true), 'data chunk size').toBe(wav.length - 44)
    expect(view.getUint32(4, true), 'RIFF size').toBe(wav.length - 8)
    expect(seconds).toBeGreaterThan(30)
  })

  it('prints the level table', () => {
    process.stdout.write(`\n${table.join('\n')}\n\nwrote ${list.length} file(s) to previews/\n\n`)
    expect(list.length).toBeGreaterThan(0)
  })
})

describe('the WAV encoder itself', () => {
  it('writes a canonical 44-byte header and clamps to int16', () => {
    const wav = encodeWavPcm16(Float32Array.of(0, 1, -1, 2, -2, 0.5), 44100)
    expect(wav.length).toBe(44 + 6 * 2)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true), 'byte rate = rate x blockAlign').toBe(44100 * 2)
    expect(view.getUint16(32, true), 'block align').toBe(2)
    expect(view.getInt16(44 + 0, true)).toBe(0)
    expect(view.getInt16(44 + 2, true)).toBe(32767)
    expect(view.getInt16(44 + 4, true)).toBe(-32767)
    expect(view.getInt16(44 + 6, true), 'over-range clamps, never wraps').toBe(32767)
    expect(view.getInt16(44 + 8, true)).toBe(-32767)
    expect(view.getInt16(44 + 10, true)).toBe(Math.round(0.5 * 32767))
  })

  it('produces an empty but valid file for an empty buffer', () => {
    const wav = encodeWavPcm16(new Float32Array(0), 48000)
    expect(wav.length).toBe(44)
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)
    expect(view.getUint32(40, true)).toBe(0)
  })
})
