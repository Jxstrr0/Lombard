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

export const STATE_VERSION = 1

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type ISODate = string
export type CustomerId = string
export type ArcId = string
export type UpgradeId = string
export type Group = 'neighbourhood' | 'police' | 'mob' | 'specialists'

export type Authenticity = 'genuine' | 'fake' | 'frankenstein' | 'restored'
export type Provenance = 'clean' | 'unknown' | 'stolen' | 'heirloom'

export interface ItemInstance {
  id: string
  defId: string
  condition: number
  authenticity: Authenticity
  fakeProfileId?: string
  provenance: Provenance
  trueValue: number
  revealed: string[]
  story: string
}

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

/** placeholder (M1/M4) */
export interface CustomerState {
  trust: number
  flags: string[]
}

/** placeholder (M1) */
export interface QueuedVisit {
  customerId: CustomerId
}

/** M0 placeholder: who is at the counter and what they just said. */
export interface VisitState {
  customerName: string
  line: string
}

/** placeholder (M1) */
export interface InspectState {
  itemId: string
}

/** placeholder (M1) */
export interface HaggleState {
  round: number
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
}

export interface Settings {
  reduceMotion: boolean
  textScale: number
}

export interface GameState {
  meta: { version: number; seed: number; careerId: string; rng: RngState }
  calendar: { day: number; weekday: number; season: Season; date: ISODate }
  cash: number
  shop: { slots: Slot[]; upgrades: UpgradeId[]; security: number }
  inventory: ItemInstance[]
  loans: Loan[]
  customers: Record<CustomerId, CustomerState>
  queue: QueuedVisit[]
  current: VisitState | null
  inspect: InspectState | null
  haggle: HaggleState | null
  crime: { heat: number; pressure: number; fenceTrust: number; flags: string[] }
  story: { arcs: Record<ArcId, ArcProgress>; pendingEvents: ScheduledEvent[] }
  reputation: { general: number; byGroup: Record<Group, number> }
  stats: CareerStats
  settings: Settings
  /** Line shown in the dialogue strip when nobody is at the counter. M0 placeholder. */
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

export function createInitialState(seed: number, careerId: string): GameState {
  const date = tuning.career.startDate
  return {
    meta: { version: STATE_VERSION, seed: seed >>> 0, careerId, rng: seed >>> 0 },
    calendar: { day: 1, weekday: weekdayOf(date), season: seasonOf(date), date },
    cash: tuning.career.startingCash,
    shop: { slots: [], upgrades: [], security: 0 },
    inventory: [],
    loans: [],
    customers: {},
    queue: [],
    current: null,
    inspect: null,
    haggle: null,
    crime: { heat: 0, pressure: 0, fenceTrust: 0, flags: [] },
    story: { arcs: {}, pendingEvents: [] },
    reputation: {
      general: 0,
      byGroup: { neighbourhood: 0, police: 0, mob: 0, specialists: 0 },
    },
    stats: { customersSeen: 0 },
    settings: { reduceMotion: false, textScale: 1 },
    narration: placeholderIdleLine,
  }
}
