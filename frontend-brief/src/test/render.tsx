import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../ds'
import { ServerErrorProvider } from '../features/cylinders/ServerError'

export function renderWithApp(ui: ReactNode, { route = '/', path = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ServerErrorProvider>
          <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path={path} element={ui} />
              <Route path="*" element={<div>other page</div>} />
            </Routes>
          </MemoryRouter>
        </ServerErrorProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
}
