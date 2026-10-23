import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from './Button'
import { Select } from './Select'

interface PaginationProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  disabled?: boolean
  /** The first page is still loading: show that instead of a count, and hold the controls. */
  loading?: boolean
}

/** Compact list of page numbers with ellipses, e.g. 1 … 4 5 6 … 12 */
export function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap')
    out.push(p)
  })
  return out
}

export function Pagination({ page, pageSize, totalCount, onPageChange, onPageSizeChange, pageSizes = [10, 20, 50], disabled: disabledProp, loading }: PaginationProps) {
  const disabled = disabledProp || loading
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(totalCount, page * pageSize)

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination__info tabular">
        {loading ? 'Loading…' : totalCount === 0 ? 'No results' : <>Showing <strong>{from}–{to}</strong> of <strong>{totalCount}</strong></>}
      </p>
      <div className="pagination__controls">
        {onPageSizeChange && (
          <label className="pagination__size">
            <span>Rows</span>
            <Select
              inputSize="sm"
              value={pageSize}
              onChange={onPageSizeChange}
              options={pageSizes.map((s) => ({ value: s, label: String(s) }))}
              disabled={disabled}
              aria-label="Rows per page"
              className="pagination__select"
            />
          </label>
        )}
        <IconButton label="Previous page" variant="secondary" size="sm" onClick={() => onPageChange(page - 1)} disabled={disabled || page <= 1}>
          <ChevronLeft size={16} />
        </IconButton>
        <ol className="pagination__pages">
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} className="pagination__gap" aria-hidden>…</li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  className="pagination__page tabular"
                  aria-current={p === page ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
                >
                  {p}
                </button>
              </li>
            ),
          )}
        </ol>
        <IconButton label="Next page" variant="secondary" size="sm" onClick={() => onPageChange(page + 1)} disabled={disabled || page >= totalPages}>
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </nav>
  )
}
