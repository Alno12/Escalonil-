/**
 * Indicadores, relatório por local e insights (§27–§30 do blueprint).
 * Tudo é calculado localmente, sem nenhum serviço externo.
 */
import type { LocalDate, LocationColor, ShiftView } from '@/db/types'
import { addMonths, daysBetween, monthPartOf } from './datetime'
import { formatDuration } from './datetime'
import { formatMoney, formatNumber, roundMoney } from './money'
import { periodSummary, type PeriodSummary } from './summary'

export interface ReportIndicators extends PeriodSummary {
  avgPerShift: number
  avgPerHour: number
  avgHoursPerWeek: number
}

export function buildIndicators(
  views: ShiftView[],
  from: LocalDate,
  to: LocalDate,
): ReportIndicators {
  const base = periodSummary(views)
  const days = Math.max(1, daysBetween(from, to) + 1)
  return {
    ...base,
    avgPerShift: base.shifts > 0 ? roundMoney(base.expected / base.shifts) : 0,
    avgPerHour: base.hours > 0 ? roundMoney(base.expected / base.hours) : 0,
    avgHoursPerWeek: Math.round((base.hours / (days / 7)) * 10) / 10,
  }
}

export interface LocationReportRow {
  locationId: string
  name: string
  /** A cor pertence ao LOCAL (invariante 10) — é ela que tinge a barra. */
  color: LocationColor
  shifts: number
  hours: number
  expected: number
  received: number
  avgPerHour: number
  /** Percentual do valor previsto do período. */
  share: number
}

