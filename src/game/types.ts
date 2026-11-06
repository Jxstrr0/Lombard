/**
 * Shared domain types (M1, extended in M2). Modules own their logic; this file owns the
 * shapes that cross module boundaries (state, reducer, UI).
 */
import type { Polarity, Reveals, ToolId } from './schema/item'

export type Authenticity = 'genuine' | 'fake' | 'frankenstein' | 'restored'
export type Provenance = 'clean' | 'unknown' | 'stolen' | 'heirloom'

export interface ItemInstance {
  id: string
  defId: string
  /** 0–100 */
  condition: number
  authenticity: Authenticity
  fakeProfileId?: string
  provenance: Provenance
  /** What the market would pay today, rubles. Hidden from the player. */
  trueValue: number
  /** Actual weight, fixed at generation so repeated weighing agrees. */
  weightGrams?: number
  /** Finding ids the player has revealed on this item (kept after purchase). */
  revealed: string[]
  /** The customer's claim about it (may be untrue). */
  story: string
}

export interface Finding {
  /** Unique within the visit. */
  id: string
  tool: ToolId
  text: string
  /** Set when the finding comes from a tell. */
  tellId?: string
  reveals?: Reveals
  polarity: Polarity
  hotspot?: string
  /** M4: a specialist's call, what they said (the story engine reads it when you buy). */
  verdict?: SpecialistVerdict
}

/** What a specialist's call said: sound, redone, mixed, doubt, or a lowball (sound, but "not worth much"). */
export type SpecialistVerdict = 'sound' | 'redone' | 'mixed' | 'doubt' | 'lowball'

export type Temperament = 'stubborn' | 'flexible' | 'desperate' | 'proud'

export interface WalkIn {
  id: string
  name: string
  archetype: string
  temperament: Temperament
  /** 0–1: how well they know what the item is worth. */
  knowledge: number
  /** 0–1: how badly they need the money today. */
  desperation: number
  portraitKey: string
  /** M4: set when this is one of the authored regulars (src/data/regulars); their memory is state.customers[regularId]. */
  regularId?: string
  /** M4: set when a specialist (src/data/specialists) is the one talking, at the counter or on the phone. */
  specialistId?: string
}

export type Approach = 'straight' | 'evidence' | 'sympathy' | 'walk'
export type Mood = 'pleased' | 'neutral' | 'annoyed' | 'insulted'

export interface HaggleRound {
  offer: number
  approach: Approach
  evidenceId?: string
  response: HaggleResponse
}

export interface HaggleResponse {
  kind: 'accept' | 'counter' | 'walk'
  /** Accept: the agreed price (= offer). Counter: their new ask. Walk: last ask. */
  price: number
  mood: Mood
  /** Key into src/data/lines.ts haggle lines, e.g. "counter.proud". */
  lineKey: string
}

export interface HaggleState {
  /** Their current asking price. */
  ask: number
  /** Hidden lowest price they'd take right now (moves with rounds and approaches). */
  floor: number
  round: number
  maxRounds: number
  /** Accumulated irritation 0–1; at 1 they walk. */
  irritation: number
  status: 'open' | 'accepted' | 'walked'
  history: HaggleRound[]
}

/** scene: a story beat's conversation (lines, maybe a choice) before anything else happens. */
export type VisitPhase = 'scene' | 'present' | 'inspect' | 'offer' | 'resolved'
/**
 * bought / pawned: you took the item. sold: a buyer took one of yours.
 * redeemed: a pawner paid off their loan. passed / walked / left: no deal.
 * talked: a story scene with no item ended (M4).
 */
export type VisitOutcome = 'bought' | 'pawned' | 'sold' | 'redeemed' | 'passed' | 'walked' | 'left' | 'talked'

/**
 * seller: brings an item to sell or pawn (inspect → offer → haggle).
 * buyer: wants one of your displayed items (sale haggle, no inspect).
 * redeem: comes back to pay off a loan and collect their item.
 * scene: a story visitor with nothing to sell (M4): they talk, maybe ask you to choose, and leave.
 */
export type VisitKind = 'seller' | 'buyer' | 'redeem' | 'scene'
export type SellerWants = 'sell' | 'pawn'

