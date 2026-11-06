/** M2 content: the 30 item defs, seasonal demand, the morning paper and the career start. */
import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, RAW_ITEM_FILES, getItemDef } from '../src/data/items'
import { FIRST_DAY, FLAVOUR_NEWS, HINT_ALIAS, HINT_NEWS, HOLIDAY_NEWS, SHOCK_NEWS } from '../src/data/news'
import { LEFTOVER_POOLS } from '../src/data/intro'
import { tuning } from '../src/data/tuning'
import { reducer } from '../src/game/actions'
import { leftoverStock } from '../src/game/career/start'
import { DEMAND_TAGS, activeHolidays, demandMultiplier, inWindow, updateMarket } from '../src/game/economy/demand'
import { Rng } from '../src/game/rng'
import { ItemDef } from '../src/game/schema/item'
import { addDays, createInitialState, seasonOf, weekdayOf, type GameState } from '../src/game/state'

const ids = () => {
  let n = 0
  return (prefix: string) => `${prefix}${++n}`
}

/** A fresh state moved to `date`, with neutral drift. */
function onDate(date: string, base: GameState = createInitialState(1, 'c')): GameState {
  return { ...base, calendar: { day: 10, date, weekday: weekdayOf(date), season: seasonOf(date) }, market: { drift: {}, news: [] } }
}

/** Run the market forward `days` days from the career start, one updateMarket per morning. */
function runPaper(seed: number, days: number): GameState[] {
  let s: GameState = { ...createInitialState(seed, 'c'), meta: { ...createInitialState(seed, 'c').meta, intro: false } }
  const out: GameState[] = []
  const rng = new Rng(seed)
  for (let d = 0; d < days; d++) {
    const date = addDays(tuning.career.startDate, d)
    s = { ...s, calendar: { day: d + 1, date, weekday: weekdayOf(date), season: seasonOf(date) } }
    s = { ...s, market: updateMarket(s, rng) }
    rng.next() // the day's other draws
    out.push(s)
  }
  return out
}

const militariaTags = getItemDef('medal_for_courage').demandTags
const goldTags = getItemDef('gold_earrings_583').demandTags

describe('item defs (M2)', () => {
  it('all 32 raw defs validate against the schema', () => {
    const raw = Object.values(RAW_ITEM_FILES).flat()
    expect(raw).toHaveLength(32)
    for (const r of raw) {
      const res = ItemDef.safeParse(r)
      expect(res.success, `${(r as { id: string }).id}: ${res.success ? '' : res.error.message}`).toBe(true)
    }
  })

  it('covers the six M2 categories with at least 3 defs each', () => {
    const byCat = new Map<string, number>()
    for (const d of ITEM_DEFS) byCat.set(d.category, (byCat.get(d.category) ?? 0) + 1)
    expect(byCat.size).toBeGreaterThanOrEqual(6)
    // Later categories may start with a single story item (M4: the student's laptop in electronics).
    for (const cat of ['gold', 'watches', 'phones', 'cameras', 'militaria', 'coins']) expect(byCat.get(cat), cat).toBeGreaterThanOrEqual(3)
  })

  it('every hotspot a tell references exists on the model', () => {
    for (const def of ITEM_DEFS) {
      const spots = new Set(def.model.hotspots.map((h) => h.id))
      for (const t of [...def.tells, ...def.fakeProfiles.flatMap((p) => p.tells)]) {
        if (t.hotspot) expect(spots.has(t.hotspot), `${def.id}/${t.id} → ${t.hotspot}`).toBe(true)
      }
    }
  })

  it('every def has loupe, scale and magnet tells, demand tags with a season entry, and plausible ruble values', () => {
    for (const def of ITEM_DEFS) {
      for (const tool of ['loupe', 'scale', 'magnet'] as const) expect(def.tells.some((t) => t.tool === tool), `${def.id}/${tool}`).toBe(true)
      expect(def.demandTags.length, def.id).toBeGreaterThan(0)
      for (const tag of def.demandTags) expect(tuning.demand.seasons[tag], `${def.id} tag ${tag}`).toBeDefined()
      expect(def.baseValue.min, def.id).toBeLessThan(def.baseValue.max)
      expect(def.baseValue.min, def.id).toBeGreaterThanOrEqual(500)
      expect(def.baseValue.max, def.id).toBeLessThanOrEqual(400_000)
    }
  })

  it('medal and coin ribbons/emblems are only set on the shapes that draw them', () => {
    for (const def of ITEM_DEFS) {
      if (def.model.ribbon) expect(def.model.placeholder, def.id).toBe('medal')
      if (def.model.emblem) expect(['medal', 'coin'], def.id).toContain(def.model.placeholder)
    }
  })
})

