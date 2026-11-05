/** Zod schema for the customer cast (src/data/customers/cast.json). */
import { z } from 'zod'

export const Gender = z.enum(['m', 'f'])
export type Gender = z.infer<typeof Gender>

export const CastEntry = z.object({
  /** File name of `public/assets/customers/<id>.glb`. */
  id: z.string().regex(/^[a-z0-9_]{1,64}$/),
  /** Folder in the Microsoft Rocketbox repository the avatar is built from (art/customers/build.py). */
  source: z.string().min(1),
  gender: Gender,
  /** Walk-in archetype id (src/data/customers/walkins.ts) this person can turn up as. */
  archetype: z.string().min(1),
})
export type CastEntry = z.infer<typeof CastEntry>
