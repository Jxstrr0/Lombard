/**
 * Zod schemas for item definitions (src/data/items/*.json).
 * Shapes follow docs/02-ARCHITECTURE.md § Data schemas, extended for M1.
 */
import { z } from 'zod'

export const CATEGORIES = [
  'gold',
  'watches',
  'phones',
  // later milestones:
  'militaria',
  'cameras',
  'electronics',
  'instruments',
  'icons',
  'coins',
  'tools',
  'sports',
  'antiques',
  'luxury',
] as const
export const Category = z.enum(CATEGORIES)
export type Category = z.infer<typeof Category>

/** M1 ships loupe, scale, magnet. The rest are declared so data can reference them later. */
export const TOOL_IDS = ['loupe', 'scale', 'magnet', 'uv', 'acid', 'reference', 'phone', 'specialist', 'passport'] as const
export const ToolId = z.enum(TOOL_IDS)
export type ToolId = z.infer<typeof ToolId>
export const M1_TOOLS: readonly ToolId[] = ['loupe', 'scale', 'magnet']

export const Reveals = z.enum(['authenticity', 'condition', 'provenance'])
export type Reveals = z.infer<typeof Reveals>

/** What the finding implies for value: negative findings are valid Evidence in haggling. */
export const Polarity = z.enum(['positive', 'neutral', 'negative'])
export type Polarity = z.infer<typeof Polarity>

export const Tell = z.object({
  /** Stable id, unique within the item def. A fake profile tell with the same id replaces it. */
  id: z.string().min(1),
  tool: ToolId,
  /** Player-facing finding text. Never says "fake"; describes what is seen. */
  finding: z.string().min(1),
  reveals: Reveals,
  polarity: Polarity,
  /** 0 = always noticed, 1 = almost never noticed on a single use. */
  difficulty: z.number().min(0).max(1),
  hotspot: z.string().optional(),
})
export type Tell = z.infer<typeof Tell>

export const FakeProfile = z.object({
  id: z.string().min(1),
  kind: z.enum(['fake', 'frankenstein', 'restored']),
  /** Tells that replace (same id) or add to the genuine tell set. */
  tells: z.array(Tell),
  /** Tell ids from the genuine set that this profile removes. */
  removeTells: z.array(z.string()).default([]),
  /** trueValue = genuine value × this. */
  valueMultiplier: z.number().min(0).max(2),
  /** Relative spawn weight among this def's fake profiles. */
  weight: z.number().positive().default(1),
  /** Measured weight = expected × this (plated brass rings weigh less, etc.). */
  weightFactor: z.number().positive().default(1),
  /** Override for the magnet tool. */
  magnetic: z.boolean().optional(),
})
export type FakeProfile = z.infer<typeof FakeProfile>

export const Hotspot = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** Local position on the placeholder model, metres. */
  position: z.tuple([z.number(), z.number(), z.number()]),
})
export type Hotspot = z.infer<typeof Hotspot>

/** Items are primitives until M3; `placeholder` picks a procedural model in src/render/items.ts. */
export const PLACEHOLDER_MODELS = [
  'ring',
  'signet',
  'chain',
  'earrings',
  'watch',
  'phone',
  // M2
  'pendant',
  'camera',
  'lens',
  'medal',
  'order',
  'badge',
  'coin',
  // M4
  'laptop',
  // M5
  'icon',
] as const

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const ItemModel = z.object({
  glb: z.string().optional(),
  placeholder: z.enum(PLACEHOLDER_MODELS),
  /** Main material colour for the placeholder (hex). */
  color: HexColor,
  scale: z.number().positive().default(1),
  /**
   * How it rests on the counter mat. `flat`: lying down, front (+Z) up, as a phone or coin
   * would. `upright`: standing as modelled, +Y up, front towards the player (a laptop with
   * its lid open). Upright items also start the inspect view looking down at them.
   */
  rest: z.enum(['flat', 'upright']).default('flat'),
  /** Medal ribbons: equal-width vertical stripes, left to right. */
  ribbon: z.array(HexColor).min(1).optional(),
  /** Which relief/print a medal or coin placeholder draws (free-form key, see src/render/items.ts). */
  emblem: z.string().optional(),
  /** Camera distance in inspect mode, metres. */
  inspectDistance: z.number().positive(),
  hotspots: z.array(Hotspot).default([]),
})

export const ItemDef = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  category: Category,
  name: z.string().min(1),
  brand: z.string().optional(),
  era: z.string().optional(),
  /** Genuine, good condition, in rubles. */
  baseValue: z.object({ min: z.number().positive(), max: z.number().positive() }),
  valueCurve: z.enum(['linear', 'collector']),
  weightGrams: z.object({ expected: z.number().positive(), tolerance: z.number().nonnegative() }).optional(),
  /** Does the genuine item attract a magnet? */
  magnetic: z.boolean(),
  /** Spawn weight among all defs. */
  rarity: z.number().positive().default(1),
  /** M5: only a story brings it in (the Collector's icon): never a walk-in's, a bulletin's or a fence's piece. */
  storyOnly: z.boolean().default(false),
  /** Chance an instance of this def is not genuine (before tuning multipliers). */
  fakeChance: z.number().min(0).max(1),
  tells: z.array(Tell),
  fakeProfiles: z.array(FakeProfile).min(1),
  demandTags: z.array(z.string()),
  /** Lines a customer might say when presenting it. {name} is the item name. */
  claims: z.array(z.string().min(1)).min(1),
  model: ItemModel,
})
export type ItemDef = z.infer<typeof ItemDef>

export const ItemDefFile = z.array(ItemDef)
