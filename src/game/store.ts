/** Minimal store: holds GameState, applies actions through the reducer, notifies listeners. */
import { reducer, type Action } from './actions'
import type { GameState } from './state'

export type Listener = (state: GameState, prev: GameState, action: Action) => void

export class Store {
  private state: GameState
  private listeners = new Set<Listener>()

  constructor(initial: GameState) {
    this.state = initial
  }

  get(): GameState {
    return this.state
  }

  dispatch = (action: Action): void => {
    const prev = this.state
    const next = reducer(prev, action)
    if (next === prev) return
    this.state = next
    for (const l of this.listeners) l(next, prev, action)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
