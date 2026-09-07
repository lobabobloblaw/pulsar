import { describe, expect, it } from 'vitest'
import { NoteHoldRegistry, noteHolder } from '../../src/input/noteOwnership'

describe('physical note ownership', () => {
  it('keeps overlapping QWERTY codes independent on the same pitch', () => {
    const holds = new NoteHoldRegistry()
    const comma = noteHolder('qwerty', 'Comma')
    const q = noteHolder('qwerty', 'KeyQ')

    expect(holds.hold(72, comma)).toBe(true)
    expect(holds.hold(72, q)).toBe(false)
    expect(holds.count(72)).toBe(2)
    expect(holds.release(72, comma)).toBe(false)
    expect(holds.count(72)).toBe(1)
    expect(holds.release(72, q)).toBe(true)
  })

  it('treats a repeated event from one holder as idempotent', () => {
    const holds = new NoteHoldRegistry()
    const midi = noteHolder('midi', 'port-a:0')

    expect(holds.hold(60, midi)).toBe(true)
    expect(holds.hold(60, midi)).toBe(false)
    expect(holds.count(60)).toBe(1)
    expect(holds.release(60, midi)).toBe(true)
    expect(holds.release(60, midi)).toBe(false)
  })

  it('does not let one MIDI port release another port or a pointer', () => {
    const holds = new NoteHoldRegistry()
    const portA = noteHolder('midi', 'port-a:0')
    const portB = noteHolder('midi', 'port-b:0')
    const pointer = noteHolder('pointer', 7)

    holds.hold(67, portA)
    holds.hold(67, portB)
    holds.hold(67, pointer)
    expect(holds.release(67, portA)).toBe(false)
    expect(holds.release(67, portB)).toBe(false)
    expect(holds.release(67, pointer)).toBe(true)
  })
})
