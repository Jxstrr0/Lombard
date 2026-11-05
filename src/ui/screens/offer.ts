/**
 * Offer view (GDD § Offer view). Step 1: the player enters their own estimate.
 * Step 2: the offer pad with quick-chips (25 / 40 / 60 % of the estimate),
 * approach buttons (Straight, Evidence → finding picker, Sympathy, Walk),
 * the customer's latest line and, after a counter, "Accept {ask}".
 * Local UI state (typed digits, chosen approach) lives here; game state is
 * only changed by dispatching actions.
 */
import { getItemDef } from '../../data/items'
import type { Action } from '../../game/actions'
import type { GameState } from '../../game/state'
import type { Approach } from '../../game/types'
import { createButton, el, setButtonLabel, setText } from '../components/button'
import { findingCard } from '../components/findings'
import { NumPad } from '../components/numpad'
import { archetypeLabel, itemNameOf, rub } from '../format'
import type { IconName } from '../icons'
import { dayLabel, monthlyRateLabel } from '../loanFormat'
import { loanTerms } from '../../game/loans/loans'
import '../loans.css'

const CHIPS = [0.25, 0.4, 0.6] as const

const APPROACHES: { id: Approach; label: string; icon: IconName; hint: string }[] = [
  { id: 'straight', label: 'Straight', icon: 'coins', hint: 'Just the number.' },
  { id: 'evidence', label: 'Evidence', icon: 'receipt', hint: 'Point at something you found.' },
  { id: 'sympathy', label: 'Sympathy', icon: 'heart', hint: 'Soften it. Works on proud, sentimental sellers.' },
  { id: 'walk', label: 'Walk', icon: 'walk', hint: 'Threaten to pass. Works on the desperate.' },
]

export class OfferScreen {
  readonly root: HTMLElement
  readonly panel: HTMLElement
  private bubbleName: HTMLElement
  private bubbleLine: HTMLElement
  private askRow: HTMLElement
  private askText: HTMLElement
  private acceptBtn: HTMLButtonElement
  private estimateRow: HTMLElement
  private estimateText: HTMLElement
  private tagLabel: HTMLElement
  private tagValue: HTMLElement
  private tagNote: HTMLElement
  /** Pawn mode: due date, rate, what they'll owe. */
  private terms: HTMLElement
  private pad: NumPad
  private approachRow: HTMLElement
  private approachBtns = new Map<Approach, HTMLButtonElement>()
  private approachHint: HTMLElement
  private submit: HTMLButtonElement
  private picker: HTMLElement
  private pickerList: HTMLElement

  private visitId: string | null = null
  private editingEstimate = false
  private approach: Approach = 'straight'
  private evidenceId: string | undefined
  private amount = 0
  private lastRounds = 0
  private state: GameState | null = null

