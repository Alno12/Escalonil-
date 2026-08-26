import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useMoneyMask } from '@/hooks/useMoneyMask'

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

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'inputMode'
> & {
  suffix?: string
  /** Recebe o texto já mascarado ("1.200,00"). */
  onValueChange: (value: string) => void
}

/**
 * Campo de dinheiro: prefixo "R$", teclado numérico e máscara brasileira.
 * O valor se preenche da direita para a esquerda e só vira número ao salvar
 * (ver `parseMoneyInput`).
 */
export function MoneyInput({
  suffix,
  className = '',
  onValueChange,
  ...rest
}: MoneyInputProps) {
  const mask = useMoneyMask(onValueChange)
  return (
    <div className="money-input">
      <span className="money-input__prefix">R$</span>
      <input
        className={`input money-input__control ${className}`.trim()}
        placeholder="0,00"
        {...rest}
        {...mask}
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
  scroll = false,
}: {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  allowClear?: boolean
  /** Uma linha só, rolando de lado — para listas longas no cabeçalho. */
  scroll?: boolean
}) {
  return (
    <div
      className={`chip-group ${scroll ? 'chip-group--scroll' : ''}`.trim()}
      role="group"
      aria-label={ariaLabel}
    >
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
