import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { ChipGroup, Field, FieldRow, TextInput } from '@/components/ui/Field'
import { ShiftRow } from '@/components/shifts/ShiftRow'
import { useAppData } from '@/state/appDataContext'
import { useShiftSheets } from '@/state/shiftSheetsContext'
import type { ShiftView } from '@/db/types'
import {
  addMonths,
  datePartOf,
  endOfMonth,
  formatMonthYear,
  monthPartOf,
  startOfMonth,
} from '@/domain/datetime'
import { filterByRange, sortByStart } from '@/domain/summary'

type RangeFilter =
  | 'upcoming'
  | 'done'
  | 'cancelled'
  | 'thisMonth'
  | 'nextMonth'
  | 'lastMonth'
  | 'custom'
type StatusFilter = 'all' | 'pending' | 'received'

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  // As três primeiras são situações; as demais, períodos. Um plantão
  // cancelado não é "próximo" nem "realizado", então sem esta opção ele só
  // aparecia caindo no mês certo — difícil de achar para reativar.
  { value: 'upcoming', label: 'Próximos' },
  { value: 'done', label: 'Realizados' },
  { value: 'cancelled', label: 'Cancelados' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'nextMonth', label: 'Próximo mês' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'custom', label: 'Personalizado' },
]

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'A receber' },
  { value: 'received', label: 'Recebidos' },
]

/** Lista cronológica completa com busca e filtros (§22, §50, §51). */
export function ListView() {
  const { views, today, locations } = useAppData()
  const sheets = useShiftSheets()

  const [range, setRange] = useState<RangeFilter>('upcoming')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [customFrom, setCustomFrom] = useState(startOfMonth(today))
  const [customTo, setCustomTo] = useState(endOfMonth(today))

  const filtered = useMemo(() => {
    let result: ShiftView[] = views

    switch (range) {
      case 'upcoming':
        result = sortByStart(
          result.filter((v) => v.status === 'scheduled' || v.status === 'inProgress'),
        )
        break
      case 'done':
        result = sortByStart(result.filter((v) => v.status === 'done'), 'desc')
        break
      case 'cancelled':
        result = sortByStart(result.filter((v) => v.status === 'cancelled'), 'desc')
        break
      case 'thisMonth':
        result = sortByStart(
          result.filter((v) => monthPartOf(v.shift.startDateTime) === monthPartOf(today)),
          'desc',
        )
        break
      case 'nextMonth':
        result = sortByStart(
          result.filter(
            (v) => monthPartOf(v.shift.startDateTime) === monthPartOf(addMonths(today, 1)),
          ),
        )
        break
      case 'lastMonth':
        result = sortByStart(
          result.filter(
            (v) => monthPartOf(v.shift.startDateTime) === monthPartOf(addMonths(today, -1)),
          ),
          'desc',
        )
        break
      case 'custom':
        result = sortByStart(filterByRange(result, customFrom, customTo), 'desc')
        break
    }

    if (status !== 'all') result = result.filter((v) => v.paymentStatus === status)
    if (locationId) result = result.filter((v) => v.shift.locationId === locationId)

    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter((v) => {
        const haystack = [
          v.location?.name ?? '',
          v.shift.shiftType,
          v.shift.notes,
          datePartOf(v.shift.startDateTime),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
    }

    return result
  }, [views, range, status, locationId, search, customFrom, customTo, today])

  // Quantos filtros além do período estão ativos — vira o contador do botão.
  const extraFilters = (status !== 'all' ? 1 : 0) + (locationId !== '' ? 1 : 0)
  const hasFilters = extraFilters > 0 || search.trim() !== ''

  return (
    <>
      <div className="search-row">
        <div className="search-box">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="search-box__input"
            value={search}
            placeholder="Buscar por local, tipo ou observação"
            aria-label="Buscar plantões"
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="search-box__clear"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          className={`filter-toggle ${showFilters ? 'is-open' : ''} ${extraFilters > 0 ? 'has-filters' : ''}`}
          aria-expanded={showFilters}
          aria-label={`Filtros${extraFilters > 0 ? ` (${extraFilters} ativos)` : ''}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Icon name="filter" size={18} />
          {extraFilters > 0 && <span className="filter-toggle__badge">{extraFilters}</span>}
        </button>
      </div>

      <div className="filters">
        <ChipGroup
          ariaLabel="Período"
          options={RANGE_OPTIONS}
          value={range}
          onChange={(v) => {
            const next = v as RangeFilter
            setRange(next)
            // A situação do pagamento não se aplica a cancelado — deixar
            // "A receber" marcado esvaziaria a lista por construção.
            if (next === 'cancelled') setStatus('all')
          }}
        />

        {range === 'custom' && (
          <FieldRow>
            <Field label="De" htmlFor="range-from">
              <TextInput
                id="range-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </Field>
            <Field label="Até" htmlFor="range-to">
              <TextInput
                id="range-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </Field>
          </FieldRow>
        )}

        {showFilters && (
          <div className="filters__extra">
            {range !== 'cancelled' && (
              <ChipGroup
                ariaLabel="Situação do pagamento"
                options={STATUS_OPTIONS}
                value={status}
                onChange={(v) => setStatus(v as StatusFilter)}
              />
            )}

            {locations.length > 1 && (
              <ChipGroup
                ariaLabel="Local"
                options={[
                  { value: '', label: 'Todos os locais' },
                  ...locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
                value={locationId}
                onChange={setLocationId}
              />
            )}
          </div>
        )}
      </div>

      <p className="list-count">
        {filtered.length} {filtered.length === 1 ? 'plantão' : 'plantões'}
        {range === 'custom' && ` · ${formatMonthYear(customFrom)}`}
      </p>

      {filtered.length > 0 ? (
        <ul className="shift-list">
          {filtered.map((view) => (
            <ShiftRow key={view.shift.id} view={view} onClick={sheets.openShift} showDate />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={range === 'cancelled' ? 'ban' : hasFilters ? 'filter' : 'calendar'}
          title={
            range === 'cancelled' && !hasFilters
              ? 'Nenhum plantão cancelado'
              : hasFilters
                ? 'Nenhum plantão com esses filtros'
                : 'Nenhum plantão neste período'
          }
          description={
            range === 'cancelled' && !hasFilters
              ? 'Cancelar um plantão o guarda aqui, com o recebimento intacto. Reativar devolve tudo.'
              : hasFilters
                ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                : 'Cadastre um plantão para começar a acompanhar horas e valores.'
          }
          action={
            range === 'cancelled' && !hasFilters ? undefined : hasFilters ? (
              <Button
                variant="secondary"
                icon="refresh"
                onClick={() => {
                  setStatus('all')
                  setLocationId('')
                  setSearch('')
                }}
              >
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
    </>
  )
}
