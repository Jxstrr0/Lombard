import { describe, expect, it } from 'vitest'
import { ITEM_DEFS, getItemDef } from '../src/data/items'
import { SPECIALISTS } from '../src/data/specialists'
import { tuning } from '../src/data/tuning'
import { UPGRADES } from '../src/data/upgrades'
import { reducer } from '../src/game/actions'
import { chargeExpenses, daysToMonthEnd, isMonthEnd, upcomingBills } from '../src/game/economy/expenses'
import { callsLeft, releaseSpecialist, retainCost, retainSpecialist } from '../src/game/economy/specialists'
import { buyUpgrade, hasUpgrade, refTier, restockAcid, upgradeStatus, visibilityBonus } from '../src/game/economy/upgrades'
import { availableTools, payForTool, toolExtras } from '../src/game/inspect/available'
import { ACID_TELL, REFERENCE_TELL, SPECIALIST_TELL, referenceRange, specialistCallSeconds, specialistOpinion, useTool } from '../src/game/inspect/tools'
import { generateItem } from '../src/game/items/generate'
import { decodeSaveCode, encodeSaveCode } from '../src/game/save/code'
import { Rng } from '../src/game/rng'
import type { FakeProfile, ItemDef, ToolId } from '../src/game/schema/item'
import { addDays, weekdayOf, type GameState } from '../src/game/state'
import type { Finding, ItemInstance } from '../src/game/types'
import { startedState } from './helpers'

const VERDICT_WORDS = /\b(fake|genuine|real|counterfeit)\b/i
const monthly = tuning.expenses.rent + tuning.expenses.utilities

function makeItem(def: ItemDef, profile: FakeProfile | undefined, seed: number): ItemInstance {
  const forced: ItemDef = profile ? { ...def, fakeChance: 1, fakeProfiles: [profile] } : { ...def, fakeChance: 0 }
  return generateItem(forced, new Rng(seed), `i${seed}`)
}

/** A started career, closed, with the calendar set to `date` (the next day to be played). */
function closedOn(date: string, seed = 7, cash: number = tuning.career.startingCash): GameState {
  const s = startedState(seed, 'econ')
  return { ...s, cash, calendar: { ...s.calendar, date, weekday: weekdayOf(date) } }
}

/** Open an empty day on the state's date and close it (no customers): just the bills. */
function playEmptyDay(s: GameState): GameState {
  const open: GameState = { ...s, day: { ...s.day, phase: 'open', log: [], openingCash: s.cash, newsRead: true }, queue: [], current: null }
  return reducer(open, { type: 'day/close' })
}

/** A seller at the counter in the inspect phase with this item. */
function inspecting(s: GameState, item: ItemInstance): GameState {
  const opened = reducer(s, { type: 'day/open' })
  return {
    ...opened,
    queue: [],
    current: {
      visitId: 'v1',
      kind: 'seller',
      wants: 'sell',
      sale: null,
      customer: opened.queue[0]!.customer,
      item,
      phase: 'inspect',
      line: '',
      elapsed: 0,
    },
    inspect: { findings: [], toolUses: {}, estimate: null },
    haggle: null,
  }
}

const use = (s: GameState, tool: ToolId) => reducer(s, { type: 'inspect/useTool', tool })
const newFindings = (before: GameState, after: GameState): Finding[] => after.inspect!.findings.slice(before.inspect!.findings.length)

describe('calendar helpers', () => {
  it('knows month ends', () => {
    expect(isMonthEnd('2014-03-31')).toBe(true)
    expect(isMonthEnd('2014-03-30')).toBe(false)
    expect(isMonthEnd('2014-02-28')).toBe(true)
    expect(isMonthEnd('2016-02-28')).toBe(false)
    expect(daysToMonthEnd('2014-03-27')).toBe(4)
    expect(daysToMonthEnd('2014-04-30')).toBe(0)
  })
})

