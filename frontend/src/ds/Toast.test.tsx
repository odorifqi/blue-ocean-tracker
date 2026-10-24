import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { ToastProvider, useToast } from './Toast'

function Triggers() {
  const toast = useToast()
  return (
    <>
      <Button onClick={() => toast.success('Cylinder registered', 'CYL-123456 · Oxygen')}>ok</Button>
      <Button onClick={() => toast.error('Couldn’t save')}>fail</Button>
    </>
  )
}

describe('Toast', () => {
  it('uses a solid tone per outcome, announces errors as alerts, and can be dismissed', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><Triggers /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'ok' }))
    expect(screen.getByRole('status')).toHaveClass('toast--success')
    expect(screen.getByRole('status')).toHaveTextContent('CYL-123456 · Oxygen')

    await user.click(screen.getByRole('button', { name: 'fail' }))
    expect(screen.getByRole('alert')).toHaveClass('toast--error')

    await user.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[1])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('waits while the pointer is over the stack and continues the countdown when it leaves', () => {
    vi.useFakeTimers()
    try {
      render(<ToastProvider><Triggers /></ToastProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'ok' }))
      const toaster = screen.getByRole('status').parentElement!

      act(() => vi.advanceTimersByTime(3000))
      fireEvent.mouseEnter(toaster)
      act(() => vi.advanceTimersByTime(20_000))
      expect(screen.getByRole('status')).toBeInTheDocument()

      fireEvent.mouseLeave(toaster)
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByRole('status')).toBeInTheDocument() // 1.5 s of the 4.5 s were still left
      act(() => vi.advanceTimersByTime(600))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks older toasts as behind the newest one, fans them out on tap, and dismisses on a swipe up', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><Triggers /></ToastProvider>)
    await user.click(screen.getByRole('button', { name: 'ok' }))
    await user.click(screen.getByRole('button', { name: 'fail' }))

    const older = screen.getByRole('status')
    const newest = screen.getByRole('alert')
    expect(older).toHaveClass('is-behind')
    expect(older.style.getPropertyValue('--depth')).toBe('1')
    expect(newest).not.toHaveClass('is-behind')

    const toaster = newest.parentElement!
    expect(toaster).not.toHaveClass('is-expanded')
    await user.click(screen.getByText('Couldn’t save'))
    expect(toaster).toHaveClass('is-expanded')

    fireEvent.pointerDown(newest, { pointerType: 'touch', clientY: 120 })
    fireEvent.pointerUp(newest, { pointerType: 'touch', clientY: 60 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(toaster).not.toHaveClass('is-expanded') // one toast left, nothing to fan out
  })

  it('pauses on touch until the next touch lands outside the stack', () => {
    vi.useFakeTimers()
    try {
      render(<ToastProvider><Triggers /></ToastProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'ok' }))
      fireEvent.touchStart(screen.getByRole('status'))
      act(() => vi.advanceTimersByTime(20_000))
      expect(screen.getByRole('status')).toBeInTheDocument()

      fireEvent.pointerDown(document.body)
      act(() => vi.advanceTimersByTime(4600))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
