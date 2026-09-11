<!--
  pulsar — Screen (plan C9, Ivory well).

  A 128x64 dot lattice in a deep green well. The only lit object on the page.

  The well is a bordered display module the width of its column: a caption
  row along the top (page name · engine status), the lattice centred, and a
  caption row along the foot (key range · who owns the keys). The captions
  are real state, printed in the well's own ink, and the pager sits under the
  module on the slab.

  Sizing: the canvas takes exactly 128*DOT x 64*DOT CSS pixels and is sized
  by the WIDTH the well can give it — the well's box minus its border and
  padding — with an unbounded height budget, so the dot pitch is always an
  integer and the lattice never resamples (the old viewport-height budget and
  its measured SHELL_OVERHEAD are gone: the Ivory slab scrolls, it does not
  fit a fixed height). See dotMatrix.ts for the DPR rule.

  The dot is capped at 3 HERE (dotMax: 3; tokens' DOT_MAX 8 served the old
  full-width screen and still serves the other renderers). The Ivory well is
  half the slab: at the 1120px slab its inner width reaches 524px, dot 4 would
  make a 512x256 lattice and the display module 64px taller than the study's
  proportion — enough to push the footer off a 1440x900 laptop inside the
  homepage window. Dot 3 (384x192) is the study's display at 1024 and stays
  the size up to the widest slab; phones still fall to dot 2.

  Pages: boot, params, scope, midi, song. The boot sequence dissolves INTO the
  params page — it is handed the params renderer as its underlay, which is why
  the two are the same function and not two drawings of the same thing.

  The canvas is aria-hidden and everything it shows is mirrored as text for
  assistive tech. A screen that only exists as pixels is not a screen.
-->
<script lang="ts">
  import { bridge } from '../audio/bridge'
  import { LATTICE, SCREEN } from '../design/tokens'
  import { params } from '../state/params.svelte'
  import { song } from '../state/song.svelte'
  import { bpm as bpmOf, CHANNEL_LABELS } from '../state/songModel'
  import { tracker } from '../state/tracker.svelte'
  import { SCREEN_PAGES, transport, type ScreenPage } from '../state/transport.svelte'
  import type { BootSequence } from './canvas/bootSequence'
  import { DotMatrix } from './canvas/dotMatrix'
  import { GLYPH_H, screenSafe } from './canvas/font5x7'
  import { SCOPE_BOX, drawScope, drawScopeFrame } from './canvas/meterRenderer'
  import { useFrame } from './frame'
  import { viewport } from './viewport.svelte'

  interface Props {
    boot: BootSequence
  }
  let { boot }: Props = $props()

  const audio = bridge()
  const frame = useFrame()

  let well = $state<HTMLDivElement | null>(null)
  let canvas = $state<HTMLCanvasElement | null>(null)
  /** The live half of the song page's text mirror. Written from the frame loop
   *  at 4 Hz — never read in the template, so nothing invalidates. */
  let posEl = $state<HTMLSpanElement | null>(null)
  let lastPosText = ''
  let lastPosAt = 0

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
      lines.push('not connected', 'connect midi in', 'settings')
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

  /** The tracker's presence, made visible on the instrument itself (design
   *  §5.6): name, author, bpm and the playing position, in the 5x7 font on the
   *  lattice we already have. Four text() calls and one hline — no new canvas
   *  primitive was needed, which is why the page is worth having. */
  function drawSongPage(m: DotMatrix): void {
    drawChrome(m, 'song')
    const meta = song.doc.meta
    m.text(screenSafe(meta.name || 'untitled').slice(0, 21), 2, 15, SCREEN.ink)
    m.text(screenSafe(meta.author || 'no author').slice(0, 21), 2, 24, SCREEN.dim)

    const beats = Math.round(bpmOf(meta) * 10) / 10
    m.text(`${beats} bpm`, 2, 36, SCREEN.accent)
    m.textRight(`s${meta.speed} t${meta.tempo}`, RIGHT, 36, SCREEN.dim)

    const p = tracker.position
    m.text(p.playing ? 'play' : 'stop', 2, 47, p.playing ? SCREEN.accent : SCREEN.dim)
    m.textRight(
      `${p.orderIndex.toString(16).padStart(2, '0')}/${p.row.toString(16).padStart(2, '0')}`,
      RIGHT,
      47,
      SCREEN.ink,
    )
  }

  function renderPage(m: DotMatrix, page: ScreenPage, now: number): void {
    if (page === 'scope') drawScopePage(m)
    else if (page === 'midi') drawMidiPage(m)
    else if (page === 'song') drawSongPage(m)
    else drawParams(m, now)
  }

  /** The width the lattice may take: the well's box minus its border and its
   *  padding, floored. Feeding a padding-inflated width to the sizing rule once
   *  picked a dot one too large — the canvas then hit reset.css's
   *  `max-width: 100%` and the lattice resampled at 2.036 device px per CSS px
   *  instead of overflowing loudly. The well is the width of its column, not
   *  of its content, so measuring it does not chase the canvas around. */
  function latticeWidthBudget(wellEl: HTMLElement): number {
    const cs = getComputedStyle(wellEl)
    const box = wellEl.getBoundingClientRect().width
    return Math.floor(
      box -
        parseFloat(cs.borderLeftWidth) -
        parseFloat(cs.borderRightWidth) -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight),
    )
  }

  $effect(() => {
    const el = canvas
    const box = well
    if (!el || !box) return

    const matrix = new DotMatrix(el, { dotMax: 3 })
    // Width only: the height budget is unbounded, so the dot is the largest
    // integer that fits the well's inner width, capped at 3 (see the header).
    matrix.resize(latticeWidthBudget(box), Infinity)

    const ro = new ResizeObserver(() => {
      matrix.resize(latticeWidthBudget(box), Infinity)
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
      if (now - lastPosAt > 250) {
        lastPosAt = now
        updatePositionMirror()
      }
    })

    return () => {
      stop()
      ro.disconnect()
      matrix.destroy()
    }
  })

  /** The half of the song page's mirror that moves. Text is written straight to
   *  the node, never through `$state`, because the frame loop must not
   *  invalidate anything (plan C2). Off the song page it is emptied once. */
  function updatePositionMirror(): void {
    const el = posEl
    if (el === null) return
    const p = tracker.position
    const next =
      transport.page === 'song'
        ? ` ${p.playing ? 'playing' : 'stopped'} at frame ${p.orderIndex} row ${p.row}.`
        : ''
    if (next === lastPosText) return
    lastPosText = next
    el.textContent = next
  }

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
    if (transport.page === 'song') {
      const meta = song.doc.meta
      // The position is NOT in this string: `tracker.position` is a plain object
      // read in rAF (design §2.4), so a $derived over it would never invalidate
      // and the mirror would silently freeze at whatever row it first saw. The
      // live half is written to `posEl` from the frame loop instead.
      return `song page. ${meta.name || 'untitled'} by ${meta.author || 'no author'}, ${
        Math.round(bpmOf(meta))
      } bpm.`
    }
    return `params page. ${params.knobs
      .map((id) => `${params.descriptor(id).label} ${params.format(id)}`)
      .join(', ')}.`
  })

  function pageLabel(p: ScreenPage): string {
    return `${p} page`
  }

  /* ---- the well's printed captions ------------------------------------- */

  const pageName = $derived(transport.page.toUpperCase())

  const status = $derived.by(() => {
    const a = transport.audio.state
    if (a === 'error') return 'AUDIO ERROR'
    if (a === 'idle') return 'TAP A KEY TO START'
    if (a === 'starting') return 'STARTING'
    return tracker.playing ? 'SONG PLAYBACK' : 'READY'
  })

  /** What the bed reaches: two octaves and the top C, or the phone's one. */
  const keyRange = $derived(
    viewport.narrow
      ? `C${transport.octave} — B${transport.octave}`
      : `C${transport.octave} — C${transport.octave + 2}`,
  )

  const lane = $derived(
    (CHANNEL_LABELS[song.doc.channels[tracker.channel] ?? 'pulse1'] ?? 'pulse 1').toUpperCase(),
  )

  const owner = $derived.by(() => {
    if (tracker.playing) return `SONG / ${lane}`
    if (transport.midi.ports.length > 0) return `MIDI · ${transport.midi.ports.length}`
    return 'QWERTY / TOUCH'
  })
