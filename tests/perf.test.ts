import { describe, expect, it } from 'vitest'
import { MIN_FPS, TIER_SETTINGS, TierGovernor, guessTier } from '../src/render/perf'

/** Feed `seconds` of frames at `fps`; return every step-down. */
function run(g: TierGovernor, fps: number, seconds: number): string[] {
  const out: string[] = []
  for (let t = 0; t < seconds; t += 1 / fps) {
    const d = g.sample(1 / fps)
    if (d) out.push(d)
  }
  return out
}

describe('quality tiers', () => {
  it('tiers get cheaper going down', () => {
    expect(TIER_SETTINGS.low.pixelRatioCap).toBeLessThan(TIER_SETTINGS.mid.pixelRatioCap)
    expect(TIER_SETTINGS.mid.pixelRatioCap).toBeLessThan(TIER_SETTINGS.high.pixelRatioCap)
    expect(TIER_SETTINGS.low.antialias).toBe(false)
  })

  it('starts phones and big desktops at high', () => {
    expect(guessTier(true, 4)).toBe('high')
    expect(guessTier(false, 8)).toBe('high')
    expect(guessTier(false, 4)).toBe('mid')
  })

  it('holds the tier at a smooth frame rate', () => {
    const g = new TierGovernor('high')
    expect(run(g, 60, 30)).toEqual([])
    expect(g.lastFps).toBeCloseTo(60, 0)
  })

  it('steps down one tier per window under MIN_FPS, and stops at low', () => {
    const g = new TierGovernor('high')
    expect(run(g, 20, 40)).toEqual(['mid', 'low'])
    expect(g.current).toBe('low')
  })

  it('waits out the warm-up before judging', () => {
    const g = new TierGovernor('mid')
    expect(run(g, 15, 5)).toEqual([])
    expect(run(g, 15, 2)).toEqual(['low'])
  })

  it('ignores a few long hitches (median, not mean)', () => {
    const g = new TierGovernor('mid')
    run(g, 60, 2.5)
    for (let i = 0; i < 6; i++) expect(g.sample(0.3)).toBeNull()
    expect(run(g, 60, 5)).toEqual([])
    expect(g.lastFps).toBeGreaterThan(MIN_FPS)
  })

  it('drops tab-switch stalls entirely', () => {
    const g = new TierGovernor('mid')
    expect(g.sample(5)).toBeNull()
    expect(run(g, 60, 10)).toEqual([])
  })

  it('measures but never steps when disabled (a picked or pinned tier)', () => {
    const g = new TierGovernor('high', false)
    expect(run(g, 10, 20)).toEqual([])
    expect(g.current).toBe('high')
    expect(g.lastFps).toBeCloseTo(10, 0)
  })
})
