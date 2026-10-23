import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AnalyticsPage } from './features/analytics/AnalyticsPage'
import { Layout } from './app/Layout'
import { ToastProvider } from './ds'
import { CylinderDetailPage } from './features/cylinders/CylinderDetailPage'
import { CylindersPage } from './features/cylinders/CylindersPage'
import { ServerErrorProvider } from './features/cylinders/ServerError'
import { StatusRulesPage } from './features/rules/StatusRulesPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ApiError } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      // Client errors (400/404) won't fix themselves; retry only network and 5xx, once.
      retry: (count, err) => count < 1 && (!(err instanceof ApiError) || err.status === 0 || err.status >= 500),
    },
  },
})

export function App({ mock }: { mock: boolean }) {
  const router = createBrowserRouter(
    [
      {
        element: <Layout mock={mock} />,
        children: [
          { path: '/', element: <CylindersPage /> },
          { path: '/cylinders/:id', element: <CylinderDetailPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/status-rules', element: <StatusRulesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
    { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/', future: { v7_relativeSplatPath: true } },
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ServerErrorProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </ServerErrorProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
