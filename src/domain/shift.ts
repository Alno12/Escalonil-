/**
 * Regras do plantão: duração, valor esperado e situação (temporal e financeira).
 * Esta é a fonte única dessas regras — telas nunca recalculam por conta própria.
 */
import type {
  LocalDate,
  Payment,
  PaymentStatus,
  Shift,
  ShiftStatus,
  Location,
  ShiftView,
} from '@/db/types'
import { durationInHours, todayISO, toDate } from './datetime'
import { roundMoney } from './money'

/** Duração do plantão em horas. */
export function shiftDuration(shift: Pick<Shift, 'startDateTime' | 'endDateTime'>): number {
  return durationInHours(shift.startDateTime, shift.endDateTime)
}

/**
 * Valor esperado do plantão.
 * - fixo  → o valor informado
 * - hora  → duração × valor/hora
 */
export function computeExpectedAmount(
  shift: Pick<Shift, 'startDateTime' | 'endDateTime' | 'paymentMode' | 'fixedAmount' | 'hourlyRate'>,
): number {
  if (shift.paymentMode === 'fixed') return roundMoney(shift.fixedAmount)
  return roundMoney(shiftDuration(shift) * shift.hourlyRate)
}

/** Situação temporal — derivada do relógio, nunca armazenada. */
export function getShiftStatus(shift: Shift, now: Date = new Date()): ShiftStatus {
  if (shift.cancelled) return 'cancelled'
  const t = now.getTime()
  if (t < toDate(shift.startDateTime).getTime()) return 'scheduled'
  if (t < toDate(shift.endDateTime).getTime()) return 'inProgress'
  return 'done'
}

/**
 * Situação financeira (§19 do blueprint).
 * Atrasado = plantão realizado + não recebido + hoje passou da data prevista.
 */
export function getPaymentStatus(
  shift: Shift,
  payment: Payment | undefined,
  now: Date = new Date(),
): PaymentStatus {
  if (shift.cancelled) return 'cancelled'
  if (payment) return 'received'
  if (getShiftStatus(shift, now) !== 'done') return 'notEligible'
  const today = todayISO(now)
  if (shift.expectedPaymentDate && today > shift.expectedPaymentDate) return 'overdue'
  return 'pending'
}

/** Diferença entre o recebido e o previsto no momento do registro. */
export function paymentDifference(payment: Payment): number {
  return roundMoney(payment.receivedAmount - payment.expectedAmount)
}

/** Junta plantão + local + pagamento + status no formato que a interface usa. */
export function buildShiftView(
  shift: Shift,
  locations: Map<string, Location>,
  paymentsByShift: Map<string, Payment>,
  now: Date = new Date(),
): ShiftView {
  const payment = paymentsByShift.get(shift.id)
  return {
    shift,
    location: locations.get(shift.locationId),
    payment,
    status: getShiftStatus(shift, now),
    paymentStatus: getPaymentStatus(shift, payment, now),
    durationHours: shiftDuration(shift),
  }
}

export function buildShiftViews(
  shifts: Shift[],
  locations: Location[],
  payments: Payment[],
  now: Date = new Date(),
): ShiftView[] {
  const locationMap = new Map(locations.map((l) => [l.id, l]))
  const paymentMap = new Map(payments.map((p) => [p.shiftId, p]))
  return shifts.map((s) => buildShiftView(s, locationMap, paymentMap, now))
}

// ---------------- Rótulos ----------------

export const shiftStatusLabel: Record<ShiftStatus, string> = {
  scheduled: 'Agendado',
  inProgress: 'Em andamento',
  done: 'Realizado',
  cancelled: 'Cancelado',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  notEligible: 'Não elegível',
  pending: 'A receber',
  received: 'Recebido',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
}

/** Nome da variável de cor (ver tokens.css) usada por cada situação. */
export const paymentStatusTone: Record<PaymentStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  notEligible: 'neutral',
  pending: 'info',
  received: 'success',
  overdue: 'danger',
  cancelled: 'neutral',
}

export const shiftStatusTone: Record<ShiftStatus, 'neutral' | 'accent' | 'success' | 'danger'> = {
  scheduled: 'accent',
  inProgress: 'success',
  done: 'neutral',
  cancelled: 'danger',
}

/** Sugere a data prevista de pagamento a partir do fim do plantão. */
export function suggestPaymentDate(endDateTime: string, termDays: number): LocalDate {
  const d = toDate(endDateTime.slice(0, 10))
  d.setDate(d.getDate() + termDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
