/**
 * Item instance generation: authenticity, fake profile, condition, weight, trueValue.
 * STUB (M1 foundation) — replaced by the items worker.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { FakeProfile, ItemDef } from '../schema/item'
import type { ItemInstance } from '../types'
import { computeTrueValue } from '../appraise/value'

export function pickItemDef(defs: readonly ItemDef[], rng: Rng): ItemDef {
  return rng.weighted(defs.map((d) => ({ item: d, weight: d.rarity })))
}

export function fakeProfileOf(def: ItemDef, item: ItemInstance): FakeProfile | undefined {
  return item.fakeProfileId ? def.fakeProfiles.find((p) => p.id === item.fakeProfileId) : undefined
}

export function generateItem(def: ItemDef, rng: Rng, id: string): ItemInstance {
  const condition = rng.int(tuning.items.condition[0], tuning.items.condition[1])
  return {
    id,
    defId: def.id,
    condition,
    authenticity: 'genuine',
    provenance: 'unknown',
    trueValue: computeTrueValue(def, condition, undefined, rng),
    weightGrams: def.weightGrams?.expected,
    revealed: [],
    story: rng.pick(def.claims),
  }
}
