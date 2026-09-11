<!--
  pulsar — the voice section (Ivory).

  Three dials — duty, level, sweep — under a caption row that says what they
  shape (VOICE / PULSE 1) and when (LIVE ONLY). While a song plays the driver
  owns the timeline, so the dials are disabled and the caption says STOP SONG
  TO SHAPE; they come back the moment playback stops. The master output is
  not here and never was a voice control: it lives in the head, in both
  workspaces, so it stays reachable during playback.
-->
<script lang="ts">
  import { VOICE_KNOBS, type ParamId } from '../audio/params'
  import { tracker } from '../state/tracker.svelte'
  import Knob from './Knob.svelte'

  /** The printed range under each value, keyed by parameter. */
  const DETAIL: Readonly<Partial<Record<ParamId, string>>> = {
    'pulse1.duty': '4 pulse widths',
    'pulse1.envDecay': '0 — 15',
    'pulse1.sweep': '−7 — +7',
  }
</script>

<section class="voice" aria-label="voice controls">
  <div class="caps">
    <span class="t-micro">Voice / Pulse 1</span>
    <span class="t-micro">{tracker.playing ? 'Stop song to shape' : 'Live only'}</span>
  </div>
  <div class="dials">
    {#each VOICE_KNOBS as id (id)}
      <Knob {id} disabled={tracker.playing} detail={DETAIL[id] ?? ''} />
    {/each}
  </div>
</section>

<style>
  .voice {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 6px 0;
  }

  .caps {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .dials {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    padding: 28px 0;
  }

  @media (max-width: 600px) {
    .dials {
      gap: 12px;
      padding: 20px 0 12px;
    }
  }

  @media (max-width: 360px) {
    .dials {
      gap: 6px;
    }
  }
</style>
