/**
 * Dev view (`?gallery=1`): every placeholder model side by side under the
 * inspect lighting, front and back, for self-review in `npm run shots`.
 * Not reachable from the game UI.
 */
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { PLACEHOLDER_MODELS } from '../game/schema/item'
import { buildPlaceholder, type PlaceholderKind } from './items'

const SAMPLE: Record<PlaceholderKind, { color: string; brand?: string; size: number }> = {
  ring: { color: '#d4a64a', size: 0.022 },
  signet: { color: '#c99a3e', size: 0.026 },
  chain: { color: '#d8ae52', size: 0.055 },
  earrings: { color: '#d4a64a', size: 0.035 },
  watch: { color: '#c0c3c6', brand: 'Pobeda', size: 0.2 },
  phone: { color: '#8a8d93', brand: 'Mangosteen', size: 0.13 },
}

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

  // Grid: one column per kind (2 per row), front view on the left, back on the right.
  const cell = 1
  const cols = 2
  PLACEHOLDER_MODELS.forEach((kind, i) => {
    const s = SAMPLE[kind]
    const k = (cell * 0.36) / s.size
    for (const back of [false, true]) {
      const m = buildPlaceholder({ placeholder: kind, color: s.color, brand: s.brand })
      m.scale.setScalar(k)
      const col = (i % cols) * 2 + (back ? 1 : 0)
      const row = Math.floor(i / cols)
      m.position.set((col - 1.5) * cell * 0.5, -(row - 1) * cell * 0.62, 0)
      m.rotation.set(back ? 0.25 : 0.3, back ? Math.PI + 0.5 : -0.5, 0)
      scene.add(m)
    }
  })
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  camera.position.set(0, 0, 4.6)
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.fov = w < h ? 46 : 30
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
