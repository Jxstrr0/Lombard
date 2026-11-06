/** M6 the Flood (src/game/city/flood.ts, src/data/flood.ts, src/data/stories/flood.ts) and the seasons of news. */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, run } from './storyHelpers'
import { reducer } from '../src/game/actions'
import { CAST } from '../src/data/customers/cast'
import { FLOOD_LOG, FLOOD_MORNING, FLOOD_NEWS, FLOOD_PEOPLE, FLOOD_PERSON, FLOOD_SELLER_LINES } from '../src/data/flood'
import { COLLECTOR } from '../src/data/collector'
import { FENCE } from '../src/data/fence'
import { VOLKOVA } from '../src/data/police'
import { REGULARS } from '../src/data/regulars'
import { SPECIALISTS } from '../src/data/specialists'
import { FLAVOUR_NEWS, HOLIDAY_NEWS, SEASON_HINTS } from '../src/data/news'
import { HOLIDAY_MORE, SEASON_FLAVOUR } from '../src/data/newsSeasons'
import { ARCS, getBeat } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { atRisk, FLOOD_FLAGS, floodDay, floodFactor, floodHit, floodNews, floodOffset, floodPhase, floodRecord, floodSellers, floodView, floodWalkIns, phaseAt } from '../src/game/city/flood'
import { tagFactor, updateMarket } from '../src/game/economy/demand'
import { epilogueCards, epiloguePaper } from '../src/game/endings/epilogue'
import { endCareer } from '../src/game/endings/end'
import { holds } from '../src/game/story/conditions'
import { floodReview, paperReview } from '../src/game/city/review'
import { Rng } from '../src/game/rng'
import { addDays, seasonOf, type GameState, type Season } from '../src/game/state'

const F = tuning.flood
const RESERVED_LOOKS = new Set(['business_male_05', 'male_adult_06', 'male_adult_20', 'male_adult_11'])
const SEED = 77
const base = () => ({ ...startedState(SEED, 'flood-test'), cash: 200_000 })
const FD = floodDay(SEED)
const withFlags = (s: GameState, ...flags: string[]): GameState => ({ ...s, story: { ...s.story, flags: [...s.story.flags, ...flags] } })
const onDay = (s: GameState, d: number) => atDay(s, FD + d)

describe('the Flood: the day and its phases', () => {
  it('comes once, on a seeded spring day inside tuning.flood.days', () => {
    const days = new Set<number>()
    for (let seed = 1; seed <= 200; seed++) {
      const d = floodDay(seed)
      expect(d).toBeGreaterThanOrEqual(F.days[0])
      expect(d).toBeLessThanOrEqual(F.days[1])
      expect(floodDay(seed)).toBe(d)
      days.add(d)
    }
    expect(days.size).toBeGreaterThan(8)
    // Day 1 is 3 March: the window sits in the first spring (late March … April).
    expect(F.days[0]).toBeGreaterThan(F.warnDays)
    expect(F.days[1]).toBeLessThan(92)
  })

  it('runs warning → rising → flood → receding → drying → after', () => {
    const seen = [-20, -F.warnDays, -1, 0, F.floodDays, F.floodDays + F.recedeDays, 30].map(phaseAt)
    expect(seen).toEqual(['before', 'warning', 'rising', 'flood', 'receding', 'drying', 'after'])
    const s = onDay(base(), 0)
    expect(floodOffset(s)).toBe(0)
    expect(floodPhase(s)).toBe('flood')
  })

  it('thins the walk-ins only while the street is under water', () => {
    expect(floodWalkIns(onDay(base(), 0), 8)).toBe(Math.round(8 * F.customersScale))
    expect(floodWalkIns(onDay(base(), -1), 8)).toBe(8)
    expect(floodWalkIns(onDay(base(), 0), 0)).toBe(0)
  })

  it('turns demand for its days, then lets it go', () => {
    expect(floodFactor(onDay(base(), 0), 'luxury')).toBe(F.demand.luxury)
    expect(floodFactor(onDay(base(), F.demandDays + 1), 'luxury')).toBe(1)
    expect(floodFactor(onDay(base(), -1), 'luxury')).toBe(1)
    const s = onDay(base(), 1)
    const plain = { calendar: s.calendar, market: s.market }
    expect(tagFactor(s, 'luxury') / tagFactor(plain, 'luxury')).toBeCloseTo(F.demand.luxury!, 5)
  })
})

