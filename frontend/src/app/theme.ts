import { useEffect, useState } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'smtr.theme'

function resolve(pref: ThemePref) {
  if (pref !== 'system') return pref
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemePref) || 'system'
    } catch {
      return 'system'
    }
  })

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolve(pref))
    apply()
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* ignore */
    }
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    m.addEventListener('change', apply)
    return () => m.removeEventListener('change', apply)
  }, [pref])

  return [pref, setPref] as const
}
