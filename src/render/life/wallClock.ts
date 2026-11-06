/**
 * The wall clock over the street door shows the shop's time. The clock in the
 * bake (Poly Haven's wall_clock prop, bake/layout.json `wall_clock`) has its
 * hands frozen in the mesh, and its big flat face bakes almost black (per-vertex
 * lighting only sees the rim). So a new dial sits inside the prop's bezel, in
 * front of the old hands: one disc, one draw call. The dial is a small canvas
 * texture; the hands are drawn in the fragment shader as anti-aliased
 * segments with a faint drop shadow, so they stay crisp at any distance.
 *
 * Lit flat (like the baked room): the two real-time lights don't reach it.
 */
import * as THREE from 'three'
import { handAngles } from './timeOfDay'

/** The prop's dial centre and the disc that covers it (bake/props/wall_clock.glb, measured). */
export const WALL_CLOCK = {
  /** Prop origin (bottom centre) + half its height; it faces −z (rotated 180°). */
  center: new THREE.Vector3(1.7, 2.7 + 0.1605, 3.92),
  /** In front of the frozen hands (≤ 7.5 mm proud of the prop origin), behind the bezel lip (11.8 mm). */
  depth: 0.0088,
  /** Inside the bezel (inner edge ≈ 0.14 m). */
  radius: 0.139,
  /** Matches the plaster around it in the baked light (by eye against the lightmap). */
  light: new THREE.Color(0.56, 0.51, 0.44),
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec3 light;
uniform vec3 angles;
uniform float showSecond;
varying vec2 vUv;

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec2 dir(float a) { return vec2(sin(a), cos(a)); }
float cover(float d, float halfWidth, float aa) { return 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, d); }

float hands(vec2 p, float aa) {
  float h = cover(segment(p, -0.12 * dir(angles.x), 0.5 * dir(angles.x)), 0.042, aa);
  float m = cover(segment(p, -0.14 * dir(angles.y), 0.78 * dir(angles.y)), 0.028, aa);
  return max(h, m);
}

void main() {
  vec3 c = texture2D(map, vUv).rgb;
  vec2 p = (vUv - 0.5) * 2.0;
  float aa = max(fwidth(p.x), 0.004);
  // Drop shadow: the hands stand a few millimetres off the dial, lit from above.
  float shadow = hands(p + vec2(-0.015, 0.03), aa * 3.0);
  c *= 1.0 - 0.35 * shadow;
  c = mix(c, vec3(0.06, 0.06, 0.065), hands(p, aa));
  float s = cover(segment(p, -0.2 * dir(angles.z), 0.86 * dir(angles.z)), 0.011, aa) * showSecond;
  c = mix(c, vec3(0.62, 0.08, 0.05), s);
  c = mix(c, vec3(0.08), cover(length(p), 0.045, aa));
  gl_FragColor = vec4(c * light, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class WallClock {
  readonly mesh: THREE.Mesh
  private readonly material: THREE.ShaderMaterial
  private readonly map: THREE.CanvasTexture
  private realSeconds = 0
  private minuteShown: number | null = null
  private hourShown = 0

  constructor() {
    this.map = dialTexture()
    this.material = new THREE.ShaderMaterial({
      name: 'life-clock',
      uniforms: {
        map: { value: this.map },
        light: { value: WALL_CLOCK.light.clone() },
        angles: { value: new THREE.Vector3() },
        showSecond: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    })
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(WALL_CLOCK.radius, 48), this.material)
    this.mesh.name = 'life-clock'
    this.mesh.position.copy(WALL_CLOCK.center).add(new THREE.Vector3(0, 0, -WALL_CLOCK.depth))
    // Face the room (−z); u then runs to the viewer's right, so the dial isn't mirrored.
    this.mesh.rotation.y = Math.PI
    this.mesh.updateMatrix()
    this.mesh.matrixAutoUpdate = false
  }

  /**
   * Hour and minute show `clockSeconds` (eased over a quarter second when the
   * minute steps, unless reduce motion); the second hand ticks with real time
   * and is hidden under reduce motion.
   */
  update(dt: number, clockSeconds: number, reduceMotion: boolean): void {
    this.realSeconds += dt
    const a = handAngles(clockSeconds, this.realSeconds)
    if (this.minuteShown === null || reduceMotion) {
      this.minuteShown = a.minute
      this.hourShown = a.hour
    } else {
      // Ease along the short way round (the minute hand wraps at 12).
      this.minuteShown = ease(this.minuteShown, a.minute, dt)
      this.hourShown = ease(this.hourShown, a.hour, dt)
    }
    const u = this.material.uniforms
    ;(u.angles!.value as THREE.Vector3).set(this.hourShown, this.minuteShown, a.second)
    u.showSecond!.value = reduceMotion ? 0 : 1
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.map.dispose()
  }
}

function ease(from: number, to: number, dt: number): number {
  let d = to - from
  d = Math.atan2(Math.sin(d), Math.cos(d))
  if (Math.abs(d) > 1) return to // a jump (new day, ?time): don't sweep round
  return from + d * Math.min(1, dt * 14)
}

/** 256 px dial: warm off-white face, minute and hour marks, Arabic numerals. No maker's name. */
function dialTexture(): THREE.CanvasTexture {
  const N = 256
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')!
  const r = N / 2
  const g = ctx.createRadialGradient(r, r * 0.9, r * 0.1, r, r, r)
  g.addColorStop(0, '#f4f0e6')
  g.addColorStop(0.85, '#e9e3d5')
  g.addColorStop(1, '#cfc7b6')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  ctx.translate(r, r)
  ctx.fillStyle = '#2a2a2a'
  for (let i = 0; i < 60; i++) {
    const hourMark = i % 5 === 0
    ctx.save()
    ctx.rotate((i / 60) * Math.PI * 2)
    if (hourMark) ctx.fillRect(-3, -r * 0.94, 6, r * 0.12)
    else ctx.fillRect(-1, -r * 0.94, 2, r * 0.05)
    ctx.restore()
  }
  ctx.font = `600 ${Math.round(r * 0.2)}px "Space Grotesk", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * Math.PI * 2
    ctx.fillText(String(h), Math.sin(a) * r * 0.66, -Math.cos(a) * r * 0.66)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
