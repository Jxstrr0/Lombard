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
 *   - "insurance" while the Protection arc's paying flag is set (M4,
 *     src/data/stories/protection.ts): tuning.protection.share (or haggledShare)
 *     of the month's net takings at the till, never under tuning.protection.minimum.
 *     M5: each month paid counts dirty on the ending axes (tuning.axes.protectionPaid)
 *     and a little with the mob (tuning.protection.rep.monthPaid).
 * The first month of a retainer is charged (prorated) when retaining; see specialists.ts.
 */
import { getSpecialist } from '../../data/specialists'
import { PROTECTION_FLAGS } from '../../data/stories/protection'
import { tuning } from '../../data/tuning'
import { nudgeAxis } from '../endings/axes'
import { adjustRep } from '../reputation'
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

/**
 * Net takings at the till so far this calendar month: sales and redemptions in,
 * buys and pawn loans out (closed days from the history, plus today while open).
 */
export function monthTakings(state: GameState): number {
  const firstDay = state.calendar.day - (Number(state.calendar.date.slice(8, 10)) - 1)
  let total = 0
  for (const h of state.history) {
    if (h.day >= firstDay && h.day < state.calendar.day) total += h.earned + h.redeemed - h.spent - h.loaned
  }
  if (state.day.phase === 'open') {
    for (const e of state.day.log) if (e.kind === 'sell' || e.kind === 'redeem' || e.kind === 'buy' || e.kind === 'loan') total += e.amount
  }
  return total
}

/** This month's protection "insurance" so far (charged at month end), or null when not paying. */
export function protectionFee(state: GameState): { amount: number; share: number; minimum: boolean } | null {
  const flags = state.story.flags
  if (!flags.includes(PROTECTION_FLAGS.paying)) return null
  const t = tuning.protection
  const share = flags.includes(PROTECTION_FLAGS.haggled) ? t.haggledShare : t.share
  const cut = Math.round((share * monthTakings(state)) / 100) * 100
  return cut > t.minimum ? { amount: cut, share, minimum: false } : { amount: t.minimum, share, minimum: true }
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
    // M4 arcs: a free month (Zhenya's apology) counts as paid in full.
    const free = (sp.mods.freeMonths ?? 0) > 0
    const paidInFull = free || cash >= roster.fee
    if (free) {
      entries.push({ kind: 'expense', amount: 0, text: `Retainer: ${def.name}, ${next} (on the house)` })
    } else {
      cash -= roster.fee
      entries.push({ kind: 'expense', amount: -roster.fee, text: `Retainer: ${def.name}, ${next}` })
    }
    const relationship = paidInFull ? Math.min(1, sp.relationship + t.relationshipPerMonth) : sp.relationship
    specialists[id] = { ...sp, callsUsed: 0, relationship, ...specialistMonthEnd(sp, paidInFull, free, roster.accuracy) }
    // M4 arcs: Zhenya's repair desk pays rent while she's on retainer.
    const rent = sp.mods.rentIn ?? 0
    if (rent > 0) {
      cash += rent
      entries.push({ kind: 'story', amount: rent, text: `Rent from ${def.short}’s repair desk, ${next}` })
    }
  }
  const insurance = protectionFee(state)
  if (insurance) {
    const how = insurance.minimum ? 'the minimum' : `${Math.round(insurance.share * 100)}% of the till`
    entries.push({ kind: 'expense', amount: -insurance.amount, text: `Insurance, ${monthName(date)} (${how})` })
    cash -= insurance.amount
  }
  const charged: GameState = {
    ...state,
    cash,
    specialists,
    day: { ...state.day, log: [...state.day.log, ...entries] },
  }
  if (!insurance) return charged
  return adjustRep(nudgeAxis(charged, 'clean', tuning.axes.protectionPaid, 'insurance'), 'mob', tuning.protection.rep.monthPaid, 'insurance')
}

/** M4 arcs at a month end on retainer: months paid in full, accuracy drift, a free month used up. */
function specialistMonthEnd(sp: SpecialistState, paidInFull: boolean, free: boolean, rosterAccuracy: number): Pick<SpecialistState, 'months' | 'mods'> {
  const mods = { ...sp.mods }
  if (free) mods.freeMonths = (mods.freeMonths ?? 0) - 1
  if (mods.driftPerMonth) {
    const floor = tuning.specialistArcs.minAccuracy - rosterAccuracy
    mods.accuracy = Math.round(Math.max(floor, (mods.accuracy ?? 0) + mods.driftPerMonth) * 1000) / 1000
  }
  return { months: sp.months + (paidInFull ? 1 : 0), mods }
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
    if (sp.retained && roster && def) bills.push({ label: `Retainer: ${def.short}`, amount: (sp.mods.freeMonths ?? 0) > 0 ? 0 : roster.fee, inDays })
  }
  const insurance = protectionFee(state)
  if (insurance) bills.push({ label: 'Insurance', amount: insurance.amount, inDays })
  // M6: the appraiser's wage for the month (prorated from the day he started; src/game/staff/appraiser.ts).
  if (state.staff.hired) {
    const full = daysInMonth(state.calendar.date)
    const monthStart = state.calendar.day - (Number(state.calendar.date.slice(8, 10)) - 1)
    const days = Math.min(full, state.calendar.day + inDays - Math.max(monthStart, state.staff.sinceDay) + 1)
    if (days > 0) bills.push({ label: 'Wages: appraiser', amount: Math.round((tuning.appraiser.salary * days) / full / 100) * 100, inDays })
  }
  return bills
}
