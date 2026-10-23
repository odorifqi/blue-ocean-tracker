import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
