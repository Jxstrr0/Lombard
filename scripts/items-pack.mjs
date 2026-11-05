#!/usr/bin/env node
/**
 * Packs the scripted item models for the game (docs/04-ASSETS.md § Items):
 *   art/out/items/<id>.glb  →  public/assets/items/<id>.glb
 * Draco geometry, textures re-encoded as KTX2 (UASTC + Zstd, mipmaps).
 *
 *   node scripts/items-pack.mjs [--in art/out/items] [--out public/assets/items] [--only id,id]
 */
import { readdir, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions'
import { dedup, draco, prune, weld } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { encodeToKTX2 } from 'ktx2-encoder'
import { PNG } from 'pngjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const inDir = opt('--in', 'art/out/items')
const outDir = opt('--out', 'public/assets/items')
const only = new Set((opt('--only', '') ?? '').split(',').filter(Boolean))

const imageDecoder = async (buffer) => {
  const png = PNG.sync.read(Buffer.from(buffer))
  return { data: new Uint8Array(png.data), width: png.width, height: png.height }
}

/**
 * Every texture → KTX2. Colour slots are sRGB; data maps (normal, roughness…) linear.
 * The baked AO (the base colour texture of most items) is smooth greyscale, so ETC1S
 * holds it at a fraction of UASTC's size; normal maps keep UASTC.
 */
async function toKtx2(doc) {
  const basisu = doc.createExtension(KHRTextureBasisu).setRequired(true)
  const srgb = new Set()
  for (const m of doc.getRoot().listMaterials()) {
    for (const t of [m.getBaseColorTexture(), m.getEmissiveTexture()]) if (t) srgb.add(t)
  }
  for (const tex of doc.getRoot().listTextures()) {
    if (tex.getMimeType() !== 'image/png') continue
    const colour = srgb.has(tex)
    const ktx2 = await quiet(() =>
      encodeToKTX2(new Uint8Array(tex.getImage()), {
        ...(colour ? { isUASTC: false, qualityLevel: 200, compressionLevel: 2 } : { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1 }),
        needSupercompression: true,
        isPerceptual: colour,
        isSetKTX2SRGBTransferFunc: colour,
        generateMipmap: true,
        imageDecoder,
      }),
    )
    tex.setImage(ktx2).setMimeType('image/ktx2').setURI(tex.getURI().replace(/\.png$/, '.ktx2'))
  }
  if (doc.getRoot().listTextures().length === 0) basisu.dispose()
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

async function main() {
  await mkdir(outDir, { recursive: true })
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule() })
  const files = (await readdir(inDir)).filter((f) => f.endsWith('.glb') && (only.size === 0 || only.has(f.slice(0, -4)))).sort()
  if (files.length === 0) throw new Error(`no item glbs in ${inDir} (run art/items/build.py first)`)
  for (const f of files) {
    const doc = await io.read(path.join(inDir, f))
    await doc.transform(
      dedup(),
      weld(),
      prune({ keepAttributes: true }),
      // Items are a few centimetres across: 14-bit positions are ~2 µm steps.
      draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    )
    await toKtx2(doc)
    const out = path.join(outDir, f)
    await io.write(out, doc)
    console.log(`[items-pack] ${out}: ${((await stat(out)).size / 1024).toFixed(0)} KB`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
