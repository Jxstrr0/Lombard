#!/usr/bin/env node
/**
 * Packs the Blender bake output for the game:
 *   bake/out/shop_raw.glb       → public/assets/shop/shop.glb (Draco)
 *   bake/out/shop_lightmap.png  → public/assets/shop/shop_lightmap.ktx2 (UASTC + Zstd, sRGB, mipmaps)
 *   bake/out/shop_bake.json     → public/assets/shop/shop.json (manifest the game reads)
 *
 *   node scripts/bake-pack.mjs [--in bake/out] [--out public/assets/shop]
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, draco, prune } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { encodeToKTX2 } from 'ktx2-encoder'
import { PNG } from 'pngjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const inDir = opt('--in', 'bake/out')
const outDir = opt('--out', 'public/assets/shop')

async function packGlb() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() })
  const doc = await io.read(path.join(inDir, 'shop_raw.glb'))
  await doc.transform(
    dedup(),
    // keepAttributes: no glTF texture references uv0/uv1 (the game supplies them), so prune would drop them.
    prune({ keepExtras: true, keepAttributes: true }),
    // 14-bit texcoords keep the lightmap islands crisp at 2048 px.
    draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }),
  )
  const file = path.join(outDir, 'shop.glb')
  await io.write(file, doc)
  return file
}

async function packLightmap() {
  const src = await readFile(path.join(inDir, 'shop_lightmap.png'))
  const ktx2 = await encodeToKTX2(new Uint8Array(src), {
    isUASTC: true,
    uastcLDRQualityLevel: 2,
    needSupercompression: true,
    isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true,
    generateMipmap: true,
    // Rate-distortion optimisation lets Zstd squeeze UASTC to roughly half; lightmaps are smooth so it costs little.
    enableRDO: true,
    rdoQualityLevel: 1,
    imageDecoder: async (buffer) => {
      const png = PNG.sync.read(Buffer.from(buffer))
      return { data: new Uint8Array(png.data), width: png.width, height: png.height }
    },
  })
  const file = path.join(outDir, 'shop_lightmap.ktx2')
  await writeFile(file, ktx2)
  return file
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const bake = JSON.parse(await readFile(path.join(inDir, 'shop_bake.json'), 'utf8'))
  if (!bake.baked) throw new Error('shop_bake.json says the lightmap was not baked (--no-bake run?)')
  const [glb, lightmap] = await Promise.all([packGlb(), packLightmap()])
  const manifest = {
    ...bake,
    commit: process.env.GITHUB_SHA?.slice(0, 7) ?? null,
    files: { glb: path.basename(glb), lightmap: path.basename(lightmap) },
  }
  await writeFile(path.join(outDir, 'shop.json'), JSON.stringify(manifest, null, 2) + '\n')
  for (const f of [glb, lightmap]) console.log(`[pack] ${f}: ${((await stat(f)).size / 1024).toFixed(0)} KB`)
  console.log(`[pack] manifest: ${JSON.stringify(manifest)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
