/**
 * Sprites outside the window: one instanced draw per sprite sheet.
 *
 * Every sprite is a quad standing at its true place in the street (three.js
 * metres), facing the shop. Anything beyond the canal render's plane (the far
 * bank, the canal, the sky) is slid along the ray from the render's eye to
 * just in front of the plane, so it looks the same from the counter and the
 * camera's far plane (40 m) never clips it. The render's depth layer (art/street
 * canal_extra.png, red) then hides each fragment wherever the render has
 * something nearer: railings, lamp posts, the bridge, the moored boat.
 * The shop's own window frames hide the near ones through the depth buffer.
 *
 * A reflection instance draws its sprite upside down below its base, only
 * where the render shows water, faint: the boat in the canal.
 */
import * as THREE from 'three'

export interface SpriteFrame {
  /** Atlas rect in texels, top-down rows as authored (x, y, w, h). */
  x: number
  y: number
  w: number
  h: number
}

export interface SpriteInstance {
  /** Bottom centre of the sprite in the street (feet, wheels, waterline). */
  x: number
  y: number
  z: number
  /** Size of the sprite cell in metres. */
  width: number
  height: number
  frame: SpriteFrame
  /** True draws the sheet as made (facing +x); false mirrors it (facing -x). */
  facingPlusX: boolean
  alpha: number
  /** Brightness multiplier (e.g. a pigeon in the shade). */
  shade: number
  reflection?: boolean
}

export interface SpriteFrameInfo {
  eye: [number, number, number]
  plane: { z: number; x0: number; x1: number; y0: number; y1: number }
  depth: { z0: number; step: number }
}

