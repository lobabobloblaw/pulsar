/* pulsar — non-passive wheel action (plan C7).
 *
 * Svelte's `onwheel` attribute registers a listener the browser is free to treat
 * as passive, and a passive listener cannot call preventDefault() — so scrolling
 * over a knob would scroll the page while it turned. This action registers with
 * `{ passive: false }` explicitly, which is the only reliable way to own the
 * gesture.
 *
 * The listener is on the element, so it only fires while the pointer is over the
 * control — that is the "hovered" half of C7's hovered-or-focused rule. The
 * focused-but-not-hovered case is intentionally not wired to a window listener:
 * a page-level wheel hook that steals scroll based on focus is worse than the
 * problem it solves, and the keyboard map already covers focused adjustment.
 */

import type { Action } from 'svelte/action'

export interface WheelParams {
  /** Positive `steps` means "increase". Already sign-corrected for the platform. */
  onWheel: (steps: number, e: WheelEvent) => void
  /** When false the event is left alone and the page scrolls normally. */
  enabled?: boolean
}

export const nonPassiveWheel: Action<HTMLElement, WheelParams> = (node, params) => {
  let current = params

  function wheel(e: WheelEvent): void {
    if (current.enabled === false) return
    // deltaMode 1 = lines, 2 = pages. Normalise to "one notch".
    const raw = e.deltaY !== 0 ? e.deltaY : e.deltaX
    if (raw === 0) return
    e.preventDefault()
    current.onWheel(raw < 0 ? 1 : -1, e)
  }

  node.addEventListener('wheel', wheel, { passive: false })

  return {
    update(next: WheelParams) {
      current = next
    },
    destroy() {
      node.removeEventListener('wheel', wheel)
    },
  }
}
