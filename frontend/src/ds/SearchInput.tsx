import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Input } from './Field'

interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  busy?: boolean
  /** Focus with the "/" key, like GitHub and Linear. */
  shortcut?: boolean
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', busy, shortcut = true }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!shortcut) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  return (
    <Input
      ref={ref}
      type="search"
      role="searchbox"
      aria-label={label}
      className="search"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value) {
          e.stopPropagation()
          onChange('')
        }
      }}
      prefix={<Search size={16} className={busy ? 'search__icon is-busy' : 'search__icon'} aria-hidden />}
      suffix={
        value ? (
          <button type="button" className="search__clear" onClick={() => { onChange(''); ref.current?.focus() }} aria-label="Clear search">
            <X size={14} />
          </button>
        ) : shortcut ? (
          <kbd className="kbd" aria-hidden>/</kbd>
        ) : null
      }
    />
  )
}
