import { describe, expect, it } from 'vitest'
import { Rng, hashString } from '../src/game/rng'

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(12345)
    const b = new Rng(12345)
    const seqA = Array.from({ length: 20 }, () => a.nextU32())
    const seqB = Array.from({ length: 20 }, () => b.nextU32())
    expect(seqA).toEqual(seqB)
  })

  it('matches the reference mulberry32 sequence', () => {
    // Golden values: if these change, every saved career's future changes.
    const r = new Rng(1)
    expect([r.nextU32(), r.nextU32(), r.nextU32()]).toEqual([2693262067, 11749833, 2265367787])
  })

  it('differs between seeds', () => {
    expect(new Rng(1).nextU32()).not.toEqual(new Rng(2).nextU32())
  })

  it('resumes exactly from a saved state', () => {
    const a = new Rng(99)
    for (let i = 0; i < 7; i++) a.next()
    const b = Rng.from(a.state)
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(
      Array.from({ length: 10 }, () => b.next()),
    )
  })

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const r = new Rng(7)
    const buckets = new Array<number>(10).fill(0)
    const n = 100_000
    for (let i = 0; i < n; i++) {
      const x = r.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      buckets[Math.floor(x * 10)]!++
    }
    for (const count of buckets) expect(Math.abs(count - n / 10)).toBeLessThan(n * 0.01)
  })

  it('int() is inclusive and covers the range', () => {
    const r = new Rng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 3)
      expect(v).toBeGreaterThanOrEqual(-2)
      expect(v).toBeLessThanOrEqual(3)
      seen.add(v)
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2, 3])
  })

  it('int() rejects bad ranges', () => {
    expect(() => new Rng(1).int(5, 1)).toThrow(RangeError)
    expect(() => new Rng(1).int(0.5, 2)).toThrow(RangeError)
  })

  it('pick() and weighted() handle edge cases', () => {
    const r = new Rng(5)
    expect(() => r.pick([])).toThrow(RangeError)
    expect(r.pick(['only'])).toBe('only')
    expect(() => r.weighted([{ item: 'a', weight: 0 }])).toThrow(RangeError)
    for (let i = 0; i < 100; i++) {
      expect(r.weighted([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }])).toBe('b')
    }
  })

  it('weighted() follows the weights', () => {
    const r = new Rng(11)
    let heavy = 0
    const n = 20_000
    for (let i = 0; i < n; i++) {
      if (r.weighted([{ item: 'h', weight: 3 }, { item: 'l', weight: 1 }]) === 'h') heavy++
    }
    expect(heavy / n).toBeCloseTo(0.75, 1)
  })

  it('shuffle() is a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = new Rng(8).shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((a, b) => a - b)).toEqual(input)
  })

  it('fork() is deterministic and does not advance the parent', () => {
    const a = new Rng(42)
    const before = a.state
    const f1 = a.fork('customers').next()
    expect(a.state).toBe(before)
    expect(new Rng(42).fork('customers').next()).toBe(f1)
    expect(new Rng(42).fork('items').next()).not.toBe(f1)
  })

  it('hashString is stable', () => {
    expect(hashString('')).toBe(0x811c9dc5)
    expect(hashString('lombard')).toBe(hashString('lombard'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })
})
