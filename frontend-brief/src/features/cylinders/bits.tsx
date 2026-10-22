import clsx from 'clsx'
import type { GasType } from '../../lib/domain'
import { GAS_META } from '../../lib/gas'

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