describe('seasonal demand', () => {
  it('holiday windows match dates, including the one that wraps the year end', () => {
    expect(inWindow('2014-03-08', '02-28', '03-08')).toBe(true)
    expect(inWindow('2014-03-09', '02-28', '03-08')).toBe(false)
    expect(inWindow('2014-12-31', '12-10', '01-07')).toBe(true)
    expect(inWindow('2015-01-05', '12-10', '01-07')).toBe(true)
    expect(inWindow('2015-01-20', '12-10', '01-07')).toBe(false)
    expect(activeHolidays('2014-03-03').map((h) => h.id)).toContain('womens_day')
    expect(activeHolidays('2014-05-09').map((h) => h.id)).toContain('victory_day')
    expect(activeHolidays('2014-09-01').map((h) => h.id)).toContain('school_start')
  })

  it('is deterministic and pure', () => {
    const s = onDate('2014-05-09')
    const copy = structuredClone(s)
    expect(demandMultiplier(s, militariaTags)).toBe(demandMultiplier(s, militariaTags))
    expect(s).toEqual(copy)
    const a = runPaper(7, 60)
    const b = runPaper(7, 60)
    expect(a.map((x) => x.market)).toEqual(b.map((x) => x.market))
  })

  it('militaria is up around Victory Day, gold and jewellery around Women\'s Day', () => {
    expect(demandMultiplier(onDate('2014-05-09'), militariaTags)).toBeGreaterThan(demandMultiplier(onDate('2014-04-10'), militariaTags) * 1.2)
    expect(demandMultiplier(onDate('2014-05-09'), militariaTags)).toBeGreaterThan(demandMultiplier(onDate('2014-06-20'), militariaTags))
    expect(demandMultiplier(onDate('2014-03-06'), goldTags)).toBeGreaterThan(demandMultiplier(onDate('2014-03-20'), goldTags) * 1.15)
    // the first career week sits inside the Women's Day window
    expect(demandMultiplier(onDate(tuning.career.startDate), goldTags)).toBeGreaterThan(1.15)
  })

  it('phones are up before school and over New Year; cameras peak in summer', () => {
    const phone = getItemDef('phone_mangosteen_m5').demandTags
    const camera = getItemDef('camera_zenit_e').demandTags
    expect(demandMultiplier(onDate('2014-08-28'), phone)).toBeGreaterThan(demandMultiplier(onDate('2014-10-15'), phone))
    expect(demandMultiplier(onDate('2014-12-28'), phone)).toBeGreaterThan(demandMultiplier(onDate('2014-11-20'), phone))
    expect(demandMultiplier(onDate('2014-07-01'), camera)).toBeGreaterThan(demandMultiplier(onDate('2014-01-20'), camera))
  })

  it('drift wanders slowly and stays clamped; the multiplier stays in range', () => {
    const { min, max, step, revert } = tuning.demand.drift
    const biggestShock = Math.max(...tuning.demand.shocks.flatMap((s) => Object.values(s.delta).map(Math.abs)))
    const days = runPaper(3, 400)
    let prev: Record<string, number> = {}
    for (const s of days) {
      for (const tag of DEMAND_TAGS) {
        const d = s.market.drift[tag]!
        expect(d).toBeGreaterThanOrEqual(min)
        expect(d).toBeLessThanOrEqual(max)
        const p = prev[tag] ?? 1
        expect(Math.abs(d - p)).toBeLessThanOrEqual(step + revert * (max - min) + biggestShock + 0.002)
      }
      for (const def of ITEM_DEFS) {
        const m = demandMultiplier(s, def.demandTags)
        expect(m).toBeGreaterThanOrEqual(tuning.demand.multiplier.min)
        expect(m).toBeLessThanOrEqual(tuning.demand.multiplier.max)
      }
      prev = s.market.drift
    }
    // …and does move
    const last = days[days.length - 1]!.market.drift
    expect(DEMAND_TAGS.some((t) => Math.abs(last[t]! - 1) > 0.01)).toBe(true)
  })

  it('unknown tags and empty tag lists are neutral', () => {
    const s = onDate('2014-10-15')
    expect(demandMultiplier(s, [])).toBe(1)
    expect(demandMultiplier(s, ['nonsense'])).toBe(1)
  })
})

