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
 * - pendant: a cross ≈ 0.019 × 0.035 in XY, bail on top at +Y (≈ 0.018), face +Z
 * - camera: body 0.14 × 0.083 × 0.04 (top plate up to y ≈ 0.042), lens along +Z to z ≈ 0.064 (SLR) / 0.06 (rangefinder);
 *   an SLR prism hump (when the def has a `prism` hotspot) rises to y ≈ 0.064; back −Z
 * - lens: barrel r ≈ 0.0235 along Z, front glass at +Z (0.0225), screw mount at −Z (to −0.0305)
 * - medal: pentagonal ribbon block on top (y 0.006…0.034), disc r 0.0185 centred at y = −0.02, face +Z
 * - order: five-pointed star r 0.025 in XY, face +Z, screw post and nut behind (to z ≈ −0.0125)
 * - badge: oval wreath plate ≈ 0.036 × 0.04 with a banner on top (to y ≈ 0.021), screw post behind (to z ≈ −0.011)
 * - coin: disc r 0.0125, 2 mm thick, obverse +Z, reverse −Z, edge at x = 0.0125 (size it with model.scale)
 * - laptop: standing as its owner sees it (model.rest "upright"): base 0.336 × 0.026 × 0.236 in the XZ
 *   plane (y −0.1175…−0.0915, keyboard up, front edge +Z at z ≈ 0.157), hinge at the back (z ≈ −0.072),
 *   lid 0.228 × 0.0075 open at 110°, screen facing +Z and a little up, lid top at y ≈ 0.122, z ≈ −0.15
 * - icon (M5): a painted panel 0.16 × 0.2 × 0.024 under a silver cover, face +Z, bare wood back −Z
 * - box (M6): a rounded box of `model.size` centred on the origin, front +Z (tape decks, consoles, a car
 *   stereo, a gold bar…; the scripted glb draws the real thing per id). Upright ones stand on −Y.
 * - record (M6): an LP lying on its sleeve. Sleeve 0.314 square × 0.004 centred at (−0.05, 0.02), front +Z;
 *   the disc r 0.15, 1.8 mm thick, on top of it at (0.07, −0.03), its face at z ≈ 0.0041; label r 0.045
 * - book (M6): a closed hardback (or a stack) of `model.size` lying flat, cover +Z, spine at −X
 *
 * `model.scale` multiplies the whole model (kept for parity with glb models).
 * Models are cached by defId; ItemModels.evict disposes geometries, materials and textures.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { ItemDef } from '../game/schema/item'
import type { GlbLoader } from './loaders'
import { buildWaveA } from './itemsWaveA'
import { textureAnisotropy } from './perf'

export type PlaceholderKind = ItemDef['model']['placeholder']

export interface ModelSpec {
  placeholder: PlaceholderKind
  color: string
  scale?: number
  /** Printed on dials/backs where it fits (watch dial, phone back). */
  brand?: string
  /** The def's hotspots: the watch sizes its case to meet the crown and caseback markers. */
  hotspots?: readonly { id: string; position: readonly [number, number, number] }[]
  /** Medal ribbon stripes, left to right. */
  ribbon?: readonly string[]
  /** Which relief a medal/coin draws. */
  emblem?: string
  /** M6: overall size of a box, book or `block`, metres. */
  size?: readonly [number, number, number]
}

