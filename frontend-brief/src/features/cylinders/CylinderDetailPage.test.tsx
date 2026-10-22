import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../mocks/db'
import { renderWithApp } from '../../test/render'
import { CylinderDetailPage } from './CylinderDetailPage'

describe('Cylinder detail page', () => {
  it('lists the usual move first and keeps Retire last', async () => {
    const empty = db.all().find((c) => c.status === 'Empty')!
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${empty.id}`, path: '/cylinders/:id' })

    const bar = await screen.findByRole('group', { name: 'Change status' })
    const labels = within(bar).getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['Mark as filled', 'Send to maintenance', 'Retire cylinder…'])
    expect(within(bar).getByRole('button', { name: 'Mark as filled' })).toHaveClass('btn--primary')
  })

  it('puts Edit details inside the Details card, not the page header', async () => {
    const any = db.all()[0]
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${any.id}`, path: '/cylinders/:id' })
    const details = await screen.findByRole('region', { name: 'Details' })
    expect(within(details).getByRole('button', { name: 'Edit details' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit details' })).toHaveLength(1)
  })

  it('names the browser tab after the serial number', async () => {
    const any = db.all()[0]
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${any.id}`, path: '/cylinders/:id' })
    await screen.findByRole('region', { name: 'Details' })
    expect(document.title).toBe(`${any.serialNumber} · Blue Ocean Tracker`)
  })

  it('keeps Retire in place but disabled when it is not allowed, and a move opens the dialog', async () => {
    const user = userEvent.setup()
    const delivered = db.all().find((c) => c.status === 'Delivered')!
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${delivered.id}`, path: '/cylinders/:id' })

    const bar = await screen.findByRole('group', { name: 'Change status' })
    expect(within(bar).getByRole('button', { name: 'Retire cylinder…' })).toBeDisabled()

    await user.click(within(bar).getByRole('button', { name: 'Mark as returned empty' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows only the brief’s fields: no history, no lifecycle diagram, no copy button', async () => {
    const any = db.all()[0]
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${any.id}`, path: '/cylinders/:id' })
    const details = await screen.findByRole('region', { name: 'Details' })
    expect(within(details).getAllByRole('term').map((t) => t.textContent)).toEqual(['Record ID', 'Serial number', 'Gas type', 'Customer', 'Last updated'])
    expect(screen.queryByRole('region', { name: /History/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Lifecycle/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy serial number' })).not.toBeInTheDocument()
  })
})
