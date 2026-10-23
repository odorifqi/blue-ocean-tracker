import clsx from 'clsx'
import { BarChart3, Boxes, Workflow } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandMark } from './Brand'
import { ReviewerKit } from './ReviewerKit'
import { ThemeSwitch } from './ThemeSwitch'

export function Layout({ mock }: { mock: boolean }) {
  const { pathname } = useLocation()
  // The list lives at "/", and a cylinder's detail page belongs to it too.
  const onCylinders = pathname === '/' || pathname.startsWith('/cylinders')
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <BrandMark />
          <span className="brand__text">
            <span className="brand__name">Cylinder Tracker</span>
            <span className="brand__sub">Gas asset lifecycle</span>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className={clsx('nav__item', onCylinders && 'is-active')} aria-current={onCylinders ? 'page' : undefined} aria-label="Cylinders">
            <Boxes size={17} aria-hidden /> <span>Cylinders</span>
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => clsx('nav__item', isActive && 'is-active')} aria-label="Analytics">
            <BarChart3 size={17} aria-hidden /> <span>Analytics</span>
          </NavLink>
          <NavLink to="/status-rules" className={({ isActive }) => clsx('nav__item', isActive && 'is-active')} aria-label="Status rules">
            <Workflow size={17} aria-hidden /> <span>Status rules</span>
          </NavLink>
        </nav>
        <div className="sidebar__foot">
          <ThemeSwitch />
          {mock && <p className="sidebar__env"><span className="env-dot" /> Demo data</p>}
        </div>
      </aside>
      <main id="main" className="main">
        <Outlet />
      </main>
      <ReviewerKit mock={mock} />
    </div>
  )
}