export function buildLocationReport(views: ShiftView[]): LocationReportRow[] {
  const active = views.filter((v) => !v.shift.cancelled)
  const total = active.reduce((sum, v) => sum + v.shift.expectedAmount, 0)
  const groups = new Map<string, LocationReportRow>()

  for (const v of active) {
    const id = v.shift.locationId
    const row = groups.get(id) ?? {
      locationId: id,
      name: v.location?.name ?? 'Local removido',
      color: v.location?.color ?? 'blue',
      shifts: 0,
      hours: 0,
      expected: 0,
      received: 0,
      avgPerHour: 0,
      share: 0,
    }
    row.shifts += 1
    row.hours += v.durationHours
    row.expected += v.shift.expectedAmount
    row.received += v.payment?.receivedAmount ?? 0
    groups.set(id, row)
  }

  return [...groups.values()]
    .map((row) => ({
      ...row,
      hours: Math.round(row.hours * 100) / 100,
      expected: roundMoney(row.expected),
      received: roundMoney(row.received),
      avgPerHour: row.hours > 0 ? roundMoney(row.expected / row.hours) : 0,
      share: total > 0 ? Math.round((row.expected / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.expected - a.expected)
}

export interface MonthBucket {
  /** "YYYY-MM" */
  month: string
  shifts: number
  hours: number
  expected: number
  received: number
}

/**
 * Série mensal de tamanho FIXO terminando em `endMonth` ("YYYY-MM").
 *
 * Mês sem plantão entra zerado de propósito: sem isso o eixo mudaria de
 * largura conforme o histórico e as barras trocariam de lugar ao andar de mês,
 * que é justamente o que o gráfico existe para comparar. Recebe o acervo
 * inteiro, não o período escolhido — a evolução olha para trás por conta
 * própria.
 */
export function buildMonthlySeries(
  views: ShiftView[],
  endMonth: string,
  count = 12,
): MonthBucket[] {
  const buckets = new Map<string, MonthBucket>()
  for (const v of views) {
    if (v.shift.cancelled) continue
    const month = monthPartOf(v.shift.startDateTime)
    const bucket = buckets.get(month) ?? { month, shifts: 0, hours: 0, expected: 0, received: 0 }
    bucket.shifts += 1
    bucket.hours += v.durationHours
    bucket.expected += v.shift.expectedAmount
    bucket.received += v.payment?.receivedAmount ?? 0
    buckets.set(month, bucket)
  }

  const series: MonthBucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    const month = monthPartOf(addMonths(`${endMonth}-01`, -i))
    const b = buckets.get(month) ?? { month, shifts: 0, hours: 0, expected: 0, received: 0 }
    series.push({
      ...b,
      hours: Math.round(b.hours * 10) / 10,
      expected: roundMoney(b.expected),
      received: roundMoney(b.received),
    })
  }
  return series
}

export type InsightTone = 'neutral' | 'positive' | 'warning'

export interface Insight {
  id: string
  text: string
  tone: InsightTone
}

/**
 * Insights em linguagem natural, gerados só com os dados locais.
 * `previous` é o período anterior equivalente (mês passado, trimestre anterior…).
 */
export function buildInsights(
  current: ShiftView[],
  previous: ShiftView[],
  options: { periodLabel: string; previousLabel: string },
): Insight[] {
  const insights: Insight[] = []
  const now = periodSummary(current)
  const before = periodSummary(previous)

  if (now.shifts === 0) return insights

  // Comparação de horas com o período anterior.
  if (before.hours > 0) {
    const delta = ((now.hours - before.hours) / before.hours) * 100
    const rounded = Math.round(Math.abs(delta))
    if (rounded >= 3) {
      insights.push({
        id: 'hours-delta',
        text: `Você trabalhou ${rounded}% ${delta > 0 ? 'mais' : 'menos'} horas que ${options.previousLabel}.`,
        tone: delta > 0 ? 'neutral' : 'positive',
      })
    } else {
      insights.push({
        id: 'hours-delta',
        text: `Sua carga horária ficou parecida com ${options.previousLabel}.`,
        tone: 'neutral',
      })
    }
  }

  if (now.hours > 0) {
    insights.push({
      id: 'avg-hour',
      text: `Seu valor médio por hora foi ${formatMoney(now.expected / now.hours)}.`,
      tone: 'neutral',
    })
  }

  // Local mais relevante financeiramente.
  const byLocation = buildLocationReport(current)
  const top = byLocation[0]
  if (top && byLocation.length > 1) {
    insights.push({
      id: 'top-location',
      text: `${top.name} representou ${formatNumber(top.share)}% da sua renda ${options.periodLabel}.`,
      tone: 'neutral',
    })
  }

  if (now.outstanding > 0) {
    insights.push({
      id: 'outstanding',
      text: `Você tem ${formatMoney(now.outstanding)} a receber.`,
      tone: 'neutral',
    })
  }

  // Maior plantão do período.
  const longest = [...current]
    .filter((v) => !v.shift.cancelled)
    .sort((a, b) => b.durationHours - a.durationHours)[0]
  if (longest && longest.durationHours >= 12) {
    insights.push({
      id: 'longest',
      text: `Seu maior plantão ${options.periodLabel} foi de ${formatDuration(longest.durationHours)}${
        longest.location ? ` na ${longest.location.name}` : ''
      }.`,
      tone: 'neutral',
    })
  }

  // Divergências entre previsto e recebido.
  const divergences = current.filter(
    (v) => v.payment && Math.abs(v.payment.receivedAmount - v.payment.expectedAmount) >= 0.01,
  )
  if (divergences.length > 0) {
    const total = roundMoney(
      divergences.reduce((sum, v) => sum + (v.payment!.receivedAmount - v.payment!.expectedAmount), 0),
    )
    insights.push({
      id: 'divergence',
      text:
        total < 0
          ? `${divergences.length} pagamento${divergences.length > 1 ? 's vieram' : ' veio'} ${formatMoney(Math.abs(total))} abaixo do previsto.`
          : `${divergences.length} pagamento${divergences.length > 1 ? 's vieram' : ' veio'} ${formatMoney(total)} acima do previsto.`,
      tone: total < 0 ? 'warning' : 'positive',
    })
  }

  return insights
}
