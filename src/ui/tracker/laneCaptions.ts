/* pulsar — the printed lane names (design §4.1, §4.2; Ivory).
 *
 * Two spellings of one lane, because two surfaces have different budgets:
 *
 *   laneCaption()  DOM chrome — the M/S cap row and the order strip. Full words.
 *                  It is visible text, so it is also what an accessible name has
 *                  to contain for voice control to match it (invariant 33).
 *   laneHeader()   the canvas header band, which draws the name INSIDE the lane's
 *                  own column: 96 px at one effect column (`computeLayout`, charW
 *                  7.2 px at `--t-body-size: 12px`), 4 px of which is the left
 *                  pad, leaving 92 px at `--t-micro-size: 11px`. The band has no
 *                  accessible surface of its own — the grid announces cells with
 *                  the store's lowercase `CHANNEL_LABELS` — so abbreviating here
 *                  costs nothing a screen reader or voice control can see.
 *
 * `VRC6 Pulse 1` would fit (12 chars ≈ 79 px of 92), but it would fill 86 % of
 * its column while `Triangle`, the widest 2A03 name, fills 57 %. The VRC6 lanes
 * are therefore abbreviated to the same 7–8 character budget the five original
 * lanes already live inside, and the fit is measured — not assumed — by
 * `tests/unit/laneCaptions.test.ts` for all eight ids at one effect column.
 */

import type { ChannelId } from '../../state/songModel'

/** Full words. `CHANNEL_LABELS` is lowercase store copy; this is the printed form. */
const CAPTIONS: Readonly<Record<ChannelId, string>> = {
  pulse1: 'Pulse 1',
  pulse2: 'Pulse 2',
  triangle: 'Triangle',
  noise: 'Noise',
  dpcm: 'DPCM',
  vrc6p1: 'VRC6 Pulse 1',
  vrc6p2: 'VRC6 Pulse 2',
  vrc6saw: 'VRC6 Saw',
}

/** Column-width spellings for the canvas band. Only the three VRC6 lanes differ. */
const HEADERS: Readonly<Record<ChannelId, string>> = {
  ...CAPTIONS,
  vrc6p1: 'VRC6 P1',
  vrc6p2: 'VRC6 P2',
}

/** Sentence case, for DOM chrome and for anything an accessible name must match. */
export function laneCaption(id: ChannelId): string {
  return CAPTIONS[id]
}

/** The header band's spelling: never wider than the lane's own column. */
export function laneHeader(id: ChannelId): string {
  return HEADERS[id]
}
