/**
 * An item from stock is sold (to a walk-in buyer, the dealer, or, M4, a specialist in a story beat):
 * cash in, item out of inventory/display/prices/paid, career stats updated. Pure.
 * Moved out of actions.ts (M4) so story effects can sell stock too.
 */
import type { GameState } from '../state'
import { clearItem } from './display'

export function removeSold(state: GameState, itemId: string, price: number): GameState {
  const paid = state.paid[itemId] ?? 0
  const profit = price - paid
  const { [itemId]: _drop, ...restPaid } = state.paid
  return noteSold(
    {
      ...state,
      cash: state.cash + price,
      inventory: state.inventory.filter((i) => i.id !== itemId),
      paid: restPaid,
      shop: clearItem(state.shop, itemId),
      stats: {
        ...state.stats,
        itemsSold: state.stats.itemsSold + 1,
        totalEarned: state.stats.totalEarned + price,
        bestDeal: Math.max(state.stats.bestDeal, profit),
        worstDeal: Math.min(state.stats.worstDeal, profit),
      },
    },
    itemId,
  )
}

/** M4 specialist arcs: a piece a specialist lowballed (and you bought) has been sold on: count it for them. */
function noteSold(state: GameState, itemId: string): GameState {
  let specialists = state.specialists
  for (const [id, sp] of Object.entries(state.specialists)) {
    if (!sp.lowballed.includes(itemId)) continue
    const events = { ...sp.events, lowballSold: (sp.events.lowballSold ?? 0) + 1 }
    specialists = { ...specialists, [id]: { ...sp, events, lowballed: sp.lowballed.filter((x) => x !== itemId) } }
  }
  return specialists === state.specialists ? state : { ...state, specialists }
}
