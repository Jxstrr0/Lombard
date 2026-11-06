/**
 * Choosing the ending title (M5, GDD § 12). Pure and deterministic: the same state
 * always gets the same title. No draws.
 *
 * Four axes are read at the end:
 * - wealth: cash + what the stock is really worth + principal lent out;
 * - clean ↔ dirty and heart ↔ hustle: `career.axes` (src/game/endings/axes.ts);
 * - standing: reputation by group (neighbourhood and mob decide titles; the rest
 *   colour the epilogue).
 * Bands are in `tuning.endings.bands`. Titles are checked in order; the first that
 * fits wins. Forced endings (evicted, raided, pushed out) have their own titles,
 * coloured by the axes. Names, straplines and the paper's lead story for each id
 * are authored in src/data/endings/titles.ts.
 */
import { PROTECTION_FLAGS } from '../../data/stories/protection'
import { tuning } from '../../data/tuning'
import { repOf } from '../reputation'
import type { CareerEndKind, GameState, Group } from '../state'

export type TitleId =
  // retired
  | 'front'
  | 'fence'
  | 'gotOutClean'
  | 'smallFry'
  | 'soldOut'
  | 'pillar'
  | 'banker'
  | 'neighbourhood'
  | 'honest'
  | 'hardBargain'
  | 'scrapedBy'
  | 'pawnbroker'
  // evicted
  | 'evictedKind'
  | 'evicted'
  // raided
  | 'raidedClean'
  | 'raidedRich'
  | 'raided'
  // pushed out
  | 'pushedOutStood'
  | 'pushedOut'

export const TITLE_IDS: readonly TitleId[] = [
  'front', 'fence', 'gotOutClean', 'smallFry', 'soldOut', 'pillar', 'banker', 'neighbourhood', 'honest', 'hardBargain', 'scrapedBy', 'pawnbroker',
  'evictedKind', 'evicted', 'raidedClean', 'raidedRich', 'raided', 'pushedOutStood', 'pushedOut',
]

/** Which ending kind each title belongs to. */
export const TITLE_KIND: Readonly<Record<TitleId, CareerEndKind>> = {
  front: 'retired', fence: 'retired', gotOutClean: 'retired', smallFry: 'retired', soldOut: 'retired', pillar: 'retired',
  banker: 'retired', neighbourhood: 'retired', honest: 'retired', hardBargain: 'retired', scrapedBy: 'retired', pawnbroker: 'retired',
  evictedKind: 'evicted', evicted: 'evicted',
  raidedClean: 'raided', raidedRich: 'raided', raided: 'raided',
  pushedOutStood: 'pushedOut', pushedOut: 'pushedOut',
}

export function isTitleId(v: unknown): v is TitleId {
  return typeof v === 'string' && v in TITLE_KIND
}

/** The four axes as the ending reads them. */
export interface EndingAxes {
  wealth: number
  clean: number
  heart: number
  standing: Record<Group, number>
}

/** Cash + what the stock is really worth + principal lent out. */
export function wealthOf(state: GameState): number {
  const stock = state.inventory.reduce((a, i) => a + i.trueValue, 0)
  const lent = state.loans.reduce((a, l) => a + l.principal, 0)
  return Math.round(state.cash + stock + lent)
}

export function endingAxes(state: GameState): EndingAxes {
  return {
    wealth: wealthOf(state),
    clean: state.career.axes.clean,
    heart: state.career.axes.heart,
    standing: {
      neighbourhood: repOf(state, 'neighbourhood'),
      youth: repOf(state, 'youth'),
      police: repOf(state, 'police'),
      mob: repOf(state, 'mob'),
      specialists: repOf(state, 'specialists'),
    },
  }
}

export type Band = 'poor' | 'comfortable' | 'rich' | 'clean' | 'dirty' | 'warm' | 'cold' | 'loved' | 'shunned' | 'watched'

/** Which of tuning.endings.bands the career sits in (poor = under `modest`; watched = heat over `coolHeat`). */
export function bandsOf(state: GameState): Record<Band, boolean> {
  const B = tuning.endings.bands
  const a = endingAxes(state)
  return {
    poor: a.wealth < B.wealth.modest,
    comfortable: a.wealth >= B.wealth.comfortable,
    rich: a.wealth >= B.wealth.rich,
    clean: a.clean >= B.clean.clean,
    dirty: a.clean <= B.clean.dirty,
    warm: a.heart >= B.heart.warm,
    cold: a.heart <= B.heart.cold,
    loved: a.standing.neighbourhood >= B.standing.loved,
    shunned: a.standing.neighbourhood < B.standing.shunned,
    watched: state.crime.heat > B.coolHeat,
  }
}

/** The title for a career that ended (or would end) this way. */
export function pickTitle(state: GameState, kind: CareerEndKind): TitleId {
  const B = tuning.endings.bands
  const a = endingAxes(state)
  const { rich, comfortable, clean, dirty, warm, cold, loved, shunned, watched, poor } = bandsOf(state)
  const flags = state.story.flags
  const paying = flags.includes(PROTECTION_FLAGS.paying)
  const inTrade = state.crime.fence.deals >= B.fenceDeals

  switch (kind) {
    case 'evicted':
      return warm && loved ? 'evictedKind' : 'evicted'
    case 'raided':
      if (clean) return 'raidedClean'
      return dirty && rich ? 'raidedRich' : 'raided'
    case 'pushedOut':
      return flags.includes(PROTECTION_FLAGS.refused) || a.standing.mob < 0 ? 'pushedOutStood' : 'pushedOut'
    case 'retired':
      break
  }
  if (paying && a.standing.mob >= B.standing.owned) return 'front'
  if (dirty) {
    if (rich && (watched || inTrade)) return 'fence'
    if (comfortable && !watched) return 'gotOutClean'
    return 'smallFry'
  }
  if (rich) {
    if (cold || shunned) return 'soldOut'
    if (warm && loved) return 'pillar'
    return 'banker'
  }
  if (warm && loved) return 'neighbourhood'
  if (cold) return 'hardBargain'
  if (poor) return 'scrapedBy'
  if (clean && a.heart >= 0) return 'honest'
  return 'pawnbroker'
}

/** The career's title: the one recorded when it ended, or (for a state that hasn't recorded one) picked now. */
export function titleOf(state: GameState): TitleId | null {
  const end = state.career.end
  if (!end) return null
  return isTitleId(end.title) ? end.title : pickTitle(state, end.kind)
}
