/** All item definitions, validated against the zod schema at import time. */
import { ItemDefFile, type ItemDef } from '../../game/schema/item'
import gold from './gold.json'
import phones from './phones.json'
import watches from './watches.json'

export const ITEM_DEFS: readonly ItemDef[] = [...gold, ...watches, ...phones].map((raw) => ItemDefFile.element.parse(raw))

const byId = new Map(ITEM_DEFS.map((d) => [d.id, d]))

export function getItemDef(id: string): ItemDef {
  const def = byId.get(id)
  if (!def) throw new Error(`Unknown item def: ${id}`)
  return def
}