describe('rent and utilities', () => {
  it('are charged only at the close of the last day of each month', () => {
    let s = closedOn(tuning.career.startDate)
    const charges: { date: string; total: number }[] = []
    for (let i = 0; i < 70; i++) {
      const date = s.calendar.date
      const before = s.cash
      s = playEmptyDay(s)
      const exp = s.day.log.filter((e) => e.kind === 'expense')
      if (exp.length > 0) charges.push({ date, total: before - s.cash })
      expect(s.history[s.history.length - 1]!.expenses).toBe(before - s.cash)
    }
    expect(charges).toEqual([
      { date: '2014-03-31', total: monthly },
      { date: '2014-04-30', total: monthly },
    ])
    expect(s.cash).toBe(tuning.career.startingCash - 2 * monthly)
  })

  it('the first bills land on day 29 of the career', () => {
    const start = tuning.career.startDate
    expect(addDays(start, 28)).toBe('2014-03-31')
  })

  it('may take cash below zero (eviction is M5)', () => {
    const s = chargeExpenses({ ...closedOn('2014-03-31', 7, 1_000), day: { ...closedOn('2014-03-31').day, phase: 'open' } })
    expect(s.cash).toBe(1_000 - monthly)
  })

  it('are listed as upcoming with days to go', () => {
    const bills = upcomingBills(closedOn('2014-03-27'))
    expect(bills.map((b) => [b.label, b.amount, b.inDays])).toEqual([
      ['Rent', tuning.expenses.rent, 4],
      ['Utilities', tuning.expenses.utilities, 4],
    ])
    const withRetainer = upcomingBills(retainSpecialist(closedOn('2014-03-27'), 'watchmaker'))
    expect(withRetainer.map((b) => b.label)).toContain('Retainer: Ilya')
  })
})

describe('retainers', () => {
  it('charge a prorated first month on retaining, then the full fee at month end, and reset calls', () => {
    const roster = tuning.specialists.roster.jeweler!
    const s0 = closedOn('2014-03-17') // 15 days left in March, this one included
    const cost = retainCost(s0, 'jeweler')!
    expect(cost.fee).toBe(Math.round((roster.fee * 15) / 31 / 100) * 100)
    expect(cost.calls).toBe(Math.ceil((roster.calls * 15) / 31))
    const s1 = reducer(s0, { type: 'specialist/retain', id: 'jeweler' })
    expect(s1.cash).toBe(s0.cash - cost.fee)
    expect(callsLeft(s1, 'jeweler')).toBe(cost.calls)
    expect(s1.specialists.jeweler!.relationship).toBe(tuning.specialists.relationshipStart)
    // Retaining twice does nothing.
    expect(reducer(s1, { type: 'specialist/retain', id: 'jeweler' })).toBe(s1)

    let s: GameState = { ...s1, specialists: { ...s1.specialists, jeweler: { ...s1.specialists.jeweler!, callsUsed: roster.calls } } }
    for (let d = 17; d <= 31; d++) {
      const before = s.cash
      s = playEmptyDay(s)
      const spent = before - s.cash
      if (d < 31) {
        expect(spent).toBe(0)
        expect(callsLeft(s, 'jeweler')).toBe(0)
      } else {
        expect(spent).toBe(monthly + roster.fee)
        expect(s.day.log.some((e) => e.text.startsWith('Retainer: Faina Gelfand, April'))).toBe(true)
      }
    }
    expect(callsLeft(s, 'jeweler')).toBe(roster.calls)
    expect(s.specialists.jeweler!.relationship).toBeCloseTo(tuning.specialists.relationshipStart + tuning.specialists.relationshipPerMonth)
  })

  it('stop after release; the relationship cools', () => {
    const s1 = retainSpecialist(closedOn('2014-04-29'), 'watchmaker')
    const s2 = releaseSpecialist(s1, 'watchmaker')
    expect(s2.specialists.watchmaker!.retained).toBe(false)
    expect(s2.specialists.watchmaker!.relationship).toBe(Math.max(0, tuning.specialists.relationshipStart - tuning.specialists.releaseRelationshipLoss))
    const s3 = playEmptyDay({ ...s2, calendar: { ...s2.calendar, date: '2014-04-30' } })
    expect(s2.cash - s3.cash).toBe(monthly)
  })

  it('refuse when cash is short, and only while closed', () => {
    const poor = closedOn('2014-03-03', 7, 100)
    expect(reducer(poor, { type: 'specialist/retain', id: 'jeweler' })).toBe(poor)
    const open = reducer(closedOn('2014-03-03'), { type: 'day/open' })
    expect(reducer(open, { type: 'specialist/retain', id: 'jeweler' })).toBe(open)
  })

  it('a retainer that cash could not cover does not grow the relationship', () => {
    const s1 = retainSpecialist(closedOn('2014-03-30'), 'jeweler')
    const broke = { ...s1, cash: 0, calendar: { ...s1.calendar, date: '2014-03-31' } }
    const s2 = playEmptyDay(broke)
    expect(s2.specialists.jeweler!.relationship).toBe(s1.specialists.jeweler!.relationship)
  })
})

