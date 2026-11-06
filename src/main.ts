/**
 * Boot: read the career slots, create the store, the shop scene and the UI,
 * then start the render loop. The title screen (M4) shows first, over the
 * dimmed shop of the most recently played career; picking a slot loads it
 * into the store. Autosave writes only while a slot is being played.
 *
 * Query flags: ?seed=N forces a fresh deterministic career and skips the title
 * screen (screenshots; that career is in no slot and is never saved),
 * ?perf=1 shows the perf overlay, ?gallery=1 shows every placeholder model.
 * ?look=<yawDeg>,<pitchDeg> starts the counter view with the head turned from the
 * default look: positive yaw turns right, positive pitch looks up (e.g. look=180,0
 * faces the back wall, look=0,18 looks up at the window). For review and shots.
 * Dev only (a review career like ?seed, seed 1 unless given): ?scenario=redeem opens day 1 with a pawner back for a 12-day-old loan first in line;
 * ?scenario=story opens day 1 with a regular's story scene (a choice) first in line;
 * ?scenario=rolex / ?scenario=laptop / ?scenario=protection open day 1 with a beat of that arc first in line (BEAT_SCENARIOS;
 * protection: Eduard Lvovich's "insurance" offer; fence: Venya Mostovoy's first visit, a choice, then him again with
 * something to sell, M5; delivery: Zhora with the crew's stolen phones, opening at half, M5);
 * ?scenario=brick opens on the morning after a brick through the stocked counter case (M5 Protection);
 * ?scenario=specialist opens day 1 with Gennady's first-refusal phone call, then Ilya at the counter with the widow's watch (M4 specialists' arcs).
 * M5 endings: ?scenario=ending&kind=retired|evicted|raided|pushedOut opens a lived-in career that has just ended that way
 * (&step=paper|cards|summary, default paper); ?scenario=retire opens the ledger on day 90 with Retire offered (&notice=1 adds the landlord's final notice).
 * M5 police: ?scenario=volkova opens day 1 with Detective Volkova first in line, asking about a bulletin watch you bought
 * two days ago and still hold (her three answers); ?scenario=bulletin prints a stolen-goods bulletin in today's paper
 * and puts the piece first in line with a walk-in seller (the passport pill); ?scenario=raid opens on a police raid.
 * M5 the Collector: ?scenario=collector opens day 1 with Leopold Germanovich asking after his icon, then Seryozha the
 * roofer bringing her in (stolen; the loupe finds the parish number on the back); ?scenario=collector-offer opens with
 * the icon in stock and him first in line with the hatbox (sell / return / police).
 * M5 Volkova's arc: ?scenario=volkova-intro (her courtesy call), and beats first in line (BEAT_SCENARIOS): volkova-father,
 * volkova-source, volkova-stakeout, volkova-short, volkova-personal, volkova-inform, volkova-leak, volkova-icon, stanislav-icon.
 * ?regular=<id> opens day 1 with that regular (src/data/regulars) first in line on an ordinary visit;
 * add &trust=<−1…1> to meet them as someone they already know (that trust, a few past visits), for their warm or cold lines.
 * ?life=0 leaves out the shop life (render/life: clock, window light, dust, tube, tea);
 * ?time=HH:MM makes the room show that shop time (window light, wall clock, canal tint, street) for review.
 * Street outside the window (render/street): ?street=0 off, ?street=busy, ?weather=clear|rain|snow,
 * ?season=<season> (the street's weather and dusk only).
 */
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './style.css'
import * as THREE from 'three'
import { AudioEngine } from './audio/engine'
import { cuesFor } from './audio/cues'
import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './audio/settings'
import { tuning } from './data/tuning'
import { AUTOSAVE_ACTIONS, reducer } from './game/actions'
import { ITEM_DEFS } from './data/items'
import { generateWalkIn } from './game/customers/walkins'
import { generateItem } from './game/items/generate'
import { Rng } from './game/rng'
import { beatVisit, regularCustomer, regularVisit } from './game/story/plan'
import { recordBeat, setMemory } from './game/story/progress'
import { specialistCustomer } from './game/story/specialists'
import { fenceGoods } from './game/crime/fence'
import { bulletinPiece, wearOf } from './game/crime/bulletin'
import { addEvent, BRING, RAID, TRAIL } from './game/crime/events'
import { volkovaCustomer } from './game/crime/volkova'
import { BULLETIN } from './data/news'
import { COLLECTOR_ICON } from './data/collector'
import { scriptedItem } from './game/story/scripted'
import { BRICK } from './game/crime/vandalism'
import { placeItem } from './game/shop/display'
import type { QueuedVisit } from './game/types'
import { getRegular } from './data/regulars'
import { getBeat } from './data/stories'
import { createInitialState, type CareerEndKind, type GameState } from './game/state'
import { endingReview, lateCareer } from './game/endings/review'
import type { EndingStep } from './ui/screens/ending'
import { Store } from './game/store'
import { OrbitGestures } from './input/gestures'
import { bindKeyboard } from './input/keyboard'
import { LookGestures } from './input/look'
import { deleteSlot, flushSaves, listSlots, loadSlot, onCareerSaved, putInSlot, saveCareer } from './persist/autosave'
import { mostRecentSlot, type SlotNo } from './game/save/slots'
import { keepStorage } from './persist/safety'
import { CameraRig } from './render/camera'
import { MIN_FPS, PerfOverlay, TIER_SETTINGS, TierGovernor, initialTier, saveAutoTier, saveChoice, setTextureAnisotropy, type GraphicsChoice, type QualityTier } from './render/perf'
import { ShopScene } from './render/scene'
import { ItemStage } from './render/stage'
import { createItemLoader } from './render/loaders'
import { CustomerCast, castOverride } from './render/customerModel'
import type { ShopLife } from './render/life'
import { clockForTime } from './render/life/timeOfDay'
import { Ui, screenFor, type ScreenId } from './ui/bind'
import { bindLoadingScreen } from './ui/loading'
import { LoadProgress } from './render/loadProgress'

