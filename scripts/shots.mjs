/* global window, document, indexedDB */
// Headless screenshots of the production build for self-review before pushing.
// Usage: npm run shots   (builds first, then writes PNGs to shots/)
//
// Portrait plays a whole day with ?seed=1: welcome → open → customer → inspect
// (every tool) → estimate → offer/haggle → resolved → the rest of the queue
// (one inspect shot per item shape, the rest passed) → close up → ledger (sell one) → settings
// → shop sheet (stock the counter case, tag prices) → day 2 → a walk-in buyer → sale result.
// Landscape and desktop shoot counter, inspect, offer and ledger. Four portrait
// head-look views (?look=) show the empty counter turned left (storeroom), right (wing case), round and up.
// The game flows use ?seed=1, which skips the title screen. The title screen and career
// slots (M4) are shot without ?seed in every view, each on a fresh empty database: portrait
// walks slots, new career, load code into a slot, the backup reminder and delete; landscape and
// desktop also check the pre-M4 slot migration. SHOTS_ONLY=title runs just those.
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
      // The customer's strip and buttons wait until they stand at the counter (model loaded, faded in).
      if (dataId === 'next-customer') {
        await page
          // 'in', not just "not arriving": until the next frame the body still says 'away' from the last visit.
          .waitForFunction(() => document.body.dataset.customer === 'in', null, { timeout: 30_000 })
          .catch(() => console.warn('customer never arrived'))
      }
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
      await page.screenshot({ path: file, timeout: 90_000 })
      shots.push(`${file}  ${what}`)
    },
    state: () => page.evaluate(() => window.__lombardState?.()),
    /** Career-start intro, if showing: optional shot, then Begin with the default name. */
    async begin(shotIt = false) {
      await page.waitForFunction(() => ['intro', 'welcome', 'ledger', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) !== 'intro') return
      await page.waitForTimeout(250)
      if (shotIt) await api.shot('intro', 'career start: name your shop')
      // Tap Next through the story cards to Begin; shoot the first story card.
      for (let i = 0; i < 8 && !(await api.visible('intro-begin')); i++) {
        await api.click('intro-next')
        if (shotIt && i === 0) {
          await page.waitForTimeout(150)
          await api.shot('intro-card', 'career start: first story card (tap or Next)')
        }
      }
      await api.click('intro-begin')
    },
    /** Open the shop and read past the morning paper if there is one. */
    async open(shotIt = false) {
      await api.click('open-shop')
      await page.waitForFunction(() => ['news', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) === 'news') {
        await page.waitForTimeout(250)
        if (shotIt) await api.shot('news', 'morning paper at day open')
        await api.click('news-done')
      }
    },
    shots,
  }
  return api
}

