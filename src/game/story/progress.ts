/** Reading and writing arc progress and regulars' memory (M4). Pure helpers. */
import { tuning } from '../../data/tuning'
import type { BeatRecord, CustomerState, GameState } from '../state'

/** "medals.roof" → "medals". */
export function arcOf(beatId: string): string {
  return beatId.slice(0, beatId.indexOf('.'))
}

export function beatRecord(state: GameState, beatId: string): BeatRecord | undefined {
  return state.story.arcs[arcOf(beatId)]?.beats[beatId]
}

export function recordBeat(state: GameState, beatId: string, record: BeatRecord): GameState {
  const arc = arcOf(beatId)
  const prev = state.story.arcs[arc] ?? { beats: {} }
  return {
    ...state,
    story: { ...state.story, arcs: { ...state.story.arcs, [arc]: { ...prev, beats: { ...prev.beats, [beatId]: record } } } },
  }
}

export function endArc(state: GameState, arc: string): GameState {
  const prev = state.story.arcs[arc] ?? { beats: {} }
  return { ...state, story: { ...state.story, arcs: { ...state.story.arcs, [arc]: { ...prev, ended: true } } } }
}

export const EMPTY_MEMORY: CustomerState = { trust: 0, flags: [], visits: 0, lastDay: 0, nextDay: 0 }

export function memoryOf(state: GameState, regularId: string): CustomerState {
  return state.customers[regularId] ?? EMPTY_MEMORY
}

export function setMemory(state: GameState, regularId: string, patch: Partial<CustomerState>): GameState {
  const prev = memoryOf(state, regularId)
  return { ...state, customers: { ...state.customers, [regularId]: { ...prev, ...patch } } }
}

export function clampTrust(t: number): number {
  return Math.round(Math.min(1, Math.max(-1, t)) * 1000) / 1000
}

export function adjustTrust(state: GameState, regularId: string, delta: number): GameState {
  return setMemory(state, regularId, { trust: clampTrust(memoryOf(state, regularId).trust + delta) })
}

export type Warmth = 'first' | 'warm' | 'cold' | 'again'

export function warmthOf(m: CustomerState): Warmth {
  const r = tuning.regulars
  if (m.visits === 0) return 'first'
  if (m.trust >= r.warmAt) return 'warm'
  if (m.trust <= r.coldAt) return 'cold'
  return 'again'
}
