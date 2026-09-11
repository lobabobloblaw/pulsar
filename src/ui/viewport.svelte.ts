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

  constructor() {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia('(max-width: 600px)')
    this.narrow = query.matches
    query.addEventListener('change', () => {
      this.narrow = query.matches
    })
  }
}

export const viewport = new Viewport()
