import clsx from 'clsx'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  counter?: { value: number; max: number }
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

/** Label + control + hint/error, wired up with the right aria attributes. */
export function Field({ label, hint, error, required, counter, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  const over = counter && counter.value > counter.max

  return (
    <div className={clsx('field', error && 'field--invalid')}>
      <div className="field__top">
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="field__req" aria-hidden> *</span>}
        </label>
        {counter && (
          <span className={clsx('field__counter tabular', over && 'is-over')} aria-live="polite">
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p className="field__error" id={errorId}>
          <CircleAlert size={14} aria-hidden /> {error}
        </p>
      ) : (
        hint && <p className="field__hint" id={hintId}>{hint}</p>
      )}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  invalid?: boolean
  prefix?: ReactNode
  suffix?: ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, prefix, suffix, inputSize = 'md', className, ...rest },
  ref,
) {
  return (
    <div className={clsx('control', `control--${inputSize}`, invalid && 'is-invalid', rest.disabled && 'is-disabled', className)}>
      {prefix && <span className="control__affix">{prefix}</span>}
      <input ref={ref} className="control__input" aria-invalid={invalid || undefined} {...rest} />
      {suffix && <span className="control__affix control__affix--end">{suffix}</span>}
    </div>
  )
})
