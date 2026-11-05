#!/usr/bin/env node
/**
 * Packs the Blender bake output for the game:
 *   bake/out/shop_raw.glb       → public/assets/shop/shop.glb (Draco; surface textures → KTX2 ETC1S, sRGB, mipmaps)
 *   bake/out/shop_lightmap.png  → public/assets/shop/shop_lightmap.ktx2 (UASTC + Zstd, sRGB, mipmaps)
 *   bake/out/shop_bake.json     → public/assets/shop/shop.json (manifest the game reads)
 *
 *   node scripts/bake-pack.mjs [--in bake/out] [--out public/assets/shop]
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions'
import { dedup, draco, prune } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { encodeToKTX2 } from 'ktx2-encoder'
import jpeg from 'jpeg-js'
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
  await texturesToKtx2(doc)
  const file = path.join(outDir, 'shop.glb')
  await io.write(file, doc)
  return file
}

const decodeImage = async (buffer) => {
  const b = Buffer.from(buffer)
  // PNG signature, else JPEG (the bake's surface textures are bake/textures/*.jpg)
  if (b[0] === 0x89 && b[1] === 0x50) {
    const png = PNG.sync.read(b)
    return { data: new Uint8Array(png.data), width: png.width, height: png.height }
  }
  const img = jpeg.decode(b, { useTArray: true, formatAsRGBA: true })
  return { data: new Uint8Array(img.data), width: img.width, height: img.height }
}

/**
 * Surface textures (base colour only, tiling on uv0) → KTX2 ETC1S: small on
 * disk and stays compressed on the GPU (~1 byte per texel with mips).
 */
async function texturesToKtx2(doc) {
  const textures = doc.getRoot().listTextures()
  if (textures.length === 0) return
  doc.createExtension(KHRTextureBasisu).setRequired(true)
  for (const tex of textures) {
    const ktx2 = await quiet(() =>
      encodeToKTX2(new Uint8Array(tex.getImage()), {
        isUASTC: false,
        qualityLevel: 200,
        compressionLevel: 2,
        needSupercompression: true,
        isPerceptual: true,
        isSetKTX2SRGBTransferFunc: true,
        generateMipmap: true,
        imageDecoder: decodeImage,
      }),
    )
    tex.setImage(ktx2).setMimeType('image/ktx2').setURI(`${tex.getName() || 'texture'}.ktx2`)
  }
}

/** The Basis encoder logs every mip level to stdout; keep the pack log readable. */
async function quiet(fn) {
  const write = process.stdout.write
  process.stdout.write = () => true
  try {
    return await fn()
  } finally {
    process.stdout.write = write
  }
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
    imageDecoder: decodeImage,
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
