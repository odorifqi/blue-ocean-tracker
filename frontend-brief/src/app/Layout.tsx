import clsx from 'clsx'
import { Boxes, Database, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { APP_NAME } from '../lib/hooks'
import { BrandMark } from './Brand'
import { ReviewerKit } from './ReviewerKit'
import { ThemeSwitch } from './ThemeSwitch'

export function Layout({ mock }: { mock: boolean }) {
  const { pathname } = useLocation()
  // The list lives at "/", and a cylinder's detail page belongs to it too.
  const onCylinders = pathname === '/' || pathname.startsWith('/cylinders')
  // Phones only: the pages, the theme and the data note live behind one Menu button.
  // It remembers the page it was opened on, so moving to another page closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const menuOpen = openOn === pathname
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null)
  const menuButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpenOn(null)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className={clsx('shell', menuOpen && 'menu-open')}>
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <BrandMark />
          <span className="brand__text">
            <span className="brand__name">{APP_NAME}</span>
            <span className="brand__sub">Gas asset lifecycle</span>
          </span>
        </NavLink>
        {mock && (
          <p className="env-badge" title="The data lives in this browser, and changes are saved here only.">
            <Database size={12} aria-hidden /> Demo data
          </p>
        )}
        <button
          ref={menuButton}
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
        {/* On desktop this wrapper has no box of its own; on phones it is the drop-down menu. */}
        <div className="sidebar__menu" id="main-menu">
          {/* Also closes when the tapped link is the page you're already on. */}
          <nav className="nav" aria-label="Main" onClick={() => setOpenOn(null)}>
            <NavLink to="/" end className={clsx('nav__item', onCylinders && 'is-active')} aria-current={onCylinders ? 'page' : undefined}>
              <Boxes size={17} aria-hidden /> <span>Cylinders</span>
            </NavLink>
          </nav>
          <div className="sidebar__foot">
            <div className="menu-row">
              <span className="menu-row__label">Appearance</span>
              <ThemeSwitch />
            </div>
            {mock && (
              <p className="menu-env">
                <Database size={15} aria-hidden />
                <span><strong>Demo data.</strong> Stored in this browser only.</span>
              </p>
            )}
          </div>
        </div>
      </aside>
      {menuOpen && <div className="menu-scrim" onClick={() => setMenuOpen(false)} aria-hidden />}
      <main id="main" className="main">
        <Outlet />
      </main>
      <ReviewerKit mock={mock} />
    </div>
  )
}
