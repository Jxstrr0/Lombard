/** M5 endings system: the title picker, eviction, retiring, ended careers and their slots, the epilogue. */
import { describe, expect, it } from 'vitest'
import { EPILOGUE_CARDS, EPILOGUE_PAPER, ENDING_TITLES } from '../src/data/endings'
import { tuning } from '../src/data/tuning'
import { reducer } from '../src/game/actions'
import { daysRun, endCareer } from '../src/game/endings/end'
import { epilogueOf } from '../src/game/endings/epilogue'
import { checkEviction, hasNotice, NOTICE_FLAG } from '../src/game/endings/eviction'
import { endingReview, lateCareer } from '../src/game/endings/review'
import { pickTitle, TITLE_IDS, TITLE_KIND, titleOf, wealthOf, type TitleId } from '../src/game/endings/title'
import { mostRecentSlot, summarizeCareer, type SlotView } from '../src/game/save/slots'
import { seasonOf, weekdayOf, type CareerEndKind, type GameState, type Group } from '../src/game/state'
import { startedState } from './helpers'

const B = tuning.endings.bands

/** A started career with the given axes, money and standing (no stock, no loans). */
function career(o: { cash?: number; clean?: number; heart?: number; rep?: Partial<Record<Group, number>>; flags?: string[]; heat?: number; fenceDeals?: number; day?: number } = {}): GameState {
  const s = startedState(1, 'c')
  return {
    ...s,
    inventory: [],
    loans: [],
    cash: o.cash ?? 100_000,
    calendar: { ...s.calendar, day: o.day ?? 120 },
    career: { ...s.career, axes: { clean: o.clean ?? 0, heart: o.heart ?? 0 } },
    reputation: { ...s.reputation, byGroup: { ...s.reputation.byGroup, ...o.rep } },
    story: { ...s.story, flags: o.flags ?? [] },
    crime: { ...s.crime, heat: o.heat ?? 0, fence: { ...s.crime.fence, deals: o.fenceDeals ?? 0, met: (o.fenceDeals ?? 0) > 0 } },
  }
}

const rich = B.wealth.rich + 1
const comfy = B.wealth.comfortable + 1
const modest = B.wealth.modest + 1
const poor = B.wealth.modest - 1
const warm = B.heart.warm
const loved = { neighbourhood: B.standing.loved }

