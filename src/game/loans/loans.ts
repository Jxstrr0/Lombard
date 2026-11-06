/**
 * Pawn loans (owner: loans worker). GDD § 3: customer gets cash, item held
 * ~30 days, interest ~10%/month; if unredeemed the item is yours.
 *
 * Contract (the reducer calls these; keep the signatures):
 *   pawnClaim(claim, customer) → the loan amount the customer hopes for (the haggle anchors on it)
 *   createLoan({ id, item, customer, principal, day, rng }) → Loan   decides the hidden redeemDay
 *   amountDue(loan, day) → principal + interest owed if repaid on `day`
 *   planRedemptions(state, nextId) → QueuedVisit[]   kind 'redeem' for loans whose redeemDay has come
 *   forfeitOverdue(state) → state   loans past dueDay + grace: item moves to inventory (paid = principal), 'forfeit' ledger entry
 *
 * Helpers for the walk-in generator and the UI: pawnChance, redeemChance, loanTerms, daysLeft.
 * Story beats (M4): renewLoan (pay interest only, fresh term).
 */
import { getItemDef } from '../../data/items'
import { loanLines } from '../../data/loanLines'
import { tuning } from '../../data/tuning'
import { Rng } from '../rng'
import type { GameState } from '../state'
import type { ItemInstance, Loan, QueuedVisit, WalkIn } from '../types'

const T = tuning.loans

export function pawnClaim(claim: number, _customer: WalkIn): number {
  return Math.round(claim * T.askFactor)
}

/** Chance a walk-in seller wants a loan rather than a sale. */
export function pawnChance(customer: WalkIn, item: ItemInstance): number {
  const p = T.pawnChance
  const raw = p.base + p.perDesperation * customer.desperation + (item.provenance === 'heirloom' ? p.heirloom : 0)
  return clamp(raw, 0, p.max)
}

/** Opening line for a pawner: by temperament, heirlooms get their own. */
export function pawnOpeningLine(customer: WalkIn, item: ItemInstance, rng: Rng): string {
  const key = item.provenance === 'heirloom' && rng.chance(0.6) ? 'pawn.open.heirloom' : `pawn.open.${customer.temperament}`
  const options = loanLines[key] ?? loanLines['pawn.open.flexible'] ?? ['I need a loan.']
  return rng.pick(options)
}

/**
 * Hidden chance the pawner ever comes back. Rises with heirloom/sentiment and
 * genuine items, falls with desperation; fakes and over-lent items rarely return.
 */
export function redeemChance(item: ItemInstance, customer: WalkIn, principal: number): number {
  let p = T.redeemBase - T.redeemDesperation * customer.desperation
  if (item.provenance === 'heirloom') p += T.redeemHeirloom
  if (customer.temperament === 'proud') p += T.redeemProud
  p *= T.redeemAuthenticity[item.authenticity]
  if (principal > item.trueValue * T.overLentRatio) p *= T.overLentFactor
  return clamp(p, T.redeemMin, T.redeemMax)
}

export function createLoan(args: { id: string; item: ItemInstance; customer: WalkIn; principal: number; day: number; rng: Rng }): Loan {
  const { id, item, customer, principal, day, rng } = args
  const dueDay = day + T.termDays
  // Always draw both numbers so the stream stays stable whichever way the first roll goes.
  const comesBack = rng.chance(redeemChance(item, customer, principal))
  const when = rng.int(day + Math.min(T.minRedeemDays, T.termDays), dueDay)
  return {
    id,
    item,
    customer,
    principal,
    startDay: day,
    dueDay,
    monthlyRate: T.monthlyRate,
    redeemDay: comesBack ? when : null,
  }
}

/** Interest prorated by days held (30-day months), never less than minInterestDays' worth; rounded up. */
export function amountDue(loan: Loan, day: number): number {
  return owed(loan.principal, loan.monthlyRate, day - loan.startDay)
}

/** What a new loan of `principal` taken out on `day` would look like (offer screen). */
export function loanTerms(principal: number, day: number): { dueDay: number; termDays: number; monthlyRate: number; owedAtDue: number } {
  return { dueDay: day + T.termDays, termDays: T.termDays, monthlyRate: T.monthlyRate, owedAtDue: owed(principal, T.monthlyRate, T.termDays) }
}

function owed(principal: number, monthlyRate: number, daysHeld: number): number {
  const days = Math.max(T.minInterestDays, daysHeld)
  const interest = (principal * monthlyRate * days) / 30
  // The epsilon keeps float noise (960.0000000001) from rounding up a whole step.
  return Math.ceil((principal + interest) / T.roundTo - 1e-9) * T.roundTo
}

/**
 * Renew a loan (pay interest only; M4, story beats): the interest owed today
 * is paid off and a fresh term starts today on the same principal. The hidden
 * redeemDay is the caller's to replan.
 */
export function renewLoan(loan: Loan, day: number): { loan: Loan; interest: number } {
  const interest = amountDue(loan, day) - loan.principal
  return { loan: { ...loan, startDay: day, dueDay: day + T.termDays }, interest }
}

/** Days until the due day (negative: in the grace period). */
export function daysLeft(loan: Loan, day: number): number {
  return loan.dueDay - day
}

/** Last day before the item is forfeited. */
export function lastRedeemDay(loan: Loan): number {
  return loan.dueDay + T.graceDays
}

/**
 * Redeem visits for loans whose redeemDay has come. Someone who gave up
 * waiting in the queue on their day tries again the next day, until the grace
 * period runs out.
 */
export function planRedemptions(state: GameState, nextId: (prefix: string) => string): QueuedVisit[] {
  const today = state.calendar.day
  const [pMin, pMax] = T.redeemPatience
  const out: QueuedVisit[] = []
  for (const loan of state.loans) {
    if (loan.redeemDay === null || loan.redeemDay > today || today > lastRedeemDay(loan)) continue
    // A per-loan stream: redemptions never shift the rest of the day's draws.
    const rng = new Rng(state.meta.rng).fork(`redeem:${loan.id}:${today}`)
    const name = itemName(loan.item.defId)
    const key = `redeem.arrive.${loan.customer.temperament}`
    const options = loanLines[key] ?? loanLines['redeem.arrive.flexible'] ?? ['I’m back for my things.']
    out.push({
      visitId: nextId('v'),
      kind: 'redeem',
      customer: loan.customer,
      item: loan.item,
      loanId: loan.id,
      patience: Math.round(rng.range(pMin, pMax)),
      line: rng.pick(options).replaceAll('{item}', name).replaceAll('{name}', loan.customer.name),
    })
  }
  return out
}

/** Loans past dueDay + grace: the pledged item becomes shop stock (paid = principal), in the safe. */
export function forfeitOverdue(state: GameState): GameState {
  const today = state.calendar.day
  const overdue = state.loans.filter((l) => today > lastRedeemDay(l))
  if (overdue.length === 0) return state
  const paid = { ...state.paid }
  const log = state.day.log.slice()
  for (const l of overdue) {
    paid[l.item.id] = l.principal
    log.push({
      kind: 'forfeit',
      amount: 0,
      text: `Nobody came for the ${itemName(l.item.defId)} (${l.customer.name}’s loan). It’s in the safe.`,
      itemId: l.item.id,
      defId: l.item.defId,
    })
  }
  return {
    ...state,
    loans: state.loans.filter((l) => !overdue.includes(l)),
    inventory: [...state.inventory, ...overdue.map((l) => l.item)],
    paid,
    day: { ...state.day, log },
  }
}

function itemName(defId: string): string {
  try {
    return getItemDef(defId).name
  } catch {
    return 'item'
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}
