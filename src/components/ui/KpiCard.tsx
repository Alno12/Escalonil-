import type { ReactNode } from 'react'
import { formatMoneyCompact } from '@/domain/money'

/** Número + rótulo em coluna, usado nos cartões de resumo. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <strong className="stat__value num">{value}</strong>
      <span className="stat__label">{label}</span>
    </div>
  )
}

/**
 * Linha de valor dentro de um cartão agrupado.
 * Substituiu os quatro cartões soltos do financeiro: mesma informação, bem
 * mais discreta, no formato de lista do iOS.
 */
export function MoneyRow({
  label,
  value,
  strong,
  tone,
  hint,
}: {
  label: string
  value: number
  strong?: boolean
  tone?: 'danger' | 'success'
  hint?: string
}) {
  const muted = value === 0
  const color = muted ? undefined : tone === 'danger' ? 'var(--danger)' : tone === 'success' ? 'var(--success)' : undefined

  return (
    <div className="row">
      <span className="row__label">
        {label}
        {hint && <span className="row__hint">{hint}</span>}
      </span>
      <span
        className={`row__value num ${strong && !muted ? 'row__value--strong' : ''}`}
        style={color ? { color, fontWeight: 600 } : undefined}
      >
        {formatMoneyCompact(value)}
      </span>
    </div>
  )
}
