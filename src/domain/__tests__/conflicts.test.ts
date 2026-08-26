import { describe, expect, it } from 'vitest'
import type { Shift } from '@/db/types'
import { findConflicts, overlaps } from '../conflicts'

const base: Omit<Shift, 'id' | 'startDateTime' | 'endDateTime'> = {
  title: '',
  locationId: 'l1',
  shiftType: '',
  paymentMode: 'fixed',
  fixedAmount: 0,
  hourlyRate: 0,
  expectedAmount: 0,
  expectedPaymentDate: null,
  notes: '',
  cancelled: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const shift = (id: string, startDateTime: string, endDateTime: string, cancelled = false): Shift => ({
  ...base,
  id,
  startDateTime,
  endDateTime,
  cancelled,
})

describe('overlaps', () => {
  it('detecta sobreposição de um plantão noturno com um matinal', () => {
    const noturno = { startDateTime: '2026-08-25T19:00', endDateTime: '2026-08-26T07:00' }
    const matinal = { startDateTime: '2026-08-26T06:00', endDateTime: '2026-08-26T12:00' }
    expect(overlaps(noturno, matinal)).toBe(true)
  })

  it('não considera conflito quando um começa exatamente quando o outro termina', () => {
    const diurno = { startDateTime: '2026-08-25T07:00', endDateTime: '2026-08-25T19:00' }
    const noturno = { startDateTime: '2026-08-25T19:00', endDateTime: '2026-08-26T07:00' }
    expect(overlaps(diurno, noturno)).toBe(false)
  })

  it('detecta plantão totalmente contido em outro', () => {
    const longo = { startDateTime: '2026-08-25T07:00', endDateTime: '2026-08-26T07:00' }
    const curto = { startDateTime: '2026-08-25T12:00', endDateTime: '2026-08-25T18:00' }
    expect(overlaps(longo, curto)).toBe(true)
    expect(overlaps(curto, longo)).toBe(true)
  })

  it('não vê conflito em dias diferentes', () => {
    expect(
      overlaps(
        { startDateTime: '2026-08-25T07:00', endDateTime: '2026-08-25T19:00' },
        { startDateTime: '2026-08-27T07:00', endDateTime: '2026-08-27T19:00' },
      ),
    ).toBe(false)
  })
})

describe('findConflicts', () => {
  const existentes = [
    shift('a', '2026-08-25T19:00', '2026-08-26T07:00'),
    shift('b', '2026-08-27T07:00', '2026-08-27T19:00'),
    shift('c', '2026-08-26T06:00', '2026-08-26T12:00', true), // cancelado
  ]

  it('encontra o plantão sobreposto', () => {
    const conflitos = findConflicts(
      { startDateTime: '2026-08-26T06:00', endDateTime: '2026-08-26T12:00' },
      existentes,
    )
    expect(conflitos.map((c) => c.id)).toEqual(['a'])
  })

  it('ignora plantões cancelados', () => {
    const conflitos = findConflicts(
      { startDateTime: '2026-08-26T08:00', endDateTime: '2026-08-26T11:00' },
      existentes,
    )
    expect(conflitos).toHaveLength(0)
  })

  it('ignora o próprio plantão ao editar', () => {
    const conflitos = findConflicts(
      { id: 'a', startDateTime: '2026-08-25T19:00', endDateTime: '2026-08-26T07:00' },
      existentes,
    )
    expect(conflitos).toHaveLength(0)
  })

  it('devolve os conflitos em ordem cronológica', () => {
    const muitos = [
      shift('tarde', '2026-08-25T14:00', '2026-08-25T20:00'),
      shift('manha', '2026-08-25T06:00', '2026-08-25T15:00'),
    ]
    const conflitos = findConflicts(
      { startDateTime: '2026-08-25T07:00', endDateTime: '2026-08-25T19:00' },
      muitos,
    )
    expect(conflitos.map((c) => c.id)).toEqual(['manha', 'tarde'])
  })
})
