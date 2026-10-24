import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/setup'
import { renderWithApp } from '../../test/render'
import { StatusRulesPage } from './StatusRulesPage'

describe('Status rules page', () => {
  it('lists only the allowed next statuses from the server rules', async () => {
    renderWithApp(<StatusRulesPage />)
    const filled = await screen.findByRole('list', { name: 'Filled can move to' })
    const next = within(filled).getAllByRole('listitem').map((li) => li.textContent)
    expect(next).toEqual(['Delivered', 'In maintenance', 'Retired'])
    expect(screen.getByText('None. Retired is final.')).toBeInTheDocument()
    expect(screen.getByText(/ready to be filled or inspected\. New cylinders start here\./)).toBeInTheDocument()
    expect(screen.queryByText('Allowed moves')).not.toBeInTheDocument()
  })

  it('shows a retryable error, not a crash, when meta comes back without the rules', async () => {
    server.use(http.get('*/api/meta', () => HttpResponse.json({ gasTypes: [], statuses: [], transitions: {} })))
    renderWithApp(<StatusRulesPage />)
    expect(await screen.findByRole('heading', { name: 'Unexpected response' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('treats an HTML page answered with 200 as an error, not as data', async () => {
    server.use(http.get('*/api/meta', () => HttpResponse.html('<!doctype html><div id="root"></div>')))
    renderWithApp(<StatusRulesPage />)
    expect(await screen.findByRole('heading', { name: 'Unexpected response' })).toBeInTheDocument()
  })
})
