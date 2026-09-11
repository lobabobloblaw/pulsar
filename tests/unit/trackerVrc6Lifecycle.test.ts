/** Note-off, mute, live steal and `stop()` on a VRC6 lane.
 *
 *  The chip has no `$4015` bit to clear, so every one of these has to be spelled out
 *  in the lane's own registers: **volume 0 in `$x000` AND the enable bit cleared in
 *  `$x002`**. The second half is not redundant — clearing the enable bit is what
 *  resets the step, the accumulator and the timer, so the next note starts from phase
 *  zero the way a fresh trigger does, and a silent lane's divider stops running.
 */
import { describe, expect, it } from 'vitest'
import { ArrayWriteSink } from '../../src/audio/timeline/writeSink'
import { NTSC_CPU_HZ } from '../../src/audio/core/constants'
import { TrackerDriver } from '../../src/tracker/driver/trackerDriver'
import { REG, at, buildSong, countWrites, drive, type SongSpec } from '../fixtures/songs/build'

const CLOCK = { clockRate: NTSC_CPU_HZ, nowCycle: () => 0 }

function song(patterns: NonNullable<SongSpec['patterns']>) {
  return buildSong({ lanes: 8, meta: { rowsPerPattern: 8 }, patterns })
}

/** Writes to `addr` across the whole run, in order. */
function series(sink: ArrayWriteSink, addr: number): number[] {
  const out: number[] = []
  for (let i = 0; i < sink.length; i++) if (sink.addrs[i] === addr) out.push(sink.values[i])
  return out
}

describe('note-off on a VRC6 lane', () => {
  it("a '---' cut writes volume 0 and clears the enable bit, in that order", () => {
    const { ticks } = drive(song({ 'vrc6p1:0': [{ r: 0, note: 69 }, { r: 1, note: -1 }] }), 18)
    // row 1 lands on tick 6
    expect(ticks[6].map((w) => w.addr)).toEqual([REG.V1_CTRL, REG.V1_HI])
    expect(at(ticks, 6, REG.V1_CTRL)).toBe(0x00)
    expect(at(ticks, 6, REG.V1_HI)).toBe(0x00)
  })

  it('the saw cut writes rate 0 and clears the enable bit', () => {
    const { ticks } = drive(song({ 'vrc6saw:0': [{ r: 0, note: 40 }, { r: 1, note: -1 }] }), 18)
    expect(ticks[6].map((w) => w.addr)).toEqual([REG.SAW_RATE, REG.SAW_HI])
    expect(at(ticks, 6, REG.SAW_RATE)).toBe(0x00)
    expect(at(ticks, 6, REG.SAW_HI)).toBe(0x00)
  })

  it('a composed volume of 0 is a note-off too — silence AND the phase reset', () => {
    // vol 0 on row 1 with the note still held: the lane is not cut, but the bytes are
    // the cut's bytes, because a VRC6 lane at volume 0 should not keep a running timer.
    const { ticks } = drive(song({ 'vrc6p1:0': [{ r: 0, note: 69 }, { r: 1, vol: 0 }] }), 18)
    expect(at(ticks, 6, REG.V1_CTRL)).toBe(0x00)
    expect(at(ticks, 6, REG.V1_HI)).toBe(0x00)
  })

  it('and coming back up re-enables it, with the full control byte restored', () => {
    const { ticks } = drive(
      song({ 'vrc6p1:0': [{ r: 0, note: 69 }, { r: 1, vol: 0 }, { r: 2, vol: 15 }] }),
      24,
    )
    expect(at(ticks, 12, REG.V1_CTRL)).toBe(0x7f)
    expect(at(ticks, 12, REG.V1_HI)).toBe(0x80)
  })

  it('a cut writes each register once, not once per tick afterwards', () => {
    const { sink } = drive(song({ 'vrc6p1:0': [{ r: 0, note: 69 }, { r: 1, note: -1 }] }), 47)
    expect(series(sink, REG.V1_CTRL)).toEqual([0x7f, 0x00])
    expect(series(sink, REG.V1_HI)).toEqual([0x80, 0x00])
  })
})

