/**
 * M6: the twenty new regulars' small threads (src/data/regulars, M6 section). Appended after
 * the M4/M5 arcs in src/data/stories/index.ts, so the older arcs keep first claim on a day's
 * beat slots (plan.ts walks ARCS in order).
 */
import { artur, bakhtiyor, dilnoza, jamshid, patimat } from './people1'
import { alyona, grisha, kira, snezhana, vitya } from './people2'
import { elvira, ernest, klava, lera, nonna, prokhor, styopa, zakhar, zhanna, zoya } from './people3'

export const THREADS = [
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
] as const
