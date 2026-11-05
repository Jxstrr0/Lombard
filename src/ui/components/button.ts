import { icons, type IconName } from '../icons'

export interface ButtonSpec {
  id: string
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: IconName
  /** Accessible name when the visible label is short or icon-only. */
  ariaLabel?: string
  className?: string
}

export function createButton(spec: ButtonSpec): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `btn btn-${spec.variant ?? 'secondary'}${spec.className ? ` ${spec.className}` : ''}`
  b.dataset.id = spec.id
  setButtonLabel(b, spec.label, spec.icon)
  if (spec.ariaLabel) b.setAttribute('aria-label', spec.ariaLabel)
  b.addEventListener('click', () => {
    if (!b.disabled) spec.onPress()
  })
  return b
}

/** Replace a button's visible label (and optional leading icon) without re-creating it. */
export function setButtonLabel(b: HTMLButtonElement, label: string, icon?: IconName): void {
  const key = `${icon ?? ''}|${label}`
  if (b.dataset.labelKey === key) return
  b.dataset.labelKey = key
  b.innerHTML = icon ? icons[icon] : ''
  if (label) {
    const span = document.createElement('span')
    span.className = 'btn-label'
    span.textContent = label
    b.appendChild(span)
  }
}

/** Small helper: create an element with a class and optional text. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

/** Set text only when it changed (avoids layout churn on the 1 Hz clock re-render). */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text
}
