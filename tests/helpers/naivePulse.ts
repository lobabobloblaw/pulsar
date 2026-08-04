/** The control renderer — deliberately WRONG, and the reason aliasing.test.ts is not
 *  vacuous.
 *
 *  It point-samples the duty sequencer once per output sample instead of inserting a
 *  band-limited step at each edge, which is exactly what a naive "just evaluate the
 *  waveform at the sample rate" engine does. Everything downstream is identical to the
 *  real engine — same mixer LUT, same analog chain, same master gain, same clamp — so
 *  when the same assertions are applied to both, the only variable is band-limited
 *  synthesis.
 *
 *  Expected result at duty 2 / t = 8 / 48 kHz: images at −9.8 dBc and −14.4 dBc,
 *  versus −127.5 dBc and −118.8 dBc for the real path.
 */
import { DEFAULT_MASTER_GAIN, NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { AnalogFilterChain, type FilterModel } from '../../src/audio/core/filters'
import { mixLut } from '../../src/audio/core/mixer'
import { DUTY_OUTPUT } from '../../src/audio/core/tables'

export interface NaivePulseOptions {
  timer: number
  duty: number
  volume: number
  sampleRate: number
  durationSamples: number
  clockRate?: number
  filterModel?: FilterModel
  masterGain?: number
}

export function renderNaivePulse(opts: NaivePulseOptions): Float32Array {
  const clockRate = opts.clockRate ?? NTSC_CPU_HZ
  const gain = opts.masterGain ?? DEFAULT_MASTER_GAIN
  const filters = new AnalogFilterChain()
  filters.setRates(opts.sampleRate, opts.filterModel ?? 'nes')

  const out = new Float32Array(opts.durationSamples)
  const periodCycles = 2 * (opts.timer + 1)
  const cyclesPerSample = clockRate / opts.sampleRate
  const dutyBase = (opts.duty & 3) * 8

  for (let i = 0; i < out.length; i++) {
    const cycle = i * cyclesPerSample
    const step = Math.floor(cycle / periodCycles) % 8
    const level = DUTY_OUTPUT[dutyBase + step] * opts.volume
    let y = filters.process(mixLut(level, 0, 0, 0, 0)) * gain
    if (y > 1) y = 1
    else if (y < -1) y = -1
    out[i] = y
  }
  return out
}