describe('the morning paper', () => {
  const year = runPaper(11, 366)

  it('prints 1–3 stories a day with unique ids, deterministic for a seed', () => {
    for (const s of year) {
      expect(s.market.news.length).toBeGreaterThanOrEqual(1)
      expect(s.market.news.length).toBeLessThanOrEqual(3)
      expect(new Set(s.market.news.map((n) => n.id)).size).toBe(s.market.news.length)
    }
    expect(runPaper(11, 40).map((s) => s.market.news)).toEqual(year.slice(0, 40).map((s) => s.market.news))
  })

  it('never prints a digit (no exact values leak); the shop name is the only exception', () => {
    for (const s of year) {
      for (const n of s.market.news) {
        const text = `${n.headline} ${n.body}`.replaceAll(s.shop.name, '')
        expect(text, n.id).not.toMatch(/\d/)
      }
    }
    for (const t of [...FIRST_DAY, ...FLAVOUR_NEWS, ...Object.values(HOLIDAY_NEWS).flat(), ...Object.values(SHOCK_NEWS).flat(), ...Object.values(HINT_NEWS).flatMap((h) => [...h.up, ...h.down])]) {
      expect(`${t.headline} ${t.body}`.replaceAll('{shop}', ''), t.id).not.toMatch(/\d/)
    }
  })

  it('has stories for every holiday and shock in tuning, and a hint for every tag', () => {
    for (const h of tuning.demand.holidays) expect(HOLIDAY_NEWS[h.id]?.length, h.id).toBeGreaterThan(0)
    for (const s of tuning.demand.shocks) expect(SHOCK_NEWS[s.id]?.length, s.id).toBeGreaterThan(0)
    for (const tag of DEMAND_TAGS) expect(HINT_NEWS[tag] ?? HINT_NEWS[HINT_ALIAS[tag] ?? ''], tag).toBeDefined()
  })

  it('reports the holidays while they run, and flavour respects the season', () => {
    const on = (md: string) => year.filter((s) => s.calendar.date.slice(5) === md).flatMap((s) => s.market.news.map((n) => n.id))
    const holidayIds = (id: string) => new Set((HOLIDAY_NEWS[id] ?? []).map((t) => t.id))
    // first day of each window always runs its story
    for (const h of tuning.demand.holidays) {
      if (h.id === 'womens_day') continue // the window opened before the career did
      expect(on(h.from).some((id) => holidayIds(h.id).has(id)), h.id).toBe(true)
    }
    const seasonal = new Map(FLAVOUR_NEWS.filter((t) => t.seasons).map((t) => [t.id, t.seasons!]))
    for (const s of year) {
      for (const n of s.market.news) {
        const allowed = seasonal.get(n.id)
        if (allowed) expect(allowed, `${n.id} on ${s.calendar.date}`).toContain(s.calendar.season)
      }
    }
  })

  it('day one leads with the new owner and the shop name; the reducer shows the paper first', () => {
    let s = reducer(createInitialState(5, 'c'), { type: 'career/begin', shopName: 'Pawn Kingdom' })
    s = reducer(s, { type: 'day/open' })
    expect(s.market.news[0]?.id).toBe('first_day')
    expect(s.market.news[0]?.body).toContain('Pawn Kingdom')
    expect(s.day.newsRead).toBe(false)
    expect(reducer(s, { type: 'news/dismiss' }).day.newsRead).toBe(true)
  })
})

describe('career start', () => {
  it('leaves 3–5 items in the safe, deterministic for a seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const a = leftoverStock(new Rng(seed), ids())
      expect(a).toEqual(leftoverStock(new Rng(seed), ids()))
      expect(a.length).toBeGreaterThanOrEqual(2 + tuning.start.extraItems[0])
      expect(a.length).toBeLessThanOrEqual(2 + tuning.start.extraItems[1])
      expect(new Set(a.map((i) => i.id)).size).toBe(a.length)
      expect(new Set(a.map((i) => i.defId)).size).toBe(a.length)
    }
  })

  it('always includes a fake and a decent genuine piece; nobody has the paperwork', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const stock = leftoverStock(new Rng(seed), ids())
      expect(stock.some((i) => i.authenticity === 'fake'), `seed ${seed}`).toBe(true)
      const decent = stock.filter((i) => (LEFTOVER_POOLS.decent as readonly string[]).includes(i.defId))
      expect(decent.some((i) => i.authenticity === 'genuine' && i.condition >= tuning.start.genuineMinCondition), `seed ${seed}`).toBe(true)
      for (const i of stock) {
        expect(i.provenance).toBe('unknown')
        expect(() => getItemDef(i.defId)).not.toThrow()
      }
    }
  })

  it('career/begin names the shop and puts the leftovers in inventory at paid 0', () => {
    const s = reducer(createInitialState(9, 'c'), { type: 'career/begin', shopName: '  Lombard on the Canal  ' })
    expect(s.meta.intro).toBe(false)
    expect(s.shop.name).toBe('Lombard on the Canal')
    expect(s.inventory.length).toBeGreaterThanOrEqual(3)
    for (const i of s.inventory) expect(s.paid[i.id]).toBe(0)
    const blank = reducer(createInitialState(9, 'c'), { type: 'career/begin', shopName: '   ' })
    expect(blank.shop.name).toBe(tuning.career.defaultShopName)
  })

  it('every leftover pool id is a real def', () => {
    for (const id of [...LEFTOVER_POOLS.fakes, ...LEFTOVER_POOLS.decent, ...LEFTOVER_POOLS.junk]) expect(() => getItemDef(id), id).not.toThrow()
  })
})
