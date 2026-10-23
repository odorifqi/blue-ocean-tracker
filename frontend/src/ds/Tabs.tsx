import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface FilterOption<T extends string> {
  value: T
  label: string
  count?: number
  icon?: ReactNode
}

/** Single-select filter rendered as a row of pills (radio-group semantics). */
export function FilterPills<T extends string>({ options, value, onChange, label }: { options: FilterOption<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pills" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={clsx('pill', o.value === value && 'is-active')}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
          {o.count !== undefined && <span className="pill__count tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
