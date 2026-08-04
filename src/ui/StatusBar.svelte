<!--
  pulsar — StatusBar (plan C10, device-controls pass 2026-08-04).

  Hardware logic, not web chips: a capability you can still act on is a CAP
  (start audio, connect midi); once resolved it is an LED with a silkscreened
  name (audio · midi · sab). The tracker and room are latching caps, the
  console model is a two-position slide switch printed nes/fc. Labels sit on
  the slab under each control, the way an enclosure is printed.

  The words did not leave — they moved where each audience needs them: sr-only
  text mirrors every LED's state, `title` carries it for a hovering pointer,
  and the note below still explains any problem in full sentences and names
  the fix. A dead control with no explanation is worse than no control.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'
  import Icon from './Icon.svelte'
  import Meter from './Meter.svelte'

  interface Props {
    onStartAudio: () => void
    onConnectMidi: () => void
  }
  let { onStartAudio, onConnectMidi }: Props = $props()

  const dev = import.meta.env.DEV

  const audioChip = $derived.by(() => {
    const a = transport.audio
    if (a.state === 'running') return `audio ${Math.round(a.sampleRate / 1000)}k`
    if (a.state === 'starting') return 'audio starting'
    if (a.state === 'error') return 'audio error'
    return 'audio idle'
  })

  const midiChip = $derived.by(() => {
    const m = transport.midi
    if (!m.supported) return 'midi unavailable'
    switch (m.permission) {
      case 'granted':
        return m.ports.length === 0 ? 'midi no devices' : `midi ${m.ports.length}`
      case 'blocked':
        return 'midi blocked'
      case 'denied':
        return 'midi denied'
      case 'unavailable':
        return 'midi unavailable'
      default:
        return 'midi connect'
    }
  })

  const sabOn = $derived(transport.audio.transport === 'sab')

  /** At most one note at a time: the most actionable problem wins. */
  const note = $derived.by(() => {
    const m = transport.midi
    if (!m.supported) {
      return 'this browser has no web midi. play with the computer keyboard — z–m lower octave, q–i upper. for midi input, open pulsar in chrome or edge.'
    }
    if (m.permission === 'blocked') {
      return 'firefox needs the site permission add-on for web midi. install it, then reload and allow midi.'
    }
    if (m.permission === 'denied') {
      return 'midi access was refused. reload the page and choose allow to use a hardware keyboard.'
    }
    if (m.permission === 'granted' && m.ports.length === 0) {
      return 'no midi devices yet. plug one in — pulsar picks it up live, no reload needed.'
    }
    if (!sabOn) {
      return 'sharedarraybuffer is off, so pulsar is using the slower message path. audio still works.'
    }
    return ''
  })

  const audioTone = $derived(
    transport.audio.state === 'running' ? 'ok' : transport.audio.state === 'error' ? 'bad' : 'idle',
  )

  const midiTone = $derived.by(() => {
    const m = transport.midi
    if (!m.supported) return 'idle'
    if (m.permission === 'granted') return m.ports.length > 0 ? 'ok' : 'warn'
    if (m.permission === 'blocked' || m.permission === 'denied') return 'bad'
    return 'idle'
  })
</script>

<div class="status">
  <div class="controls">
    {#if transport.audio.state !== 'running' && transport.audio.state !== 'starting'}
      <span class="keyed">
        <button type="button" class="key" onclick={onStartAudio} aria-label="start audio">
          <Icon name="power" />
        </button>
        <span class="silk">start</span>
      </span>
    {/if}

    {#if transport.midi.supported && transport.midi.permission === 'unknown'}
      <span class="keyed">
        <button type="button" class="key" onclick={onConnectMidi} aria-label="connect midi">
          <Icon name="midi" />
        </button>
        <span class="silk">midi</span>
      </span>
    {/if}

    <!-- The tracker panel is opt-in from here (design §4.1). Opening it also
         turns the screen to the song page — the panel hosts the screen beside
         the grid, and a giant params readout narrates nothing there. Closing
         restores the live-play default. -->
    <span class="keyed">
      <button
        type="button"
        class="key"
        aria-pressed={tracker.open}
        aria-label="tracker"
        onclick={() => {
          tracker.toggleOpen()
          transport.setPage(tracker.open ? 'song' : 'params')
        }}
      >
        <Icon name="grid" />
      </button>
      <span class="silk">tracker</span>
    </span>

    <span class="keyed">
      <button
        type="button"
        class="key"
        aria-pressed={transport.room === 'night'}
        aria-label="room: {transport.room}"
        onclick={() => transport.toggleRoom()}
      >
        {#if transport.room === 'night'}<Icon name="moon" />{:else}<Icon name="sun" />{/if}
      </button>
      <span class="silk">room</span>
    </span>

    <span class="keyed">
      <button
        type="button"
        class="switch"
        aria-pressed={transport.consoleModel === 'famicom'}
        aria-label="console model: {transport.consoleModel}"
        onclick={() => transport.toggleModel()}
      >
        <span class="silk" class:on={transport.consoleModel === 'nes'}>nes</span>
        <span class="track" aria-hidden="true"><span class="thumb"></span></span>
        <span class="silk" class:on={transport.consoleModel === 'famicom'}>fc</span>
      </button>
      <span class="silk">model</span>
    </span>

    <div class="leds">
      <span class="ledgroup" title={audioChip}>
        <span class="led {audioTone}" aria-hidden="true"></span>
        <span class="silk">audio</span>
        <span class="sr">{audioChip}</span>
      </span>
      <span class="ledgroup" title={midiChip}>
        <span class="led {midiTone}" aria-hidden="true"></span>
        <span class="silk">midi</span>
        <span class="sr">{midiChip}</span>
      </span>
      <span class="ledgroup" title="sharedarraybuffer transport {sabOn ? 'on' : 'off'}">
        <span class="led" class:ok={sabOn} aria-hidden="true"></span>
        <span class="silk">sab</span>
        <span class="sr">sab {sabOn ? 'on' : 'off'}</span>
      </span>
      {#if dev}
        <span class="silk">fps {transport.fps}</span>
      {/if}
    </div>

    <div class="meter">
      <Meter mode="level" label="out" />
    </div>
  </div>

  {#if note}
    <p class="note">{note}</p>
  {/if}
</div>

<style>
  .status {
    display: grid;
    gap: var(--s-2);
    justify-items: end;
  }

  /* One row on the wide (tracker) device; on the Phase-1 width the LED line
     wraps under the caps as its own thin printed row. */
  .controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: flex-start;
    gap: var(--s-1) var(--s-3);
  }

  .leds {
    display: flex;
    align-items: center;
    align-self: center;
    gap: var(--s-3);
  }

  .ledgroup {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* The slide switch: a recessed track, a moving mark, printed endpoints. */
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .switch .track {
    position: relative;
    width: 22px;
    height: 12px;
    background: var(--chip-bg);
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
  }

  .switch .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    background: var(--enclosure-mark);
    transition: left var(--dur-fast) var(--ease);
  }

  .switch[aria-pressed='true'] .thumb {
    left: 12px;
  }

  .switch:focus-visible {
    outline: none;
  }

  .switch:focus-visible .track {
    box-shadow: var(--focus);
  }

  /* The active endpoint is printed in ink; position says the same thing. */
  .switch .silk.on {
    color: var(--enclosure-ink);
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* The meter sits on the LED line. */
  .meter {
    display: flex;
    align-items: center;
    align-self: center;
  }

  .note {
    max-width: 46ch;
    text-align: right;
    color: var(--enclosure-ink-2);
    font-size: var(--t-body-size);
    line-height: 1.45;
  }
</style>
