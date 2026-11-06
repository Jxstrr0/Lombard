/**
 * M4 story arcs (GDD §9), validated at import. One file per arc; progress
 * lives in GameState.story. See src/game/schema/story.ts for the format and
 * src/game/story for how beats are picked and played.
 */
import { Arc, type Beat } from '../../game/schema/story'
import laptop from './laptop'
import medals from './medals'
import rolex from './rolex'

export const ARCS: readonly Arc[] = [medals, rolex, laptop].map((raw) => Arc.parse(raw))

const beats = new Map<string, Beat>(ARCS.flatMap((a) => a.beats.map((b) => [b.id, b] as const)))

export function getBeat(id: string): Beat | undefined {
  return beats.get(id)
}
