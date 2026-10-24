import clsx from 'clsx'
import { ArrowRight, Clock, Inbox, Info, PencilLine, Plus, Repeat2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Button,
  EmptyState,
  ErrorState,
  FilterPills,
  Menu,
  Pagination,
  SearchInput,
  Skeleton,
  StatusBadge,
  Truncate,
  statusKey,
  type FilterOption,
} from '../../ds'
import type { Cylinder } from '../../lib/api'
import { STATUSES, STATUS_LABEL, isStatus, type CylinderStatus } from '../../lib/domain'
import { absoluteTime, relativeTime } from '../../lib/format'
import { useDebounced, useDocumentTitle } from '../../lib/hooks'
import { useCylinders, useSummary } from '../../lib/queries'
import { GasSwatch, Highlight, IdleBadge } from './bits'
import { CylinderFormDialog } from './CylinderFormDialog'
import { SlowNotice } from './SlowNotice'
import { StatusChangeDialog } from './StatusChangeDialog'

const PAGE_SIZES = [10, 20, 50]

/** List state lives in the URL so filters survive reloads and can be shared. */
function useListParams() {
  const [sp, setSp] = useSearchParams()
  const status: CylinderStatus | '' = isStatus(sp.get('status')) ? (sp.get('status') as CylinderStatus) : ''
  const page = Math.max(1, Number(sp.get('page')) || 1)
  const sizeParam = Number(sp.get('pageSize'))
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : 10
  const search = sp.get('q') ?? ''

  const set = (patch: Partial<{ q: string; status: string; page: number; pageSize: number }>) => {
    const next = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => {
      const isDefault = v === '' || v === undefined || (k === 'page' && v === 1) || (k === 'pageSize' && v === 10)
      if (isDefault) next.delete(k)
      else next.set(k, String(v))
    })
    setSp(next, { replace: true })
  }
  return { status, page, pageSize, search, set }
}

