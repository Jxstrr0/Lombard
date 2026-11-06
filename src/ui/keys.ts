/**
 * Key hints and key presses on the DOM side (M6). The map itself is
 * input/keymap.ts; this marks the visible buttons with the key they answer to
 * (`data-keys`, the accepted key names, and `data-key-hint`, the badge text shown
 * only with a fine pointer, see ui/desktop.css) and presses the right one.
 *
 * Numbered rows: a story scene's answers, the title's career slots, the inspect
 * tools and the counter's action row get 1, 2, 3… in reading order (icon-only
 * buttons and the Shop button keep their letters).
 */
import { BUTTON_KEY_NAMES, BUTTON_KEYS, KEY_HINT } from '../input/keymap'

/** Numbered groups: container, then the buttons in it. The first visible group with buttons wins. */
const NUMBERED: [string, string][] = [
  ['.scene-choices', '.btn-choice'],
  ['.title-careers', '.slot-main'],
  ['.toolbar', '.tool'],
  ['.counter-actions', '.btn:not(.btn-icon):not(.btn-shop)'],
]

function shown(e: HTMLElement): boolean {
  return e.getClientRects().length > 0 && !e.closest('[hidden]')
}

function usable(e: HTMLElement): boolean {
  return shown(e) && !(e as HTMLButtonElement).disabled && e.getAttribute('aria-disabled') !== 'true'
}

/** Mark every button under `root` with its keys and hint. Cheap enough to run on every render. */
export function applyKeyHints(root: HTMLElement): void {
  for (const b of root.querySelectorAll<HTMLElement>('[data-keys]')) {
    delete b.dataset.keys
    delete b.dataset.keyHint
  }
  for (const b of root.querySelectorAll<HTMLElement>('[data-id]')) {
    const k = BUTTON_KEYS[b.dataset.id!]
    if (!k) continue
    b.dataset.keys = BUTTON_KEY_NAMES[k]
    b.dataset.keyHint = KEY_HINT[k]
  }
  for (const [box, item] of NUMBERED) {
    for (const group of root.querySelectorAll<HTMLElement>(box)) {
      if (!shown(group)) continue
      const items = [...group.querySelectorAll<HTMLElement>(item)].filter(shown).slice(0, 9)
      items.forEach((b, i) => {
        const n = String(i + 1)
        b.dataset.keys = b.dataset.keys ? `${b.dataset.keys} ${n}` : n
        // A named key (↵, S…) stays the hint; the number still works.
        if (!b.dataset.keyHint) b.dataset.keyHint = n
      })
    }
  }
}

/** Press the visible, enabled button under `root` that answers to `key`. True if one did. */
export function pressKey(root: HTMLElement, key: string): boolean {
  applyKeyHints(root)
  for (const b of root.querySelectorAll<HTMLElement>('[data-keys]')) {
    if (!b.dataset.keys!.split(' ').includes(key) || !usable(b)) continue
    b.click()
    return true
  }
  return false
}
