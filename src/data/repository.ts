/**
 * Camada de acesso aos dados. Nenhuma tela fala com o Dexie diretamente —
 * toda escrita passa por aqui, o que mantém regras (valor esperado, limpeza
 * de pagamentos órfãos) em um lugar só.
 */
import { db, newId, nowStamp, nextLocationColor, DEFAULT_SETTINGS } from '@/db/db'
import type { Location, LocationColor, Payment, Settings, Shift } from '@/db/types'
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

/**
 * Busca por nome (sem diferenciar maiúsculas) ou cria um local novo.
 * `color` só é aplicada quando informada — assim salvar um plantão sem mexer
 * na cor nunca sobrescreve a que o local já tinha.
 */
export async function ensureLocation(name: string, color?: LocationColor): Promise<Location> {
  const clean = normalizeName(name)
  if (!clean) throw new Error('O local não pode ficar em branco.')

  const all = await db.locations.toArray()
  const found = all.find((l) => l.name.toLowerCase() === clean.toLowerCase())
  if (found) {
    if (color && color !== found.color) {
      await db.locations.update(found.id, { color })
      return { ...found, color }
    }
    return found
  }

  const location: Location = {
    id: newId(),
    name: clean,
    color: color ?? nextLocationColor(all.map((l) => l.color)),
    createdAt: nowStamp(),
  }
  await db.locations.add(location)
  return location
}

/** Troca a cor de um local já existente. */
export async function setLocationColor(id: string, color: LocationColor): Promise<void> {
  await db.locations.update(id, { color })
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
  | 'title'
  | 'startDateTime'
  | 'endDateTime'
  | 'locationId'
  | 'shiftType'
  | 'paymentMode'
  | 'fixedAmount'
  | 'hourlyRate'
  | 'notes'
>

function validate(input: ShiftInput): void {
  if (!input.locationId) throw new Error('Escolha o local do plantão.')
  if (!input.startDateTime || !input.endDateTime) throw new Error('Informe data e horários.')
  if (input.endDateTime <= input.startDateTime) {
    throw new Error('O término precisa ser depois do início.')
  }
}

function buildShift(input: ShiftInput, stamp: string): Shift {
  validate(input)
  return {
    ...input,
    id: newId(),
    expectedAmount: computeExpectedAmount(input),
    cancelled: false,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export async function createShift(input: ShiftInput): Promise<Shift> {
  const [shift] = await createShifts([input])
  return shift
}

/**
 * Cria vários plantões de uma vez (usado pela repetição).
 * Tudo ou nada: se um input for inválido, nenhum é gravado.
 */
export async function createShifts(inputs: ShiftInput[]): Promise<Shift[]> {
  if (inputs.length === 0) throw new Error('Nenhum plantão para salvar.')
  const stamp = nowStamp()
  const shifts = inputs.map((input) => buildShift(input, stamp))
  await db.shifts.bulkAdd(shifts)
  return shifts
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
    receivedDate: input.receivedDate,
    notes: input.notes,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  }
  await db.payments.put(payment)
  return payment
}

/**
 * Marca vários plantões como recebidos na mesma data.
 * Cada um entra pelo próprio valor previsto — nenhum valor é inventado ou
 * rateado. Se algum veio diferente, o ajuste é feito plantão a plantão.
 * Plantões cancelados ou já pagos são ignorados em silêncio.
 */
export async function registerPayments(
  shiftIds: string[],
  receivedDate: string,
): Promise<number> {
  if (!receivedDate) throw new Error('Informe a data do recebimento.')

  return db.transaction('rw', db.shifts, db.payments, async () => {
    const stamp = nowStamp()
    const created: Payment[] = []

    for (const shiftId of shiftIds) {
      const shift = await db.shifts.get(shiftId)
      if (!shift || shift.cancelled) continue
      const existing = await db.payments.where('shiftId').equals(shiftId).first()
      if (existing) continue

      created.push({
        id: newId(),
        shiftId,
        expectedAmount: shift.expectedAmount,
        receivedAmount: shift.expectedAmount,
        receivedDate,
        notes: '',
        createdAt: stamp,
        updatedAt: stamp,
      })
    }

    await db.payments.bulkAdd(created)
    return created.length
  })
}

/** Desfaz o recebimento: o plantão volta a ficar "a receber". */
export async function removePayment(shiftId: string): Promise<void> {
  await db.payments.where('shiftId').equals(shiftId).delete()
}

// ---------------- Zerar o aplicativo ----------------

/**
 * Apaga plantões, locais e recebimentos deste aparelho.
 *
 * As preferências (tema, valores padrão, tipos de plantão) ficam — são
 * escolhas, não dados lançados. O aviso de backup volta ao início porque não
 * há mais nada para salvar.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.shifts, db.locations, db.payments, async () => {
    await Promise.all([db.shifts.clear(), db.locations.clear(), db.payments.clear()])
  })
  await saveSettings({ lastBackupAt: null })
}
