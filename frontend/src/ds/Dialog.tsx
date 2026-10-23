import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  tone?: 'default' | 'danger' | 'warning'
  size?: 'sm' | 'md'
  footer?: ReactNode
  children?: ReactNode
  /** Block closing (e.g. while a request is in flight). */
  dismissible?: boolean
}

/**
 * Built on the native <dialog> element: focus trapping, Esc handling and the
 * top layer come from the browser instead of being re-implemented.
 */
export function Dialog({ open, onClose, title, description, icon, tone = 'default', size = 'md', footer, children, dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={clsx('dialog', `dialog--${size}`, `dialog--${tone}`)}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose()
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            {icon && <div className="dialog__icon">{icon}</div>}
            <div className="dialog__titles">
              <h2 id={titleId} className="dialog__title">{title}</h2>
              {description && <p id={descId} className="dialog__desc">{description}</p>}
            </div>
            <IconButton label="Close" size="sm" onClick={onClose} disabled={!dismissible} className="dialog__close">
              <X size={18} />
            </IconButton>
          </header>
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
