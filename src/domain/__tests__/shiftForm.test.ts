import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/db/db'
import {
  activeDurationShortcut,
  applyDuration,
  emptyForm,
  formDuration,
  formExpectedAmount,
  formFromDuplicate,
  formFromShift,
  formRange,
  MAX_OCCURRENCES,
  repeatDates,
  syncMoney,
  type ShiftFormValues,
} from '@/components/shifts/shiftFormValues'
import type { Shift } from '@/db/types'

const base = (overrides: Partial<ShiftFormValues> = {}): ShiftFormValues => ({
  ...emptyForm(DEFAULT_SETTINGS, '2026-08-25'),
  ...overrides,
})

const shift = (startDateTime: string, endDateTime: string, extra: Partial<Shift> = {}): Shift => ({
  id: 's1',
  title: '',
  startDateTime,
  endDateTime,
  locationId: 'l1',
  shiftType: '',
  paymentMode: 'fixed',
  fixedAmount: 1200,
  hourlyRate: 0,
  expectedAmount: 1200,
  expectedPaymentDate: null,
  notes: '',
  cancelled: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...extra,
})

describe('emptyForm', () => {
  it('propõe um plantão noturno de 12 horas', () => {
    const values = base()
    expect(values.startDate).toBe('2026-08-25')
    expect(values.startTime).toBe('19:00')
    expect(values.endDate).toBe('2026-08-26')
    expect(values.endTime).toBe('07:00')
    expect(formDuration(values)).toBe(12)
  })
})

describe('atalhos de duração', () => {
  it('preenchem o término a partir do início', () => {
    const values = applyDuration(base({ startTime: '07:00' }), 36)
    expect(values.endDate).toBe('2026-08-26')
    expect(values.endTime).toBe('19:00')
    expect(formDuration(values)).toBe(36)
  })

  it('permitem plantões de 48 horas', () => {
    expect(formDuration(applyDuration(base(), 48))).toBe(48)
  })

  it('reconhecem qual atalho corresponde ao intervalo atual', () => {
    expect(activeDurationShortcut(base())).toBe(12)
    expect(activeDurationShortcut(applyDuration(base(), 24))).toBe(24)
    expect(activeDurationShortcut(base({ endTime: '20:00', endDate: '2026-08-25' }))).toBeNull()
  })
})

describe('repeatDates', () => {
  it('devolve só a data informada quando não repete', () => {
    expect(repeatDates(base())).toEqual(['2026-08-25'])
  })

  it('gera a série diária até a data limite', () => {
    expect(repeatDates(base({ repeat: 'daily', repeatUntil: '2026-08-28' }))).toEqual([
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
    ])
  })

  it('gera a série semanal', () => {
    expect(repeatDates(base({ repeat: 'weekly', repeatUntil: '2026-09-15' }))).toEqual([
      '2026-08-25',
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ])
  })

  it('gera a série quinzenal', () => {
    expect(repeatDates(base({ repeat: 'biweekly', repeatUntil: '2026-09-30' }))).toEqual([
      '2026-08-25',
      '2026-09-08',
      '2026-09-22',
    ])
  })

  it('gera a série mensal preservando o dia', () => {
    expect(repeatDates(base({ repeat: 'monthly', repeatUntil: '2026-11-30' }))).toEqual([
      '2026-08-25',
      '2026-09-25',
      '2026-10-25',
      '2026-11-25',
    ])
  })

  it('nunca devolve lista vazia, mesmo com limite anterior ao início', () => {
    expect(repeatDates(base({ repeat: 'weekly', repeatUntil: '2026-01-01' }))).toEqual([
      '2026-08-25',
    ])
  })

  it('respeita o teto de segurança da série', () => {
    const dates = repeatDates(base({ repeat: 'daily', repeatUntil: '2030-01-01' }))
    expect(dates).toHaveLength(MAX_OCCURRENCES)
  })
})

describe('syncMoney', () => {
  it('deriva o valor por hora quando o total é digitado', () => {
    const values = syncMoney(base({ amountText: '1200' }), 'fixed')
    expect(values.paymentMode).toBe('fixed')
    expect(values.hourlyText).toBe('100')
    expect(formExpectedAmount(values)).toBe(1200)
  })

  it('deriva o total quando o valor por hora é digitado', () => {
    const values = syncMoney(base({ hourlyText: '100' }), 'hourly')
    expect(values.paymentMode).toBe('hourly')
    expect(values.amountText).toBe('1200')
    expect(formExpectedAmount(values)).toBe(1200)
  })

  it('acompanha a duração: 36h a R$ 100/h dão R$ 3.600', () => {
    const values = syncMoney(applyDuration(base(), 36), 'hourly')
    expect(formExpectedAmount({ ...values, hourlyText: '100' })).toBe(3600)
  })

  it('limpa o outro campo quando o valor é zerado', () => {
    expect(syncMoney(base({ amountText: '' }), 'fixed').hourlyText).toBe('')
  })
})

describe('formFromShift', () => {
  it('reabre um plantão longo com o término correto', () => {
    const values = formFromShift(shift('2026-08-25T07:00', '2026-08-26T19:00'), 'UPA', 'teal')
    expect(values.endDate).toBe('2026-08-26')
    expect(values.endTime).toBe('19:00')
    expect(formDuration(values)).toBe(36)
    expect(values.color).toBe('teal')
  })

  it('nunca reabre um plantão já com repetição marcada', () => {
    expect(formFromShift(shift('2026-08-25T19:00', '2026-08-26T07:00'), 'UPA', 'blue').repeat).toBe(
      'none',
    )
  })

  it('traz o título como complemento, não no lugar do local', () => {
    const values = formFromShift(
      shift('2026-08-25T19:00', '2026-08-26T07:00', { title: 'Coordenação' }),
      'UPA Centro',
      'blue',
    )
    expect(values.title).toBe('Coordenação')
    expect(values.locationName).toBe('UPA Centro')
  })
})

describe('formFromDuplicate', () => {
  it('move para hoje preservando a duração', () => {
    const original = shift('2026-08-10T07:00', '2026-08-11T19:00')
    const values = formFromDuplicate(original, 'UPA', 'blue', DEFAULT_SETTINGS)
    expect(formDuration(values)).toBe(36)
    expect(values.startDate).not.toBe('2026-08-10')
    expect(formRange(values).startDateTime.slice(11)).toBe('07:00')
  })
})
