/**
 * trueValue and resale prices.
 *
 * trueValue = base (rolled in the def's genuine range) × condition factor × fake multiplier.
 * The condition factor follows the def's value curve: `linear` maps condition straight
 * onto tuning.appraise.conditionFactor; `collector` raises condition to
 * collectorExponent first, so collectors pay a premium for mint and punish wear.
 */
import { tuning } from '../../data/tuning'
import { Rng, type RngState } from '../rng'
import type { FakeProfile, ItemDef } from '../schema/item'
import type { ItemInstance } from '../types'

type ValueCurve = ItemDef['valueCurve']

/** Value multiplier for a condition (0–100) on a value curve. */
export function conditionFactor(curve: ValueCurve, condition: number): number {
  const [lo, hi] = tuning.appraise.conditionFactor[curve]
  const t = Math.min(1, Math.max(0, condition / 100))
  const shaped = curve === 'collector' ? t ** tuning.appraise.collectorExponent : t
  return lo + (hi - lo) * shaped
}

/** Round to a tidy price: tens under 1,000 ₽, fifties under 10,000 ₽, hundreds above. Never below one step. */
export function tidyPrice(value: number): number {
  const steps = tuning.appraise.roundSteps
  const { step } = steps.find((s) => value < s.below) ?? steps[steps.length - 1]!
  return Math.max(steps[0]!.step, Math.round(value / step) * step)
}

export function computeTrueValue(def: ItemDef, condition: number, fake: FakeProfile | undefined, rng: Rng): number {
  const base = rng.range(def.baseValue.min, def.baseValue.max)
  const mult = fake ? fake.valueMultiplier : 1
  return tidyPrice(base * mult * conditionFactor(def.valueCurve, condition))
}

/**
 * What the item would be worth if it were what it claims to be (genuine, at its
 * condition). Customers anchor their asking price on this, even for fakes.
 * Deterministic (no rng): the middle of the def's range × condition factor.
 */
export function claimedValue(def: ItemDef, item: ItemInstance): number {
  const mid = (def.baseValue.min + def.baseValue.max) / 2
  return tidyPrice(mid * conditionFactor(def.valueCurve, item.condition))
}

/** What the M1 dealer pays for an item today: dealerRate × trueValue, ± dealerNoise. */
export function dealerPrice(item: ItemInstance, rng: Rng): number {
  const noise = rng.range(-tuning.appraise.dealerNoise, tuning.appraise.dealerNoise)
  return tidyPrice(item.trueValue * tuning.appraise.dealerRate * (1 + noise))
}

/**
 * The dealer's offer right now: the same draw the sale will take, peeked from the game's Rng
 * state without advancing it, so the ledger can show the price and the sale pays exactly that.
 * Selling something moves the Rng on, so the other offers are re-quoted after each sale.
 */
export function dealerQuote(rngState: RngState, item: ItemInstance): number {
  return dealerPrice(item, Rng.from(rngState))
}
