import { ArrowRight, Info, PencilLine, Plus, Repeat2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FilterPills,
  IconButton,
  Input,
  Menu,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  ToastCard,
  Truncate,
  useToast,
} from '../ds'
import { ApiError } from '../lib/api'
import { GAS_TYPES, STATUSES, STATUS_DESCRIPTION, STATUS_LABEL, type CylinderStatus, type GasType } from '../lib/domain'
import { GAS_META } from '../lib/gas'
import { GasSwatch } from '../features/cylinders/bits'
import { useServerError } from '../features/cylinders/ServerError'
import { useDocumentTitle } from '../lib/hooks'

const SECTIONS = [
  ['principles', 'Principles'],
  ['color', 'Colour'],
  ['type', 'Typography'],
  ['space', 'Space, radius, elevation'],
  ['motion', 'Motion'],
  ['buttons', 'Buttons'],
  ['inputs', 'Inputs'],
  ['status', 'Status & badges'],
  ['navigation', 'Filters & pagination'],
  ['feedback', 'Feedback states'],
  ['overlays', 'Dialogs & toasts'],
  ['data', 'Messy data'],
] as const

function useTokenValue(name: string) {
  const [v, setV] = useState('')
  useEffect(() => {
    const read = () => setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [name])
  return v
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="sg-section" aria-labelledby={`${id}-h`}>
      <header className="sg-section__head">
        <h2 id={`${id}-h`}>{title}</h2>
        {intro && <p>{intro}</p>}
      </header>
      {children}
    </section>
  )
}

function Specimen({ label, children, code, stack }: { label: string; children: ReactNode; code?: string; stack?: boolean }) {
  return (
    <figure className="specimen">
      <div className={stack ? 'specimen__stage specimen__stage--stack' : 'specimen__stage'}>{children}</div>
      <figcaption className="specimen__cap">
        <span>{label}</span>
        {code && <code>{code}</code>}
      </figcaption>
    </figure>
  )
}

function Swatch({ token, label }: { token: string; label?: string }) {
  const value = useTokenValue(token)
  return (
    <div className="swatch">
      <span className="swatch__chip" style={{ background: `var(${token})` }} />
      <span className="swatch__name">{label ?? token.replace('--', '')}</span>
      <code className="swatch__val">{value}</code>
    </div>
  )
}

const MOTION_TOKENS = [
  ['--duration-fast', 'Hover, press, new table rows fading in'],
  ['--duration-base', 'Menus, stale rows dimming, the table header shadow'],
  ['--duration-slow', 'Dialogs, toasts, page and card entrances'],
  ['--motion-stagger', 'Delay between entrance blocks. At most 4 blocks per page'],
  ['--motion-rise', 'How far an entering block travels'],
  ['--ease-out', 'Every entrance: a fast start and a soft landing'],
] as const

function MotionToken({ token, use }: { token: string; use: string }) {
  const value = useTokenValue(token)
  return (
    <div className="type-row">
      <code>{token}</code>
      <span className="tabular">{value}</span>
      <span className="muted">{use}</span>
    </div>
  )
}

const gasOptions = GAS_TYPES.map((g) => ({ value: g, label: g, icon: <GasSwatch gas={g} showLabel={false} /> }))

const RAMP = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']

