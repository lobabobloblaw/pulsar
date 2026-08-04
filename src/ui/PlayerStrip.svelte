<!--
  pulsar — the phone player (mobile plan pillar 2, 2026-08-04).

  Below the workbench threshold the tracker cannot open, but the album must
  still play: one play/stop cap and the songs picker, living under the screen.
  It renders wherever the screen renders and shows itself only under 721px, so
  the enclosure grid never learns a new area and the desktop shell stays
  byte-identical. Playback rides the exact wiring the panel uses — the tracker
  store's togglePlay and PresetBar's load path — and the tap that starts it is
  the user gesture the audio bridge's resume logic wants anyway.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'
  import Icon from './Icon.svelte'
  import PresetBar from './tracker/PresetBar.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  function toggle(): void {
    tracker.togglePlay('row')
    // The song page narrates playback; params returns when the strip stops it.
    transport.setPage(tracker.playing ? 'song' : 'params')
  }
</script>

<div class="player">
  <span class="keyed">
    <button
      type="button"
      class="key"
      aria-pressed={tracker.playing}
      aria-label={tracker.playing ? 'stop' : 'play'}
      onclick={toggle}
    >
      {#if tracker.playing}<Icon name="stop" />{:else}<Icon name="play" />{/if}
    </button>
    <span class="silk">{tracker.playing ? 'stop' : 'play'}</span>
  </span>
  <PresetBar {announce} />
</div>

<style>
  .player {
    display: none;
  }

  @media (max-width: 720px) {
    .player {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--s-3);
      padding-top: var(--s-2);
    }
  }
</style>
