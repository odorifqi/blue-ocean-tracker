import { useLayoutEffect, useRef } from 'react'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Reveals an element once, the first time 15% of it scrolls into view: it rises into place
 * and its chart bars grow from zero. Elements already on screen at mount only grow their bars,
 * because the page entrance already moved them. Nothing is hidden under reduced motion or
 * when IntersectionObserver is missing, so content never depends on this to be seen.
 */
export function useReveal<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!enabled || !el || typeof IntersectionObserver === 'undefined' || reducedMotion()) return
    const aboveFold = el.getBoundingClientRect().top < window.innerHeight
    el.classList.add('reveal', 'is-pending')
    el.classList.toggle('is-above-fold', aboveFold)
    const show = () => {
      el.classList.remove('is-pending')
      el.classList.add('is-in')
    }
    let frame = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        // Two frames, so the pending state is painted before the bars start growing.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(show) })
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
      el.classList.remove('is-pending')
    }
  }, [enabled])
  return ref
}