describe('stop()', () => {
  function stopTrace(lanes: number) {
    const sink = new ArrayWriteSink()
    const s =
      lanes === 8
        ? song({ 'vrc6p1:0': [{ r: 0, note: 69 }], 'vrc6saw:0': [{ r: 0, note: 40 }] })
        : buildSong({ patterns: { 'pulse1:0': [{ r: 0, note: 60 }] } })
    const driver = new TrackerDriver(sink, CLOCK, { song: s })
    driver.play('song')
    driver.runTo(cycleAfter(6))
    const before = sink.length
    driver.stop()
    return sink.addrs.slice(before)
  }

  const cycleAfter = (ticks: number) => Math.floor((ticks * NTSC_CPU_HZ) / 60)

  it('silences all three VRC6 lanes, in OCTET’s order, after $4015', () => {
    expect(stopTrace(8)).toEqual([
      REG.STATUS,
      REG.V1_CTRL,
      REG.V1_HI,
      REG.V2_CTRL,
      REG.V2_HI,
      REG.SAW_RATE,
      REG.SAW_HI,
    ])
  })

  it('leaves a 2A03-only song’s all-channels-off as the one byte it has always been', () => {
    expect(stopTrace(5)).toEqual([REG.STATUS])
  })
})

describe('mute and solo', () => {
  it('muting a VRC6 lane silences it the way muting a 2A03 lane does', () => {
    const s = song({ 'vrc6p1:0': [{ r: 0, note: 69 }] })
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song: s })
    driver.play('song')
    driver.runTo(Math.floor((2 * NTSC_CPU_HZ) / 60))
    driver.setChannelMute(5, true)
    const before = sink.length
    driver.runTo(Math.floor((6 * NTSC_CPU_HZ) / 60))
    expect(sink.addrs.slice(before)).toEqual([REG.V1_CTRL, REG.V1_HI])
    expect(sink.values.slice(before)).toEqual([0x00, 0x00])

    // and unmuting brings the whole image back, trigger-style
    driver.setChannelMute(5, false)
    const after = sink.length
    driver.runTo(Math.floor((12 * NTSC_CPU_HZ) / 60))
    expect(sink.addrs.slice(after)).toEqual([REG.V1_CTRL, REG.V1_LO, REG.V1_HI])
    expect(sink.values.slice(after)).toEqual([0x7f, 0xfd, 0x80])
  })

  it('muting one VRC6 lane leaves the other two and the APU alone', () => {
    const s = song({
      'pulse1:0': [{ r: 0, note: 60 }],
      'vrc6p1:0': [{ r: 0, note: 69 }],
      'vrc6saw:0': [{ r: 0, note: 40 }],
    })
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song: s })
    driver.play('song')
    driver.runTo(Math.floor((2 * NTSC_CPU_HZ) / 60))
    driver.setChannelMute(5, true)
    const before = sink.length
    driver.runTo(Math.floor((6 * NTSC_CPU_HZ) / 60))
    const addrs = sink.addrs.slice(before)
    expect(addrs).not.toContain(REG.STATUS)
    expect(addrs).not.toContain(REG.SAW_RATE)
  })
})

describe('live keyboard play onto a VRC6 lane', () => {
  it('a note with the cursor on vrc6 pulse 2 triggers that lane, canonically', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song: song({}) })
    driver.setLiveChannel(6)
    expect(driver.liveChannelIndex).toBe(6)
    driver.play('song')
    driver.liveNoteOn(driver.liveChannelIndex, 69, 127)
    driver.runTo(Math.floor((2 * NTSC_CPU_HZ) / 60))
    const first = sink.addrs.indexOf(REG.V2_CTRL)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(sink.addrs.slice(first, first + 3)).toEqual([REG.V2_CTRL, REG.V2_LO, REG.V2_HI])
    expect(sink.values.slice(first, first + 3)).toEqual([0x7f, 0xfd, 0x80])
    expect(countWrites(sink, REG.STATUS)).toBe(0)
  })

  it('releasing it hands the lane back silent at the next row boundary', () => {
    const sink = new ArrayWriteSink()
    const driver = new TrackerDriver(sink, CLOCK, { song: song({}) })
    driver.play('song')
    driver.liveNoteOn(7, 45, 127)
    driver.runTo(Math.floor((2 * NTSC_CPU_HZ) / 60))
    driver.liveNoteOff(7, 45)
    const before = sink.length
    driver.runTo(Math.floor((20 * NTSC_CPU_HZ) / 60))
    expect(sink.addrs.slice(before)).toEqual([REG.SAW_RATE, REG.SAW_HI])
    expect(sink.values.slice(before)).toEqual([0x00, 0x00])
  })
})
