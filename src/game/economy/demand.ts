/**
 * Seasonal demand, market drift and the morning paper (owner: content worker).
 * GDD § 7 ("electronics before school year, gold when the ruble wobbles,
 * medals around Victory Day") and § 10 (newspaper at day start).
 *
 * Contract:
 *   updateMarket(state, rng) → MarketState   called at day open with the NEW day's calendar:
 *       step each tag's drift, then write today's news (1–3 items hinting at demand; never exact numbers).
 *   demandMultiplier(state, tags) → number   season × holiday × drift for an item's demandTags (1 = normal).
 *       Used by buyers (shop worker) and the dealer.
 *
 * Stubs: flat demand, no news.
 */
import type { Rng } from '../rng'
import type { GameState } from '../state'
import type { MarketState } from '../types'

export function updateMarket(state: GameState, _rng: Rng): MarketState {
  return { drift: state.market.drift, news: [] }
}

export function demandMultiplier(_state: GameState, _tags: readonly string[]): number {
  return 1
}
