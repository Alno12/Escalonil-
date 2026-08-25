/** Estado do formulário de plantão e conversões de/para o banco. */
import type { LocalDate, PaymentMode, Settings, Shift } from '@/db/types'
import {
  addDays,
  baseDayShift,
  buildShiftRange,
  datePartOf,
  extraDaysOf,
  timePartOf,
  todayISO,
} from '@/domain/datetime'
import { computeExpectedAmount } from '@/domain/shift'
import { parseMoneyInput } from '@/domain/money'
import { suggestPaymentDate } from '@/domain/shift'

/** Repetição do plantão. `none` é o caso normal. */
export type RepeatMode = 'none' | 'weekly' | 'biweekly'

/** Quantos dias separam cada ocorrência da série. */
export const REPEAT_INTERVAL_DAYS: Record<RepeatMode, number> = {
  none: 0,
  weekly: 7,
  biweekly: 14,
}

export interface ShiftFormValues {
  date: LocalDate
  startTime: string
  endTime: string
  /** Dias somados além da virada automática — plantões de 36h e afins. */
  extraDays: number
  repeat: RepeatMode
  /** Total de ocorrências da série, contando a primeira. */
  repeatCount: number
  locationName: string
  shiftType: string
  paymentMode: PaymentMode
  /** Texto livre; convertido com `parseMoneyInput` só na hora de salvar. */
  fixedAmountText: string
  hourlyRateText: string
  expectedPaymentDate: string
  notes: string
}

const moneyToText = (value: number) =>
  value > 0 ? value.toFixed(2).replace('.', ',').replace(/,00$/, '') : ''

export function emptyForm(settings: Settings, date?: LocalDate): ShiftFormValues {
  const day = date ?? todayISO()
  const { endDateTime } = buildShiftRange(day, '07:00', '19:00')
  return {
    date: day,
    startTime: '07:00',
    endTime: '19:00',
    extraDays: 0,
    repeat: 'none',
    repeatCount: 4,
    locationName: '',
    shiftType: '',
    paymentMode: settings.defaultPaymentMode,
    fixedAmountText: moneyToText(settings.defaultFixedAmount),
    hourlyRateText: moneyToText(settings.defaultHourlyRate),
    expectedPaymentDate: suggestPaymentDate(endDateTime, settings.paymentTermDays),
    notes: '',
  }
}

export function formFromShift(shift: Shift, locationName: string): ShiftFormValues {
  return {
    date: datePartOf(shift.startDateTime),
    startTime: timePartOf(shift.startDateTime),
    endTime: timePartOf(shift.endDateTime),
    extraDays: extraDaysOf(shift.startDateTime, shift.endDateTime),
    // Repetição é sempre uma escolha nova: editar ou duplicar não recria a série.
    repeat: 'none',
    repeatCount: 4,
    locationName,
    shiftType: shift.shiftType,
    paymentMode: shift.paymentMode,
    fixedAmountText: moneyToText(shift.fixedAmount),
    hourlyRateText: moneyToText(shift.hourlyRate),
    expectedPaymentDate: shift.expectedPaymentDate ?? '',
    notes: shift.notes,
  }
}

/** Cópia para "Duplicar": mantém tudo e traz a data para hoje (§48). */
export function formFromDuplicate(
  shift: Shift,
  locationName: string,
  settings: Settings,
): ShiftFormValues {
  const base = formFromShift(shift, locationName)
  const today = todayISO()
  const { endDateTime } = buildShiftRange(today, base.startTime, base.endTime, base.extraDays)
  return {
    ...base,
    date: today,
    expectedPaymentDate: suggestPaymentDate(endDateTime, settings.paymentTermDays),
  }
}

/** Início e fim resolvidos, incluindo virada de meia-noite e dias extras. */
export function formRange(values: ShiftFormValues) {
  return buildShiftRange(values.date, values.startTime, values.endTime, values.extraDays)
}

/** Datas de início de cada ocorrência da série (a primeira é a do formulário). */
export function repeatDates(values: ShiftFormValues): LocalDate[] {
  const step = REPEAT_INTERVAL_DAYS[values.repeat]
  if (step === 0) return [values.date]
  const total = Math.max(1, Math.min(52, values.repeatCount))
  return Array.from({ length: total }, (_, i) => addDays(values.date, i * step))
}

/** Valor previsto conforme o que está digitado agora. */
export function formExpectedAmount(values: ShiftFormValues): number {
  const { startDateTime, endDateTime } = formRange(values)
  return computeExpectedAmount({
    startDateTime,
    endDateTime,
    paymentMode: values.paymentMode,
    fixedAmount: parseMoneyInput(values.fixedAmountText),
    hourlyRate: parseMoneyInput(values.hourlyRateText),
  })
}

/** Quantos dias inteiros o plantão avança do início ao fim. */
export function formDayShift(values: ShiftFormValues): number {
  return baseDayShift(values.startTime, values.endTime) + Math.max(0, values.extraDays)
}
