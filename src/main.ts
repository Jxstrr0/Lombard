/**
 * Boot: load (or create) the career, create the store, the shop scene and the
 * UI, then start the render loop.
 *
 * Query flags: ?seed=N forces a fresh deterministic career (screenshots),
 * ?perf=1 shows the perf overlay, ?gallery=1 shows every placeholder model.
 * ?look=<yawDeg>,<pitchDeg> starts the counter view with the head turned from the
 * default look: positive yaw turns right, positive pitch looks up (e.g. look=180,0
 * faces the back wall, look=0,18 looks up at the window). For review and shots.
 * Dev only, with ?seed: ?scenario=redeem opens day 1 with a pawner back for a 12-day-old loan first in line.
 */
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './style.css'
import * as THREE from 'three'
import { tuning } from './data/tuning'
import { AUTOSAVE_ACTIONS, reducer } from './game/actions'
import { ITEM_DEFS } from './data/items'
import { generateWalkIn } from './game/customers/walkins'
import { generateItem } from './game/items/generate'
import { Rng } from './game/rng'
import { createInitialState, type GameState } from './game/state'
import { Store } from './game/store'
import { OrbitGestures } from './input/gestures'
import { bindKeyboard } from './input/keyboard'
import { LookGestures } from './input/look'
import { deleteCareer, loadLatestCareer, saveCareer } from './persist/autosave'
import { CameraRig } from './render/camera'
import { PerfOverlay, TIER_SETTINGS, TierBenchmark, initialTier } from './render/perf'
import { ShopScene } from './render/scene'
import { ItemStage } from './render/stage'
import { createItemLoader } from './render/loaders'
import { Ui, screenFor, type ScreenId } from './ui/bind'

const REDUCE_MOTION_KEY = 'lombard.reduceMotion'

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