describe('upgrades', () => {
  it('validate and cost what tuning says', () => {
    for (const u of UPGRADES) expect(u.cost).toBe((tuning.upgrades.cost as Record<string, number>)[u.id])
  })

  it('need the cash, the prerequisite, and can be bought once', () => {
    const s0 = closedOn('2014-03-10')
    expect(upgradeStatus(s0, 'reference_3')).toBe('locked')
    expect(buyUpgrade(s0, 'reference_3')).toBe(s0)
    const s1 = buyUpgrade(s0, 'reference_2')
    expect(hasUpgrade(s1, 'reference_2')).toBe(true)
    expect(s1.cash).toBe(s0.cash - tuning.upgrades.cost.reference_2)
    expect(buyUpgrade(s1, 'reference_2')).toBe(s1)
    expect(upgradeStatus(s1, 'reference_3')).toBe('available')
    const s2 = buyUpgrade(s1, 'reference_3')
    expect(refTier(s0)).toBe(1)
    expect(refTier(s1)).toBe(2)
    expect(refTier(s2)).toBe(3)
    const poor = closedOn('2014-03-10', 7, 1_000)
    expect(upgradeStatus(poor, 'acid_kit')).toBe('short')
    expect(buyUpgrade(poor, 'acid_kit')).toBe(poor)
    expect(buyUpgrade(s0, 'no_such_thing')).toBe(s0)
  })

  it('are refused by the reducer while the shop is open', () => {
    const open = reducer(closedOn('2014-03-03'), { type: 'day/open' })
    expect(reducer(open, { type: 'upgrade/buy', id: 'acid_kit' })).toBe(open)
  })

  it('log an expense and patch the closed day’s summary', () => {
    const closed = playEmptyDay(closedOn('2014-03-10'))
    const s = reducer(closed, { type: 'upgrade/buy', id: 'acid_kit' })
    expect(s.day.log[s.day.log.length - 1]).toMatchObject({ kind: 'expense', amount: -tuning.upgrades.cost.acid_kit })
    const last = s.history[s.history.length - 1]!
    expect(last.expenses).toBe(tuning.upgrades.cost.acid_kit)
    expect(last.closingCash).toBe(s.cash)
  })

  it('acid kit comes with charges; restocking needs the kit and caps', () => {
    const s0 = closedOn('2014-03-10', 7, 200_000)
    expect(restockAcid(s0)).toBe(s0)
    const s1 = buyUpgrade(s0, 'acid_kit')
    expect(s1.shop.acidCharges).toBe(tuning.upgrades.acidKitCharges)
    let s = s1
    for (let i = 0; i < 10; i++) s = restockAcid(s)
    expect(s.shop.acidCharges).toBe(tuning.upgrades.acidMaxCharges)
    const spent = s1.cash - s.cash
    expect(spent % tuning.upgrades.acidRestockCost).toBe(0)
    expect(restockAcid(s)).toBe(s)
  })

  it('better case raises counter visibility only', () => {
    const s0 = closedOn('2014-03-10')
    expect(visibilityBonus(s0, 'counter')).toBe(1)
    const s1 = buyUpgrade(s0, 'case_counter')
    expect(visibilityBonus(s1, 'counter')).toBe(tuning.upgrades.caseCounterVisibility)
    expect(visibilityBonus(s1, 'wall')).toBe(1)
    expect(s1.shop.security).toBe(s0.shop.security + tuning.upgrades.caseCounterSecurity)
  })
})

