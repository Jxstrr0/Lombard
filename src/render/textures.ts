/**
 * Procedural canvas textures for the M0 grey-box shop. Replaced by
 * Poly Haven / ambientCG materials and the baked lightmap in M3.
 * Uses the seeded RNG so the room looks the same on every load.
 */
import * as THREE from 'three'
import { Rng } from '../game/rng'
import { textureAnisotropy } from './perf'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement, repeatX = 1, repeatY = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = textureAnisotropy()
  return t
}

/** Worn parquet: staggered planks with tone variation and scuffs. */
export function parquetTexture(): THREE.CanvasTexture {
  const rng = new Rng(7001)
  const [c, ctx] = canvas(512, 512)
  const plankW = 64
  const plankH = 256
  for (let col = 0; col < 512 / plankW; col++) {
    const offset = (col % 2) * (plankH / 2)
    for (let row = -1; row < 512 / plankH + 1; row++) {
      const y = row * plankH + offset
      const l = rng.range(22, 34)
      ctx.fillStyle = `hsl(${rng.range(22, 30)}, ${rng.range(35, 48)}%, ${l}%)`
      ctx.fillRect(col * plankW, y, plankW, plankH)
      // grain
      for (let g = 0; g < 14; g++) {
        ctx.strokeStyle = `rgba(20, 10, 4, ${rng.range(0.05, 0.18)})`
        ctx.lineWidth = rng.range(0.5, 1.6)
        const gx = col * plankW + rng.range(2, plankW - 2)
        ctx.beginPath()
        ctx.moveTo(gx, y)
        ctx.bezierCurveTo(gx + rng.range(-4, 4), y + plankH / 3, gx + rng.range(-4, 4), y + (2 * plankH) / 3, gx, y + plankH)
        ctx.stroke()
      }
      // seams
      ctx.fillStyle = 'rgba(8, 4, 2, 0.75)'
      ctx.fillRect(col * plankW, y, plankW, 2)
      ctx.fillRect(col * plankW, y, 2, plankH)
    }
  }
  // traffic wear: lighter, flatter patch where customers stand
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 300)
  grad.addColorStop(0, 'rgba(160, 130, 100, 0.10)')
  grad.addColorStop(1, 'rgba(160, 130, 100, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 512)
  return toTexture(c, 3, 4)
}

/** Old plaster: warm off-white with blotches and a darker skirting band. */
export function plasterTexture(): THREE.CanvasTexture {
  const rng = new Rng(7002)
  const [c, ctx] = canvas(512, 512)
  ctx.fillStyle = '#e4dccb'
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 260; i++) {
    const x = rng.range(0, 512)
    const y = rng.range(0, 512)
    const r = rng.range(6, 40)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const dark = rng.chance(0.5)
    g.addColorStop(0, dark ? `rgba(90, 75, 55, ${rng.range(0.02, 0.05)})` : `rgba(245, 240, 228, ${rng.range(0.02, 0.05)})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // damp stain creeping up from the floor
  const damp = ctx.createLinearGradient(0, 512, 0, 380)
  damp.addColorStop(0, 'rgba(70, 60, 40, 0.28)')
  damp.addColorStop(1, 'rgba(70, 60, 40, 0)')
  ctx.fillStyle = damp
  ctx.fillRect(0, 380, 512, 132)
  return toTexture(c, 4, 1)
}

/** Canal backdrop card seen through the street window: overcast sky, facades, water. */
export function canalBackdropTexture(): THREE.CanvasTexture {
  const rng = new Rng(7003)
  const [c, ctx] = canvas(1024, 512)
  const sky = ctx.createLinearGradient(0, 0, 0, 300)
  sky.addColorStop(0, '#9fb0bd')
  sky.addColorStop(1, '#d9dcd6')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1024, 512)
  // far bank facades
  let x = -20
  while (x < 1044) {
    const w = rng.range(70, 150)
    const h = rng.range(110, 190)
    const hue = rng.pick([28, 38, 48, 10, 200])
    ctx.fillStyle = `hsl(${hue}, ${rng.range(15, 35)}%, ${rng.range(52, 68)}%)`
    ctx.fillRect(x, 300 - h, w, h)
    // windows
    ctx.fillStyle = 'rgba(40, 45, 55, 0.55)'
    for (let wy = 300 - h + 18; wy < 285; wy += 32) {
      for (let wx = x + 10; wx < x + w - 14; wx += 22) ctx.fillRect(wx, wy, 10, 16)
    }
    // cornice
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x, 300 - h, w, 4)
    x += w + rng.range(0, 6)
  }
  // embankment
  ctx.fillStyle = '#6f6a62'
  ctx.fillRect(0, 300, 1024, 18)
  ctx.fillStyle = '#2b2a28'
  for (let rx = 0; rx < 1024; rx += 16) ctx.fillRect(rx, 292, 3, 10)
  // water
  const water = ctx.createLinearGradient(0, 318, 0, 512)
  water.addColorStop(0, '#5d6a70')
  water.addColorStop(1, '#2f3a3f')
  ctx.fillStyle = water
  ctx.fillRect(0, 318, 1024, 194)
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(220, 225, 220, ${rng.range(0.04, 0.14)})`
    ctx.fillRect(rng.range(0, 1024), rng.range(322, 512), rng.range(10, 60), 1.5)
  }
  return toTexture(c)
}

/** Soft radial dark blob used as a contact-shadow decal under furniture. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128)
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.75)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
