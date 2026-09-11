/** The VRC6 lanes' register timeline (docs/register-timeline.md, "VRC6 lanes").
 *
 *  Everything here is observed through `ArrayWriteSink` rather than through rendered
 *  audio, deliberately: the core in this branch does not accept `$9000+` yet, so the
 *  only honest claim a test can make today is about the WRITES — their order, their
 *  values, and the fact that a held note stops producing them.
 *
 *  The four disciplines under test, in the order they matter:
 *    1. canonical order on a trigger — `$x000` → `$x001` → **`$x002` last**, all three
 *       unconditional, because `$x002`'s enable bit resets the lane's phase;
 *    2. write-on-change afterwards, so a sustained note writes `$x002` exactly once;
 *    3. `$4015` is NEVER written for a VRC6 lane — it is the APU's register, and a
 *       stray write to it would silence 2A03 lanes that had nothing to do with this;
 *    4. `$9003` goes out once, as `0x00`, and only for a song that has the lanes.
 */
import { describe, expect, it } from 'vitest'
import { REG, at, buildSong, countWrites, drive, type SongSpec } from '../fixtures/songs/build'

/** An eight-lane song with one note on each VRC6 lane at row 0. */
function vrc6Song(patterns: NonNullable<SongSpec['patterns']> = {}) {
  return buildSong({
    lanes: 8,
    meta: { rowsPerPattern: 8 },
    patterns,
  })
}

describe('the canonical trigger order', () => {
  it('vrc6 pulse 1: $9000 then $9001 then $9002 LAST, all three, in that order', () => {
    const { ticks } = drive(vrc6Song({ 'vrc6p1:0': [{ r: 0, note: 69 }] }), 4)
    const addrs = ticks[0].map((w) => w.addr)
    expect(addrs).toEqual([REG.VRC6_FREQ, REG.V1_CTRL, REG.V1_LO, REG.V1_HI])
    // duty 7 (the default 50 %), volume 15 -> 0x7F; A4 is timer 253 = 0x0FD.
    expect(at(ticks, 0, REG.V1_CTRL)).toBe(0x7f)
    expect(at(ticks, 0, REG.V1_LO)).toBe(0xfd)
    expect(at(ticks, 0, REG.V1_HI)).toBe(0x80)
  })

  it('vrc6 pulse 2 uses the $A000 block and nothing else', () => {
    const { ticks } = drive(vrc6Song({ 'vrc6p2:0': [{ r: 0, note: 69 }] }), 4)
    expect(ticks[0].map((w) => w.addr)).toEqual([REG.VRC6_FREQ, REG.V2_CTRL, REG.V2_LO, REG.V2_HI])
    expect(at(ticks, 0, REG.V2_CTRL)).toBe(0x7f)
    expect(at(ticks, 0, REG.V2_HI)).toBe(0x80)
  })

  it('the saw: $B000 (rate) then $B001 then $B002 LAST', () => {
    const { ticks } = drive(vrc6Song({ 'vrc6saw:0': [{ r: 0, note: 69 }] }), 4)
    expect(ticks[0].map((w) => w.addr)).toEqual([REG.VRC6_FREQ, REG.SAW_RATE, REG.SAW_LO, REG.SAW_HI])
    // volume 15 -> rate 42; A4 on the divide-by-14 saw is timer 290 = 0x122.
    expect(at(ticks, 0, REG.SAW_RATE)).toBe(42)
    expect(at(ticks, 0, REG.SAW_LO)).toBe(0x22)
    expect(at(ticks, 0, REG.SAW_HI)).toBe(0x81)
  })

  it('all eight lanes trigger together without treading on each other', () => {
    const { ticks } = drive(
      vrc6Song({
        'pulse1:0': [{ r: 0, note: 60 }],
        'vrc6p1:0': [{ r: 0, note: 69 }],
        'vrc6p2:0': [{ r: 0, note: 64 }],
        'vrc6saw:0': [{ r: 0, note: 36 }],
      }),
      4,
    )
    const addrs = ticks[0].map((w) => w.addr)
    // the APU's status byte carries pulse1's bit and ONLY pulse1's
    expect(at(ticks, 0, REG.STATUS)).toBe(0x01)
    expect(addrs.filter((a) => a >= 0x9000)).toEqual([
      REG.VRC6_FREQ,
      REG.V1_CTRL,
      REG.V1_LO,
      REG.V1_HI,
      REG.V2_CTRL,
      REG.V2_LO,
      REG.V2_HI,
      REG.SAW_RATE,
      REG.SAW_LO,
      REG.SAW_HI,
    ])
  })
})

describe('write-on-change', () => {
  /** One note held for 33 s of pattern (speed 31 x 64 rows), so a ten-second run
   *  cannot loop round and legitimately retrigger it — the same shape as the `$4003`
   *  test in trackerDriver.test.ts, because it is the same claim about a different
   *  side-effect register. */
  function held(patterns: NonNullable<SongSpec['patterns']>) {
    return buildSong({ lanes: 8, meta: { speed: 31, rowsPerPattern: 64 }, patterns })
  }

  it('a ten-second held note writes $9002 exactly ONCE', () => {
    const { sink, driver } = drive(held({ 'vrc6p1:0': [{ r: 0, note: 69, vol: 15 }] }), 601)
    expect(driver.stats.ticksGenerated).toBeGreaterThan(590)
    expect(countWrites(sink, REG.V1_HI)).toBe(1)
    expect(countWrites(sink, REG.V1_CTRL)).toBe(1)
    expect(countWrites(sink, REG.V1_LO)).toBe(1)
  })

  it('and so does a ten-second held note on the saw', () => {
    const { sink } = drive(held({ 'vrc6saw:0': [{ r: 0, note: 40, vol: 15 }] }), 601)
    expect(countWrites(sink, REG.SAW_HI)).toBe(1)
    expect(countWrites(sink, REG.SAW_RATE)).toBe(1)
    expect(countWrites(sink, REG.SAW_LO)).toBe(1)
  })
})

