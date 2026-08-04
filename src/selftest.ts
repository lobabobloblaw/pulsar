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
import { NTSC_CPU_HZ } from './audio/core/constants'
import { startEngine } from './audio/host/audioEngine'
import { LiveScheduler } from './audio/host/liveScheduler'
import { formatDiagnostics } from './audio/host/diagnostics'
import { centsBetween, peakAmplitude, zeroCrossingHz } from './audio/dsp/toneMeasure'
import { midiToHz, pulseHzForTimer, pulseTimerForHz, triangleTimerForHz } from './audio/host/pitch'

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
  // M8 soak: `?selftest&soak=<minutes>` switches to the long-run harness. Living
  // here (not in App) keeps the UI tree untouched and the title contract single.
  const soakMinutes = Number(new URLSearchParams(location.search).get('soak') ?? '0')
  if (soakMinutes > 0) return runSoakTest(soakMinutes)

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

// ─── M8 soak harness ────────────────────────────────────────────────────────────
//
// Drives all four tone channels RAW through the WriteSink — the same producer shape
// the Phase-2 tracker will be — on a 200 ms step pattern: pulse-1 melody, pulse-2
// fifth, triangle bass, auto-cut noise hats, a $4011 DMC-level ramp (exercises
// ducking), and a console-model flip every 32 steps. Diagnostics are sampled every
// 5 s (fields copied — `diagnostics()` reuses its object). Acceptance (plan M8 c):
// zero underruns, zero dropped writes over the whole run; `peakProcessUs` is gated
// only when the worklet's clock probe actually reports (headless AudioWorklet scopes
// lack `performance`, and a vacuously-passing gate is worse than none).

const SOAK_STEP_MS = 200
const SOAK_MELODY = [57, 60, 64, 67, 72, 67, 64, 60] // a-minor arpeggio, MIDI
const SOAK_DIAG_EVERY_MS = 5_000
const PEAK_BUDGET_US = 267

/** M-Phase2 soak: `?selftest&soak=N&song=<preset id>` plays a real preset through
 *  the real TrackerDriver over a bare engine for N minutes — the sustained-playback
 *  claim, measured (counters clean, position advancing, seam crossings). */
