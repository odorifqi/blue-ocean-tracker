import clsx from 'clsx'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from 'react'

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

interface Timer {
  handle?: ReturnType<typeof setTimeout>
  remaining: number
  startedAt: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  // Each toast's time left. The whole stack pauses while it's hovered or focused, so a toast
  // can't vanish while someone is reading it or reaching for its dismiss button.
  const timers = useRef(new Map<number, Timer>())
  const paused = useRef(false)
  // Phones show only the newest toast with the older ones peeking behind it; a tap fans the stack out.
  const [expanded, setExpanded] = useState(false)
  const toasterRef = useRef<HTMLDivElement>(null)

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)?.handle)
    timers.current.delete(id)
    setItems((xs) => xs.filter((x) => x.id !== id))
  }, [])

  const run = useCallback(
    (id: number, timer: Timer) => {
      timer.startedAt = Date.now()
      timer.handle = setTimeout(() => dismiss(id), timer.remaining)
    },
    [dismiss],
  )

  const show = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = nextId.current++
      setItems((xs) => {
        // The stack keeps the newest four; drop the timers of any pushed out.
        xs.slice(0, -3).forEach((x) => {
          clearTimeout(timers.current.get(x.id)?.handle)
          timers.current.delete(x.id)
        })
        return [...xs.slice(-3), { ...t, id }]
      })
      const timer: Timer = { remaining: t.tone === 'error' || t.tone === 'warning' ? 7000 : 4500, startedAt: 0 }
      timers.current.set(id, timer)
      if (!paused.current) run(id, timer)
    },
    [run],
  )

  const pause = useCallback(() => {
    if (paused.current) return
    paused.current = true
    timers.current.forEach((timer) => {
      clearTimeout(timer.handle)
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt))
    })
  }, [])

  const resume = useCallback(() => {
    if (!paused.current) return
    paused.current = false
    timers.current.forEach((timer, id) => run(id, timer))
  }, [run])

  // Focus leaving the stack entirely resumes it; moving between two toasts doesn't.
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume()
  }

  // Touch has no hover: a touch pauses the stack until the next touch lands outside it.
  const onTouchStart = () => {
    if (paused.current) return
    pause()
    const outside = (e: Event) => {
      if (toasterRef.current?.contains(e.target as Node)) return
      document.removeEventListener('pointerdown', outside, true)
      resume()
    }
    document.addEventListener('pointerdown', outside, true)
  }

  // Once the stack is down to one toast, the next stack starts collapsed again.
  if (expanded && items.length < 2) setExpanded(false)

  useEffect(() => {
    const all = timers.current
    return () => all.forEach((timer) => clearTimeout(timer.handle))
  }, [])

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
      <div
        ref={toasterRef}
        className={clsx('toaster', expanded && 'is-expanded')}
        aria-live="polite"
        aria-relevant="additions"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocus={pause}
        onBlur={onBlur}
        onTouchStart={onTouchStart}
        onClick={(e) => items.length > 1 && !(e.target as Element).closest('button') && setExpanded(true)}
      >
        {items.map((t, i) => (
          <ToastCard
            key={t.id}
            tone={t.tone}
            title={t.title}
            description={t.description}
            onDismiss={() => dismiss(t.id)}
            depth={items.length - 1 - i}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** One toast. Rendered by the provider; exported so the style guide can show every tone at rest. */
export function ToastCard({
  tone,
  title,
  description,
  onDismiss,
  depth = 0,
}: {
  tone: ToastTone
  title: string
  description?: string
  onDismiss?: () => void
  /** 0 for the newest toast, 1 for the one behind it, and so on. Drives the phone stack. */
  depth?: number
}) {
  const Icon = ICONS[tone]
  // On phones the stack hangs from the top bar, so a swipe up puts a toast away.
  const startY = useRef<number | null>(null)
  const onPointerDown = (e: PointerEvent) => {
    startY.current = e.pointerType === 'touch' ? e.clientY : null
  }
  const onPointerUp = (e: PointerEvent) => {
    if (onDismiss && startY.current !== null && startY.current - e.clientY > 32) onDismiss()
    startY.current = null
  }
  return (
    <div
      className={clsx('toast', `toast--${tone}`, depth > 0 && 'is-behind')}
      style={depth > 0 ? ({ '--depth': depth } as CSSProperties) : undefined}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
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