describe('the Flood: the flood morning', () => {
  /** A shop on the flood morning with every piece in the back, so all of it is at risk. */
  const soaked = (prep: string[] = []) => {
    const s = onDay(withFlags(base(), ...prep), 0)
    return { ...s, shop: { ...s.shop, slots: s.shop.slots.map((x) => ({ ...x, itemId: null })) } }
  }

  it('bills by preparation and soaks less behind sandbags, nothing when lifted', () => {
    const none = floodHit(soaked())
    const bags = floodHit(soaked([FLOOD_FLAGS.sandbags]))
    const lifted = floodHit(soaked([FLOOD_FLAGS.lifted]))
    expect(none.morning).toBe(FLOOD_MORNING.none)
    expect(bags.morning).toBe(FLOOD_MORNING.sandbags)
    expect(lifted.morning).toBe(FLOOD_MORNING.lifted)
    const start = soaked().cash
    expect(start - none.state.cash).toBe(F.hit.none.bill)
    expect(start - bags.state.cash).toBe(F.hit.sandbags.bill)
    expect(start - lifted.state.cash).toBe(F.hit.lifted.bill)
    const wet = (r: ReturnType<typeof floodHit>) => r.state.day.log.filter((e) => e.text.startsWith(FLOOD_LOG.damaged.slice(0, 12))).length
    expect(wet(lifted)).toBe(0)
    expect(lifted.state.story.flags).toContain(FLOOD_FLAGS.dry)
    expect(soaked().inventory.length).toBeGreaterThan(3)
    expect(wet(none)).toBeGreaterThanOrEqual(wet(bags))
    // Damaged stock loses condition and value, never below condition 1.
    for (const item of none.state.inventory) {
      const before = soaked().inventory.find((i) => i.id === item.id)!
      expect(item.condition).toBeLessThanOrEqual(before.condition)
      expect(item.condition).toBeGreaterThanOrEqual(1)
      if (item.condition < before.condition) expect(item.trueValue).toBeLessThanOrEqual(before.trueValue)
    }
  })

  it('happens once, on the day, and only reaches the back shelf and stock off display', () => {
    const s = soaked()
    const hit = floodHit(s).state
    expect(hit.story.flags).toContain(FLOOD_FLAGS.hit)
    expect(floodHit(hit).state).toBe(hit)
    expect(floodHit(onDay(base(), 1)).morning).toBeNull()
    const shown = base().shop.slots.filter((x) => x.itemId && x.area !== 'back').map((x) => x.itemId)
    const risk = atRisk(onDay(base(), 0))
    for (const id of shown) expect(risk).not.toContain(id)
  })

  it('reaches the shop through day/open: the morning line, the bill, fewer people', () => {
    const before = onDay(base(), -1)
    const open = reducer(atDay(before, FD), { type: 'day/open' })
    expect(open.narration).toContain('The canal came over the embankment')
    expect(open.story.flags).toContain(FLOOD_FLAGS.hit)
    expect(open.day.log.some((e) => e.kind === 'expense' && e.text.startsWith('Flood:'))).toBe(true)
    expect(open.market.news[0]!.id).toBe(FLOOD_NEWS.flood[0]!.id)
  })

  it('floods out some walk-in sellers (more desperate, and they say so), and nobody else', () => {
    const s = onDay(base(), 0)
    const open = reducer(atDay(onDay(base(), -1), FD - 1), { type: 'day/open' })
    const visits = open.queue
    const out = floodSellers(s, visits)
    expect(out).toHaveLength(visits.length)
    let flooded = 0
    out.forEach((v, i) => {
      const was = visits[i]!
      if (v === was) return
      flooded++
      expect(was.kind).toBe('seller')
      expect(v.customer.desperation).toBeGreaterThan(was.customer.desperation)
      expect(v.customer.desperation).toBeLessThanOrEqual(F.sellers.cap)
      expect(FLOOD_SELLER_LINES.some((l) => v.line!.startsWith(l))).toBe(true)
    })
    expect(flooded).toBeGreaterThan(0)
    expect(floodSellers(onDay(base(), -1), visits)).toEqual(visits)
  })
})

