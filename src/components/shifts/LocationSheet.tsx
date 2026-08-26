import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import { nextLocationColor } from '@/db/db'
import { findLocationByName } from '@/domain/location'
import type { Location, LocationColor } from '@/db/types'

interface LocationSheetProps {
  open: boolean
  /** Nome digitado ou escolhido agora — pode ainda não existir no banco. */
  value: string
  locations: Location[]
  onChange: (name: string, color?: LocationColor) => void
  onClose: () => void
}

/**
 * Escolha do local a partir dos que já foram usados.
 *
 * Existe para o plantonista não redigitar o mesmo hospital toda semana e,
 * principalmente, para não criar "UPA Centro" e "UPA do Centro" como dois
 * lugares diferentes — o que quebraria a cor, a agenda e os relatórios por
 * local sem ninguém perceber.
 */
export function LocationSheet({ open, value, locations, onChange, onClose }: LocationSheetProps) {
  const saved = [...locations].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const known = findLocationByName(saved, value)
  const [typing, setTyping] = useState(false)

  const pick = (location: Location) => {
    setTyping(false)
    onChange(location.name, location.color)
    onClose()
  }

  /** Abre o campo já limpo e com a próxima cor livre da paleta. */
  const startNew = () => {
    setTyping(true)
    onChange('', nextLocationColor(saved.map((l) => l.color)))
  }

  const close = () => {
    setTyping(false)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title="Local"
      onClose={close}
      closeLabel="Voltar"
      action={
        <button className="sheet__action-btn" onClick={close} disabled={!value.trim()}>
          Concluir
        </button>
      }
    >
      <div className="form">
        <div className="card rows">
          <button
            type="button"
            className="row option"
            aria-pressed={typing && !known}
            onClick={startNew}
          >
            <span className="row__label">Novo local</span>
            {typing && !known && (
              <span className="option__check" aria-hidden="true">
                <Icon name="check" size={17} strokeWidth={2.4} />
              </span>
            )}
          </button>

          {typing && (
            <label className="row">
              <span className="row__label">Nome</span>
              <input
                className="input"
                type="text"
                value={value}
                placeholder="UPA Centro"
                autoComplete="off"
                autoFocus
                aria-label="Nome do local"
                onChange={(e) => onChange(e.target.value)}
              />
            </label>
          )}

          {typing && known && (
            <p className="row row--stack form-note">
              Esse local já existe. O plantão vai para {known.name}, com a cor dele.
            </p>
          )}
        </div>

        <div className="section-header">
          <h2 className="section-header__title">Locais já usados</h2>
        </div>
        <div className="card rows">
          {saved.map((location) => (
            <button
              key={location.id}
              type="button"
              className="row option"
              aria-pressed={known?.id === location.id}
              onClick={() => pick(location)}
            >
              <span
                className="loc-dot"
                style={{ background: `var(--loc-${location.color})` }}
                aria-hidden="true"
              />
              <span className="row__label">{location.name}</span>
              {known?.id === location.id && (
                <span className="option__check" aria-hidden="true">
                  <Icon name="check" size={17} strokeWidth={2.4} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="form-note">
          A cor pertence ao local: mudar a cor aqui muda todos os plantões dele. Locais são
          removidos em Ajustes.
        </p>
      </div>
    </Sheet>
  )
}
