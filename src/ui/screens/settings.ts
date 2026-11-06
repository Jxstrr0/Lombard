/**
 * Settings sheet (Longlight palette): save code copy/load, backup files,
 * new career, sound and ambience level, reduce motion, text size. Loading a
 * code (pasted or from a file) and starting over both ask for confirmation
 * inline (no browser dialogs).
 */
import type { SoundSettings } from '../../audio/settings'
import { AMBIENCE_LEVELS } from '../../data/audio'
import type { Action } from '../../game/actions'
import { decodeSaveCode, encodeSaveCode, SaveCodeError } from '../../game/save/code'
import type { GameState } from '../../game/state'
import { backupAgeText, keepStorage, lastBackupAt, markBackedUp, readBackupFile, saveBackupFile, storageProtected } from '../../persist/safety'
import { createButton, el, setText } from '../components/button'
import { rub } from '../format'

export interface SettingsDeps {
  getState(): GameState
  dispatch(a: Action): void
  /** Swap in a loaded career (main also autosaves it). */
  replaceState(state: GameState): void
  /** Start a fresh career (main generates the seed and careerId). */
  newCareer(): void
  /** Persist and apply the reduce-motion override. */
  setReduceMotion(on: boolean): void
  /** Device sound settings (localStorage, not the career). */
  getSound(): SoundSettings
  setSound(patch: Partial<SoundSettings>): void
}