describe('acid kit', () => {
  const band = getItemDef('gold_band_583')
  const brass = band.fakeProfiles.find((p) => p.id === 'plated_brass')!

  it('is locked without a kit, on non-gold items, and when empty', () => {
    const s0 = closedOn('2014-03-10')
    const acid = (s: GameState, def: ItemDef) => availableTools(s, def).find((t) => t.tool === 'acid')!
    expect(acid(s0, band)).toMatchObject({ usable: false, note: 'no kit' })
    const kit = buyUpgrade(s0, 'acid_kit')
    expect(acid(kit, band).usable).toBe(true)
    expect(acid(kit, getItemDef('watch_pobeda_gold')).usable).toBe(false)
    expect(payForTool(kit, 'acid', getItemDef('phone_mangosteen_m5'))).toBeNull()
    expect(acid({ ...kit, shop: { ...kit.shop, acidCharges: 0 } }, band)).toMatchObject({ usable: false, note: 'empty' })
  })

  it('uses one charge per test and once per item', () => {
    const s = inspecting(buyUpgrade(closedOn('2014-03-10'), 'acid_kit'), makeItem(band, undefined, 1))
    const a = use(s, 'acid')
    expect(a.shop.acidCharges).toBe(s.shop.acidCharges - 1)
    expect(a.current!.elapsed).toBe(tuning.inspect.toolSeconds.acid)
    expect(use(a, 'acid')).toBe(a)
  })

  it('holds on gold and fizzes on plated brass', () => {
    const base = buyUpgrade(closedOn('2014-03-10'), 'acid_kit')
    for (let seed = 0; seed < 5; seed++) {
      const g = inspecting(base, makeItem(band, undefined, seed))
      const gf = newFindings(g, use(g, 'acid')).find((f) => f.tellId === ACID_TELL)!
      expect(gf.text).toContain('583 scratch holds under the acid')
      expect(gf.polarity).toBe('positive')
      const b = inspecting(base, makeItem(band, brass, seed))
      const bf = newFindings(b, use(b, 'acid')).find((f) => f.tellId === ACID_TELL)!
      expect(bf.text).toContain('fizzes green')
      expect(bf.polarity).toBe('negative')
      expect(bf.reveals).toBe('authenticity')
    }
  })

  it('reacts to every gold fake profile without naming a verdict', () => {
    for (const def of ITEM_DEFS.filter((d) => d.category === 'gold')) {
      for (const p of def.fakeProfiles) {
        const f = useTool({ item: makeItem(def, p, 3), def, tool: 'acid', previous: [], uses: 0, rng: new Rng(3), extras: { refTier: 1 } })
        const acid = f.findings.find((x) => x.tellId === ACID_TELL)!
        expect(acid.text).not.toMatch(VERDICT_WORDS)
        if (p.kind === 'fake') expect(acid.polarity, `${def.id}/${p.id}`).toBe('negative')
        else expect(acid.polarity, `${def.id}/${p.id}`).toBe('positive')
      }
    }
  })
})

