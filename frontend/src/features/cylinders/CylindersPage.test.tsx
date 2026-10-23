import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockSettings } from '../../mocks/settings'
import { renderWithApp } from '../../test/render'
import { CylindersPage } from './CylindersPage'

const rows = () => screen.getAllByRole('row').slice(1) // minus header

describe('Cylinders list page', () => {
  it('loads the first page from the API and paginates', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)

    await waitFor(() => expect(rows()).toHaveLength(10))
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1–10 of 87')

    await user.click(screen.getByRole('button', { name: 'Page 9' }))
    await waitFor(() => expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 81–87 of 87'))
    expect(rows()).toHaveLength(7)
  })

  it('searches by customer name with apostrophes and shows an empty state when nothing matches', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    await user.type(screen.getByRole('searchbox'), "o'brien")
    await waitFor(() => expect(rows()).toHaveLength(3))
    rows().forEach((r) => expect(within(r).getByText(/O'Brien/i, { selector: 'mark' })).toBeInTheDocument())

    await user.clear(screen.getByRole('searchbox'))
    await user.type(screen.getByRole('searchbox'), 'CYL-000000')
    expect(await screen.findByText('No cylinders match')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(rows()).toHaveLength(10))
  })

  it('gives every row Edit details, Change status and Detail, with Detail as the emphasised link', async () => {
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    const row = rows()[0]
    const serial = row.querySelector('.serial')!.textContent!
    const actions = row.querySelector('.table__actions') as HTMLElement
    expect(Array.from(actions.querySelectorAll('button, a')).map((el) => [el.textContent, el.getAttribute('aria-label')])).toEqual([
      ['Edit details', `Edit details for ${serial}`],
      ['Change status', `Change status for ${serial}`],
      ['Detail', `Detail for ${serial}`],
    ])
    const detail = within(actions).getByRole('link', { name: `Detail for ${serial}` })
    expect(detail).toHaveClass('btn--soft')
    // Edit details and Change status share one quiet style.
    actions.querySelectorAll('button').forEach((b) => expect(b).toHaveClass('btn--ghost'))
    expect(detail.getAttribute('href')).toMatch(/^\/cylinders\/\d+$/)
  })

  it('opens the detail page only from the Detail button, never from the row', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    const row = rows()[0]
    // Detail is the row's only link; the serial is plain text.
    expect(within(row).getAllByRole('link')).toHaveLength(1)
    await user.click(row.querySelector('td[data-label="Customer"]')!)
    await user.click(row.querySelector('.serial')!)
    expect(screen.queryByText('other page')).not.toBeInTheDocument()

    await user.click(within(row).getByRole('link', { name: /^Detail for / }))
    expect(await screen.findByText('other page')).toBeInTheDocument()
  })

  it('puts all three actions behind the ⋯ menu for phones, Detail first, with the Retired reason shown', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    const row = rows()[0]
    const serial = row.querySelector('.serial')!.textContent!
    const trigger = within(row).getByRole('button', { name: `Actions for ${serial}` })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu', { name: `Actions for ${serial}` })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Detail', 'Edit details', 'Change status'])
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(within(screen.getByRole('menu', { name: `Actions for ${serial}` })).getByRole('menuitem', { name: 'Detail' }))
    expect(await screen.findByText('other page')).toBeInTheDocument()
  })

  it('disables Change status in the menu of a Retired cylinder and says why', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))
    await user.click(screen.getByRole('radio', { name: /Retired/ }))
    await waitFor(() => expect(rows()).toHaveLength(2))

    const row = rows()[0]
    await user.click(within(row).getByRole('button', { name: /^Actions for / }))
    const item = screen.getByRole('menuitem', { name: /Change status/ })
    expect(item).toBeDisabled()
    expect(item).toHaveTextContent('Retired is final')
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    await user.click(screen.getByRole('radio', { name: /Retired/ }))
    await waitFor(() => expect(rows()).toHaveLength(2))
    rows().forEach((r) => expect(within(r).getByText('Retired')).toBeInTheDocument())
  })

  it('shows an error state and recovers on retry', async () => {
    const user = userEvent.setup()
    mockSettings.set({ failure: 'always' })
    renderWithApp(<CylindersPage />)

    expect(await screen.findByText('Server error')).toBeInTheDocument()
    mockSettings.set({ failure: 'none' })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rows()).toHaveLength(10))
  })

  it('has no status tiles; overdue returns show as a banner that applies the Delivered filter', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    expect(screen.queryByRole('region', { name: 'Fleet overview' })).not.toBeInTheDocument()
    const banner = await screen.findByText(/come back in 30\+ days/)
    await user.click(within(banner.closest('.idle-banner') as HTMLElement).getByRole('button', { name: /View them/ }))
    await waitFor(() => expect(screen.getByRole('radio', { name: /Delivered/ })).toBeChecked())
    rows().forEach((r) => expect(r).toHaveTextContent('Delivered'))
  })

  it('keeps the list frame fixed: scrollable results region, scroll reset on page change, pagination with 0 results', async () => {
    const user = userEvent.setup()
    renderWithApp(<CylindersPage />)
    await waitFor(() => expect(rows()).toHaveLength(10))

    const results = screen.getByRole('region', { name: 'Cylinder results' })
    expect(results).toHaveAttribute('tabindex', '0')
    results.scrollTop = 200
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    await waitFor(() => expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 11–20 of 87'))
    expect(results.scrollTop).toBe(0)

    await user.type(screen.getByRole('searchbox'), 'CYL-000000')
    expect(await screen.findByText('No cylinders match')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText('No results')).toBeInTheDocument()
  })
})
