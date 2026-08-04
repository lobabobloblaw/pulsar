<!--
  pulsar — Screen (plan C9).

  A 128x64 dot lattice in a recessed well. The only lit object on the page.

  Sizing: the canvas takes exactly 128*DOT x 64*DOT CSS pixels and the leftover
  width of the well becomes bezel, so the dot pitch is always an integer and the
  lattice never resamples. See dotMatrix.ts for the DPR rule.

  Pages: boot, params, scope, midi. The boot sequence dissolves INTO the params
  page — it is handed the params renderer as its underlay, which is why the two
  are the same function and not two drawings of the same thing.

  The canvas is aria-hidden and everything it shows is mirrored as text for
  assistive tech. A screen that only exists as pixels is not a screen.
-->
<script lang="ts">
  import { bridge } from '../audio/bridge'
  import { LATTICE, SCREEN } from '../design/tokens'
  import { params } from '../state/params.svelte'
  import { SCREEN_PAGES, transport, type ScreenPage } from '../state/transport.svelte'
  import type { BootSequence } from './canvas/bootSequence'
  import { DotMatrix } from './canvas/dotMatrix'
  import { GLYPH_H, screenSafe } from './canvas/font5x7'
  import { SCOPE_BOX, drawScope, drawScopeFrame } from './canvas/meterRenderer'
  import { useFrame } from './frame'

  interface Props {
    boot: BootSequence
  }
  let { boot }: Props = $props()

  const audio = bridge()
  const frame = useFrame()

  let well = $state<HTMLDivElement | null>(null)
  let canvas = $state<HTMLCanvasElement | null>(null)

  /* ---- lattice geometry, all in dots ---------------------------------- */
  const TITLE_Y = 2
  const RULE_Y = 11
  const ROW_Y = [15, 26, 37, 48]
  const BAR_X = 34
  const BAR_LEN = 64
  const RIGHT = LATTICE.cols - 3
  const FOOTER_Y = LATTICE.rows - GLYPH_H

  /** Chrome is deliberately the DIMMEST thing on the lattice. The values are
   *  the brightest. If you can only read one thing from across the room it
   *  should be the number, not the word "params". */
  function drawChrome(m: DotMatrix, title: string): void {
    m.text(title, 2, TITLE_Y, SCREEN.dim)
    for (let x = 2; x < LATTICE.cols - 2; x += 2) m.set(x, RULE_Y, SCREEN.dim)
    drawFooter(m)
    drawPageDots(m)
  }

  function drawFooter(m: DotMatrix): void {
    const rate =
      transport.audio.state === 'running' ? `${Math.round(transport.audio.sampleRate / 1000)}k` : 'idle'
    m.text(`oct ${transport.octave} · ${rate}`, 2, FOOTER_Y, SCREEN.dim)
  }

  function drawPageDots(m: DotMatrix): void {
    const y = LATTICE.rows - 4
    for (let i = 0; i < SCREEN_PAGES.length; i++) {
      const x = LATTICE.cols - 3 - (SCREEN_PAGES.length - 1 - i) * 4
      if (SCREEN_PAGES[i] === transport.page) {
        m.rect(x - 1, y - 1, 2, 2, SCREEN.ink)
      } else {
        m.set(x, y, SCREEN.dim)
      }
    }
  }

  /** The parameter page — also the boot sequence's dissolve target. */
  function drawParams(m: DotMatrix, now: number = performance.now()): void {
    drawChrome(m, 'params')
    const ids = params.knobs
    for (let i = 0; i < ids.length && i < ROW_Y.length; i++) {
      const id = ids[i]
      if (!id) continue
      const y = ROW_Y[i] as number
      const d = params.descriptor(id)
      const hot = params.isHighlighted(id, now)
      const ink = hot ? SCREEN.accent : SCREEN.ink
      const label = hot ? SCREEN.accent : SCREEN.dim

      m.text(d.label.slice(0, 5), 2, y, label)

      // Track: a sparse guide of every fourth dot, so an empty bar still shows
      // how far it could go. Fill: three rows solid.
      const mid = y + 3
      for (let x = 0; x < BAR_LEN; x += 4) m.set(BAR_X + x, mid, SCREEN.dim)
      const span = d.max - d.min
      const frac = span > 0 ? (params.get(id) - d.min) / span : 0
      const lit = Math.round(frac * BAR_LEN)
      for (let x = 0; x < lit; x++) {
        for (let r = -1; r <= 1; r++) m.set(BAR_X + x, mid + r, ink)
      }

      m.textRight(params.format(id), RIGHT, y, ink)
    }
  }

  function drawScopePage(m: DotMatrix): void {
    drawChrome(m, 'scope')
    drawScopeFrame(m, SCOPE_BOX)
    drawScope(m, audio.scope, SCOPE_BOX, SCREEN.accent)
  }

  function drawMidiPage(m: DotMatrix): void {
    drawChrome(m, 'midi')
    const midi = transport.midi
    const lines: string[] = []
    if (!midi.supported) {
      lines.push('unavailable here', 'use the computer', 'keyboard: z-m, q-i')
    } else if (midi.permission === 'blocked') {
      lines.push('blocked', 'firefox needs the', 'site permission add-on')
    } else if (midi.permission === 'denied') {
      lines.push('denied', 'reload and allow', 'midi access')
    } else if (midi.permission === 'unknown') {
      lines.push('not connected', 'press the midi chip', 'to connect a device')
    } else if (midi.ports.length === 0) {
      lines.push('no devices', 'plug one in, it is', 'picked up live')
    } else {
      for (const p of midi.ports) lines.push(screenSafe(p.name))
    }
    for (let i = 0; i < lines.length && i < 4; i++) {
      const line = (lines[i] as string).slice(0, 21)
      m.text(line, 2, 15 + i * 9, i === 0 ? SCREEN.ink : SCREEN.dim)
    }
  }

  function renderPage(m: DotMatrix, page: ScreenPage, now: number): void {
    if (page === 'scope') drawScopePage(m)
    else if (page === 'midi') drawMidiPage(m)
    else drawParams(m, now)
  }

  $effect(() => {
    const el = canvas
    const box = well
    if (!el || !box) return

    const matrix = new DotMatrix(el)
    matrix.resize(box.clientWidth)

    const ro = new ResizeObserver(() => {
      matrix.resize(box.clientWidth)
    })
    ro.observe(box)

    const stop = frame.subscribe((now) => {
      if (transport.page === 'boot' && !boot.done) {
        boot.render(matrix, now, (target) => renderPage(target, 'params', now))
        return
      }
      matrix.beginFrame()
      renderPage(matrix, transport.page, now)
      matrix.endFrame()
    })

    return () => {
      stop()
      ro.disconnect()
      matrix.destroy()
    }
  })

  /** Text mirror of the screen for assistive tech. */
  const screenText = $derived.by(() => {
    if (transport.page === 'boot') return 'boot screen. press any key to start audio.'
    if (transport.page === 'scope') return 'scope page. output waveform.'
    if (transport.page === 'midi') {
      const m = transport.midi
      if (!m.supported) return 'midi page. midi unavailable in this browser.'
      if (m.ports.length === 0) return `midi page. ${m.permission}. no devices.`
      return `midi page. ${m.ports.map((p) => p.name).join(', ')}.`
    }
    return `params page. ${params.knobs
      .map((id) => `${params.descriptor(id).label} ${params.format(id)}`)
      .join(', ')}.`
  })

  function pageLabel(p: ScreenPage): string {
    return `${p} page`
  }
