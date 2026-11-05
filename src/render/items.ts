/**
 * Procedural placeholder item models (M1), one builder per `model.placeholder`.
 *
 * Coordinate convention (the item data places hotspots by it):
 * - real size in metres, centred at the origin, +Y up, front faces +Z
 * - ring: band in the XY plane (hole axis Z), outer radius ≈ 0.010
 * - signet: ring with a flat engraved face on top at +Y
 * - chain: loose loop ≈ 0.05 across in XY, clasp at −Y
 * - earrings: a pair side by side along X (centres at x = ±0.009), ≈ 0.03 tall
 * - watch: round case r = 0.019, dial faces +Z, caseback −Z, strap along ±Y, crown +X
 * - phone: 0.06 × 0.125 × 0.008 box, screen +Z, back −Z (logo + camera), bottom edge −Y (port, screws)
 *
 * `model.scale` multiplies the whole model (kept for parity with glb models).
 * Models are cached by defId; ItemModels.evict disposes geometries, materials and textures.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { ItemDef } from '../game/schema/item'

export type PlaceholderKind = ItemDef['model']['placeholder']

export interface ModelSpec {
  placeholder: PlaceholderKind
  color: string
  scale?: number
  /** Printed on dials/backs where it fits (watch dial, phone back). */
  brand?: string
  /** The def's hotspots: the watch sizes its case to meet the crown and caseback markers. */
  hotspots?: readonly { id: string; position: readonly [number, number, number] }[]
}

/** Builds placeholder meshes into a group. Every material/texture is owned by the group. */
export function buildPlaceholder(spec: ModelSpec): THREE.Group {
  const g = new THREE.Group()
  g.name = `placeholder:${spec.placeholder}`
  const color = new THREE.Color(spec.color)
  switch (spec.placeholder) {
    case 'ring':
      buildRing(g, color)
      break
    case 'signet':
      buildSignet(g, color)
      break
    case 'chain':
      buildChain(g, color)
      break
    case 'earrings':
      buildEarrings(g, color)
      break
    case 'watch':
      buildWatch(g, color, spec.brand, spec.hotspots)
      break
    case 'phone':
      buildPhone(g, color, spec.brand, spec.hotspots)
      break
  }
  const s = spec.scale ?? 1
  g.scale.setScalar(s)
  return g
}

/** Free every GPU resource under `root`. */
export function disposeObject(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) textures.add(v)
      m.dispose()
    }
    if ((mesh as unknown as THREE.InstancedMesh).isInstancedMesh) (mesh as unknown as THREE.InstancedMesh).dispose()
  })
  for (const t of textures) t.dispose()
}

/**
 * Cache of built models keyed by defId. Keeps the most recent few so going
 * back and forth between counter and inspect never rebuilds; older models are
 * disposed (docs/02-ARCHITECTURE.md § Rendering: dispose after > 2 scene changes).
 */
export class ItemModels {
  private cache = new Map<string, THREE.Group>()

  constructor(private readonly keep = 3) {}

  get(defId: string, spec: ModelSpec): THREE.Group {
    let model = this.cache.get(defId)
    if (model) {
      // refresh LRU order
      this.cache.delete(defId)
      this.cache.set(defId, model)
      return model
    }
    model = buildPlaceholder(spec)
    this.cache.set(defId, model)
    this.evict()
    return model
  }

  private evict(): void {
    while (this.cache.size > this.keep) {
      const [oldest, model] = this.cache.entries().next().value as [string, THREE.Group]
      model.removeFromParent()
      disposeObject(model)
      this.cache.delete(oldest)
    }
  }

  dispose(): void {
    for (const m of this.cache.values()) {
      m.removeFromParent()
      disposeObject(m)
    }
    this.cache.clear()
  }
}

// --- materials ------------------------------------------------------------------

function metal(color: THREE.Color, roughness = 0.26): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness })
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) draw(ctx)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** A cheap deterministic hash → [0,1) so placeholder jitter is stable across loads. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// --- ring / signet -------------------------------------------------------------------

