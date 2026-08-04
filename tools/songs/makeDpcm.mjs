#!/usr/bin/env node
/** the album's two DPCM samples, generated from arithmetic (preset-suite §3.5).
 *
 *  No recorded audio, ever. Both samples are computed here from a closed-form target
 *  waveform and 1-bit delta modulation, so they are MIT-shippable by construction and
 *  reproducible byte-for-byte on any machine. `tests/unit/presets.test.ts` runs this
 *  script and asserts the bank's base64 equals what it prints — the anti-drift pin that
 *  keeps "generated, not sampled" a fact rather than a claim.
 *
 *  Node ≥ 22, zero dependencies, deterministic, no seed input.
 *
 *      node tools/songs/makeDpcm.mjs           # human-readable report + paste block
 *      node tools/songs/makeDpcm.mjs --json    # machine-readable, for the pin test
 *
 *  Two facts about the DMC that shape everything below:
 *
 *  1. The DAC is a 7-bit level (0..127) and the 1-bit stream only ever moves it by ±2
 *     per output sample. The slew ceiling at rate index 12 is 2·16 885 = 33 769 units/s;
 *     a 110 Hz sine of amplitude 40 needs 2π·110·40 = 27 646 units/s, so the kick is
 *     trackable — barely, and on purpose. Anything louder or higher would slew-limit
 *     into a triangle wave.
 *  2. The level PERSISTS after the sample ends. A sample that finishes at level 60
 *     leaves the DMC holding 60, and the shared TND mixer index (3·tri + 2·noise + dmc)
 *     turns that into a permanent duck of the triangle and the noise. So both samples
 *     start AND end at the `delta` preload (8), which is what step 3's assert checks.
 *
 *  The doc writes the kick as `A(t)·sin(φ(t))`. What is emitted here is the same wave
 *  with its phase and DC offset chosen so it starts and ends exactly at the preload:
 *  `8 + A(t)·(1 − cos φ)` is `A·sin` shifted a quarter cycle and lifted to be unipolar,
 *  which costs nothing audibly (the mixer's DC blocker removes the offset) and buys the
 *  tail requirement above for free.
 */

import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const CPU_HZ = 1789773
/** $4010 rate index → CPU cycles per output bit. Index 12 = 106, index 15 = 54. */
const DMC_RATE_NTSC = [428, 380, 340, 320, 286, 254, 226, 214, 190, 160, 142, 128, 106, 84, 72, 54]
/** $4011 preload every album DPCM assignment writes before it triggers. */
const DELTA_PRELOAD = 8
/** How far the modulator's final level may sit from the preload (§3.5 step 3). */
const TAIL_TOLERANCE = 4

/** 1-bit delta modulation, LSB first, exactly as the DMC decodes it in reverse.
 *
 *  Per output bit: emit 1 when the target is above the current level (and step the
 *  level up 2), else 0 (and step it down 2). Clamped to the DAC's 0..127. */
function deltaModulate(target, preload) {
  const bits = target.length
  if (bits % 8 !== 0) throw new Error(`bit count ${bits} is not a whole number of bytes`)
  const bytes = new Uint8Array(bits / 8)
  let level = preload
  for (let i = 0; i < bits; i++) {
    if (target[i] > level) {
      bytes[i >> 3] |= 1 << (i & 7)
      level = Math.min(127, level + 2)
    } else {
      level = Math.max(0, level - 2)
    }
  }
  return { bytes, level }
}

/** kick — a pitched thump the noise channel structurally cannot make.
 *
 *  Amplitude decays 40 → 2 exponentially; instantaneous frequency sweeps 110 → 45 Hz,
 *  also exponentially, so the pitch falls at a constant musical rate. The last 64 bits
 *  taper the amplitude linearly to zero so the level lands back on the preload. */
function kickTarget(rateIndex, byteCount) {
  const bits = byteCount * 8
  const fs = CPU_HZ / DMC_RATE_NTSC[rateIndex]
  const target = new Float64Array(bits)
  const f0 = 110
  const f1 = 45
  const a0 = 40
  const a1 = 2
  const tail = 64
  let phase = 0
  for (let i = 0; i < bits; i++) {
    const u = i / (bits - 1)
    const f = f0 * Math.pow(f1 / f0, u)
    const fade = i >= bits - tail ? (bits - 1 - i) / tail : 1
    const a = a0 * Math.pow(a1 / a0, u) * fade
    target[i] = DELTA_PRELOAD + a * (1 - Math.cos(2 * Math.PI * phase))
    phase += f / fs
  }
  return target
}

/** snare — a deterministic LFSR burst under an exponential decay.
 *
 *  The same 15-bit polynomial the APU's noise channel uses (feedback = bit0 ^ bit1,
 *  shift right), seeded to 1, clocked once per output bit. The modulator's ±2 slew
 *  turns the full-scale random target into a rate-limited random walk, which is what
 *  gives the burst body instead of pure hiss. First 4 ms boosted for the crack; the
 *  last 48 bits taper to the preload for the same reason the kick does. */
