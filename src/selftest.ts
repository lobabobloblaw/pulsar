// Headless gate harness: measures what a listener would hear, without ears.
// Run with ?selftest in the URL under `--autoplay-policy=no-user-gesture-required`.
//
// The M2 gate this proves end to end: a canonical pulse note-on, scheduled on the
// cycle timeline and delivered through the real write transport, comes back out of
// the AudioContext at the pitch an NTSC 2A03 would produce for timer t = 253 —
// 440.3969 Hz, i.e. +1.561 cents sharp of concert A, which is hardware resolution and
// not something to "fix".
//
// M3 adds the transport line: whichever path is live is named in the output, and the
// counters behind it are read back through `engine.diagnostics()`. Run the page
// without COOP/COEP and the same test must still pass, with `transport=postMessage`.
//
// Output contract (the lead's headless CDP harness greps these): the details blob
// always ends in `SELFTEST PASS` or `SELFTEST FAIL`, and App.svelte maps that onto
// `document.title = 'pulsar-selftest-pass' | 'pulsar-selftest-fail'`.
import { startEngine } from './audio/host/audioEngine'
import { LiveScheduler } from './audio/host/liveScheduler'
import { formatDiagnostics } from './audio/host/diagnostics'
import { centsBetween, peakAmplitude, zeroCrossingHz } from './audio/dsp/toneMeasure'
import { midiToHz, pulseHzForTimer, pulseTimerForHz } from './audio/host/pitch'

export interface SelfTestResult {
  pass: boolean
  details: string
}

/** Duty 2 (50 %), full constant volume — the canonical note-on of plan B6. */
const SELFTEST_DUTY = 2
const SELFTEST_VOLUME = 15
/** Cents of error allowed on the live readout. The offline dual-method assertion in
 *  tests/unit/pitch.test.ts holds the same 3-cent budget. */
const CENTS_TOLERANCE = 3
const SETTLE_MS = 800
const READY_TIMEOUT_MS = 2000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function runSelfTest(expectedHz = 440): Promise<SelfTestResult> {
  const lines: string[] = []
  const iso = crossOriginIsolated
  const sab = typeof SharedArrayBuffer === 'function'
  lines.push(`crossOriginIsolated=${String(iso)}`)
  lines.push(`sab=${String(sab)}`)
  // The overall verdict still requires isolation — the served app sets COOP/COEP and
  // a regression there must be loud. The separate `audio=` line below is what the M3
  // resilience check reads: strip the headers and audio must still be ok, on the
  // postMessage path, even though the run as a whole reports FAIL.
  let pass = iso && sab

  try {
    const engine = await startEngine()
    // The transport is a runtime fact, not a hope: an isolated page must land on the
    // ring, and a non-isolated one must still play through postMessage.
    lines.push(`transport=${engine.transport}`)
    const transportExpected = engine.transport === (iso && sab ? 'sab' : 'postMessage')
    pass = pass && transportExpected
    lines.push(`contextState=${engine.ctx.state}`)
    lines.push(`sampleRate=${engine.ctx.sampleRate}`)

    const analyser = engine.ctx.createAnalyser()
    analyser.fftSize = 16384
    engine.node.connect(analyser)

    // The worklet publishes the clock anchor from its first render quantum; nothing
    // can be placed on the timeline before that.
    const anchor = await Promise.race([engine.ready(), sleep(READY_TIMEOUT_MS).then(() => null)])
    lines.push(`clockAnchor=${anchor === null ? 'TIMEOUT' : `startFrame=${anchor.startFrame}`}`)
    if (anchor !== null) lines.push(`factor=${anchor.factor}`)
    pass = pass && anchor !== null

    const timer = pulseTimerForHz(expectedHz, engine.clockRate)
    const targetHz = pulseHzForTimer(timer, engine.clockRate)
    lines.push(`timer=${timer}`)
    lines.push(`targetHz=${targetHz.toFixed(4)}`)
    lines.push(`targetCents=${centsBetween(targetHz, expectedHz).toFixed(3)}`)

    // Through the real M3 producer: the scheduler picks the cycle, emits the
    // canonical five-write sequence and flushes the burst.
    const scheduler = new LiveScheduler(engine, {
      duty: SELFTEST_DUTY,
      volume: SELFTEST_VOLUME,
    })
    const note = Math.round(69 + 12 * Math.log2(expectedHz / midiToHz(69)))
    lines.push(`lead=${scheduler.leadMs.toFixed(1)}ms`)
    scheduler.noteOn(note, 127)
    lines.push(`note=${note}`)
    lines.push(`scheduledCycle=${scheduler.lastScheduledCycle}`)

    await sleep(SETTLE_MS)

    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)

    const peak = peakAmplitude(buf)
    const hz = zeroCrossingHz(buf, engine.ctx.sampleRate)
    const cents = hz > 0 ? centsBetween(hz, targetHz) : NaN

    lines.push(`peak=${peak.toFixed(3)}`)
    lines.push(`hz=${hz.toFixed(3)}`)
    lines.push(`cents=${Number.isNaN(cents) ? 'n/a' : cents.toFixed(3)}`)

    const toneOk =
      engine.ctx.state === 'running' && peak > 0.05 && hz > 0 && Math.abs(cents) < CENTS_TOLERANCE
    lines.push(`tone=${toneOk ? 'ok' : 'FAIL'}`)
    pass = pass && toneOk

    // Whatever the transport, the counters read back the same way.
    const diag = engine.diagnostics()
    lines.push(formatDiagnostics(diag))
    const transportOk = diag.droppedWrites === 0 && diag.underruns === 0
    lines.push(`transportClean=${transportOk ? 'ok' : 'FAIL'}`)
    pass = pass && transportOk

    // Isolation-independent: did the instrument actually work, on whichever path?
    const audioOk = toneOk && transportOk && transportExpected && anchor !== null
    lines.push(`audio=${audioOk ? 'ok' : 'FAIL'}`)

    // Note-off is an authentic hard cut; the high-passes absorb the step.
    scheduler.allNotesOff()
    await engine.dispose()
  } catch (e) {
    lines.push(`error=${e instanceof Error ? e.message : String(e)}`)
    pass = false
  }

  lines.push(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL')
  return { pass, details: lines.join('\n') }
}
