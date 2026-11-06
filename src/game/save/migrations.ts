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
import { tuning } from '../../data/tuning'
import { flagAxis } from '../endings/axes'
import { addDays, createCrimeState, createSlots, STATE_VERSION, type GameState } from '../state'

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

/**
 * v2 (M1) → v3 (M2): display slots and tag prices, pawn loans with held items,
 * specialists, market/news, visit kinds, the career-start intro flag and the
 * shop name. An M1 career is already under way, so its intro counts as done and
 * its stock starts in the safe. Old loans were never creatable, so they are dropped.
 */
const v2ToV3: Migration = {
  from: 2,
  to: 3,
  up(raw) {
    const meta = isRecord(raw.meta) ? raw.meta : {}
    const shop = isRecord(raw.shop) ? raw.shop : {}
    const day = isRecord(raw.day) ? raw.day : {}
    const upgrades = Array.isArray(shop.upgrades) ? shop.upgrades : []
    const security = typeof shop.security === 'number' ? shop.security : 0
    const visit = (v: unknown) => (isRecord(v) ? { kind: 'seller', wants: 'sell', ...v } : v)
    const current = isRecord(raw.current) ? { sale: null, ...(visit(raw.current) as Raw) } : null
    const history = Array.isArray(raw.history)
      ? raw.history.map((h) => (isRecord(h) ? { expenses: 0, loaned: 0, redeemed: 0, ...h } : h))
      : []
    return {
      ...raw,
      meta: { ...meta, intro: false },
      shop: {
        name: tuning.career.defaultShopName,
        slots: createSlots(),
        prices: {},
        upgrades,
        acidCharges: 0,
        security,
      },
      loans: [],
      specialists: {},
      market: { drift: {}, news: [] },
      queue: Array.isArray(raw.queue) ? raw.queue.map(visit) : [],
      current,
      day: { ...day, newsRead: true },
      history,
    }
  },
}

/**
 * v3 (M3) → v4 (M4 story): regulars' memory and arc progress get real shapes.
 * Nothing wrote either before, so both start empty; story flags appear.
 */
const v3ToV4Story: Migration = {
  from: 3,
  to: 4,
  up(raw) {
    const story = isRecord(raw.story) ? raw.story : {}
    return {
      ...raw,
      customers: {},
      story: { arcs: {}, pendingEvents: Array.isArray(story.pendingEvents) ? story.pendingEvents : [], flags: [] },
    }
  },
}

/**
 * v4 → v5 (M4 reputation by group, shoplifting): a `youth` reputation group (the
 * local kids and students) starting at 0, and a career count of stolen items.
 * Other groups and the day's records are kept as they are; day summaries and
 * the day's rep tally gained optional fields only.
 */
const v4ToV5: Migration = {
  from: 4,
  to: 5,
  up(raw) {
    const reputation = isRecord(raw.reputation) ? raw.reputation : {}
    const byGroup = isRecord(reputation.byGroup) ? reputation.byGroup : {}
    const stats = isRecord(raw.stats) ? raw.stats : {}
    const group = (k: string) => (typeof byGroup[k] === 'number' ? byGroup[k] : 0)
    return {
      ...raw,
      reputation: {
        ...reputation,
        general: typeof reputation.general === 'number' ? reputation.general : 0,
        byGroup: {
          ...byGroup,
          neighbourhood: group('neighbourhood'),
          youth: group('youth'),
          police: group('police'),
          mob: group('mob'),
          specialists: group('specialists'),
        },
      },
      stats: { ...stats, itemsStolen: typeof stats.itemsStolen === 'number' ? stats.itemsStolen : 0 },
    }
  },
}

/** Month ends (billing days) on or after `from` and before `to` (ISO dates). */
function monthEndsBetween(from: string, to: string): number {
  let n = 0
  for (let d = from; d < to; d = addDays(d, 1)) if (addDays(d, 1).slice(5, 7) !== d.slice(5, 7)) n++
  return n
}

/**
 * v5 → v6 (M4 specialists' small arcs): each specialist record gets `months` (retainers paid in full
 * since sinceDay; estimated as the billing days since then, as if every one was paid), `events`,
 * `mods` and `lowballed`; the story gets `boosts`.
 */
