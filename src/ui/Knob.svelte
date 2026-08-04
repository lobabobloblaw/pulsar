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

  SHIFT = FINE, AND WHAT THAT HONESTLY MEANS PER PARAMETER.

  The store quantises every write to the parameter's step, so a value can only
  ever land on the step grid — "fine" cannot mean "a smaller value", it can only
  mean "a smaller MOVE per gesture". Every path here therefore accumulates in
  `acc`, an unquantised shadow of the value, and commits through the store; the
  readout shows the quantised truth, never the accumulator.

    continuous parameters (step < 1 — master.volume, step 0.01):
        shift = one tenth of a step per notch, so ten shifted wheel notches or
        ten shifted arrows move the value by exactly one step. Real fine
        control, and the sub-step remainder survives between gestures.

    integer and enum parameters (step >= 1 — duty, level, sweep):
        shift moves ONE STEP, exactly like an unmodified arrow or notch. There
        is nothing between 8 and 9 on a 0..15 nibble or between two duty cycles,
        so a tenth-of-a-step mode would either do nothing at all (the bug this
        replaces) or silently need ten presses to move one position. Doing the
        plain thing is the honest answer.

  Dragging is unaffected: it is a continuous gesture whose sensitivity (range/200
  vs range/1000 per pixel) is meaningful on every parameter, integer or not.
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import { paramFraction, speak, type ParamId } from '../audio/params'
  import { params, quantize } from '../state/params.svelte'
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

  /** The accumulator, shared by drag, wheel and keyboard. Kept OUTSIDE the store
   *  so that Shift can change sensitivity mid-gesture without the value jumping:
   *  it carries the sub-step remainder that quantisation would otherwise throw
   *  away. Deliberately not $state — nothing renders it. Seeded once (untracked:
   *  this is a plain local, not a derivation), then kept in sync by the effect
   *  below. */
  let acc = untrack(() => params.get(id))

  /** How many notches of Shift make one step. */
  const FINE_DIVISOR = 10

  /** Fine mode only exists where the grid is finer than a whole unit. See the
   *  file header: on an integer or enum parameter Shift is a plain step. */
  const fineable = $derived(d.taper !== 'enum' && d.step < 1)
  const fineStep = $derived(fineable ? d.step / FINE_DIVISOR : d.step)

  /** Re-seed when anything else moved the parameter — reset, another control,
   *  a MIDI CC — so the accumulator can never drift away from the truth. It
   *  reads `value`, so it re-runs on every store write; after our own writes
   *  the quantised accumulator already equals the value and nothing happens. */
  $effect(() => {
    if (quantize(d, acc) !== value) acc = value
  })

  /** The one write path out of this component: clamp the accumulator, then let
   *  the store clamp and quantise its own copy. */
  function commit(next: number): void {
    acc = next < d.min ? d.min : next > d.max ? d.max : next
    params.set(id, acc)
  }

  function detentAngle(i: number): number {
    return -SWEEP / 2 + (SWEEP * i) / (DETENTS - 1)
  }

  function detentFilled(i: number): boolean {
    return i / (DETENTS - 1) <= fraction + 1e-6
  }

  /** Horizontal travel accumulated across the gesture. Touch has no Shift, so
   *  pulling the finger ASIDE is the touch-native fine mode (the scrubbing
   *  idiom): past 48px of offset the same vertical travel moves at the
   *  shifted rate. The accumulator design above is exactly what lets the rate
   *  change mid-gesture without a value jump. */
  let aside = 0

  function onStart(): void {
    dragging = true
    aside = 0
  }

  function onMove(dx: number, dy: number, e: PointerEvent): void {
    aside += dx
    const fine = e.shiftKey || (e.pointerType === 'touch' && Math.abs(aside) > 48)
    const range = d.max - d.min
    // C7 verbatim: acc += (lastY - y) * (shift ? range/1000 : range/200).
    // pointerDrag hands us dy = y - lastY, hence the negation.
    commit(acc + -dy * (fine ? range / 1000 : range / 200))
  }

  function onEnd(): void {
    dragging = false
  }

  function onWheel(steps: number, e: WheelEvent): void {
    commit(acc + steps * (e.shiftKey ? fineStep : d.step))
  }

  function reset(): void {
    acc = params.reset(id)
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
        commit(acc + step)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        commit(acc - step)
        break
      case 'PageUp':
        commit(acc + d.step * 10)
        break
      case 'PageDown':
        commit(acc - d.step * 10)
        break
      case 'Home':
        commit(d.min)
        break
      case 'End':
        commit(d.max)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
</script>

<div class="knob">
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
      <!-- Dome light: a soft shade along the lower curve, a sheen along the
           upper. Static on purpose — the light does not rotate with the
           indicator, and the one animated transform stays the rotation
           (D-U1). -->
      <path class="shade" d="M14 32.5 A16.5 16.5 0 0 0 42 32.5" />
      <path class="sheen" d="M15 22.5 A16 16 0 0 1 41 22.5" />
      <g transform="rotate({angle} 28 28)">
        <line class="indicator" x1="28" y1="13" x2="28" y2="24" />
      </g>
    </svg>
  </div>

  <!-- One printed line under the dial: name and value together, the way a
       panel is silkscreened (compact pass). The numeric readout plan-file §10
       requires stays visible; the id feeding aria-labelledby stays with it. -->
  <p class="readout">
    <span class="label t-label" id={labelId}>{d.label}</span>
    <span class="value t-value">{text}</span>
  </p>
</div>

<style>
  .knob {
    display: grid;
    justify-items: center;
    gap: var(--s-2);
  }

  .readout {
    display: flex;
    align-items: baseline;
    gap: var(--s-1);
    margin: 0;
    line-height: 1;
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
    /* The cap sits ON the face: a contact shadow where it meets the panel. */
    filter: drop-shadow(0 1.5px 1px rgb(0 0 0 / 0.3));
  }

  .shade {
    fill: none;
    stroke: rgb(0 0 0 / 0.12);
    stroke-width: 3.5;
    stroke-linecap: round;
    filter: blur(1.5px);
  }

  .sheen {
    fill: none;
    stroke: rgb(255 255 255 / 0.6);
    stroke-width: 2.5;
    stroke-linecap: round;
    filter: blur(1.2px);
  }

  @media (prefers-contrast: more) {
    .cap {
      filter: none;
    }
    .shade,
    .sheen {
      display: none;
    }
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
