/** All item definitions, validated against the zod schema at import time. */
import { ItemDefFile, type ItemDef } from '../../game/schema/item'
import cameras from './cameras.json'
import coins from './coins.json'
import electronics from './electronics.json'
import gold from './gold.json'
import icons from './icons.json'
import media from './media.json'
import militaria from './militaria.json'
import phones from './phones.json'
import watches from './watches.json'

/** Raw JSON per category file, in spawn-table order (tests validate these directly). */
export const RAW_ITEM_FILES: Readonly<Record<string, readonly unknown[]>> = { gold, watches, phones, cameras, militaria, coins, electronics, icons, media }

export const ITEM_DEFS: readonly ItemDef[] = Object.values(RAW_ITEM_FILES)
  .flat()
  .map((raw) => ItemDefFile.element.parse(raw))

/** What walk-ins, the bulletin and the fence draw from: everything but story-only pieces (M5). */
export const SPAWN_DEFS: readonly ItemDef[] = ITEM_DEFS.filter((d) => !d.storyOnly)

const byId = new Map(ITEM_DEFS.map((d) => [d.id, d]))

export function getItemDef(id: string): ItemDef {
  const def = byId.get(id)
  if (!def) throw new Error(`Unknown item def: ${id}`)
  return def
}
