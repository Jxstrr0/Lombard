import { describe, expect, it } from 'vitest'
import { ITEM_DEFS } from '../src/data/items'
import { claimFits, claimSpeaker } from '../src/game/items/claims'
import { genderOf } from '../src/game/customers/look'
import { generateDayQueue } from '../src/game/customers/walkins'
import { Rng } from '../src/game/rng'

describe('claims fit their speaker', () => {
  it('reads who a claim needs', () => {
    expect(claimSpeaker('From my first husband. The earrings were the best part of him.')).toBe('f')
    expect(claimSpeaker('My wife prefers paper.')).toBe('m')
    expect(claimSpeaker('My daughter chose a boyfriend with a better phone.')).toBeUndefined()
  })

  it('no walk-in tells a story meant for someone else', () => {
    let n = 0
    for (let seed = 1; seed <= 300; seed++) {
      let id = 0
      for (const v of generateDayQueue(new Rng(seed), 8, (p) => `${p}${id++}`)) {
        const item = v.item!
        const def = ITEM_DEFS.find((d) => d.id === item.defId)!
        const anyFit = def.claims.some((c) => claimFits(c, genderOf(v.customer.name)))
        if (anyFit) expect(claimFits(item.story, genderOf(v.customer.name)), `${v.customer.name}: ${item.story}`).toBe(true)
        n++
      }
    }
    expect(n).toBe(2400)
  })
})
