/**
 * Tool application → findings.
 * STUB (M1 foundation) — replaced by the items worker.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { ItemDef, ToolId } from '../schema/item'
import type { Finding, ItemInstance } from '../types'

export interface UseToolInput {
  item: ItemInstance
  def: ItemDef
  tool: ToolId
  hotspot?: string
  /** Findings already on this visit (for repeat-use logic and unique ids). */
  previous: readonly Finding[]
  /** How many times this tool was already used on this visit. */
  uses: number
  rng: Rng
}

export interface UseToolResult {
  /** New findings produced by this use (may be a single "nothing notable"). */
  findings: Finding[]
  /** In-game seconds the use took. */
  seconds: number
}

export function useTool(input: UseToolInput): UseToolResult {
  const { tool, previous } = input
  return {
    findings: [{ id: `f${previous.length + 1}`, tool, text: `You use the ${tool}. Nothing notable.`, polarity: 'neutral' }],
    seconds: tuning.inspect.toolSeconds[tool],
  }
}