describe('ending titles', () => {
  const cases: [TitleId, GameState][] = [
    ['front', career({ flags: ['protection.paying'], rep: { mob: B.standing.owned } })],
    ['fence', career({ cash: rich, clean: B.clean.dirty, heat: B.coolHeat + 1 })],
    ['fence', career({ cash: rich, clean: B.clean.dirty, fenceDeals: B.fenceDeals })],
    ['gotOutClean', career({ cash: rich, clean: B.clean.dirty })],
    ['smallFry', career({ cash: modest, clean: B.clean.dirty })],
    ['soldOut', career({ cash: rich, heart: B.heart.cold })],
    ['soldOut', career({ cash: rich, rep: { neighbourhood: -0.2 } })],
    ['pillar', career({ cash: rich, heart: warm, rep: loved })],
    ['banker', career({ cash: rich })],
    ['neighbourhood', career({ cash: modest, heart: warm, rep: loved })],
    ['honest', career({ cash: modest, heart: 1 })],
    ['hardBargain', career({ cash: comfy, heart: B.heart.cold })],
    ['scrapedBy', career({ cash: poor })],
    ['pawnbroker', career({ cash: modest, clean: -2 })],
  ]
  it.each(cases)('a retired career can be %s', (id, s) => {
    expect(pickTitle(s, 'retired')).toBe(id)
  })

  it('every retired title is reachable (the cases above cover them all)', () => {
    const retired = TITLE_IDS.filter((t) => TITLE_KIND[t] === 'retired')
    expect(new Set(cases.map(([id]) => id))).toEqual(new Set(retired))
  })

  it('forced endings get their own titles, coloured by the axes', () => {
    expect(pickTitle(career({ cash: -10_000 }), 'evicted')).toBe('evicted')
    expect(pickTitle(career({ cash: -10_000, heart: warm, rep: loved }), 'evicted')).toBe('evictedKind')
    expect(pickTitle(career(), 'raided')).toBe('raidedClean')
    expect(pickTitle(career({ clean: -2 }), 'raided')).toBe('raided')
    expect(pickTitle(career({ cash: rich, clean: B.clean.dirty }), 'raided')).toBe('raidedRich')
    expect(pickTitle(career({ flags: ['protection.paying'] }), 'pushedOut')).toBe('pushedOut')
    expect(pickTitle(career({ flags: ['protection.refused'] }), 'pushedOut')).toBe('pushedOutStood')
    for (const id of TITLE_IDS) expect(TITLE_KIND[id]).toBeDefined()
  })

  it('wealth counts cash, what the stock is really worth and principal lent out', () => {
    const s = startedState(1, 'c')
    const stock = s.inventory.reduce((a, i) => a + i.trueValue, 0)
    expect(wealthOf(s)).toBe(Math.round(s.cash + stock))
  })

  it('is deterministic and recorded when the career ends, so it never shifts later', () => {
    const s = career({ cash: modest, heart: warm, rep: loved })
    const over = endCareer(s, 'retired')
    expect(over.career.end?.title).toBe('neighbourhood')
    expect(endCareer(s, 'retired')).toEqual(over)
    // Standing that changes afterwards (it can't, but a stale save could) doesn't move the title.
    const later = { ...over, reputation: { ...over.reputation, byGroup: { ...over.reputation.byGroup, neighbourhood: -1 } } }
    expect(titleOf(later)).toBe('neighbourhood')
  })
})

/** The open day before closing on `date`, nobody left in the shop. */
function closingOn(s: GameState, date: string, cash: number): GameState {
  return { ...s, cash, queue: [], current: null, calendar: { ...s.calendar, date, weekday: weekdayOf(date), season: seasonOf(date) }, day: { ...s.day, phase: 'open', log: [], openingCash: cash } }
}

describe('eviction', () => {
  const owed = tuning.expenses.rent + tuning.expenses.utilities

  it('is only judged on rent night', () => {
    const s = closingOn(startedState(1, 'c'), '2014-03-20', -50_000)
    expect(checkEviction(s)).toEqual({ state: s, evicted: false })
  })

  it('under water on rent night: a final notice; under again next rent night: the keys go back', () => {
    let s = reducer(closingOn(startedState(1, 'c'), '2014-03-31', owed - 5_000), { type: 'day/close' })
    expect(s.cash).toBeLessThan(tuning.endings.eviction.line)
    expect(hasNotice(s)).toBe(true)
    expect(s.career.end).toBeNull()
    expect(s.day.log.some((e) => e.kind === 'story' && e.text.includes('Final notice'))).toBe(true)
    const day = s.calendar.day
    s = reducer({ ...closingOn(s, '2014-04-30', 1_000), inventory: [] }, { type: 'day/close' }) // nothing to sell either
    expect(s.career.end).toMatchObject({ kind: 'evicted', day: day + 1 })
    expect(daysRun(s)).toBe(day)
  })

  it('back in credit by the next rent night: the notice is withdrawn', () => {
    let s = reducer(closingOn(startedState(1, 'c'), '2014-03-31', owed - 5_000), { type: 'day/close' })
    s = reducer(closingOn(s, '2014-04-30', owed + 10_000), { type: 'day/close' })
    expect(hasNotice(s)).toBe(false)
    expect(s.career.end).toBeNull()
    expect(s.story.flags).not.toContain(NOTICE_FLAG)
  })

  it('still under on cash, but stock the dealer would cover it with: the notice stands, no eviction yet', () => {
    let s = reducer(closingOn(startedState(1, 'c'), '2014-03-31', owed - 5_000), { type: 'day/close' })
    s = closingOn(s, '2014-04-30', 1_000)
    const short = owed - 1_000 + 5_000 // what tonight leaves owing, and some
    const piece = { ...s.inventory[0]!, id: 'big', trueValue: Math.ceil(short / tuning.endings.eviction.stockShare) }
    s = reducer({ ...s, inventory: [piece] }, { type: 'day/close' })
    expect(s.career.end).toBeNull()
    expect(hasNotice(s)).toBe(true)
    expect(s.day.log.some((e) => e.text.includes('Sell them'))).toBe(true)
  })

  it('a cash dip between rent nights is not a notice', () => {
    const s = reducer(closingOn(startedState(1, 'c'), '2014-03-20', -20_000), { type: 'day/close' })
    expect(hasNotice(s)).toBe(false)
  })
})

