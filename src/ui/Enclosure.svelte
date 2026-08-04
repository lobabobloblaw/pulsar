<!--
  pulsar — Enclosure (plan C1).

  One centred slab, min(100% - 24px, 960px), on a page ground one step darker
  than the slab so it reads as an object sitting on a surface rather than as the
  page itself.

  12-column grid, areas: brand/stat -> screen -> knob-a..d -> keys -> foot.
  Reflows at 720px (brand and status stack; the knob row goes 2x2) and at 560px
  (the keybed scrolls one octave at a time — see KeyBed.svelte).

  GRAIN: `.device::before` carries two background layers. The top layer is the
  generated tile at /textures/enclosure-grain-512.png; the bottom is an inline
  feTurbulence data URI that is mathematically seamless and needs no asset. A
  missing PNG layer simply does not paint and the procedural layer shows
  through, so the slab has its texture whether or not the asset pipeline has
  run. Both are zeroed under prefers-contrast: more.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    brand: Snippet
    status: Snippet
    screen: Snippet
    knobs: Snippet
    keys: Snippet
    foot?: Snippet
    /** Phase-2 design §4.1: one grid area, `tracker`, between the screen and
     *  the knobs — present ONLY when the panel is open. The live-play shell is
     *  the Phase-1 product and it does not regress when this is absent. */
    tracker?: Snippet | undefined
  }
  let { brand, status, screen, knobs, keys, foot, tracker }: Props = $props()
</script>

<div class="stage">
  <div class="device" class:with-tracker={tracker !== undefined}>
    <header class="area brand">{@render brand()}</header>
    <div class="area stat">{@render status()}</div>
    <div class="area screen">{@render screen()}</div>
    {#if tracker}
      <div class="area tracker">{@render tracker()}</div>
    {/if}
    <div class="area knobs">{@render knobs()}</div>
    <div class="area keys">{@render keys()}</div>
    <footer class="area foot">
      {#if foot}{@render foot()}{/if}
    </footer>
  </div>
</div>

<style>
  .stage {
    display: grid;
    place-items: start center;
    min-height: 100dvh;
    padding: var(--s-4) var(--s-3);
    background: var(--page-bg);
  }

  .device {
    position: relative;
    isolation: isolate;
    width: min(100% - 24px, 960px);
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-areas:
      'brand brand brand brand brand brand stat stat stat stat stat stat'
      'screen screen screen screen screen screen screen screen screen screen screen screen'
      'knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs'
      'keys keys keys keys keys keys keys keys keys keys keys keys'
      'foot foot foot foot foot foot foot foot foot foot foot foot';
    gap: var(--s-4);
    padding: var(--s-5);
    background: var(--enclosure-bg);
    border-radius: var(--r-4);
    box-shadow: var(--sh-inset);
    transition:
      background-color var(--dur-med) var(--ease),
      color var(--dur-med) var(--ease);
  }

  /* The tracker turns the instrument into a workbench: the slab keeps its
     Phase-1 width until the panel opens, then takes the room an 8-channel grid
     plus its two plain-DOM editors actually needs. Width is not transitioned —
     a slab that eases open reads as a webpage, not as a device. */
  .device.with-tracker {
    width: min(100% - 24px, 1240px);
    grid-template-areas:
      'brand brand brand brand brand brand stat stat stat stat stat stat'
      'screen screen screen screen screen screen screen screen screen screen screen screen'
      'tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker'
      'knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs'
      'keys keys keys keys keys keys keys keys keys keys keys keys'
      'foot foot foot foot foot foot foot foot foot foot foot foot';
  }

  .device::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    background-image:
      url('/textures/enclosure-grain-512.png'),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E");
    background-repeat: repeat, repeat;
    background-size:
      256px 256px,
      256px 256px;
    opacity: 0.05;
    mix-blend-mode: multiply;
  }

  @media (prefers-contrast: more) {
    .device::before {
      opacity: 0;
    }
  }

  .brand {
    grid-area: brand;
    align-self: center;
  }
  .stat {
    grid-area: stat;
    align-self: center;
  }
  .screen {
    grid-area: screen;
  }
  .tracker {
    grid-area: tracker;
  }
  .knobs {
    grid-area: knobs;
  }
  .keys {
    grid-area: keys;
  }
  .foot {
    grid-area: foot;
  }

  .area {
    min-width: 0;
  }

  @media (max-width: 720px) {
    .device,
    .device.with-tracker {
      grid-template-areas:
        'brand brand brand brand brand brand brand brand brand brand brand brand'
        'stat stat stat stat stat stat stat stat stat stat stat stat'
        'screen screen screen screen screen screen screen screen screen screen screen screen'
        'tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker'
        'knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs'
        'keys keys keys keys keys keys keys keys keys keys keys keys'
        'foot foot foot foot foot foot foot foot foot foot foot foot';
      padding: var(--s-4);
      gap: var(--s-4) var(--s-3);
    }
  }

  @media (max-width: 560px) {
    .stage {
      padding: var(--s-4) var(--s-2);
    }
    .device {
      border-radius: var(--r-3);
    }
  }
</style>
