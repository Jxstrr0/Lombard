/**
 * The Collector (M5, GDD § 9). Pure.
 *
 * Leopold Germanovich Bessmertny (src/data/collector.ts) is a beat person like the fence:
 * `who: 'bessmertny'` on a beat plays him (collectorCustomer). His arc
 * (src/data/stories/collector.ts) is all story data; the one thing data can't do is take
 * the icon out of the shop, which the `collector` story effect does here:
 *   - sold: he pays tuning.collector.price; the icon's police trail stays (Volkova can
 *     still ask where it went);
 *   - returned: back to its church, for nothing; the trail is dropped (the police close it);
 *   - handedIn: to the police; the trail is dropped.
 * Flags, axes, heat and standing for each are the arc's effects (numbers in tuning.collector).
 */
import { COLLECTOR, COLLECTOR_ICON, COLLECTOR_LOG } from '../../data/collector'
import { tuning } from '../../data/tuning'
import { clearItem } from '../shop/display'
import type { GameState } from '../state'
import type { LedgerEntry, WalkIn } from '../types'
import { TRAIL, dropEvents } from './events'

export const COLLECTOR_ID = COLLECTOR.id

export type CollectorChange = 'sold' | 'returned' | 'handedIn'

export function collectorCustomer(): WalkIn {
  return { id: COLLECTOR_ID, name: COLLECTOR.name, archetype: COLLECTOR.role, temperament: 'flexible', knowledge: 1, desperation: 0, portraitKey: COLLECTOR.look }
}

export function isCollector(c: Pick<WalkIn, 'id'>): boolean {
  return c.id === COLLECTOR_ID
}

/** The icon in stock (not on a loan), if you hold it. */
export function heldIcon(state: GameState) {
  return state.inventory.find((i) => i.defId === COLLECTOR_ICON)
}

/** The icon leaves the shop one of three ways. Nothing happens if you don't hold it. */
export function applyCollectorChange(state: GameState, change: CollectorChange): GameState {
  const icon = heldIcon(state)
  if (!icon) return state
  const { [icon.id]: paidFor = 0, ...paid } = state.paid
  const cash = change === 'sold' ? tuning.collector.price : 0
  const entry: LedgerEntry = { kind: change === 'sold' ? 'sell' : 'story', amount: cash, text: COLLECTOR_LOG[change], itemId: icon.id, defId: icon.defId }
  const profit = cash - paidFor
  let s: GameState = {
    ...state,
    cash: state.cash + cash,
    inventory: state.inventory.filter((i) => i.id !== icon.id),
    paid,
    shop: clearItem(state.shop, icon.id),
    day: { ...state.day, log: [...state.day.log, entry] },
    stats:
      change === 'sold'
        ? {
            ...state.stats,
            itemsSold: state.stats.itemsSold + 1,
            totalEarned: state.stats.totalEarned + cash,
            bestDeal: Math.max(state.stats.bestDeal, profit),
          }
        : state.stats,
  }
  if (change !== 'sold') s = dropEvents(s, (e) => e.kind === TRAIL && e.data?.item === icon.id)
  return s
}