/** Lathe a comfort-fit band profile around Y, then turn it so the hole axis is Z. */
function bandGeometry(inner: number, outer: number, width: number, segments = 48): THREE.BufferGeometry {
  const hw = width / 2
  const r = Math.min((outer - inner) * 0.45, hw * 0.45)
  const pts: THREE.Vector2[] = []
  // inner face (slightly domed for comfort fit)
  pts.push(new THREE.Vector2(inner + r * 0.4, -hw))
  pts.push(new THREE.Vector2(inner, -hw * 0.5))
  pts.push(new THREE.Vector2(inner - (outer - inner) * 0.05, 0))
  pts.push(new THREE.Vector2(inner, hw * 0.5))
  pts.push(new THREE.Vector2(inner + r * 0.4, hw))
  // rounded outer shoulders
  for (let i = 0; i <= 4; i++) {
    const a = Math.PI / 2 - (i / 4) * (Math.PI / 2)
    pts.push(new THREE.Vector2(outer - r + Math.cos(a) * r, hw - r + Math.sin(a) * r))
  }
  for (let i = 0; i <= 4; i++) {
    const a = -(i / 4) * (Math.PI / 2)
    pts.push(new THREE.Vector2(outer - r + Math.cos(a) * r, -hw + r + Math.sin(a) * r))
  }
  pts.push(new THREE.Vector2(inner + r * 0.4, -hw))
  const geo = new THREE.LatheGeometry(pts, segments)
  geo.rotateX(Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

function buildRing(g: THREE.Group, color: THREE.Color): void {
  const band = new THREE.Mesh(bandGeometry(0.0086, 0.0101, 0.0042), metal(color, 0.22))
  band.name = 'band'
  g.add(band)
}

function buildSignet(g: THREE.Group, color: THREE.Color): void {
  const mat = metal(color, 0.24)
  const band = new THREE.Mesh(bandGeometry(0.0086, 0.0099, 0.0036), mat)
  band.name = 'band'
  g.add(band)
  // Shoulders swelling into the head
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0072, 0.0034, 28, 1), mat)
  shoulder.position.y = 0.0093
  g.add(shoulder)
  // Flat oval face on top (+Y), engraved monogram on the top cap
  const engraving = canvasTexture(128, 128, (ctx) => {
    const base = `#${color.getHexString()}`
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 128, 128)
    ctx.strokeStyle = 'rgba(40, 24, 6, 0.55)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(64, 64, 52, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = 'rgba(40, 24, 6, 0.6)'
    ctx.font = 'italic 700 64px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('A', 64, 68)
  })
  const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: engraving, metalness: 1, roughness: 0.3 })
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0056, 0.0056, 0.0016, 32, 1), [mat, capMat, mat])
  head.name = 'face'
  head.position.y = 0.0114
  head.scale.set(1, 1, 0.82)
  g.add(head)
}

// --- chain -------------------------------------------------------------------------

