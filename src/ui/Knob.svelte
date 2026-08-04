<!--
  pulsar — Knob (plan C7).

  DEVIATION FROM plan-file.md, DELIBERATE: this is SVG, not canvas.

  plan-file's "put the knobs on canvas" advice is aimed at the Phase-2 pattern
  grid, where hundreds of cells repaint per frame. Four knobs are a different
  problem. Each one animates exactly one property — `transform: rotate()` on a
  single <line> — which the compositor handles without a paint, and in exchange
  SVG gives us free DPR crispness, CSS-variable theming that follows the room
  dimmer for nothing, and NATIVE focus and ARIA. A canvas knob would have to
  reimplement role="slider", the focus ring, and hit testing by hand.

  REVISIT TRIGGER: more than 24 simultaneous knobs on screen (Phase 2's
  instrument editor is the likely cause). At that point re-measure with a
  DevTools recording; if the layer count or paint time regresses, move all knobs
  to ONE shared canvas — not one canvas each.

  Geometry: 56px dial, 240 degrees of travel (-120 to +120), 24 detent dots,
  3px ink indicator, label above, numeric readout always beneath.
-->
<script lang="ts">
  import { paramFraction, speak, type ParamId } from '../audio/params'
  import { params } from '../state/params.svelte'
  import { nonPassiveWheel } from './actions/nonPassiveWheel'
  import { pointerDrag } from './actions/pointerDrag'

  interface Props {
    id: ParamId
  }
  let { id }: Props = $props()

  const SWEEP = 240
  const DETENTS = 24

  const d = $derived(params.descriptor(id))
  const value = $derived(params.get(id))
  const text = $derived(params.format(id))
  const fraction = $derived(paramFraction(d, value))
  const angle = $derived(-SWEEP / 2 + SWEEP * fraction)

  const labelId = $derived(`knob-${id.replace('.', '-')}-label`)

  let dragging = $state(false)
  /** The drag accumulator. Kept OUTSIDE the store so that Shift can change
   *  sensitivity mid-drag without the value jumping: the accumulator carries
   *  the sub-step remainder that quantisation would otherwise throw away. */
  let acc = 0

  /** An enum parameter has no meaningful fine mode — a four-position switch
   *  does not have tenths. */
  const fineStep = $derived(d.taper === 'enum' ? d.step : d.step / 10)

  function detentAngle(i: number): number {
    return -SWEEP / 2 + (SWEEP * i) / (DETENTS - 1)
  }

  function detentFilled(i: number): boolean {
    return i / (DETENTS - 1) <= fraction + 1e-6
  }

  function onStart(): void {
    dragging = true
    acc = value
  }

  function onMove(_dx: number, dy: number, e: PointerEvent): void {
    const range = d.max - d.min
    // C7 verbatim: acc += (lastY - y) * (shift ? range/1000 : range/200).
    // pointerDrag hands us dy = y - lastY, hence the negation.
    acc += -dy * (e.shiftKey ? range / 1000 : range / 200)
    if (acc < d.min) acc = d.min
    if (acc > d.max) acc = d.max
    params.set(id, acc)
  }

  function onEnd(): void {
    dragging = false
  }

  function onWheel(steps: number, e: WheelEvent): void {
    params.nudge(id, steps * (e.shiftKey ? fineStep : d.step))
  }

  function reset(): void {
    params.reset(id)
    acc = params.get(id)
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.altKey) {
      e.preventDefault()
      reset()
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    const step = e.shiftKey ? fineStep : d.step
    let handled = true
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        params.nudge(id, step)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        params.nudge(id, -step)
        break
      case 'PageUp':
        params.nudge(id, d.step * 10)
        break
      case 'PageDown':
        params.nudge(id, -d.step * 10)
        break
      case 'Home':
        params.set(id, d.min)
        break
      case 'End':
        params.set(id, d.max)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
      acc = params.get(id)
    }
  }
</script>

<div class="knob">
  <span class="label t-label" id={labelId}>{d.label}</span>

  <div
    class="dial"
    class:dragging
    role="slider"
    tabindex="0"
    aria-orientation="vertical"
    aria-labelledby={labelId}
    aria-valuemin={d.min}
    aria-valuemax={d.max}
    aria-valuenow={value}
    aria-valuetext={speak(text)}
    onkeydown={onKeyDown}
    onpointerdown={onPointerDown}
    ondblclick={reset}
    use:pointerDrag={{ onStart, onMove, onEnd, accept: (e) => !e.altKey }}
    use:nonPassiveWheel={{ onWheel }}
  >
    <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false">
      {#each { length: DETENTS } as _, i (i)}
        <circle
          class="detent"
          class:filled={detentFilled(i)}
          cx="28"
          cy="4.5"
          r="1.5"
          transform="rotate({detentAngle(i)} 28 28)"
        />
      {/each}

      <circle class="cap" cx="28" cy="28" r="18" />
      <g transform="rotate({angle} 28 28)">
        <line class="indicator" x1="28" y1="13" x2="28" y2="24" />
      </g>
    </svg>
  </div>

  <span class="value t-value">{text}</span>
</div>

<style>
  .knob {
    display: grid;
    justify-items: center;
    gap: var(--s-2);
  }

  .label {
    color: var(--enclosure-ink-2);
  }

  .dial {
    width: 56px;
    height: 56px;
    border-radius: var(--r-max);
    cursor: ns-resize;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .dial:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .dial.dragging {
    cursor: grabbing;
  }

  .detent {
    fill: var(--enclosure-hairline);
  }

  /* Blue as a component fill only — 3:1 against the aluminium is enough for a
     non-text indicator (WCAG 1.4.11), and it never carries meaning alone: the
     numeric readout underneath always says the same thing in words. */
  .detent.filled {
    fill: var(--enclosure-accent);
  }

  .cap {
    fill: var(--key-face);
    stroke: var(--enclosure-hairline);
    stroke-width: 1;
  }

  .indicator {
    stroke: var(--enclosure-mark);
    stroke-width: 3;
    stroke-linecap: butt;
  }

  .value {
    color: var(--enclosure-ink);
    font-variant-numeric: tabular-nums;
  }
</style>
