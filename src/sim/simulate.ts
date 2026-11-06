/**
 * Headless simulator (docs/02-ARCHITECTURE.md § Testing): runs whole careers
 * through the real reducer with a scripted player policy and reports the
 * economy. Pure: no DOM, no three, seeded only.
 *
 * Used by scripts/sim.mjs (`npm run sim`, a printed report for tuning) and by
 * tests/sim.test.ts (the M2 done criteria).
 */
import { vandalismLines } from '../data/vandalismLines'
import { reducer, type Action } from '../game/actions'
import { isPoliceVisit } from '../game/crime/volkova'
import { createInitialState, type GameState } from '../game/state'
import { recordBeat } from '../game/story/progress'
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
  /**
   * First day the shop was insolvent (worth below zero: cash plus stock at cost
   * plus loans out can't cover what it owes), or null. A one-night cash dip on
   * rent day with stock on the shelves is not a bust.
   */
  bustDay: number | null
  /** Lowest closing cash seen. */
  minCash: number
  finalCash: number
  finalWorth: number
  stats: GameState['stats']
  /** Regulars' memory at the end (M4): visits and trust per regular met. */
  customers: GameState['customers']
  /** M5: the crime dials and the fence at the end, and the ending axes. */
  crime: GameState['crime']
  axes: GameState['career']['axes']
  /** Actions dispatched (sanity: guards against a stuck policy). */
  steps: number
  /** M5 police: heat at the end, Volkova's visits, pieces the police took, raids, and whether it was shut down. */
  police: { heat: number; visits: number; seized: number; raids: number; shut: boolean }
  /** M5: how the career ended (the run stops that day), or null. */
  end: GameState['career']['end']
  /** M5: the crime dials (also in `crime`) and the story flags at the end (who paid, who held out). */
  heat: number
  pressure: number
  flags: readonly string[]
  /** M5 Protection, as it played: bricks through the case, glazier visits, insurance paid (₽), crew deliveries bought. */
  crew: { bricks: number; glaziers: number; insurance: number; deliveries: number }
}

export interface SimOptions {
  /**
   * M5: the Protection arc's ladder for refusers (the brick, the landlord, pushed out). On by
   * default. Off, the career starts with the ladder's first rung (protection.properly) marked
   * as already past, so no rung after the bakery story ever comes; the game's rules are
   * unchanged. The M2 trading band (tests/sim.test.ts) measures the trade with it off.
   */
  protectionLadder?: boolean
}

/** The ladder's first rung, recorded as past before day 1 (see SimOptions.protectionLadder). */
export function holdOffLadder(s: GameState): GameState {
  return recordBeat(s, 'protection.properly', { day: 0, outcome: 'left', choice: 'sim:held_off' })
}

const MAX_STEPS_PER_DAY = 2_000

export function worthOf(s: GameState): number {
  const stock = s.inventory.reduce((a, i) => a + (s.paid[i.id] ?? 0), 0)
  const lent = s.loans.reduce((a, l) => a + l.principal, 0)
  return s.cash + stock + lent
}

export function simulate(seed: number, policy: Policy, days: number, options: SimOptions = {}): RunResult {
  let s = reducer(createInitialState(seed, `sim-${seed}`), { type: 'career/begin', shopName: '' })
  if (options.protectionLadder === false) s = holdOffLadder(s)
  const crew = { bricks: 0, glaziers: 0, insurance: 0, deliveries: 0 }
  const ctx = policy.start(s)
  const points: DayPoint[] = []
  let bustDay: number | null = null
  let steps = 0
  const police = { heat: 0, visits: 0, seized: 0, raids: 0, shut: false }
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
      if (action.type === 'counter/next' && isPoliceVisit(next.current)) police.visits++
      if (action.type === 'day/close') police.seized += s.day.log.filter((e) => e.kind === 'story' && e.itemId && (e.text.startsWith('Volkova took') || e.text.startsWith('Seized'))).length
      s = next
      policy.after?.(s, action, ctx)
      if (s.calendar.day !== day) break // day/close advanced the calendar
    }
    // The day's ledger (the brick and the glazier land in the morning's log, insurance at closing).
    for (const e of s.day.log) {
      if (e.text === vandalismLines.brick.found) crew.bricks++
      else if (e.text === vandalismLines.brick.glazier) crew.glaziers++
      else if (e.kind === 'expense' && e.text.startsWith('Insurance')) crew.insurance -= e.amount
    }
    const worth = worthOf(s)
    points.push({ day, cash: s.cash, worth })
    if (bustDay === null && worth < 0) bustDay = day
    if (s.career.end) break // M5: a forced ending (pushed out, say): nothing more to play.
  }
  const minCash = Math.min(...points.map((p) => p.cash))
  police.heat = s.crime.heat
  police.raids = s.crime.flags.includes('police.raided') ? 1 + (s.career.end?.kind === 'raided' ? 1 : 0) : 0
  police.shut = s.career.end?.kind === 'raided'
  return {
    seed,
    policy: policy.name,
    days: points,
    bustDay,
    minCash,
    finalCash: s.cash,
    finalWorth: worthOf(s),
    stats: s.stats,
    customers: s.customers,
    crime: s.crime,
    steps,
    police,
    end: s.career.end,
    axes: s.career.axes,
    heat: s.crime.heat,
    pressure: s.crime.pressure,
    flags: s.story.flags,
    crew: {
      ...crew,
      deliveries: Object.entries(s.story.arcs.protection?.beats ?? {}).filter(([id, r]) => id.startsWith('protection.delivery') && r.outcome === 'bought').length,
    },
  }
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
  /** Items shoplifted per run (M4). */
  avgStolen: number
  /** Runs whose closing cash ever went below zero. */
  cashDips: number
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
    avgStolen: results.reduce((a, r) => a + (r.stats.itemsStolen ?? 0), 0) / Math.max(1, results.length),
    cashDips: results.filter((r) => r.minCash < 0).length,
  }
}
