/**
 * 3D customers (M3): Microsoft Rocketbox avatars, one glb per cast member in
 * `public/assets/customers/<id>.glb` (built by art/customers/build.py). Each
 * loads lazily the first time that person is needed, then stays cached while
 * the scene keeps it (the current customer and the next one in line).
 * `?customer=<id>` makes every customer that cast member, for review.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CAST } from '../data/customers/cast'

export interface CustomerModel {
  id: string
  root: THREE.Group
  /** Plays the glb's idle loop, if it has one. */
  mixer: THREE.AnimationMixer | null
  /** Each mesh's materials, made transparent so the scene can fade them. */
  materials: THREE.Material[]
  triangles: number
}

/** `?customer=<id>`: a cast id, or null. */
export function castOverride(params: URLSearchParams): string | null {
  const id = params.get('customer')
  return id && CAST.some((c) => c.id === id) ? id : null
}

export class CustomerCast {
  private models = new Map<string, Promise<CustomerModel>>()

  constructor(
    private base: string,
    private version: string,
  ) {}

  get(id: string): Promise<CustomerModel> {
    let p = this.models.get(id)
    if (!p) {
      p = loadCustomerModel(this.base, id, this.version)
      p.then(
        (m) => console.info(`[customer] ${id}: ${Math.round(m.triangles)} triangles, ${m.materials.length} materials${m.mixer ? ', idle clip' : ''}`),
        (err) => {
          console.warn(`[customer] ${id} failed to load`, err)
          // Let a later visit try again.
          if (this.models.get(id) === p) this.models.delete(id)
        },
      )
      this.models.set(id, p)
    }
    return p
  }

  /** Drop (and free) every cached model not in `keep`. */
  retain(keep: Iterable<string | null>): void {
    const k = new Set(keep)
    for (const [id, p] of this.models) {
      if (k.has(id)) continue
      this.models.delete(id)
      p.then((m) => disposeModel(m), () => {})
    }
  }

  dispose(): void {
    this.retain([])
  }
}

async function loadCustomerModel(base: string, id: string, version: string): Promise<CustomerModel> {
  const gltf = await new GLTFLoader().loadAsync(`${base}assets/customers/${id}.glb?v=${version}`)
  const root = gltf.scene
  const materials: THREE.Material[] = []
  let triangles = 0
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const index = mesh.geometry.index
    triangles += (index ? index.count : (mesh.geometry.getAttribute('position')?.count ?? 0)) / 3
    // Skinned meshes move outside their rest bounds; don't let culling pop them.
    mesh.frustumCulled = false
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      // Cards that blend for real keep blending once the scene has faded them in.
      m.userData.blend = m.transparent
      m.transparent = true
      m.opacity = 0
      materials.push(m)
    }
  })
  // The glbs face +z (towards the street); the customer faces the player.
  root.rotation.y = Math.PI
  let mixer: THREE.AnimationMixer | null = null
  const idle = gltf.animations[0]
  if (idle) {
    mixer = new THREE.AnimationMixer(root)
    const action = mixer.clipAction(idle)
    action.play()
    // Start people at different points of the breath so two in a row don't match.
    action.time = (hash(id) % 1000) / 1000 * idle.duration
  }
  return { id, root, mixer, materials, triangles }
}

function disposeModel(m: CustomerModel): void {
  m.mixer?.stopAllAction()
  m.root.removeFromParent()
  m.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose()
      mat.dispose()
    }
  })
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
