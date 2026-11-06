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
  StoryBoost,
  VisitOutcome,
  VisitState,
} from './types'

export type { ItemInstance } from './types'

export const STATE_VERSION = 9

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
  /** A beat that ended in a pawn (v7): its loan, and once it's over how it ended and on which day. */
  loan?: PledgeRecord
}

/** The loan a story beat made (v7), followed until it ends (story/pledges.ts). */
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
  /** M5 career summary: deals that helped someone who needed it, and ones that hurt them. */
  peopleHelped: number
  peopleHurt: number
}

/**
 * M5 crime layer (v8). Empty shapes laid down by the foundation so the police,
 * fence, pressure and endings work can land in any order without fighting over
 * save versions; each sub-object belongs to one system.
 */
/** One line of the stolen-goods bulletin in the morning paper (police). */
export interface BulletinEntry {
  id: string
  /** Day it was printed. */
  day: number
  defId: string
  /** The instance it describes, when that exact piece is (or will be) in circulation. */
  itemId?: string
  text: string
}

/** Detective Volkova (police): her weekly visits and what she remembers. */
export interface VolkovaState {
  met: boolean
  /** −1…1, her read of you. */
  trust: number
  /** Next day she is due at the counter (0 = not scheduled). */
  nextDay: number
  /** Lies told, lies she caught, bribes taken. */
  lies: number
  caught: number
  bribes: number
}

/** The fence (fence relationship; `crime.fenceTrust` is the relationship itself). */
export interface FenceState {
  met: boolean
  deals: number
  /** Every time you said no; the fence remembers. */
  refusals: number
  /** Next day the fence calls or drops in (0 = not scheduled). */
  nextDay: number
}

/** A scheduled crime event: vandalism, a raid, a call (kinds owned by the system that schedules them). */
export interface CrimeEvent {
  day: number
  kind: string
  data?: Record<string, string | number>
}

export interface CrimeState {
  /** Police attention (GDD § 8). Rises with stolen goods, flagged sellers and a sloppy ledger. */
  heat: number
  /** Mob pressure (GDD § 8). */
  pressure: number
  fenceTrust: number
  flags: string[]
  bulletin: BulletinEntry[]
  volkova: VolkovaState
  fence: FenceState
  events: CrimeEvent[]
}

/** How a career ended (GDD § 12). Forced endings are endings too. */
export type CareerEndKind = 'retired' | 'evicted' | 'raided' | 'pushedOut'

export interface CareerEnd {
  kind: CareerEndKind
  day: number
  /** Ending title id, chosen by the endings system when the end is shown (absent until then). */
  title?: string
}

/**
 * The career's hidden ending axes (GDD § 12). Wealth and standing are read at the end from
 * cash, stock and reputation; these two accumulate over the career through nudgeAxis
 * (src/game/endings/axes.ts). Signed and unbounded: > 0 is clean / heart, < 0 dirty / hustle.
 */
export interface CareerAxes {
  clean: number
  heart: number
}

export interface CareerState {
  axes: CareerAxes
  end: CareerEnd | null
}

/**
 * M6 the Appraiser (v9): the one hire the second counter allows (src/game/staff/appraiser.ts,
 * GDD § 7 Employee). He serves walk-in sellers off the line while you serve yours.
 */
export type StaffMode = 'next' | 'categories'

export interface StaffState {
  /** On staff now. */
  hired: boolean
  /** Career day he started (0 = never hired). */
  sinceDay: number
  /** How he left, once he has: let go from the office, let go when he told you, or gone in the night. Final. */
  gone?: 'fired' | 'left' | 'vanished'
  goneDay?: number
  /** next: the next walk-in seller while the line is long; categories: only sellers bringing these. */
  mode: StaffMode
  categories: string[]
  /** Added to tuning.appraiser.accuracy by his arc. */
  accuracyMod: number
  /** The seller he is serving at the second counter, until the day clock reaches `until`. */
  busy: { visit: QueuedVisit; until: number } | null
  /** Pieces he bought today that weren't what he thought: the ledger names them at closing. */
  pending: { itemId: string; defId: string; price: number; from: string }[]
  /** Career totals (the office card, the sim, the epilogue). */
  record: { served: number; bought: number; lent: number; spent: number; fakes: number; insults: number; wages: number }
}

export function createStaffState(): StaffState {
  return {
    hired: false,
    sinceDay: 0,
    mode: 'next',
    categories: [],
    accuracyMod: 0,
    busy: null,
    pending: [],
    record: { served: 0, bought: 0, lent: 0, spent: 0, fakes: 0, insults: 0, wages: 0 },
  }
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
  crime: CrimeState
  /** M5: the ending axes and, once it is over, how the career ended. */
  career: CareerState
  /** M6 (v9): the appraiser at the second counter. */
  staff: StaffState
  /**
   * M4: arc progress and story flags (set by beats, read by their conditions).
   * boosts (v6): specialist warnings running ("plated chains turn up more for two weeks").
   */
  story: { arcs: Record<ArcId, ArcProgress>; pendingEvents: ScheduledEvent[]; flags: string[]; boosts: StoryBoost[] }
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

export function createCrimeState(): CrimeState {
  return {
    heat: 0,
    pressure: 0,
    fenceTrust: 0,
    flags: [],
    bulletin: [],
    volkova: { met: false, trust: 0, nextDay: 0, lies: 0, caught: 0, bribes: 0 },
    fence: { met: false, deals: 0, refusals: 0, nextDay: 0 },
    events: [],
  }
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
    crime: createCrimeState(),
    career: { axes: { clean: 0, heart: 0 }, end: null },
    staff: createStaffState(),
    story: { arcs: {}, pendingEvents: [], flags: [], boosts: [] },
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
      peopleHelped: 0,
      peopleHurt: 0,
    },
    settings: { reduceMotion: false, textScale: 1 },
    narration: placeholderIdleLine,
  }
}
