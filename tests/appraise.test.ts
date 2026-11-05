import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { tuning } from '../src/data/tuning'
import { claimedValue, computeTrueValue, conditionFactor, dealerPrice, tidyPrice } from '../src/game/appraise/value'
import { generateItem } from '../src/game/items/generate'
import { Rng } from '../src/game/rng'
import type { FakeProfile, ItemDef } from '../src/game/schema/item'
import type { ItemInstance } from '../src/game/types'

function makeItem(def: ItemDef, profile: FakeProfile | undefined, seed: number): ItemInstance {
  const forced: ItemDef = profile ? { ...def, fakeChance: 1, fakeProfiles: [profile] } : { ...def, fakeChance: 0 }
  return generateItem(forced, new Rng(seed), `i${seed}`)
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('condition factor', () => {
  it('hits the tuning endpoints and rises with condition', () => {
    for (const curve of ['linear', 'collector'] as const) {
      const [lo, hi] = tuning.appraise.conditionFactor[curve]
      expect(conditionFactor(curve, 0)).toBeCloseTo(lo)
      expect(conditionFactor(curve, 100)).toBeCloseTo(hi)
      for (let c = 1; c <= 100; c++) expect(conditionFactor(curve, c)).toBeGreaterThan(conditionFactor(curve, c - 1))
    }
  })

  it('collectors punish wear harder than the linear curve', () => {
    expect(conditionFactor('collector', 50)).toBeLessThan(conditionFactor('linear', 50))
    expect(conditionFactor('collector', 100)).toBeGreaterThan(conditionFactor('linear', 100))
  })
})

describe('tidyPrice', () => {
  it('rounds to tens, fifties and hundreds by size, never to zero', () => {
    expect(tidyPrice(263)).toBe(260)
    expect(tidyPrice(4_321)).toBe(4_300)
    expect(tidyPrice(4_330)).toBe(4_350)
    expect(tidyPrice(12_345)).toBe(12_300)
    expect(tidyPrice(1)).toBe(10)
  })
})

describe('computeTrueValue', () => {
  it('stays inside base range × condition factor and is a tidy number', () => {
    for (const def of ITEM_DEFS) {
      const rng = new Rng(8)
      for (const condition of [35, 60, 98]) {
        const v = computeTrueValue(def, condition, undefined, rng)
        const f = conditionFactor(def.valueCurve, condition)
        expect(v).toBeGreaterThanOrEqual(def.baseValue.min * f - 100)
        expect(v).toBeLessThanOrEqual(def.baseValue.max * f + 100)
        expect(v % 10).toBe(0)
      }
    }
  })

  it('values fakes far below the genuine article', () => {
    for (const def of ITEM_DEFS) {
      const genuine = mean(Array.from({ length: 300 }, (_, s) => makeItem(def, undefined, s).trueValue))
      for (const p of def.fakeProfiles) {
        const v = mean(Array.from({ length: 300 }, (_, s) => makeItem(def, p, s).trueValue))
        const limit = p.kind === 'fake' ? 0.2 : 0.75
        expect(v / genuine, `${def.id}/${p.id}`).toBeLessThan(limit)
      }
    }
  })

  it('lands near the GDD anchors (band ~10k, used phone ~8k, rare Soviet watch ~40k in good shape)', () => {
    const at = (id: string, condition: number) => {
      const def = getItemDef(id)
      return mean(Array.from({ length: 200 }, (_, s) => computeTrueValue(def, condition, undefined, new Rng(s))))
    }
    expect(at('gold_band_583', 70)).toBeGreaterThan(8_000)
    expect(at('gold_band_583', 70)).toBeLessThan(12_000)
    expect(at('phone_galaxia_stella4', 70)).toBeGreaterThan(6_500)
    expect(at('phone_galaxia_stella4', 70)).toBeLessThan(10_000)
    expect(at('watch_pobeda_gold', 85)).toBeGreaterThan(35_000)
    expect(at('watch_pobeda_gold', 85)).toBeLessThan(50_000)
  })
})

describe('claimedValue', () => {
  it('is deterministic and ignores authenticity (customers anchor on it, fakes included)', () => {
    for (const def of ITEM_DEFS) {
      const g = makeItem(def, undefined, 1)
      for (const p of def.fakeProfiles) {
        const f = { ...makeItem(def, p, 1), condition: g.condition }
        expect(claimedValue(def, f)).toBe(claimedValue(def, g))
      }
      expect(claimedValue(def, g)).toBe(claimedValue(def, { ...g }))
    }
  })

  it('tracks the average genuine trueValue at that condition', () => {
    for (const def of ITEM_DEFS) {
      const items = Array.from({ length: 400 }, (_, s) => makeItem(def, undefined, s))
      const ratio = mean(items.map((i) => i.trueValue / claimedValue(def, i)))
      expect(Math.abs(ratio - 1), def.id).toBeLessThan(0.05)
    }
  })
})

describe('dealerPrice', () => {
  it('pays dealerRate × trueValue within the noise band', () => {
    const rng = new Rng(3)
    const item = makeItem(getItemDef('gold_band_583'), undefined, 3)
    const { dealerRate, dealerNoise } = tuning.appraise
    for (let i = 0; i < 200; i++) {
      const p = dealerPrice(item, rng)
      expect(p).toBeGreaterThanOrEqual(item.trueValue * dealerRate * (1 - dealerNoise) - 50)
      expect(p).toBeLessThanOrEqual(item.trueValue * dealerRate * (1 + dealerNoise) + 50)
    }
  })

  it('buying genuine at 50% of claimedValue and selling to the dealer profits; any non-genuine piece loses', () => {
    for (const def of ITEM_DEFS) {
      const profit = (profile: FakeProfile | undefined) => {
        const rng = new Rng(11)
        return mean(
          Array.from({ length: 400 }, (_, s) => {
            const item = makeItem(def, profile, s)
            return dealerPrice(item, rng) - claimedValue(def, item) * 0.5
          }),
        )
      }
      expect(profit(undefined), def.id).toBeGreaterThan(0)
      for (const p of def.fakeProfiles) expect(profit(p), `${def.id}/${p.id}`).toBeLessThan(0)
    }
  })
})
