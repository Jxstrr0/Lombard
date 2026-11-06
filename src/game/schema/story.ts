/**
 * M4 schemas: regulars (authored recurring customers) and story arcs.
 *
 * A regular is a named person with a fixed 3D look, a temperament, things
 * they bring, a visiting rhythm and lines that change with how much they
 * trust you (their memory is GameState.customers[id]).
 *
 * An arc is a list of beats. A beat waits until all its conditions hold
 * (and a seeded chance passes), then one visit plays it: a regular walks in,
 * maybe talks first (a scene, maybe with a choice), maybe brings a scripted
 * item to inspect and haggle over, and when the visit ends its outcome is
 * recorded so later beats can branch on it. Declarative on purpose (docs/02
 * § Data schemas): no scripting language.
 */
import { z } from 'zod'
import { tuning } from '../../data/tuning'

const id = z.string().regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, _')
const beatId = z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/, 'arc.beat')
const unit = z.number().min(0).max(1)
const int = z.number().int()
const range = z.tuple([int, int]).refine(([a, b]) => a <= b, 'min ≤ max')

export const TemperamentSchema = z.enum(['stubborn', 'flexible', 'desperate', 'proud'])
export const AuthenticitySchema = z.enum(['genuine', 'fake', 'frankenstein', 'restored'])
export const ProvenanceSchema = z.enum(['clean', 'unknown', 'stolen', 'heirloom'])
export const GroupSchema = z.enum(['neighbourhood', 'youth', 'police', 'mob', 'specialists'])

const lines = z.array(z.string().min(1)).min(1)

/** What a regular brings on an ordinary visit (one entry is picked by weight). */
export const RegularItem = z.object({
  defId: z.string(),
  weight: z.number().positive().default(1),
  /** Leave out for the item's own odds of being fake. */
  authenticity: AuthenticitySchema.optional(),
  provenance: ProvenanceSchema.optional(),
  /** Condition range [min, max] (0–100), e.g. suspiciously new. Only with `authenticity`; default: the usual range. */
  condition: range.optional(),
  /** Their claim about it; default: one of the item def's claims. */
  story: lines.optional(),
}).refine((e) => e.condition === undefined || e.authenticity !== undefined, 'condition needs authenticity')

export const RegularDef = z.object({
  id,
  /** As shown at the counter, e.g. "Zinaida Petrovna". Distinct from walk-in first names. */
  name: z.string().min(1),
  /** A walk-in archetype id (src/data/customers/walkins.ts) for the label under the name. */
  archetype: z.string(),
  /** Their cast id (src/data/customers/cast.json): always the same person. */
  look: z.string(),
  temperament: TemperamentSchema,
  knowledge: unit,
  desperation: unit,
  /** One line for the People page: who they are, as the shopkeeper would put it. */
  bio: z.string().min(1),
  /**
   * Ordinary visits: first eligible day, then every [min, max] days after a
   * visit (seeded), optionally only on some weekdays (0 = Monday), and maybe
   * stopping on a day. Leave out for someone who only comes in for their arc.
   */
  schedule: z
    .object({
      from: int.min(1),
      every: range,
      weekdays: z.array(int.min(0).max(6)).optional(),
      until: int.optional(),
    })
    .optional(),
  /** Chance an ordinary visit is a pawn rather than a sale. */
  pawn: unit.default(0.3),
  items: z.array(RegularItem).default([]),
  lines: z.object({
    /** The first time they walk in. */
    first: lines,
    /** Coming back, neither warm nor cold. */
    again: lines,
    /** Coming back, trusting you. */
    warm: lines,
    /** Coming back after you burned them. */
    cold: lines,
  }),
})
export type RegularDef = z.infer<typeof RegularDef>
export type RegularItem = z.infer<typeof RegularItem>

/** Compare a number: at least / at most (both optional; both = a range). */
const cmp = z.object({ gte: z.number().optional(), lte: z.number().optional() })

