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

   3. RELEASE ONLY WHAT YOU STARTED. `transport.notes` is the UNION of every
      source (QWERTY, pointer, MIDI) and drives the highlight, but it is not
      ownership: it has no per-source counts, so it cannot answer "is anyone
      else still holding this?". This component therefore keeps its own `owned`
      map and arbitrates play/release on that alone — clicking a key the
      computer keyboard is physically holding neither retriggers it nor, on
      release, cuts it.

  Stuck-note guard: pointerup, pointercancel, leaving the bed and losing the
  window all release. The all-source guards (blur, visibilitychange -> panic)
  live in input/keyboard.ts; a panic from there can leave this map holding notes
  the engine has already dropped, which costs one harmless duplicate note-off.
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

  /** The notes THIS component started, note number -> how many of its own holds
   *  are on it (two fingers can land on one key during a glissando). Ownership,
   *  not highlight: the highlight is `transport.notes`, the union. */
  const owned = new Map<number, number>()

  interface PointerHold {
    semitone: number
    /** null when the press landed on a note another source already held, i.e.
     *  this component owns nothing and must release nothing. */
    note: number | null
  }

  /** One entry per pointer that is currently down on the bed. */
  const pointers = new Map<number, PointerHold>()

  /** The note Space/Enter started — a note, not a cursor position. */
  let cursorNote: number | null = null

  const noteOfSemitone = (s: number): number => (transport.octave + 1) * 12 + s
  const keyId = (s: number): string => `key-${s}`

  /** Starts a note and takes ownership of it. Returns the note that must later
   *  be handed to `release`, or null when this component started nothing. */
  function play(semitone: number): number | null {
    const note = noteOfSemitone(semitone)
    announce?.(noteName(note))

    const mine = owned.get(note)
    if (mine !== undefined) {
      // Already ours: count the extra hold, do not retrigger.
      owned.set(note, mine + 1)
      return note
    }
    // Someone else's note. Leave it entirely alone — retriggering would be
    // inaudible and releasing it later would cut a note we never started.
    if (transport.notes.has(note)) return null

    owned.set(note, 1)
    transport.noteOn(note)
    audio.noteOn(note, LOCAL_VELOCITY)
    return note
  }

  /** Releases a note this component owns. Never consults the union to decide. */
  function release(note: number): void {
    const mine = owned.get(note)
    if (mine === undefined) return
    if (mine > 1) {
      owned.set(note, mine - 1)
      return
    }
    owned.delete(note)
    transport.noteOff(note)
    audio.noteOff(note)
  }

  function onPointerDown(e: PointerEvent, semitone: number): void {
    e.preventDefault()
    cursor = semitone
    pointers.set(e.pointerId, { semitone, note: play(semitone) })
  }

  /** Glissando: dragging a held pointer onto another key retriggers, per
   *  pointer — the other fingers are untouched. */
  function onPointerEnter(e: PointerEvent, semitone: number): void {
    const hold = pointers.get(e.pointerId)
    if (hold === undefined || (e.buttons & 1) === 0) return
    if (hold.semitone === semitone) return
    if (hold.note !== null) release(hold.note)
    pointers.set(e.pointerId, { semitone, note: play(semitone) })
  }

  /** pointerup / pointercancel / leaving the bed — always for ONE pointer. */
  function endPointer(e: PointerEvent): void {
    const hold = pointers.get(e.pointerId)
    if (hold === undefined) return
    pointers.delete(e.pointerId)
    if (hold.note !== null) release(hold.note)
  }

  /** Tab away, or focus taken by a click elsewhere, while Space is down: the
   *  keyup lands on the new focus owner and this element never sees it. */
  function releaseCursorNote(): void {
    if (cursorNote === null) return
    release(cursorNote)
    cursorNote = null
  }

  /** Losing the window means no pointerup and no keyup will ever arrive.
   *  input/keyboard.ts panics for every source; this drops what we own so the
   *  bookkeeping cannot outlive the notes. */
  function releaseAll(): void {
    cursorNote = null
    pointers.clear()
    for (const note of owned.keys()) {
      transport.noteOff(note)
      audio.noteOff(note)
    }
    owned.clear()
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
        if (!e.repeat && cursorNote === null) cursorNote = play(cursor)
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

<svelte:window onpointerup={endPointer} onpointercancel={endPointer} onblur={releaseAll} />

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
    onfocusout={releaseCursorNote}
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
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
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
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
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
