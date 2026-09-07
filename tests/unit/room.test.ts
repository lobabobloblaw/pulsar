import { describe, expect, it, vi } from 'vitest'
import { initialRoom, persistRoom, type RoomStorage } from '../../src/state/room'

describe('room persistence', () => {
  it('uses a valid stored room before consulting the system preference', () => {
    const dark = vi.fn(() => true)
    const storage: RoomStorage = { getItem: () => 'day', setItem: () => {} }
    expect(initialRoom(storage, dark)).toBe('day')
    expect(dark).not.toHaveBeenCalled()
  })

  it('falls back when storage access is blocked', () => {
    const storage: RoomStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
    }
    expect(initialRoom(storage, () => true)).toBe('night')
  })

  it('defaults safely and never lets persistence failures escape', () => {
    expect(initialRoom(undefined, () => false)).toBe('day')
    const storage: RoomStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => persistRoom('night', storage)).not.toThrow()
  })
})
