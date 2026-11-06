/**
 * Zod schemas for the economy data files (src/data/upgrades.ts, src/data/specialists.ts).
 * Numbers (costs, fees, accuracy) live in tuning.ts; the data files reference them.
 */
import { z } from 'zod'
import { Category, ToolId } from './item'

const SlotArea = z.enum(['counter', 'wall', 'back'])

export const UpgradeDef = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  /** One line for the office sheet. */
  blurb: z.string().min(1),
  cost: z.number().int().positive(),
  /** Upgrade ids that must be owned first. */
  requires: z.array(z.string()).default([]),
  /** Office section: tools and books, cases and security (M4), or staff (M6: the second counter). */
  group: z.enum(['tools', 'security', 'staff']).default('tools'),
  /** M6: not offered before this career day (a mid-game purchase). */
  fromDay: z.number().int().positive().optional(),
  effects: z
    .object({
      /** Unlocks this tool (for the categories below, if given). */
      unlockTool: ToolId.optional(),
      toolCategories: z.array(Category).optional(),
      /** Acid tests that come with it. */
      acidCharges: z.number().int().positive().optional(),
      /** Reference book tier it provides. */
      refTier: z.number().int().min(2).max(3).optional(),
      /** Buyer-visibility multiplier per display area. */
      visibility: z.partialRecord(SlotArea, z.number().positive()).optional(),
      /** Added to shop.security (deters shoplifting; src/game/shop/theft.ts). */
      security: z.number().optional(),
      /** Display areas thieves can't reach once this is installed (M4). */
      protects: z.array(SlotArea).optional(),
      /** Records what happens in the shop: evidence for the M5 crime layer (stored only). */
      records: z.boolean().optional(),
    })
    .default({}),
})
export type UpgradeDef = z.infer<typeof UpgradeDef>

export const ReferenceBook = z.object({
  tier: z.number().int().min(1).max(3),
  /** "the old price guide": used in findings ("The old price guide lists…"). */
  title: z.string().min(1),
  /** Short label for the toolbar note. */
  short: z.string().min(1),
  /** Categories this edition predates (useless finding). */
  outdated: z.array(Category).default([]),
})
export type ReferenceBook = z.infer<typeof ReferenceBook>

/** Verdict kinds a specialist can give (never a flat "fake"). */
export const VERDICTS = ['sound', 'redone', 'mixed', 'doubt', 'lowball'] as const
export type Verdict = (typeof VERDICTS)[number]

const Lines = z.array(z.string().min(1)).min(1)

export const SpecialistDef = z.object({
  /** Key into tuning.specialists.roster (fee, calls, accuracy, honesty). */
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  /** Name used in findings ("Ilya squints: …"). */
  short: z.string().min(1),
  role: z.string().min(1),
  categories: z.array(Category).min(1),
  /** A hint of who they are, for the office sheet. */
  blurb: z.string().min(1),
  /**
   * Verdict lines. Placeholders: {lo} {hi} (formatted rubles), {item}.
   * sound = all as it should be; redone = restored/refinished; mixed = parts that
   * don't belong together; doubt = not what it claims; lowball = a dishonest
   * "not worth much" on a sound piece (with a hint they'd buy it themselves).
   */
  lines: z.object({
    sound: Lines,
    redone: Lines,
    mixed: Lines,
    doubt: Lines,
    lowball: Lines,
  }),
  /**
   * M6: lines for one category that replace `lines` for that verdict (Zhenya talks phones by
   * default, so tools get their own). Same placeholders.
   */
  categoryLines: z
    .record(
      z.string(),
      z.object({ sound: Lines, redone: Lines, mixed: Lines, doubt: Lines, lowball: Lines }).partial(),
    )
    .optional(),
  /** Said when you retain them (office sheet status). */
  hello: z.string().min(1),
  /** M4 arcs: their cast id (src/data/customers/cast.json) when they come to the counter. Phone-only: leave out. */
  look: z.string().optional(),
})
export type SpecialistDef = z.infer<typeof SpecialistDef>
