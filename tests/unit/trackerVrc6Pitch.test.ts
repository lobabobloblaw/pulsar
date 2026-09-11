/** VRC6 pitch, duty and volume arithmetic.
 *
 *  The chip's two differences from the 2A03 that a musician can hear:
 *    - **12-bit dividers.** Every pitch effect runs unchanged and simply stops later,
 *      which is what lets a saw bass reach an octave a 2A03 pulse saturates in.
 *    - **a four-bit duty field.** Bits 0–2 are the duty (high for `duty+1` of 16
 *      steps, so 7 is the 50 % square) and bit 3 is the mode bit, which makes the lane
 *      output its volume constantly. A `Vxx` or a duty macro reaches all four.
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_VRC6_TIMER,
  centsBetween,
  midiToHz,
  pulseTimerForMidi,
  vrc6PulseHzForTimer,
  vrc6PulseTimerForMidi,
  vrc6SawHzForTimer,
  vrc6SawTimerForMidi,
} from '../../src/audio/host/pitch'
import { MAX_PERIOD, MAX_VRC6_PERIOD, clampPeriod } from '../../src/tracker/driver/effects'
import { vrc6PulseControlByte, vrc6SawRate } from '../../src/tracker/driver/registers'
import { REG, at, buildSong, drive, timerSeries, vrc6TimerSeries } from '../fixtures/songs/build'

describe('the pitch anchors', () => {
  it('the VRC6 pulse divides by 16, like the 2A03 pulse: t = 253 is A440', () => {
    expect(vrc6PulseTimerForMidi(69)).toBe(253)
    expect(vrc6PulseHzForTimer(253)).toBeCloseTo(440.3968996062992, 9)
    expect(centsBetween(vrc6PulseHzForTimer(253), midiToHz(69))).toBeCloseTo(1.5609, 3)
  })

  it('the saw divides by 14: A4 is t = 290, and it is further out of tune', () => {
    expect(vrc6SawTimerForMidi(69)).toBe(290)
    expect(vrc6SawHzForTimer(290)).toBeCloseTo(439.3159057437408, 9)
    expect(centsBetween(vrc6SawHzForTimer(290), midiToHz(69))).toBeCloseTo(-2.6937, 3)
  })

  it('12 bits, not 11 — the low octave the 2A03 cannot reach', () => {
    expect(MAX_VRC6_TIMER).toBe(0xfff)
    // c1 (midi 24): the 2A03 pulse saturates at 0x7FF and plays the wrong note; the
    // VRC6 pulse writes the period the note actually asks for.
    expect(pulseTimerForMidi(24)).toBe(MAX_PERIOD)
    expect(vrc6PulseTimerForMidi(24)).toBe(3419)
    // and the bottom of the VRC6's own range still saturates, at four times further down
    expect(vrc6PulseTimerForMidi(0)).toBe(MAX_VRC6_TIMER)
    expect(vrc6SawTimerForMidi(0)).toBe(MAX_VRC6_TIMER)
  })

  it('clampPeriod takes the lane’s maximum, and the VRC6 floor is 0', () => {
    expect(clampPeriod(5000, 8)).toBe(MAX_PERIOD)
    expect(clampPeriod(5000, 0, MAX_VRC6_PERIOD)).toBe(MAX_VRC6_PERIOD)
    expect(clampPeriod(0x800, 0, MAX_VRC6_PERIOD)).toBe(0x800)
    // no sweep unit means no period check means no silent floor
    expect(clampPeriod(-3, 0, MAX_VRC6_PERIOD)).toBe(0)
    expect(clampPeriod(3, 0, MAX_VRC6_PERIOD)).toBe(3)
  })
})

describe('a slide runs to the lane’s own ceiling', () => {
  /** `2FF` — slide the pitch DOWN as fast as the effect goes — on a low note, on both
   *  a 2A03 pulse and the saw at once, so the two ceilings are compared in one run. */
  const song = buildSong({
    lanes: 8,
    meta: { rowsPerPattern: 64, speed: 6 },
    patterns: {
      'pulse1:0': [{ r: 0, note: 36, vol: 15, fx: [{ cmd: '2', param: 0xff }] }],
      'vrc6saw:0': [{ r: 0, note: 36, vol: 15, fx: [{ cmd: '2', param: 0xff }] }],
    },
  })

  it('the saw passes 0x7FF and stops at 0xFFF; pulse 1 stops at 0x7FF', () => {
    const { ticks } = drive(song, 40)
    const saw = vrc6TimerSeries(ticks, REG.SAW_LO)
    const pulse = timerSeries(ticks, REG.P1_LO)
    expect(saw[0]).toBe(1954)
    expect(pulse[0]).toBe(1709)
    expect(Math.max(...saw)).toBe(MAX_VRC6_PERIOD)
    expect(Math.max(...pulse)).toBe(MAX_PERIOD)
    expect(saw.some((v) => v > MAX_PERIOD)).toBe(true)
    expect(pulse.every((v) => v <= MAX_PERIOD)).toBe(true)
    expect(saw[saw.length - 1]).toBe(MAX_VRC6_PERIOD)
    expect(pulse[pulse.length - 1]).toBe(MAX_PERIOD)
  })
})

