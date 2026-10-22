import clsx from 'clsx'
import type { ReactNode } from 'react'
import { STATUS_LABEL, type CylinderStatus } from '../lib/domain'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={clsx('badge', `badge--${tone}`)}>
      {icon}
      {children}
    </span>
  )
}

export const statusKey = (s: CylinderStatus) => (s === 'InMaintenance' ? 'maintenance' : s.toLowerCase())

export function StatusBadge({ status, size = 'md' }: { status: CylinderStatus; size?: 'sm' | 'md' }) {
  return (
    <span className={clsx('status', `status--${statusKey(status)}`, `status--${size}`)}>
      <span className="status__dot" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  )
}
