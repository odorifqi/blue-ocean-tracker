import { Activity, Boxes, Clock, RotateCcw, Wrench } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarList,
  Button,
  ChartCard,
  ColumnChart,
  EmptyState,
  ErrorState,
  HeatScale,
  HeatTable,
  LegendKey,
  Skeleton,
  StatTile,
  Truncate,
  formatCount,
  formatPct,
} from '../../ds'
import { pct, utilisation } from '../../lib/analytics'
import type { Analytics } from '../../lib/api'
import { GAS_TYPES, STATUSES, STATUS_LABEL, type GasType } from '../../lib/domain'
import { useAnalytics } from '../../lib/queries'
import { statusKey } from '../../ds/Badge'
import { GasSwatch } from '../cylinders/bits'
import { SlowNotice } from '../cylinders/SlowNotice'
import { useReveal } from '../../lib/useReveal'
import { useDocumentTitle } from '../../lib/hooks'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const listLink = (params: Record<string, string>) => `/?${new URLSearchParams(params)}`

export function AnalyticsPage() {
  useDocumentTitle('Analytics')
  const query = useAnalytics()
  const a = query.data

  return (
    <div className="page">
      <header className="page__header enter">
        <div>
          <p className="page__eyebrow">Fleet insights</p>
          <h1 className="page__title">Analytics</h1>
          <p className="page__subtitle">How the fleet is being used, where cylinders are sitting, and who is holding them.</p>
        </div>
        {a && (
          <div className="analytics__updated">
            <span className="muted">Updated {timeFmt.format(new Date(a.generatedAt))}</span>
            <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} loading={query.isFetching} onClick={() => query.refetch()}>
              Refresh
            </Button>
          </div>
        )}
      </header>

      <SlowNotice loading={query.isLoading} />

      {query.isError && !a ? (
        <div className="card"><ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} /></div>
      ) : !a ? (
        <AnalyticsSkeleton />
      ) : a.total === 0 ? (
        <div className="card">
          <EmptyState icon={<Boxes size={22} />} title="Nothing to analyse yet" description="Register cylinders and their charts will show up here." action={<Link to="/">Go to cylinders</Link>} />
        </div>
      ) : (
        <AnalyticsBody a={a} />
      )}
    </div>
  )
}

