import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/setup'
import { DEMO_OPERATOR, db } from '../../mocks/db'
import { renderWithApp } from '../../test/render'
import { CylinderDetailPage } from './CylinderDetailPage'

describe('History card', () => {
  it('shows a new status change at the top with who made it, and says when earlier history is unknown', async () => {
    const user = userEvent.setup()
    const empty = db.all().find((c) => c.status === 'Empty')!
    renderWithApp(<CylinderDetailPage />, { route: `/cylinders/${empty.id}`, path: '/cylinders/:id' })

    const card = await screen.findByRole('region', { name: 'History' })
    expect(await within(card).findByText('Imported')).toBeInTheDocument()
    expect(within(card).getByText(/Earlier history isn’t known/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mark as filled' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /mark as filled|confirm|change status/i }))

    await within(card).findByText('Status changed')
    expect(within(card).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Action at', 'Event', 'Change', 'Action by'])
    const newest = within(card).getAllByRole('row')[1]
    expect(within(newest).getByText('Status changed')).toBeInTheDocument()
    expect(within(newest).getByText(DEMO_OPERATOR)).toBeInTheDocument()

    await user.click(within(card).getByRole('radio', { name: 'Edits' }))
    expect(await within(card).findByText('No edits yet')).toBeInTheDocument()
  })

  it('keeps the error in place when switching filters, with dashes instead of loading skeletons', async () => {
    const user = userEvent.setup()
    server.use(http.get('*/api/cylinders/:id/history', () => HttpResponse.json({ status: 404, title: 'Not found' }, { status: 404 })))
    renderWithApp(<CylinderDetailPage />, { route: '/cylinders/1', path: '/cylinders/:id' })

    const card = await screen.findByRole('region', { name: 'History' })
    expect(await within(card).findByRole('alert')).toBeInTheDocument()
    expect(card.querySelector('.skeleton')).toBeNull()

    await user.click(within(card).getByRole('radio', { name: 'Edits' }))
    expect(within(card).getByRole('alert')).toBeInTheDocument()
    expect(card.querySelector('.skeleton')).toBeNull()
  })
  it('names the customer next to the move, and fills in a return saved without one from the delivery it closes', async () => {
    const base = { cylinderId: 1, changes: [], actionBy: DEMO_OPERATOR, type: 'status' as const }
    const items = [
      { ...base, id: 3, at: '2026-10-23T10:00:00Z', fromStatus: 'Delivered', toStatus: 'Empty', customerName: null },
      { ...base, id: 2, at: '2026-10-22T10:00:00Z', fromStatus: 'Filled', toStatus: 'Delivered', customerName: 'PT Aneka Gas' },
    ]
    const summary = { trackedSince: '2026-10-22T10:00:00Z', deliveries: 1, customers: 1, lastEdited: null }
    server.use(http.get('*/api/cylinders/:id/history', () => HttpResponse.json({ items, page: 1, pageSize: 10, totalCount: 2, summary })))
    renderWithApp(<CylinderDetailPage />, { route: '/cylinders/1', path: '/cylinders/:id' })

    const card = await screen.findByRole('region', { name: 'History' })
    await within(card).findByText('Back from')
    const [, returned, delivered] = within(card).getAllByRole('row')
    expect(returned).toHaveTextContent('Back from PT Aneka Gas')
    expect(delivered).toHaveTextContent('To PT Aneka Gas')
  })
})
