/**
 * Rent, utilities, retainers (owner: economy worker). GDD § 7.
 *
 * Contract: chargeExpenses(state) → state, called by the reducer at day close
 * BEFORE the day summary is built. Charge whatever falls due tonight, as
 * 'expense' ledger entries (negative amounts) and cash changes; reset monthly
 * specialist call counts on billing day. Cash may go negative (eviction is M5).
 * upcomingBills(state) is for the ledger UI ("Rent 30,000 ₽ due in 4 days").
 *
 * Stub: nothing is charged.
 */
import type { GameState } from '../state'

export interface UpcomingBill {
  label: string
  amount: number
  inDays: number
}

export function chargeExpenses(state: GameState): GameState {
  return state
}

export function upcomingBills(_state: GameState): UpcomingBill[] {
  return []
}
