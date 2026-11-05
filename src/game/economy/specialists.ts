/**
 * Specialist retainers (owner: economy worker). GDD § 2b. M2: jeweler and
 * watchmaker. Definitions (name, categories, hidden accuracy/honesty, fee,
 * calls per month, per-call fee, lines) live in src/data/specialists.ts.
 *
 * Contract: retainSpecialist(state, id) → state; releaseSpecialist(state, id) → state.
 * Closed phase only. The first month's retainer is charged on retaining.
 *
 * Stubs: no-ops.
 */
import type { GameState } from '../state'

export function retainSpecialist(state: GameState, _id: string): GameState {
  return state
}

export function releaseSpecialist(state: GameState, _id: string): GameState {
  return state
}
