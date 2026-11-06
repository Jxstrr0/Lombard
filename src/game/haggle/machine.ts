/**
 * Haggle state machine (GDD §4): 2–5 rounds between the player and a seller.
 *
 * Pure and deterministic: same state + move + context + rng state gives the
 * same result. Inputs are never mutated. Every number lives in
 * `tuning.haggle`.
 *
 * ## Opening position (startHaggle)
 * - The seller *perceives* the item's value around `claimedValue` (what it'd
 *   be worth if genuine; they anchor on it even when it's fake, because they
 *   lie or don't know). Low knowledge = wide noise either way
 *   (± perceptionNoise × (1 − knowledge)); high knowledge = close, leaning
 *   slightly high (knowledgeBias × knowledge).
 * - Opening ask = perceived × askMarkup[temperament], tidied (proud and
 *   stubborn open high, desperate open low). Typically 70–120% of claimedValue.
 * - Hidden floor = perceived × (floorShare[temperament] − desperationFloorDrop
 *   × desperation), never below minFloorShare of perceived, never above ask.
 *   Stubborn and proud hold a higher floor.
 * - maxRounds = roundsByTemperament (stubborn/proud are shorter), sometimes
 *   one less, clamped to [minRounds, maxRounds].
 *
 * ## A round (haggleRound)
 * 1. The approach moves the seller first (see the table below).
 * 2. The offer is judged against the moved ask/floor:
 *    - offer ≥ ask → accepted at the offer, immediately;
 *    - offer under insultRatio × claimedValue (and under the floor) → insult:
 *      irritation jumps; a proud seller may walk on the spot;
 *    - offer ≥ floor → accepted with a chance that grows with the round,
 *      with how close the offer is to the ask, with desperation, and with a
 *      well-fitted approach; certain on the final answer;
 *    - otherwise they counter: the ask moves toward the offer by
 *      concession[temperament] (+ concessionPerRound per round played) of the
 *      gap, tidied, never below the floor, never above the previous ask, and
 *      always above the offer.
 * 3. Every counter adds irritation (irritationPerRound, plus extra for offers
 *    far below the ask). At irritation 1, or on the last round, the answer is
 *    final: accept if offer ≥ floor, else walk.
 *
 * ## Approach × temperament
 * | approach  | stubborn          | flexible        | desperate          | proud                        |
 * |-----------|-------------------|-----------------|--------------------|------------------------------|
 * | straight  | small steps       | big steps       | big steps          | small steps, quick to anger  |
 * | evidence  | strong negative authenticity/condition finding: floor and ask drop (more if they know their stuff, much more if the item truly isn't genuine); proud also bristle. Weak (provenance) = small drop, some irritation. Positive/neutral/missing = backfire: irritation up, ask holds, floor firms. Repeating a finding = nothing but irritation. |
 * | sympathy  | "spare me": +irr  | no effect       | works: −irr, bigger steps, likelier yes; costs margin (floor +7% once) | same as desperate |
 * | walk      | shrug (+irr; may call a lowball bluff) | floor −a bit, bigger step | floor drops a lot (scaled by desperation), bigger step | insulted: big irritation, may tell you to go |
 *
 * Threats lose half their effect each time they are repeated and annoy more.
 *
 * ## Responses
 * price: accept → the offer; counter → their new ask; walk → their last stated
 * ask. lineKey always exists in `haggleLines` (src/data/lines.ts); the plain
 * `<kind>.<temperament>` keys carry the temperament tells.
 */
import { tuning } from '../../data/tuning'
import type { Rng } from '../rng'
import type { Approach, Finding, HaggleResponse, HaggleState, ItemInstance, Mood, Temperament, WalkIn } from '../types'

export interface HaggleContext {
  customer: WalkIn
  item: ItemInstance
  /** What it would be worth if genuine (appraise/value.ts claimedValue). Customers anchor on this. */
  claimedValue: number
  /** Findings revealed during inspection (evidence candidates). */
  findings: readonly Finding[]
  /** M4: a regular's trust in you (−1…1): trusting regulars open lower and hold a lower floor. */
  trust?: number
}

export interface HaggleMove {
  offer: number
  approach: Approach
  /** Required when approach = evidence. */
  evidenceId?: string
}

const H = tuning.haggle

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const clamp01 = (x: number) => clamp(x, 0, 1)

function priceUnit(x: number): number {
  return x >= H.roundTo.bigFrom ? H.roundTo.big : H.roundTo.small
}

/** Round to a tidy price: nearest 100 ₽ from 2,000 ₽ up, nearest 10 ₽ below. */
export function tidyPrice(x: number): number {
  const unit = priceUnit(x)
  return Math.max(H.roundTo.small, Math.round(x / unit) * unit)
}

/** Smallest tidy price ≥ x. */
function tidyUp(x: number): number {
  const unit = priceUnit(x)
  return Math.max(H.roundTo.small, Math.ceil(x / unit) * unit)
}