const v5ToV6: Migration = {
  from: 5,
  to: 6,
  up(raw) {
    const calendar = isRecord(raw.calendar) ? raw.calendar : {}
    const day = typeof calendar.day === 'number' ? calendar.day : 1
    const date = typeof calendar.date === 'string' ? calendar.date : tuning.career.startDate
    const specialists: Raw = {}
    for (const [id, sp] of Object.entries(isRecord(raw.specialists) ? raw.specialists : {})) {
      if (!isRecord(sp)) continue
      const since = typeof sp.sinceDay === 'number' ? sp.sinceDay : 0
      const months = sp.retained === true && since > 0 && since <= day ? monthEndsBetween(addDays(date, since - day), date) : 0
      specialists[id] = { ...sp, months, events: {}, mods: {}, lowballed: [] }
    }
    const story = isRecord(raw.story) ? raw.story : {}
    return { ...raw, specialists, story: { ...story, boosts: [] } }
  },
}

/**
 * v6 → v7 (M4 story pledges): a beat that ended in a pawn now remembers its
 * loan and how the loan ended (`story.arcs[*].beats[*].loan`, optional). Beats
 * recorded before had no link to follow, so nothing is filled in: their
 * pledge conditions read as "never pawned". Only the version moves.
 */
const v6ToV7: Migration = {
  from: 6,
  to: 7,
  up(raw) {
    return raw
  },
}

/**
 * v7 → v8 (M5 foundation): the crime state gets the bulletin, Volkova, the fence and
 * scheduled events (heat, pressure, fenceTrust and flags kept); `career` arrives with
 * the ending axes, seeded from the heart.* / dirty.* story choices already made (deals
 * before v8 were not counted), and no ending; the stats get people helped and hurt.
 */
const v7ToV8: Migration = {
  from: 7,
  to: 8,
  up(raw) {
    const crime = isRecord(raw.crime) ? raw.crime : {}
    const fresh = createCrimeState()
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    const story = isRecord(raw.story) ? raw.story : {}
    const flags = Array.isArray(story.flags) ? story.flags.filter((f): f is string => typeof f === 'string') : []
    const axes = { clean: 0, heart: 0 }
    for (const f of flags) {
      const move = flagAxis(f)
      if (move) axes[move.axis] += move.delta
    }
    const stats = isRecord(raw.stats) ? raw.stats : {}
    return {
      ...raw,
      crime: {
        ...fresh,
        heat: n(crime.heat),
        pressure: n(crime.pressure),
        fenceTrust: n(crime.fenceTrust),
        flags: Array.isArray(crime.flags) ? crime.flags : [],
      },
      career: { axes, end: null },
      stats: { ...stats, peopleHelped: 0, peopleHurt: 0 },
    }
  },
}

/** Ordered, contiguous chain. Append new steps at the end. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2, v2ToV3, v3ToV4Story, v4ToV5, v5ToV6, v6ToV7, v7ToV8]

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
    intro: z.boolean(),
  }),
  calendar: z.looseObject({ day: num, weekday: num, season: z.string(), date: z.string() }),
  cash: num,
  shop: z.looseObject({
    name: z.string(),
    slots: z.array(z.looseObject({ id: z.string(), area: z.string() })),
    prices: z.record(z.string(), num),
    upgrades: z.array(z.unknown()),
    acidCharges: num,
    security: num,
  }),
  inventory: z.array(itemLike),
  paid: z.record(z.string(), num),
  loans: z.array(z.looseObject({ id: z.string(), item: itemLike, principal: num })),
  specialists: rec,
  market: z.looseObject({ drift: rec, news: z.array(z.unknown()) }),
  customers: rec,
  queue: z.array(z.looseObject({ visitId: z.string(), kind: z.string(), item: itemLike })),
  current: z.looseObject({ visitId: z.string(), kind: z.string(), phase: z.string(), item: itemLike }).nullable(),
  inspect: z.looseObject({ findings: z.array(z.unknown()) }).nullable(),
  haggle: z.looseObject({ ask: num, floor: num }).nullable(),
  day: z.looseObject({ phase: z.enum(['open', 'closed']), clock: num, openingCash: num, log: z.array(z.unknown()) }),
  history: z.array(z.unknown()),
  crime: z.looseObject({ heat: num, pressure: num, bulletin: z.array(z.unknown()), volkova: rec, fence: rec, events: z.array(z.unknown()) }),
  career: z.looseObject({ axes: z.looseObject({ clean: num, heart: num }), end: rec.nullable() }),
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
