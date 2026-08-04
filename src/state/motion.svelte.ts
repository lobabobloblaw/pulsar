/* pulsar — motion policy (plan C1).
 *
 * Canvas cannot read a media query, and the renderers need the answer every
 * frame, so the match is mirrored into a rune here. Policy: reduced motion
 * removes DECORATIVE motion (boot raster scan and dot dissolve collapse to a
 * single paint + hold; page changes are instant) but never INFORMATION-BEARING
 * motion — the meter and scope keep running, peak-hold just decays in one step.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

class MotionState {
  #reduced = $state(false)
  #mql: MediaQueryList | null = null

  constructor() {
    if (typeof matchMedia !== 'function') return
    this.#mql = matchMedia(QUERY)
    this.#reduced = this.#mql.matches
    this.#mql.addEventListener('change', (e) => {
      this.#reduced = e.matches
    })
  }

  get reduced(): boolean {
    return this.#reduced
  }
}

export const motion = new MotionState()
