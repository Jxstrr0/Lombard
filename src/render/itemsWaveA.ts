/**
 * M6 wave A: code-drawn placeholder models for the new categories (instruments, tools,
 * silver & jewellery, household antiques), where no usable CC0 model exists
 * (docs/04-ASSETS.md § Items). Same convention as items.ts: real size in metres,
 * centred at the origin, +Y up, front +Z. Hotspots in the defs sit on these surfaces.
 *
 * Shapes (half extents in brackets, x y z):
 * - accordion [0.2 0.22 0.1]: treble box x −0.2…−0.08, bellows ±0.08, bass box 0.08…0.2, front +Z at 0.09;
 *   emblem "piano" draws a keyboard strip, otherwise treble buttons (bayan, garmon; size with model.scale)
 * - balalaika [0.215 0.33 0.05]: triangular body (base y −0.33, top −0.05), face +Z at 0.012, staved back to −0.045, neck to +0.33
 * - guitar [0.19 0.5 0.05]: body y −0.5…0.0 (face +Z at 0.05), neck to 0.32, headstock to 0.5
 * - eguitar [0.17 0.49 0.025]: solid body y −0.49…−0.05, face +Z at 0.022, neck to 0.33, headstock to 0.49
 * - violin [0.105 0.3 0.032]: body y −0.3…0.056 (top arching to z 0.032), neck and scroll to 0.3 (size with model.scale)
 * - trumpet [0.24 0.08 0.065]: lying on its side, lead pipe along X, bell at +X (r 0.062), valves along ±Y, face +Z
 * - saxophone [0.15 0.35 0.08]: lying on its side, body along Y, neck at +Y, bell bottom-right, keys toward +Z
 * - grinder [0.24 0.07 0.08]: motor along X (r 0.035), gear head at −X with a 125 mm disc under it, cord at +X
 * - perforator [0.19 0.12 0.045]: barrel along X, chuck at −X, D-handle at +X, label on the +Z side
 * - chainsaw [0.36 0.12 0.11]: engine x −0.02…0.2, bar out to −0.36, rear handle to +0.36
 * - socketset [0.21 0.165 0.04]: an open case lying flat, sockets and ratchet up (+Z)
 * - sewing [0.19 0.14 0.09]: base y −0.14…−0.09, pillar at +X, arm along X, needle bar at −X
 * - spoons [0.075 0.07 0.008]: six teaspoons side by side, bowls up (+Z) at −Y, handles to +Y; hallmarks behind (−Z)
 * - glassholder [0.06 0.05 0.045]: tea-glass holder (r 0.036) with a glass, handle at +X, base at −Y
 * - cups [0.09 0.03 0.065]: six vodka cups in a 3 × 2 box, rims up (+Y)
 * - beads [0.07 0.07 0.01]: a loop of beads in XY, clasp at −Y; emblem "pearl" makes them small and even
 * - brooch [0.026 0.021 0.008]: oval cameo in a frame, face +Z, pin behind
 * - cabochon [0.01 0.019 0.003]: an oval stone in a silver bezel, bail at +Y (the gold cross is `pendant`)
 * - samovar [0.2 0.23 0.21]: urn on a foot, tap at +Z, handles at ±X, chimney and crown on top;
 *   emblem "electric" drops the chimney for a lid and a cord socket
 * - figurine [0.07 0.11 0.07]: a shepherdess on a round base, mark under the base (−Y)
 * - vase [0.08 0.125 0.08]: cut crystal on a foot
 * - gramophone [0.22 0.32 0.31]: case y −0.32…−0.2 (front +Z), turntable on top, horn rising behind and opening over the front
 * - block: a plain box of model.size (a CC0 glb loads over it)
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { ModelSpec } from './items'
import { textureAnisotropy } from './perf'

type V3 = [number, number, number]

const std = (color: THREE.ColorRepresentation, roughness = 0.55, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
const metal = (color: THREE.ColorRepresentation, roughness = 0.3) => std(color, roughness, 1)

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], name?: string): THREE.Mesh {
  const me = new THREE.Mesh(geo, m)
  me.position.set(...pos)
  me.rotation.set(...rot)
  if (name) me.name = name
  g.add(me)
  return me
}

const box = (g: THREE.Object3D, s: V3, m: THREE.Material, pos: V3 = [0, 0, 0], r = 0) =>
  add(g, r > 0 ? new RoundedBoxGeometry(s[0], s[1], s[2], 2, r) : new THREE.BoxGeometry(...s), m, pos)

/** A cylinder along an axis. */
function cyl(g: THREE.Object3D, r0: number, r1: number, h: number, m: THREE.Material, pos: V3, axis: 'x' | 'y' | 'z' = 'y', seg = 24): THREE.Mesh {
  const rot: V3 = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  return add(g, new THREE.CylinderGeometry(r0, r1, h, seg), m, pos, rot)
}

/** Lathe a [radius, y] profile around +Y. Double-sided: horns, cups and holders are open shells. */
function lathe(g: THREE.Object3D, pts: readonly [number, number][], m: THREE.Material, pos: V3 = [0, 0, 0], seg = 40): THREE.Mesh {
  m.side = THREE.DoubleSide
  return add(g, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg), m, pos)
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

/** A printed or engraved plate: text centred on a coloured ground. */
function plateTexture(text: string, bg: string, fg: string, font = '700 40px Georgia, serif', w = 256, h = 64): THREE.CanvasTexture {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2 + 2)
  })
}

