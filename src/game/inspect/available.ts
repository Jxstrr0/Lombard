/**
 * Which tools the player can use right now, and what using one costs
 * (owner: economy worker).
 *
 * Contract (the reducer and the inspect UI call these):
 *   availableTools(state, def) → ToolAvailability[] in toolbar order. Includes
 *       locked tools the player has seen of (with `note`) so the UI can grey them out.
 *   payForTool(state, tool, def) → state with the cost applied (acid charge, specialist
 *       call or per-call fee), or null if the tool can't be used now.
 *   toolExtras(state, def) → extra context passed to useTool (reference tier, specialist).
 *
 * Toolbar: loupe, scale, magnet (always), acid kit, reference book, specialist call.
 * The acid kit, the book and the specialist each give one answer per item: once used
 * on this visit they show as done and refuse again (a second scratch or call would
 * cost a charge or a call for nothing new).
 */
import { tuning } from '../../data/tuning'
import { referenceBook } from '../../data/upgrades'
import { getSpecialist } from '../../data/specialists'
import { chargeExpense } from '../economy/charge'
import { callsLeft, coversCategory, specialistFor } from '../economy/specialists'
import { hasUpgrade, refTier, toolUpgrade } from '../economy/upgrades'
import { M1_TOOLS, type ItemDef, type ToolId } from '../schema/item'
import type { GameState } from '../state'
import { specialistCallSeconds, type ToolExtras } from './tools'

export interface ToolAvailability {
  tool: ToolId
  usable: boolean
  /** Why it is locked or what it costs, for the button sub-label (e.g. "3 left", "no retainer"). */
  note?: string
  /** Seconds a use takes, if not tuning.inspect.toolSeconds[tool] (each specialist's own call time). */
  seconds?: number
}

export const TOOLBAR: readonly ToolId[] = [...M1_TOOLS, 'acid', 'reference', 'specialist']

const rub = (n: number) => `${Math.round(n).toLocaleString('en-US')} ₽`

function usedThisVisit(state: GameState, tool: ToolId): boolean {
  return (state.inspect?.toolUses[tool] ?? 0) > 0
}

export function toolAvailability(state: GameState, tool: ToolId, def: ItemDef): ToolAvailability {
  switch (tool) {
    case 'acid': {
      const kit = toolUpgrade('acid')
      if (!kit || !hasUpgrade(state, kit.id)) return { tool, usable: false, note: 'no kit' }
      const cats = kit.effects.toolCategories
      if (cats && !cats.includes(def.category)) return { tool, usable: false, note: 'gold & coins' }
      if (usedThisVisit(state, tool)) return { tool, usable: false, note: 'tested' }
      if (state.shop.acidCharges <= 0) return { tool, usable: false, note: 'empty' }
      return { tool, usable: true, note: `${state.shop.acidCharges} left` }
    }
    case 'reference': {
      if (usedThisVisit(state, tool)) return { tool, usable: false, note: 'read' }
      return { tool, usable: true, note: referenceBook(refTier(state)).short }
    }
    case 'specialist': {
      const id = specialistFor(state, def)
      if (!id) return { tool, usable: false, note: coversCategory(def) ? 'no retainer' : 'nobody' }
      if (usedThisVisit(state, tool)) return { tool, usable: false, note: 'called' }
      const seconds = specialistCallSeconds(id)
      const left = callsLeft(state, id)
      if (left > 0) return { tool, usable: true, note: `${left} left`, seconds }
      const fee = tuning.specialists.roster[id]!.perCall
      if (state.cash < fee) return { tool, usable: false, note: `${rub(fee)} fee` }
      return { tool, usable: true, note: rub(fee), seconds }
    }
    default:
      return M1_TOOLS.includes(tool) ? { tool, usable: true } : { tool, usable: false, note: 'later' }
  }
}

export function availableTools(state: GameState, def: ItemDef): ToolAvailability[] {
  return TOOLBAR.map((tool) => toolAvailability(state, tool, def))
}

export function payForTool(state: GameState, tool: ToolId, def: ItemDef): GameState | null {
  if (!toolAvailability(state, tool, def).usable) return null
  if (tool === 'acid') return { ...state, shop: { ...state.shop, acidCharges: state.shop.acidCharges - 1 } }
  if (tool === 'specialist') {
    const id = specialistFor(state, def)!
    const sp = state.specialists[id]!
    const paid = callsLeft(state, id) > 0 ? state : chargeExpense(state, tuning.specialists.roster[id]!.perCall, `Extra call to ${getSpecialist(id)?.name ?? id}`)
    return { ...paid, specialists: { ...paid.specialists, [id]: { ...sp, callsUsed: sp.callsUsed + 1 } } }
  }
  return state
}

export function toolExtras(state: GameState, def: ItemDef): ToolExtras {
  const id = specialistFor(state, def)
  const extras: ToolExtras = { refTier: refTier(state) }
  if (id) extras.specialist = { id, relationship: state.specialists[id]!.relationship }
  return extras
}
