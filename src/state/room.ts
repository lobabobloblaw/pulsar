export type Room = 'day' | 'night'

const ROOM_KEY = 'pulsar.room'

export interface RoomStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface BrowserGlobals {
  localStorage?: RoomStorage
  matchMedia?: (query: string) => { matches: boolean }
}

function globals(): BrowserGlobals {
  return globalThis as unknown as BrowserGlobals
}

function browserStorage(): RoomStorage | undefined {
  try {
    return globals().localStorage
  } catch {
    return undefined
  }
}

function browserPrefersDark(): boolean {
  try {
    const browser = globals()
    return browser.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  } catch {
    return false
  }
}

export function initialRoom(
  storage: RoomStorage | undefined = browserStorage(),
  prefersDark: () => boolean = browserPrefersDark,
): Room {
  try {
    const stored = storage?.getItem(ROOM_KEY)
    if (stored === 'day' || stored === 'night') return stored
  } catch {
    /* blocked storage falls through to the system preference */
  }
  try {
    return prefersDark() ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

export function persistRoom(room: Room, storage: RoomStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(ROOM_KEY, room)
  } catch {
    /* private mode: the room still applies for this session */
  }
}
