<!--
  pulsar — KeyBed (plan C8).

  Two octaves and a top C, matching the QWERTY map exactly, so the printed
  legends and the physical keys are the same instrument rather than two.

  This component RENDERS ONLY. It does not listen for typing — input/keyboard.ts
  owns the window keydown/keyup listeners, which is what lets a letter play a
  note while a knob has focus.

  Accessibility: one tab stop for the whole keybed (the container), a visible key
  cursor moved with the arrows and reported via aria-activedescendant, Home/End
  to jump, Space/Enter to play (down = on, up = off). `role="toolbar"` is the
  composite role that legitimately supports aria-activedescendant over button
  children — a keybed is, structurally, a toolbar of buttons.

  NOTE LIFETIME — the three rules this component lives by:

   1. ONE HOLD PER POINTER. `pointerup` fires per pointerId, so the press is
      remembered in a Map keyed by pointerId. Two fingers on two keys are two
      independent notes: lifting the first releases exactly the note the first
      finger started and leaves the second sounding until its own lift. A single
      scalar "current pointer note" strands one of them for ever, because no
      blur or visibilitychange follows a plain finger lift.

   2. RELEASE WHAT YOU PLAYED, NOT WHAT IS UNDER THE CURSOR. Space/Enter
      remember the note they started. The cursor may move (arrows) or focus may
      leave (Tab) between keydown and keyup, and Tab means the element-level
      keyup is never seen at all — hence the focusout release. Tab itself is
      never trapped; a keybed you cannot leave is a worse bug than a stuck note.

   3. RELEASE ONLY WHAT YOU STARTED. Every pointer and the keyboard cursor gets
      a distinct transport holder token. The highlighted-note set remains the
      union, while lifting one finger releases exactly that finger's hold.

  Stuck-note guard: pointerup, pointercancel, leaving the bed and losing the
  window all release. The all-source guards (blur, visibilitychange -> panic)
  live in input/keyboard.ts; a panic from there can leave this map holding notes
  the engine has already dropped, which costs one harmless duplicate note-off.