function AnalyticsBody({ a }: { a: Analytics }) {
  const use = utilisation(a.byStatus)
  const inUse = a.byStatus.Filled + a.byStatus.Delivered
  const idleShare = a.byStatus.Delivered ? a.idle / a.byStatus.Delivered : 0
  const gasByTotal = [...a.byGas].sort((x, y) => y.total - x.total)
  const gasRow = (g: GasType) => a.byGas.find((x) => x.gasType === g)!
  const gasInService = (g: GasType) => gasRow(g).total - gasRow(g).byStatus.Retired

  return (
    <>
      <section className="analytics-tiles enter" style={{ '--i': 1 } as CSSProperties} aria-label="Key figures">
        <StatTile
          icon={<Boxes size={15} aria-hidden />}
          label="In service"
          value={formatCount(a.inService)}
          meta={`${formatCount(a.total)} registered · ${formatCount(a.byStatus.Retired)} retired`}
        />
        <StatTile
          icon={<Activity size={15} aria-hidden />}
          label="Utilisation"
          value={`${Math.round(use * 100)}%`}
          meter={use}
          meta={`${formatCount(inUse)} of ${formatCount(a.inService)} filled or at customers`}
        />
        <StatTile
          icon={<Clock size={15} aria-hidden />}
          label={`Out ${a.idleDays}+ days`}
          value={formatCount(a.idle)}
          tone={a.idle ? 'warning' : 'default'}
          meter={idleShare}
          meta={`${formatPct(a.idle, a.byStatus.Delivered)} of delivered cylinders, not yet returned`}
          to={listLink({ status: 'Delivered' })}
        />
        <StatTile
          icon={<Wrench size={15} aria-hidden />}
          label="In maintenance"
          value={formatCount(a.byStatus.InMaintenance)}
          meta={`${formatPct(a.byStatus.InMaintenance, a.inService)} of the fleet in service is out of action`}
          to={listLink({ status: 'InMaintenance' })}
        />
      </section>

      <FleetStatusStrip a={a} />

      {/* Rigid 12-column grid: every row fills the width (6 + 6, 12, 8 + 4). */}
      <div className="analytics-grid enter" style={{ '--i': 3 } as CSSProperties}>
        <ChartCard reveal className="span-6" title="Cylinders by gas type" subtitle="Share of the whole fleet, largest first.">
          <BarList
            ariaLabel="Cylinders by gas type"
            total={a.total}
            items={gasByTotal.map((g) => ({ key: g.gasType, text: g.gasType, label: <GasSwatch gas={g.gasType} />, value: g.total }))}
          />
        </ChartCard>

        <ChartCard reveal className="span-6" title="Time since last movement" subtitle="Cylinders in service, by days since their status last changed.">
          <ColumnChart
            ariaLabel="Cylinders in service by days since their last status change"
            height={232}
            items={a.aging.map((b) => ({
              key: b.label,
              label: b.label.replace(' days', 'd').replace('Over 90d', '90d+'),
              value: b.count,
              emphasis: b.minDays > a.idleDays,
              detail: b.minDays > a.idleDays ? `Not moved for over ${a.idleDays} days` : undefined,
            }))}
            legend={
              <>
                <LegendKey color="var(--chart-series-muted)">Moved in the last {a.idleDays} days</LegendKey>
                <LegendKey color="var(--chart-series)">Not moved for over {a.idleDays} days</LegendKey>
              </>
            }
          />
        </ChartCard>

        <ChartCard
          reveal
          className="span-12"
          title="Status mix by gas"
          subtitle="Darker cells hold more cylinders. “In use” is filled or delivered, out of each gas’s cylinders in service."
          footer={<HeatScale />}
        >
          <HeatTable
            caption="Number of cylinders per gas type and status"
            rows={GAS_TYPES}
            cols={STATUSES}
            value={(g, s) => gasRow(g).byStatus[s]}
            rowHeader={(g) => <GasSwatch gas={g} />}
            colHeader={(s) => STATUS_LABEL[s]}
            rowTotal={(g) => gasRow(g).total}
            extra={{ header: 'In use', cell: (g) => formatPct(gasRow(g).byStatus.Filled + gasRow(g).byStatus.Delivered, gasInService(g)) }}
          />
        </ChartCard>

        <ChartCard
          reveal
          className="span-8"
          title="Customers holding cylinders"
          subtitle={`Top ${a.topCustomers.length} of ${formatCount(a.customerCount)} customers by delivered cylinders. Select one to see their cylinders.`}
        >
          {a.topCustomers.length ? (
            <BarList
              ariaLabel="Customers holding the most cylinders"
              noteWidth="9ch"
              items={a.topCustomers.map((c) => ({
                key: c.customerName,
                text: `${c.customerName}${c.idle ? `, ${c.idle} out over ${a.idleDays} days` : ''}`,
                label: <Truncate text={c.customerName} />,
                value: c.cylinders,
                note: c.idle ? <span className="warn-text">{c.idle} idle</span> : <span className="muted">–</span>,
                to: listLink({ q: c.customerName, status: 'Delivered' }),
              }))}
            />
          ) : (
            <EmptyState compact title="No cylinders at customers" description="Delivered cylinders will be listed here by customer." />
          )}
        </ChartCard>

        <ChartCard reveal className="span-4" title="Highlights" subtitle="Worth a look this week.">
          <Highlights a={a} gasInService={gasInService} />
        </ChartCard>
      </div>
    </>
  )
}

