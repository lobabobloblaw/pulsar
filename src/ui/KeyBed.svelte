<!--
  pulsar — KeyBed (plan C8, Ivory bed).

  Two octaves and a top C, matching the QWERTY map exactly, so the printed
  note names and the physical keys are the same instrument rather than two.
  Below 600px the bed shows ONE octave (semitones 0–11, seven whites and five
  blacks) and the keytop's octave caps move it; QWERTY still plays both rows.
  Nothing in the bed scrolls: white keys are flex children that share the
  width, black keys are positioned by percentage of the white count.

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
  import { LOCAL_VELOCITY, codeForSemitone } from '../input/keyboard'
  import { noteHolder, type NoteHolder } from '../input/noteOwnership'
  import { noteName, transport } from '../state/transport.svelte'
  import { viewport } from './viewport.svelte'

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
    /** The QWERTY code that plays it (kept for the map's own sake). */
    code: string | undefined
  }

  const KEYS: KeyDef[] = buildKeys()

  function buildKeys(): KeyDef[] {
    const out: KeyDef[] = []
    let whites = 0
    for (let s = 0; s < SEMITONES; s++) {
      const black = BLACK.has(s % 12)
      out.push({ semitone: s, black, whiteIndex: whites, code: codeForSemitone(s) })
      if (!black) whites++
    }
    return out
  }

  /** The phone shows one octave; the keytop's octave caps move it. */
  const visible = $derived(viewport.narrow ? KEYS.filter((k) => k.semitone < 12) : KEYS)
  const whiteKeys = $derived(visible.filter((k) => !k.black))
  const blackKeys = $derived(visible.filter((k) => k.black))
  const lastSemitone = $derived((visible[visible.length - 1] as KeyDef).semitone)

  const audio = bridge()

  let cursor = $state(0)

  // A narrower bed can leave the cursor on a key that no longer exists;
  // aria-activedescendant must always name a rendered key.
  $effect(() => {
    if (cursor > lastSemitone) cursor = lastSemitone
  })

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
  /** `c4` -> `C4`: the printed name on a white key. */
  const printedName = (s: number): string => noteName(noteOfSemitone(s)).toUpperCase()

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
        cursor = Math.min(lastSemitone, cursor + 1)
        break
      case 'ArrowLeft':
        cursor = Math.max(0, cursor - 1)
        break
      case 'Home':
        cursor = 0
        break
      case 'End':
        cursor = lastSemitone
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
  <div class="row" style:--whites={whiteKeys.length}>
    {#each whiteKeys as k (k.semitone)}
      <div
        id={keyId(k.semitone)}
        data-semitone={k.semitone}
        class="key white"
        class:pressed={isPressed(k.semitone)}
        class:cursor={cursor === k.semitone}
        role="button"
        tabindex="-1"
        aria-label={noteName(noteOfSemitone(k.semitone))}
        aria-pressed={isPressed(k.semitone)}
        onpointerdown={(e) => onPointerDown(e, k.semitone)}
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
      >
        <span class="legend">{printedName(k.semitone)}</span>
      </div>
    {/each}

    {#each blackKeys as k (k.semitone)}
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
        style:--wi={k.whiteIndex}
        onpointerdown={(e) => onPointerDown(e, k.semitone)}
        onpointerenter={(e) => onPointerEnter(e, k.semitone)}
      ></div>
    {/each}
  </div>
</div>

<style>
  /* The bed: a recessed tray under the panel lip, the keys standing in it. */
  .bed {
    height: 136px;
    padding: 7px 7px 10px;
    background: var(--key-bed);
    border-radius: var(--r-cap);
    box-shadow: var(--sh-bed);
    touch-action: none;
  }

  .bed:focus-visible {
    outline: none;
    box-shadow: var(--sh-bed), var(--focus);
  }

  .row {
    position: relative;
    display: flex;
    gap: 4px;
    height: 100%;
  }

  /* The global `.key` is the cap vocabulary; a piano key is not a cap. */
  .key {
    min-height: 0;
    padding: 0;
    gap: 0;
    font: inherit;
    white-space: normal;
    border: 0;
    box-shadow: none;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
    touch-action: none;
  }

  .white {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 9px;
    color: #62665b;
    background: linear-gradient(#e3e4da 0%, var(--key-face) 70%);
    border-radius: 2px 2px var(--r-cap) var(--r-cap);
    box-shadow:
      0 4px 0 #b0b3a4,
      0 5px 2px rgb(0 0 0 / 0.3);
    z-index: 0;
    transition:
      transform var(--dur-fast) var(--ease),
      box-shadow var(--dur-fast) var(--ease);
  }

  /* Black keys straddle the gap between two whites: centred on the boundary
     at whiteIndex / whites, 65% of a white's pitch wide. */
  .black {
    position: absolute;
    top: 0;
    left: calc(var(--wi) * 100% / var(--whites) - 32.5% / var(--whites));
    width: calc(65% / var(--whites));
    height: 74px;
    color: #c5c9ba;
    background: linear-gradient(var(--key-face-sharp), #3f4439);
    border: 1px solid #151a10;
    border-radius: 2px 2px var(--r-cap) var(--r-cap);
    box-shadow:
      0 4px 0 #141710,
      0 6px 4px rgb(0 0 0 / 0.3);
    z-index: 2;
    transition:
      transform var(--dur-fast) var(--ease),
      box-shadow var(--dur-fast) var(--ease);
  }

  /* Pressed state is never colour alone: the key also drops and swallows its
     shadow, and aria-pressed carries it to assistive tech. */
  .key.pressed {
    color: var(--enclosure-ink);
    background: var(--key-active);
    box-shadow: 0 1px 0 #a74325;
    transform: translateY(3px);
  }

  .black.pressed {
    border-color: #a74325;
  }

  @media (prefers-contrast: more) {
    .white {
      background: var(--key-face);
    }
    .black {
      background: var(--key-face-sharp);
    }
  }

  .key.cursor::after {
    content: '';
    position: absolute;
    inset: auto 50% 26px;
    width: 6px;
    height: 6px;
    margin-left: -3px;
    border-radius: var(--r-max);
    background: var(--enclosure-accent);
  }

  .black.cursor::after {
    bottom: 8px;
    background: var(--key-face);
  }

  .legend {
    pointer-events: none;
    font-family: var(--font-ui);
    font-size: var(--t-caption-size);
    line-height: 1;
    transition: color var(--dur-fast) var(--ease);
  }

  /* Thumbs get a deeper bed. */
  @media (pointer: coarse) {
    .bed {
      height: 164px;
    }

    .black {
      height: 100px;
    }
  }
</style>
