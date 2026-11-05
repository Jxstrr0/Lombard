import { describe, expect, it } from 'vitest'
import { reducer } from '../src/game/actions'
import { createInitialState, seasonOf, weekdayOf } from '../src/game/state'
import { tuning } from '../src/data/tuning'

describe('initial state', () => {
  it('starts with tuning cash on day 1', () => {
    const s = createInitialState(1, 'c1')
    expect(s.cash).toBe(tuning.career.startingCash)
    expect(s.calendar.day).toBe(1)
    expect(s.current).toBeNull()
  })

  it('derives season and weekday', () => {
    expect(seasonOf('2014-01-15')).toBe('winter')
    expect(seasonOf('2014-04-01')).toBe('spring')
    expect(seasonOf('2014-07-01')).toBe('summer')
    expect(seasonOf('2014-10-01')).toBe('autumn')
    expect(seasonOf('2014-12-31')).toBe('winter')
    expect(weekdayOf('2014-03-03')).toBe(0) // a Monday
    expect(weekdayOf('2014-03-09')).toBe(6) // Sunday
  })
})

describe('reducer', () => {
  it('is pure and deterministic under a fixed seed', () => {
    const s0 = createInitialState(2024, 'c1')
    const frozen = JSON.stringify(s0)
    const a = reducer(s0, { type: 'counter/next' })
    const b = reducer(s0, { type: 'counter/next' })
    expect(JSON.stringify(s0)).toBe(frozen)
    expect(a).toEqual(b)
    expect(a.meta.rng).not.toBe(s0.meta.rng)
    expect(a.current).not.toBeNull()
    expect(a.stats.customersSeen).toBe(1)
  })

  it('inspect and pass do nothing without a customer', () => {
    const s0 = createInitialState(1, 'c1')
    expect(reducer(s0, { type: 'counter/inspect' })).toBe(s0)
    expect(reducer(s0, { type: 'counter/pass' })).toBe(s0)
  })

  it('pass clears the customer', () => {
    const s1 = reducer(createInitialState(1, 'c1'), { type: 'counter/next' })
    const s2 = reducer(s1, { type: 'counter/pass' })
    expect(s2.current).toBeNull()
    expect(s2.narration).not.toBe('')
  })

  it('replaying the same actions gives the same state', () => {
    const actions = [
      { type: 'counter/next' },
      { type: 'counter/inspect' },
      { type: 'counter/pass' },
      { type: 'counter/next' },
    ] as const
    const run = () => actions.reduce(reducer, createInitialState(77, 'c1'))
    expect(run()).toEqual(run())
  })
})
