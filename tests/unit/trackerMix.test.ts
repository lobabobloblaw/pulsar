import { describe, expect, it } from 'vitest'
import { CANONICAL_CHANNELS } from '../../src/tracker/model/types'
import { effectiveChannelMute } from '../../src/state/trackerMix'

describe('tracker mute and solo routing', () => {
  it('uses stored mute choices when no channel is soloed', () => {
    expect(effectiveChannelMute([false, true, false], -1, 0)).toBe(false)
    expect(effectiveChannelMute([false, true, false], -1, 1)).toBe(true)
  })

  it('keeps every non-solo channel suppressed regardless of stored mute edits', () => {
    const stored = [false, false, false]
    expect(effectiveChannelMute(stored, 1, 0)).toBe(true)
    expect(effectiveChannelMute(stored, 1, 2)).toBe(true)
  })

  it('keeps the solo channel audible while preserving its stored choice', () => {
    const stored = [false, true, false]
    expect(effectiveChannelMute(stored, 1, 1)).toBe(false)
    expect(effectiveChannelMute(stored, -1, 1)).toBe(true)
  })
})

/** The routing is generic, but the ARRAY it reads is the tracker store's, and that
 *  array was a five-element literal until the VRC6 lanes landed. These cases are the
 *  eight-lane shape `tracker.muted` now has (`CANONICAL_CHANNELS.map(() => false)`),
 *  exercised at the lanes a five-wide array could not describe. */
describe('mute and solo over an eight-lane song', () => {
  const lanes = CANONICAL_CHANNELS.length
  const none = (): boolean[] => CANONICAL_CHANNELS.map(() => false)
  const VRC6_SAW = 7
  const VRC6_P1 = 5

  it('has a defined slot for every canonical lane', () => {
    expect(lanes).toBe(8)
    const stored = none()
    expect(stored).toHaveLength(8)
    // The point of the sizing: no hole. A five-element literal left 5..7
    // `undefined` under a `boolean[]` type, which every later reader inherits.
    for (let c = 0; c < lanes; c++) expect(typeof stored[c]).toBe('boolean')
  })

  it('mutes vrc6saw and nothing else when lane 7 is muted', () => {
    const stored = none()
    stored[VRC6_SAW] = true
    for (let c = 0; c < lanes; c++) {
      expect(effectiveChannelMute(stored, -1, c), `lane ${c}`).toBe(c === VRC6_SAW)
    }
  })

  it('silences the five 2A03 lanes when vrc6p1 is soloed', () => {
    const stored = none()
    for (let c = 0; c < 5; c++) {
      expect(effectiveChannelMute(stored, VRC6_P1, c), `2A03 lane ${c}`).toBe(true)
    }
    expect(effectiveChannelMute(stored, VRC6_P1, VRC6_P1)).toBe(false)
    expect(effectiveChannelMute(stored, VRC6_P1, 6)).toBe(true)
    expect(effectiveChannelMute(stored, VRC6_P1, VRC6_SAW)).toBe(true)
  })

  it('restores an expansion lane’s stored mute when its solo is cleared', () => {
    const stored = none()
    stored[VRC6_SAW] = true
    expect(effectiveChannelMute(stored, VRC6_SAW, VRC6_SAW)).toBe(false)
    expect(effectiveChannelMute(stored, -1, VRC6_SAW)).toBe(true)
  })
})
