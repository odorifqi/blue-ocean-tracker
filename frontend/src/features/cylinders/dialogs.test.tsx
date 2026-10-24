import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../mocks/db'
import { renderWithApp } from '../../test/render'
import { CylinderFormDialog } from './CylinderFormDialog'
import { StatusChangeDialog } from './StatusChangeDialog'

describe('Create form', () => {
  it('validates, asks for review, and shows the server error pop-up on a duplicate serial', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylinderFormDialog open onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Review/ }))
    expect(screen.getByText('Serial number is required.')).toBeInTheDocument()
    expect(screen.getByText('Choose a gas type.')).toBeInTheDocument()

    // Pasting a full serial in lower case is normalised to the digits.
    await user.click(screen.getByRole('textbox', { name: /Serial number/ }))
    await user.paste('cyl-703757')
    expect(screen.getByRole('textbox', { name: /Serial number/ })).toHaveValue('703757')
    await user.click(screen.getByRole('radio', { name: /Oxygen/ }))
    await user.click(screen.getByRole('button', { name: /Review/ }))

    expect(screen.getByText('Review before saving')).toBeInTheDocument()
    // The create request only sends serial and gas, so the review shows only those.
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
    expect(screen.queryByText('Customer')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Register cylinder' }))

    expect(await screen.findByText('Duplicate serial number')).toBeInTheDocument()
    // Shown in the pop-up and on the serial field it belongs to.
    expect(screen.getAllByText('CYL-703757 is already registered.')).toHaveLength(2)
    expect(screen.getByText('HTTP 409')).toBeInTheDocument()
  })
})

describe('Edit form', () => {
  it('reviews only serial and gas, since status has its own action', async () => {
    const user = userEvent.setup()
    const c = db.all().find((x) => x.gasType !== 'Argon')!
    renderWithApp(<CylinderFormDialog open cylinder={c} onClose={() => {}} />)

    await user.click(screen.getByRole('radio', { name: /Argon/ }))
    await user.click(screen.getByRole('button', { name: /Review/ }))

    expect(screen.getByText('Review before saving')).toBeInTheDocument()
    expect(screen.getByText('Gas type')).toBeInTheDocument()
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
    expect(screen.queryByText('unchanged')).not.toBeInTheDocument()
  })
})

describe('Status change', () => {
  it('offers only allowed moves and requires a customer when delivering', async () => {
    const user = userEvent.setup()
    const filled = db.all().find((c) => c.status === 'Filled')!
    renderWithApp(<StatusChangeDialog open cylinder={filled} onClose={() => {}} />)

    const options = screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)
    expect(options).toEqual(['Delivered', 'InMaintenance', 'Retired'])

    await user.click(screen.getByRole('radio', { name: /Delivered/ }))
    await user.click(screen.getByRole('button', { name: 'Deliver to customer' }))
    expect(screen.getByText('Customer name is required when delivering a cylinder.')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /Received by/ }), 'PT Café Nusantara Ünggul')
    await user.click(screen.getByRole('button', { name: 'Deliver to customer' }))

    await waitFor(() => expect(db.find(filled.id)).toMatchObject({ status: 'Delivered', customerName: 'PT Café Nusantara Ünggul' }))
  })

  it('sends one request when Enter is pressed twice, so no false error pop-up follows the success', async () => {
    const user = userEvent.setup()
    const filled = db.all().find((c) => c.status === 'Filled')!
    renderWithApp(<StatusChangeDialog open cylinder={filled} onClose={() => {}} />)

    await user.click(screen.getByRole('radio', { name: /Delivered/ }))
    await user.type(screen.getByRole('textbox', { name: /Received by/ }), 'PT Sinar Abadi')
    await user.keyboard('{Enter}{Enter}')

    await waitFor(() => expect(db.find(filled.id)).toMatchObject({ status: 'Delivered' }))
    await new Promise((r) => setTimeout(r, 300))
    expect(db.history(filled.id).filter((e) => e.type === 'status')).toHaveLength(1)
    expect(screen.queryByText('Invalid status transition')).not.toBeInTheDocument()
  })
})
