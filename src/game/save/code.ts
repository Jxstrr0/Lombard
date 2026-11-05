/**
 * Save code: "LMB1." + base64url(deflate(JSON)) + "." + checksum.
 * STUB (M1 foundation) — replaced by the save worker.
 */
import type { GameState } from '../state'
import { migrate } from './migrations'

export class SaveCodeError extends Error {}

export function encodeSaveCode(state: GameState): string {
  return `LMB1.${btoa(encodeURIComponent(JSON.stringify(state)))}`
}

export function decodeSaveCode(code: string): GameState {
  const body = code.trim().replace(/^LMB1\./, '')
  try {
    return migrate(JSON.parse(decodeURIComponent(atob(body))))
  } catch (err) {
    throw new SaveCodeError(`That save code could not be read (${(err as Error).message})`)
  }
}
