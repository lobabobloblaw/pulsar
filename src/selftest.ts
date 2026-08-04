// Headless gate harness: measures what a listener would hear, without ears.
// Run with ?selftest in the URL under `--autoplay-policy=no-user-gesture-required`.
import { startEngine } from './audio/host/audioEngine'

export interface SelfTestResult {
  pass: boolean
  details: string
}

export async function runSelfTest(expectedHz = 440): Promise<SelfTestResult> {
  const lines: string[] = []
  const iso = crossOriginIsolated
  const sab = typeof SharedArrayBuffer === 'function'
  lines.push(`crossOriginIsolated=${String(iso)}`)
  lines.push(`sab=${String(sab)}`)
  let pass = iso && sab

  try {
    const engine = await startEngine()
    lines.push(`contextState=${engine.ctx.state}`)
    lines.push(`sampleRate=${engine.ctx.sampleRate}`)

    const analyser = engine.ctx.createAnalyser()
    analyser.fftSize = 4096
    engine.node.connect(analyser)
    await new Promise((r) => setTimeout(r, 600))

    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)

    let peak = 0
    for (let i = 0; i < buf.length; i++) {
      const a = Math.abs(buf[i])
      if (a > peak) peak = a
    }

    let crossings = 0
    let first = -1
    let last = -1
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] < 0 && buf[i] >= 0) {
        crossings++
        if (first < 0) first = i
        last = i
      }
    }
    const hz =
      crossings > 1 && last > first
        ? ((crossings - 1) * engine.ctx.sampleRate) / (last - first)
        : 0

    lines.push(`peak=${peak.toFixed(3)}`)
    lines.push(`hz=${hz.toFixed(1)}`)

    const toneOk =
      engine.ctx.state === 'running' && peak > 0.05 && Math.abs(hz - expectedHz) < 5
    lines.push(`tone=${toneOk ? 'ok' : 'FAIL'}`)
    pass = pass && toneOk

    await engine.dispose()
  } catch (e) {
    lines.push(`error=${e instanceof Error ? e.message : String(e)}`)
    pass = false
  }

  lines.push(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL')
  return { pass, details: lines.join('\n') }
}