function snareTarget(rateIndex, byteCount) {
  const bits = byteCount * 8
  const fs = CPU_HZ / DMC_RATE_NTSC[rateIndex]
  const target = new Float64Array(bits)
  const e0 = 45
  const floor = 0.02
  const boostBits = Math.round(0.004 * fs)
  const tail = 48
  let lfsr = 1
  for (let i = 0; i < bits; i++) {
    const feedback = (lfsr & 1) ^ ((lfsr >> 1) & 1)
    lfsr = (lfsr >> 1) | (feedback << 14)
    const u = i / (bits - 1)
    let e = e0 * Math.pow(floor, u)
    if (i < boostBits) e *= 1.35
    if (i >= bits - tail) e *= (bits - 1 - i) / tail
    target[i] = DELTA_PRELOAD + e * (lfsr & 1)
  }
  return target
}

/** The two samples, exactly as `preset-suite.md` §3.5 specifies them. */
export const SPEC = [
  { name: 'dpcm-kick', bytes: 257, rateIndex: 12, note: 36, build: kickTarget },
  { name: 'dpcm-snare', bytes: 145, rateIndex: 15, note: 39, build: snareTarget },
]

export function makeSamples() {
  return SPEC.map((s) => {
    if (s.bytes % 16 !== 1) {
      throw new Error(`${s.name}: ${s.bytes} bytes is not 16n+1 — the validator rejects it`)
    }
    const target = s.build(s.rateIndex, s.bytes)
    const { bytes, level } = deltaModulate(target, DELTA_PRELOAD)
    if (Math.abs(level - DELTA_PRELOAD) > TAIL_TOLERANCE) {
      throw new Error(
        `${s.name}: final DAC level ${level} is more than ${TAIL_TOLERANCE} from the ` +
          `preload ${DELTA_PRELOAD} — it would permanently duck the triangle and noise`,
      )
    }
    const cycles = DMC_RATE_NTSC[s.rateIndex]
    const rateHz = CPU_HZ / cycles
    return {
      name: s.name,
      data: Buffer.from(bytes).toString('base64'),
      byteLength: bytes.length,
      rateIndex: s.rateIndex,
      rateCycles: cycles,
      rateHz,
      durationMs: (bytes.length * 8 * 1000) / rateHz,
      note: s.note,
      delta: DELTA_PRELOAD,
      finalLevel: level,
      /** $4013 units, the value `buildDpcmImage` derives: floor((len − 1) / 16). */
      lengthUnits: Math.floor((bytes.length - 1) / 16),
    }
  })
}

function main() {
  const samples = makeSamples()
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(samples, null, 2)}\n`)
    return
  }
  const lines = ['name         bytes  rate  Hz        ms      final DAC  $4013']
  for (const s of samples) {
    lines.push(
      `${s.name.padEnd(12)} ${String(s.byteLength).padStart(5)}  ${String(s.rateIndex).padStart(4)}  ` +
        `${s.rateHz.toFixed(1).padStart(8)}  ${s.durationMs.toFixed(1).padStart(5)}   ` +
        `${String(s.finalLevel).padStart(9)}  ${String(s.lengthUnits).padStart(5)}`,
    )
  }
  const total = samples.reduce((n, s) => n + s.byteLength, 0)
  const b64 = samples.reduce((n, s) => n + s.data.length, 0)
  lines.push('')
  lines.push(`${total} bytes decoded, ${b64} base64 characters — the whole album's sample budget.`)
  lines.push('')
  lines.push('paste into a song\'s "samples" (and keep the order — the dpcm map indexes it):')
  lines.push(
    JSON.stringify(
      samples.map((s) => ({ name: s.name, data: s.data })),
      null,
      2,
    ),
  )
  lines.push('')
  lines.push('the matching `dpcm-kit` key map:')
  lines.push(
    JSON.stringify(
      Object.fromEntries(
        samples.map((s, i) => [
          String(s.note),
          { sample: i, pitch: s.rateIndex, loop: false, delta: s.delta },
        ]),
      ),
      null,
      2,
    ),
  )
  process.stdout.write(`${lines.join('\n')}\n`)
}

/** Was this file run, rather than imported?
 *
 *  Comparing `import.meta.url` against "file://" + `process.argv[1]` is a string test
 *  against something that is not a URL, and it is false for two everyday paths: one containing
 *  a character a URL must percent-encode (a space — "My Project", "Google Drive"), and
 *  one reached through a symlink (`/tmp` and `/var` on macOS both are). Either way the
 *  script prints NOTHING and exits 0, which looks exactly like success. `import.meta.url`
 *  is built by node from the resolved real path, so both sides are normalised here. */
function invokedDirectly() {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (invokedDirectly()) main()
