/**
 * The police's crime events (M5): kinds and small helpers over `crime.events` (v8).
 * Every police kind starts with `police.`; other systems' events are never touched.
 */
import type { CrimeEvent, GameState } from '../state'

/** Crime event kinds owned by the police (all start with `police.`). */
export const TRAIL = 'police.trail'
export const RAID = 'police.raid'
export const RAIDED = 'police.raided'
export const RECHECK = 'police.recheck'
export const BRING = 'police.bring'

export function addEvent(state: GameState, e: CrimeEvent): GameState {
  return { ...state, crime: { ...state.crime, events: [...state.crime.events, e] } }
}

export function dropEvents(state: GameState, drop: (e: CrimeEvent) => boolean): GameState {
  const events = state.crime.events.filter((e) => !drop(e))
  return events.length === state.crime.events.length ? state : { ...state, crime: { ...state.crime, events } }
}

/** Police events for today of one kind. */
export function eventsToday(state: GameState, kind: string): CrimeEvent[] {
  return state.crime.events.filter((e) => e.kind === kind && e.day === state.calendar.day)
}

