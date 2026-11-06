/** M3: scripted item models (art/items → public/assets/items) line up with the item defs. */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ITEM_DEFS } from '../src/data/items'

const ROOT = path.resolve(__dirname, '..')
const ASSETS = path.join(ROOT, 'public', 'assets', 'items')
const KINDS = path.join(ROOT, 'art', 'items', 'kinds')
/** M6: CC0 models prepared by art/items/cc0.py, keyed by def id. */
const CC0 = JSON.parse(readFileSync(path.join(ROOT, 'art', 'items', 'cc0.json'), 'utf8')) as Record<string, unknown>

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

  it('a def only points at a glb when its kind has a builder (or it is a prepared CC0 model)', () => {
    for (const def of ITEM_DEFS) {
      if (!def.model.glb) continue
      if (def.model.placeholder === 'block') {
        expect(CC0[def.id], `${def.id}: not in art/items/cc0.json`).toBeDefined()
        continue
      }
      expect(existsSync(path.join(KINDS, `${def.model.placeholder}.py`)), `${def.id}: no art/items/kinds/${def.model.placeholder}.py`).toBe(true)
    }
  })
})
