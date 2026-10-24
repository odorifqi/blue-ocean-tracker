import { ArrowLeftRight, CirclePlus, FileDown, History, PencilLine } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, EmptyState, ErrorState, FilterPills, Pagination, Skeleton, StatusBadge } from '../../ds'
import type { HistoryEvent, HistoryFilter, HistorySummary } from '../../lib/api'
import { dateTime, shortDate, utcTime } from '../../lib/format'
import { useHistory } from '../../lib/queries'

const PAGE_SIZE = 10
const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'status', label: 'Status changes' },
  { value: 'edit', label: 'Edits' },
]
const isFilter = (v: string | null): v is HistoryFilter => FILTERS.some((f) => f.value === v)

const EVENT: Record<HistoryEvent['type'], { label: string; icon: ReactNode }> = {
  status: { label: 'Status changed', icon: <ArrowLeftRight size={15} /> },
  edited: { label: 'Details edited', icon: <PencilLine size={15} /> },
  added: { label: 'Added', icon: <CirclePlus size={15} /> },
  imported: { label: 'Imported', icon: <FileDown size={15} /> },
}
const FIELD_LABEL = { serialNumber: 'Serial', gasType: 'Gas type' } as const

const dash = <span className="muted">—</span>

/**
 * Append-only record of everything that happened to one cylinder. Same five columns and
 * four summary slots for every cylinder and state; a dash fills anything that doesn't apply.
 * Filter and page live in the URL like the list's, so a link opens the same view.
 */
export function HistoryCard({ cylinderId }: { cylinderId: number }) {
  const [params, setParams] = useSearchParams()
  const type = isFilter(params.get('history')) ? (params.get('history') as HistoryFilter) : 'all'
  const page = Math.max(1, Number(params.get('historyPage')) || 1)
  const query = useHistory(cylinderId, { type, page, pageSize: PAGE_SIZE })
  const data = query.data
  // keepPreviousData holds the last page while a new filter loads, but not the last error.
  // Hold that too, so switching filters on a failing request doesn't flash skeletons in between.
  const [lastError, setLastError] = useState<unknown>(null)
  if (query.isError && lastError !== query.error) setLastError(query.error)
  else if (data && lastError) setLastError(null)
  const error = query.isError ? query.error : query.isFetching ? lastError : null

  const setView = (next: { type?: HistoryFilter; page?: number }) =>
    setParams(
      (p) => {
        const t = next.type ?? type
        const pg = next.page ?? 1
        if (t === 'all') p.delete('history')
        else p.set('history', t)
        if (pg === 1) p.delete('historyPage')
        else p.set('historyPage', String(pg))
        return p
      },
      { replace: true, preventScrollReset: true },
    )

  const cardRef = useRef<HTMLElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const items = data?.items ?? []
  const lastPage = data ? page * PAGE_SIZE >= data.totalCount : false
  const importedOnly = items.at(-1)?.type === 'imported' && lastPage && type === 'all'

  let body: ReactNode
  if (error && !data) {
    body = <ErrorState compact error={error} onRetry={() => query.refetch()} retrying={query.isFetching} />
  } else if (!data) {
    body = <HistoryTable>{Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)}</HistoryTable>
  } else if (data.totalCount === 0 && type !== 'all') {
    body = (
      <EmptyState
        compact
        icon={<History size={22} />}
        title={type === 'edit' ? 'No edits yet' : 'No status changes yet'}
        description={
          type === 'edit'
            ? 'The serial number and gas type haven’t been changed since tracking started.'
            : 'This cylinder hasn’t moved since tracking started.'
        }
        action={<Button size="sm" onClick={() => setView({ type: 'all' })}>Show all events</Button>}
      />
    )
  } else if (items.length === 0) {
    body = (
      <EmptyState
        compact
        title="Nothing on this page"
        description="The history is shorter than this page number."
        action={<Button size="sm" onClick={() => setView({ page: 1 })}>Go to the first page</Button>}
      />
    )
  } else {
    body = (
      <HistoryTable>
        {items.map((e, i) => <EventRow key={e.id} event={withReturnCustomer(e, items.slice(i + 1))} />)}
        {importedOnly && (
          <tr className="history__note">
            <td colSpan={4}>Earlier history isn’t known. Tracking started when this cylinder was imported from the original data file.</td>
          </tr>
        )}
      </HistoryTable>
    )
  }

  return (
    <section ref={cardRef} className="card detail-card history" aria-labelledby="history-h">
      <div className="history__head">
        <div className="card__head">
          <h2 id="history-h" className="card__title">History</h2>
          <p className="card__hint">Every change to this cylinder, newest first. Entries can’t be edited or removed.</p>
        </div>
        <FilterPills label="Show events" options={FILTERS} value={type} onChange={(t) => setView({ type: t })} />
      </div>
      <SummaryStrip summary={data?.summary} failed={Boolean(error && !data)} />
      {/* Focusable so a page change can hand focus to the first event (see Pagination). */}
      <div ref={bodyRef} className="history__body" tabIndex={-1} aria-busy={query.isFetching || undefined}>{body}</div>
      {data && data.totalCount > PAGE_SIZE && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={data.totalCount}
          onPageChange={(p) => setView({ page: p })}
          disabled={query.isFetching}
          scrollTarget={cardRef}
          focusTarget={bodyRef}
        />
      )}
    </section>
  )
}

