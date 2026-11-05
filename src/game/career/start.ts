/**
 * Career start (owner: content worker). GDD § 7: a near-empty shop with a few
 * leftover items from the previous owner, who left in a hurry.
 *
 * Contract: leftoverStock(rng, nextId) → ItemInstance[]   added to inventory with paid = 0
 * when the intro finishes (action career/begin). Some should be fakes or junk; the
 * previous owner was not careful.
 *
 * What's in the safe (pools in src/data/intro.ts, counts in tuning.start):
 *   - one piece that is surely not genuine (a fake profile of a tempting def),
 *   - one decent genuine piece in at least tuning.start.genuineMinCondition,
 *   - 1–3 odds and ends, rolled as usual (they may be fakes too).
 * Provenance is always "unknown": nobody has the paperwork. Deterministic for a given rng.
 */
import { getItemDef } from '../../data/items'
import { LEFTOVER_POOLS, LEFTOVER_STORY } from '../../data/intro'
import { tuning } from '../../data/tuning'
import { generateItem } from '../items/generate'
import type { Rng } from '../rng'
import type { ItemDef } from '../schema/item'
import type { ItemInstance } from '../types'

type Want = 'fake' | 'genuine' | 'any'

/** Roll `def` until it matches `want` (bounded by tuning.start.maxRolls; the last roll stands). */
function roll(def: ItemDef, want: Want, rng: Rng, id: string): ItemInstance {
  const t = tuning.start
  // Lean the def toward what we want, so the retry loop rarely runs long.
  const fakes = def.fakeProfiles.filter((p) => p.kind === 'fake')
  const leaned: ItemDef =
    want === 'fake'
      ? { ...def, fakeChance: 1, fakeProfiles: fakes.length > 0 ? fakes : def.fakeProfiles }
      : want === 'genuine'
        ? { ...def, fakeChance: 0 }
        : def
  let item = generateItem(leaned, rng, id)
  for (let i = 1; i < t.maxRolls; i++) {
    const ok =
      want === 'any' ||
      (want === 'fake' && item.authenticity !== 'genuine') ||
      (want === 'genuine' && item.authenticity === 'genuine' && item.condition >= t.genuineMinCondition)
    if (ok) break
    item = generateItem(leaned, rng, id)
  }
  return { ...item, provenance: 'unknown', story: LEFTOVER_STORY }
}

export function leftoverStock(rng: Rng, nextId: (prefix: string) => string): ItemInstance[] {
  const [lo, hi] = tuning.start.extraItems
  const fakeDef = getItemDef(rng.pick(LEFTOVER_POOLS.fakes))
  const decentDef = getItemDef(rng.pick(LEFTOVER_POOLS.decent))
  const extras = rng.shuffle(LEFTOVER_POOLS.junk).slice(0, rng.int(lo, hi))
  const items = [
    roll(fakeDef, 'fake', rng, nextId('i')),
    roll(decentDef, 'genuine', rng, nextId('i')),
    ...extras.map((id) => roll(getItemDef(id), 'any', rng, nextId('i'))),
  ]
  // The safe isn't sorted: shuffle so the fake isn't always first.
  return rng.shuffle(items)
}
