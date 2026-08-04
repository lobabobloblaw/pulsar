/** Hand-written spectral analysis for the test suite. Deliberately dependency-free:
 *  the project ships zero runtime dependencies besides Svelte, and an FFT is 60 lines.
 *
 *  Radix-2 decimation-in-time FFT, a 4-term Blackman–Harris window (−92 dB sidelobes,
 *  which is what makes a −70 dBc measurement meaningful), and a Goertzel evaluator for
 *  single-bin probes.
 */

/** In-place complex FFT. `re.length` must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < half; j++) {
        const ur = re[i + j]
        const ui = im[i + j]
        const xr = re[i + j + half]
        const xi = im[i + j + half]
        const vr = xr * cr - xi * ci
        const vi = xr * ci + xi * cr
        re[i + j] = ur + vr
        im[i + j] = ui + vi
        re[i + j + half] = ur - vr
        im[i + j + half] = ui - vi
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/** 4-term Blackman–Harris: −92 dB peak sidelobe, 8-bin main lobe. */
export function blackmanHarris(size: number): Float64Array {
  const a0 = 0.35875
  const a1 = 0.48829
  const a2 = 0.14128
  const a3 = 0.01168
  const w = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    const p = (2 * Math.PI * i) / (size - 1)
    w[i] = a0 - a1 * Math.cos(p) + a2 * Math.cos(2 * p) - a3 * Math.cos(3 * p)
  }
  return w
}

/** Windowed magnitude spectrum of `size` samples starting at `offset`. */
export function magnitudeSpectrum(
  signal: ArrayLike<number>,
  offset: number,
  size: number,
): Float64Array {
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  const win = blackmanHarris(size)
  for (let i = 0; i < size; i++) re[i] = signal[offset + i] * win[i]
  fftInPlace(re, im)
  const mag = new Float64Array(size >> 1)
  for (let i = 0; i < mag.length; i++) mag[i] = Math.hypot(re[i], im[i])
  return mag
}

export function binForHz(hz: number, sampleRate: number, size: number): number {
  return (hz * size) / sampleRate
}

export function hzForBin(bin: number, sampleRate: number, size: number): number {
  return (bin * sampleRate) / size
}

/** Largest magnitude within ±halfBins of `hz` — a spectral component's peak does not
 *  land exactly on a bin unless the frequency is bin-aligned. */
export function peakMagnitudeNear(
  mag: Float64Array,
  sampleRate: number,
  size: number,
  hz: number,
  halfBins = 24,
): number {
  const centre = Math.round(binForHz(hz, sampleRate, size))
  const lo = Math.max(0, centre - halfBins)
  const hi = Math.min(mag.length - 1, centre + halfBins)
  let peak = 0
  for (let i = lo; i <= hi; i++) if (mag[i] > peak) peak = mag[i]
  return peak
}

/** Interpolated peak frequency: parabolic fit through the log-magnitudes either side
 *  of the largest bin in [loHz, hiHz]. Accurate to ~0.02 cents on a windowed tone. */
export function peakHzParabolic(
  mag: Float64Array,
  sampleRate: number,
  size: number,
  loHz = 0,
  hiHz = sampleRate / 2,
): number {
  const lo = Math.max(1, Math.floor(binForHz(loHz, sampleRate, size)))
  const hi = Math.min(mag.length - 2, Math.ceil(binForHz(hiHz, sampleRate, size)))
  let best = lo
  let bestMag = 0
  for (let i = lo; i <= hi; i++) {
    if (mag[i] > bestMag) {
      bestMag = mag[i]
      best = i
    }
  }
  const y1 = Math.log(mag[best - 1])
  const y2 = Math.log(mag[best])
  const y3 = Math.log(mag[best + 1])
  const denom = y1 - 2 * y2 + y3
  const delta = denom === 0 ? 0 : (0.5 * (y1 - y3)) / denom
  return hzForBin(best + delta, sampleRate, size)
}

/** Single-bin magnitude by the Goertzel algorithm — no FFT, no power-of-two
 *  constraint, and the cheap way to probe one known frequency. */
export function goertzel(
  signal: ArrayLike<number>,
  sampleRate: number,
  targetHz: number,
  offset: number,
  size: number,
): number {
  const k = (2 * Math.PI * targetHz) / sampleRate
  const coeff = 2 * Math.cos(k)
  const win = blackmanHarris(size)
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < size; i++) {
    const s0 = signal[offset + i] * win[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2)
}

/** Level relative to a carrier, in dB. */
export function dBc(value: number, carrier: number): number {
  if (carrier <= 0) return Number.NEGATIVE_INFINITY
  if (value <= 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(value / carrier)
}