export function StyleGuidePage() {
  useDocumentTitle('Design system')
  const toast = useToast()
  const showServerError = useServerError()
  const [dialog, setDialog] = useState(false)
  const [pill, setPill] = useState<CylinderStatus | ''>('')
  const [page, setPage] = useState(4)
  const [search, setSearch] = useState('')
  const [gas, setGas] = useState<GasType>('Argon')
  const [failure, setFailure] = useState('next')
  const [active, setActive] = useState<string>('principles')
  const [motionRun, setMotionRun] = useState(0)
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' },
    )
    mainRef.current?.querySelectorAll('.sg-section').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  return (
    <div className="page sg">
      <header className="page__header enter">
        <div>
          <p className="page__eyebrow">Design library · v1.0</p>
          <h1 className="page__title">Design system</h1>
          <p className="page__subtitle">
            Tokens and components behind Blue Ocean Tracker. Everything here is the live component the app uses. Use the theme switch at the top right to see dark mode.
          </p>
        </div>
      </header>

      <div className="sg__layout">
        <nav className="sg__toc" aria-label="On this page">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? 'is-active' : undefined}>{label}</a>
          ))}
        </nav>

        <div className="sg__content" ref={mainRef}>
          <Section id="principles" title="Principles">
            <div className="principles">
              <div className="principle">
                <span className="principle__n">01</span>
                <h3>Status first</h3>
                <p>Operators scan for where a cylinder is. Each status has one colour, one dot and one label, used the same way everywhere.</p>
              </div>
              <div className="principle">
                <span className="principle__n">02</span>
                <h3>Prevent, then explain</h3>
                <p>The UI only offers moves the lifecycle allows, and checks input before sending it. If the server still says no, the reason is shown in plain words.</p>
              </div>
              <div className="principle">
                <span className="principle__n">03</span>
                <h3>Built for real data</h3>
                <p>Names with apostrophes, accents and 100+ characters, and serials that look alike. Layouts truncate cleanly, and serials use a monospaced, tabular font.</p>
              </div>
            </div>
          </Section>

          <Section id="color" title="Colour" intro="Primitives are raw values. Components only use semantic tokens, so the dark theme swaps one layer.">
            <h3 className="sg-sub">Primitives</h3>
            {(['blue', 'slate'] as const).map((name) => (
              <div key={name} className="ramp">
                <span className="ramp__name">{name}</span>
                <div className="ramp__chips">
                  {RAMP.map((step) => (
                    <span key={step} className="ramp__chip" style={{ background: `var(--${name}-${step})` }} title={`--${name}-${step}`}>
                      <span>{step}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <h3 className="sg-sub">Semantic</h3>
            <div className="swatches">
              {['--bg-canvas', '--bg-surface', '--bg-muted', '--fg-default', '--fg-muted', '--fg-subtle', '--border-default', '--accent', '--accent-subtle', '--danger', '--warning-fg', '--success-fg'].map((t) => (
                <Swatch key={t} token={t} />
              ))}
            </div>
            <h3 className="sg-sub">Status</h3>
            <div className="status-spec">
              {STATUSES.map((s) => {
                const k = s === 'InMaintenance' ? 'maintenance' : s.toLowerCase()
                return (
                  <div key={s} className="status-spec__row">
                    <StatusBadge status={s} />
                    <p>{STATUS_DESCRIPTION[s]}</p>
                    <code>--status-{k}-*</code>
                  </div>
                )
              })}
            </div>
            <h3 className="sg-sub">Gas identification</h3>
            <p className="sg-note">Swatches follow ISO 32 shoulder colours, so the screen matches the paint on the physical cylinder. Upright bars in two sizes: small (8×16) inline with text, large (12×30) in pickers. Every bar has the same thin edge so white and black stay visible in both themes.</p>
            <div className="gas-spec">
              {GAS_TYPES.map((g) => (
                <div key={g} className="gas-spec__item">
                  <GasSwatch gas={g} showLabel={false} size="lg" />
                  <strong>{g}</strong>
                  <span className="muted">{GAS_META[g].formula} · <span className="mono">{GAS_META[g].color}</span></span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="type" title="Typography" intro="Inter Variable for UI, JetBrains Mono for serial numbers and codes. Body text is 14px, for dense operational screens. Every plain value in a table cell has one style: regular weight, default colour, one size per table. Grey is only for things that aren’t values: the “—” placeholder, field labels and the struck-out old value.">
            <div className="type-scale">
              {[
                ['--text-3xl', '32 / 600', 'Page title'],
                ['--text-2xl', '24 / 600', 'Section title'],
                ['--text-lg', '16 / 600', 'Card & dialog title'],
                ['--text-md', '14 / 420', 'Body, table cells, inputs'],
                ['--text-sm', '13 / 420', 'Secondary text, hints'],
                ['--text-xs', '12 / 520', 'Labels, badges, captions'],
              ].map(([t, spec, use]) => (
                <div key={t} className="type-row">
                  <code>{t}</code>
                  <span style={{ fontSize: `var(${t})`, fontWeight: t.match(/3xl|2xl|xl|lg/) ? 600 : undefined }}>Cylinder lifecycle</span>
                  <span className="muted">{spec} · {use}</span>
                </div>
              ))}
              <div className="type-row">
                <code>--font-mono</code>
                <span className="mono" style={{ fontSize: 'var(--text-lg)' }}>CYL-012300 · CYL-012030</span>
                <span className="muted">Tabular numbers keep look-alike serials easy to tell apart</span>
              </div>
            </div>
          </Section>

          <Section id="space" title="Space, radius, elevation" intro="A 4px grid. Radius grows with component size. Shadows are used only for things that float.">
            <div className="space-scale">
              {['1', '2', '3', '4', '5', '6', '8', '10', '12', '16'].map((s) => (
                <div key={s} className="space-row">
                  <code>--space-{s}</code>
                  <span className="space-bar" style={{ width: `var(--space-${s})` }} />
                </div>
              ))}
            </div>
            <div className="shape-grid">
              {['xs', 'sm', 'md', 'lg', 'xl', 'full'].map((r) => (
                <div key={r} className="shape" style={{ borderRadius: `var(--radius-${r})` }}><code>radius-{r}</code></div>
              ))}
            </div>
            <div className="shape-grid">
              {['xs', 'sm', 'md', 'lg'].map((s) => (
                <div key={s} className="elev" style={{ boxShadow: `var(--shadow-${s})` }}><code>shadow-{s}</code></div>
              ))}
            </div>
          </Section>

          <Section
            id="motion"
            title="Motion"
            intro="Motion shows order and change, never decoration. Only opacity and transform move, so nothing shifts and clicks always land. With “Reduce motion” on, everything appears at once."
          >
            <div className="type-scale">
              {MOTION_TOKENS.map(([t, use]) => <MotionToken key={t} token={t} use={use} />)}
            </div>
            <div className="motion-replay">
              <Button size="sm" icon={<Repeat2 size={15} />} onClick={() => setMotionRun((n) => n + 1)}>Replay</Button>
            </div>
            <Specimen label="Page entrance: header, controls, content, 50 ms apart" code={`className="enter" style={{ '--i': n }}`}>
              <div key={motionRun} className="motion-demo">
                {['Header', 'Search and filters', 'Table'].map((t, i) => (
                  <div key={t} className="motion-demo__block enter" style={{ '--i': i } as CSSProperties}>{t}</div>
                ))}
              </div>
            </Specimen>
          </Section>

          <Section id="buttons" title="Buttons" intro="One primary action per view. Soft is the strongest action inside a repeated row, so a table never shows a column of solid buttons. Destructive actions use danger and always go through a confirmation step.">
            <Specimen label="Variants" code="<Button variant>">
              <Button variant="primary" icon={<Plus size={16} />}>New cylinder</Button>
              <Button>Secondary</Button>
              <Button variant="soft">Soft</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon={<Trash2 size={16} />}>Retire</Button>
            </Specimen>
            <Specimen label="Sizes" code="size = sm | md | lg">
              <Button size="sm" variant="primary">Small</Button>
              <Button size="md" variant="primary">Medium</Button>
              <Button size="lg" variant="primary">Large</Button>
            </Specimen>
            <Specimen label="States" code="loading · disabled · icon">
              <Button variant="primary" loading>Saving</Button>
              <Button disabled>Disabled</Button>
              <Button iconRight={<ArrowRight size={16} />}>Review</Button>
              <IconButton label="Change status" variant="secondary"><Repeat2 size={16} /></IconButton>
            </Specimen>
            <Specimen label="Menu button: a row's actions on phones. The main action comes first and tinted; a disabled item says why. Keyboard: ↑ ↓ Home End, Enter, Esc" code="<Menu label items>">
              <Menu
                label="Actions for CYL-118204"
                items={[
                  { label: 'Detail', icon: <Info size={16} />, primary: true, onSelect: () => {} },
                  { label: 'Edit details', icon: <PencilLine size={16} />, separated: true, onSelect: () => {} },
                  { label: 'Change status', icon: <Repeat2 size={16} />, onSelect: () => {}, disabled: true, hint: 'Retired is final' },
                ]}
              />
            </Specimen>
          </Section>

          <Section id="inputs" title="Inputs" intro="Labels sit above fields. Hints explain the format, and errors replace hints so the layout doesn’t jump.">
            <div className="spec-grid">
              <Specimen label="Default + hint" stack>
                <Field label="Customer name" hint="The party receiving the cylinder." counter={{ value: 18, max: 120 }}>
                  {(p) => <Input id={p.id} aria-describedby={p.describedBy} defaultValue="PT Café Nusantara" />}
                </Field>
              </Specimen>
              <Specimen label="Error" stack>
                <Field label="Serial number" required error="Use 'CYL-' followed by 6 digits, e.g. CYL-012345.">
                  {(p) => <Input id={p.id} aria-describedby={p.describedBy} invalid prefix={<span className="serial-prefix">CYL-</span>} className="mono serial-input" defaultValue="12A" />}
                </Field>
              </Specimen>
              <Specimen label="Select: with icons" stack>
                <Field label="Gas type">
                  {(p) => <Select id={p.id} value={gas} onChange={setGas} options={gasOptions} />}
                </Field>
              </Specimen>
              <Specimen label="Select: placeholder + error" stack>
                <Field label="Gas type" required error="Choose a gas type.">
                  {(p) => <Select id={p.id} aria-describedby={p.describedBy} invalid value={undefined} onChange={() => {}} options={gasOptions} placeholder="Choose a gas" />}
                </Field>
              </Specimen>
              <Specimen label="Disabled" stack>
                <Field label="Status" hint="Changed through the status action, not here.">
                  {(p) => <Input id={p.id} disabled value="Delivered" readOnly />}
                </Field>
              </Specimen>
            </div>
            <Specimen label="Select: descriptions, small size. Keyboard: ↑ ↓ Home End, Enter, Esc, type to jump" code="<Select options>" stack>
              <div style={{ maxWidth: 280 }}>
                <Select
                  inputSize="sm"
                  aria-label="Failure mode"
                  value={failure}
                  onChange={setFailure}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'next', label: 'Fail the next request', description: 'One HTTP 500, then back to normal' },
                    { value: 'always', label: 'Fail every request', description: 'HTTP 500 until you switch back' },
                    { value: 'offline', label: 'Offline', description: 'Network error', disabled: true },
                  ]}
                />
              </div>
            </Specimen>
            <Specimen label="Search (press / to focus, Esc to clear)" code="<SearchInput>" stack>
              <SearchInput value={search} onChange={setSearch} placeholder="Search serial number or customer" shortcut={false} />
            </Specimen>
          </Section>

          <Section id="status" title="Status & badges">
            <Specimen label="Status badge" code="<StatusBadge status size>">
              {STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
            </Specimen>
            <Specimen label="Small" code='size="sm"'>
              {STATUSES.map((s) => <StatusBadge key={s} status={s} size="sm" />)}
            </Specimen>
            <Specimen label="Tone badges" code="<Badge tone>">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
            </Specimen>
          </Section>

          <Section id="navigation" title="Filters & pagination">
            <Specimen label="Filter pills, single select" code="<FilterPills>">
              <FilterPills
                label="Status"
                value={pill}
                onChange={setPill}
                options={[{ value: '', label: 'All' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
              />
            </Specimen>
            <Specimen label="Pagination" code="<Pagination>" stack>
              <Pagination page={page} pageSize={10} totalCount={87} onPageChange={setPage} onPageSizeChange={() => {}} />
            </Specimen>
          </Section>

          <Section id="feedback" title="Feedback states" intro="Every screen that loads data has a loading, empty and error state.">
            <div className="spec-grid">
              <Specimen label="Loading: skeleton" stack>
                <div className="skeleton-demo">
                  {[80, 64, 92].map((w, i) => (
                    <div key={i} className="skeleton-demo__row">
                      <Skeleton width={84} /><Skeleton width={60} height={20} radius={99} /><Skeleton width={`${w}%`} />
                    </div>
                  ))}
                </div>
              </Specimen>
              <Specimen label="Empty: no results" stack>
                <EmptyState compact title="No cylinders match" description="Check the serial number or try another filter." action={<Button size="sm">Clear filters</Button>} />
              </Specimen>
              <Specimen label="Error: server" stack>
                <ErrorState compact error={new ApiError(500, { title: 'Server error', detail: 'The data couldn’t be loaded.' })} onRetry={() => {}} />
              </Specimen>
              <Specimen label="Error: offline" stack>
                <ErrorState compact error={new ApiError(0, { detail: 'Check your connection and try again.' })} onRetry={() => {}} />
              </Specimen>
            </div>
          </Section>

          <Section id="overlays" title="Dialogs & toasts" intro="Dialogs use the native <dialog> element, so focus trapping and Esc come for free. Toasts report what just happened, with a solid colour per outcome and white text. Errors from the server open a pop-up.">
            <Specimen label="Toast tones: solid fill, white text and icon. Every fill clears 4.5:1 against white, in both themes." code="<ToastCard tone> · --toast-*-bg" stack>
              <div className="sg-toasts">
                <ToastCard tone="success" title="Cylinder registered" description="CYL-123456 · Oxygen" onDismiss={() => {}} />
                <ToastCard tone="error" title="Couldn’t save" description="The server didn’t respond. Try again in a moment." onDismiss={() => {}} />
                <ToastCard tone="warning" title="Still waiting for the server" description="The free host may be waking up." onDismiss={() => {}} />
                <ToastCard tone="info" title="Data reset" description="Showing the 87 cylinders from the JSON seed." onDismiss={() => {}} />
              </div>
            </Specimen>
            <Specimen label="Try them" code="<Dialog> · useToast() · useServerError()">
              <Button onClick={() => setDialog(true)}>Open dialog</Button>
              <Button onClick={() => toast.success('Cylinder registered', 'CYL-123456 · Oxygen')}>Success toast</Button>
              <Button onClick={() => toast.error('Couldn’t save', 'Try again in a moment.')}>Error toast</Button>
              <Button onClick={() => toast.warning('Still waiting for the server', 'The free host may be waking up.')}>Warning toast</Button>
              <Button onClick={() => toast.info('Data reset', 'Showing the 87 cylinders from the JSON seed.')}>Info toast</Button>
              <Button
                onClick={() =>
                  showServerError(
                    new ApiError(409, {
                      title: 'Duplicate serial number',
                      detail: 'A cylinder with serial number CYL-703757 already exists.',
                      errors: { serialNumber: ['CYL-703757 is already registered.'] },
                    }),
                    'Couldn’t register the cylinder.',
                  )
                }
              >
                Server error pop-up
              </Button>
            </Specimen>
            <Dialog
              open={dialog}
              onClose={() => setDialog(false)}
              icon={<Repeat2 size={20} />}
              title="Dialog title"
              description="Short description of what this dialog does."
              footer={<><Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button><Button variant="primary" onClick={() => setDialog(false)}>Confirm</Button></>}
            >
              <p>Body content. Keep it to one task.</p>
            </Dialog>
          </Section>

          <Section id="data" title="Messy data" intro="Patterns for the dirty data the brief calls out.">
            <div className="spec-grid">
              <Specimen label="Long names truncate, full text on hover" stack>
                <div style={{ maxWidth: 260 }}>
                  <Truncate text="PT Persada Karya Multi Sarana Teknik Industri dan Perdagangan Umum Nusantara Sentosa Abadi Makmur Jaya" />
                </div>
              </Specimen>
              <Specimen label="Look-alike serials in mono" stack>
                <span className="mono">CYL-012300</span>
                <span className="mono">CYL-012030</span>
              </Specimen>
              <Specimen label="Serial input normalises paste" stack>
                <span className="muted">“ cyl-012345 ” → <span className="mono">CYL-012345</span></span>
              </Specimen>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
