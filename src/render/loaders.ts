/**
 * Shared glTF loader for item models: Draco geometry and KTX2 (Basis) textures,
 * decoders served from `${base}assets/decoders/` (copied there by
 * scripts/copy-decoders.mjs). One loader for the whole session so the decoder
 * workers start once; item models are small and come one at a time.
 */
import type * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

/** Loads `public/assets/items/<file>` and resolves to its scene. */
export type GlbLoader = (file: string) => Promise<THREE.Group>

export interface ItemLoader {
  load: GlbLoader
  dispose(): void
}

export function createItemLoader(renderer: THREE.WebGLRenderer, base: string, version: string): ItemLoader {
  const draco = new DRACOLoader().setDecoderPath(`${base}assets/decoders/draco/`)
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base}assets/decoders/basis/`).detectSupport(renderer)
  const gltf = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2)
  return {
    load: async (file) => (await gltf.loadAsync(`${base}assets/items/${file}?v=${version}`)).scene,
    dispose: () => {
      draco.dispose()
      ktx2.dispose()
    },
  }
}
