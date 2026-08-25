/** Estado do formulário de plantão e conversões de/para o banco. */
import type { LocalDate, PaymentMode, Settings, Shift } from '@/db/types'
import { buildShiftRange, datePartOf, timePartOf, todayISO } from '@/domain/datetime'
import { computeExpectedAmount } from '@/domain/shift'
import { parseMoneyInput } from '@/domain/money'
import { suggestPaymentDate } from '@/domain/shift'

export interface ShiftFormValues {
  date: LocalDate
  startTime: string
  endTime: string
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
  const { endDateTime } = buildShiftRange(today, base.startTime, base.endTime)
  return {
    ...base,
    date: today,
    expectedPaymentDate: suggestPaymentDate(endDateTime, settings.paymentTermDays),
  }
}

/** Início e fim resolvidos, incluindo a virada de meia-noite. */
export function formRange(values: ShiftFormValues) {
  return buildShiftRange(values.date, values.startTime, values.endTime)
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

export function formCrossesMidnight(values: ShiftFormValues): boolean {
  return values.endTime <= values.startTime
}
