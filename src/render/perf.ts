/**
 * Performance overlay (stats.js, shown with ?perf=1) and quality tiers (M3).
 *
 * Three tiers trade sharpness for frame rate: render resolution (the biggest
 * cost on a phone), MSAA and texture anisotropy. High renders at the screen's
 * own resolution (up to 3× CSS pixels). The player picks one in Settings, or
 * leaves it on Auto: Auto starts at High and, once the shop is on screen,
 * steps down a tier whenever the median frame rate over a few seconds is
 * under MIN_FPS (smoothness first: Colby's phone held 60 fps at the old Low,
 * Nov 6). It never steps back up on its own (with vsync a phone that has
 * headroom still reads 60 fps, so there is nothing to measure), but it
 * remembers where it ended up for the next visit.
 *
 * Resolution changes apply at once. MSAA is fixed when the WebGL context is
 * made, so a tier change that turns it on or off applies on the next load.
 * Anisotropy applies to textures loaded after the change.
 */
import * as THREE from 'three'

export type QualityTier = 'low' | 'mid' | 'high'
export type GraphicsChoice = 'auto' | QualityTier

export interface TierSettings {
  /** Cap on devicePixelRatio for the render target. */
  pixelRatioCap: number
  antialias: boolean
  /** Anisotropic filtering for floor, wall and item textures. */
  anisotropy: number
}

export const TIERS: readonly QualityTier[] = ['low', 'mid', 'high']

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  low: { pixelRatioCap: 1.25, antialias: false, anisotropy: 2 },
  mid: { pixelRatioCap: 2, antialias: true, anisotropy: 4 },
  high: { pixelRatioCap: 3, antialias: true, anisotropy: 8 },
}

export const TIER_LABELS: Record<GraphicsChoice, string> = {
  auto: 'Auto',
  low: 'Low',
  mid: 'Medium',
  high: 'High',
}

/**
 * Auto steps down when the median frame rate over a window is below this.
 * Above the 30 fps floor in CLAUDE.md on purpose: under ~45 a 60 Hz phone
 * visibly judders, and a lower tier is the better trade.
 */
export const MIN_FPS = 45
/** Seconds to wait after the shop appears (shader compiles, first decodes). */
const WARMUP_S = 2
/** Length of one measuring window, in seconds. */
const WINDOW_S = 4
/** A frame longer than this is a tab switch or a stall, not the frame rate. */
const STALL_S = 0.5

const CHOICE_KEY = 'lombard.qualityTier'
/** v2: the tiers were raised on Nov 6, so every device gets one try at the new High. */
const AUTO_KEY = 'lombard.autoTier.v2'

function isTier(v: unknown): v is QualityTier {
  return v === 'low' || v === 'mid' || v === 'high'
}

function isChoice(v: unknown): v is GraphicsChoice {
  return v === 'auto' || isTier(v)
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
}

let anisotropy = TIER_SETTINGS.mid.anisotropy

/** Anisotropy for textures loaded from now on (set from the tier). */
export function textureAnisotropy(): number {
  return anisotropy
}

export function setTextureAnisotropy(n: number): void {
  anisotropy = n
}

/** The device guess Auto starts from: High on phones (Auto steps down if needed) and big desktops. */
export function guessTier(coarsePointer: boolean, cores: number): QualityTier {
  if (coarsePointer) return 'high'
  return cores >= 8 ? 'high' : 'mid'
}

export interface TierStart {
  choice: GraphicsChoice
  tier: QualityTier
  /** ?tier= pins the tier for this visit (and turns Auto's stepping off). */
  pinned: boolean
}

/** ?tier= override, then the saved choice (Auto by default), then Auto's last result or the device guess. */
export function initialTier(params: URLSearchParams): TierStart {
  const fromUrl = params.get('tier')
  if (isTier(fromUrl)) return { choice: fromUrl, tier: fromUrl, pinned: true }
  const saved = read(CHOICE_KEY)
  const choice: GraphicsChoice = isChoice(saved) ? saved : 'auto'
  if (choice !== 'auto') return { choice, tier: choice, pinned: false }
  const last = read(AUTO_KEY)
  if (isTier(last)) return { choice, tier: last, pinned: false }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return { choice, tier: guessTier(coarse, navigator.hardwareConcurrency ?? 4), pinned: false }
}

export function saveChoice(choice: GraphicsChoice): void {
  write(CHOICE_KEY, choice)
}

