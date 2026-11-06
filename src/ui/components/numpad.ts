/**
 * Calculator-style number pad: digits on three columns, a fourth column of
 * side keys (quick-chips or clear). One-handed, every key ≥ 44 px.
 */
import { t } from '../../data/strings'
import { icons } from '../icons'
import { el } from './button'

export interface SideKey {
  id: string
  label: string
  /** Sub label, e.g. the rubles a chip stands for. */
  sub?: string
  onPress: () => void
  disabled?: boolean
}

const MAX_DIGITS = 8

export class NumPad {
  readonly root: HTMLElement
  private digits = ''
  private side: HTMLButtonElement[] = []

  constructor(
    idPrefix: string,
    private readonly onChange: (value: number) => void,
  ) {
    const root = el('div', 'numpad')
    root.dataset.id = `${idPrefix}-numpad`
    const layout = ['1', '2', '3', 'S0', '4', '5', '6', 'S1', '7', '8', '9', 'S2', '000', '0', 'back', 'S3']
    for (const k of layout) {
      const b = el('button', 'key')
      b.type = 'button'
      if (k.startsWith('S')) {
        b.classList.add('key-side')
        this.side.push(b)
      } else if (k === 'back') {
        b.innerHTML = icons.backspace
        b.setAttribute('aria-label', t('numpad.backspace'))
        b.dataset.id = `${idPrefix}-key-back`
        b.addEventListener('click', () => this.backspace())
      } else {
        b.textContent = k
        b.dataset.id = `${idPrefix}-key-${k}`
        b.addEventListener('click', () => this.type(k))
      }
      root.append(b)
    }
    this.root = root
  }

  get value(): number {
    return this.digits ? Number(this.digits) : 0
  }

  set(value: number): void {
    const v = Math.max(0, Math.round(value))
    this.digits = v > 0 ? String(v).slice(0, MAX_DIGITS) : ''
    this.onChange(this.value)
  }

  /** Configure the four side keys (missing entries become blank, inert keys). */
  setSideKeys(keys: (SideKey | null)[]): void {
    this.side.forEach((b, i) => {
      const k = keys[i] ?? null
      const sig = k ? `${k.id}|${k.label}|${k.sub ?? ''}|${k.disabled ? 1 : 0}` : ''
      if (b.dataset.sig === sig) {
        if (k) b.onclick = () => k.onPress()
        return
      }
      b.dataset.sig = sig
      b.replaceChildren()
      b.onclick = null
      b.disabled = !k || !!k.disabled
      b.classList.toggle('is-blank', !k)
      if (!k) {
        b.removeAttribute('data-id')
        b.setAttribute('aria-hidden', 'true')
        b.tabIndex = -1
        return
      }
      b.removeAttribute('aria-hidden')
      b.tabIndex = 0
      b.dataset.id = k.id
      b.append(el('span', 'key-main', k.label))
      if (k.sub) b.append(el('span', 'key-sub', k.sub))
      b.onclick = () => k.onPress()
    })
  }

  /** Keyboard input from the desktop handler. */
  key(k: string): boolean {
    if (/^[0-9]$/.test(k)) {
      this.type(k)
      return true
    }
    if (k === 'Backspace') {
      this.backspace()
      return true
    }
    return false
  }

  private type(k: string): void {
    if (this.digits === '' && /^0+$/.test(k)) return
    this.digits = (this.digits + k).slice(0, MAX_DIGITS)
    this.onChange(this.value)
  }

  private backspace(): void {
    this.digits = this.digits.slice(0, -1)
    this.onChange(this.value)
  }
}
