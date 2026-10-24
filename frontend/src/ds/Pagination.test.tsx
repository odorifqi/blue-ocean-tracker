import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pagination } from './Pagination'

function Paged() {
  const [page, setPage] = useState(2)
  const [size, setSize] = useState(10)
  const ref = useRef<HTMLDivElement>(null)
  const results = useRef<HTMLDivElement>(null)
  return (
    <>
      <div ref={ref} data-testid="list" style={{ scrollMarginTop: '64px' }}>
        <div ref={results} tabIndex={-1} data-testid="results" />
      </div>
      <button type="button">Search</button>
      <Pagination page={page} pageSize={size} totalCount={87} onPageChange={setPage} onPageSizeChange={setSize} scrollTarget={ref} focusTarget={results} />
    </>
  )
}

function setup(top: number) {
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  render(<Paged />)
  return { scrollIntoView, results: screen.getByTestId('results') }
}

afterEach(() => vi.restoreAllMocks())

describe('Pagination scrollTarget', () => {
  it('jumps to the top of the list and hands focus to its results when the list starts above the screen', async () => {
    const user = userEvent.setup()
    const { scrollIntoView, results } = setup(-1800)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    expect(results).toHaveFocus()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21–30 of 87')
  })

  it('treats a list top hidden under the sticky top bar as off-screen', async () => {
    const user = userEvent.setup()
    const { scrollIntoView } = setup(40)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('leaves the view and focus alone when the first row is already visible', async () => {
    const user = userEvent.setup()
    const { scrollIntoView, results } = setup(120)
    const next = screen.getByRole('button', { name: 'Page 3' })
    await user.click(next)
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(results).not.toHaveFocus()
    expect(next).toHaveFocus()
  })

  it('announces the new range politely', () => {
    setup(0)
    expect(screen.getByText(/Showing/)).toHaveAttribute('aria-live', 'polite')
  })
})
