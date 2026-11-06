/**
 * GameState: the single source of truth. Updated immutably by the reducer in
 * actions.ts. Render and UI read it; they never mutate it.
 *
 * Shapes follow docs/02-ARCHITECTURE.md § State model. Types marked
 * "placeholder" are filled in by the milestone that owns them.
 */
import { placeholderIdleLine } from '../data/placeholder'
import { tuning } from '../data/tuning'
import type { RngState } from './rng'
import type {
  DayState,
  DaySummary,
  HaggleState,
  InspectState,
  ItemInstance,
  Loan,
  MarketState,
  QueuedVisit,
  SpecialistState,
  VisitOutcome,
  VisitState,
} from './types'

export type { ItemInstance } from './types'

export const STATE_VERSION = 6

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type ISODate = string
export type CustomerId = string
export type ArcId = string
export type UpgradeId = string
/**
 * Reputation groups (src/game/reputation.ts owns the rules). `youth` = the local
 * kids and students (GDD § 6 "reputation with the local kids"); added in v4.
 */
export type Group = 'neighbourhood' | 'youth' | 'police' | 'mob' | 'specialists'

export type SlotArea = 'counter' | 'wall' | 'back'

/** A display position. Inventory items not in any slot are in the safe (not for sale). */
export interface Slot {
  id: string
  area: SlotArea
  itemId: string | null
}

export interface ShopState {
  /** Player-chosen at career start; default tuning.career.defaultShopName. */
  name: string
  slots: Slot[]
  /** Tag price per displayed (or safe) inventory item id. */
  prices: Record<string, number>
  upgrades: UpgradeId[]
  /** Acid kit uses left. */
  acidCharges: number
  security: number
}

/**
 * A regular's memory of you (M4), keyed by regular id (src/data/regulars).
 * Walk-ins have none; they live on their visit.
 */
export interface CustomerState {
  /** −1 (burned) … 1 (trusts you). Moves with how each visit ended. */
  trust: number
  flags: string[]
  visits: number
  /** Career day of their last visit (0 = never been in). */
  lastDay: number
  /** Earliest day of their next ordinary (scheduled) visit. */
  nextDay: number
  lastOutcome?: VisitOutcome
}

/** How one story beat went (M4). */
export interface BeatRecord {
  day: number
  outcome?: VisitOutcome
  /** The scene choice made, if the beat had one. */
  choice?: string
  /** Price ÷ true value, for a beat that ended in a buy or a pawn. */
  ratio?: number
  /** A beat that ended in a pawn (v6): its loan, and once it's over how it ended and on which day. */
  loan?: PledgeRecord
}

/** The loan a story beat made (v6), followed until it ends (story/pledges.ts). */
export interface PledgeRecord {
  id: string
  end?: 'redeemed' | 'forfeited'
  /** Career day it ended. */
  day?: number
}

/** An arc's progress (M4): the beats that have played. */
export interface ArcProgress {
  beats: Record<string, BeatRecord>
  ended?: boolean
}

/** placeholder (M4/M5) */
export interface ScheduledEvent {
  day: number
  id: string
}

export interface CareerStats {
  customersSeen: number
  itemsBought: number
  itemsSold: number
  totalSpent: number
  totalEarned: number
  /** Most profit on a single item (sale − purchase). */
  bestDeal: number
  /** Biggest loss on a single item. */
  worstDeal: number
  fakesBought: number
  /** Items shoplifted off the open shelves (M4). */
  itemsStolen: number
}

export interface Settings {
  reduceMotion: boolean
  textScale: number
}

export interface GameState {
  meta: {
    version: number
    seed: number
    careerId: string
    rng: RngState
    nextId: number
    /** True until the career-start intro (name the shop, leftover stock) is finished. */
    intro: boolean
  }
  calendar: { day: number; weekday: number; season: Season; date: ISODate }
  cash: number
  shop: ShopState
  inventory: ItemInstance[]
  /** Purchase price per inventory item id (for profit tracking). */
  paid: Record<string, number>
  /** Open pawn loans; their items are held here, not in inventory. */
  loans: Loan[]
  specialists: Record<string, SpecialistState>
  market: MarketState
  customers: Record<CustomerId, CustomerState>
  queue: QueuedVisit[]
  current: VisitState | null
  inspect: InspectState | null
  haggle: HaggleState | null
  day: DayState
  history: DaySummary[]
  crime: { heat: number; pressure: number; fenceTrust: number; flags: string[] }
  /** M4: arc progress and story flags (set by beats, read by their conditions). */
  story: { arcs: Record<ArcId, ArcProgress>; pendingEvents: ScheduledEvent[]; flags: string[] }
  /**
   * general: the M1 standing in points (unbounded; walkouts −1), read by buyer chance.
   * byGroup: −1…1 per group, changed only through adjustRep (src/game/reputation.ts).
   */
  reputation: { general: number; byGroup: Record<Group, number> }
  stats: CareerStats
  settings: Settings
  /** Line shown in the dialogue strip when nobody is at the counter. */
  narration: string
}

export function seasonOf(isoDate: ISODate): Season {
  const month = Number(isoDate.slice(5, 7))
  if (month === 12 || month <= 2) return 'winter'
  if (month <= 5) return 'spring'
  if (month <= 8) return 'summer'
  return 'autumn'
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(isoDate: ISODate): number {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return (d.getUTCDay() + 6) % 7
}

export function addDays(isoDate: ISODate, days: number): ISODate {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Display slots from tuning, all empty. Ids: counter-1…, wall-1…, back-1…. */
export function createSlots(): Slot[] {
  const slots: Slot[] = []
  for (const area of ['counter', 'wall', 'back'] as const) {
    for (let i = 1; i <= tuning.shop.slots[area]; i++) slots.push({ id: `${area}-${i}`, area, itemId: null })
  }
  return slots
}

export function createInitialState(seed: number, careerId: string): GameState {
  const date = tuning.career.startDate
  return {
    meta: { version: STATE_VERSION, seed: seed >>> 0, careerId, rng: seed >>> 0, nextId: 1, intro: true },
    calendar: { day: 1, weekday: weekdayOf(date), season: seasonOf(date), date },
    cash: tuning.career.startingCash,
    shop: {
      name: tuning.career.defaultShopName,
      slots: createSlots(),
      prices: {},
      upgrades: [],
      acidCharges: 0,
      security: 0,
    },
    inventory: [],
    paid: {},
    loans: [],
    specialists: {},
    market: { drift: {}, news: [] },
    customers: {},
    queue: [],
    current: null,
    inspect: null,
    haggle: null,
    day: { phase: 'closed', clock: 0, served: 0, total: 0, openingCash: tuning.career.startingCash, log: [], newsRead: true },
    history: [],
    crime: { heat: 0, pressure: 0, fenceTrust: 0, flags: [] },
    story: { arcs: {}, pendingEvents: [], flags: [] },
    reputation: {
      general: 0,
      byGroup: { neighbourhood: 0, youth: 0, police: 0, mob: 0, specialists: 0 },
    },
    stats: {
      customersSeen: 0,
      itemsBought: 0,
      itemsSold: 0,
      totalSpent: 0,
      totalEarned: 0,
      bestDeal: 0,
      worstDeal: 0,
      fakesBought: 0,
      itemsStolen: 0,
    },
    settings: { reduceMotion: false, textScale: 1 },
    narration: placeholderIdleLine,
  }
}
