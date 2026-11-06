/**
 * Ending a career (M5, GDD § 12). Pure.
 *
 * endCareer is the one door out: retiring (from `tuning.endings.retireDay`) and the
 * forced endings (eviction, a police raid, being pushed out by the mob) all call it.
 * It only records how and when; the endings system picks the title, the epilogue and
 * the summary screen from `career.end`, the axes and the rest of the state.
 */
import { tuning } from '../../data/tuning'
import type { CareerEndKind, GameState } from '../state'

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
  return { ...state, career: { ...state.career, end: { kind, day: state.calendar.day } } }
}
