/**
 * Inspect view (GDD § Inspect view): item centred under a dark vignette, tool
 * bar at the bottom, findings as paper slips on the left edge, hotspot
 * markers projected from the 3D item. The orbit/pinch gestures are attached
 * to `gestureLayer` by main (src/input/gestures.ts drives the render stage).
 *
 * Tools: the loupe is the selected tool. Tapping a marker looks closely
 * at that spot; tapping the Loupe button looks over the whole item. The other
 * tools apply at once. The toolbar comes from availableTools() (M2: acid kit,
 * reference book, specialist call); locked tools stay visible, greyed, with a
 * note ("no kit", "no retainer") in place of their time.
 */
import { getItemDef } from '../../data/items'
import { tuning } from '../../data/tuning'
import type { Action } from '../../game/actions'
import { availableTools, TOOLBAR } from '../../game/inspect/available'
import { fakeProfileOf } from '../../game/items/generate'
import type { ItemDef, ToolId } from '../../game/schema/item'
import type { GameState } from '../../game/state'
import type { Finding } from '../../game/types'
import { createButton, el, setText } from '../components/button'
import { FindingStack } from '../components/findings'
import { TOOL_LABEL } from '../format'
import { icons, type IconName } from '../icons'

export interface HotspotView {
  id: string
  label: string
  x: number
  y: number
  visible: boolean
}

const BUSY_MS = 700

export class InspectScreen {
  readonly root: HTMLElement
  readonly gestureLayer: HTMLElement
  readonly panel: HTMLElement
  readonly header: HTMLElement
  readonly findings = new FindingStack()
  private itemName: HTMLElement
  private claim: HTMLElement
  private hotspotLayer: HTMLElement
  private hotspotEls = new Map<string, HTMLButtonElement>()
  private fx: HTMLElement
  private toolbar: HTMLElement
  private toolButtons = new Map<ToolId, HTMLButtonElement>()
  private toolOrder: ToolId[] = []
  private toolUsable = new Map<ToolId, boolean>()
  private def: ItemDef | null = null
  private visitId: string | null = null
  private busyUntil = 0
  private lastHotspots: HotspotView[] = []
  private itemCenter = { x: 0, y: 0 }
  private examined = new Set<string>()

  constructor(private readonly dispatch: (a: Action) => void) {
    const root = el('section', 'screen inspect-screen')
    root.dataset.screen = 'inspect'
    root.append(el('div', 'vignette'))

    this.gestureLayer = el('div', 'gesture-layer')
    this.gestureLayer.dataset.id = 'inspect-gesture'
    this.gestureLayer.setAttribute('aria-label', 'Drag to turn the item, pinch or scroll to zoom')

    this.header = el('div', 'inspect-header')
    this.itemName = el('div', 'item-tag item-tag-lg')
    this.itemName.dataset.id = 'inspect-item'
    this.claim = el('p', 'inspect-claim')
    this.header.append(this.itemName, this.claim)

    this.hotspotLayer = el('div', 'hotspots')
    this.fx = el('div', 'tool-fx')
    this.fx.setAttribute('aria-hidden', 'true')

    const panel = el('div', 'inspect-panel')
    const hint = el('p', 'inspect-hint', 'Drag to turn · pinch to zoom · tap a marker to look closely')
    const toolbar = el('div', 'toolbar')
    toolbar.setAttribute('role', 'toolbar')
    toolbar.setAttribute('aria-label', 'Tools')
    this.toolbar = toolbar
    const actions = el('div', 'actions inspect-actions')
    actions.append(
      createButton({ id: 'inspect-pass', label: 'Pass', onPress: () => dispatch({ type: 'counter/pass' }) }),
      createButton({
        id: 'inspect-done',
        label: 'Done — make an offer',
        variant: 'primary',
        onPress: () => dispatch({ type: 'inspect/done' }),
      }),
    )
    panel.append(hint, toolbar, actions)
    this.panel = panel

    root.append(this.gestureLayer, this.header, this.hotspotLayer, this.fx, this.findings.root, panel)
    this.root = root
  }

  /** Free band for the item, in CSS px (between the header and the findings/panel). */
  freeBand(): { top: number; bottom: number; left: number; right: number } {
    const w = window.innerWidth
    const h = window.innerHeight
    const head = this.header.getBoundingClientRect()
    const panel = this.panel.getBoundingClientRect()
    const landscape = w > h
    if (landscape) {
      // panel docked on the right
      const right = panel.width > 0 && panel.left > w * 0.4 ? panel.left : w
      return { top: Math.max(56, head.bottom), bottom: h - 12, left: Math.min(w * 0.28, 260), right }
    }
    const top = head.height > 0 ? head.bottom + 4 : 96
    const panelTop = panel.height > 0 ? panel.top : h * 0.72
    // Reserve the strip above the panel for the findings stack.
    const bottom = Math.max(top + 160, panelTop - 132)
    return { top, bottom, left: 0, right: w }
  }

