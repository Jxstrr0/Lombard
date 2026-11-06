/**
 * Window light: the soft patch of daylight on the floor and the dust drifting
 * in the light coming through the window. Two draw calls.
 *
 * The patch is one quad on the floor: the window opening projected along the
 * light (timeOfDay.ts), so it slides and stretches with the time of day. Its
 * shader draws the panes (soft-edged, split by the middle post and the
 * transom), the potted plant's shadow at the sill end, the occasional shadow
 * of someone walking past outside, and clips to the floor in front of the
 * counter. It adds light by brightening what is already there
 * (dst × (1 + light)), so the parquet keeps its colour and the baked shading.
 *
 * The dust is one Points draw call, additive: a few hundred motes whose
 * positions live in "window space" (u, v across the opening, s metres along
 * the light), so they always stay inside the beam however the sun moves.
 *
 * Passers-by: `passerBy()` sweeps a shadow across the patch. Until the street
 * (render/street/) calls it, the light fakes one now and then from a seeded
 * schedule; `setFakePassers(false)` turns that off.
 */
import * as THREE from 'three'
import { Rng } from '../../game/rng'
import { PATCH_CLIP, WINDOW, patchCorners, sunDirection, type Sun } from './timeOfDay'

const WIDTH = WINDOW.x1 - WINDOW.x0
const HEIGHT = WINDOW.y1 - WINDOW.y0
/**
 * The bars' shadows are wider than the bars: the light comes in at an angle,
 * so their depth (post 0.12 m, transom 0.08 m) blocks too. Typical widths for
 * the day's sun, in metres on the window plane.
 */
const POST_SHADOW = WINDOW.postW + 0.03
const TRANSOM_SHADOW = WINDOW.transomW + 0.05
const POST_U = [(WINDOW.postX - POST_SHADOW / 2 - WINDOW.x0) / WIDTH, (WINDOW.postX + POST_SHADOW / 2 - WINDOW.x0) / WIDTH]
const TRANSOM_V = [(WINDOW.transomY - TRANSOM_SHADOW / 2 - WINDOW.y0) / HEIGHT, (WINDOW.transomY + TRANSOM_SHADOW / 2 - WINDOW.y0) / HEIGHT]

const LIGHT = {
  /** Penumbra, in window uv, at mid-height: thin cloud makes it soft. It widens with the distance the light travels (the top of the window lands furthest). */
  soft: 0.022,
  /** How much the bars (post, transom) block; less than 1 because the light is broad. */
  bars: 0.8,
  /** Cloud: the patch breathes between (1 − depth) and 1 of its strength over tens of seconds. */
  cloudDepth: 0.35,
  /** Under the heaviest rain or snow the patch keeps this much of its strength (a faint, soft brightening). */
  overcastFloor: 0.08,
  /** A passer-by's shadow: width (m), top (m, a head on the pavement), how dark. */
  passer: { width: 0.55, top: 1.75, strength: 0.55 },
  /** Seconds between fake passers-by. */
  passerGap: [16, 48] as const,
  /** Walking speed range, m/s. */
  passerSpeed: [0.9, 1.5] as const,
}

const DUST = {
  count: 320,
  /** Motes live from this far along the light (m) out to `reach` or the floor. */
  near: 0.15,
  reach: 3.2,
  /** Mote size, metres (drawn at least ~1 px). */
  size: 0.0045,
  /** Brightness per unit patch strength. */
  gain: 0.8,
}

const PATCH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** Shared by the patch and the dust: how much light gets through the opening at window uv p. */
const PANES = /* glsl */ `
uniform vec2 postU;
uniform vec2 transomV;
uniform vec3 plant; // u, half width (u), top (v)
uniform vec4 passer; // u, half width (u), strength, top (v)
uniform float soft;
uniform float bars;
float band(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
float panes(vec2 p) {
  float s = soft * mix(0.35, 1.6, clamp(p.y, 0.0, 1.0));
  float m = band(p.x, 0.0, 1.0, s) * band(p.y, 0.0, 1.0, s);
  m *= 1.0 - bars * band(p.x, postU.x, postU.y, s * 0.7);
  m *= 1.0 - bars * band(p.y, transomV.x, transomV.y, s * 0.5);
  vec2 d = (p - vec2(plant.x, 0.0)) / vec2(plant.y, plant.z);
  m *= 1.0 - 0.5 * (1.0 - smoothstep(0.55, 1.15, length(d)));
  float pu = 1.0 - smoothstep(passer.y * 0.45, passer.y, abs(p.x - passer.x));
  float pv = 1.0 - smoothstep(passer.w - 0.12, passer.w + 0.04, p.y);
  return m * (1.0 - passer.z * pu * pv);
}
`

