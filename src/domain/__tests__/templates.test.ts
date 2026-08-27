import { describe, expect, it } from 'vitest'
import type { Location, Settings, Shift } from '@/db/types'
import { buildShiftTemplates } from '../templates'
import { applyTemplate, emptyForm } from '@/components/shifts/shiftFormValues'

const LOCATIONS: Location[] = [
  { id: 'upa', name: 'UPA Centro', color: 'blue', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'hosp', name: 'Hospital Regional', color: 'teal', createdAt: '2026-01-01T00:00:00.000Z' },
]

const SETTINGS: Settings = {
  id: 'app',
  theme: 'light',
  defaultPaymentMode: 'fixed',
  defaultHourlyRate: 0,
  defaultFixedAmount: 0,
  shiftTypes: [],
  lastBackupAt: null,
  vacationDate: null,
  vacationEnabled: false,
  lastSeenVersion: null,
  printLandscape: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function shift(
  id: string,
  startDateTime: string,
  endDateTime: string,
  expectedAmount: number,
  extra: Partial<Shift> = {},
): Shift {
  return {
    id,
    seriesId: '',
    title: '',
    startDateTime,
    endDateTime,
    locationId: 'upa',
    shiftType: '',
    paymentMode: 'fixed',
    fixedAmount: expectedAmount,
    hourlyRate: 0,
    expectedAmount,
    notes: '',
    cancelled: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...extra,
  }
}

/** Um noturno de 12h na UPA, sempre igual — só a data muda. */
const doze = (id: string, date: string, nextDate: string, extra: Partial<Shift> = {}) =>
  shift(id, `${date}T19:00`, `${nextDate}T07:00`, 1800, extra)

describe('modelos de plantão', () => {
  it('só vira modelo o que se repete', () => {
    const avulso = [doze('a', '2026-08-03', '2026-08-04')]
    expect(buildShiftTemplates(avulso, LOCATIONS)).toEqual([])

    const repetido = [
      doze('a', '2026-08-03', '2026-08-04'),
      doze('b', '2026-08-10', '2026-08-11'),
    ]
    const modelos = buildShiftTemplates(repetido, LOCATIONS)
    expect(modelos).toHaveLength(1)
    expect(modelos[0]).toMatchObject({
      locationName: 'UPA Centro',
      color: 'blue',
      startTime: '19:00',
      durationHours: 12,
      expectedAmount: 1800,
      uses: 2,
      lastUsed: '2026-08-10T19:00',
    })
  })

  it('a data não faz parte do modelo', () => {
    const modelos = buildShiftTemplates(
      [doze('a', '2026-08-03', '2026-08-04'), doze('b', '2027-02-19', '2027-02-20')],
      LOCATIONS,
    )
    expect(modelos).toHaveLength(1)
    expect(modelos[0].uses).toBe(2)
  })

  it('ordena do mais usado para o menos e desempata pelo mais recente', () => {
    const modelos = buildShiftTemplates(
      [
        doze('n1', '2026-08-03', '2026-08-04'),
        doze('n2', '2026-08-10', '2026-08-11'),
        doze('n3', '2026-08-17', '2026-08-18'),
        // Diurno na mesma UPA: outra hora de início, outro modelo.
        shift('d1', '2026-08-05T07:00', '2026-08-05T19:00', 1500),
        shift('d2', '2026-08-12T07:00', '2026-08-12T19:00', 1500),
        // Empata com o diurno em uso, mas é mais recente.
        shift('h1', '2026-08-06T07:00', '2026-08-06T19:00', 1500, { locationId: 'hosp' }),
        shift('h2', '2026-08-20T07:00', '2026-08-20T19:00', 1500, { locationId: 'hosp' }),
      ],
      LOCATIONS,
    )
    expect(modelos.map((m) => [m.locationName, m.startTime, m.uses])).toEqual([
      ['UPA Centro', '19:00', 3],
      ['Hospital Regional', '07:00', 2],
      ['UPA Centro', '07:00', 2],
    ])
  })

  it('separa modelos por título, tipo, duração e valor', () => {
    const base = [doze('a', '2026-08-03', '2026-08-04'), doze('b', '2026-08-10', '2026-08-11')]
    const variacoes = [
      ...base,
      doze('t1', '2026-09-01', '2026-09-02', { title: 'Coordenação' }),
      doze('t2', '2026-09-08', '2026-09-09', { title: 'Coordenação' }),
      doze('p1', '2026-10-01', '2026-10-02', { shiftType: 'Extra' }),
      doze('p2', '2026-10-08', '2026-10-09', { shiftType: 'Extra' }),
      doze('v1', '2026-11-02', '2026-11-03', { expectedAmount: 2000, fixedAmount: 2000 }),
      doze('v2', '2026-11-09', '2026-11-10', { expectedAmount: 2000, fixedAmount: 2000 }),
      shift('l1', '2026-12-01T19:00', '2026-12-02T13:00', 1800),
      shift('l2', '2026-12-08T19:00', '2026-12-09T13:00', 1800),
    ]
    expect(buildShiftTemplates(variacoes, LOCATIONS)).toHaveLength(5)
  })

  it('ignora cancelados e plantão de local removido', () => {
    const modelos = buildShiftTemplates(
      [
        doze('a', '2026-08-03', '2026-08-04'),
        doze('b', '2026-08-10', '2026-08-11', { cancelled: true }),
        doze('x', '2026-08-17', '2026-08-18', { locationId: 'sumiu' }),
        doze('y', '2026-08-24', '2026-08-25', { locationId: 'sumiu' }),
      ],
      LOCATIONS,
    )
    expect(modelos).toEqual([])
  })

  it('guarda o valor por hora quando o plantão foi cadastrado por hora', () => {
    const porHora = (id: string, date: string) =>
      shift(id, `${date}T07:00`, `${date}T19:00`, 1200, {
        paymentMode: 'hourly',
        fixedAmount: 0,
        hourlyRate: 100,
      })
    const [modelo] = buildShiftTemplates([porHora('a', '2026-08-03'), porHora('b', '2026-08-10')], LOCATIONS)
    expect(modelo.paymentMode).toBe('hourly')
    expect(modelo.hourlyRate).toBe(100)
    expect(modelo.expectedAmount).toBe(1200)
  })
})

describe('aplicar um modelo no formulário', () => {
  const [modelo] = buildShiftTemplates(
    [doze('a', '2026-08-03', '2026-08-04'), doze('b', '2026-08-10', '2026-08-11')],
    LOCATIONS,
  )

  it('mantém a data escolhida e traz o resto', () => {
    const antes = emptyForm(SETTINGS, '2026-09-22')
    const depois = applyTemplate(antes, modelo)

    expect(depois.startDate).toBe('2026-09-22')
    expect(depois.locationName).toBe('UPA Centro')
    expect(depois.color).toBe('blue')
    expect(depois.startTime).toBe('19:00')
    // 12h a partir das 19:00 caem na madrugada do dia seguinte.
    expect(depois.endDate).toBe('2026-09-23')
    expect(depois.endTime).toBe('07:00')
    expect(depois.amountText).toBe('1.800,00')
    expect(depois.hourlyText).toBe('150,00')
  })

  it('não recria a escala do plantão de origem', () => {
    const depois = applyTemplate(emptyForm(SETTINGS, '2026-09-22'), modelo)
    expect(depois.recurrence.kind).toBe('none')
  })
})
