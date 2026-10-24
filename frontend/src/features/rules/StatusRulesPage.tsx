import { Lock } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Skeleton, StatusBadge } from '../../ds'
import type { Meta, StatusRule } from '../../lib/api'
import { STATUS_DESCRIPTION, STATUS_LABEL } from '../../lib/domain'
import { useMeta, useSummary } from '../../lib/queries'
import { SlowNotice } from '../cylinders/SlowNotice'
import { useDocumentTitle } from '../../lib/hooks'

/**
 * Read-only view of the lifecycle rules, rendered from /api/meta rather than the client's
 * copy, so it always shows what the server enforces. One row per status answers both
 * "what is it" and "where can it go"; only allowed moves are listed, so there is nothing to decode.
 */
export function StatusRulesPage() {
  useDocumentTitle('Status rules')
  const meta = useMeta()
  const summary = useSummary()
  const data = meta.data

  return (
    <div className="page">
      <header className="page__header enter">
        <div>
          <p className="page__eyebrow">Lifecycle</p>
          <h1 className="page__title">Status rules</h1>
          <p className="page__subtitle">Which statuses a cylinder can have, and which moves between them are allowed.</p>
        </div>
      </header>

      <SlowNotice loading={meta.isLoading} />

      {meta.isError ? (
        <div className="card"><ErrorState error={meta.error} onRetry={() => meta.refetch()} retrying={meta.isFetching} /></div>
      ) : (
        <>
          <p className="rules__bar enter" style={{ '--i': 1 } as CSSProperties}>
            <Lock size={15} aria-hidden />
            <span><strong>Read-only.</strong> These are the lifecycle rules, enforced by the server on every status change.</span>
          </p>

          <section className="card rules__card enter" style={{ '--i': 1 } as CSSProperties} aria-labelledby="statuses-h">
            <h2 id="statuses-h" className="card__title rules__title">Statuses</h2>
            <div className="rules__scroll">
              <table className="table rules__statuses">
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Meaning</th>
                    <th scope="col">Can move to</th>
                    <th scope="col" className="num">Cylinders</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    ? data.statusRules.map((r) => (
                        <tr key={r.status}>
                          <td data-label="Status"><StatusBadge status={r.status} /></td>
                          <td data-label="Meaning" className="rules__meaning">{meaning(r)}</td>
                          <td data-label="Can move to" className="rules__next"><NextStatuses rule={r} meta={data} /></td>
                          <td data-label="Cylinders" className="num tabular">
                            {summary.data ? (
                              <Link to={`/?status=${r.status}`} className="rules__count">{summary.data.byStatus[r.status]}</Link>
                            ) : summary.isError ? (
                              <span className="muted">—</span>
                            ) : (
                              <Skeleton width={24} />
                            )}
                          </td>
                        </tr>
                      ))
                    : Array.from({ length: 5 }, (_, i) => (
                        <tr key={i} aria-hidden>
                          {['80px', '70%', '50%', '24px'].map((w, j) => <td key={j}><Skeleton width={w} /></td>)}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

// Behaviour flags read as part of the meaning, in the same voice, not as a separate column of chips.
function meaning(r: StatusRule) {
  return [
    STATUS_DESCRIPTION[r.status],
    r.isStart && 'New cylinders start here.',
    r.requiresCustomer && 'Moving here asks for the customer’s name.',
  ]
    .filter(Boolean)
    .join(' ')
}

function NextStatuses({ rule, meta }: { rule: StatusRule; meta: Meta }) {
  const next = meta.statuses.filter((s) => meta.transitions[rule.status]?.includes(s))
  if (next.length === 0) {
    return <span className="muted">{rule.isFinal ? `None. ${STATUS_LABEL[rule.status]} is final.` : 'None.'}</span>
  }
  return (
    <ul className="rules__moves" aria-label={`${STATUS_LABEL[rule.status]} can move to`}>
      {next.map((s) => <li key={s}><StatusBadge status={s} size="sm" /></li>)}
    </ul>
  )
}
