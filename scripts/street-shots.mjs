/* global window, document */
// Screenshots of the street outside the window, for review: day, dusk, rain, snow,
// plus two frames a second apart to check that it moves.
// Usage: npm run build && node scripts/street-shots.mjs [--dpr 2]   (writes shots/street-*.png)
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const OUT = 'shots'
const dpr = Number(process.argv[process.argv.indexOf('--dpr') + 1]) || 1
const BASE = '?seed=1&lull=0&look=0,18&tier=mid&street=busy'
const CASES = [
  ['day', '&time=12:30&weather=clear&season=autumn'],
  ['dusk', '&time=18:40&weather=clear&season=autumn'],
  ['rain', '&time=14:00&weather=rain&season=autumn'],
  ['snow', '&time=15:20&weather=snow&season=winter'],
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const server = await preview({ preview: { port: 4178, strictPort: false } })
  const url = server.resolvedUrls.local[0]
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  const browser = await chromium.launch({ args }).catch(() => chromium.launch({ args, executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' }))
  const errors = []
  try {
    for (const [name, q] of CASES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true })
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
      page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`))
      await page.goto(`${url}${BASE}${q}`)
      await page.waitForFunction(() => window.__lombardReady === true, null, { timeout: 120_000 })
      await page.waitForFunction(() => document.body.dataset.street === 'ready', null, { timeout: 60_000 })
      // through the career intro and the morning paper to the empty counter
      const vis = async (id) => (await page.locator(`[data-id="${id}"]:visible`).count()) > 0
      const click = (id) => page.locator(`[data-id="${id}"]:visible`).first().click({ timeout: 10_000 })
      await page.waitForFunction(() => ['intro', 'welcome', 'ledger', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) === 'intro') {
        for (let i = 0; i < 8 && !(await vis('intro-begin')); i++) await click('intro-next')
        await click('intro-begin')
      }
      if (await vis('open-shop')) await click('open-shop')
      await page.waitForTimeout(400)
      if (await vis('news-done')) await click('news-done')
      await page.waitForTimeout(4000)
      await page.screenshot({ path: `${OUT}/street-${name}.png`, timeout: 120_000 })
      if (name === 'day') {
        await page.waitForTimeout(1000)
        await page.screenshot({ path: `${OUT}/street-${name}-1s.png`, timeout: 120_000 })
      }
      await page.close()
      console.log(`street-${name}.png`)
    }
  } finally {
    await browser.close()
    await server.close()
  }
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
