import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { reducer, type Action } from '../src/game/actions'
import type { GameState } from '../src/game/state'
import { tuning } from '../src/data/tuning'
import { visitLines } from '../src/data/lines'

const run = (s: GameState, ...actions: Action[]) => actions.reduce(reducer, s)

/** An open day with the paper read, so time can pass. */
function openDay(seed: number): GameState {
  const s = reducer(startedState(seed, 'c1'), { type: 'day/open' })
  return s.day.newsRead ? s : reducer(s, { type: 'news/dismiss' })
}

function tickUntilCustomer(s: GameState, limit = 120): { s: GameState; seconds: number } {
  for (let t = 1; t <= limit; t++) {
    s = reducer(s, { type: 'time/tick', seconds: 1 })
    if (s.current) return { s, seconds: t }
  }
  return { s, seconds: -1 }
}

describe('the lull between customers', () => {
  it('the first customer walks in a few seconds after opening', () => {
    const s = openDay(5)
    const [lo, hi] = tuning.day.firstArrivalSeconds
    expect(s.day.nextArrival).toBeGreaterThanOrEqual(lo)
    expect(s.day.nextArrival).toBeLessThanOrEqual(hi)
    const { s: after, seconds } = tickUntilCustomer(s)
    expect(after.current).not.toBeNull()
    expect(seconds).toBeGreaterThanOrEqual(Math.floor(lo))
    expect(seconds).toBeLessThanOrEqual(Math.ceil(hi))
  })

  it('after a visit, the next one comes after a lull; the clock runs, the queue does not lose patience', () => {
    let s = openDay(7)
    s = tickUntilCustomer(s).s
    s = run(s, { type: 'counter/pass' }, { type: 'counter/dismiss' })
    expect(s.current).toBeNull()
    expect(visitLines.lull).toContain(s.narration)
    const [lo, hi] = tuning.day.lullSeconds
    const wait = s.day.nextArrival! - s.day.clock
    expect(wait).toBeGreaterThanOrEqual(lo)
    expect(wait).toBeLessThanOrEqual(hi)
    const patience = s.queue.map((v) => v.patience)
    const clock = s.day.clock
    const ticked = reducer(s, { type: 'time/tick', seconds: 5 })
    expect(ticked.current).toBeNull()
    expect(ticked.day.clock).toBe(clock + 5)
    expect(ticked.queue.map((v) => v.patience)).toEqual(patience)
    const { seconds } = tickUntilCustomer(s)
    expect(seconds).toBeGreaterThanOrEqual(Math.floor(lo))
    expect(seconds).toBeLessThanOrEqual(Math.ceil(hi))
  })

  it('nobody walks in while the paper is unread', () => {
    const s = { ...openDay(9) }
    const unread = { ...s, day: { ...s.day, newsRead: false } }
    expect(reducer(unread, { type: 'time/tick', seconds: 60 })).toBe(unread)
  })

  it('pacing does not touch the game Rng (customers and outcomes are unchanged)', () => {
    const s = openDay(11)
    const direct = run(s, { type: 'counter/next' }, { type: 'counter/pass' }, { type: 'counter/dismiss' }, { type: 'counter/next' })
    expect(direct.meta.rng).toEqual(run(s, { type: 'counter/next' }, { type: 'counter/pass' }, { type: 'counter/next' }).meta.rng)
  })

  it('older saves without nextArrival bring the next person on the next tick', () => {
    const s = openDay(13)
    const { nextArrival: _, ...day } = s.day
    expect(reducer({ ...s, day }, { type: 'time/tick', seconds: 1 }).current).not.toBeNull()
  })
})
