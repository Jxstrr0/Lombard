/**
 * Ending a career (M5, GDD § 12). Pure.
 *
 * endCareer is the one door out: retiring (from `tuning.endings.retireDay`) and the
 * forced endings (eviction, a police raid, being pushed out by the mob) all call it.
 * It records how and when, and the title the endings system picks from the state as
 * it is at that moment (src/game/endings/title.ts), so the title never shifts later.
 * The epilogue and summary screen are built from `career.end` and the rest of the state
 * (src/game/endings/epilogue.ts). Once a career has ended, the reducer refuses every
 * action that would play it on.
 */
import { tuning } from '../../data/tuning'
import type { CareerEndKind, GameState } from '../state'
import { pickTitle } from './title'

export function canRetire(state: GameState): boolean {
  return !state.career.end && state.calendar.day >= tuning.endings.retireDay
}

export function isOver(state: GameState): boolean {
  return state.career.end !== null
}

/** Record the end of the career. The first ending wins; later calls change nothing. */
export function endCareer(state: GameState, kind: CareerEndKind): GameState {
  if (state.career.end) return state
  if (kind === 'retired' && !canRetire(state)) return state
  const end = { kind, day: state.calendar.day, title: pickTitle(state, kind) }
  return { ...state, career: { ...state.career, end } }
}

/**
 * Days the shop ran: the days it opened its doors. An ending found at closing (eviction,
 * retiring from the ledger) comes after the calendar has turned to a day that never opened.
 */
export function daysRun(state: GameState): number {
  const end = state.career.end
  const day = end?.day ?? state.calendar.day
  return Math.max(0, state.day.phase === 'closed' ? day - 1 : day)
}
