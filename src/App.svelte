<!--
  pulsar — app shell (plan C2, Ivory).

  Responsibilities, and only these:
   - own the SINGLE requestAnimationFrame loop and publish it on the
     'pulsar.frame' context. Order inside a frame is fixed: pump the bridge
     first (it refreshes meter/scope), then the tracker, then let the
     renderers read. The loop never writes $state — the dev fps chip at 4 Hz
     is the one exception.
   - create the audio bridge, wire the parameter store to it, and mirror bridge
     status into transport.
   - own the boot gesture: the first keydown (or the first pointer press, for
     touch and pointer-only users) dismisses the boot sequence AND calls
     bridge.start(). Autoplay policy requires that call to come from a gesture.
   - attach the QWERTY listener and construct the MIDI controller. MIDI
     permission is requested lazily, never on load.
   - compose the Ivory enclosure: head (brand, workspace switch, settings,
     output) · settings strip · transport row · live modules or the tracker ·
     keytop · keybed · footer. Below the compact threshold the shell is paged
     (`phonePage`, session state owned here like `compact`): Play carries the
     keytop, keybed and footer, Voice the screen well and the dials.

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
  import KeyBed from './ui/KeyBed.svelte'
  import KeyTop from './ui/KeyTop.svelte'
  import KnobRow from './ui/KnobRow.svelte'
  import ModeSwitch from './ui/ModeSwitch.svelte'
  import OutputControl from './ui/OutputControl.svelte'
  import ProjectBar from './ui/ProjectBar.svelte'
  import Screen from './ui/Screen.svelte'
  import Settings from './ui/Settings.svelte'
  import TransportBar from './ui/TransportBar.svelte'
  import TrackerPanel from './ui/tracker/TrackerPanel.svelte'
  import { viewport } from './ui/viewport.svelte'
  import type { PhonePage } from './ui/pages'
  import { downloadProject, installProjectHost } from './state/projectHost'
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
  let settingsOpen = $state(false)
  /** The phone page. Default Play; kept across a grow-and-shrink. */
  let phonePage = $state<PhonePage>('play')
  const showLive = $derived(!compact || phonePage === 'voice')
  const showKeys = $derived(!compact || phonePage === 'play')

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
    const detachViewport = viewport.attach()
    return () => {
      compactQuery.removeEventListener('change', resize)
      detachViewport()
    }
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
    song.restoreDraft()
    const releaseHost = installProjectHost()
    const pause = (): void => { tracker.stop(); audio.allNotesOff(); transport.clearNotes() }
    window.addEventListener('site:pause', pause)
    params.attach(audio)
    transport.attach(audio)
    tracker.attach(audio)

    const unsubscribe = audio.subscribe((s) => {
      transport.audio = s
      if (s.state === 'running' && !boot.done) {
        boot.dismiss()
        transport.booted = true
        if (transport.page === 'boot') transport.setPage('params')
      }
    })

    const detachKeys = attachKeyboard({
      bridge: audio,
      gesture: () => {
        if (started && boot.done) return false
        startAudio()
        return false // the held note is queued until the engine is ready
      },
      onNote: announce,
      // While the tracker grid has focus its own keymap owns the keyboard. One
      // window listener, one guard — never a second listener (design §4.5).
      suppress: () => tracker.focused,
    })

    // Playing surfaces start on press. Native controls own their click: starting
    // on pointerdown could remove the start cap before pointerup, sending the
    // click to whatever shifted into its place.
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
      releaseHost()
      window.removeEventListener('site:pause', pause)
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
<!-- The tracker workspace only exists while the editor is open AND the viewport
     can show it (today's `tracker.open && !compact` rule); otherwise the live
     modules render. The transport row and the keybed are in the enclosure in
     both workspaces, so nothing about playback or note entry moves. -->
{#snippet trackerArea()}
  <TrackerPanel announce={announceText} />
{/snippet}

{#snippet settingsStrip()}
  <Settings id="settings-strip" onConnectMidi={connectMidi} />
{/snippet}

{#snippet liveArea()}
  <Screen {boot} />
  <KnobRow />
{/snippet}

{#snippet keytopArea()}
  <KeyTop {compact} />
{/snippet}

{#snippet keysArea()}
  <KeyBed {announce} />
{/snippet}

<!-- The footer's visible row belongs to the Play page; its host bridge (the
     pulsar:project listener, the file input, the replace dialog) must stay
     mounted on every page, so the Voice page keeps ProjectBar quiet rather
     than absent. -->
{#snippet footArea()}
  <ProjectBar quiet={!showKeys} />
{/snippet}

<main aria-label="pulsar">
{#if song.draftError}
  <div class="draft-alert" role="alert">
    <span>{song.draftMessage}</span>
    <button type="button" class="key" onclick={downloadProject}>Download project</button>
  </div>
{/if}
<Enclosure
  tracker={tracker.open && !compact ? trackerArea : undefined}
  settings={settingsOpen ? settingsStrip : undefined}
  live={showLive ? liveArea : undefined}
  keytop={showKeys ? keytopArea : undefined}
  keys={showKeys ? keysArea : undefined}
  foot={footArea}
>
  {#snippet brand()}
    <Brand />
  {/snippet}

  {#snippet modes()}
    <ModeSwitch {compact} {phonePage} onPhonePage={(page) => { phonePage = page }} />
  {/snippet}

  {#snippet settingsButton()}
    <button
      type="button"
      class="key"
      aria-expanded={settingsOpen}
      aria-controls="settings-strip"
      onclick={() => { settingsOpen = !settingsOpen }}
    >
      Settings
    </button>
  {/snippet}

  {#snippet output()}
    <OutputControl />
  {/snippet}

  {#snippet transportRow()}
    <TransportBar announce={announceText} onStartAudio={startAudio} />
  {/snippet}
</Enclosure>

<LiveRegion message={announcement} />
</main>

{#if selftest}<pre data-selftest>{selftest}</pre>{/if}


<style>
  .draft-alert {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px;
    font-size: var(--t-ui-size);
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border-bottom: 2px solid var(--enclosure-accent);
  }
</style>
