/** M3: the canal backdrop render (art/backdrop → public/assets/backdrop) still fits the shop it is seen from. */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'public', 'assets', 'backdrop')
const ART = path.join(ROOT, 'art', 'backdrop')

interface Manifest {
  eye: [number, number, number]
  plane: { z: number; x0: number; x1: number; y0: number; y1: number }
  size: [number, number]
  waterY: number
  file: string
  inputHash: string
}
interface LayoutObject {
  name: string
  position?: [number, number, number]
  size?: [number, number, number]
  children?: LayoutObject[]
}

const manifest = JSON.parse(readFileSync(path.join(DIR, 'canal.json'), 'utf8')) as Manifest
const layout = JSON.parse(readFileSync(path.join(ROOT, 'bake', 'layout.json'), 'utf8')) as {
  cameras: { name: string; position: [number, number, number] }[]
  objects: LayoutObject[]
}

function group(name: string): { at: [number, number, number]; child: (n: string) => LayoutObject } {
  const g = layout.objects.find((o) => o.name === name)
  if (!g?.children) throw new Error(`layout has no ${name} group`)
  return {
    at: g.position ?? [0, 0, 0],
    child: (n) => {
      const c = g.children!.find((o) => o.name === n)
      if (!c?.position) throw new Error(`layout ${name} has no ${n}`)
      return c
    },
  }
}

/** Openings the backdrop must fill, from the bake layout: [x0, x1, y0, y1, z]. */
function openings(): [number, number, number, number, number][] {
  const w = group('window')
  const px = (n: string) => w.at[0] + w.child(n).position![0]
  const py = (n: string) => w.at[1] + w.child(n).position![1]
  const d = group('door')
  const glass = d.child('door_glass')
  const [gx, gy] = [d.at[0] + glass.position![0], d.at[1] + glass.position![1]]
  const [sx, sy] = [glass.size![0], glass.size![1]]
  return [
    [px('window_post_l'), px('window_post_r'), py('window_foot'), py('window_head'), w.at[2]],
    [gx - sx / 2, gx + sx / 2, gy - sy / 2, gy + sy / 2, d.at[2]],
  ]
}

describe('canal backdrop', () => {
  it('the packed texture exists and is small', () => {
    const file = path.join(DIR, manifest.file)
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file).length).toBeLessThan(700 * 1024)
  })

  it('was rendered from the player eye', () => {
    const eye = layout.cameras.find((c) => c.name === 'preview')!.position
    expect(manifest.eye).toEqual(eye)
  })

  it('covers the window and the door glass as seen from the eye', () => {
    const { plane, eye } = manifest
    for (const [x0, x1, y0, y1, z] of openings()) {
      for (const [x, y] of [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ] as const) {
        const t = (plane.z - eye[2]) / (z - eye[2])
        const px = eye[0] + (x - eye[0]) * t
        const py = eye[1] + (y - eye[1]) * t
        expect(px, `opening corner (${x}, ${y}) falls off the backdrop: rerun art/backdrop/build.py`).toBeGreaterThan(plane.x0)
        expect(px).toBeLessThan(plane.x1)
        expect(py, `opening corner (${x}, ${y}) falls off the backdrop: rerun art/backdrop/build.py`).toBeGreaterThan(plane.y0)
        expect(py).toBeLessThan(plane.y1)
      }
    }
  })

  it('is up to date with its build scripts', () => {
    const h = createHash('sha256')
    for (const f of readdirSync(ART)
      .filter((f) => f.endsWith('.py'))
      .sort())
      h.update(readFileSync(path.join(ART, f)))
    expect(manifest.inputHash, 'art/backdrop changed since the committed render: rerun build.py and scripts/backdrop-pack.mjs').toBe(h.digest('hex').slice(0, 16))
  })
})
