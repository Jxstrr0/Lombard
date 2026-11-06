/**
 * Dev-only review careers (?scenario=…, ?regular=…; the list is in main.ts's
 * header). Split out of main.ts so this code, and the review helpers it pulls
 * in (game/endings/review, game/city/review), load only when a review URL asks
 * for one (M6 perf pass): a player's first load never downloads it.
 */
import { tuning } from '../data/tuning'
import { reducer } from '../game/actions'
import { ITEM_DEFS } from '../data/items'
import { generateWalkIn } from '../game/customers/walkins'
import { generateItem } from '../game/items/generate'
import { Rng } from '../game/rng'
import { beatVisit, regularCustomer, regularVisit } from '../game/story/plan'
import { THREADS } from '../data/stories/threads'
import { recordBeat, setMemory } from '../game/story/progress'
import { specialistCustomer } from '../game/story/specialists'
import { fenceGoods } from '../game/crime/fence'
import { bulletinPiece, wearOf } from '../game/crime/bulletin'
import { addEvent, BRING, RAID, TRAIL } from '../game/crime/events'
import { volkovaCustomer } from '../game/crime/volkova'
import { applyStaffChange, servable } from '../game/staff/appraiser'
import { BULLETIN } from '../data/news'
import { COLLECTOR_ICON } from '../data/collector'
import { scriptedItem } from '../game/story/scripted'
import { BRICK } from '../game/crime/vandalism'
import { placeItem } from '../game/shop/display'
import type { QueuedVisit } from '../game/types'
import { getRegular } from '../data/regulars'
import { getBeat } from '../data/stories'
import type { CareerEndKind, GameState } from '../game/state'
import { endingReview, lateCareer } from '../game/endings/review'
import { floodReview, paperReview } from '../game/city/review'

/** Dev-only (?seed=N&scenario=redeem): a pawner whose 12-day-old loan is due today is first in line. */
function redeemScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  const rng = new Rng(s.meta.seed)
  const def = ITEM_DEFS.find((d) => d.category === 'watches') ?? ITEM_DEFS[0]!
  const item = { ...generateItem(def, rng, 'i-dev'), authenticity: 'genuine' as const }
  const day = s.calendar.day
  const customer = { ...generateWalkIn(rng, 'c-dev'), temperament: 'flexible' as const }
  const principal = Math.max(1000, Math.round((item.trueValue * 0.45) / 100) * 100)
  const startDay = day - 12
  const loan = { id: 'l-dev', item, customer, principal, startDay, dueDay: startDay + tuning.loans.termDays, monthlyRate: tuning.loans.monthlyRate, redeemDay: day }
  s = reducer({ ...s, loans: [loan] }, { type: 'day/open' })
  const visit = s.queue.find((v) => v.loanId === loan.id)
  return visit ? { ...s, queue: [visit, ...s.queue.filter((v) => v !== visit)] } : s
}

/** Dev-only (?seed=N&scenario=story): Zinaida Petrovna is first in line with the medals arc's choice scene. */
function storyScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = reducer(s, { type: 'day/open' })
  const who = getRegular('zinaida')
  const beat = getBeat('medals.truth')
  if (!who || !beat) return s
  const visit: QueuedVisit = { visitId: 'v-dev-story', kind: 'scene', customer: regularCustomer(who), patience: tuning.story.patience, beatId: beat.id, line: beat.visit.scene?.lines[0] }
  return { ...s, queue: [visit, ...s.queue] }
}

/** Dev-only (?scenario=<key>): the beat each arc scenario puts first in line on day 1. */
const BEAT_SCENARIOS: Record<string, string> = {
  rolex: 'rolex.omeca',
  laptop: 'laptop.rent',
  protection: 'protection.offer',
  fence: 'fence.meet',
  delivery: 'protection.delivery_phones',
  // M5 Volkova's arc (src/data/stories/volkova.ts) and Stanislav's icon.
  'volkova-father': 'volkova.father',
  'volkova-source': 'volkova.source',
  'volkova-stakeout': 'volkova.stakeout',
  'volkova-short': 'volkova.short',
  'volkova-personal': 'volkova.personal',
  'volkova-inform': 'volkova.inform',
  'volkova-leak': 'volkova.leak',
  'volkova-icon': 'volkova.icon',
  'stanislav-icon': 'stanislav.icon',
  // M6: each new regular's thread opens with its first beat (?scenario=grisha, ?scenario=alyona, …).
  ...Object.fromEntries(THREADS.map((a) => [a.id, a.beats[0]!.id])),
}

