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
 * Dev only (a review career like ?seed, seed 1 unless given; built in src/dev/scenarios.ts, a lazy chunk): ?scenario=redeem opens day 1 with a pawner back for a 12-day-old loan first in line;
 * ?scenario=story opens day 1 with a regular's story scene (a choice) first in line;
 * ?scenario=item&item=<def id> opens day 1 with a walk-in selling that item first (M6: reviewing new items on the mat);
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
 * M6 the twenty new regulars' threads: ?scenario=<regular id> (artur, bakhtiyor, … lera; src/data/stories/threads) opens
 * day 1 with that thread's first beat first in line.
 * M6 the appraiser: ?scenario=appraiser opens day 1 with Lev on staff, serving a walk-in at the second counter while
 * you have the line; appraiser-start (his first morning), and one per beat of his arc first in line (APPRAISER_SCENARIOS):
 * appraiser-zhora, -confide, -tin, -yuri, -zhora-back, -vanish (a voicemail), -zhora-vanished; appraiser-paper (the morning paper).
 * M6 the Flood and the seasons of news (src/game/city/review.ts): ?scenario=flood-warning (Kuzmich and his sandbags,
 * three days before the water), ?scenario=flood[&prep=none|sandbags|lifted] (the flood morning, Arkady and his pump),
 * ?scenario=flood-after (the water going down, Nina Arkadyevna's things); ?scenario=paper[&on=MM-DD|YYYY-MM-DD] opens
 * that morning's paper (default the first day of school).
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
import { bedsFor, cuesFor, prefetchFor } from './audio/cues'
import { TramSchedule } from './audio/tram'
import { AUDIO_MIX } from './data/audio'
import { voiceFor } from './audio/voice'
import { loadSoundSettings, saveSoundSettings, type SoundSettings } from './audio/settings'
import { t } from './data/strings'
import { AUTOSAVE_ACTIONS } from './game/actions'
import { createInitialState, type GameState } from './game/state'
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

const ENDING_STEPS: readonly EndingStep[] = ['paper', 'cards', 'summary']

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
    showFatal(t('fatal.webgl'))
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
    if (params.has('scenario') || params.has('regular')) {
      const { reviewCareer } = await import('./dev/scenarios')
      initial = reviewCareer(params, seedParam, initial)
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
    slotLabel: () => (activeSlot ? t('common.slotLower', { slot: activeSlot }) : null),
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
    // Rain while the street shows it, canal water while the Flood stands in the shop.
    audio.setBeds(bedsFor(state, street?.todaysWeather ?? null))
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
    const cues = cuesFor(prev, state, action)
    audio.play(cues.filter((c) => !c.atDoor))
    // The door shuts behind a leaving walk-in once they reach it (the scene's walk-out).
    const door = cues.filter((c) => c.atDoor)
    if (door.length > 0) {
      const asked = performance.now()
      shop.whenCustomerOut(() => {
        if (performance.now() - asked < AUDIO_MIX.doorCloseTimeout * 1000) audio.play(door)
      })
    }
    // Lazy sounds wait for the game screen (the title stays at the preload).
    audio.prefetch(ui.mode === 'game' ? prefetchFor(state) : [])
    audio.say(voiceFor(prev, state, action))
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
        audio.setBeds(bedsFor(store.get(), street.todaysWeather))
        document.body.dataset.street = 'ready' // for screenshot scripts
      })
      .catch((err) => console.info('[street] staying quiet:', err instanceof Error ? err.message : err))
  }

  const clock = new THREE.Clock()
  let readyFrames = 0
  // Now and then a distant tram while the shop is open (seeded per day; see src/audio/tram.ts).
  const trams = new TramSchedule()
  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta()
    const dt = Math.min(raw, 0.1)
    perf?.begin()
    shop.update(dt)
    // the street's weather (once both are loaded) dims the sun patch on rainy and snowy days
    if (life && street) life.setWeather(street.todaysWeather)
    life?.update(dt, renderer.domElement.height)
    street?.update(dt)
    const now = store.get()
    if (trams.update(dt, now.meta.seed, now.calendar.day, ui.mode === 'game' && now.day.phase === 'open' && !now.career.end)) {
      audio.play([{ sound: 'tram_bell', lateOk: true }])
    }
    // M6: where the appraiser is (hidden / closed / serving / counter / idle / walking), for shots.
    const staffState = shop.staffState
    if (document.body.dataset.staff !== staffState) document.body.dataset.staff = staffState
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
  showFatal(t('fatal.boot'))
})
