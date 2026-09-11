<!--
  pulsar — Knob (plan C7, Ivory dial).

  DEVIATION FROM plan-file.md, DELIBERATE (D-U1): this is DOM, not canvas.

  plan-file's "put the knobs on canvas" advice is aimed at the Phase-2 pattern
  grid, where hundreds of cells repaint per frame. Three dials are a different
  problem. Each one animates exactly one property — `transform: rotate()` on a
  single indicator element — which the compositor handles without a paint, and
  in exchange the DOM gives us free DPR crispness, CSS-variable theming that
  follows the room dimmer for nothing, and NATIVE focus and ARIA. A canvas
  knob would have to reimplement role="slider", the focus ring, and hit
  testing by hand. (It was an SVG until the Ivory pass; the tick ring is now
  a conic gradient and the cap a radial one, which is the same argument with
  fewer nodes.)

  REVISIT TRIGGER: more than 24 simultaneous knobs on screen. At that point
  re-measure with a DevTools recording; if the layer count or paint time
  regresses, move all knobs to ONE shared canvas — not one canvas each.

  Geometry: 88px dial (72 on a phone), 270 degrees of travel (-135 to +135),
  a 3x20px accent indicator with rounded ends, label above, numeric readout
  and the printed range beneath.

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

  DISABLED (song playback): the driver owns the timeline, so the dial keeps its
  ARIA and its focus stop but ignores every gesture and says so through
  `aria-disabled`; the row's caption says why.
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import { paramFraction, speak, type ParamId } from '../audio/params'
  import { params, quantize } from '../state/params.svelte'
  import { nonPassiveWheel } from './actions/nonPassiveWheel'
  import { pointerDrag } from './actions/pointerDrag'

  interface Props {
    id: ParamId
    /** The printed range line under the value (`0 — 15`). */
    detail?: string
    disabled?: boolean
  }
  let { id, detail = '', disabled = false }: Props = $props()

  const SWEEP = 270

  const d = $derived(params.descriptor(id))
  const value = $derived(params.get(id))
  const text = $derived(params.format(id))
  const fraction = $derived(paramFraction(d, value))
  const angle = $derived(-SWEEP / 2 + SWEEP * fraction)

  const labelId = $derived(`knob-${id.replace('.', '-')}-label`)

  /** The registry's labels are lowercase for the 5x7 screen face; the slab
   *  prints them in sentence case. `aria-labelledby` still points at this. */
  const labelText = $derived(d.label.charAt(0).toUpperCase() + d.label.slice(1))
  const valueText = $derived(text.charAt(0).toUpperCase() + text.slice(1))

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
    if (disabled) return
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
    if (disabled) return
    commit(acc + steps * (e.shiftKey ? fineStep : d.step))
  }

  function reset(): void {
    if (disabled) return
    acc = params.reset(id)
  }

  function onPointerDown(e: PointerEvent): void {
    if (disabled) return
    if (e.altKey) {
      e.preventDefault()
      reset()
    }
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (disabled) return
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

<div class="knob" class:disabled>
  <span class="label" id={labelId}>{labelText}</span>
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
    aria-disabled={disabled ? 'true' : undefined}
    style:--angle="{angle}deg"
    onkeydown={onKeyDown}
    onpointerdown={onPointerDown}
    ondblclick={reset}
    use:pointerDrag={{ onStart, onMove, onEnd, accept: (e) => !disabled && !e.altKey }}
    use:nonPassiveWheel={{ onWheel }}
  >
    <!-- The cap sits inside the tick ring; the one animated transform is the
         indicator's rotation (D-U1). -->
    <span class="cap" aria-hidden="true"><i class="indicator"></i></span>
  </div>
  <span class="value">{valueText}</span>
  {#if detail}<span class="detail">{detail}</span>{/if}
</div>

<style>
  .knob {
    --dial: 88px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .knob.disabled {
    opacity: 0.45;
  }

  .label {
    font-family: var(--font-sans);
    font-size: var(--t-ui-size);
    color: var(--enclosure-ink);
  }

  /* The tick ring: a conic repeat of 2° ink marks every 7°. */
  .dial {
    position: relative;
    width: var(--dial);
    height: var(--dial);
    border-radius: var(--r-max);
    background: repeating-conic-gradient(#343a311c 0deg 2deg, transparent 2deg 7deg);
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

  .disabled .dial {
    cursor: default;
  }

  /* The domed cap: lit from the upper left, a shaded lower rim, a contact
     shadow onto the ring. */
  .cap {
    position: absolute;
    inset: 8px;
    display: block;
    border-radius: var(--r-max);
    background: radial-gradient(circle at 36% 23%, #fffffb, #eeeee4 45%, #c5c8ba 100%);
    border: 1px solid #bbc0ae;
    box-shadow:
      0 5px 6px rgb(0 0 0 / 0.25),
      inset 0 2px 2px #fff,
      inset 0 -2px 3px #9a9f8f;
  }

  .indicator {
    position: absolute;
    top: 5px;
    left: calc(50% - 1.5px);
    width: 3px;
    height: 20px;
    border-radius: 2px;
    background: var(--enclosure-accent);
    transform-origin: 50% calc((var(--dial) - 16px) / 2 - 5px);
    transform: rotate(var(--angle));
  }

  .value {
    font-family: var(--font-ui);
    font-size: var(--t-dial-size);
    font-weight: 500;
    line-height: 1;
    color: var(--enclosure-ink);
    font-variant-numeric: tabular-nums;
  }

  .detail {
    max-width: 100%;
    font-family: var(--font-ui);
    font-size: var(--t-caption-size);
    line-height: 1.4;
    text-align: center;
    overflow-wrap: anywhere;
    color: var(--enclosure-ink-2);
  }

  @media (prefers-contrast: more) {
    .cap {
      background: var(--chip-bg);
      box-shadow: none;
    }
  }

  @media (max-width: 600px) {
    .knob {
      --dial: 72px;
      gap: 12px;
    }
    .indicator {
      height: 16px;
    }
  }
</style>