/** Dev-only (?scenario=collector): his wish first, then Seryozha with the icon. */
function collectorScenario(s0: GameState): GameState {
  const s = beatScenario(s0, 'collector.icon')
  const wish = getBeat('collector.wish')
  const visit = wish && beatVisit(s, wish, (prefix) => `${prefix}-dev-wish`)
  return visit ? { ...s, queue: [visit, ...s.queue], day: { ...s.day, total: s.day.total + 1 } } : s
}

/** Dev-only (?scenario=collector-offer): the icon bought from Seryozha and in stock; he is first in line with the hatbox. */
function collectorOfferScenario(s0: GameState): GameState {
  let s = s0
  const def = ITEM_DEFS.find((d) => d.id === COLLECTOR_ICON)
  if (!def) return s
  const icon = scriptedItem(def, { authenticity: 'genuine', provenance: 'stolen', condition: [70, 70], story: 'My gran’s.' }, new Rng(7), 'i-dev-icon')
  s = { ...s, cash: s.cash - 12_000, inventory: [...s.inventory, icon], paid: { ...s.paid, [icon.id]: 12_000 } }
  s = recordBeat(s, 'collector.icon', { day: s.calendar.day, outcome: 'bought' })
  return beatScenario(s, 'collector.offer')
}

function beatScenario(s0: GameState, beatId: string): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = reducer(s, { type: 'day/open' })
  const beat = getBeat(beatId)
  if (!beat) return s
  let n = 0
  const visit = beatVisit(s, beat, (prefix) => `${prefix}-dev-${n++}`)
  return visit ? { ...s, queue: [visit, ...s.queue], day: { ...s.day, total: s.day.total + 1 } } : s
}

/** Dev-only (M6): the second counter bought and Lev hired before day 1 opens (his first morning already played unless `fresh`). */
function appraiserHired(s0: GameState, fresh = false): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = { ...s, shop: { ...s.shop, upgrades: [...s.shop.upgrades, 'second_counter'] } }
  s = reducer(s, { type: 'staff/hire' })
  return fresh ? s : recordBeat(s, 'appraiser.start', { day: 0, outcome: 'talked', choice: 'welcome' })
}

/** Dev-only (?scenario=appraiser-<beat>): the beat each scenario puts first in line, Lev on staff. */
const APPRAISER_SCENARIOS: Record<string, string> = {
  'appraiser-zhora': 'appraiser.zhora',
  'appraiser-confide': 'appraiser.confide',
  'appraiser-tin': 'appraiser.tin',
  'appraiser-yuri': 'appraiser.yuri',
  'appraiser-zhora-back': 'appraiser.zhora_back',
  'appraiser-vanish': 'appraiser.vanish',
  'appraiser-zhora-vanished': 'appraiser.zhora_vanished',
}

function appraiserScenario(s0: GameState, key: string): GameState {
  if (key === 'appraiser-start') return reducer(appraiserHired(s0, true), { type: 'day/open' })
  if (key === 'appraiser-paper') {
    // The tin went to Volkova days ago: the paper runs it this morning.
    const s = recordBeat(appraiserHired(s0), 'appraiser.tin', { day: 1 - tuning.appraiser.arc.afterTin, outcome: 'talked', choice: 'tin_police' })
    return reducer(s, { type: 'day/open' })
  }
  // After the voicemail he's gone (Zhora comes for the tin).
  const hiredS = appraiserHired(s0)
  const s = reducer(key === 'appraiser-zhora-vanished' ? applyStaffChange(hiredS, 'vanish') : hiredS, { type: 'day/open' })
  const beatId = APPRAISER_SCENARIOS[key]
  const beat = beatId ? getBeat(beatId) : undefined
  if (beat) {
    let n = 0
    const visit = beatVisit(s, beat, (prefix) => `${prefix}-dev-${n++}`)
    return visit ? { ...s, queue: [visit, ...s.queue], day: { ...s.day, total: s.day.total + 1 } } : s
  }
  // ?scenario=appraiser: he's serving a walk-in from the line at the second counter.
  const i = s.queue.findIndex((v, k) => k >= 1 && servable(v))
  const visit = s.queue[i]
  if (!visit) return s
  return { ...s, queue: s.queue.filter((_, k) => k !== i), staff: { ...s.staff, busy: { visit, until: s.day.clock + 600 } } }
}