export function startHaggle(ctx: HaggleContext, rng: Rng): HaggleState {
  const { temperament: t } = ctx.customer
  const knowledge = clamp01(ctx.customer.knowledge)
  const desperation = clamp01(ctx.customer.desperation)
  const spread = H.perceptionNoise * (1 - knowledge)
  const perceived = Math.max(0, ctx.claimedValue * (1 + H.knowledgeBias * knowledge + rng.range(-spread, spread)))
  const trust = clamp(ctx.trust ?? 0, -1, 1)
  const ask = tidyPrice(perceived * H.askMarkup[t] * (1 - tuning.regulars.askPerTrust * trust))
  const share = Math.max(H.minFloorShare, H.floorShare[t] - H.desperationFloorDrop * desperation)
  const floor = Math.min(ask, Math.round(perceived * share * (1 - tuning.regulars.floorPerTrust * trust)))
  const rounds = H.roundsByTemperament[t] - (rng.chance(H.shortRoundChance) ? 1 : 0)
  const maxRounds = clamp(rounds, H.minRounds, H.maxRounds)
  return { ask, floor, round: 0, maxRounds, irritation: 0, status: 'open', history: [] }
}

/** How a cited finding lands. */
type EvidenceKind = 'strong' | 'weak' | 'backfire' | 'repeat'

/** What the approach did this round; picks the line. */
type Effect =
  | 'straight'
  | 'evidence'
  | 'evidenceWeak'
  | 'evidenceBackfire'
  | 'evidenceRepeat'
  | 'sympathy'
  | 'sympathyShrug'
  | 'threatWorked'
  | 'threatShrug'
  | 'threatInsulted'

function classifyEvidence(finding: Finding | undefined): Exclude<EvidenceKind, 'repeat'> {
  if (!finding || finding.polarity !== 'negative') return 'backfire'
  if (finding.reveals === 'authenticity' || finding.reveals === 'condition') return 'strong'
  return 'weak'
}

