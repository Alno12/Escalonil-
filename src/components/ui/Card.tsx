import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div className={`card ${padded ? 'card--padded' : ''} ${className}`.trim()} {...rest}>
      {children}
    </div>
  )
}

/** Título de seção com ação opcional à direita. */
export function SectionHeader({
  title,
  action,
  hint,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-header__title">{title}</h2>
        {hint && <p className="section-header__hint">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
