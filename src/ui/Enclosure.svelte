<!--
  pulsar — Enclosure (plan C1).

  One centred slab, min(100% - 24px, 960px), on a page ground one step darker
  than the slab so it reads as an object sitting on a surface rather than as the
  page itself.

  12-column grid, areas: brand/stat -> screen -> knob-a..d -> keys -> foot.
  With the tracker open the panel REPLACES the screen and knob rows (§4.1 as
  amended by the 2026-08-04 UI audit): the panel hosts the screen in its own
  left pane and the knobs return when it closes — the stacked five-row shape
  was ~2x a laptop viewport. Reflows at 720px (brand and status stack; the
  knob row goes 2x2) and at 560px (the keybed scrolls one octave at a time —
  see KeyBed.svelte).

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
    <!-- Four machined screws, slots at the uneven angles assembly leaves
         behind. Furniture, not information: hidden from the tree. -->
    <span class="screw" aria-hidden="true"></span>
    <span class="screw" aria-hidden="true"></span>
    <span class="screw" aria-hidden="true"></span>
    <span class="screw" aria-hidden="true"></span>
    <header class="area brand">{@render brand()}</header>
    <div class="area stat">{@render status()}</div>
    {#if tracker}
      <div class="area tracker">{@render tracker()}</div>
    {:else}
      <div class="area screen">{@render screen()}</div>
      <div class="area knobs">{@render knobs()}</div>
    {/if}
    <div class="area keys">{@render keys()}</div>
    <footer class="area foot">
      {#if foot}{@render foot()}{/if}
    </footer>
  </div>
</div>

<style>
  /* Light falls from above the desk, so the object below can cast a shadow
     into something. */
  .stage {
    display: grid;
    place-items: start center;
    min-height: 100dvh;
    padding: var(--s-4) var(--s-3);
    background: radial-gradient(
        120% 90% at 50% -10%,
        rgb(255 255 255 / 0.07),
        rgb(0 0 0 / 0.05) 70%
      ),
      var(--page-bg);
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
    /* The faintest vertical sheen over the paint — machined face, not flat
       fill. The grain layer in ::before does the micro texture. */
    background-image: linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(0 0 0 / 0.04));
    background-color: var(--enclosure-bg);
    border-radius: var(--r-4);
    box-shadow: var(--sh-slab);
    transition:
      background-color var(--dur-med) var(--ease),
      color var(--dur-med) var(--ease);
  }

  /* The tracker turns the instrument into a workbench: the slab keeps its
     Phase-1 width until the panel opens, then takes the room the grid and its
     two plain-DOM editors actually need — and the panel row REPLACES the
     screen and knob rows, because the workbench has to fit the viewport the
     live shell fits (the screen re-homes into the panel's left pane; the
     knobs return on close). Width is not transitioned — a slab that eases
     open reads as a webpage, not as a device. */
  .device.with-tracker {
    width: min(100% - 24px, 1240px);
    grid-template-areas:
      'brand brand brand brand brand brand stat stat stat stat stat stat'
      'tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker'
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
    .device,
    .stage {
      background-image: none;
    }
  }

  .screw {
    position: absolute;
    width: 9px;
    height: 9px;
    border-radius: var(--r-max);
    background:
      radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.75), rgb(0 0 0 / 0.1) 55%, rgb(0 0 0 / 0.4)),
      var(--enclosure-bg);
    box-shadow:
      inset 0 1px 2px rgb(0 0 0 / 0.45),
      0 1px 0 rgb(255 255 255 / 0.35);
  }

  .screw::after {
    content: '';
    position: absolute;
    inset: 50% 1.5px auto;
    height: 1.5px;
    margin-top: -0.75px;
    border-radius: 1px;
    background: rgb(0 0 0 / 0.55);
  }

  .screw:nth-of-type(1) {
    top: 10px;
    left: 10px;
    transform: rotate(23deg);
  }
  .screw:nth-of-type(2) {
    top: 10px;
    right: 10px;
    transform: rotate(-64deg);
  }
  .screw:nth-of-type(3) {
    bottom: 10px;
    left: 10px;
    transform: rotate(81deg);
  }
  .screw:nth-of-type(4) {
    bottom: 10px;
    right: 10px;
    transform: rotate(-12deg);
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
    .device {
      grid-template-areas:
        'brand brand brand brand brand brand brand brand brand brand brand brand'
        'stat stat stat stat stat stat stat stat stat stat stat stat'
        'screen screen screen screen screen screen screen screen screen screen screen screen'
        'knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs knobs'
        'keys keys keys keys keys keys keys keys keys keys keys keys'
        'foot foot foot foot foot foot foot foot foot foot foot foot';
      padding: var(--s-4);
      gap: var(--s-4) var(--s-3);
    }

    .device.with-tracker {
      grid-template-areas:
        'brand brand brand brand brand brand brand brand brand brand brand brand'
        'stat stat stat stat stat stat stat stat stat stat stat stat'
        'tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker tracker'
        'keys keys keys keys keys keys keys keys keys keys keys keys'
        'foot foot foot foot foot foot foot foot foot foot foot foot';
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