/** A flat decal facing +Z (or rotated), slightly proud of its surface. */
function decal(g: THREE.Object3D, w: number, h: number, tex: THREE.Texture, pos: V3, rot: V3 = [0, 0, 0], extra: THREE.MeshStandardMaterialParameters = {}): THREE.Mesh {
  return add(g, new THREE.PlaneGeometry(w, h), std('#ffffff', 0.6, 0, { map: tex, ...extra }), pos, rot)
}

/** A closed outline from a half-width profile along Y (t = 0 at y0, 1 at y1), mirrored about X = 0. */
function profileShape(y0: number, y1: number, half: (t: number) => number, n = 48): THREE.Shape {
  const s = new THREE.Shape()
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push([Math.max(half(t), 0.002), y0 + (y1 - y0) * t])
  }
  s.moveTo(-pts[0]![0], pts[0]![1])
  for (const [x, y] of pts) s.lineTo(x, y)
  for (let i = pts.length - 1; i >= 0; i--) s.lineTo(-pts[i]![0], pts[i]![1])
  return s
}

/** Extrude a shape in Z between z0 and z1, with a small rounded edge. */
function slab(g: THREE.Object3D, shape: THREE.Shape, z0: number, z1: number, m: THREE.Material | THREE.Material[], bevel = 0.003): THREE.Mesh {
  const depth = Math.max(0.0005, z1 - z0 - bevel * 2)
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 })
  geo.translate(0, 0, z0 + bevel)
  const me = new THREE.Mesh(geo, m)
  g.add(me)
  return me
}

const lobe = (t: number, c: number, r: number, w: number) => (Math.abs(t - c) >= r ? 0 : w * Math.sqrt(1 - ((t - c) / r) ** 2))

function strings(g: THREE.Object3D, n: number, spread0: number, spread1: number, y0: number, y1: number, z: number, m: THREE.Material): void {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5
    const xa = k * spread0
    const xb = k * spread1
    const len = Math.hypot(xb - xa, y1 - y0)
    const s = add(g, new THREE.CylinderGeometry(0.0005, 0.0005, len, 4), m, [(xa + xb) / 2, (y0 + y1) / 2, z])
    s.rotation.z = -Math.atan2(xb - xa, y1 - y0)
  }
}

function frets(g: THREE.Object3D, y0: number, y1: number, n: number, w: number, z: number, m: THREE.Material): void {
  for (let i = 1; i <= n; i++) {
    // frets close up towards the body, as on the real thing
    const y = y1 - (y1 - y0) * (1 - 0.94 ** i) / (1 - 0.94 ** n)
    box(g, [w, 0.0015, 0.0015], m, [0, y, z])
  }
}

// --- instruments -------------------------------------------------------------------------------

function buildAccordion(g: THREE.Group, color: THREE.Color, brand?: string, emblem?: string): void {
  const shell = std(color, 0.25, 0, { envMapIntensity: 1.2 })
  const dark = std('#1b1a1a', 0.5)
  const ivory = std('#efe9da', 0.35)
  const chrome = metal('#c9c9c4', 0.25)
  // treble and bass boxes
  box(g, [0.12, 0.44, 0.18], shell, [-0.14, 0, 0], 0.01)
  box(g, [0.12, 0.42, 0.17], shell, [0.14, 0, 0], 0.01)
  // bellows: pleats of dark card with paler corner tapes
  for (let i = 0; i < 9; i++) {
    const x = -0.075 + i * 0.01875
    box(g, [0.012, 0.43, 0.175], i % 2 ? dark : std('#2a2422', 0.6), [x, 0, 0])
  }
  for (const [y, z] of [[0.215, 0.087], [-0.215, 0.087], [0.215, -0.087], [-0.215, -0.087]] as const) box(g, [0.16, 0.006, 0.006], ivory, [0, y, z])
  // treble grille with the maker's badge
  box(g, [0.05, 0.2, 0.004], chrome, [-0.105, 0.08, 0.091])
  decal(g, 0.045, 0.014, plateTexture((brand ?? '').toUpperCase(), '#b9b2a2', '#1d1a17', '700 34px Georgia, serif'), [-0.105, 0.08, 0.0935], [0, 0, Math.PI / 2])
  if (emblem === 'piano') {
    // piano keyboard along the treble edge
    box(g, [0.05, 0.38, 0.03], ivory, [-0.175, -0.01, 0.08])
    for (let i = 0; i < 22; i++) box(g, [0.03, 0.009, 0.012], dark, [-0.165, -0.19 + i * 0.0172, 0.1])
  } else {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 14; i++) cyl(g, 0.0045, 0.0045, 0.008, i % 3 === 1 ? dark : ivory, [-0.19 + r * 0.013, -0.17 + i * 0.026 + (r % 2) * 0.013, 0.094], 'z', 12)
  }
  // bass buttons and the strap
  for (let r = 0; r < 4; r++) for (let i = 0; i < 10; i++) cyl(g, 0.0035, 0.0035, 0.006, ivory, [0.12 + r * 0.014, -0.12 + i * 0.024 + (r % 2) * 0.012, 0.088], 'z', 10)
  box(g, [0.03, 0.3, 0.004], std('#3a2418', 0.8), [0.15, 0, -0.088])
}

