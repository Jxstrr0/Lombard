/**
 * The tea glass on the counter, pure part (tests/life.test.ts): how full and
 * how hot it is, from the shop minutes since it was last poured. The player
 * sips now and then; the glass is topped up in a lull between customers once
 * it is half gone (render/life/teaGlass.ts decides when).
 */

export const TEA = {
  /** Shop minutes between sips. */
  sipEvery: 7,
  /** Fraction of a full glass per sip. */
  sip: 0.075,
  /** Never quite empty: the dregs and the lemon pip stay. */
  minLevel: 0.12,
  /** Shop minutes for the heat to fall to 1/e (steam fades with it). */
  coolMinutes: 28,
  /** Top up in a lull once the level is at or under this. */
  refillBelow: 0.55,
}

export interface TeaState {
  /** 0–1 of a full glass. */
  level: number
  /** 1 just poured, towards 0 as it cools. */
  heat: number
}

export function teaAt(minutesSincePour: number): TeaState {
  const m = Math.max(0, minutesSincePour)
  const sips = Math.floor(m / TEA.sipEvery)
  return {
    level: Math.max(TEA.minLevel, 1 - sips * TEA.sip),
    heat: Math.exp(-m / TEA.coolMinutes),
  }
}

/** Whether a lull that starts now (nobody at the counter) is a moment to top up. */
export function wantsRefill(minutesSincePour: number): boolean {
  return teaAt(minutesSincePour).level <= TEA.refillBelow
}
