/**
 * The two hidden crime dials (M5, GDD § 8). Pure.
 *
 * Heat is police attention, pressure is the mob's. Both start at 0 ("nobody has
 * noticed you") and never go below it. Every system moves them through these two
 * functions (story effects included), so a later rule (decay, caps, the ledger's
 * trend) lives in one place. `_reason` documents the call site, like adjustRep's.
 */
import type { GameState } from '../state'

const round = (v: number) => Math.round(v * 1000) / 1000

export function addHeat(state: GameState, delta: number, _reason?: string): GameState {
  if (delta === 0) return state
  return { ...state, crime: { ...state.crime, heat: round(Math.max(0, state.crime.heat + delta)) } }
}

export function addPressure(state: GameState, delta: number, _reason?: string): GameState {
  if (delta === 0) return state
  return { ...state, crime: { ...state.crime, pressure: round(Math.max(0, state.crime.pressure + delta)) } }
}
