/**
 * M3 customer test (Plan A vs Plan B, docs/03-ROADMAP.md): `?customer=<name>`
 * swaps the stand-in silhouette for `public/assets/customer-test/<name>.glb`,
 * a rigged test person, so Colby can judge 3D customers in the shop on a phone.
 * Review-only and lazy: nothing loads without the flag. Removed (with the test
 * glbs) once the decision is made.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface CustomerModel {
  root: THREE.Group
  /** Plays the first clip, if the glb has one (an idle loop). */
  mixer: THREE.AnimationMixer | null
  /** Each mesh's materials, made transparent so the scene can fade them. */
  materials: THREE.Material[]
  triangles: number
}

/** Only plain names (no paths or URLs) reach the loader. */
export function customerTestName(params: URLSearchParams): string | null {
  const name = params.get('customer')
  return name && /^[a-z0-9_-]{1,64}$/i.test(name) ? name : null
}

export async function loadCustomerModel(base: string, name: string, version: string): Promise<CustomerModel> {
  const gltf = await new GLTFLoader().loadAsync(`${base}assets/customer-test/${name}.glb?v=${version}`)
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
      // Hair and lash cards blend for real; the scene restores this once faded in.
      m.userData.blend = m.transparent
      m.transparent = true
      m.opacity = 0
      materials.push(m)
    }
  })
  let mixer: THREE.AnimationMixer | null = null
  const idle = gltf.animations[0]
  if (idle) {
    mixer = new THREE.AnimationMixer(root)
    mixer.clipAction(idle).play()
  }
  return { root, mixer, materials, triangles }
}
