import clsx from 'clsx'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useReveal } from '../lib/useReveal'

/*
 * Chart primitives. Plain HTML/CSS, no chart library: the shapes we need are bars,
 * columns and a heat table, and HTML keeps them themeable, responsive and readable
 * by screen readers. Every value is printed next to its mark, so hover only adds detail.
 */

const nf = new Intl.NumberFormat('en-US')
export const formatCount = (n: number) => nf.format(n)
export const formatPct = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 0}%`

/* ---------- Card ---------- */

export function ChartCard({ title, subtitle, action, footer, className, reveal, children }: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  footer?: ReactNode
  className?: string
  /** Reveal once on scroll and grow the bars from zero. For long pages like Analytics. */
  reveal?: boolean
  children: ReactNode
}) {
  const id = useId()
  const ref = useReveal<HTMLElement>(reveal)
  return (
    <section ref={ref} className={clsx('card chart-card', className)} aria-labelledby={id}>
      <header className="chart-card__head">
        <div>
          <h2 className="chart-card__title" id={id}>{title}</h2>
          {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="chart-card__body">{children}</div>
      {footer && <footer className="chart-card__foot">{footer}</footer>}
    </section>
  )
}

/* ---------- Stat tile + meter ---------- */

export function StatTile({ label, value, meta, icon, tone = 'default', meter, to }: {
  label: string
  value: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'warning'
  /** 0–1. Renders a meter under the value. */
  meter?: number
  to?: string
}) {
  const body = (
    <>
      <span className="stat-tile__label">{icon}{label}</span>
      <span className="stat-tile__value">{value}</span>
      {meter !== undefined && <Meter value={meter} label={label} tone={tone} />}
      {meta && <span className="stat-tile__meta">{meta}</span>}
    </>
  )
  const cls = clsx('stat-tile', `stat-tile--${tone}`, to && 'stat-tile--link')
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function Meter({ value, label, tone = 'default' }: { value: number; label: string; tone?: 'default' | 'warning' }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className={clsx('meter', `meter--${tone}`)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <span className="meter__fill" style={{ width: `${v * 100}%` }} />
    </span>
  )
}

/* ---------- Bar list (horizontal bars, one row per category) ---------- */

export interface BarItem {
  key: string
  label: ReactNode
  /** Plain-text label, used for the accessible name when `label` is rich. */
  text: string
  value: number
  /** Optional mark colour (a CSS colour or var). Defaults to the single-series colour. */
  color?: string
  /** Secondary value printed after the main one, e.g. a share. */
  note?: ReactNode
  to?: string
}

export function BarList({ items, max, total, ariaLabel, noteWidth }: {
  items: BarItem[]
  /** Scale maximum. Defaults to the largest value. */
  max?: number
  /** When set, each row shows its share of this total. */
  total?: number
  ariaLabel: string
  /** Width of the trailing note column, when notes are longer than a percentage. */
  noteWidth?: string
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className={clsx('bar-list', noteWidth && 'bar-list--note')} aria-label={ariaLabel} style={noteWidth ? ({ '--note-w': noteWidth } as CSSProperties) : undefined}>
      {items.map((i) => {
        const share = total !== undefined ? formatPct(i.value, total) : undefined
        const row = (
          <>
            <span className="bar-list__label">{i.label}</span>
            <span className="bar-list__track" aria-hidden>
              <span className="bar-list__bar" style={{ width: `${(i.value / top) * 100}%`, '--bar': i.color } as CSSProperties} />
            </span>
            <span className="bar-list__value tabular">{formatCount(i.value)}</span>
            <span className="bar-list__note tabular">{i.note ?? share}</span>
          </>
        )
        const name = `${i.text}: ${formatCount(i.value)}${share ? `, ${share}` : ''}`
        return (
          <li key={i.key} className="bar-list__item">
            {i.to ? (
              <Link to={i.to} className="bar-list__row bar-list__row--link" aria-label={name}>{row}</Link>
            ) : (
              <div className="bar-list__row" aria-label={name} role="group">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Column chart (ordered categories, e.g. age buckets) ---------- */

export interface ColumnItem {
  key: string
  label: string
  value: number
  /** Emphasised columns use the accent; the rest recede. */
  emphasis?: boolean
  detail?: string
}

export function ColumnChart({ items, ariaLabel, height = 168, legend }: {
  items: ColumnItem[]
  ariaLabel: string
  height?: number
  legend?: ReactNode
}) {
  const [active, setActive] = useState<string>()
  const top = niceMax(Math.max(1, ...items.map((i) => i.value)))
  const ticks = [0, top / 2, top]
  const total = items.reduce((s, i) => s + i.value, 0)
  return (
    <figure className="columns" style={{ '--plot-h': `${height}px` } as CSSProperties}>
      <div className="columns__plot" role="list" aria-label={ariaLabel}>
        <div className="columns__grid" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="columns__tick" style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="columns__tick-label tabular">{formatCount(t)}</span>
            </span>
          ))}
        </div>
        {items.map((i) => (
          <div
            key={i.key}
            role="listitem"
            tabIndex={0}
            className={clsx('columns__col', i.emphasis && 'is-emphasis', active === i.key && 'is-active')}
            aria-label={`${i.label}: ${formatCount(i.value)} (${formatPct(i.value, total)})${i.detail ? `. ${i.detail}` : ''}`}
            onPointerEnter={() => setActive(i.key)}
            onPointerLeave={() => setActive(undefined)}
            onFocus={() => setActive(i.key)}
            onBlur={() => setActive(undefined)}
          >
            <span className="columns__bar" style={{ height: `${(i.value / top) * 100}%` }}>
              <span className="columns__value tabular" aria-hidden>{formatCount(i.value)}</span>
            </span>
            {active === i.key && (
              <span className="chart-tip" role="presentation">
                <strong>{i.label}</strong>
                <span className="tabular">{formatCount(i.value)} cylinders · {formatPct(i.value, total)}</span>
                {i.detail && <span className="chart-tip__muted">{i.detail}</span>}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="columns__axis" aria-hidden>
        {items.map((i) => <span key={i.key}>{i.label}</span>)}
      </div>
      {legend && <figcaption className="chart-legend">{legend}</figcaption>}
    </figure>
  )
}

function niceMax(n: number) {
  const step = 10 ** Math.floor(Math.log10(n))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= n) return m * step
  return 10 * step
}

/* ---------- Heat table (two dimensions, sequential shading) ---------- */

export function HeatTable<R extends string, C extends string>({ caption, rows, cols, value, rowHeader, colHeader, rowTotal, extra }: {
  caption: string
  rows: readonly R[]
  cols: readonly C[]
  value: (row: R, col: C) => number
  rowHeader?: (row: R) => ReactNode
  colHeader?: (col: C) => ReactNode
  rowTotal?: (row: R) => number
  /** An extra trailing column, e.g. a ratio. */
  extra?: { header: ReactNode; cell: (row: R) => ReactNode }
}) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))))
  return (
    <div className="heat-wrap">
      <table className="heat">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {cols.map((c) => <th key={c} scope="col">{colHeader ? colHeader(c) : c}</th>)}
            {rowTotal && <th scope="col" className="heat__total">Total</th>}
            {extra && <th scope="col" className="heat__total">{extra.header}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row">{rowHeader ? rowHeader(r) : r}</th>
              {cols.map((c) => {
                const v = value(r, c)
                const t = v / max
                return (
                  <td key={c}>
                    <span className={clsx('heat__cell tabular', v === 0 && 'is-zero', t > 0.55 && 'is-strong')} style={{ '--t': t } as CSSProperties}>
                      {v === 0 ? '–' : formatCount(v)}
                    </span>
                  </td>
                )
              })}
              {rowTotal && <td className="heat__total tabular">{formatCount(rowTotal(r))}</td>}
              {extra && <td className="heat__total tabular">{extra.cell(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A legend for the heat table's sequential scale. */
export function HeatScale({ min = 'Fewer', max = 'More' }: { min?: string; max?: string }) {
  return (
    <span className="heat-scale">
      <span>{min}</span>
      <span className="heat-scale__ramp" aria-hidden>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => <span key={t} style={{ '--t': t } as CSSProperties} />)}
      </span>
      <span>{max}</span>
    </span>
  )
}

/** A colour key for legends. */
export function LegendKey({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="legend-key">
      <span className="legend-key__swatch" style={{ background: color }} aria-hidden />
      {children}
    </span>
  )
}