/** Dev-only (?scenario=fence, after the meeting beat): the fence's next drop-in, with something to sell, second in line. */
function fenceGoodsSecond(s: GameState): GameState {
  const met = { ...s, crime: { ...s.crime, fence: { ...s.crime.fence, met: true } } }
  const goods = fenceGoods(met, (prefix, who) => `${prefix}-dev-${who}`)
  return { ...s, queue: [...s.queue.slice(0, 1), goods, ...s.queue.slice(1)], day: { ...s.day, total: s.day.total + 1 } }
}

/** Dev-only (M5 police): a stolen watch on the bulletin, bought `ago` days back and still in stock, with its trail. */
function holdHotWatch(s: GameState, ago: number): GameState {
  const day = s.calendar.day
  const defId = 'watch_poljot_strela'
  const piece = bulletinPiece(s, { id: 'b-dev', defId }, 'i-dev-hot', 'My grandfather’s. I’d keep it, but the rent won’t wait.')
  const name = ITEM_DEFS.find((d) => d.id === defId)?.name ?? defId
  const text = BULLETIN.line
    .replaceAll('{item}', name)
    .replaceAll('{wear}', wearOf(piece.condition))
    .replaceAll('{place}', BULLETIN.places[0]!)
    .replaceAll('{when}', BULLETIN.when[0]!.replaceAll('{day}', 'Friday'))
  const paid = Math.max(1000, Math.round((piece.trueValue * 0.3) / 100) * 100)
  const bought = day - ago
  s = {
    ...s,
    cash: s.cash - paid,
    inventory: [...s.inventory, piece],
    paid: { ...s.paid, [piece.id]: paid },
    crime: { ...s.crime, heat: 0.18, bulletin: [...s.crime.bulletin, { id: 'b-dev', day: Math.max(1, bought - 1), defId, itemId: piece.id, text }] },
  }
  const trail = { item: piece.id, def: defId, seller: 'Kirill Sobolev', bought, passport: 0, tape: 0, bulletin: 1, heat: 0 }
  return addEvent(s, { day: bought + 1, kind: TRAIL, data: trail })
}

/** Dev-only (?scenario=volkova): Detective Volkova is first in line, asking about the watch. */
function volkovaScenario(s0: GameState): GameState {
  let s = holdHotWatch(reducer(s0, { type: 'career/begin', shopName: '' }), 2)
  s = reducer(s, { type: 'day/open' })
  const visit: QueuedVisit = { visitId: `vs${s.calendar.day.toString(36)}_volkova`, kind: 'scene', customer: volkovaCustomer(), patience: tuning.police.patience, line: '' }
  const queue = [visit, ...s.queue.filter((v) => v.customer.id !== 'volkova')]
  return { ...s, queue, crime: { ...s.crime, volkova: { ...s.crime.volkova, nextDay: s.calendar.day + 7 } }, day: { ...s.day, total: queue.length } }
}

/** Dev-only (?scenario=volkova-intro): her courtesy call (every career, days 8–20) is first in line. */
function volkovaIntroScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = reducer(s, { type: 'day/open' })
  const visit: QueuedVisit = { visitId: `vs${s.calendar.day.toString(36)}_intro`, kind: 'scene', customer: volkovaCustomer(), patience: tuning.police.patience, line: '' }
  const queue = [visit, ...s.queue.filter((v) => v.customer.id !== 'volkova')]
  return { ...s, queue, day: { ...s.day, total: queue.length } }
}

