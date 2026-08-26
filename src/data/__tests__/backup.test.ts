import { describe, expect, it } from 'vitest'
import type { Shift, ShiftView } from '@/db/types'
import { BACKUP_FORMAT, buildShiftsCsv, describeBackup, parseBackup } from '../backup'
import { DEFAULT_SETTINGS } from '@/db/db'
import { buildShiftViews } from '@/domain/shift'

const shift: Shift = {
  id: 's1',
  seriesId: '',
  title: '',
  startDateTime: '2026-08-12T19:00',
  endDateTime: '2026-08-13T07:00',
  locationId: 'l1',
  shiftType: 'Noturno',
  paymentMode: 'fixed',
  fixedAmount: 1200,
  hourlyRate: 0,
  expectedAmount: 1200,
  notes: 'Extra; solicitado pela coordenação',
  cancelled: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const validBackup = {
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: '2026-08-25T12:00:00.000Z',
  shifts: [shift],
  locations: [{ id: 'l1', name: 'UPA Centro', color: 'blue', createdAt: '2026-08-01T00:00:00.000Z' }],
  payments: [
    {
      id: 'p1',
      shiftId: 's1',
      expectedAmount: 1200,
      receivedAmount: 1100,
      receivedDate: '2026-09-06',
      notes: '',
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
    },
  ],
  settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
}

describe('parseBackup', () => {
  it('lê um backup válido preservando os dados', () => {
    const parsed = parseBackup(JSON.stringify(validBackup))
    expect(parsed.shifts).toHaveLength(1)
    expect(parsed.shifts[0].expectedAmount).toBe(1200)
    expect(parsed.locations[0].name).toBe('UPA Centro')
    expect(parsed.payments[0].receivedAmount).toBe(1100)
    expect(parsed.settings.theme).toBe('dark')
  })

  it('recusa JSON inválido', () => {
    expect(() => parseBackup('{{{')).toThrow(/JSON/)
  })

  it('recusa arquivo de outro aplicativo', () => {
    expect(() => parseBackup(JSON.stringify({ format: 'outro', shifts: [], locations: [] }))).toThrow(
      /não é um backup/i,
    )
  })

  it('recusa backup de uma versão futura', () => {
    expect(() => parseBackup(JSON.stringify({ ...validBackup, version: 99 }))).toThrow(/mais nova/i)
  })

  it('recusa plantões com data inválida', () => {
    const corrupted = { ...validBackup, shifts: [{ ...shift, startDateTime: '25/08/2026' }] }
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/data ou hora/i)
  })

  it('descarta recebimentos sem plantão correspondente', () => {
    const orphan = {
      ...validBackup,
      payments: [{ ...validBackup.payments[0], shiftId: 'inexistente' }],
    }
    expect(parseBackup(JSON.stringify(orphan)).payments).toHaveLength(0)
  })

  it('completa campos ausentes com valores seguros', () => {
    const minimal = {
      format: BACKUP_FORMAT,
      version: 1,
      shifts: [
        {
          id: 's2',
          startDateTime: '2026-08-12T19:00',
          endDateTime: '2026-08-13T07:00',
          locationId: 'l1',
        },
      ],
      locations: [{ id: 'l1', name: 'UPA' }],
    }
    const parsed = parseBackup(JSON.stringify(minimal))
    expect(parsed.shifts[0].paymentMode).toBe('fixed')
    expect(parsed.shifts[0].cancelled).toBe(false)
    expect(parsed.shifts[0].title).toBe('')
    expect(parsed.settings.shiftTypes.length).toBeGreaterThan(0)
  })
})

describe('buildShiftsCsv', () => {
  const view: ShiftView = {
    shift,
    location: { id: 'l1', name: 'UPA Centro', color: 'blue', createdAt: '2026-08-01T00:00:00.000Z' },
    payment: undefined,
    status: 'done',
    paymentStatus: 'pending',
    durationHours: 12,
  }

  it('monta cabeçalho e linha com separador ponto e vírgula', () => {
    const [header, row] = buildShiftsCsv([view]).split('\r\n')
    expect(header.split(';')[0]).toBe('Data')
    expect(row.startsWith('12/08/2026;19:00;07:00;12,00;UPA Centro;Noturno;1200,00')).toBe(true)
  })

  it('protege campos que contêm o separador', () => {
    const row = buildShiftsCsv([view]).split('\r\n')[1]
    expect(row).toContain('"Extra; solicitado pela coordenação"')
  })
})

describe('describeBackup', () => {
  const arquivo = (shifts: number, locations: number, payments: number) =>
    ({
      format: 'escalonil-backup', version: 1, exportedAt: '',
      shifts: Array.from({ length: shifts }),
      locations: Array.from({ length: locations }),
      payments: Array.from({ length: payments }),
      settings: {},
    }) as never

  it('usa o plural irregular certo', () => {
    expect(describeBackup(arquivo(2, 2, 2))).toBe('2 plantões, 2 locais e 2 recebimentos')
    expect(describeBackup(arquivo(0, 0, 0))).toBe('0 plantões, 0 locais e 0 recebimentos')
  })

  it('mantém o singular quando é um só', () => {
    expect(describeBackup(arquivo(1, 1, 1))).toBe('1 plantão, 1 local e 1 recebimento')
  })
})