export function saveAutoTier(tier: QualityTier): void {
  write(AUTO_KEY, tier)
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Auto's frame-rate watcher. Pure (no DOM, no three): feed it raw frame
 * deltas once the shop is drawing, and it returns a lower tier when one
 * window's median frame rate is under MIN_FPS. The median ignores the odd
 * hitch from a customer model decoding; frames over STALL_S are dropped.
 */
export class TierGovernor {
  private wait = WARMUP_S
  private elapsed = 0
  private deltas: number[] = []
  /** Median fps of the last finished window (for the overlay). */
  lastFps: number | null = null

  constructor(
    private tier: QualityTier,
    public enabled = true,
  ) {}

  get current(): QualityTier {
    return this.tier
  }

  /** Restart measuring at `tier` (after the player picks one, or a step down). */
  reset(tier: QualityTier): void {
    this.tier = tier
    this.wait = WARMUP_S
    this.elapsed = 0
    this.deltas = []
  }

  /** Returns the new tier when it steps down, else null. */
  sample(rawDt: number): QualityTier | null {
    if (rawDt <= 0 || rawDt > STALL_S) return null
    if (this.wait > 0) {
      this.wait -= rawDt
      return null
    }
    this.elapsed += rawDt
    this.deltas.push(rawDt)
    if (this.elapsed < WINDOW_S) return null
    const fps = 1 / median(this.deltas)
    this.lastFps = fps
    this.elapsed = 0
    this.deltas = []
    if (!this.enabled || fps >= MIN_FPS) return null
    const i = TIERS.indexOf(this.tier)
    if (i <= 0) return null
    const down = TIERS[i - 1]!
    this.reset(down)
    return down
  }
}

/** Rough decoded size of every texture the scene's materials use, in MB (mips included). */
export function textureMegabytes(scene: THREE.Object3D): number {
  const seen = new Set<THREE.Texture>()
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material
    if (!mats) return
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) seen.add(v)
    }
  })
  if (scene instanceof THREE.Scene && scene.environment) seen.add(scene.environment)
  let bytes = 0
  for (const t of seen) {
    if (t instanceof THREE.CompressedTexture) {
      for (const level of t.mipmaps ?? []) bytes += (level as { data?: ArrayBufferView }).data?.byteLength ?? 0
      continue
    }
    const img = t.image as { width?: number; height?: number; data?: ArrayBufferView } | null
    if (!img?.width || !img.height) continue
    const texel = t.type === THREE.HalfFloatType ? 8 : t.type === THREE.FloatType ? 16 : 4
    bytes += img.width * img.height * texel * (t.generateMipmaps ? 4 / 3 : 1)
  }
  return bytes / (1024 * 1024)
}

/** stats.js FPS panel plus a readout against the phone budget (draw calls, triangles, texture memory). */
export class PerfOverlay {
  private stats: { begin(): void; end(): void; dom: HTMLElement } | null = null
  private info: HTMLDivElement | null = null
  private acc = 0
  private texAcc = 2
  private texMB = 0

  async mount(): Promise<void> {
    const { default: Stats } = await import('stats.js')
    const stats = new Stats()
    stats.showPanel(0)
    stats.dom.style.cssText = 'position:fixed;left:0;z-index:50;opacity:0.9'
    stats.dom.classList.add('perf-stats')
    document.body.appendChild(stats.dom)
    this.stats = stats
    const info = document.createElement('div')
    info.className = 'perf-info'
    document.body.appendChild(info)
    this.info = info
  }

  begin(): void {
    this.stats?.begin()
  }

  end(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, dt: number, tier: string, fps: number | null): void {
    this.stats?.end()
    if (!this.info) return
    this.acc += dt
    this.texAcc += dt
    if (this.acc < 0.5) return
    this.acc = 0
    if (this.texAcc >= 2) {
      this.texAcc = 0
      this.texMB = textureMegabytes(scene)
    }
    const r = renderer.info.render
    const aa = renderer.getContextAttributes()?.antialias ? 'aa' : 'no aa'
    const f = fps === null ? '' : ` · ${Math.round(fps)} fps`
    this.info.dataset.tier = tier
    this.info.textContent =
      `tier ${tier} · px ${renderer.getPixelRatio().toFixed(2)} · ${aa}${f}\n` +
      `calls ${r.calls}/150 · tris ${(r.triangles / 1000).toFixed(1)}k/300k · tex ${Math.round(this.texMB)}/60 MB`
  }
}