async function runSongSoak(minutes: number, songId: string): Promise<SelfTestResult> {
  const lines: string[] = []
  lines.push(`songSoak=${songId} ${minutes}min`)
  let pass = true
  try {
    const [{ presetById }, { parseSong }, { TrackerDriver }, { msToCycles }] = await Promise.all([
      import('./assets/songs/index'),
      import('./tracker/model/validate'),
      import('./tracker/driver/trackerDriver'),
      import('./audio/timeline/clockMap'),
    ])
    const entry = presetById(songId)
    if (entry === undefined) throw new Error(`unknown preset ${songId}`)
    const parsed = parseSong(entry.song)
    lines.push(`diagnostics=${parsed.diagnostics.length}`)

    const engine = await startEngine()
    lines.push(`transport=${engine.transport}`)
    const anchor = await Promise.race([engine.ready(), sleep(READY_TIMEOUT_MS).then(() => null)])
    if (anchor === null) throw new Error('clock anchor timeout')

    const driver = new TrackerDriver(engine, engine)
    driver.loadSong(parsed.song)
    driver.play('song')
    const lookahead = msToCycles(engine.clockRate, 120)

    const endAt = performance.now() + minutes * 60_000
    let lastOrder = -1
    let orderAdvances = 0
    let loops = 0
    while (performance.now() < endAt) {
      driver.runTo(engine.nowCycle() + lookahead)
      engine.flush()
      await sleep(20)
      const pos = driver.position
      if (pos.orderIndex !== lastOrder) {
        if (pos.orderIndex < lastOrder) loops++
        lastOrder = pos.orderIndex
        orderAdvances++
      }
    }
    driver.stop()
    engine.flush()
    await sleep(200)

    const d = engine.diagnostics()
    lines.push(`orderAdvances=${orderAdvances} loops=${loops} lastOrder=${lastOrder}`)
    lines.push(formatDiagnostics(d))
    const countersOk = d.droppedWrites === 0 && d.underruns === 0
    const playedOk = orderAdvances > 2
    lines.push(`counters=${countersOk ? 'ok' : 'FAIL'}`)
    lines.push(`advanced=${playedOk ? 'ok' : 'FAIL'}`)
    pass = countersOk && playedOk
    await engine.dispose()
  } catch (e) {
    lines.push(`error=${e instanceof Error ? e.message : String(e)}`)
    pass = false
  }
  lines.push(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL')
  return { pass, details: lines.join('\n') }
}

async function runSoakTest(minutes: number): Promise<SelfTestResult> {
  const songId = new URLSearchParams(location.search).get('song')
  if (songId !== null && songId !== '') return runSongSoak(minutes, songId)
  const lines: string[] = []
  lines.push(`soak=${minutes}min`)
  lines.push(`crossOriginIsolated=${String(crossOriginIsolated)}`)
  let pass = true

  try {
    const engine = await startEngine()
    lines.push(`transport=${engine.transport}`)
    lines.push(`sampleRate=${engine.ctx.sampleRate}`)
    const anchor = await Promise.race([engine.ready(), sleep(READY_TIMEOUT_MS).then(() => null)])
    if (anchor === null) throw new Error('clock anchor timeout')

    const endAt = performance.now() + minutes * 60_000
    let nextDiagAt = performance.now() + SOAK_DIAG_EVERY_MS
    let step = 0
    let maxPeakUs = 0
    let lastLate = 0
    let famicom = false

    while (performance.now() < endAt) {
      const c = engine.scheduleCycle()
      const melody = SOAK_MELODY[step % SOAK_MELODY.length] ?? 60
      const p1 = pulseTimerForHz(midiToHz(melody), engine.clockRate)
      const p2 = pulseTimerForHz(midiToHz(melody - 7), engine.clockRate)
      // triangleTimerForHz, not pulse: the triangle divides by 32 (finding #8 —
      // the pulse helper put it an octave low at HALF the intended event rate).
      const tri = triangleTimerForHz(midiToHz(melody - 24), engine.clockRate)

      engine.write(c, 0x4015, 0x0f)
      // pulse 1 — melody, duty 2, constant volume 12, halted length
      engine.write(c, 0x4000, 0xb0 | 12)
      engine.write(c, 0x4001, 0x08)
      engine.write(c, 0x4002, p1 & 0xff)
      engine.write(c, 0x4003, (p1 >> 8) & 0x07)
      // pulse 2 — a fifth below, duty 1, quieter
      engine.write(c, 0x4004, 0x70 | 8)
      engine.write(c, 0x4005, 0x08)
      engine.write(c, 0x4006, p2 & 0xff)
      engine.write(c, 0x4007, (p2 >> 8) & 0x07)
      // triangle — bass, control set (sustains through the linear counter)
      engine.write(c, 0x4008, 0xff)
      engine.write(c, 0x400a, tri & 0xff)
      engine.write(c, 0x400b, (tri >> 8) & 0x07)
      // noise — un-halted hat that the length counter cuts by itself
      engine.write(c, 0x400c, 0x10 | 6)
      engine.write(c, 0x400e, 0x04)
      engine.write(c, 0x400f, 0x18) // length index 3 → 2 half-frames ≈ 17 ms hat
      // dmc level ramp every 4th step — moves the tnd index, exercises ducking
      if (step % 4 === 0) engine.write(c, 0x4011, (step % 16) * 8)
      if (step % 32 === 31) {
        famicom = !famicom
        engine.setConfig({ consoleModel: famicom ? 'famicom' : 'nes' })
      }
      engine.flush()

      await sleep(SOAK_STEP_MS)
      step++

      if (performance.now() >= nextDiagAt) {
        nextDiagAt += SOAK_DIAG_EVERY_MS
        const d = engine.diagnostics()
        if (d.peakProcessUs > maxPeakUs) maxPeakUs = d.peakProcessUs
        lastLate = d.lateWrites
        if (d.droppedWrites !== 0 || d.underruns !== 0) {
          lines.push(
            `t=${Math.round((performance.now() - (endAt - minutes * 60_000)) / 1000)}s ` +
              `FAIL dropped=${d.droppedWrites} underruns=${d.underruns}`,
          )
          pass = false
        }
      }
    }

    engine.write(engine.scheduleCycle(), 0x4015, 0x00)
    engine.flush()
    await sleep(200)

    const d = engine.diagnostics()
    lines.push(`steps=${step}`)
    lines.push(`cyclesElapsed≈${Math.round(engine.nowCycle())}`)
    lines.push(formatDiagnostics(d))
    lines.push(`maxPeakUs=${maxPeakUs.toFixed(1)}`)
    lines.push(`lateWrites=${lastLate}`)

    const countersOk = d.droppedWrites === 0 && d.underruns === 0
    lines.push(`counters=${countersOk ? 'ok' : 'FAIL'}`)
    pass = pass && countersOk

    // The int32-wrap claim must be asserted, not implied: a ≥21-minute run exists
    // to CROSS 2^31 NES cycles (≈20 min at 1.789773 MHz) and still be running.
    const mustCross = minutes * 60 * NTSC_CPU_HZ > 2 ** 31
    if (mustCross) {
      const crossed = engine.nowCycle() > 2 ** 31
      lines.push(`int32CycleCrossing=${crossed ? 'ok' : 'FAIL'}`)
      pass = pass && crossed
    }

    if (maxPeakUs > 0) {
      const peakOk = maxPeakUs < PEAK_BUDGET_US
      lines.push(`peakGate=${peakOk ? 'ok' : 'FAIL'} (budget ${PEAK_BUDGET_US}us)`)
      pass = pass && peakOk
    } else {
      lines.push('peakGate=untrusted (worklet clock probe unavailable — not counted)')
    }

    await engine.dispose()
  } catch (e) {
    lines.push(`error=${e instanceof Error ? e.message : String(e)}`)
    pass = false
  }

  lines.push(pass ? 'SELFTEST PASS' : 'SELFTEST FAIL')
  return { pass, details: lines.join('\n') }
}
