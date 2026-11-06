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
  /**
   * Ground speed of the glb's in-place `walk` clip, m/s (written by art/customers/build.py
   * from the clip's root motion). Move the customer at this speed while it plays and the
   * planted foot stays put; scale the clip's timeScale with any other speed.
   */
  walkSpeed: z.number().positive(),
  /**
   * A look kept for an authored regular (M4, src/data/regulars): never given to a random
   * walk-in, so a regular's face only ever belongs to that regular. Absent = walk-in cast.
   */
  regular: z.literal(true).optional(),
  /**
   * M6: a look kept for the hired appraiser (src/data/appraiser.ts): like `regular`, never given to
   * a walk-in, and never to a regular either.
   */
  staff: z.literal(true).optional(),
  /** Who this looks like, for casting by description: age band, gender, build, clothes, hair. */
  note: z.string().min(1),
})
export type CastEntry = z.infer<typeof CastEntry>
