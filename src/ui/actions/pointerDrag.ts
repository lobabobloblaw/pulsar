/* pulsar — pointer-capture drag action (plan C7).
 *
 * Delivers per-move deltas and nothing else. The ACCUMULATION lives in the
 * control, because only the control knows its range — and accumulating in the
 * control is what lets Shift change sensitivity mid-drag without the value
 * jumping (see Knob.svelte).
 *
 * Pointer capture means the drag survives leaving the element, which is the
 * behaviour of a real knob: you do not stop turning it because your finger
 * drifted off the cap.
 */

import type { Action } from 'svelte/action'

export interface PointerDragParams {
  onStart?: (e: PointerEvent) => void
  /** dx/dy are since the previous move, not since the start. */
  onMove: (dx: number, dy: number, e: PointerEvent) => void
  onEnd?: (e: PointerEvent) => void
  /** Return false to ignore a press (e.g. Alt+click, which resets instead). */
  accept?: (e: PointerEvent) => boolean
}

export const pointerDrag: Action<HTMLElement, PointerDragParams> = (node, params) => {
  let current = params
  let active = -1
  let lastX = 0
  let lastY = 0

  function down(e: PointerEvent): void {
    if (active !== -1) return
    if (e.button !== 0 && e.pointerType === 'mouse') return
    if (current.accept && !current.accept(e)) return
    active = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    node.setPointerCapture(e.pointerId)
    e.preventDefault()
    current.onStart?.(e)
  }

  function move(e: PointerEvent): void {
    if (e.pointerId !== active) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (dx !== 0 || dy !== 0) current.onMove(dx, dy, e)
  }

  function up(e: PointerEvent): void {
    if (e.pointerId !== active) return
    active = -1
    if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId)
    current.onEnd?.(e)
  }

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointermove', move)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', up)

  return {
    update(next: PointerDragParams) {
      current = next
    },
    destroy() {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
    },
  }
}