function buildBalalaika(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const top = std('#d9b57e', 0.5)
  const back = std(color, 0.35)
  const dark = std('#2a1c12', 0.6)
  const shape = profileShape(-0.33, -0.05, (t) => 0.215 * (1 - t) ** 1.05 + 0.012)
  slab(g, shape, -0.004, 0.012, top, 0.002)
  // staved back: a few wedges, darker between
  const backShape = profileShape(-0.328, -0.055, (t) => 0.21 * (1 - t) + 0.008)
  const b = slab(g, backShape, -0.045, -0.002, back, 0.008)
  b.scale.set(1, 1, 1)
  decal(g, 0.055, 0.055, canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#d9b57e'
    ctx.fillRect(0, 0, 128, 128)
    ctx.strokeStyle = '#4a2c18'
    ctx.lineWidth = 6
    for (let i = 0; i < 8; i++) {
      ctx.beginPath()
      ctx.arc(64, 64, 18 + i * 5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#100a06'
    ctx.beginPath()
    ctx.arc(64, 64, 18, 0, Math.PI * 2)
    ctx.fill()
  }), [0, -0.165, 0.0125], [0, 0, 0], { transparent: false })
  // bridge, neck, frets, head
  box(g, [0.05, 0.004, 0.008], std('#e8dcc0', 0.5), [0, -0.29, 0.016])
  box(g, [0.034, 0.3, 0.018], dark, [0, 0.11, 0.0])
  frets(g, -0.04, 0.24, 16, 0.034, 0.0095, metal('#c9c5bc', 0.3))
  box(g, [0.06, 0.08, 0.016], dark, [0, 0.29, 0])
  for (const x of [-0.02, 0, 0.02]) cyl(g, 0.004, 0.004, 0.012, metal('#cfc8b8'), [x, 0.3, 0.012], 'z', 10)
  strings(g, 3, 0.03, 0.02, -0.29, 0.28, 0.013, metal('#dedbd2', 0.2))
  // the maker's label inside, seen through the rosette
  if (brand) decal(g, 0.02, 0.008, plateTexture(brand, '#e7dcc0', '#2a1c12', '700 30px Georgia, serif'), [0, -0.165, 0.0128])
}

function buildGuitar(g: THREE.Group, color: THREE.Color): void {
  const top = std(color, 0.35)
  const sides = std(new THREE.Color(color).multiplyScalar(0.55), 0.4)
  const dark = std('#24170f', 0.6)
  const shape = profileShape(-0.5, 0.0, (t) => Math.max(lobe(t, 0.28, 0.29, 0.19), lobe(t, 0.73, 0.28, 0.145), t > 0.4 && t < 0.62 ? 0.12 : 0))
  slab(g, shape, -0.05, 0.05, [top, sides], 0.004)
  decal(g, 0.1, 0.1, canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    ctx.strokeStyle = '#2b1a10'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(64, 64, 52, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#0d0805'
    ctx.beginPath()
    ctx.arc(64, 64, 42, 0, Math.PI * 2)
    ctx.fill()
  }), [0, -0.17, 0.0505], [0, 0, 0], { transparent: true })
  box(g, [0.11, 0.022, 0.008], dark, [0, -0.39, 0.054])
  box(g, [0.05, 0.34, 0.02], dark, [0, 0.16, 0.035])
  frets(g, 0.0, 0.32, 18, 0.05, 0.0455, metal('#c9c5bc', 0.3))
  box(g, [0.075, 0.17, 0.016], dark, [0, 0.41, 0.03])
  for (let i = 0; i < 7; i++) cyl(g, 0.004, 0.004, 0.02, metal('#d6cfbf'), [i % 2 ? 0.045 : -0.045, 0.35 + i * 0.019, 0.03], 'x', 8)
  strings(g, 7, 0.05, 0.045, -0.39, 0.35, 0.0475, metal('#dedbd2', 0.2))
}

function buildEguitar(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const paint = std(color, 0.22)
  const dark = std('#1e1a17', 0.55)
  const chrome = metal('#d4d4d0', 0.2)
  const shape = profileShape(-0.49, -0.05, (t) => Math.max(lobe(t, 0.32, 0.33, 0.165), lobe(t, 0.78, 0.24, 0.13)) * (1 - 0.15 * Math.sin(t * 9)))
  slab(g, shape, -0.022, 0.022, paint, 0.004)
  box(g, [0.15, 0.2, 0.002], std('#f1ede4', 0.4), [0.01, -0.24, 0.0225])
  for (const y of [-0.17, -0.25]) box(g, [0.075, 0.02, 0.006], dark, [0, y, 0.026])
  box(g, [0.08, 0.012, 0.006], chrome, [0, -0.33, 0.026])
  for (let i = 0; i < 3; i++) cyl(g, 0.007, 0.007, 0.012, chrome, [0.07 + (i % 2) * 0.02, -0.33 - i * 0.03, 0.028], 'z', 14)
  box(g, [0.046, 0.38, 0.02], std('#5a3a22', 0.5), [0, 0.13, 0.012])
  frets(g, -0.05, 0.31, 21, 0.046, 0.0225, chrome)
  box(g, [0.07, 0.16, 0.014], dark, [0, 0.41, 0.006])
  if (brand) decal(g, 0.055, 0.014, plateTexture(brand, '#1e1a17', '#e9e3d4', 'italic 700 38px Georgia, serif'), [0, 0.43, 0.0135])
  for (let i = 0; i < 6; i++) cyl(g, 0.004, 0.004, 0.02, chrome, [0.04, 0.35 + i * 0.022, 0.006], 'x', 8)
  // neck plate behind
  box(g, [0.06, 0.06, 0.002], chrome, [0, -0.08, -0.0225])
  strings(g, 6, 0.045, 0.04, -0.33, 0.35, 0.03, std('#dedbd2', 0.2, 1))
}

