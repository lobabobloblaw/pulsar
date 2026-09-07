import { describe, expect, it } from 'vitest'
import {
  DraftRepository,
  DRAFT_KEY,
  type DraftStorage,
} from '../../src/state/draft'
import { createEmptySong } from '../../src/state/songModel'
function storage(): DraftStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (k) => entries.get(k) ?? null,
    setItem: (k, v) => {
      entries.set(k, v)
    },
  }
}
const draft = () => ({
  song: {
    ...createEmptySong(),
    meta: { ...createEmptySong().meta, name: 'My melody' },
  },
  dirty: true,
  presetId: null,
})
describe('recoverable song drafts', () => {
  it('restores a real edit and the modified state from a new repository', () => {
    const s = storage()
    const writer = new DraftRepository(s)
    expect(writer.read()).toBeNull()
    writer.write(draft())
    const restored = new DraftRepository(s).read()
    expect(restored?.song.meta.name).toBe('My melody')
    expect(restored?.dirty).toBe(true)
    expect(restored?.song).not.toEqual(createEmptySong())
  })
  it('refuses to overwrite a newer draft from another window', () => {
    const s = storage()
    const first = new DraftRepository(s)
    const second = new DraftRepository(s)
    first.read()
    second.read()
    first.write(draft())
    expect(() => second.write({ ...draft(), dirty: false })).toThrow(
      'Another Pulsar',
    )
    expect(new DraftRepository(s).read()?.dirty).toBe(true)
  })
  it('retains an unreadable draft and surfaces the failure', () => {
    const s = storage()
    s.setItem(DRAFT_KEY, '{broken')
    expect(() => new DraftRepository(s).read()).toThrow()
    expect(s.getItem(DRAFT_KEY)).toBe('{broken')
  })
  it('does not report a successful save when storage rejects the write', () => {
    const store = new DraftRepository({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    store.read()
    expect(() => store.write(draft())).toThrow('quota')
  })
})
