/**
 * Rent, utilities, retainers (owner: economy worker). GDD § 7.
 *
 * Contract: chargeExpenses(state) → state, called by the reducer at day close
 * BEFORE the day summary is built. Charge whatever falls due tonight, as
 * 'expense' ledger entries (negative amounts) and cash changes; reset monthly
 * specialist call counts on billing day. Cash may go negative (eviction is M5).
 * upcomingBills(state) is for the UI ("Rent 30,000 ₽ in 4 days").
 *
 * Billing day is the last day of each calendar month (closing time):
 *   - rent and utilities for the month just ending (amounts: tuning.expenses);
 *   - each retained specialist's retainer for the month ahead, after which every
 *     specialist's call count resets to 0. A retainer paid in full (cash covered
 *     it) grows the relationship by tuning.specialists.relationshipPerMonth.
 * The first month of a retainer is charged (prorated) when retaining; see specialists.ts.
 */
import { getSpecialist } from '../../data/specialists'
import { tuning } from '../../data/tuning'
import { addDays, type GameState, type ISODate } from '../state'
import type { LedgerEntry, SpecialistState } from '../types'

export interface UpcomingBill {
  label: string
  amount: number
  /** Days until the bill is charged: 0 = at closing today. */
  inDays: number
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function monthName(iso: ISODate): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''
}

export function daysInMonth(iso: ISODate): number {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Days from `iso` to the last day of its month (0 on the last day itself). */
export function daysToMonthEnd(iso: ISODate): number {
  return daysInMonth(iso) - Number(iso.slice(8, 10))
}

export function isMonthEnd(iso: ISODate): boolean {
  return addDays(iso, 1).slice(5, 7) !== iso.slice(5, 7)
}

export function chargeExpenses(state: GameState): GameState {
  const date = state.calendar.date
  if (!isMonthEnd(date)) return state
  const next = monthName(addDays(date, 1))
  const entries: LedgerEntry[] = [
    { kind: 'expense', amount: -tuning.expenses.rent, text: `Rent, ${monthName(date)}` },
    { kind: 'expense', amount: -tuning.expenses.utilities, text: `Utilities, ${monthName(date)}` },
  ]
  let cash = state.cash + entries.reduce((a, e) => a + e.amount, 0)
  const t = tuning.specialists
  const specialists: Record<string, SpecialistState> = {}
  for (const [id, sp] of Object.entries(state.specialists)) {
    const roster = t.roster[id]
    const def = getSpecialist(id)
    if (!sp.retained || !roster || !def) {
      specialists[id] = { ...sp, callsUsed: 0 }
      continue
    }
    const paidInFull = cash >= roster.fee
    cash -= roster.fee
    entries.push({ kind: 'expense', amount: -roster.fee, text: `Retainer: ${def.name}, ${next}` })
    const relationship = paidInFull ? Math.min(1, sp.relationship + t.relationshipPerMonth) : sp.relationship
    specialists[id] = { ...sp, callsUsed: 0, relationship }
  }
  return {
    ...state,
    cash,
    specialists,
    day: { ...state.day, log: [...state.day.log, ...entries] },
  }
}

export function upcomingBills(state: GameState): UpcomingBill[] {
  const inDays = daysToMonthEnd(state.calendar.date)
  const bills: UpcomingBill[] = [
    { label: 'Rent', amount: tuning.expenses.rent, inDays },
    { label: 'Utilities', amount: tuning.expenses.utilities, inDays },
  ]
  for (const [id, sp] of Object.entries(state.specialists)) {
    const roster = tuning.specialists.roster[id]
    const def = getSpecialist(id)
    if (sp.retained && roster && def) bills.push({ label: `Retainer: ${def.short}`, amount: roster.fee, inDays })
  }
  return bills
}
