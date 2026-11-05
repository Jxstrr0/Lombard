#!/usr/bin/env node
/**
 * Packs the canal backdrop render (art/backdrop/build.py) for the game:
 *   art/out/backdrop/canal.png   → public/assets/backdrop/canal.ktx2 (sRGB colour, alpha = water mask, mipmaps)
 *   art/out/backdrop/canal.json  → public/assets/backdrop/canal.json (plane rectangle the game places the render on)
 *
 *   node scripts/backdrop-pack.mjs [--in art/out/backdrop] [--out public/assets/backdrop] [--mode etc1s|uastc]
 *
 * Rows are flipped before encoding so the texture follows three's usual
 * convention (v = 0 at the bottom) although KTX2 textures can't be flipped on upload.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { encodeToKTX2 } from 'ktx2-encoder'
import { PNG } from 'pngjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const inDir = opt('--in', 'art/out/backdrop')
const outDir = opt('--out', 'public/assets/backdrop')
const mode = opt('--mode', 'etc1s')

const ENCODERS = {
  // ETC1S at high quality: ~4x smaller than UASTC for a painterly daylight image; the alpha
  // (water mask) goes in its own slice.
  etc1s: { isUASTC: false, qualityLevel: 230, compressionLevel: 3 },
  uastc: { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 2 },
}

function flipRows(png) {
  const row = png.width * 4
  const out = new Uint8Array(png.data.length)
  for (let y = 0; y < png.height; y++) out.set(png.data.subarray(y * row, (y + 1) * row), (png.height - 1 - y) * row)
  return out
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
  if (!ENCODERS[mode]) throw new Error(`unknown --mode ${mode}`)
  await mkdir(outDir, { recursive: true })
  const meta = JSON.parse(await readFile(path.join(inDir, 'canal.json'), 'utf8'))
  const src = await readFile(path.join(inDir, 'canal.png'))
  const ktx2 = await quiet(() =>
    encodeToKTX2(new Uint8Array(src), {
      ...ENCODERS[mode],
      needSupercompression: true,
      isPerceptual: true,
      isSetKTX2SRGBTransferFunc: true,
      generateMipmap: true,
      imageDecoder: async (buffer) => {
        const png = PNG.sync.read(Buffer.from(buffer))
        return { data: flipRows(png), width: png.width, height: png.height }
      },
    }),
  )
  const file = path.join(outDir, 'canal.ktx2')
  await writeFile(file, ktx2)
  const manifest = { ...meta, encoding: mode, file: path.basename(file) }
  await writeFile(path.join(outDir, 'canal.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`[backdrop-pack] ${file}: ${((await stat(file)).size / 1024).toFixed(0)} KB (${mode}, ${meta.size.join('x')})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
