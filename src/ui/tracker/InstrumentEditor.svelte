<!--
  pulsar — the instrument / macro editor (design §4.1, §3.4; Ivory).

  Plain DOM for the structure, one small canvas for the envelope — the split
  §4.1 asks for. The canvas is aria-hidden; over it sits a single focusable
  `role="slider"` that carries the whole editor's state in `aria-valuetext`
  ("step 3 of 5, value 12, loops here"), which is the same honest device the
  dials use: one control, arrows to operate it, the drawing as the visual.

  Two columns: the song instrument (slot, name, add, sharing) on the left, the
  macro bank on the right — the macro caps, the envelope drawn as ink bars on
  the slab with a hairline baseline, the STEPS · LOOP · RELEASE line, the
  New sequence / Clear actions and the editing reference.

  Macros are shared BY INDEX across instruments (§1.2) — the number beside each
  macro name is a slot in the song's sequence bank, not a private envelope, and
  the sharing line says how many instruments read the selected slot.
-->
<script lang="ts">
  import { song } from '../../state/song.svelte'
  import {
    emptyInstrument,
    MACRO_KINDS,
    MAX_SEQUENCE_LENGTH,
    type Instrument,
    type MacroKind,
    type Sequence,
  } from '../../state/songModel'
  import { watchRoom, deviceRatio } from '../canvas/gridMetrics'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  let selected = $state(0)
  let macro = $state<MacroKind>('volume')
  let step = $state(0)
  let canvas = $state<HTMLCanvasElement | null>(null)

  /** The slab's own colours, resolved once and again on a room change — the
   *  bars are drawn on the enclosure, whose tokens dim with the room. */
  interface Ink {
    ink: string
    hairline: string
    accent: string
  }
  let ink: Ink | null = null

  function resolveInk(): Ink {
    const cs = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback
    return {
      ink: read('--enclosure-ink', '#252720'),
      hairline: read('--enclosure-hairline', '#b9bcb0'),
      accent: read('--enclosure-accent', '#df4a28'),
    }
  }

  const RANGE: Readonly<Record<MacroKind, readonly [number, number]>> = {
    volume: [0, 15],
    arpeggio: [-79, 79],
    pitch: [-127, 126],
    hiPitch: [-127, 126],
    duty: [0, 3],
  }

  const MACRO_NAMES: Readonly<Record<MacroKind, string>> = {
    volume: 'Volume',
    arpeggio: 'Arpeggio',
    pitch: 'Pitch',
    hiPitch: 'High pitch',
    duty: 'Duty',
  }

  const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0')

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

  /** How many instruments read the selected slot — the format shares by index. */
  const sharing = $derived.by(() => {
    if (macroIndex < 0) return 'No sequence assigned'
    const n = song.doc.instruments.filter((i) => i.macros[macro] === macroIndex).length
    return `Shared sequence ${hex2(macroIndex)} · ${n} ${n === 1 ? 'instrument' : 'instruments'}`
  })

  const meta = $derived.by(() => {
    if (sequence === null) return 'No sequence on this slot'
    const loop = sequence.loop < 0 ? 'OFF' : hex2(sequence.loop)
    const release = sequence.release < 0 ? 'OFF' : hex2(sequence.release)
    return `${values.length} steps · loop ${loop} · release ${release}`
  })

  /** FamiTracker's note spelling, `C-4` / `A#3`, for the DPCM key map. */
  const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'] as const
  function noteLabel(note: number): string {
    return `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`
  }

  const dpcmKeys = $derived.by(() => {
    const map = instrument.dpcm
    if (!map) return []
    return Object.entries(map)
      .map(([note, a]) => ({
        note: Number(note),
        sample: song.doc.samples[a.sample]?.name ?? `sample ${a.sample}`,
        rate: a.pitch,
      }))
      .sort((a, b) => a.note - b.note)
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
    // Step can be stale against this sequence (instrument switch, preset load):
    // clamp before the indexed write — a sparse slot corrupts the document.
    step = Math.min(step, values.length - 1)
    const [lo, hi] = range
    const next = [...values]
    next[step] = Math.max(lo, Math.min(hi, (next[step] ?? 0) + delta))
    writeSequence({ ...sequence, values: next })
  }

  function setLength(delta: number): void {
    if (sequence === null) return
    if (delta > 0 && values.length >= MAX_SEQUENCE_LENGTH) return
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
    // Same stale-step guard as setValue: never mark past the end.
    step = Math.min(step, values.length - 1)
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
    e.stopPropagation()
  }

  const BAR_H = 57
  const BAR_GAP = 3
  const BAR_MAX_W = 34

  /** Ink bars on the slab: a transparent canvas, so the enclosure's own face
   *  shows through; the current step in the accent; loop and release as
   *  1px ink marks; a hairline baseline where the values cross zero. */
  function draw(): void {
    const el = canvas
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ink ??= resolveInk()
    const p = ink
    const dpr = deviceRatio()
    const cssW = el.clientWidth || 240
    const cssH = BAR_H
    el.width = Math.round(cssW * dpr)
    el.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const n = Math.max(1, values.length)
    const bw = Math.min(BAR_MAX_W, (cssW - BAR_GAP * (n - 1)) / n)
    const [lo, hi] = range
    const span = hi - lo || 1
    const zeroY = cssH - ((0 - lo) / span) * cssH

    // The baseline: a hairline where zero sits (the floor for volume).
    ctx.fillStyle = p.hairline
    ctx.fillRect(0, Math.min(cssH - 1, Math.round(zeroY) - (zeroY >= cssH ? 1 : 0)), cssW, 1)

    for (let i = 0; i < values.length; i++) {
      const v = values[i] as number
      const y = cssH - ((v - lo) / span) * cssH
      ctx.fillStyle = i === step ? p.accent : p.ink
      const top = Math.min(y, zeroY)
      const h = Math.max(2, Math.abs(zeroY - y))
      ctx.fillRect(i * (bw + BAR_GAP), top, Math.max(1, bw), h)
    }

    if (sequence !== null) {
      ctx.fillStyle = p.ink
      if (sequence.loop >= 0) ctx.fillRect(sequence.loop * (bw + BAR_GAP), 0, 1, cssH)
      if (sequence.release >= 0) ctx.fillRect((sequence.release + 1) * (bw + BAR_GAP) - BAR_GAP - 1, 0, 1, cssH)
    }
  }

  // A preset load (or any document swap) can shrink the macro under the cursor
  // — keep step inside whatever sequence survives (length 0 → back to step 1).
  $effect(() => {
    step = Math.max(0, Math.min(step, values.length - 1))
  })

  $effect(() => {
    void values
    void step
    void macro
    draw()
  })

  $effect(() => {
    const stop = watchRoom(() => {
      ink = resolveInk()
      draw()
    })
    return stop
  })

  $effect(() => {
    const el = canvas
    if (!el) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(el)
    return () => ro.disconnect()
  })

  function onCanvasPointer(e: PointerEvent): void {
    const el = canvas
    if (!el || sequence === null) return
    const box = el.getBoundingClientRect()
    const n = Math.max(1, values.length)
    const bw = Math.min(BAR_MAX_W, (box.width - BAR_GAP * (n - 1)) / n)
    const i = Math.floor((e.clientX - box.left) / (bw + BAR_GAP))
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
  <div class="pick">
    <label class="t-micro" for="inst-pick" id="inst-title">Song instrument</label>
    <select
      id="inst-pick"
      class="window"
      value={selected}
      onchange={(e) => {
        selected = Number(e.currentTarget.value)
        step = 0
      }}
    >
      {#each song.doc.instruments as inst, i (i)}
        <option value={i}>{hex2(i)} · {inst.name}</option>
      {/each}
    </select>
    <label class="t-micro" for="inst-name">Name</label>
    <input
      id="inst-name"
      class="window"
      type="text"
      value={instrument.name}
      oninput={(e) => setInstrumentName(e.currentTarget.value)}
    />
    <div class="pick-actions">
      <button type="button" class="key mini" onclick={addInstrument}>Add instrument</button>
    </div>
    <span class="shared">{sharing}</span>
  </div>

  <div class="work">
    <div class="macros" role="group" aria-label="macro">
      {#each MACRO_KINDS as kind (kind)}
        <button
          type="button"
          class="key mini"
          aria-pressed={macro === kind}
          onclick={() => {
            macro = kind
            step = 0
          }}
        >
          {MACRO_NAMES[kind]}
        </button>
      {/each}
    </div>

    <div class="envelope">
      <canvas bind:this={canvas} aria-hidden="true" onpointerdown={onCanvasPointer}></canvas>
      <div
        class="handle"
        role="slider"
        tabindex="0"
        aria-label="{MACRO_NAMES[macro]} envelope"
        aria-valuemin={range[0]}
        aria-valuemax={range[1]}
        aria-valuenow={valueAt}
        aria-valuetext={valueText}
        onkeydown={onKeyDown}
      ></div>
    </div>

    <p class="meta t-micro">{meta}</p>

    {#if dpcmKeys.length > 0}
      <ul class="dpcm t-micro" aria-label="DPCM key assignments">
        {#each dpcmKeys as k (k.note)}
          <li>{noteLabel(k.note)} → {k.sample} / rate {k.rate}</li>
        {/each}
      </ul>
    {/if}

    <div class="actions">
      {#if macroIndex < 0}
        <button type="button" class="key mini" onclick={() => newSequence(macro)}>New sequence</button>
      {:else}
        <button type="button" class="key mini" onclick={() => setMacroSlot(macro, -1)}>Clear</button>
      {/if}

      <details class="help">
        <summary class="key mini" title="editing reference">
          <span aria-hidden="true">?</span>
          <span class="sr">editing reference</span>
        </summary>
        <p class="t-body">
          Arrows edit · Shift for bigger steps · + and − change length · L sets the loop point ·
          R sets the release point · click a bar to set it. Macros are shared by index, so two
          instruments on the same slot share the envelope.
        </p>
      </details>
    </div>
  </div>
</section>

<style>
  .inst {
    display: grid;
    grid-template-columns: 210px minmax(0, 1fr);
    gap: 22px;
    align-items: start;
    min-width: 0;
    padding: 17px 0 23px;
  }

  .pick {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  }

  .pick select,
  .pick input {
    width: 100%;
    min-width: 0;
    font-size: 12px;
  }

  .pick-actions {
    margin-top: 4px;
  }

  .shared {
    margin-top: 5px;
    font-size: 11px;
    color: var(--enclosure-ink-2);
  }

  .work {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .macros {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .macros .key {
    min-height: 25px;
    padding: 3px 7px;
    font-size: 10px;
    background: transparent;
    box-shadow: none;
  }

  .macros .key[aria-pressed='true'] {
    background: var(--enclosure-ink);
  }

  /* The envelope is drawn ON the slab: a transparent canvas over the face, a
     hairline under it, the handle laid over both. */
  .envelope {
    position: relative;
    margin: 12px 0 7px;
    border-bottom: 1px solid var(--enclosure-hairline);
  }

  canvas {
    display: block;
    width: 100%;
    height: 57px;
    touch-action: none;
  }

  .handle {
    position: absolute;
    inset: 0;
    border-radius: var(--r-1);
  }

  .handle:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }

  .meta {
    margin: 0;
  }

  .dpcm {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    text-transform: none;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }

  .help {
    position: relative;
    color: var(--enclosure-ink-2);
    line-height: 1.5;
  }

  .help summary {
    list-style: none;
    font-family: var(--font-ui);
    font-weight: 700;
    width: 28px;
    padding: 3px 0;
  }

  .help summary::-webkit-details-marker {
    display: none;
  }

  .help[open] p {
    position: absolute;
    left: 0;
    top: calc(100% + 8px);
    z-index: 5;
    width: min(56ch, 80vw);
    margin: 0;
    padding: 12px 14px;
    color: var(--enclosure-ink);
    background: var(--chip-bg);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 8px;
    box-shadow: 0 8px 16px rgb(0 0 0 / 0.15);
  }

  @media (max-width: 850px) {
    .inst {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
</style>
