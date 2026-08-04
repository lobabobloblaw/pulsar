/* pulsar — transport / session state (plan C5).
 *
 * Everything the StatusBar chips and the KeyBed highlight read. `notes` is the
 * union of ALL note sources (QWERTY, pointer, MIDI) so the keybed lights the
 * same way no matter what played the note — and so a single allNotesOff() can
 * truthfully clear it.
 */

import { SvelteSet } from 'svelte/reactivity'
import type { BridgeStatus } from '../audio/bridge'

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
export type ScreenPage = 'boot' | 'params' | 'scope' | 'midi'

export const SCREEN_PAGES: readonly ScreenPage[] = ['params', 'scope', 'midi']

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

  /** Every sounding note number, from every source. */
  readonly notes = new SvelteSet<number>()

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

  constructor() {
    this.room = initialRoom()
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

  noteOn(note: number): void {
    this.notes.add(note)
  }

  noteOff(note: number): void {
    this.notes.delete(note)
  }

  clearNotes(): void {
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
