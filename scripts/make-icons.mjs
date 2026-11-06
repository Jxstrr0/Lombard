// Renders the home screen icons from public/icons/icon.svg with Playwright.
// Run by hand after changing the SVG:  node scripts/make-icons.mjs
// Writes into public/icons/:
//   apple-touch-icon.png  180x180, square and opaque (iOS rounds the corners itself)
//   icon-192.png, icon-512.png  the rounded tile, as drawn in the SVG
//   icon-512-maskable.png  square, art shrunk to sit inside the middle 80%
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const dir = new URL('../public/icons/', import.meta.url)
const svg = await readFile(new URL('icon.svg', dir), 'utf8')

const square = svg.replace(/(<rect id="tile"[^>]*?) rx="\d+"/, '$1')
// The art reaches about 172px from the centre; 0.8 brings it well inside the
// 204px safe circle that Android masks to.
const maskable = square.replace('<g id="art">', '<g id="art" transform="translate(256 256) scale(0.8) translate(-256 -256)">')

const jobs = [
  ['apple-touch-icon.png', square, 180, false],
  ['icon-192.png', svg, 192, true],
  ['icon-512.png', svg, 512, true],
  ['icon-512-maskable.png', maskable, 512, false],
]

// CHROME=/path/to/chrome uses a browser you already have instead of the
// one Playwright downloads.
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
const page = await browser.newPage()
for (const [name, source, size, transparent] of jobs) {
  await page.setViewportSize({ width: size, height: size })
  const sized = source.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${sized}`)
  await page.screenshot({ path: new URL(name, dir).pathname, omitBackground: transparent })
  console.log('wrote', name)
}
await browser.close()
