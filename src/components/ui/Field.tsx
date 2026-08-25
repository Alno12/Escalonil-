import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  optional?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, optional, children }: FieldProps) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`.trim()}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="field__optional">opcional</span>}
      </label>
      {children}
      {error ? (
        <p className="field__message field__message--error">{error}</p>
      ) : (
        hint && <p className="field__message">{hint}</p>
      )}
    </div>
  )
}

/** Campos lado a lado (data + hora, por exemplo). */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="field-row">{children}</div>
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`.trim()} {...rest} />
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input input--area ${className}`.trim()} rows={3} {...rest} />
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select className={`input select ${className}`.trim()} {...rest}>
        {children}
      </select>
      <svg className="select-wrap__caret" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5.6 9.2 12 15.6l6.4-6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/**
 * Campo de dinheiro: prefixo "R$" e teclado numérico no iPhone.
 * O valor fica como texto enquanto o usuário digita e só vira número ao salvar
 * (ver `parseMoneyInput`), o que evita o campo "pular" durante a digitação.
 */
export function MoneyInput({
  suffix,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  return (
    <div className="money-input">
      <span className="money-input__prefix">R$</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`input money-input__control ${className}`.trim()}
        {...rest}
      />
      {suffix && <span className="money-input__suffix">{suffix}</span>}
    </div>
  )
}

interface ChipOption {
  value: string
  label: string
}

/** Escolha rápida em formato de "pílulas" — mais confortável que um select no toque. */
export function ChipGroup({
  options,
  value,
  onChange,
  ariaLabel,
  allowClear = false,
}: {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  allowClear?: boolean
}) {
  return (
    <div className="chip-group" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={`chip ${active ? 'is-active' : ''}`}
            onClick={() => onChange(active && allowClear ? '' : option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
