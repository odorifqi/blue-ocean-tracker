import { useEffect, useState, useSyncExternalStore } from 'react'

export const APP_NAME = 'Blue Ocean Tracker'

/** Names the browser tab after the page, e.g. "CYL-012345 · Blue Ocean Tracker", so several open tabs stay apart. */
export function useDocumentTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${APP_NAME}` : APP_NAME
  }, [page])
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** True once `active` has stayed true for `ms`. Used to explain long waits instead of spinning silently. */
export function useSlow(active: boolean, ms = 4000) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!active) {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(t)
  }, [active, ms])
  return slow
}