function buildChain(g: THREE.Group, color: THREE.Color): void {
  const mat = metal(color, 0.24)
  // Loose, slightly irregular loop in XY, opening at the clasp (−Y).
  const pts: THREE.Vector3[] = []
  const n = 14
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    // keep the clasp (−Y) and the top of the loop where the hotspots expect them
    const pinned = i === 0 || i === n / 2
    const wobble = pinned ? 1 : 1 + (hash01(i) - 0.5) * 0.14
    pts.push(new THREE.Vector3(Math.cos(a) * 0.025 * wobble, Math.sin(a) * 0.0245 * wobble, (hash01(i + 40) - 0.5) * 0.003))
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const linkLen = 0.0032
  const count = Math.floor(curve.getLength() / (linkLen * 0.78))
  const linkGeo = new THREE.TorusGeometry(linkLen / 2, 0.00042, 5, 10)
  linkGeo.scale(1, 0.62, 1)
  const links = new THREE.InstancedMesh(linkGeo, mat, count)
  links.name = 'links'
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const twist = new THREE.Quaternion()
  const one = new THREE.Vector3(1, 1, 1)
  const xAxis = new THREE.Vector3(1, 0, 0)
  for (let i = 0; i < count; i++) {
    const t = i / count
    const p = curve.getPointAt(t)
    const tan = curve.getTangentAt(t)
    q.setFromUnitVectors(xAxis, tan)
    twist.setFromAxisAngle(xAxis, i % 2 ? Math.PI / 2 : 0)
    q.multiply(twist)
    m.compose(p, q, one)
    links.setMatrixAt(i, m)
  }
  links.instanceMatrix.needsUpdate = true
  links.computeBoundingSphere()
  g.add(links)
  // Lobster clasp at −Y
  const clasp = new THREE.Mesh(new THREE.CapsuleGeometry(0.0011, 0.003, 3, 8), mat)
  clasp.name = 'clasp'
  const bottom = curve.getPointAt(0)
  clasp.position.set(bottom.x, bottom.y - 0.0004, bottom.z)
  clasp.rotation.z = Math.PI / 2
  g.add(clasp)
  const ringLoop = new THREE.Mesh(new THREE.TorusGeometry(0.0011, 0.00035, 5, 12), mat)
  ringLoop.position.set(bottom.x + 0.0032, bottom.y, bottom.z)
  g.add(ringLoop)
}

// --- earrings ------------------------------------------------------------------------

function buildEarrings(g: THREE.Group, color: THREE.Color): void {
  const mat = metal(color, 0.22)
  const gem = new THREE.MeshStandardMaterial({ color: '#8f1d2c', metalness: 0.1, roughness: 0.08, envMapIntensity: 1.6 })
  // Shepherd hook: down the back, over the top, ending at the drop's bail.
  const hookCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.003, -0.0012),
    new THREE.Vector3(0, 0.007, -0.0024),
    new THREE.Vector3(0, 0.0125, -0.0016),
    new THREE.Vector3(0, 0.0148, 0.0006),
    new THREE.Vector3(0, 0.0125, 0.0022),
    new THREE.Vector3(0, 0.0072, 0.0012),
    new THREE.Vector3(0, 0.0045, 0.0003),
  ])
  const hookGeo = new THREE.TubeGeometry(hookCurve, 24, 0.0004, 5, false)
  // Teardrop pendant (lathe around Y) with a stone set in its face.
  const dropPts: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const y = 0.003 - t * 0.0175
    const r = Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.0042 * (0.35 + 0.65 * t)
    dropPts.push(new THREE.Vector2(Math.max(r, 0.0001), y))
  }
  const dropGeo = new THREE.LatheGeometry(dropPts, 20)
  dropGeo.scale(1, 1, 0.55)
  const stoneGeo = new THREE.SphereGeometry(0.0022, 14, 10)
  stoneGeo.scale(1, 1.2, 0.6)
  for (const side of [-1, 1]) {
    const e = new THREE.Group()
    e.name = side < 0 ? 'earring-left' : 'earring-right'
    e.position.x = side * 0.009
    const hook = new THREE.Mesh(hookGeo, mat)
    const drop = new THREE.Mesh(dropGeo, mat)
    const stone = new THREE.Mesh(stoneGeo, gem)
    stone.position.set(0, -0.0085, 0.0015)
    e.add(hook, drop, stone)
    g.add(e)
  }
}

// --- watch -----------------------------------------------------------------------------

