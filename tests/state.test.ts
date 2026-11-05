import { describe, expect, it } from 'vitest'
import { reducer, type Action } from '../src/game/actions'
import { createInitialState, seasonOf, weekdayOf, type GameState } from '../src/game/state'
import { tuning } from '../src/data/tuning'

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)

describe('initial state', () => {
  it('starts with tuning cash on day 1, shop closed', () => {
    const s = createInitialState(1, 'c1')
    expect(s.cash).toBe(tuning.career.startingCash)
    expect(s.calendar.day).toBe(1)
    expect(s.day.phase).toBe('closed')
    expect(s.current).toBeNull()
  })

  it('derives season and weekday', () => {
    expect(seasonOf('2014-01-15')).toBe('winter')
    expect(seasonOf('2014-04-01')).toBe('spring')
    expect(seasonOf('2014-07-01')).toBe('summer')
    expect(seasonOf('2014-10-01')).toBe('autumn')
    expect(seasonOf('2014-12-31')).toBe('winter')
    expect(weekdayOf('2014-03-03')).toBe(0)
    expect(weekdayOf('2014-03-09')).toBe(6)
  })
})

describe('day loop', () => {
  it('opening the shop fills the queue deterministically', () => {
    const a = reducer(createInitialState(2024, 'c1'), { type: 'day/open' })
    const b = reducer(createInitialState(2024, 'c1'), { type: 'day/open' })
    expect(a).toEqual(b)
    expect(a.queue).toHaveLength(tuning.day.customersPerDay)
    expect(a.day.phase).toBe('open')
    const ids = new Set(a.queue.flatMap((v) => [v.visitId, v.customer.id, v.item.id]))
    expect(ids.size).toBe(a.queue.length * 3)
  })

  it('does not mutate the input state', () => {
    const s0 = createInitialState(5, 'c1')
    const frozen = JSON.stringify(s0)
    run(s0, { type: 'day/open' }, { type: 'counter/next' })
    expect(JSON.stringify(s0)).toBe(frozen)
  })

  it('a visit goes present → inspect → offer, and pass resolves it', () => {
    let s = run(createInitialState(9, 'c1'), { type: 'day/open' }, { type: 'counter/next' })
    expect(s.current?.phase).toBe('present')
    s = run(s, { type: 'counter/inspect' }, { type: 'inspect/useTool', tool: 'magnet' })
    expect(s.inspect?.findings.length).toBeGreaterThan(0)
    expect(s.day.clock).toBe(tuning.inspect.toolSeconds.magnet)
    s = run(s, { type: 'inspect/done' })
    expect(s.current?.phase).toBe('offer')
    s = run(s, { type: 'counter/pass' })
    expect(s.current?.outcome).toBe('passed')
    s = run(s, { type: 'counter/dismiss' })
    expect(s.current).toBeNull()
    expect(s.day.served).toBe(1)
  })

  it('an accepted offer moves cash and the item', () => {
    let s = run(createInitialState(11, 'c1'), { type: 'day/open' }, { type: 'counter/next' }, { type: 'counter/inspect' }, { type: 'inspect/done' })
    const item = s.current!.item
    // Offer the item's full value: any sane haggle accepts that.
    s = run(s, { type: 'offer/make', amount: Math.max(100, item.trueValue * 2), approach: 'straight' })
    expect(s.current?.outcome).toBe('bought')
    expect(s.inventory.map((i) => i.id)).toContain(item.id)
    expect(s.cash).toBe(tuning.career.startingCash - s.current!.price!)
  })

  it('cannot offer more cash than you have', () => {
    const s = run(createInitialState(11, 'c1'), { type: 'day/open' }, { type: 'counter/next' }, { type: 'counter/inspect' }, { type: 'inspect/done' })
    expect(reducer(s, { type: 'offer/make', amount: s.cash + 1, approach: 'straight' })).toBe(s)
  })

  it('waiting customers walk out when patience runs out', () => {
    let s = run(createInitialState(3, 'c1'), { type: 'day/open' }, { type: 'counter/next' })
    const waiting = s.queue.length
    s = reducer(s, { type: 'time/tick', seconds: 10_000 })
    expect(s.queue).toHaveLength(0)
    expect(s.day.log.filter((e) => e.kind === 'walkout')).toHaveLength(waiting)
    expect(s.reputation.general).toBeLessThan(0)
  })

  it('a full day can be played to the ledger and the next day opened', () => {
    let s = reducer(createInitialState(21, 'c1'), { type: 'day/open' })
    while (s.queue.length > 0) s = run(s, { type: 'counter/next' }, { type: 'counter/pass' }, { type: 'counter/dismiss' })
    s = reducer(s, { type: 'day/close' })
    expect(s.day.phase).toBe('closed')
    expect(s.calendar.day).toBe(2)
    expect(s.history).toHaveLength(1)
    s = reducer(s, { type: 'day/open' })
    expect(s.queue.length).toBe(tuning.day.customersPerDay)
  })

  it('selling to the dealer pays cash and removes the item', () => {
    let s = run(createInitialState(11, 'c1'), { type: 'day/open' }, { type: 'counter/next' }, { type: 'counter/inspect' }, { type: 'inspect/done' })
    s = run(s, { type: 'offer/make', amount: Math.max(100, s.current!.item.trueValue * 2), approach: 'straight' }, { type: 'counter/dismiss' })
    while (s.queue.length > 0) s = run(s, { type: 'counter/next' }, { type: 'counter/pass' }, { type: 'counter/dismiss' })
    s = reducer(s, { type: 'day/close' })
    const item = s.inventory[0]!
    const cash = s.cash
    s = reducer(s, { type: 'ledger/sell', itemId: item.id })
    expect(s.inventory).toHaveLength(0)
    expect(s.cash).toBeGreaterThanOrEqual(cash)
    expect(s.stats.itemsSold).toBe(1)
  })
})
