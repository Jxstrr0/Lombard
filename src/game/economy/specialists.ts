/**
 * Specialist retainers (owner: economy worker). GDD § 2b. M2: jeweler and
 * watchmaker; M4: militaria collector, antiques dealer, electronics tech. Definitions (name, categories, lines) live in src/data/specialists.ts;
 * fee, calls per month, per-call fee, hidden accuracy and honesty in
 * tuning.specialists.roster.
 *
 * Contract: retainSpecialist(state, id) → state; releaseSpecialist(state, id) → state.
 * Closed phase only (the reducer checks). The first month's retainer is charged
 * on retaining, prorated to the days left in the month (the calls too: the
 * unused share is marked as already used). From then on the retainer is charged
 * at each month end by expenses.ts, which also resets the call count.
 */
import { getSpecialist, SPECIALISTS } from '../../data/specialists'
import { tuning } from '../../data/tuning'
import { tidyPrice } from '../appraise/value'
import type { ItemDef } from '../schema/item'
import type { GameState } from '../state'
import type { SpecialistState } from '../types'
import { chargeExpense } from './charge'
import { daysInMonth, daysToMonthEnd } from './expenses'

/** What retaining costs right now: the prorated fee and the calls left this month. */
export function retainCost(state: GameState, id: string): { fee: number; calls: number } | null {
  const roster = tuning.specialists.roster[id]
  if (!roster) return null
  const date = state.calendar.date
  const share = (daysToMonthEnd(date) + 1) / daysInMonth(date)
  return { fee: tidyPrice(roster.fee * share), calls: Math.ceil(roster.calls * share) }
}

export function retainSpecialist(state: GameState, id: string): GameState {
  const def = getSpecialist(id)
  const roster = tuning.specialists.roster[id]
  const cost = retainCost(state, id)
  const prev = state.specialists[id]
  if (!def || !roster || !cost || prev?.retained || prev?.retired || state.cash < cost.fee) return state
  const next = chargeExpense(state, cost.fee, `Retainer: ${def.name} (rest of the month)`)
  const sp: SpecialistState = {
    // M4 arcs: what their arc changed (mods, counters) stays with them across a release.
    ...prev,
    retained: true,
    relationship: prev?.relationship ?? tuning.specialists.relationshipStart,
    callsUsed: roster.calls + (prev?.mods.freeCalls ?? 0) - cost.calls,
    sinceDay: state.calendar.day,
    months: 0,
    events: prev?.events ?? {},
    mods: prev?.mods ?? {},
    lowballed: prev?.lowballed ?? [],
  }
  return { ...next, specialists: { ...next.specialists, [id]: sp } }
}

/** `gentle` (M4, Ilya's arc): let them go with no relationship loss. `retire` (M4 arcs): gone for good. */
export function releaseSpecialist(state: GameState, id: string, how: { gentle?: boolean; retire?: boolean } = {}): GameState {
  const sp = state.specialists[id]
  if (!sp?.retained) return state
  const loss = how.gentle || how.retire ? 0 : tuning.specialists.releaseRelationshipLoss
  const relationship = Math.max(0, sp.relationship - loss)
  const next: SpecialistState = { ...sp, retained: false, relationship, sinceDay: 0, months: 0, releasedDay: state.calendar.day }
  if (how.retire) next.retired = true
  return { ...state, specialists: { ...state.specialists, [id]: next } }
}

/** Calls in a month's allowance: the roster's plus any free calls their arc gave (M4). */
export function monthlyCalls(state: GameState, id: string): number {
  return (tuning.specialists.roster[id]?.calls ?? 0) + (state.specialists[id]?.mods.freeCalls ?? 0)
}

/** M4 arcs: buyer chance × this for an item in `category` (Faina's customer book, Zhenya's repair desk). */
export function specialistSellFactor(state: GameState, category: string): number {
  let f = 1
  for (const sp of Object.values(state.specialists)) {
    const b = sp.mods.sellBoost
    if (sp.retained && b && b.categories.includes(category)) f *= b.factor
  }
  return f
}

/** Calls left in this month's allowance (0 if not retained). */
export function callsLeft(state: GameState, id: string): number {
  const sp = state.specialists[id]
  const roster = tuning.specialists.roster[id]
  if (!sp?.retained || !roster) return 0
  return Math.max(0, monthlyCalls(state, id) - sp.callsUsed)
}

/** The retained specialist covering this item's category (roster order), if any. */
export function specialistFor(state: GameState, def: ItemDef): string | undefined {
  return SPECIALISTS.find((s) => state.specialists[s.id]?.retained && s.categories.includes(def.category))?.id
}

/** Any specialist (retained or not) covering this category. */
export function coversCategory(def: ItemDef): boolean {
  return SPECIALISTS.some((s) => s.categories.includes(def.category))
}
