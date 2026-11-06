/**
 * M5 endings content (GDD § 12), validated at import: the titles, the epilogue paper and
 * the "what became of them" cards. The game logic that picks from them is src/game/endings/.
 */
import { EndingTitle, EpilogueCard, PaperSection } from '../../game/schema/endings'
import type { TitleId } from '../../game/endings/title'
import { CARDS } from './cards'
import { PAPER_SECTIONS } from './paper'
import { REGULAR_CARDS } from './regularCards'
import { TITLES } from './titles'

export const ENDING_TITLES: Readonly<Record<TitleId, EndingTitle>> = Object.fromEntries(
  Object.entries(TITLES).map(([id, t]) => [id, EndingTitle.parse(t)]),
) as Record<TitleId, EndingTitle>

export const EPILOGUE_PAPER: readonly PaperSection[] = PAPER_SECTIONS.map((s) => PaperSection.parse(s))

// M6: the twenty new regulars' cards come after the M5 ones.
export const EPILOGUE_CARDS: readonly EpilogueCard[] = [...CARDS, ...REGULAR_CARDS].map((c) => EpilogueCard.parse(c))
