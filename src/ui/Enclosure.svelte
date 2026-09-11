<!--
  pulsar — Enclosure (Ivory).

  One centred slab, min(100% - 24px, 1120px) in BOTH workspaces (the width
  never jumps on the workspace switch), on a paper ground. The slab is a
  gradient face with a one-pixel border, a highlight along its top edge and a
  shaded lip along its bottom — shallow bevels and one light direction do the
  material work; there is no grain texture and there are no screws.

  Sections, top to bottom: head · settings (while open) · transport · live OR
  tracker · keytop · keys · foot. Each section owns its own vertical padding
  and rule, so the slab is a plain column and the phone order is one `order`
  swap: below 600px the keybed moves directly under the transport and the
  live modules (screen, then voice) follow it. The `.live` grid stacks to one
  column at 850px.

  Embedded (`html[data-embedded]`): the homepage window is the casing, so the
  slab fills the frame with no radius, border or shadow, and the page ground
  becomes the slab colour.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    brand: Snippet
    modes: Snippet
    settingsButton: Snippet
    output: Snippet
    /** The settings strip — present ONLY while the head's button is expanded. */
    settings?: Snippet | undefined
    transportRow: Snippet
    /** Screen module + voice section: the instrument workspace. */
    live: Snippet
    /** The tracker workspace — present ONLY while the editor is open and the
     *  viewport can show it. It replaces `live`; the keys stay. */
    tracker?: Snippet | undefined
    keytop: Snippet
    keys: Snippet
    foot: Snippet
  }
  let {
    brand,
    modes,
    settingsButton,
    output,
    settings,
    transportRow,
    live,
    tracker,
    keytop,
    keys,
    foot,
  }: Props = $props()
</script>

<div class="stage">
  <div class="device">
    <header class="area head">
      <div class="brand">{@render brand()}</div>
      <div class="modes">{@render modes()}</div>
      <div class="settings-toggle">{@render settingsButton()}</div>
      <div class="output">{@render output()}</div>
    </header>
    {#if settings}
      <div class="area settings">{@render settings()}</div>
    {/if}
    <div class="area transport">{@render transportRow()}</div>
    {#if tracker}
      <div class="area tracker">{@render tracker()}</div>
    {:else}
      <div class="area live">{@render live()}</div>
    {/if}
    <div class="area keytop">{@render keytop()}</div>
    <div class="area keys">{@render keys()}</div>
    <footer class="area foot">{@render foot()}</footer>
  </div>
</div>

<style>
  /* ONE column that can shrink to nothing: a bare `auto` track takes the
     slab's min-content width, and the slab's percentage width then resolves
     against that wider track — at 320px with 44px octave caps the keytop's
     min-content pushed the whole slab past the viewport. */
  .stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    place-items: start center;
    min-height: 100dvh;
    /* Notches and home bars: the desk extends under them, the slab does not
       (env() is 0 everywhere that has no insets, so desktop is unchanged). */
    padding:
      calc(var(--s-5) + env(safe-area-inset-top, 0px))
      calc(var(--s-3) + env(safe-area-inset-right, 0px))
      calc(var(--s-5) + env(safe-area-inset-bottom, 0px))
      calc(var(--s-3) + env(safe-area-inset-left, 0px));
    background: var(--page-bg);
  }

  .device {
    display: flex;
    flex-direction: column;
    min-width: 0;
    width: min(100% - 24px, 1120px);
    padding: 24px;
    color: var(--enclosure-ink);
    background-color: var(--enclosure-bg);
    background-image: var(--enclosure-face);
    border: 1px solid var(--enclosure-border);
    border-radius: var(--r-4);
    box-shadow: var(--sh-slab);
    transition:
      background-color var(--dur-med) var(--ease),
      color var(--dur-med) var(--ease);
  }

  .area {
    min-width: 0;
  }

  /* The head: wordmark left, the switch pushed right, then the two small
     modules. Wraps by itself on a tablet; on a phone the switch takes its own
     row (see the media rule below). */
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px 24px;
    padding-bottom: 22px;
    border-bottom: 1px solid var(--enclosure-hairline);
  }

  .head > .modes {
    margin-inline-start: auto;
  }

  .head > .brand,
  .head > .modes,
  .head > .settings-toggle,
  .head > .output {
    min-width: 0;
  }

  /* Screen module beside the voice section. */
  .live {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    padding-bottom: 24px;
  }

  /* A homepage window already supplies the outer frame. Fill its available
     width, preserving normal document scrolling on small and short screens. */
  :global([data-embedded]) .stage {
    padding: 0;
    background: var(--enclosure-bg);
  }
  :global([data-embedded]) .device {
    width: 100%;
    min-height: 100dvh;
    padding: 16px;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }
  /* Tighter vertical rhythm inside the casing (with TransportBar, KeyTop and
     ProjectBar's embedded rules, about 24px less in total). */
  :global([data-embedded]) .live {
    padding-bottom: 16px;
  }

  @media (max-width: 850px) {
    .device {
      padding: 14px;
    }
    .live {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
  }

  @media (max-width: 600px) {
    .stage {
      padding:
        calc(var(--s-4) + env(safe-area-inset-top, 0px))
        calc(var(--s-1) + env(safe-area-inset-right, 0px))
        calc(var(--s-4) + env(safe-area-inset-bottom, 0px))
        calc(var(--s-1) + env(safe-area-inset-left, 0px));
    }
    /* The phone keeps the slab; the desk margin shrinks to a rim so a
       2-dot lattice still fits inside the screen well at 320px. */
    .device {
      width: calc(100% - 8px);
    }
    :global([data-embedded]) .device {
      width: 100%;
      padding: 12px;
    }

    .head {
      gap: 12px;
      padding-bottom: 16px;
    }
    .head > .brand {
      --brand-size: 32px;
      order: 0;
      flex: 1 1 auto;
    }
    .head > .output {
      order: 1;
    }
    .head > .settings-toggle {
      order: 2;
    }
    .head > .modes {
      order: 3;
      flex-basis: 100%;
      margin-inline-start: 0;
    }

    /* Phone order: head, settings, transport, keytop, keys, live, foot. */
    .head {
      order: 0;
    }
    .settings {
      order: 1;
    }
    .transport {
      order: 2;
    }
    .keytop {
      order: 3;
    }
    .keys {
      order: 4;
    }
    .live,
    .tracker {
      order: 5;
      margin-top: 20px;
    }
    .foot {
      order: 6;
    }
  }
</style>
