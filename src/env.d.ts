/// <reference types="vite/client" />

/** Short commit hash, injected by vite.config.ts. */
declare const __BUILD_SHA__: string
/** Build date (YYYY-MM-DD), injected by vite.config.ts. */
declare const __BUILD_DATE__: string

interface Window {
  /** Set when the first frame with the environment has rendered (used by npm run shots). */
  __lombardReady?: boolean
  /** Read-only snapshot of the game state (debugging and npm run shots). */
  __lombardState?: () => import('./game/state').GameState
}
