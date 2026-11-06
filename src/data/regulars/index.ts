/**
 * M4 regulars: authored recurring customers (GDD §5), validated at import.
 * One file per person; their memory of you is GameState.customers[id].
 * Fictional people. Their arcs, if any, live in src/data/stories.
 *
 * Ordinary regulars (no arc of their own) are paced so a 30-day career meets
 * most of them two to four times and the weekly ones (Valentin, Yevstafy,
 * Margarita) about four; tests/regulars.test.ts checks it. See docs/05.
 */
import { RegularDef } from '../../game/schema/story'
import alisa from './alisa'
import darya from './darya'
import eduard from './eduard'
import gleb from './gleb'
import inessa from './inessa'
import lyusya from './lyusya'
import margarita from './margarita'
import mikhail from './mikhail'
import nika from './nika'
import rimma from './rimma'
import ruslan from './ruslan'
import timofei from './timofei'
import ulyana from './ulyana'
import valentin from './valentin'
import yana from './yana'
import yevstafy from './yevstafy'
import zhora from './zhora'
import zinaida from './zinaida'

export const REGULARS: readonly RegularDef[] = [
  zinaida,
  // Pensioner, students, tradespeople, office, hustler, sailors.
  valentin,
  alisa,
  darya,
  yana,
  lyusya,
  rimma,
  ruslan,
  inessa,
  nika,
  gleb,
  timofei,
  margarita,
  ulyana,
  yevstafy,
  mikhail,
  // Arc-only (Protection): no ordinary visits.
  eduard,
  zhora,
].map((raw) => RegularDef.parse(raw))

const byId = new Map(REGULARS.map((r) => [r.id, r]))

export function getRegular(id: string): RegularDef | undefined {
  return byId.get(id)
}