interface QueuedBase {
  visitId: string
  customer: WalkIn
  /** Seconds of in-game time they will wait in the queue before leaving. */
  patience: number
  /** seller only. */
  wants?: SellerWants
  /** redeem only. */
  loanId?: string
  /** Opening line at the counter (default: item.story). */
  line?: string
  /** M4: the story beat this visit plays (src/data/stories); its script lives in the data, not the save. */
  beatId?: string
  /** M4: a phone call between customers (nobody walks in). */
  via?: 'phone'
  /** M4 buyer only: a specialist's take-it-or-leave-it offer for a piece in stock (Gennady's first refusal). */
  offer?: number
}

/** A visit in the line outside. Scene visitors (M4) bring no item. */
export type QueuedVisit =
  | (QueuedBase & {
      kind: Exclude<VisitKind, 'scene'>
      /** seller: their item. buyer: a snapshot of the displayed item they want. redeem: the pledged item. */
      item: ItemInstance
    })
  | (QueuedBase & { kind: 'scene'; item?: undefined })

/** A story beat's conversation at the counter (M4). */
export interface SceneState {
  lines: string[]
  /** Index of the line showing. */
  step: number
  /** Offered on the last line; empty = just "Go on". */
  choices: { id: string; label: string }[]
  /** The choice made, once made (its reply is the line showing). */
  chosen?: string
}

interface VisitBase {
  visitId: string
  wants?: SellerWants
  loanId?: string
  /** buyer only: the sale haggle (null for other kinds). */
  sale: SaleState | null
  customer: WalkIn
  phase: VisitPhase
  /** What the customer is saying right now. */
  line: string
  /** In-game seconds spent at the counter. */
  elapsed: number
  outcome?: VisitOutcome
  /** Cash that changed hands: price paid (bought), principal (pawned), sale price (sold), amount repaid (redeemed). */
  price?: number
  /** M4: the story beat this visit plays. */
  beatId?: string
  /** M4: the beat's conversation, while phase is 'scene' (kept after, with the choice made). */
  scene?: SceneState
  /** M4: a phone call (nobody stands at the counter). */
  via?: 'phone'
}

/** The customer at the counter. Scene visitors (M4) bring no item. */
export type ItemVisit = VisitBase & { kind: Exclude<VisitKind, 'scene'>; item: ItemInstance }
export type SceneVisit = VisitBase & { kind: 'scene'; item?: undefined }
export type VisitState = ItemVisit | SceneVisit

/** A walk-in buyer haggling over one of your displayed items. */
export interface SaleState {
  itemId: string
  /** Your tag price when they picked it up. */
  tag: number
  /** Their current offer. */
  offer: number
  /** Hidden: the most they will pay. */
  ceiling: number
  round: number
  maxRounds: number
  status: 'open' | 'sold' | 'walked'
  history: { counter: number; response: SaleResponse }[]
}

export interface SaleResponse {
  /** accept: they pay `price` (= your counter). counter: their new offer. walk: they leave. */
  kind: 'accept' | 'counter' | 'walk'
  price: number
  /** Key into src/data/lines.ts sale lines. */
  lineKey: string
}

export interface Loan {
  id: string
  /** The pledged item, held by the shop (not in inventory, not for sale). */
  item: ItemInstance
  customer: WalkIn
  principal: number
  startDay: number
  /** Last day they can redeem. After it the item is forfeited to the shop. */
  dueDay: number
  /** Interest per 30 days, e.g. 0.1. */
  monthlyRate: number
  /** Hidden: the day they will come back to redeem, or null if they never will. */
  redeemDay: number | null
}

export interface NewsItem {
  id: string
  headline: string
  body: string
  /** demandTags this story hints at. */
  tags: string[]
  direction: 'up' | 'down' | 'flat'
}

export interface MarketState {
  /** Slow random-walk multiplier per demandTag (1 = normal). */
  drift: Record<string, number>
  /** Today's paper. */
  news: NewsItem[]
}

