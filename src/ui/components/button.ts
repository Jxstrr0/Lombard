export interface ButtonSpec {
  id: string
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
}

export function createButton(spec: ButtonSpec): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = `btn btn-${spec.variant ?? 'secondary'}`
  b.dataset.id = spec.id
  b.textContent = spec.label
  b.addEventListener('click', spec.onPress)
  return b
}