const BaseCondition = z.discriminatedUnion('if', [
  /** Career day (1 = the first day). */
  z.object({ if: z.literal('day'), ...cmp.shape }),
  z.object({ if: z.literal('weekday'), in: z.array(int.min(0).max(6)).min(1) }),
  /** A story flag is set (or not). */
  z.object({ if: z.literal('flag'), flag: z.string(), not: z.boolean().optional() }),
  /**
   * A beat has played (or, with not, hasn't), optionally with one of these
   * outcomes or choice ids, at a price/true-value ratio, and some days ago.
   */
  z.object({
    if: z.literal('beat'),
    beat: beatId,
    not: z.boolean().optional(),
    outcome: z.array(z.string()).min(1).optional(),
    ratio: cmp.optional(),
    daysAgo: cmp.optional(),
  }),
  /** A regular's trust (−1…1) or number of visits. */
  z.object({ if: z.literal('trust'), who: id, ...cmp.shape }),
  z.object({ if: z.literal('visits'), who: id, ...cmp.shape }),
  /** Does this regular have a pawn loan open with you? */
  z.object({ if: z.literal('loan'), who: id, not: z.boolean().optional() }),
  /**
   * The loan made at a beat that ended in a pawn: still open, redeemed, or
   * forfeited to the shop. `daysAgo` counts from the day it ended (an open
   * pledge never meets it). With `not`, the whole test is reversed, so a beat
   * that wasn't pawned at all meets `{ is: ['open', 'forfeited'], not: true }`.
   */
  z.object({
    if: z.literal('pledge'),
    beat: beatId,
    is: z.array(z.enum(['open', 'redeemed', 'forfeited'])).min(1),
    daysAgo: cmp.optional(),
    not: z.boolean().optional(),
  }),
  /** A specialist on retainer (and their relationship 0–1). */
  z.object({ if: z.literal('specialist'), id, retained: z.boolean().default(true), relationship: cmp.optional() }),
  z.object({ if: z.literal('cash'), ...cmp.shape }),
  z.object({ if: z.literal('rep'), group: GroupSchema, ...cmp.shape }),
  // --- M4 specialists' small arcs (GDD § 2b) -----------------------------------------
  /** On retainer at least `gte` months: retainers paid in full since sinceDay, and that many × monthDays on the books. */
  z.object({ if: z.literal('retainedMonths'), id, gte: int.min(0) }),
  /** Something their calls turned out to be, counted (SpecialistEvent in src/game/types.ts). */
  z.object({ if: z.literal('specialistEvent'), id, event: z.enum(['soundBig', 'wrong', 'wrongSound', 'wrongBought', 'lowballSold']), gte: int.min(1).default(1) }),
  /** Another arc has started (a beat played), is running (started, not ended) or has ended. */
  z.object({ if: z.literal('arc'), arc: id, is: z.enum(['started', 'running', 'ended']).default('running'), not: z.boolean().optional() }),
  /** You hold something in this category (in stock, not on loan); `genuine`: and it really is. */
  z.object({ if: z.literal('stock'), category: z.string(), genuine: z.boolean().optional() }),
  /** The calendar date (MM-DD) is within from…to (inclusive; may wrap the year end). */
  z.object({ if: z.literal('date'), from: z.string().regex(/^\d\d-\d\d$/), to: z.string().regex(/^\d\d-\d\d$/) }),
  // --- M5 ---------------------------------------------------------------------------
  /** The hidden mob dial (crime.pressure, ≥ 0). */
  z.object({ if: z.literal('pressure'), ...cmp.shape }),
  // --- M5 the fence (src/game/crime/fence.ts) -------------------------------------------
  /** crime.fence: met (or not), deals and refusals on record, and fenceTrust (−1…1). */
  z.object({ if: z.literal('fence'), met: z.boolean().optional(), deals: cmp.optional(), refusals: cmp.optional(), trust: cmp.optional() }),
  // --- M5 police (src/game/crime/), for the Volkova arc and anything else that reads the police ---
  /** M5 the Collector: you hold this very kind of piece in stock (or, with `not`, don't). */
  z.object({ if: z.literal('holds'), defId: z.string(), not: z.boolean().optional() }),
  /** Police heat (0 = the police don't know you exist; unbounded). */
  z.object({ if: z.literal('heat'), ...cmp.shape }),
  /** Detective Volkova: met yet, her trust in you (−1…1), and how many lies, caught lies and bribes. */
  z.object({
    if: z.literal('volkova'),
    met: z.boolean().optional(),
    trust: cmp.optional(),
    lies: cmp.optional(),
    caught: cmp.optional(),
    bribes: cmp.optional(),
  }),
])

/** M4: at least one of these holds (one level: no `any` inside `any`). */
const AnyCondition = z.object({ if: z.literal('any'), of: z.array(BaseCondition).min(1) })

export const Condition = z.union([BaseCondition, AnyCondition])
export type Condition = z.infer<typeof Condition>

/**
 * When a story pawner comes back for their pledge, instead of the usual
 * hidden roll: with `chance` they come back `days` [min, max] after the loan
 * starts (seeded), otherwise never (the item is forfeited). `line` is what they
 * say walking in to redeem, `thanks` what they say once it's handed back.
 */