describe('retiring and ended careers', () => {
  it('Retire works from the ledger on the retire day, not before', () => {
    const early = lateCareer(1, 'c', tuning.endings.retireDay - 1)
    expect(reducer(early, { type: 'career/retire' })).toBe(early)
    const s = reducer(lateCareer(1, 'c', tuning.endings.retireDay), { type: 'career/retire' })
    expect(s.career.end).toMatchObject({ kind: 'retired', day: tuning.endings.retireDay })
    expect(daysRun(s)).toBe(tuning.endings.retireDay - 1)
  })

  it('an ended career cannot be played on', () => {
    const over = reducer(lateCareer(1, 'c', tuning.endings.retireDay), { type: 'career/retire' })
    for (const a of [{ type: 'day/open' }, { type: 'ledger/sell', itemId: over.inventory[0]?.id ?? 'x' }, { type: 'upgrade/buy', id: 'acid_kit' }, { type: 'time/tick', seconds: 5 }] as const) {
      expect(reducer(over, a)).toBe(over)
    }
    expect(reducer(over, { type: 'settings/set', patch: { textScale: 1.3 } }).settings.textScale).toBe(1.3)
  })

  it('its slot shows the title, and Continue skips it', () => {
    const over = endingReview(1, 'ended', 'retired')
    const sum = summarizeCareer(over, 10)
    expect(sum.end).toEqual({ kind: 'retired', title: ENDING_TITLES[titleOf(over)!].name, daysRun: 120 })
    expect(summarizeCareer(startedState(2, 'live'), 5).end).toBeNull()
    const slots: SlotView[] = [
      { slot: 1, career: summarizeCareer(startedState(2, 'live'), 5), damaged: false },
      { slot: 2, career: sum, damaged: false },
      { slot: 3, career: null, damaged: false },
    ]
    expect(mostRecentSlot(slots)?.slot).toBe(2)
    expect(mostRecentSlot(slots, true)?.slot).toBe(1)
    expect(mostRecentSlot([slots[1]!, slots[2]!], true)).toBeNull()
  })

  it('"New career" in an ended slot starts fresh', () => {
    const over = endingReview(1, 'ended', 'evicted')
    const fresh = reducer(over, { type: 'career/new', seed: 9, careerId: 'new' })
    expect(fresh.career.end).toBeNull()
    expect(fresh.meta.careerId).toBe('new')
    expect(fresh.meta.intro).toBe(true)
  })
})

