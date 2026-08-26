/** Estado do formulário de plantão e conversões de/para o banco. */
import type { LocalDate, LocalDateTime, LocationColor, PaymentMode, Settings, Shift } from '@/db/types'
import {
  addHours,
  addMonths,
  datePartOf,
  durationInHours,
  joinDateTime,
  timePartOf,
  todayISO,
} from '@/domain/datetime'
import {
  NO_RECURRENCE,
  recurrenceStarts,
  type Recurrence,
} from '@/domain/recurrence'
import { computeExpectedAmount } from '@/domain/shift'
import { moneyToInput, parseMoneyInput, roundMoney } from '@/domain/money'

/** Atalhos de duração do formulário, em horas. */
export const DURATION_SHORTCUTS = [6, 12, 24, 36, 48]

export interface ShiftFormValues {
  /** Complemento do local; nunca substitui o nome do local. */
  title: string
  locationName: string
  color: LocationColor
  shiftType: string
  startDate: LocalDate
  startTime: string
  endDate: LocalDate
  endTime: string
  /** Escala ou recorrência escolhida na tela de frequência. */
  recurrence: Recurrence
  repeatUntil: LocalDate
  /** Valor total do plantão, como texto enquanto o usuário digita. */
  amountText: string
  /** Valor por hora, como texto. Espelha `amountText` pela duração. */
  hourlyText: string
  /** Qual dos dois campos o usuário editou por último. */
  paymentMode: PaymentMode
  notes: string
}

export function emptyForm(settings: Settings, date?: LocalDate): ShiftFormValues {
  const startDate = date ?? todayISO()
  const start = joinDateTime(startDate, '19:00')
  const end = addHours(start, 12)
  return {
    title: '',
    locationName: '',
    color: 'blue',
    shiftType: '',
    startDate,
    startTime: '19:00',
    endDate: datePartOf(end),
    endTime: timePartOf(end),
    recurrence: NO_RECURRENCE,
    repeatUntil: addMonths(startDate, 3),
    amountText: moneyToInput(settings.defaultFixedAmount),
    hourlyText: moneyToInput(settings.defaultHourlyRate),
    paymentMode: settings.defaultPaymentMode,
    notes: '',
  }
}

export function formFromShift(
  shift: Shift,
  locationName: string,
  color: LocationColor,
): ShiftFormValues {
  const hours = durationInHours(shift.startDateTime, shift.endDateTime)
  return {
    title: shift.title,
    locationName,
    color,
    shiftType: shift.shiftType,
    startDate: datePartOf(shift.startDateTime),
    startTime: timePartOf(shift.startDateTime),
    endDate: datePartOf(shift.endDateTime),
    endTime: timePartOf(shift.endDateTime),
    // Repetição é sempre uma escolha nova: editar ou duplicar não recria a série.
    recurrence: NO_RECURRENCE,
    repeatUntil: addMonths(datePartOf(shift.startDateTime), 3),
    amountText: moneyToInput(shift.expectedAmount),
    hourlyText: moneyToInput(
      shift.hourlyRate > 0 ? shift.hourlyRate : hours > 0 ? roundMoney(shift.expectedAmount / hours) : 0,
    ),
    paymentMode: shift.paymentMode,
    notes: shift.notes,
  }
}

/** Cópia para "Duplicar": mantém tudo e traz a data para hoje. */
export function formFromDuplicate(
  shift: Shift,
  locationName: string,
  color: LocationColor,
): ShiftFormValues {
  const base = formFromShift(shift, locationName, color)
  const today = todayISO()
  // Preserva a duração original ao mover a data.
  const hours = durationInHours(shift.startDateTime, shift.endDateTime)
  const start = joinDateTime(today, base.startTime)
  const end = addHours(start, hours)
  return {
    ...base,
    startDate: today,
    endDate: datePartOf(end),
    endTime: timePartOf(end),
    repeatUntil: addMonths(today, 3),
  }
}

/** Início e fim do plantão como estão no formulário. */
export function formRange(values: ShiftFormValues): {
  startDateTime: LocalDateTime
  endDateTime: LocalDateTime
} {
  return {
    startDateTime: joinDateTime(values.startDate, values.startTime),
    endDateTime: joinDateTime(values.endDate, values.endTime),
  }
}

export function formDuration(values: ShiftFormValues): number {
  const { startDateTime, endDateTime } = formRange(values)
  return durationInHours(startDateTime, endDateTime)
}

/** Aplica um atalho de duração: o término passa a ser início + N horas. */
export function applyDuration(values: ShiftFormValues, hours: number): ShiftFormValues {
  const end = addHours(joinDateTime(values.startDate, values.startTime), hours)
  return { ...values, endDate: datePartOf(end), endTime: timePartOf(end) }
}

/** Qual atalho de duração corresponde ao intervalo atual, se algum. */
export function activeDurationShortcut(values: ShiftFormValues): number | null {
  const hours = formDuration(values)
  return DURATION_SHORTCUTS.find((h) => Math.abs(h - hours) < 0.01) ?? null
}

/** Valor previsto conforme o que está digitado agora. */
export function formExpectedAmount(values: ShiftFormValues): number {
  const { startDateTime, endDateTime } = formRange(values)
  return computeExpectedAmount({
    startDateTime,
    endDateTime,
    paymentMode: values.paymentMode,
    fixedAmount: parseMoneyInput(values.amountText),
    hourlyRate: parseMoneyInput(values.hourlyText),
  })
}

/**
 * Mantém total e valor/hora coerentes: quem foi editado manda, o outro é
 * recalculado pela duração. Assim os dois campos sempre contam a mesma história.
 */
export function syncMoney(values: ShiftFormValues, edited: PaymentMode): ShiftFormValues {
  const hours = formDuration(values)
  if (hours <= 0) return { ...values, paymentMode: edited }

  if (edited === 'fixed') {
    const total = parseMoneyInput(values.amountText)
    return {
      ...values,
      paymentMode: 'fixed',
      hourlyText: total > 0 ? moneyToInput(roundMoney(total / hours)) : '',
    }
  }

  const hourly = parseMoneyInput(values.hourlyText)
  return {
    ...values,
    paymentMode: 'hourly',
    amountText: hourly > 0 ? moneyToInput(roundMoney(hourly * hours)) : '',
  }
}

/**
 * Instantes de início de cada plantão da série, respeitando a data limite.
 *
 * A conta mora em `domain/recurrence.ts`; aqui só se junta a data e a hora do
 * formulário. A primeira ocorrência pode ser ANTES da data digitada quando a
 * escala marca dias da semana — é o comportamento pedido: a série começa no
 * dia marcado, mesmo que esse dia já tenha passado.
 */
export function repeatStarts(values: ShiftFormValues): LocalDateTime[] {
  return recurrenceStarts(
    joinDateTime(values.startDate, values.startTime),
    values.recurrence,
    values.repeatUntil,
  )
}
