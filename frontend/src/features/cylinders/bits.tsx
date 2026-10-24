import clsx from 'clsx'
import { Clock } from 'lucide-react'
import { Fragment } from 'react'
import { Badge } from '../../ds'
import { daysSince, isIdle, type GasType } from '../../lib/domain'
import { GAS_META } from '../../lib/gas'
import type { Cylinder } from '../../lib/api'

/** Gas colour as an upright bar. `sm` sits inline with text; `lg` is for pickers and the design system page. */
export function GasSwatch({ gas, showLabel = true, size = 'sm' }: { gas: GasType; showLabel?: boolean; size?: 'sm' | 'lg' }) {
  const meta = GAS_META[gas]
  return (
    <span className="gas">
      <span className={clsx('gas__swatch', size === 'lg' && 'gas__swatch--lg')} style={{ background: meta?.color }} aria-hidden />
      {showLabel && <span className="gas__label">{gas}</span>}
    </span>
  )
}

/** Highlights case-insensitive matches of `query` inside `text`. */
export function Highlight({ text, query }: { text: string; query?: string }) {
  const q = query?.trim()
  if (!q) return <>{text}</>
  const upper = text.toUpperCase()
  const needle = q.toUpperCase()
  const parts: { s: string; hit: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const at = upper.indexOf(needle, i)
    if (at === -1) {
      parts.push({ s: text.slice(i), hit: false })
      break
    }
    if (at > i) parts.push({ s: text.slice(i, at), hit: false })
    parts.push({ s: text.slice(at, at + needle.length), hit: true })
    i = at + needle.length
  }
  return (
    <>
      {parts.map((p, k) => (p.hit ? <mark key={k} className="hl">{p.s}</mark> : <Fragment key={k}>{p.s}</Fragment>))}
    </>
  )
}

export function IdleBadge({ cylinder }: { cylinder: Pick<Cylinder, 'status' | 'lastUpdated'> }) {
  if (!isIdle(cylinder)) return null
  const d = daysSince(cylinder.lastUpdated)
  return (
    <span title={`Delivered ${d} days ago and not returned yet`}>
      <Badge tone="warning" icon={<Clock size={12} />}>
        <span aria-hidden>Out {d}d</span>
        {/* The tooltip never shows on touch screens, so the explanation is also in the text. */}
        <span className="sr-only">Delivered {d} days ago and not returned yet</span>
      </Badge>
    </span>
  )
}
