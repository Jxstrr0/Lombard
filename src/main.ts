/** Boot: create the game store, the shop scene and the UI, then start the render loop. */
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import './style.css'
import * as THREE from 'three'
import { createInitialState } from './game/state'
import { Store } from './game/store'
import { CounterCamera } from './render/camera'
import { PerfOverlay, TIER_SETTINGS, TierBenchmark, initialTier } from './render/perf'
import { ShopScene } from './render/scene'
import { bindUi } from './ui/bind'

function newSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]!
}

function showFatal(message: string): void {
  const el = document.createElement('div')
  el.className = 'fatal'
  el.textContent = message
  document.body.appendChild(el)
}

function boot(): void {
  const params = new URLSearchParams(location.search)
  const app = document.getElementById('app')!
  const canvasHost = document.getElementById('scene')!

  // --- state -----------------------------------------------------------------
  const seedParam = Number(params.get('seed'))
  const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : newSeed()
  const store = new Store(createInitialState(seed, `career-${seed.toString(36)}`))

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  store.dispatch({ type: 'settings/set', patch: { reduceMotion: reduceMotionQuery.matches } })
  reduceMotionQuery.addEventListener('change', (e) =>
    store.dispatch({ type: 'settings/set', patch: { reduceMotion: e.matches } }),
  )

  // --- renderer --------------------------------------------------------------
  const tier = initialTier(params)
  const tierSettings = TIER_SETTINGS[tier]
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: tierSettings.antialias, powerPreference: 'high-performance' })
  } catch {
    showFatal('This browser could not start WebGL. Try Chrome or Safari with hardware acceleration on.')
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tierSettings.pixelRatioCap))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  canvasHost.appendChild(renderer.domElement)

  const shop = new ShopScene()
  const cam = new CounterCamera()

  // --- UI --------------------------------------------------------------------
  bindUi(store, app)
  const strip = app.querySelector<HTMLElement>('.strip')

  const syncFromState = () => {
    const s = store.get()
    shop.sync(s)
    cam.reduceMotion = s.settings.reduceMotion
  }
  syncFromState()
  store.subscribe(syncFromState)

  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    const overlay = strip ? strip.getBoundingClientRect().height / h : 0.33
    cam.resize(w, h, overlay)
  }
  resize()
  window.addEventListener('resize', resize)
  new ResizeObserver(resize).observe(strip ?? app)

  // --- perf ------------------------------------------------------------------
  const perf = params.get('perf') === '1' ? new PerfOverlay() : null
  void perf?.mount(tier)
  const benchmark = new TierBenchmark()

  // --- loop ------------------------------------------------------------------
  let envReady = false
  shop
    .loadEnvironment(renderer, { envUrl: `${import.meta.env.BASE_URL}assets/env/lebombo_1k.hdr` })
    .catch((err) => console.warn('[env] HDRI failed to load, continuing without it', err))
    .finally(() => {
      envReady = true
    })

  const clock = new THREE.Clock()
  let readyFrames = 0
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1)
    perf?.begin()
    shop.update(dt)
    cam.update(dt)
    renderer.render(shop.scene, cam.camera)
    benchmark.sample(dt)
    perf?.end(renderer, dt, benchmark)
    if (envReady && !window.__lombardReady && ++readyFrames > 2) {
      window.__lombardReady = true
      document.body.classList.add('ready')
    }
  })
}

boot()
