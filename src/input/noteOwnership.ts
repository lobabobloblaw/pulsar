/** A broad input family, used for UI labels and holder-token construction. */
export type NoteSource = 'qwerty' | 'pointer' | 'midi' | 'tracker' | 'record'

/**
 * One physical/logical hold. The suffix distinguishes controls in the same
 * family, such as KeyQ and Comma both holding the keybed's middle C.
 */
export type NoteHolder = NoteSource | `${NoteSource}:${string}`

export function noteHolder(source: NoteSource, id: string | number): NoteHolder {
  return `${source}:${id}`
}

/** Pure ownership bookkeeping; the Svelte transport mirrors first/last holds. */
export class NoteHoldRegistry {
  readonly #byNote = new Map<number, Set<NoteHolder>>()

  hold(note: number, holder: NoteHolder): boolean {
    let holders = this.#byNote.get(note)
    if (holders === undefined) {
      holders = new Set()
      this.#byNote.set(note, holders)
    }
    const first = holders.size === 0
    holders.add(holder)
    return first
  }

  release(note: number, holder: NoteHolder): boolean {
    const holders = this.#byNote.get(note)
    if (holders === undefined || !holders.delete(holder)) return false
    if (holders.size > 0) return false
    this.#byNote.delete(note)
    return true
  }

  count(note: number): number {
    return this.#byNote.get(note)?.size ?? 0
  }

  clear(): void {
    this.#byNote.clear()
  }
}
