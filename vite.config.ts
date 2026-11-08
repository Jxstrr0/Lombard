import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

function shortSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const buildDate = new Date().toISOString().slice(0, 10)

// The player-facing version, Major.Minor.Patch.Build (see CLAUDE.md § Versions).
// It lives in the VERSION file at the repo root so there is one place to bump it.
// package.json keeps its own three-part number because npm requires semver.
const gameVersion = readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim()
if (!/^\d+\.\d+\.\d+\.\d+$/.test(gameVersion)) {
  throw new Error(`VERSION must be four numbers like 0.1.0.0, got "${gameVersion}"`)
}

export default defineConfig({
  // Relative base: every asset path in the build is relative to index.html, so the same
  // dist/ works under a sub-path (jxstrr0.github.io/Lombard/) and at a domain's root
  // (lombard.longlight.games). import.meta.env.BASE_URL is './' at runtime.
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(shortSha()),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  build: {
    target: 'es2022',
    // The biggest chunks (three.js, content) are ~750–780 kB; scripts/check-bundle.mjs holds the real limits.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // M6 perf pass: split the eager JS by how often it changes, so a new deploy
        // re-downloads only what moved (Kelbo reviews every push on a phone) and the
        // chunks download in parallel. All four still load up front: the game logic
        // reads its content synchronously. Lazy chunks (street, life, stats, dev
        // scenarios, gallery) stay lazy because nothing here matches them.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'vendor', test: /node_modules[\\/](zod|fflate|idb)[\\/]/, priority: 20 },
            // Authored content: items, regulars, stories, endings, news, lines.
            { name: 'content', test: /[\\/]src[\\/]data[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