describe('the Flood: the paper', () => {
  it('leads every day of the water with a story that never repeats, warning first', () => {
    const seen = new Set<string>()
    const ids: string[] = []
    for (let d = -F.warnDays; d < F.floodDays + F.recedeDays + F.dryDays + 3; d++) {
      const t = floodNews(onDay(base(), d))
      if (!t) continue
      ids.push(t.id)
      expect(seen.has(t.id), t.id).toBe(false)
      seen.add(t.id)
    }
    expect(ids[0]).toBe(FLOOD_NEWS.warning[0]!.id)
    for (const pool of Object.values(FLOOD_NEWS)) for (const t of pool) expect(seen.has(t.id), t.id).toBe(true)
    expect(floodNews(onDay(base(), -F.warnDays - 1))).toBeUndefined()
    expect(floodNews(onDay(base(), 40))).toBeUndefined()
  })

  it('prints in the morning paper, ahead of everything else', () => {
    for (const d of [-F.warnDays, -1, 0, F.floodDays]) {
      const s = onDay(base(), d)
      const m = updateMarket(s, new Rng(5))
      expect(m.news[0]!.id).toBe(floodNews(s)!.id)
    }
  })

  it('has no digits, and its hints agree with tuning.flood.demand', () => {
    for (const t of Object.values(FLOOD_NEWS).flat()) {
      expect(`${t.headline} ${t.body}`, t.id).not.toMatch(/\d/)
      for (const tag of t.tags ?? []) {
        const k = F.demand[tag]
        expect(k, `${t.id} ${tag}`).toBeDefined()
        expect(t.direction === 'up' ? k! > 1 : k! < 1, `${t.id} ${tag}`).toBe(true)
      }
    }
  })
})