function buildViolin(g: THREE.Group, color: THREE.Color): void {
  const varnish = std(color, 0.18, 0, { envMapIntensity: 1.3 })
  const ebony = std('#0f0c0a', 0.35)
  const shape = profileShape(-0.3, 0.056, (t) => Math.max(lobe(t, 0.22, 0.23, 0.103), lobe(t, 0.78, 0.23, 0.083), t > 0.38 && t < 0.62 ? 0.058 : 0))
  // top and back arch: two slabs, the middle raised
  slab(g, shape, -0.02, 0.02, varnish, 0.006)
  const arch = slab(g, shape, 0.0, 0.032, varnish, 0.01)
  arch.scale.set(0.8, 0.9, 1)
  const archB = slab(g, shape, -0.032, 0.0, varnish, 0.01)
  archB.scale.set(0.8, 0.9, 1)
  // f-holes
  const f = canvasTexture(64, 256, (ctx) => {
    ctx.clearRect(0, 0, 64, 256)
    ctx.strokeStyle = '#0a0605'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(40, 20)
    ctx.bezierCurveTo(10, 90, 54, 160, 24, 236)
    ctx.stroke()
  })
  for (const s of [-1, 1]) decal(g, 0.012, 0.07, f, [s * 0.036, -0.13, 0.0325], [0, s < 0 ? Math.PI : 0, 0], { transparent: true, side: THREE.DoubleSide })
  // fingerboard, tailpiece, bridge, chinrest, neck, pegbox and scroll
  box(g, [0.03, 0.27, 0.008], ebony, [0, 0.09, 0.036])
  box(g, [0.035, 0.11, 0.008], ebony, [0, -0.24, 0.033])
  box(g, [0.04, 0.003, 0.02], std('#e7d8b8', 0.5), [0, -0.165, 0.042])
  box(g, [0.06, 0.04, 0.012], ebony, [0.03, -0.29, 0.03], 0.004)
  box(g, [0.024, 0.16, 0.02], varnish, [0, 0.13, 0.018])
  box(g, [0.022, 0.06, 0.02], varnish, [0, 0.24, 0.02])
  add(g, new THREE.TorusGeometry(0.012, 0.006, 8, 18), varnish, [0, 0.28, 0.02], [0, Math.PI / 2, 0])
  for (let i = 0; i < 4; i++) cyl(g, 0.003, 0.003, 0.035, ebony, [0, 0.22 + i * 0.014, 0.02], 'x', 8)
  strings(g, 4, 0.03, 0.018, -0.2, 0.22, 0.044, std('#bdb8ad', 0.3, 1))
}

/** A tube along a list of points (brass work). */
function tube(g: THREE.Object3D, pts: V3[], r: number, m: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2)
  return add(g, new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), r, 10, false), m)
}

function buildTrumpet(g: THREE.Group, color: THREE.Color): void {
  const brass = metal(color, 0.18)
  // bell: lathe along +X
  const bell = lathe(g, [[0.0065, -0.24], [0.0075, -0.1], [0.012, 0.0], [0.024, 0.06], [0.045, 0.085], [0.062, 0.095], [0.06, 0.096]], brass, [0.145, 0, 0])
  bell.rotation.z = -Math.PI / 2
  bell.position.set(0.145, 0.03, 0)
  // lead pipe and the main slide below
  tube(g, [[-0.24, 0.0, 0], [-0.1, -0.005, 0], [0.0, -0.025, 0], [0.04, -0.04, 0]], 0.005, brass)
  tube(g, [[0.04, -0.04, 0], [0.09, -0.045, 0], [0.11, -0.025, 0], [0.09, -0.005, 0], [-0.05, 0.0, 0]], 0.006, brass)
  cyl(g, 0.009, 0.005, 0.03, brass, [-0.235, 0.0, 0], 'x', 16)
  // three valves with finger buttons
  for (let i = 0; i < 3; i++) {
    const x = -0.03 + i * 0.024
    cyl(g, 0.0085, 0.0085, 0.09, brass, [x, 0.01, 0], 'y', 18)
    cyl(g, 0.007, 0.007, 0.02, std('#eeeae0', 0.25), [x, 0.07, 0], 'y', 18)
    cyl(g, 0.009, 0.009, 0.006, brass, [x, -0.04, 0], 'y', 18)
  }
}

function buildSaxophone(g: THREE.Group, color: THREE.Color): void {
  const brass = metal(color, 0.2)
  const pearl = std('#efe9df', 0.2)
  // body: a widening tube down, then the U-bend and the bell up the right side
  const body = new THREE.CatmullRomCurve3(
    ([[0.0, 0.25, 0], [0.0, 0.0, 0], [0.0, -0.22, 0], [0.04, -0.31, 0], [0.09, -0.27, 0], [0.1, -0.15, 0]] as V3[]).map((p) => new THREE.Vector3(...p)),
  )
  const geo = new THREE.TubeGeometry(body, 60, 1, 14, false)
  // taper the radius along the tube
  const pos = geo.attributes.position as THREE.BufferAttribute
  const tmp = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 15) / 60
    const p = body.getPointAt(Math.min(1, seg))
    tmp.fromBufferAttribute(pos, i).sub(p)
    tmp.setLength(0.011 + seg * 0.03)
    pos.setXYZ(i, p.x + tmp.x, p.y + tmp.y, p.z + tmp.z)
  }
  geo.computeVertexNormals()
  add(g, geo, brass)
  const bell = lathe(g, [[0.04, 0], [0.05, 0.05], [0.075, 0.09], [0.075, 0.093]], brass, [0.1, -0.15, 0])
  bell.rotation.z = 0
  // neck and mouthpiece
  tube(g, [[0.0, 0.25, 0], [0.0, 0.3, 0], [-0.03, 0.335, 0], [-0.07, 0.34, 0]], 0.007, brass)
  cyl(g, 0.006, 0.008, 0.035, std('#1a1817', 0.4), [-0.085, 0.34, 0], 'x', 12)
  // key cups and pearls toward +Z
  for (let i = 0; i < 9; i++) {
    const y = 0.2 - i * 0.045
    cyl(g, 0.009, 0.009, 0.004, brass, [0.0, y, 0.024], 'z', 14)
    if (i % 2 === 0) cyl(g, 0.006, 0.006, 0.004, pearl, [-0.004, y + 0.01, 0.03], 'z', 12)
  }
}

