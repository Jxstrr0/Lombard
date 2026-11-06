import { describe, expect, it } from 'vitest'
import { LoadProgress } from '../src/render/loadProgress'

describe('LoadProgress (loading screen bar)', () => {
  it('counts each file the same until every size is known', () => {
    const p = new LoadProgress(['a', 'b'])
    expect(p.fraction()).toBe(0)
    p.track('a')({ loaded: 50, total: 100, lengthComputable: true })
    expect(p.fraction()).toBeCloseTo(0.25)
  })

  it('weights by bytes once every size is known', () => {
    const p = new LoadProgress(['big', 'small'])
    p.track('big')({ loaded: 0, total: 900 })
    p.track('small')({ loaded: 100, total: 100 })
    expect(p.fraction()).toBeCloseTo(0.1)
    p.track('big')({ loaded: 450, total: 900 })
    expect(p.fraction()).toBeCloseTo(0.55)
  })

  it('a finished file with no size still counts, and all done is 1', () => {
    const p = new LoadProgress(['a', 'b'])
    p.track('a')({ loaded: 300, total: 0, lengthComputable: false })
    p.track('b')({ loaded: 50, total: 100 })
    p.done('a')
    expect(p.fraction()).toBeCloseTo(0.75)
    p.done('b')
    expect(p.fraction()).toBe(1)
  })

  it('tells its listener about every change', () => {
    const p = new LoadProgress(['a'])
    let calls = 0
    p.onChange = () => calls++
    p.track('a')({ loaded: 1, total: 2 })
    p.done('a')
    expect(calls).toBe(2)
  })
})
