/**
 * Desktop keyboard (docs/02-ARCHITECTURE.md § Input). Turns key events into the
 * commands of the key map (keymap.ts); the active screen decides what a command
 * means. Orbit keys are held: while one is down, every frame sends an orbit of
 * a few drag pixels, so the item turns smoothly instead of at the key-repeat rate.
 * Ignored while typing in a text field or with modifier keys held.
 */
import { commandFor, orbitFor, ORBIT_PX_PER_S, type Command } from './keymap'

export type { Command } from './keymap'

/** `onCommand` returns true when the command was used (the key's default action is then prevented). */
export function bindKeyboard(onCommand: (command: Command) => boolean): () => void {
  const held = new Map<string, [number, number]>()
  let raf = 0
  let last = 0

  const tick = (t: number) => {
    raf = 0
    if (held.size === 0) return
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60
    last = t
    let x = 0
    let y = 0
    for (const [dx, dy] of held.values()) {
      x += dx
      y += dy
    }
    const px = ORBIT_PX_PER_S * dt
    // The screen may have changed under a held key (Done, a sheet): let go.
    if (!onCommand({ kind: 'orbit', dx: Math.sign(x) * px, dy: Math.sign(y) * px })) held.clear()
    if (held.size > 0) raf = requestAnimationFrame(tick)
  }

  const typing = (t: EventTarget | null) => {
    const e = t as HTMLElement | null
    return !!e && (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.isContentEditable)
  }

  const down = (e: KeyboardEvent) => {
    if (typing(e.target)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const orbit = orbitFor(e.key)
    if (orbit) {
      const id = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (held.has(id)) {
        e.preventDefault()
        return
      }
      // A probe with no movement: only the inspect view takes orbit keys (elsewhere arrows scroll).
      if (!onCommand({ kind: 'orbit', dx: 0, dy: 0 })) return
      e.preventDefault()
      held.set(id, orbit)
      last = 0
      if (!raf) raf = requestAnimationFrame(tick)
      return
    }
    // A focused button already presses itself on Enter.
    if (e.key === 'Enter' && (e.target as HTMLElement | null)?.tagName === 'BUTTON') return
    const command = commandFor(e.key)
    if (!command) return
    // Held keys repeat; only typing and zoom should (a held Enter must not race through screens).
    if (e.repeat && command.kind !== 'backspace' && command.kind !== 'zoom' && command.kind !== 'digit') return
    if (onCommand(command)) e.preventDefault()
  }

  const up = (e: KeyboardEvent) => {
    held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)
  }
  const blur = () => held.clear()

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    if (raf) cancelAnimationFrame(raf)
  }
}