/** Skeletons only while the first load is in flight; a failed load shows dashes, not endless shimmer. */
function SummaryStrip({ summary, failed }: { summary?: HistorySummary; failed: boolean }) {
  const slots: [string, ReactNode][] = [
    ['Tracked since', summary && (summary.trackedSince ? shortDate(summary.trackedSince) : dash)],
    ['Deliveries', summary && summary.deliveries],
    ['Customers', summary && summary.customers],
    ['Last edit', summary && (summary.lastEdited ? shortDate(summary.lastEdited) : dash)],
  ]
  return (
    <dl className="history__strip">
      {slots.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="tabular">{value ?? (failed ? dash : <Skeleton width="60%" height={16} />)}</dd>
        </div>
      ))}
    </dl>
  )
}

function HistoryTable({ children }: { children: ReactNode }) {
  return (
    <table className="table history__table">
      <colgroup>
        <col style={{ width: '15%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '50%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Action at</th>
          <th scope="col">Event</th>
          <th scope="col">Change</th>
          <th scope="col">Action by</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/**
 * Returns recorded before the server stored the customer on them (or by an older backend)
 * borrow the name from the delivery they close, which is the next status entry down the list.
 * Display only: the stored entry is never changed.
 */
function withReturnCustomer(e: HistoryEvent, older: HistoryEvent[]): HistoryEvent {
  if (e.customerName || e.type !== 'status' || e.fromStatus !== 'Delivered') return e
  const delivery = older.find((o) => o.toStatus)
  return delivery?.toStatus === 'Delivered' && delivery.customerName ? { ...e, customerName: delivery.customerName } : e
}

function EventRow({ event: e }: { event: HistoryEvent }) {
  const ev = EVENT[e.type]
  return (
    <tr>
      <td data-label="Action at" className="tabular history__when">
        <time dateTime={e.at} title={`Stored as ${utcTime(e.at)}`}>{dateTime(e.at)}</time>
      </td>
      <td data-label="Event"><span className="history__event" title={ev.label}>{ev.icon}<span className="history__event-label">{ev.label}</span></span></td>
      <td data-label="Change"><Change event={e} /></td>
      <td data-label="Action by" className="break">{e.actionBy}</td>
    </tr>
  )
}

function Change({ event: e }: { event: HistoryEvent }) {
  if (e.type === 'edited') {
    return (
      <span className="history__changes">
        {e.changes.map((c) => (
          <span key={c.field} className="history__change">
            <span className="history__field">{FIELD_LABEL[c.field]}</span>
            <s className={c.field === 'serialNumber' ? 'mono' : undefined}>{c.from}</s>
            <span className="history__arrow" aria-label="changed to">→</span>
            <span className={c.field === 'serialNumber' ? 'mono' : undefined}>{c.to}</span>
          </span>
        ))}
      </span>
    )
  }
  if (e.type === 'status' && e.fromStatus && e.toStatus) {
    return (
      <span className="history__stack">
        <span className="history__change">
          <StatusBadge status={e.fromStatus} size="sm" />
          <span className="history__arrow" aria-label="to">→</span>
          <StatusBadge status={e.toStatus} size="sm" />
        </span>
        <Customer event={e} />
      </span>
    )
  }
  return (
    <span className="history__stack">
      <span className="history__change">
        <span className="history__field">{e.type === 'added' ? 'Started as' : 'File said'}</span>
        {e.toStatus ? <StatusBadge status={e.toStatus} size="sm" /> : dash}
      </span>
      <Customer event={e} />
    </span>
  )
}

/**
 * The customer sits under the move it belongs to, only on rows that involve one,
 * instead of in a column that would be a dash on most rows.
 */
function Customer({ event: e }: { event: HistoryEvent }) {
  if (!e.customerName) return null
  const lead = e.type === 'imported' ? 'With' : e.toStatus === 'Delivered' ? 'To' : 'Back from'
  return (
    <span className="history__customer">
      {lead} <strong className="break">{e.customerName}</strong>
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr aria-hidden>
      {['70%', '60%', '60%', '50%'].map((w, i) => (
        <td key={i}><Skeleton width={w} /></td>
      ))}
    </tr>
  )
}
