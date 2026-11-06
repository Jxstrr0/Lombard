/**
 * Guard (M6, localization-ready): no hard-coded English in src/ui/.
 *
 * Every player-facing string the DOM layer shows comes from the string table
 * (src/data/strings/en.ts) through t(). This test parses each src/ui/ module
 * with the TypeScript compiler and fails on any string literal (or the static
 * text of a template literal) that reads like words a player would see, unless
 * it sits in a context that never reaches the screen as text (class names,
 * data-ids, selectors, event names, attribute names, comparisons…) or is on
 * the allowlist below.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const UI = join(ROOT, 'src', 'ui')

/** Literals that look like words but are not player-facing text. Keep this short and explain each. */
const ALLOWED = new Set<string>([
  // Not text: the Longlight hub URL and an input accept filter.
  'https://jxstrr0.github.io/Kelbo.Website/games.html',
  '.txt,text/plain',
])

/** Calls whose string arguments are never shown (by argument index; -1 = all). */
const SILENT_CALLS: Record<string, number[]> = {
  querySelector: [-1],
  querySelectorAll: [-1],
  closest: [-1],
  matches: [-1],
  matchMedia: [-1],
  addEventListener: [0],
  removeEventListener: [0],
  dispatchEvent: [-1],
  createElement: [-1],
  getElementById: [-1],
  getAttribute: [-1],
  removeAttribute: [-1],
  hasAttribute: [-1],
  toggleAttribute: [-1],
  setProperty: [-1],
  getPropertyValue: [-1],
  add: [-1],
  remove: [-1],
  toggle: [-1],
  contains: [-1],
  replace: [-1],
  includes: [-1],
  startsWith: [-1],
  endsWith: [-1],
  split: [-1],
  join: [-1],
  get: [-1],
  has: [-1],
  set: [0],
  Error: [-1],
  t: [-1],
  tr: [-1],
  // el(tag, className, text): the tag and class are not text; the text must come from t().
  el: [0, 1],
  setButtonLabel: [2],
  icon: [-1],
  dispatch: [-1],
  getItemDef: [-1],
  log: [-1],
  warn: [-1],
  error: [-1],
  info: [-1],
  debug: [-1],
}

/** setAttribute(name, value): the value is text only for these attributes. */
const TEXT_ATTRIBUTES = new Set(['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'])

/** Object keys whose values are never shown (ids, classes, variants, icons, modes…). */
const SILENT_KEYS = new Set([
  'id',
  'className',
  'class',
  'variant',
  'icon',
  'type',
  'mode',
  'kind',
  'value',
  'key',
  'tool',
  'screen',
  'area',
  'role',
  'block',
  'behavior',
  'inline',
  'once',
  'passive',
  'hour',
  'minute',
  'day',
  'month',
  'year',
  'weekday',
  'timeZone',
])

/** Properties whose assigned strings are never shown. */
const SILENT_PROPS = new Set(['className', 'id', 'type', 'accept', 'autocapitalize', 'href', 'target', 'rel', 'value', 'innerHTML', 'cssText', 'transform', 'display', 'width', 'height', 'fontSize', 'cursor', 'inputMode', 'autocomplete', 'enterKeyHint', 'name', 'dir', 'lang'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return p.endsWith('.ts') ? [p] : []
  })
}

function calleeName(e: ts.Expression): string {
  if (ts.isIdentifier(e)) return e.text
  if (ts.isPropertyAccessExpression(e)) return e.name.text
  if (ts.isElementAccessExpression(e)) return calleeName(e.expression)
  return ''
}

/** True when a literal at this node can never reach the screen as text. */
function silent(node: ts.Node): boolean {
  let child: ts.Node = node
  let p: ts.Node | undefined = node.parent
  while (p) {
    // Pass through wrappers that keep the value itself.
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p) || ts.isNonNullExpression(p)) {
      child = p
      p = p.parent
      continue
    }
    if (ts.isConditionalExpression(p) && child !== p.condition) {
      child = p
      p = p.parent
      continue
    }
    if (ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || p.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      child = p
      p = p.parent
      continue
    }
    break
  }
  if (!p) return true
  // Types, imports, comparisons, switch cases, keys and indexes.
  if (ts.isLiteralTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true
  if (ts.isCaseClause(p)) return true
  if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return true
  if (ts.isPropertyAssignment(p) && p.name === child) return true
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind
    if (op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken || op === ts.SyntaxKind.InKeyword) return true
    if (op === ts.SyntaxKind.EqualsToken && child === p.right) {
      const target = p.left
      if (ts.isPropertyAccessExpression(target)) {
        if (SILENT_PROPS.has(target.name.text)) return true
        // el.dataset.foo = '…', el.style.foo = '…'
        const owner = target.expression
        if (ts.isPropertyAccessExpression(owner) && (owner.name.text === 'dataset' || owner.name.text === 'style')) return true
      }
      if (ts.isElementAccessExpression(target)) return true
    }
  }
  if (ts.isPropertyAssignment(p) && p.initializer === child) {
    const key = p.name
    const name = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : ''
    if (SILENT_KEYS.has(name)) return true
  }
  if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
    const args = p.arguments ?? ts.factory.createNodeArray()
    const i = args.indexOf(child as ts.Expression)
    const name = calleeName(p.expression)
    if (name === 'setAttribute') return i === 0 || !(args[0] && ts.isStringLiteral(args[0]) && TEXT_ATTRIBUTES.has(args[0].text))
    const which = SILENT_CALLS[name]
    if (which && (which.includes(-1) || which.includes(i))) return true
  }
  if (ts.isTemplateSpan(p) || ts.isTemplateExpression(p)) return true
  return false
}