/** Dev-only (?scenario=bulletin): today's paper prints a bulletin line, and a walk-in seller brings that very piece in first. */
function bulletinScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  const day = s.calendar.day
  const defId = 'gold_signet_583'
  const piece = bulletinPiece(s, { id: 'b-dev', defId }, 'b-dev')
  const name = ITEM_DEFS.find((d) => d.id === defId)?.name ?? defId
  const text = BULLETIN.line
    .replaceAll('{item}', name)
    .replaceAll('{wear}', wearOf(piece.condition))
    .replaceAll('{place}', BULLETIN.places[1]!)
    .replaceAll('{when}', BULLETIN.when[1]!.replaceAll('{day}', 'Saturday'))
  s = addEvent({ ...s, crime: { ...s.crime, bulletin: [{ id: 'b-dev', day, defId, text }] } }, { day, kind: BRING, data: { entry: 'b-dev' } })
  s = reducer(s, { type: 'day/open' })
  const brought = s.queue.find((v) => v.item && s.crime.bulletin.some((b) => b.itemId === v.item!.id))
  return brought ? { ...s, queue: [brought, ...s.queue.filter((v) => v !== brought)] } : s
}

/** Dev-only (?scenario=item&item=<def id>): the first seller in line brings that item (M6 item review). */
function itemScenario(s0: GameState, defId: string | null): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = reducer(s, { type: 'day/open' })
  const def = ITEM_DEFS.find((d) => d.id === defId)
  const first = s.queue.find((v) => v.kind === 'seller' && v.item)
  if (!def || !first?.item) return s
  const visit = { ...first, item: generateItem(def, new Rng(s.meta.seed), first.item.id) }
  return { ...s, queue: [visit, ...s.queue.filter((v) => v !== first)] }
}

/** Dev-only (?scenario=raid): heat past the line and a raid ordered for this morning, with the hot watch in stock. */
function raidScenario(s0: GameState): GameState {
  const s = holdHotWatch(reducer(s0, { type: 'career/begin', shopName: '' }), 6)
  const hot = addEvent({ ...s, crime: { ...s.crime, heat: 1 } }, { day: s.calendar.day, kind: RAID })
  return reducer(hot, { type: 'day/open' })
}

/**
 * Dev-only (?seed=N&scenario=brick): the morning after the brick. The counter case was stocked, you told
 * Eduard Lvovich no when he "asked properly" yesterday, and the shop opens on the glass (M5 Protection).
 */
function brickScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  const slots = s.shop.slots.filter((x) => x.area === 'counter')
  s.inventory.slice(0, slots.length).forEach((item, i) => (s = placeItem(s, item.id, slots[i]!.id)))
  const night = s.calendar.day - 1
  s = recordBeat(s, 'protection.properly', { day: night, outcome: 'talked', choice: 'refuse' })
  s = { ...s, crime: { ...s.crime, events: [...s.crime.events, { day: night, kind: BRICK }] } }
  return reducer(s, { type: 'day/open' })
}

/** Dev-only (?seed=N&scenario=specialist): a specialist's phone call (a choice), then a specialist at the counter (a choice). */
function specialistScenario(s0: GameState): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  s = reducer(s, { type: 'specialist/retain', id: 'collector' })
  s = reducer(s, { type: 'specialist/retain', id: 'watchmaker' })
  s = reducer(s, { type: 'day/open' })
  const visits: QueuedVisit[] = []
  for (const id of ['gennady.first_refusal', 'ilya.widow']) {
    const beat = getBeat(id)
    const customer = beat ? specialistCustomer(beat.visit.who) : null
    if (!beat || !customer) continue
    const via = beat.visit.via === 'phone' ? { via: 'phone' as const } : {}
    visits.push({ visitId: `v-dev-${id}`, kind: 'scene', customer, patience: tuning.story.patience, beatId: id, line: beat.visit.scene?.lines[0], ...via })
  }
  return { ...s, queue: [...visits, ...s.queue], day: { ...s.day, total: s.day.total + visits.length } }
}

