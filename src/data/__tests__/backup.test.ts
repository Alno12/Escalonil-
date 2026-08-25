import { describe, expect, it } from 'vitest'
import type { Shift, ShiftView } from '@/db/types'
import { BACKUP_FORMAT, buildShiftsCsv, parseBackup } from '../backup'
import { DEFAULT_SETTINGS } from '@/db/db'

const shift: Shift = {
  id: 's1',
  startDateTime: '2026-08-12T19:00',
  endDateTime: '2026-08-13T07:00',
  locationId: 'l1',
  shiftType: 'Noturno',
  paymentMode: 'fixed',
  fixedAmount: 1200,
  hourlyRate: 0,
  expectedAmount: 1200,
  expectedPaymentDate: '2026-09-05',
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
  locations: [{ id: 'l1', name: 'UPA Centro', createdAt: '2026-08-01T00:00:00.000Z' }],
  payments: [
    {
      id: 'p1',
      shiftId: 's1',
      expectedAmount: 1200,
      receivedAmount: 1100,
      expectedDate: '2026-09-05',
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
    expect(parsed.shifts[0].expectedPaymentDate).toBeNull()
    expect(parsed.settings.shiftTypes.length).toBeGreaterThan(0)
  })
})

describe('buildShiftsCsv', () => {
  const view: ShiftView = {
    shift,
    location: { id: 'l1', name: 'UPA Centro', createdAt: '2026-08-01T00:00:00.000Z' },
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
