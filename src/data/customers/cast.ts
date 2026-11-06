/**
 * The 3D customer cast (M3): Microsoft Rocketbox avatars built into
 * `public/assets/customers/<id>.glb` by art/customers/build.py from cast.json.
 * Each walk-in is played by one of these, matched on archetype and on the
 * gender of their first name (see src/game/customers/look.ts).
 */
import raw from './cast.json'
import { CastEntry } from '../../game/schema/cast'

export const CAST: readonly CastEntry[] = CastEntry.array().parse(raw)
