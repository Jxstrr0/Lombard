/* global window, document */
// Headless screenshots of the production build for self-review before pushing.
// Usage: npm run shots   (builds first, then writes PNGs to shots/)
//
// Portrait plays a whole day with ?seed=1: welcome → open → customer → inspect
// (every tool) → estimate → offer/haggle → resolved → the rest of the queue
// (one inspect shot per item shape, the rest passed) → close up → ledger (sell one) → settings.
// Landscape and desktop shoot counter, inspect, offer and ledger.
// Portrait runs in one browser while landscape, desktop, the gallery and the perf
// readout run in a second. Rendering is SwiftShader (software), so shots use DPR 1.
// Fails on any page error or console error.
import { mkdir, rm } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const OUT = 'shots'
// DPR 1: SwiftShader time scales with pixels, and 1x is still legible for review.
const PORTRAIT = { name: 'portrait', width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const VIEWS = [
  PORTRAIT,
  { name: 'landscape', width: 844, height: 390, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
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

/** Page helpers bound to one view. */
function helpers(page, name) {
  let n = 0
  const shots = []
  const id = (dataId) => page.locator(`[data-id="${dataId}"]:visible`).first()
  const api = {
    id,
    async screen(screenId) {
      await page.waitForFunction((s) => document.body.dataset.screen === s, screenId, { timeout: 15_000 })
      await page.waitForTimeout(250)
    },
    async click(dataId) {
      await id(dataId).click({ timeout: 10_000 })
      await page.waitForTimeout(120)
    },
    async visible(dataId) {
      return (await page.locator(`[data-id="${dataId}"]:visible`).count()) > 0
    },
    async enabled(dataId) {
      const l = id(dataId)
      return (await l.count()) > 0 && (await l.isEnabled())
    },
    async shot(label, what) {
      n++
      const file = `${OUT}/${name}-${String(n).padStart(2, '0')}-${label}.png`
      await page.screenshot({ path: file })
      shots.push(`${file}  ${what}`)
    },
    state: () => page.evaluate(() => window.__lombardState?.()),
    shots,
  }
  return api
}

/** Coarse item shape from a def id (gold_band_583 → gold_band, watch_x → watch). */
function kindOf(defId) {
  if (defId.startsWith('watch_')) return 'watch'
  if (defId.startsWith('phone_')) return 'phone'
  return defId.split('_').slice(0, 2).join('_')
}

/** Type a number on the offer pad. */
async function typeNumber(h, value) {
  for (const ch of String(value)) await h.click(`offer-key-${ch}`)
}

/** Haggle until the visit resolves: offer 40% of the estimate, then accept the ask if affordable, else raise. */
async function haggle(h) {
  await h.click('chip-40')
  await h.click('make-offer')
  await haggleOn(h)
}

/** After a first offer: accept the ask if affordable, else raise to 60%, then pass. */
async function haggleOn(h) {
  for (let i = 0; i < 6; i++) {
    const s = await h.state()
    if (s.current?.phase !== 'offer') return
    if (await h.enabled('accept-ask')) {
      await h.click('accept-ask')
      return
    }
    await h.click(i === 0 ? 'chip-60' : 'chip-60')
    if (await h.enabled('make-offer')) await h.click('make-offer')
    else break
  }
  const s = await h.state()
  if (s.current?.phase === 'offer') await h.click('offer-pass')
}

async function playPortrait(page, h) {
  await h.screen('welcome')
  await h.shot('welcome', 'first launch: welcome card, Open shop')
  await h.click('open-shop')
  await h.screen('counter')
  await h.shot('counter-open', 'shop open, nobody at the counter, Next customer')
  await h.click('next-customer')
  await page.waitForTimeout(900)
  await h.shot('counter-customer', 'customer presents an item: name, archetype, item tag, line; Inspect / Pass')
  await h.click('inspect')
  await h.screen('inspect')
  await page.waitForTimeout(600)
  await h.shot('inspect', 'inspect view: item at eye level, vignette, hotspot markers, tool bar')
  await h.click('tool-loupe')
  await page.waitForTimeout(250)
  await h.shot('inspect-loupe', 'loupe over the whole item: lens feedback + first finding slip')
  // first marker that is not covered by a finding slip or the panel
  await page.waitForTimeout(700)
  const spotId = await page.evaluate(() => {
    for (const b of document.querySelectorAll('.hotspot:not(.is-occluded)')) {
      const r = b.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (hit && b.contains(hit)) return b.dataset.id
    }
    return null
  })
  if (spotId) {
    await h.click(spotId)
    await page.waitForTimeout(250)
    await h.shot('inspect-hotspot', 'loupe on a hotspot marker: finding with the spot label')
  }
  await page.waitForTimeout(700)
  await h.click('tool-scale')
  await page.waitForTimeout(250)
  await h.shot('inspect-scale', 'scale: LCD reading + finding slip')
  await page.waitForTimeout(700)
  await h.click('tool-magnet')
  await page.waitForTimeout(250)
  await h.shot('inspect-magnet', 'magnet: pull / no pull + finding slip')
  // orbit by dragging
  const box = await page.locator('[data-id="inspect-gesture"]').boundingBox()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height * 0.35
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 120, cy + 40, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  await h.shot('inspect-orbit', 'after a drag: item turned (back side)')
  await h.click('findings-stack')
  await page.waitForTimeout(200)
  await h.shot('findings-expanded', 'findings expanded: all slips with full text')
  await h.click('findings-list')

  await h.click('inspect-done')
  await h.screen('offer')
  await page.waitForTimeout(500)
  await h.shot('offer-estimate', 'offer step 1: enter your own estimate')
  const s0 = await h.state()
  const claimed = s0.current?.item ? Math.max(1000, Math.round((s0.current.item.trueValue * 1.1) / 1000) * 1000) : 10000
  await typeNumber(h, claimed)
  await h.shot('offer-estimate-typed', 'estimate typed on the pad')
  await h.click('set-estimate')
  await page.waitForTimeout(200)
  await h.click('chip-40')
  await h.shot('offer', 'offer step 2: chips, approaches, Offer')
  await h.click('approach-evidence')
  await page.waitForTimeout(200)
  await h.shot('offer-evidence', 'evidence picker: cite a finding')
  await page.locator('[data-id^="cite-"]:visible').first().click()
  await page.waitForTimeout(150)
  await h.click('make-offer')
  await page.waitForTimeout(400)
  const s1 = await h.state()
  if (s1.current?.phase === 'offer') await h.shot('offer-countered', 'after a counter: their ask + Accept')
  await haggle(h)
  await h.screen('counter')
  await page.waitForTimeout(300)
  await h.shot('resolved', 'visit resolved: outcome stamp + Next')
  await h.click('dismiss')

  // The rest of the queue: inspect one item of each placeholder shape not shot yet
  // (screenshots cost ~3 s each under SwiftShader), buy one more, pass the rest.
  const shotKinds = new Set([s0.current?.item ? kindOf(s0.current.item.defId) : ''])
  let k = 0
  while (await h.visible('next-customer')) {
    await h.click('next-customer')
    const s = await h.state()
    if (!s.current) break
    const kind = kindOf(s.current.item.defId)
    if (shotKinds.has(kind) && k !== 1) {
      await h.click('pass')
      await h.click('dismiss')
      continue
    }
    shotKinds.add(kind)
    await h.click('inspect')
    await h.screen('inspect')
    await page.waitForTimeout(450)
    await h.shot(`item-${s.current.item.defId}`, `inspect: ${s.current.item.defId}`)
    if (k === 1) {
      await h.click('inspect-done')
      await h.screen('offer')
      await typeNumber(h, 5000)
      await h.click('set-estimate')
      await haggle(h)
    } else {
      await h.click('inspect-pass')
    }
    await h.screen('counter')
    await h.click('dismiss')
    k++
  }
  await h.shot('queue-empty', 'queue empty: Close up')
  await h.click('close-up')
  await h.screen('ledger')
  await page.waitForTimeout(300)
  await h.shot('ledger', 'ledger: day summary, log, stock with Sell to dealer')
  const sell = page.locator('[data-id^="sell-"]:visible').first()
  if ((await sell.count()) > 0) {
    await sell.click()
    await page.waitForTimeout(300)
    await h.shot('ledger-sold', 'ledger after selling one item: sale in the log')
    await page.evaluate(() => document.querySelector('.ledger-scroll')?.scrollTo(0, 99999))
    await page.waitForTimeout(150)
    await h.shot('ledger-bottom', 'ledger scrolled to the stock list')
  }
  await h.click('settings-ledger')
  await page.waitForTimeout(200)
  await h.shot('settings', 'settings sheet (Longlight palette)')
  await h.click('copy-code')
  await page.waitForTimeout(300)
  await h.click('load-code')
  await page.waitForTimeout(150)
  await h.shot('settings-actions', 'settings after Copy (status) and an empty Load (error)')
  await h.click('text-130')
  await page.waitForTimeout(150)
  await h.click('settings-close')
  await h.shot('ledger-text-130', 'ledger with the largest text size')
  await h.click('settings-ledger')
  await h.click('text-100')
  await h.click('settings-close')
  await h.click('open-shop')
  await h.screen('counter')
  await h.shot('day2', 'day 2 opened')
}

async function playShort(page, h) {
  await h.screen('welcome')
  await h.shot('welcome', 'welcome card')
  await h.click('open-shop')
  await h.screen('counter')
  await h.click('next-customer')
  await page.waitForTimeout(900)
  await h.shot('counter-customer', 'customer at the counter')
  await h.click('inspect')
  await h.screen('inspect')
  await page.waitForTimeout(600)
  await h.click('tool-loupe')
  await page.waitForTimeout(800)
  await h.click('tool-scale')
  await page.waitForTimeout(300)
  await h.shot('inspect', 'inspect with two findings')
  await h.click('inspect-done')
  await h.screen('offer')
  await typeNumber(h, 9000)
  await h.click('set-estimate')
  await h.click('chip-40')
  await h.shot('offer', 'offer pad')
  await h.click('make-offer')
  await page.waitForTimeout(300)
  if ((await h.state()).current?.phase === 'offer') await h.shot('offer-countered', 'after a counter: their ask + Accept')
  await haggleOn(h)
  await h.screen('counter')
  await h.click('dismiss')
  while (await h.visible('next-customer')) {
    await h.click('next-customer')
    await h.click('pass')
    await h.click('dismiss')
  }
  await h.click('close-up')
  await h.screen('ledger')
  await page.waitForTimeout(300)
  await h.shot('ledger', 'ledger')
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'warn' })
  const base = server.resolvedUrls.local[0]
  const errors = []
  const t0 = Date.now()
  const secs = () => ((Date.now() - t0) / 1000).toFixed(0)
  const newPage = async (browser, view, url) => {
    const { name, ...o } = view
    const context = await browser.newContext({
      viewport: { width: o.width, height: o.height },
      deviceScaleFactor: o.deviceScaleFactor,
      isMobile: o.isMobile,
      hasTouch: o.hasTouch,
      reducedMotion: 'reduce', // stable camera for comparable shots
    })
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`)
    })
    await page.goto(`${base}${url}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.__lombardReady === true, null, { timeout: 30_000 })
    await page.waitForTimeout(400)
    return { context, page }
  }

  // Each job gets its own browser (its own GPU process), so they run in parallel.
  const playView = (view) => async (browser) => {
    const { context, page } = await newPage(browser, view, '?seed=1')
    const h = helpers(page, view.name)
    try {
      if (view === PORTRAIT) await playPortrait(page, h)
      else await playShort(page, h)
    } catch (err) {
      await page.screenshot({ path: `${OUT}/${view.name}-FAILED.png` }).catch(() => {})
      errors.push(`[${view.name}] flow: ${err.message.split('\n')[0]}`)
    }
    await context.close()
    console.log(`${view.name} done at ${secs()} s`)
    return h.shots
  }
  // Placeholder model gallery (dev view) and a perf readout at the counter + inspect.
  const extras = async (browser) => {
    const out = []
    {
      const { context, page } = await newPage(browser, { name: 'gallery', width: 1000, height: 1250, deviceScaleFactor: 1 }, '?gallery=1')
      await page.screenshot({ path: `${OUT}/gallery.png` })
      out.push(`${OUT}/gallery.png  every item def's placeholder model, front + back, hotspots as pink beads`)
      await context.close()
    }
    {
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1&perf=1')
      const h = helpers(page, 'perf')
      await h.click('open-shop')
      await h.click('next-customer')
      await page.waitForTimeout(1200)
      const counter = await page.locator('.perf-info').textContent()
      await h.click('inspect')
      await page.waitForTimeout(1200)
      const inspect = await page.locator('.perf-info').textContent()
      console.log(`perf counter: ${counter?.replace(/\n/g, ' | ')}`)
      console.log(`perf inspect: ${inspect?.replace(/\n/g, ' | ')}`)
      await context.close()
    }
    return out
  }
  const run = async (job) => {
    const browser = await launch()
    try {
      return await job(browser)
    } catch (err) {
      errors.push(`job: ${err.message.split('\n')[0]}`)
      return []
    } finally {
      await browser.close()
    }
  }
  // Portrait is the long flow; the other views share a second browser.
  let listing
  try {
    const [portrait, rest] = await Promise.all([
      run(playView(PORTRAIT)),
      run(async (browser) => {
        const out = []
        for (const view of VIEWS) if (view !== PORTRAIT) out.push(...(await playView(view)(browser)))
        out.push(...(await extras(browser)))
        return out
      }),
    ])
    listing = [...portrait, ...rest]
  } finally {
    server.httpServer.close()
  }
  console.log(listing.join('\n'))
  console.log(`${listing.length} screenshots in ${secs()} s`)
  if (errors.length) {
    console.error('Page errors:\n' + errors.join('\n'))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