function dialTexture(brand: string | undefined, caseColor: THREE.Color): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const c = 256
    const grad = ctx.createRadialGradient(c, c - 40, 20, c, c, 256)
    grad.addColorStop(0, '#f4efe2')
    grad.addColorStop(1, '#d9d0bb')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 512)
    // minute track
    ctx.strokeStyle = '#2b2620'
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const major = i % 5 === 0
      const r0 = major ? 196 : 222
      ctx.lineWidth = major ? 12 : 3
      ctx.beginPath()
      ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0)
      ctx.lineTo(c + Math.sin(a) * 240, c - Math.cos(a) * 240)
      ctx.stroke()
    }
    // numerals at 12 / 3 / 6 / 9
    ctx.fillStyle = '#2b2620'
    ctx.font = '700 56px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const nums: [string, number, number][] = [['12', c, 140], ['3', 372, c], ['6', c, 372], ['9', 140, c]]
    for (const [t, x, y] of nums) ctx.fillText(t, x, y)
    // brand
    if (brand) {
      ctx.font = '600 34px Georgia, serif'
      ctx.fillText(brand.toUpperCase(), c, 196)
    }
    ctx.font = '22px Georgia, serif'
    ctx.fillText('17 JEWELS', c, 318)
    // hands at 10:10
    const hand = (angle: number, len: number, width: number, col: string) => {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(angle)
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(-width / 2, 24)
      ctx.lineTo(-width * 0.3, -len)
      ctx.lineTo(0, -len - 14)
      ctx.lineTo(width * 0.3, -len)
      ctx.lineTo(width / 2, 24)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    hand((-60 / 360) * Math.PI * 2, 120, 16, '#1d1a16')
    hand((60 / 360) * Math.PI * 2, 190, 12, '#1d1a16')
    hand((200 / 360) * Math.PI * 2, 200, 4, '#a3271c')
    ctx.fillStyle = `#${caseColor.getHexString()}`
    ctx.beginPath()
    ctx.arc(c, c, 12, 0, Math.PI * 2)
    ctx.fill()
  })
}

function casebackTexture(caseColor: THREE.Color): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = `#${caseColor.getHexString()}`
    ctx.fillRect(0, 0, 256, 256)
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    for (let r = 30; r < 128; r += 7) {
      ctx.lineWidth = r % 21 === 2 ? 2 : 0.8
      ctx.beginPath()
      ctx.arc(128, 128, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.font = '600 20px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('№ 0417263', 128, 120)
    ctx.font = '14px ui-monospace, monospace'
    ctx.fillText('STAINLESS · 17 J', 128, 146)
  })
}