export const RedeemPlan = z.object({
  days: z.tuple([int.min(1), int.min(1)]).refine(([a, b]) => a <= b, 'min ≤ max'),
  chance: unit.default(1),
  line: z.string().min(1).optional(),
  thanks: z.string().min(1).optional(),
})
export type RedeemPlan = z.infer<typeof RedeemPlan>

const changeName = z.string().refine((k) => k in tuning.specialistArcs.changes, 'a tuning.specialistArcs.changes key')
const boostName = z.string().refine((k) => k in tuning.specialistArcs.boosts, 'a tuning.specialistArcs.boosts key')
const offerName = z.string().refine((k) => k in tuning.specialistArcs.offers, 'a tuning.specialistArcs.offers key')
const axisWeight = z.string().refine((k) => k in tuning.axes, 'a tuning.axes key') as z.ZodType<keyof typeof tuning.axes>
const fenceChange = z.string().refine((k) => k in tuning.fence.changes, 'a tuning.fence.changes key')

export const Effect = z.discriminatedUnion('do', [
  z.object({ do: z.literal('flag'), flag: z.string() }),
  z.object({ do: z.literal('unflag'), flag: z.string() }),
  z.object({ do: z.literal('trust'), who: id, delta: z.number() }),
  z.object({ do: z.literal('rep'), group: GroupSchema, delta: z.number() }),
  /** Cash changes hands outside a deal (a gift, a debt paid). Logged in the ledger. */
  z.object({ do: z.literal('cash'), amount: int, text: z.string() }),
  z.object({ do: z.literal('pressure'), delta: z.number() }),
  z.object({ do: z.literal('heat'), delta: z.number() }),
  /** No more beats from this arc. */
  z.object({ do: z.literal('endArc') }),
  /**
   * Renew this regular's open loan (pay interest only): they pay the interest
   * owed today (unless `charge` is false: you waive it), and the loan starts
   * a fresh term today on the same principal. `redeem` replans their return;
   * left out, it stays as it was.
   */
  z.object({ do: z.literal('renew'), who: id, charge: z.boolean().default(true), redeem: RedeemPlan.optional() }),
  // --- M4 specialists' small arcs (GDD § 2b) -----------------------------------------
  /** A named change to a specialist (tuning.specialistArcs.changes); `text` is the ledger line if it moves cash. */
  z.object({ do: z.literal('specialist'), id, change: changeName, text: z.string().optional() }),
  /** Something turns up more for a while (tuning.specialistArcs.boosts). */
  z.object({ do: z.literal('boost'), boost: boostName }),
  /** One person waiting in the line gives up and leaves (a walkout like any other). */
  z.object({ do: z.literal('walkout') }),
  /** A specialist buys from your stock (tuning.specialistArcs.offers). */
  z.object({ do: z.literal('sellTo'), id, offer: offerName }),
  // --- M5 ---------------------------------------------------------------------------
  /** Move an ending axis (src/game/endings/axes.ts) by a tuning.axes weight. */
  z.object({ do: z.literal('axis'), axis: z.enum(['clean', 'heart']), weight: axisWeight }),
  /** Vandalism tonight (src/game/crime/vandalism.ts): a brick through the counter case. */
  z.object({ do: z.literal('vandalism'), kind: z.enum(['brick']) }),
  /** A forced ending (src/game/endings/end.ts). */
  z.object({ do: z.literal('endCareer'), kind: z.enum(['evicted', 'raided', 'pushedOut']) }),
  // --- M5 the fence ---------------------------------------------------------------------
  /** A named change to the fence relationship (tuning.fence.changes): met, trust, a refusal, the next contact. */
  z.object({ do: z.literal('fence'), change: fenceChange }),
  // --- M5 Volkova's arc -----------------------------------------------------------------
  /** Detective Volkova's trust in you moves by `trust` (clamped to tuning.police.volkova trustMin…trustMax). */
  z.object({ do: z.literal('volkova'), trust: z.number() }),
  // --- M5 the Collector (src/game/crime/collector.ts) ----------------------------------
  /** The Collector's icon leaves the shop: sold to him (his price), back to its church, or to the police. */
  z.object({ do: z.literal('collector'), change: z.enum(['sold', 'returned', 'handedIn']) }),
])
export type Effect = z.infer<typeof Effect>

