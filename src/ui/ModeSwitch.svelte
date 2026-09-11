<!--
  pulsar — the workspace switch (Ivory).

  One segmented control, two positions: Instrument and Tracker. It is the only
  way the tracker opens, and it reads back the state the app is actually in:
  `tracker.open` persists for the session, but below App's compact threshold
  the editor cannot be shown, so the Tracker segment is disabled and says why,
  and the Instrument segment reads pressed because that is the workspace on
  screen. Resizing back up restores the editor over the same song and cursor
  — the persisted flag is the contract (docs/homepage-integration.md).

  Opening turns the screen to the song page and closing restores the params
  page — the page follow the old StatusBar chip performed.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { transport } from '../state/transport.svelte'

  interface Props {
    /** App's `(max-width: 720px)` state: the tracker has no phone layout. */
    compact: boolean
  }
  let { compact }: Props = $props()

  const trackerShown = $derived(tracker.open && !compact)

  function setMode(open: boolean): void {
    if (tracker.open === open) return
    tracker.toggleOpen()
    transport.setPage(tracker.open ? 'song' : 'params')
  }
</script>

<nav class="modes" aria-label="Workspace">
  <button type="button" aria-pressed={!trackerShown} onclick={() => setMode(false)}>Instrument</button>
  <button
    type="button"
    aria-pressed={trackerShown}
    disabled={compact}
    onclick={() => setMode(true)}
  >
    {compact ? 'Tracker · wider screen' : 'Tracker'}
  </button>
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

  .modes button:disabled {
    opacity: 0.4;
    cursor: default;
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
      white-space: normal;
    }
  }
</style>
