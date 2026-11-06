/**
 * Weather on the street window and the door glass: one draw over both
 * openings, just outside the glass. Procedural, no textures of its own.
 *
 * Rain: streaks falling outside at three apparent depths, beads of water on
 * the glass that refract the canal render upside down (a lens), and now and
 * then a drop running down. Snow: flakes drifting down at three depths.
 *
 * Reduce motion freezes it: the drops stay, streaks go, flakes hang still.
 * Low quality draws two layers instead of three.
 */
import * as THREE from 'three'

/** Openings in the street wall (bake/layout.json): window, door glass. x0, x1, y0, y1. */
const OPENINGS: [number, number, number, number][] = [
  [-2.5, 0.5, 0.85, 3.25],
  [1.25, 2.15, 0.9, 2.05],
]
/** Just outside the street wall's outer face (z 4.1). */
const GLASS_Z = 4.12

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAGMENT = /* glsl */ `
uniform float time;
uniform float rain;
uniform float snow;
uniform float motion;
uniform float layers;
uniform sampler2D canalMap;
uniform vec3 eye;
uniform vec4 plane;
uniform float planeZ;
uniform vec3 tint;
varying vec3 vWorld;

float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec2 canalUv(vec3 p) {
  vec2 pp = eye.xy + (p.xy - eye.xy) * ((planeZ - eye.z) / (p.z - eye.z));
  return vec2((plane.y - pp.x) / (plane.y - plane.x), (pp.y - plane.z) / (plane.w - plane.z));
}

// Rain streaks in columns 'cell' metres wide, falling 'speed' m/s (as seen on the glass).
float streaks(vec2 p, float cell, float speed, float len, float density, float seed) {
  p.x += p.y * 0.1;
  float c = floor(p.x / cell);
  float on = step(h1(c + seed), density);
  float fx = fract(p.x / cell) - 0.25 - 0.5 * h1(c * 1.7 + seed);
  float period = 2.2;
  float fy = fract((p.y + time * speed * (0.85 + 0.3 * h1(c + 3.1 + seed))) / period + h1(c * 3.3 + seed));
  float lf = len / period;
  float body = step(fy, lf) * (1.0 - fy / lf);
  float w = smoothstep(0.08, 0.0, abs(fx));
  return on * body * w;
}

// Snow flakes: one per cell at a seeded spot, drifting down with a sway.
float flakes(vec2 p, float cell, float speed, float r, float seed) {
  float c = floor(p.x / cell);
  p.y += time * speed * (0.8 + 0.4 * h1(c + seed)) + h1(c * 2.1 + seed) * 7.0;
  vec2 id = floor(p / cell);
  vec2 f = fract(p / cell);
  vec2 at = vec2(0.3 + 0.4 * h2(id + seed), 0.3 + 0.4 * h2(id + seed + 9.1));
  at.x += 0.18 * sin(time * (0.6 + h2(id) * 0.8) + h2(id + 4.0) * 6.28);
  float on = step(h2(id + seed + 2.7), 0.55);
  float d = length((f - at) * cell);
  return on * smoothstep(r, r * 0.25, d);
}

void main() {
  vec2 p = vWorld.xy;
  vec3 col = vec3(0.0);
  float a = 0.0;
  if (rain > 0.0) {
    // falling rain outside, far to near
    // (a CSS pixel on a phone covers about 12 mm of this glass, so nothing here is thinner than that)
    float s = streaks(p, 0.07, 7.0, 0.45, 0.4 * rain, 1.0) * 0.16;
    s += streaks(p, 0.13, 9.0, 0.7, 0.34 * rain, 7.0) * 0.2;
    if (layers > 2.5) s += streaks(p, 0.24, 12.0, 1.1, 0.28 * rain, 13.0) * 0.24;
    s *= motion;
    col += vec3(0.82, 0.85, 0.88) * s;
    a += s;
    // a faint wet veil on the glass
    a += 0.08 * rain;
    col += vec3(0.6, 0.63, 0.66) * 0.08 * rain;
    // beads on the glass: tiny lenses showing the street upside down
    vec2 buv = canalUv(vWorld);
    for (int i = 0; i < 2; i++) {
      float cell = i == 0 ? 0.11 : 0.2;
      vec2 q = p;
      vec2 id = floor(q / cell);
      vec2 f = fract(q / cell) - 0.5;
      float r = (i == 0 ? 0.009 : 0.014) + (i == 0 ? 0.007 : 0.012) * h2(id + 5.3);
      vec2 at = (vec2(h2(id), h2(id + 1.7)) - 0.5) * 0.6;
      vec2 d = (f - at) * cell;
      d.y *= 1.0 - 0.25 * step(0.0, -d.y); // a little heavier at the bottom
      float on = step(h2(id + 3.9), (i == 0 ? 0.55 : 0.35) * rain);
      float m = on * smoothstep(r, r * 0.7, length(d));
      if (m > 0.0) {
        vec3 lens = texture2D(canalMap, buv - d * 0.9).rgb * tint;
        float rim = smoothstep(r * 0.45, r, length(d));
        lens = mix(lens, lens * 0.55, rim) + vec3(0.25) * smoothstep(r * 0.45, 0.0, length(d - vec2(-0.3, 0.35) * r));
        col = mix(col, lens, m);
        a = mix(a, 0.92, m);
      }
    }
    // now and then a drop runs down, leaving a wet trail
    float rc = 0.3;
    float cid = floor(p.x / rc);
    float on = step(h1(cid + 11.0), 0.45 * rain);
    float fx = (fract(p.x / rc) - 0.5 - (h1(cid + 2.0) - 0.5) * 0.6) * rc;
    float period = 9.0 + 6.0 * h1(cid);
    float head = 3.4 - fract((time * motion + h1(cid + 5.0) * period) / period) * period * 0.6;
    float above = p.y - head;
    float trail = on * step(0.0, above) * smoothstep(0.007, 0.0, abs(fx)) * exp(-above * 1.5) * 0.3;
    float bead = on * smoothstep(0.016, 0.01, length(vec2(fx, above * 0.8)));
    col = mix(col, vec3(0.75, 0.78, 0.8) * tint, max(trail, bead * 0.8));
    a = max(a, max(trail, bead * 0.8));
  }
  if (snow > 0.0) {
    float f = flakes(p, 0.1, 0.35, 0.008, 1.0) * 0.6;
    f += flakes(p, 0.18, 0.55, 0.013, 4.0) * 0.8;
    if (layers > 2.5) f += flakes(p, 0.34, 0.85, 0.022, 9.0) * 0.9;
    f *= snow * (0.35 + 0.65 * motion);
    col += vec3(0.93, 0.94, 0.96) * f;
    a += f;
  }
  a = clamp(a, 0.0, 1.0);
  if (a < 0.003) discard;
  // colours above are premultiplied by coverage
  gl_FragColor = vec4(col * mix(vec3(1.0), tint, 0.6) / max(a, 1e-3), a);
  #include <colorspace_fragment>
}
`