export const Choice = z.object({
  id,
  /** Button text, short: "Tell her the truth". */
  label: z.string().min(1).max(40),
  /** What they say back (shown as their line). */
  reply: z.string().min(1),
  effects: z.array(Effect).default([]),
  /** The visit ends after the reply (an item visit doesn't go on to the item). */
  end: z.boolean().default(false),
})
export type Choice = z.infer<typeof Choice>

/** A scripted item: what it is, exactly. Value comes from the item's own rules. */
export const ScriptItem = z.object({
  defId: z.string(),
  authenticity: AuthenticitySchema.default('genuine'),
  /** For a non-genuine item: which of the def's fake profiles (default: one of that kind). */
  fakeProfileId: z.string().optional(),
  provenance: ProvenanceSchema.default('clean'),
  condition: range.optional(),
  story: z.string().min(1),
  /**
   * The same thing every visit: beats sharing this key draw the item from one
   * stream seeded by the career, so it comes back with the same weight, value
   * and (for a fake) profile. A condition range a step lower shows the wear.
   */
  same: id.optional(),
})
export type ScriptItem = z.infer<typeof ScriptItem>

/** After the visit: a line (replaces the usual one) and effects, keyed by outcome, or `any`. */
const Aftermath = z.object({ line: z.string().optional(), effects: z.array(Effect).default([]) })

export const VisitScript = z
  .object({
    /** A regular's id: who walks in. */
    who: id,
    /** seller: talks (if there's a scene), then sells or pawns the item. scene: just talks. */
    kind: z.enum(['seller', 'scene']),
    wants: z.enum(['sell', 'pawn']).default('sell'),
    item: ScriptItem.optional(),
    scene: z.object({ lines: lines, choices: z.array(Choice).max(3).default([]) }).optional(),
    /** Their line when the item is on the mat (after the scene). Default: the item's story. */
    line: z.string().optional(),
    after: z.record(z.string(), Aftermath).default({}),
    /** A pawn beat: when (and whether) they come back to redeem; default: the usual hidden roll. */
    redeem: RedeemPlan.optional(),
    /** Walks in first today (before the line outside). */
    first: z.boolean().default(false),
    /**
     * M4: how it lands. counter: they walk in. phone: a call between customers (nobody walks in).
     * paper: a note in the morning paper (scene lines = headline, then body; no choices; plays as 'talked').
     * `who` may also name a specialist (src/data/specialists): they are the one talking.
     */
    via: z.enum(['counter', 'phone', 'paper']).default('counter'),
    /**
     * M5: a seller beat's seller anchors their asking price on this share of what the piece
     * would fetch (the crew's deliveries come cheap). Default: the usual claimed value.
     */
    anchor: unit.optional(),
    /** M4: someone sent by `who` walks in instead (a one-off stranger; `who` still owns the beat). */
    as: z
      .object({
        name: z.string().min(1),
        archetype: z.string(),
        look: z.string(),
        temperament: TemperamentSchema,
        knowledge: unit,
        desperation: unit,
      })
      .optional(),
  })
  .refine((v) => v.kind === 'scene' || v.item !== undefined, 'a seller beat needs an item')
  .refine((v) => v.via !== 'paper' || (v.kind === 'scene' && (v.scene?.choices.length ?? 0) === 0), 'a paper beat is a scene without choices')
  .refine((v) => v.via === 'counter' || v.kind === 'scene', 'only counter visits bring an item')
  .refine((v) => v.kind === 'seller' || v.scene !== undefined, 'a scene beat needs a scene')
  .refine((v) => !v.redeem || (v.kind === 'seller' && v.wants === 'pawn'), 'a redeem plan needs a pawn beat')
export type VisitScript = z.infer<typeof VisitScript>

export const Beat = z.object({
  id: beatId,
  /** All must hold on the morning the beat can play. */
  when: z.array(Condition).default([]),
  /** Chance per eligible morning (seeded), so beats don't land like clockwork. */
  chance: unit.default(1),
  visit: VisitScript,
  /** M4: the arc's last beat; a specialist released while their arc was under way never plays it. */
  final: z.boolean().default(false),
})
export type Beat = z.infer<typeof Beat>

export const Arc = z
  .object({
    id,
    title: z.string().min(1),
    /**
     * M4: a specialist's small arc. Its beats wait while they're off retainer (or retired),
     * and a `final` beat is skipped for good once they were let go mid-arc (GDD § 2b).
     */
    specialist: id.optional(),
    beats: z.array(Beat).min(1),
  })
  .refine((a) => a.beats.every((b) => b.id.startsWith(`${a.id}.`)), 'beat ids start with the arc id')
export type Arc = z.infer<typeof Arc>
