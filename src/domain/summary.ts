/**
 * Agregações financeiras e de agenda.
 * Toda soma de dinheiro/horas do app sai daqui, para que Início, Financeiro
 * e Relatórios nunca discordem entre si.
 *
 * Convenção de período: um plantão pertence ao período da sua DATA DE INÍCIO.
 */
import type { LocalDate, ShiftView } from '@/db/types'
import { datePartOf, startOfWeek, endOfWeek, toDate } from './datetime'
import { roundMoney } from './money'

export interface FinanceTotals {
  /** Soma dos valores previstos (plantões não cancelados). */
  expected: number
  /** Realizados, ainda não pagos e dentro do prazo. */
  pending: number
  /** Realizados, não pagos e com a data prevista vencida. */
  overdue: number
  /** Soma do que foi efetivamente recebido. */
  received: number
  /** Tudo que ainda falta entrar: pending + overdue. */
  outstanding: number
}

export const emptyTotals: FinanceTotals = {
  expected: 0,
  pending: 0,
  overdue: 0,
  received: 0,
  outstanding: 0,
}

export function financeTotals(views: ShiftView[]): FinanceTotals {
  let expected = 0
  let pending = 0
  let overdue = 0
  let received = 0

  for (const v of views) {
    if (v.shift.cancelled) continue
    expected += v.shift.expectedAmount
    if (v.paymentStatus === 'pending') pending += v.shift.expectedAmount
    else if (v.paymentStatus === 'overdue') overdue += v.shift.expectedAmount
    else if (v.paymentStatus === 'received') received += v.payment?.receivedAmount ?? 0
  }

  return {
    expected: roundMoney(expected),
    pending: roundMoney(pending),
    overdue: roundMoney(overdue),
    received: roundMoney(received),
    outstanding: roundMoney(pending + overdue),
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
  const running = views.find((v) => v.status === 'inProgress')
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

/** Plantões de um dia específico — inclui os que começaram na véspera e atravessaram. */
export function shiftsOnDay(views: ShiftView[], day: LocalDate): ShiftView[] {
  return sortByStart(
    views.filter((v) => {
      const start = datePartOf(v.shift.startDateTime)
      const end = datePartOf(v.shift.endDateTime)
      return start === day || (start < day && end >= day)
    }),
  )
}
