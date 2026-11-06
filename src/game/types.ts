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
}

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

export type VisitPhase = 'present' | 'inspect' | 'offer' | 'resolved'
/**
 * bought / pawned: you took the item. sold: a buyer took one of yours.
 * redeemed: a pawner paid off their loan. passed / walked / left: no deal.
 */
export type VisitOutcome = 'bought' | 'pawned' | 'sold' | 'redeemed' | 'passed' | 'walked' | 'left'

/**
 * seller: brings an item to sell or pawn (inspect → offer → haggle).
 * buyer: wants one of your displayed items (sale haggle, no inspect).
 * redeem: comes back to pay off a loan and collect their item.
 */
export type VisitKind = 'seller' | 'buyer' | 'redeem'
export type SellerWants = 'sell' | 'pawn'

export interface QueuedVisit {
  visitId: string
  kind: VisitKind
  customer: WalkIn
  /** seller: their item. buyer: a snapshot of the displayed item they want. redeem: the pledged item. */
  item: ItemInstance
  /** Seconds of in-game time they will wait in the queue before leaving. */
  patience: number
  /** seller only. */
  wants?: SellerWants
  /** redeem only. */
  loanId?: string
  /** Opening line at the counter (default: item.story). */
  line?: string
}

export interface VisitState {
  visitId: string
  kind: VisitKind
  wants?: SellerWants
  loanId?: string
  /** buyer only: the sale haggle (null for other kinds). */
  sale: SaleState | null
  customer: WalkIn
  item: ItemInstance
  phase: VisitPhase
  /** What the customer is saying right now. */
  line: string
  /** In-game seconds spent at the counter. */
  elapsed: number
  outcome?: VisitOutcome
  /** Cash that changed hands: price paid (bought), principal (pawned), sale price (sold), amount repaid (redeemed). */
  price?: number
}

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
}

export interface InspectState {
  findings: Finding[]
  toolUses: Partial<Record<ToolId, number>>
  /** The player's own value estimate, entered before offering. */
  estimate: number | null
}

/** theft: shoplifted off an open shelf (M4). deterred: security stopped one (a note, no cash). */
export type LedgerKind = 'buy' | 'sell' | 'walkout' | 'pass' | 'expense' | 'loan' | 'redeem' | 'forfeit' | 'theft' | 'deterred'

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