// --- tools ---------------------------------------------------------------------------------------

function sticker(g: THREE.Object3D, text: string, w: number, h: number, pos: V3, bg: string, fg: string, rot: V3 = [0, 0, 0]): void {
  decal(g, w, h, plateTexture(text, bg, fg, '800 40px Arial, sans-serif'), pos, rot)
}

function buildGrinder(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const body = std(color, 0.45)
  const black = std('#1c1c1c', 0.6)
  const steel = metal('#9ea3a6', 0.35)
  cyl(g, 0.034, 0.036, 0.2, body, [0.02, 0, 0], 'x', 24)
  cyl(g, 0.028, 0.03, 0.08, black, [0.15, 0, 0], 'x', 20)
  box(g, [0.07, 0.06, 0.06], steel, [-0.11, 0.0, 0], 0.01)
  // disc and guard under the gear head
  cyl(g, 0.0625, 0.0625, 0.003, std('#5b5a57', 0.8), [-0.11, -0.05, 0], 'y', 36)
  add(g, new THREE.CylinderGeometry(0.066, 0.066, 0.02, 32, 1, true, 0, Math.PI), steel, [-0.11, -0.04, 0], [0, Math.PI / 2, 0])
  cyl(g, 0.01, 0.01, 0.06, black, [-0.11, 0.0, 0.05], 'z', 12)
  box(g, [0.06, 0.012, 0.01], black, [0.04, 0.034, 0.0])
  cyl(g, 0.004, 0.004, 0.06, black, [0.21, 0, 0], 'x', 8)
  if (brand) sticker(g, brand.toUpperCase(), 0.08, 0.02, [0.02, 0, 0.0365], '#1c1c1c', '#f3f1ea')
}

function buildPerforator(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const body = std(color, 0.45)
  const black = std('#1c1c1c', 0.6)
  box(g, [0.24, 0.09, 0.075], body, [-0.02, 0.03, 0], 0.02)
  cyl(g, 0.022, 0.026, 0.07, black, [-0.17, 0.03, 0], 'x', 20)
  cyl(g, 0.006, 0.006, 0.05, metal('#9ea3a6'), [-0.22, 0.03, 0], 'x', 10)
  // D-handle and the trigger
  box(g, [0.035, 0.15, 0.04], black, [0.15, -0.03, 0], 0.012)
  box(g, [0.08, 0.03, 0.04], black, [0.12, -0.095, 0], 0.01)
  box(g, [0.012, 0.03, 0.02], std('#c03a2b', 0.5), [0.125, 0.0, 0])
  box(g, [0.05, 0.05, 0.08], black, [0.02, -0.04, 0], 0.01)
  if (brand) sticker(g, brand.toUpperCase(), 0.1, 0.024, [-0.02, 0.035, 0.038], '#1c1c1c', '#f3f1ea')
}

function buildChainsaw(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const body = std(color, 0.45)
  const black = std('#1c1c1c', 0.6)
  const steel = metal('#a7acae', 0.3)
  box(g, [0.22, 0.2, 0.2], body, [0.09, 0.01, 0], 0.03)
  // bar and chain
  box(g, [0.38, 0.06, 0.006], steel, [-0.17, -0.02, 0], 0.003)
  box(g, [0.38, 0.068, 0.004], std('#4c4c4a', 0.5, 1), [-0.17, -0.02, 0.004])
  // top handle, rear handle, starter
  tube(g, [[0.02, 0.1, 0.09], [0.0, 0.12, 0.0], [0.02, 0.1, -0.09]], 0.011, black)
  box(g, [0.15, 0.03, 0.035], black, [0.27, 0.0, 0], 0.01)
  cyl(g, 0.045, 0.045, 0.02, black, [0.1, 0.03, 0.105], 'z', 24)
  cyl(g, 0.012, 0.012, 0.012, std('#d9b43c', 0.5), [0.17, 0.1, 0.06], 'y', 14)
  if (brand) sticker(g, brand.toUpperCase(), 0.12, 0.03, [0.09, -0.04, 0.1005], color.getHexString() === 'ffffff' ? '#222' : '#f3f1ea', '#1c1c1c')
}

function buildSocketSet(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const caseM = std(color, 0.5)
  const foam = std('#222222', 0.9)
  const chrome = metal('#d7d9da', 0.18)
  box(g, [0.42, 0.33, 0.05], caseM, [0, 0, -0.015], 0.01)
  box(g, [0.4, 0.31, 0.004], foam, [0, 0, 0.0105])
  // the ratchet and an extension bar
  box(g, [0.2, 0.022, 0.012], chrome, [-0.06, 0.12, 0.02], 0.005)
  cyl(g, 0.018, 0.018, 0.014, chrome, [0.05, 0.12, 0.02], 'z', 20)
  cyl(g, 0.006, 0.006, 0.15, chrome, [0.1, 0.07, 0.018], 'x', 10)
  // rows of sockets, standing up
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 11; i++) {
      const rr = 0.007 + r * 0.0025 + i * 0.0004
      cyl(g, rr, rr, 0.025, chrome, [-0.17 + i * 0.033, 0.025 - r * 0.055, 0.025], 'z', 12)
    }
  }
  if (brand) sticker(g, brand.toUpperCase(), 0.1, 0.025, [0.13, -0.14, 0.0135], '#1c1c1c', '#f3f1ea')
}