describe('reference book', () => {
  it('narrows with each tier', () => {
    for (const def of ITEM_DEFS) {
      if (def.category === 'phones' || def.category === 'electronics') continue
      const w = [1, 2, 3].map((t) => {
        const r = referenceRange(def, t)!
        return r.hi - r.lo
      })
      expect(w[0]!, def.id).toBeGreaterThan(w[1]!)
      expect(w[1]!, def.id).toBeGreaterThan(w[2]!)
    }
  })

  it('stays near the def’s value and is the same every time', () => {
    for (const def of ITEM_DEFS) {
      for (const t of [1, 2, 3]) {
        const r = referenceRange(def, t)
        if (!r) continue
        const mid = (def.baseValue.min + def.baseValue.max) / 2
        expect((r.lo + r.hi) / 2).toBeGreaterThan(mid * 0.8)
        expect((r.lo + r.hi) / 2).toBeLessThan(mid * 1.2)
        expect(referenceRange(def, t)).toEqual(r)
      }
    }
  })

  it('predates phones at tier 1', () => {
    const phone = getItemDef('phone_mangosteen_m5')
    expect(referenceRange(phone, 1)).toBeNull()
    expect(referenceRange(phone, 2)).not.toBeNull()
    const f = useTool({ item: makeItem(phone, undefined, 1), def: phone, tool: 'reference', previous: [], uses: 0, rng: new Rng(1), extras: { refTier: 1 } })
    expect(f.findings[0]!.text).toContain('predates the model')
  })

  it('never detects fakes: same neutral text for genuine and fake', () => {
    const def = getItemDef('gold_signet_583')
    const say = (item: ItemInstance) =>
      useTool({ item, def, tool: 'reference', previous: [], uses: 0, rng: new Rng(9), extras: { refTier: 2 } }).findings.find((f) => f.tellId === REFERENCE_TELL)!
    const a = say(makeItem(def, undefined, 1))
    const b = say(makeItem(def, def.fakeProfiles[0], 1))
    expect(a.text).toBe(b.text)
    expect(a.polarity).toBe('neutral')
    expect(a.reveals).toBeUndefined()
    expect(a.text).toMatch(/lists the .* at [\d,]+ ₽–[\d,]+ ₽ in good condition/)
  })

  it('is usable from day 1 (tier 1 is implicit) and reports the tier via extras', () => {
    const s = closedOn('2014-03-03')
    expect(toolExtras(s, getItemDef('gold_band_583')).refTier).toBe(1)
    expect(availableTools(s, getItemDef('gold_band_583')).find((t) => t.tool === 'reference')!.usable).toBe(true)
  })
})

