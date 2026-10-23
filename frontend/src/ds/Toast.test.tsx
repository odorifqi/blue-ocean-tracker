import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
})