</script>

<div class="screen">
  <div class="well" bind:this={well}>
    <div class="cap">
      <span>{pageName}</span>
      <span>{status}</span>
    </div>
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
    <div class="cap">
      <span>{keyRange}</span>
      <span>{owner}</span>
    </div>
  </div>

  <p class="sr" aria-live="off">{screenText}<span bind:this={posEl}></span></p>

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
    grid-template-columns: minmax(0, 1fr);
    gap: var(--s-3);
    min-width: 0;
  }

  /* The display module: a thick bezel around deep green glass, the captions
     printed in the glass's own pale ink, the lattice centred between them. */
  .well {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-items: stretch;
    align-content: center;
    gap: 14px;
    min-width: 0;
    padding: 18px 20px;
    color: var(--screen-caption);
    background-color: var(--screen-bg);
    background-image: var(--screen-face);
    border: 7px solid var(--screen-bezel);
    border-radius: var(--r-3);
    box-shadow: var(--sh-well);
  }

  /* Glass: one faint diagonal sheet reflection. Decoration, so it dies under
     prefers-contrast and never intercepts the pointer. */
  .well::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 3px;
    pointer-events: none;
    background: linear-gradient(145deg, rgb(255 255 255 / 0.03), transparent 50%);
  }

  @media (prefers-contrast: more) {
    .well::after {
      background: none;
    }
  }

  .cap {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-family: var(--font-ui);
    font-size: var(--t-caption-size);
    font-weight: 500;
    line-height: 1.5;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .cap span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  canvas {
    justify-self: center;
    border-radius: var(--r-0);
    image-rendering: pixelated;
    /* Opt out of reset.css's `canvas { max-width: 100% }`: a squeezed lattice
       resamples every dot to a non-integer size. A sizing bug must overflow
       the well visibly, never distort silently. */
    max-width: none;
  }

  /* The page dots belong to the display module above them, so they centre
     with it rather than hanging off the row's left edge. */
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
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
    background: var(--enclosure-ink);
    border-color: var(--enclosure-ink);
  }

  .page-dot:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  @media (pointer: coarse) {
    .page-dot,
    .page-dot.active {
      position: relative;
      width: 44px;
      height: 44px;
      border: 0;
      background: transparent;
    }

    .page-dot::before {
      content: '';
      position: absolute;
      inset: 16px;
      border: 1px solid var(--enclosure-hairline);
      border-radius: var(--r-max);
    }

    .page-dot.active::before {
      background: var(--enclosure-ink);
      border-color: var(--enclosure-ink);
    }
  }

  .pager-name {
    color: var(--enclosure-ink-2);
  }

  @media (max-width: 600px) {
    .well {
      padding: 12px 10px;
      gap: 10px;
    }
  }

  /* 320px: the 2-dot lattice is 256px wide; the well gives up its side
     padding so the integer dot still fits inside the bezel. */
  @media (max-width: 360px) {
    .well {
      padding-inline: 0;
    }
    .cap {
      padding-inline: 6px;
    }
  }
</style>
