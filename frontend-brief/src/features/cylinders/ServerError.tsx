import { TriangleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Button, Dialog } from '../../ds'
import { ApiError } from '../../lib/api'

const LABELS: Record<string, string> = {
  serialNumber: 'Serial number',
  gasType: 'Gas type',
  status: 'Status',
  customerName: 'Customer name',
  page: 'Page',
  pageSize: 'Page size',
}

interface Ctx {
  show: (error: unknown, context?: string) => void
}
const ServerErrorContext = createContext<Ctx | null>(null)

/**
 * Pop-up that explains what the server rejected and why. Used for every
 * failed write, so validation messages from the API always reach the user
 * even when they don't map onto a visible field.
 */
export function ServerErrorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ error: ApiError; context?: string } | null>(null)

  const show = useCallback((error: unknown, context?: string) => {
    const e = error instanceof ApiError ? error : new ApiError(500, { detail: (error as Error)?.message })
    setState({ error: e, context })
  }, [])
  const value = useMemo(() => ({ show }), [show])
  const e = state?.error
  const fieldErrors = e ? Object.entries(e.errors) : []

  return (
    <ServerErrorContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => setState(null)}
        size="sm"
        tone={e && e.status >= 500 ? 'danger' : 'warning'}
        icon={<TriangleAlert size={20} />}
        title={e?.isNetwork ? 'Can’t reach the server' : (e?.title ?? 'Request failed')}
        description={state?.context}
        footer={<Button variant="primary" onClick={() => setState(null)} autoFocus>Got it</Button>}
      >
        {e && (
          <div className="server-error" role="alert">
            {e.detail && <p>{e.detail}</p>}
            {fieldErrors.length > 0 && (
              <ul className="server-error__list">
                {fieldErrors.map(([field, msgs]) => (
                  <li key={field}>
                    <strong>{LABELS[field] ?? field}</strong>
                    <span>{msgs.join(' ')}</span>
                  </li>
                ))}
              </ul>
            )}
            {!e.isNetwork && <p className="server-error__code">HTTP {e.status}</p>}
          </div>
        )}
      </Dialog>
    </ServerErrorContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServerError() {
  const ctx = useContext(ServerErrorContext)
  if (!ctx) throw new Error('useServerError must be used inside <ServerErrorProvider>')
  return ctx.show
}
