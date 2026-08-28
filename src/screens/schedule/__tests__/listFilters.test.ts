import { describe, expect, it } from 'vitest'
import type { Location, Shift } from '@/db/types'
import { buildShiftViews } from '@/domain/shift'
import { toDate } from '@/domain/datetime'
import {
  activeCount,
  applyFilters,
  defaultFilters,
  hasAnyFilter,
  type ListFilters,
} from '../listFilters'

const HOJE = '2026-08-27'
const AGORA = toDate('2026-08-27T16:25')

const LOCATIONS: Location[] = [
  { id: 'upa', name: 'UPA Centro', color: 'blue', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'hosp', name: 'Hospital Regional', color: 'teal', createdAt: '2026-01-01T00:00:00.000Z' },
]

function shift(id: string, start: string, end: string, extra: Partial<Shift> = {}): Shift {
  return {
    id,
    seriesId: '',
    title: '',
    startDateTime: start,
    endDateTime: end,
    locationId: 'upa',
    shiftType: '',
    paymentMode: 'fixed',
    fixedAmount: 1000,
    hourlyRate: 0,
    expectedAmount: 1000,
    notes: '',
    cancelled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

const SHIFTS = [
  shift('jul-feito', '2026-07-10T07:00', '2026-07-10T19:00'),
  shift('ago-feito', '2026-08-10T07:00', '2026-08-10T19:00'),
  shift('ago-feito-hosp', '2026-08-12T07:00', '2026-08-12T19:00', { locationId: 'hosp' }),
  shift('ago-proximo', '2026-08-30T19:00', '2026-08-31T07:00'),
  shift('set-proximo', '2026-09-05T19:00', '2026-09-06T07:00'),
  shift('ago-cancelado', '2026-08-20T07:00', '2026-08-20T19:00', { cancelled: true }),
]

const views = buildShiftViews(SHIFTS, LOCATIONS, [], AGORA)
const base = defaultFilters('2026-08-01', '2026-08-31')
const filtrar = (patch: Partial<ListFilters> = {}) =>
  applyFilters(views, { ...base, ...patch }, HOJE).map((v) => v.shift.id)

describe('filtros da Lista', () => {
  it('o padrão mostra os próximos, em ordem cronológica', () => {
    expect(filtrar()).toEqual(['ago-proximo', 'set-proximo'])
  })

  it('realizados vêm do mais recente para o mais antigo', () => {
    expect(filtrar({ situation: 'done' })).toEqual(['ago-feito-hosp', 'ago-feito', 'jul-feito'])
  })

  it('cancelados ficam num recorte só deles', () => {
    expect(filtrar({ situation: 'cancelled' })).toEqual(['ago-cancelado'])
  })

  it('cruza situação com período — o que antes era impossível', () => {
    // Este é o motivo de os dois eixos terem sido separados.
    expect(filtrar({ situation: 'done', period: 'lastMonth' })).toEqual(['jul-feito'])
    expect(filtrar({ situation: 'done', period: 'thisMonth' })).toEqual([
      'ago-feito-hosp',
      'ago-feito',
    ])
    expect(filtrar({ situation: 'upcoming', period: 'nextMonth' })).toEqual(['set-proximo'])
  })

  it('cruza os três eixos de uma vez', () => {
    expect(filtrar({ situation: 'done', period: 'thisMonth', locationId: 'hosp' })).toEqual([
      'ago-feito-hosp',
    ])
  })

  it('o período personalizado usa as datas informadas', () => {
    expect(
      filtrar({ situation: 'done', period: 'custom', customFrom: '2026-07-01', customTo: '2026-07-31' }),
    ).toEqual(['jul-feito'])
  })

  it('a busca varre local, tipo e anotações', () => {
    expect(filtrar({ situation: 'done', search: 'hospital' })).toEqual(['ago-feito-hosp'])
    expect(filtrar({ situation: 'done', search: 'upa' })).toEqual(['ago-feito', 'jul-feito'])
  })

  it('combinação vazia devolve lista vazia, sem erro', () => {
    // "Próximos do mês anterior" não existe — e é justamente o que o contador
    // do rodapé da folha mostra antes de o usuário fechar.
    expect(filtrar({ situation: 'upcoming', period: 'lastMonth' })).toEqual([])
  })

  it('conta só o que está fora do padrão', () => {
    expect(activeCount(base)).toBe(0)
    expect(hasAnyFilter(base)).toBe(false)
    expect(activeCount({ ...base, situation: 'done' })).toBe(1)
    expect(activeCount({ ...base, situation: 'done', period: 'thisMonth', locationId: 'upa' })).toBe(3)
    // Busca não entra na contagem do botão, mas conta como "tem filtro".
    expect(activeCount({ ...base, search: 'upa' })).toBe(0)
    expect(hasAnyFilter({ ...base, search: 'upa' })).toBe(true)
  })
})
