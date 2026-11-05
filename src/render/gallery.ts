/**
 * Dev view (`?gallery=1`): every item def's placeholder model under the
 * inspect lighting, front and back, with its hotspots as small pink beads,
 * for self-review in `npm run shots`.
 * Not reachable from the game UI.
 */
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { ITEM_DEFS } from '../data/items'
import { buildPlaceholder } from './items'

export async function runGallery(renderer: THREE.WebGLRenderer, envUrl: string, onReady: () => void): Promise<void> {
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

  // Grid: two items per row, each shown from the front and from the back.
  const cols = 4
  const rows = Math.ceil((ITEM_DEFS.length * 2) / cols)
  const beadMat = new THREE.MeshBasicMaterial({ color: '#ff3d9a' })
  ITEM_DEFS.forEach((def, i) => {
    for (const back of [false, true]) {
      const m = buildPlaceholder({
        placeholder: def.model.placeholder,
        color: def.model.color,
        scale: def.model.scale,
        brand: def.brand,
        hotspots: def.model.hotspots,
      })
      const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3())
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
  camera.position.set(0, 0, 6.4)
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.fov = 30
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
