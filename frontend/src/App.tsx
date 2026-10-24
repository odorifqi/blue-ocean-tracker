import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { DocsLayout } from './app/DocsLayout'
import { AnalyticsPage } from './features/analytics/AnalyticsPage'
import { Layout } from './app/Layout'
import { ToastProvider } from './ds'
import { CylinderDetailPage } from './features/cylinders/CylinderDetailPage'
import { CylindersPage } from './features/cylinders/CylindersPage'
import { ServerErrorProvider } from './features/cylinders/ServerError'
import { StatusRulesPage } from './features/rules/StatusRulesPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RouteError } from './pages/RouteError'
import { StyleGuidePage } from './pages/StyleGuidePage'
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
  // Created once: a router rebuilt on a re-render would remount the whole tree.
  const [router] = useState(() => createBrowserRouter(
    [
      {
        element: <Layout mock={mock} />,
        // The error page sits inside the layout, so a page that throws keeps the sidebar working.
        children: [
          {
            errorElement: <RouteError />,
            children: [
              { path: '/', element: <CylindersPage /> },
              { path: '/cylinders/:id', element: <CylinderDetailPage /> },
              { path: '/analytics', element: <AnalyticsPage /> },
              { path: '/status-rules', element: <StatusRulesPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      {
        element: <DocsLayout />,
        children: [{ errorElement: <RouteError />, children: [{ path: '/design-system', element: <StyleGuidePage /> }] }],
      },
    ],
    { basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/', future: { v7_relativeSplatPath: true } },
  ))

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
