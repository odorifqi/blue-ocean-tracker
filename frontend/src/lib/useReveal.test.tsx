import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReveal } from './useReveal'

function Card() {
  const ref = useReveal<HTMLDivElement>()
  return <div ref={ref} data-testid="card">Chart</div>
}

let trigger: (visible: boolean) => void = () => {}
class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    trigger = (visible) => cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  observe() {}
  disconnect() {}
}

const mockReducedMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))

afterEach(() => vi.unstubAllGlobals())

describe('useReveal', () => {
  it('never hides content when the user asks for reduced motion', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    mockReducedMotion(true)
    render(<Card />)
    expect(screen.getByTestId('card')).not.toHaveClass('is-pending')
  })

  it('never hides content when IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    mockReducedMotion(false)
    render(<Card />)
    expect(screen.getByTestId('card')).not.toHaveClass('is-pending')
  })

  it('holds a card until it scrolls into view, then reveals it once', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1 })
    mockReducedMotion(false)
    render(<Card />)
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('reveal', 'is-pending')

    await act(async () => trigger(true))
    expect(card).toHaveClass('is-in')
    expect(card).not.toHaveClass('is-pending')
  })
})
