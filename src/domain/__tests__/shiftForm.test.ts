import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/db/db'
import {
  emptyForm,
  formDayShift,
  formExpectedAmount,
  formFromShift,
  formRange,
  repeatDates,
  REPEAT_INTERVAL_DAYS,
  type ShiftFormValues,
} from '@/components/shifts/shiftFormValues'
import { durationInHours } from '../datetime'
import type { Shift } from '@/db/types'

const base = (overrides: Partial<ShiftFormValues> = {}): ShiftFormValues => ({
  ...emptyForm(DEFAULT_SETTINGS, '2026-08-25'),
  ...overrides,
})

describe('repeatDates', () => {
  it('devolve só a data informada quando não repete', () => {
    expect(repeatDates(base())).toEqual(['2026-08-25'])
  })

  it('gera a série semanal a partir da primeira data', () => {
    expect(repeatDates(base({ repeat: 'weekly', repeatCount: 4 }))).toEqual([
      '2026-08-25',
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ])
  })

  it('gera a série quinzenal', () => {
    expect(repeatDates(base({ repeat: 'biweekly', repeatCount: 3 }))).toEqual([
      '2026-08-25',
      '2026-09-08',
      '2026-09-22',
    ])
  })

  it('limita a série a um ano e nunca devolve lista vazia', () => {
    expect(repeatDates(base({ repeat: 'weekly', repeatCount: 999 }))).toHaveLength(52)
    expect(repeatDates(base({ repeat: 'weekly', repeatCount: 0 }))).toHaveLength(1)
  })

  it('mantém os intervalos coerentes com os rótulos', () => {
    expect(REPEAT_INTERVAL_DAYS.weekly).toBe(7)
    expect(REPEAT_INTERVAL_DAYS.biweekly).toBe(14)
    expect(REPEAT_INTERVAL_DAYS.none).toBe(0)
  })
})

describe('dias extras no formulário', () => {
  it('um plantão diurno normal não avança dia', () => {
    const values = base({ startTime: '07:00', endTime: '19:00' })
    expect(formDayShift(values)).toBe(0)
    expect(durationInHours(formRange(values).startDateTime, formRange(values).endDateTime)).toBe(12)
  })

  it('um plantão noturno avança um dia sozinho', () => {
    expect(formDayShift(base({ startTime: '19:00', endTime: '07:00' }))).toBe(1)
  })

  it('permite montar um plantão de 36 horas', () => {
    const values = base({ startTime: '07:00', endTime: '19:00', extraDays: 1 })
    const range = formRange(values)
    expect(formDayShift(values)).toBe(1)
    expect(durationInHours(range.startDateTime, range.endDateTime)).toBe(36)
  })

  it('calcula o valor por hora sobre a duração real do plantão longo', () => {
    const values = base({
      startTime: '07:00',
      endTime: '19:00',
      extraDays: 1,
      paymentMode: 'hourly',
      hourlyRateText: '100',
    })
    expect(formExpectedAmount(values)).toBe(3600)
  })
})

describe('formFromShift', () => {
  const shift = (startDateTime: string, endDateTime: string): Shift => ({
    id: 's1',
    startDateTime,
    endDateTime,
    locationId: 'l1',
    shiftType: '',
    paymentMode: 'fixed',
    fixedAmount: 100,
    hourlyRate: 0,
    expectedAmount: 100,
    expectedPaymentDate: null,
    notes: '',
    cancelled: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  })

  it('reabre um plantão longo preservando os dias extras', () => {
    const values = formFromShift(shift('2026-08-25T07:00', '2026-08-26T19:00'), 'UPA')
    expect(values.extraDays).toBe(1)
    expect(formRange(values).endDateTime).toBe('2026-08-26T19:00')
  })

  it('nunca reabre um plantão já com repetição marcada', () => {
    const values = formFromShift(shift('2026-08-25T19:00', '2026-08-26T07:00'), 'UPA')
    expect(values.repeat).toBe('none')
  })
})
