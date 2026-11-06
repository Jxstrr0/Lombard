/**
 * The canal outside: a Cycles render made from the player's eye
 * (art/backdrop/build.py, packed by scripts/backdrop-pack.mjs into
 * public/assets/backdrop/), shown on a plane beyond the street wall. The eye
 * only rotates, so the render is perspective-exact through the window and the
 * door glass; the inspect camera and the idle sway are a few centimetres off
 * and show a little parallax.
 *
 * The texture's alpha is the water mask. One ShaderMaterial, one draw call:
 * inside the mask, two scrolling samples of a small tiling noise (laid out on
 * the water plane in metres, so ripples shrink with distance) push the lookup
 * up and down a few texels, which makes the reflections shimmer, and add faint
 * glints. Reduce motion stops it (the render's own water stays). A daylight
 * tint follows the shop clock.
 *
 * With the street layer (src/render/street/) attached, the same draw also
 * reads art/street's canal layers (depth, night light): clouds drift through
 * the sky, rain / snow / ice grade the picture, street lamps and windows light
 * up after the season's sunset, and a passing boat stirs the ripples.
 *
 * Presentation only: nothing here touches game state.
 */
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Rng } from '../game/rng'
import { outdoorLight } from './street/plan'

export interface BackdropManifest {
  version: number
  eye: [number, number, number]
  plane: { z: number; x0: number; x1: number; y0: number; y1: number }
  size: [number, number]
  waterY: number
  file: string
  inputHash: string
}

/** What the street layer tells the backdrop every frame. */
export interface BackdropStreet {
  /** Daylight multiplier (src/render/street/plan.ts outdoorLight). */
  tint: [number, number, number]
  /** 0 day → 1 night: lamps, then windows. */
  dark: number
  /** 0..1 each: rainy grading, snowy grading, frozen canal. */
  wet: number
  snow: number
  ice: number
  /** A boat on the water: x, z, heading (+1 towards +x), strength 0..1. */
  boat: [number, number, number, number]
  /** M6 the Flood: the water's height (world y) when the canal is up, else null or absent. */
  floodY?: number | null
}

/** Ripple look. Offsets are in texels of the render; noise scales in cycles per metre of water. */
const WATER = {
  /** Vertical / horizontal lookup offset at full ripple, texels (reflections smear mostly vertically). */
  offset: [2.0, 4.0] as const,
  /** Two noise layers: scale on the water plane (x along the canal, z across) and drift in tiles/s. */
  layers: [
    { scale: [0.05, 0.032], drift: [0.006, 0.018] },
    { scale: [0.13, 0.085], drift: [-0.011, 0.027] },
  ],
  /** Glint brightness (linear) where both layers peak. */
  glint: 0.06,
}

/** The hour follows shopClock() in src/ui/format.ts (opens 10:00, one minute per in-game second). */
const OPENING_HOUR = 10
const HOURS_PER_CLOCK_SECOND = 1 / 60

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform sampler2D noiseMap;
uniform float time;
uniform float motion;
uniform vec3 tint;
uniform vec3 eye;
uniform float waterY;
uniform vec2 offset;
uniform vec4 layerScale;
uniform vec4 layerDrift;
uniform float glint;
#ifdef USE_STREET
uniform sampler2D extraMap;
uniform vec3 lights;  // lamps and shop fronts, early windows, late windows
uniform vec4 weather; // wet, snow, ice, cloud drift (s)
uniform vec4 boat;    // x, z on the water, heading (+-1), strength
uniform float floodY; // M6 the Flood: the water's height (world y); below -50 = none
uniform vec2 depthCode; // the canal layer's depth code: z0, metres per code (255 = sky)
#endif
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec4 base = texture2D(map, vUv);
  vec3 col = base.rgb;
#ifdef USE_STREET
  vec4 ex = texture2D(extraMap, vUv);
  float sky = smoothstep(0.985, 0.998, ex.r);
  float ice = weather.z * base.a;
  float wet = base.a * motion * (1.0 - ice);
#else
  float wet = base.a * motion;
