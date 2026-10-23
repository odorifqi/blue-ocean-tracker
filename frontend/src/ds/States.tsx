import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import { CloudOff, RotateCcw, SearchX, ServerCrash } from 'lucide-react'
import { Button } from './Button'
import type { ApiError } from '../lib/api'

export function Skeleton({ width, height = 14, radius, className, style }: { width?: number | string; height?: number | string; radius?: number; className?: string; style?: CSSProperties }) {
  return <span className={clsx('skeleton', className)} style={{ width, height, borderRadius: radius, ...style }} aria-hidden />
}

export function EmptyState({ icon = <SearchX size={22} />, title, description, action, compact }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={clsx('state', compact && 'state--compact')}>
      <div className="state__icon">{icon}</div>
      <h3 className="state__title">{title}</h3>
      {description && <p className="state__desc">{description}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, retrying, compact }: { error: unknown; onRetry?: () => void; retrying?: boolean; compact?: boolean }) {
  const e = error as Partial<ApiError> | undefined
  const network = e?.status === 0
  return (
    <div className={clsx('state state--error', compact && 'state--compact')} role="alert">
      <div className="state__icon">{network ? <CloudOff size={22} /> : <ServerCrash size={22} />}</div>
      <h3 className="state__title">{network ? 'Can’t reach the server' : (e?.title ?? 'Something went wrong')}</h3>
      <p className="state__desc">
        {e?.detail ?? (e as Error | undefined)?.message ?? 'The data couldn’t be loaded.'}
        {e?.status ? <span className="state__code"> · HTTP {e.status}</span> : null}
      </p>
      {onRetry && (
        <div className="state__action">
          <Button icon={<RotateCcw size={16} />} onClick={onRetry} loading={retrying}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
