/**
 * Office purchases (upgrades, acid, retainers) and in-day fees as 'expense'
 * ledger entries. While closed, the ledger on screen is the day just closed, so
 * its summary is patched too (the same way a dealer sale is).
 */
import type { GameState } from '../state'

export function chargeExpense(state: GameState, amount: number, text: string): GameState {
  const cash = state.cash - amount
  const log = [...state.day.log, { kind: 'expense' as const, amount: -amount, text }]
  let history = state.history
  const last = history[history.length - 1]
  if (state.day.phase === 'closed' && last) {
    history = history.slice()
    history[history.length - 1] = { ...last, expenses: last.expenses + amount, closingCash: cash }
  }
  return { ...state, cash, history, day: { ...state.day, log } }
}
