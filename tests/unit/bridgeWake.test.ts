/** The bridge's wake/resume status machine (review of 8c3c892), driven end to end:
 *
 *    - a context Chrome CLOSED under us (device loss) must not wedge the bridge:
 *      the next gesture's start() has to build a FRESH engine. The pre-fix code
 *      cleared only #startPromise, so start()'s live-engine branch resumed a
 *      closed context forever — #resume() refuses 'closed', #run() never ran,
 *      and the audio was dead until reload.
 *    - the 10 Hz diagnostics poll must not talk the panel back into 'running'
 *      while the context is suspended: a refused resume publishes 'idle' (the
 *      state that puts the start cap back on the panel), and the pre-fix poll
 *      re-published 'running' over it within one interval — the cap flashed and
 *      vanished, the LED green on a silent context.
 *
 *  Mock and import strategy are bridgeTransport.test.ts's: `host/audioEngine` is
 *  replaced by a fake whose ctx.state is SCRIPTABLE, and the bridge module is
 *  imported through a variable specifier because tsconfig.test.json has no DOM
 *  lib. Everything past the engine seam — LiveScheduler, TrackerDriver, the
 *  poll timer, the status machine itself — is the production code.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import type { NesCycle, RegAddr } from '../../src/audio/timeline/types'

/* ---- the fake audio thread ------------------------------------------------- */

class FakePort {
  postMessage(): void {}
}

class FakeNode {
  readonly port = new FakePort()
  connect(): void {}
}

class FakeAnalyser {
  fftSize = 512
  smoothingTimeConstant = 0
}

class FakeContext {
  readonly sampleRate = 48_000
  state = 'running'
  onstatechange: (() => void) | null = null
  resumeResult: 'resolve' | 'reject' = 'resolve'

  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser()
  }

  /** A gesture-borne resume WebKit may still refuse (an interruption still in
   *  progress rejects); an accepted one takes the state to 'running'. */
  resume(): Promise<void> {
    if (this.resumeResult === 'reject') return Promise.reject(new Error('interrupted'))
    this.state = 'running'
    return Promise.resolve()
  }

  /** The browser moving the context under us: suspension, device loss, recovery. */
  setState(state: string): void {
    this.state = state
    this.onstatechange?.()
  }
}

/** Structurally an `EngineHandle` as far as the bridge uses one. */
class FakeEngine {
  readonly clockRate = NTSC_CPU_HZ
  leadMs = 6
  readonly transport = 'postMessage'
  readonly ctx = new FakeContext()
  readonly node = new FakeNode()
  now: NesCycle = 1_000_000
  dropped = 0
  disposed = 0

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

  write(_cycle: NesCycle, _addr: RegAddr, _value: number): void {}
  flush(): void {}
  lateWrites(): number {
    return 0
  }
  setMasterGain(): void {}
  setConfig(): void {}

  diagnostics(): Record<string, number | string> {
    return {
      transport: 'postMessage',
      baseLatencyMs: 2.67,
      outputLatencyMs: 0,
      leadMs: this.leadMs,
      lateWrites: 0,
      droppedWrites: this.dropped,
      underruns: 0,
      peakProcessUs: 0,
      dspLoadPct: 0,
      sampleRate: 48_000,
    }
  }

  dispose(): Promise<void> {
    this.disposed++
    return Promise.resolve()
  }
}

const hoisted = vi.hoisted(() => ({ engine: null as FakeEngine | null, starts: 0 }))

vi.mock('../../src/audio/host/audioEngine', () => ({
  sabAvailable: () => false,
  startEngine: () => {
    hoisted.starts++
    return Promise.resolve(hoisted.engine)
  },
}))

/* ---- the bridge under test -------------------------------------------------- */

/** The members this suite drives, declared structurally (see the header). */
interface TestBridge {
  start(): Promise<void>
  readonly status: { readonly state: string; readonly error?: string }
  readonly engine: unknown
  readonly diagnostics: { readonly droppedWrites: number }
  dispose(): void
}

const BRIDGE_MODULE = '../../src/audio/bridge'

async function makeBridge(): Promise<{ bridge: TestBridge; engine: FakeEngine }> {
  const engine = new FakeEngine()
  hoisted.engine = engine
  hoisted.starts = 0
  const mod = (await import(BRIDGE_MODULE)) as { createAudioBridge(): TestBridge }
  return { bridge: mod.createAudioBridge(), engine }
}

/** Let every already-resolved promise in the start/resume chain run. */
async function microtasks(n = 8): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

/** The bridge's DIAGNOSTICS_INTERVAL_MS — module-private there, pinned here. */
const POLL_MS = 100

afterEach(() => {
  vi.useRealTimers()
})

describe('bridge wake', () => {
  it('tears a closed context down, so the next gesture builds a fresh engine', async () => {
    vi.useFakeTimers()
    const { bridge, engine } = await makeBridge()
    engine.settle()
    await bridge.start()
    expect(bridge.status.state).toBe('running')
    expect(hoisted.starts).toBe(1)

    // Chrome device loss: the context goes to 'closed' and stays there.
    engine.ctx.setState('closed')
    await microtasks()

    expect(bridge.status.state).toBe('error')
    expect(bridge.status.error).toContain('device')
    expect(bridge.engine, 'a closed context is not a live engine').toBeNull()
    expect(engine.disposed, 'the dead handle must be disposed').toBe(1)

    // The recovery gesture: start() must reach startEngine again, not resume
    // the corpse — pre-fix it returned early and the audio stayed dead.
    const next = new FakeEngine()
    hoisted.engine = next
    next.settle()
    await bridge.start()

    expect(hoisted.starts, 'the retry must build a FRESH engine').toBe(2)
    expect(bridge.engine).toBe(next)
    expect(bridge.status.state).toBe('running')
    bridge.dispose()
  })

  it('poll refreshes numbers but never re-publishes running over a refused resume', async () => {
    vi.useFakeTimers()
    const { bridge, engine } = await makeBridge()
    engine.settle()
    await bridge.start()
    expect(bridge.status.state).toBe('running')

    // The browser suspends the context; the wake's resume is refused, so the
    // bridge says 'idle' and the start cap comes back on the panel.
    engine.ctx.resumeResult = 'reject'
    engine.ctx.setState('suspended')
    await microtasks()
    expect(bridge.status.state).toBe('idle')

    // One poll interval later the cap must STILL be up. The droppedWrites
    // assertion proves the poll genuinely ran — without it 'idle' could pass
    // vacuously on a dead timer.
    engine.dropped = 7
    vi.advanceTimersByTime(POLL_MS)
    await microtasks()

    expect(bridge.diagnostics.droppedWrites, 'the poll ran: numbers refresh').toBe(7)
    expect(bridge.status.state, 'a suspended context is not running').toBe('idle')
    bridge.dispose()
  })
})
