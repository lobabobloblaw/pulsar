/* pulsar — transport / session state (plan C5).
 *
 * Everything the StatusBar chips and the KeyBed highlight read. `notes` is the
 * union of ALL note sources (QWERTY, pointer, MIDI) so the keybed lights the
 * same way no matter what played the note — and so a single allNotesOff() can
 * truthfully clear it.
 *
 * PER-SOURCE REFCOUNTS (phase-2 design §7.2, absorbed Phase-1 polish item).
 * A set of note numbers cannot answer "is anyone else still holding this?", so
 * the first source to release used to cut a note a second source still had
 * down: hold c4 on the keybed with the mouse, tap `z`, release `z`, and the
 * pointer's note died. The tracker makes that worse, not better — step record
 * is a third source and record-while-playing a fourth.
 *
 * The model: every note keeps the SET of sources holding it. `noteOn` returns
 * true only for the first holder and `noteOff` only for the last, and callers
 * dispatch to the bridge on that answer. Source identity rather than a plain
 * counter, so a repeated note-on from one source is idempotent — which is what
 * a MIDI controller with a sticky key sends.
 */

import { SvelteSet } from 'svelte/reactivity'
import type { AudioBridge, BridgeStatus } from '../audio/bridge'

export type MidiPermission = 'unknown' | 'granted' | 'denied' | 'unavailable' | 'blocked'

export interface MidiPort {
  readonly id: string
  readonly name: string
  readonly manufacturer: string
}

export interface MidiState {
  supported: boolean
  permission: MidiPermission
  ports: MidiPort[]
}

export type ConsoleModel = 'nes' | 'famicom'
export type Room = 'day' | 'night'
/** `song` is the tracker's page on the lattice (design §5.6). */
export type ScreenPage = 'boot' | 'params' | 'scope' | 'midi' | 'song'

export const SCREEN_PAGES: readonly ScreenPage[] = ['params', 'scope', 'song', 'midi']

/** Everything that can hold a note down. Step record and record-while-playing
 *  are the two the tracker adds (§7.2). */
export type NoteSource = 'qwerty' | 'pointer' | 'midi' | 'tracker' | 'record'

const ROOM_KEY = 'pulsar.room'

function initialRoom(): Room {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(ROOM_KEY) : null
  if (stored === 'day' || stored === 'night') return stored
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'night'
  }
  return 'day'
}

class TransportState {
  audio = $state<BridgeStatus>({
    state: 'idle',
    sampleRate: 0,
    crossOriginIsolated: false,
    transport: 'postMessage',
    baseLatencyMs: 0,
  })

  midi = $state<MidiState>({ supported: false, permission: 'unknown', ports: [] })

  /** Every sounding note number, from every source — the keybed highlight. */
  readonly notes = new SvelteSet<number>()

  /** note -> the sources currently holding it. Never exposed directly; the two
   *  booleans `noteOn`/`noteOff` return are the whole contract. */
  readonly #holders = new Map<number, Set<NoteSource>>()

  /** Base octave for the QWERTY keybed; `KeyZ` plays C at this octave. */
  octave = $state(4)

  room = $state<Room>('day')
  consoleModel = $state<ConsoleModel>('nes')
  page = $state<ScreenPage>('boot')
  /** Set once the boot sequence has been dismissed by the first keydown. */
  booted = $state(false)
  /** Dev only, written from the rAF at 4 Hz — the one exception to the
   *  "never write $state from the frame loop" rule. */
  fps = $state(0)

  #bridge: AudioBridge | null = null

  constructor() {
    this.room = initialRoom()
  }

  /** Mirrors `params.attach`: App wires the bridge in, the store never imports it.
   *  Pushes the current model so a pre-attach toggle is not lost. */
  attach(bridge: AudioBridge): void {
    this.#bridge = bridge
    bridge.setConsoleModel(this.consoleModel)
  }

  setRoom(room: Room): void {
    this.room = room
    document.documentElement.dataset['room'] = room
    try {
      localStorage.setItem(ROOM_KEY, room)
    } catch {
      /* private mode: the room still applies for this session */
    }
  }

  toggleRoom(): void {
    this.setRoom(this.room === 'day' ? 'night' : 'day')
  }

  toggleModel(): void {
    this.consoleModel = this.consoleModel === 'nes' ? 'famicom' : 'nes'
    this.#bridge?.setConsoleModel(this.consoleModel)
  }

  nextPage(): void {
    const i = SCREEN_PAGES.indexOf(this.page)
    this.page = SCREEN_PAGES[(i + 1) % SCREEN_PAGES.length] ?? 'params'
  }

  setPage(p: ScreenPage): void {
    this.page = p
  }

  setOctave(n: number): void {
    this.octave = n < 0 ? 0 : n > 8 ? 8 : n
  }

  /** Register `source` as holding `note`.
   *  @returns true when this is the FIRST holder — i.e. the caller should send
   *  the note-on. A second source joining an already-sounding note gets false
   *  and must not retrigger it. */
  noteOn(note: number, source: NoteSource = 'qwerty'): boolean {
    let held = this.#holders.get(note)
    if (held === undefined) {
      held = new Set()
      this.#holders.set(note, held)
    }
    const first = held.size === 0
    held.add(source)
    if (first) this.notes.add(note)
    return first
  }

  /** Release `source`'s hold on `note`.
   *  @returns true when the LAST holder let go — i.e. the caller should send the
   *  note-off. This is the whole fix: a QWERTY keyup on a note the pointer or
   *  the tracker still holds returns false and nothing is cut. */
  noteOff(note: number, source: NoteSource = 'qwerty'): boolean {
    const held = this.#holders.get(note)
    if (held === undefined || !held.delete(source)) return false
    if (held.size > 0) return false
    this.#holders.delete(note)
    this.notes.delete(note)
    return true
  }

  /** How many sources hold `note`. For tests and the dev readout. */
  holdCount(note: number): number {
    return this.#holders.get(note)?.size ?? 0
  }

  /** The panic path. Every source loses every note at once, which is exactly
   *  what `bridge.allNotesOff()` does on the audio side. */
  clearNotes(): void {
    this.#holders.clear()
    this.notes.clear()
  }
}

export const transport = new TransportState()

/** `c4`, `f#3` — used by the keybed's aria-labels and the live region. */
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'] as const

export function noteName(note: number): string {
  const n = NOTE_NAMES[((note % 12) + 12) % 12] ?? 'c'
  return `${n}${Math.floor(note / 12) - 1}`
}
