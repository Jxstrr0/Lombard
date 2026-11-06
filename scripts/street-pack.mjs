#!/usr/bin/env node
/**
 * Packs the street-life sprites and canal layers (art/street/build.py) for the game:
 *   art/out/street/people_dry.png, people_rain.png, props.png → public/assets/street/*.ktx2
 *     (ETC1S, sRGB, straight alpha, mipmaps; rows flipped so v = 0 is at the bottom)
 *   art/out/street/canal_extra.png → public/assets/street/canal_extra.webp (data: lossless WebP, every byte kept,
 *     colour under zero alpha too; rows are already bottom-up). Needs system python3 with Pillow, like art/materials.
 *   art/out/street/street.json     → public/assets/street/street.json
 *
 *   node scripts/street-pack.mjs [--in art/out/street] [--out public/assets/street]
 */
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { encodeToKTX2 } from 'ktx2-encoder'
import { PNG } from 'pngjs'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const inDir = opt('--in', 'art/out/street')
const outDir = opt('--out', 'public/assets/street')

function flipRows(png) {
  const row = png.width * 4
  const out = new Uint8Array(png.data.length)
  for (let y = 0; y < png.height; y++) out.set(png.data.subarray(y * row, (y + 1) * row), (png.height - 1 - y) * row)
  return out
}

async function quiet(fn) {
  const write = process.stdout.write
  process.stdout.write = () => true
  try {
    return await fn()
  } finally {
    process.stdout.write = write
  }
}

async function ktx2(name) {
  const src = await readFile(path.join(inDir, `${name}.png`))
  const out = await quiet(() =>
    encodeToKTX2(new Uint8Array(src), {
      isUASTC: false,
      qualityLevel: 200,
      compressionLevel: 3,
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
  const file = path.join(outDir, `${name}.ktx2`)
  await writeFile(file, out)
  return { file: path.basename(file), bytes: (await stat(file)).size }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const meta = JSON.parse(await readFile(path.join(inDir, 'street.json'), 'utf8'))
  const files = {}
  for (const name of ['people_dry', 'people_rain', 'props']) {
    const r = await ktx2(name)
    files[name] = r.file
    console.log(`[street-pack] ${r.file}: ${(r.bytes / 1024).toFixed(0)} KB`)
  }
  const webp = path.join(outDir, 'canal_extra.webp')
  const py = [
    'import sys, numpy as np',
    'from PIL import Image',
    'src = Image.open(sys.argv[1]); src.save(sys.argv[2], "WEBP", lossless=True, quality=100, method=6, exact=True)',
    'assert (np.array(Image.open(sys.argv[2])) == np.array(src)).all(), "webp changed the data"',
  ].join('\n')
  execFileSync('python3', ['-I', '-c', py, path.join(inDir, 'canal_extra.png'), webp], { stdio: 'inherit' })
  files.canal = path.basename(webp)
  console.log(`[street-pack] ${files.canal}: ${((await stat(webp)).size / 1024).toFixed(0)} KB`)
  await writeFile(path.join(outDir, 'street.json'), JSON.stringify({ ...meta, files }, null, 2) + '\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
