import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  tone?: Tone
  /** Deixa o cartão discreto quando o valor é zero — evita alarme falso (§10). */
  muted?: boolean
  onClick?: () => void
}

export function KpiCard({ label, value, hint, tone = 'neutral', muted, onClick }: KpiCardProps) {
  const className = `kpi kpi--${tone} ${muted ? 'kpi--muted' : ''} ${onClick ? 'kpi--tappable' : ''}`
  const content = (
    <>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value num">{value}</strong>
      {hint && <span className="kpi__hint">{hint}</span>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className.trim()} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={className.trim()}>{content}</div>
}

/** Número + rótulo em linha, para resumos compactos. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <strong className="stat__value num">{value}</strong>
      <span className="stat__label">{label}</span>
    </div>
  )
}