#endif
  if (wet > 0.004) {
    // Where the render's eye ray through this texel meets the water, in metres.
    vec3 d = vWorld - eye;
    vec2 p = eye.xz + d.xz * ((waterY - eye.y) / min(d.y, -1e-3));
    vec2 n1 = texture2D(noiseMap, p * layerScale.xy + time * layerDrift.xy).rg;
    vec2 n2 = texture2D(noiseMap, p * layerScale.zw + time * layerDrift.zw).rg;
    vec2 n = n1 + n2 - 1.0;
#ifdef USE_STREET
    // A passing boat: a V of stirred water trailing behind it, churn at the stern.
    vec2 bd = p - boat.xy;
    float along = -bd.x * boat.z;
    float across = abs(bd.y);
    float wake = step(0.0, along) * exp(-along / 16.0) * exp(-abs(across - 0.9 - along * 0.3) * 1.1);
    wake += exp(-length(bd * vec2(0.22, 0.8))) * 0.8;
    n *= 1.0 + boat.w * wake * 3.5;
#endif
    vec4 s = texture2D(map, vUv + n * offset);
    // Only take the shifted texel if it is water too, so railings and the far wall don't smear.
    col = mix(col, s.rgb, s.a * wet);
    // Glints where both layers crest, as bright as what the water reflects there (none under the bridge).
    float g = smoothstep(0.72, 0.98, n1.g * 0.5 + n2.g * 0.5 + n.r * 0.25);
    col += glint * g * wet * (0.2 + 2.0 * dot(col, vec3(0.2126, 0.7152, 0.0722)));
  }
#ifdef USE_STREET
  if (ice > 0.004) {
    // Frozen canal: grey-blue ice with a little grain, a ghost of the reflections left.
    float grain = texture2D(noiseMap, vUv * vec2(7.0, 26.0)).r;
    col = mix(col, vec3(0.66, 0.70, 0.73) * (0.86 + 0.2 * grain), ice * 0.82);
  }
  // M6 the Flood: the canal up its walls and over the street. The depth layer gives the surface each
  // texel shows; where that sits below the water's height, show brown water at that height instead.
  if (floodY > -50.0) {
    vec3 fd = vWorld - eye;
    float code = ex.r * 255.0;
    float zr = code > 254.5 ? 1e4 : depthCode.x + code * depthCode.y;
    float ys = eye.y + fd.y * ((zr - eye.z) / max(fd.z, 1e-3));
    float under = smoothstep(0.0, 0.025, floodY - ys) * (1.0 - sky);
    // a dark wet band on the walls just above the waterline, and a pale scum line at it
    float above = ys - floodY;
    col *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.25, above)) * step(0.0, above) * (1.0 - sky);
    if (under > 0.004) {
      vec2 fp = eye.xz + fd.xz * ((floodY - eye.y) / min(fd.y, -1e-3));
      vec2 f1 = texture2D(noiseMap, fp * layerScale.xy * 1.6 + time * layerDrift.xy * 0.6).rg;
      vec2 f2 = texture2D(noiseMap, fp * layerScale.zw * 1.6 + time * layerDrift.zw * 0.6).rg;
      vec2 fn = f1 + f2 - 1.0;
      vec3 skyc = texture2D(map, vec2(vUv.x + fn.x * 0.03, 0.96)).rgb;
      vec3 murk = vec3(0.29, 0.26, 0.19);
      float graze = clamp(1.0 - (-fd.y / length(fd)) * 4.0, 0.0, 1.0);
      vec3 water = mix(murk, skyc * 0.6, 0.12 + 0.3 * graze);
      // shallow at its edge: a ghost of the street under it
      float shallow = 1.0 - smoothstep(0.0, 0.2, floodY - ys);
      water = mix(water, col * 0.55 + murk * 0.35, shallow * 0.55);
      water *= 0.92 + 0.16 * fn.r * motion;
      float fg = smoothstep(0.74, 0.98, f1.g * 0.5 + f2.g * 0.5 + fn.r * 0.25);
      water += glint * fg * motion * 0.5 * (0.3 + dot(skyc, vec3(0.3)));
      water += vec3(0.10, 0.09, 0.07) * (1.0 - smoothstep(0.0, 0.02, floodY - ys));
      col = mix(col, water, under);
    }
  }
  // Clouds drifting through the render's own sky.
  vec2 cp = vec2(vUv.x * 2.4 + weather.w * 0.0036, vUv.y * 1.3);
  float cl = texture2D(noiseMap, cp).r * 0.62 + texture2D(noiseMap, cp * 2.7 + vec2(weather.w * 0.0023, 0.37)).g * 0.38;
  col *= 1.0 + sky * (cl - 0.5) * 0.24;
  // Rain: a darker, flatter street under a lower, greyer sky. Snow: muted and lighter.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, mix(vec3(l), col, 0.7) * 0.8, weather.x * (1.0 - sky));
  col = mix(col, vec3(l * 0.85 + 0.06), weather.x * sky * 0.7);
  col = mix(col, mix(vec3(l), col, 0.65) * 0.94 + 0.05, weather.y * (1.0 - sky) * 0.6);
  col = mix(col, vec3(0.80, 0.82, 0.84), weather.y * sky * 0.7);
  col *= tint;
  // Night: street lamps and shop fronts first, then the windows (art/street canal layers, sqrt-stored).
  vec3 lit = ex.gba * ex.gba;
  col += vec3(1.0, 0.70, 0.40) * lit.x * lights.x + vec3(1.0, 0.80, 0.55) * (lit.y * lights.y + lit.z * lights.z);
  gl_FragColor = vec4(col, 1.0);
