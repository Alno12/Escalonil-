/**
 * Agregações financeiras e de agenda.
 * Toda soma de dinheiro/horas do app sai daqui, para que Início, Financeiro
 * e Relatórios nunca discordem entre si.
 *
 * Convenção de período: um plantão pertence ao período da sua DATA DE INÍCIO.
 */
import type { LocalDate, Shift, ShiftView } from '@/db/types'
import { addDays, datePartOf, startOfWeek, endOfWeek, timePartOf, toDate } from './datetime'
import { roundMoney } from './money'

export interface FinanceTotals {
  /** Soma dos valores previstos (plantões não cancelados). */
  expected: number
  /** Realizados e ainda não pagos. */
  pending: number
  /** Soma do que foi efetivamente recebido. */
  received: number
  /** Tudo que ainda falta entrar. Hoje é igual a `pending`. */
  outstanding: number
}

export const emptyTotals: FinanceTotals = {
  expected: 0,
  pending: 0,
  received: 0,
  outstanding: 0,
}

export function financeTotals(views: ShiftView[]): FinanceTotals {
  let expected = 0
  let pending = 0
  let received = 0

  for (const v of views) {
    if (v.shift.cancelled) continue
    expected += v.shift.expectedAmount
    if (v.paymentStatus === 'pending') pending += v.shift.expectedAmount
    else if (v.paymentStatus === 'received') received += v.payment?.receivedAmount ?? 0
  }

  return {
    expected: roundMoney(expected),
    pending: roundMoney(pending),
    received: roundMoney(received),
    outstanding: roundMoney(pending),
  }
}

export interface PeriodSummary extends FinanceTotals {
  shifts: number
  hours: number
}

export function periodSummary(views: ShiftView[]): PeriodSummary {
  const active = views.filter((v) => !v.shift.cancelled)
  const hours = active.reduce((sum, v) => sum + v.durationHours, 0)
  return {
    ...financeTotals(active),
    shifts: active.length,
    hours: Math.round(hours * 100) / 100,
  }
}

// ---------------- Filtros ----------------

export function isActive(view: ShiftView): boolean {
  return !view.shift.cancelled
}

/** Plantões cuja data de início cai no intervalo (inclusivo nos dois lados). */
export function filterByRange(views: ShiftView[], from: LocalDate, to: LocalDate): ShiftView[] {
  return views.filter((v) => {
    const day = datePartOf(v.shift.startDateTime)
    return day >= from && day <= to
  })
}

export function filterByMonth(views: ShiftView[], month: string): ShiftView[] {
  return views.filter((v) => v.shift.startDateTime.slice(0, 7) === month)
}

export function sortByStart(views: ShiftView[], direction: 'asc' | 'desc' = 'asc'): ShiftView[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...views].sort(
    (a, b) => factor * a.shift.startDateTime.localeCompare(b.shift.startDateTime),
  )
}

// ---------------- Agenda ----------------

/** Resumo da semana que contém a data informada. */
export function weekSummary(views: ShiftView[], reference: LocalDate): PeriodSummary {
  return periodSummary(filterByRange(views, startOfWeek(reference), endOfWeek(reference)))
}

/**
 * O plantão em destaque na tela inicial: o que está acontecendo agora tem
 * prioridade; senão, o próximo agendado.
 */
export function currentOrNextShift(views: ShiftView[], now: Date = new Date()): ShiftView | undefined {
  // Com dois plantões sobrepostos em andamento (raro, mas permitido — ver
  // invariante 5), vale o que começou primeiro. Sem ordenar, quem aparecia
  // era o primeiro do array, que é a ordem de gravação no banco.
  const [running] = sortByStart(views.filter((v) => v.status === 'inProgress'))
  if (running) return running
  const nowMs = now.getTime()
  return sortByStart(views.filter((v) => v.status === 'scheduled')).find(
    (v) => toDate(v.shift.startDateTime).getTime() >= nowMs,
  )
}

/** Plantões de hoje em diante (em andamento e agendados), em ordem. */
export function upcomingShifts(views: ShiftView[], limit?: number): ShiftView[] {
  const upcoming = sortByStart(
    views.filter((v) => v.status === 'scheduled' || v.status === 'inProgress'),
  )
  return limit ? upcoming.slice(0, limit) : upcoming
}

/**
 * Hora a partir da qual um plantão que atravessou a meia-noite ainda OCUPA o
 * dia seguinte.
 *
 * O critério é a hora de término, não a duração: 12h (19:00 → 07:00), 18h
 * (13:00 → 07:00) e 24h (07:00 → 07:00) terminam todos às 07:00 e tomam
 * exatamente o mesmo pedaço do dia seguinte — de manhã o médico vai para casa.
 * Já um 24h que começa às 19:00 termina às 19:00 e come o dia inteiro.
 */
export const NEXT_DAY_CUTOFF = '12:00'

type Span = Pick<Shift, 'startDateTime' | 'endDateTime'>

/**
 * Se o plantão ocupa o dia informado.
 *
 * Vale sempre no dia em que COMEÇA — a mesma regra do resto do app
 * (`filterByRange`, Ritmo da semana, Mapa do mês, Recordes). Nos dias
 * seguintes, ocupa quando atravessa o dia inteiro ou quando termina depois do
 * meio-dia; sair às 07:00 deixa o dia livre.
 */
export function occupiesDay(shift: Span, day: LocalDate): boolean {
  const start = datePartOf(shift.startDateTime)
  if (start === day) return true
  if (start > day) return false
  const end = datePartOf(shift.endDateTime)
  if (end > day) return true
  return end === day && timePartOf(shift.endDateTime) > NEXT_DAY_CUTOFF
}

/**
 * Todos os dias que o plantão ocupa, do primeiro ao último.
 *
 * É o que o calendário usa para marcar os dias: assim o anel e as bolinhas
 * dizem exatamente o que a lista do dia vai mostrar embaixo.
 */
export function occupiedDays(shift: Span): LocalDate[] {
  const start = datePartOf(shift.startDateTime)
  const end = datePartOf(shift.endDateTime)
  const days = [start]
  for (let day = addDays(start, 1); day <= end; day = addDays(day, 1)) {
    if (day < end || timePartOf(shift.endDateTime) > NEXT_DAY_CUTOFF) days.push(day)
  }
  return days
}

/** Plantões de um dia específico, na ordem em que começam. */
export function shiftsOnDay(views: ShiftView[], day: LocalDate): ShiftView[] {
  return sortByStart(views.filter((v) => occupiesDay(v.shift, day)))
}
