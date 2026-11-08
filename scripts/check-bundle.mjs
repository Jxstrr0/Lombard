#!/usr/bin/env node
/**
 * First-load guard (M6 perf pass). Runs after `vite build` (npm's postbuild) and
 * fails the build when what a fresh visit downloads before the first customer
 * stands at the counter could pass CLAUDE.md's 15 MB, or when the eager JS grows
 * past its limits. Reads dist/ only, so it is fast and deterministic.
 *
 * The first-load total is built from files on disk, uncompressed (GitHub Pages
 * gzips JS and CSS, so the wire is smaller):
 * - everything index.html pulls eagerly (entry script, modulepreloads, stylesheet);
 * - the boot assets main.ts loads behind the title screen: the baked shop, the
 *   HDRI, the Draco and Basis decoders, the canal backdrop, the street (one
 *   people sheet, the larger), the Latin and Latin Extended font files (the
 *   ones our text's unicode ranges pull) and every preloaded sound (the first
 *   tap starts audio): the top-level files in assets/audio/ only. The voice
 *   lines (voice/) and the ElevenLabs effects and beds (lazy/) are fetched on
 *   first use, so they are not counted;
 * - the first customer and the one queued behind them, and the first item: these
 *   are random, so the check counts two median avatar glbs and a median item glb,
 *   and prints the worst case (the largest of each) as a warning when that would
 *   pass the limit.
 * Measured with Playwright on Nov 6 (0.11.0.0): 13.9 MiB for a real first day;
 * this estimate gives 14.1 MiB for the same build. See docs/05 § Perf final pass.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const DIST = 'dist'
const MiB = 1024 * 1024
const LIMITS = {
  firstLoad: 15 * MiB,
  /** The entry chunk (game logic, render, UI): ~350 kB after the M6 split. */
  entry: 500 * 1000,
  /** Any one eager chunk (three.js and the content chunk are ~750–780 kB). */
  chunk: 900 * 1000,
}

const size = async (p) => (await stat(p)).size
const files = async (dir, re = /./) => (await readdir(dir)).filter((f) => re.test(f)).map((f) => path.join(dir, f))
const sizes = async (list) => (await Promise.all(list.map(size))).sort((x, y) => x - y)
const median = async (list) => {
  const s = await sizes(list)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}
const largest = async (list) => Math.max(0, ...(await Promise.all(list.map(size))))
const sum = async (list) => (await Promise.all(list.map(size))).reduce((a, b) => a + b, 0)
const fmt = (b) => (b >= MiB ? `${(b / MiB).toFixed(2)} MiB` : `${(b / 1000).toFixed(1)} kB`)

const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
const base = '/Lombard/'
const eager = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+\.(?:js|css))"/g)].map((m) => path.join(DIST, m[1].replace(base, '')))
const entry = html.match(/<script type="module"[^>]*\ssrc="([^"]+)"/)?.[1]
if (!entry || eager.length === 0) throw new Error('check-bundle: could not read the eager files from dist/index.html')

const a = (p) => path.join(DIST, 'assets', p)
const parts = {
  'eager js + css': await sum(eager),
  shop: await sum(await files(a('shop'))),
  env: await sum(await files(a('env'))),
  decoders: await sum([...(await files(a('decoders/draco'))), ...(await files(a('decoders/basis')))]),
  'backdrop + street': (await sum(await files(a('backdrop')))) + (await sum(await files(a('street'), /^(?!people_)/))) + (await largest(await files(a('street'), /^people_/))),
  fonts: await sum(await files(a(''), /-latin-(ext-)?\d+-normal-.*\.woff2$/)),
  audio: await sum(await files(a('audio'), /\.mp3$/)),
  'two avatars': 2 * (await median(await files(a('customers'), /\.glb$/))),
  'first item': await median(await files(a('items'), /\.glb$/)),
}
const total = Object.values(parts).reduce((x, y) => x + y, 0)
const worst =
  total - parts['two avatars'] - parts['first item'] + 2 * (await largest(await files(a('customers'), /\.glb$/))) + (await largest(await files(a('items'), /\.glb$/)))

const problems = []
console.log(`first load: ${fmt(total)} of ${fmt(LIMITS.firstLoad)} (worst case, largest avatars and item: ${fmt(worst)})`)
for (const [k, v] of Object.entries(parts)) console.log(`  ${k.padEnd(18)} ${fmt(v)}`)
if (worst > LIMITS.firstLoad) console.warn(`  warning: the worst-case first day (${fmt(worst)}) would pass ${fmt(LIMITS.firstLoad)}`)
if (total > LIMITS.firstLoad) problems.push(`first load ${fmt(total)} is over ${fmt(LIMITS.firstLoad)}`)
for (const f of eager.filter((f) => f.endsWith('.js'))) {
  const s = await size(f)
  const isEntry = f.endsWith(entry.replace(base, '').split('/').pop())
  const limit = isEntry ? LIMITS.entry : LIMITS.chunk
  console.log(`  ${isEntry ? 'entry' : 'eager'} ${path.basename(f)} ${fmt(s)}`)
  if (s > limit) problems.push(`${path.basename(f)} is ${fmt(s)}, over its ${fmt(limit)} limit`)
}
if (problems.length) {
  console.error(`check-bundle failed:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