const REDUCE_MOTION_KEY = 'lombard.reduceMotion'
/** Text size is a device setting (M4), like reduce motion: the title screen has no career to hold it. */
const TEXT_SCALE_KEY = 'lombard.textScale'

function newSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! || 1
}

function newCareerId(seed: number): string {
  return `career-${Date.now().toString(36)}-${seed.toString(36)}`
}

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
const ENDING_STEPS: readonly EndingStep[] = ['paper', 'cards', 'summary']

/** Dev-only (?scenario=retire[&notice=1]): the ledger after closing day 89, Retire on offer. */
function retireScenario(seed: number, careerId: string, notice: boolean): GameState {
  const s = lateCareer(seed, careerId, tuning.endings.retireDay)
  return notice ? { ...s, story: { ...s.story, flags: [...s.story.flags, 'landlord.notice'] } } : s
}

/** Screens that show the counter view and leave the 3D area free to drag. */
const LOOK_SCREENS = new Set<ScreenId>(['counter', 'sale', 'redeem', 'offer'])

/** ?look=<yawDeg>,<pitchDeg>, or null. */
function lookParam(params: URLSearchParams): { yaw: number; pitch: number } | null {
  const raw = params.get('look')
  if (!raw) return null
  const [yaw, pitch = 0] = raw.split(',').map(Number)
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null
  return { yaw: yaw!, pitch }
}

/**
 * The loading screen from index.html. The bar runs over the boot steps: the
 * bundle itself (it is running, so that much is done), the career slots, then
 * the HDRI, the baked shop and its lightmap by bytes (LOAD_SHARE), then the
 * canal backdrop and the first frames.
 */
const loading = bindLoadingScreen()
const LOAD_SHARE = { bundle: 0.15, slots: 0.2, files: 0.9, backdrop: 0.95 } as const
loading.progress(LOAD_SHARE.bundle)