function buildWatch(g: THREE.Group, color: THREE.Color, brand?: string, hotspots?: ModelSpec['hotspots']): void {
  // Case radius from the crown marker (+X), thickness from the caseback marker (−Z), within sane bounds.
  const crownX = hotspots?.find((h) => h.id === 'crown')?.position[0]
  const backZ = hotspots?.find((h) => h.id === 'caseback')?.position[2]
  const R = crownX ? THREE.MathUtils.clamp(crownX - 0.0016, 0.016, 0.022) : 0.019
  const depth = backZ ? THREE.MathUtils.clamp(Math.abs(backZ) * 2 - 0.0006, 0.007, 0.014) : 0.009
  const caseMat = metal(color, 0.3)
  // Case: cylinder with axis along Z
  const caseGeo = new THREE.CylinderGeometry(R, R * 0.96, depth, 40, 1)
  caseGeo.rotateX(Math.PI / 2)
  const body = new THREE.Mesh(caseGeo, caseMat)
  body.name = 'case'
  g.add(body)
  // Bezel ring around the dial (+Z)
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.0011, 6, 40), metal(color, 0.18))
  bezel.position.z = depth / 2
  g.add(bezel)
  // Dial
  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.88, 40),
    new THREE.MeshStandardMaterial({ map: dialTexture(brand, color), roughness: 0.45, metalness: 0 }),
  )
  dial.name = 'dial'
  dial.position.z = depth / 2 + 0.0002
  g.add(dial)
  // Crystal: faint glossy dome so the dial picks up reflections
  const crystal = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.92, 24, 6, 0, Math.PI * 2, 0, 0.28),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false }),
  )
  crystal.rotation.x = Math.PI / 2
  crystal.position.z = depth / 2 - R * 0.92 * Math.cos(0.28) + 0.0012
  crystal.renderOrder = 3
  crystal.raycast = () => {} // see-through: never hides a hotspot
  g.add(crystal)
  // Caseback (−Z), engraved
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.8, 36),
    new THREE.MeshStandardMaterial({ map: casebackTexture(color), metalness: 1, roughness: 0.38 }),
  )
  back.name = 'caseback'
  back.position.z = -depth / 2 - 0.0002
  back.rotation.y = Math.PI
  g.add(back)
  // Crown (+X)
  const crownGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0028, 14)
  crownGeo.rotateZ(Math.PI / 2)
  const crown = new THREE.Mesh(crownGeo, caseMat)
  crown.name = 'crown'
  crown.position.x = R + 0.0014
  g.add(crown)
  // Lugs (±Y)
  const lugGeo = new THREE.BoxGeometry(0.0026, 0.007, 0.0045)
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const lug = new THREE.Mesh(lugGeo, caseMat)
      lug.position.set(sx * 0.0085, sy * (R + 0.0015), 0)
      g.add(lug)
    }
  }
  // Leather strap along ±Y, curving back (−Z) as if lying on the counter
  const leather = new THREE.MeshStandardMaterial({ color: '#4a2d1c', roughness: 0.78, metalness: 0 })
  for (const sy of [-1, 1]) {
    const len = sy > 0 ? 0.07 : 0.08
    const strapGeo = new THREE.BoxGeometry(0.0175, len, 0.0026, 1, 8, 1)
    // bend: push z back progressively along the strap
    const pos = strapGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + len / 2 // 0..len from the lug
      const t = y / len
      pos.setY(i, sy * (R + 0.0035 + y * Math.cos(t * 0.6)))
      pos.setZ(i, pos.getZ(i) - 0.001 - y * Math.sin(t * 0.6) * 0.9)
    }
    strapGeo.computeVertexNormals()
    const strap = new THREE.Mesh(strapGeo, leather)
    strap.name = sy > 0 ? 'strap-top' : 'strap-bottom'
    g.add(strap)
  }
  // Buckle on the top strap
  const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0007, 4, 4), metal(new THREE.Color('#c9cbcd'), 0.3))
  buckle.scale.set(1, 0.55, 1)
  buckle.rotation.z = Math.PI / 4
  buckle.position.set(0, R + 0.06, -0.026)
  buckle.rotation.x = -0.55
  g.add(buckle)
}

// --- phone -----------------------------------------------------------------------------

const PHONE = { w: 0.06, h: 0.125, d: 0.008 }

function screenTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 256, (ctx) => {
    const grad = ctx.createLinearGradient(0, 0, 128, 256)
    grad.addColorStop(0, '#15181c')
    grad.addColorStop(0.55, '#07080a')
    grad.addColorStop(1, '#0c0e11')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 128, 256)
    // earpiece and front camera
    ctx.fillStyle = '#2a2d31'
    ctx.fillRect(48, 7, 32, 4)
    ctx.beginPath()
    ctx.arc(90, 9, 3, 0, Math.PI * 2)
    ctx.fill()
    // hairline crack in one corner (wear)
    ctx.strokeStyle = 'rgba(220, 230, 240, 0.25)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(128, 210)
    ctx.lineTo(112, 222)
    ctx.lineTo(104, 241)
    ctx.moveTo(112, 222)
    ctx.lineTo(96, 226)
    ctx.stroke()
  })
}

function backTexture(color: THREE.Color, brand?: string): THREE.CanvasTexture {
  return canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = `#${color.getHexString()}`
    ctx.fillRect(0, 0, 128, 256)
    const ink = color.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    const isFruit = !brand || /mango/i.test(brand)
    if (isFruit) {
      // Mangosteen: a round fruit with a four-leaf crown
      ctx.beginPath()
      ctx.arc(64, 106, 15, 0, Math.PI * 2)
      ctx.fill()
      for (let i = 0; i < 4; i++) {
        ctx.save()
        ctx.translate(64, 89)
        ctx.rotate((i - 1.5) * 0.55)
        ctx.beginPath()
        ctx.ellipse(0, -6, 3, 7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    } else {
      ctx.font = '600 15px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillText(brand.toUpperCase(), 64, 110)
    }
    ctx.font = '7px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Designed in Mostograd', 64, 222)
    ctx.fillText('Model A1530  IMEI 01 384 2...', 64, 232)
  })
}

function bottomEdgeTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 32, (ctx) => {
    ctx.fillStyle = '#8d9096'
    ctx.fillRect(0, 0, 256, 32)
    // port
    ctx.fillStyle = '#121315'
    ctx.beginPath()
    ctx.roundRect(104, 10, 48, 12, 6)
    ctx.fill()
    // screws
    for (const x of [88, 168]) {
      ctx.fillStyle = '#3d3f43'
      ctx.beginPath()
      ctx.arc(x, 16, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a7aab0'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(x - 2, 16)
      ctx.lineTo(x + 2, 16)
      ctx.stroke()
    }
    // speaker / mic grilles
    ctx.fillStyle = '#25272a'
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(190 + i * 8, 16, 2, 0, Math.PI * 2)
      ctx.arc(66 - i * 8, 16, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function buildPhone(g: THREE.Group, color: THREE.Color, brand?: string, hotspots?: ModelSpec['hotspots']): void {
  const { w, h, d } = PHONE
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 3, 0.0035),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 }),
  )
  body.name = 'body'
  g.add(body)
  // Screen glass (+Z)
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.004, h - 0.006),
    new THREE.MeshStandardMaterial({ map: screenTexture(), roughness: 0.06, metalness: 0.1, envMapIntensity: 1.4 }),
  )
  screen.name = 'screen'
  screen.position.z = d / 2 + 0.0001
  g.add(screen)
  // Back panel (−Z) with logo
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.006, h - 0.008),
    new THREE.MeshStandardMaterial({ map: backTexture(color, brand), metalness: 0.5, roughness: 0.4 }),
  )
  back.name = 'back'
  back.position.z = -d / 2 - 0.0001
  back.rotation.y = Math.PI
  g.add(back)
  // Rear camera bump (top-left when looking at the back = +X side in model space)
  const camGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.0012, 20)
  camGeo.rotateX(Math.PI / 2)
  const camRing = new THREE.Mesh(camGeo, metal(new THREE.Color('#9a9da2'), 0.25))
  camRing.name = 'camera'
  camRing.position.set(w / 2 - 0.009, h / 2 - 0.009, -d / 2 - 0.0005)
  g.add(camRing)
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.0027, 18),
    new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.05, metalness: 0.2 }),
  )
  lens.position.set(camRing.position.x, camRing.position.y, -d / 2 - 0.00115)
  lens.rotation.y = Math.PI
  g.add(lens)
  // Bottom edge (−Y): port, screws, grilles
  const edge = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.008, d - 0.0012),
    new THREE.MeshStandardMaterial({ map: bottomEdgeTexture(), metalness: 0.6, roughness: 0.4 }),
  )
  edge.name = 'bottom-edge'
  edge.position.y = -h / 2 - 0.00005
  edge.rotation.x = Math.PI / 2
  g.add(edge)
  // Side buttons (+X power, −X volume)
  const btnMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 })
  const power = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.01, 0.0026), btnMat)
  power.position.set(w / 2 + 0.0003, h / 2 - 0.03, 0)
  g.add(power)
  for (const y of [0.028, 0.016]) {
    const vol = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.008, 0.0026), btnMat)
    vol.position.set(-w / 2 - 0.0003, y, 0)
    g.add(vol)
  }
  // SIM tray on the +X edge (at the marker when the def has one)
  const sim = hotspots?.find((h) => h.id === 'simtray')?.position[1] ?? 0.01
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.0004, 0.014, 0.0028), metal(new THREE.Color('#8f9297'), 0.3))
  tray.name = 'simtray'
  tray.position.set(w / 2 + 0.0001, sim, 0)
  g.add(tray)
}
