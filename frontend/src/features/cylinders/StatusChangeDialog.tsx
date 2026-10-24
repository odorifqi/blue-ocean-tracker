import clsx from 'clsx'
import { ArrowRight, Repeat2, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Field, Input, StatusBadge, statusKey, useToast } from '../../ds'
import { ApiError, type Cylinder } from '../../lib/api'
import {
  CUSTOMER_NAME_MAX,
  PRIMARY_NEXT,
  STATUS_ACTION,
  STATUS_DESCRIPTION,
  STATUS_LABEL,
  TRANSITIONS,
  validateCustomerName,
  type CylinderStatus,
} from '../../lib/domain'
import { useChangeStatus } from '../../lib/queries'
import { useServerError } from './ServerError'

interface Props {
  cylinder: Cylinder
  open: boolean
  onClose: () => void
  /** Pre-select a target, e.g. when a node in the lifecycle diagram was clicked. */
  initialStatus?: CylinderStatus
}

export function StatusChangeDialog({ cylinder, open, onClose, initialStatus }: Props) {
  const options = TRANSITIONS[cylinder.status]
  const [target, setTarget] = useState<CylinderStatus | undefined>()
  const [customer, setCustomer] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string>()
  const mutation = useChangeStatus(cylinder.id)
  const toast = useToast()
  const showServerError = useServerError()

  useEffect(() => {
    if (!open) return
    setTarget(initialStatus ?? (options.length === 1 ? options[0] : undefined))
    setCustomer('')
    setTouched(false)
    setServerError(undefined)
    mutation.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStatus, cylinder.id])

  const needsCustomer = target === 'Delivered'
  const customerError = needsCustomer ? validateCustomerName(customer) : undefined
  const canSubmit = Boolean(target) && !customerError

  // Enter in the customer field can fire twice before React re-renders, so isPending alone is too late.
  const inFlight = useRef(false)

  async function submit() {
    setTouched(true)
    if (!target || customerError || inFlight.current) return
    inFlight.current = true
    try {
      const updated = await mutation.mutateAsync({ status: target, customerName: needsCustomer ? customer.trim() : null })
      toast.success(
        `${updated.serialNumber} is now ${STATUS_LABEL[updated.status].toLowerCase()}`,
        updated.customerName ? `Received by ${updated.customerName}` : undefined,
      )
      onClose()
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.fieldError('customerName'))
      showServerError(err, `Couldn’t change the status of ${cylinder.serialNumber}.`)
    } finally {
      inFlight.current = false
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!mutation.isPending}
      icon={<Repeat2 size={20} />}
      tone={target === 'Retired' ? 'danger' : 'default'}
      title="Change status"
      description={<>Move <span className="mono">{cylinder.serialNumber}</span> to its next step.</>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button
            variant={target === 'Retired' ? 'danger' : 'primary'}
            onClick={submit}
            loading={mutation.isPending}
            disabled={!target || (touched && !canSubmit)}
          >
            {target ? STATUS_ACTION[target] : 'Choose a status'}
          </Button>
        </>
      }
    >
      {/* Two labelled groups: the move being made (a fact, flat) and the moves allowed (choices, bordered). */}
      <div className="status-group">
        <span className="field__label" id="status-change-label">Status change</span>
        <div className="transition-summary" aria-labelledby="status-change-label" aria-live="polite">
          <StatusBadge status={cylinder.status} />
          <ArrowRight size={16} className="transition-summary__arrow" aria-hidden />
          {target ? <StatusBadge status={target} /> : <span className="transition-summary__placeholder">Next status</span>}
        </div>
      </div>

      <div className="status-group">
        <div className="status-group__label">
          <span className="field__label" id="next-status-label">Choose the next status</span>
          <span className="status-group__count">{options.length} allowed</span>
        </div>
        <div className="status-options" role="radiogroup" aria-labelledby="next-status-label">
          {options.map((s) => (
            <label key={s} className={clsx('status-option', target === s && 'is-selected', s === 'Retired' && 'is-danger')}>
              <input type="radio" name="next-status" value={s} checked={target === s} onChange={() => setTarget(s)} />
              <span className="status-option__radio" aria-hidden />
              <span className="status-option__head">
                {/* A dot, not the pill: the pill means "the status it is in now". */}
                <span className={clsx('status__dot', `status--${statusKey(s)}`)} aria-hidden />
                <span className="status-option__name">{STATUS_LABEL[s]}</span>
                {PRIMARY_NEXT[cylinder.status] === s && <span className="status-option__usual">Usual next step</span>}
              </span>
              <span className="status-option__desc">{STATUS_DESCRIPTION[s]}</span>
            </label>
          ))}
        </div>
      </div>

      {needsCustomer && (
        <Field
          label="Received by (customer)"
          required
          error={(touched && customerError) || serverError}
          hint="The external party taking the cylinder. Recorded on the delivery."
          counter={{ value: customer.trim().length, max: CUSTOMER_NAME_MAX }}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={customer}
              autoFocus
              placeholder="e.g. PT Sinar O'Brien Medika"
              onChange={(e) => {
                setCustomer(e.target.value)
                setServerError(undefined)
              }}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          )}
        </Field>
      )}

      {target === 'Retired' && (
        <p className="callout callout--danger">
          <TriangleAlert size={16} aria-hidden />
          Retiring is permanent. The cylinder can’t be filled, delivered or brought back into service.
        </p>
      )}
      {cylinder.status === 'Delivered' && target === 'Empty' && cylinder.customerName && (
        <p className="callout">
          {/* One span so the flex callout keeps this as a single wrapping sentence. */}
          <span>Returning clears the customer <strong>{cylinder.customerName}</strong> from this cylinder.</span>
        </p>
      )}
    </Dialog>
  )
}