/** Coarse item family from a def id (gold_band_583 → gold, lens_x → camera, order_x → militaria). */
function kindOf(defId) {
  const head = defId.split('_')[0]
  if (head === 'lens') return 'camera'
  if (head === 'medal' || head === 'order' || head === 'badge') return 'militaria'
  return head
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
  await h.begin(true)
  await h.screen('welcome')
  await h.shot('welcome', 'first launch: welcome card, Open shop')
  await h.open(true)
  await h.screen('counter')
  await h.shot('counter-open', 'shop open, nobody at the counter, Next customer')
  await h.click('hud-queue')
  await h.shot('queue-list', 'queue tapped: one patience bar per waiting customer, ~minutes left')
  await h.click('hud-queue')
  await h.click('shop-counter')
  await page.waitForTimeout(400)
  await h.shot('shop-door-waiting', 'Shop sheet in opening hours: the door bar says who is waiting')
  await h.click('shop-close')
  await page.waitForTimeout(300)
  await h.click('next-customer')
  // The cast model loads, then fades in (slowly in headless at desktop size).
  await page.waitForFunction(() => document.body.dataset.customer === 'in', null, { timeout: 30_000 }).catch(() => console.warn('customer never settled'))
  await page.waitForTimeout(300)
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
  // Pawn loans: the first pawner's offer pad is shot in loan mode (here, or later in the queue).
  let pawnShot = s0.current?.wants === 'pawn'
  await h.shot('offer', pawnShot ? 'offer step 2, pawn mode: Loan amount, terms (due date, rate, owed), Lend' : 'offer step 2: chips, approaches, Offer')
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
    if (!pawnShot && s.current.wants === 'pawn') {
      pawnShot = true
      await h.click('inspect')
      await h.screen('inspect')
      await h.click('inspect-done')
      await h.screen('offer')
      await typeNumber(h, 6000)
      await h.click('set-estimate')
      await h.click('chip-40')
      await h.shot('offer-pawn', 'offer pad in pawn mode: Loan amount, terms (due date, rate, owed), Lend')
      await haggleOn(h)
      await h.screen('counter')
      await h.click('dismiss')
      continue
    }
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
  if ((await h.state()).loans.length > 0) {
    await page.evaluate(() => document.querySelector('[data-id="ledger-loans"]')?.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(150)
    await h.shot('ledger-loans', 'ledger: open pawn loans (customer, item, lent, owed, due, days left) and LOAN entries')
    await page.evaluate(() => document.querySelector('.ledger-scroll')?.scrollTo(0, 0))
  }
  const sell = page.locator('[data-id^="sell-"]:visible').first()
  if ((await sell.count()) > 0) {
    // First tap asks "Sell for X?", the second sells.
    await sell.click()
    await page.waitForTimeout(150)
    await h.shot('ledger-sell-confirm', 'ledger: dealer price shown, first tap asks to confirm')
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
  await shopFlow(page, h)
  await h.open()
  await h.screen('counter')
  await h.shot('day2', 'day 2 opened')
  await buyerFlow(page, h)
}

/** Ledger → Shop sheet: put the stock in the counter case and tag it a little under value, so day 2 has buyers. */
async function shopFlow(page, h) {
  await h.click('shop-ledger')
  await page.waitForTimeout(200)
  const s = await h.state()
  const items = s.inventory.slice(0, 6)
  for (const [i, it] of items.entries()) {
    // Tap the item in the safe, tap an empty slot (it stays selected), then price it.
    await h.click(`safe-${it.id}`)
    await h.click(`slot-counter-${i + 1}`)
    await h.click('shop-price')
    await h.click('tag-clear')
    for (const ch of String(Math.max(100, Math.round((it.trueValue * 0.85) / 100) * 100))) await h.click(`tag-key-${ch}`)
    if (i === items.length - 1) await h.shot('shop-price', 'shop sheet: tag price pad (paid chips, never the true value)')
    await h.click('tag-set')
  }
  await page.evaluate(() => document.querySelector('.shop-body')?.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await h.shot('shop-placed', 'shop sheet: counter case stocked with paper tags, wall/back shelves, safe')
  await h.click('shop-close')
}

/** Day 2: serve the queue until a walk-in buyer reaches the counter, counter once, then take the result. */
async function buyerFlow(page, h) {
  for (let i = 0; i < 20 && (await h.visible('next-customer')); i++) {
    await h.click('next-customer')
    await page.waitForTimeout(150)
    const screen = await page.evaluate(() => document.body.dataset.screen)
    if (screen === 'sale') {
      await page.waitForTimeout(500)
      await h.shot('sale-buyer', 'walk-in buyer at the counter: line, item + your tag, their offer; Refuse / Counter / Sell')
      await h.click('sale-counter')
      await h.click('sale-chip-split')
      await h.click('sale-ask')
      for (let r = 0; r < 4 && (await page.evaluate(() => document.body.dataset.screen)) === 'sale'; r++) await h.click('sale-accept')
      await h.screen('counter')
      await h.shot('sale-result', 'sale resolved: buyer’s line + Sold stamp with the price')
      return
    }
    if (screen === 'redeem') await h.click('redeem-return')
    else if (await h.visible('pass')) await h.click('pass')
    await h.click('dismiss')
  }
  console.warn('portrait: no walk-in buyer came on day 2; sale shots skipped')
}

async function playShort(page, h) {
  await h.begin()
  await h.screen('welcome')
  await h.shot('welcome', 'welcome card')
  await h.open(page.viewportSize()?.height < 500)
  await h.screen('counter')
  await h.click('next-customer')
  // The cast model loads, then fades in (slowly in headless at desktop size).
  await page.waitForFunction(() => document.body.dataset.customer === 'in', null, { timeout: 30_000 }).catch(() => console.warn('customer never settled'))
  await page.waitForTimeout(300)
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

/** Send away whoever is at the counter without a deal (seller, buyer or redeemer). */
async function sendAway(h) {
  for (const id of ['pass', 'sale-refuse', 'redeem-return']) {
    if (await h.visible(id)) {
      await h.click(id)
      break
    }
  }
  if (await h.visible('dismiss')) await h.click('dismiss')
}

/**
 * Economy (portrait, ?seed=1): day 1 passed → ledger → Office (buy the acid kit,
 * retain four of the five specialists, buy the door chime and mirror) → word on the street → day 2 → the first gold or watch seller → acid,
 * reference book and a specialist call.
 */
async function playEconomy(page, h) {
  await h.begin()
  await h.open()
  await h.screen('counter')
  while (await h.visible('next-customer')) {
    await h.click('next-customer')
    await sendAway(h)
  }
  await h.click('close-up')
  await h.screen('ledger')
  await h.click('open-office')
  await page.waitForTimeout(200)
  // Four of the five specialists: the electronics tech stays unretained to show the Retain button.
  for (const id of ['buy-acid_kit', 'retain-jeweler', 'retain-watchmaker', 'retain-collector', 'retain-antiquary']) if (await h.enabled(id)) await h.click(id)
  await page.evaluate(() => document.querySelector('[data-id="office"]')?.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await h.shot('office', 'office sheet: bills due, upgrades (acid kit owned), cash')
  await page.evaluate(() => document.querySelector('[data-id="office-specialists"]')?.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(150)
  await h.shot('office-specialists', 'office sheet: specialists retained, calls left, release')
  await page.evaluate(() => {
    const sheet = document.querySelector('[data-id="office"]')
    sheet?.scrollTo(0, sheet.scrollHeight)
  })
  await page.waitForTimeout(150)
  await h.shot('office-specialists-end', 'office sheet: the last specialists (antiques dealer retained, electronics tech not)')
  for (const id of ['buy-door_chime', 'buy-convex_mirror']) if (await h.enabled(id)) await h.click(id)
  await page.evaluate(() => document.querySelector('[data-id="office-exposure"]')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(150)
  await h.shot('office-security', 'office sheet: cases and security (chime and mirror owned), things on open shelves')
  await h.click('office-close')
  await page.evaluate(() => document.querySelector('[data-id="ledger-standing"]')?.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(150)
  await h.shot('ledger-standing', 'ledger: word on the street (reputation by group as vague lines)')
  await h.open()
  await h.screen('counter')
  while (await h.visible('next-customer')) {
    await h.click('next-customer')
    const s = await h.state()
    const def = s.current?.item.defId ?? ''
    if (s.current?.kind !== 'seller' || !/^(gold|watch|coin)/.test(def)) {
      await sendAway(h)
      continue
    }
    await h.click('inspect')
    await h.screen('inspect')
    await page.waitForTimeout(500)
    const first = (await h.enabled('tool-acid')) && !(await page.locator('[data-id="tool-acid"].is-locked').count()) ? 'acid' : 'reference'
    await h.click(`tool-${first}`)
    await page.waitForTimeout(450)
    await h.shot(`inspect-${first}`, `inspect toolbar with the M2 tools; ${first} finding (${def})`)
    await page.waitForTimeout(500)
    for (const tool of ['reference', 'specialist']) {
      if (tool === first || (await page.locator(`[data-id="tool-${tool}"].is-locked`).count())) continue
      await h.click(`tool-${tool}`)
      await page.waitForTimeout(tool === 'specialist' ? 450 : 800)
    }
    if (await page.locator('.fx-for-specialist').count()) await h.shot('inspect-specialist', 'specialist call: phone fx + opinion slip')
    await page.waitForTimeout(1200)
    await h.click('findings-stack')
    await page.waitForTimeout(200)
    await h.shot('findings-m2', 'findings expanded: acid, reference and specialist slips')
    await h.click('findings-stack')
    await h.click('inspect-done')
    await h.screen('offer')
    await page.waitForTimeout(500)
    await h.shot('offer-estimate-range', 'estimate pad after the reference book: its price range')
    break
  }
}

/** Settings → Main menu, back to the title screen. */
async function toTitle(page, h, gear) {
  await h.click(gear)
  await page.waitForTimeout(150)
  await h.click('main-menu')
  await h.screen('title')
}

/** A save code copied from Settings (clipboard, or the manual-copy box if the clipboard is blocked). */
async function copyCode(page, h) {
  await h.click('copy-code')
  await page.waitForTimeout(300)
  const fromClipboard = await page.evaluate(() => navigator.clipboard?.readText?.().catch(() => '') ?? '')
  return fromClipboard || (await page.locator('[data-id="code-manual"]').inputValue())
}

/**
 * Title screen and career slots, portrait (no ?seed: a fresh browser, so an
 * empty database): empty slots → title settings → new career in slot 1 →
 * play day 1 → copy its code → main menu → load the code into slot 2 (pick,
 * replace confirm, cancel, empty slot) → reload with an old backup date for the
 * GDD §11 reminder → delete confirm → Continue.
 */
async function playTitle(page, h) {
  await h.screen('title')
  await h.shot('title-empty', 'title screen at first launch: Longlight brand, three empty slots, Load save code, Settings, hub link, build number')
  await h.click('title-settings')
  await page.waitForTimeout(200)
  await h.shot('title-settings', 'settings from the title: device settings only (sound, graphics, motion, text size)')
  await h.click('settings-close')
  await h.click('slot-new-1')
  await h.begin()
  await h.screen('welcome')
  await h.open()
  await h.screen('counter')
  while (await h.visible('next-customer')) {
    await h.click('next-customer')
    await sendAway(h)
  }
  await h.click('close-up')
  await h.screen('ledger')
  if (await h.visible('backup-later')) await h.click('backup-later')
  await h.click('settings-ledger')
  await page.waitForTimeout(150)
  await h.shot('settings-main-menu', 'in-game settings: save code, load (replaces this slot), Main menu')
  const code = await copyCode(page, h)
  await h.click('main-menu')
  await h.screen('title')
  await h.shot('title-one', 'title after day 1 in slot 1: Continue, slot card (shop, day, cash, last played), empty slots')
  await h.click('title-load')
  await page.locator('[data-id="title-code-input"]').fill(code)
  await h.click('title-code-read')
  await page.waitForTimeout(150)
  await h.shot('title-load-pick', 'load save code from the title: what the code holds, pick a slot')
  await h.click('title-code-slot-1')
  await page.waitForTimeout(150)
  await h.shot('title-load-replace', 'slot 1 is taken: replace confirm')
  await h.click('title-code-cancel')
  await h.click('title-code-slot-2')
  await page.waitForFunction(() => ['welcome', 'ledger'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
  await toTitle(page, h, (await h.visible('settings-ledger')) ? 'settings-ledger' : 'settings-welcome')
  // GDD §11 reminder: pretend the last backup was 20 days ago, then reload (also proves the slots persist).
  await page.evaluate(() => localStorage.setItem('lombard.lastBackup', String(Date.now() - 20 * 86_400_000)))
  await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })
  await page.waitForFunction(() => window.__lombardReady === true, null, { timeout: 90_000 })
  await h.screen('title')
  if (!(await h.visible('title-reminder'))) throw new Error('title: backup reminder did not show')
  await h.shot('title-reminder', 'after a reload: two careers, the backup reminder (last backup 20 days ago)')
  await h.click('slot-delete-2')
  await page.waitForTimeout(150)
  await h.shot('title-delete', 'delete with an inline confirm on the slot card')
  await h.click('slot-delete-confirm-2')
  await page.waitForTimeout(300)
  if (await h.visible('slot-play-2')) throw new Error('title: slot 2 was not deleted')
  // A new career in the freed slot 2: the intro, then the welcome card.
  await h.click('slot-new-2')
  await h.screen('intro')
  await h.shot('title-new-slot2', 'new career in slot 2: straight into the name-the-shop intro')
  await h.begin()
  await h.screen('welcome')
  await h.shot('title-new-slot2-welcome', 'slot 2 career after the intro: day 1 welcome card')
  await toTitle(page, h, 'settings-welcome')
  await h.shot('title-three', 'three slots: a career on day 2 (slot 1), a new day-1 career (slot 2), one empty; Continue = slot 2')
  // Continue a slot from its card: slot 1 is back on its ledger.
  await h.click('slot-play-1')
  await h.screen('ledger')
  await page.waitForTimeout(300)
  if (await h.visible('backup-later')) await h.click('backup-later')
  await h.shot('title-continue-slot1', 'slot 1 played from its card: back on its day-1 ledger')
  // Continue now means slot 1 (the most recent).
  await toTitle(page, h, 'settings-ledger')
  await h.click('title-continue')
  await h.screen('ledger')
}

/**
 * Title screen in landscape / desktop, plus the slot migration end to end: an
 * M3-style record with no slot is written behind the game's back, the page is
 * reloaded, and it must show up in slot 1 and play.
 */
async function playTitleShort(page, h) {
  await h.screen('title')
  await h.shot('title-empty', 'title screen, no careers yet')
  await page.evaluate(async () => {
    const s = window.__lombardState()
    const state = { ...s, meta: { ...s.meta, careerId: 'legacy-m3', intro: false }, shop: { ...s.shop, name: 'Lombard No. 7' }, cash: 61_250 }
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('lombard')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction('careers', 'readwrite')
        tx.objectStore('careers').put({ careerId: 'legacy-m3', savedAt: Date.now() - 3 * 86_400_000, version: state.meta.version, state })
        tx.oncomplete = () => {
          open.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 90_000 })
  await page.waitForFunction(() => window.__lombardReady === true, null, { timeout: 90_000 })
  await h.screen('title')
  if (!(await h.visible('slot-play-1'))) throw new Error('title: the pre-slot save did not migrate into slot 1')
  await h.shot('title-migrated', 'a pre-M4 autosave (no slot) migrated into slot 1; Continue')
  await h.click('title-continue')
  await h.screen('welcome')
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
    // Pin the quality tier (Auto would step down on a slow headless GPU mid-run)
    // skip the lull between customers (a Next customer button calls each one), and no walk from the door.
    const pinned = `${url}${url.includes('?') ? '&' : '?'}${/[?&]tier=/.test(url) ? '' : 'tier=mid&'}lull=0&walk=0`
    await page.goto(`${base}${pinned}`, { waitUntil: 'networkidle', timeout: 90_000 })
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
      await page.screenshot({ path: `${OUT}/gallery.png`, timeout: 120_000 })
      out.push(`${OUT}/gallery.png  every item def's model (glb or placeholder), front + back, hotspots as pink beads`)
      await context.close()
    }
    {
      // Dev scenario: a pawner back for a 12-day-old loan is first in line.
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1&scenario=redeem')
      const h = helpers(page, 'redeem')
      await page.waitForFunction(() => ['news', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) === 'news') await h.click('news-done')
      await h.screen('counter')
      await h.click('next-customer')
      await h.screen('redeem')
      await page.waitForTimeout(600)
      await h.shot('redeem', 'redeem visit: who, item, pawn ticket (lent + interest = total), Take X, hand it over')
      out.push(...h.shots)
      await context.close()
    }
    {
      // Dev scenario: a regular (Zinaida Petrovna) comes in for a story scene with a choice.
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1&scenario=story')
      const h = helpers(page, 'story')
      await page.waitForFunction(() => ['news', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) === 'news') await h.click('news-done')
      await h.screen('counter')
      await h.click('next-customer')
      await page.waitForTimeout(600)
      await h.shot('scene', 'story scene: regular badge, first line, Go on')
      await h.click('scene-next')
      await page.waitForTimeout(400)
      await h.shot('choices', 'last line: up to three choices, Go on hidden')
      await h.click('choice-truth')
      await page.waitForTimeout(400)
      await h.shot('reply', 'her reply to the truth; Go on ends the visit')
      await h.click('scene-next')
      await page.waitForTimeout(600)
      await h.shot('talked', 'resolved: Talked, no stamp')
      out.push(...h.shots)
      await context.close()
    }
    {
      // Dev scenario: the Protection arc's offer (Eduard Lvovich), its three choices and a refusal.
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1&scenario=protection')
      const h = helpers(page, 'protection')
      await page.waitForFunction(() => ['news', 'counter'].includes(document.body.dataset.screen ?? ''), null, { timeout: 15_000 })
      if ((await page.evaluate(() => document.body.dataset.screen)) === 'news') await h.click('news-done')
      await h.screen('counter')
      await h.click('next-customer')
      await page.waitForTimeout(600)
      await h.shot('offer', 'Protection offer: Eduard Lvovich, first line')
      for (let i = 0; i < 6 && !(await h.visible('choice-refuse')); i++) await h.click('scene-next')
      await page.waitForTimeout(400)
      await h.shot('choices', 'the offer itself and its three choices: accept, haggle, refuse')
      await h.click('choice-refuse')
      await page.waitForTimeout(400)
      await h.shot('refused', 'his reply to a refusal')
      out.push(...h.shots)
      await context.close()
    }
    // Head look (?look=<yawDeg>,<pitchDeg>, +yaw = right, +pitch = up): the empty counter view, head turned.
    // The player looks along +z, so world +X (the storeroom doorway at x = 3) is on their left.
    for (const [slug, look, what] of [
      ['left-90', '-90,-4', 'head turned left 90°: the storeroom doorway behind the counter (world +X side)'],
      ['right-95', '95,-18', 'head turned right ~95°: the low glass wing case behind the counter, tall wall cases beyond (world −X side)'],
      ['back-160', '160,-8', 'head turned round ~160°: the back wall 0.8 m behind the eye, safe and pinboard'],
      ['up-18', '0,18', 'looking up 18°: window and the canal street outside'],
    ]) {
      const { context, page } = await newPage(browser, PORTRAIT, `?seed=1&look=${look}`)
      const h = helpers(page, `look-${slug}`)
      await h.begin()
      await h.open()
      await h.screen('counter')
      await page.waitForTimeout(300)
      await h.shot('counter', `${what} (?look=${look})`)
      out.push(...h.shots)
      await context.close()
    }
    {
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1&perf=1')
      const h = helpers(page, 'perf')
      await h.begin()
      await h.open()
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
    {
      const { context, page } = await newPage(browser, PORTRAIT, '?seed=1')
      const h = helpers(page, 'economy')
      try {
        await playEconomy(page, h)
      } catch (err) {
        await page.screenshot({ path: `${OUT}/economy-FAILED.png` }).catch(() => {})
        errors.push(`[economy] flow: ${err.message.split('\n')[0]}`)
      }
      out.push(...h.shots)
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
  // Title screen and career slots (M4): no ?seed, so the title shows; each view gets a fresh, empty database.
  const titleShots = (view) => async (browser) => {
    const { context, page } = await newPage(browser, view, '')
    const h = helpers(page, `title-${view.name}`)
    try {
      if (view === PORTRAIT) await playTitle(page, h)
      else await playTitleShort(page, h)
    } catch (err) {
      await page.screenshot({ path: `${OUT}/title-${view.name}-FAILED.png` }).catch(() => {})
      errors.push(`[title-${view.name}] flow: ${err.message.split('\n')[0]}`)
    }
    await context.close()
    console.log(`title ${view.name} done at ${secs()} s`)
    return h.shots
  }
  // SHOTS_ONLY=title runs just the title flows (quick iteration on the menus).
  const only = process.env.SHOTS_ONLY
  // Portrait is the long flow; the other views share a second browser.
  let listing
  try {
    const [portrait, rest] = await Promise.all([
      run(async (browser) => {
        const out = []
        if (only !== 'title') out.push(...(await playView(PORTRAIT)(browser)))
        out.push(...(await titleShots(PORTRAIT)(browser)))
        return out
      }),
      run(async (browser) => {
        const out = []
        for (const view of VIEWS) {
          if (view === PORTRAIT) continue
          out.push(...(await titleShots(view)(browser)))
          if (only !== 'title') out.push(...(await playView(view)(browser)))
        }
        if (only !== 'title') out.push(...(await extras(browser)))
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
