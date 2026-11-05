/**
 * Headless simulator (docs/02-ARCHITECTURE.md § Testing): runs whole careers
 * through the real reducer with a scripted player policy and reports the
 * economy. Pure: no DOM, no three, seeded only.
 *
 * Used by scripts/sim.mjs (`npm run sim`, a printed report for tuning) and by
 * tests/sim.test.ts (the M2 done criteria).
 */
import { reducer, type Action } from '../game/actions'
import { createInitialState, type GameState } from '../game/state'
import type { Policy } from './policies'

export interface DayPoint {
  day: number
  cash: number
  /** cash + what was paid for stock on hand + principal lent out. */
  worth: number
}

export interface RunResult {
  seed: number
  policy: string
  days: DayPoint[]
  /** First day closing cash was below zero, or null. */
  bustDay: number | null
  finalCash: number
  finalWorth: number
  stats: GameState['stats']
  /** Actions dispatched (sanity: guards against a stuck policy). */
  steps: number
}

const MAX_STEPS_PER_DAY = 2_000

export function worthOf(s: GameState): number {
  const stock = s.inventory.reduce((a, i) => a + (s.paid[i.id] ?? 0), 0)
  const lent = s.loans.reduce((a, l) => a + l.principal, 0)
  return s.cash + stock + lent
}

export function simulate(seed: number, policy: Policy, days: number): RunResult {
  let s = reducer(createInitialState(seed, `sim-${seed}`), { type: 'career/begin', shopName: '' })
  const ctx = policy.start(s)
  const points: DayPoint[] = []
  let bustDay: number | null = null
  let steps = 0
  for (let d = 0; d < days; d++) {
    const day = s.calendar.day
    let guard = 0
    // Play from "closed, before opening" through the close of this day.
    while (true) {
      if (++guard > MAX_STEPS_PER_DAY) throw new Error(`policy ${policy.name} stuck on day ${day} (seed ${seed})`)
      const action: Action | null = policy.next(s, ctx)
      if (action === null) break
      const next = reducer(s, action)
      steps++
      if (next === s) {
        const fallback = policy.stuck(s, action)
        if (!fallback) throw new Error(`policy ${policy.name}: ${action.type} had no effect on day ${day} (seed ${seed})`)
        s = reducer(s, fallback)
        continue
      }
      s = next
      policy.after?.(s, action, ctx)
      if (s.calendar.day !== day) break // day/close advanced the calendar
    }
    points.push({ day, cash: s.cash, worth: worthOf(s) })
    if (bustDay === null && s.cash < 0) bustDay = day
  }
  return { seed, policy: policy.name, days: points, bustDay, finalCash: s.cash, finalWorth: worthOf(s), stats: s.stats, steps }
}

/** Compound growth per 30 days of `worth`, from the start of the run to its end. */
export function monthlyGrowth(r: RunResult, startWorth: number): number {
  const last = r.days[r.days.length - 1]
  if (!last || last.worth <= 0 || startWorth <= 0) return -1
  return Math.pow(last.worth / startWorth, 30 / r.days.length) - 1
}

export interface Summary {
  policy: string
  runs: number
  medianGrowth: number
  busted: number
  medianBustDay: number | null
  medianFinalWorth: number
  avgFakesBought: number
}

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN
  const a = xs.slice().sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2
}

export function summarize(results: RunResult[], startWorth: number): Summary {
  const busts = results.filter((r) => r.bustDay !== null).map((r) => r.bustDay!)
  return {
    policy: results[0]?.policy ?? '?',
    runs: results.length,
    medianGrowth: median(results.map((r) => monthlyGrowth(r, startWorth))),
    busted: busts.length,
    medianBustDay: busts.length ? median(busts) : null,
    medianFinalWorth: median(results.map((r) => r.finalWorth)),
    avgFakesBought: results.reduce((a, r) => a + r.stats.fakesBought, 0) / Math.max(1, results.length),
  }
}
