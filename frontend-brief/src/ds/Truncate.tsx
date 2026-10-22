import clsx from 'clsx'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Single-line text that ellipsises and exposes the full value on hover/focus only when it's actually cut off. */
export function Truncate({ text, className, lines = 1, children }: { text: string; className?: string; lines?: 1 | 2; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setCut(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : undefined
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [text])

  return (
    <span ref={ref} className={clsx('truncate', lines === 2 && 'truncate--2', className)} title={cut ? text : undefined} data-tip={cut ? text : undefined}>
      {children ?? text}
    </span>
  )
}
