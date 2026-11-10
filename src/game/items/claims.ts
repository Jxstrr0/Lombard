/**
 * Matching an item's story to the person telling it. Item claims are written
 * for anyone, but a few only fit one speaker ("from my first husband"); see
 * src/data/customers/claimSpeakers.ts. When the drawn claim doesn't fit, a
 * fitting one is picked from a forked stream, so no other draw moves.
 */
import { CLAIM_SPEAKERS } from '../../data/customers/claimSpeakers'
import type { Rng } from '../rng'
import type { Gender } from '../schema/cast'
import type { ItemDef } from '../schema/item'

/** Who a claim has to come from, or undefined if anyone can say it. */
export function claimSpeaker(text: string): Gender | undefined {
  return CLAIM_SPEAKERS.find((s) => s.pattern.test(text))?.speaker
}

export function claimFits(text: string, gender: Gender): boolean {
  const who = claimSpeaker(text)
  return who === undefined || who === gender
}

/** `story` if it fits `gender`; otherwise another of the def's claims that does (or `story` if none do). */
export function fitClaim(def: ItemDef, story: string, gender: Gender, rng: Rng): string {
  if (claimFits(story, gender)) return story
  const fits = def.claims.map((c) => c.replaceAll('{name}', def.name)).filter((c) => claimFits(c, gender))
  return fits.length > 0 ? rng.pick(fits) : story
}
