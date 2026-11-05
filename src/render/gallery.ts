/**
 * Dev view (`?gallery=1`): every item def's model (its scripted glb where it
 * has one, else the placeholder; `&noglb=1` forces placeholders) under the
 * inspect lighting, front and back, with its hotspots as small pink beads,
 * for self-review in `npm run shots`. `&item=<id>` shows one item large, which
 * is how a scripted model is reviewed on a phone.
 * Not reachable from the game UI.
 */
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { ITEM_DEFS } from '../data/items'
import { buildPlaceholder, specOf, swapInGlb } from './items'
import type { GlbLoader } from './loaders'

export async function runGallery(
  renderer: THREE.WebGLRenderer,
  envUrl: string,
  loadGlb: GlbLoader | undefined,
  onReady: () => void,
  only?: string,
): Promise<void> {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#141413')
  try {
    const hdr = await new HDRLoader().loadAsync(envUrl)
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromEquirectangular(hdr).texture
    scene.environmentIntensity = 1
    hdr.dispose()
    pmrem.dispose()
  } catch (err) {
    console.warn('[gallery] no env', err)
  }
  const key = new THREE.DirectionalLight('#fff4e6', 1.9)
  key.position.set(1, 1.4, 2)
  const rim = new THREE.PointLight('#ffc98a', 0.4, 4.5, 1.6)
  rim.position.set(-0.5, 0.3, -0.4)
  scene.add(key, rim)

  // Grid: three items per row, each shown from the front and from the back.
  // `&item=<id>` shows just that one, large (stacked on a portrait screen).
  const defs = only ? ITEM_DEFS.filter((d) => d.id === only) : ITEM_DEFS
  if (defs.length === 0) console.warn('[gallery] no item def', only)
  const cols = only ? (window.innerWidth < window.innerHeight ? 1 : 2) : 6
  const rows = Math.max(1, Math.ceil((defs.length * 2) / cols))
  const beadMat = new THREE.MeshBasicMaterial({ color: '#ff3d9a' })
  const glbs = new Map<string, THREE.Group | null>()
  await Promise.all(
    defs.map(async (def) => {
      const file = def.model.glb
      if (!file || !loadGlb) return
      try {
        glbs.set(def.id, await loadGlb(file))
      } catch (err) {
        console.warn('[gallery] glb failed', file, err)
      }
    }),
  )
  defs.forEach((def, i) => {
    for (const back of [false, true]) {
      const m = buildPlaceholder(specOf(def))
      const glb = glbs.get(def.id)
      if (glb) swapInGlb(m, back ? glb.clone() : glb)
      m.updateMatrixWorld(true)
      const size = new THREE.Box3().setFromObject(m.getObjectByName('glb') ?? m).getSize(new THREE.Vector3())
      const k = 0.42 / Math.max(size.x, size.y, size.z)
      for (const h of def.model.hotspots) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.012 / k, 8, 6), beadMat)
        bead.position.set(...h.position)
        m.add(bead)
      }
      const holder = new THREE.Group()
      holder.add(m)
      holder.scale.setScalar(k)
      const slot = i * 2 + (back ? 1 : 0)
      const col = slot % cols
      const row = Math.floor(slot / cols)
      holder.position.set((col - (cols - 1) / 2) * 0.5, -(row - (rows - 1) / 2) * 0.55, 0)
      holder.rotation.set(back ? 0.25 : 0.3, back ? Math.PI + 0.5 : -0.5, 0)
      scene.add(holder)
    }
  })
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  const gridW = cols * 0.5
  const gridH = rows * 0.55
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.fov = 30
    // Back off until the whole grid fits.
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    camera.position.set(0, 0, Math.max(gridH / 2 / t, gridW / 2 / (t * camera.aspect)) * 1.04)
    camera.updateProjectionMatrix()
  }
  resize()
  window.addEventListener('resize', resize)
  let frames = 0
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera)
    if (++frames === 3) onReady()
  })
}
