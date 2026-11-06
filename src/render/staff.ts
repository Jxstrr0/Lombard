/**
 * The appraiser in the shop (M6, presentation only): one cast model (his staff-only look) that
 * walks a small graph of spots in world metres (bake/layout.json) between the storeroom, behind
 * the counter and the shop floor. Reads the game state; never writes it.
 *
 *   - serving a walk-in (state.staff.busy): at the second counter, the street side of the island
 *     case, facing it (the seller across it isn't drawn: the phone budget has one customer);
 *   - talking to you (his arc's scenes: the visitor at the counter is him): at the customer spot,
 *     facing you (the scene leaves the customer slot empty for him);
 *   - closed: at the storeroom workbench;
 *   - otherwise: idling round a fixed cycle of spots (the workbench, the storeroom shelves, behind
 *     the counter, the right-hand shelves, the wall cases, the second counter), a while at each.
 *
 * Paths are straight segments between graph nodes, chosen to clear the counter, the island case
 * and the chair. One model, no extra lights, no shadows.
 */
import * as THREE from 'three'
import type { CustomerModel } from './customerModel'

type Node = 'bench' | 'shelf' | 'via' | 'door' | 'cback' | 'behind' | 'cfront' | 'spot' | 'shelves' | 'floor' | 'second' | 'casesVia' | 'cases'

/** Facing −z is yaw 0 (the cast glbs are turned to face the player). */
const FACE = { negZ: 0, posZ: Math.PI, posX: -Math.PI / 2, negX: Math.PI / 2 }

const NODES: Record<Node, { at: THREE.Vector3; yaw?: number }> = {
  /** In front of the storeroom workbench (4.15, -3.68). */
  bench: { at: new THREE.Vector3(4.15, 0, -3.2), yaw: FACE.negZ },
  /** At the storeroom shelves (x 5.72). */
  shelf: { at: new THREE.Vector3(5.2, 0, -2.8), yaw: FACE.posX },
  via: { at: new THREE.Vector3(3.6, 0, -3.2) },
  /** The storeroom doorway (x 3.0). */
  door: { at: new THREE.Vector3(2.95, 0, -3.2) },
  cback: { at: new THREE.Vector3(2.25, 0, -2.9) },
  /** Behind the counter, at its left end (the player's left), facing the shop. */
  behind: { at: new THREE.Vector3(1.3, 0, -2.85), yaw: FACE.posZ },
  cfront: { at: new THREE.Vector3(2.25, 0, -1.45) },
  /** The customer spot, facing the player (his scenes). */
  spot: { at: new THREE.Vector3(-0.15, 0, -1.45), yaw: FACE.negZ },
  /** At the right-hand shelves (x 2.8). */
  shelves: { at: new THREE.Vector3(2.35, 0, 1.2), yaw: FACE.posX },
  floor: { at: new THREE.Vector3(0.6, 0, 1.9) },
  /** The second counter: the street side of the island case (x -1.15, z 0.1…1.4), facing it. */
  second: { at: new THREE.Vector3(-1.15, 0, 1.75), yaw: FACE.negZ },
  casesVia: { at: new THREE.Vector3(-2.1, 0, 1.75) },
  /** At the left wall case (x -2.76). */
  cases: { at: new THREE.Vector3(-2.25, 0, 0.3), yaw: FACE.negX },
}

const EDGES: [Node, Node][] = [
  ['bench', 'via'],
  ['shelf', 'via'],
  ['via', 'door'],
  ['door', 'cback'],
  ['cback', 'behind'],
  ['cback', 'cfront'],
  ['cfront', 'spot'],
  ['cfront', 'shelves'],
  ['shelves', 'floor'],
  ['spot', 'floor'],
  ['floor', 'second'],
  ['second', 'casesVia'],
  ['casesVia', 'cases'],
]

/** Idle cycle: [spot, seconds there]. */
const IDLE: [Node, number][] = [
  ['bench', 14],
  ['behind', 9],
  ['shelves', 8],
  ['second', 12],
  ['cases', 8],
  ['shelf', 10],
]

const TURN_RATE = 3.2
const BLEND = 0.35
const FALLBACK_SPEED = 1.1

function route(from: Node, to: Node): Node[] {
  if (from === to) return [to]
  const prev = new Map<Node, Node>()
  const queue: Node[] = [from]
  const seen = new Set<Node>([from])
  while (queue.length) {
    const n = queue.shift()!
    if (n === to) break
    for (const [a, b] of EDGES) {
      const m = a === n ? b : b === n ? a : null
      if (m && !seen.has(m)) {
        seen.add(m)
        prev.set(m, n)
        queue.push(m)
      }
    }
  }
  const path: Node[] = []
  for (let n: Node | undefined = to; n && n !== from; n = prev.get(n)) path.unshift(n)
  return path
}

