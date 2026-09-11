/** The lane names, and the measurement that says they fit.
 *
 *  The canvas header band draws each lane's name INSIDE that lane's own column,
 *  with no clip region and no ellipsis: a name wider than the column runs under
 *  the next lane's name. The column is 96 px at one effect column, so the eight
 *  captions are a geometry problem, not a copy problem, and this suite measures
 *  them against the real `computeLayout`.
 *
 *  The two font facts it needs cannot be measured in node (no canvas, no
 *  webfont), so they are measured in the browser and pinned here:
 *
 *    Chrome 152, preview build, 2026-09-11 — `--font-ui` = JetBrains Mono
 *    Variable, `ctx.measureText('0').width` = 7.200 px at `400 12px` and
 *    6.600 px at `600 11px`. Both are the font's 0.6 em advance; the weight
 *    does not change it, which is what makes one number describe the band.
 *
 *  `tokensDeclare` below is the tripwire that keeps that pinning honest: change
 *  `--t-body-size` or `--t-micro-size` and this suite fails rather than going on
 *  measuring a geometry the product no longer has.
 *
 *  Anti-vacuity: `overflows` proves the same arithmetic rejects a caption one
 *  word longer, for every lane, so a passing fit is a fact about these strings
 *  and not about a check that can never fail.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CANONICAL_CHANNELS, type ChannelId } from '../../src/tracker/model/types'
import { computeLayout, PAD } from '../../src/ui/canvas/patternRenderer'
import { laneCaption, laneHeader } from '../../src/ui/tracker/laneCaptions'

/** Measured in Chrome (see the header). One advance serves both sizes. */
const MONO_ADVANCE_EM = 0.6
const CELL_PX = 12
const MICRO_PX = 11
const CHAR_W = CELL_PX * MONO_ADVANCE_EM // 7.2 — the grid's column unit
const MICRO_CHAR_W = MICRO_PX * MONO_ADVANCE_EM // 6.6 — the header band's ink

const LAYOUT = computeLayout({
  charW: CHAR_W,
  channels: CANONICAL_CHANNELS.length,
  // One effect column is the NARROWEST a lane can be, so it is the only case
  // the fit has to survive: more columns only widen it.
  effectColumns: CANONICAL_CHANNELS.map(() => 1),
  fontCell: `400 ${CELL_PX}px mono`,
  fontMicro: `600 ${MICRO_PX}px mono`,
})

/** Ink width of a label drawn in the header band's font. */
function inkWidth(text: string): number {
  return text.length * MICRO_CHAR_W
}

/** What `drawFurniture` leaves a lane's label: the column minus its left pad. */
function budget(channel: number): number {
  const ch = LAYOUT.channels[channel]
  expect(ch, `no layout for lane ${channel}`).toBeDefined()
  return (ch?.w ?? 0) - PAD
}

describe('the grid header band fits every lane name in its own column', () => {
  it('is measured against the column geometry the product actually builds', () => {
    // The number every caption is judged against. If this moves, the captions
    // were chosen for a layout that no longer exists.
    expect(LAYOUT.channels).toHaveLength(8)
    expect(budget(0)).toBe(92)
    for (let c = 1; c < LAYOUT.channels.length; c++) expect(budget(c)).toBe(92)
  })

  it('draws all eight header labels inside their lanes at one effect column', () => {
    for (let c = 0; c < CANONICAL_CHANNELS.length; c++) {
      const id = CANONICAL_CHANNELS[c] as ChannelId
      const text = laneHeader(id)
      expect(inkWidth(text), `${id} header "${text}" overflows its lane`).toBeLessThanOrEqual(
        budget(c),
      )
    }
  })

  it('keeps the VRC6 lanes inside the widest 2A03 name, not merely inside the lane', () => {
    // `VRC6 Pulse 1` would fit (79.2 px of 92) but would fill 86 % of its column
    // while `Triangle` fills 57 %. The abbreviation exists to hold that rhythm,
    // so the rhythm is what is pinned.
    const widest2A03 = Math.max(
      ...CANONICAL_CHANNELS.slice(0, 5).map((id) => inkWidth(laneHeader(id as ChannelId))),
    )
    expect(widest2A03).toBeCloseTo(52.8, 6) // 'Triangle'
    for (const id of ['vrc6p1', 'vrc6p2', 'vrc6saw'] as const) {
      expect(inkWidth(laneHeader(id)), id).toBeLessThanOrEqual(widest2A03)
    }
  })

  it('rejects a caption one word longer — in every lane', () => {
    // Anti-vacuity: the same arithmetic, the same budget, a name that does not fit.
    const tooLong = 'VRC6 Sawtooth Bass' // 18 chars = 118.8 px
    expect(inkWidth(tooLong)).toBeGreaterThan(92)
    for (let c = 0; c < CANONICAL_CHANNELS.length; c++) {
      expect(inkWidth(tooLong)).toBeGreaterThan(budget(c))
    }
  })
})

describe('the two spellings of a lane', () => {
  it('prints full words in DOM chrome, where an accessible name must match them', () => {
    expect(laneCaption('vrc6p1')).toBe('VRC6 Pulse 1')
    expect(laneCaption('vrc6p2')).toBe('VRC6 Pulse 2')
    expect(laneCaption('vrc6saw')).toBe('VRC6 Saw')
    // The five original lanes are untouched copy: the VRC6 pass must not have
    // renamed them on the way past.
    expect(CANONICAL_CHANNELS.slice(0, 5).map((id) => laneCaption(id as ChannelId))).toEqual([
      'Pulse 1',
      'Pulse 2',
      'Triangle',
      'Noise',
      'DPCM',
    ])
  })

  it('abbreviates only the two VRC6 pulses, and only in the header band', () => {
    expect(laneHeader('vrc6p1')).toBe('VRC6 P1')
    expect(laneHeader('vrc6p2')).toBe('VRC6 P2')
    for (const id of CANONICAL_CHANNELS) {
      if (id === 'vrc6p1' || id === 'vrc6p2') continue
      expect(laneHeader(id), `${id} needs no short form`).toBe(laneCaption(id))
    }
  })

  it('names every canonical lane — a new lane cannot print as undefined', () => {
    for (const id of CANONICAL_CHANNELS) {
      expect(laneCaption(id), id).toMatch(/^\S/)
      expect(laneHeader(id), id).toMatch(/^\S/)
    }
  })
})

describe('the pinned font measurement still describes the product', () => {
  it('reads the two type tokens the grid measures itself with', () => {
    const tokens = readFileSync(
      join(import.meta.dirname, '..', '..', 'src', 'design', 'tokens.css'),
      'utf8',
    )
    expect(tokens).toMatch(/--t-body-size:\s*12px/)
    expect(tokens).toMatch(/--t-micro-size:\s*11px/)
    expect(tokens).toMatch(/--font-ui:[^;]*JetBrains Mono/)
  })
})
