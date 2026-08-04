/** The bridge's transport seams (design §2.6, §6.3) — the four places where the UI's
 *  intent and the audio thread's lifetime disagree, and what happens when they do.
 *
 *  Why this file mocks `host/audioEngine` and imports the bridge through a variable
 *  specifier: `src/audio/bridge.ts` is full of DOM (`AudioContext`, `document`,
 *  `location`) and `tsconfig.test.json` deliberately has no DOM lib, so a static
 *  import would make `pnpm typecheck` fail on a file this suite only ever drives
 *  through its public surface. `bridgeMapping.test.ts` solved the same problem by
 *  testing an extracted pure module; that is not available here, because what is under
 *  test IS the sequencing inside the bridge. The mock replaces the one import that
 *  needs a real audio thread, and everything else — `LiveScheduler`, `TrackerDriver`,
 *  `PlaybackCoordinator`, the pump — is the production code.
 *
 *  What each case pins, all four found in the phase-2 review:
 *    - a live note held when playback is stopped survives `stopPlayback()`, and the
 *      key coming up still silences it (Escape in the grid was a stuck note)
 *    - a `stop` pressed during the ~100 ms cold-page engine start is not swallowed
 *    - a song that halts ITSELF (`Cxx`) hands the timeline back, so the live
 *      scheduler does not resume behind the driver's last write
 *    - the DPCM image survives `loadSong` happening before the engine exists — which
 *      is the normal order, since the document loads at mount and the engine waits
 *      for a gesture
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { PUMP_MS } from '../../src/tracker/driver/tempo'
import { parseSong } from '../../src/tracker/model/validate'
import { emptySong, type Song } from '../../src/tracker/model/types'
import { REG, buildSong } from '../fixtures/songs/build'
import type { NesCycle, RegAddr } from '../../src/audio/timeline/types'

/* ---- the fake audio thread ------------------------------------------------- */

class FakePort {
  readonly posted: { t: string }[] = []
  postMessage(message: { t: string }): void {
    this.posted.push(message)
  }
}

class FakeNode {
  readonly port = new FakePort()
  connect(): void {}
}

class FakeAnalyser {
  fftSize = 512
  smoothingTimeConstant = 0
  getFloatTimeDomainData(): void {}
}

class FakeContext {
  readonly sampleRate = 48_000
  state = 'running'
  onstatechange: (() => void) | null = null
  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser()
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
}

/** Structurally an `EngineHandle` as far as the bridge uses one. */
class FakeEngine {
  readonly clockRate = NTSC_CPU_HZ
  leadMs = 6
  readonly transport = 'postMessage'
  readonly ctx = new FakeContext()
  readonly node = new FakeNode()
  readonly sink = new ArrayWriteSink()
  now: NesCycle = 1_000_000
  configs = 0

  /** `ready()` is deliberately controllable: the cold-page start window is a real
   *  interval in the app and the review's finding lives inside it. */
  #resolveReady: (v: { cycle: number; time: number }) => void = () => {}
  readonly #ready = new Promise<{ cycle: number; time: number }>((r) => {
    this.#resolveReady = r
  })

  settle(): void {
    this.#resolveReady({ cycle: this.now, time: 0 })
  }

  ready(): Promise<{ cycle: number; time: number }> {
    return this.#ready
  }

  nowCycle(): NesCycle {
    return this.now
  }

  write(cycle: NesCycle, addr: RegAddr, value: number): void {
    this.sink.write(cycle, addr, value)
  }

  flush(): void {}

  lateWrites(): number {
    return 0
  }

  setMasterGain(): void {}

  setConfig(): void {
    this.configs++
  }

  diagnostics(): Record<string, number | string> {
    return {
      transport: 'postMessage',
      baseLatencyMs: 2.67,
      outputLatencyMs: 0,
      leadMs: this.leadMs,
      lateWrites: 0,
      droppedWrites: 0,
      underruns: 0,
      peakProcessUs: 0,
      dspLoadPct: 0,
      sampleRate: 48_000,
    }
  }

  dispose(): Promise<void> {
    return Promise.resolve()
  }
}

const hoisted = vi.hoisted(() => ({ engine: null as FakeEngine | null }))

vi.mock('../../src/audio/host/audioEngine', () => ({
  sabAvailable: () => false,
  startEngine: () => Promise.resolve(hoisted.engine),
}))

/* ---- the bridge under test -------------------------------------------------- */

/** The members this suite drives. Declared structurally so the module can be imported
 *  through a variable specifier (see the header) without pulling its DOM types in. */
interface TestBridge {
  start(): Promise<void>
  noteOn(note: number, velocity: number): void
  noteOff(note: number): void
  loadSong(song: Song): void
  play(mode: 'song' | 'pattern' | 'row', from?: { order: number; row: number }): void
  stopPlayback(): void
  readonly playback: { playing: boolean; orderIndex: number; row: number }
  readonly playbackStats: { ticksGenerated: number; rowsPlayed: number } | null
  dispose(): void
}

