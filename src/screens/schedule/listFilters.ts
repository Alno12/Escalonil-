/**
 * Os filtros da aba Lista.
 *
 * São DOIS eixos, não um. Antes "Próximos / Realizados / Cancelados" (situação)
 * e "Mês atual / Próximo mês / Mês anterior" (período) dividiam o mesmo
 * controle, então escolher um desligava o outro e "realizados do mês passado"
 * era impossível de pedir.
 *
 * Não existe filtro de pagamento aqui: quanto falta receber é a pergunta que a
 * aba Financeiro responde melhor, com os valores somados.
 */
import type { LocalDate, ShiftView } from '@/db/types'
import { addMonths, monthPartOf } from '@/domain/datetime'
import { filterByRange, sortByStart } from '@/domain/summary'

export type Situation = 'upcoming' | 'done' | 'cancelled'
export type Period = 'any' | 'thisMonth' | 'nextMonth' | 'lastMonth' | 'custom'

export interface ListFilters {
  situation: Situation
  period: Period
  locationId: string
  customFrom: LocalDate
  customTo: LocalDate
  search: string
}

export const SITUATION_OPTIONS: { value: Situation; label: string }[] = [
  { value: 'upcoming', label: 'Próximos' },
  { value: 'done', label: 'Realizados' },
  { value: 'cancelled', label: 'Cancelados' },
]

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'any', label: 'Qualquer' },
  { value: 'thisMonth', label: 'Mês atual' },
  { value: 'nextMonth', label: 'Próximo mês' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'custom', label: 'Personalizado' },
]

export const periodLabel = (period: Period) =>
  PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Qualquer'

export const situationLabel = (situation: Situation) =>
  SITUATION_OPTIONS.find((o) => o.value === situation)?.label ?? 'Próximos'

/** O que a tela mostra quando nada foi mexido. */
export function defaultFilters(from: LocalDate, to: LocalDate): ListFilters {
  return {
    situation: 'upcoming',
    period: 'any',
    locationId: '',
    customFrom: from,
    customTo: to,
    search: '',
  }
}

/** Quantos filtros estão fora do padrão — vira o contador do botão. */
export function activeCount(filters: ListFilters): number {
  return (
    (filters.situation !== 'upcoming' ? 1 : 0) +
    (filters.period !== 'any' ? 1 : 0) +
    (filters.locationId !== '' ? 1 : 0)
  )
}

export function hasAnyFilter(filters: ListFilters): boolean {
  return activeCount(filters) > 0 || filters.search.trim() !== ''
}

/**
 * Aplica os filtros na ordem em que eles estreitam mais: situação, período,
 * local e só então a busca, que é a mais cara por varrer texto.
 */
export function applyFilters(
  views: ShiftView[],
  filters: ListFilters,
  today: LocalDate,
): ShiftView[] {
  const { situation, period, locationId } = filters

  let result: ShiftView[]
  switch (situation) {
    case 'upcoming':
      result = sortByStart(
        views.filter((v) => v.status === 'scheduled' || v.status === 'inProgress'),
      )
      break
    case 'done':
      result = sortByStart(views.filter((v) => v.status === 'done'), 'desc')
      break
    case 'cancelled':
      result = sortByStart(views.filter((v) => v.status === 'cancelled'), 'desc')
      break
  }

  if (period === 'thisMonth') {
    result = result.filter((v) => monthPartOf(v.shift.startDateTime) === monthPartOf(today))
  } else if (period === 'nextMonth') {
    const alvo = monthPartOf(addMonths(today, 1))
    result = result.filter((v) => monthPartOf(v.shift.startDateTime) === alvo)
  } else if (period === 'lastMonth') {
    const alvo = monthPartOf(addMonths(today, -1))
    result = result.filter((v) => monthPartOf(v.shift.startDateTime) === alvo)
  } else if (period === 'custom') {
    result = filterByRange(result, filters.customFrom, filters.customTo)
  }

  if (locationId) result = result.filter((v) => v.shift.locationId === locationId)

  const term = filters.search.trim().toLowerCase()
  if (term) {
    result = result.filter((v) =>
      [v.location?.name ?? '', v.shift.shiftType, v.shift.notes, v.shift.startDateTime.slice(0, 10)]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }

  return result
}
