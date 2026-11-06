/** M5 the Collector (src/data/collector.ts, src/game/crime/collector.ts, src/data/stories/collector.ts). */
import { describe, expect, it } from 'vitest'
import { startedState } from './helpers'
import { atDay, beatAtCounter, choose, eligible, offer, pass, readScene, run } from './storyHelpers'
import { COLLECTOR, COLLECTOR_ICON, ROOFER } from '../src/data/collector'
import { CAST } from '../src/data/customers/cast'
import { FENCE } from '../src/data/fence'
import { getItemDef, ITEM_DEFS, SPAWN_DEFS } from '../src/data/items'
import { VOLKOVA } from '../src/data/police'
import { REGULARS } from '../src/data/regulars'
import { SPECIALISTS } from '../src/data/specialists'
import { ARCS } from '../src/data/stories'
import { tuning } from '../src/data/tuning'
import { claimedValue } from '../src/game/appraise/value'
import { applyCollectorChange, COLLECTOR_ID, heldIcon } from '../src/game/crime/collector'
import { TRAIL } from '../src/game/crime/events'
import { useTool } from '../src/game/inspect/tools'
import { epilogueCards } from '../src/game/endings/epilogue'
import { Rng } from '../src/game/rng'
import { scriptedItem } from '../src/game/story/scripted'
import type { GameState } from '../src/game/state'

const C = tuning.collector
/** Looks reserved for arc characters (tests/specialistArcs.test.ts). */
const RESERVED_LOOKS = new Set(['business_male_05', 'male_adult_06', 'male_adult_20', 'male_adult_11'])
const icon = getItemDef(COLLECTOR_ICON)
const flags = (s: GameState) => s.story.flags
const trails = (s: GameState) => s.crime.events.filter((e) => e.kind === TRAIL)

/** A career on the morning of `day`, plenty of cash, the wish heard on day 20. */
function asked(day = 26, seed = 51): GameState {
  let s = { ...atDay(startedState(seed, `collector-${seed}`), 20), cash: 200_000 }
  s = readScene(beatAtCounter(s, 'collector.wish', 20))
  s = run(s, { type: 'scene/next' })
  return atDay(s, day)
}

/** Bought the icon from Seryozha on `day`. */
function bought(day = 26, seed = 51): GameState {
  let s = beatAtCounter(asked(day, seed), 'collector.icon', day)
  s = readScene(s)
  s = run(s, { type: 'scene/next' })
  s = offer(s, s.current!.item!.trueValue)
  return s
}

describe('the Collector: content', () => {
  it('wears a male walk-in look nobody else in the cast is given', () => {
    const look = CAST.find((c) => c.id === COLLECTOR.look)
    expect(look).toBeDefined()
    expect(look!.regular ?? false).toBe(false)
    expect(look!.gender).toBe('m')
    expect(RESERVED_LOOKS.has(COLLECTOR.look)).toBe(false)
    expect([FENCE.look, VOLKOVA.look]).not.toContain(COLLECTOR.look)
    expect(REGULARS.some((r) => r.look === COLLECTOR.look)).toBe(false)
    expect(SPECIALISTS.some((s) => s.look === COLLECTOR.look)).toBe(false)
    // Seryozha the roofer is a stranger in another walk-in look.
    expect(ROOFER.look).not.toBe(COLLECTOR.look)
    expect(SPECIALISTS.some((s) => s.id === COLLECTOR_ID)).toBe(false)
  })

  it('every arc’s one-off strangers wear walk-in looks no named character wears, one look each', () => {
    // Named people: regulars, specialists, the fence, Volkova, the Collector, the reserved arc looks.
    const named = new Set([...RESERVED_LOOKS, FENCE.look, VOLKOVA.look, COLLECTOR.look, ...REGULARS.map((r) => r.look), ...SPECIALISTS.flatMap((s) => (s.look ? [s.look] : []))])
    const strangers = new Map<string, string>([[ROOFER.look, ROOFER.name]])
    for (const arc of ARCS) {
      for (const b of arc.beats) {
        const as = b.visit.as
        // Volkova off duty is herself, in her own look.
        if (!as || (b.visit.who === VOLKOVA.id && as.look === VOLKOVA.look)) continue
        const look = CAST.find((c) => c.id === as.look)
        expect(look, `${b.id} ${as.look}`).toBeDefined()
        expect(look!.regular ?? false, `${b.id} ${as.look}`).toBe(false)
        expect(named.has(as.look), `${b.id} ${as.name} in ${as.look}`).toBe(false)
        const other = strangers.get(as.look)
        expect(other === undefined || other === as.name, `${as.name} and ${other} both wear ${as.look}`).toBe(true)
        strangers.set(as.look, as.name)
      }
    }
    expect(strangers.size).toBeGreaterThanOrEqual(5)
  })

  it('the icon is story-only: real, but never in the walk-in pool or the bulletin', () => {
    expect(ITEM_DEFS.some((d) => d.id === COLLECTOR_ICON)).toBe(true)
    expect(SPAWN_DEFS.some((d) => d.id === COLLECTOR_ICON)).toBe(false)
    expect(SPAWN_DEFS.length).toBe(ITEM_DEFS.length - 1)
    expect(icon.fakeChance).toBe(0)
  })

  it('every beat is his, Stanislav’s call aside, and the three answers are sell / return / police', () => {
    const arc = ARCS.find((a) => a.id === 'collector')!
    for (const b of arc.beats) expect([COLLECTOR_ID, 'antiquary']).toContain(b.visit.who)
    const offerBeat = arc.beats.find((b) => b.id === 'collector.offer')!
    expect(offerBeat.visit.scene!.choices.map((c) => c.id)).toEqual(['sell', 'return', 'police'])
  })
})

