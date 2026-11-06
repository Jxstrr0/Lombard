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
  if (!def || !roster || !cost || prev?.retained || state.cash < cost.fee) return state
  const next = chargeExpense(state, cost.fee, `Retainer: ${def.name} (rest of the month)`)
  const sp: SpecialistState = {
    retained: true,
    relationship: prev?.relationship ?? tuning.specialists.relationshipStart,
    callsUsed: roster.calls - cost.calls,
    sinceDay: state.calendar.day,
  }
  return { ...next, specialists: { ...next.specialists, [id]: sp } }
}

export function releaseSpecialist(state: GameState, id: string): GameState {
  const sp = state.specialists[id]
  if (!sp?.retained) return state
  const relationship = Math.max(0, sp.relationship - tuning.specialists.releaseRelationshipLoss)
  return { ...state, specialists: { ...state.specialists, [id]: { ...sp, retained: false, relationship, sinceDay: 0 } } }
}

/** Calls left in this month's allowance (0 if not retained). */
export function callsLeft(state: GameState, id: string): number {
  const sp = state.specialists[id]
  const roster = tuning.specialists.roster[id]
  if (!sp?.retained || !roster) return 0
  return Math.max(0, roster.calls - sp.callsUsed)
}

/** The retained specialist covering this item's category (roster order), if any. */
export function specialistFor(state: GameState, def: ItemDef): string | undefined {
  return SPECIALISTS.find((s) => state.specialists[s.id]?.retained && s.categories.includes(def.category))?.id
}

/** Any specialist (retained or not) covering this category. */
export function coversCategory(def: ItemDef): boolean {
  return SPECIALISTS.some((s) => s.categories.includes(def.category))
}