  setItemCenter(x: number, y: number): void {
    this.itemCenter = { x, y }
    this.root.style.setProperty('--cx', `${Math.round(x)}px`)
    this.root.style.setProperty('--cy', `${Math.round(y)}px`)
  }

  render(state: GameState, prev: GameState | null): void {
    const c = state.current
    const insp = state.inspect
    if (!c || !insp || !c.item) return
    if (c.visitId !== this.visitId) {
      this.visitId = c.visitId
      this.findings.reset()
      this.fx.replaceChildren()
      try {
        this.def = getItemDef(c.item.defId)
      } catch {
        this.def = null
      }
    }
    setText(this.itemName, this.def?.name ?? 'Unknown item')
    setText(this.claim, `${c.customer.name}: “${c.item.story}”`)
    const labels: Record<string, string> = {}
    for (const h of this.def?.model.hotspots ?? []) labels[h.id] = h.label
    this.findings.render(insp.findings, labels)
    this.examined = new Set(insp.findings.filter((f) => f.hotspot).map((f) => f.hotspot!))

    this.renderToolbar(state)

    // Tool feedback for findings that just arrived
    const before = prev?.current?.visitId === c.visitId ? (prev.inspect?.findings.length ?? 0) : insp.findings.length
    const fresh = insp.findings.slice(before)
    if (fresh.length > 0) this.playFx(fresh, state)
    this.renderHotspots(this.lastHotspots)
  }

  /** Per-frame hotspot positions from the render stage (empty while not fully in inspect). */
  updateHotspots(list: HotspotView[]): void {
    this.lastHotspots = list
    this.renderHotspots(list)
  }

  /** Keyboard: 1–6 pick a tool in toolbar order. */
  key(k: string): boolean {
    const i = Number(k) - 1
    const tool = Number.isInteger(i) ? this.toolOrder[i] : undefined
    if (!tool) return false
    this.useTool(tool)
    return true
  }

  /** Toolbar from availableTools(): locked tools stay visible, greyed, with their note. */
  private renderToolbar(state: GameState): void {
    const insp = state.inspect!
    const list = this.def ? availableTools(state, this.def) : TOOLBAR.map((tool) => ({ tool, usable: false, note: '' }))
    const order = list.map((t) => t.tool)
    if (order.join() !== this.toolOrder.join()) {
      this.toolOrder = order
      this.toolButtons.clear()
      this.toolbar.replaceChildren()
      this.toolbar.classList.toggle('toolbar-many', order.length > 3)
      for (const tool of order) {
        const b = el('button', 'tool')
        b.type = 'button'
        b.dataset.id = `tool-${tool}`
        b.innerHTML = `${icons[tool as IconName] ?? icons.doc}<span class="tool-name">${TOOL_LABEL[tool]}</span><span class="tool-cost"><span class="tc-clock">${icons.clock}</span><span class="tc-lock">${icons.lock}</span><span class="tool-secs">${tuning.inspect.toolSeconds[tool]} s</span><span class="tool-note"></span></span><span class="tool-uses" hidden></span>`
        if (tool === 'loupe') b.classList.add('is-selected')
        b.addEventListener('click', () => {
          if (this.toolUsable.get(tool)) this.useTool(tool)
        })
        this.toolButtons.set(tool, b)
        this.toolbar.append(b)
      }
    }
    for (const t of list) {
      const b = this.toolButtons.get(t.tool)!
      this.toolUsable.set(t.tool, t.usable)
      b.classList.toggle('is-locked', !t.usable)
      b.setAttribute('aria-disabled', String(!t.usable))
      const note = t.note ?? ''
      // Locked: the note replaces the time ("no kit"). Usable: "20 s · 9 left".
      const noteEl = b.querySelector<HTMLElement>('.tool-note')!
      b.querySelector<HTMLElement>('.tool-secs')!.hidden = !t.usable && !!note
      setText(noteEl, note ? (t.usable ? ` · ${note}` : note) : '')
      const secs = tuning.inspect.toolSeconds[t.tool]
      b.setAttribute(
        'aria-label',
        `${TOOL_LABEL[t.tool]}, ${secs} seconds${t.tool === 'loupe' ? ', look over the whole item' : ''}${note ? `, ${note}` : ''}${t.usable ? '' : ', unavailable'}`,
      )
      const uses = insp.toolUses[t.tool] ?? 0
      const badge = b.querySelector<HTMLElement>('.tool-uses')!
      badge.hidden = uses === 0
      setText(badge, `×${uses}`)
    }
  }

