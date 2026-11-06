/**
 * M4 regulars: authored recurring customers (GDD §5), validated at import.
 * One file per person; their memory of you is GameState.customers[id].
 * Fictional people. Their arcs, if any, live in src/data/stories.
 */
import { RegularDef } from '../../game/schema/story'
import eduard from './eduard'
import zhora from './zhora'
import zinaida from './zinaida'

export const REGULARS: readonly RegularDef[] = [zinaida, eduard, zhora].map((raw) => RegularDef.parse(raw))

const byId = new Map(REGULARS.map((r) => [r.id, r]))

export function getRegular(id: string): RegularDef | undefined {
  return byId.get(id)
}