</script>

<div class="screen">
  <div class="well" bind:this={well}>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>

  <p class="sr" aria-live="off">{screenText}</p>

  <div class="pager" role="group" aria-label="screen pages">
    {#each SCREEN_PAGES as p (p)}
      <button
        type="button"
        class="page-dot"
        class:active={transport.page === p}
        aria-pressed={transport.page === p}
        onclick={() => transport.setPage(p)}
      >
        <span class="sr">{pageLabel(p)}</span>
      </button>
    {/each}
    <span class="pager-name t-micro" aria-hidden="true">{transport.page}</span>
  </div>
</div>

<style>
  .screen {
    display: grid;
    gap: var(--s-3);
  }

  .well {
    display: grid;
    place-items: center;
    padding: var(--s-4);
    background: var(--screen-bg);
    border-radius: var(--r-3);
    box-shadow: var(--sh-well);
  }

  canvas {
    border-radius: var(--r-0);
    image-rendering: pixelated;
  }

  .pager {
    display: flex;
    align-items: center;
    gap: var(--s-2);
  }

  .page-dot {
    width: 12px;
    height: 12px;
    padding: 0;
    border: 1px solid var(--enclosure-hairline);
    border-radius: var(--r-max);
    background: transparent;
  }

  .page-dot.active {
    background: var(--enclosure-mark);
    border-color: var(--enclosure-mark);
  }

  .page-dot:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .pager-name {
    color: var(--enclosure-ink-2);
  }
</style>
