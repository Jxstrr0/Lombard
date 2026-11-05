/**
 * trueValue and resale prices.
 * STUB (M1 foundation) — replaced by the items worker.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { FakeProfile, ItemDef } from '../schema/item'
import type { ItemInstance } from '../types'

export function computeTrueValue(def: ItemDef, condition: number, fake: FakeProfile | undefined, rng: Rng): number {
  const base = rng.range(def.baseValue.min, def.baseValue.max)
  const mult = fake ? fake.valueMultiplier : 1
  return Math.round((base * mult * (0.5 + condition / 200)) / 10) * 10
}

/**
 * What the item would be worth if it were what it claims to be (genuine, at its
 * condition). Customers anchor their asking price on this, even for fakes.
 * Deterministic (no rng).
 */
export function claimedValue(def: ItemDef, item: ItemInstance): number {
  const mid = (def.baseValue.min + def.baseValue.max) / 2
  return Math.round((mid * (0.5 + item.condition / 200)) / 10) * 10
}

/** What the M1 dealer pays for an item today. */
export function dealerPrice(item: ItemInstance, rng: Rng): number {
  const noise = rng.range(-tuning.appraise.dealerNoise, tuning.appraise.dealerNoise)
  return Math.max(0, Math.round((item.trueValue * tuning.appraise.dealerRate * (1 + noise)) / 10) * 10)
}