#else
  gl_FragColor = vec4(col * tint, 1.0);
#endif
  #include <colorspace_fragment>
}
`

export class CanalBackdrop {
  readonly mesh: THREE.Mesh
  /** The plane the render is shown on, the eye it was made from, the water level. */
  readonly frame: { plane: BackdropManifest['plane']; eye: [number, number, number]; waterY: number }
  private readonly material: THREE.ShaderMaterial
  private readonly noise: THREE.DataTexture
  private readonly map: THREE.Texture
  private time = 0
  private motion = 1
  private reduceMotion = false
  private hour = OPENING_HOUR
  private street: BackdropStreet | null = null
  private readonly tint = new THREE.Vector3(1, 1, 1)
  private readonly tintTarget = new THREE.Vector3(1, 1, 1)
  private tintPrimed = false

  constructor(manifest: BackdropManifest, map: THREE.Texture) {
    const { plane, size, eye } = manifest
    this.frame = { plane, eye, waterY: manifest.waterY }
    this.map = map
    this.noise = rippleNoise()
    const l0 = WATER.layers[0]!
    const l1 = WATER.layers[1]!
    this.material = new THREE.ShaderMaterial({
      name: 'canal-backdrop',
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        map: { value: map },
        noiseMap: { value: this.noise },
        time: { value: 0 },
        motion: { value: 1 },
        tint: { value: this.tint },
        eye: { value: new THREE.Vector3(...eye) },
        waterY: { value: manifest.waterY },
        offset: { value: new THREE.Vector2(WATER.offset[0] / size[0], WATER.offset[1] / size[1]) },
        layerScale: { value: new THREE.Vector4(l0.scale[0], l0.scale[1], l1.scale[0], l1.scale[1]) },
        layerDrift: { value: new THREE.Vector4(l0.drift[0], l0.drift[1], l1.drift[0], l1.drift[1]) },
        glint: { value: WATER.glint },
      },
      toneMapped: false,
    })
    const w = plane.x1 - plane.x0
    const h = plane.y1 - plane.y0
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.material)
    this.mesh.name = 'canal-backdrop'
    this.mesh.position.set((plane.x0 + plane.x1) / 2, (plane.y0 + plane.y1) / 2, plane.z)
    // Face the shop. The render's left edge (u = 0) is the +x side, as the player sees it.
    this.mesh.rotation.y = Math.PI
    this.mesh.updateMatrix()
    this.mesh.matrixAutoUpdate = false
  }

  /** The render itself (sRGB colour, alpha = water mask), for layers drawn over it. */
  get texture(): THREE.Texture {
    return this.map
  }

  /** Shop clock (in-game seconds since opening) and the reduce-motion setting. */
  setState(clockSeconds: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion
    this.hour = OPENING_HOUR + clockSeconds * HOURS_PER_CLOCK_SECOND
    this.retint()
  }

  /** The street layer's canal data texture (art/street canal_extra.png): turns on clouds, weather, night lights and the wake. */
  attachStreet(extra: THREE.Texture, depth: { z0: number; step: number }): void {
    const u = this.material.uniforms
    u.extraMap = { value: extra }
    u.floodY = { value: -99 }
    u.depthCode = { value: new THREE.Vector2(depth.z0, depth.step) }
    u.lights = { value: new THREE.Vector3() }
    u.weather = { value: new THREE.Vector4() }
    u.boat = { value: new THREE.Vector4(0, 0, 1, 0) }
    this.material.defines = { ...this.material.defines, USE_STREET: '' }
    this.material.needsUpdate = true
  }

  /** The street's light and weather; null goes back to the plain clock tint. */
  setStreet(street: BackdropStreet | null): void {
    this.street = street
    this.retint()
    const u = this.material.uniforms
    if (!street || !u.lights) return
    const d = street.dark
    ;(u.lights.value as THREE.Vector3).set(ramp(0.12, 0.32, d), ramp(0.3, 0.62, d), ramp(0.55, 0.92, d))
    const w = u.weather!.value as THREE.Vector4
    w.set(street.wet, street.snow, street.ice, w.w)
    ;(u.boat!.value as THREE.Vector4).fromArray(street.boat)
    u.floodY!.value = street.floodY ?? -99
  }

  update(dt: number): void {
    const u = this.material.uniforms
    if (this.reduceMotion) {
      this.motion = 0
      this.tint.copy(this.tintTarget)
    } else {
      this.motion = Math.min(1, this.motion + dt)
      this.time += dt
      this.tint.lerp(this.tintTarget, Math.min(1, dt * 0.5))
      if (u.weather) (u.weather.value as THREE.Vector4).w += dt
    }
    u.motion!.value = this.motion
    u.time!.value = this.time
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.map.dispose()
    this.noise.dispose()
  }

  private retint(): void {
    const t = this.street ? this.street.tint : outdoorLight(this.hour, null).tint
    this.tintTarget.set(t[0], t[1], t[2])
    if (!this.tintPrimed) {
      this.tint.copy(this.tintTarget)
      this.tintPrimed = true
    }
  }
}

function ramp(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export async function loadCanalBackdrop(renderer: THREE.WebGLRenderer, base: string): Promise<CanalBackdrop> {
  const dir = `${base}assets/backdrop/`
  const res = await fetch(`${dir}canal.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`no canal backdrop (${res.status})`)
  const manifest = (await res.json()) as BackdropManifest
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}assets/decoders/basis/`).detectSupport(renderer)
  try {
    const map = await ktx2.loadAsync(`${dir}${manifest.file}?v=${manifest.inputHash}`)
    map.colorSpace = THREE.SRGBColorSpace
    map.flipY = false // rows were flipped when packing
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping
    return new CanalBackdrop(manifest, map)
  } finally {
    ktx2.dispose()
  }
}

/** 64×64 tiling two-channel value noise (bicubic over a 16×16 seeded lattice), linear data. */
function rippleNoise(): THREE.DataTexture {
  const N = 64
  const L = 16
  const rng = new Rng(9137)
  const lattice = [new Float32Array(L * L), new Float32Array(L * L)]
  for (const ch of lattice) for (let i = 0; i < ch.length; i++) ch[i] = rng.next()
  const data = new Uint8Array(N * N * 4)
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * L
      const fy = (y / N) * L
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      for (let c = 0; c < 2; c++) {
        const g = lattice[c]!
        const at = (i: number, j: number) => g[((j + L) % L) * L + ((i + L) % L)]!
        const rows = [-1, 0, 1, 2].map((j) => cubic(at(ix - 1, iy + j), at(ix, iy + j), at(ix + 1, iy + j), at(ix + 2, iy + j), fx - ix))
        const v = cubic(rows[0]!, rows[1]!, rows[2]!, rows[3]!, fy - iy)
        data[(y * N + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(v * 255)))
      }
      data[(y * N + x) * 4 + 3] = 255
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}
