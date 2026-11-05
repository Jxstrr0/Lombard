/**
 * Display positions and tag prices (owner: shop worker).
 *
 * Contract (the reducer calls these; keep the signatures):
 *   placeItem(state, itemId, slotId | null) → state   slotId null = back to the safe
 *   setPrice(state, itemId, price) → state
 *   displayed(state) → what is on display, with area and tag
 *
 * Rules: only inventory items can be placed; one item per slot. Placing into an
 * occupied slot swaps: the occupant takes the moved item's old slot, or goes to
 * the safe if the moved item came from the safe. A tag of 0 (or less) removes
 * the tag: the item is then not for sale even on display. Tags are capped at
 * tuning.shop.maxTag.
 */
import { tuning } from '../../data/tuning'
import type { GameState, Slot, SlotArea } from '../state'
import type { ItemInstance } from '../types'

export interface DisplayedItem {
  item: ItemInstance
  slot: Slot
  area: SlotArea
  price: number | undefined
}

export function placeItem(state: GameState, itemId: string, slotId: string | null): GameState {
  if (!state.inventory.some((i) => i.id === itemId)) return state
  if (slotId !== null && !state.shop.slots.some((s) => s.id === slotId)) return state
  const from = state.shop.slots.find((s) => s.itemId === itemId)
  if ((from?.id ?? null) === slotId) return state
  const occupant = slotId === null ? null : (state.shop.slots.find((s) => s.id === slotId)?.itemId ?? null)
  const slots = state.shop.slots.map((s) => {
    if (s.id === slotId) return { ...s, itemId }
    if (s.itemId === itemId) return { ...s, itemId: occupant }
    return s
  })
  return { ...state, shop: { ...state.shop, slots } }
}

export function setPrice(state: GameState, itemId: string, price: number): GameState {
  if (!state.inventory.some((i) => i.id === itemId)) return state
  const p = Math.min(tuning.shop.maxTag, Math.round(price))
  if (!Number.isFinite(p) || p <= 0) {
    if (!(itemId in state.shop.prices)) return state
    const { [itemId]: _drop, ...prices } = state.shop.prices
    return { ...state, shop: { ...state.shop, prices } }
  }
  if (state.shop.prices[itemId] === p) return state
  return { ...state, shop: { ...state.shop, prices: { ...state.shop.prices, [itemId]: p } } }
}

export function displayed(state: GameState): DisplayedItem[] {
  const byId = new Map(state.inventory.map((i) => [i.id, i]))
  const out: DisplayedItem[] = []
  for (const slot of state.shop.slots) {
    const item = slot.itemId ? byId.get(slot.itemId) : undefined
    if (item) out.push({ item, slot, area: slot.area, price: state.shop.prices[item.id] })
  }
  return out
}

/** Remove every trace of an item from the shop (after it is sold or handed back). */
export function clearItem(shop: GameState['shop'], itemId: string): GameState['shop'] {
  const { [itemId]: _drop, ...prices } = shop.prices
  return { ...shop, slots: shop.slots.map((s) => (s.itemId === itemId ? { ...s, itemId: null } : s)), prices }
}
