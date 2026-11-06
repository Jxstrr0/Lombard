/**
 * M6 the Flood, inside the shop (presentation only; src/game/city/flood.ts floodView says what to
 * show): Kuzmich's sandbags across the street door, and canal water on the floor from the flood
 * morning until it dries.
 *
 * Two draws at most, built in code (nothing to download): the sandbags are one InstancedMesh of a
 * squashed low-poly sphere; the water is one floor quad with a procedural soft-edged mask, a
 * glossy standard material so the room's environment map gives it a sheen (no real-time
 * reflections, no extra lights). Hidden entirely outside the flood's days.
 */
import * as THREE from 'three'
import type { FloodPhase, FloodPrep } from '../../game/city/flood'

/** Presentation numbers (world metres; the street door is 1.2 m wide at x 1.7, its inner face z ≈ 3.95). */
const LOOK = {
  door: { x: 1.7, z: 3.72, width: 1.3 },
  bag: { size: [0.3, 0.12, 0.2] as const, rows: 2, perRow: 5, colour: 0x8b7b5c },
  /** The water's patch on the floor by the door (x0, x1, z0, z1) and its depth of colour by how ready the shop was. */
  puddle: {
    none: { rect: [-0.6, 2.9, 0.6, 3.95], opacity: 0.6 },
    lifted: { rect: [-0.6, 2.9, 0.6, 3.95], opacity: 0.55 },
    sandbags: { rect: [1.0, 2.5, 2.9, 3.6], opacity: 0.45 },
  } satisfies Record<FloodPrep, { rect: number[]; opacity: number }>,
  colour: 0x050403,
  /** How much of the room's environment map the water's surface shows (a sheen, not a mirror). */
  sheen: 0.12,
  /** Opacity × this through the phases after the flood morning (receding, drying); then gone. */
  fade: { flood: 1, receding: 0.75, drying: 0.35 } as Partial<Record<FloodPhase, number>>,
}

export class FloodInside {
  readonly group = new THREE.Group()
  private readonly bags: THREE.InstancedMesh
  private readonly water: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  private readonly mask: THREE.DataTexture
  private key = ''

  constructor() {
    this.group.name = 'flood'
    const [bx, by, bz] = LOOK.bag.size
    const geo = new THREE.SphereGeometry(0.5, 10, 6)
    geo.scale(bx, by, bz)
    const mat = new THREE.MeshStandardMaterial({ color: LOOK.bag.colour, roughness: 1, metalness: 0 })
    const count = LOOK.bag.rows * LOOK.bag.perRow
    this.bags = new THREE.InstancedMesh(geo, mat, count)
    this.bags.name = 'flood-sandbags'
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    let i = 0
    for (let row = 0; row < LOOK.bag.rows; row++) {
      const n = LOOK.bag.perRow - row
      const step = LOOK.door.width / LOOK.bag.perRow
      for (let k = 0; k < n; k++) {
        // a little irregular, the way a caretaker lays them
        const jitter = Math.sin((row * 7 + k) * 12.9898) * 0.5
        const x = LOOK.door.x - ((n - 1) * step) / 2 + k * step + jitter * 0.03
        e.set(0, jitter * 0.25, jitter * 0.06)
        q.setFromEuler(e)
        m.compose(new THREE.Vector3(x, by * 0.45 + row * by * 0.82, LOOK.door.z - row * 0.02 + jitter * 0.02), q, new THREE.Vector3(1, 1, 1))
        this.bags.setMatrixAt(i++, m)
      }
    }
    this.bags.count = i
    this.bags.instanceMatrix.needsUpdate = true

    this.mask = puddleMask(64)
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: LOOK.colour,
        roughness: 0.25,
        metalness: 0,
        envMapIntensity: LOOK.sheen,
        transparent: true,
        alphaMap: this.mask,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    )
    this.water.name = 'flood-water'
    this.water.rotation.x = -Math.PI / 2
    this.water.renderOrder = 1
    this.group.add(this.bags, this.water)
    this.group.visible = false
  }

  /** What floodView says today (phase, how ready the shop was, whether the sandbags are down). */
  sync(view: { phase: FloodPhase; prep: FloodPrep; sandbags: boolean } | null): void {
    const key = view ? `${view.phase}:${view.prep}:${view.sandbags}` : ''
    if (key === this.key) return
    this.key = key
    const fade = view ? (LOOK.fade[view.phase] ?? 0) : 0
    this.bags.visible = !!view?.sandbags
    this.water.visible = fade > 0
    if (view && fade > 0) {
      const p = LOOK.puddle[view.prep]
      const [x0, x1, z0, z1] = p.rect as [number, number, number, number]
      this.water.position.set((x0 + x1) / 2, 0.003, (z0 + z1) / 2)
      this.water.scale.set(x1 - x0, z1 - z0, 1)
      this.water.material.opacity = p.opacity * fade
    }
    this.group.visible = this.bags.visible || this.water.visible
  }

  dispose(): void {
    this.group.removeFromParent()
    this.bags.geometry.dispose()
    ;(this.bags.material as THREE.Material).dispose()
    this.bags.dispose()
    this.water.geometry.dispose()
    this.water.material.dispose()
    this.mask.dispose()
  }
}

/** A soft, lobed blob of water (green channel = alpha, as three.js reads alphaMap). Deterministic. */
function puddleMask(n: number): THREE.DataTexture {
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n - 0.5
      const v = (y + 0.5) / n - 0.5
      const a = Math.atan2(v, u)
      const r = Math.hypot(u * 1.0, v * 1.0)
      const edge = 0.4 + 0.05 * Math.sin(a * 3 + 1.3) + 0.035 * Math.sin(a * 5 + 2.1) + 0.02 * Math.sin(a * 11 + 0.4)
      // a hard-ish rim, as water has, with a thinner film just inside it
      const t = Math.min(1, Math.max(0, (edge - r) / 0.025))
      const k = (t * t * (3 - 2 * t)) * (0.75 + 0.25 * Math.min(1, (edge - r) / 0.12))
      const i = (y * n + x) * 4
      data[i] = data[i + 1] = data[i + 2] = Math.round(k * 255)
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return tex
}
