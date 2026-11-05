/**
 * Upgrades (owner: economy worker). M2: acid kit, reference book tiers, better case.
 * Definitions live in src/data/upgrades.ts.
 *
 * Contract: buyUpgrade(state, id) → state; restockAcid(state) → state.
 * Both only while the shop is closed; refuse (return state unchanged) when
 * unaffordable, already owned, or a prerequisite is missing.
 * hasUpgrade(state, id) for other modules.
 *
 * Stubs: nothing can be bought.
 */
import type { GameState } from '../state'

export function hasUpgrade(state: GameState, id: string): boolean {
  return state.shop.upgrades.includes(id)
}

export function buyUpgrade(state: GameState, _id: string): GameState {
  return state
}

export function restockAcid(state: GameState): GameState {
  return state
}