function showFatal(message: string): void {
  const el = document.createElement('div')
  el.className = 'fatal'
  el.textContent = message
  document.body.appendChild(el)
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

function autosave(state: GameState): void {
  saveCareer(state).catch((err) => console.warn('[save] autosave failed', err))
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
  const tier = initialTier(params)
  const tierSettings = TIER_SETTINGS[tier]

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
      },
      params.get('item') ?? undefined,
    )
    return
  }

  // --- state -----------------------------------------------------------------
  const seedParam = Number(params.get('seed'))
  let initial: GameState | null = null
  if (Number.isFinite(seedParam) && seedParam > 0) {
    initial = createInitialState(seedParam, `career-${seedParam.toString(36)}`)
    if (params.get('scenario') === 'redeem') initial = redeemScenario(initial)
  } else {
    try {
      initial = await loadLatestCareer()
    } catch (err) {
      console.warn('[save] could not load the last career, starting a new one', err)
    }
    if (!initial) {
      const seed = newSeed()
      initial = createInitialState(seed, newCareerId(seed))
    }
  }
  const store = new Store(initial)
  window.__lombardState = () => store.get()

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const applyReduceMotion = () => {
    const rm = storedReduceMotion() ?? reduceMotionQuery.matches
    if (store.get().settings.reduceMotion !== rm) store.dispatch({ type: 'settings/set', patch: { reduceMotion: rm } })
  }
  applyReduceMotion()
  reduceMotionQuery.addEventListener('change', applyReduceMotion)

  // --- renderer --------------------------------------------------------------
  const renderer = createRenderer(tierSettings.antialias, tierSettings.pixelRatioCap)
  if (!renderer) return
  canvasHost.appendChild(renderer.domElement)

  const shop = new ShopScene()
  const rig = new CameraRig()
  const look = lookParam(params)
  if (look) rig.setHeadOffset(look.yaw, look.pitch)
  // ?noglb=1 keeps every item on its procedural placeholder (for comparing against the scripted models).
  const itemLoader = params.get('noglb') === '1' ? null : createItemLoader(renderer, import.meta.env.BASE_URL, __BUILD_SHA__)
  const stage = new ItemStage(shop.scene, shop.matPoint, itemLoader?.load)

  // --- UI --------------------------------------------------------------------
  const ui = new Ui(app, {
    store,
    replaceState: (s) => store.replace(s),
    newCareer: () => {
      const old = store.get().meta.careerId
      const seed = newSeed()
      store.dispatch({ type: 'career/new', seed, careerId: newCareerId(seed) })
      // The new career autosaves on career/new; drop the old one once that landed.
      saveCareer(store.get())
        .then(() => deleteCareer(old))
        .catch((err) => console.warn('[save] could not clear the old career', err))
    },
    setReduceMotion: (on) => {
      try {
        localStorage.setItem(REDUCE_MOTION_KEY, on ? '1' : '0')
      } catch {
        // storage blocked: the choice lasts for this session only
      }
      store.dispatch({ type: 'settings/set', patch: { reduceMotion: on } })
    },
  })

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    const l = ui.layout()
    rig.resize({ width: w, height: h, ...l })
  }
  ui.onScreenChange = () => requestAnimationFrame(resize)

  const sync = (state: GameState, prev: GameState | null) => {
    ui.render(state, prev)
    shop.sync(state)
    stage.sync(state)
    rig.reduceMotion = stage.reduceMotion = state.settings.reduceMotion
    // A new customer steps up: face the counter again.
    if (prev && state.current && state.current.visitId !== prev.current?.visitId) rig.recentre()
    rig.setInspect(state.current?.phase === 'inspect')
    rig.setOfferFocus(state.current?.phase === 'offer')
  }
  sync(store.get(), null)
  store.subscribe((state, prev, action) => {
    sync(state, prev)
    if (action.type === 'inspect/useTool' && (state.inspect?.findings.length ?? 0) > (prev.inspect?.findings.length ?? 0)) {
      stage.playTool(action.tool, state)
    }
    if (action.type === 'store/replace' || AUTOSAVE_ACTIONS.has(action.type)) autosave(state)
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
    enabled: () => rig.canLook && LOOK_SCREENS.has(screenFor(store.get())),
    look: (dx, dy) => rig.turnHead(dx, dy),
    dragging: (on) => {
      rig.setLookDragging(on)
      if (on) ui.lookUsed()
    },
    tap: (x, y) => {
      const s = store.get()
      if (screenFor(s) !== 'counter' || s.current?.phase !== 'present' || s.current.kind !== 'seller') return
      if (stage.hitOnCounter(rig.camera, x, y, window.innerWidth, window.innerHeight)) store.dispatch({ type: 'counter/inspect' })
    },
    doubleTap: () => rig.recentre(),
  })
  bindKeyboard((k) => ui.key(k))

  // --- time pressure: one in-game tick per real second at the counter --------
  window.setInterval(() => {
    if (document.hidden) return
    const s = store.get()
    if (s.day.phase === 'open' && s.current && s.current.phase !== 'resolved') {
      store.dispatch({ type: 'time/tick', seconds: 1 })
    }
  }, 1000)

  // --- perf ------------------------------------------------------------------
  const perf = params.get('perf') === '1' ? new PerfOverlay() : null
  void perf?.mount(tier)
  const benchmark = new TierBenchmark()

  // --- loop ------------------------------------------------------------------
  let envReady = false
  const envLoad = shop
    .loadEnvironment(renderer, { envUrl })
    .catch((err) => console.warn('[env] HDRI failed to load, continuing without it', err))
  // ?nobake=1 keeps the procedural grey box (for comparing against the bake).
  const bakeLoad =
    params.get('nobake') === '1'
      ? Promise.resolve(null)
      : shop.loadBaked(renderer, import.meta.env.BASE_URL).then((m) => {
          if (m) ui.setBakeInfo(`bake ${m.quality}${m.commit ? ` ${m.commit}` : ''}`)
          return m
        })
  void Promise.all([envLoad, bakeLoad]).finally(() => {
    envReady = true
  })

  const clock = new THREE.Clock()
  let readyFrames = 0
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1)
    perf?.begin()
    shop.update(dt)
    stage.update(dt, rig)
    rig.update(dt)
    shop.setInspectBlend(rig.inspectBlend)
    renderer.render(shop.scene, rig.camera)
    const w = window.innerWidth
    const h = window.innerHeight
    ui.frame(rig.inspectBlend > 0.97 && stage.isInspecting ? stage.hotspotScreen(rig.camera, w, h) : [])
    benchmark.sample(dt)
    perf?.end(renderer, dt, benchmark)
    if (envReady && !window.__lombardReady && ++readyFrames > 2) {
      window.__lombardReady = true
      document.body.classList.add('ready')
    }
  })
}

void boot()
