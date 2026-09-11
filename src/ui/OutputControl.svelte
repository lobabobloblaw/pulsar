<!--
  pulsar — the master output (Ivory).

  Output has a permanent position in the head, in both workspaces and during
  song playback, because it is the one parameter that must never become
  unreachable: a song playing at the wrong volume needs the fader now. It is a
  native range input on top of the same `params.set('master.volume')` path the
  old fourth knob used — the store still clamps, quantises to 0.01 and pushes
  the value to the bridge; nothing here talks to audio.
-->
<script lang="ts">
  import { params } from '../state/params.svelte'

  const percent = $derived(Math.round(params.get('master.volume') * 100))
  const text = $derived(params.format('master.volume'))

  function onInput(e: Event): void {
    params.set('master.volume', Number((e.currentTarget as HTMLInputElement).value) / 100)
  }
</script>

<div class="output">
  <div class="row">
    <span class="name">Output</span>
    <output class="value" for="master-output">{text}</output>
  </div>
  <input
    id="master-output"
    type="range"
    min="0"
    max="100"
    step="1"
    value={percent}
    aria-label="Master output"
    oninput={onInput}
  />
</div>

<style>
  .output {
    width: 112px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--enclosure-ink);
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .value {
    font-family: var(--font-ui);
    font-variant-numeric: tabular-nums;
  }

  input[type='range'] {
    display: block;
    width: 100%;
    margin: 4px 0 0;
    accent-color: var(--enclosure-ink);
    cursor: ew-resize;
  }

  input[type='range']:focus-visible {
    outline: none;
    box-shadow: var(--focus);
    border-radius: var(--r-1);
  }

  @media (pointer: coarse) {
    input[type='range'] {
      margin-top: 0;
    }
  }

  /* Phones: the caption sits inside the fader's own 44px box (the track is
     drawn at its vertical centre, under the caption), so the head row is one
     touch target tall instead of a caption plus a target. */
  @media (max-width: 600px) {
    .output {
      position: relative;
      width: 100px;
      height: 44px;
    }
    .row {
      position: absolute;
      inset: 0 0 auto;
      pointer-events: none;
    }
    input[type='range'] {
      position: absolute;
      inset: 0;
      height: 100%;
      margin: 0;
    }
  }

  @media (max-width: 360px) {
    .output {
      width: 88px;
    }
  }
</style>
