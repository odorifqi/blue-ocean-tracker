import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePref } from './theme'

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme()
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Colour theme">
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button key={value} role="radio" aria-checked={theme === value} title={label} aria-label={label} className={clsx(theme === value && 'is-active')} onClick={() => setTheme(value)}>
          <Icon size={15} />
        </button>
      ))}
    </div>
  )
}