function buildSewing(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const paint = std(color, 0.3)
  const chrome = metal('#cfd2d2', 0.2)
  box(g, [0.38, 0.05, 0.18], paint, [0, -0.115, 0], 0.01)
  box(g, [0.2, 0.002, 0.1], chrome, [-0.05, -0.089, 0.02])
  box(g, [0.07, 0.17, 0.1], paint, [0.14, -0.005, 0], 0.02)
  box(g, [0.3, 0.06, 0.09], paint, [0.0, 0.1, 0], 0.025)
  box(g, [0.05, 0.08, 0.08], paint, [-0.135, 0.05, 0], 0.015)
  cyl(g, 0.002, 0.002, 0.06, chrome, [-0.135, -0.03, 0.02], 'y', 6)
  // hand wheel at the right, spool pin on top
  cyl(g, 0.045, 0.045, 0.02, chrome, [0.185, 0.07, 0], 'x', 28)
  cyl(g, 0.003, 0.003, 0.03, chrome, [0.05, 0.145, 0], 'y', 6)
  cyl(g, 0.01, 0.01, 0.02, std('#b8322a', 0.6), [0.05, 0.14, 0], 'y', 14)
  if (brand) decal(g, 0.16, 0.03, plateTexture(brand, color.getStyle(), '#e8d9a8', 'italic 700 40px Georgia, serif', 320, 64), [0.0, 0.1, 0.0455])
}

// --- silver & jewellery -------------------------------------------------------------------------

function buildSpoons(g: THREE.Group, color: THREE.Color): void {
  const silver = metal(color, 0.22)
  const velvet = std('#3b1420', 0.95)
  box(g, [0.15, 0.14, 0.004], velvet, [0, 0, -0.005])
  for (let i = 0; i < 6; i++) {
    const x = -0.0625 + i * 0.025
    const sp = new THREE.Group()
    // bowl: a squashed half sphere, hollow side up
    const bowl = add(sp, new THREE.SphereGeometry(0.011, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), silver, [0, -0.045, 0.004])
    bowl.scale.set(0.8, 1.35, 0.5)
    box(sp, [0.004, 0.085, 0.0018], silver, [0, 0.015, 0.0015])
    const tip = add(sp, new THREE.CircleGeometry(0.006, 16), silver, [0, 0.058, 0.0026])
    tip.scale.set(1, 1.3, 1)
    sp.position.x = x
    g.add(sp)
  }
}

function buildGlassHolder(g: THREE.Group, color: THREE.Color): void {
  const silver = metal(color, 0.25)
  // pierced holder: a lathe body with a few vertical slots drawn as darker bands
  lathe(g, [[0.03, -0.05], [0.034, -0.046], [0.031, -0.04], [0.034, 0.02], [0.037, 0.03], [0.036, 0.032], [0.034, 0.031]], silver, [0, 0, 0], 40)
  // the glass
  const glass = std('#e8f2f2', 0.05, 0, { transparent: true, opacity: 0.35, envMapIntensity: 1.5 })
  lathe(g, [[0.028, -0.04], [0.031, 0.04], [0.032, 0.05]], glass, [0, 0, 0], 24)
  // handle at +X
  tube(g, [[0.034, 0.02, 0], [0.055, 0.015, 0], [0.058, -0.015, 0], [0.034, -0.03, 0]], 0.004, silver)
  // a raised medallion on the front
  cyl(g, 0.012, 0.012, 0.003, silver, [0, -0.005, 0.034], 'z', 20)
}

function buildCups(g: THREE.Group, color: THREE.Color): void {
  const silver = metal(color, 0.22)
  const gilt = metal('#d8b15e', 0.25)
  box(g, [0.18, 0.012, 0.13], std('#5a1a22', 0.9), [0, -0.024, 0])
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 3; i++) {
      const p: V3 = [-0.055 + i * 0.055, -0.018, -0.03 + r * 0.06]
      lathe(g, [[0.012, 0], [0.013, 0.004], [0.006, 0.008], [0.006, 0.012], [0.016, 0.03], [0.0175, 0.042]], silver, p, 28)
      lathe(g, [[0.0172, 0.04], [0.0178, 0.043]], gilt, p, 28)
    }
  }
}

function buildBeads(g: THREE.Group, color: THREE.Color, emblem?: string): void {
  const pearl = emblem === 'pearl'
  const m = pearl ? std(color, 0.18, 0, { envMapIntensity: 1.4 }) : std(color, 0.15, 0, { transparent: true, opacity: 0.92, envMapIntensity: 1.3 })
  const n = pearl ? 64 : 34
  const geo = new THREE.SphereGeometry(1, 14, 10)
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) / n) * Math.PI * 2
    // graduated amber (big at the front), even pearls
    const k = pearl ? 0.0035 : 0.0045 + 0.004 * (0.5 - 0.5 * Math.cos(a + Math.PI / 2 + Math.PI))
    const b = add(g, geo, m, [Math.cos(a) * 0.055, Math.sin(a) * 0.06 + 0.005, 0])
    b.scale.set(k, k, pearl ? k : k * 0.8)
    if (!pearl && i % 4 === 0) b.material = std(new THREE.Color(color).multiplyScalar(0.75), 0.15, 0, { transparent: true, opacity: 0.92 })
  }
  // clasp at −Y
  add(g, new THREE.TorusGeometry(0.004, 0.0012, 6, 14), metal(pearl ? '#d9d6cf' : '#d8b15e', 0.25), [0, -0.058, 0])
}