describe('the Collector: the icon comes in', () => {
  it('he asks from day 18; Seryozha comes 6+ days later, cheap, with a parish number on the back', () => {
    const early = atDay(startedState(51, 'collector-early'), C.wishDay - 1)
    expect(eligible(early, 'collector.wish')).toBe(false)
    expect(eligible(atDay(early, C.wishDay), 'collector.wish')).toBe(true)

    const s = asked(20 + C.iconAfter - 1)
    expect(flags(s)).toContain('collector.asked')
    expect(eligible(s, 'collector.icon')).toBe(false)
    expect(eligible(atDay(s, 20 + C.iconAfter), 'collector.icon')).toBe(true)

    const counter = run(readScene(beatAtCounter(atDay(s, 26), 'collector.icon', 26)), { type: 'scene/next' })
    expect(counter.current!.customer.name).toBe(ROOFER.name)
    const item = counter.current!.item!
    expect(item.defId).toBe(COLLECTOR_ICON)
    expect(item.provenance).toBe('stolen')
    expect(item.authenticity).toBe('genuine')

    // visit.anchor: he opens at about a third of what she'd fetch.
    const inspecting = run(counter, { type: 'counter/inspect' }, { type: 'inspect/done' }, { type: 'offer/estimate', value: item.trueValue }, { type: 'offer/make', amount: 1000, approach: 'straight' })
    expect(inspecting.haggle!.ask).toBeLessThan(claimedValue(icon, item) * 0.6)
  })

  it('the loupe finds the parish inventory number (a provenance finding)', () => {
    const item = scriptedItem(icon, { authenticity: 'genuine', provenance: 'stolen', story: 'x' }, new Rng(3), 'i1')
    const seen = new Set<string>()
    let previous: ReturnType<typeof useTool>['findings'] = []
    for (let i = 0; i < 12; i++) {
      const r = useTool({ item, def: icon, tool: 'loupe', hotspot: 'back', previous, uses: i, rng: new Rng(i) })
      previous = [...previous, ...r.findings]
      for (const f of r.findings) if (f.tellId) seen.add(f.tellId)
    }
    expect(seen.has('inventory')).toBe(true)
    expect(previous.find((f) => f.tellId === 'inventory')!.reveals).toBe('provenance')
  })

  it('buying her leaves a police trail; the paper names the church the next morning', () => {
    let s = bought()
    expect(flags(s)).toContain('collector.bought')
    s = run(s, { type: 'counter/next' })
    expect(heldIcon(s)).toBeDefined()
    expect(eligible(atDay(s, 26), 'collector.news')).toBe(false)
    expect(eligible(atDay(s, 27), 'collector.news')).toBe(true)
    // Buying a stolen piece lays a police trail that names it (src/game/crime/heat.ts).
    expect(trails(s).some((e) => e.data?.item === heldIcon(s)!.id)).toBe(true)
  })

  it('passing on her: the museum opens with her anyway, 10 days on', () => {
    let s = beatAtCounter(asked(), 'collector.icon', 26)
    s = pass(run(readScene(s), { type: 'scene/next' }))
    expect(flags(s)).toContain('collector.passed')
    expect(eligible(atDay(s, 26 + C.elsewhereAfter - 1), 'collector.elsewhere')).toBe(false)
    expect(eligible(atDay(s, 26 + C.elsewhereAfter), 'collector.elsewhere')).toBe(true)
    expect(eligible(atDay(s, 40), 'collector.offer')).toBe(false)
  })
})

