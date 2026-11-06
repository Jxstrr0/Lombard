/**
 * A glass of tea in a metal holder on the counter by the lamp, with a teaspoon
 * in it and steam rising while it's hot. The level drops a sip at a time as
 * the shop clock runs and it's topped up in a lull between customers once
 * it's half gone (teaModel.ts). Built from lathe and tube geometry here, so
 * there is nothing to download. Lit like the items on the mat (env map plus
 * the counter lamp). Four draw calls: holder (with handle and spoon), glass,
 * tea, steam; plus the contact-shadow decal.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Rng } from '../../game/rng'
import { contactShadowTexture } from '../textures'
import { TEA, teaAt, wantsRefill } from './teaModel'
import { CLOCK_MINUTES_PER_SECOND } from './timeOfDay'

const GLASS = {
  /** On the counter glass (top 0.938 m), to the player's left of the mat, in the lamp's pool. */
  position: new THREE.Vector3(0.6, 0.939, -2.14),
  /** Handle points to the player's near left. */
  handleYaw: 0.75,
  height: 0.105,
  /** Inside bottom of the glass and the tea's full height above it. */
  floor: 0.006,
  fill: 0.086,
  /** Seconds to top up (the level rises, steam comes back). */
  pourSeconds: 1.6,
}

const STEAM = {
  count: 16,
  /** Rise (m) over a puff's life, and lives per second. */
  rise: 0.16,
  rate: 0.3,
  /** Puff size (m) at birth and growth over its life. */
  size: 0.016,
  grow: 0.05,
  /** Opacity of a fresh puff from a just-poured glass. */
  alpha: 0.28,
}

const STEAM_VERTEX = /* glsl */ `
attribute vec4 seed;
uniform float time;
uniform vec3 origin;
uniform float heat;
uniform float viewH;
varying float vAlpha;
varying float vSeed;
void main() {
  float age = fract(time * ${STEAM.rate.toFixed(3)} * (0.8 + 0.4 * seed.y) + seed.x);
  float ph = seed.z * 6.2831;
  vec3 p = origin;
  p.x += (seed.y - 0.5) * 0.016 + age * (0.012 * sin(time * 1.1 + ph) + 0.01 * (seed.w - 0.5));
  p.z += (seed.w - 0.5) * 0.016 + age * 0.012 * cos(time * 0.9 + ph);
  p.y += age * ${STEAM.rise.toFixed(3)};
  vAlpha = heat * ${STEAM.alpha.toFixed(3)} * smoothstep(0.0, 0.18, age) * pow(1.0 - age, 1.6);
  vSeed = seed.z;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = ${STEAM.size.toFixed(3)} + age * ${STEAM.grow.toFixed(3)};
  gl_PointSize = size * projectionMatrix[1][1] * viewH * 0.5 / -mv.z;
}
`

