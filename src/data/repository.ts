/**
 * Camada de acesso aos dados. Nenhuma tela fala com o Dexie diretamente —
 * toda escrita passa por aqui, o que mantém regras (valor esperado, limpeza
 * de pagamentos órfãos) em um lugar só.
 */
import { db, newId, nowStamp, DEFAULT_SETTINGS } from '@/db/db'
import type { Location, Payment, Settings, Shift } from '@/db/types'
import { computeExpectedAmount } from '@/domain/shift'

// ---------------- Configurações ----------------

export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app')
  return { ...DEFAULT_SETTINGS, ...stored, id: 'app' }
}

export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const current = await getSettings()
  const next: Settings = { ...current, ...patch, id: 'app', updatedAt: nowStamp() }
  await db.settings.put(next)
  return next
}

// ---------------- Locais ----------------

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ')

/** Busca por nome (sem diferenciar maiúsculas) ou cria um local novo. */
export async function ensureLocation(name: string): Promise<Location> {
  const clean = normalizeName(name)
  if (!clean) throw new Error('O local não pode ficar em branco.')
  const all = await db.locations.toArray()
  const found = all.find((l) => l.name.toLowerCase() === clean.toLowerCase())
  if (found) return found
  const location: Location = { id: newId(), name: clean, createdAt: nowStamp() }
  await db.locations.add(location)
  return location
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const clean = normalizeName(name)
  if (!clean) throw new Error('O local não pode ficar em branco.')
  const all = await db.locations.toArray()
  const clash = all.find((l) => l.id !== id && l.name.toLowerCase() === clean.toLowerCase())
  if (clash) throw new Error('Já existe um local com esse nome.')
  await db.locations.update(id, { name: clean })
}

/** Só remove locais sem plantões — evita registros órfãos no histórico. */
export async function deleteLocation(id: string): Promise<void> {
  const used = await db.shifts.where('locationId').equals(id).count()
  if (used > 0) {
    throw new Error(
      `Este local está em ${used} plantão${used > 1 ? 'es' : ''} e não pode ser excluído.`,
    )
  }
  await db.locations.delete(id)
}

// ---------------- Plantões ----------------

/** Campos que a interface envia ao salvar um plantão. */
export type ShiftInput = Pick<
  Shift,
  | 'startDateTime'
  | 'endDateTime'
  | 'locationId'
  | 'shiftType'
  | 'paymentMode'
  | 'fixedAmount'
  | 'hourlyRate'
  | 'expectedPaymentDate'
  | 'notes'
>

function validate(input: ShiftInput): void {
  if (!input.locationId) throw new Error('Escolha o local do plantão.')
  if (!input.startDateTime || !input.endDateTime) throw new Error('Informe data e horários.')
  if (input.endDateTime <= input.startDateTime) {
    throw new Error('O término precisa ser depois do início.')
  }
}

export async function createShift(input: ShiftInput): Promise<Shift> {
  validate(input)
  const stamp = nowStamp()
  const shift: Shift = {
    ...input,
    id: newId(),
    expectedAmount: computeExpectedAmount(input),
    cancelled: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
  await db.shifts.add(shift)
  return shift
}

export async function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  validate(input)
  const current = await db.shifts.get(id)
  if (!current) throw new Error('Plantão não encontrado.')
  const next: Shift = {
    ...current,
    ...input,
    expectedAmount: computeExpectedAmount(input),
    updatedAt: nowStamp(),
  }
  await db.shifts.put(next)
  return next
}

export async function setShiftCancelled(id: string, cancelled: boolean): Promise<void> {
  await db.transaction('rw', db.shifts, db.payments, async () => {
    await db.shifts.update(id, { cancelled, updatedAt: nowStamp() })
    // Um plantão cancelado não tem recebimento a controlar.
    if (cancelled) await db.payments.where('shiftId').equals(id).delete()
  })
}

export async function deleteShift(id: string): Promise<void> {
  await db.transaction('rw', db.shifts, db.payments, async () => {
    await db.payments.where('shiftId').equals(id).delete()
    await db.shifts.delete(id)
  })
}

// ---------------- Pagamentos ----------------

export interface PaymentInput {
  receivedAmount: number
  receivedDate: string
  notes: string
}

/**
 * Marca o plantão como recebido (ou atualiza o recebimento já registrado).
 * O previsto é fotografado aqui para que a divergência não mude depois.
 */
export async function registerPayment(shiftId: string, input: PaymentInput): Promise<Payment> {
  const shift = await db.shifts.get(shiftId)
  if (!shift) throw new Error('Plantão não encontrado.')
  if (shift.cancelled) throw new Error('Este plantão está cancelado.')
  if (!input.receivedDate) throw new Error('Informe a data do recebimento.')

  const existing = await db.payments.where('shiftId').equals(shiftId).first()
  const stamp = nowStamp()
  const payment: Payment = {
    id: existing?.id ?? newId(),
    shiftId,
    expectedAmount: existing?.expectedAmount ?? shift.expectedAmount,
    receivedAmount: input.receivedAmount,
    expectedDate: existing?.expectedDate ?? shift.expectedPaymentDate,
    receivedDate: input.receivedDate,
    notes: input.notes,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  }
  await db.payments.put(payment)
  return payment
}

/** Desfaz o recebimento: o plantão volta a ficar "a receber". */
export async function removePayment(shiftId: string): Promise<void> {
  await db.payments.where('shiftId').equals(shiftId).delete()
}