export const TEXT_SCALES = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
] as const

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
  private newConfirm: HTMLElement
  private newConfirmText: HTMLElement
  private motion: HTMLButtonElement
  private sound: HTMLButtonElement
  private ambience: HTMLButtonElement[] = []
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
    sheet.setAttribute('aria-label', 'Settings')

    const head = el('div', 'sheet-head')
    head.append(
      el('h2', '', 'Settings'),
      createButton({ id: 'settings-close', label: '', icon: 'close', variant: 'ghost', ariaLabel: 'Close settings', onPress: () => this.close() }),
    )

    // --- save code: copy
    const copySec = this.section(
      'Save code',
      'Move this career to another device, or keep it safe: copy the code into Notes or a message, or save it as a backup file.',
    )
    const copyBtn = createButton({ id: 'copy-code', label: 'Copy save code', icon: 'copy', variant: 'primary', onPress: () => void this.copy() })
    const fileBtn = createButton({ id: 'save-file', label: 'Save backup file', icon: 'doc', onPress: () => void this.saveFile() })
    this.copyStatus = el('p', 'settings-status')
    this.copyStatus.setAttribute('role', 'status')
    this.manual = el('textarea', 'code-box')
    this.manual.dataset.id = 'code-manual'
    this.manual.readOnly = true
    this.manual.rows = 3
    this.manual.hidden = true
    this.manual.setAttribute('aria-label', 'Your save code')
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
    const loadSec = this.section('Load save code', 'Paste a code from another device. It replaces the career on this one.')
    this.loadInput = el('textarea', 'code-box')
    this.loadInput.dataset.id = 'code-input'
    this.loadInput.rows = 3
    this.loadInput.placeholder = 'LMB1.…'
    this.loadInput.setAttribute('aria-label', 'Save code to load')
    this.loadInput.spellcheck = false
    this.loadInput.autocapitalize = 'off'
    this.loadError = el('p', 'settings-error')
    this.loadError.setAttribute('role', 'alert')
    const loadBtn = createButton({ id: 'load-code', label: 'Load', onPress: () => this.tryLoad(this.loadInput.value) })
    this.fileInput = el('input', '')
    this.fileInput.type = 'file'
    this.fileInput.accept = '.txt,text/plain'
    this.fileInput.hidden = true
    this.fileInput.dataset.id = 'backup-file-input'
    this.fileInput.addEventListener('change', () => void this.loadFile())
    const loadFileBtn = createButton({ id: 'load-file', label: 'Load file', ariaLabel: 'Load backup file', icon: 'doc', onPress: () => this.fileInput.click() })
    const loadRow = el('div', 'actions')
    loadRow.append(loadBtn, loadFileBtn)
    this.loadConfirm = el('div', 'confirm')
    this.loadConfirm.hidden = true
    this.loadConfirmText = el('p', '')
    const loadActions = el('div', 'actions')
    loadActions.append(
      createButton({ id: 'load-cancel', label: 'Cancel', onPress: () => this.cancelLoad() }),
      createButton({ id: 'load-confirm', label: 'Replace career', variant: 'danger', onPress: () => this.confirmLoad() }),
    )
    this.loadConfirm.append(this.loadConfirmText, loadActions)
    loadSec.append(this.loadInput, this.loadError, loadRow, this.fileInput, this.loadConfirm)

    // --- new career
    const newSec = this.section('New career', 'Start over on Day 1 with a new shop.')
    const newBtn = createButton({ id: 'new-career', label: 'New career', onPress: () => this.askNew() })
    this.newConfirm = el('div', 'confirm')
    this.newConfirm.hidden = true
    this.newConfirmText = el('p', '')
    const newActions = el('div', 'actions')
    newActions.append(
      createButton({ id: 'new-cancel', label: 'Cancel', onPress: () => (this.newConfirm.hidden = true) }),
      createButton({
        id: 'new-confirm',
        label: 'Start over',
        variant: 'danger',
        onPress: () => {
          this.newConfirm.hidden = true
          this.deps.newCareer()
          this.close()
        },
      }),
    )
    this.newConfirm.append(this.newConfirmText, newActions)
    newSec.append(newBtn, this.newConfirm)

    // --- sound
    const soundSec = this.section('Sound', '')
    this.sound = el('button', 'switch')
    this.sound.type = 'button'
    this.sound.dataset.id = 'sound'
    this.sound.setAttribute('role', 'switch')
    this.sound.innerHTML = '<span class="switch-label">Sound</span><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-state"></span>'
    this.sound.addEventListener('click', () => {
      this.deps.setSound({ enabled: !this.deps.getSound().enabled })
      this.render(this.deps.getState())
    })
    const ambLabel = el('div', 'settings-label', 'Street and canal outside')
    const ambRow = el('div', 'segmented')
    ambRow.setAttribute('role', 'radiogroup')
    ambRow.setAttribute('aria-label', 'Street and canal outside')
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

    // --- comfort
    const comfort = this.section('Comfort', '')
    this.motion = el('button', 'switch')
    this.motion.type = 'button'
    this.motion.dataset.id = 'reduce-motion'
    this.motion.setAttribute('role', 'switch')
    this.motion.innerHTML = '<span class="switch-label">Reduce motion</span><span class="switch-track"><span class="switch-thumb"></span></span><span class="switch-state"></span>'
    this.motion.addEventListener('click', () => {
      const on = !this.deps.getState().settings.reduceMotion
      this.deps.setReduceMotion(on)
    })
    const sizeLabel = el('div', 'settings-label', 'Text size')
    const sizeRow = el('div', 'segmented')
    sizeRow.setAttribute('role', 'radiogroup')
    sizeRow.setAttribute('aria-label', 'Text size')
    for (const s of TEXT_SCALES) {
      const b = el('button', 'segment', s.label)
      b.type = 'button'
      b.dataset.id = `text-${Math.round(s.value * 100)}`
      b.setAttribute('role', 'radio')
      b.style.fontSize = `${s.value}rem`
      b.addEventListener('click', () => this.deps.dispatch({ type: 'settings/set', patch: { textScale: s.value } }))
      this.sizes.push(b)
      sizeRow.append(b)
    }
    comfort.append(this.motion, sizeLabel, sizeRow)

    const foot = el('p', 'settings-foot', `Lombard · build ${__BUILD_SHA__} · ${__BUILD_DATE__} · A Longlight Interactive game`)
    sheet.append(head, copySec, loadSec, newSec, soundSec, comfort, foot)
    root.append(sheet)
    this.root = root
    this.sheet = sheet
  }

  get isOpen(): boolean {
    return !this.root.hidden
  }

  open(onClose?: () => void): void {
    this.onClose = onClose ?? null
    this.copyStatus.textContent = ''
    this.manual.hidden = true
    this.loadError.textContent = ''
    this.cancelLoad()
    this.newConfirm.hidden = true
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
    setText(this.motion.querySelector<HTMLElement>('.switch-state')!, rm ? 'On' : 'Off')
    const snd = this.deps.getSound()
    this.sound.setAttribute('aria-checked', String(snd.enabled))
    this.sound.classList.toggle('is-on', snd.enabled)
    setText(this.sound.querySelector<HTMLElement>('.switch-state')!, snd.enabled ? 'On' : 'Off')
    for (const [i, b] of this.ambience.entries()) {
      const on = AMBIENCE_LEVELS[i]!.value === snd.ambience
      b.classList.toggle('is-selected', on)
      b.setAttribute('aria-checked', String(on))
      b.disabled = !snd.enabled
    }
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
      this.copyStatus.textContent = `Could not make a save code: ${(err as Error).message}`
      return
    }
    this.manual.value = code
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(code)
      this.copyStatus.textContent = `Copied (${code.length.toLocaleString('en-US')} characters). Paste it somewhere safe.`
      this.manual.hidden = true
      this.backedUp()
    } catch {
      // Older mobile browsers: show the code selected for a manual copy.
      this.copyStatus.textContent = 'Your browser blocked copying. Press and hold the code below, Select all, then Copy.'
      this.manual.hidden = false
      this.manual.focus()
      this.manual.select()
    }
  }

  /** Show when the last backup was made and whether the browser promised to keep the storage. */
  private refreshSafety(): void {
    setText(this.backupLine, `Last backup: ${backupAgeText(lastBackupAt(), Date.now())}.`)
    void storageProtected().then((kept) => {
      this.storageLine.hidden = kept === null
      setText(
        this.storageLine,
        kept ? 'Storage: protected on this device.' : 'Storage: your browser may clear saves if the phone runs low on space. Keep a backup file.',
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
      this.copyStatus.textContent = `Could not make a save code: ${(err as Error).message}`
      return
    }
    this.manual.hidden = true
    const result = await saveBackupFile(code)
    if (result === 'cancelled') {
      this.copyStatus.textContent = ''
      return
    }
    if (result === 'failed') {
      this.copyStatus.textContent = 'This browser could not save a file. Copy the save code instead.'
      return
    }
    this.copyStatus.textContent = result === 'shared' ? 'Backup file ready. Keep it somewhere safe, like Files.' : 'Backup file saved to your downloads.'
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
      this.loadError.textContent = (err as Error).message || 'That file could not be read.'
      return
    }
    this.tryLoad(text, 'That file is empty. Choose a Lombard backup file.')
  }

  private tryLoad(input: string, emptyMessage = 'Paste a save code first.'): void {
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
        err instanceof SaveCodeError ? err.message : 'That save code could not be loaded. Check that you copied all of it.'
      return
    }
    const s = this.pending
    const cur = this.deps.getState()
    this.loadConfirmText.textContent =
      `This code holds Day ${s.calendar.day} with ${rub(s.cash)} and ${s.inventory.length} item${s.inventory.length === 1 ? '' : 's'} in stock. ` +
      `It replaces your current career (Day ${cur.calendar.day}, ${rub(cur.cash)}).`
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

  private askNew(): void {
    const cur = this.deps.getState()
    this.newConfirmText.textContent = `Start over? Your current shop (Day ${cur.calendar.day}, ${rub(cur.cash)}) will be gone unless you copied its save code.`
    this.newConfirm.hidden = false
  }
}
