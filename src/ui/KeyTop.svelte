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
      aria-label="− lower octave"
      disabled={transport.octave <= 0}
      onclick={() => transport.setOctave(transport.octave - 1)}
    >
      −
    </button>
    <span class="t-micro reading">Octave <strong>{transport.octave}</strong></span>
    <button
      type="button"
      class="key mini"
      aria-label="+ higher octave"
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 12px;
    min-width: 0;
    padding: 14px 0;
    border-top: 1px solid var(--enclosure-hairline);
  }

  :global([data-embedded]) .keytop {
    padding: 10px 0;
  }

  .scope,
  .hint {
    min-width: 0;
    letter-spacing: 0.7px;
    white-space: nowrap;
  }

  .scope {
    overflow: hidden;
    text-overflow: ellipsis;
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

  /* The phone: the caption takes its own line above the octave group, so
     the row's min-content is the octave group alone and 44px caps still fit
     at 320px. */
  @media (max-width: 600px) {
    .hint {
      display: none;
    }
    .scope {
      flex-basis: 100%;
      white-space: normal;
    }
    .octave {
      gap: 8px;
    }
  }

  @media (max-width: 360px) {
    .keytop,
    :global([data-embedded]) .keytop {
      gap: 6px 12px;
      padding: 6px 0;
    }
  }
</style>
