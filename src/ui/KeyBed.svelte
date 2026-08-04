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

  Stuck-note guard: pointerup, pointercancel and leaving the bed all release.
  The window-level guards (blur, visibilitychange) live in input/keyboard.ts and
  cover every source at once.
-->
<script lang="ts">
  import { bridge } from '../audio/bridge'
  import { LOCAL_VELOCITY, codeForSemitone, keyLegend } from '../input/keyboard'
  import { noteName, transport } from '../state/transport.svelte'

  interface Props {
    announce?: (message: string) => void
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

  let cursor = $state(0)
  let pointerNote = $state<number | null>(null)

  const noteOfSemitone = (s: number): number => (transport.octave + 1) * 12 + s
  const keyId = (s: number): string => `key-${s}`

  function play(semitone: number): void {
    const note = noteOfSemitone(semitone)
    if (transport.notes.has(note)) return
    transport.noteOn(note)
    audio.noteOn(note, LOCAL_VELOCITY)
    announce?.(noteName(note))
  }

  function release(semitone: number): void {
    const note = noteOfSemitone(semitone)
    if (!transport.notes.has(note)) return
    transport.noteOff(note)
    audio.noteOff(note)
  }

  function onPointerDown(e: PointerEvent, semitone: number): void {
    e.preventDefault()
    cursor = semitone
    pointerNote = semitone
    play(semitone)
  }

  /** Glissando: entering a key with the button already down retriggers. */
  function onPointerEnter(semitone: number, buttons: number): void {
    if ((buttons & 1) === 0 || pointerNote === null) return
    if (pointerNote === semitone) return
    release(pointerNote)
    pointerNote = semitone
    play(semitone)
  }

  function endPointer(): void {
    if (pointerNote === null) return
    release(pointerNote)
    pointerNote = null
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
        if (!e.repeat) play(cursor)
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
    release(cursor)
  }

  const isPressed = (s: number): boolean => transport.notes.has(noteOfSemitone(s))
</script>

<svelte:window onpointerup={endPointer} onpointercancel={endPointer} />

<div class="bed-scroll">
  <div
    class="bed"
    role="toolbar"
    aria-orientation="horizontal"
    aria-label="keybed, octave {transport.octave}"
    tabindex="0"
    aria-activedescendant={keyId(cursor)}
    onkeydown={onKeyDown}
    onkeyup={onKeyUp}
    onpointerleave={endPointer}
  >
    {#each WHITE_KEYS as k (k.semitone)}
      <div
        id={keyId(k.semitone)}
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
        onpointerenter={(e) => onPointerEnter(k.semitone, e.buttons)}
      >
        <span class="legend t-label">{k.legend}</span>
      </div>
    {/each}

    {#each BLACK_KEYS as k (k.semitone)}
      <div
        id={keyId(k.semitone)}
        class="key black"
        class:pressed={isPressed(k.semitone)}
        class:cursor={cursor === k.semitone}
        role="button"
        tabindex="-1"
        aria-label={noteName(noteOfSemitone(k.semitone))}
        aria-pressed={isPressed(k.semitone)}
        style:left="{k.whiteIndex * 40 - 13}px"
        onpointerdown={(e) => onPointerDown(e, k.semitone)}
        onpointerenter={(e) => onPointerEnter(k.semitone, e.buttons)}
      ></div>
    {/each}
  </div>
</div>

<style>
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

  .white {
    width: 40px;
    height: 140px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: var(--s-3);
    background: var(--key-face);
    border: 1px solid var(--enclosure-hairline);
    border-radius: 0 0 var(--r-2) var(--r-2);
    box-shadow: var(--sh-inset);
    color: var(--n-600);
    z-index: 0;
  }

  .white.snap {
    scroll-snap-align: start;
  }

  .black {
    width: 26px;
    height: 88px;
    background: var(--key-face-sharp);
    border-radius: 0 0 var(--r-1) var(--r-1);
    z-index: 1;
  }

  /* Pressed state is never colour alone: the white key also drops 2px and its
     legend flips, and aria-pressed carries it to assistive tech. */
  .white.pressed {
    background: var(--key-active);
    color: var(--n-000);
    transform: translateY(2px);
    box-shadow: none;
  }

  .black.pressed {
    box-shadow: inset 0 -3px 0 0 var(--key-active);
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
</style>
