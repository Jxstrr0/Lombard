/**
 * Shared domain types for M1. Modules own their logic; this file owns the
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
export type VisitOutcome = 'bought' | 'passed' | 'walked' | 'left'

export interface QueuedVisit {
  visitId: string
  customer: WalkIn
  item: ItemInstance
  /** Seconds of in-game time they will wait in the queue before leaving. */
  patience: number
}

export interface VisitState {
  visitId: string
  customer: WalkIn
  item: ItemInstance
  phase: VisitPhase
  /** What the customer is saying right now. */
  line: string
  /** In-game seconds spent at the counter. */
  elapsed: number
  outcome?: VisitOutcome
  /** Price paid when outcome = bought. */
  price?: number
}

export interface InspectState {
  findings: Finding[]
  toolUses: Partial<Record<ToolId, number>>
  /** The player's own value estimate, entered before offering. */
  estimate: number | null
}

export type LedgerKind = 'buy' | 'sell' | 'walkout' | 'pass' | 'expense'

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
}
