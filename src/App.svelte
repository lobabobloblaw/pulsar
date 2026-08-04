<script lang="ts">
  import { startEngine, type EngineHandle } from './audio/host/audioEngine'
  import { runSelfTest } from './selftest'

  let engine: EngineHandle | null = $state(null)
  let busy = $state(false)
  let error = $state('')
  let selftest = $state('')

  const iso = crossOriginIsolated
  const sab = typeof SharedArrayBuffer === 'function'

  $effect(() => {
    if (new URLSearchParams(location.search).has('selftest')) {
      void runSelfTest().then((r) => {
        selftest = r.details
        document.title = r.pass ? 'pulsar-selftest-pass' : 'pulsar-selftest-fail'
      })
    }
  })

  async function toggle(): Promise<void> {
    if (busy) return
    busy = true
    error = ''
    try {
      if (engine) {
        await engine.dispose()
        engine = null
      } else {
        engine = await startEngine()
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      engine = null
    } finally {
      busy = false
    }
  }
</script>

<main>
  <h1>pulsar</h1>
  <p class="sub">m0 scaffold — worklet loader gate</p>
  <p class="caps">
    crossOriginIsolated: <code>{String(iso)}</code> ·
    sharedarraybuffer: <code>{String(sab)}</code>
    {#if engine}· samplerate: <code>{engine.ctx.sampleRate}</code>{/if}
  </p>
  <button onclick={toggle} disabled={busy}>
    {engine ? 'stop' : 'click to start — 440 hz sine'}
  </button>
  {#if error}<p class="err">{error}</p>{/if}
  {#if selftest}<pre data-selftest>{selftest}</pre>{/if}
</main>

<style>
  main {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    max-width: 640px;
    margin: 4rem auto;
    padding: 0 1.5rem;
    color: #181818;
  }
  h1 {
    font-weight: 800;
    letter-spacing: -0.04em;
    margin: 0;
  }
  .sub {
    color: #484848;
  }
  button {
    font: inherit;
    padding: 0.6rem 1.2rem;
    border: 1px solid #a8a8a8;
    border-radius: 6px;
    background: #ffffff;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .err {
    color: #ce2021;
  }
</style>