/** The placeholder spec for an item def (stage and gallery build from the same thing). */
export function specOf(def: ItemDef): ModelSpec {
  return {
    placeholder: def.model.placeholder,
    color: def.model.color,
    scale: def.model.scale,
    brand: def.brand,
    hotspots: def.model.hotspots,
    ribbon: def.model.ribbon,
    emblem: def.model.emblem,
    size: def.model.size,
  }
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
    case 'pendant':
      buildPendant(g, color)
      break
    case 'camera':
      buildCamera(g, color, spec.brand, spec.hotspots)
      break
    case 'lens':
      buildLens(g, color, spec.brand)
      break
    case 'medal':
      buildMedal(g, color, spec.ribbon, spec.emblem)
      break
    case 'order':
      buildOrder(g, color)
      break
    case 'badge':
      buildBadge(g, color)
      break
    case 'coin':
      buildCoin(g, color, spec.emblem)
      break
    case 'laptop':
      buildLaptop(g, color)
      break
    case 'icon':
      buildIcon(g, color)
      break
    case 'box':
      buildBox(g, color, spec.size ?? [0.1, 0.05, 0.1])
      break
    case 'record':
      buildRecord(g, color)
      break
    case 'book':
      buildBook(g, color, spec.size ?? [0.15, 0.22, 0.03])
      break
    default:
      // M6 wave A kinds (src/render/itemsWaveA.ts)
      buildWaveA(g, spec)
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
 *
 * A def with `model.glb` (a scripted model from art/items, packed into
 * public/assets/items) shows its placeholder at once and swaps the glb in when
 * it has loaded; `onSwap` listeners hear about it so the stage can refit. The
 * placeholder stays behind, hidden, as a cheap stand-in for raycasts (see `proxyOf`).
 */
export class ItemModels {
  private cache = new Map<string, THREE.Group>()
  private readonly listeners = new Set<(defId: string) => void>()

  constructor(
    private readonly keep = 3,
    private readonly loadGlb?: GlbLoader,
  ) {}

  get(def: ItemDef): THREE.Group {
    let model = this.cache.get(def.id)
    if (model) {
      // refresh LRU order
      this.cache.delete(def.id)
      this.cache.set(def.id, model)
      return model
    }
    model = buildPlaceholder(specOf(def))
    this.cache.set(def.id, model)
    this.evict()
    const file = def.model.glb
    if (file && this.loadGlb) {
      const target = model
      this.loadGlb(file)
        .then((scene) => {
          if (this.cache.get(def.id) !== target) {
            disposeObject(scene)
            return
          }
          swapInGlb(target, scene)
          for (const l of this.listeners) l(def.id)
        })
        .catch((err: unknown) => console.warn(`[items] ${file} failed, keeping the placeholder`, err))
    }
    return model
  }

  onSwap(fn: (defId: string) => void): void {
    this.listeners.add(fn)
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
    this.listeners.clear()
  }
}

/**
 * Put a loaded glb scene inside a placeholder group (which carries `model.scale`).
 * The placeholder meshes move into a hidden `proxy` child: raycasters ignore
 * visibility, so hotspot occlusion tests keep using a few hundred triangles
 * instead of the glb's tens of thousands.
 */
export function swapInGlb(model: THREE.Group, scene: THREE.Group): void {
  if (model.name === 'placeholder:block') {
    // M6: a CC0 model (a few thousand triangles) over a stand-in box: it is its own raycast proxy.
    for (const c of [...model.children]) {
      c.removeFromParent()
      disposeObject(c)
    }
    scene.name = 'glb'
    model.add(scene)
    model.userData.glb = true
    return
  }
  const proxy = new THREE.Group()
  proxy.name = 'proxy'
  proxy.visible = false
  for (const c of [...model.children]) proxy.add(c)
  scene.name = 'glb'
  model.add(proxy, scene)
  model.userData.glb = true
}

/** What to raycast against for occlusion: the hidden placeholder if a glb took its place. */
export function proxyOf(model: THREE.Object3D): THREE.Object3D {
  return model.getObjectByName('proxy') ?? model
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
  t.anisotropy = textureAnisotropy()
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
  // Case radius from the crown marker (+X), thickness from the caseback marker (−Z), within sane bounds (a ladies' watch can be as small as 10 mm).
  const crownX = hotspots?.find((h) => h.id === 'crown')?.position[0]
  const backZ = hotspots?.find((h) => h.id === 'caseback')?.position[2]
  const R = crownX ? THREE.MathUtils.clamp(crownX - 0.0016, 0.01, 0.022) : 0.019
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

// --- M2 shapes: shared helpers ------------------------------------------------------------

/** Darker or lighter CSS colour from a THREE.Color, for relief strokes on canvas. */
function shade(color: THREE.Color, k: number): string {
  const c = color.clone().multiplyScalar(k)
  c.r = Math.min(1, c.r)
  c.g = Math.min(1, c.g)
  c.b = Math.min(1, c.b)
  return `#${c.getHexString()}`
}

/** Map a flat shape's XY extent to 0..1 UVs (ExtrudeGeometry uses raw coordinates). */
function planarUv(geo: THREE.BufferGeometry): void {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  const w = b.max.x - b.min.x || 1
  const h = b.max.y - b.min.y || 1
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / w
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / h
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** Disc along Z (front cap +Z, back cap −Z) with materials [edge, front, back]. */
function disc(r: number, thick: number, mats: THREE.Material[], segments = 40): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, thick, segments, 1)
  geo.rotateX(Math.PI / 2)
  return new THREE.Mesh(geo, mats)
}

function starShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? inner : outer
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return s
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? inner : outer
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
}

/** Text set around a circle (coin and medal rims). Top arcs read clockwise; `bottom` arcs read left to right too. */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, centre: number, spread: number, bottom = false): void {
  const chars = [...text]
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  chars.forEach((ch, i) => {
    const t = chars.length > 1 ? i / (chars.length - 1) : 0.5
    const a = bottom ? centre + spread / 2 - t * spread : centre - spread / 2 + t * spread
    ctx.save()
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
  ctx.restore()
}

/** Metallic face: base colour, a raised rim ring, and whatever `draw` adds in a darker shade. */
function faceTexture(color: THREE.Color, draw: (ctx: CanvasRenderingContext2D, ink: string, hi: string) => void, size = 256): THREE.CanvasTexture {
  const tex = canvasTexture(size, size, (ctx) => {
    const c = size / 2
    const grad = ctx.createRadialGradient(c * 0.8, c * 0.7, size * 0.05, c, c, c)
    grad.addColorStop(0, shade(color, 1.12))
    grad.addColorStop(1, shade(color, 0.86))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = shade(color, 0.62)
    ctx.lineWidth = size * 0.018
    ctx.beginPath()
    ctx.arc(c, c, c * 0.93, 0, Math.PI * 2)
    ctx.stroke()
    draw(ctx, shade(color, 0.5), shade(color, 1.25))
  })
  // Cylinder caps (see disc()) map the canvas a quarter turn off once the disc faces ±Z.
  tex.center.set(0.5, 0.5)
  tex.rotation = Math.PI / 2
  return tex
}

// --- pendant (cross) ------------------------------------------------------------------------

function buildPendant(g: THREE.Group, color: THREE.Color): void {
  const mat = metal(color, 0.24)
  const t = 0.0018
  const upright = new THREE.Mesh(new RoundedBoxGeometry(0.0042, 0.03, t, 2, 0.0006), mat)
  upright.position.y = -0.002
  upright.name = 'front'
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.019, 0.0042, t, 2, 0.0006), mat)
  bar.position.y = 0.006
  // small rounded terminals at the four ends
  const knob = new THREE.SphereGeometry(0.0013, 10, 6)
  for (const [x, y] of [[0, 0.0135], [0, -0.0175], [0.0095, 0.006], [-0.0095, 0.006]] as const) {
    const k = new THREE.Mesh(knob, mat)
    k.position.set(x, y, 0)
    k.scale.z = 0.7
    g.add(k)
  }
  // bail: a ring standing across the cross so a chain would run through it
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.0021, 0.00055, 6, 16), mat)
  bail.name = 'bail'
  bail.rotation.y = Math.PI / 2
  bail.position.y = 0.0168
  g.add(upright, bar, bail)
}

