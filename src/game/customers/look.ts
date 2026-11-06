/**
 * Which cast member plays a walk-in (M3, src/data/customers/cast.json).
 * The look is picked once, when the walk-in is generated, and stored in
 * `portraitKey`; older saves stored the archetype id there, so `lookFor`
 * derives a stable look from the customer id instead.
 *
 * Cast entries marked `regular` (M4) belong to authored regulars and are never
 * drawn for a walk-in: they are filtered out before any pick or hash, so the
 * walk-in pool, and every look already derived from it, is the same as before
 * they were added. M6: the same goes for the appraiser's look (`staff`).
 */
import { CAST } from '../../data/customers/cast'
import { femaleFirstNames } from '../../data/customers/walkins'
import type { CastEntry, Gender } from '../schema/cast'
import { hashString, type Rng } from '../rng'
import type { WalkIn } from '../types'

type Who = Pick<WalkIn, 'name' | 'archetype'>

export function genderOf(name: string): Gender {
  return femaleFirstNames.has(name) ? 'f' : 'm'
}

/** The cast members random walk-ins can be played by (everyone not kept for a regular). */
export function walkInCast(cast: readonly CastEntry[] = CAST): readonly CastEntry[] {
  return cast.filter((c) => !c.regular && !c.staff)
}

/** The looks kept for authored regulars (each regular names one as its portraitKey). */
export function regularCast(cast: readonly CastEntry[] = CAST): readonly CastEntry[] {
  return cast.filter((c) => c.regular)
}

/** Walk-in cast members who can play this person: same gender, same archetype if possible. */
export function castPool(who: Who, cast: readonly CastEntry[] = CAST): readonly CastEntry[] {
  const gender = genderOf(who.name)
  const sameGender = walkInCast(cast).filter((c) => c.gender === gender)
  const exact = sameGender.filter((c) => c.archetype === who.archetype)
  return exact.length > 0 ? exact : sameGender
}

/**
 * Pick a look. `avoid` (the previous customer's look) is skipped when the
 * pool has anyone else, so the same person doesn't step up twice in a row.
 */
export function pickLook(rng: Rng, who: Who, avoid?: string, cast: readonly CastEntry[] = CAST): string {
  const pool = castPool(who, cast)
  if (pool.length === 0) return who.archetype
  const others = pool.filter((c) => c.id !== avoid)
  return rng.pick(others.length > 0 ? others : pool).id
}

/**
 * The cast id to show for a customer (null if there is no cast to draw from).
 * A stored `portraitKey` that names any cast member wins, regular looks included
 * (that is how a regular's visit shows their own face); anything else falls back
 * to a stable pick from the walk-in pool only.
 */
export function lookFor(customer: Pick<WalkIn, 'id' | 'name' | 'archetype' | 'portraitKey'>, cast: readonly CastEntry[] = CAST): string | null {
  if (cast.some((c) => c.id === customer.portraitKey)) return customer.portraitKey
  const pool = castPool(customer, cast)
  if (pool.length === 0) return null
  return pool[hashString(customer.id) % pool.length]?.id ?? null
}
