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
  base: '/Lombard/',
  define: {
    __BUILD_SHA__: JSON.stringify(shortSha()),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GAME_VERSION__: JSON.stringify(gameVersion),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
})