describe('the Collector: Stanislav and the offer', () => {
  it('Stanislav rings only while he is on retainer and you hold her', () => {
    const s = bought()
    const day = atDay(s, 28)
    expect(eligible(day, 'collector.stanislav')).toBe(false)
    const retained = { ...day, specialists: { ...day.specialists, antiquary: { ...day.specialists['antiquary']!, retained: true } } } as GameState
    expect(eligible(retained, 'collector.stanislav')).toBe(true)
    expect(eligible(applyCollectorChange(retained, 'returned'), 'collector.stanislav')).toBe(false)
  })

  it('he comes with the hatbox 4+ days on, only while you hold her', () => {
    const s = bought()
    expect(eligible(atDay(s, 26 + C.offerAfter - 1), 'collector.offer')).toBe(false)
    expect(eligible(atDay(s, 26 + C.offerAfter), 'collector.offer')).toBe(true)
    const gone = applyCollectorChange(atDay(s, 30), 'returned')
    expect(eligible(gone, 'collector.offer')).toBe(false)
    expect(eligible(gone, 'collector.missed')).toBe(true)
  })

  function answer(choice: 'sell' | 'return' | 'police') {
    const before = atDay(bought(), 30)
    const id = heldIcon(before)!.id
    const withTrail = { ...before, crime: { ...before.crime, events: [...before.crime.events, { day: 28, kind: TRAIL, data: { item: id } }] } } as GameState
    const after = choose(beatAtCounter(withTrail, 'collector.offer', 30), choice)
    return { before: withTrail, after, id }
  }

  it('sell: 350,000 in the hatbox, dirty, heat, the police cooler; the trail stays', () => {
    const { before, after, id } = answer('sell')
    expect(after.cash).toBe(before.cash + C.price)
    expect(heldIcon(after)).toBeUndefined()
    expect(flags(after)).toEqual(expect.arrayContaining(['collector.sold', 'dirty.collector_icon']))
    expect(after.career.axes.clean).toBeCloseTo(before.career.axes.clean + tuning.axes.storyDirty)
    expect(after.crime.heat).toBeCloseTo(before.crime.heat + C.heat.sold, 5)
    expect(after.reputation.byGroup.police).toBeLessThan(before.reputation.byGroup.police)
    expect(trails(after).some((e) => e.data?.item === id)).toBe(true)
    expect(after.stats.itemsSold).toBe(before.stats.itemsSold + 1)
    expect(eligible(atDay(after, 30 + C.museumAfter), 'collector.museum')).toBe(true)
  })

  it('return: back to her church for nothing; heart and clean, the street warmer, the trail closed', () => {
    const { before, after, id } = answer('return')
    expect(after.cash).toBe(before.cash)
    expect(heldIcon(after)).toBeUndefined()
    expect(flags(after)).toEqual(expect.arrayContaining(['collector.returned', 'heart.collector_icon']))
    expect(after.career.axes.heart).toBeCloseTo(before.career.axes.heart + tuning.axes.storyHeart)
    expect(after.career.axes.clean).toBeCloseTo(before.career.axes.clean + tuning.axes.iconReturned)
    expect(after.reputation.byGroup.neighbourhood).toBeGreaterThan(before.reputation.byGroup.neighbourhood)
    expect(trails(after).some((e) => e.data?.item === id)).toBe(false)
    expect(eligible(atDay(after, 30 + C.paperAfter), 'collector.thanks')).toBe(true)
  })

  it('police: handed in; clean, heat down, the police warmer, the trail closed', () => {
    const hot = (s: GameState) => ({ ...s, crime: { ...s.crime, heat: 0.4 } })
    const before = atDay(bought(), 30)
    const id = heldIcon(before)!.id
    const after = choose(beatAtCounter(hot(before), 'collector.offer', 30), 'police')
    expect(after.cash).toBe(before.cash)
    expect(flags(after)).toContain('collector.handed_in')
    expect(after.career.axes.clean).toBeCloseTo(before.career.axes.clean + tuning.axes.iconHandedIn)
    expect(after.crime.heat).toBeLessThan(0.4)
    expect(after.reputation.byGroup.police).toBeGreaterThan(before.reputation.byGroup.police)
    expect(trails(after).some((e) => e.data?.item === id)).toBe(false)
    expect(eligible(atDay(after, 30 + C.paperAfter), 'collector.recovered')).toBe(true)
  })

  it('each paper ends the arc', () => {
    const { after } = answer('return')
    let s = beatAtCounter(after, 'collector.thanks', 30 + C.paperAfter)
    s = readScene(s)
    s = run(s, { type: 'scene/next' })
    expect(s.story.arcs['collector']?.ended).toBe(true)
  })

  it('the effect does nothing if you no longer hold her', () => {
    const s = startedState(52, 'collector-none')
    expect(applyCollectorChange(s, 'sold')).toBe(s)
  })
})

describe('the Collector: what became of him', () => {
  const card = (f: string[]) => {
    const s = startedState(53, 'collector-card')
    return epilogueCards({ ...s, story: { ...s.story, flags: f } }).find((c) => c.id === 'collector')
  }

  it('shows once he has asked, and reads how she left the shop', () => {
    expect(card([])).toBeUndefined()
    const texts = [[], ['collector.sold'], ['collector.returned'], ['collector.handed_in'], ['collector.missed'], ['collector.passed']].map(
      (f) => card(['collector.asked', ...f])!.text,
    )
    expect(new Set(texts).size).toBe(texts.length)
    expect(card(['collector.asked'])!.name).toBe(COLLECTOR.name)
  })
})
