import clsx from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  /** Shown under a disabled item, so the reason is visible, not just a greyed-out word. */
  hint?: string
  /** The item the menu exists for (e.g. Detail): tinted like a soft button. */
  primary?: boolean
  /** Draws a divider above this item. */
  separated?: boolean
}

export interface MenuProps {
  /** Accessible name of the trigger, e.g. "Actions for CYL-703757". */
  label: string
  items: MenuItem[]
  className?: string
}

const GAP = 6
const WIDTH = 216
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

/**
 * Menu button (WAI-ARIA "menu button" pattern): a ⋯ trigger that opens a short list of actions.
 * Like <Select>, the menu sits in the top layer (Popover API), so scroll containers never clip it.
 * Opens under the trigger, right-aligned, and flips above when there's no room below.
 */
export function Menu({ label, items, className }: MenuProps) {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'bottom' | 'top' }>()

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const height = menuRef.current?.offsetHeight || items.length * 44 + 8
    const placement = window.innerHeight - r.bottom - GAP < height + 8 && r.top > height + GAP ? 'top' : 'bottom'
    const left = Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8))
    setPos({ top: placement === 'bottom' ? r.bottom + GAP : r.top - GAP, left, placement })
  }, [items.length])

  const enabled = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  const openMenu = (focus: 'first' | 'last' = 'first') => {
    place()
    setOpen(true)
    requestAnimationFrame(() => {
      const list = enabled()
      ;(focus === 'first' ? list[0] : list[list.length - 1])?.focus()
    })
  }

  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  useLayoutEffect(() => {
    const m = menuRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void }) | null
    if (!m) return
    if (open) {
      try { m.showPopover?.() } catch { /* already open */ }
      place() // re-measure with the real height
    }
    return () => {
      try { m.hidePopover?.() } catch { /* already closed */ }
    }
  }, [open, place])

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

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(e.key === 'ArrowDown' ? 'first' : 'last')
    }
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = enabled()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus()
        break
      case 'Home':
      case 'End':
        e.preventDefault()
        ;(e.key === 'Home' ? list[0] : list[list.length - 1])?.focus()
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close()
        break
      case 'Tab':
        close(false)
        break
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={clsx('btn', 'btn--secondary', 'btn--sm', 'btn--icon', 'menu-trigger', open && 'is-open', className)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKey}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      <div
        ref={menuRef}
        id={`${id}-menu`}
        role="menu"
        aria-label={label}
        popover={supportsPopover ? 'manual' : undefined}
        className={clsx('menu', pos?.placement === 'top' && 'is-top')}
        hidden={!open}
        style={pos && { top: pos.top, left: pos.left, width: WIDTH }}
        onKeyDown={onMenuKey}
      >
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={it.disabled}
            className={clsx('menu__item', it.primary && 'is-primary', it.separated && 'is-separated')}
            onClick={() => {
              close()
              it.onSelect()
            }}
          >
            {it.icon && <span className="menu__icon" aria-hidden>{it.icon}</span>}
            <span className="menu__text">
              {it.label}
              {it.disabled && it.hint && <small className="menu__hint">{it.hint}</small>}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