  private useTool(tool: ToolId, hotspot?: string): void {
    const now = performance.now()
    if (now < this.busyUntil) return
    this.busyUntil = now + BUSY_MS
    this.root.classList.add('is-busy')
    window.setTimeout(() => this.root.classList.remove('is-busy'), BUSY_MS)
    this.dispatch(hotspot ? { type: 'inspect/useTool', tool, hotspot } : { type: 'inspect/useTool', tool })
  }

  private renderHotspots(list: HotspotView[]): void {
    const seen = new Set<string>()
    for (const h of list) {
      seen.add(h.id)
      let b = this.hotspotEls.get(h.id)
      if (!b) {
        b = el('button', 'hotspot')
        b.type = 'button'
        b.dataset.id = `hotspot-${h.id}`
        b.setAttribute('aria-label', `Look closely: ${h.label} (${tuning.inspect.toolSeconds.loupe} seconds)`)
        b.innerHTML = `<span class="hotspot-ring">${icons.loupe}</span><span class="hotspot-label"></span>`
        b.querySelector('.hotspot-label')!.textContent = h.label
        const id = h.id
        b.addEventListener('click', () => this.useTool('loupe', id))
        this.hotspotLayer.append(b)
        this.hotspotEls.set(h.id, b)
      }
      b.style.transform = `translate(${Math.round(h.x - 22)}px, ${Math.round(h.y - 22)}px)`
      b.classList.toggle('is-occluded', !h.visible)
      b.classList.toggle('is-done', this.examined.has(h.id))
      b.classList.toggle('label-left', h.x > window.innerWidth * 0.62)
    }
    for (const [id, b] of this.hotspotEls) {
      if (!seen.has(id)) {
        b.remove()
        this.hotspotEls.delete(id)
      }
    }
  }

  private playFx(fresh: readonly Finding[], state: GameState): void {
    const f = fresh[fresh.length - 1]!
    const { x, y } = this.itemCenter
    const node = el('div', `fx fx-for-${f.tool}`)
    node.style.setProperty('--x', `${Math.round(x)}px`)
    node.style.setProperty('--y', `${Math.round(y)}px`)
    if (f.tool === 'loupe') {
      const spot = f.hotspot ? this.lastHotspots.find((h) => h.id === f.hotspot) : undefined
      if (spot) {
        node.style.setProperty('--x', `${Math.round(spot.x)}px`)
        node.style.setProperty('--y', `${Math.round(spot.y)}px`)
      }
      node.innerHTML = `<span class="fx-lens"></span>`
    } else if (f.tool === 'scale') {
      // The reading is the first number in grams among this use's findings (the
      // weight finding comes first; tells found on the same use follow it).
      let reading = 'weighed'
      for (const g of fresh) {
        const m = /(\d+(?:[.,]\d+)?)\s?(?:g|grams?)\b/i.exec(g.text)
        if (m) {
          reading = `${m[1]!.replace(',', '.')} g`
          break
        }
      }
      node.innerHTML = `<span class="fx-scale">${icons.scale}<span class="fx-scale-lcd">${reading}</span></span>`
    } else if (f.tool === 'magnet') {
      let magnetic = false
      const c = state.current
      if (c?.item && this.def) magnetic = fakeProfileOf(this.def, c.item)?.magnetic ?? this.def.magnetic
      node.classList.add(magnetic ? 'is-stuck' : 'is-free')
      node.innerHTML = `<span class="fx-magnet">${icons.magnet}</span><span class="fx-magnet-word">${magnetic ? 'snap!' : 'no pull'}</span>`
    } else if (f.tool === 'acid') {
      // Read the reaction off the finding (never the hidden item): negative = it fizzed.
      const fizz = fresh.some((g) => g.tool === 'acid' && g.polarity === 'negative')
      node.classList.add(fizz ? 'is-fizz' : 'is-holds')
      node.innerHTML = `<span class="fx-drop"></span><span class="fx-splash"></span><span class="fx-word">${fizz ? 'fizz…' : 'holds'}</span>`
    } else if (f.tool === 'reference') {
      const m = /([\d,]+ ₽)–([\d,]+ ₽)/.exec(f.text)
      node.innerHTML = `<span class="fx-book">${icons.reference}<span class="fx-word">${m ? `${m[1]}–${m[2]}` : 'not listed'}</span></span>`
    } else if (f.tool === 'specialist') {
      node.innerHTML = `<span class="fx-phone">${icons.specialist}<span class="fx-word">ring… ring…</span></span>`
    } else {
      return
    }
    this.fx.append(node)
    window.setTimeout(() => node.remove(), 1800)
  }
}
