import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RouteError } from './RouteError'

function Boom(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'map')")
}

describe('Route error page', () => {
  it('replaces a page that throws, and clears when you navigate away', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter(
      [{ errorElement: <RouteError />, children: [{ path: '/', element: <div>cylinder list</div> }, { path: '/status-rules', element: <Boom /> }] }],
      { initialEntries: ['/status-rules'] },
    )
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { name: 'This page couldn’t be shown' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Go to cylinders' }))
    expect(await screen.findByText('cylinder list')).toBeInTheDocument()
  })
})
