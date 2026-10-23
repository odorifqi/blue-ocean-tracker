// Knobs for the demo panel, so reviewers can see loading and error states
// without a real backend misbehaving.

export type FailureMode = 'none' | 'next' | 'always' | 'offline'

export interface MockSettings {
  latency: number
  failure: FailureMode
}

const KEY = 'smtr.mock.settings.v1'
const defaults: MockSettings = { latency: 450, failure: 'none' }
const listeners = new Set<() => void>()

let current: MockSettings = (() => {
  try {
    return { ...defaults, ...JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}'), failure: 'none' }
  } catch {
    return defaults
  }
})()

export const mockSettings = {
  get: () => current,
  set(patch: Partial<MockSettings>) {
    current = { ...current, ...patch }
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ latency: current.latency }))
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}
