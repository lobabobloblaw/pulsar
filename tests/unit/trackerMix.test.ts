import { describe, expect, it } from 'vitest'
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
