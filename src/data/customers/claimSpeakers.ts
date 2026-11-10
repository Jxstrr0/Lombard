/**
 * Item claims that only make sense from one kind of speaker. A walk-in whose
 * drawn claim doesn't fit them gets another of the item's claims instead
 * (src/game/items/claims.ts), so a young man never mentions "my first husband".
 * Each pattern is matched case-insensitively against the claim text.
 */
import type { Gender } from '../../game/schema/cast'

export const CLAIM_SPEAKERS: readonly { speaker: Gender; pattern: RegExp }[] = [
  // "my husband", "a different husband", "my husband and I"
  { speaker: 'f', pattern: /\bhusband/i },
  // "my wife", "the wife", "my girlfriend's. Ex-girlfriend's."
  { speaker: 'm', pattern: /\b(my|the) wife\b|\b(my|ex-)girlfriend/i },
]
