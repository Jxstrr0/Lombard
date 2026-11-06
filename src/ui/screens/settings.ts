/**
 * Settings sheet (Longlight palette): save code copy/load, backup files,
 * main menu, sound and ambience level, graphics quality, reduce motion, text
 * size. Loading a code (pasted or from a file) asks for confirmation inline (no
 * browser dialogs).
 *
 * From the title screen (M4) it opens in 'title' mode: only the device
 * settings (sound, graphics, comfort); the save code and main menu need a career.
 * New careers start from a slot on the title screen.
 */
import type { SoundSettings } from '../../audio/settings'
import { AMBIENCE_LEVELS } from '../../data/audio'
import type { PlainKey } from '../../data/strings'
import { t } from '../../data/strings'
import type { Action } from '../../game/actions'
import { decodeSaveCode, encodeSaveCode, SaveCodeError } from '../../game/save/code'
import type { GameState } from '../../game/state'
import { backupAgeText, keepStorage, lastBackupAt, markBackedUp, readBackupFile, saveBackupFile, storageProtected } from '../../persist/safety'
import { createButton, el, setText } from '../components/button'
import { count, rub } from '../format'

export interface SettingsDeps {
  getState(): GameState
  dispatch(a: Action): void
  /** Swap in a loaded career, replacing the one in this slot (main also autosaves it). */
  replaceState(state: GameState): void
  /** Save, then back to the title screen and the career slots. */
  mainMenu(): void
  /** "Slot 2" for a career in a slot, null for an unsaved review career (?seed). */
  slotLabel(): string | null
  /** Persist and apply the reduce-motion override. */
  setReduceMotion(on: boolean): void
  /** Persist and apply the text size (a device setting). */
  setTextScale(scale: number): void
  /** Device sound settings (localStorage, not the career). */
  getSound(): SoundSettings
  setSound(patch: Partial<SoundSettings>): void
  /** Device graphics quality (render/perf.ts). */
  getGraphics(): GraphicsInfo
  setGraphics(choice: GraphicsChoice): void
}

export type GraphicsChoice = 'auto' | 'low' | 'mid' | 'high'

export interface GraphicsInfo {
  choice: GraphicsChoice
  /** The tier in use (Auto's current pick). */
  tier: Exclude<GraphicsChoice, 'auto'>
  /** Whether this page's WebGL context has MSAA (fixed until reload). */
  antialias: boolean
  /** Whether the tier in use wants MSAA. */
  wantsAntialias: boolean
}

export const GRAPHICS_CHOICES: readonly { value: GraphicsChoice; label: PlainKey }[] = [
  { value: 'auto', label: 'graphics.auto' },
  { value: 'low', label: 'graphics.low' },
  { value: 'mid', label: 'graphics.mid' },
  { value: 'high', label: 'graphics.high' },
]

export const TEXT_SCALES = [
  { value: 0.9, label: 'text.small' },
  { value: 1, label: 'text.normal' },
  { value: 1.15, label: 'text.large' },
  { value: 1.3, label: 'text.larger' },
] as const satisfies readonly { value: number; label: PlainKey }[]

export class SettingsSheet {
  readonly root: HTMLElement
  private sheet: HTMLElement
  private copyStatus: HTMLElement
  private manual: HTMLTextAreaElement
  private storageLine: HTMLElement
  private backupLine: HTMLElement
  private fileInput: HTMLInputElement
  private loadInput: HTMLTextAreaElement
  private loadError: HTMLElement
  private loadConfirm: HTMLElement
  private loadConfirmText: HTMLElement
  private pending: GameState | null = null
  private careerSections: HTMLElement[]
  private menuText: HTMLElement
  private loadText: HTMLElement
  private motion: HTMLButtonElement
  private sound: HTMLButtonElement
  private ambience: HTMLButtonElement[] = []
  private graphics: HTMLButtonElement[] = []
  private graphicsNote: HTMLElement
  private sizes: HTMLButtonElement[] = []
  private onClose: (() => void) | null = null