export function CylindersPage() {
  const { status, page, pageSize, search, set } = useListParams()
  useDocumentTitle('Cylinders')
  const [searchDraft, setSearchDraft] = useState(search)
  const debounced = useDebounced(searchDraft.trim(), 300)

  // Push the search to the URL (and back to page 1) once typing pauses.
  useEffect(() => {
    if (debounced !== search.trim()) set({ q: debounced, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // Pull a search changed from outside (the sidebar link, the logo) back into the box. Comparing with the
  // debounced text, not the draft, leaves letters typed during the debounce alone.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, an outside source
    if (search.trim() !== debounced) setSearchDraft(search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const effectiveSearch = search.trim()

  const query = useCylinders({ search: effectiveSearch, status, page, pageSize })
  const summary = useSummary()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Cylinder>()
  const [changing, setChanging] = useState<Cylinder>()

  const data = query.data
  const filtered = Boolean(effectiveSearch || status)
  const typing = searchDraft.trim() !== debounced

  const pillOptions = useMemo<FilterOption<CylinderStatus | ''>[]>(
    () => [
      { value: '', label: 'All', count: summary.data?.total },
      ...STATUSES.map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
        count: summary.data?.byStatus[s],
        icon: <span className={clsx('pill__dot', `status--${statusKey(s)}`)} aria-hidden />,
      })),
    ],
    [summary.data],
  )

  // A new result set starts at its first row, and the column header lifts once rows pass under it.
  const bodyRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [page, pageSize, status, effectiveSearch])
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onScroll = () => el.classList.toggle('is-scrolled', el.scrollTop > 0)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const clearFilters = () => {
    setSearchDraft('')
    set({ q: '', status: '', page: 1 })
  }

  return (
    <div className="page page--fill">
      <header className="page__header enter">
        <div>
          <p className="page__eyebrow">Asset register</p>
          <h1 className="page__title">Cylinders</h1>
          <p className="page__subtitle">Every cylinder, where it is in its lifecycle, and who has it.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New cylinder
        </Button>
      </header>

      {summary.data && summary.data.idle > 0 && (
        <IdleBanner count={summary.data.idle} onView={() => set({ status: 'Delivered', page: 1 })} />
      )}

      <section ref={listRef} className="card list enter" style={{ '--i': 2 } as CSSProperties} aria-label="Cylinder list">
        <div className="list__toolbar">
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Search serial number or customer"
            label="Search cylinders by serial number or customer name"
            busy={typing || (query.isFetching && !query.isLoading)}
          />
          <FilterPills label="Filter by status" options={pillOptions} value={status} onChange={(v) => set({ status: v, page: 1 })} />
        </div>

        {/* On desktop only this region scrolls, so it takes focus for keyboard scrolling. */}
        <div
          ref={bodyRef}
          className={clsx('list__body', query.isPlaceholderData && 'is-stale')}
          aria-busy={query.isFetching}
          role="region"
          aria-label="Cylinder results"
          tabIndex={0}
        >
          {query.isFetching && !query.isLoading && <div className="progress-bar" role="progressbar" aria-label="Updating results" />}

          {query.isLoading ? (
            <>
              <SlowNotice loading />
              <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} />
            </>
          ) : query.isError && !data ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
          ) : data && data.items.length === 0 ? (
            filtered ? (
              <EmptyState
                title="No cylinders match"
                description={
                  <>
                    Nothing found{effectiveSearch && <> for “<strong className="break">{effectiveSearch}</strong>”</>}
                    {status && <> with status <strong>{STATUS_LABEL[status]}</strong></>}. Check the serial number or try another filter.
                  </>
                }
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : page > 1 ? (
              <EmptyState
                icon={<Inbox size={22} />}
                title="This page is empty"
                description={`There are only ${data.totalCount} cylinders.`}
                action={<Button onClick={() => set({ page: 1 })}>Go to first page</Button>}
              />
            ) : (
              <EmptyState
                icon={<Inbox size={22} />}
                title="No cylinders yet"
                description="Register the first cylinder to start tracking it."
                action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>New cylinder</Button>}
              />
            )
          ) : data ? (
            <>
              {query.isError && <p className="inline-error" role="alert">Couldn’t refresh. Showing the last results. <button onClick={() => query.refetch()}>Retry</button></p>}
              <CylinderTable
                rowsKey={`${page}-${pageSize}-${status}-${effectiveSearch}`}
                items={data.items}
                search={effectiveSearch}
                onEdit={setEditing}
                onChangeStatus={setChanging}
              />
            </>
          ) : null}
        </div>

        {/* Always rendered, so the card keeps the same shape for 0, 3 or 50 results. */}
        <footer className="list__footer">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={data?.totalCount ?? 0}
            loading={!data}
            onPageChange={(p) => set({ page: p })}
            onPageSizeChange={(s) => set({ pageSize: s, page: 1 })}
            pageSizes={PAGE_SIZES}
            scrollTarget={listRef}
            focusTarget={bodyRef}
          />
        </footer>
      </section>

      <CylinderFormDialog open={creating} onClose={() => setCreating(false)} />
      <CylinderFormDialog open={Boolean(editing)} cylinder={editing} onClose={() => setEditing(undefined)} />
      {changing && <StatusChangeDialog open cylinder={changing} onClose={() => setChanging(undefined)} />}
    </div>
  )
}

/** Overdue returns are an exception the team acts on, so they stay on the list as a message, not a filter. */
function IdleBanner({ count, onView }: { count: number; onView: () => void }) {
  return (
    <div className="idle-banner enter" style={{ '--i': 1 } as CSSProperties} role="status">
      <Clock size={16} aria-hidden />
      <span className="idle-banner__text">
        <strong>{count} delivered {count === 1 ? 'cylinder hasn’t' : 'cylinders haven’t'}</strong> come back in 30+ days.
      </span>
      <button type="button" className="idle-banner__action" onClick={onView}>
        View them <ArrowRight size={14} aria-hidden />
      </button>
    </div>
  )
}

interface TableProps {
  /** Changes with the result set, so new rows fade in instead of swapping. */
  rowsKey: string
  items: Cylinder[]
  search?: string
  onEdit: (c: Cylinder) => void
  onChangeStatus: (c: Cylinder) => void
}

