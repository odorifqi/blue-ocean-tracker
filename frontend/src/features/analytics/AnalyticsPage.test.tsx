import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockSettings } from '../../mocks/settings'
import { renderWithApp } from '../../test/render'
import { AnalyticsPage } from './AnalyticsPage'

describe('Analytics page', () => {
  it('shows key figures and breakdowns from the API', async () => {
    renderWithApp(<AnalyticsPage />, { route: '/analytics', path: '/analytics' })

    const figures = await screen.findByRole('region', { name: 'Key figures' })
    expect(within(figures).getByText('85')).toBeInTheDocument() // 87 minus 2 retired

    const fleet = screen.getByRole('region', { name: 'Fleet by status' })
    expect(within(fleet).getAllByRole('link')).toHaveLength(5)
    expect(within(fleet).getByRole('link', { name: 'Delivered: 32, 37%' })).toHaveAttribute('href', '/?status=Delivered')

    const byGas = screen.getByRole('list', { name: 'Cylinders by gas type' })
    expect(within(byGas).getAllByRole('group')[0]).toHaveAccessibleName('Acetylene: 20, 23%') // largest first

    expect(screen.getByRole('table', { name: /per gas type and status/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Customers holding the most cylinders' })).toBeInTheDocument()
  })

  it('shows an error state with a retry when the API fails', async () => {
    mockSettings.set({ failure: 'always' })
    renderWithApp(<AnalyticsPage />, { route: '/analytics', path: '/analytics' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
