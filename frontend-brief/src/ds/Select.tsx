import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  /** Optional leading visual, e.g. a gas swatch or status dot. */
  icon?: ReactNode
  description?: string
  disabled?: boolean
}

export interface SelectProps<T extends string | number> {
  value: T | undefined
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  id?: string
  inputSize?: 'sm' | 'md' | 'lg'
  invalid?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
  'aria-describedby'?: string
  /** Narrow triggers (e.g. "Rows: 10") can let the menu grow wider than the trigger. */
  menuMinWidth?: number
}

const GAP = 6
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
const MAX_MENU_H = 300

/**
 * Custom listbox select (WAI-ARIA "select-only combobox" pattern).
 * The menu is rendered with the Popover API so it sits in the top layer and
 * isn't clipped by dialogs or scroll containers, while the trigger stays a
 * normal form control with the same sizes and states as <Input>.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  id,
  inputSize = 'md',
  invalid,
  disabled,
  className,
  menuMinWidth,
  ...aria
}: SelectProps<T>) {
  const autoId = useId()
  const triggerId = id ?? `${autoId}-trigger`
  const listId = `${autoId}-list`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; placement: 'bottom' | 'top' }>()
  const typeahead = useRef({ text: '', at: 0 })

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = options[selectedIndex]

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - GAP - 8
    const above = r.top - GAP - 8
    const placement = below < Math.min(MAX_MENU_H, 180) && above > below ? 'top' : 'bottom'
    const maxHeight = Math.min(MAX_MENU_H, placement === 'bottom' ? below : above)
    const width = Math.max(r.width, menuMinWidth ?? 0)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({ top: placement === 'bottom' ? r.bottom + GAP : r.top - GAP, left: Math.max(8, left), width, maxHeight, placement })
  }, [menuMinWidth])

  const openMenu = (index = selectedIndex) => {
    if (disabled) return
    place()
    setActive(index >= 0 ? index : firstEnabled(options))
    setOpen(true)
  }

  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  const commit = (i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    onChange(o.value)
    close()
  }

  // Show/hide in the top layer; fall back to plain fixed positioning where the Popover API is missing (jsdom).
  useLayoutEffect(() => {
    const m = menuRef.current as (HTMLUListElement & { showPopover?: () => void; hidePopover?: () => void }) | null
    if (!m) return
    if (open) {
      try { m.showPopover?.() } catch { /* already open */ }
    }
    return () => {
      try { m.hidePopover?.() } catch { /* already closed */ }
    }
  }, [open])

  // Close on outside click, keep position on scroll/resize.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  // Keep the active option in view.
  useEffect(() => {
    if (open && active >= 0) menuRef.current?.children[active]?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active])

  const move = (from: number, step: 1 | -1) => {
    let i = from
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length
      if (!options[i].disabled) return i
    }
    return from
  }

  const onTypeahead = (key: string) => {
    const now = Date.now()
    const ta = typeahead.current
    ta.text = now - ta.at > 600 ? key : ta.text + key
    ta.at = now
    const start = open ? active : selectedIndex
    const order = [...options.keys()].map((k) => (k + start + 1) % options.length)
    const hit = order.find((i) => !options[i].disabled && options[i].label.toLowerCase().startsWith(ta.text.toLowerCase()))
    return hit
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        if (!open) openMenu(selectedIndex)
        else if (e.altKey && step === -1) commit(active)
        else setActive((a) => move(a < 0 ? (step === 1 ? -1 : 0) : a, step))
        break
      }
      case 'Home':
      case 'End':
        if (!open) return
        e.preventDefault()
        setActive(e.key === 'Home' ? firstEnabled(options) : move(0, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) commit(active)
        else openMenu()
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          e.stopPropagation() // don't close the surrounding dialog
          close()
        }
        break
      case 'Tab':
        if (open) close(false)
        break
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const hit = onTypeahead(e.key)
          if (hit === undefined) return
          if (open) setActive(hit)
          else onChange(options[hit].value)
        }
    }
  }

  return (
    <div className={clsx('control', 'select', `control--${inputSize}`, invalid && 'is-invalid', disabled && 'is-disabled', open && 'is-open', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        className="select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-label={aria['aria-label']}
        aria-describedby={aria['aria-describedby']}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        {selected?.icon && <span className="select__icon">{selected.icon}</span>}
        <span className={clsx('select__value', !selected && 'is-placeholder')}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="select__chevron" size={16} aria-hidden />
      </button>

      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-labelledby={triggerId}
        popover={supportsPopover ? 'manual' : undefined}
        className={clsx('select__menu', pos?.placement === 'top' && 'is-top')}
        hidden={!open}
        style={pos && { top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
        tabIndex={-1}
        onClick={(e) => e.preventDefault() /* clicks on padding or disabled options must not reach a wrapping <label> either */}
      >
        {options.map((o, i) => (
          <li
            key={String(o.value)}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled || undefined}
            className={clsx('select__option', i === active && 'is-active', o.value === value && 'is-selected', o.disabled && 'is-disabled')}
            onPointerMove={() => !o.disabled && setActive(i)}
            onPointerDown={(e) => e.preventDefault() /* keep focus on the trigger */}
            onClick={(e) => {
              // Cancel the click so a wrapping <label> doesn't forward it to the trigger and reopen the menu.
              e.preventDefault()
              commit(i)
            }}
          >
            {o.icon && <span className="select__icon">{o.icon}</span>}
            <span className="select__text">
              <span className="select__label">{o.label}</span>
              {o.description && <span className="select__desc">{o.description}</span>}
            </span>
            <Check size={16} className="select__check" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  )
}

const firstEnabled = (options: { disabled?: boolean }[]) => Math.max(0, options.findIndex((o) => !o.disabled))