export type StaffWhere = 'hidden' | 'closed' | 'serving' | 'counter' | 'idle'

export class StaffFigure {
  readonly group = new THREE.Group()
  private model: CustomerModel | null = null
  private where: StaffWhere = 'hidden'
  /** The node he stands at (or last passed). */
  private at: Node = 'bench'
  private goal: Node = 'bench'
  private path: Node[] = []
  private idleIndex = 0
  private idleLeft = 0
  /** Walking right now (for the dev overlay and screenshots). */
  walking = false

  constructor() {
    this.group.name = 'staff'
    this.group.visible = false
    this.group.position.copy(NODES.bench.at)
  }

  /** Put his model in (once loaded): fully opaque, idling. */
  setModel(model: CustomerModel): void {
    if (this.model === model) return
    this.model?.root.removeFromParent()
    this.model = model
    for (const m of model.materials) {
      m.opacity = 1
      m.transparent = m.userData.blend === true
      m.needsUpdate = true
    }
    model.play('idle', 0)
    this.group.add(model.root)
  }

  get hasModel(): boolean {
    return this.model !== null
  }

  /** Standing at his goal, done walking (the counter scene waits for this). */
  get arrived(): boolean {
    return this.path.length === 0 && this.at === this.goal && !this.walking
  }

  get state(): StaffWhere {
    return this.where
  }

  /** Where he should be; a change of plan reroutes from the node he last reached. */
  setWhere(where: StaffWhere): void {
    if (where === this.where) return
    const was = this.where
    this.where = where
    if (where === 'hidden') {
      this.group.visible = false
      return
    }
    if (was === 'hidden') {
      // Appears in the storeroom (hired from the office), or where his job puts him (a dev scenario).
      const start: Node = where === 'serving' ? 'second' : where === 'counter' ? 'spot' : 'bench'
      this.place(start)
    }
    this.group.visible = this.model !== null
    if (where === 'idle') {
      this.idleLeft = 0
      return
    }
    this.goTo(where === 'serving' ? 'second' : where === 'counter' ? 'spot' : 'bench')
  }

  /** Stand at a node at once (no walk). */
  private place(n: Node): void {
    this.at = n
    this.goal = n
    this.path = []
    this.group.position.copy(NODES[n].at)
    this.group.rotation.y = NODES[n].yaw ?? 0
    this.walking = false
    this.model?.play('idle', 0)
  }

  private goTo(n: Node): void {
    if (n === this.goal && (this.path.length > 0 || this.at === n)) return
    this.goal = n
    this.path = route(this.at, n)
  }

  update(dt: number): void {
    if (this.where === 'hidden' || !this.model) return
    this.group.visible = true
    this.model.mixer?.update(dt)
    if (this.where === 'idle' && this.path.length === 0 && this.at === this.goal) {
      this.idleLeft -= dt
      if (this.idleLeft <= 0) {
        const [next, stay] = IDLE[this.idleIndex % IDLE.length]!
        this.idleIndex++
        this.idleLeft = stay
        this.goTo(next)
      }
    }
    const next = this.path[0]
    if (!next) {
      this.walking = false
      this.model.play('idle', BLEND)
      const yaw = NODES[this.at].yaw
      if (yaw !== undefined) this.turnTo(yaw, dt)
      return
    }
    const target = NODES[next].at
    const pos = this.group.position
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const dist = Math.hypot(dx, dz)
    // Turn towards the next node first (on the spot when the bend is sharp), then walk.
    const yaw = Math.atan2(-dx, -dz)
    const facing = this.turnTo(yaw, dt, dist > 0.05 ? 0.6 : Math.PI)
    if (!facing) {
      this.model.play('idle', BLEND)
      this.walking = false
      return
    }
    this.model.play('walk', BLEND)
    this.walking = true
    const step = (this.model.walkSpeed ?? FALLBACK_SPEED) * dt
    if (step >= dist) {
      pos.set(target.x, 0, target.z)
      this.at = next
      this.path.shift()
    } else {
      pos.x += (dx / dist) * step
      pos.z += (dz / dist) * step
    }
  }

  /** Turn towards `yaw`; true once within `slack` radians of it. */
  private turnTo(yaw: number, dt: number, slack = 0): boolean {
    let d = yaw - this.group.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    const maxStep = TURN_RATE * dt
    if (Math.abs(d) <= maxStep) this.group.rotation.y = yaw
    else this.group.rotation.y += Math.sign(d) * maxStep
    return Math.abs(d) <= Math.max(maxStep, slack)
  }

  dispose(): void {
    this.model?.root.removeFromParent()
    this.model = null
  }
}