describe('specialist call', () => {
  const chain = getItemDef('gold_rope_chain_585')

  it('needs a retained specialist covering the category', () => {
    const s0 = closedOn('2014-03-10')
    const call = (s: GameState, def: ItemDef) => availableTools(s, def).find((t) => t.tool === 'specialist')!
    expect(call(s0, chain)).toMatchObject({ usable: false, note: 'no retainer' })
    const s1 = retainSpecialist(s0, 'jeweler')
    expect(call(s1, chain).usable).toBe(true)
    expect(call(s1, getItemDef('watch_pobeda_gold')).usable).toBe(false)
    expect(call(s1, getItemDef('phone_mangosteen_m5'))).toMatchObject({ usable: false, note: 'no retainer' })
    expect(call(s1, { ...chain, category: 'sports' })).toMatchObject({ usable: false, note: 'nobody' })
    expect(toolExtras(s1, chain).specialist).toEqual({ id: 'jeweler', relationship: tuning.specialists.relationshipStart, mods: {} })
  })

  it('uses the allowance, then the per-call fee, then refuses when cash is short', () => {
    const roster = tuning.specialists.roster.jeweler!
    const base = retainSpecialist(closedOn('2014-03-03'), 'jeweler')
    const s = inspecting(base, makeItem(chain, undefined, 1))
    const used = s.specialists.jeweler!.callsUsed
    const a = use(s, 'specialist')
    expect(a.specialists.jeweler!.callsUsed).toBe(used + 1)
    expect(a.cash).toBe(s.cash)
    expect(a.current!.elapsed).toBe(tuning.inspect.toolSeconds.specialist)
    expect(newFindings(s, a).some((f) => f.tellId === SPECIALIST_TELL)).toBe(true)
    expect(use(a, 'specialist')).toBe(a) // one call per item

    const over = { ...s, specialists: { ...s.specialists, jeweler: { ...s.specialists.jeweler!, callsUsed: roster.calls } } }
    const b = use(over, 'specialist')
    expect(b.cash).toBe(over.cash - roster.perCall)
    expect(b.day.log[b.day.log.length - 1]).toMatchObject({ kind: 'expense', amount: -roster.perCall })

    const broke = { ...over, cash: roster.perCall - 1 }
    expect(availableTools(broke, chain).find((t) => t.tool === 'specialist')!.usable).toBe(false)
    expect(use(broke, 'specialist')).toBe(broke)
  })

  it('is deterministic for a seed', () => {
    const base = retainSpecialist(closedOn('2014-03-03'), 'watchmaker')
    const s = inspecting(base, makeItem(getItemDef('watch_pobeda_gold'), undefined, 4))
    expect(use(s, 'specialist')).toEqual(use(s, 'specialist'))
  })

  it('mostly gets it right, never says FAKE, and doubts non-genuine pieces', () => {
    for (const spec of SPECIALISTS) {
      const defs = ITEM_DEFS.filter((d) => spec.categories.includes(d.category))
      let right = 0
      let total = 0
      for (const def of defs) {
        for (const p of [undefined, ...def.fakeProfiles]) {
          for (let seed = 0; seed < 100; seed++) {
            const item = makeItem(def, p, seed)
            const sp = { id: spec.id, relationship: 0.1 }
            const op = specialistOpinion(def, item, sp, new Rng(seed))
            const truth = !p ? 'sound' : p.kind === 'restored' ? 'redone' : p.kind === 'frankenstein' ? 'mixed' : 'doubt'
            total++
            if (op.verdict === truth || (truth === 'sound' && op.verdict === 'lowball')) right++
            expect(op.lo).toBeLessThan(op.hi)
            const f = useTool({ item, def, tool: 'specialist', previous: [], uses: 0, rng: new Rng(seed), extras: { refTier: 1, specialist: sp } })
            const text = f.findings.find((x) => x.tellId === SPECIALIST_TELL)!.text
            expect(text).not.toMatch(VERDICT_WORDS)
            expect(text).not.toContain('{')
            expect(text.length).toBeLessThanOrEqual(170)
          }
        }
      }
      if (total > 0) expect(right / total, spec.id).toBeGreaterThan(0.8)
    }
  })

  it('a better relationship means fewer wrong verdicts', () => {
    const def = getItemDef('watch_pobeda_gold')
    const wrong = (relationship: number) => {
      let n = 0
      for (let seed = 0; seed < 2000; seed++) {
        const op = specialistOpinion(def, makeItem(def, def.fakeProfiles[0], seed), { id: 'watchmaker', relationship }, new Rng(seed))
        if (op.verdict === 'sound') n++
      }
      return n
    }
    expect(wrong(1)).toBeLessThan(wrong(0))
  })

  it('a dishonest specialist sometimes lowballs sound valuables; an honest one rarely', () => {
    const lowballs = (id: string, def: ItemDef) => {
      let n = 0
      let eligible = 0
      for (let seed = 0; seed < 2000; seed++) {
        const item = makeItem(def, undefined, seed)
        if (item.trueValue < tuning.specialists.lowballMinValue) continue
        eligible++
        const op = specialistOpinion(def, item, { id, relationship: 0.1 }, new Rng(seed))
        if (op.verdict === 'lowball') {
          n++
          expect(op.hi).toBeLessThan(item.trueValue)
        }
      }
      return n / eligible
    }
    const jeweler = lowballs('jeweler', chain)
    const watchmaker = lowballs('watchmaker', getItemDef('watch_pobeda_gold'))
    expect(jeweler).toBeGreaterThan(0.15)
    expect(watchmaker).toBeLessThan(0.06)
    // Cheap pieces are never lowballed.
    const ring = getItemDef('gold_earrings_583')
    for (let seed = 0; seed < 200; seed++) {
      const item = makeItem(ring, undefined, seed)
      if (item.trueValue >= tuning.specialists.lowballMinValue) continue
      expect(specialistOpinion(ring, item, { id: 'jeweler', relationship: 0 }, new Rng(seed)).verdict).not.toBe('lowball')
    }
  })

  it('the antiques dealer lowballs most, the militaria collector hardly ever', () => {
    const rate = (id: string) => {
      let n = 0
      let eligible = 0
      for (let seed = 0; seed < 2000; seed++) {
        const item = makeItem(chain, undefined, seed)
        if (item.trueValue < tuning.specialists.lowballMinValue) continue
        eligible++
        if (specialistOpinion(chain, item, { id, relationship: 0.1 }, new Rng(seed)).verdict === 'lowball') n++
      }
      return n / eligible
    }
    expect(rate('antiquary')).toBeGreaterThan(rate('jeweler'))
    expect(rate('collector')).toBeLessThan(0.1)
  })

  it('routes each category to its own specialist; the electronics tech answers faster', () => {
    let s = closedOn('2014-03-03')
    for (const spec of SPECIALISTS) s = retainSpecialist(s, spec.id)
    expect(SPECIALISTS.every((spec) => s.specialists[spec.id]?.retained)).toBe(true)
    const expected: Record<string, string> = {
      gold_rope_chain_585: 'jeweler',
      watch_pobeda_gold: 'watchmaker',
      medal_for_courage: 'collector',
      phone_mangosteen_m5: 'technician',
      camera_zenit_e: 'technician',
    }
    for (const [defId, id] of Object.entries(expected)) expect(toolExtras(s, getItemDef(defId)).specialist?.id, defId).toBe(id)
    expect(toolExtras(s, { ...chain, category: 'icons' }).specialist?.id).toBe('antiquary')
    expect(toolExtras(s, { ...chain, category: 'electronics' }).specialist?.id).toBe('technician')

    const phone = getItemDef('phone_mangosteen_m5')
    const at = inspecting(s, makeItem(phone, undefined, 3))
    const call = availableTools(at, phone).find((t) => t.tool === 'specialist')!
    expect(call.seconds).toBe(tuning.specialists.roster.technician!.callSeconds)
    expect(specialistCallSeconds('technician')).toBeLessThan(tuning.inspect.toolSeconds.specialist)
    expect(specialistCallSeconds('jeweler')).toBe(tuning.inspect.toolSeconds.specialist)
    expect(use(at, 'specialist').current!.elapsed).toBe(specialistCallSeconds('technician'))
  })
})

