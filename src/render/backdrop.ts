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
 * Presentation only: nothing here touches game state.
 */
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { Rng } from '../game/rng'

export interface BackdropManifest {
  version: number
  eye: [number, number, number]
  plane: { z: number; x0: number; x1: number; y0: number; y1: number }
  size: [number, number]
  waterY: number
  file: string
  inputHash: string
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

/**
 * Daylight over the shop's day: [shop-clock hour, r, g, b] multipliers on the render.
 * Overcast March in a northern city: a cool morning, neutral midday, a warmer
 * afternoon, then the light drains towards the blue hour after 18:00.
 * The hour follows shopClock() in src/ui/format.ts (opens 10:00, one minute per in-game second).
 */
const DAYLIGHT: [number, number, number, number][] = [
  [10, 0.94, 0.96, 1.0],
  [12.5, 1.0, 1.0, 1.0],
  [15.5, 1.0, 0.97, 0.92],
  [17.5, 0.9, 0.84, 0.8],
  [18.5, 0.66, 0.66, 0.76],
  [19.5, 0.42, 0.45, 0.58],
]
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
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  vec4 base = texture2D(map, vUv);
  vec3 col = base.rgb;
  float wet = base.a * motion;
  if (wet > 0.004) {
    // Where the render's eye ray through this texel meets the water, in metres.
    vec3 d = vWorld - eye;
    vec2 p = eye.xz + d.xz * ((waterY - eye.y) / min(d.y, -1e-3));
    vec2 n1 = texture2D(noiseMap, p * layerScale.xy + time * layerDrift.xy).rg;
    vec2 n2 = texture2D(noiseMap, p * layerScale.zw + time * layerDrift.zw).rg;
    vec2 n = n1 + n2 - 1.0;
    vec4 s = texture2D(map, vUv + n * offset);
    // Only take the shifted texel if it is water too, so railings and the far wall don't smear.
    col = mix(col, s.rgb, s.a * wet);
    // Glints where both layers crest, as bright as what the water reflects there (none under the bridge).
    float g = smoothstep(0.72, 0.98, n1.g * 0.5 + n2.g * 0.5 + n.r * 0.25);
    col += glint * g * wet * (0.2 + 2.0 * dot(col, vec3(0.2126, 0.7152, 0.0722)));
  }
  gl_FragColor = vec4(col * tint, 1.0);
  #include <colorspace_fragment>
}
`

export class CanalBackdrop {
  readonly mesh: THREE.Mesh
  private readonly material: THREE.ShaderMaterial
  private readonly noise: THREE.DataTexture
  private readonly map: THREE.Texture
  private time = 0
  private motion = 1
  private reduceMotion = false
  private readonly tint = new THREE.Vector3(1, 1, 1)
  private readonly tintTarget = new THREE.Vector3(1, 1, 1)
  private tintPrimed = false

  constructor(manifest: BackdropManifest, map: THREE.Texture) {
    const { plane, size, eye } = manifest
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

  /** Shop clock (in-game seconds since opening) and the reduce-motion setting. */
  setState(clockSeconds: number, reduceMotion: boolean): void {
    this.reduceMotion = reduceMotion
    daylight(OPENING_HOUR + clockSeconds * HOURS_PER_CLOCK_SECOND, this.tintTarget)
    if (!this.tintPrimed) {
      this.tint.copy(this.tintTarget)
      this.tintPrimed = true
    }
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

function daylight(hour: number, out: THREE.Vector3): void {
  const k = DAYLIGHT
  const first = k[0]!
  const last = k[k.length - 1]!
  if (hour <= first[0]) return void out.set(first[1], first[2], first[3])
  if (hour >= last[0]) return void out.set(last[1], last[2], last[3])
  for (let i = 1; i < k.length; i++) {
    const b = k[i]!
    if (hour <= b[0]) {
      const a = k[i - 1]!
      const t = (hour - a[0]) / (b[0] - a[0])
      out.set(a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t)
      return
    }
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
