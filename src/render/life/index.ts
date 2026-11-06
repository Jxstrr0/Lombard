/**
 * Shop life (M3 art pass): small moving things that make the baked room feel
 * lived in. All presentation; reads game state like the rest of render/ and
 * never changes it. Loaded as its own chunk after the shop is on screen
 * (main.ts, after __lombardReady); everything is built in code, so there is
 * nothing extra to download. ?life=0 leaves it out.
 *
 * - wallClock.ts: the clock over the street door shows the shop time.
 * - sunlight.ts: the window's light on the floor (slides and warms with the
 *   day, breathes with passing cloud, now and then a passer-by's shadow) and
 *   dust drifting in it.
 * - tubeLight.ts: a fluorescent tube in the storeroom that stutters now and then.
 * - teaGlass.ts: a glass of tea by the counter lamp, steaming, sipped, topped up.
 *
 * Reduce motion: nothing drifts, flickers or sweeps; the clock still shows
 * the time. Low tier: no particles (dust, steam).
 *
 * Budget (measured with ?perf=1, see docs/04-ASSETS.md § Shop life): at most
 * 9 draw calls in any one view, a few hundred triangles, under 1 MB of
 * textures.
 */
import * as THREE from 'three'
import type { GameState } from '../../game/state'
import type { QualityTier } from '../perf'
import { Sunlight } from './sunlight'
import { TeaGlass } from './teaGlass'
import { shopHour, sunAt } from './timeOfDay'
import { TubeLight } from './tubeLight'
import { WallClock } from './wallClock'

export class ShopLife {
  readonly group = new THREE.Group()
  readonly clock = new WallClock()
  readonly sunlight = new Sunlight()
  readonly tube = new TubeLight()
  readonly tea = new TeaGlass()
  private clockSeconds = 0
  private clockOverride: number | null = null
  private reduceMotion = false
  private lastHour = Number.NaN

  constructor() {
    this.group.name = 'shop-life'
    this.group.add(this.clock.mesh, this.sunlight.group, this.tube.group, this.tea.group)
  }

  /** ?time=HH:MM: show this shop time (as day.clock seconds) whatever the game's clock says. */
  setClockOverride(seconds: number | null): void {
    this.clockOverride = seconds
  }

  sync(state: GameState): void {
    this.clockSeconds = this.clockOverride ?? state.day.clock
    if (state.settings.reduceMotion !== this.reduceMotion) {
      this.reduceMotion = state.settings.reduceMotion
      this.sunlight.setReduceMotion(this.reduceMotion)
      this.tube.setReduceMotion(this.reduceMotion)
      this.tea.setReduceMotion(this.reduceMotion)
    }
    const hour = shopHour(this.clockSeconds)
    // The sun moves a few metres a day; re-project when the shop clock has moved.
    if (hour !== this.lastHour) {
      this.lastHour = hour
      this.sunlight.setSun(sunAt(hour))
    }
    const open = state.day.phase === 'open'
    this.tea.sync(this.clockSeconds, open, state.current !== null)
  }

  setTier(tier: QualityTier): void {
    const particles = tier !== 'low'
    this.sunlight.setParticles(particles)
    this.tea.setParticles(particles)
  }

  /** `viewHeightPx`: the drawing buffer's height (point sizes are in device pixels). */
  update(dt: number, viewHeightPx: number): void {
    this.clock.update(dt, this.clockSeconds, this.reduceMotion)
    this.sunlight.update(dt, viewHeightPx)
    this.tube.update(dt)
    this.tea.update(dt, viewHeightPx)
  }

  /** For the street (render/street/): someone walks past the window. */
  passerBy(direction: 1 | -1, speed?: number): void {
    this.sunlight.passerBy(direction, speed)
  }

  dispose(): void {
    this.group.removeFromParent()
    this.clock.dispose()
    this.sunlight.dispose()
    this.tube.dispose()
    this.tea.dispose()
  }
}