const VERTEX = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iRect;
attribute vec4 iMisc; // facing (+-1), alpha, reflection (0/1), shade
uniform vec3 eye;
uniform float nearZ;
varying vec2 vUv;
varying vec3 vTrue;
varying float vAlpha;
varying float vRefl;
varying float vShade;
void main() {
  float refl = iMisc.z;
  vec3 p = iPos + vec3(position.x * iSize.x, position.y * iSize.y * (refl > 0.5 ? -1.0 : 1.0), 0.0);
  vTrue = p;
  // The sheet is drawn facing +x: image left is the +x end of the quad.
  float s = iMisc.x > 0.0 ? 0.5 - position.x : 0.5 + position.x;
  vUv = vec2(mix(iRect.x, iRect.z, s), mix(iRect.y, iRect.w, position.y));
  vAlpha = iMisc.y;
  vRefl = refl;
  vShade = iMisc.w;
  float k = p.z > nearZ ? (nearZ - eye.z) / (p.z - eye.z) : 1.0;
  vec3 q = eye + (p - eye) * k;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform sampler2D atlas;
uniform sampler2D extraMap;
uniform sampler2D canalMap;
uniform vec3 eye;
uniform vec4 plane;  // x0, x1, y0, y1
uniform float planeZ;
uniform vec2 depth;  // z0, step per code
uniform vec3 tint;
uniform float wet;
varying vec2 vUv;
varying vec3 vTrue;
varying float vAlpha;
varying float vRefl;
varying float vShade;
void main() {
  vec4 c = texture2D(atlas, vUv);
  float a = c.a * vAlpha;
  if (a < 0.004) discard;
  // Where this point sits in the canal render (the ray from the render's eye through it).
  vec2 pp = eye.xy + (vTrue.xy - eye.xy) * ((planeZ - eye.z) / (vTrue.z - eye.z));
  vec2 buv = vec2((plane.y - pp.x) / (plane.y - plane.x), (pp.y - plane.z) / (plane.w - plane.z));
  float inside = step(0.0, buv.x) * step(buv.x, 1.0) * step(0.0, buv.y) * step(buv.y, 1.0);
  float vis;
  if (vRefl > 0.5) {
    // a reflection shows only on the water, dimmed
    vis = texture2D(canalMap, buv).a * 0.32 * inside;
  } else {
    float code = texture2D(extraMap, buv).r * 255.0;
    float zr = code > 254.5 ? 1e4 : depth.x + code * depth.y;
    vis = mix(1.0, smoothstep(-0.5, 0.15, zr - vTrue.z), inside);
  }
  a *= vis;
  if (a < 0.004) discard;
  vec3 col = c.rgb * vShade;
  // the canal render's haze over distance (art/backdrop/build.py develop)
  float m = clamp((distance(vTrue, eye) - 12.0) / 260.0, 0.0, 1.0);
  float hz = 0.4 * (0.35 * m + 0.65 * m * m * m);
  col = mix(col, vec3(0.80, 0.82, 0.84), hz);
  col = mix(col, col * 0.82, wet);
  gl_FragColor = vec4(col * tint * (vRefl > 0.5 ? 0.8 : 1.0), a);
  #include <colorspace_fragment>
}
`

export class SpriteLayer {
  readonly mesh: THREE.Mesh
  private readonly geometry: THREE.InstancedBufferGeometry
  private readonly material: THREE.ShaderMaterial
  private readonly pos: THREE.InstancedBufferAttribute
  private readonly size: THREE.InstancedBufferAttribute
  private readonly rect: THREE.InstancedBufferAttribute
  private readonly misc: THREE.InstancedBufferAttribute
  private readonly atlasSize: [number, number]
  private readonly eye: THREE.Vector3
  private readonly order: number[] = []

  constructor(
    name: string,
    readonly capacity: number,
    atlas: THREE.Texture,
    atlasSize: [number, number],
    extra: THREE.Texture,
    canal: THREE.Texture,
    info: SpriteFrameInfo,
  ) {
    this.atlasSize = atlasSize
    const quad = new THREE.PlaneGeometry(1, 1)
    quad.translate(0, 0.5, 0)
    this.geometry = new THREE.InstancedBufferGeometry()
    this.geometry.index = quad.index
    this.geometry.setAttribute('position', quad.getAttribute('position'))
    const attr = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(THREE.DynamicDrawUsage)
    this.pos = attr(3)
    this.size = attr(2)
    this.rect = attr(4)
    this.misc = attr(4)
    this.geometry.setAttribute('iPos', this.pos)
    this.geometry.setAttribute('iSize', this.size)
    this.geometry.setAttribute('iRect', this.rect)
    this.geometry.setAttribute('iMisc', this.misc)
    this.geometry.instanceCount = 0
    this.eye = new THREE.Vector3(...info.eye)
    const p = info.plane
    this.material = new THREE.ShaderMaterial({
      name,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        atlas: { value: atlas },
        extraMap: { value: extra },
        canalMap: { value: canal },
        eye: { value: this.eye },
        nearZ: { value: p.z - 0.06 },
        plane: { value: new THREE.Vector4(p.x0, p.x1, p.y0, p.y1) },
        planeZ: { value: p.z },
        depth: { value: new THREE.Vector2(info.depth.z0, info.depth.step) },
        tint: { value: new THREE.Vector3(1, 1, 1) },
        wet: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      // the quads face +z, away from the shop; reflections flip the winding too
      side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.name = name
    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    // Transparent, but before the shop's own glass and anything else see-through.
    this.mesh.renderOrder = -3
  }

  setLook(tint: readonly number[], wet: number): void {
    ;(this.material.uniforms.tint!.value as THREE.Vector3).set(tint[0]!, tint[1]!, tint[2]!)
    this.material.uniforms.wet!.value = wet
  }

  setAtlas(atlas: THREE.Texture): void {
    this.material.uniforms.atlas!.value = atlas
  }

  /** Draw these sprites this frame, far to near. */
  set(list: readonly SpriteInstance[]): void {
    const n = Math.min(list.length, this.capacity)
    const eye = this.eye
    this.order.length = 0
    for (let i = 0; i < list.length; i++) this.order.push(i)
    const d = (s: SpriteInstance) => (s.x - eye.x) ** 2 + (s.z - eye.z) ** 2
    this.order.sort((a, b) => d(list[b]!) - d(list[a]!))
    const [W, H] = this.atlasSize
    for (let k = 0; k < n; k++) {
      const s = list[this.order[k]!]!
      const f = s.frame
      this.pos.setXYZ(k, s.x, s.y, s.z)
      this.size.setXY(k, s.width, s.height)
      // atlas rows are flipped on packing: v = 0 is the bottom row
      this.rect.setXYZW(k, f.x / W, 1 - (f.y + f.h) / H, (f.x + f.w) / W, 1 - f.y / H)
      this.misc.setXYZW(k, s.facingPlusX ? 1 : -1, s.alpha, s.reflection ? 1 : 0, s.shade)
    }
    for (const a of [this.pos, this.size, this.rect, this.misc]) a.needsUpdate = true
    this.geometry.instanceCount = n
    this.mesh.visible = n > 0
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
