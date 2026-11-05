/**
 * Pawn loans (owner: loans worker). GDD § 3: customer gets cash, item held
 * ~30 days, interest ~10%/month; if unredeemed the item is yours.
 *
 * Contract (the reducer calls these; keep the signatures):
 *   pawnClaim(claim, customer) → the loan amount the customer hopes for (the haggle anchors on it)
 *   createLoan({ id, item, customer, principal, day, rng }) → Loan   decides the hidden redeemDay
 *   amountDue(loan, day) → principal + interest owed if repaid on `day`
 *   planRedemptions(state, nextId) → QueuedVisit[]   kind 'redeem' for loans whose redeemDay is today
 *   forfeitOverdue(state) → state   loans past dueDay: item moves to inventory (paid = principal), 'forfeit' ledger entry
 *
 * Stubs below: 60% of the claim, 30 days at 10%, never redeemed, nothing forfeits.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { GameState } from '../state'
import type { ItemInstance, Loan, QueuedVisit, WalkIn } from '../types'

export function pawnClaim(claim: number, _customer: WalkIn): number {
  return Math.round(claim * tuning.loans.askFactor)
}

export function createLoan(args: { id: string; item: ItemInstance; customer: WalkIn; principal: number; day: number; rng: Rng }): Loan {
  return {
    id: args.id,
    item: args.item,
    customer: args.customer,
    principal: args.principal,
    startDay: args.day,
    dueDay: args.day + tuning.loans.termDays,
    monthlyRate: tuning.loans.monthlyRate,
    redeemDay: null,
  }
}

export function amountDue(loan: Loan, _day: number): number {
  return loan.principal
}

export function planRedemptions(_state: GameState, _nextId: (prefix: string) => string): QueuedVisit[] {
  return []
}

export function forfeitOverdue(state: GameState): GameState {
  return state
}
