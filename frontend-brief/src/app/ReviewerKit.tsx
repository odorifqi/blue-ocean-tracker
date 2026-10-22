import clsx from 'clsx'
import { ArrowUpRight, BookOpen, Palette, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button, IconButton, Select, useToast } from '../ds'
import { db } from '../mocks/db'
import { mockSettings, type FailureMode } from '../mocks/settings'
import { ThemeSwitch } from './ThemeSwitch'

const REPO_README = (import.meta.env.VITE_README_URL as string | undefined) ?? ''

/**
 * The "Miscellaneous" panel: things that sit outside the product navigation,
 * like the design system, the colour theme, notes on the build, and (in mock
 * mode) knobs to force loading and error states.
 */
export function ReviewerKit({ mock }: { mock: boolean }) {
  const [open, setOpen] = useState(false)
  const settings = useSyncExternalStore(mockSettings.subscribe, mockSettings.get)
  const failing = mock && settings.failure !== 'none'

  return (
    <div className={clsx('kit', open && 'is-open')}>
      {open ? (
        <section className="kit__panel" aria-label="Miscellaneous">
          <header className="kit__head">
            <span><SlidersHorizontal size={15} aria-hidden /> Miscellaneous</span>
            <IconButton label="Close miscellaneous panel" size="sm" onClick={() => setOpen(false)}><X size={16} /></IconButton>
          </header>
          <p className="kit__note">Shortcuts and display settings that live outside the main Blue Ocean Tracker screens.</p>

          <Link to="/design-system" className="kit__link" onClick={() => setOpen(false)}>
            <span className="kit__link-icon"><Palette size={18} /></span>
            <span className="kit__link-text">
              <strong>Design system</strong>
              <span>Tokens, components and patterns behind the app</span>
            </span>
            <ArrowUpRight size={16} className="kit__link-arrow" aria-hidden />
          </Link>

          <div className="kit__theme">
            <span className="kit__theme-text">
              <strong>Appearance</strong>
              <span>Light, dark or follow your system</span>
            </span>
            <ThemeSwitch />
          </div>
          {REPO_README && (
            <a href={REPO_README} target="_blank" rel="noreferrer" className="kit__link">
              <span className="kit__link-icon"><BookOpen size={18} /></span>
              <span className="kit__link-text">
                <strong>Build notes</strong>
                <span>Setup, decisions and assumptions (README)</span>
              </span>
              <ArrowUpRight size={16} className="kit__link-arrow" aria-hidden />
            </a>
          )}

          {mock && <DemoControls />}
        </section>
      ) : (
        <button className={clsx('kit__fab', failing && 'is-warn')} onClick={() => setOpen(true)} aria-label="Open miscellaneous panel">
          <SlidersHorizontal size={16} /> <span className="kit__fab-label">Miscellaneous</span>
          {failing && <span className="kit__flag">failing</span>}
        </button>
      )}
    </div>
  )
}

function DemoControls() {
  const settings = useSyncExternalStore(mockSettings.subscribe, mockSettings.get)
  const qc = useQueryClient()
  const toast = useToast()
  const refetch = () => qc.invalidateQueries()

  return (
    <div className="kit__section">
      <h3 className="kit__section-title">Demo controls</h3>
      <p className="kit__note">The API runs in your browser and follows the brief’s contract. Use these to see loading and error states.</p>
      <label className="kit__row">
        <span>Network delay <strong className="tabular">{settings.latency} ms</strong></span>
        <input type="range" min={0} max={3000} step={50} value={settings.latency} onChange={(e) => mockSettings.set({ latency: Number(e.target.value) })} />
      </label>
      <div className="kit__row">
        <span>Failure</span>
        <Select<FailureMode>
          inputSize="sm"
          value={settings.failure}
          onChange={(v) => { mockSettings.set({ failure: v }); refetch() }}
          aria-label="Failure mode"
          options={[
            { value: 'none', label: 'None' },
            { value: 'next', label: 'Fail the next request', description: 'One HTTP 500, then back to normal' },
            { value: 'always', label: 'Fail every request', description: 'HTTP 500 until you switch back' },
            { value: 'offline', label: 'Offline', description: 'Network error, as if the server is unreachable' },
          ]}
        />
      </div>
      <Button size="sm" icon={<RotateCcw size={14} />} onClick={() => { db.reset(); refetch(); toast.success('Data reset', 'Back to the 87 records from cylinders.json') }}>
        Reset data to the JSON seed
      </Button>
    </div>
  )
}
