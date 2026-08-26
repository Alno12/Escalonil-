import { describe, expect, it } from 'vitest'
import type { Payment, Shift } from '@/db/types'
import { toDate } from '../datetime'
import {
  computeExpectedAmount,
  getPaymentStatus,
  getShiftStatus,
  paymentDifference,
  shiftDuration,
  suggestPaymentDate,
} from '../shift'

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 's1',
    title: '',
    startDateTime: '2026-08-25T19:00',
    endDateTime: '2026-08-26T07:00',
    locationId: 'l1',
    shiftType: 'Noturno',
    paymentMode: 'fixed',
    fixedAmount: 1200,
    hourlyRate: 0,
    expectedAmount: 1200,
    expectedPaymentDate: '2026-09-05',
    notes: '',
    cancelled: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'p1',
    shiftId: 's1',
    expectedAmount: 1200,
    receivedAmount: 1200,
    expectedDate: '2026-09-05',
    receivedDate: '2026-09-05',
    notes: '',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeExpectedAmount', () => {
  it('usa o valor fixo quando o pagamento é fixo', () => {
    expect(computeExpectedAmount(makeShift())).toBe(1200)
  })

  it('multiplica duração por valor/hora quando o pagamento é por hora', () => {
    const shift = makeShift({ paymentMode: 'hourly', hourlyRate: 100, fixedAmount: 999 })
    expect(shiftDuration(shift)).toBe(12)
    expect(computeExpectedAmount(shift)).toBe(1200)
  })

  it('arredonda para centavos', () => {
    const shift = makeShift({
      paymentMode: 'hourly',
      hourlyRate: 97.37,
      startDateTime: '2026-08-25T07:00',
      endDateTime: '2026-08-25T13:30',
    })
    expect(computeExpectedAmount(shift)).toBe(632.91)
  })
})

describe('getShiftStatus', () => {
  const shift = makeShift()

  it('é agendado antes do início', () => {
    expect(getShiftStatus(shift, toDate('2026-08-25T18:59'))).toBe('scheduled')
  })

  it('é em andamento entre início e término', () => {
    expect(getShiftStatus(shift, toDate('2026-08-25T19:00'))).toBe('inProgress')
    expect(getShiftStatus(shift, toDate('2026-08-26T06:59'))).toBe('inProgress')
  })

  it('é realizado a partir do término', () => {
    expect(getShiftStatus(shift, toDate('2026-08-26T07:00'))).toBe('done')
  })

  it('cancelado tem prioridade sobre o relógio', () => {
    expect(getShiftStatus(makeShift({ cancelled: true }), toDate('2026-08-25T20:00'))).toBe(
      'cancelled',
    )
  })
})

describe('getPaymentStatus', () => {
  const shift = makeShift()

  it('não é elegível enquanto o plantão não foi realizado', () => {
    expect(getPaymentStatus(shift, undefined, toDate('2026-08-25T10:00'))).toBe('notEligible')
  })

  it('fica a receber depois de realizado e dentro do prazo', () => {
    expect(getPaymentStatus(shift, undefined, toDate('2026-08-30T10:00'))).toBe('pending')
  })

  it('ainda está a receber no próprio dia previsto', () => {
    expect(getPaymentStatus(shift, undefined, toDate('2026-09-05T23:00'))).toBe('pending')
  })

  it('fica atrasado no dia seguinte à data prevista', () => {
    expect(getPaymentStatus(shift, undefined, toDate('2026-09-06T00:01'))).toBe('overdue')
  })

  it('nunca atrasa quando não há data prevista', () => {
    const semData = makeShift({ expectedPaymentDate: null })
    expect(getPaymentStatus(semData, undefined, toDate('2027-01-01T10:00'))).toBe('pending')
  })

  it('fica recebido quando existe pagamento registrado', () => {
    expect(getPaymentStatus(shift, makePayment(), toDate('2026-09-30T10:00'))).toBe('received')
  })

  it('plantão cancelado não entra no controle financeiro', () => {
    expect(
      getPaymentStatus(makeShift({ cancelled: true }), undefined, toDate('2026-09-30T10:00')),
    ).toBe('cancelled')
  })
})

describe('divergência de pagamento', () => {
  it('mostra a diferença entre recebido e previsto', () => {
    expect(paymentDifference(makePayment({ receivedAmount: 1100 }))).toBe(-100)
    expect(paymentDifference(makePayment({ receivedAmount: 1250.5 }))).toBe(50.5)
    expect(paymentDifference(makePayment())).toBe(0)
  })
})

describe('suggestPaymentDate', () => {
  it('soma o prazo ao dia do término do plantão', () => {
    expect(suggestPaymentDate('2026-08-26T07:00', 30)).toBe('2026-09-25')
    expect(suggestPaymentDate('2026-08-26T07:00', 0)).toBe('2026-08-26')
  })
})
