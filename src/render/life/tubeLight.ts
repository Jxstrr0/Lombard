/**
 * The storeroom's fluorescent tube, on the far wall over the pledge shelves
 * (seen through the doorway when the player turns left and looks up a little).
 * Now and then it stutters: a short run of blinks, sometimes a drop-out and a
 * restart. Emissive change only, no real-time light:
 * - the tube itself, and a soft glow on the wall round it (dst × (1 + glow));
 * - a dimmer across the doorway (dst × level): everything seen through the
 *   doorway darkens with the tube, so the flicker reads from the counter even
 *   when the tube is out of frame. The bake is the storeroom with the light on.
 * Four small draw calls, all out of view unless the player looks into the storeroom.
 *
 * Reduce motion: the tube stays steadily on (no flicker).
 */
import * as THREE from 'three'
import { Rng } from '../../game/rng'

const TUBE = {
  /** On the storeroom's east wall (inner face x = 6.0), clear of the shelving (top box ≈ 2.02 m). */
  x: 5.965,
  y: 2.4,
  z: -3.2,
  length: 1.2,
  radius: 0.013,
  /** Linear colour at full output (a cool-white tube, a bit green like an old one). */
  color: new THREE.Color(1.0, 1.02, 0.94),
  /** Glow on the wall: half-extent (m) along the tube and up/down, and how much it brightens the wall. */
  glow: { along: 0.95, across: 0.55, strength: 0.75 },
  /** Storeroom brightness with the tube out, on screen (the shop's light still spills in). */
  darkLevel: 0.35,
  /** The doorway opening (inside the jambs), just behind the jambs' inner face. */
  doorway: { x: 3.012, z0: -3.66, z1: -2.74, y0: -0.01, y1: 2.11 },
  /** Seconds between stutters, and how long one lasts. */
  gap: [9, 34] as const,
  burst: [0.2, 1.1] as const,
}

const GLOW_VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform vec2 extent;
varying vec2 vP;
void main() {
  vec2 q = vP / extent;
  float f = exp(-3.0 * dot(q, q));
  gl_FragColor = vec4(color * f, 1.0);
}
`

export class TubeLight {
  readonly group = new THREE.Group()
  private readonly tubeMat: THREE.MeshBasicMaterial
  private readonly glowMat: THREE.ShaderMaterial
  private readonly dimMat: THREE.MeshBasicMaterial
  private readonly dim: THREE.Mesh
  private readonly owned: { dispose(): void }[] = []
  private readonly rng = new Rng(6113)
  private level = 1
  private next: number
  /** The current stutter: when it ends, and when the level next changes. */
  private burst: { left: number; step: number; dropout: number } | null = null
  private reduceMotion = false

  constructor() {
    this.group.name = 'life-tube'
    this.group.position.set(TUBE.x, TUBE.y, TUBE.z)
    const housingGeo = new THREE.BoxGeometry(0.05, 0.045, TUBE.length + 0.08)
    const housingMat = new THREE.MeshBasicMaterial({ name: 'life-tube-housing', color: new THREE.Color(0.32, 0.31, 0.29) })
    const housing = new THREE.Mesh(housingGeo, housingMat)
    housing.position.set(0.012, 0.02, 0)
    const tubeGeo = new THREE.CylinderGeometry(TUBE.radius, TUBE.radius, TUBE.length, 10, 1)
    tubeGeo.rotateX(Math.PI / 2)
    this.tubeMat = new THREE.MeshBasicMaterial({ name: 'life-tube', color: TUBE.color.clone(), toneMapped: false })
    const tube = new THREE.Mesh(tubeGeo, this.tubeMat)
    tube.position.set(-0.012, -0.012, 0)

    const glowGeo = new THREE.PlaneGeometry(TUBE.glow.along * 2.4, TUBE.glow.across * 2.6)
    this.glowMat = new THREE.ShaderMaterial({
      name: 'life-tube-glow',
      uniforms: { color: { value: new THREE.Color() }, extent: { value: new THREE.Vector2(TUBE.glow.along, TUBE.glow.across) } },
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneFactor,
    })
    const glow = new THREE.Mesh(glowGeo, this.glowMat)
    // Flat on the wall (faces −x, into the storeroom); plane x runs along the tube (world z).
    glow.rotation.y = -Math.PI / 2
    glow.position.set(5.995 - TUBE.x, -0.05, 0)
    glow.renderOrder = 1

    // The doorway dimmer: dst × colour (only ever darkens, so 8-bit targets are fine).
    const d = TUBE.doorway
    const dimGeo = new THREE.PlaneGeometry(d.z1 - d.z0, d.y1 - d.y0)
    this.dimMat = new THREE.MeshBasicMaterial({
      name: 'life-storeroom-dim',
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.ZeroFactor,
    })
    const dim = (this.dim = new THREE.Mesh(dimGeo, this.dimMat))
    dim.name = 'life-storeroom-dim'
    // In the group's frame (the tube's position); the plane faces ±x across the doorway.
    dim.rotation.y = Math.PI / 2
    dim.position.set(d.x - TUBE.x, (d.y0 + d.y1) / 2 - TUBE.y, (d.z0 + d.z1) / 2 - TUBE.z)
    dim.renderOrder = 7

    this.group.add(glow, housing, tube, dim)
    this.owned.push(housingGeo, housingMat, tubeGeo, this.tubeMat, glowGeo, this.glowMat, dimGeo, this.dimMat)
    this.group.traverse((o) => {
      o.updateMatrix()
      o.matrixAutoUpdate = false
    })
    this.next = this.rng.range(3, 8)
    this.apply()
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    if (on) {
      this.burst = null
      this.level = 1
      this.apply()
    }
  }

  update(dt: number): void {
    if (this.reduceMotion) return
    if (!this.burst) {
      this.next -= dt
      if (this.next > 0) return
      this.next = this.rng.range(TUBE.gap[0], TUBE.gap[1])
      // One in four is a drop-out: dark for a moment, then it strikes again.
      const dropout = this.rng.chance(0.25) ? this.rng.range(0.35, 0.8) : 0
      this.burst = { left: this.rng.range(TUBE.burst[0], TUBE.burst[1]) + dropout, step: 0, dropout }
    }
    const b = this.burst
    b.left -= dt
    b.step -= dt
    if (b.left <= 0) {
      this.burst = null
      this.level = 1
    } else if (b.dropout > 0) {
      b.dropout -= dt
      this.level = 0.02
    } else if (b.step <= 0) {
      b.step = this.rng.range(0.03, 0.09)
      const r = this.rng.next()
      this.level = r < 0.45 ? 0.04 : r < 0.7 ? 0.35 : 1
    }
    this.apply()
  }

  private apply(): void {
    this.tubeMat.color.copy(TUBE.color).multiplyScalar(0.08 + 1.3 * this.level)
    ;(this.glowMat.uniforms.color!.value as THREE.Color).copy(TUBE.color).multiplyScalar(TUBE.glow.strength * this.level)
    // The colour is linear and goes out sRGB-encoded: undo that so darkLevel is what the screen shows.
    this.dimMat.color.setScalar(Math.pow(TUBE.darkLevel + (1 - TUBE.darkLevel) * Math.min(1, this.level), 2.2))
    // At full light the dimmer changes nothing: skip the draw.
    this.dim.visible = this.level < 0.999
  }

  dispose(): void {
    for (const d of this.owned) d.dispose()
  }
}