-->
<script lang="ts">
  import { tracker } from '../state/tracker.svelte'
  import { bridge } from '../audio/bridge'
  import { LOCAL_VELOCITY, codeForSemitone, keyLegend } from '../input/keyboard'
  import { noteHolder, type NoteHolder } from '../input/noteOwnership'
  import { noteName, transport } from '../state/transport.svelte'

  interface Props {
    announce?: ((message: string) => void) | undefined
  }
  let { announce }: Props = $props()

  const SEMITONES = 25
  const BLACK = new Set([1, 3, 6, 8, 10])

  interface KeyDef {
    semitone: number
    black: boolean
    /** Index among white keys — drives x position for both key types. */
    whiteIndex: number
    legend: string
  }

  const KEYS: KeyDef[] = buildKeys()

  function buildKeys(): KeyDef[] {
    const out: KeyDef[] = []
    let whites = 0
    for (let s = 0; s < SEMITONES; s++) {
      const black = BLACK.has(s % 12)
      const code = codeForSemitone(s)
      out.push({
        semitone: s,
        black,
        whiteIndex: whites,
        legend: black ? '' : code ? keyLegend(code) : '',
      })
      if (!black) whites++
    }
    return out
  }

  const WHITE_KEYS = KEYS.filter((k) => !k.black)
  const BLACK_KEYS = KEYS.filter((k) => k.black)

  const audio = bridge()
  let scroll = $state<HTMLDivElement | null>(null)
  let range = $state(0)
  function shiftRange(delta: number): void {
    releaseAll()
    range = Math.max(0, Math.min(1, range + delta))
    if (scroll) scroll.scrollLeft = range * 280
  }

  let cursor = $state(0)

  interface PointerHold {
    semitone: number
    note: number
    holder: NoteHolder
  }

  /** One entry per pointer that is currently down on the bed. */
  const pointers = new Map<number, PointerHold>()

  /** The note Space/Enter started — a note, not a cursor position. */
  let cursorNote: number | null = null
  const cursorHolder = noteHolder('pointer', 'keyboard')

  const noteOfSemitone = (s: number): number => (transport.octave + 1) * 12 + s
  const keyId = (s: number): string => `key-${s}`

  /** Registers one physical hold; only the first global holder reaches audio. */
  function play(semitone: number, holder: NoteHolder): number {
    const note = noteOfSemitone(semitone)
    announce?.(noteName(note))
    if (transport.noteOn(note, holder)) audio.noteOn(note, LOCAL_VELOCITY)
    if (tracker.open && tracker.editing && matchMedia('(min-width: 721px)').matches) {
      window.dispatchEvent(new CustomEvent('pulsar:enter-note', { detail: note }))
    }
    return note
  }

  function release(note: number, holder: NoteHolder): void {
    if (transport.noteOff(note, holder)) audio.noteOff(note)
  }

  function onPointerDown(e: PointerEvent, semitone: number): void {
    e.preventDefault()
    cursor = semitone
    const previous = pointers.get(e.pointerId)
    if (previous !== undefined) release(previous.note, previous.holder)
    const holder = noteHolder('pointer', e.pointerId)
    pointers.set(e.pointerId, { semitone, note: play(semitone, holder), holder })
  }

  function onPointerMove(e: PointerEvent): void {
    const hold = pointers.get(e.pointerId)
    if (!hold) return
    const key = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-semitone]')
    if (!key) { endPointer(e); return }
    onPointerEnter(e, Number(key.dataset['semitone']))
  }

  /** Glissando: dragging a held pointer onto another key retriggers, per
   *  pointer — the other fingers are untouched. */
  function onPointerEnter(e: PointerEvent, semitone: number): void {
    const hold = pointers.get(e.pointerId)
    if (hold === undefined || (e.buttons & 1) === 0) return
    if (hold.semitone === semitone) return
    release(hold.note, hold.holder)
    pointers.set(e.pointerId, {
      semitone,
      note: play(semitone, hold.holder),
      holder: hold.holder,
    })
  }

  /** pointerup / pointercancel / leaving the bed — always for ONE pointer. */
  function endPointer(e: PointerEvent): void {
    const hold = pointers.get(e.pointerId)
    if (hold === undefined) return
    pointers.delete(e.pointerId)
    release(hold.note, hold.holder)
  }

  /** Tab away, or focus taken by a click elsewhere, while Space is down: the
   *  keyup lands on the new focus owner and this element never sees it. */
  function releaseCursorNote(): void {
    if (cursorNote === null) return
    release(cursorNote, cursorHolder)
    cursorNote = null
  }

  /** Losing the window means no pointerup and no keyup will ever arrive.
   *  input/keyboard.ts panics for every source; this drops what we own so the
   *  bookkeeping cannot outlive the notes. */
  function releaseAll(): void {
    releaseCursorNote()
    for (const hold of pointers.values()) release(hold.note, hold.holder)
    pointers.clear()
  }

  function onKeyDown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowRight':
        cursor = Math.min(SEMITONES - 1, cursor + 1)
        break
      case 'ArrowLeft':
        cursor = Math.max(0, cursor - 1)
        break
      case 'Home':
        cursor = 0
        break
      case 'End':
        cursor = SEMITONES - 1
        break
      case ' ':
      case 'Enter':
        // One note at a time from the cursor: Enter while Space is down must
        // not orphan the note Space started.
        if (!e.repeat && cursorNote === null) cursorNote = play(cursor, cursorHolder)
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    releaseCursorNote()
  }

  const isPressed = (s: number): boolean => transport.notes.has(noteOfSemitone(s))
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={endPointer} onpointercancel={endPointer} onblur={releaseAll} />

<div class="range-controls">
  <button type="button" aria-label="lower keyboard range" disabled={range === 0} onclick={() => shiftRange(-1)}>← Lower keys</button>
  <span>octave {transport.octave + range}</span>
  <button type="button" aria-label="upper keyboard range" disabled={range === 1} onclick={() => shiftRange(1)}>Upper keys →</button>
