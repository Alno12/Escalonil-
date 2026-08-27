import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import { endOfMonth, formatDate, startOfMonth } from '@/domain/datetime'
import { ListFilterSheet } from './ListFilterSheet'
import {
  activeCount,
  applyFilters,
  defaultFilters,
  hasAnyFilter,
  periodLabel,
  situationLabel,
  type ListFilters,
} from './listFilters'

/**
 * Lista cronológica completa, com busca e filtros.
 *
 * Os filtros moram FORA da tela, atrás do botão. Antes eram treze chips
 * empilhados acima da lista e sobrava um plantão à vista; agora a tela é a
 * busca e a lista, e o que está aplicado aparece como pílulas que se tiram
 * com um toque.
 */
export function ListView() {
  const { views, today, locations } = useAppData()
  const sheets = useShiftSheets()

  const [filters, setFilters] = useState<ListFilters>(() =>
    defaultFilters(startOfMonth(today), endOfMonth(today)),
  )
  const [editing, setEditing] = useState(false)

  const patch = (next: Partial<ListFilters>) => setFilters((prev) => ({ ...prev, ...next }))
  const clear = () => setFilters(defaultFilters(startOfMonth(today), endOfMonth(today)))

  const filtered = useMemo(() => applyFilters(views, filters, today), [views, filters, today])

  const count = activeCount(filters)
  const hasFilters = hasAnyFilter(filters)

  /**
   * Só entra na fita o que está FORA do padrão. Na tela limpa a linha some
   * inteira — que é o ponto: a lista começa logo abaixo da busca.
   */
  const pills: { key: string; label: string; clear: () => void }[] = []
  if (filters.situation !== 'upcoming') {
    pills.push({
      key: 'situation',
      label: situationLabel(filters.situation),
      clear: () => patch({ situation: 'upcoming' }),
    })
  }
  if (filters.period !== 'any') {
    pills.push({
      key: 'period',
      label:
        filters.period === 'custom'
          ? `${formatDate(filters.customFrom)} — ${formatDate(filters.customTo)}`
          : periodLabel(filters.period),
      clear: () => patch({ period: 'any' }),
    })
  }
  if (filters.locationId) {
    pills.push({
      key: 'location',
      label: locations.find((l) => l.id === filters.locationId)?.name ?? 'Local',
      clear: () => patch({ locationId: '' }),
    })
  }

  return (
    <>
      <div className="search-row">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="search-box__input"
            value={filters.search}
            placeholder="Buscar por local, tipo ou observação"
            aria-label="Buscar plantões"
            onChange={(e) => patch({ search: e.target.value })}
          />
          {filters.search && (
            <button
              type="button"
              className="search-box__clear"
              onClick={() => patch({ search: '' })}
              aria-label="Limpar busca"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          className={`filter-toggle ${count > 0 ? 'has-filters' : ''}`}
          aria-label={`Filtros${count > 0 ? ` (${count} ativos)` : ''}`}
          onClick={() => setEditing(true)}
        >
          <Icon name="filter" size={18} />
          {count > 0 && <span className="filter-toggle__badge">{count}</span>}
        </button>
      </div>

      {pills.length > 0 && (
        <div className="applied">
          {pills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className="applied__pill"
              onClick={pill.clear}
              aria-label={`Tirar o filtro ${pill.label}`}
            >
              {pill.label}
              <span className="applied__x" aria-hidden="true">
                <Icon name="close" size={11} strokeWidth={2.6} />
              </span>
            </button>
          ))}
          <button type="button" className="applied__clear" onClick={clear}>
            Limpar
          </button>
        </div>
      )}

      <p className="list-count">
        {filtered.length} {filtered.length === 1 ? 'plantão' : 'plantões'}
      </p>

      {filtered.length > 0 ? (
        <ul className="shift-list">
          {filtered.map((view) => (
            <ShiftRow key={view.shift.id} view={view} onClick={sheets.openShift} showDate />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={filters.situation === 'cancelled' ? 'ban' : hasFilters ? 'filter' : 'calendar'}
          title={
            filters.situation === 'cancelled' && !hasFilters
              ? 'Nenhum plantão cancelado'
              : hasFilters
                ? 'Nenhum plantão com esses filtros'
                : 'Nenhum plantão neste período'
          }
          description={
            filters.situation === 'cancelled' && !hasFilters
              ? 'Cancelar um plantão o guarda aqui, com o recebimento intacto. Reativar devolve tudo.'
              : hasFilters
                ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                : 'Cadastre um plantão para começar a acompanhar horas e valores.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" icon="refresh" onClick={clear}>
                Limpar filtros
              </Button>
            ) : (
              <Button variant="primary" icon="plus" onClick={() => sheets.newShift()}>
                Novo plantão
              </Button>
            )
          }
        />
      )}

      <ListFilterSheet
        open={editing}
        filters={filters}
        locations={locations}
        count={filtered.length}
        canClear={hasFilters}
        onChange={patch}
        onClear={clear}
        onClose={() => setEditing(false)}
      />
    </>
  )
}