/** Dev-only (?regular=<id>[&trust=N]): that regular is first in line on an ordinary visit; with trust, they know you already. */
function regularScenario(s0: GameState, id: string, trust: number | null): GameState {
  let s = reducer(s0, { type: 'career/begin', shopName: '' })
  const def = getRegular(id)
  if (!def) return reducer(s, { type: 'day/open' })
  if (trust !== null) s = setMemory(s, id, { trust: Math.max(-1, Math.min(1, trust)), visits: 3 })
  s = reducer(s, { type: 'day/open' })
  let n = 0
  const visit = regularVisit(s, def, (p) => `${p}-dev-regular-${n++}`)
  const queue = [visit, ...s.queue.filter((v) => v.customer.regularId !== id)]
  return { ...s, queue, day: { ...s.day, total: queue.length } }
}

const END_KINDS: readonly CareerEndKind[] = ['retired', 'evicted', 'raided', 'pushedOut']

/** Dev-only (?scenario=retire[&notice=1]): the ledger after closing day 89, Retire on offer. */
function retireScenario(seed: number, careerId: string, notice: boolean): GameState {
  const s = lateCareer(seed, careerId, tuning.endings.retireDay)
  return notice ? { ...s, story: { ...s.story, flags: [...s.story.flags, 'landlord.notice'] } } : s
}

/** The review career a dev URL asks for, built on `initial` (a fresh career for `seedParam`). */
export function reviewCareer(params: URLSearchParams, seedParam: number, initial: GameState): GameState {
  if (params.get('scenario') === 'redeem') initial = redeemScenario(initial)
  if (params.get('scenario') === 'story') initial = storyScenario(initial)
  if (params.get('scenario') === 'specialist') initial = specialistScenario(initial)
  if (params.get('scenario') === 'ending') {
    const kind = END_KINDS.find((k) => k === params.get('kind')) ?? 'retired'
    initial = endingReview(seedParam, initial.meta.careerId, kind)
  }
  if (params.get('scenario') === 'retire') initial = retireScenario(seedParam, initial.meta.careerId, params.get('notice') === '1')
  if (params.get('scenario') === 'brick') initial = brickScenario(initial)
  const beatId = BEAT_SCENARIOS[params.get('scenario') ?? '']
  if (beatId) initial = beatScenario(initial, beatId)
  if (params.get('scenario') === 'fence') initial = fenceGoodsSecond(initial)
  if (params.get('scenario') === 'volkova') initial = volkovaScenario(initial)
  if (params.get('scenario') === 'volkova-intro') initial = volkovaIntroScenario(initial)
  if (params.get('scenario') === 'bulletin') initial = bulletinScenario(initial)
  if (params.get('scenario') === 'raid') initial = raidScenario(initial)
  if (params.get('scenario') === 'item') initial = itemScenario(initial, params.get('item'))
  if (params.get('scenario') === 'collector') initial = collectorScenario(initial)
  if (params.get('scenario') === 'collector-offer') initial = collectorOfferScenario(initial)
  if (params.get('scenario')?.startsWith('appraiser')) initial = appraiserScenario(initial, params.get('scenario')!)
  // M6 the Flood and the seasons of news (src/game/city/review.ts).
  const floodStep = { 'flood-warning': 'warning', flood: 'flood', 'flood-after': 'after' } as const
  const floodKey = params.get('scenario') as keyof typeof floodStep | null
  if (floodKey && floodKey in floodStep) {
    const prep = params.get('prep')
    initial = floodReview(seedParam, initial.meta.careerId, floodStep[floodKey], prep === 'sandbags' || prep === 'lifted' ? prep : 'none')
  }
  if (params.get('scenario') === 'paper') initial = paperReview(seedParam, initial.meta.careerId, params.get('on'))
  const regular = params.get('regular')
  if (regular) {
    const trust = params.has('trust') ? Number(params.get('trust')) : NaN
    initial = regularScenario(initial, regular, Number.isFinite(trust) ? trust : null)
  }
  return initial
}