// --- camera -----------------------------------------------------------------------------------

const CAMERA = { w: 0.14, h: 0.075, d: 0.04 }

function nameplateTexture(text: string, dark: boolean): THREE.CanvasTexture {
  return canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = dark ? '#1a1a1a' : '#cfcfca'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = dark ? '#e9e7e0' : '#1b1b1b'
    ctx.font = '700 38px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 34)
  })
}

function leatherTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#1b1a19'
    ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = hash01(i + 2000) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.35)'
      ctx.fillRect(hash01(i) * 128, hash01(i + 1000) * 128, 2, 2)
    }
  })
}

function buildCamera(g: THREE.Group, color: THREE.Color, brand?: string, hotspots?: ModelSpec['hotspots']): void {
  const { w, h, d } = CAMERA
  const slr = hotspots?.some((s) => s.id === 'prism') ?? true
  const chrome = metal(color, 0.32)
  const dark = color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.3
  const leather = new THREE.MeshStandardMaterial({ map: leatherTexture(), roughness: 0.85, metalness: 0 })
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), leather)
  body.name = 'body'
  g.add(body)
  // Top plate in the def colour (chrome or black paint), bottom plate to match
  const top = new THREE.Mesh(new RoundedBoxGeometry(w - 0.002, 0.009, d - 0.001, 2, 0.003), chrome)
  top.name = 'top'
  top.position.y = h / 2 + 0.0002
  g.add(top)
  const plateTop = h / 2 + 0.0047
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w - 0.006, 0.003, d - 0.004), chrome)
  bottom.position.y = -h / 2 - 0.0005
  g.add(bottom)
  // Knobs: shutter dial (+X), rewind (−X), release button
  const knobGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.006, 18)
  const shutter = new THREE.Mesh(knobGeo, chrome)
  shutter.position.set(0.046, plateTop + 0.003, 0)
  const rewind = new THREE.Mesh(knobGeo, chrome)
  rewind.position.set(-0.05, plateTop + 0.003, 0)
  const release = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 10), chrome)
  release.position.set(0.03, plateTop + 0.002, 0.008)
  g.add(shutter, rewind, release)
  const label = brand ? (/zenit/i.test(brand) ? 'ЗЕНИТ' : brand.toUpperCase()) : 'CAMERA'
  const plateMat = new THREE.MeshStandardMaterial({ map: nameplateTexture(label, dark), metalness: 0.4, roughness: 0.4 })
  if (slr) {
    // Prism hump: a square frustum over the lens axis, nameplate on its sloped front
    const prismGeo = new THREE.CylinderGeometry(0.018, 0.03, 0.022, 4, 1)
    prismGeo.rotateY(Math.PI / 4)
    const prism = new THREE.Mesh(prismGeo, chrome)
    prism.name = 'prism'
    prism.position.y = plateTop + 0.011
    g.add(prism)
    const half = (r: number) => r / Math.SQRT2
    const slope = Math.atan2(half(0.03) - half(0.018), 0.022)
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.006), plateMat)
    plate.position.set(0, plateTop + 0.0105, (half(0.03) + half(0.018)) / 2 + 0.0004)
    plate.rotation.x = slope
    g.add(plate)
  } else {
    // Rangefinder: two windows on the front, engraved script on the top plate
    const glass = new THREE.MeshStandardMaterial({ color: '#2a2216', roughness: 0.08, metalness: 0.3 })
    for (const x of [0.042, -0.012]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(x > 0 ? 0.012 : 0.009, 0.007), glass)
      win.position.set(x, 0.028, d / 2 + 0.0004)
      g.add(win)
    }
    const script = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.0125), plateMat)
    script.position.set(-0.016, plateTop + 0.0002, 0.003)
    script.rotation.x = -Math.PI / 2
    g.add(script)
  }
  // Lens: mount ring, barrel, grip ring, front glass
  const lensEnd = slr ? 0.064 : 0.06
  const lensY = -0.006
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 28), chrome)
  mount.rotation.x = Math.PI / 2
  mount.position.set(0, lensY, d / 2 + 0.002)
  g.add(mount)
  const barrelLen = lensEnd - d / 2 - 0.004
  const barrelMat = new THREE.MeshStandardMaterial({ color: dark ? '#222222' : '#c7c7c2', metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide })
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0235, barrelLen, 28, 1, true), barrelMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, lensY, d / 2 + 0.004 + barrelLen / 2)
  g.add(barrel)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0232, 0.0014, 4, 28), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.7 }))
  ring.position.set(0, lensY, d / 2 + 0.004 + barrelLen * 0.45)
  g.add(ring)
  const front = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.0216, 28), barrelMat)
  front.position.set(0, lensY, lensEnd - 0.0001)
  g.add(front)
  const glassFront = new THREE.Mesh(
    new THREE.CircleGeometry(0.0162, 28),
    new THREE.MeshStandardMaterial({ color: '#141a24', roughness: 0.04, metalness: 0.2, envMapIntensity: 1.6 }),
  )
  glassFront.name = 'lens'
  glassFront.position.set(0, lensY, lensEnd - 0.0012)
  g.add(glassFront)
  // Film door seam on the back
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.0012, h - 0.012), new THREE.MeshBasicMaterial({ color: '#050505' }))
  seam.name = 'back'
  seam.position.set(0.045, 0, -d / 2 - 0.0002)
  seam.rotation.y = Math.PI
  g.add(seam)
}

