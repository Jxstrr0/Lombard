/**
 * Counter screen overlay: dialogue strip plus three action buttons.
 * Reads state and dispatches actions; never mutates state.
 */
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import { createButton } from '../components/button'

const rub = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export class CounterScreen {
  readonly root: HTMLElement
  private speaker: HTMLElement
  private line: HTMLElement
  private cash: HTMLElement
  private day: HTMLElement
  private next: HTMLButtonElement
  private inspect: HTMLButtonElement
  private pass: HTMLButtonElement
  private primaryAction: 'day/open' | 'counter/next' | 'day/close' | 'counter/dismiss' = 'day/open'

  constructor(dispatch: (a: Action) => void) {
    const root = document.createElement('section')
    root.className = 'counter-ui'
    root.innerHTML = `
      <header class="hud">
        <span class="hud-day" data-ref="day"></span>
        <span class="hud-cash" data-ref="cash"></span>
      </header>
      <div class="strip">
        <div class="dialogue" aria-live="polite">
          <div class="speaker" data-ref="speaker"></div>
          <p class="line" data-ref="line"></p>
        </div>
        <div class="actions" data-ref="actions"></div>
      </div>`
    const q = (ref: string) => root.querySelector<HTMLElement>(`[data-ref="${ref}"]`)!
    this.root = root
    this.speaker = q('speaker')
    this.line = q('line')
    this.cash = q('cash')
    this.day = q('day')
    this.next = createButton({
      id: 'next',
      label: 'Next customer',
      variant: 'primary',
      onPress: () => dispatch({ type: this.primaryAction }),
    })
    this.inspect = createButton({ id: 'inspect', label: 'Inspect', onPress: () => dispatch({ type: 'counter/inspect' }) })
    this.pass = createButton({ id: 'pass', label: 'Pass', onPress: () => dispatch({ type: 'counter/pass' }) })
    q('actions').append(this.inspect, this.pass, this.next)
  }

  render(state: GameState): void {
    const c = state.current
    this.speaker.textContent = c ? c.customer.name : ''
    this.speaker.hidden = !c
    this.line.textContent = c ? `“${c.line}”` : state.narration
    this.line.classList.toggle('narration', !c)
    this.cash.textContent = `${rub.format(state.cash)} ₽`
    this.day.textContent = `Day ${state.calendar.day}`
    this.inspect.disabled = !c || c.phase !== 'present'
    this.pass.disabled = !c || c.phase === 'resolved'
    if (state.day.phase === 'closed') this.setPrimary('day/open', 'Open shop')
    else if (c?.phase === 'resolved') this.setPrimary('counter/dismiss', 'Next')
    else if (c) this.setPrimary('counter/next', 'Next customer', true)
    else if (state.queue.length > 0) this.setPrimary('counter/next', 'Next customer')
    else this.setPrimary('day/close', 'Close up')
  }

  private setPrimary(action: CounterScreen['primaryAction'], label: string, disabled = false): void {
    this.primaryAction = action
    this.next.textContent = label
    this.next.disabled = disabled
  }
}
