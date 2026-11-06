import { describe, expect, it } from 'vitest'
import { reducer } from '../src/game/actions'
import { assignSlots, mostRecentSlot, summarizeCareer, withUniqueCareerId, type SlotView } from '../src/game/save/slots'
import { startedState } from './helpers'

describe('assignSlots (career slot migration)', () => {
  it('puts the single pre-M4 autosave into slot 1', () => {
    const out = assignSlots([{ careerId: 'kelbo', savedAt: 1000, readable: true }])
    expect(out.get('kelbo')).toBe(1)
  })

  it('fills free slots newest first and leaves a fourth career unslotted (not deleted)', () => {
    const out = assignSlots([
      { careerId: 'oldest', savedAt: 1, readable: true },
      { careerId: 'newest', savedAt: 4, readable: true },
      { careerId: 'mid', savedAt: 3, readable: true },
      { careerId: 'older', savedAt: 2, readable: true },
    ])
    expect([out.get('newest'), out.get('mid'), out.get('older'), out.get('oldest')]).toEqual([1, 2, 3, null])
  })

  it('keeps existing slots and fills only the gaps', () => {
    const out = assignSlots([
      { careerId: 'two', savedAt: 1, slot: 2, readable: true },
      { careerId: 'legacy', savedAt: 9, readable: true },
      { careerId: 'legacy2', savedAt: 5, readable: true },
    ])
    expect(out.get('two')).toBe(2)
    expect(out.get('legacy')).toBe(1)
    expect(out.get('legacy2')).toBe(3)
  })

  it('never gives a slot to an unreadable record without one, but a damaged slotted record keeps its slot', () => {
    const out = assignSlots([
      { careerId: 'corrupt', savedAt: 10, readable: false },
      { careerId: 'damaged', savedAt: 1, slot: 1, readable: false },
      { careerId: 'good', savedAt: 5, readable: true },
    ])
    expect(out.get('corrupt')).toBeNull()
    expect(out.get('damaged')).toBe(1)
    expect(out.get('good')).toBe(2)
  })

  it('resolves two records claiming one slot: the newest keeps it, the other moves to a free slot', () => {
    const out = assignSlots([
      { careerId: 'a', savedAt: 1, slot: 1, readable: true },
      { careerId: 'b', savedAt: 2, slot: 1, readable: true },
    ])
    expect(out.get('b')).toBe(1)
    expect(out.get('a')).toBe(2)
  })

  it('treats junk slot values as no slot', () => {
    const out = assignSlots([{ careerId: 'x', savedAt: 1, slot: 7, readable: true }])
    expect(out.get('x')).toBe(1)
  })
})

describe('slot summaries', () => {
  it('summarises a career for its slot card', () => {
    const s = { ...startedState(3, 'c'), cash: 12345 }
    expect(summarizeCareer(s, 99)).toMatchObject({ careerId: 'c', shopName: s.shop.name, day: 1, cash: 12345, intro: false, progress: false, savedAt: 99 })
    const closed = reducer(reducer(s, { type: 'day/open' }), { type: 'day/close' })
    expect(summarizeCareer(closed, 1).progress).toBe(closed.history.length > 0)
  })

  it('mostRecentSlot picks the latest played occupied slot', () => {
    const career = (savedAt: number) => ({ ...summarizeCareer(startedState(1, `c${savedAt}`), savedAt) })
    const slots: SlotView[] = [
      { slot: 1, career: career(5), damaged: false },
      { slot: 2, career: null, damaged: false },
      { slot: 3, career: career(9), damaged: false },
    ]
    expect(mostRecentSlot(slots)?.slot).toBe(3)
    expect(mostRecentSlot([{ slot: 1, career: null, damaged: true }])).toBeNull()
  })

  it('withUniqueCareerId renames only on a clash', () => {
    const s = startedState(1, 'dup')
    expect(withUniqueCareerId(s, new Set(['other']), 'x')).toBe(s)
    expect(withUniqueCareerId(s, new Set(['dup']), 'x').meta.careerId).toBe('dup-x')
    expect(withUniqueCareerId(s, new Set(['dup', 'dup-x']), 'x').meta.careerId).toBe('dup-x2')
  })
})
