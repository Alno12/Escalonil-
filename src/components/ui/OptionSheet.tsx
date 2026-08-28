import { Sheet } from './Sheet'
import { Icon } from './Icon'
import type { LocationColor } from '@/db/types'

export interface SheetOption<T extends string> {
  value: T
  label: string
  /** Bolinha do local à esquerda, quando a opção é um lugar. */
  color?: LocationColor
}

interface OptionSheetProps<T extends string> {
  open: boolean
  title: string
  options: SheetOption<T>[]
  value: T
  onChange: (value: T) => void
  onClose: () => void
}

/**
 * Escolha de UMA opção numa lista, no formato de cartão do iOS.
 *
 * Existe para as linhas com valor à direita (Período, Local) da folha de
 * filtros: a linha mostra o que está escolhido, e o toque abre esta folha.
 * Escolher aplica e volta na hora — não tem "Concluir", porque não há nada
 * para confirmar.
 */
export function OptionSheet<T extends string>({
  open,
  title,
  options,
  value,
  onChange,
  onClose,
}: OptionSheetProps<T>) {
  const pick = (next: T) => {
    onChange(next)
    onClose()
  }

  return (
    <Sheet open={open} title={title} onClose={onClose} closeLabel="Voltar" size="auto">
      <div className="form">
        <div className="card rows">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="row option"
              aria-pressed={option.value === value}
              onClick={() => pick(option.value)}
            >
              {option.color && (
                <span
                  className="loc-dot"
                  style={{ background: `var(--loc-${option.color})` }}
                  aria-hidden="true"
                />
              )}
              <span className="row__label">{option.label}</span>
              {option.value === value && (
                <span className="option__check" aria-hidden="true">
                  <Icon name="check" size={17} strokeWidth={2.4} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
