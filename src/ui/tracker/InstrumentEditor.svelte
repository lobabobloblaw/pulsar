<!--
  pulsar — the instrument / macro editor (design §4.1, §3.4).

  Plain DOM for the structure, one small canvas for the envelope — the split
  §4.1 asks for. The canvas is aria-hidden; beside it sits a single focusable
  `role="slider"` that carries the whole editor's state in `aria-valuetext`
  ("step 3 of 5, value 12, loops here"), which is the same honest device the
  knobs use: one control, arrows to operate it, the drawing as the visual.

  Macros are shared BY INDEX across instruments (§1.2) — the number beside each
  macro name is a slot in the song's sequence bank, not a private envelope, and
  the editor says so rather than pretending otherwise.
-->
<script lang="ts">
  import { song } from '../../state/song.svelte'
  import {
    emptyInstrument,
    MACRO_KINDS,
    type Instrument,
    type MacroKind,
    type Sequence,
  } from '../../state/songModel'
  import { resolvePalette, watchRoom, deviceRatio } from '../canvas/gridMetrics'
  import type { GridPalette } from '../canvas/patternRenderer'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  let selected = $state(0)
  let macro = $state<MacroKind>('volume')
  let step = $state(0)
  let canvas = $state<HTMLCanvasElement | null>(null)
  let palette: GridPalette | null = null

  const RANGE: Readonly<Record<MacroKind, readonly [number, number]>> = {
    volume: [0, 15],
    arpeggio: [-79, 79],
    pitch: [-127, 126],
    hiPitch: [-127, 126],
    duty: [0, 3],
  }

  const instrument = $derived<Instrument>(song.doc.instruments[selected] ?? emptyInstrument())
  const macroIndex = $derived(instrument.macros[macro] ?? -1)
  const sequence = $derived<Sequence | null>(song.doc.sequences[macro][macroIndex] ?? null)
  const values = $derived<readonly number[]>(sequence?.values ?? [])
  const range = $derived(RANGE[macro])

  const valueAt = $derived(values[Math.min(step, values.length - 1)] ?? 0)

  const valueText = $derived.by(() => {
    if (sequence === null) return 'no macro on this slot'
    const marks: string[] = []
    if (sequence.loop === step) marks.push('loop point')
    if (sequence.release === step) marks.push('release point')
    return `step ${step + 1} of ${values.length}, value ${valueAt}${marks.length ? `, ${marks.join(' and ')}` : ''}`
  })

  function setInstrumentName(name: string): void {
    song.run({ kind: 'setInstrument', index: selected, instrument: { ...instrument, name } })
  }

  function addInstrument(): void {
    const index = song.doc.instruments.length
    song.run({ kind: 'setInstrument', index, instrument: emptyInstrument(`inst ${index}`) })
    selected = index
    announce?.(`instrument ${index} added`)
  }

  function setMacroSlot(kind: MacroKind, index: number): void {
    song.run({
      kind: 'setInstrument',
      index: selected,
      instrument: { ...instrument, macros: { ...instrument.macros, [kind]: index } },
    })
  }

  /** A macro with no slot gets a fresh one at the end of the bank — shared by
   *  index is the format's rule, so "new" means "new slot", never "private". */
  function newSequence(kind: MacroKind): void {
    const index = song.doc.sequences[kind].length
    const [lo, hi] = RANGE[kind]
    const seed = kind === 'volume' ? [hi, hi, Math.round(hi / 2), lo] : [0]
    // One list, so allocating the slot and pointing the instrument at it are one
    // undo entry.
    song.run([
      { kind: 'setSequence', macro: kind, index, sequence: { values: seed, loop: -1, release: -1 } },
      {
        kind: 'setInstrument',
        index: selected,
        instrument: { ...instrument, macros: { ...instrument.macros, [kind]: index } },
      },
    ])
    macro = kind
    step = 0
    announce?.(`${kind} macro on slot ${index}`)
  }

  function writeSequence(next: Sequence): void {
    if (macroIndex < 0) return
    song.run({ kind: 'setSequence', macro, index: macroIndex, sequence: next })
  }

  function setValue(delta: number): void {
    if (sequence === null) return
    const [lo, hi] = range
    const next = [...values]
    next[step] = Math.max(lo, Math.min(hi, (next[step] ?? 0) + delta))
    writeSequence({ ...sequence, values: next })
  }

  function setLength(delta: number): void {
    if (sequence === null) return
    const next = [...values]
    if (delta > 0) next.push(next[next.length - 1] ?? 0)
    else if (next.length > 1) next.pop()
    else return
    const last = next.length - 1
    writeSequence({
      ...sequence,
      values: next,
      loop: Math.min(sequence.loop, last),
      release: Math.min(sequence.release, last),
    })
    step = Math.min(step, last)
  }

  function mark(which: 'loop' | 'release'): void {
    if (sequence === null) return
    const current = which === 'loop' ? sequence.loop : sequence.release
    const value = current === step ? -1 : step
    writeSequence({ ...sequence, [which]: value })
    announce?.(value === -1 ? `${which} point cleared` : `${which} point at step ${step + 1}`)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (sequence === null) return
    const big = e.shiftKey ? 4 : 1
    switch (e.key) {
      case 'ArrowUp':
        setValue(big)
        break
      case 'ArrowDown':
        setValue(-big)
        break
      case 'ArrowRight':
        step = Math.min(values.length - 1, step + 1)
        break
      case 'ArrowLeft':
        step = Math.max(0, step - 1)
        break
      case 'Home':
        step = 0
        break
      case 'End':
        step = values.length - 1
        break
      case '+':
      case '=':
        setLength(1)
        break
      case '-':
        setLength(-1)
        break
      case 'l':
        mark('loop')
        break
      case 'r':
        mark('release')
        break
      default:
        return
    }
    e.preventDefault()
  }

  function draw(): void {
    const el = canvas
    if (!el) return
    const ctx = el.getContext('2d', { alpha: false })
    if (!ctx) return
    palette ??= resolvePalette()
    const p = palette
    const dpr = deviceRatio()
    const cssW = el.clientWidth || 240
    const cssH = 72
    el.width = Math.round(cssW * dpr)
    el.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, cssW, cssH)

    const n = Math.max(1, values.length)
    const bw = cssW / n
    const [lo, hi] = range
    const span = hi - lo || 1
    const zeroY = cssH - ((0 - lo) / span) * cssH

    ctx.fillStyle = p.bgBeat
    ctx.fillRect(0, zeroY - 0.5, cssW, 1)

    for (let i = 0; i < values.length; i++) {
      const v = values[i] as number
      const y = cssH - ((v - lo) / span) * cssH
      ctx.fillStyle = i === step ? p.accent : p.inkDim
      const top = Math.min(y, zeroY)
      const h = Math.max(1, Math.abs(zeroY - y))
      ctx.fillRect(i * bw + 1, top, Math.max(1, bw - 2), h)
    }

    if (sequence !== null) {
      ctx.fillStyle = p.ink
      if (sequence.loop >= 0) ctx.fillRect(sequence.loop * bw, 0, 1, cssH)
      if (sequence.release >= 0) ctx.fillRect((sequence.release + 1) * bw - 1, 0, 1, cssH)
    }
  }

  $effect(() => {
    void values
    void step
    void macro
    draw()
  })

  $effect(() => {
    const stop = watchRoom(() => {
      palette = resolvePalette()
      draw()
    })
    return stop
  })

  function onCanvasPointer(e: PointerEvent): void {
    const el = canvas
    if (!el || sequence === null) return
    const box = el.getBoundingClientRect()
    const n = Math.max(1, values.length)
    const i = Math.floor(((e.clientX - box.left) / box.width) * n)
    if (i < 0 || i >= values.length) return
    step = i
    const [lo, hi] = range
    const frac = 1 - (e.clientY - box.top) / box.height
    const next = [...values]
    next[i] = Math.round(lo + frac * (hi - lo))
    next[i] = Math.max(lo, Math.min(hi, next[i] as number))
    writeSequence({ ...sequence, values: next })
  }