describe('a 3xx glide on the saw', () => {
  /** `3xx` is a channel MODE: the next note is slid to rather than triggered. Two
   *  notes an octave and a half apart, so the period's high nibble crosses several
   *  boundaries on the way — which is the only thing that may write `$B002`. */
  const song = buildSong({
    lanes: 8,
    meta: { rowsPerPattern: 8, speed: 6 },
    patterns: {
      'vrc6saw:0': [
        { r: 0, note: 72, vol: 15, fx: [{ cmd: '3', param: 0x20 }] },
        { r: 1, note: 60 },
      ],
    },
  })

  it('moves $B001 continuously and $B002 only when its nibble changes — D-TK2', () => {
    const { ticks, sink } = drive(song, 40)
    const period = vrc6TimerSeries(ticks, REG.SAW_LO)
    expect(period[0]).toBe(243) // c5 on the saw
    expect(period[period.length - 1]).toBe(488) // arrived at c4

    let lo = 0
    let hi = 0
    for (let i = 0; i < sink.length; i++) {
      if (sink.addrs[i] === REG.SAW_LO) lo++
      if (sink.addrs[i] === REG.SAW_HI) hi++
    }
    // the glide covers 245 period units at `3xx`'s 0x20 = 32 units per tick, so
    // $B001 moves on eight successive ticks; $B002 crosses exactly one high-nibble
    // boundary (0x0F3 -> 0x1E8) and is otherwise untouched, so it goes out twice in
    // the whole run — the trigger's write and that one crossing.
    expect(lo).toBeGreaterThan(6)
    expect(hi).toBe(2)

    // every $B002 written during the glide keeps the enable bit set: the lane is
    // sounding throughout, and a cleared E would reset its phase mid-glide.
    for (let i = 0; i < sink.length; i++) {
      if (sink.addrs[i] === REG.SAW_HI) expect(sink.values[i] & 0x80).toBe(0x80)
    }
  })
})

describe('the saw’s rate table', () => {
  it('is OCTET’s mapping, all sixteen entries', () => {
    const table = [0, 3, 6, 8, 11, 14, 17, 20, 22, 25, 28, 31, 34, 36, 39, 42]
    for (let v = 0; v <= 15; v++) expect(vrc6SawRate(v), `volume ${v}`).toBe(table[v])
    // the three the brief names, called out so a silent re-derivation is visible
    expect(vrc6SawRate(0)).toBe(0)
    expect(vrc6SawRate(3)).toBe(8)
    expect(vrc6SawRate(15)).toBe(42)
    // 42 is the ceiling: above it the 8-bit accumulator wraps, which is distortion,
    // not loudness, and a volume column must not be able to reach it
    expect(vrc6SawRate(99)).toBe(42)
  })

  it('and the driver writes it: volume 3 then volume 15 on one held note', () => {
    const song = buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 8 },
      patterns: { 'vrc6saw:0': [{ r: 0, note: 69, vol: 3 }, { r: 1, vol: 15 }] },
    })
    const { ticks } = drive(song, 18)
    expect(at(ticks, 0, REG.SAW_RATE)).toBe(8)
    expect(at(ticks, 6, REG.SAW_RATE)).toBe(42)
  })
})

describe('the duty field is four bits wide', () => {
  it('packs mode into bit 3 and duty into bits 0–2', () => {
    expect(vrc6PulseControlByte(7, 15)).toBe(0x7f)
    expect(vrc6PulseControlByte(0, 15)).toBe(0x0f)
    expect(vrc6PulseControlByte(8, 15)).toBe(0x8f) // mode bit, duty 0
    expect(vrc6PulseControlByte(15, 9)).toBe(0xf9) // mode bit, duty 7
    expect(vrc6PulseControlByte(0x1f, 0x1f)).toBe(0xff) // masked, never overflowing
  })

  it('defaults to 7 — a 50 % square — when neither a macro nor a Vxx sets one', () => {
    const { ticks } = drive(
      buildSong({ lanes: 8, patterns: { 'vrc6p1:0': [{ r: 0, note: 69 }] } }),
      4,
    )
    expect((at(ticks, 0, REG.V1_CTRL) >> 4) & 0x0f).toBe(7)
  })

  it('a Vxx sets all four bits, so V08 reaches the mode bit', () => {
    const song = buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 8 },
      patterns: {
        'vrc6p2:0': [
          { r: 0, note: 69, fx: [{ cmd: 'V', param: 3 }] },
          { r: 1, fx: [{ cmd: 'V', param: 8 }] },
        ],
      },
    })
    const { ticks } = drive(song, 18)
    expect(at(ticks, 0, REG.V2_CTRL)).toBe(0x3f)
    expect(at(ticks, 6, REG.V2_CTRL)).toBe(0x8f)
  })

  it('a duty macro steps 0..7 through the field, one value per tick', () => {
    const song = buildSong({
      lanes: 8,
      meta: { rowsPerPattern: 16, speed: 12 },
      instruments: [
        { name: 'lead', macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: 0 } },
      ],
      sequences: { duty: [{ values: [0, 1, 2, 3, 4, 5, 6, 7], loop: -1, release: -1 }] },
      patterns: { 'vrc6p1:0': [{ r: 0, note: 69, inst: 0, vol: 15 }] },
    })
    const { ticks } = drive(song, 10)
    const duties: number[] = []
    for (let t = 0; t < 8; t++) duties.push((at(ticks, t, REG.V1_CTRL) >> 4) & 0x0f)
    expect(duties).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // the 2A03 pulses are untouched by the wider field: they still mask to two bits
    const p = buildSong({
      meta: { rowsPerPattern: 16, speed: 12 },
      instruments: [
        { name: 'lead', macros: { volume: -1, arpeggio: -1, pitch: -1, hiPitch: -1, duty: 0 } },
      ],
      sequences: { duty: [{ values: [0, 1, 2, 3, 4, 5, 6, 7], loop: -1, release: -1 }] },
      patterns: { 'pulse1:0': [{ r: 0, note: 69, inst: 0, vol: 15 }] },
    })
    const run = drive(p, 10)
    const pd: number[] = []
    for (let t = 0; t < 8; t++) pd.push((at(run.ticks, t, REG.P1_CTRL) >> 6) & 3)
    expect(pd).toEqual([0, 1, 2, 3, 0, 1, 2, 3])
  })
})
