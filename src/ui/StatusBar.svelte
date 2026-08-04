<!--
  pulsar — StatusBar (plan C10).

  Chips carry live capability state: audio · midi · sab · room · model · [dev] fps.
  Every chip is set on a white ground, which is the only place blue text clears
  4.5:1 in this palette (5.20:1). No state is ever colour alone — the 6px status
  dot always sits next to words that say the same thing.

  Capability copy is lowercase, does not apologise, and names the fix. A dead
  control with no explanation is worse than no control.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'
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
</script>

<div class="status">
  <div class="chips">
    {#if transport.audio.state === 'running' || transport.audio.state === 'starting'}
      <span class="chip t-micro">
        <span class="dot {audioTone}" aria-hidden="true"></span>
        {audioChip}
      </span>
    {:else}
      <button type="button" class="chip t-micro action" onclick={onStartAudio}>
        <span class="dot {audioTone}" aria-hidden="true"></span>
        {audioChip} · start
      </button>
    {/if}

    {#if transport.midi.supported && transport.midi.permission === 'unknown'}
      <button type="button" class="chip t-micro action" onclick={onConnectMidi}>{midiChip}</button>
    {:else}
      <span class="chip t-micro">{midiChip}</span>
    {/if}

    <span class="chip t-micro">sab {sabOn ? 'on' : 'off'}</span>

    <!-- The tracker panel is opt-in from here (design §4.1). -->
    <button
      type="button"
      class="chip t-micro action"
      aria-pressed={tracker.open}
      onclick={() => tracker.toggleOpen()}
    >
      tracker
    </button>

    <button
      type="button"
      class="chip t-micro action"
      aria-pressed={transport.room === 'night'}
      onclick={() => transport.toggleRoom()}
    >
      room: {transport.room}
    </button>

    <button
      type="button"
      class="chip t-micro action"
      aria-pressed={transport.consoleModel === 'famicom'}
      onclick={() => transport.toggleModel()}
    >
      model: {transport.consoleModel}
    </button>

    {#if dev}
      <span class="chip t-micro">fps {transport.fps}</span>
    {/if}
  </div>

  <div class="meter">
    <Meter mode="level" label="out" />
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

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--s-1);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--s-1);
    padding: 3px var(--s-2);
    background: var(--chip-bg);
    color: var(--chip-ink);
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
    white-space: nowrap;
  }

  /* Blue text is legal here and nowhere else on the enclosure: 5.20:1 on white. */
  .action {
    color: var(--chip-accent);
  }

  .action:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .action[aria-pressed='true'] {
    background: var(--chip-accent);
    color: var(--n-000);
    box-shadow: none;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--r-max);
    background: var(--a-gray);
  }

  .dot.ok {
    background: var(--st-ok);
  }

  .dot.bad {
    background: var(--st-bad);
  }

  .meter {
    display: flex;
    justify-content: flex-end;
  }

  .note {
    max-width: 46ch;
    text-align: right;
    color: var(--enclosure-ink-2);
    font-size: var(--t-body-size);
    line-height: 1.45;
  }
</style>