const BRIDGE_MODULE = '../../src/audio/bridge'

async function makeBridge(): Promise<{ bridge: TestBridge; engine: FakeEngine }> {
  const engine = new FakeEngine()
  hoisted.engine = engine
  const mod = (await import(BRIDGE_MODULE)) as { createAudioBridge(): TestBridge }
  return { bridge: mod.createAudioBridge(), engine }
}

/** Let every already-resolved promise in the start chain run. */
async function microtasks(n = 8): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

function statusWritesAfter(sink: ArrayWriteSink, from: number): number[] {
  const out: number[] = []
  for (let i = from; i < sink.length; i++) if (sink.addrs[i] === REG.STATUS) out.push(sink.values[i])
  return out
}

function expectNonDecreasing(sink: ArrayWriteSink): void {
  for (let i = 1; i < sink.length; i++) {
    expect(sink.cycles[i], `write ${i} at ${sink.addrs[i].toString(16)}`).toBeGreaterThanOrEqual(
      sink.cycles[i - 1],
    )
  }
}

/** A valid document carrying one DMC sample. The validator insists on 16n+1 bytes. */
function songWithSample(): Song {
  const bytes = new Uint8Array(17).fill(0xaa)
  const raw = {
    ...emptySong(),
    samples: [{ name: 'probe', data: Buffer.from(bytes).toString('base64') }],
  }
  const { song, diagnostics } = parseSong(JSON.parse(JSON.stringify(raw)))
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  return song
}

/** speed 1, and a `C00` on row 1 — the song halts itself inside the first lookahead. */
function selfHaltingSong(): Song {
  return buildSong({
    meta: { speed: 1, rowsPerPattern: 8 },
    patterns: {
      'pulse1:0': [
        { r: 0, note: 60, vol: 15 },
        { r: 1, fx: [{ cmd: 'C', param: 0 }] },
      ],
    },
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('bridge transport', () => {
  it('leaves a held live note alone when stopPlayback runs with nothing playing', async () => {
    // Escape in the grid, closing the panel and every preset click all reach
    // `stopPlayback()`. With no playback to stop it must be inert: the live scheduler
    // owns the timeline, and resetting it drops the sounding note without emitting a
    // write — after which the key coming up cuts nothing and the note is stuck.
    const { bridge, engine } = await makeBridge()
    engine.settle()
    await bridge.start()

    bridge.noteOn(60, 127)
    const before = engine.sink.length
    expect(before).toBeGreaterThan(0)

    bridge.stopPlayback()
    bridge.noteOff(60)

    const status = statusWritesAfter(engine.sink, before)
    expect(status.length, 'note-off must still write $4015').toBeGreaterThan(0)
    expect(status[status.length - 1] & 0x01).toBe(0)
    bridge.dispose()
  })

  it('does not swallow a stop pressed during the cold-page engine start', async () => {
    const { bridge, engine } = await makeBridge()
    bridge.play('song') // the user hits enter on a page whose engine has never run
    await microtasks()
    expect(bridge.playback.playing).toBe(false)

    bridge.stopPlayback() // ...and changes their mind before the worklet answers
    engine.settle()
    await microtasks(24)

    expect(bridge.playback.playing).toBe(false)
    expect(bridge.playbackStats?.ticksGenerated ?? -1).toBe(0)
    expect(engine.sink.length, 'nothing may be scheduled after the stop').toBe(0)
    bridge.dispose()
  })

  it('hands the timeline back when the song halts itself', async () => {
    vi.useFakeTimers()
    const { bridge, engine } = await makeBridge()
    engine.settle()
    bridge.loadSong(selfHaltingSong())
    bridge.play('song')
    await microtasks(24)

    expect(bridge.playback.playing).toBe(false) // Cxx, inside the first lookahead
    const drivenTo = engine.sink.cycles[engine.sink.length - 1]
    expect(engine.sink.length).toBeGreaterThan(2)

    // The pump notices, stops itself, and hands the timeline back.
    vi.advanceTimersByTime(PUMP_MS * 2)
    await microtasks()

    // A live note now: the scheduler's clamp must be past everything the driver
    // queued, or the timeline goes backwards.
    bridge.noteOn(64, 127)
    bridge.noteOff(64)
    expect(engine.sink.cycles[engine.sink.length - 1]).toBeGreaterThan(drivenTo)
    expectNonDecreasing(engine.sink)
    bridge.dispose()
  })

  it('posts the DPCM image at start when the song was loaded before the engine', async () => {
    // The everyday order: `tracker.attach()` loads the document at mount, and the
    // engine is not built until the first gesture. Posting only from `loadSong` meant
    // the sample memory never reached the worklet and every DPCM note was silent.
    const { bridge, engine } = await makeBridge()
    bridge.loadSong(songWithSample())
    expect(engine.node.port.posted).toEqual([])

    engine.settle()
    await bridge.start()

    expect(engine.node.port.posted.filter((m) => m.t === 'dpcm').length).toBe(1)
    bridge.dispose()
  })
})
