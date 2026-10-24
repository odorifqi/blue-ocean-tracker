import { ArrowLeft, Copy, PencilLine, SearchX } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, Skeleton, StatusBadge, useToast } from '../../ds'
import { ApiError } from '../../lib/api'
import { PRIMARY_NEXT, STATUS_ACTION, STATUS_DESCRIPTION, STATUS_LABEL, TRANSITIONS, type CylinderStatus } from '../../lib/domain'
import { GAS_META } from '../../lib/gas'
import { absoluteTime, relativeTime, utcTime } from '../../lib/format'
import { useCylinder } from '../../lib/queries'
import { GasSwatch, IdleBadge } from './bits'
import { HistoryCard } from './HistoryCard'
import { CylinderFormDialog } from './CylinderFormDialog'
import { LifecycleDiagram, LifecycleLegend } from './LifecycleDiagram'
import { SlowNotice } from './SlowNotice'
import { StatusChangeDialog } from './StatusChangeDialog'
import { useDocumentTitle } from '../../lib/hooks'

export function CylinderDetailPage() {
  const id = Number(useParams().id)
  const query = useCylinder(id)
  useDocumentTitle(query.data?.serialNumber ?? 'Cylinder')
  const [editing, setEditing] = useState(false)
  const [statusTarget, setStatusTarget] = useState<CylinderStatus | undefined>()
  const toast = useToast()

  const back = (
    <Link to=".." relative="path" className="back-link enter" onClick={(e) => { if (window.history.length > 1) { e.preventDefault(); history.back() } }}>
      <ArrowLeft size={16} /> All cylinders
    </Link>
  )

  if (query.isLoading) {
    return (
      <div className="page" aria-busy>
        {back}
        <SlowNotice loading />
        <div className="detail-head">
          <div className="detail-head__main">
            <Skeleton width={220} height={32} />
            <Skeleton width={120} height={22} radius={99} />
          </div>
        </div>
        <div className="detail-grid">
          <div className="card detail-card"><Skeleton width="100%" height={200} /></div>
          <div className="card detail-card"><Skeleton width="100%" height={200} /></div>
        </div>
      </div>
    )
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <div className="page">
        {back}
        <div className="card">
          {notFound || !Number.isFinite(id) ? (
            <EmptyState
              icon={<SearchX size={22} />}
              title="Cylinder not found"
              description="It may have been removed, or the link is wrong."
              action={<Link to="/"><Button>Back to the list</Button></Link>}
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
          )}
        </div>
      </div>
    )
  }

  const c = query.data!
  const next = TRANSITIONS[c.status]
  const primary = PRIMARY_NEXT[c.status]
  // Usual move first, Retire always last and set apart.
  const moves = next.filter((s) => s !== 'Retired').sort((a, b) => Number(b === primary) - Number(a === primary))

  return (
    <div className="page">
      {back}
      <header className="detail-head enter">
        <div className="detail-head__main">
          <h1 className="detail-head__serial mono">
            {c.serialNumber}
            <button
              className="copy-btn"
              aria-label="Copy serial number"
              title="Copy serial number"
              onClick={() => navigator.clipboard?.writeText(c.serialNumber).then(() => toast.success('Copied', c.serialNumber))}
            >
              <Copy size={16} />
            </button>
          </h1>
          <div className="detail-head__meta">
            <StatusBadge status={c.status} />
            <span className="detail-head__sep" aria-hidden />
            <span>Updated {relativeTime(c.lastUpdated)}</span>
            <IdleBadge cylinder={c} />
          </div>
        </div>
      </header>

      <div className="detail-grid enter" style={{ '--i': 1 } as CSSProperties}>
        <section className="card detail-card" aria-labelledby="details-h">
          {/* Editing sits with the fields it changes, not in the page header. */}
          <div className="card__head card__head--row">
            <h2 id="details-h" className="card__title">Details</h2>
            <Button size="sm" icon={<PencilLine size={15} />} onClick={() => setEditing(true)}>Edit details</Button>
          </div>
          <dl className="props">
            <div><dt>Record ID</dt><dd className="mono">#{c.id}</dd></div>
            <div><dt>Serial number</dt><dd className="mono">{c.serialNumber}</dd></div>
            <div><dt>Gas type</dt><dd><GasSwatch gas={c.gasType} /></dd></div>
            <div><dt>Chemical formula</dt><dd>{GAS_META[c.gasType]?.formula ?? '—'}</dd></div>
            <div><dt>Customer</dt><dd className="break">{c.customerName ?? <span className="muted">—</span>}</dd></div>
            <div>
              <dt>Last updated</dt>
              <dd><time dateTime={c.lastUpdated} title={`Stored as ${utcTime(c.lastUpdated)}`}>{absoluteTime(c.lastUpdated)}</time></dd>
            </div>
          </dl>
        </section>

        <section className="card detail-card" aria-labelledby="lifecycle-h">
          <div className="card__head">
            <h2 id="lifecycle-h" className="card__title">Lifecycle</h2>
            <p className="card__hint">Now <strong>{STATUS_LABEL[c.status]}</strong>. {STATUS_DESCRIPTION[c.status]}</p>
          </div>
          <LifecycleDiagram current={c.status} onSelect={(s) => setStatusTarget(s)} />
          <LifecycleLegend current={c.status} />
          <div className="detail-actions" role="group" aria-label="Change status">
            <span className="detail-actions__label">Move to</span>
            {next.length === 0 && <span className="muted">None. Retired is final.</span>}
            {moves.map((s) => (
              <Button key={s} size="sm" variant={s === primary ? 'primary' : 'secondary'} onClick={() => setStatusTarget(s)}>
                {STATUS_ACTION[s]}
              </Button>
            ))}
            {c.status !== 'Retired' && (
              <Button
                size="sm"
                className="detail-actions__retire"
                disabled={!next.includes('Retired')}
                title={next.includes('Retired') ? undefined : 'Mark it returned empty first'}
                onClick={() => setStatusTarget('Retired')}
              >
                {STATUS_ACTION.Retired}…
              </Button>
            )}
          </div>
        </section>
      </div>

      <div className="enter" style={{ '--i': 2 } as CSSProperties}>
        <HistoryCard cylinderId={c.id} />
      </div>

      <CylinderFormDialog open={editing} cylinder={c} onClose={() => setEditing(false)} />
      <StatusChangeDialog
        open={Boolean(statusTarget)}
        cylinder={c}
        initialStatus={statusTarget}
        onClose={() => setStatusTarget(undefined)}
      />
    </div>
  )
}
