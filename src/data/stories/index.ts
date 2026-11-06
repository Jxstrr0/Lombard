/**
 * M4 story arcs (GDD §9), validated at import. One file per arc; progress
 * lives in GameState.story. See src/game/schema/story.ts for the format and
 * src/game/story for how beats are picked and played.
 */
import { Arc, type Beat } from '../../game/schema/story'
import collector from './collector'
import fence from './fence'
import flood, { floodTalk } from './flood'
import laptop from './laptop'
import medals from './medals'
import protection from './protection'
import rolex from './rolex'
import volkova from './volkova'
// M4 specialists' small arcs (GDD § 2b), one per specialist.
import faina from './faina'
import gennady from './gennady'
import ilya from './ilya'
import stanislav from './stanislav'
import zhenya from './zhenya'

const SPECIALIST_ARCS = [faina, ilya, gennady, stanislav, zhenya]

// M6 the Flood: its own beats first (a city event; it gets a beat slot on its few days before the
// others), what people say about it afterwards last.
export const ARCS: readonly Arc[] = [flood, medals, rolex, laptop, ...SPECIALIST_ARCS, protection, fence, collector, volkova, floodTalk].map((raw) => Arc.parse(raw))

const beats = new Map<string, Beat>(ARCS.flatMap((a) => a.beats.map((b) => [b.id, b] as const)))

export function getBeat(id: string): Beat | undefined {
  return beats.get(id)
}
