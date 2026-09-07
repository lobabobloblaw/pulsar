import { parseSong, serializeSong } from '../tracker/model/validate'
import type { Song } from '../tracker/model/types'

export const DRAFT_KEY = 'pulsar.draft.v1'
export interface Draft {
  song: Song
  presetId: string | null
  dirty: boolean
}
export interface DraftStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Synchronous writes keep a completed edit safe even if its frame closes in
 * the same task. Compare before writing to detect changes saved by another window. */
export class DraftRepository {
  private previous: string | null = null
  constructor(private storage: DraftStorage) {}
  read(): Draft | null {
    const raw = this.storage.getItem(DRAFT_KEY)
    this.previous = raw
    if (raw === null) return null
    const data = JSON.parse(raw) as {
      version?: unknown
      song?: unknown
      presetId?: unknown
      dirty?: unknown
    }
    if (data.version !== 1)
      throw new Error('This saved draft cannot be read by this version.')
    return {
      song: parseSong(data.song).song,
      presetId: typeof data.presetId === 'string' ? data.presetId : null,
      dirty: data.dirty === true,
    }
  }
  write(draft: Draft): void {
    if (this.storage.getItem(DRAFT_KEY) !== this.previous) {
      throw new Error(
        'Another Pulsar window changed the saved draft. Download this project before reopening it.',
      )
    }
    const next = JSON.stringify({
      version: 1,
      ...draft,
      song: JSON.parse(serializeSong(draft.song)),
    })
    this.storage.setItem(DRAFT_KEY, next)
    this.previous = next
  }
}
