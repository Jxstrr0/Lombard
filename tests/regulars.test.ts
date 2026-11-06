/**
 * M4 "done when": a 30-day playthrough has recurring characters the tester can
 * name. Plays 30 days with the careful policy through the real reducer and
 * counts who came to the counter (visits in the regulars' memory).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CAST } from '../src/data/customers/cast'
import { firstNames } from '../src/data/customers/walkins'
import { REGULARS } from '../src/data/regulars'
import { tuning } from '../src/data/tuning'
import { reducer } from '../src/game/actions'
import { createInitialState, type GameState } from '../src/game/state'
import { careful, type Policy } from '../src/sim/policies'

const DAYS = 30
const SEEDS = [1000, 1001]
/** The ones written to drop in about weekly. */
const WEEKLY = ['valentin', 'yevstafy', 'margarita']

interface Played {
  final: GameState
  /** Walk-in sellers in each morning's queue. */
  walkInSellers: number[]
  /** Regulars who at some point held a pledge they meant to redeem. */
  pledged: Set<string>
}

function play(seed: number, policy: Policy, days: number): Played {
  let s = reducer(createInitialState(seed, `regulars-${seed}`), { type: 'career/begin', shopName: '' })
  const ctx = policy.start(s)
  const walkInSellers: number[] = []
  const pledged = new Set<string>()
  for (let d = 0; d < days; d++) {
    const day = s.calendar.day
    for (let guard = 0; guard < 2_000; guard++) {
      const action = policy.next(s, ctx)
      if (action === null) break
      let next = reducer(s, action)
      if (next === s) next = reducer(s, policy.stuck(s, action)!)
      if (action.type === 'day/open') {
        walkInSellers.push(next.queue.filter((v) => v.kind === 'seller' && !v.customer.regularId && !v.loanId).length)
      }
      s = next
      for (const l of s.loans) if (l.customer.regularId && l.redeemDay !== null) pledged.add(l.customer.regularId)
      policy.after?.(s, action, ctx)
      if (s.calendar.day !== day) break
    }
  }
  return { final: s, walkInSellers, pledged }
}

describe('regulars content', () => {
  const looks = new Map(CAST.map((c) => [c.id, c]))

  it('each regular has a look of their own, of their archetype', () => {
    const used = new Set<string>()
    for (const r of REGULARS) {
      expect(used.has(r.look), `${r.id} shares ${r.look}`).toBe(false)
      used.add(r.look)
      const look = looks.get(r.look)!
      expect(look.regular, `${r.id}: ${r.look} is a walk-in look`).toBe(true)
      expect(look.archetype, r.id).toBe(r.archetype)
    }
  })

  it('names never start like a walk-in name, so a regular is never mistaken for one', () => {
    const walkIn = new Set<string>(firstNames)
    const seen = new Set<string>()
    for (const r of REGULARS) {
      const first = r.name.split(' ')[0]!
      expect(walkIn.has(first), r.name).toBe(false)
      expect(seen.has(first), r.name).toBe(false)
      seen.add(first)
    }
  })

  it('everyone who drops in on a schedule has things to bring and a few lines per warmth', () => {
    const scheduled = REGULARS.filter((r) => r.schedule)
    expect(scheduled.length).toBeGreaterThanOrEqual(36) // M6: forty regulars, less Fedya, Eduard and Zhora (they come only for their arcs)
    for (const r of scheduled) {
      expect(r.items.length, r.id).toBeGreaterThanOrEqual(3)
      expect(r.lines.again.length + r.lines.warm.length + r.lines.cold.length, r.id).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('regulars over a 30-day career', () => {
  let runs: ({ seed: number } & Played)[] = []
  beforeAll(() => {
    runs = SEEDS.map((seed) => ({ seed, ...play(seed, careful, DAYS) }))
  }, 120_000)

  it('at least ten regulars come to the counter two or more times, and most at least once', () => {
    for (const { seed, final } of runs) {
      const visits = REGULARS.filter((r) => r.schedule).map((r) => final.customers[r.id]?.visits ?? 0)
      expect(visits.filter((v) => v >= 2).length, `seed ${seed}`).toBeGreaterThanOrEqual(10)
      expect(visits.filter((v) => v >= 1).length, `seed ${seed}`).toBeGreaterThanOrEqual(visits.length - 2)
    }
  })

  it('the weekly ones come about weekly, and nobody comes in every other day', () => {
    for (const { seed, final, pledged } of runs) {
      for (const id of WEEKLY) {
        // Someone with a pledge they mean to redeem comes back for that, not to sell (story/plan.ts),
        // so a weekly regular who pawns stays away until the redemption, up to a month.
        expect(final.customers[id]?.visits ?? 0, `${id} seed ${seed}`).toBeGreaterThanOrEqual(pledged.has(id) ? 1 : 3)
      }
      for (const r of REGULARS) expect(final.customers[r.id]?.visits ?? 0, `${r.id} seed ${seed}`).toBeLessThanOrEqual(DAYS / 5)
    }
  })

  it('walk-ins stay the bulk of every day', () => {
    for (const { seed, walkInSellers } of runs) {
      expect(walkInSellers).toHaveLength(DAYS)
      for (const n of walkInSellers) expect(n, `seed ${seed}`).toBeGreaterThanOrEqual(tuning.story.minWalkIns)
      const avg = walkInSellers.reduce((a, n) => a + n, 0) / walkInSellers.length
      expect(avg, `seed ${seed}`).toBeGreaterThan(tuning.day.customersPerDay * 0.65)
    }
  })
})
