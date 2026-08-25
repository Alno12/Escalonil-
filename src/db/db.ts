/**
 * Banco local (IndexedDB via Dexie).
 * Tudo fica no aparelho: nenhum dado sai daqui.
 */
import Dexie, { type Table } from 'dexie'
import type { Location, Payment, Settings, Shift } from './types'

export const DEFAULT_SHIFT_TYPES = [
  'Diurno',
  'Noturno',
  'Apoio',
  'Sobreaviso',
  'Extra',
  'Outro',
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  defaultPaymentMode: 'fixed',
  defaultHourlyRate: 0,
  defaultFixedAmount: 0,
  paymentTermDays: 30,
  shiftTypes: DEFAULT_SHIFT_TYPES,
  updatedAt: new Date(0).toISOString(),
}

class EscalonilDB extends Dexie {
  shifts!: Table<Shift, string>
  locations!: Table<Location, string>
  payments!: Table<Payment, string>
  settings!: Table<Settings, string>

  constructor() {
    super('escalonil')
    // Booleanos não são indexáveis no IndexedDB — `cancelled` fica fora dos índices.
    this.version(1).stores({
      shifts: 'id, startDateTime, endDateTime, locationId, expectedPaymentDate',
      locations: 'id, name',
      payments: 'id, &shiftId, receivedDate',
      settings: 'id',
    })
  }
}

export const db = new EscalonilDB()

/** Identificador único e estável para os registros. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowStamp(): string {
  return new Date().toISOString()
}
