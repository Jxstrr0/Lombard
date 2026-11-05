/* global window */
// Headless screenshots of the production build for self-review before pushing.
// Usage: npm run shots   (builds first, then writes PNGs to shots/)
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const OUT = 'shots'
const VIEWS = [
  { name: 'portrait', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'landscape', width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
]

async function launch() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  try {
    return await chromium.launch({ args })
  } catch (err) {
    // Fallback for environments with a preinstalled browser at a known path.
    const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium'
    console.warn(`default chromium launch failed (${err.message.split('\n')[0]}); trying ${executablePath}`)
    return chromium.launch({ args, executablePath })
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'warn' })
  const base = server.resolvedUrls.local[0]
  const browser = await launch()
  const errors = []
  try {
    for (const view of VIEWS) {
      const { name, ...ctxOpts } = view
      const context = await browser.newContext({
        viewport: { width: ctxOpts.width, height: ctxOpts.height },
        deviceScaleFactor: ctxOpts.deviceScaleFactor,
        isMobile: ctxOpts.isMobile,
        hasTouch: ctxOpts.hasTouch,
        reducedMotion: 'reduce', // stable camera for comparable shots
      })
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`)
      })
      await page.goto(`${base}?seed=1&perf=1`, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => window.__lombardReady === true, null, { timeout: 30_000 })
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/${name}-idle.png` })

      await page.click('button[data-id="next"]')
      await page.waitForTimeout(1500) // customer fade-in
      await page.screenshot({ path: `${OUT}/${name}-customer.png` })
      console.log(`shots/${name}-idle.png, shots/${name}-customer.png`)
      await context.close()
    }
  } finally {
    await browser.close()
    server.httpServer.close()
  }
  if (errors.length) {
    console.error('Page errors:\n' + errors.join('\n'))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
