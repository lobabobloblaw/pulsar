<!--
  pulsar — the control glyphs (plan §10's shape language, UI audit follow-up).

  Every symbol on a button cap comes from here: one 12x12 viewBox, geometric
  primitives only — triangles, squares, circles, straight strokes — so the caps
  speak the same language as the 8x8 screen glyphs and the keybed. Hand-authored
  paths, no icon font, no dependency (K4). `currentColor` throughout: the cap
  decides ink, the glyph never does.

  Icons are decoration on a labelled control, so the svg is aria-hidden — the
  BUTTON carries the accessible name (its silkscreen label or aria-label),
  never the drawing.
-->
<script lang="ts">
  export type IconName =
    | 'play'
    | 'stop'
    | 'loop'
    | 'record'
    | 'follow'
    | 'grid'
    | 'midi'
    | 'sun'
    | 'moon'
    | 'power'
    | 'plus'
    | 'minus'
    | 'clone'
    | 'up'
    | 'down'
    | 'clear'

  interface Props {
    name: IconName
    /** CSS px; the glyph is drawn for 12 and scales in integer-friendly steps. */
    size?: number
  }
  let { name, size = 12 }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 12 12"
  aria-hidden="true"
  focusable="false"
  fill="currentColor"
  stroke="none"
>
  {#if name === 'play'}
    <path d="M3 1.75 10.25 6 3 10.25Z" />
  {:else if name === 'stop'}
    <rect x="2.75" y="2.75" width="6.5" height="6.5" />
  {:else if name === 'loop'}
    <path
      d="M9.75 4.25V4A1.75 1.75 0 0 0 8 2.25H4A1.75 1.75 0 0 0 2.25 4v4A1.75 1.75 0 0 0 4 9.75h4A1.75 1.75 0 0 0 9.75 8v-.25"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <path d="M7.5 1 11 3.25 7.5 5.5Z" />
  {:else if name === 'record'}
    <circle cx="6" cy="6" r="3.75" />
  {:else if name === 'follow'}
    <path d="M6 1.25v5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M2.9 4.6 6 8.25 9.1 4.6Z" />
    <path d="M2 10.25h8" fill="none" stroke="currentColor" stroke-width="1.5" />
  {:else if name === 'grid'}
    <rect x="1.75" y="1.75" width="3.75" height="3.75" />
    <rect x="6.5" y="1.75" width="3.75" height="3.75" />
    <rect x="1.75" y="6.5" width="3.75" height="3.75" />
    <rect x="6.5" y="6.5" width="3.75" height="3.75" />
  {:else if name === 'midi'}
    <circle cx="6" cy="6" r="4.9" fill="none" stroke="currentColor" stroke-width="1.4" />
    <circle cx="3.4" cy="7" r="0.95" />
    <circle cx="4.6" cy="4.5" r="0.95" />
    <circle cx="6" cy="3.9" r="0" />
    <circle cx="7.4" cy="4.5" r="0.95" />
    <circle cx="8.6" cy="7" r="0.95" />
    <circle cx="6" cy="8.2" r="0.95" />
  {:else if name === 'sun'}
    <circle cx="6" cy="6" r="2.4" />
    <path
      d="M6 .9v1.7M6 9.4v1.7M.9 6h1.7M9.4 6h1.7M2.4 2.4l1.2 1.2M8.4 8.4l1.2 1.2M9.6 2.4 8.4 3.6M3.6 8.4 2.4 9.6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.3"
    />
  {:else if name === 'moon'}
    <path d="M7.25 1.25a5 5 0 1 0 3.5 5.9A4.1 4.1 0 0 1 7.25 1.25Z" />
  {:else if name === 'power'}
    <path
      d="M3.4 3.4a3.9 3.9 0 1 0 5.2 0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <path d="M6 1v4.4" fill="none" stroke="currentColor" stroke-width="1.5" />
  {:else if name === 'plus'}
    <path d="M6 2v8M2 6h8" fill="none" stroke="currentColor" stroke-width="1.5" />
  {:else if name === 'minus'}
    <path d="M2 6h8" fill="none" stroke="currentColor" stroke-width="1.5" />
  {:else if name === 'clone'}
    <rect
      x="1.75"
      y="3.75"
      width="6.5"
      height="6.5"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path d="M4 1.75h5.25A1 1 0 0 1 10.25 2.75V8" fill="none" stroke="currentColor" stroke-width="1.4" />
  {:else if name === 'up'}
    <path d="M6 2.5 10.25 9H1.75Z" />
  {:else if name === 'down'}
    <path d="M6 9.5 1.75 3h8.5Z" />
  {:else if name === 'clear'}
    <path d="M2.6 2.6 9.4 9.4M9.4 2.6 2.6 9.4" fill="none" stroke="currentColor" stroke-width="1.5" />
  {/if}
</svg>
