/**
 * Career slots (M4): three per device, chosen on the title screen.
 *
 * Pure: which stored record sits in which slot and what a slot card shows.
 * The IndexedDB side is src/persist/autosave.ts.
 *
 * The slot number lives on the stored record, not in GameState: a save code
 * carries a career, and the device it is loaded on picks the slot.
 */
import type { GameState } from '../state'

export type SlotNo = 1 | 2 | 3
export const SLOT_NUMBERS: readonly SlotNo[] = [1, 2, 3]

export function isSlotNo(v: unknown): v is SlotNo {
  return v === 1 || v === 2 || v === 3
}

/** What slot assignment needs to know about one stored record. */
export interface SlotCandidate {
  careerId: string
  savedAt: number
  /** The record's stored slot, if any (anything but 1–3 counts as none). */
  slot?: unknown
  /** Whether the record's state migrates and loads. */
  readable: boolean
}

/**
 * Decide the slot of every stored record. Returns careerId → slot, or null for
 * a record that is kept in storage but not shown.
 *
 * - A record that already has a slot keeps it (readable or not, so a damaged
 *   save still occupies its slot until the player deletes it). If two claim the
 *   same slot, the most recently saved one wins and the other is unslotted.
 * - Readable records without a slot (saves from before slots existed, M1–M3)
 *   fill the free slots newest first: the career the player was last playing
 *   lands in slot 1 on an empty board.
 * - Unreadable records without a slot, and anything beyond three, stay
 *   unslotted. Nothing is ever deleted here.
 */
export function assignSlots(records: readonly SlotCandidate[]): Map<string, SlotNo | null> {
  const out = new Map<string, SlotNo | null>()
  const newestFirst = [...records].sort((a, b) => b.savedAt - a.savedAt)
  const taken = new Set<SlotNo>()
  for (const r of newestFirst) {
    if (isSlotNo(r.slot) && !taken.has(r.slot)) {
      taken.add(r.slot)
      out.set(r.careerId, r.slot)
    }
  }
  for (const r of newestFirst) {
    if (out.has(r.careerId)) continue
    const free = r.readable ? SLOT_NUMBERS.find((n) => !taken.has(n)) : undefined
    if (free) taken.add(free)
    out.set(r.careerId, free ?? null)
  }
  return out
}

/** What a slot card shows about the career in it. */
export interface SlotCareer {
  careerId: string
  shopName: string
  day: number
  date: string
  cash: number
  /** Career-start intro not finished yet (the shop has no name yet). */
  intro: boolean
  /** At least one finished day (progress worth a backup). */
  progress: boolean
  /** Real time of the last autosave (ms since epoch). */
  savedAt: number
}

export interface SlotView {
  slot: SlotNo
  career: SlotCareer | null
  /** A record sits in this slot but cannot be read (only Delete is offered). */
  damaged: boolean
}

export function summarizeCareer(state: GameState, savedAt: number): SlotCareer {
  return {
    careerId: state.meta.careerId,
    shopName: state.shop.name,
    day: state.calendar.day,
    date: state.calendar.date,
    cash: state.cash,
    intro: state.meta.intro,
    progress: state.history.length > 0,
    savedAt,
  }
}

/** The occupied slot played most recently (the title screen's Continue), or null. */
export function mostRecentSlot(slots: readonly SlotView[]): SlotView | null {
  let best: SlotView | null = null
  for (const s of slots) {
    if (s.career && (!best?.career || s.career.savedAt > best.career.savedAt)) best = s
  }
  return best
}

/**
 * A career loaded from a save code into one slot must not share its careerId
 * (the storage key) with a career in another slot, or saving one would move
 * the other. Returns the state unchanged, or with a fresh careerId derived
 * from the old one and `salt`.
 */
export function withUniqueCareerId(state: GameState, takenIds: ReadonlySet<string>, salt: string): GameState {
  if (!takenIds.has(state.meta.careerId)) return state
  let id = `${state.meta.careerId}-${salt}`
  for (let i = 2; takenIds.has(id); i++) id = `${state.meta.careerId}-${salt}${i}`
  return { ...state, meta: { ...state.meta, careerId: id } }
}
