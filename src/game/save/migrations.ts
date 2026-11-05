/**
 * Save migrations: an ordered list, one step per schema-changing version.
 *
 * RULE: every commit that changes the shape of GameState must bump
 * STATE_VERSION in state.ts AND append a `{ from, to, up }` step here.
 * Saves and save codes from any older version must keep loading.
 *
 * Steps work on untyped data (`Raw`), never on GameState, because the old
 * shape no longer exists in the codebase.
 */
import { z } from 'zod'
import { STATE_VERSION, type GameState } from '../state'

export const CURRENT_VERSION = STATE_VERSION

/** Thrown for anything that is not a loadable save. `kind` tells the UI why. */
export class SaveFormatError extends Error {
  readonly kind: 'invalid' | 'future'

  constructor(message: string, kind: 'invalid' | 'future' = 'invalid') {
    super(message)
    this.name = 'SaveFormatError'
    this.kind = kind
  }
}

export type Raw = Record<string, unknown>

export interface Migration {
  from: number
  to: number
  up(raw: Raw): Raw
}

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * v1 (M0) → v2 (M1): the day loop arrived. Queue/visit/inspect/haggle got real
 * shapes, so the M0 placeholders are cleared; the day starts closed; purchase
 * prices (`paid`), day state, history and fuller stats appear.
 */
const v1ToV2: Migration = {
  from: 1,
  to: 2,
  up(raw) {
    const meta = isRecord(raw.meta) ? raw.meta : {}
    const stats = isRecord(raw.stats) ? raw.stats : {}
    const cash = typeof raw.cash === 'number' ? raw.cash : 0
    const inventory = Array.isArray(raw.inventory) ? raw.inventory : []
    // M0 could not buy anything, so inventory is normally empty. If it is not,
    // price each item at its true value so profit tracking starts neutral.
    const paid: Record<string, number> = {}
    for (const it of inventory) {
      if (isRecord(it) && typeof it.id === 'string') paid[it.id] = typeof it.trueValue === 'number' ? it.trueValue : 0
    }
    return {
      ...raw,
      meta: { ...meta, nextId: 1 },
      paid,
      queue: [],
      current: null,
      inspect: null,
      haggle: null,
      day: { phase: 'closed', clock: 0, served: 0, total: 0, openingCash: cash, log: [] },
      history: [],
      stats: {
        customersSeen: typeof stats.customersSeen === 'number' ? stats.customersSeen : 0,
        itemsBought: 0,
        itemsSold: 0,
        totalSpent: 0,
        totalEarned: 0,
        bestDeal: 0,
        worstDeal: 0,
        fakesBought: 0,
      },
    }
  },
}

/** Ordered, contiguous chain. Append new steps at the end. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2]

const num = z.number().finite()
const rec = z.record(z.string(), z.unknown())
const itemLike = z.looseObject({ id: z.string(), defId: z.string() })

/** Light structural check of the current shape: top-level keys and meta, not every leaf. */
const GameStateShape = z.looseObject({
  meta: z.looseObject({
    version: z.literal(CURRENT_VERSION),
    seed: num,
    careerId: z.string().min(1),
    rng: num,
    nextId: num,
  }),
  calendar: z.looseObject({ day: num, weekday: num, season: z.string(), date: z.string() }),
  cash: num,
  shop: z.looseObject({ slots: z.array(z.unknown()), upgrades: z.array(z.unknown()), security: num }),
  inventory: z.array(itemLike),
  paid: z.record(z.string(), num),
  loans: z.array(z.unknown()),
  customers: rec,
  queue: z.array(z.looseObject({ visitId: z.string(), item: itemLike })),
  current: z.looseObject({ visitId: z.string(), phase: z.string(), item: itemLike }).nullable(),
  inspect: z.looseObject({ findings: z.array(z.unknown()) }).nullable(),
  haggle: z.looseObject({ ask: num, floor: num }).nullable(),
  day: z.looseObject({ phase: z.enum(['open', 'closed']), clock: num, openingCash: num, log: z.array(z.unknown()) }),
  history: z.array(z.unknown()),
  crime: rec,
  story: rec,
  reputation: rec,
  stats: z.looseObject({ customersSeen: num }),
  settings: rec,
  narration: z.string(),
})

/** Bring any older saved state up to CURRENT_VERSION. Throws SaveFormatError on garbage. */
export function migrate(raw: unknown): GameState {
  if (!isRecord(raw)) throw new SaveFormatError('Save is not an object')
  const version = isRecord(raw.meta) ? raw.meta.version : undefined
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveFormatError('Save has no version')
  }
  if (version > CURRENT_VERSION) {
    throw new SaveFormatError(`Save is version ${version}, this build understands up to ${CURRENT_VERSION}`, 'future')
  }
  let data: Raw = raw
  for (let v = version; v < CURRENT_VERSION; ) {
    const step = MIGRATIONS.find((m) => m.from === v)
    if (!step) throw new SaveFormatError(`No migration from save version ${v}`)
    let out: Raw
    try {
      out = step.up(data)
    } catch (err) {
      throw new SaveFormatError(`Save could not be upgraded from version ${v} (${(err as Error).message})`)
    }
    data = { ...out, meta: { ...(isRecord(out.meta) ? out.meta : {}), version: step.to } }
    v = step.to
  }
  const result = GameStateShape.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new SaveFormatError(`Save is damaged (${issue?.path.join('.') || 'root'}: ${issue?.message ?? 'invalid'})`)
  }
  return data as unknown as GameState
}
