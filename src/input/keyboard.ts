/**
 * Desktop keyboard shortcuts (docs/02-ARCHITECTURE.md § Input). The active
 * screen decides what a key means: 1–3 pick a tool in inspect, digits type
 * into the number pad in the offer view, Esc goes back / closes.
 * Ignored while typing in a text field or with modifier keys held.
 */
export type KeyName = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'Backspace' | 'Enter' | 'Escape'

const KEYS = new Set<string>(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', 'Enter', 'Escape'])

export function bindKeyboard(onKey: (key: KeyName) => boolean): () => void {
  const handler = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (!KEYS.has(e.key)) return
    if (onKey(e.key as KeyName)) e.preventDefault()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
