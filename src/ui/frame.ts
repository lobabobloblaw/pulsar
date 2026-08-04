/* pulsar — the single-frame-loop contract (plan C2).
 *
 * App.svelte owns exactly ONE requestAnimationFrame loop for the whole app and
 * publishes it on this context. Canvas components subscribe; nobody else starts
 * a rAF. Two loops would double the cost of every meter read and make frame
 * ordering (bridge.tick -> renderers) undefined.
 *
 * The loop never writes $state — the one exception is the dev fps chip at 4 Hz.
 */

import { getContext, setContext } from 'svelte'

export const FRAME_KEY = 'pulsar.frame'

export type FrameFn = (now: number) => void

export interface FrameBus {
  subscribe(fn: FrameFn): () => void
}

export function createFrameBus(): { bus: FrameBus; emit: (now: number) => void } {
  const subs = new Set<FrameFn>()
  return {
    bus: {
      subscribe(fn: FrameFn): () => void {
        subs.add(fn)
        return () => {
          subs.delete(fn)
        }
      },
    },
    emit(now: number): void {
      for (const fn of subs) fn(now)
    },
  }
}

export function provideFrame(bus: FrameBus): void {
  setContext(FRAME_KEY, bus)
}

/** Returns a no-op bus when used outside App (tests, storybook-style previews)
 *  so a canvas component never throws for want of a loop. */
export function useFrame(): FrameBus {
  return getContext<FrameBus | undefined>(FRAME_KEY) ?? { subscribe: () => () => {} }
}
