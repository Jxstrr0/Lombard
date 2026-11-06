/**
 * The desktop key map (M6), in one place: which key means what, and the hint
 * each button shows on a device with a fine pointer. Pure: no DOM, no game
 * state. `keyboard.ts` turns key events into these commands; `ui/keys.ts`
 * marks the buttons with their hints and routes a command to the visible screen.
 *
 *   1–9          numbered choices: a story scene's answers, the counter's actions
 *                (Pass, Inspect…), the tools in inspect; digits on a number pad
 *   Enter        confirm: the screen's main button (Next customer, Inspect, Done,
 *                Offer, Open shop…)
 *   Esc          back / close: the open sheet, the number pad, the evidence picker;
 *                at the counter or the ledger with nothing open, Settings
 *   ← → / A D    inspect: turn the item; ↑ ↓ tilt it; + − zoom
 *   Backspace    a number pad: delete a digit
 *   Y            haggling: accept their ask
 *   S            the Shop sheet (display and price tags)
 *   O            the Office (between days, on the ledger)
 *   L            the ledger: Close up when the line is empty
 */

export type Command =
  | { kind: 'digit'; digit: string }
  | { kind: 'confirm' }
  | { kind: 'back' }
  | { kind: 'backspace' }
  /** Held orbit keys, as a direction; keyboard.ts turns it into drag pixels per frame. */
  | { kind: 'orbit'; dx: number; dy: number }
  | { kind: 'zoom'; factor: number }
  | { kind: 'letter'; letter: LetterKey }

/** Letter shortcuts that press a named button. */
export type LetterKey = 'shop' | 'office' | 'ledger' | 'accept'

/** Orbit direction per key (x: −1 left, +1 right; y: −1 up, +1 down). */
const ORBIT_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
}

const LETTERS: Record<string, LetterKey> = {
  s: 'shop',
  o: 'office',
  l: 'ledger',
  y: 'accept',
}

/** Zoom step per press of + or −. */
export const ZOOM_STEP = 1.12

/** Held orbit keys turn the item like a drag of this many CSS pixels per second. */
export const ORBIT_PX_PER_S = 240

/** The orbit direction a key holds, or null. */
export function orbitFor(key: string): [number, number] | null {
  return ORBIT_KEYS[key.length === 1 ? key.toLowerCase() : key] ?? null
}

/** The command for one key press (orbit keys excluded: they are held, see orbitFor). */
export function commandFor(key: string): Command | null {
  if (/^[0-9]$/.test(key)) return { kind: 'digit', digit: key }
  switch (key) {
    case 'Enter':
      return { kind: 'confirm' }
    case 'Escape':
      return { kind: 'back' }
    case 'Backspace':
      return { kind: 'backspace' }
    case '+':
    case '=':
      return { kind: 'zoom', factor: ZOOM_STEP }
    case '-':
    case '_':
      return { kind: 'zoom', factor: 1 / ZOOM_STEP }
  }
  const letter = key.length === 1 ? LETTERS[key.toLowerCase()] : undefined
  return letter ? { kind: 'letter', letter } : null
}

/** What a button answers to: confirm (Enter), back (Esc) or a letter. */
export type ButtonKey = 'confirm' | 'back' | LetterKey

/** The hint shown on a button for each key. */
export const KEY_HINT: Record<ButtonKey, string> = {
  confirm: 'Enter',
  back: 'Esc',
  shop: 'S',
  office: 'O',
  ledger: 'L',
  accept: 'Y',
}

/**
 * Buttons (by data-id) and the key that presses them. A button with a number
 * (a numbered row) still shows the key named here instead of its number.
 */
export const BUTTON_KEYS: Record<string, ButtonKey> = {
  // the counter
  'next-customer': 'confirm',
  inspect: 'confirm',
  dismiss: 'confirm',
  'scene-next': 'confirm',
  'close-up': 'ledger',
  'shop-counter': 'shop',
  'settings-counter': 'back',
  // sale and redeem
  'sale-accept': 'confirm',
  'sale-ask': 'confirm',
  'sale-back': 'back',
  'redeem-return': 'confirm',
  // inspect and offer
  'inspect-done': 'confirm',
  'make-offer': 'confirm',
  'set-estimate': 'confirm',
  'accept-ask': 'accept',
  'back-to-inspect': 'back',
  'evidence-close': 'back',
  // between days
  'intro-next': 'confirm',
  'intro-begin': 'confirm',
  'open-shop': 'confirm',
  'news-done': 'confirm',
  'open-office': 'office',
  'shop-ledger': 'shop',
  'settings-ledger': 'back',
  'settings-welcome': 'back',
  'ending-next': 'confirm',
  'ending-menu': 'confirm',
  'ending-back': 'back',
  // sheets
  'settings-close': 'back',
  'office-close': 'back',
  'shop-close': 'back',
  'tag-back': 'back',
  'tag-set': 'confirm',
  'title-load-close': 'back',
  'title-continue': 'confirm',
}

/** Keys a button answers to, for its data-keys attribute ("Enter", "Escape", "s", …). */
export const BUTTON_KEY_NAMES: Record<ButtonKey, string> = {
  confirm: 'Enter',
  back: 'Escape',
  shop: 's',
  office: 'o',
  ledger: 'l',
  accept: 'y',
}