// --- lens -------------------------------------------------------------------------------------

function apertureTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 32, (ctx) => {
    ctx.fillStyle = '#1d1d1e'
    ctx.fillRect(0, 0, 512, 32)
    ctx.fillStyle = '#e6e3da'
    ctx.font = '600 14px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const stops = ['2', '2.8', '4', '5.6', '8', '11', '16']
    stops.forEach((s, i) => ctx.fillText(s, 40 + i * 32, 16))
    for (let x = 300; x < 512; x += 6) ctx.fillRect(x, 4, 2, 24)
  })
}

function nameRingTexture(brand?: string): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#18181a'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#ece9e0'
    ctx.font = '600 15px Georgia, serif'
    const text = brand && /helios/i.test(brand) ? 'ГЕЛИОС-44-2  2/58  № 8231507' : `${(brand ?? 'LENS').toUpperCase()}  2/58`
    arcText(ctx, text, 128, 128, 112, -Math.PI / 2, Math.PI * 1.4)
  })
}

function buildLens(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const body = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.38 })
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.045, 32), body)
  barrel.rotation.x = Math.PI / 2
  barrel.name = 'barrel'
  g.add(barrel)
  const aperture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0234, 0.0234, 0.008, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: apertureTexture(), metalness: 0.5, roughness: 0.45 }),
  )
  aperture.rotation.x = Math.PI / 2
  aperture.position.z = 0.006
  aperture.name = 'aperture'
  g.add(aperture)
  const focus = new THREE.Mesh(new THREE.CylinderGeometry(0.0232, 0.0232, 0.013, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.8 }))
  focus.rotation.x = Math.PI / 2
  focus.position.z = -0.011
  g.add(focus)
  const nameRing = new THREE.Mesh(new THREE.RingGeometry(0.0152, 0.0224, 32), new THREE.MeshStandardMaterial({ map: nameRingTexture(brand), metalness: 0.3, roughness: 0.5 }))
  nameRing.position.z = 0.02255
  g.add(nameRing)
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 24, 6, 0, Math.PI * 2, 0, 0.53),
    new THREE.MeshStandardMaterial({ color: '#2a1d10', roughness: 0.03, metalness: 0.3, envMapIntensity: 1.8 }),
  )
  glass.rotation.x = Math.PI / 2
  glass.position.z = 0.0225 - 0.03 * Math.cos(0.53) + 0.0006
  glass.name = 'front'
  g.add(glass)
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.008, 24), metal(new THREE.Color('#bdbdb8'), 0.3))
  thread.rotation.x = Math.PI / 2
  thread.position.z = -0.0265
  thread.name = 'mount'
  g.add(thread)
}

// --- medals ----------------------------------------------------------------------------------

