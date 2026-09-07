<!--
  pulsar — the knob row (plan C1/C4).

  Four knobs, left to right, in registry order. The row is a labelled group so a
  screen-reader rotor lists "voice controls" once rather than four orphan
  sliders. The knobs stay 56px AND stay one row at every size — a control that
  changes size changes feel, and four 56px dials fit even a 320px phone. The
  old 2x2 reflow at 720px cost ~126px of height, which on a real iPhone (where
  Safari's chrome already eats ~180px) was exactly the difference between the
  instrument fitting the first screen and scrolling.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { params } from '../state/params.svelte'
  import Knob from './Knob.svelte'

  const AREAS = ['knob-a', 'knob-b', 'knob-c', 'knob-d'] as const
</script>

<section class="knobs" aria-label="voice controls">
  {#if tracker.playing}
    <div class="playback-note"><strong>Song playback</strong><span>The piano plays along. Voice controls return when the song stops.</span></div>
    <div class="slot" style:grid-area="knob-d"><Knob id="master.volume" /></div>
  {:else}
    {#each params.knobs as id, i (id)}
      <div class="slot" style:grid-area={AREAS[i]}><Knob {id} /></div>
    {/each}
  {/if}
</section>

<style>
  .knobs {
    display: grid;
    grid-template-areas: 'knob-a knob-b knob-c knob-d';
    grid-template-columns: repeat(4, 1fr);
    align-items: start;
    gap: var(--s-5) var(--s-4);
    padding: var(--s-3) 0;
    border-top: 1px solid var(--enclosure-hairline);
    border-bottom: 1px solid var(--enclosure-hairline);
  }

  .playback-note { grid-column: 1 / 4; grid-row: 1; align-self: center; display: grid; gap: 4px; font-size: 12px; line-height: 1.5; }

  .slot {
    display: grid;
    justify-items: center;
  }

  @media (max-width: 720px) {
    .knobs {
      gap: var(--s-3) var(--s-2);
    }
  }
</style>
