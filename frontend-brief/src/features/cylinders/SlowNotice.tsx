import { Hourglass } from 'lucide-react'
import { useSlow } from '../../lib/hooks'

/**
 * Free hosting tiers put the API to sleep when idle, so the first request can
 * take up to a minute. Say so, rather than leaving a skeleton spinning.
 */
export function SlowNotice({ loading }: { loading: boolean }) {
  const slow = useSlow(loading)
  if (!slow) return null
  return (
    <p className="slow-notice" role="status">
      <Hourglass size={16} aria-hidden />
      <span>
        <strong>Waking up the server…</strong> The free host sleeps when nobody’s using it, so the first load can take up to a minute.
      </span>
    </p>
  )
}
