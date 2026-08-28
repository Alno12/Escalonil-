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
   * Mês que a folha de compartilhar deve propor. Sem ele, o mês corrente —
   * é o caso das telas que não olham para um mês específico.
   */
  shareMonth?: string
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
  shareMonth,
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
          {/* Compartilhar a escala do mês, em TODAS as telas — como o `+`. À
              esquerda dele e em círculo claro: o `+` continua sendo o único
              preenchido e a ação principal. */}
          <button
            type="button"
            className="header-icon"
            onClick={() => sheets.shareMonth(shareMonth)}
            aria-label="Compartilhar a escala do mês"
          >
            <Icon name="share" size={19} strokeWidth={2} />
          </button>
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
