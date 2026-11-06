/**
 * The UI string lookup (M6, localization-ready). Every player-facing string the
 * DOM layer shows comes from a table keyed by stable ids (`en.ts`, the only
 * shipped language) through `t(key, params?)`. No library: plain objects,
 * `{name}` holes and plural forms picked by `Intl.PluralRules`, so the same
 * table shape works for a language with one / few / many forms (Russian).
 *
 * Pure: no DOM, no three. A future translation is another file of the
 * `Translation` shape (every key, each a string or plural forms); `makeT`
 * builds a lookup for it. See docs/05 § Localization for how content is translated.
 */
import { en } from './en'

/** The one locale for strings, numbers and dates (see ui/format.ts). */
export const LOCALE = 'en-GB'

export type StringTable = typeof en
export type StringKey = keyof StringTable

/** Plural forms of one string: CLDR categories, `other` required. The count goes in `{count}`. */
export type PluralForms = { readonly other: string } & { readonly [C in Intl.LDMLPluralRule]?: string }
export type Entry = string | PluralForms
/** What a translation must provide: every key of the English table. */
export type Translation = { readonly [K in StringKey]: Entry }

/** `{a} and {b}` → 'a' | 'b'. */
type Holes<S> = S extends `${string}{${infer P}}${infer R}` ? P | Holes<R> : never
type TextOf<E> = E extends string ? E : E[keyof E]
/** The parameters a key takes: its holes, plus `count` for plural forms. */
export type ParamName<K extends StringKey> = Holes<TextOf<StringTable[K]>> | (StringTable[K] extends string ? never : 'count')
export type Params<K extends StringKey> = { readonly [P in ParamName<K>]: string | number }
/** Keys that take no parameters (safe to keep in a lookup table and pass to `t` alone). */
export type PlainKey = { [K in StringKey]: [ParamName<K>] extends [never] ? K : never }[StringKey]
/** No second argument for a key without holes; a typed object for one with them. */
type Args<K extends StringKey> = [ParamName<K>] extends [never] ? [] : [params: Params<K>]

const HOLE = /\{(\w+)\}/g

/** Fill `{name}` holes. Numbers go in as written (`String(n)`): callers format money and dates first. */
export function interpolate(text: string, params: Readonly<Record<string, string | number>> = {}): string {
  return text.replace(HOLE, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/** Every `{name}` hole in a string. */
export function holesOf(text: string): string[] {
  return [...text.matchAll(HOLE)].map((m) => m[1]!)
}

/** A lookup over one table and locale. */
export function makeT(table: Translation, locale: string) {
  const rules = new Intl.PluralRules(locale)
  return function t<K extends StringKey>(key: K, ...args: Args<K>): string {
    const entry = table[key] as Entry
    const params = (args[0] ?? {}) as Record<string, string | number>
    if (typeof entry === 'string') return interpolate(entry, params)
    const count = Number(params.count ?? 0)
    return interpolate(entry[rules.select(count)] ?? entry.other, params)
  }
}

/** The shipped lookup: English. */
export const t = makeT(en, LOCALE)