function ribbonTexture(stripes: readonly string[]): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    const n = stripes.length
    stripes.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(Math.floor((i * 128) / n), 0, Math.ceil(128 / n) + 1, 128)
    })
    // moiré sheen and a little dirt
    for (let y = 0; y < 128; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.04 * Math.sin(y * 0.4)})`
      ctx.fillRect(0, y, 128, 1)
    }
    ctx.fillStyle = 'rgba(40,30,20,0.12)'
    ctx.fillRect(0, 0, 128, 128)
  })
}

const MEDAL_TEXT: Record<string, string> = {
  merit: 'ЗА БОЕВЫЕ ЗАСЛУГИ',
  victory: 'ЗА ПОБЕДУ НАД ГЕРМАНИЕЙ',
}

function medalFace(color: THREE.Color, emblem?: string): THREE.CanvasTexture {
  return faceTexture(color, (ctx, ink) => {
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (emblem === 'courage') {
      // three aircraft over the motto, a tank below
      for (const [x, y] of [[80, 62], [128, 48], [176, 62]] as const) {
        ctx.fillRect(x - 16, y - 2, 32, 5)
        ctx.fillRect(x - 3, y - 9, 6, 18)
      }
      ctx.font = '700 30px Georgia, serif'
      ctx.fillText('ЗА', 128, 104)
      ctx.fillText('ОТВАГУ', 128, 140)
      ctx.fillRect(82, 176, 92, 22)
      ctx.fillRect(104, 164, 44, 14)
      ctx.fillRect(140, 168, 40, 5)
    } else {
      ctx.font = '700 20px Georgia, serif'
      arcText(ctx, MEDAL_TEXT[emblem ?? ''] ?? 'СССР', 128, 128, 98, -Math.PI / 2, Math.PI * 1.3)
      drawStar(ctx, 128, 132, 46, 19)
      ctx.font = '700 24px Georgia, serif'
      ctx.fillText('СССР', 128, 204)
    }
  })
}

function medalBack(color: THREE.Color): THREE.CanvasTexture {
  return faceTexture(color, (ctx, ink) => {
    ctx.fillStyle = ink
    ctx.font = '600 22px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('№ 2841937', 128, 136)
  })
}

function buildMedal(g: THREE.Group, color: THREE.Color, ribbon?: readonly string[], emblem?: string): void {
  const mat = metal(color, 0.3)
  // Pentagonal mount: wide top, sides down, a point at the bottom; ribbon on the front
  const shape = new THREE.Shape()
  shape.moveTo(-0.0125, 0.034)
  shape.lineTo(-0.0125, 0.016)
  shape.lineTo(0, 0.006)
  shape.lineTo(0.0125, 0.016)
  shape.lineTo(0.0125, 0.034)
  shape.closePath()
  const blockGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.002, bevelEnabled: false })
  blockGeo.translate(0, 0, -0.001)
  planarUv(blockGeo)
  const block = new THREE.Mesh(blockGeo, [
    new THREE.MeshStandardMaterial({ map: ribbonTexture(ribbon ?? ['#8a8a86']), roughness: 0.75, metalness: 0 }),
    mat,
  ])
  block.name = 'ribbon'
  g.add(block)
  // Pin across the back of the mount
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.02, 6), metal(new THREE.Color('#9a9a96'), 0.4))
  pin.rotation.z = Math.PI / 2
  pin.position.set(0, 0.024, -0.0016)
  pin.name = 'pin'
  g.add(pin)
  // Eyelet and jump ring linking the mount to the disc
  const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.0022, 0.0007, 6, 14), mat)
  eyelet.rotation.y = Math.PI / 2
  eyelet.position.y = 0.0012
  eyelet.name = 'eyelet'
  g.add(eyelet)
  const jump = new THREE.Mesh(new THREE.TorusGeometry(0.002, 0.0005, 5, 12), mat)
  jump.position.y = 0.0045
  g.add(jump)
  const face = new THREE.MeshStandardMaterial({ map: medalFace(color, emblem), metalness: 1, roughness: 0.32 })
  const back = new THREE.MeshStandardMaterial({ map: medalBack(color), metalness: 1, roughness: 0.36 })
  const d = disc(0.0185, 0.003, [mat, face, back])
  d.position.y = -0.02
  d.name = 'disc'
  g.add(d)
}

function orderCentre(): THREE.CanvasTexture {
  return faceTexture(new THREE.Color('#cfcfca'), (ctx, ink) => {
    ctx.fillStyle = '#b3222a'
    ctx.beginPath()
    ctx.arc(128, 128, 116, 0, Math.PI * 2)
    ctx.arc(128, 128, 82, 0, Math.PI * 2, true)
    ctx.fill()
    ctx.fillStyle = '#e9d9a8'
    ctx.font = '700 16px Georgia, serif'
    arcText(ctx, 'ПРОЛЕТАРИИ ВСЕХ СТРАН', 128, 128, 99, -Math.PI / 2, Math.PI * 1.2)
    ctx.font = '700 22px Georgia, serif'
    arcText(ctx, 'СССР', 128, 128, 99, Math.PI / 2, 0.7, true)
    // a soldier in a greatcoat, rifle on the shoulder
    ctx.fillStyle = ink
    ctx.beginPath()
    ctx.arc(124, 88, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(110, 100)
    ctx.lineTo(138, 100)
    ctx.lineTo(146, 168)
    ctx.lineTo(102, 168)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(140, 64, 4, 66)
  })
}

function buildOrder(g: THREE.Group, color: THREE.Color): void {
  const enamel = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.22 })
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.025, 0.0105), {
    depth: 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0006,
    bevelSegments: 1,
  })
  starGeo.translate(0, 0, -0.0015)
  const star = new THREE.Mesh(starGeo, enamel)
  star.name = 'enamel'
  g.add(star)
  const silver = metal(new THREE.Color('#cfcfca'), 0.3)
  const centre = disc(0.0095, 0.0016, [silver, new THREE.MeshStandardMaterial({ map: orderCentre(), metalness: 0.8, roughness: 0.35 }), silver], 32)
  centre.position.z = 0.0025
  centre.name = 'center'
  g.add(centre)
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.011, 10), silver)
  post.rotation.x = Math.PI / 2
  post.position.z = -0.0075
  post.name = 'screw'
  g.add(post)
  const nutBack = faceTexture(new THREE.Color('#bdbdb8'), (ctx, ink) => {
    ctx.fillStyle = ink
    ctx.font = '700 22px Georgia, serif'
    arcText(ctx, 'МОНЕТНЫЙ ДВОР', 128, 128, 92, -Math.PI / 2, Math.PI * 1.2)
  })
  const nut = disc(0.0145, 0.002, [silver, silver, new THREE.MeshStandardMaterial({ map: nutBack, metalness: 1, roughness: 0.4 })], 32)
  nut.position.z = -0.0095
  nut.name = 'nut'
  g.add(nut)
}

function buildBadge(g: THREE.Group, color: THREE.Color): void {
  const gilt = metal(color, 0.3)
  // Oval wreath plate with a red star at its heart
  const plateShape = new THREE.Shape()
  plateShape.absellipse(0, -0.003, 0.018, 0.02, 0, Math.PI * 2, false, 0)
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0005, bevelSegments: 1, curveSegments: 24 })
  plateGeo.translate(0, 0, -0.001)
  planarUv(plateGeo)
  const wreathTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = shade(color, 1.05)
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = shade(color, 0.55)
    // oak leaves round the edge
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      ctx.save()
      ctx.translate(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 104)
      ctx.rotate(a + Math.PI / 2)
      ctx.beginPath()
      ctx.ellipse(0, 0, 8, 17, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = '#b3222a'
    drawStar(ctx, 128, 140, 40, 16)
  })
  const plate = new THREE.Mesh(plateGeo, [new THREE.MeshStandardMaterial({ map: wreathTex, metalness: 0.9, roughness: 0.32 }), gilt])
  plate.name = 'wreath'
  g.add(plate)
  // Red enamel banner across the top
  const bannerTex = canvasTexture(256, 64, (ctx) => {
    ctx.fillStyle = '#b3222a'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = '#e8c766'
    ctx.font = '700 40px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('ГВАРДИЯ', 128, 34)
  })
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, metalness: 0.15, roughness: 0.25 })
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.009, 0.0016), [gilt, gilt, gilt, gilt, bannerMat, gilt])
  banner.position.set(0, 0.0165, 0.0012)
  banner.name = 'banner'
  g.add(banner)
  // Screw post and nut behind
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.01, 10), gilt)
  post.rotation.x = Math.PI / 2
  post.position.z = -0.006
  post.name = 'screw'
  g.add(post)
  const nut = disc(0.011, 0.0015, [gilt, gilt, gilt], 24)
  nut.position.z = -0.0078
  g.add(nut)
}

// --- coins ------------------------------------------------------------------------------------

function coinObverse(color: THREE.Color, emblem?: string): THREE.CanvasTexture {
  return faceTexture(color, (ctx, ink, hi) => {
    ctx.fillStyle = ink
    ctx.strokeStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // beaded border
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    if (emblem === 'smith') {
      // hammer raised over an anvil
      ctx.fillRect(88, 150, 80, 20)
      ctx.fillRect(110, 170, 36, 24)
      ctx.beginPath()
      ctx.moveTo(120, 140)
      ctx.lineTo(160, 70)
      ctx.stroke()
      ctx.fillRect(146, 56, 34, 18)
      ctx.font = '700 20px Georgia, serif'
      ctx.fillText('ОДИН ПОЛТИННИК', 128, 214)
    } else if (emblem === 'eagle') {
      // a double-headed eagle, simplified: body, two heads, spread wings
      ctx.beginPath()
      ctx.ellipse(128, 132, 18, 34, 0, 0, Math.PI * 2)
      ctx.fill()
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(128 + s * 18, 86, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(128 + s * 14, 112)
        ctx.lineTo(128 + s * 78, 84)
        ctx.lineTo(128 + s * 70, 150)
        ctx.lineTo(128 + s * 16, 150)
        ctx.closePath()
        ctx.fill()
      }
      ctx.fillStyle = hi
      ctx.fillRect(121, 120, 14, 18)
    } else if (emblem === 'sower') {
      // the sower striding, a rising sun and chimneys behind
      ctx.beginPath()
      ctx.arc(150, 120, 30, Math.PI, Math.PI * 2)
      ctx.stroke()
      ctx.fillRect(64, 104, 8, 44)
      ctx.fillRect(80, 114, 8, 34)
      ctx.beginPath()
      ctx.arc(120, 82, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(108, 96)
      ctx.lineTo(132, 96)
      ctx.lineTo(150, 186)
      ctx.lineTo(136, 186)
      ctx.lineTo(120, 140)
      ctx.lineTo(104, 186)
      ctx.lineTo(90, 186)
      ctx.closePath()
      ctx.fill()
      ctx.fillRect(60, 186, 136, 6)
    } else if (emblem === 'sprinter') {
      // a runner in mid-stride on a proof field
      ctx.beginPath()
      ctx.arc(140, 70, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(136, 84)
      ctx.lineTo(118, 136)
      ctx.lineTo(90, 176)
      ctx.moveTo(118, 136)
      ctx.lineTo(150, 160)
      ctx.lineTo(168, 196)
      ctx.moveTo(132, 96)
      ctx.lineTo(96, 110)
      ctx.moveTo(132, 96)
      ctx.lineTo(166, 118)
      ctx.stroke()
      ctx.font = '700 16px Georgia, serif'
      arcText(ctx, 'ИГРЫ XXII ОЛИМПИАДЫ', 128, 128, 96, -Math.PI / 2, Math.PI * 1.1)
    } else {
      drawStar(ctx, 128, 128, 40, 16)
    }
  })
}

const COIN_VALUE: Record<string, [string, string]> = {
  smith: ['50', 'КОПЕЕК'],
  eagle: ['РУБЛЬ', ''],
  sower: ['ЧЕРВОНЕЦ', ''],
  sprinter: ['10', 'РУБЛЕЙ'],
}

function coinReverse(color: THREE.Color, emblem?: string): THREE.CanvasTexture {
  const [big, small] = COIN_VALUE[emblem ?? ''] ?? ['1', '']
  return faceTexture(color, (ctx, ink) => {
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // wreath of wheat ears on both sides
    for (const s of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + s * (0.35 + i * 0.26)
        ctx.save()
        ctx.translate(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92)
        ctx.rotate(a)
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 11, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
    ctx.font = `700 ${big.length > 3 ? 30 : 64}px Georgia, serif`
    ctx.fillText(big, 128, small ? 114 : 128)
    if (small) {
      ctx.font = '700 24px Georgia, serif'
      ctx.fillText(small, 128, 164)
    }
  })
}

function reedTexture(color: THREE.Color): THREE.CanvasTexture {
  return canvasTexture(256, 8, (ctx) => {
    ctx.fillStyle = shade(color, 1)
    ctx.fillRect(0, 0, 256, 8)
    ctx.fillStyle = shade(color, 0.6)
    for (let x = 0; x < 256; x += 4) ctx.fillRect(x, 0, 2, 8)
  })
}

function buildCoin(g: THREE.Group, color: THREE.Color, emblem?: string): void {
  const edge = new THREE.MeshStandardMaterial({ map: reedTexture(color), metalness: 1, roughness: 0.3 })
  const front = new THREE.MeshStandardMaterial({ map: coinObverse(color, emblem), metalness: 1, roughness: 0.28 })
  const back = new THREE.MeshStandardMaterial({ map: coinReverse(color, emblem), metalness: 1, roughness: 0.3 })
  const c = disc(0.0125, 0.002, [edge, front, back], 48)
  c.name = 'coin'
  g.add(c)
}

// --- laptop -----------------------------------------------------------------------------------

/** Same layout as art/items/kinds/laptop.py: base centre, hinge-side lid centre, lid tilt. */
const LAPTOP = { w: 0.336, d: 0.236, t: 0.026, y0: -0.1175, zc: 0.0394, lidH: 0.228, lidT: 0.0075, lidCentre: [0, 0.0136, -0.1114] as const, lidTilt: -0.349 }

function buildLaptop(g: THREE.Group, color: THREE.Color): void {
  const { w, d, t, y0, zc, lidH, lidT } = LAPTOP
  const shell = new THREE.MeshStandardMaterial({ color: '#8e9196', metalness: 0.35, roughness: 0.45 })
  const dark = new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.4 })
  const base = new THREE.Mesh(new RoundedBoxGeometry(w, t, d, 2, 0.004), shell)
  base.name = 'base'
  base.position.set(0, y0 + t / 2, zc)
  g.add(base)
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.104), dark)
  keys.rotation.x = -Math.PI / 2
  keys.position.set(0, y0 + t + 0.0002, zc - 0.0142)
  g.add(keys)
  // Lid: box tilted back 20° from vertical about the hinge, screen on its +Z face.
  const lid = new THREE.Group()
  lid.position.set(...LAPTOP.lidCentre)
  lid.rotation.x = LAPTOP.lidTilt
  const shellLid = new THREE.Mesh(new RoundedBoxGeometry(w - 0.001, lidH, lidT, 2, 0.003), new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.25 }))
  shellLid.name = 'lid'
  lid.add(shellLid)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.175), new THREE.MeshStandardMaterial({ color: '#06070a', roughness: 0.06 }))
  screen.name = 'screen'
  screen.position.set(0, 0.008, lidT / 2 + 0.0002)
  lid.add(screen)
  g.add(lid)
}

// --- icon (M5, the Collector's) -------------------------------------------------------------

const ICON = { w: 0.16, h: 0.2, t: 0.024 } as const

/** The painted panel under its silver cover: canvas colour plus a metalness map (silver frame, painted window). */
function iconFace(color: THREE.Color): { map: THREE.CanvasTexture; metal: THREE.CanvasTexture } {
  const W = 320
  const H = 400
  const win = { x: 62, y: 56, w: 196, h: 300 }
  const map = canvasTexture(W, H, (ctx) => {
    // Silver cover, chased in rows of little leaves.
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, shade(color, 1.15))
    grad.addColorStop(0.5, shade(color, 0.85))
    grad.addColorStop(1, shade(color, 1.05))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = shade(color, 0.6)
    ctx.lineWidth = 2
    for (let i = 0; i < 60; i++) {
      const along = (i % 15) / 15
      const side = Math.floor(i / 15)
      const x = side < 2 ? 20 + along * (W - 40) : side === 2 ? 28 : W - 28
      const y = side === 0 ? 28 : side === 1 ? H - 28 : 30 + along * (H - 60)
      ctx.beginPath()
      ctx.ellipse(x, y, 7, 4, (i * 0.7) % Math.PI, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeRect(10, 10, W - 20, H - 20)
    ctx.strokeRect(win.x - 6, win.y - 6, win.w + 12, win.h + 12)
    // The dent, top left.
    const dent = ctx.createRadialGradient(36, 34, 2, 36, 34, 22)
    dent.addColorStop(0, shade(color, 0.45))
    dent.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = dent
    ctx.fillRect(10, 10, 52, 50)
    // The painted window: dark gold ground, her red-brown cloak, face, halo.
    ctx.fillStyle = '#6b4a1c'
    ctx.fillRect(win.x, win.y, win.w, win.h)
    const cx = win.x + win.w / 2
    ctx.fillStyle = '#c89b3c'
    ctx.beginPath()
    ctx.arc(cx, win.y + 92, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#5a1f17'
    ctx.beginPath()
    ctx.moveTo(cx, win.y + 52)
    ctx.quadraticCurveTo(cx + 70, win.y + 70, cx + 84, win.y + win.h - 40)
    ctx.lineTo(cx - 84, win.y + win.h - 40)
    ctx.quadraticCurveTo(cx - 70, win.y + 70, cx, win.y + 52)
    ctx.fill()
    ctx.fillStyle = '#b98a5e'
    ctx.beginPath()
    ctx.ellipse(cx, win.y + 96, 17, 23, 0, 0, Math.PI * 2)
    ctx.fill()
    // The child on her arm, a smaller face and halo.
    ctx.fillStyle = '#c89b3c'
    ctx.beginPath()
    ctx.arc(cx - 34, win.y + 150, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b98a5e'
    ctx.beginPath()
    ctx.ellipse(cx - 34, win.y + 152, 9, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c89b3c'
    ctx.fillRect(cx - 50, win.y + 66, 3, 120)
    // The little canal boat at her feet.
    ctx.fillStyle = '#2c2416'
    ctx.beginPath()
    ctx.moveTo(cx - 22, win.y + win.h - 22)
    ctx.lineTo(cx + 22, win.y + win.h - 22)
    ctx.lineTo(cx + 14, win.y + win.h - 14)
    ctx.lineTo(cx - 14, win.y + win.h - 14)
    ctx.fill()
    ctx.fillRect(cx + 4, win.y + win.h - 40, 2, 20)
    // A drip of candle wax on the hem.
    ctx.fillStyle = 'rgba(240,232,205,0.9)'
    ctx.beginPath()
    ctx.ellipse(cx + 60, win.y + win.h + 2, 6, 10, 0.2, 0, Math.PI * 2)
    ctx.fill()
    // Crackle over the paint.
    ctx.strokeStyle = 'rgba(30,18,8,0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i < 70; i++) {
      const x = win.x + hash01(i) * win.w
      const y = win.y + hash01(i + 97) * win.h
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (hash01(i + 13) - 0.5) * 24, y + (hash01(i + 29) - 0.5) * 24)
      ctx.stroke()
    }
  })
  const metalTex = new THREE.CanvasTexture(
    (() => {
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#000000'
        ctx.fillRect(win.x, win.y, win.w, win.h)
      }
      return c
    })(),
  )
  return { map, metal: metalTex }
}

/** The back of the panel: bare lime wood, two dovetailed battens, a half-scraped parish number in white paint. */
function iconBack(): THREE.CanvasTexture {
  return canvasTexture(320, 400, (ctx) => {
    ctx.fillStyle = '#9a7a52'
    ctx.fillRect(0, 0, 320, 400)
    ctx.strokeStyle = 'rgba(60,40,20,0.35)'
    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.moveTo(8 * i, 0)
      ctx.bezierCurveTo(8 * i + 6, 140, 8 * i - 6, 260, 8 * i + 3, 400)
      ctx.stroke()
    }
    ctx.fillStyle = '#7a5c3a'
    ctx.fillRect(0, 70, 320, 26)
    ctx.fillRect(0, 300, 320, 26)
    ctx.fillStyle = 'rgba(240,238,230,0.85)'
    ctx.font = 'bold 34px serif'
    ctx.textAlign = 'center'
    ctx.fillText('ПОКР', 150, 200)
    ctx.fillText('№ 47', 165, 244)
    // Scraped away: streaks of bare wood over the paint.
    ctx.fillStyle = '#9a7a52'
    for (let i = 0; i < 9; i++) ctx.fillRect(40 + i * 28, 168 + (i % 3) * 9, 18, 56)
  })
}

function buildIcon(g: THREE.Group, color: THREE.Color): void {
  const { w, h, t } = ICON
  const { map, metal: metalnessMap } = iconFace(color)
  const front = new THREE.MeshStandardMaterial({ map, metalnessMap, metalness: 1, roughness: 0.38 })
  const back = new THREE.MeshStandardMaterial({ map: iconBack(), roughness: 0.85 })
  const edge = new THREE.MeshStandardMaterial({ color: '#7a5c3a', roughness: 0.8 })
  // BoxGeometry groups: +X, −X, +Y, −Y, +Z (front), −Z (back).
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), [edge, edge, edge, edge, front, back])
  panel.name = 'panel'
  g.add(panel)
}

// --- M6: box, record, book --------------------------------------------------------------

function buildBox(g: THREE.Group, color: THREE.Color, size: readonly [number, number, number]): void {
  const [w, h, d] = size
  const r = Math.min(w, h, d) * 0.12
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 }))
  body.name = 'body'
  g.add(body)
  // a darker front panel so the front reads at a glance
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.86, h * 0.7), new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.4 }))
  panel.position.z = d / 2 + 0.0002
  g.add(panel)
}

const RECORD = { sleeve: 0.314, sleeveT: 0.004, sleeveAt: [-0.05, 0.02] as const, r: 0.15, t: 0.0018, at: [0.07, -0.03] as const, label: 0.045 }

function buildRecord(g: THREE.Group, color: THREE.Color): void {
  const { sleeve, sleeveT, sleeveAt, r, t, at, label } = RECORD
  const art = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = shade(color, 1)
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = shade(color, 0.55)
    ctx.fillRect(24, 150, 208, 70)
    ctx.strokeStyle = shade(color, 1.4)
    ctx.lineWidth = 6
    ctx.strokeRect(14, 14, 228, 228)
  })
  const card = new THREE.MeshStandardMaterial({ color: '#d8d0bd', roughness: 0.85 })
  const sleeveMesh = new THREE.Mesh(new THREE.BoxGeometry(sleeve, sleeve, sleeveT), [card, card, card, card, new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 }), card])
  sleeveMesh.name = 'sleeve'
  sleeveMesh.position.set(sleeveAt[0], sleeveAt[1], 0)
  g.add(sleeveMesh)
  const vinyl = new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 0.28 })
  const labelTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#0b0b0c'
    ctx.fillRect(0, 0, 128, 128)
    ctx.fillStyle = shade(color, 0.9)
    ctx.beginPath()
    ctx.arc(64, 64, 64 * (label / r) * 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0b0b0c'
    ctx.beginPath()
    ctx.arc(64, 64, 2, 0, Math.PI * 2)
    ctx.fill()
  })
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 64), [vinyl, new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.4 }), vinyl])
  disc.name = 'disc'
  disc.rotation.x = Math.PI / 2
  disc.position.set(at[0], at[1], sleeveT / 2 + t / 2 + 0.0002)
  g.add(disc)
}

function buildBook(g: THREE.Group, color: THREE.Color, size: readonly [number, number, number]): void {
  const [w, h, d] = size
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
  const pages = new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.9 })
  // BoxGeometry groups: +X (fore-edge), −X (spine), +Y, −Y, +Z (cover), −Z (back board)
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [pages, cloth, pages, pages, cloth, cloth])
  block.name = 'book'
  g.add(block)
}
