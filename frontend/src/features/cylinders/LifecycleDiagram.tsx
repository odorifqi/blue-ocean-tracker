import clsx from 'clsx'
import { STATUSES, STATUS_LABEL, TRANSITIONS, type CylinderStatus } from '../../lib/domain'
import { statusKey } from '../../ds'

// Fixed layout for the five-state lifecycle. The Empty -> Filled -> Delivered
// loop sits on the top row, the exits (maintenance, retirement) underneath.
const NODES: Record<CylinderStatus, { x: number; y: number }> = {
  Empty: { x: 100, y: 100 },
  Filled: { x: 340, y: 100 },
  Delivered: { x: 580, y: 100 },
  InMaintenance: { x: 220, y: 210 },
  Retired: { x: 460, y: 210 },
}
const W = 148
const H = 40

// Hand-routed so no two edges cross: Delivered -> Empty arcs over the top row,
// Empty -> Retired passes under In maintenance. Keyed `${from}>${to}`.
const EDGES: Record<string, string> = {
  'Empty>Filled': 'M178,100 L262,100',
  'Filled>Delivered': 'M418,100 L502,100',
  'Delivered>Empty': 'M580,78 Q340,-6 104,78',
  'Empty>InMaintenance': 'M84,122 Q92,206 142,208',
  'InMaintenance>Empty': 'M178,187 Q150,140 126,124',
  'Filled>InMaintenance': 'M318,122 L248,186',
  'Filled>Retired': 'M362,122 L432,186',
  'InMaintenance>Retired': 'M298,210 L382,210',
  'Empty>Retired': 'M64,122 C34,300 400,300 440,234',
}

interface Props {
  current?: CylinderStatus
  onSelect?: (s: CylinderStatus) => void
  className?: string
}

export function LifecycleDiagram({ current, onSelect, className }: Props) {
  const next = current ? TRANSITIONS[current] : []
  // Moves from the current status are drawn last so they sit on top.
  const edges = STATUSES.flatMap((from) => TRANSITIONS[from].map((to) => ({ from, to }))).sort(
    (a, b) => Number(a.from === current) - Number(b.from === current),
  )

  return (
    <svg
      className={clsx('lifecycle', className)}
      viewBox="0 18 680 274"
      role="img"
      aria-label={
        current
          ? `Lifecycle diagram. Current status ${STATUS_LABEL[current]}. ${next.length ? `Can move to ${next.map((s) => STATUS_LABEL[s]).join(', ')}.` : 'No further moves.'}`
          : 'Cylinder lifecycle: Empty, Filled, Delivered, In maintenance, Retired.'
      }
    >
      <defs>
        <marker id="lc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="lifecycle__arrow" />
        </marker>
        <marker id="lc-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="lifecycle__arrow is-on" />
        </marker>
      </defs>
      {edges.map(({ from, to }) => {
        const on = from === current
        return (
          <path
            key={`${from}>${to}`}
            d={EDGES[`${from}>${to}`]}
            className={clsx('lifecycle__edge', on && 'is-on')}
            markerEnd={`url(#${on ? 'lc-arrow-on' : 'lc-arrow'})`}
          />
        )
      })}
      {STATUSES.map((s) => {
        const { x, y } = NODES[s]
        const isCurrent = s === current
        const isNext = next.includes(s)
        const interactive = isNext && onSelect
        return (
          <g
            key={s}
            className={clsx('lifecycle__node', `status--${statusKey(s)}`, isCurrent && 'is-current', isNext && 'is-next', interactive && 'is-interactive')}
            transform={`translate(${x - W / 2}, ${y - H / 2})`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Move to ${STATUS_LABEL[s]}` : undefined}
            onClick={interactive ? () => onSelect(s) : undefined}
            onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(s)) : undefined}
          >
            <rect width={W} height={H} rx={H / 2} />
            <circle cx={18} cy={H / 2} r={4} className="lifecycle__dot" />
            <text x={30} y={H / 2} dominantBaseline="central">{STATUS_LABEL[s]}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Key for the diagram's marks. The "Current" swatch takes the current status colour. */
export function LifecycleLegend({ current }: { current?: CylinderStatus }) {
  return (
    <ul className="lifecycle-legend" aria-hidden>
      <li><i className={clsx('lifecycle-legend__current', current && `status--${statusKey(current)}`)} />Current</li>
      <li><i className="lifecycle-legend__next" />Allowed next</li>
      <li><i className="lifecycle-legend__move" />Move from current status</li>
      <li><i className="lifecycle-legend__other" />Other moves</li>
    </ul>
  )
}
