import clsx from 'clsx'
import { ArrowLeft, ArrowRight, ClipboardCheck, PackagePlus, PencilLine } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Dialog, Field, Input, useToast } from '../../ds'
import { ApiError, type Cylinder } from '../../lib/api'
import { GAS_TYPES, validateCylinderInput, type FieldErrors, type GasType } from '../../lib/domain'
import { GAS_META } from '../../lib/gas'
import { useCreateCylinder, useUpdateCylinder } from '../../lib/queries'
import { GasSwatch } from './bits'
import { useServerError } from './ServerError'

const PREFIX = 'CYL-'

const toDigits = (raw: string) => {
  const v = raw.trim().toUpperCase()
  return (v.startsWith(PREFIX) ? v.slice(PREFIX.length) : v).replace(/\D/g, '').slice(0, 6)
}

interface Props {
  open: boolean
  onClose: () => void
  /** Present when editing. */
  cylinder?: Cylinder
  onSaved?: (c: Cylinder) => void
}

export function CylinderFormDialog({ open, onClose, cylinder, onSaved }: Props) {
  const editing = Boolean(cylinder)
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [digits, setDigits] = useState('')
  const [gasType, setGasType] = useState<GasType | ''>('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const create = useCreateCylinder()
  const update = useUpdateCylinder(cylinder?.id ?? -1)
  const mutation = editing ? update : create
  const toast = useToast()
  const showServerError = useServerError()

  useEffect(() => {
    if (!open) return
    setStep('form')
    setDigits(cylinder ? toDigits(cylinder.serialNumber) : '')
    setGasType(cylinder?.gasType ?? '')
    setErrors({})
    setTouched({})
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cylinder?.id])

  const serialNumber = `${PREFIX}${digits}`
  const input = { serialNumber: digits ? serialNumber : '', gasType }
  const clientErrors = validateCylinderInput(input)
  if (digits && digits.length < 6) clientErrors.serialNumber = `Enter all 6 digits (${digits.length}/6).`
  const visible = (k: string) => (touched[k] ? (errors[k] ?? clientErrors[k]) : errors[k])

  const unchanged = editing && cylinder!.serialNumber === serialNumber && cylinder!.gasType === gasType

  function review(e: FormEvent) {
    e.preventDefault()
    setTouched({ serialNumber: true, gasType: true })
    setErrors({})
    if (Object.keys(clientErrors).length || unchanged) return
    setStep('review')
  }

  async function submit() {
    try {
      const saved = await mutation.mutateAsync({ serialNumber, gasType })
      toast.success(editing ? 'Cylinder updated' : 'Cylinder registered', `${saved.serialNumber} · ${saved.gasType}`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors).length) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
        setStep('form')
      }
      showServerError(err, editing ? `Couldn’t save ${cylinder!.serialNumber}.` : 'Couldn’t register the cylinder.')
    }
  }

  const pending = mutation.isPending

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      icon={step === 'review' ? <ClipboardCheck size={20} /> : editing ? <PencilLine size={20} /> : <PackagePlus size={20} />}
      title={step === 'review' ? 'Review before saving' : editing ? `Edit ${cylinder!.serialNumber}` : 'Register a cylinder'}
      description={
        step === 'review'
          ? 'Check the details. Saving writes to the shared register.'
          : editing
            ? 'Fix the serial number or gas type.'
            : 'New cylinders start as Empty, with no customer.'
      }
      footer={
        step === 'form' ? (
          <>
            {/* Sits beside the disabled Review button it explains. */}
            {unchanged && <p className="dialog__footer-note" id="unchanged-note">No changes yet.</p>}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form="cylinder-form" iconRight={<ArrowRight size={16} />} disabled={unchanged} aria-describedby={unchanged ? 'unchanged-note' : undefined}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep('form')} disabled={pending}>Back</Button>
            <Button variant="primary" onClick={submit} loading={pending} autoFocus>
              {editing ? 'Save changes' : 'Register cylinder'}
            </Button>
          </>
        )
      }
    >
      {step === 'form' ? (
        <form id="cylinder-form" className="form" onSubmit={review} noValidate>
          <Field
            label="Serial number"
            required
            error={visible('serialNumber')}
            hint="6 digits. Pasting a full serial like CYL-012345 works too."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="012345"
                className="mono serial-input"
                prefix={<span className="serial-prefix">{PREFIX}</span>}
                value={digits}
                onChange={(e) => {
                  setDigits(toDigits(e.target.value))
                  setErrors((x) => ({ ...x, serialNumber: undefined }))
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  setDigits(toDigits(e.clipboardData.getData('text')))
                }}
                onBlur={() => setTouched((t) => ({ ...t, serialNumber: true }))}
              />
            )}
          </Field>

          <fieldset className="field gas-picker" aria-describedby={visible('gasType') ? 'gas-error' : undefined}>
            <legend className="field__label">Gas type<span className="field__req" aria-hidden> *</span></legend>
            <div className="gas-picker__grid">
              {GAS_TYPES.map((g) => (
                <label key={g} className={clsx('gas-option', gasType === g && 'is-selected')}>
                  <input
                    type="radio"
                    name="gasType"
                    value={g}
                    checked={gasType === g}
                    onChange={() => {
                      setGasType(g)
                      setTouched((t) => ({ ...t, gasType: true }))
                      setErrors((x) => ({ ...x, gasType: undefined }))
                    }}
                  />
                  <GasSwatch gas={g} showLabel={false} size="lg" />
                  <span className="gas-option__name">{g}</span>
                  <span className="gas-option__formula" aria-hidden>{GAS_META[g].formula}</span>
                </label>
              ))}
            </div>
            {visible('gasType') && <p className="field__error" id="gas-error">{visible('gasType')}</p>}
          </fieldset>
        </form>
      ) : (
        <dl className="review">
          <ReviewRow label="Serial number" before={cylinder?.serialNumber} after={serialNumber} mono />
          <ReviewRow label="Gas type" before={cylinder?.gasType} after={gasType} />
        </dl>
      )}
    </Dialog>
  )
}

function ReviewRow({ label, before, after, mono }: { label: string; before?: string; after: string; mono?: boolean }) {
  const changed = before !== undefined && before !== after
  return (
    <div className={clsx('review__row', changed && 'is-changed')}>
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>
        {changed && (
          <>
            <del>{before}</del>
            <ArrowRight size={14} aria-label="changes to" />
          </>
        )}
        <ins>{after}</ins>
      </dd>
    </div>
  )
}
