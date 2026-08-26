/** Estado do formulário de plantão e conversões de/para o banco. */
import type { LocalDate, LocalDateTime, LocationColor, PaymentMode, Settings, Shift } from '@/db/types'
import {
  addDays,
  addHours,
  addMonths,
  datePartOf,
  durationInHours,
  joinDateTime,
  timePartOf,
  todayISO,
  toDate,
} from '@/domain/datetime'
import { computeExpectedAmount } from '@/domain/shift'
import { parseMoneyInput, roundMoney } from '@/domain/money'

/** Frequências oferecidas na recorrência. */
export type RepeatMode = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'

export const REPEAT_LABELS: Record<RepeatMode, string> = {
  none: 'Nunca',
  daily: 'Todo dia',
  weekly: 'Toda semana',
  biweekly: 'A cada 2 semanas',
  monthly: 'Todo mês',
}

/** Teto de segurança para uma série — evita gerar milhares de plantões. */
export const MAX_OCCURRENCES = 120

/** Dias da semana, na ordem brasileira (domingo primeiro). */
export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
]

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
  repeat: RepeatMode
  /**
   * Dias da semana marcados quando a frequência é semanal (0 = domingo).
   * Vazio nunca acontece: o formulário garante ao menos o dia do início.
   */
  weekdays: number[]
  repeatUntil: LocalDate
  /** Valor total do plantão, como texto enquanto o usuário digita. */
  amountText: string
  /** Valor por hora, como texto. Espelha `amountText` pela duração. */
  hourlyText: string
  /** Qual dos dois campos o usuário editou por último. */
  paymentMode: PaymentMode
  notes: string
}

const moneyToText = (value: number) =>
  value > 0 ? value.toFixed(2).replace('.', ',').replace(/,00$/, '') : ''

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
    repeat: 'none',
    weekdays: [toDate(startDate).getDay()],
    repeatUntil: addMonths(startDate, 3),
    amountText: moneyToText(settings.defaultFixedAmount),
    hourlyText: moneyToText(settings.defaultHourlyRate),
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
    repeat: 'none',
    weekdays: [toDate(datePartOf(shift.startDateTime)).getDay()],
    repeatUntil: addMonths(datePartOf(shift.startDateTime), 3),
    amountText: moneyToText(shift.expectedAmount),
    hourlyText: moneyToText(
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
    weekdays: [toDate(today).getDay()],
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
      hourlyText: total > 0 ? moneyToText(roundMoney(total / hours)) : '',
    }
  }

  const hourly = parseMoneyInput(values.hourlyText)
  return {
    ...values,
    paymentMode: 'hourly',
    amountText: hourly > 0 ? moneyToText(roundMoney(hourly * hours)) : '',
  }
}

/**
 * Datas de início de cada ocorrência da série, respeitando a data limite.
 *
 * Na frequência semanal a série segue os DIAS MARCADOS: escolher segunda e
 * quinta gera duas ocorrências por semana. Nas demais frequências o passo é
 * fixo a partir da data de início.
 */
export function repeatDates(values: ShiftFormValues): LocalDate[] {
  if (values.repeat === 'none') return [values.startDate]

  const dates: LocalDate[] =
    values.repeat === 'weekly' ? weeklyDates(values) : steppedDates(values)

  // A primeira ocorrência sempre entra, mesmo se o limite for anterior a ela.
  return dates.length > 0 ? dates : [values.startDate]
}

function steppedDates(values: ShiftFormValues): LocalDate[] {
  const dates: LocalDate[] = []
  let current = values.startDate

  while (current <= values.repeatUntil && dates.length < MAX_OCCURRENCES) {
    dates.push(current)
    current =
      values.repeat === 'monthly'
        ? addMonths(current, 1)
        : addDays(current, values.repeat === 'daily' ? 1 : 14)
  }
  return dates
}

function weeklyDates(values: ShiftFormValues): LocalDate[] {
  const selected = normalizeWeekdays(values)
  const dates: LocalDate[] = []

  // Começa no domingo da semana do início e varre dia a dia; simples de ler e
  // impossível de errar a virada de mês ou de ano.
  let cursor = addDays(values.startDate, -toDate(values.startDate).getDay())

  while (cursor <= values.repeatUntil && dates.length < MAX_OCCURRENCES) {
    if (cursor >= values.startDate && selected.includes(toDate(cursor).getDay())) {
      dates.push(cursor)
    }
    cursor = addDays(cursor, 1)
  }
  return dates
}

/** Nunca devolve lista vazia: sem marcação, vale o dia da data de início. */
export function normalizeWeekdays(values: ShiftFormValues): number[] {
  return values.weekdays.length > 0
    ? [...values.weekdays].sort((a, b) => a - b)
    : [toDate(values.startDate).getDay()]
}
