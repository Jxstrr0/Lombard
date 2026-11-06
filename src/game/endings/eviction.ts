/**
 * Eviction, the broke ending (M5, GDD § 7 and § 12). Pure.
 *
 * Checked on rent night only (the last day of each calendar month, at closing, after
 * the bills are on the ledger), so it is a slow slide you can see coming, never a
 * surprise mid-day:
 *
 *   1. Closing cash under `tuning.endings.eviction.line` → the landlord's final notice
 *      (a NOTE on tonight's ledger; `landlord.notice` is set in story flags, so no save
 *      shape change). The ledger keeps reminding you while it stands.
 *   2. At the next rent night: back above the line → the notice is withdrawn (a NOTE);
 *      still under, and still under even counting what the stock would fetch from the
 *      dealer (`eviction.stockShare`) → evicted, and the reducer ends the career. Under on
 *      cash but with stock to sell → the notice stands (a NOTE) until a rent night settles it.
 *
 * Cash may go negative between rent nights (GDD § 7); only the two rent nights count.
 * The landlord, Semyon Markovich, is a typed letter and a phone call (lines in
 * src/data/endings/landlord.ts).
 */
import { LANDLORD } from '../../data/endings/landlord'
import { tuning } from '../../data/tuning'
import { isMonthEnd, monthName } from '../economy/expenses'
import { addDays, type GameState } from '../state'

export const NOTICE_FLAG = 'landlord.notice'

export function hasNotice(state: GameState): boolean {
  return state.story.flags.includes(NOTICE_FLAG)
}

/**
 * Tonight's rent-night verdict. Call at closing, after chargeExpenses and before the
 * calendar turns (`calendar.date` is the day being closed). Gives or withdraws the
 * notice (with its ledger line), or says the shop is evicted: the reducer then ends
 * the career once the calendar has turned, like retiring from the ledger, so
 * `career.end.day` is the day that never opened.
 */
export function checkEviction(state: GameState): { state: GameState; evicted: boolean } {
  const date = state.calendar.date
  if (state.career.end || !isMonthEnd(date)) return { state, evicted: false }
  const E = tuning.endings.eviction
  const under = state.cash < E.line
  const notice = hasNotice(state)
  if (under && notice) {
    const stock = state.inventory.reduce((a, i) => a + i.trueValue * E.stockShare, 0)
    if (state.cash + stock < E.line) return { state: note(state, LANDLORD.evicted), evicted: true }
    return { state: note(state, LANDLORD.stands), evicted: false }
  }
  if (under) {
    const flagged = { ...state, story: { ...state.story, flags: [...state.story.flags, NOTICE_FLAG] } }
    return { state: note(flagged, LANDLORD.notice.replace('{month}', monthName(addDays(date, 1)))), evicted: false }
  }
  if (notice) {
    const cleared = { ...state, story: { ...state.story, flags: state.story.flags.filter((f) => f !== NOTICE_FLAG) } }
    return { state: note(cleared, LANDLORD.withdrawn), evicted: false }
  }
  return { state, evicted: false }
}

function note(state: GameState, text: string): GameState {
  return { ...state, day: { ...state.day, log: [...state.day.log, { kind: 'story', amount: 0, text }] } }
}