  constructor(private readonly deps: SettingsDeps) {
    const root = el('div', 'overlay settings-overlay')
    root.hidden = true
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close()
    })
    const sheet = el('section', 'sheet menu settings')
    sheet.dataset.id = 'settings'
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-label', t('common.settings'))

    const head = el('div', 'sheet-head')
    head.append(
      el('h2', '', t('common.settings')),
      createButton({ id: 'settings-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: t('settings.closeAria'), onPress: () => this.close() }),
    )

    // --- save code: copy
    const copySec = this.section(t('settings.saveCode'), t('settings.saveCodeText'))
    const copyBtn = createButton({ id: 'copy-code', label: t('settings.copy'), icon: 'copy', variant: 'primary', onPress: () => void this.copy() })
    const fileBtn = createButton({ id: 'save-file', label: t('settings.saveFile'), icon: 'doc', onPress: () => void this.saveFile() })
    this.copyStatus = el('p', 'settings-status')
    this.copyStatus.setAttribute('role', 'status')
    this.manual = el('textarea', 'code-box')
    this.manual.dataset.id = 'code-manual'
    this.manual.readOnly = true
    this.manual.rows = 3
    this.manual.hidden = true
    this.manual.setAttribute('aria-label', t('settings.yourCode'))
    this.manual.addEventListener('focus', () => this.manual.select())
    // Copied by hand from the fallback box: that counts as a backup too.
    this.manual.addEventListener('copy', () => this.backedUp())
    this.backupLine = el('p', 'settings-text settings-small')
    this.backupLine.dataset.id = 'last-backup'
    this.storageLine = el('p', 'settings-text settings-small')
    this.storageLine.dataset.id = 'storage-status'
    this.storageLine.hidden = true
    const copyActions = el('div', 'actions actions-stack')
    copyActions.append(copyBtn, fileBtn)
    copySec.append(copyActions, this.copyStatus, this.manual, this.backupLine, this.storageLine)

    // --- save code: load
    const loadSec = this.section(t('settings.loadCode'), '')
    this.loadText = el('p', 'settings-text')
    loadSec.append(this.loadText)
    this.loadInput = el('textarea', 'code-box')
    this.loadInput.dataset.id = 'code-input'
    this.loadInput.rows = 3
    this.loadInput.placeholder = t('settings.codePlaceholder')
    this.loadInput.setAttribute('aria-label', t('settings.codeAria'))
    this.loadInput.spellcheck = false
    this.loadInput.autocapitalize = 'off'
    this.loadError = el('p', 'settings-error')
    this.loadError.setAttribute('role', 'alert')
    const loadBtn = createButton({ id: 'load-code', label: t('common.load'), onPress: () => this.tryLoad(this.loadInput.value) })
    this.fileInput = el('input', '')
    this.fileInput.type = 'file'
    this.fileInput.accept = '.txt,text/plain'
    this.fileInput.hidden = true
    this.fileInput.dataset.id = 'backup-file-input'
    this.fileInput.addEventListener('change', () => void this.loadFile())
    const loadFileBtn = createButton({ id: 'load-file', label: t('common.loadFile'), ariaLabel: t('common.loadFileAria'), icon: 'doc', onPress: () => this.fileInput.click() })
    const loadRow = el('div', 'actions')
    loadRow.append(loadBtn, loadFileBtn)
    this.loadConfirm = el('div', 'confirm')
    this.loadConfirm.hidden = true
    this.loadConfirmText = el('p', '')
    const loadActions = el('div', 'actions')
    loadActions.append(
      createButton({ id: 'load-cancel', label: t('common.cancel'), onPress: () => this.cancelLoad() }),
      createButton({ id: 'load-confirm', label: t('settings.replace'), variant: 'danger', onPress: () => this.confirmLoad() }),
    )
    this.loadConfirm.append(this.loadConfirmText, loadActions)
    loadSec.append(this.loadInput, this.loadError, loadRow, this.fileInput, this.loadConfirm)

    // --- main menu (M4)
    const menuSec = this.section(t('common.mainMenu'), '')
    this.menuText = el('p', 'settings-text')
    const menuBtn = createButton({
      id: 'main-menu',
      label: t('common.mainMenu'),
      icon: 'back',
      onPress: () => {
        this.close()
        this.deps.mainMenu()
      },
    })
    menuSec.append(this.menuText, menuBtn)
    this.careerSections = [copySec, loadSec, menuSec]

    // --- sound
    const soundSec = this.section(t('settings.sound'), '')
    this.sound = el('button', 'switch')
    this.sound.type = 'button'
    this.sound.dataset.id = 'sound'
    this.sound.setAttribute('role', 'switch')
    this.sound.innerHTML = '<span class="switch-label"></span><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-state"></span>'
    setText(this.sound.querySelector<HTMLElement>('.switch-label')!, t('settings.sound'))
    this.sound.addEventListener('click', () => {
      this.deps.setSound({ enabled: !this.deps.getSound().enabled })
      this.render(this.deps.getState())
    })
    const ambLabel = el('div', 'settings-label', t('settings.ambience'))
    const ambRow = el('div', 'segmented')
    ambRow.setAttribute('role', 'radiogroup')
    ambRow.setAttribute('aria-label', t('settings.ambience'))
    for (const l of AMBIENCE_LEVELS) {
      const b = el('button', 'segment', l.label)
      b.type = 'button'
      b.dataset.id = `ambience-${Math.round(l.value * 100)}`
      b.setAttribute('role', 'radio')
      b.addEventListener('click', () => {
        this.deps.setSound({ ambience: l.value })
        this.render(this.deps.getState())
      })
      this.ambience.push(b)
      ambRow.append(b)
    }
    soundSec.append(this.sound, ambLabel, ambRow)

    // --- graphics
    const gfxSec = this.section(t('settings.graphics'), t('settings.graphicsText'))
    const gfxRow = el('div', 'segmented')
    gfxRow.setAttribute('role', 'radiogroup')
    gfxRow.setAttribute('aria-label', t('settings.graphicsAria'))
    for (const g of GRAPHICS_CHOICES) {
      const b = el('button', 'segment', t(g.label))
      b.type = 'button'
      b.dataset.id = `graphics-${g.value}`
      b.setAttribute('role', 'radio')
      b.addEventListener('click', () => {
        this.deps.setGraphics(g.value)
        this.render(this.deps.getState())
      })
      this.graphics.push(b)
      gfxRow.append(b)
    }
    this.graphicsNote = el('p', 'settings-status')
    gfxSec.append(gfxRow, this.graphicsNote)

    // --- comfort
    const comfort = this.section(t('settings.comfort'), '')
    this.motion = el('button', 'switch')
    this.motion.type = 'button'
    this.motion.dataset.id = 'reduce-motion'
    this.motion.setAttribute('role', 'switch')
    this.motion.innerHTML = '<span class="switch-label"></span><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-state"></span>'
    setText(this.motion.querySelector<HTMLElement>('.switch-label')!, t('settings.motion'))
    this.motion.addEventListener('click', () => {
      const on = !this.deps.getState().settings.reduceMotion
      this.deps.setReduceMotion(on)
    })
    const sizeLabel = el('div', 'settings-label', t('settings.textSize'))
    const sizeRow = el('div', 'segmented')
    sizeRow.setAttribute('role', 'radiogroup')
    sizeRow.setAttribute('aria-label', t('settings.textSize'))
    for (const s of TEXT_SCALES) {
      const b = el('button', 'segment', t(s.label))
      b.type = 'button'
      b.dataset.id = `text-${Math.round(s.value * 100)}`
      b.setAttribute('role', 'radio')
      b.style.fontSize = `${s.value}rem`
      b.addEventListener('click', () => this.deps.setTextScale(s.value))
      this.sizes.push(b)
      sizeRow.append(b)
    }
    comfort.append(this.motion, sizeLabel, sizeRow)

    const foot = el('p', 'settings-foot', t('settings.foot', { version: __GAME_VERSION__, sha: __BUILD_SHA__, date: __BUILD_DATE__ }))
    sheet.append(head, copySec, loadSec, menuSec, soundSec, gfxSec, comfort, foot)
    root.append(sheet)
    this.root = root
    this.sheet = sheet
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  open(onClose?: () => void, mode: 'game' | 'title' = 'game'): void {
    this.onClose = onClose ?? null
    for (const sec of this.careerSections) sec.hidden = mode === 'title'
    const slot = this.deps.slotLabel()
    setText(
      this.loadText,
      slot ? t('settings.loadTextSlot', { slot }) : t('settings.loadTextTest'),
    )
    setText(
      this.menuText,
      slot ? t('settings.menuTextSlot', { slot }) : t('settings.menuTextTest'),
    )
    this.copyStatus.textContent = ''
    this.manual.hidden = true
    this.loadError.textContent = ''
    this.cancelLoad()
    this.render(this.deps.getState())
    this.refreshSafety()
    this.root.hidden = false
    this.sheet.scrollTop = 0
    this.sheet.querySelector<HTMLButtonElement>('[data-id="settings-close"]')?.focus()
  }

  close(): void {
    if (this.root.hidden) return
    this.root.hidden = true
    this.onClose?.()
  }

  render(state: GameState): void {
    const rm = state.settings.reduceMotion
    this.motion.setAttribute('aria-checked', String(rm))
    this.motion.classList.toggle('is-on', rm)
    setText(this.motion.querySelector<HTMLElement>('.switch-state')!, t(rm ? 'common.on' : 'common.off'))
    const snd = this.deps.getSound()
    this.sound.setAttribute('aria-checked', String(snd.enabled))
    this.sound.classList.toggle('is-on', snd.enabled)
    setText(this.sound.querySelector<HTMLElement>('.switch-state')!, t(snd.enabled ? 'common.on' : 'common.off'))
    for (const [i, b] of this.ambience.entries()) {
      const on = AMBIENCE_LEVELS[i]!.value === snd.ambience
      b.classList.toggle('is-selected', on)
      b.setAttribute('aria-checked', String(on))
      b.disabled = !snd.enabled
    }
    const gfx = this.deps.getGraphics()
    for (const [i, b] of this.graphics.entries()) {
      const on = GRAPHICS_CHOICES[i]!.value === gfx.choice
      b.classList.toggle('is-selected', on)
      b.setAttribute('aria-checked', String(on))
    }
    const label = (tier: GraphicsChoice) => {
      const key = GRAPHICS_CHOICES.find((g) => g.value === tier)?.label
      return key ? t(key) : tier
    }
    const notes: string[] = []
    if (gfx.choice === 'auto') notes.push(t('settings.using', { tier: label(gfx.tier) }))
    if (gfx.wantsAntialias !== gfx.antialias) notes.push(t(gfx.wantsAntialias ? 'settings.aaOn' : 'settings.aaOff'))
    setText(this.graphicsNote, notes.join(' '))

    const scale = state.settings.textScale
    for (const [i, b] of this.sizes.entries()) {
      const on = Math.abs(TEXT_SCALES[i]!.value - scale) < 0.01
      b.classList.toggle('is-selected', on)
      b.setAttribute('aria-checked', String(on))
    }
  }

  private section(title: string, text: string): HTMLElement {
    const s = el('div', 'settings-section')
    s.append(el('h3', '', title))
    if (text) s.append(el('p', 'settings-text', text))
    return s
  }

  private async copy(): Promise<void> {
    let code: string
    try {
      code = encodeSaveCode(this.deps.getState())
    } catch (err) {
      this.copyStatus.textContent = t('settings.codeFailed', { error: (err as Error).message })
      return
    }
    this.manual.value = code
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(code)
      this.copyStatus.textContent = t('settings.copied', { n: count(code.length) })
      this.manual.hidden = true
      this.backedUp()
    } catch {
      // Older mobile browsers: show the code selected for a manual copy.
      this.copyStatus.textContent = t('settings.copyBlocked')
      this.manual.hidden = false
      this.manual.focus()
      this.manual.select()
    }
  }

  /** Show when the last backup was made and whether the browser promised to keep the storage. */
  private refreshSafety(): void {
    setText(this.backupLine, t('settings.lastBackup', { age: backupAgeText(lastBackupAt(), Date.now()) }))
    void storageProtected().then((kept) => {
      this.storageLine.hidden = kept === null
      setText(
        this.storageLine,
        t(kept ? 'settings.storageKept' : 'settings.storageRisk'),
      )
    })
  }

  /** A backup was made: remember when, and ask the browser to keep the storage. */
  private backedUp(): void {
    markBackedUp()
    void keepStorage().finally(() => this.refreshSafety())
  }

  private async saveFile(): Promise<void> {
    let code: string
    try {
      code = encodeSaveCode(this.deps.getState())
    } catch (err) {
      this.copyStatus.textContent = t('settings.codeFailed', { error: (err as Error).message })
      return
    }
    this.manual.hidden = true
    const result = await saveBackupFile(code)
    if (result === 'cancelled') {
      this.copyStatus.textContent = ''
      return
    }
    if (result === 'failed') {
      this.copyStatus.textContent = t('settings.fileFailed')
      return
    }
    this.copyStatus.textContent = t(result === 'shared' ? 'settings.fileShared' : 'settings.fileSaved')
    this.backedUp()
  }

  private async loadFile(): Promise<void> {
    const file = this.fileInput.files?.[0]
    // Clear the picker so choosing the same file again still fires "change".
    this.fileInput.value = ''
    if (!file) return
    let text: string
    try {
      text = await readBackupFile(file)
    } catch (err) {
      this.loadConfirm.hidden = true
      this.pending = null
      this.loadError.textContent = (err as Error).message || t('settings.fileUnreadable')
      return
    }
    this.tryLoad(text, t('settings.fileEmpty'))
  }

  private tryLoad(input: string, emptyMessage = t('settings.pasteFirst')): void {
    const code = input.trim()
    this.loadError.textContent = ''
    this.loadConfirm.hidden = true
    if (!code) {
      this.loadError.textContent = emptyMessage
      return
    }
    try {
      this.pending = decodeSaveCode(code)
    } catch (err) {
      this.pending = null
      this.loadError.textContent =
        err instanceof SaveCodeError ? err.message : t('settings.codeBad')
      return
    }
    const s = this.pending
    const cur = this.deps.getState()
    this.loadConfirmText.textContent = t('settings.codeHolds', {
      day: s.calendar.day,
      cash: rub(s.cash),
      count: s.inventory.length,
      curDay: cur.calendar.day,
      curCash: rub(cur.cash),
    })
    this.loadConfirm.hidden = false
  }

  private cancelLoad(): void {
    this.pending = null
    this.loadConfirm.hidden = true
  }

  private confirmLoad(): void {
    if (!this.pending) return
    const s = this.pending
    this.pending = null
    this.loadConfirm.hidden = true
    this.loadInput.value = ''
    this.deps.replaceState(s)
    void keepStorage()
    this.close()
  }
}
