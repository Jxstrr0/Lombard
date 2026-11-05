/**
 * Which tools the player can use right now, and what using one costs
 * (owner: economy worker).
 *
 * Contract (the reducer and the inspect UI call these):
 *   availableTools(state, def) → ToolAvailability[] in toolbar order. Includes
 *       locked tools the player has seen of (with `reason`) so the UI can grey them out.
 *   payForTool(state, tool, def) → state with the cost applied (acid charge, specialist
 *       call or per-call fee), or null if the tool can't be used now.
 *   toolExtras(state, def) → extra context passed to useTool (reference tier, specialist).
 *
 * Stubs: loupe, scale, magnet only, free.
 */
import { M1_TOOLS, type ItemDef, type ToolId } from '../schema/item'
import type { GameState } from '../state'
import type { ToolExtras } from './tools'

export interface ToolAvailability {
  tool: ToolId
  usable: boolean
  /** Why it is locked or what it costs, for the button sub-label (e.g. "3 left", "no retainer"). */
  note?: string
}

export function availableTools(_state: GameState, _def: ItemDef): ToolAvailability[] {
  return M1_TOOLS.map((tool) => ({ tool, usable: true }))
}

export function payForTool(state: GameState, tool: ToolId, _def: ItemDef): GameState | null {
  return M1_TOOLS.includes(tool) ? state : null
}

export function toolExtras(_state: GameState, _def: ItemDef): ToolExtras {
  return { refTier: 0 }
}