describe('the Flood: people', () => {
  it('Kuzmich and the neighbours wear walk-in looks no named character wears', () => {
    const named = new Set([...REGULARS.map((r) => r.look), ...SPECIALISTS.map((s) => s.look), FENCE.look, VOLKOVA.look, COLLECTOR.look, ...RESERVED_LOOKS])
    const looks = [FLOOD_PERSON.look, ...Object.values(FLOOD_PEOPLE).map((p) => p.look)]
    expect(new Set(looks).size).toBe(looks.length)
    for (const look of looks) {
      expect(CAST.some((c) => c.id === look), look).toBe(true)
      expect(named.has(look), look).toBe(false)
    }
  })

  it('Kuzmich comes with sandbags before the water, once', () => {
    expect(eligible(onDay(base(), -6), 'flood.sandbags')).toBe(false)
    expect(eligible(onDay(base(), -5), 'flood.sandbags')).toBe(true)
    expect(eligible(onDay(base(), 0), 'flood.sandbags')).toBe(false)
    const s = choose(beatAtCounter(base(), 'flood.sandbags', FD - 3), 'flood_sandbags')
    expect(s.story.flags).toContain(FLOOD_FLAGS.sandbags)
    expect(floodView(atDay(s, FD)).sandbags).toBe(true)
    expect(floodView(atDay(s, FD + F.floodDays + F.recedeDays)).sandbags).toBe(false)
    expect(eligible(atDay(s, FD - 2), 'flood.sandbags')).toBe(false)
  })

  it('lending the pump is a hero’s choice; gouging is a vulture’s, and Volkova hears of it', () => {
    const lend = choose(beatAtCounter(base(), 'flood.pump', FD), 'pump_lend')
    expect(floodRecord(lend)).toEqual({ hero: 1, vulture: 0 })
    expect(lend.story.flags).toContain('heart.flood_pump')
    const s0 = beatAtCounter(base(), 'flood.pump', FD)
    const gouge = choose(s0, 'pump_gouge')
    expect(floodRecord(gouge)).toEqual({ hero: 0, vulture: 1 })
    expect(gouge.cash - s0.cash).toBe(F.pump.gouge)
    expect(gouge.career.axes.heart).toBeLessThan(s0.career.axes.heart)
    const met = { ...gouge, crime: { ...gouge.crime, volkova: { ...gouge.crime.volkova, met: true } } }
    expect(eligible(atDay(met, FD + 4), 'flood_talk.complaint')).toBe(true)
    const refunded = choose(beatAtCounter(met, 'flood_talk.complaint', FD + 4), 'gouge_refund')
    expect(floodRecord(refunded).vulture).toBe(0)
    expect(refunded.story.flags).toContain('flood.refunded')
  })

  it('storage and credit move the record, and the regulars notice heroes and vultures', () => {
    let s = choose(beatAtCounter(base(), 'flood.storage', FD + 1), 'store_free')
    s = choose(beatAtCounter(s, 'flood.credit', FD + 2), 'credit_lend')
    expect(floodRecord(s)).toEqual({ hero: 2, vulture: 0 })
    expect(holds({ if: 'flood', hero: { gte: F.heroAt }, vulture: { lte: 0 } }, s)).toBe(true)
    const hero = ARCS.find((a) => a.id === 'flood_talk')!.beats.filter((b) => b.id.endsWith('_hero'))
    expect(hero.length).toBeGreaterThan(2)
    const v = withFlags(base(), 'flood.vulture_pump', 'flood.vulture_storage')
    expect(holds({ if: 'flood', vulture: { gte: F.vultureAt } }, v)).toBe(true)
    expect(holds({ if: 'flood', hero: { gte: 1 } }, v)).toBe(false)
  })

  it('every flood beat stays inside the water’s days or follows one of its own', () => {
    for (const arc of ARCS.filter((a) => a.id === 'flood' || a.id === 'flood_talk')) {
      for (const beat of arc.beats) {
        const ok = beat.when.some((c) => c.if === 'flood' || (c.if === 'beat' && c.beat.startsWith('flood')) || (c.if === 'flag' && c.flag.startsWith('flood.')))
        expect(ok, beat.id).toBe(true)
        expect(getBeat(beat.id)).toBeDefined()
      }
    }
  })
})

describe('the Flood: the ending', () => {
  it('Kuzmich’s card shows once the water came in, and reads the record', () => {
    const s = base()
    expect(epilogueCards(s).some((c) => c.id === 'kuzmich')).toBe(false)
    const hero = withFlags(s, 'flood.hit', 'flood.dry', 'flood.hero_pump', 'flood.hero_storage', 'flood.hero_credit')
    const vulture = withFlags(s, 'flood.hit', 'flood.damaged', 'flood.vulture_pump', 'flood.vulture_storage')
    const card = (x: GameState) => epilogueCards(x).find((c) => c.id === 'kuzmich')!.text
    expect(card(hero)).toContain('your name')
    expect(card(vulture)).toContain('spits')
    const ended = (x: GameState) => endCareer(x, 'evicted')
    expect(epiloguePaper(ended(hero)).some((p) => p.id === 'weather_flood_hero')).toBe(true)
    expect(epiloguePaper(ended(vulture)).some((p) => p.id === 'weather_flood_vulture')).toBe(true)
  })
})

