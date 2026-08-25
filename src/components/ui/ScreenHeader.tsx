import type { ReactNode } from 'react'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  /** Conteúdo grudado abaixo do título (filtros, seletor de período). */
  below?: ReactNode
}

/** Cabeçalho de tela com fundo translúcido e respeito à safe area do iOS. */
export function ScreenHeader({ title, subtitle, action, below }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <div className="screen-header__bar">
        <div className="screen-header__titles">
          <h1 className="screen-header__title">{title}</h1>
          {subtitle && <p className="screen-header__subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>
      {below && <div className="screen-header__below">{below}</div>}
    </header>
  )
}
