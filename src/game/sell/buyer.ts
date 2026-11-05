/**
 * Walk-in buyers (owner: shop worker). GDD § 4 "Buying side" and § 6.
 *
 * Contract (the reducer calls these; keep the signatures):
 *   planBuyers(state, rng, nextId) → QueuedVisit[]   kind 'buyer', item = snapshot of a displayed item,
 *       optional `line` (their opening line). Sell chance per displayed item per day =
 *       f(tag / trueValue, slot visibility, demandMultiplier(state, def.demandTags), reputation).
 *       Items with no tag price are not for sale.
 *   startSale(state, item, tag, customer, rng) → SaleState   their opening offer (≤ tag) and hidden ceiling.
 *   saleRound(sale, counter, customer, rng) → { sale, response }   you counter with a price between
 *       their offer and your tag; they accept, raise, or walk. Same feel as the seller haggle in reverse.
 *
 * Stubs below: no buyers, opening offer 80% of tag, accept anything ≤ tag.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { GameState } from '../state'
import type { ItemInstance, QueuedVisit, SaleResponse, SaleState, WalkIn } from '../types'

export function planBuyers(_state: GameState, _rng: Rng, _nextId: (prefix: string) => string): QueuedVisit[] {
  return []
}

export function startSale(_state: GameState, item: ItemInstance, tag: number, _customer: WalkIn, _rng: Rng): SaleState {
  return { itemId: item.id, tag, offer: Math.round(tag * tuning.sell.openFactor), ceiling: tag, round: 0, maxRounds: tuning.sell.maxRounds, status: 'open', history: [] }
}

export function saleRound(sale: SaleState, counter: number, _customer: WalkIn, _rng: Rng): { sale: SaleState; response: SaleResponse } {
  const response: SaleResponse =
    counter <= sale.ceiling ? { kind: 'accept', price: counter, lineKey: 'sale.accept.flexible' } : { kind: 'walk', price: sale.offer, lineKey: 'sale.walk.flexible' }
  const status = response.kind === 'accept' ? 'sold' : 'walked'
  return { sale: { ...sale, round: sale.round + 1, status, history: [...sale.history, { counter, response }] }, response }
}