describe('seasons of news', () => {
  const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

  it('has city life for every season', () => {
    for (const season of SEASONS) {
      const own = SEASON_FLAVOUR.filter((t) => t.seasons?.includes(season))
      expect(own.length, season).toBeGreaterThanOrEqual(12)
      expect(FLAVOUR_NEWS.filter((t) => !t.seasons || t.seasons.includes(season)).length).toBeGreaterThan(own.length)
    }
  })

  it('seasonal market notes agree with tuning.demand.seasons', () => {
    for (const season of SEASONS) {
      expect(SEASON_HINTS[season].length, season).toBeGreaterThanOrEqual(4)
      for (const t of SEASON_HINTS[season]) {
        expect(t.tags?.length, t.id).toBeGreaterThan(0)
        for (const tag of t.tags!) {
          const k = (tuning.demand.seasons as Record<string, Record<Season, number>>)[tag]?.[season]
          expect(k, `${t.id} ${tag}`).toBeDefined()
          expect(t.direction === 'up' ? k! > 1 : k! < 1, `${t.id} ${tag} ${season}`).toBe(true)
        }
      }
    }
  })

  it('holidays have more to say, and the news-only city days have stories but no boost', () => {
    for (const id of Object.keys(HOLIDAY_MORE)) expect(HOLIDAY_NEWS[id]!.length, id).toBeGreaterThanOrEqual(HOLIDAY_MORE[id]!.length)
    for (const id of ['city_day', 'graduates', 'fleet_day', 'teachers_day']) {
      const h = tuning.demand.holidays.find((x) => x.id === id)
      expect(h, id).toBeDefined()
      expect(Object.keys(h!.boost)).toHaveLength(0)
      expect(HOLIDAY_NEWS[id]!.length).toBeGreaterThan(0)
    }
    expect(HOLIDAY_NEWS.new_year!.length).toBeGreaterThanOrEqual(4)
    expect(HOLIDAY_NEWS.victory_day!.length).toBeGreaterThanOrEqual(4)
    expect(HOLIDAY_NEWS.school_start!.length).toBeGreaterThanOrEqual(4)
  })

  it('no digits, unique ids', () => {
    const all = [...SEASON_FLAVOUR, ...Object.values(SEASON_HINTS).flat(), ...Object.values(HOLIDAY_MORE).flat()]
    const ids = new Set<string>()
    for (const t of [...FLAVOUR_NEWS, ...Object.values(HOLIDAY_NEWS).flat(), ...Object.values(SEASON_HINTS).flat(), ...Object.values(FLOOD_NEWS).flat()]) {
      expect(ids.has(t.id), t.id).toBe(false)
      ids.add(t.id)
    }
    for (const t of all) expect(`${t.headline} ${t.body}`, t.id).not.toMatch(/\d/)
  })

  it('a long career does not repeat a flavour story for weeks', () => {
    let s = startedState(9, 'news-long')
    const last = new Map<string, number>()
    let minGap = Infinity
    const flavourIds = new Set(FLAVOUR_NEWS.map((t) => t.id))
    for (let day = 2; day < 200; day++) {
      const date = addDays(tuning.career.startDate, day - 1)
      s = { ...s, calendar: { ...s.calendar, day, date, season: seasonOf(date) } }
      s = { ...s, market: updateMarket(s, new Rng(day)) }
      for (const n of s.market.news) {
        if (!flavourIds.has(n.id)) continue
        const prev = last.get(n.id)
        if (prev !== undefined && s.calendar.season === seasonAt.get(n.id)) minGap = Math.min(minGap, day - prev)
        last.set(n.id, day)
        seasonAt.set(n.id, s.calendar.season)
      }
    }
    expect(minGap).toBeGreaterThanOrEqual(7)
  })
})

describe('dev review careers (src/game/city/review.ts)', () => {
  it('flood scenarios open on the right morning with the right beat first; the paper scenario on its date', () => {
    const w = floodReview(3, 'r', 'warning')
    expect(floodOffset(w)).toBe(-3)
    expect(w.queue[0]!.beatId).toBe('flood.sandbags')
    expect(w.market.news[0]!.id).toBe(floodNews(w)!.id)
    const f = floodReview(3, 'r', 'flood')
    expect(floodOffset(f)).toBe(0)
    expect(f.queue[0]!.beatId).toBe('flood.pump')
    expect(f.story.flags).toContain(FLOOD_FLAGS.hit)
    expect(f.narration).toContain(FLOOD_MORNING.none)
    const a = floodReview(3, 'r', 'after')
    expect(floodPhase(a)).toBe('receding')
    expect(a.queue[0]!.beatId).toBe('flood.storage')
    const p = paperReview(3, 'r', null)
    expect(p.calendar.date.slice(5)).toBe('09-01')
    expect(p.calendar.season).toBe('autumn')
    expect(p.market.news.length).toBeGreaterThan(0)
    expect(p.day.newsRead).toBe(false)
  })
})

const seasonAt = new Map<string, Season>()
void run
