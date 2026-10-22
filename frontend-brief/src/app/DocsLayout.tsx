import { ArrowLeft } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { APP_NAME } from '../lib/hooks'
import { BrandMark } from './Brand'
import { ThemeSwitch } from './ThemeSwitch'

/**
 * The design system is documentation for reviewers, not part of the product,
 * so it gets its own frame instead of the app's sidebar.
 */
export function DocsLayout() {
  return (
    <div className="docs-shell">
      <header className="docs-bar">
        <div className="docs-bar__inner">
          <Link to="/" className="docs-bar__back">
            <ArrowLeft size={16} /> Back to app
          </Link>
          <span className="docs-bar__title">
            <BrandMark size={22} />
            <span>{APP_NAME}</span>
            <span className="docs-bar__sep" aria-hidden>/</span>
            <strong>Design system</strong>
          </span>
          <ThemeSwitch />
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
    </div>
  )
}
