import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useShiftSheets } from '@/state/shiftSheetsContext'

interface ScreenHeaderProps {
  /** Linha pequena em caixa alta acima do título (data, período…). */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Substitui o botão de novo plantão quando a tela precisa de outra ação. */
  action?: ReactNode
  /**
   * Entra À ESQUERDA do `+`, sem tomar o lugar dele.
   *
   * O `+` é sempre o círculo mais à direita e o único preenchido: é o que
   * impede o canto do cabeçalho de virar uma fileira de botões todos com o
   * mesmo peso.
   */
  extra?: ReactNode
  /** Esconde o botão de novo plantão (telas onde ele não faz sentido). */
  hideAdd?: boolean
  /** Conteúdo grudado abaixo do título (abas, seletor de período). */
  below?: ReactNode
}

/**
 * Cabeçalho no estilo do iOS: título grande à esquerda e uma ação circular à
 * direita — que por padrão é "novo plantão", acessível de qualquer aba.
 */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
  extra,
  hideAdd = false,
  below,
}: ScreenHeaderProps) {
  const sheets = useShiftSheets()

  return (
    <header className="screen-header">
      <div className="screen-header__bar">
        <div className="screen-header__titles">
          {eyebrow && <p className="screen-header__eyebrow">{eyebrow}</p>}
          <h1 className="screen-header__title">{title}</h1>
          {subtitle && <p className="screen-header__subtitle">{subtitle}</p>}
        </div>

        <div className="screen-header__actions">
          {extra}
          {action ??
            (hideAdd ? null : (
              <button
                type="button"
                className="header-add"
                onClick={() => sheets.newShift()}
                aria-label="Novo plantão"
              >
                <Icon name="plus" size={22} strokeWidth={2.2} />
              </button>
            ))}
        </div>
      </div>
      {below && <div className="screen-header__below">{below}</div>}
    </header>
  )
}
