/**
 * Career start (owner: content worker). GDD § 7: a near-empty shop with a few
 * leftover items from the previous owner, who left in a hurry.
 *
 * Contract: leftoverStock(rng, nextId) → ItemInstance[]   added to inventory with paid = 0
 * when the intro finishes (action career/begin). Some should be fakes or junk; the
 * previous owner was not careful.
 *
 * Stub: nothing left behind.
 */
import type { Rng } from '../rng'
import type { ItemInstance } from '../types'

export function leftoverStock(_rng: Rng, _nextId: (prefix: string) => string): ItemInstance[] {
  return []
}
