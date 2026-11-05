/**
 * Item instance generation: authenticity, fake profile, condition, weight,
 * provenance, trueValue, story. Deterministic for a given rng state; the draw
 * order below is part of the save contract (changing it reshuffles careers).
 */
import { tuning } from '../../data/tuning'
import { computeTrueValue } from '../appraise/value'
import type { Rng } from '../rng'
import type { FakeProfile, ItemDef } from '../schema/item'
import type { ItemInstance, Provenance } from '../types'

export function pickItemDef(defs: readonly ItemDef[], rng: Rng): ItemDef {
  return rng.weighted(defs.map((d) => ({ item: d, weight: d.rarity })))
}

export function fakeProfileOf(def: ItemDef, item: ItemInstance): FakeProfile | undefined {
  return item.fakeProfileId ? def.fakeProfiles.find((p) => p.id === item.fakeProfileId) : undefined
}

export function generateItem(def: ItemDef, rng: Rng, id: string): ItemInstance {
  const t = tuning.items

  // 1. Authenticity: genuine, or one of the def's fake profiles by weight.
  const fakeChance = Math.min(1, def.fakeChance * t.fakeChanceScale)
  const isFake = rng.chance(fakeChance)
  const profile = isFake ? rng.weighted(def.fakeProfiles.map((p) => ({ item: p, weight: p.weight }))) : undefined

  // 2. Condition. Fakes use the full range (a fresh copy can look mint); restored pieces skew high.
  const [cMin, cMax] = t.condition
  let condition = rng.int(cMin, cMax)
  if (profile?.kind === 'restored') {
    for (let i = 1; i < t.restoredConditionDraws; i++) condition = Math.max(condition, rng.int(cMin, cMax))
  }

  // 3. Weight, fixed now so repeated weighing agrees.
  let weightGrams: number | undefined
  if (def.weightGrams) {
    const factor = profile?.weightFactor ?? 1
    const spread = rng.range(-1, 1) * def.weightGrams.tolerance * t.weightSpread
    weightGrams = Math.round((def.weightGrams.expected + spread) * factor * 100) / 100
  }

  // 4. Provenance (hidden).
  const heirloomOk = t.heirloomCategories.includes(def.category)
  const pw = t.provenanceWeights
  const provenance = rng.weighted<Provenance>([
    { item: 'unknown', weight: pw.unknown },
    { item: 'clean', weight: pw.clean },
    { item: 'heirloom', weight: heirloomOk ? pw.heirloom : 0 },
  ])

  // 5. Value and story.
  const trueValue = computeTrueValue(def, condition, profile, rng)
  const story = rng.pick(def.claims).replaceAll('{name}', def.name)

  const item: ItemInstance = {
    id,
    defId: def.id,
    condition,
    authenticity: profile ? profile.kind : 'genuine',
    provenance,
    trueValue,
    revealed: [],
    story,
  }
  if (profile) item.fakeProfileId = profile.id
  if (weightGrams !== undefined) item.weightGrams = weightGrams
  return item
}
