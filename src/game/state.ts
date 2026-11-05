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
  QueuedVisit,
  VisitState,
} from './types'

export type { ItemInstance } from './types'

export const STATE_VERSION = 2

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type ISODate = string
export type CustomerId = string
export type ArcId = string
export type UpgradeId = string
export type Group = 'neighbourhood' | 'police' | 'mob' | 'specialists'

/** placeholder (M2) */
export interface Slot {
  id: string
  itemId: string | null
}

/** placeholder (M2) */
export interface Loan {
  itemId: string
  customerId: CustomerId
  principal: number
  startDay: number
}

/** placeholder (M4): regulars only; walk-ins live on their visit. */
export interface CustomerState {
  trust: number
  flags: string[]
}

/** placeholder (M4/M5) */
export interface ArcProgress {
  beat: string
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
}

export interface Settings {
  reduceMotion: boolean
  textScale: number
}

export interface GameState {
  meta: { version: number; seed: number; careerId: string; rng: RngState; nextId: number }
  calendar: { day: number; weekday: number; season: Season; date: ISODate }
  cash: number
  shop: { slots: Slot[]; upgrades: UpgradeId[]; security: number }
  inventory: ItemInstance[]
  /** Purchase price per inventory item id (for profit tracking). */
  paid: Record<string, number>
  loans: Loan[]
  customers: Record<CustomerId, CustomerState>
  queue: QueuedVisit[]
  current: VisitState | null
  inspect: InspectState | null
  haggle: HaggleState | null
  day: DayState
  history: DaySummary[]
  crime: { heat: number; pressure: number; fenceTrust: number; flags: string[] }
  story: { arcs: Record<ArcId, ArcProgress>; pendingEvents: ScheduledEvent[] }
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

export function createInitialState(seed: number, careerId: string): GameState {
  const date = tuning.career.startDate
  return {
    meta: { version: STATE_VERSION, seed: seed >>> 0, careerId, rng: seed >>> 0, nextId: 1 },
    calendar: { day: 1, weekday: weekdayOf(date), season: seasonOf(date), date },
    cash: tuning.career.startingCash,
    shop: { slots: [], upgrades: [], security: 0 },
    inventory: [],
    paid: {},
    loans: [],
    customers: {},
    queue: [],
    current: null,
    inspect: null,
    haggle: null,
    day: { phase: 'closed', clock: 0, served: 0, total: 0, openingCash: tuning.career.startingCash, log: [] },
    history: [],
    crime: { heat: 0, pressure: 0, fenceTrust: 0, flags: [] },
    story: { arcs: {}, pendingEvents: [] },
    reputation: {
      general: 0,
      byGroup: { neighbourhood: 0, police: 0, mob: 0, specialists: 0 },
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
    },
    settings: { reduceMotion: false, textScale: 1 },
    narration: placeholderIdleLine,
  }
}
