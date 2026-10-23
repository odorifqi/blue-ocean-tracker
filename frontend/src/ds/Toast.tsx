import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'
interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

interface ToastApi {
  show: (t: Omit<ToastItem, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = nextId.current++
      setItems((xs) => [...xs.slice(-3), { ...t, id }])
      setTimeout(() => dismiss(id), t.tone === 'error' || t.tone === 'warning' ? 7000 : 4500)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ tone: 'success', title, description }),
      error: (title, description) => show({ tone: 'error', title, description }),
      warning: (title, description) => show({ tone: 'warning', title, description }),
      info: (title, description) => show({ tone: 'info', title, description }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toaster" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <ToastCard key={t.id} tone={t.tone} title={t.title} description={t.description} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** One toast. Rendered by the provider; exported so the style guide can show every tone at rest. */
export function ToastCard({ tone, title, description, onDismiss }: { tone: ToastTone; title: string; description?: string; onDismiss?: () => void }) {
  const Icon = ICONS[tone]
  return (
    <div className={clsx('toast', `toast--${tone}`)} role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}>
      <Icon size={20} className="toast__icon" aria-hidden />
      <div className="toast__text">
        <p className="toast__title">{title}</p>
        {description && <p className="toast__desc">{description}</p>}
      </div>
      {onDismiss && (
        <button className="toast__close" onClick={onDismiss} aria-label="Dismiss notification">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
