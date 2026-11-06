/**
 * Upgrades (owner: economy worker). M2: acid kit, reference book tiers, better case.
 * Definitions live in src/data/upgrades.ts; costs in tuning.upgrades.
 *
 * Contract: buyUpgrade(state, id) → state; restockAcid(state) → state.
 * Both only while the shop is closed (the reducer checks); refuse (return state
 * unchanged) when unaffordable, already owned, or a prerequisite is missing.
 * hasUpgrade(state, id) for other modules.
 * visibilityBonus(state, area) → multiplier on an area's buyer visibility from case upgrades
 *   (read by the shop worker's buyer planning; 1 = no upgrade).
 * protectedAreas(state) → areas thieves can't reach; recordsEvidence(state) → a camera is installed (M4).
 * refTier(state) → reference book tier, max(1, best owned) (tier 1 is everyone's basic book).
 */
import { getUpgrade, UPGRADES } from '../../data/upgrades'
import { tuning } from '../../data/tuning'
import type { UpgradeDef } from '../schema/economy'
import type { GameState, SlotArea } from '../state'
import { chargeExpense } from './charge'

export type UpgradeStatus = 'owned' | 'locked' | 'short' | 'available'

export function hasUpgrade(state: GameState, id: string): boolean {
  return state.shop.upgrades.includes(id)
}

function owned(state: GameState): UpgradeDef[] {
  return state.shop.upgrades.flatMap((id) => getUpgrade(id) ?? [])
}

export function visibilityBonus(state: GameState, area: SlotArea): number {
  return owned(state).reduce((m, u) => m * (u.effects.visibility?.[area] ?? 1), 1)
}

/** Display areas thieves can't reach (M4: the lockable wall case protects the wall). */
export function protectedAreas(state: GameState): Set<SlotArea> {
  return new Set(owned(state).flatMap((u) => u.effects.protects ?? []))
}

/** True once something in the shop records what happens (the camera): evidence for M5. */
export function recordsEvidence(state: GameState): boolean {
  return owned(state).some((u) => u.effects.records === true)
}

export function refTier(state: GameState): number {
  return owned(state).reduce((t, u) => Math.max(t, u.effects.refTier ?? 1), 1)
}

/** For the office sheet: can this be bought right now, and if not, why. */
export function upgradeStatus(state: GameState, id: string): UpgradeStatus {
  const def = getUpgrade(id)
  if (!def) return 'locked'
  if (hasUpgrade(state, id)) return 'owned'
  if (def.requires.some((r) => !hasUpgrade(state, r))) return 'locked'
  if (state.cash < def.cost) return 'short'
  return 'available'
}

export function buyUpgrade(state: GameState, id: string): GameState {
  const def = getUpgrade(id)
  if (!def || upgradeStatus(state, id) !== 'available') return state
  const next = chargeExpense(state, def.cost, `Bought: ${def.name}`)
  const e = def.effects
  return {
    ...next,
    shop: {
      ...next.shop,
      upgrades: [...next.shop.upgrades, id],
      acidCharges: next.shop.acidCharges + (e.acidCharges ?? 0),
      security: next.shop.security + (e.security ?? 0),
    },
  }
}

/** The upgrade that unlocks a tool (e.g. acid → acid_kit), if any. */
export function toolUpgrade(tool: string): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.effects.unlockTool === tool)
}

export function canRestockAcid(state: GameState): boolean {
  const u = tuning.upgrades
  return hasUpgrade(state, 'acid_kit') && state.shop.acidCharges < u.acidMaxCharges && state.cash >= u.acidRestockCost
}

export function restockAcid(state: GameState): GameState {
  if (!canRestockAcid(state)) return state
  const u = tuning.upgrades
  const next = chargeExpense(state, u.acidRestockCost, 'Acid kit refill')
  return { ...next, shop: { ...next.shop, acidCharges: Math.min(u.acidMaxCharges, next.shop.acidCharges + u.acidRestockCharges) } }
}
