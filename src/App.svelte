<!--
  pulsar — app shell (plan C2).

  Responsibilities, and only these:
   - own the SINGLE requestAnimationFrame loop and publish it on the
     'pulsar.frame' context. Order inside a frame is fixed: pump the bridge
     first (it refreshes meter/scope), then let the renderers read. The loop
     never writes $state — the dev fps chip at 4 Hz is the one exception.
   - create the audio bridge, wire the parameter store to it, and mirror bridge
     status into transport.
   - own the boot gesture: the first keydown (or the first pointer press, for
     touch and pointer-only users) dismisses the boot sequence AND calls
     bridge.start(). Autoplay policy requires that call to come from a gesture.
   - attach the QWERTY listener and construct the MIDI controller. MIDI
     permission is requested lazily, never on load.

  The ?selftest hook below is the lead's headless gate harness. Do not change
  its shape: the runner looks for `pre[data-selftest]` and reads document.title.
-->
<script lang="ts">
  import { onMount } from 'svelte'
  import { runSelfTest } from './selftest'
  import { bridge, releaseBridge } from './audio/bridge'
  import { attachKeyboard } from './input/keyboard'
  import { createMidi } from './input/midi'
  import { params } from './state/params.svelte'
  import { transport } from './state/transport.svelte'
  import LiveRegion from './ui/a11y/LiveRegion.svelte'
  import Brand from './ui/Brand.svelte'
  import Enclosure from './ui/Enclosure.svelte'
  import KeyBed from './ui/KeyBed.svelte'
  import KnobRow from './ui/KnobRow.svelte'
  import Screen from './ui/Screen.svelte'
  import StatusBar from './ui/StatusBar.svelte'
  import { createBootSequence } from './ui/canvas/bootSequence'
  import { createFrameBus, provideFrame } from './ui/frame'
  import { noteName } from './state/transport.svelte'

  const audio = bridge()
  const boot = createBootSequence()
  const { bus, emit } = createFrameBus()
  provideFrame(bus)

  const midi = createMidi(audio, announce)

  let announcement = $state('')
  let selftest = $state('')
  let started = false

  function announce(note: number | string): void {
    announcement = typeof note === 'number' ? noteName(note) : note
  }

  /** The user gesture. Idempotent, and safe to call from anywhere. */
  function startAudio(): void {
    if (!started) {
      started = true
      void audio.start()
    }
    if (!boot.done) {
      boot.dismiss()
      transport.booted = true
      transport.setPage('params')
    }
  }

  function connectMidi(): void {
    void midi.ensureAccess()
  }

  /** Harness mode: the selftest/soak owns its own engine and its numbers must be
   *  uncontaminated — the interactive shell stays visible but INERT (no gesture
   *  listeners, no keyboard, no second AudioContext, no MIDI). Review finding #4. */
  const harnessMode = new URLSearchParams(location.search).has('selftest')

  onMount(() => {
    document.documentElement.dataset['room'] = transport.room
    if (harnessMode) {
      let raf = 0
      const loop = (now: number): void => {
        raf = requestAnimationFrame(loop)
        emit(now)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    }
    params.attach(audio)
    transport.attach(audio)

    const unsubscribe = audio.subscribe((s) => {
      transport.audio = s
    })

    const detachKeys = attachKeyboard({
      bridge: audio,
      gesture: () => {
        if (started && boot.done) return false
        startAudio()
        return true // the first key starts audio, it does not play a note
      },
      onNote: announce,
    })

    // Pointer-only and touch users need the same gesture path. Any press
    // anywhere counts, including a press on a key of the keybed.
    const onPointerDown = (): void => {
      if (started && boot.done) return
      startAudio()
    }
    window.addEventListener('pointerdown', onPointerDown)

    let raf = 0
    let frames = 0
    let fpsAt = 0
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop)
      audio.tick(now)
      emit(now)
      if (import.meta.env.DEV) {
        frames++
        if (now - fpsAt >= 250) {
          transport.fps = Math.round((frames * 1000) / (now - fpsAt))
          frames = 0
          fpsAt = now
        }
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointerDown)
      detachKeys()
      unsubscribe()
      midi.dispose()
      audio.dispose()
      releaseBridge(audio)
    }
  })

  // Headless gate harness — preserved verbatim from WP0.
  $effect(() => {
    if (new URLSearchParams(location.search).has('selftest')) {
      void runSelfTest().then((r) => {
        selftest = r.details
        document.title = r.pass ? 'pulsar-selftest-pass' : 'pulsar-selftest-fail'
      })
    }
  })
</script>

<!-- The one main landmark; the stage/device manage their own layout, so a plain
     block wrapper is inert visually and satisfies axe's landmark-one-main/region. -->
<main aria-label="pulsar">
<Enclosure>
  {#snippet brand()}
    <Brand />
  {/snippet}

  {#snippet status()}
    <StatusBar onStartAudio={startAudio} onConnectMidi={connectMidi} />
  {/snippet}

  {#snippet screen()}
    <Screen {boot} />
  {/snippet}

  {#snippet knobs()}
    <KnobRow />
  {/snippet}

  {#snippet keys()}
    <KeyBed {announce} />
  {/snippet}

  {#snippet foot()}
    <div class="foot">
      <p class="t-micro">
        z–m lower octave · q–i upper · − and = shift octave · shift-drag knobs for fine control
      </p>
      <p class="t-micro">not affiliated with teenage engineering</p>
    </div>
  {/snippet}
</Enclosure>

<LiveRegion message={announcement} />
</main>

{#if selftest}<pre data-selftest>{selftest}</pre>{/if}

<style>
  .foot {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--s-2) var(--s-4);
    padding-top: var(--s-3);
    border-top: 1px solid var(--enclosure-hairline);
    color: var(--enclosure-ink-2);
  }

  pre[data-selftest] {
    margin: var(--s-4);
    padding: var(--s-3);
    font-family: var(--font-ui);
    font-size: var(--t-body-size);
    color: var(--enclosure-ink);
    background: var(--n-000);
    border-radius: var(--r-2);
    white-space: pre-wrap;
  }
</style>