export function haggleRound(
  state: HaggleState,
  move: HaggleMove,
  ctx: HaggleContext,
  rng: Rng,
): { state: HaggleState; response: HaggleResponse } {
  if (state.status !== 'open') {
    // Already over: repeat the last answer and change nothing.
    const last = state.history[state.history.length - 1]?.response
    const t = ctx.customer.temperament
    return {
      state,
      response: last ?? { kind: 'walk', price: state.ask, mood: 'annoyed', lineKey: `walk.${t}` },
    }
  }

  const t: Temperament = ctx.customer.temperament
  const knowledge = clamp01(ctx.customer.knowledge)
  const desperation = clamp01(ctx.customer.desperation)
  const offer = move.offer
  const played = state.round
  const isFinal = played + 1 >= state.maxRounds
  const lastAsk = state.ask

  let ask = state.ask
  let floor = state.floor
  let irritation = state.irritation
  let concession = H.concession[t] + H.concessionPerRound * played
  let acceptBonus = 0
  let effect: Effect = 'straight'
  let walkOut = false

  // 1. The approach moves the seller.
  switch (move.approach) {
    case 'straight':
      break

    case 'evidence': {
      const finding = move.evidenceId ? ctx.findings.find((f) => f.id === move.evidenceId) : undefined
      let kind: EvidenceKind = classifyEvidence(finding)
      const reused = state.history.some((r) => r.approach === 'evidence' && r.evidenceId === move.evidenceId)
      if (reused && kind !== 'backfire') kind = 'repeat'
      if (kind === 'strong' || kind === 'weak') {
        let drop = H.evidenceDrop + H.evidenceKnowledgeDrop * knowledge
        if (kind === 'strong' && finding?.reveals === 'authenticity' && ctx.item.authenticity !== 'genuine') {
          drop += H.evidenceFakeDrop + H.evidenceFakeKnowledgeDrop * knowledge
        }
        if (kind === 'weak') drop *= H.evidenceWeakFactor
        drop = Math.min(drop, 0.8)
        floor = floor * (1 - drop)
        ask = Math.max(floor, ask * (1 - Math.min(0.85, drop * H.evidenceAskFactor)))
        if (kind === 'weak') irritation += H.evidenceWeakIrritation
        else if (t === 'proud') irritation += H.evidenceProudIrritation
        effect = kind === 'strong' ? 'evidence' : 'evidenceWeak'
      } else if (kind === 'repeat') {
        irritation += H.evidenceRepeatIrritation
        effect = 'evidenceRepeat'
      } else {
        irritation += H.evidenceBackfireIrritation
        floor = Math.min(ask, floor * (1 + H.evidenceBackfireFloorRise))
        concession = 0 // the ask firms this round
        effect = 'evidenceBackfire'
      }
      break
    }

    case 'sympathy': {
      if (t === 'proud' || t === 'desperate') {
        const firstTime = !state.history.some((r) => r.approach === 'sympathy')
        if (firstTime) floor = Math.min(ask, floor * (1 + H.sympathyFloorRise))
        irritation += H.sympathyIrritation
        concession *= H.sympathyConcession
        acceptBonus += H.sympathyAccept
        effect = 'sympathy'
      } else {
        irritation += H.sympathyFlatIrritation[t]
        effect = 'sympathyShrug'
      }
      break
    }

    case 'walk': {
      const priorThreats = state.history.filter((r) => r.approach === 'walk').length
      const drop = (H.threatFloorDrop[t] * (0.5 + desperation)) / 2 ** priorThreats
      irritation += H.threatIrritation[t] * (1 + priorThreats)
      if (t === 'proud') {
        effect = 'threatInsulted'
        walkOut = rng.chance(H.proudThreatWalkChance)
      } else if (drop > 0) {
        floor = floor * (1 - drop)
        concession *= H.threatConcession
        acceptBonus += H.threatAccept
        effect = 'threatWorked'
      } else {
        effect = 'threatShrug'
        walkOut = offer < floor && rng.chance(H.stubbornThreatWalkChance)
      }
      break
    }
  }

  floor = Math.round(floor)
  ask = Math.max(ask, floor)

  const finish = (kind: HaggleResponse['kind'], price: number, mood: Mood, lineKey: string, nextAsk: number) => {
    const response: HaggleResponse = { kind, price, mood, lineKey }
    const next: HaggleState = {
      ...state,
      ask: nextAsk,
      floor: Math.min(floor, nextAsk),
      round: played + 1,
      irritation: clamp01(irritation),
      status: kind === 'accept' ? 'accepted' : kind === 'walk' ? 'walked' : 'open',
      history: [...state.history, { ...move, response }],
    }
    return { state: next, response }
  }

  const acceptKey = (reluctant: boolean): string => {
    if (reluctant) return 'accept.reluctant'
    if (effect === 'evidence') return 'accept.evidence'
    if (effect === 'sympathy') return 'accept.sympathy'
    if (effect === 'threatWorked') return 'accept.threat'
    return `accept.${t}`
  }

  // 2. Judge the offer.
  if (walkOut) return finish('walk', lastAsk, 'insulted', 'walk.threatCalled', lastAsk)

  if (offer >= ask) return finish('accept', offer, 'pleased', acceptKey(false), lastAsk)

  const insult = offer < H.insultRatio * ctx.claimedValue && offer < floor
  if (insult) {
    irritation += H.insultIrritation[t]
    const storms = irritation >= 1 || isFinal || (t === 'proud' && rng.chance(H.proudInsultWalkChance))
    if (storms) return finish('walk', lastAsk, 'insulted', 'walk.insulted', lastAsk)
    return finish('counter', lastAsk, 'insulted', 'counter.insulted', lastAsk)
  }

  // Wear from another round of back-and-forth.
  irritation += H.irritationPerRound[t] + H.gapIrritation * Math.max(0, H.gapGrace - offer / ask)
  const finalAnswer = isFinal || irritation >= 1

  if (offer >= floor) {
    if (finalAnswer) return finish('accept', offer, irritation >= H.warnIrritation ? 'annoyed' : 'neutral', 'accept.reluctant', lastAsk)
    const closeness = ask > floor ? (offer - floor) / (ask - floor) : 1
    const p =
      H.acceptBase[t] + H.acceptPerRound * played + H.acceptCloseness * closeness + H.acceptDesperation * desperation + acceptBonus
    if (rng.chance(p)) return finish('accept', offer, 'pleased', acceptKey(false), lastAsk)
  } else if (finalAnswer) {
    if (irritation >= 1) return finish('walk', lastAsk, 'insulted', 'walk.insulted', lastAsk)
    return finish('walk', lastAsk, 'annoyed', `walk.${t}`, lastAsk)
  }

  // 3. Counter: move toward the offer, never below the floor, never above the last ask, always above the offer.
  const raw = ask - (ask - offer) * Math.min(1, concession)
  let newAsk = tidyPrice(raw)
  if (newAsk < floor) newAsk = tidyUp(floor)
  if (newAsk <= offer) newAsk = tidyUp(offer + 1)
  newAsk = Math.min(newAsk, lastAsk)

  const mood: Mood =
    effect === 'evidenceBackfire' || effect === 'threatInsulted' || irritation >= 0.5 ? 'annoyed' : 'neutral'
  let lineKey: string
  if (irritation >= H.warnIrritation) lineKey = 'counter.lastChance'
  else if (effect !== 'straight') lineKey = `counter.${effect}`
  else if (newAsk - floor < priceUnit(newAsk)) lineKey = 'counter.floor'
  else lineKey = `counter.${t}`
  return finish('counter', newAsk, mood, lineKey, newAsk)
}
