import { describe, expect, it } from 'vitest'
import type { Location, Payment, Shift } from '@/db/types'
import { buildShiftViews } from '../shift'
import { toDate } from '../datetime'
import {
  currentOrNextShift,
  filterByMonth,
  financeTotals,
  periodSummary,
  shiftsOnDay,
  upcomingShifts,
  weekSummary,
} from '../summary'
import { buildIndicators, buildInsights, buildLocationReport, buildMonthlySeries } from '../reports'
import { roundMoney } from '../money'

const LOCATIONS: Location[] = [
  { id: 'upa', name: 'UPA Centro', color: 'blue', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'hosp', name: 'Hospital Regional', color: 'teal', createdAt: '2026-01-01T00:00:00.000Z' },
]

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

function payment(shiftId: string, receivedAmount: number, expectedAmount = receivedAmount): Payment {
  return {
    id: `pay-${shiftId}`,
    shiftId,
    expectedAmount,
    receivedAmount,
    receivedDate: '2026-09-04',
    notes: '',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  }
}

// "Agora" fixo para os testes: 25/08/2026 às 16:25 (uma terça-feira).
const NOW = toDate('2026-08-25T16:25')

const SHIFTS = [
  shift('passado-pago', '2026-08-10T07:00', '2026-08-10T19:00', 900),
  shift('passado-pendente', '2026-08-12T19:00', '2026-08-13T07:00', 1200),
  shift('passado-atrasado', '2026-08-14T07:00', '2026-08-14T19:00', 800),
  shift('agora', '2026-08-25T13:00', '2026-08-25T19:00', 650),
  shift('proximo', '2026-08-26T19:00', '2026-08-27T07:00', 1200, { locationId: 'hosp' }),
  shift('cancelado', '2026-08-27T07:00', '2026-08-27T19:00', 500, { cancelled: true }),
]

const PAYMENTS = [payment('passado-pago', 850, 900)]

const views = buildShiftViews(SHIFTS, LOCATIONS, PAYMENTS, NOW)

describe('financeTotals', () => {
  const totals = financeTotals(views)

  it('soma o previsto ignorando cancelados', () => {
    expect(totals.expected).toBe(900 + 1200 + 800 + 650 + 1200)
  })

  it('soma tudo que foi realizado e não recebido em "a receber"', () => {
    // Sem lógica de prazo: os três plantões passados não pagos entram juntos.
    expect(totals.pending).toBe(1200 + 800)
    expect(totals.outstanding).toBe(totals.pending)
  })

  it('usa o valor efetivamente recebido, não o previsto', () => {
    expect(totals.received).toBe(850)
  })
})

describe('periodSummary', () => {
  it('conta plantões e horas do período', () => {
    const agosto = periodSummary(filterByMonth(views, '2026-08'))
    expect(agosto.shifts).toBe(5)
    expect(agosto.hours).toBe(12 + 12 + 12 + 6 + 12)
  })
})

describe('weekSummary', () => {
  it('considera a semana de domingo a sábado da data informada', () => {
    // Semana de 23/08 a 29/08 contém "agora" e "proximo".
    const semana = weekSummary(views, '2026-08-25')
    expect(semana.shifts).toBe(2)
    expect(semana.hours).toBe(18)
    expect(semana.expected).toBe(1850)
  })
})

describe('agenda', () => {
  it('destaca o plantão em andamento antes do próximo agendado', () => {
    expect(currentOrNextShift(views, NOW)?.shift.id).toBe('agora')
  })

  it('cai para o próximo agendado quando nada está em andamento', () => {
    const later = buildShiftViews(SHIFTS, LOCATIONS, PAYMENTS, toDate('2026-08-25T20:00'))
    expect(currentOrNextShift(later, toDate('2026-08-25T20:00'))?.shift.id).toBe('proximo')
  })

  it('lista os próximos em ordem cronológica, sem cancelados', () => {
    expect(upcomingShifts(views).map((v) => v.shift.id)).toEqual(['agora', 'proximo'])
  })

  it('inclui no dia o plantão que começou na véspera', () => {
    expect(shiftsOnDay(views, '2026-08-27').map((v) => v.shift.id)).toEqual([
      'proximo',
      'cancelado',
    ])
  })
})

describe('relatórios', () => {
  const agosto = filterByMonth(views, '2026-08')

  it('calcula médias por plantão, por hora e horas por semana', () => {
    const ind = buildIndicators(agosto, '2026-08-01', '2026-08-31')
    expect(ind.shifts).toBe(5)
    expect(ind.hours).toBe(54)
    expect(ind.expected).toBe(4750)
    expect(ind.avgPerShift).toBe(950)
    expect(ind.avgPerHour).toBe(roundMoney(4750 / 54))
    expect(ind.avgHoursPerWeek).toBe(Math.round((54 / (31 / 7)) * 10) / 10)
  })

  it('agrupa por local com participação na renda', () => {
    const rows = buildLocationReport(agosto)
    expect(rows[0].name).toBe('UPA Centro')
    expect(rows[0].shifts).toBe(4)
    expect(rows[0].expected).toBe(3550)
    expect(rows[0].share + rows[1].share).toBeCloseTo(100, 1)
  })

  it('monta a série mensal ordenada', () => {
    const series = buildMonthlySeries(views)
    expect(series.map((b) => b.month)).toEqual(['2026-08'])
    expect(series[0].received).toBe(850)
  })

  it('gera insights comparando com o período anterior', () => {
    const anterior = [views[0]]
    const insights = buildInsights(agosto, anterior, {
      periodLabel: 'neste mês',
      previousLabel: 'no mês passado',
    })
    const ids = insights.map((i) => i.id)
    expect(ids).toContain('hours-delta')
    expect(ids).toContain('avg-hour')
    expect(ids).toContain('top-location')
    expect(ids).toContain('outstanding')
    expect(ids).toContain('divergence')
  })

  it('não gera insights sem plantões no período', () => {
    expect(buildInsights([], [], { periodLabel: 'neste mês', previousLabel: 'no mês passado' })).toEqual([])
  })
})


describe('plantão em destaque com sobreposição', () => {
  it('com dois em andamento, vale o que começou primeiro', () => {
    const agora = toDate('2026-08-27T12:00')
    const tarde = shift('tarde', '2026-08-27T11:00', '2026-08-27T23:00', 100)
    const cedo = shift('cedo', '2026-08-27T06:00', '2026-08-27T18:00', 100)
    const monta = (lista: Shift[]) => buildShiftViews(lista, LOCATIONS, [], agora)
    expect(currentOrNextShift(monta([tarde, cedo]), agora)?.shift.id).toBe('cedo')
    expect(currentOrNextShift(monta([cedo, tarde]), agora)?.shift.id).toBe('cedo')
  })
})
