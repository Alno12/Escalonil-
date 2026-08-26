/** Períodos usados nos relatórios (§27) e o período anterior equivalente. */
import type { LocalDate } from '@/db/types'
import { addDays, addMonths, daysBetween, endOfMonth, formatMonthYear, startOfMonth } from './datetime'

export type PeriodKey =
  | 'thisMonth'
  | 'nextMonth'
  | 'lastMonth'
  | 'last3'
  | 'last6'
  | 'year'
  | 'custom'

export interface Period {
  key: PeriodKey
  from: LocalDate
  to: LocalDate
  /** Título legível do período ("Agosto de 2026"). */
  title: string
  /** Usado nas frases dos insights: "neste mês". */
  label: string
  /** Usado nas comparações: "no mês passado". */
  previousLabel: string
  previousFrom: LocalDate
  previousTo: LocalDate
}

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'thisMonth', label: 'Mês atual' },
  // Olhar para frente: quanto já está escalado e quanto isso vai render.
  { value: 'nextMonth', label: 'Próximo mês' },
  { value: 'lastMonth', label: 'Mês anterior' },
  { value: 'last3', label: '3 meses' },
  { value: 'last6', label: '6 meses' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Personalizado' },
]

/**
 * De quantos meses cada seta do relatório anda. Os períodos do tamanho de um
 * mês andam de mês em mês; os intervalos andam do próprio tamanho, senão
 * "3 meses" para trás mostraria dois meses repetidos.
 */
export function periodStepMonths(key: PeriodKey): number {
  switch (key) {
    case 'last3':
      return 3
    case 'last6':
      return 6
    case 'year':
      return 12
    default:
      return 1
  }
}

/**
 * `offset` é o quanto as setas dos Indicadores andaram: 0 é o período que o
 * chip descreve, -1 o anterior, +1 o seguinte.
 *
 * Fora do zero, "Próximo mês" vira um mês qualquer — o comparativo passa a ser
 * o mês ANTES dele, não o mês corrente, senão a variação compararia dois meses
 * sem relação nenhuma. E os rótulos das frases deixam de ser "neste mês", que
 * seria mentira em um mês que não é o de hoje.
 */
export function buildPeriod(
  key: PeriodKey,
  today: LocalDate,
  custom?: { from: LocalDate; to: LocalDate },
  offset = 0,
): Period {
  if (offset === 0) return basePeriod(key, today, custom)

  if (key === 'custom') {
    const from = custom?.from ?? startOfMonth(today)
    const to = custom?.to ?? endOfMonth(today)
    const length = Math.max(1, daysBetween(from, to) + 1)
    return basePeriod(key, today, {
      from: addDays(from, offset * length),
      to: addDays(to, offset * length),
    })
  }

  const ref = addMonths(today, (key === 'nextMonth' ? 1 : 0) + offset * periodStepMonths(key))
  const moved = basePeriod(key === 'nextMonth' ? 'thisMonth' : key, ref, custom)
  return { ...moved, key, ...movedLabels(key, moved) }
}

function movedLabels(key: PeriodKey, moved: Period): Pick<Period, 'label' | 'previousLabel'> {
  switch (key) {
    case 'last3':
    case 'last6':
      return { label: 'no período', previousLabel: 'no período anterior' }
    case 'year':
      return { label: `em ${moved.title}`, previousLabel: 'no ano anterior' }
    default:
      return {
        label: `em ${formatMonthYear(moved.from).toLowerCase()}`,
        previousLabel: 'no mês anterior',
      }
  }
}

function basePeriod(
  key: PeriodKey,
  today: LocalDate,
  custom?: { from: LocalDate; to: LocalDate },
): Period {
  switch (key) {
    case 'nextMonth': {
      const ref = addMonths(today, 1)
      return {
        key,
        from: startOfMonth(ref),
        to: endOfMonth(ref),
        title: formatMonthYear(ref),
        label: 'no mês que vem',
        // O comparativo é o mês corrente: é com ele que se quer comparar o
        // que já está escalado à frente.
        previousLabel: 'neste mês',
        previousFrom: startOfMonth(today),
        previousTo: endOfMonth(today),
      }
    }
    case 'lastMonth': {
      const ref = addMonths(today, -1)
      return {
        key,
        from: startOfMonth(ref),
        to: endOfMonth(ref),
        title: formatMonthYear(ref),
        label: 'no mês passado',
        previousLabel: 'no mês anterior',
        previousFrom: startOfMonth(addMonths(ref, -1)),
        previousTo: endOfMonth(addMonths(ref, -1)),
      }
    }
    case 'last3':
      return monthsBack(key, today, 3, 'nos últimos 3 meses', 'nos 3 meses anteriores')
    case 'last6':
      return monthsBack(key, today, 6, 'nos últimos 6 meses', 'nos 6 meses anteriores')
    case 'year': {
      const year = Number(today.slice(0, 4))
      return {
        key,
        from: `${year}-01-01`,
        to: `${year}-12-31`,
        title: String(year),
        label: 'neste ano',
        previousLabel: 'no ano passado',
        previousFrom: `${year - 1}-01-01`,
        previousTo: `${year - 1}-12-31`,
      }
    }
    case 'custom': {
      const from = custom?.from ?? startOfMonth(today)
      const to = custom?.to ?? endOfMonth(today)
      const length = Math.max(1, daysBetween(from, to) + 1)
      return {
        key,
        from,
        to,
        title: 'Período personalizado',
        label: 'no período',
        previousLabel: 'no período anterior',
        previousFrom: addDays(from, -length),
        previousTo: addDays(from, -1),
      }
    }
    case 'thisMonth':
    default:
      return {
        key: 'thisMonth',
        from: startOfMonth(today),
        to: endOfMonth(today),
        title: formatMonthYear(today),
        label: 'neste mês',
        previousLabel: 'no mês passado',
        previousFrom: startOfMonth(addMonths(today, -1)),
        previousTo: endOfMonth(addMonths(today, -1)),
      }
  }
}

function monthsBack(
  key: PeriodKey,
  today: LocalDate,
  months: number,
  label: string,
  previousLabel: string,
): Period {
  const from = startOfMonth(addMonths(today, -(months - 1)))
  const to = endOfMonth(today)
  return {
    key,
    from,
    to,
    title: `${formatMonthYear(from)} — ${formatMonthYear(to)}`,
    label,
    previousLabel,
    previousFrom: startOfMonth(addMonths(from, -months)),
    previousTo: endOfMonth(addMonths(from, -1)),
  }
}
