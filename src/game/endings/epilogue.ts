/**
 * The ending sequence's content (M5, GDD § 12). Pure and deterministic: built from
 * `career.end` and the rest of the state, no draws.
 *
 *   1. The epilogue paper: the morning paper's format (src/data/news.ts), the title's own
 *      lead story, then one story per section of src/data/endings/paper.ts.
 *   2. One card per major regular and arc character met, specialist kept on, and Volkova and
 *      the fence if met (src/data/endings/cards.ts), each saying what became of them.
 *   3. The career summary: days run, best deal, worst mistake, people helped and hurt, the title.
 */
import { EPILOGUE_CARDS, EPILOGUE_PAPER, ENDING_TITLES } from '../../data/endings'
import type { EndingCondition } from '../schema/endings'
import type { GameState } from '../state'
import { holds } from '../story/conditions'
import { daysRun } from './end'
import { bandsOf, endingAxes, pickTitle, titleOf, wealthOf, type TitleId } from './title'

export interface EpilogueStory {
  id: string
  headline: string
  body: string
}

export interface EpilogueCardView {
  id: string
  name: string
  role: string
  text: string
}

export interface CareerSummary {
  shopName: string
  title: TitleId
  titleName: string
  strap: string
  kind: NonNullable<GameState['career']['end']>['kind']
  daysRun: number
  /** The calendar date the career ended (ISO). */
  endDate: string
  bestDeal: number
  /** Biggest loss on a single item (positive ₽, 0 = none). */
  worstDeal: number
  fakesBought: number
  peopleHelped: number
  peopleHurt: number
  wealth: number
}

export interface Epilogue {
  paper: EpilogueStory[]
  cards: EpilogueCardView[]
  summary: CareerSummary
}

const within = (x: number, c: { gte?: number; lte?: number } | undefined) => !c || ((c.gte === undefined || x >= c.gte) && (c.lte === undefined || x <= c.lte))

function hired(state: GameState, id: string): boolean {
  const s = state.specialists[id]
  return !!s && (s.retained || s.months > 0 || s.sinceDay > 0 || !!s.retired)
}

export function endingHolds(c: EndingCondition, state: GameState): boolean {
  const end = state.career.end
  switch (c.if) {
    case 'ending':
      return !!end && c.kind.includes(end.kind)
    case 'title': {
      const t = titleOf(state)
      return !!t && c.is.includes(t)
    }
    case 'band':
      return bandsOf(state)[c.is] !== (c.not ?? false)
    case 'axis': {
      const a = endingAxes(state)
      return within(c.axis === 'wealth' ? a.wealth : a[c.axis], c)
    }
    case 'met':
      return (state.customers[c.who]?.visits ?? 0) > 0
    case 'hired':
      return hired(state, c.id) && (c.retired === undefined || !!state.specialists[c.id]?.retired === c.retired)
    case 'stat':
      return within(state.stats[c.stat] ?? 0, c)
    default:
      return holds(c, state)
  }
}

export function allEndingHold(cs: readonly EndingCondition[], state: GameState): boolean {
  return cs.every((c) => endingHolds(c, state))
}

const fill = (s: string, state: GameState) => s.replaceAll('{shop}', state.shop.name)

export function epiloguePaper(state: GameState): EpilogueStory[] {
  const title = titleOf(state)
  if (!title) return []
  const t = ENDING_TITLES[title]
  const lead: EpilogueStory = { id: `title_${title}`, headline: fill(t.headline, state), body: fill(t.body, state) }
  const rest: EpilogueStory[] = []
  for (const section of EPILOGUE_PAPER) {
    const story = section.stories.find((s) => allEndingHold(s.when, state))
    if (story) rest.push({ id: story.id, headline: fill(story.headline, state), body: fill(story.body, state) })
  }
  return [lead, ...rest]
}

export function epilogueCards(state: GameState): EpilogueCardView[] {
  const out: EpilogueCardView[] = []
  for (const card of EPILOGUE_CARDS) {
    if (!allEndingHold(card.show, state)) continue
    const v = card.variants.find((x) => allEndingHold(x.when, state)) ?? card.variants[card.variants.length - 1]!
    out.push({ id: card.id, name: card.name, role: card.role, text: fill(v.text, state) })
  }
  return out
}

export function careerSummary(state: GameState): CareerSummary | null {
  const end = state.career.end
  if (!end) return null
  const title = titleOf(state) ?? pickTitle(state, end.kind)
  const t = ENDING_TITLES[title]
  return {
    shopName: state.shop.name,
    title,
    titleName: t.name,
    strap: fill(t.strap, state),
    kind: end.kind,
    daysRun: daysRun(state),
    endDate: state.calendar.date,
    bestDeal: Math.max(0, state.stats.bestDeal),
    worstDeal: Math.abs(Math.min(0, state.stats.worstDeal)),
    fakesBought: state.stats.fakesBought,
    peopleHelped: state.stats.peopleHelped,
    peopleHurt: state.stats.peopleHurt,
    wealth: wealthOf(state),
  }
}

export function epilogueOf(state: GameState): Epilogue | null {
  const summary = careerSummary(state)
  if (!summary) return null
  return { paper: epiloguePaper(state), cards: epilogueCards(state), summary }
}