describe('specialist roster', () => {
  it('every specialist has tuning, nobody shares a category, and every item category has someone', () => {
    const ids = SPECIALISTS.map((s) => s.id)
    expect(ids).toHaveLength(5)
    expect(Object.keys(tuning.specialists.roster).sort()).toEqual([...ids].sort())
    const cats = SPECIALISTS.flatMap((s) => s.categories)
    expect(new Set(cats).size).toBe(cats.length)
    for (const def of ITEM_DEFS) expect(cats, def.id).toContain(def.category)
    for (const r of Object.values(tuning.specialists.roster)) {
      expect(r.calls).toBeGreaterThan(0)
      expect(r.perCall).toBeGreaterThan(r.fee / r.calls) // extra calls cost more than allowance calls
      expect(r.accuracy).toBeLessThan(tuning.specialists.maxAccuracy)
    }
  })

  it('all five on retainer: five bills at month end, and the save code still round-trips', () => {
    let s = closedOn('2014-03-30', 7, 200_000)
    for (const spec of SPECIALISTS) s = retainSpecialist(s, spec.id)
    const bills = upcomingBills(s)
    for (const spec of SPECIALISTS) expect(bills.map((b) => b.label)).toContain(`Retainer: ${spec.short}`)
    const fees = SPECIALISTS.reduce((a, spec) => a + tuning.specialists.roster[spec.id]!.fee, 0)
    const before = s.cash
    s = playEmptyDay({ ...s, calendar: { ...s.calendar, date: '2014-03-31' } })
    expect(before - s.cash).toBe(monthly + fees)
    for (const spec of SPECIALISTS) {
      expect(callsLeft(s, spec.id)).toBe(tuning.specialists.roster[spec.id]!.calls)
      expect(s.day.log.some((e) => e.text.startsWith(`Retainer: ${spec.name}, April`)), spec.id).toBe(true)
    }
    const none = encodeSaveCode(closedOn('2014-03-30', 7, 200_000))
    const code = encodeSaveCode(s)
    expect(decodeSaveCode(code).specialists).toEqual(s.specialists)
    expect(code.length - none.length).toBeLessThan(600)
  })
})
