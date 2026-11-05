/**
 * Browser persistence: IndexedDB autosave of the current career.
 * STUB (M1 foundation) — replaced by the save worker (uses `idb`).
 */
import type { GameState } from '../game/state'

export async function saveCareer(_state: GameState): Promise<void> {}

/** The most recently saved career, or null. */
export async function loadLatestCareer(): Promise<GameState | null> {
  return null
}

export async function deleteCareer(_careerId: string): Promise<void> {}