const PATCH_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform vec4 clip; // x0, x1, z0, z1
varying vec2 vUv;
varying vec3 vWorld;
${PANES}
void main() {
  float c = band(vWorld.x, clip.x, clip.y, 0.02) * band(vWorld.z, clip.z, clip.w, 0.04);
  // dst * (1 + src): see the blend factors in the material.
  gl_FragColor = vec4(color * panes(vUv) * c, 1.0);
}
`

const DUST_VERTEX = /* glsl */ `
attribute vec4 seed; // u, v, along, phase
uniform float time;
uniform vec4 win; // x0, x1, y0, y1
uniform float winZ;
uniform vec3 dir;
uniform vec2 reach; // near, far (m along the light)
uniform float size;
uniform float viewH; // drawing buffer height, px
uniform vec4 clip;
varying float vAlpha;
${PANES}
void main() {
  float ph = seed.w * 6.2831;
  vec2 p = seed.xy;
  p.x += time * 0.0016 * (seed.w - 0.5) + 0.006 * sin(time * 0.11 + ph);
  p.y += -time * 0.0021 + 0.005 * sin(time * 0.083 + ph * 1.7);
  float a = seed.z + 0.012 * sin(time * 0.07 + ph * 2.3);
  p = fract(p);
  a = fract(a);
  vec3 w = vec3(mix(win.x, win.y, p.x), mix(win.z, win.w, p.y), winZ);
  float floorS = w.y / -dir.y;
  float s = mix(reach.x, min(reach.y, floorS - 0.02), a);
  vec3 world = w + dir * s;
  // Fade at the wrap seams, outside the floor in front of the counter, and in the bars' shade.
  float edge = smoothstep(0.0, 0.08, p.x) * smoothstep(1.0, 0.92, p.x) * smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.92, p.y) * smoothstep(0.0, 0.1, a) * smoothstep(1.0, 0.9, a);
  float inRoom = step(clip.z, world.z) * step(clip.x, world.x) * step(world.x, clip.y);
  float twinkle = 0.45 + 0.55 * sin(time * (0.9 + seed.w * 1.7) + ph * 7.0);
  vAlpha = edge * inRoom * panes(p) * twinkle * twinkle;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.3, size * projectionMatrix[1][1] * viewH * 0.5 / -mv.z);
}
`

const DUST_FRAGMENT = /* glsl */ `
uniform vec3 color;
varying float vAlpha;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  gl_FragColor = vec4(color * vAlpha * (1.0 - r), 1.0);
}
`

/** Rain or snow of intensity i covers the sky by base + (1 − base)·i (light rain already hides most of the sun). */
export const LIGHT_OVERCAST = { base: 0.7 } as const

export class Sunlight {
  readonly group = new THREE.Group()
  private readonly patch: THREE.Mesh
  private readonly patchMat: THREE.ShaderMaterial
  private readonly dust: THREE.Points
  private readonly dustMat: THREE.ShaderMaterial
  private readonly rng = new Rng(4211)
  private readonly cloudPhase: number[]
  private time = 0
  private strength = 0
  /** 1 on a clear day; less under rain or snow (see `setOvercast`). */
  private sky = 1
  private readonly tint = new THREE.Color()
  private passer: { u: number; du: number; strength: number } | null = null
  private nextPasser: number
  private fakePassers = true
  private reduceMotion = false
  private particles = true

  constructor() {
    this.group.name = 'life-sunlight'
    const shared = {
      postU: { value: new THREE.Vector2(POST_U[0], POST_U[1]) },
      transomV: { value: new THREE.Vector2(TRANSOM_V[0], TRANSOM_V[1]) },
      plant: { value: new THREE.Vector3((WINDOW.plantX - WINDOW.x0) / WIDTH, 0.06, (WINDOW.plantTop - WINDOW.y0) / HEIGHT) },
      passer: { value: new THREE.Vector4(-1, 0.1, 0, 0) },
      soft: { value: LIGHT.soft },
      bars: { value: LIGHT.bars },
      clip: { value: new THREE.Vector4(PATCH_CLIP.x0, PATCH_CLIP.x1, PATCH_CLIP.z0, PATCH_CLIP.z1) },
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2))
    geo.setIndex([0, 2, 1, 1, 2, 3])
    this.patchMat = new THREE.ShaderMaterial({
      name: 'life-sun-patch',
      uniforms: { ...shared, color: { value: new THREE.Color() } },
      vertexShader: PATCH_VERTEX,
      fragmentShader: PATCH_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneFactor,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    this.patch = new THREE.Mesh(geo, this.patchMat)
    this.patch.name = 'life-sun-patch'
    this.patch.matrixAutoUpdate = false
    this.patch.renderOrder = 1

    const seeds = new Float32Array(DUST.count * 4)
    for (let i = 0; i < seeds.length; i++) seeds[i] = this.rng.next()
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4))
    // Positions are computed in the shader; three still wants a position attribute for the draw count.
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST.count * 3), 3))
    this.dustMat = new THREE.ShaderMaterial({
      name: 'life-dust',
      uniforms: {
        ...shared,
        color: { value: new THREE.Color() },
        time: { value: 0 },
        win: { value: new THREE.Vector4(WINDOW.x0, WINDOW.x1, WINDOW.y0, WINDOW.y1) },
        winZ: { value: WINDOW.z },
        dir: { value: new THREE.Vector3(0, -1, 0) },
        reach: { value: new THREE.Vector2(DUST.near, DUST.reach) },
        size: { value: DUST.size },
        viewH: { value: 800 },
      },
      vertexShader: DUST_VERTEX,
      fragmentShader: DUST_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.dust = new THREE.Points(dustGeo, this.dustMat)
    this.dust.name = 'life-dust'
    // The shader places the motes; cull by a sphere round the window's light (within DUST.reach of the glass).
    dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3((WINDOW.x0 + WINDOW.x1) / 2, 1.6, WINDOW.z - 1.4), 3.4)
    this.dust.renderOrder = 6

    this.cloudPhase = [this.rng.range(0, 6.28), this.rng.range(0, 6.28), this.rng.range(0, 6.28)]
    this.nextPasser = this.rng.range(6, 14)
    this.group.add(this.patch, this.dust)
  }

  /** Set the sun for the current shop time. */
  setSun(sun: Sun): void {
    this.strength = sun.strength
    this.tint.setRGB(sun.color[0], sun.color[1], sun.color[2])
    const pos = this.patch.geometry.getAttribute('position') as THREE.BufferAttribute
    const corners = patchCorners(sun)
    corners.forEach(([x, z], i) => pos.setXYZ(i, x, 0.004, z))
    pos.needsUpdate = true
    this.patch.geometry.computeBoundingSphere()
    const [dx, dy, dz] = sunDirection(sun)
    ;(this.dustMat.uniforms.dir!.value as THREE.Vector3).set(dx, dy, dz)
    this.patch.visible = sun.strength > 0.001
    this.dust.visible = this.particles && this.patch.visible
  }

  /**
   * The street's weather: 0 for a clear sky, up to 1 for heavy rain or snow.
   * The patch fades to LIGHT.overcastFloor of its strength and the dust with it.
   */
  setOvercast(amount: number): void {
    this.sky = 1 - (1 - LIGHT.overcastFloor) * Math.min(1, Math.max(0, amount))
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on
    if (on) this.passer = null
  }

  /** Low tier: no dust. */
  setParticles(on: boolean): void {
    this.particles = on
    this.dust.visible = on && this.patch.visible
  }

  /** Fake passers-by from a seeded schedule (on until the street drives `passerBy`). */
  setFakePassers(on: boolean): void {
    this.fakePassers = on
  }

  /**
   * Someone walks past outside: their shadow crosses the window light.
   * `direction` +1 walks towards +x (the door side), −1 towards −x; `speed` in m/s.
   * Ignored under reduce motion or while one is already crossing.
   */
  passerBy(direction: 1 | -1, speed = 1.2): void {
    if (this.reduceMotion || this.passer) return
    const half = LIGHT.passer.width / WIDTH / 2
    this.passer = { u: direction > 0 ? -half * 2 : 1 + half * 2, du: (direction * speed) / WIDTH, strength: LIGHT.passer.strength }
  }

  update(dt: number, viewHeightPx: number): void {
    if (!this.reduceMotion) this.time += dt
    const t = this.time
    const p = this.cloudPhase
    const n = 0.5 + 0.5 * (0.55 * Math.sin(t * 0.029 + p[0]!) + 0.3 * Math.sin(t * 0.061 + p[1]!) + 0.15 * Math.sin(t * 0.13 + p[2]!))
    const cloud = this.reduceMotion ? 1 - LIGHT.cloudDepth * 0.5 : 1 - LIGHT.cloudDepth * (1 - n)
    const s = this.strength * cloud * this.sky
    ;(this.patchMat.uniforms.color!.value as THREE.Color).copy(this.tint).multiplyScalar(s)
    ;(this.dustMat.uniforms.color!.value as THREE.Color).copy(this.tint).multiplyScalar(s * DUST.gain)
    this.dustMat.uniforms.time!.value = t
    this.dustMat.uniforms.viewH!.value = viewHeightPx

    // Passers-by, faked until the street drives them.
    if (!this.reduceMotion && this.fakePassers && this.strength > 0.01) {
      this.nextPasser -= dt
      if (this.nextPasser <= 0) {
        this.nextPasser = this.rng.range(LIGHT.passerGap[0], LIGHT.passerGap[1])
        this.passerBy(this.rng.chance(0.5) ? 1 : -1, this.rng.range(LIGHT.passerSpeed[0], LIGHT.passerSpeed[1]))
      }
    }
    const v = this.patchMat.uniforms.passer!.value as THREE.Vector4
    if (this.passer) {
      this.passer.u += this.passer.du * dt
      const half = LIGHT.passer.width / WIDTH / 2
      if (this.passer.u < -half * 3 || this.passer.u > 1 + half * 3) this.passer = null
    }
    const top = (LIGHT.passer.top - WINDOW.y0) / HEIGHT
    v.set(this.passer?.u ?? -1, LIGHT.passer.width / WIDTH / 2, this.passer?.strength ?? 0, top)
  }

  dispose(): void {
    this.patch.geometry.dispose()
    this.patchMat.dispose()
    this.dust.geometry.dispose()
    this.dustMat.dispose()
  }
}