function showFatal(message: string): void {
  loading.fail(message)
}

/** Explicit reduce-motion choice from Settings (overrides the OS setting), or null. */
function storedReduceMotion(): boolean | null {
  try {
    const v = localStorage.getItem(REDUCE_MOTION_KEY)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

/** Text size chosen in Settings on this device, or null. */
function storedTextScale(): number | null {
  try {
    const v = Number(localStorage.getItem(TEXT_SCALE_KEY))
    return Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : null
  } catch {
    return null
  }
}

function saveTextScale(scale: number): void {
  try {
    localStorage.setItem(TEXT_SCALE_KEY, String(scale))
  } catch {
    // storage blocked: the choice lasts for this session only
  }
}

function autosave(state: GameState, slot: SlotNo): void {
  saveCareer(state, slot).catch((err) => console.warn('[save] autosave failed', err))
}

function createRenderer(antialias: boolean, pixelRatioCap: number): THREE.WebGLRenderer | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' })
  } catch {
    showFatal('This browser could not start WebGL. Try Chrome or Safari with hardware acceleration on.')
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  return renderer
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search)
  const app = document.getElementById('app')!
  const canvasHost = document.getElementById('scene')!
  const envUrl = `${import.meta.env.BASE_URL}assets/env/lebombo_1k.hdr`
  const tierStart = initialTier(params)
  const tierSettings = TIER_SETTINGS[tierStart.tier]
  setTextureAnisotropy(tierSettings.anisotropy)

  if (params.get('gallery') === '1') {
    const renderer = createRenderer(true, 2)
    if (!renderer) return
    canvasHost.appendChild(renderer.domElement)
    const { runGallery } = await import('./render/gallery')
    const loader = params.get('noglb') === '1' ? null : createItemLoader(renderer, import.meta.env.BASE_URL, __BUILD_SHA__)
    await runGallery(
      renderer,
      envUrl,
      loader?.load,
      () => {
        window.__lombardReady = true
        loading.done()
      },
      params.get('item') ?? undefined,
    )
    return
  }

  // --- state -----------------------------------------------------------------
  // ?seed=N: a review career, straight to the game, never saved. Otherwise the
  // title screen, with the last played career's shop dimmed behind it.
  const seedRaw = Number(params.get('seed'))
  const seedGiven = Number.isFinite(seedRaw) && seedRaw > 0
  // A dev ?scenario= or ?regular= is a review career too (seed 1 unless ?seed= says otherwise).
  const review = seedGiven || params.has('scenario') || params.has('regular')
  const seedParam = seedGiven ? seedRaw : 1
  /** The slot being played; null on the title screen and for a review career (nothing is saved then). */
  let activeSlot: SlotNo | null = null
  let initial: GameState | null = null
  let slots = review ? [] : await listSlots()
  loading.progress(LOAD_SHARE.slots)
  if (review) {
    initial = createInitialState(seedParam, `career-${seedParam.toString(36)}`)
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
    if (params.get('scenario') === 'collector') initial = collectorScenario(initial)
    if (params.get('scenario') === 'collector-offer') initial = collectorOfferScenario(initial)
    const regular = params.get('regular')
    if (regular) {
      const trust = params.has('trust') ? Number(params.get('trust')) : NaN
      initial = regularScenario(initial, regular, Number.isFinite(trust) ? trust : null)
    }
  } else {
    const recent = mostRecentSlot(slots)
    if (recent) initial = await loadSlot(recent.slot)
    // Before M4 the text size lived in the career: carry the player's choice over once.
    if (initial && storedTextScale() === null && initial.settings.textScale !== 1) saveTextScale(initial.settings.textScale)
  }
  // An empty shop behind the title on a first visit (never saved: no slot is active).
  initial ??= createInitialState(1, 'title-backdrop')
  const store = new Store(initial)
  // Once a career with real progress (a finished day) is safely written, ask the
  // browser to keep the storage. keepStorage asks at most once per page load.
  onCareerSaved((s) => {
    if (s.history.length > 0) void keepStorage()
  })
  window.__lombardState = () => store.get()

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  /** Device settings (reduce motion, text size) win over whatever the loaded career carries. */
  const applyReduceMotion = () => {
    const rm = storedReduceMotion() ?? reduceMotionQuery.matches
    const ts = storedTextScale() ?? store.get().settings.textScale
    const cur = store.get().settings
    if (cur.reduceMotion !== rm || cur.textScale !== ts) store.dispatch({ type: 'settings/set', patch: { reduceMotion: rm, textScale: ts } })
  }
  applyReduceMotion()
  reduceMotionQuery.addEventListener('change', applyReduceMotion)
  /** Swap a career into the store with this device's settings applied. */
  const enter = (s: GameState) => {
    store.replace(s)
    applyReduceMotion()
  }

  // --- audio -----------------------------------------------------------------
  // Nothing is created or fetched until the first gesture (mobile autoplay rules).
  let sound: SoundSettings = loadSoundSettings()
  const audio = new AudioEngine(import.meta.env.BASE_URL, sound)
  for (const type of ['pointerup', 'touchend', 'click', 'keydown'] as const) {
    window.addEventListener(type, () => audio.gesture(), { capture: true, passive: true })
  }
  // A soft tap for buttons; runs after the button's own handler, so a tap that
  // already made a state sound (door, tool, cash) stays quiet.
  document.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button:not(:disabled)')) audio.tap()
  })

  // --- renderer --------------------------------------------------------------
  const renderer = createRenderer(tierSettings.antialias, tierSettings.pixelRatioCap)
  if (!renderer) return
  canvasHost.appendChild(renderer.domElement)

  // Quality tier: Auto steps down under 30 fps (see render/perf.ts); ?tier= pins one.
  let graphics: GraphicsChoice = tierStart.choice
  const governor = new TierGovernor(tierStart.tier, graphics === 'auto' && !tierStart.pinned)
  let life: ShopLife | null = null
  /** Life outside the window, once loaded (see below). */
  let street: import('./render/street').StreetLife | null = null
  const applyTier = (t: QualityTier) => {
    governor.reset(t)
    life?.setTier(t)
    street?.setTier(t)
    setTextureAnisotropy(TIER_SETTINGS[t].anisotropy)
    // setPixelRatio resizes the drawing buffer itself.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_SETTINGS[t].pixelRatioCap))
  }

  const shop = new ShopScene()
  const rig = new CameraRig()
  const look = lookParam(params)
  if (look) rig.setHeadOffset(look.yaw, look.pitch)
  // ?noglb=1 keeps every item on its procedural placeholder (for comparing against the scripted models).
  const itemLoader = params.get('noglb') === '1' ? null : createItemLoader(renderer, import.meta.env.BASE_URL, __BUILD_SHA__)
  // Customers are 3D cast members (Rocketbox); ?nocast=1 (or ?noglb=1) keeps the old silhouette, ?customer=<id> casts one person as everyone.
  if (itemLoader && params.get('nocast') !== '1') {
    // With MSAA on (mid/high), cut-out hair edges are smoothed by alpha-to-coverage.
    const msaa = renderer.getContextAttributes()?.antialias === true
    shop.setCast(new CustomerCast(itemLoader.gltf, import.meta.env.BASE_URL, __BUILD_SHA__, msaa), castOverride(params))
  }
  // ?walk=0: customers appear at the counter instead of walking in from the door (screenshots).
  if (params.get('walk') === '0') shop.setWalking(false)
  const timeOverride = clockForTime(params.get('time'))
  shop.setClockOverride(timeOverride)
  const stage = new ItemStage(shop.scene, shop.matPoint, itemLoader?.load)

  // --- UI --------------------------------------------------------------------
  // ?lull=0: no waiting between customers; a Next customer button calls each one (review, screenshots).
  const manualNext = params.get('lull') === '0'
  const ui = new Ui(app, {
    store,
    manualNext,
    // In-game Load save code: the loaded career takes over this slot (the old one is deleted).
    replaceState: (s) => {
      const slot = activeSlot
      if (!slot) return enter(s)
      void putInSlot(s, slot).then((stored) => enter(stored ?? s))
    },
    mainMenu: () => void mainMenu(),
    slotLabel: () => (activeSlot ? `slot ${activeSlot}` : null),
    setTextScale: (scale) => {
      saveTextScale(scale)
      store.dispatch({ type: 'settings/set', patch: { textScale: scale } })
    },
    title: {
      play: (slot) => void play(slot),
      newCareer: (slot) => void newCareerIn(slot),
      deleteSlot: (slot) => void deleteSlot(slot).then(refreshTitle),
      loadCode: (state, slot) => void loadCodeInto(state, slot),
    },
    setReduceMotion: (on) => {
      try {
        localStorage.setItem(REDUCE_MOTION_KEY, on ? '1' : '0')
      } catch {
        // storage blocked: the choice lasts for this session only
      }
      store.dispatch({ type: 'settings/set', patch: { reduceMotion: on } })
    },
    getSound: () => sound,
    setSound: (patch) => {
      sound = { ...sound, ...patch }
      saveSoundSettings(sound)
      audio.apply(sound)
      audio.gesture()
    },
    getGraphics: () => ({ choice: graphics, tier: governor.current, antialias: renderer.getContextAttributes()?.antialias ?? false, wantsAntialias: TIER_SETTINGS[governor.current].antialias }),
    setGraphics: (choice) => {
      graphics = choice
      saveChoice(choice)
      governor.enabled = choice === 'auto' && !tierStart.pinned
      // Auto carries on from whatever is showing now, next visit included.
      if (choice === 'auto') saveAutoTier(governor.current)
      applyTier(choice === 'auto' ? governor.current : choice)
    },
  })

  // --- title screen and slots -------------------------------------------------
  const refreshTitle = async () => {
    slots = await listSlots()
    if (ui.mode === 'title') ui.showTitle(slots)
  }
  const start = (state: GameState, slot: SlotNo) => {
    activeSlot = slot
    enter(state) // store/replace autosaves it into the slot (and makes it the most recent)
    ui.showGame()
  }
  const play = async (slot: SlotNo) => {
    const s = await loadSlot(slot)
    if (s) start(s, slot)
    else await refreshTitle()
  }
  const newCareerIn = async (slot: SlotNo) => {
    const seed = newSeed()
    const fresh = createInitialState(seed, newCareerId(seed))
    // Written before play starts so the slot is claimed; the intro (name the shop) comes next.
    start((await putInSlot(fresh, slot)) ?? fresh, slot)
  }
  const loadCodeInto = async (state: GameState, slot: SlotNo) => {
    const stored = await putInSlot(state, slot)
    void keepStorage()
    start(stored ?? state, slot)
  }
  const mainMenu = async () => {
    const slot = activeSlot
    activeSlot = null
    if (slot) {
      saveCareer(store.get(), slot).catch(() => {})
      await flushSaves()
    }
    slots = await listSlots()
    ui.showTitle(slots)
  }

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER_SETTINGS[governor.current].pixelRatioCap))
    renderer.setSize(w, h)
    const l = ui.layout()
    rig.resize({ width: w, height: h, ...l })
  }
  ui.onScreenChange = () => requestAnimationFrame(resize)

  const sync = (state: GameState, prev: GameState | null) => {
    // The scene first: it knows whether a new customer is still walking in, which the UI waits for.
    shop.sync(state)
    life?.sync(state)
    street?.sync(state)
    ui.setCustomerArrivedQuiet(shop.customerState !== 'arriving')
    ui.render(state, prev)
    stage.sync(state)
    stage.setWaiting((state.current?.phase === 'present' || state.current?.phase === 'scene') && shop.customerState === 'arriving')
    rig.reduceMotion = stage.reduceMotion = state.settings.reduceMotion
    // A new customer steps up: face the counter again.
    if (prev && state.current && state.current.visitId !== prev.current?.visitId) rig.recentre()
    rig.setInspect(state.current?.phase === 'inspect')
    rig.setOfferFocus(state.current?.phase === 'offer')
  }
  sync(store.get(), null)
  if (review) ui.showGame(ENDING_STEPS.find((x) => x === params.get('step')) ?? 'paper')
  else ui.showTitle(slots)
  store.subscribe((state, prev, action) => {
    sync(state, prev)
    audio.play(cuesFor(prev, state, action))
    if (action.type === 'inspect/useTool' && (state.inspect?.findings.length ?? 0) > (prev.inspect?.findings.length ?? 0)) {
      stage.playTool(action.tool, state)
    }
    if (activeSlot && (action.type === 'store/replace' || AUTOSAVE_ACTIONS.has(action.type))) autosave(state, activeSlot)
  })

  resize()
  window.addEventListener('resize', resize)
  const ro = new ResizeObserver(() => resize())
  for (const el of ui.observed()) ro.observe(el)

  // --- input -----------------------------------------------------------------
  new OrbitGestures(ui.inspect.gestureLayer, {
    orbit: (dx, dy) => stage.orbit(dx, dy),
    zoom: (f) => stage.zoomBy(f),
    dragging: (on) => stage.setDragging(on),
  })
  // Head look in the counter view: drag the 3D view to turn, tap the item to inspect, double-tap to recentre.
  new LookGestures(renderer.domElement, {
    enabled: () => ui.mode === 'game' && rig.canLook && LOOK_SCREENS.has(screenFor(store.get())),
    look: (dx, dy) => rig.turnHead(dx, dy),
    dragging: (on) => {
      rig.setLookDragging(on)
      if (on) ui.lookUsed()
    },
    tap: (x, y) => {
      const s = store.get()
      if (ui.mode !== 'game' || screenFor(s) !== 'counter' || s.current?.phase !== 'present' || s.current.kind !== 'seller') return
      if (stage.hitOnCounter(rig.camera, x, y, window.innerWidth, window.innerHeight)) store.dispatch({ type: 'counter/inspect' })
    },
    doubleTap: () => rig.recentre(),
  })
  bindKeyboard((k) => ui.key(k))

  // --- time pressure: one in-game tick per real second at the counter --------
  window.setInterval(() => {
    if (document.hidden || ui.mode !== 'game') return
    const s = store.get()
    if (s.day.phase !== 'open') return
    // At the counter the clock runs until the visit is resolved; with the counter
    // empty it runs through the lull until the next person walks in.
    const atCounter = s.current && s.current.phase !== 'resolved'
    const lull = !s.current && s.queue.length > 0 && !manualNext
    if (atCounter || lull) store.dispatch({ type: 'time/tick', seconds: 1 })
  }, 1000)

  // --- perf ------------------------------------------------------------------
  const perf = params.get('perf') === '1' ? new PerfOverlay() : null
  void perf?.mount()

  // --- loop ------------------------------------------------------------------
  let envReady = false
  // Byte progress of the big files drives the loading screen's bar.
  const noBake = params.get('nobake') === '1'
  const files = new LoadProgress(noBake ? ['env'] : ['env', 'glb', 'lightmap'])
  files.onChange = () => loading.progress(LOAD_SHARE.slots + (LOAD_SHARE.files - LOAD_SHARE.slots) * files.fraction())
  const envLoad = shop
    .loadEnvironment(renderer, { envUrl, onProgress: files.track('env') })
    .catch((err) => console.warn('[env] HDRI failed to load, continuing without it', err))
    .finally(() => files.done('env'))
  // ?nobake=1 keeps the procedural grey box (for comparing against the bake).
  const bakeLoad = noBake
    ? Promise.resolve(null)
    : shop
        .loadBaked(renderer, import.meta.env.BASE_URL, { glb: files.track('glb'), lightmap: files.track('lightmap') })
        .then((m) => {
          if (m) ui.setBakeInfo(`bake ${m.quality}${m.commit ? ` ${m.commit}` : ''}`)
          return m
        })
        .finally(() => {
          files.done('glb')
          files.done('lightmap')
        })
  // The canal outside the window comes after the shop; ?nobackdrop=1 keeps the old canvas card.
  const backdropLoad = params.get('nobackdrop') === '1' ? Promise.resolve(false) : bakeLoad.then(() => shop.loadBackdrop(renderer, import.meta.env.BASE_URL))
  void Promise.all([envLoad, bakeLoad, backdropLoad]).finally(() => {
    loading.progress(LOAD_SHARE.backdrop)
    envReady = true
  })
  // Street life outside the window (render/street): loads only once the shop is on screen. ?street=0 turns it off.
  let markReady = () => {}
  const shopReady = new Promise<void>((r) => (markReady = r))
  if (params.get('street') !== '0') {
    void Promise.all([backdropLoad, shopReady])
      .then(async ([ok]) => {
        const canal = shop.canal
        if (!ok || !canal) return
        const { StreetLife, streetFlags } = await import('./render/street')
        street = await StreetLife.load(renderer, import.meta.env.BASE_URL, canal, shop.scene, streetFlags(params))
        street.setClockOverride(timeOverride)
        // the real passers-by cast the shadows on the sun patch, not the shop life's fake ones
        street.onWindowPasser = (dir, speed) => life?.passerBy(dir, speed)
        life?.sunlight.setFakePassers(false)
        street.setTier(governor.current)
        street.sync(store.get())
        document.body.dataset.street = 'ready' // for screenshot scripts
      })
      .catch((err) => console.info('[street] staying quiet:', err instanceof Error ? err.message : err))
  }

  const clock = new THREE.Clock()
  let readyFrames = 0
  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta()
    const dt = Math.min(raw, 0.1)
    perf?.begin()
    shop.update(dt)
    // the street's weather (once both are loaded) dims the sun patch on rainy and snowy days
    if (life && street) life.setWeather(street.todaysWeather)
    life?.update(dt, renderer.domElement.height)
    street?.update(dt)
    const customerState = shop.customerState
    if (document.body.dataset.customer !== customerState) {
      document.body.dataset.customer = customerState
      ui.setCustomerArrived(customerState !== 'arriving')
      const c = store.get().current
      stage.setWaiting((c?.phase === 'present' || c?.phase === 'scene') && customerState === 'arriving')
    }
    stage.update(dt, rig)
    rig.update(dt)
    shop.setInspectBlend(rig.inspectBlend)
    renderer.render(shop.scene, rig.camera)
    const w = window.innerWidth
    const h = window.innerHeight
    ui.frame(rig.inspectBlend > 0.97 && stage.isInspecting ? stage.hotspotScreen(rig.camera, w, h) : [])
    if (window.__lombardReady) {
      const down = governor.sample(raw)
      if (down) {
        console.info(`[perf] under ${MIN_FPS} fps, stepping down to "${down}"`)
        saveAutoTier(down)
        applyTier(down)
      }
    }
    perf?.end(renderer, shop.scene, dt, `${governor.enabled ? 'auto ' : ''}${governor.current}`, governor.lastFps)
    if (envReady && !window.__lombardReady && ++readyFrames > 2) {
      window.__lombardReady = true
      document.body.classList.add('ready')
      loading.done()
      markReady()
      // Shop life comes after the shop is up, as its own chunk (?life=0 leaves it out).
      if (params.get('life') !== '0') {
        void import('./render/life').then(({ ShopLife }) => {
          life = new ShopLife()
          life.setClockOverride(timeOverride)
          if (street) life.sunlight.setFakePassers(false)
          life.setTier(governor.current)
          life.sync(store.get())
          shop.scene.add(life.group)
        })
      }
    }
  })
}

boot().catch((err) => {
  console.error('[boot] failed', err)
  showFatal('The shop could not open. Check the connection and reload.')
})
