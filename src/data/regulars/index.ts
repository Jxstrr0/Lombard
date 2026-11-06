/**
 * M4 regulars (M6: forty): authored recurring customers (GDD §5), validated at import.
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
import edik from './edik'
import fedya from './fedya'
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
// M6: twenty more, each with a small thread (src/data/stories/threads).
import artur from './artur'
import bakhtiyor from './bakhtiyor'
import dilnoza from './dilnoza'
import jamshid from './jamshid'
import patimat from './patimat'
import snezhana from './snezhana'
import kira from './kira'
import alyona from './alyona'
import grisha from './grisha'
import vitya from './vitya'
import prokhor from './prokhor'
import zakhar from './zakhar'
import ernest from './ernest'
import styopa from './styopa'
import klava from './klava'
import elvira from './elvira'
import zhanna from './zhanna'
import nonna from './nonna'
import zoya from './zoya'
import lera from './lera'

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
  // Arc people: Edik (The Dubai Rolex Guy) visits on his own only from day 45; Fedya (The Student's Laptop) comes in only for his arc.
  edik,
  fedya,
  // Arc-only (Protection): no ordinary visits.
  eduard,
  zhora,
  // M6: twenty more regulars, each with a small thread (src/data/stories/threads). They start
  // later (day 11 to 40) and come less often, so the first month still belongs to the first twenty.
  artur,
  bakhtiyor,
  dilnoza,
  jamshid,
  patimat,
  snezhana,
  kira,
  alyona,
  grisha,
  vitya,
  prokhor,
  zakhar,
  ernest,
  styopa,
  klava,
  elvira,
  zhanna,
  nonna,
  zoya,
  lera,
].map((raw) => RegularDef.parse(raw))

const byId = new Map(REGULARS.map((r) => [r.id, r]))

export function getRegular(id: string): RegularDef | undefined {
  return byId.get(id)
}