  constructor(private readonly dispatch: (a: Action) => void) {
    const root = el('section', 'screen offer-screen')
    root.dataset.screen = 'offer'

    const bubble = el('div', 'offer-bubble')
    bubble.setAttribute('aria-live', 'polite')
    this.bubbleName = el('div', 'speaker')
    this.bubbleLine = el('p', 'line')
    this.bubbleLine.dataset.id = 'offer-line'
    bubble.append(this.bubbleName, this.bubbleLine)

    const panel = el('div', 'offer-panel')
    // Their ask after a counter
    this.askRow = el('div', 'offer-row ask-row')
    this.askText = el('div', 'ask-text')
    this.acceptBtn = createButton({ id: 'accept-ask', label: 'Accept', variant: 'primary', onPress: () => dispatch({ type: 'offer/acceptAsk' }) })
    this.askRow.append(this.askText, this.acceptBtn)
    // Estimate summary (step 2)
    this.estimateRow = el('div', 'offer-row estimate-row')
    this.estimateText = el('div', 'estimate-text')
    const editEst = createButton({ id: 'edit-estimate', label: 'Change', variant: 'ghost', onPress: () => this.editEstimate() })
    this.estimateRow.append(this.estimateText, editEst)
    // Price tag display
    const tag = el('div', 'price-tag')
    tag.dataset.id = 'offer-amount'
    this.tagLabel = el('span', 'price-tag-label')
    this.tagValue = el('span', 'price-tag-value')
    this.tagNote = el('span', 'price-tag-note')
    tag.append(this.tagLabel, this.tagValue, this.tagNote)
    this.terms = el('div', 'loan-terms')
    this.terms.dataset.id = 'loan-terms'

    this.pad = new NumPad('offer', (v) => {
      this.amount = v
      this.refresh()
    })

    this.approachRow = el('div', 'approaches')
    this.approachRow.setAttribute('role', 'radiogroup')
    this.approachRow.setAttribute('aria-label', 'Approach')
    for (const a of APPROACHES) {
      const b = createButton({ id: `approach-${a.id}`, label: a.label, icon: a.icon, className: 'approach', onPress: () => this.pickApproach(a.id) })
      b.setAttribute('role', 'radio')
      this.approachBtns.set(a.id, b)
      this.approachRow.append(b)
    }
    this.approachHint = el('p', 'approach-hint')

    const actions = el('div', 'actions offer-actions')
    const back = createButton({ id: 'back-to-inspect', label: 'Back', icon: 'back', ariaLabel: 'Back to inspect', onPress: () => dispatch({ type: 'inspect/back' }) })
    const pass = createButton({ id: 'offer-pass', label: 'Pass', onPress: () => dispatch({ type: 'counter/pass' }) })
    this.submit = createButton({ id: 'make-offer', label: 'Offer', variant: 'primary', onPress: () => this.onSubmit() })
    actions.append(back, pass, this.submit)

    panel.append(this.askRow, this.estimateRow, tag, this.terms, this.pad.root, this.approachRow, this.approachHint, actions)
    this.panel = panel

    // Evidence picker sheet
    this.picker = el('div', 'sheet evidence-picker')
    this.picker.dataset.id = 'evidence-picker'
    this.picker.setAttribute('role', 'dialog')
    this.picker.setAttribute('aria-label', 'Choose a finding to cite')
    this.picker.hidden = true
    const pickerHead = el('div', 'sheet-head')
    pickerHead.append(
      el('h2', '', 'Cite a finding'),
      createButton({ id: 'evidence-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: 'Close', onPress: () => this.closePicker() }),
    )
    this.pickerList = el('div', 'picker-list')
    this.picker.append(pickerHead, this.pickerList)

    root.append(bubble, panel, this.picker)
    this.root = root
  }

  render(state: GameState): void {
    this.state = state
    const c = state.current
    const insp = state.inspect
    if (!c || !insp) return
    if (c.visitId !== this.visitId) {
      this.visitId = c.visitId
      this.editingEstimate = false
      this.approach = 'straight'
      this.evidenceId = undefined
      this.lastRounds = 0
      this.pad.set(0)
      this.closePicker()
    }
    const rounds = state.haggle?.history.length ?? 0
    if (rounds !== this.lastRounds) {
      // After each round the approach resets; the typed number stays for adjusting.
      this.lastRounds = rounds
      this.approach = 'straight'
      this.evidenceId = undefined
    }
    this.bubbleName.innerHTML = ''
    this.bubbleName.append(el('span', 'speaker-name', c.customer.name), el('span', 'speaker-tag', archetypeLabel(c.customer.archetype)))
    setText(this.bubbleLine, `“${c.line}”`)
    this.refresh()
  }

  /** Keyboard input (digits, Backspace, Enter). */
  key(k: string): boolean {
    if (k === 'Enter') {
      this.onSubmit()
      return true
    }
    return this.pad.key(k)
  }

  private get estimating(): boolean {
    const est = this.state?.inspect?.estimate
    return est === null || est === undefined || this.editingEstimate
  }

  private refresh(): void {
    const s = this.state
    if (!s || !s.current || !s.inspect) return
    const estimating = this.estimating
    const est = s.inspect.estimate ?? 0
    const h = s.haggle
    const countered = !!h && h.status === 'open' && h.history.length > 0
    const pawn = s.current.wants === 'pawn'
    this.root.classList.toggle('is-estimating', estimating)
    this.root.classList.toggle('is-pawn', pawn)

    // Ask row (after a counter offer)
    this.askRow.hidden = estimating || !countered
    if (countered && h) {
      setText(this.askText, pawn ? `They want a ${rub(h.ask)} loan` : `They want ${rub(h.ask)}`)
      setButtonLabel(this.acceptBtn, pawn ? `Lend ${rub(h.ask)}` : `Accept ${rub(h.ask)}`)
      this.acceptBtn.disabled = h.ask > s.cash
    }
    // Estimate row
    this.estimateRow.hidden = estimating || countered
    const name = itemNameOf(s.current.item.defId, 'item')
    setText(this.estimateText, `You think the ${name} is worth ${rub(est)}`)

    // Price tag
    const v = this.amount
    setText(this.tagLabel, estimating ? 'What is it worth?' : pawn ? 'Loan amount' : 'Your offer')
    setText(this.tagValue, v > 0 ? rub(v) : '— ₽')
    const over = !estimating && v > s.cash
    this.root.classList.toggle('is-over', over)
    if (estimating) setText(this.tagNote, 'Your own estimate. The customer never sees it.')
    else if (over) setText(this.tagNote, `More than your cash (${rub(s.cash)})`)
    else setText(this.tagNote, `Cash ${rub(s.cash)}`)

    // Loan terms (pawn mode, after the estimate)
    this.terms.hidden = !pawn || estimating
    if (pawn && !estimating) {
      const t = loanTerms(v, s.calendar.day)
      const parts = [`Due ${dayLabel(s, t.dueDay)}`, monthlyRateLabel(t.monthlyRate)]
      if (v > 0) parts.push(`owes ${rub(t.owedAtDue)}`)
      this.terms.replaceChildren()
      parts.forEach((p, i) => {
        if (i > 0) this.terms.append(el('span', 'loan-terms-sep', ' · '))
        this.terms.append(el('span', 'loan-terms-part', p))
      })
    }

    // Side keys: chips in step 2, clear in step 1
    if (estimating) {
      this.pad.setSideKeys([null, null, null, { id: 'key-clear', label: 'Clear', onPress: () => this.pad.set(0) }])
    } else {
      this.pad.setSideKeys([
        ...CHIPS.map((p) => {
          const val = Math.round((est * p) / 100) * 100
          return { id: `chip-${Math.round(p * 100)}`, label: `${Math.round(p * 100)}%`, sub: est > 0 ? rub(val) : undefined, disabled: est <= 0, onPress: () => this.pad.set(val) }
        }),
        { id: 'key-clear', label: 'Clear', onPress: () => this.pad.set(0) },
      ])
    }

    // Approaches
    this.approachRow.hidden = estimating
    this.approachHint.hidden = estimating
    const hasFindings = s.inspect.findings.length > 0
    for (const [id, b] of this.approachBtns) {
      const on = id === this.approach
      b.classList.toggle('is-selected', on)
      b.setAttribute('aria-checked', String(on))
      if (id === 'evidence') b.disabled = !hasFindings
    }
    const a = APPROACHES.find((x) => x.id === this.approach)!
    let hint = a.hint
    if (this.approach === 'evidence' && this.evidenceId) {
      const f = s.inspect.findings.find((x) => x.id === this.evidenceId)
      if (f) hint = `Citing: ${f.text}`
    } else if (!hasFindings && this.approach === 'straight') {
      hint = 'Straight: just the number. (Evidence needs a finding.)'
    }
    setText(this.approachHint, hint)

    // Submit
    if (estimating) {
      setButtonLabel(this.submit, 'Set estimate')
      this.submit.dataset.id = 'set-estimate'
      this.submit.disabled = v <= 0
    } else {
      const verb = pawn ? 'Lend' : 'Offer'
      setButtonLabel(this.submit, v > 0 ? `${verb} ${rub(v)}` : verb)
      this.submit.dataset.id = 'make-offer'
      this.submit.disabled = v <= 0 || over || s.current.phase !== 'offer'
    }
  }

  private editEstimate(): void {
    this.editingEstimate = true
    this.pad.set(this.state?.inspect?.estimate ?? 0)
  }

  private pickApproach(a: Approach): void {
    if (a === 'evidence') {
      this.openPicker()
      return
    }
    this.approach = a
    this.evidenceId = undefined
    this.refresh()
  }

  private openPicker(): void {
    const s = this.state
    if (!s?.inspect) return
    this.pickerList.replaceChildren()
    const def = (() => {
      try {
        return s.current ? getItemDef(s.current.item.defId) : null
      } catch {
        return null
      }
    })()
    const labels: Record<string, string> = {}
    for (const h of def?.model.hotspots ?? []) labels[h.id] = h.label
    for (const f of [...s.inspect.findings].reverse()) {
      const b = el('button', 'picker-item')
      b.type = 'button'
      b.dataset.id = `cite-${f.id}`
      b.append(findingCard(f, f.hotspot ? labels[f.hotspot] : undefined))
      b.addEventListener('click', () => {
        this.approach = 'evidence'
        this.evidenceId = f.id
        this.closePicker()
        this.refresh()
      })
      this.pickerList.append(b)
    }
    this.picker.hidden = false
    this.root.classList.add('has-sheet')
  }

  private closePicker(): void {
    this.picker.hidden = true
    this.root.classList.remove('has-sheet')
  }

  private onSubmit(): void {
    const s = this.state
    if (!s || this.submit.disabled) return
    const v = this.amount
    if (this.estimating) {
      if (v <= 0) return
      this.dispatch({ type: 'offer/estimate', value: v })
      this.editingEstimate = false
      // Start the offer pad empty so the chips are the obvious next step.
      this.pad.set(0)
      return
    }
    if (this.approach === 'evidence' && !this.evidenceId) {
      this.openPicker()
      return
    }
    this.dispatch(
      this.approach === 'evidence'
        ? { type: 'offer/make', amount: v, approach: 'evidence', evidenceId: this.evidenceId }
        : { type: 'offer/make', amount: v, approach: this.approach },
    )
  }

  /** Esc closes the picker first. */
  closeOverlay(): boolean {
    if (!this.picker.hidden) {
      this.closePicker()
      return true
    }
    return false
  }
}