export class WeatherGlass {
  readonly mesh: THREE.Mesh
  private readonly material: THREE.ShaderMaterial
  private time = 0

  constructor(canal: THREE.Texture, info: { eye: [number, number, number]; plane: { z: number; x0: number; x1: number; y0: number; y1: number } }) {
    const pos: number[] = []
    const idx: number[] = []
    for (const [x0, x1, y0, y1] of OPENINGS) {
      const b = pos.length / 3
      // facing the shop (-z)
      pos.push(x1, y0, GLASS_Z, x0, y0, GLASS_Z, x0, y1, GLASS_Z, x1, y1, GLASS_Z)
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    const p = info.plane
    this.material = new THREE.ShaderMaterial({
      name: 'street-weather',
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        time: { value: 0 },
        rain: { value: 0 },
        snow: { value: 0 },
        motion: { value: 1 },
        layers: { value: 3 },
        canalMap: { value: canal },
        eye: { value: new THREE.Vector3(...info.eye) },
        plane: { value: new THREE.Vector4(p.x0, p.x1, p.y0, p.y1) },
        planeZ: { value: p.z },
        tint: { value: new THREE.Vector3(1, 1, 1) },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(g, this.material)
    this.mesh.name = 'street-weather'
    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    this.mesh.renderOrder = -2
    this.mesh.visible = false
  }

  set(rain: number, snow: number, tint: readonly number[], reduceMotion: boolean, layers: number): void {
    const u = this.material.uniforms
    u.rain!.value = rain
    u.snow!.value = snow
    u.motion!.value = reduceMotion ? 0 : 1
    u.layers!.value = layers
    ;(u.tint!.value as THREE.Vector3).set(tint[0]!, tint[1]!, tint[2]!)
    this.mesh.visible = rain > 0 || snow > 0
  }

  update(dt: number, reduceMotion: boolean): void {
    if (!reduceMotion) this.time += dt
    this.material.uniforms.time!.value = this.time
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