/** KeyboardEvent.key names compared against in key handlers. */
const KEY_NAMES = new Set(['Enter', 'Escape', 'Backspace', 'Delete', 'Tab', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

/** Reads like words a player would see. */
function wordy(text: string): boolean {
  if (ALLOWED.has(text) || KEY_NAMES.has(text)) return false
  if (/₽/.test(text)) return true
  // Markup (SVG icons; text between tags is checked separately) and selectors.
  if (/^\s*</.test(text) || /^[.#[]/.test(text)) return false
  // String keys, storage keys and dotted ids: 'outcome.bought', 'lombard.lookHintSeen'.
  if (/^[\w-]+(\.[\w-]+)+$/.test(text)) return false
  if (!/[A-Za-z]{2,}/.test(text) && !/[А-Яа-яЁё]{2,}/.test(text)) return false
  // Two or more words, or a capitalised word: English. A lone lowercase token is an id or a state.
  return /[A-Za-zА-Яа-я]{2,}[\s,.!?:;’']+[A-Za-zА-Яа-я]/.test(text) || /^[A-ZА-Я][a-zа-я]/.test(text.trim())
}

interface Hit {
  file: string
  line: number
  text: string
}

function scan(file: string): Hit[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const hits: Hit[] = []
  const report = (node: ts.Node, text: string) => {
    if (!wordy(text) || silent(node)) return
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    hits.push({ file: relative(ROOT, file), line, text })
  }
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) report(node, node.text)
    else if (ts.isTemplateExpression(node)) {
      // The static text around the holes, with each hole as a word stand-in.
      const text = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' x ')
      report(node, text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  // innerHTML templates: no text between tags (set it with textContent from t()).
  for (const m of src.matchAll(/innerHTML\s*=\s*(['`])([\s\S]*?)\1/g)) {
    for (const between of m[2]!.matchAll(/>([^<>${}]*[A-Za-z]{2,}[^<>${}]*)</g)) {
      const line = src.slice(0, m.index).split('\n').length
      hits.push({ file: relative(ROOT, file), line, text: between[1]!.trim() })
    }
  }
  return hits
}

describe('src/ui has no hard-coded player-facing English', () => {
  it('every string a player sees comes from t()', () => {
    const hits = files(UI).flatMap(scan)
    expect(hits.map((h) => `${h.file}:${h.line}  ${JSON.stringify(h.text)}`)).toEqual([])
  })

  it('the detector catches the usual ways English sneaks in', () => {
    const probe = (code: string) => {
      const sf = ts.createSourceFile('probe.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const found: string[] = []
      const visit = (n: ts.Node) => {
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && wordy(n.text) && !silent(n)) found.push(n.text)
        if (ts.isTemplateExpression(n)) {
          const text = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' x ')
          if (wordy(text) && !silent(n)) found.push(text)
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
      return found
    }
    expect(probe(`el('p', 'settings-text', 'Paste a code first.')`)).toEqual(['Paste a code first.'])
    expect(probe(`createButton({ id: 'x', label: 'Load' })`)).toEqual(['Load'])
    expect(probe(`b.setAttribute('aria-label', 'Close shop')`)).toEqual(['Close shop'])
    expect(probe('setText(x, `Day ${d} · ${c}`)')).toHaveLength(1)
    expect(probe(`x.textContent = ok ? 'On' : 'Off'`)).toEqual(['On', 'Off'])
    // Not text: classes, data-ids, selectors, events, attribute names, comparisons.
    expect(probe(`el('div', 'sheet menu settings')`)).toEqual([])
    expect(probe(`b.dataset.id = 'Slot two'; q.querySelector('[data-id="Close all"]'); b.setAttribute('role', 'switch')`)).toEqual([])
    expect(probe(`if (kind === 'Old Stock') x()`)).toEqual([])
    expect(probe(`createButton({ id: 'Copy code', icon: 'close', variant: 'ghost', label: t('common.close') })`)).toEqual([])
  })
})
