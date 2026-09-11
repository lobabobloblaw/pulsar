/* pulsar — the one shared phone-width state (Ivory).
 *
 * `narrow` mirrors `(max-width: 600px)`: below it the keybed shows one octave,
 * the screen's key-range caption describes that octave and the keytop drops
 * the QWERTY hint. One query, one listener, so the readers cannot disagree
 * about where the phone begins. App's `compact` (720px, the tracker
 * threshold) is a different boundary and stays where it is.
 *
 * Guarded for environments without `matchMedia` (the node test project never
 * imports this, but a rune module must not throw on construction anywhere).
 */

class Viewport {
  narrow = $state(false)
  #query: MediaQueryList | null = null

  /** The initial value is read synchronously, so `narrow` is right before the
   *  first paint; following changes is `attach()`'s job. */
  constructor() {
    if (typeof matchMedia !== 'function') return
    this.#query = matchMedia('(max-width: 600px)')
    this.narrow = this.#query.matches
  }

  /** Start following the query. App calls this from onMount beside its own
   *  compact listener and disposes both in the same cleanup, so a torn-down
   *  shell (site:dispose, pagehide) leaves no listener behind. */
  attach(): () => void {
    const query = this.#query
    if (query === null) return () => {}
    const update = (): void => {
      this.narrow = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }
}

export const viewport = new Viewport()
