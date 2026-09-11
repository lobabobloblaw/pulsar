<!--
  pulsar — the settings strip (Ivory; replaces StatusBar).

  A full-width strip under the head, shown while the head's Settings button is
  expanded. Everything on it is a real control or a real status: the console
  model and the room are native selects over the transport store, MIDI is a
  Connect button until the permission outcome is known and printed status
  afterwards, and audio is printed status. The explanatory sentences moved
  here from the old StatusBar's `note` unchanged; the audio-failure sentence
  went to the transport row, beside the Retry cap it refers to.

  The dev-only transport/fps readout stays, printed after the audio status.
-->
<script lang="ts">
  import { transport, type ConsoleModel, type Room } from '../state/transport.svelte'

  interface Props {
    /** The strip's element id — the head's Settings button points `aria-controls` at it. */
    id: string
    onConnectMidi: () => void
  }
  let { id, onConnectMidi }: Props = $props()

  const dev = import.meta.env.DEV

  const midiText = $derived.by(() => {
    const m = transport.midi
    if (!m.supported) return 'MIDI · Unavailable in this browser'
    switch (m.permission) {
      case 'granted':
        return m.ports.length === 0
          ? 'MIDI · No devices'
          : `MIDI · ${m.ports.length} ${m.ports.length === 1 ? 'device' : 'devices'}`
      case 'blocked':
        return 'MIDI · Blocked'
      case 'denied':
        return 'MIDI · Denied'
      case 'unavailable':
        return 'MIDI · Unavailable in this browser'
      default:
        return 'MIDI · Not connected'
    }
  })

  const audioText = $derived.by(() => {
    const a = transport.audio
    if (a.state === 'running') return `Audio · Running ${Math.round(a.sampleRate / 1000)}k`
    if (a.state === 'starting') return 'Audio · Starting'
    if (a.state === 'error') return 'Audio · Error'
    return 'Audio · Idle'
  })

  /** At most one note at a time: the most actionable MIDI problem wins. */
  const note = $derived.by(() => {
    const m = transport.midi
    if (!m.supported) return ''
    if (m.permission === 'blocked') {
      return 'Firefox needs the site permission add-on for Web MIDI. Install it, then reload and allow MIDI.'
    }
    if (m.permission === 'denied') {
      return 'MIDI access was refused. Reload the page and choose allow to use a hardware keyboard.'
    }
    if (m.permission === 'granted' && m.ports.length === 0) {
      return 'No MIDI devices yet. Plug one in — pulsar picks it up live, no reload needed.'
    }
    return ''
  })

  const connectable = $derived(transport.midi.supported && transport.midi.permission === 'unknown')
</script>

<div class="settings" {id}>
  <label class="field">
    <span>Console</span>
    <select
      class="window"
      value={transport.consoleModel}
      onchange={(e) => transport.setModel(e.currentTarget.value as ConsoleModel)}
    >
      <option value="nes">NES</option>
      <option value="famicom">Famicom</option>
    </select>
  </label>

  <label class="field">
    <span>Room</span>
    <select
      class="window"
      value={transport.room}
      onchange={(e) => transport.setRoom(e.currentTarget.value as Room)}
    >
      <option value="day">Day</option>
      <option value="night">Night</option>
    </select>
  </label>

  {#if connectable}
    <button type="button" class="key" onclick={onConnectMidi}>Connect MIDI</button>
  {:else}
    <span class="status">{midiText}</span>
  {/if}

  <span class="status">
    {audioText}{#if dev}
      · {transport.audio.transport} · {transport.fps} fps{/if}
  </span>

  {#if note}
    <p class="note" role="status">{note}</p>
  {/if}
</div>

<style>
  .settings {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 20px;
    padding: 16px 0;
    border-bottom: 1px solid var(--enclosure-hairline);
  }

  .field {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    font-size: var(--t-ui-size);
    color: var(--enclosure-ink);
  }

  .field select {
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
  }

  .status {
    font-size: var(--t-ui-size);
    color: var(--enclosure-ink-2);
    white-space: nowrap;
  }

  .note {
    flex-basis: 100%;
    margin: 0;
    font-size: var(--t-body-size);
    line-height: 1.5;
    color: var(--enclosure-ink-2);
  }
</style>
