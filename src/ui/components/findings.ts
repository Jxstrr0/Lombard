/**
 * Finding cards: paper receipt slips, newest on top. Each card carries its
 * tool icon + name and the finding text; positive/negative findings add an
 * icon and a word ("good sign" / "concern"), never colour alone.
 */
import type { Finding } from '../../game/types'
import { t } from '../../data/strings'
import { toolLabel } from '../format'
import { icons } from '../icons'
import { el } from './button'

const POLARITY: Record<Finding['polarity'], { icon: string; word: () => string } | null> = {
  positive: { icon: icons.plus, word: () => t('findings.good') },
  negative: { icon: icons.alert, word: () => t('findings.concern') },
  neutral: null,
}

/** A mouse or trackpad (not touch): the stack says "click" instead of "tap". */
function finePointer(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
}

export function findingCard(f: Finding, hotspotLabel?: string): HTMLElement {
  const card = el('article', `finding-card polarity-${f.polarity}`)
  card.dataset.id = `finding-${f.id}`
  const head = el('div', 'fc-head')
  const tool = el('span', 'fc-tool')
  tool.innerHTML = (icons as Record<string, string>)[f.tool] ?? icons.doc
  tool.append(el('span', '', toolLabel(f.tool)))
  head.append(tool)
  const pol = POLARITY[f.polarity]
  if (pol) {
    const p = el('span', 'fc-pol')
    p.innerHTML = pol.icon
    p.append(el('span', '', pol.word()))
    head.append(p)
  }
  card.append(head)
  if (hotspotLabel) card.append(el('div', 'fc-spot', hotspotLabel))
  card.append(el('p', 'fc-text', f.text))
  return card
}

/**
 * The stack on the left edge of the inspect view. Collapsed it shows the
 * newest card with older ones peeking out behind; tapping expands a list of
 * every finding with full text.
 */
export class FindingStack {
  readonly root: HTMLElement
  private stack: HTMLElement
  private list: HTMLElement
  private count: HTMLElement
  private key = ''
  private expanded = false

  constructor() {
    const root = el('div', 'findings')
    root.dataset.id = 'findings'
    this.stack = el('div', 'findings-stack')
    this.stack.setAttribute('role', 'button')
    this.stack.tabIndex = 0
    this.stack.dataset.id = 'findings-stack'
    this.stack.setAttribute('aria-label', t('findings.showAll'))
    this.count = el('span', 'findings-count')
    this.list = el('div', 'findings-list')
    this.list.dataset.id = 'findings-list'
    this.list.setAttribute('role', 'dialog')
    this.list.setAttribute('aria-label', t('findings.title'))
    this.list.hidden = true
    root.append(this.stack, this.list)
    this.stack.addEventListener('click', () => this.setExpanded(true))
    this.stack.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.setExpanded(true)
      }
    })
    this.list.addEventListener('click', () => this.setExpanded(false))
    this.root = root
  }

  get isExpanded(): boolean {
    return this.expanded
  }

  setExpanded(on: boolean): void {
    this.expanded = on
    this.list.hidden = !on
    this.stack.hidden = on || this.key === ''
  }

  render(findings: readonly Finding[], hotspotLabels: Record<string, string>): void {
    const key = findings.map((f) => f.id).join('|')
    if (key === this.key) return
    const grew = findings.length > (this.key ? this.key.split('|').length : 0)
    this.key = key
    this.stack.replaceChildren()
    this.list.replaceChildren()
    if (findings.length === 0) {
      this.setExpanded(false)
      this.stack.hidden = true
      return
    }
    const newestFirst = [...findings].reverse()
    // Collapsed: up to three slips, newest in front.
    newestFirst.slice(0, 3).forEach((f, i) => {
      const c = findingCard(f, f.hotspot ? hotspotLabels[f.hotspot] : undefined)
      c.style.setProperty('--depth', String(i))
      if (i === 0 && grew) c.classList.add('is-new')
      this.stack.prepend(c)
    })
    const mouse = finePointer()
    this.count.textContent = t(mouse ? 'findings.countClick' : 'findings.countTap', { count: findings.length })
    this.stack.append(this.count)
    const title = el('div', 'findings-list-title', t(mouse ? 'findings.listClick' : 'findings.listTap', { count: findings.length }))
    this.list.append(title)
    for (const f of newestFirst) this.list.append(findingCard(f, f.hotspot ? hotspotLabels[f.hotspot] : undefined))
    this.setExpanded(this.expanded)
  }

  reset(): void {
    this.key = ''
    this.stack.replaceChildren()
    this.list.replaceChildren()
    this.setExpanded(false)
  }
}
