<!--
  pulsar — the workspace switch (Ivory, phone pages).

  One segmented control, two positions. On a wide window they are Instrument
  and Tracker: the only way the tracker opens, reading back the state the
  app is actually in. Below App's compact threshold the tracker has no
  layout, so the same control pages the phone instead: Play (keytop and
  keybed) and Voice (screen well and dials) — session state App owns, never
  persisted. No segment is disabled at any width.

  Opening the tracker turns the screen to the song page and closing restores
  the params page. `tracker.open` persists for the session either way:
  shrinking to a phone shows the pages, growing back restores the editor
  over the same song and cursor (docs/homepage-integration.md).
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'
  import type { PhonePage } from './pages'

  interface Props {
    /** App's `(max-width: 720px)` state: the tracker has no phone layout. */
    compact: boolean
    /** The phone page App owns; only rendered while compact. */
    phonePage: PhonePage
    onPhonePage: (page: PhonePage) => void
  }
  let { compact, phonePage, onPhonePage }: Props = $props()

  const trackerShown = $derived(tracker.open && !compact)

  /** Guards on the RENDERED state, never on `tracker.open`: the editor can be
   *  open but hidden, and a click on the pressed segment must be a no-op —
   *  toggling the hidden editor would also stop a playing song
   *  (`toggleOpen` stops playback on close). */
  function setMode(open: boolean): void {
    if (trackerShown === open) return
    tracker.toggleOpen()
    transport.setPage(tracker.open ? 'song' : 'params')
  }
</script>

<nav class="modes" aria-label="Workspace">
  {#if compact}
    <button type="button" aria-pressed={phonePage === 'play'} onclick={() => onPhonePage('play')}>
      Play
    </button>
    <button type="button" aria-pressed={phonePage === 'voice'} onclick={() => onPhonePage('voice')}>
      Voice
    </button>
  {:else}
    <button type="button" aria-pressed={!trackerShown} onclick={() => setMode(false)}>Instrument</button>
    <button type="button" aria-pressed={trackerShown} onclick={() => setMode(true)}>Tracker</button>
  {/if}
</nav>

<style>
  /* A recessed track holding two segments; the pressed segment is the raised
     cap. Reads as one control because the track, not the segments, carries
     the outline. */
  .modes {
    display: flex;
    gap: 3px;
    padding: 3px;
    background: rgb(0 0 0 / 0.07);
    border-radius: var(--r-2);
  }

  .modes button {
    min-height: 36px;
    padding: 9px 12px;
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
    line-height: 1.2;
    white-space: nowrap;
    color: var(--enclosure-ink);
    background: transparent;
    border: 0;
    border-radius: var(--r-cap);
    cursor: pointer;
  }

  .modes button[aria-pressed='true'] {
    background: var(--chip-bg);
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.13);
  }

  :global([data-room='night']) .modes {
    background: rgb(0 0 0 / 0.35);
  }

  :global([data-room='night']) .modes button[aria-pressed='true'] {
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.5);
  }

  .modes button:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  @media (prefers-contrast: more) {
    .modes button[aria-pressed='true'] {
      box-shadow: inset 0 0 0 1px var(--enclosure-ink);
    }
  }

  @media (pointer: coarse) {
    .modes button {
      min-height: 44px;
    }
  }

  /* The phone head: the switch takes its own full-width row. */
  @media (max-width: 600px) {
    .modes {
      width: 100%;
    }
    .modes button {
      flex: 1 1 0;
      min-width: 0;
    }
  }
</style>
