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
  repeatStarts,
  syncMoney,
  type ShiftFormValues,
} from '@/components/shifts/shiftFormValues'
import { dayScale, hourScale, MAX_OCCURRENCES } from '@/domain/recurrence'
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

describe('repeatStarts', () => {
  it('devolve só o plantão informado quando não repete', () => {
    expect(repeatStarts(base())).toEqual(['2026-08-25T19:00'])
  })

  it('gera a série diária até a data limite', () => {
    expect(
      repeatStarts(base({ recurrence: { kind: 'daily' }, repeatUntil: '2026-08-28' })),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-08-26T19:00',
      '2026-08-27T19:00',
      '2026-08-28T19:00',
    ])
  })

  it('gera a série semanal no dia da data de início', () => {
    // 25/08/2026 é uma terça-feira.
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [2], everyWeeks: 1 },
          repeatUntil: '2026-09-15',
        }),
      ),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-09-01T19:00',
      '2026-09-08T19:00',
      '2026-09-15T19:00',
    ])
  })

  it('gera uma ocorrência por dia da semana marcado', () => {
    // Terça (2) e quinta (4), a partir de terça 25/08.
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [2, 4], everyWeeks: 1 },
          repeatUntil: '2026-09-04',
        }),
      ),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T19:00',
      '2026-09-01T19:00',
      '2026-09-03T19:00',
    ])
  })

  it('começa no dia marcado mesmo quando ele é anterior à data de início', () => {
    // Segunda (1) marcada com início na terça 25/08: a série começa na segunda
    // 24/08, da mesma semana. É a regra pedida — o dia marcado manda.
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [1], everyWeeks: 1 },
          repeatUntil: '2026-09-10',
        }),
      ),
    ).toEqual(['2026-08-24T19:00', '2026-08-31T19:00', '2026-09-07T19:00'])
  })

  it('ordena as ocorrências mesmo com dias marcados fora de ordem', () => {
    const starts = repeatStarts(
      base({
        recurrence: { kind: 'weekdays', weekdays: [5, 3], everyWeeks: 1 },
        repeatUntil: '2026-09-05',
      }),
    )
    expect(starts).toEqual([...starts].sort())
    expect(starts).toEqual([
      '2026-08-26T19:00',
      '2026-08-28T19:00',
      '2026-09-02T19:00',
      '2026-09-04T19:00',
    ])
  })

  it('sem nenhum dia marcado, cai no dia da data de início', () => {
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [], everyWeeks: 1 },
          repeatUntil: '2026-09-08',
        }),
      ),
    ).toEqual(['2026-08-25T19:00', '2026-09-01T19:00', '2026-09-08T19:00'])
  })

  it('gera a série quinzenal', () => {
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [2], everyWeeks: 2 },
          repeatUntil: '2026-09-30',
        }),
      ),
    ).toEqual(['2026-08-25T19:00', '2026-09-08T19:00', '2026-09-22T19:00'])
  })

  it('gera a série mensal preservando o dia', () => {
    expect(
      repeatStarts(base({ recurrence: { kind: 'monthlyDay' }, repeatUntil: '2026-11-30' })),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-09-25T19:00',
      '2026-10-25T19:00',
      '2026-11-25T19:00',
    ])
  })

  it('a escala de horas anda pelo ciclo, não pelo calendário', () => {
    // 12×24: começa 25/08 às 19:00, volta 36h depois — 27/08 às 07:00.
    expect(
      repeatStarts(
        base({ recurrence: hourScale([12, 24]), repeatUntil: '2026-08-29' }),
      ),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-08-27T07:00',
      '2026-08-28T19:00',
    ])
  })

  it('a escala de dias trabalha em blocos', () => {
    // 2×2: dois plantões seguidos, dois dias de folga.
    expect(
      repeatStarts(base({ recurrence: dayScale([2, 2]), repeatUntil: '2026-09-01' })),
    ).toEqual([
      '2026-08-25T19:00',
      '2026-08-26T19:00',
      '2026-08-29T19:00',
      '2026-08-30T19:00',
    ])
  })

  it('nunca devolve lista vazia, mesmo com limite anterior ao início', () => {
    expect(
      repeatStarts(
        base({
          recurrence: { kind: 'weekdays', weekdays: [2], everyWeeks: 1 },
          repeatUntil: '2026-01-01',
        }),
      ),
    ).toEqual(['2026-08-25T19:00'])
  })

  it('respeita o teto de segurança da série', () => {
    const starts = repeatStarts(base({ recurrence: { kind: 'daily' }, repeatUntil: '2030-01-01' }))
    expect(starts).toHaveLength(MAX_OCCURRENCES)
  })

  it('o teto vale também para a série semanal com vários dias', () => {
    const starts = repeatStarts(
      base({
        recurrence: { kind: 'weekdays', weekdays: [0, 1, 2, 3, 4, 5, 6], everyWeeks: 1 },
        repeatUntil: '2030-01-01',
      }),
    )
    expect(starts.length).toBeLessThanOrEqual(MAX_OCCURRENCES)
  })
})

describe('syncMoney', () => {
  it('deriva o valor por hora quando o total é digitado', () => {
    const values = syncMoney(base({ amountText: '1.200,00' }), 'fixed')
    expect(values.paymentMode).toBe('fixed')
    expect(values.hourlyText).toBe('100,00')
    expect(formExpectedAmount(values)).toBe(1200)
  })

  it('deriva o total quando o valor por hora é digitado', () => {
    const values = syncMoney(base({ hourlyText: '100,00' }), 'hourly')
    expect(values.paymentMode).toBe('hourly')
    expect(values.amountText).toBe('1.200,00')
    expect(formExpectedAmount(values)).toBe(1200)
  })

  it('acompanha a duração: 36h a R$ 100/h dão R$ 3.600', () => {
    const values = syncMoney(applyDuration(base(), 36), 'hourly')
    expect(formExpectedAmount({ ...values, hourlyText: '100,00' })).toBe(3600)
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
    expect(
      formFromShift(shift('2026-08-25T19:00', '2026-08-26T07:00'), 'UPA', 'blue').recurrence.kind,
    ).toBe('none')
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
    const values = formFromDuplicate(original, 'UPA', 'blue')
    expect(formDuration(values)).toBe(36)
    expect(values.startDate).not.toBe('2026-08-10')
    expect(formRange(values).startDateTime.slice(11)).toBe('07:00')
  })
})