const STEAM_FRAGMENT = /* glsl */ `
uniform vec3 color;
varying float vAlpha;
varying float vSeed;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  // Wispy rather than a disc: a couple of soft bands across the puff.
  float wisp = 0.65 + 0.35 * sin(q.x * 4.0 + q.y * 2.5 + vSeed * 40.0);
  float a = vAlpha * (1.0 - smoothstep(0.15, 1.0, r)) * wisp;
  gl_FragColor = vec4(color, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class TeaGlass {
  readonly group = new THREE.Group()
  private readonly tea: THREE.Mesh
  private readonly steam: THREE.Points
  private readonly steamMat: THREE.ShaderMaterial
  private readonly owned: { dispose(): void }[] = []
  private pourClock: number | null = null
  private lastClock = 0
  private hadCustomer = false
  /** Shown level/heat (eased during a pour). */
  private level = 1
  private heat = 1
  private pour: { from: number; t: number } | null = null
  private time = 0
  private reduceMotion = false
  private particles = true

  constructor() {
    this.group.name = 'life-tea'
    this.group.position.copy(GLASS.position)

    const metal = new THREE.MeshStandardMaterial({ name: 'life-tea-holder', color: '#bdb6a6', metalness: 1, roughness: 0.32 })
    const holder = new THREE.Mesh(holderGeometry(), metal)
    holder.rotation.y = GLASS.handleYaw

    const glassMat = new THREE.MeshStandardMaterial({
      name: 'life-tea-glass',
      color: '#e8f0ec',
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      envMapIntensity: 1.6,
      depthWrite: false,
      flatShading: true,
      side: THREE.DoubleSide,
    })
    const glass = new THREE.Mesh(glassGeometry(), glassMat)
    glass.renderOrder = 4

    const teaGeo = new THREE.CylinderGeometry(0.0282, 0.0262, 1, 14, 1)
    teaGeo.translate(0, 0.5, 0)
    const teaMat = new THREE.MeshStandardMaterial({ name: 'life-tea', color: '#3b1605', roughness: 0.2, metalness: 0, envMapIntensity: 0.5, transparent: true, opacity: 0.94 })
    this.tea = new THREE.Mesh(teaGeo, teaMat)
    this.tea.position.y = GLASS.floor
    this.tea.renderOrder = 3

    const shadowTex = contactShadowTexture()
    const shadowMat = new THREE.MeshBasicMaterial({ name: 'life-tea-shadow', map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 })
    const shadowGeo = new THREE.PlaneGeometry(0.13, 0.13)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadow = new THREE.Mesh(shadowGeo, shadowMat)
    shadow.position.y = 0.0008
    shadow.renderOrder = 3

    const rng = new Rng(3307)
    const seeds = new Float32Array(STEAM.count * 4)
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next()
    // Spread the births evenly so the column never gaps.
    for (let i = 0; i < STEAM.count; i++) seeds[i * 4] = i / STEAM.count
    const steamGeo = new THREE.BufferGeometry()
    steamGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4))
    steamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STEAM.count * 3), 3))
    this.steamMat = new THREE.ShaderMaterial({
      name: 'life-tea-steam',
      uniforms: {
        time: { value: 0 },
        origin: { value: GLASS.position.clone().add(new THREE.Vector3(0, GLASS.height - 0.004, 0)) },
        heat: { value: 1 },
        viewH: { value: 800 },
        color: { value: new THREE.Color(0.78, 0.76, 0.72) },
      },
      vertexShader: STEAM_VERTEX,
      fragmentShader: STEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
    })
    this.steam = new THREE.Points(steamGeo, this.steamMat)
    this.steam.name = 'life-tea-steam'
    // The shader places the puffs in world space; culling uses the group's frame: a sphere round the column above the glass.
    steamGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, GLASS.height + 0.08, 0), 0.16)
    this.steam.renderOrder = 5

    // The steam's shader works in world space (it rises straight up), so its parent doesn't matter.
    this.group.add(shadow, holder, this.tea, glass, this.steam)
    this.owned.push(holder.geometry, metal, glass.geometry, glassMat, teaGeo, teaMat, shadowGeo, shadowMat, shadowTex, steamGeo, this.steamMat)
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
  }

  /** Low tier: no steam. */
  setParticles(on: boolean): void {
    this.particles = on
  }

  /** Shop clock (in-game seconds), and whether someone is at the counter now. */
  sync(clockSeconds: number, open: boolean, customer: boolean): void {
    // A new day (or the first look): a fresh glass.
    if (this.pourClock === null || clockSeconds < this.lastClock - 1) this.pourClock = clockSeconds
    this.lastClock = clockSeconds
    // A lull starts: top up if it's half gone.
    if (open && this.hadCustomer && !customer && wantsRefill(this.minutes())) {
      this.pour = { from: this.level, t: 0 }
      this.pourClock = clockSeconds
    }
    this.hadCustomer = customer
  }

  private minutes(): number {
    return (this.lastClock - (this.pourClock ?? this.lastClock)) * CLOCK_MINUTES_PER_SECOND
  }

  update(dt: number, viewHeightPx: number): void {
    if (!this.reduceMotion) this.time += dt
    const target = teaAt(this.minutes())
    if (this.pour && !this.reduceMotion) {
      this.pour.t += dt / GLASS.pourSeconds
      const k = Math.min(1, this.pour.t)
      this.level = this.pour.from + (target.level - this.pour.from) * (k * k * (3 - 2 * k))
      if (k >= 1) this.pour = null
    } else {
      this.pour = null
      // Sips: a quick drop rather than a jump.
      this.level += (target.level - this.level) * Math.min(1, dt * (this.reduceMotion ? 1000 : 3))
    }
    this.heat += (target.heat - this.heat) * Math.min(1, dt * 2)
    this.tea.scale.y = Math.max(0.001, this.level * GLASS.fill)
    const u = this.steamMat.uniforms
    u.time!.value = this.time
    u.heat!.value = this.heat
    u.viewH!.value = viewHeightPx
    this.steam.visible = this.particles && this.heat > 0.06 && this.level > TEA.minLevel * 0.5
  }

  dispose(): void {
    for (const d of this.owned) d.dispose()
  }
}

/** Thin faceted glass (16 flats, like the classic tea glass), open at the top. */
function glassGeometry(): THREE.BufferGeometry {
  const h = GLASS.height
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.0285, 0.0),
    new THREE.Vector2(0.0335, h),
    new THREE.Vector2(0.0318, h),
    new THREE.Vector2(0.027, GLASS.floor),
    new THREE.Vector2(0.0, GLASS.floor),
  ]
  return new THREE.LatheGeometry(pts, 16)
}

/** Cupronickel holder: foot, body, rim, a loop handle, and the teaspoon standing in the glass. */
function holderGeometry(): THREE.BufferGeometry {
  const shell = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, -0.003),
      new THREE.Vector2(0.034, -0.003),
      new THREE.Vector2(0.0352, 0.004),
      new THREE.Vector2(0.0312, 0.009),
      new THREE.Vector2(0.0338, 0.013),
      new THREE.Vector2(0.0362, 0.068),
      new THREE.Vector2(0.0384, 0.072),
      new THREE.Vector2(0.0372, 0.075),
      new THREE.Vector2(0.0344, 0.071),
      new THREE.Vector2(0.0332, 0.014),
      new THREE.Vector2(0.0, 0.012),
    ],
    24,
  )
  // Lathe starts at +z and goes round; the handle sits on +x.
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.035, 0.064, 0),
    new THREE.Vector3(0.052, 0.066, 0),
    new THREE.Vector3(0.062, 0.05, 0),
    new THREE.Vector3(0.058, 0.03, 0),
    new THREE.Vector3(0.035, 0.022, 0),
  ])
  const handle = new THREE.TubeGeometry(handleCurve, 18, 0.0032, 6, false)
  const spoon = new THREE.CylinderGeometry(0.0016, 0.0016, 0.15, 5, 1)
  spoon.translate(0, 0.075, 0)
  spoon.rotateZ(-0.24)
  spoon.translate(-0.013, 0.012, 0.006)
  const spoonEnd = new THREE.SphereGeometry(0.0042, 6, 4)
  spoonEnd.scale(1, 0.45, 1)
  spoonEnd.translate(-0.013 + Math.sin(0.24) * 0.15, 0.012 + Math.cos(0.24) * 0.15, 0.006)
  const merged = mergeGeometries([shell, handle, spoon, spoonEnd])
  shell.dispose()
  handle.dispose()
  spoon.dispose()
  spoonEnd.dispose()
  return merged
}
