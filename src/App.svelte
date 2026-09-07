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
  import { onMount, untrack } from 'svelte'
  import { runSelfTest } from './selftest'
  import { bridge, releaseBridge } from './audio/bridge'
  import { attachKeyboard } from './input/keyboard'
  import { createMidi } from './input/midi'
  import { params } from './state/params.svelte'
  import { tracker } from './state/tracker.svelte'
  import { song } from './state/song.svelte'
  import { transport } from './state/transport.svelte'
  import LiveRegion from './ui/a11y/LiveRegion.svelte'
  import Brand from './ui/Brand.svelte'
  import Enclosure from './ui/Enclosure.svelte'
  import PlayerStrip from './ui/PlayerStrip.svelte'
  import KeyBed from './ui/KeyBed.svelte'
  import KnobRow from './ui/KnobRow.svelte'
  import Screen from './ui/Screen.svelte'
  import StatusBar from './ui/StatusBar.svelte'
  import PresetBar from './ui/tracker/PresetBar.svelte'
  import TrackerPanel from './ui/tracker/TrackerPanel.svelte'
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
  const compactQuery = matchMedia('(max-width: 720px)')
  let compact = $state(compactQuery.matches)

  // Keep the audio document current independent of which responsive view is
  // mounted. Reopening the editor must not restart a playing song.
  $effect(() => {
    void song.version
    untrack(() => {
      if (tracker.playing) audio.loadSong(song.doc)
    })
  })

  function announce(note: number | string): void {
    announcement = typeof note === 'number' ? noteName(note) : note
  }

  /** The tracker's LiveRegion route. Same region, same politeness — the panel
   *  throttles its own cursor announcements (design §4.4). */
  function announceText(message: string): void {
    announcement = message
  }

  /** The user gesture. Idempotent, and safe to call from anywhere. ALWAYS
   *  forwarded to the bridge: after iOS suspends the context (lock screen,
   *  phone call, ringer), a later gesture must arrive there as a resume — a
   *  one-shot latch here once made the reappearing start cap a dead button
   *  and stranded the phone in silence until a reload. */
  function startAudio(): void {
    started = true
    void audio.start()
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
    const resize = (): void => { compact = compactQuery.matches }
    compactQuery.addEventListener('change', resize)
    return () => compactQuery.removeEventListener('change', resize)
  })

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
    tracker.attach(audio)

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
      // While the tracker grid has focus its own keymap owns the keyboard. One
      // window listener, one guard — never a second listener (design §4.5).
      suppress: () => tracker.focused,
    })

    // Playing surfaces start on press. Native controls own their click: starting
    // on pointerdown could remove the power button before pointerup, sending the
    // click to the MIDI button that shifted into its place.
    const onPointerDown = (event: PointerEvent): void => {
      if (started && boot.done) return
      if (event.target instanceof Element && event.target.closest('button,input,select,textarea,summary,a')) return
      startAudio()
    }
    window.addEventListener('pointerdown', onPointerDown)

    let raf = 0
    let frames = 0
    let fpsAt = 0
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop)
      audio.tick(now)
      // The driver's position is refreshed before the renderers read it, so the
      // grid and the screen agree about the playhead within one frame. Cheap
      // and inert when nothing is playing.
      tracker.pump(now)
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

    let disposed = false
    const dispose = (): void => {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('site:dispose', dispose)
      window.removeEventListener('pagehide', onPageHide)
      detachKeys()
      unsubscribe()
      tracker.detach()
      midi.dispose()
      audio.dispose()
      releaseBridge(audio)
    }
    const onPageHide = (event: PageTransitionEvent): void => {
      if (!event.persisted) dispose()
    }
    // The trusted homepage gives us a synchronous turn before removing the
    // frame; native pagehide covers standalone navigation without breaking BFCache.
    window.addEventListener('site:dispose', dispose)
    window.addEventListener('pagehide', onPageHide)
    return dispose
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
<!-- The tracker area only exists while the panel is open, so the enclosure keeps
     its Phase-1 shape (and its Phase-1 width) when it is closed. -->
<!-- The screen is ONE component with two homes: the enclosure's screen area in
     live mode, the tracker panel's left pane while tracking (§4.1 as amended —
     the workbench replaces the screen and knob rows so the open panel fits a
     laptop viewport). One snippet, so the two mounts cannot drift. -->
<!-- The preset browser fills TrackerPanel's `presetBar` seam from here (design §5.6),
     and gets the SAME LiveRegion route as the panel: a preset that fails to load says
     so out loud, and that message has nowhere else to go. -->
{#snippet screenView()}
  <Screen {boot} />
  <!-- The live instrument always has song controls, including after rotation
       to tablet width. The editor supplies its own transport while visible. -->
  {#if !tracker.open || compact}<PlayerStrip announce={announceText} />{/if}
{/snippet}

{#snippet trackerArea()}
  <TrackerPanel announce={announceText}>
    {#snippet screen()}
      {@render screenView()}
    {/snippet}
    {#snippet presetBar()}
      <PresetBar announce={announceText} />
    {/snippet}
  </TrackerPanel>
{/snippet}

<main aria-label="pulsar">
<Enclosure tracker={tracker.open && !compact ? trackerArea : undefined} screen={screenView}>
  {#snippet brand()}
    <Brand />
  {/snippet}

  {#snippet status()}
    <StatusBar onStartAudio={startAudio} onConnectMidi={connectMidi} />
  {/snippet}

  {#snippet knobs()}
    <KnobRow />
  {/snippet}

  {#snippet keys()}
    <KeyBed {announce} />
  {/snippet}

  {#snippet foot()}
    <!-- The face carries no usage prose (compact pass): the boot screen
         teaches the first key, the midi screen page carries the fallback
         mapping, and the full legend lives in the tracker's keyboard
         reference. Only the disclaimer is printed. -->
    <div class="foot">
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
    justify-content: flex-end;
    padding-top: var(--s-2);
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
