<!--
  pulsar — Meter (plan C10).

  Two modes, one renderer, one primitive:
    level  24x3 dots with a 1.2s peak hold and a clip dot. It sits on the
           aluminium, so it is an UNLIT readout — ink dots on the enclosure,
           never a second lit object competing with the screen.
    scope  a 256-sample zero-crossing-aligned trace on its own lattice.

  The screen's scope PAGE calls the same `drawScope` on the shared 128x64
  lattice (see Screen.svelte), so there is exactly one trace implementation in
  the codebase regardless of which surface it lands on.

  Source arrays are read inside the single rAF only, never in an $effect. The
  numeric readout is written straight to the text node through `bind:this` for
  the same reason the canvas is a canvas: C2 says the frame loop never writes
  $state, and a 4 Hz rune write is still a 4 Hz reactive invalidation that runs
  for as long as the page is open. `textContent` on a node nothing else renders
  is the frame path's equivalent of a canvas draw.
-->
<script lang="ts">
  import { bridge } from '../audio/bridge'
  import { transport } from '../state/transport.svelte'
  import { DotMatrix } from './canvas/dotMatrix'
  import {
    LEVEL_COLS,
    LEVEL_ROWS,
    LevelState,
    drawLevel,
    drawScope,
    drawScopeFrame,
    levelText,
  } from './canvas/meterRenderer'
  import { useFrame } from './frame'

  interface Props {
    mode?: 'level' | 'scope'
    /** Show the numeric readout beside the dots. Never colour alone. */
    showText?: boolean
    label?: string
  }
  let { mode = 'level', showText = true, label = 'output' }: Props = $props()

  const audio = bridge()
  const frame = useFrame()
  const level = new LevelState()

  let canvas = $state<HTMLCanvasElement | null>(null)
  /** The readout's text node owner. Written from the frame loop, never read in
   *  the template — so nothing invalidates when the level changes. */
  let readout = $state<HTMLSpanElement | null>(null)
  let dm: DotMatrix | null = null
  let lastTextAt = 0
  let lastText = 'silent'

  const cols = $derived(mode === 'level' ? LEVEL_COLS : 128)
  const rows = $derived(mode === 'level' ? LEVEL_ROWS : 24)

  /** Resolve the room-dependent enclosure tokens for the canvas, which cannot
   *  read custom properties itself. Re-run whenever the room changes. */
  function applyPalette(el: HTMLCanvasElement, matrix: DotMatrix): void {
    const cs = getComputedStyle(el)
    const bg = cs.getPropertyValue('--enclosure-bg').trim() || '#d8d8d8'
    const off = cs.getPropertyValue('--enclosure-hairline').trim() || '#a8a8a8'
    matrix.setPalette(bg, off)
  }

  function colors(el: HTMLCanvasElement): { on: string; peak: string; clip: string } {
    const cs = getComputedStyle(el)
    return {
      on: cs.getPropertyValue('--enclosure-ink').trim() || '#181818',
      peak: cs.getPropertyValue('--enclosure-accent').trim() || '#1270b8',
      clip: cs.getPropertyValue('--a-red').trim() || '#ce2021',
    }
  }

  let palette = $state({ on: '#181818', peak: '#1270b8', clip: '#ce2021' })

  $effect(() => {
    const el = canvas
    if (!el) return
    const matrix = new DotMatrix(el, {
      cols,
      rows,
      dotMin: mode === 'level' ? 2 : 2,
      dotMax: mode === 'level' ? 4 : 4,
    })
    dm = matrix
    matrix.resize(cols * 4)
    if (mode === 'level') {
      applyPalette(el, matrix)
      palette = colors(el)
    }

    const stop = frame.subscribe((now) => {
      if (mode === 'level') {
        matrix.beginFrame()
        drawLevel(matrix, audio.meter, level, now, palette)
        matrix.endFrame()
        if (showText && now - lastTextAt > 250) {
          lastTextAt = now
          const next = levelText(audio.meter)
          const el = readout
          if (el !== null && next !== lastText) {
            lastText = next
            el.textContent = next
          }
        }
      } else {
        matrix.beginFrame()
        drawScopeFrame(matrix, { x: 0, y: 0, w: matrix.cols, h: matrix.rows })
        drawScope(matrix, audio.scope, { x: 0, y: 0, w: matrix.cols, h: matrix.rows })
        matrix.endFrame()
      }
    })

    return () => {
      stop()
      matrix.destroy()
      dm = null
    }
  })

  // The room dimmer changes the surface the level meter is drawn on.
  $effect(() => {
    const room = transport.room
    const el = canvas
    const matrix = dm
    if (!el || !matrix || mode !== 'level') return
    void room
    applyPalette(el, matrix)
    palette = colors(el)
  })
</script>

<div class="meter" class:scope={mode === 'scope'}>
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  {#if showText}
    <span class="read t-micro">{label} <span bind:this={readout}>silent</span></span>
  {/if}
</div>

<style>
  .meter {
    display: flex;
    align-items: center;
    gap: var(--s-2);
  }

  canvas {
    image-rendering: pixelated;
  }

  .read {
    color: var(--enclosure-ink-2);
    white-space: nowrap;
  }

  .scope canvas {
    width: 100%;
  }
</style>