/** Moved here from the Cylinders list, where it duplicated the filter pills. */
function FleetStatusStrip({ a }: { a: Analytics }) {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} className="card fleet-strip enter" style={{ '--i': 2 } as CSSProperties} aria-labelledby="fleet-strip-title">
      <div>
        <h2 className="chart-card__title" id="fleet-strip-title">Fleet by status</h2>
        <p className="chart-card__subtitle">All {formatCount(a.total)} registered cylinders. Select a status to see those cylinders.</p>
      </div>
      <div className="fleet-strip__bar" aria-hidden>
        {STATUSES.map((s) =>
          a.byStatus[s] ? <span key={s} className={`fleet-strip__seg status--${statusKey(s)}`} style={{ flexGrow: a.byStatus[s] }} /> : null,
        )}
      </div>
      <ul className="fleet-strip__tiles" aria-label="Cylinders by status">
        {STATUSES.map((s) => (
          <li key={s}>
            <Link
              to={listLink({ status: s })}
              className={`stat status--${statusKey(s)}`}
              aria-label={`${STATUS_LABEL[s]}: ${formatCount(a.byStatus[s])}, ${formatPct(a.byStatus[s], a.total)}`}
            >
              <span className="stat__label"><span className="stat__dot" aria-hidden />{STATUS_LABEL[s]}</span>
              <span className="stat__value">{formatCount(a.byStatus[s])}</span>
              <span className="stat__meta tabular">{formatPct(a.byStatus[s], a.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Highlights({ a, gasInService }: { a: Analytics; gasInService: (g: GasType) => number }) {
  const items: { key: string; tone?: 'warning'; text: ReactNode }[] = []
  const rate = (n: number, d: number) => (d ? n / d : 0)
  const withService = a.byGas.filter((g) => gasInService(g.gasType) > 0)

  const busiest = [...withService].sort((x, y) =>
    rate(y.byStatus.Filled + y.byStatus.Delivered, gasInService(y.gasType)) - rate(x.byStatus.Filled + x.byStatus.Delivered, gasInService(x.gasType)))[0]
  if (busiest) {
    const used = busiest.byStatus.Filled + busiest.byStatus.Delivered
    items.push({ key: 'busy', text: <><strong>{busiest.gasType}</strong> is the busiest gas: {used} of {gasInService(busiest.gasType)} cylinders in use ({pct(used, gasInService(busiest.gasType))}%).</> })
  }

  const spare = [...a.byGas].sort((x, y) => y.byStatus.Empty - x.byStatus.Empty)[0]
  if (spare?.byStatus.Empty) {
    items.push({ key: 'spare', text: <><strong>{spare.gasType}</strong> has the most empty cylinders ({spare.byStatus.Empty}), ready to refill.</> })
  }

  const repair = [...withService].sort((x, y) => rate(y.byStatus.InMaintenance, gasInService(y.gasType)) - rate(x.byStatus.InMaintenance, gasInService(x.gasType)))[0]
  if (repair?.byStatus.InMaintenance) {
    items.push({ key: 'repair', text: <><strong>{repair.gasType}</strong> has the highest share in maintenance: {repair.byStatus.InMaintenance} of {gasInService(repair.gasType)}.</> })
  }

  const oldest = [...a.topCustomers].sort((x, y) => y.oldestDays - x.oldestDays)[0]
  if (oldest && oldest.oldestDays >= a.idleDays) {
    items.push({
      key: 'oldest',
      tone: 'warning',
      text: <><Link to={listLink({ q: oldest.customerName, status: 'Delivered' })}><strong className="break">{oldest.customerName}</strong></Link> has had a cylinder for {oldest.oldestDays} days. Worth chasing the return.</>,
    })
  }

  if (!items.length) return <p className="muted">Nothing stands out right now.</p>
  return (
    <ul className="highlights">
      {items.map((i) => (
        <li key={i.key} className={i.tone === 'warning' ? 'highlights__item is-warning' : 'highlights__item'}>{i.text}</li>
      ))}
    </ul>
  )
}

function AnalyticsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading analytics" className="analytics-skeleton">
      <div className="analytics-tiles">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-tile">
            <Skeleton width={90} height={12} />
            <Skeleton width={70} height={30} />
            <Skeleton width="80%" height={10} />
          </div>
        ))}
      </div>
      <div className="analytics-grid">
        {['span-6', 'span-6', 'span-12'].map((span, i) => (
          <div key={i} className={`card chart-card ${span}`}>
            <div className="chart-card__head"><Skeleton width={160} height={16} /></div>
            <div className="chart-card__body skeleton-bars">
              {[0.9, 0.7, 0.55, 0.4, 0.25].map((w) => <Skeleton key={w} height={10} style={{ width: `${w * 100}%` } as CSSProperties} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
