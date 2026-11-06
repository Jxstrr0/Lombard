/**
 * M6, localization-ready content: the authored content in src/data/ stays where
 * it is (see docs/05 § Localization for how it would be translated), but every
 * string in it that can reach the screen must be plain text or use the same
 * `{name}` holes as the UI string table, so one translation workflow covers both.
 *
 * Two checks:
 * - every string value in every content module (as loaded) uses only `{name}`
 *   holes: no `${…}`, `{{…}}`, `%s`, or stray braces;
 * - no content file builds a sentence with a JS template literal (`${…}` in
 *   source), except the known spots listed in docs/05 § Localization, which
 *   are counted here so a new one fails.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'src', 'data')

/** Not content: the UI string table (its own test) and gameplay numbers. */
const NOT_CONTENT = ['src/data/strings/', 'src/data/tuning.ts']

/**
 * Sentences built in code with template literals (docs/05 § Localization lists
 * each). The number is how many such templates the file has; a new one fails.
 */
const KNOWN_TEMPLATES: Record<string, number> = {
  // Prices from tuning formatted into lines with toLocaleString('en-US') (counts include the helper).
  'src/data/stories/flood.ts': 6,
  'src/data/stories/collector.ts': 3,
  'src/data/stories/volkova.ts': 2,
  // The protection rate as English words ("ten percent") built into lines, plus the helper.
  'src/data/stories/protection.ts': 10,
  // timesWord(n): "once", "twice", "{n} times".
  'src/data/fence.ts': 1,
}

const modules = import.meta.glob<Record<string, unknown>>('../src/data/**/*.{ts,json}', { eager: true })

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return p.endsWith('.ts') ? [p] : []
  })
}

const isContent = (path: string) => !NOT_CONTENT.some((n) => path.includes(n))

/** Every string reachable from a value (objects, arrays), with a path for the failure message. */
function* stringsIn(value: unknown, path: string, seen = new Set<unknown>()): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value]
    return
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (value instanceof Map) {
    for (const [k, v] of value) yield* stringsIn(v, `${path}[${String(k)}]`, seen)
    return
  }
  for (const [k, v] of Object.entries(value)) yield* stringsIn(v, `${path}.${k}`, seen)
}

describe('content strings use the same {name} syntax as the string table', () => {
  it('loads the content modules', () => {
    expect(Object.keys(modules).filter(isContent).length).toBeGreaterThan(80)
  })

  it('every content string is plain text or {name} holes only', () => {
    const bad: string[] = []
    let n = 0
    for (const [file, mod] of Object.entries(modules)) {
      if (!isContent(file)) continue
      for (const [path, text] of stringsIn(mod, file.replace('../', ''))) {
        n++
        if (/\$\{|\{\{|\}\}|%[sd]/.test(text) || /[{}]/.test(text.replace(/\{\w+\}/g, ''))) bad.push(`${path}: ${JSON.stringify(text)}`)
      }
    }
    expect(n).toBeGreaterThan(5000)
    expect(bad).toEqual([])
  })

  it('no content file builds sentences with template literals beyond the known spots (docs/05)', () => {
    const found: Record<string, number> = {}
    for (const file of files(DATA)) {
      const rel = relative(ROOT, file)
      if (!isContent(rel)) continue
      const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const visit = (node: ts.Node) => {
        if (ts.isTemplateExpression(node)) {
          // Static text that reads like words (ids such as `flood_talk.${who}_hero` don't count).
          const text = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join('')
          const inThrow = ts.isNewExpression(node.parent) && ts.isIdentifier(node.parent.expression) && node.parent.expression.text === 'Error'
          if (!inThrow && ((/\s/.test(text) && /[A-Za-z]/.test(text)) || /₽/.test(text))) found[rel] = (found[rel] ?? 0) + 1
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
    expect(found).toEqual(KNOWN_TEMPLATES)
  })
})
