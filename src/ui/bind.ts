/** Wires the store to the DOM: one render function per screen. */
import type { Store } from '../game/store'
import { CounterScreen } from './screens/counter'

export function bindUi(store: Store, mount: HTMLElement): void {
  const counter = new CounterScreen(store.dispatch)
  mount.appendChild(counter.root)
  counter.render(store.get())
  store.subscribe((state) => counter.render(state))

  const build = document.createElement('div')
  build.className = 'build-number'
  build.textContent = `${__BUILD_SHA__} · ${__BUILD_DATE__}`
  mount.appendChild(build)
}
