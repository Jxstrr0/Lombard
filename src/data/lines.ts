/**
 * Customer dialogue lines keyed by situation. Haggle responses use
 * HaggleResponse.lineKey ("<kind>.<temperament>" or more specific keys).
 * {price} is replaced with the formatted price.
 */
import type { Rng } from '../game/rng'

export const haggleLines: Record<string, readonly string[]> = {
  'accept.flexible': ['Fine. {price} it is.'],
  'counter.flexible': ['I was thinking more like {price}.'],
  'walk.flexible': ['Forget it. I’ll try somewhere else.'],
}

export const visitLines = {
  pass: ['Your loss.', 'Fine. There’s another lombard by the bridge.'],
  left: ['I can’t wait all day.'],
  thanks: ['Pleasure doing business.'],
} as const

export function pickLine(key: string, rng: Rng, vars: Record<string, string> = {}): string {
  const options = haggleLines[key] ?? haggleLines[key.split('.')[0] + '.flexible'] ?? ['…']
  let line = rng.pick(options)
  for (const [k, v] of Object.entries(vars)) line = line.replaceAll(`{${k}}`, v)
  return line
}
