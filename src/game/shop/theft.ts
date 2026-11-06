/**
 * Shoplifting (M4; GDD § 6 "Shrinkage"). Cheap things on open shelves walk out.
 *
 * Contract: rollShoplifting(state) → { state, stolen }, called by the reducer at day
 * close (once per open day, from day tuning.theft.fromDay) before the day summary. theftChance(state, item, area) for
 * tests and UI hints.
 *
 * Per displayed item, one seeded draw from a stream forked off the day's RNG state
 * (`theft:<day>`), so thefts never shift any other system's draws:
 *   chance = base × exposure[area] × cheapness(trueValue) × traffic × youth × security
 * - exposure: the counter case is behind glass (0); areas a protecting upgrade covers
 *   (the lockable wall case) are 0 too; the back shelf is out of the way (0.6).
 * - cheapness: 1 for small cheap things (≤ cheapFull ₽), fading to 0 at cheapMax.
 * - traffic: people through the door today / trafficBaseline, clamped.
 * - youth: theftRepFactor (good standing with the local kids lowers it).
 * - security: 1 / (1 + shop.security × perSecurity), from the mirror, chime, camera, counter case.
 * - M5 Protection: a bricked counter case is open until the glazier comes
 *   (tuning.protection.brick.openExposure), and a shop that pays the crew loses
 *   less (× tuning.protection.paidTheftScale).
 * Capped at maxChance. A stolen item leaves inventory, display, tags and `paid`, and
 * gets a 'theft' ledger entry; career stats count it. When a draw would have been a
 * theft without the security factor, the strongest deterrent you own gets one
 * 'deterred' note that night, so security is felt, not just bought.
 * Numbers: tuning.theft. Lines: src/data/theftLines.ts.
 */
import { getItemDef } from '../../data/items'
import { theftLines, theftWhere } from '../../data/theftLines'
import { tuning } from '../../data/tuning'
import { getUpgrade } from '../../data/upgrades'
import { PROTECTION_FLAGS } from '../../data/stories/protection'
import { caseBroken } from '../crime/vandalism'
import { protectedAreas } from '../economy/upgrades'
import { theftRepFactor } from '../reputation'
import { Rng } from '../rng'
import { shortName } from '../sell/buyer'
import type { GameState, SlotArea } from '../state'
import type { ItemInstance, LedgerEntry } from '../types'
import { clearItem, displayed } from './display'

const T = tuning.theft

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function cheapness(value: number): number {
  if (value <= T.cheapFull) return 1
  if (value >= T.cheapMax) return 0
  return (T.cheapMax - value) / (T.cheapMax - T.cheapFull)
}

export function securityFactor(state: GameState): number {
  return 1 / (1 + Math.max(0, state.shop.security) * T.perSecurity)
}

function trafficFactor(state: GameState): number {
  return clamp(state.day.total / T.trafficBaseline, T.traffic[0], T.traffic[1])
}

/** Tonight's chance before security (exposure, cheapness, traffic, youth). */
function rawChance(state: GameState, item: ItemInstance, area: SlotArea): number {
  if (protectedAreas(state).has(area)) return 0
  // M5 Protection: a bricked case has no glass until the glazier comes; and the crew keeps
  // the street's light fingers off a shop that pays.
  const exposure = area === 'counter' && caseBroken(state) ? tuning.protection.brick.openExposure : T.exposure[area]
  const paying = state.story.flags.includes(PROTECTION_FLAGS.paying) ? tuning.protection.paidTheftScale : 1
  return T.base * exposure * cheapness(item.trueValue) * trafficFactor(state) * theftRepFactor(state) * paying
}

/** Tonight's chance that `item` on display in `area` is stolen. */
export function theftChance(state: GameState, item: ItemInstance, area: SlotArea): number {
  return Math.min(T.maxChance, rawChance(state, item, area) * securityFactor(state))
}

/** The owned upgrade with the most security that has deterred lines (it gets the credit). */
function strongestDeterrent(state: GameState): string | undefined {
  let best: { id: string; security: number } | undefined
  for (const id of state.shop.upgrades) {
    const security = getUpgrade(id)?.effects.security ?? 0
    if (security > 0 && theftLines.deterred[id] && (!best || security > best.security)) best = { id, security }
  }
  return best?.id
}

function fill(line: string, item: ItemInstance, area: SlotArea): string {
  return line.replaceAll('{item}', shortName(getItemDef(item.defId).name)).replaceAll('{where}', theftWhere[area])
}

export interface TheftResult {
  state: GameState
  /** Item ids stolen tonight. */
  stolen: string[]
}

export function rollShoplifting(state: GameState): TheftResult {
  if (state.calendar.day < T.fromDay) return { state, stolen: [] }
  const rng = Rng.from(state.meta.rng).fork(`theft:${state.calendar.day}`)
  const sec = securityFactor(state)
  const deterrent = strongestDeterrent(state)
  const gone: { item: ItemInstance; area: SlotArea }[] = []
  let saved: { item: ItemInstance; area: SlotArea } | undefined
  for (const d of displayed(state)) {
    const raw = rawChance(state, d.item, d.area)
    if (raw <= 0) continue
    const u = rng.next()
    if (u < Math.min(T.maxChance, raw * sec)) gone.push({ item: d.item, area: d.area })
    else if (!saved && deterrent && u < Math.min(T.maxChance, raw)) saved = { item: d.item, area: d.area }
  }
  if (gone.length === 0 && !saved) return { state, stolen: [] }

  const entries: LedgerEntry[] = gone.map(({ item, area }) => ({
    kind: 'theft',
    amount: 0,
    text: fill(rng.pick(theftLines.gone), item, area),
    itemId: item.id,
    defId: item.defId,
  }))
  if (saved && deterrent) {
    entries.push({ kind: 'deterred', amount: 0, text: fill(rng.pick(theftLines.deterred[deterrent]!), saved.item, saved.area), defId: saved.item.defId })
  }

  const ids = new Set(gone.map((g) => g.item.id))
  let shop = state.shop
  for (const id of ids) shop = clearItem(shop, id)
  const paid = Object.fromEntries(Object.entries(state.paid).filter(([id]) => !ids.has(id)))
  return {
    stolen: [...ids],
    state: {
      ...state,
      inventory: state.inventory.filter((i) => !ids.has(i.id)),
      paid,
      shop,
      stats: { ...state.stats, itemsStolen: (state.stats.itemsStolen ?? 0) + ids.size },
      day: { ...state.day, log: [...state.day.log, ...entries] },
    },
  }
}
