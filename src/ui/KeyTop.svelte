<!--
  pulsar — the keytop row (Ivory).

  The printed line above the keybed: what the keys currently do, the octave
  with its two caps, and the QWERTY hint. The scope caption is the honest
  answer to "where does a key go right now" — into the live pulse 1 voice,
  into the tracker lane under the cursor while edit mode is on, or through the
  driver's takeover of the cursor lane while the song plays.

  The octave caps replace the old keybed range buttons: on a phone the bed
  shows one octave and these move it (see KeyBed.svelte).
-->
<script lang="ts">
  import { song } from '../state/song.svelte'
  import { CHANNEL_LABELS } from '../state/songModel'
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'

  interface Props {
    /** App's `(max-width: 720px)` state: the editor is not on screen below it. */
    compact: boolean
  }
  let { compact }: Props = $props()

  const lane = $derived(
    (CHANNEL_LABELS[song.doc.channels[tracker.channel] ?? 'pulse1'] ?? 'pulse 1').toUpperCase(),
  )

  const scope = $derived.by(() => {
    if (tracker.open && tracker.editing && !compact) return `WRITE / ${lane} · STEP ${tracker.editStep}`
    if (tracker.playing) return `LIVE TAKEOVER / ${lane}`
    return 'PLAY / LIVE PULSE 1'
  })
</script>

<div class="keytop">
  <span class="t-micro scope">{scope}</span>
  <div class="octave">
    <button
      type="button"
      class="key mini"
      aria-label="Lower octave"
      disabled={transport.octave <= 0}
      onclick={() => transport.setOctave(transport.octave - 1)}
    >
      −
    </button>
    <span class="t-micro reading">Octave <strong>{transport.octave}</strong></span>
    <button
      type="button"
      class="key mini"
      aria-label="Higher octave"
      disabled={transport.octave >= 8}
      onclick={() => transport.setOctave(transport.octave + 1)}
    >
      +
    </button>
  </div>
  <span class="t-micro hint">Z–M / Q–I</span>
</div>

<style>
  .keytop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 0;
    border-top: 1px solid var(--enclosure-hairline);
  }

  .scope,
  .hint {
    letter-spacing: 0.7px;
    white-space: nowrap;
  }

  .octave {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .reading {
    white-space: nowrap;
  }

  .reading strong {
    font-weight: 700;
    color: var(--enclosure-ink);
  }

  .octave .key {
    min-height: 28px;
    padding: 2px 10px;
    font-family: var(--font-ui);
    font-size: 13px;
  }

  @media (pointer: coarse) {
    .octave .key {
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (max-width: 600px) {
    .hint {
      display: none;
    }
    .octave {
      gap: 8px;
    }
  }
</style>
