/**
 * Items a story or a regular specifies (M4): a given def, authenticity and
 * provenance, with condition, weight and value drawn by the item's own rules.
 * Ordinary walk-in items still come from items/generate.ts (whose draw order
 * is part of the save contract); this is a separate path.
 */
import { tuning } from '../../data/tuning'
import { computeTrueValue } from '../appraise/value'
import type { Rng } from '../rng'
import type { ItemDef } from '../schema/item'
import type { Authenticity, ItemInstance, Provenance } from '../types'

export interface ItemSpec {
  authenticity: Authenticity
  fakeProfileId?: string
  provenance: Provenance
  condition?: [number, number]
  story: string
}

export function scriptedItem(def: ItemDef, spec: ItemSpec, rng: Rng, id: string): ItemInstance {
  const t = tuning.items
  let profile = spec.fakeProfileId ? def.fakeProfiles.find((p) => p.id === spec.fakeProfileId) : undefined
  if (!profile && spec.authenticity !== 'genuine') {
    const ofKind = def.fakeProfiles.filter((p) => p.kind === spec.authenticity)
    const pool = ofKind.length > 0 ? ofKind : def.fakeProfiles
    profile = pool.length > 0 ? rng.weighted(pool.map((p) => ({ item: p, weight: p.weight }))) : undefined
  }
  const [cMin, cMax] = spec.condition ?? t.condition
  let condition = rng.int(cMin, cMax)
  if (profile?.kind === 'restored' && !spec.condition) {
    for (let i = 1; i < t.restoredConditionDraws; i++) condition = Math.max(condition, rng.int(cMin, cMax))
  }
  let weightGrams: number | undefined
  if (def.weightGrams) {
    const factor = profile?.weightFactor ?? 1
    const spread = rng.range(-1, 1) * def.weightGrams.tolerance * t.weightSpread
    weightGrams = Math.round((def.weightGrams.expected + spread) * factor * 100) / 100
  }
  const item: ItemInstance = {
    id,
    defId: def.id,
    condition,
    authenticity: profile ? profile.kind : 'genuine',
    provenance: spec.provenance,
    trueValue: computeTrueValue(def, condition, profile, rng),
    revealed: [],
    story: spec.story.replaceAll('{name}', def.name),
  }
  if (profile) item.fakeProfileId = profile.id
  if (weightGrams !== undefined) item.weightGrams = weightGrams
  return item
}