export interface SpecialistState {
  retained: boolean
  /** 0–1, grows with steady payment. */
  relationship: number
  /** Calls used in the current billing month. */
  callsUsed: number
  /** Day the current retainer started (or 0). */
  sinceDay: number
  /** M4 arcs (save v6): retainers paid in full since sinceDay (reset when released). */
  months: number
  /** M4 arcs: what their calls turned out to be (see SpecialistEvent). */
  events: Partial<Record<SpecialistEvent, number>>
  /** M4 arcs: what their small arc changed about them. */
  mods: SpecialistMods
  /** M4 arcs: items they lowballed that you then bought, until you sell them. */
  lowballed: string[]
  /** M4 arcs: the last day you let them go (their arc's last beat is skipped if it was under way). */
  releasedDay?: number
  /** M4 arcs: gone for good; can't be retained again. */
  retired?: boolean
}

/**
 * Counted per specialist (M4 arcs). soundBig: a sound call on a genuine piece worth ≥ specialistArcs.bigValue.
 * wrong: the call missed (not counting lowballs). wrongSound: called sound, wasn't. wrongBought: a missed call
 * on a piece you then bought. lowballSold: they lowballed a piece you bought and later sold.
 */
export type SpecialistEvent = 'soundBig' | 'wrong' | 'wrongSound' | 'wrongBought' | 'lowballSold'

/** How a specialist's arc changed them (M4). Absent fields = as on the roster. */
export interface SpecialistMods {
  /** Added to roster accuracy (Ilya's drift, Zhenya slowing down). */
  accuracy?: number
  /** Added to accuracy at each month end on retainer (negative: slipping). */
  driftPerMonth?: number
  /** Their lowball chance × this. */
  lowball?: number
  /** Their call takes this many seconds (overrides the roster). */
  callSeconds?: number
  freeMonths?: number
  freeCalls?: number
  firstRefusal?: boolean
  /** One referred buyer a month for these categories; referralMonth = 'YYYY-MM' of the last one. */
  referral?: string[]
  referralMonth?: string
  sellBoost?: { categories: string[]; factor: number }
  rentIn?: number
}

/** An active "turns up more for a while" (M4 specialist warnings): tuning.specialistArcs.boosts[id] until this day. */
export interface StoryBoost {
  id: string
  /** Last day it runs (inclusive). */
  until: number
}

export interface InspectState {
  findings: Finding[]
  toolUses: Partial<Record<ToolId, number>>
  /** The player's own value estimate, entered before offering. */
  estimate: number | null
}

/**
 * story (M4): cash a story beat moved outside a deal (a gift, an old debt).
 * theft: shoplifted off an open shelf (M4). deterred: security stopped one (a note, no cash).
 * staff: a note about the appraiser's work (M6): a mistake found at closing, an insulted seller (no cash).
 */
export type LedgerKind = 'buy' | 'sell' | 'walkout' | 'pass' | 'expense' | 'loan' | 'redeem' | 'forfeit' | 'story' | 'theft' | 'deterred' | 'staff'

export interface LedgerEntry {
  kind: LedgerKind
  /** Signed cash delta, rubles (buys negative). */
  amount: number
  text: string
  itemId?: string
  defId?: string
}

export interface DayState {
  phase: 'open' | 'closed'
  /** In-game seconds since the shop opened today. */
  clock: number
  served: number
  total: number
  openingCash: number
  log: LedgerEntry[]
  /** False while today's paper is still unread (the news screen shows first). */
  newsRead: boolean
  /** Net reputation change per group today (M4; absent until something moves). Drives the ledger's trend lines. */
  repDelta?: Record<string, number>
  /**
   * Clock second at which the next person in the queue walks in (the lull
   * between visitors). Unset in older saves: they walk in on the next tick.
   */
  nextArrival?: number
}

/** Compact record of a finished day (kept in saves; full logs are not). */
export interface DaySummary {
  day: number
  openingCash: number
  closingCash: number
  bought: number
  spent: number
  sold: number
  earned: number
  walkouts: number
  /** M2+: rent, bills, retainers, upgrades (positive number). */
  expenses: number
  /** M2+: cash lent out on pawns today. */
  loaned: number
  /** M2+: cash repaid by redeeming pawners today. */
  redeemed: number
  /** M4+: items shoplifted tonight (absent in older saves = 0). */
  stolen?: number
}
