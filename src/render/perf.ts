/**
 * Performance overlay (stats.js, shown with ?perf=1) and quality tiers.
 *
 * Tier selection is a stub for M0: a device heuristic plus a 3-second frame
 * time sample that is logged and kept for later. Real tier switching
 * (glass transmission, anisotropy, shadow decals) arrives with M3 art.
 */
import type * as THREE from 'three'

export type QualityTier = 'low' | 'mid' | 'high'

export interface TierSettings {
  pixelRatioCap: number
  antialias: boolean
}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  low: { pixelRatioCap: 1.5, antialias: false },
  mid: { pixelRatioCap: 2, antialias: true },
  high: { pixelRatioCap: 2, antialias: true },
}

const TIER_KEY = 'lombard.qualityTier'

function isTier(v: unknown): v is QualityTier {
  return v === 'low' || v === 'mid' || v === 'high'
}

/** ?tier= override, then a saved choice, then a device heuristic. */
export function initialTier(params: URLSearchParams): QualityTier {
  const fromUrl = params.get('tier')
  if (isTier(fromUrl)) return fromUrl
  try {
    const saved = localStorage.getItem(TIER_KEY)
    if (isTier(saved)) return saved
  } catch {
    // storage blocked: fall through to the heuristic
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  if (coarse) return 'low'
  const cores = navigator.hardwareConcurrency ?? 4
  return cores >= 8 ? 'high' : 'mid'
}

/**
 * Samples frame times for the first 3 seconds. Stub: records the result and
 * suggests a tier, but does not switch automatically yet.
 */
export class TierBenchmark {
  private elapsed = 0
  private frames = 0
  private done = false
  result: { avgMs: number; suggested: QualityTier } | null = null

  sample(dt: number): void {
    if (this.done) return
    this.elapsed += dt
    this.frames++
    if (this.elapsed >= 3) {
      this.done = true
      const avgMs = (this.elapsed / this.frames) * 1000
      const suggested: QualityTier = avgMs < 12 ? 'high' : avgMs < 22 ? 'mid' : 'low'
      this.result = { avgMs, suggested }
      console.info(`[perf] 3 s benchmark: ${avgMs.toFixed(1)} ms/frame, suggests "${suggested}"`)
    }
  }
}

/** stats.js FPS panel plus a draw-call / triangle readout against the phone budget. */
export class PerfOverlay {
  private stats: { begin(): void; end(): void; dom: HTMLElement } | null = null
  private info: HTMLDivElement | null = null
  private acc = 0

  async mount(tier: QualityTier): Promise<void> {
    const { default: Stats } = await import('stats.js')
    const stats = new Stats()
    stats.showPanel(0)
    stats.dom.style.cssText = 'position:fixed;left:0;z-index:50;opacity:0.9'
    stats.dom.classList.add('perf-stats')
    document.body.appendChild(stats.dom)
    this.stats = stats
    const info = document.createElement('div')
    info.className = 'perf-info'
    info.dataset.tier = tier
    document.body.appendChild(info)
    this.info = info
  }

  begin(): void {
    this.stats?.begin()
  }

  end(renderer: THREE.WebGLRenderer, dt: number, benchmark: TierBenchmark): void {
    this.stats?.end()
    if (!this.info) return
    this.acc += dt
    if (this.acc < 0.5) return
    this.acc = 0
    const r = renderer.info.render
    const m = renderer.info.memory
    const bench = benchmark.result ? ` · bench ${benchmark.result.avgMs.toFixed(1)}ms` : ''
    this.info.textContent =
      `tier ${this.info.dataset.tier} · px ${renderer.getPixelRatio().toFixed(2)}${bench}\n` +
      `calls ${r.calls}/150 · tris ${(r.triangles / 1000).toFixed(1)}k/300k · tex ${m.textures} · geo ${m.geometries}`
  }
}