describe('backup mais rigoroso', () => {
  const arquivo = (extra: Record<string, unknown> = {}) => JSON.stringify({
    format: BACKUP_FORMAT, version: 1, exportedAt: '2026-08-25T00:00:00.000Z',
    locations: [{ id: 'l', name: 'UPA', color: 'blue', createdAt: '2026-01-01T00:00:00.000Z' }],
    shifts: [{
      id: 's1', seriesId: '', title: '', startDateTime: '2026-08-25T19:00',
      endDateTime: '2026-08-26T07:00', locationId: 'l', shiftType: '', paymentMode: 'fixed',
      fixedAmount: 1200, hourlyRate: 0, expectedAmount: 1200, notes: '', cancelled: false,
      createdAt: '', updatedAt: '',
    }],
    payments: [], settings: {}, ...extra,
  })
  const comPlantao = (s: Record<string, unknown>) => arquivo({ shifts: [{
    id: 'x', startDateTime: '2026-08-25T19:00', endDateTime: '2026-08-26T07:00',
    locationId: 'l', paymentMode: 'fixed', fixedAmount: 100, expectedAmount: 100, ...s,
  }] })

  it('recalcula o valor previsto em vez de confiar no arquivo', () => {
    const b = parseBackup(comPlantao({ fixedAmount: 1200, expectedAmount: 999999 }))
    expect(b.shifts[0].expectedAmount).toBe(1200)
  })

  it('recalcula também no modo por hora', () => {
    const b = parseBackup(comPlantao({ paymentMode: 'hourly', hourlyRate: 100, expectedAmount: 7 }))
    expect(b.shifts[0].expectedAmount).toBe(1200) // 12h × 100
  })

  it('rejeita data que existe no papel mas não no calendário', () => {
    expect(() => parseBackup(comPlantao({ startDateTime: '2026-02-31T19:00' }))).toThrow(/data ou hora/)
    expect(() => parseBackup(comPlantao({ startDateTime: '2026-13-01T19:00' }))).toThrow(/data ou hora/)
    expect(() => parseBackup(comPlantao({ endDateTime: '2026-08-26T25:00' }))).toThrow(/data ou hora/)
  })

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(() => parseBackup(comPlantao({
      startDateTime: '2024-02-29T19:00', endDateTime: '2024-03-01T07:00',
    }))).not.toThrow()
  })

  it('rejeita plantão que termina antes de começar', () => {
    expect(() => parseBackup(comPlantao({ endDateTime: '2026-08-25T07:00' }))).toThrow(/termina antes/)
  })

  it('aceita plantão de duração zero', () => {
    expect(() => parseBackup(comPlantao({ endDateTime: '2026-08-25T19:00' }))).not.toThrow()
  })

  it('rejeita valores negativos', () => {
    expect(() => parseBackup(comPlantao({ fixedAmount: -500 }))).toThrow(/valor negativo/)
    expect(() => parseBackup(comPlantao({ paymentMode: 'hourly', hourlyRate: -50 }))).toThrow(/valor negativo/)
    expect(() => parseBackup(arquivo({ payments: [
      { id: 'p', shiftId: 's1', receivedAmount: -1, receivedDate: '2026-09-01' },
    ] }))).toThrow(/valor negativo/)
  })

  it('rejeita identificadores repetidos, dizendo qual é o problema', () => {
    const s = (id: string) => ({ id, startDateTime: '2026-08-25T19:00', endDateTime: '2026-08-26T07:00',
      locationId: 'l', paymentMode: 'fixed', fixedAmount: 100, expectedAmount: 100 })
    expect(() => parseBackup(arquivo({ shifts: [s('a'), s('a')] }))).toThrow(/plantões com o mesmo identificador/)
    expect(() => parseBackup(arquivo({ locations: [
      { id: 'z', name: 'A', color: 'blue', createdAt: '' }, { id: 'z', name: 'B', color: 'red', createdAt: '' },
    ] }))).toThrow(/locais com o mesmo identificador/)
    expect(() => parseBackup(arquivo({ payments: [
      { id: 'p1', shiftId: 's1', receivedAmount: 10, receivedDate: '2026-09-01' },
      { id: 'p2', shiftId: 's1', receivedAmount: 20, receivedDate: '2026-09-02' },
    ] }))).toThrow(/mais de um recebimento/)
  })

  it('backup gerado pelo próprio app continua entrando', () => {
    expect(() => parseBackup(arquivo())).not.toThrow()
  })
})

describe('CSV e fórmulas de planilha', () => {
  const S = (notes: string): Shift => ({
    id: 's', seriesId: '', title: '', startDateTime: '2026-08-25T19:00',
    endDateTime: '2026-08-26T07:00', locationId: 'l', shiftType: '', paymentMode: 'fixed',
    fixedAmount: 1200, hourlyRate: 0, expectedAmount: 1200, notes, cancelled: false,
    createdAt: '', updatedAt: '',
  })
  const csv = (notes: string) =>
    buildShiftsCsv(buildShiftViews([S(notes)], [{ id: 'l', name: 'UPA', color: 'blue', createdAt: '' }], []))

  it('neutraliza texto que a planilha leria como fórmula', () => {
    expect(csv('=1+1')).toContain("'=1+1")
    expect(csv('@SUM(A1)')).toContain("'@SUM(A1)")
    expect(csv('+34')).toContain("'+34")
    expect(csv('-cmd')).toContain("'-cmd")
  })

  it('não mexe em texto comum', () => {
    expect(csv('Plantão tranquilo')).toContain('Plantão tranquilo')
    expect(csv('Plantão tranquilo')).not.toContain("'Plantão")
  })

  it('o sinal de menos dos NÚMEROS continua intacto', () => {
    // A neutralização vale só para o texto do usuário, não para as colunas
    // numéricas — senão um valor negativo viraria texto na planilha.
    expect(csv('').split('\r\n')[1]).toContain('1200,00')
  })

  it('aspas continuam escapadas uma vez só', () => {
    expect(csv('a "b"')).toContain('"a ""b"""')
    expect(csv('=a "b"')).toContain('"\'=a ""b"""')
  })
})
