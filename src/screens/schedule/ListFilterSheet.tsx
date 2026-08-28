import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { OptionSheet, type SheetOption } from '@/components/ui/OptionSheet'
import { Field, FieldRow, TextInput } from '@/components/ui/Field'
import type { Location } from '@/db/types'
import {
  PERIOD_OPTIONS,
  SITUATION_OPTIONS,
  periodLabel,
  type ListFilters,
  type Period,
  type Situation,
} from './listFilters'

interface ListFilterSheetProps {
  open: boolean
  filters: ListFilters
  locations: Location[]
  /** Quantos plantões passam pelos filtros agora — vai no botão do rodapé. */
  count: number
  canClear: boolean
  onChange: (patch: Partial<ListFilters>) => void
  onClear: () => void
  onClose: () => void
}

/**
 * Os filtros da Lista, fora da tela.
 *
 * Antes eram treze chips empilhados acima da lista, e sobrava um plantão à
 * vista. Aqui a situação — o que mais se troca — fica em um seletor no topo, e
 * período e local viram linhas com o valor à direita, no estilo dos Ajustes.
 *
 * O rodapé mostra quantos plantões passam pelo filtro AGORA. É o que evita
 * fechar a folha e cair numa lista vazia sem entender por quê.
 */
export function ListFilterSheet({
  open,
  filters,
  locations,
  count,
  canClear,
  onChange,
  onClear,
  onClose,
}: ListFilterSheetProps) {
  const [picking, setPicking] = useState<'period' | 'location' | null>(null)

  const locationOptions: SheetOption<string>[] = [
    { value: '', label: 'Todos os locais' },
    ...locations.map((l) => ({ value: l.id, label: l.name, color: l.color })),
  ]
  const locationName =
    locations.find((l) => l.id === filters.locationId)?.name ?? 'Todos os locais'

  return (
    <>
      <Sheet
        open={open}
        title="Filtros"
        onClose={onClose}
        size="auto"
        action={
          <button className="sheet__action-btn" onClick={onClear} disabled={!canClear}>
            Limpar
          </button>
        }
        footer={
          <Button variant="primary" size="lg" block onClick={onClose}>
            {count === 1 ? 'Ver 1 plantão' : `Ver ${count} plantões`}
          </Button>
        }
      >
        <div className="form">
          <SegmentedControl
            ariaLabel="Situação do plantão"
            options={SITUATION_OPTIONS}
            value={filters.situation}
            onChange={(situation: Situation) => onChange({ situation })}
          />

          <div className="card rows">
            <button type="button" className="row" onClick={() => setPicking('period')}>
              <span className="row__label">Período</span>
              <span
                className={`row__value ${filters.period === 'any' ? 'row__value--muted' : ''}`}
              >
                {periodLabel(filters.period)}
              </span>
              <Icon name="chevronRight" size={17} className="row__chevron" />
            </button>

            {/* As datas ficam no cartão, e não dentro do seletor de período:
                escolher "Personalizado" e ter de reabrir a folha para ver os
                campos seria um passo a mais sem ganho nenhum. */}
            {filters.period === 'custom' && (
              <div className="row row--stack">
                <FieldRow>
                  <Field label="De" htmlFor="filtro-de">
                    <TextInput
                      id="filtro-de"
                      type="date"
                      value={filters.customFrom}
                      onChange={(e) => onChange({ customFrom: e.target.value })}
                    />
                  </Field>
                  <Field label="Até" htmlFor="filtro-ate">
                    <TextInput
                      id="filtro-ate"
                      type="date"
                      value={filters.customTo}
                      onChange={(e) => onChange({ customTo: e.target.value })}
                    />
                  </Field>
                </FieldRow>
              </div>
            )}

            {locations.length > 1 && (
              <button type="button" className="row" onClick={() => setPicking('location')}>
                <span className="row__label">Local</span>
                <span
                  className={`row__value ${filters.locationId ? '' : 'row__value--muted'}`}
                >
                  {locationName}
                </span>
                <Icon name="chevronRight" size={17} className="row__chevron" />
              </button>
            )}
          </div>
        </div>
      </Sheet>

      <OptionSheet
        open={picking === 'period'}
        title="Período"
        options={PERIOD_OPTIONS}
        value={filters.period}
        onChange={(period: Period) => onChange({ period })}
        onClose={() => setPicking(null)}
      />

      <OptionSheet
        open={picking === 'location'}
        title="Local"
        options={locationOptions}
        value={filters.locationId}
        onChange={(locationId) => onChange({ locationId })}
        onClose={() => setPicking(null)}
      />
    </>
  )
}
