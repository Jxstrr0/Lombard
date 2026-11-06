/** Formatting for pawn-loan screens (offer in pawn mode, redeem, ledger loans). Pure, no DOM; built on ui/format.ts. */
import { addDays, type GameState } from '../game/state'
import { shortDay } from './format'

export { daysLabel, monthlyRateLabel } from './format'

/** Calendar day number → "Thu 2 Apr", relative to today's calendar. */
export function dayLabel(state: GameState, day: number): string {
  return shortDay(addDays(state.calendar.date, day - state.calendar.day))
}