</script>

<section class="inst" aria-labelledby="inst-title">
  <div class="head">
    <h2 id="inst-title" class="t-label">instrument</h2>
    <button type="button" class="chip t-micro" onclick={addInstrument}>add</button>
  </div>

  <div class="row">
    <label class="t-micro" for="inst-pick">slot</label>
    <select
      id="inst-pick"
      class="t-value"
      value={selected}
      onchange={(e) => (selected = Number(e.currentTarget.value))}
    >
      {#each song.doc.instruments as inst, i (i)}
        <option value={i}>{i.toString(16).padStart(2, '0')} · {inst.name}</option>
      {/each}
    </select>
    <label class="t-micro" for="inst-name">name</label>
    <input
      id="inst-name"
      class="t-value"
      type="text"
      value={instrument.name}
      onchange={(e) => setInstrumentName(e.currentTarget.value)}
    />
  </div>

  <ul class="macros">
    {#each MACRO_KINDS as kind (kind)}
      <li>
        <button
          type="button"
          class="t-micro kind"
          aria-pressed={macro === kind}
          onclick={() => {
            macro = kind
            step = 0
          }}
        >
          {kind === 'hiPitch' ? 'hi pitch' : kind}
        </button>
        <span class="t-micro slot">
          {instrument.macros[kind] < 0 ? 'none' : `slot ${instrument.macros[kind]}`}
        </span>
        {#if instrument.macros[kind] < 0}
          <button type="button" class="chip t-micro" onclick={() => newSequence(kind)}>new</button>
        {:else}
          <button type="button" class="chip t-micro" onclick={() => setMacroSlot(kind, -1)}>
            clear
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="envelope">
    <canvas bind:this={canvas} aria-hidden="true" onpointerdown={onCanvasPointer}></canvas>
    <div
      class="handle"
      role="slider"
      tabindex="0"
      aria-label="{macro === 'hiPitch' ? 'hi pitch' : macro} envelope"
      aria-valuemin={range[0]}
      aria-valuemax={range[1]}
      aria-valuenow={valueAt}
      aria-valuetext={valueText}
      onkeydown={onKeyDown}
    ></div>
  </div>

  <details class="help">
    <summary class="t-micro">editing reference</summary>
    <p class="t-micro">
      arrows edit · shift for bigger steps · + and − change length · l sets the loop point · r
      sets the release point. macros are shared by index, so two instruments on the same slot
      share the envelope.
    </p>
  </details>
</section>

<style>
  .inst {
    display: grid;
    gap: var(--s-2);
    align-content: start;
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-2);
  }

  h2 {
    margin: 0;
    color: var(--enclosure-ink-2);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-1) var(--s-2);
  }

  label {
    color: var(--enclosure-ink-2);
  }

  select,
  input {
    min-width: 0;
    padding: 2px var(--s-1);
    font-family: var(--font-ui);
    color: var(--grid-ink);
    background: var(--grid-bg);
    border: 1px solid var(--grid-hairline);
    border-radius: var(--r-1);
  }

  input {
    flex: 1 1 8ch;
  }

  .macros {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .macros li {
    display: grid;
    grid-template-columns: 8ch 1fr auto;
    align-items: center;
    gap: var(--s-2);
  }

  .kind {
    padding: 2px var(--s-1);
    text-align: left;
    color: var(--enclosure-ink);
    background: transparent;
    border: 0;
    border-radius: var(--r-1);
    cursor: pointer;
  }

  .kind[aria-pressed='true'] {
    color: var(--n-000);
    background: var(--grid-accent);
  }

  .slot {
    color: var(--enclosure-ink-2);
  }

  .envelope {
    position: relative;
    background: var(--grid-bg);
    border-radius: var(--r-2);
    box-shadow: var(--sh-inset);
  }

  canvas {
    display: block;
    width: 100%;
    height: 72px;
    touch-action: none;
  }

  .handle {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .handle:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .help {
    color: var(--enclosure-ink-2);
    line-height: 1.5;
  }

  .help summary {
    width: fit-content;
    color: var(--chip-accent);
    cursor: pointer;
  }

  .help summary:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .help[open] summary {
    margin-block-end: var(--s-1);
  }

  .chip {
    padding: 3px var(--s-2);
    color: var(--chip-accent);
    background: var(--chip-bg);
    border: 0;
    border-radius: var(--r-1);
    box-shadow: var(--sh-inset);
    cursor: pointer;
  }

  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