function buildBrooch(g: THREE.Group, color: THREE.Color): void {
  const silver = metal(color, 0.25)
  const frame = add(g, new THREE.TorusGeometry(0.02, 0.0022, 8, 40), silver)
  frame.scale.set(1.1, 0.88, 1)
  const ground = add(g, new THREE.CircleGeometry(0.02, 32), std('#c97b55', 0.5), [0, 0, 0.0005])
  ground.scale.set(1.1, 0.88, 1)
  // the carved profile: a pale relief
  const face = canvasTexture(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128)
    ctx.fillStyle = '#f4ece2'
    ctx.beginPath()
    ctx.ellipse(66, 64, 26, 36, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(56, 30, 24, 16, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e7d9ca'
    ctx.fillRect(50, 92, 26, 24)
  })
  const relief = add(g, new THREE.CircleGeometry(0.018, 32), std('#ffffff', 0.45, 0, { map: face, transparent: true }), [0, 0, 0.0025])
  relief.scale.set(1.1, 0.88, 1)
  cyl(g, 0.0006, 0.0006, 0.04, silver, [0, 0.004, -0.004], 'x', 6)
}

/** An oval stone in a plain silver bezel with a bail on top (amber, agate). */
function buildCabochon(g: THREE.Group, color: THREE.Color): void {
  const silver = metal('#cdd0d2', 0.25)
  const bezel = add(g, new THREE.TorusGeometry(0.008, 0.0011, 8, 32), silver)
  bezel.scale.set(1, 1.35, 1)
  const back = add(g, new THREE.CircleGeometry(0.0085, 28), silver, [0, 0, -0.0011], [0, Math.PI, 0], 'back')
  back.scale.set(1, 1.35, 1)
  const stone = add(g, new THREE.SphereGeometry(0.0078, 24, 14), std(color, 0.12, 0, { transparent: true, opacity: 0.93, envMapIntensity: 1.4 }), [0, 0, 0], [0, 0, 0], 'front')
  stone.scale.set(1, 1.35, 0.38)
  add(g, new THREE.TorusGeometry(0.0021, 0.00055, 6, 16), silver, [0, 0.0168, 0], [0, Math.PI / 2, 0], 'bail')
}

// --- antiques ---------------------------------------------------------------------------------------

function buildSamovar(g: THREE.Group, color: THREE.Color, emblem?: string): void {
  const brass = metal(color, 0.22)
  const wood = std('#2b1a10', 0.5)
  const electric = emblem === 'electric'
  // foot, neck, urn
  lathe(g, [[0.0, -0.23], [0.1, -0.23], [0.105, -0.215], [0.06, -0.2], [0.05, -0.17], [0.075, -0.15], [0.14, -0.1], [0.155, -0.02], [0.15, 0.06], [0.12, 0.1], [0.07, 0.11], [0.0, 0.11]], brass, [0, 0, 0], 48)
  if (electric) {
    lathe(g, [[0.07, 0.11], [0.072, 0.13], [0.04, 0.15], [0.012, 0.155], [0.012, 0.17], [0.0, 0.17]], brass, [0, 0, 0], 32)
    cyl(g, 0.012, 0.012, 0.03, std('#1c1c1c', 0.5), [-0.1, -0.12, 0.08], 'z', 14)
  } else {
    // chimney and crown
    cyl(g, 0.03, 0.03, 0.08, brass, [0, 0.15, 0], 'y', 24)
    lathe(g, [[0.03, 0.19], [0.05, 0.2], [0.035, 0.22], [0.035, 0.23], [0.0, 0.23]], brass, [0, 0, 0], 24)
    // the row of struck medals
    for (let i = 0; i < 5; i++) {
      const a = -0.5 + i * 0.25
      add(g, new THREE.CircleGeometry(0.011, 18), metal('#d9b866', 0.3), [Math.sin(a) * 0.1545, 0.03, Math.cos(a) * 0.1545]).lookAt(Math.sin(a) * 2, 0.03, Math.cos(a) * 2)
    }
  }
  // tap at the front with its key
  cyl(g, 0.01, 0.008, 0.06, brass, [0, -0.06, 0.18], 'z', 14)
  box(g, [0.03, 0.008, 0.006], brass, [0, -0.045, 0.2])
  // handles at the sides
  for (const s of [-1, 1]) {
    box(g, [0.04, 0.012, 0.012], brass, [s * 0.165, 0.08, 0])
    cyl(g, 0.009, 0.009, 0.05, wood, [s * 0.19, 0.08, 0], 'z', 12)
  }
}

function buildFigurine(g: THREE.Group, color: THREE.Color): void {
  const glaze = std(color, 0.15, 0, { envMapIntensity: 1.3 })
  const pale = std('#f6f1e9', 0.15)
  const gilt = metal('#d8b15e', 0.25)
  lathe(g, [[0.0, -0.11], [0.05, -0.11], [0.052, -0.1], [0.05, -0.095], [0.0, -0.095]], pale, [0, 0, 0], 40)
  lathe(g, [[0.0505, -0.101], [0.0515, -0.099]], gilt, [0, 0, 0], 40)
  // skirt, bodice, head, hat brim
  lathe(g, [[0.045, -0.095], [0.042, -0.06], [0.03, -0.01], [0.018, 0.02], [0.0, 0.02]], glaze, [0, 0, 0], 32)
  lathe(g, [[0.018, 0.02], [0.015, 0.05], [0.009, 0.06], [0.0, 0.06]], pale, [0, 0, 0], 24)
  add(g, new THREE.SphereGeometry(0.012, 16, 12), pale, [0, 0.074, 0.002])
  cyl(g, 0.024, 0.024, 0.0025, glaze, [0, 0.084, 0], 'y', 24).rotation.x = -0.25
  // crook and a lamb at her feet
  cyl(g, 0.0018, 0.0018, 0.14, gilt, [0.035, -0.03, 0.02], 'y', 6).rotation.z = -0.1
  add(g, new THREE.SphereGeometry(0.016, 12, 8), pale, [-0.03, -0.085, 0.03]).scale.set(1.2, 0.8, 0.9)
}