describe('$4015 is not theirs to write', () => {
  it('a song with only VRC6 notes never writes the APU status byte while playing', () => {
    const song = vrc6Song({
      'vrc6p1:0': [{ r: 0, note: 69 }, { r: 4, note: -1 }],
      'vrc6saw:0': [{ r: 0, note: 40 }, { r: 4, note: -1 }],
    })
    const { ticks } = drive(song, 48)
    for (let t = 0; t < ticks.length; t++) {
      expect(at(ticks, t, REG.STATUS), `tick ${t}`).toBe(-1)
    }
  })

  it('and a 2A03 lane playing alongside keeps its own bit through a VRC6 note-off', () => {
    const song = vrc6Song({
      'pulse1:0': [{ r: 0, note: 60 }],
      'vrc6p1:0': [{ r: 0, note: 69 }, { r: 2, note: -1 }],
    })
    const { ticks, sink } = drive(song, 48)
    expect(at(ticks, 0, REG.STATUS)).toBe(0x01)
    // exactly one status write in the whole run: the trigger's. The VRC6 note-off
    // adds none, so pulse1 is never cut by a lane it shares no register with.
    expect(countWrites(sink, REG.STATUS)).toBe(1)
  })
})

describe('$9003', () => {
  it('goes out once, as 0x00, before any lane register', () => {
    const { ticks, sink } = drive(vrc6Song({ 'vrc6p1:0': [{ r: 0, note: 69 }] }), 600)
    expect(countWrites(sink, REG.VRC6_FREQ)).toBe(1)
    expect(at(ticks, 0, REG.VRC6_FREQ)).toBe(0x00)
    expect(ticks[0][0].addr).toBe(REG.VRC6_FREQ)
  })

  it('is never written for a 2A03-only song', () => {
    const { sink } = drive(buildSong({ patterns: { 'pulse1:0': [{ r: 0, note: 60 }] } }), 60)
    expect(countWrites(sink, REG.VRC6_FREQ)).toBe(0)
  })

  it('is re-armed by a second play() — once per playback, not once per driver', () => {
    const song = vrc6Song({ 'vrc6p1:0': [{ r: 0, note: 69 }] })
    const { driver, sink } = drive(song, 30)
    driver.play('song')
    driver.runTo(1_000_000)
    expect(countWrites(sink, REG.VRC6_FREQ)).toBe(2)
  })
})

describe('a VRC6 lane runs the PULSE effect set', () => {
  it('its pitch is a timer, not the noise lane’s inverted index', () => {
    // note 48 would be noise index 15 (the lowest); on a VRC6 pulse it is a 12-bit
    // timer of 3419, and on the saw 3908.
    const { ticks } = drive(
      buildSong({
        lanes: 8,
        patterns: { 'vrc6p1:0': [{ r: 0, note: 24 }], 'vrc6saw:0': [{ r: 0, note: 24 }] },
      }),
      4,
    )
    expect(at(ticks, 0, REG.V1_LO) | ((at(ticks, 0, REG.V1_HI) & 0x0f) << 8)).toBe(3419)
    expect(at(ticks, 0, REG.SAW_LO) | ((at(ticks, 0, REG.SAW_HI) & 0x0f) << 8)).toBe(3908)
  })

  it('4xy vibrato moves the period the way it does on a pulse', () => {
    const { ticks } = drive(
      buildSong({
        lanes: 8,
        meta: { rowsPerPattern: 64 },
        patterns: { 'vrc6p1:0': [{ r: 0, note: 69, vol: 15, fx: [{ cmd: '4', param: 0x8f }] }] },
      }),
      24,
    )
    const period: number[] = []
    let lo = 0xfd
    let hi = 0
    for (let t = 0; t < 24; t++) {
      const l = at(ticks, t, REG.V1_LO)
      const h = at(ticks, t, REG.V1_HI)
      if (l >= 0) lo = l
      if (h >= 0) hi = h & 0x0f
      period.push((hi << 8) | lo)
    }
    expect(new Set(period).size).toBeGreaterThan(3)
    expect(Math.max(...period)).toBeGreaterThan(253)
    expect(Math.min(...period)).toBeLessThan(253)
  })

  it('and the noise and dpcm registers are never touched by one', () => {
    const { sink } = drive(
      buildSong({
        lanes: 8,
        patterns: {
          'vrc6p1:0': [{ r: 0, note: 69 }],
          'vrc6p2:0': [{ r: 0, note: 60 }],
          'vrc6saw:0': [{ r: 0, note: 40 }],
        },
      }),
      120,
    )
    for (let i = 0; i < sink.length; i++) {
      const a = sink.addrs[i]
      expect(a >= 0x400c && a <= 0x4013, `write ${i} to ${a.toString(16)}`).toBe(false)
    }
  })
})
