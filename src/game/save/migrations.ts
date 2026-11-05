/**
 * Save migrations: an ordered list, one per schema-changing version.
 * STUB (M1 foundation) — replaced by the save worker.
 */
import { STATE_VERSION, type GameState } from '../state'

export const CURRENT_VERSION = STATE_VERSION

export class SaveFormatError extends Error {}

/** Bring any older saved state up to CURRENT_VERSION. Throws SaveFormatError on garbage. */
export function migrate(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) throw new SaveFormatError('Save is not an object')
  const state = raw as GameState
  if (state.meta?.version !== CURRENT_VERSION) throw new SaveFormatError(`Unsupported save version ${String(state.meta?.version)}`)
  return state
}