describe('epilogue', () => {
  const KINDS: CareerEndKind[] = ['retired', 'evicted', 'raided', 'pushedOut']

  it('content validates: every title has text, every card a fallback, every section a default', () => {
    for (const id of TITLE_IDS) expect(ENDING_TITLES[id]?.name).toBeTruthy()
    for (const c of EPILOGUE_CARDS) expect(c.variants[c.variants.length - 1]!.when).toEqual([])
    for (const s of EPILOGUE_PAPER) expect(s.stories[s.stories.length - 1]!.when).toEqual([])
    expect(new Set(EPILOGUE_CARDS.map((c) => c.id)).size).toBe(EPILOGUE_CARDS.length)
    // M6: each of the twenty new regulars has a card (shown once you've got to know them).
    const ids = new Set(EPILOGUE_CARDS.map((c) => c.id))
    for (const id of ['artur', 'bakhtiyor', 'dilnoza', 'jamshid', 'patimat', 'snezhana', 'kira', 'alyona', 'grisha', 'vitya', 'prokhor', 'zakhar', 'ernest', 'styopa', 'klava', 'elvira', 'zhanna', 'nonna', 'zoya', 'larisa']) {
      expect(ids.has(id), id).toBe(true)
    }
  })

  it('the paper has no digits, like the morning paper (the shop name is filled in later)', () => {
    const texts = [...Object.values(ENDING_TITLES).flatMap((t) => [t.headline, t.body]), ...EPILOGUE_PAPER.flatMap((s) => s.stories.flatMap((n) => [n.headline, n.body]))]
    for (const t of texts) expect(t).not.toMatch(/[0-9]/)
  })

  it.each(KINDS)('a %s career gets a paper, cards and a summary', (kind) => {
    const s = endingReview(1, 'c', kind)
    const e = epilogueOf(s)!
    expect(e.summary.kind).toBe(kind)
    expect(TITLE_KIND[e.summary.title]).toBe(kind)
    expect(e.paper.length).toBe(1 + EPILOGUE_PAPER.length)
    expect(e.paper[0]!.headline).toBe(ENDING_TITLES[e.summary.title].headline)
    for (const n of e.paper) expect(`${n.headline} ${n.body}`, n.id).not.toMatch(/[{}]/)
    const ids = e.cards.map((c) => c.id)
    expect(ids).toEqual(expect.arrayContaining(['zinaida', 'fedya', 'edik', 'valentin', 'ilya', 'faina', 'volkova', 'crew']))
    expect(ids).not.toContain('gennady') // never kept on
    expect(ids.includes('fence')).toBe(kind === 'raided') // only met in the raided review
    for (const c of e.cards) expect(c.text).not.toMatch(/[{}]/)
    expect(e.summary).toMatchObject({ daysRun: 120, bestDeal: 41_500, worstDeal: 18_200, peopleHelped: 49 })
  })

  it('cards follow what happened: the story choices, the trust, the ending', () => {
    const e = epilogueOf(endingReview(1, 'c', 'retired'))!
    const text = (id: string) => e.cards.find((c) => c.id === id)!.text
    expect(text('zinaida')).toContain('Sennaya') // medals_conman_known
    expect(text('fedya')).toContain('postcard') // graduated, interest waived
    expect(text('ilya')).toContain('operation')
    expect(text('yevstafy')).toContain('Admiralty') // cold
    const raided = epilogueOf(endingReview(1, 'c', 'raided'))!
    expect(raided.cards.find((c) => c.id === 'volkova')!.text).toContain('search')
    expect(raided.paper.map((p) => p.id)).toContain('crime_raid_list')
  })

  it('Venya Mostovoy gets a card once met, shaped by deals against refusals, trust and the standing deal', () => {
    const F = tuning.fence
    const venya = (fence: Partial<GameState['crime']['fence']>, trust = 0, flags: string[] = [], kind: CareerEndKind = 'retired') => {
      const s = endingReview(1, 'c', 'retired')
      const t: GameState = {
        ...s,
        career: { ...s.career, end: { ...s.career.end!, kind } },
        story: { ...s.story, flags: [...s.story.flags, ...flags] },
        crime: { ...s.crime, fenceTrust: trust, fence: { ...s.crime.fence, met: true, deals: 0, refusals: 0, ...fence } },
      }
      return epilogueOf(t)!.cards.find((c) => c.id === 'fence')?.text
    }
    expect(venya({ met: false })).toBeUndefined()
    expect(venya({ deals: 2 }, 0, [], 'raided')).toContain('swapped his shift')
    expect(venya({ deals: F.standing.deals }, F.standing.trust, ['dirty.fence_standing'])).toContain('in pen')
    expect(venya({ deals: F.standing.deals }, F.warmAt)).toContain('pirozhki')
    expect(venya({ refusals: F.soreAt, deals: 1 })).toContain('every no')
    expect(venya({ deals: 2, refusals: 1 })).toContain('every price')
    expect(venya({ refusals: 1 })).toContain('one no')
  })

  it('Protection: Eduard Lvovich and Zhora follow whether you paid, held out, or were pushed out', () => {
    const card = (s: GameState, id: string) => epilogueOf(s)!.cards.find((c) => c.id === id)?.text
    const out = endingReview(1, 'c', 'pushedOut')
    expect(out.career.end!.title).toBe('pushedOutStood')
    expect(card(out, 'crew')).toContain('nephew')
    expect(card(out, 'zhora')).toContain('van')
    expect(epilogueOf(out)!.paper.map((p) => p.id)).toContain('premises_pushed')
    const paid = endingReview(1, 'c', 'retired')
    expect(card(paid, 'crew')).toContain('first of the month')
    expect(card(paid, 'zhora')).toContain('envelope')
    const held: GameState = { ...paid, story: { ...paid.story, flags: [...paid.story.flags.filter((f) => f !== 'protection.paying'), 'protection.refused', 'protection.held_out'] } }
    expect(card(held, 'crew')).toContain('broom')
    expect(card(held, 'zhora')).toContain('bakery')
    expect(epilogueOf(held)!.paper.map((p) => p.id)).toContain('crime_held_out')
  })

  it('Volkova gets a card once met, shaped by bribes, lies caught and trust; met and nothing else still reads', () => {
    const base = endingReview(1, 'c', 'retired')
    const volkova = (v: Partial<GameState['crime']['volkova']>, flags: string[] = []) => {
      const s: GameState = {
        ...base,
        story: { ...base.story, flags: [...base.story.flags, ...flags] },
        crime: { ...base.crime, volkova: { ...base.crime.volkova, met: true, trust: 0, lies: 0, caught: 0, bribes: 0, ...v } },
      }
      return epilogueOf(s)!.cards.find((c) => c.id === 'volkova')?.text
    }
    expect(volkova({ met: false })).toBeUndefined()
    expect(volkova({}, ['police.bribe_refused'])).toContain('unopened')
    expect(volkova({ bribes: 1 })).toContain('port')
    expect(volkova({ caught: 1, lies: 1 })).toContain('lied')
    expect(volkova({ trust: 0.5 })).toContain('inspector')
    expect(volkova({ trust: 0.1 }, ['police.cooperated'])).toContain('handed her a watch')
    expect(volkova({})).toContain('all eleven') // only her introduction
    // Her own arc (src/data/stories/volkova.ts).
    expect(volkova({ bribes: 1 }, ['volkova.leaked'])).toContain('I said twice')
    expect(volkova({ bribes: 1 }, ['dirty.volkova_evidence'])).toContain('bag')
    expect(volkova({ bribes: 1 }, ['volkova.reported'])).toContain('three months')
    expect(volkova({ caught: 1 }, ['volkova.grudge'])).toContain('Tuesdays')
    expect(volkova({ caught: 1 }, ['volkova.friend'])).toContain('bayan')
    expect(volkova({ trust: 0.6 }, ['volkova.crackdown'])).toContain('clean cars')
    expect(volkova({ trust: 0.6 }, ['heart.volkova_recital'])).toContain('House of Culture')
    expect(volkova({ trust: 0.1 }, ['heart.volkova_father', 'police.cooperated'])).toContain('Seventh Bridge')
  })

  it('no ending, no epilogue', () => {
    expect(epilogueOf(startedState(1, 'c'))).toBeNull()
  })
})
