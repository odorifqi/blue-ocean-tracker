import clsx from 'clsx'
import { STATUSES, STATUS_LABEL, TRANSITIONS, type CylinderStatus } from '../../lib/domain'
import { statusKey } from '../../ds'

// Fixed layout for the five-state lifecycle. The Empty -> Filled -> Delivered
// loop sits on the top row, the exits (maintenance, retirement) underneath. x/y are centres.
const NODES: Record<CylinderStatus, { x: number; y: number }> = {
  Empty: { x: 100, y: 100 },
  Filled: { x: 340, y: 100 },
  Delivered: { x: 580, y: 100 },
  InMaintenance: { x: 220, y: 210 },
  Retired: { x: 460, y: 210 },
}
// Each pill hugs its label: 30 (dot + gap) + the label at 15px bold, rounded up + 18 right padding.
// Sized for the bold "current" weight so a pill never changes width when the status moves.
const W: Record<CylinderStatus, number> = { Empty: 96, Filled: 88, Delivered: 118, InMaintenance: 162, Retired: 102 }
const H = 40

const box = (s: CylinderStatus) => {
  const { x, y } = NODES[s]
  return { x, y, l: x - W[s] / 2, r: x + W[s] / 2, t: y - H / 2, b: y + H / 2 }
}
const E = box('Empty'), F = box('Filled'), D = box('Delivered'), M = box('InMaintenance'), R = box('Retired')

// Hand-routed so no two edges cross: Delivered -> Empty arcs over the top row,
// Empty -> Retired passes under In maintenance. Endpoints are tied to the pill edges, leaving
// clearance for the arrowhead, so a label change only needs its width above. Keyed `${from}>${to}`.
const EDGES: Record<string, string> = {
  'Empty>Filled': `M${E.r + 4},${E.y} L${F.l - 4},${F.y}`,
  'Filled>Delivered': `M${F.r + 4},${F.y} L${D.l - 4},${D.y}`,
  'Delivered>Empty': `M${D.x},${D.t - 2} Q${F.x},-6 ${E.x + 4},${E.t - 2}`,
  'Empty>InMaintenance': `M${E.x - 8},${E.b + 2} Q${E.x - 4},${M.y - 4} ${M.l - 4},${M.y - 2}`,
  'InMaintenance>Empty': `M${M.l + 36},${M.t - 3} Q${M.l + 14},${E.b + 18} ${E.x + 22},${E.b + 4}`,
  'Filled>InMaintenance': `M${F.x - 22},${F.b + 2} L${M.x + 28},${M.t - 4}`,
  'Filled>Retired': `M${F.x + 22},${F.b + 2} L${R.x - 28},${R.t - 4}`,
  'InMaintenance>Retired': `M${M.r + 4},${M.y} L${R.l - 4},${R.y}`,
  'Empty>Retired': `M${E.l + 20},${E.b + 2} C${E.l - 10},300 ${R.x - 60},300 ${R.x - 20},${R.b + 4}`,
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
      // Cropped to the drawing with an even 26px side margin; widen it if a pill grows past Delivered.
      viewBox="26 18 640 274"
      // A group, not an image: the allowed next steps inside are real buttons that screen readers must reach.
      role="group"
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
            transform={`translate(${x - W[s] / 2}, ${y - H / 2})`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? `Move to ${STATUS_LABEL[s]}` : undefined}
            onClick={interactive ? () => onSelect(s) : undefined}
            onKeyDown={interactive ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(s)) : undefined}
          >
            <rect width={W[s]} height={H} rx={H / 2} />
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
