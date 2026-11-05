import { execSync } from 'node:child_process'
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

export default defineConfig({
  base: '/Lombard/',
  define: {
    __BUILD_SHA__: JSON.stringify(shortSha()),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
})
