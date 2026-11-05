/** M3: scripted item models (art/items → public/assets/items) line up with the item defs. */
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEM_DEFS } from '../src/data/items'

const ROOT = path.resolve(__dirname, '..')
const ASSETS = path.join(ROOT, 'public', 'assets', 'items')
const KINDS = path.join(ROOT, 'art', 'items', 'kinds')

describe('item models', () => {
  it('every model.glb names a packed file', () => {
    for (const def of ITEM_DEFS) {
      if (!def.model.glb) continue
      expect(def.model.glb, def.id).toBe(`${def.id}.glb`)
      expect(existsSync(path.join(ASSETS, def.model.glb)), `${def.id}: ${def.model.glb} is not in public/assets/items`).toBe(true)
    }
  })

  it('every packed glb belongs to a def that uses it', () => {
    const used = new Set(ITEM_DEFS.map((d) => d.model.glb).filter(Boolean))
    const files = existsSync(ASSETS) ? readdirSync(ASSETS).filter((f) => f.endsWith('.glb')) : []
    for (const f of files) expect(used.has(f), `${f} is packed but no def sets model.glb to it`).toBe(true)
  })

  it('a def only points at a glb when its kind has a builder', () => {
    for (const def of ITEM_DEFS) {
      if (!def.model.glb) continue
      expect(existsSync(path.join(KINDS, `${def.model.placeholder}.py`)), `${def.id}: no art/items/kinds/${def.model.placeholder}.py`).toBe(true)
    }
  })
})