function buildVase(g: THREE.Group, color: THREE.Color): void {
  const crystal = std(color, 0.04, 0, { transparent: true, opacity: 0.55, envMapIntensity: 2, flatShading: true })
  // few lathe segments: the flat facets read as cuts
  lathe(g, [[0.0, -0.125], [0.05, -0.125], [0.052, -0.118], [0.022, -0.105], [0.03, -0.09], [0.07, -0.04], [0.075, 0.0], [0.06, 0.06], [0.045, 0.1], [0.055, 0.12], [0.058, 0.125]], crystal, [0, 0, 0], 16)
  // a band of diamond cuts as a ring of small flat boxes
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const d = box(g, [0.018, 0.018, 0.004], crystal, [Math.sin(a) * 0.074, -0.01, Math.cos(a) * 0.074])
    d.rotation.set(0, a, Math.PI / 4)
  }
}

function buildGramophone(g: THREE.Group, color: THREE.Color, brand?: string): void {
  const wood = std('#5a3218', 0.45)
  const horn = metal(color, 0.22)
  const black = std('#151313', 0.4)
  box(g, [0.33, 0.12, 0.33], wood, [0, -0.26, 0], 0.006)
  cyl(g, 0.13, 0.13, 0.008, std('#2a3a22', 0.9), [0, -0.195, 0.02], 'y', 40)
  cyl(g, 0.12, 0.12, 0.003, black, [0, -0.19, 0.02], 'y', 40)
  // winding crank at +X
  cyl(g, 0.004, 0.004, 0.05, metal('#b8b4aa'), [0.19, -0.26, 0], 'x', 8)
  box(g, [0.006, 0.05, 0.006], metal('#b8b4aa'), [0.215, -0.24, 0])
  // horn elbow at the back: a brass post on the case with a ball joint; the tone arm and the horn both leave it
  cyl(g, 0.02, 0.024, 0.03, horn, [0, -0.185, -0.13], 'y', 20)
  add(g, new THREE.SphereGeometry(0.026, 20, 14), horn, [0, -0.168, -0.13])
  // tone arm from the elbow, sound box over the record
  tube(g, [[0, -0.168, -0.13], [0.035, -0.158, -0.05], [0.07, -0.17, 0.05]], 0.009, horn)
  cyl(g, 0.025, 0.025, 0.012, horn, [0.07, -0.175, 0.06], 'z', 20)
  // the horn grows out of the elbow, rises at the back and opens towards the front
  const h = new THREE.Group()
  lathe(h, [[0.017, 0], [0.022, 0.15], [0.045, 0.3], [0.09, 0.42], [0.165, 0.47], [0.17, 0.475]], horn, [0, 0, 0], 32)
  // tipped forward 43°, so the mouth looks up and out over the record rather than hiding it
  h.rotation.x = 0.75
  h.position.set(0, -0.17, -0.13)
  g.add(h)
  if (brand) decal(g, 0.1, 0.025, plateTexture(brand, '#5a3218', '#e2c98a', 'italic 700 38px Georgia, serif'), [0, -0.26, 0.1655])
}

function buildBlock(g: THREE.Group, color: THREE.Color, size?: readonly [number, number, number]): void {
  const s = size ?? [0.1, 0.1, 0.1]
  box(g, [s[0] * 0.9, s[1] * 0.9, s[2] * 0.9], std(color, 0.6), [0, 0, 0], Math.min(...s) * 0.1)
}

/** Builds a wave A kind into `g`; false if `spec` is not one of them. */
export function buildWaveA(g: THREE.Group, spec: ModelSpec): boolean {
  const color = new THREE.Color(spec.color)
  switch (spec.placeholder) {
    case 'accordion':
      buildAccordion(g, color, spec.brand, spec.emblem)
      return true
    case 'balalaika':
      buildBalalaika(g, color, spec.brand)
      return true
    case 'guitar':
      buildGuitar(g, color)
      return true
    case 'eguitar':
      buildEguitar(g, color, spec.brand)
      return true
    case 'violin':
      buildViolin(g, color)
      return true
    case 'trumpet':
      buildTrumpet(g, color)
      return true
    case 'saxophone':
      buildSaxophone(g, color)
      return true
    case 'grinder':
      buildGrinder(g, color, spec.brand)
      return true
    case 'perforator':
      buildPerforator(g, color, spec.brand)
      return true
    case 'chainsaw':
      buildChainsaw(g, color, spec.brand)
      return true
    case 'socketset':
      buildSocketSet(g, color, spec.brand)
      return true
    case 'sewing':
      buildSewing(g, color, spec.brand)
      return true
    case 'spoons':
      buildSpoons(g, color)
      return true
    case 'glassholder':
      buildGlassHolder(g, color)
      return true
    case 'cups':
      buildCups(g, color)
      return true
    case 'beads':
      buildBeads(g, color, spec.emblem)
      return true
    case 'brooch':
      buildBrooch(g, color)
      return true
    case 'cabochon':
      buildCabochon(g, color)
      return true
    case 'samovar':
      buildSamovar(g, color, spec.emblem)
      return true
    case 'figurine':
      buildFigurine(g, color)
      return true
    case 'vase':
      buildVase(g, color)
      return true
    case 'gramophone':
      buildGramophone(g, color, spec.brand)
      return true
    case 'block':
      buildBlock(g, color, spec.size)
      return true
    default:
      return false
  }
}