</div>
<div class="bed-scroll" bind:this={scroll}>
  <div
    class="bed"
    role="toolbar"
    aria-orientation="horizontal"
    aria-label="keybed, octave {transport.octave}"
    tabindex="0"
    aria-activedescendant={keyId(cursor)}
    onkeydown={onKeyDown}
    onkeyup={onKeyUp}
    onfocusout={releaseCursorNote}
    onpointerleave={endPointer}
  >
    {#each WHITE_KEYS as k (k.semitone)}
      <div
        id={keyId(k.semitone)}
        data-semitone={k.semitone}
        class="key white"
        class:pressed={isPressed(k.semitone)}
        class:cursor={cursor === k.semitone}
        class:snap={k.semitone % 12 === 0}
        role="button"
        tabindex="-1"
        aria-label={noteName(noteOfSemitone(k.semitone))}
        aria-pressed={isPressed(k.semitone)}
        style:left="{k.whiteIndex * 40}px"
        onpointerdown={(e) => onPointerDown(e, k.semitone)}
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
      >
        <span class="legend t-label">{k.legend}</span>
      </div>
    {/each}

    {#each BLACK_KEYS as k (k.semitone)}
      <div
        id={keyId(k.semitone)}
        data-semitone={k.semitone}
        class="key black"
        class:pressed={isPressed(k.semitone)}
        class:cursor={cursor === k.semitone}
        role="button"
        tabindex="-1"
        aria-label={noteName(noteOfSemitone(k.semitone))}
        aria-pressed={isPressed(k.semitone)}
        style:left="{k.whiteIndex * 40 - 13}px"
        onpointerdown={(e) => onPointerDown(e, k.semitone)}
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
      ></div>
    {/each}
  </div>
</div>

<style>
  .range-controls { display: none; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 8px; }
  .range-controls button { min-height: 44px; padding: 8px; border: 1px solid var(--enclosure-hairline); border-radius: 4px; background: var(--enclosure-bg); color: var(--enclosure-ink); font: inherit; }
  .range-controls button:disabled { opacity: .4; }
  @media (max-width: 650px) { .range-controls { display: flex; } }

  .bed-scroll {
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    padding-bottom: var(--s-1);
  }

  .bed {
    position: relative;
    height: 140px;
    /* 15 white keys x 40px */
    width: 600px;
    margin-inline: auto;
    touch-action: none;
  }

  .bed:focus-visible {
    outline: none;
    box-shadow: var(--focus);
    border-radius: var(--r-1);
  }

  .key {
    position: absolute;
    top: 0;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }

  /* The lip of the enclosure shades the top of every key — the fallboard
     shadow that makes the bed read as recessed under the panel. */
  .bed::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 10px;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(180deg, rgb(0 0 0 / 0.2), transparent);
  }

  .white {
    width: 40px;
    height: 140px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: var(--s-3);
    background-color: var(--key-face);
    /* Lit from above: bright shoulder, body, a shaded front lip at the foot. */
    background-image: linear-gradient(
      180deg,
      rgb(255 255 255 / 0.55),
      rgb(255 255 255 / 0) 16%,
      rgb(0 0 0 / 0) 88%,
      rgb(0 0 0 / 0.07)
    );
    border: 1px solid var(--enclosure-hairline);
    border-radius: 0 0 var(--r-2) var(--r-2);
    box-shadow:
      var(--sh-inset),
      0 2px 2px rgb(0 0 0 / 0.16);
    color: var(--n-600);
    z-index: 0;
    transition:
      transform var(--dur-fast) var(--ease),
      box-shadow var(--dur-fast) var(--ease);
  }

  .white.snap {
    scroll-snap-align: start;
  }

  .black {
    width: 26px;
    height: 88px;
    background-color: var(--key-face-sharp);
    background-image: linear-gradient(
      180deg,
      rgb(255 255 255 / 0.22),
      rgb(255 255 255 / 0) 18%,
      rgb(0 0 0 / 0.25)
    );
    border-radius: 0 0 var(--r-1) var(--r-1);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.16),
      0 3px 4px rgb(0 0 0 / 0.38);
    z-index: 1;
    transition:
      transform var(--dur-fast) var(--ease),
      box-shadow var(--dur-fast) var(--ease);
  }

  /* Pressed state is never colour alone: the key also drops and swallows its
     light, the white legend flips, and aria-pressed carries it to assistive
     tech. */
  .white.pressed {
    background: var(--key-active);
    color: var(--n-000);
    transform: translateY(2px);
    box-shadow: inset 0 2px 3px rgb(0 0 0 / 0.25);
  }

  .black.pressed {
    transform: translateY(2px);
    box-shadow:
      inset 0 -3px 0 0 var(--key-active),
      0 1px 2px rgb(0 0 0 / 0.3);
  }

  @media (prefers-contrast: more) {
    .bed::before {
      background: none;
    }
    .white,
    .black {
      background-image: none;
    }
  }

  .key.cursor::after {
    content: '';
    position: absolute;
    inset: auto 50% 6px;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: var(--r-max);
    background: var(--enclosure-accent);
  }

  .black.cursor::after {
    bottom: 8px;
    background: var(--n-000);
  }

  .legend {
    pointer-events: none;
    transition: color var(--dur-fast) var(--ease);
  }

  @media (max-width: 560px) {
    .bed-scroll {
      scroll-snap-type: x mandatory;
    }
  }

  /* Thumbs get a deeper bed; the widths stay — 40px white keys are already
     honest touch targets. */
  @media (pointer: coarse) {
    .bed {
      height: 164px;
    }

    .white {
      height: 164px;
    }

    .black {
      height: 100px;
    }
  }
</style>
