/** Formatting for pawn-loan screens (offer in pawn mode, redeem, ledger loans). Pure, no DOM. */
import { addDays, weekdayOf, type GameState } from '../game/state'

const SHORT_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Calendar day number → "Thu 2 Apr", relative to today's calendar. */
export function dayLabel(state: GameState, day: number): string {
  const iso = addDays(state.calendar.date, day - state.calendar.day)
  const d = new Date(`${iso}T00:00:00Z`)
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${SHORT_WEEKDAYS[weekdayOf(iso)]} ${d.getUTCDate()} ${month}`
}

/** 0.1 → "10% a month" */
export function monthlyRateLabel(rate: number): string {
  return `${Math.round(rate * 1000) / 10}% a month`
}

/** 1 → "1 day", 5 → "5 days" */
export function daysLabel(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`
}
