/**
 * The baked shop: static room geometry and its Cycles lightmap, produced by
 * the `bake` GitHub Actions workflow (bake/bake.py + scripts/bake-pack.mjs)
 * into public/assets/shop/.
 *
 * Each glTF material carries `kind` (and optionally `opacity`, `doubleSided`)
 * as extras, set in bake/materials.py:
 *   baked    MeshBasicMaterial + lightmap on uv1, plus its tiling surface texture
 *            (KTX2, on uv0) when it has one. Unlit by the real-time lights,
 *            so the lamp and window fill (which exist for the item and the
 *            customer) don't light the room a second time.
 *   prop     the CC0 props: MeshBasicMaterial with their own texture, lit by the
 *            bake's per-vertex lighting (COLOR_0, scaled like the lightmap).
 *   dynamic  metals: MeshStandardMaterial, env map + the two real-time lights.
 *   glass    transparent standard material, no depth write.
 *   unlit    flat colour (bulbs, door glass, cords).
 *
 * The lightmap stores lighting only, scaled by 1/lightmapScale to fit 8 bits;
 * three divides lightmaps by π, so intensity = π × scale.
 */
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { textureAnisotropy } from './perf'

export interface ShopManifest {
  version: number
  quality: 'preview' | 'full'
  lightmapSize: number
  lightmapScale: number
  samples: number
  blender: string
  inputHash: string
  commit: string | null
  files: { glb: string; lightmap: string }
}

export interface BakedShop {
  group: THREE.Group
  manifest: ShopManifest
  dispose(): void
}

type Kind = 'baked' | 'prop' | 'dynamic' | 'glass' | 'unlit'

export async function loadBakedShop(renderer: THREE.WebGLRenderer, base: string): Promise<BakedShop> {
  const dir = `${base}assets/shop/`
  const res = await fetch(`${dir}shop.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`no baked shop (${res.status})`)
  const manifest = (await res.json()) as ShopManifest
  // The bake's input hash busts caches when a new bake lands.
  const v = `?v=${manifest.inputHash}-${manifest.quality}`

  const draco = new DRACOLoader().setDecoderPath(`${base}assets/decoders/draco/`)
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}assets/decoders/basis/`).detectSupport(renderer)
  const gltfLoader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2)
  const owned: { dispose(): void }[] = []
  try {
    const [gltf, lightmap] = await Promise.all([gltfLoader.loadAsync(`${dir}${manifest.files.glb}${v}`), ktx2.loadAsync(`${dir}${manifest.files.lightmap}${v}`)])
    lightmap.channel = 1
    lightmap.flipY = false
    lightmap.colorSpace = THREE.SRGBColorSpace
    lightmap.anisotropy = textureAnisotropy()
    owned.push(lightmap)

    const cache = new Map<THREE.Material, THREE.Material>()
    const group = gltf.scene
    group.name = 'baked-shop'
    group.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial
      let mat = cache.get(src)
      if (!mat) {
        mat = convert(src, lightmap, manifest.lightmapScale, mesh.geometry.hasAttribute('color'))
        cache.set(src, mat)
        owned.push(mat)
        src.dispose()
      }
      mesh.material = mat
      mesh.matrixAutoUpdate = false
      mesh.updateMatrix()
      owned.push(mesh.geometry)
      if ((mat as THREE.Material).transparent) mesh.renderOrder = 2
    })
    const maps = new Set<THREE.Texture>()
    group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
      if (m?.map) maps.add(m.map)
    })
    for (const t of maps) {
      t.anisotropy = textureAnisotropy()
      owned.push(t)
    }
    group.updateMatrixWorld(true)
    return {
      group,
      manifest,
      dispose: () => {
        for (const d of owned) d.dispose()
      },
    }
  } finally {
    draco.dispose()
    ktx2.dispose()
  }
}

function convert(src: THREE.MeshStandardMaterial, lightmap: THREE.Texture, scale: number, vertexLighting: boolean): THREE.Material {
  const extras = src.userData as { kind?: Kind; opacity?: number; doubleSided?: boolean }
  const kind: Kind = extras.kind ?? 'dynamic'
  const side = extras.doubleSided ? THREE.DoubleSide : THREE.FrontSide
  const name = src.name
  switch (kind) {
    case 'baked': {
      // A textured surface's texture already averages to its authored colour
      // (art/materials/prepare.py), and glTF stores base colour factor 1 with it.
      const m = new THREE.MeshBasicMaterial({
        name,
        color: src.color.clone(),
        map: src.map,
        lightMap: lightmap,
        lightMapIntensity: Math.PI * scale,
        side,
      })
      return m
    }
    case 'prop':
      // No colour attribute means an unbaked (--no-bake) export: show it flat.
      return new THREE.MeshBasicMaterial({
        name,
        color: new THREE.Color(1, 1, 1).multiplyScalar(vertexLighting ? scale : 0.6),
        map: src.map,
        vertexColors: vertexLighting,
        side,
      })
    case 'glass':
      return new THREE.MeshStandardMaterial({
        name,
        color: src.color.clone(),
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: extras.opacity ?? 0.18,
        envMapIntensity: 1.5,
        depthWrite: false,
      })
    case 'unlit':
      return new THREE.MeshBasicMaterial({ name, color: src.color.clone(), toneMapped: name !== 'bulb' && name !== 'door_glass', side })
    case 'dynamic':
    default: {
      const m = new THREE.MeshStandardMaterial({
        name,
        color: src.color.clone(),
        roughness: src.roughness,
        metalness: src.metalness,
        side,
      })
      return m
    }
  }
}