function CylinderTable({ rowsKey, items, search, onEdit, onChangeStatus }: TableProps) {
  const navigate = useNavigate()
  return (
    <table className="table cyl-table">
      <CylinderCols />
      <thead>
        <tr>
          <th scope="col">Serial number</th>
          <th scope="col">Gas</th>
          <th scope="col">Status</th>
          <th scope="col">Customer</th>
          <th scope="col" className="cyl-table__updated">Updated</th>
          <th scope="col"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody key={rowsKey} className="table__rows">
        {items.map((c) => (
          // Rows aren't clickable: Detail is the one way into the detail page, so a stray
          // click while reading or selecting text never navigates away.
          <tr key={c.id} className="table__row">
            <td data-label="Serial number">
              <span className="serial mono">
                <Highlight text={c.serialNumber} query={search} />
              </span>
            </td>
            <td data-label="Gas"><GasSwatch gas={c.gasType} /></td>
            <td data-label="Status">
              <span className="table__status">
                <StatusBadge status={c.status} size="sm" />
                <span className="table__status-idle"><IdleBadge cylinder={c} /></span>
              </span>
            </td>
            <td data-label="Customer" className="table__customer">
              {c.customerName ? (
                <span className="table__with">
                  <span className="table__card-only">With</span>
                  <Truncate text={c.customerName} className="customer">
                    <Highlight text={c.customerName} query={search} />
                  </Truncate>
                </span>
              ) : (
                <span className="muted" aria-label="No customer">—</span>
              )}
              {/* Phones put "Out Nd" beside the customer who has the cylinder, and the time on its own
                  line; the Status and Updated cells drop those there. */}
              <span className="table__card-only table__card-idle"><IdleBadge cylinder={c} /></span>
              <span className="table__card-only table__card-time">Updated {relativeTime(c.lastUpdated)}</span>
            </td>
            <td data-label="Updated" className="nowrap">
              <time dateTime={c.lastUpdated} title={absoluteTime(c.lastUpdated)} className="muted tabular">
                {relativeTime(c.lastUpdated)}
              </time>
            </td>
            <td className="table__actions">
              {/* Two equal quiet actions, then Detail, the one tinted action in the row.
                  The serial is in each accessible name, so ten "Detail" links stay distinguishable.
                  The wrapper is a size container: all three labels show whenever they fit; when they
                  don't, all three drop to icons together. */}
              <div className="table__actions-inner">
              <Button size="sm" variant="ghost" className="row-quiet" icon={<PencilLine size={15} />} aria-label={`Edit details for ${c.serialNumber}`} title="Edit details" onClick={() => onEdit(c)}>
                <span className="btn__label">Edit details</span>
              </Button>
              <Button size="sm" variant="ghost" className="row-quiet" icon={<Repeat2 size={15} />} aria-label={`Change status for ${c.serialNumber}`} onClick={() => onChangeStatus(c)} disabled={c.status === 'Retired'} title={c.status === 'Retired' ? 'Retired cylinders can’t change status' : 'Change status'}>
                <span className="btn__label">Change status</span>
              </Button>
              <Link to={`/cylinders/${c.id}`} className="btn btn--soft btn--sm" aria-label={`Detail for ${c.serialNumber}`} title="Detail">
                <Info size={15} aria-hidden /><span className="btn__label">Detail</span>
              </Link>
              </div>
            </td>
            {/* Phones: one ⋯ button holds all three actions (Detail first). Hidden on desktop. */}
            <td className="table__menu">
              <Menu
                label={`Actions for ${c.serialNumber}`}
                items={[
                  { label: 'Detail', icon: <Info size={16} />, primary: true, onSelect: () => navigate(`/cylinders/${c.id}`) },
                  { label: 'Edit details', icon: <PencilLine size={16} />, separated: true, onSelect: () => onEdit(c) },
                  { label: 'Change status', icon: <Repeat2 size={16} />, onSelect: () => onChangeStatus(c), disabled: c.status === 'Retired', hint: 'Retired is final' },
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Rifqi's widths, shared by the table and its skeleton so nothing shifts when data arrives. Sums to 100%. */
function CylinderCols() {
  return (
    <colgroup>
      <col style={{ width: '15%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '15%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '30%' }} />
    </colgroup>
  )
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <table className="table cyl-table" aria-hidden>
      <CylinderCols />
      <thead>
        <tr>
          {['Serial number', 'Gas', 'Status', 'Customer', 'Updated', ''].map((h, i) => <th key={i}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <tr key={i} className="table__row">
            {/* Same cells and labels as a real row, so the phone card skeleton has the real card's shape. */}
            <td data-label="Serial number"><Skeleton width={92} /></td>
            <td data-label="Gas"><Skeleton width={70} /></td>
            <td data-label="Status"><Skeleton width={74} height={20} radius={99} /></td>
            <td data-label="Customer"><Skeleton width={`${40 + ((i * 37) % 45)}%`} /></td>
            <td data-label="Updated"><Skeleton width={72} /></td>
            <td className="table__actions"><Skeleton width="100%" height={28} /></td>
            <td className="table__menu"><Skeleton width={36} height={36} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
