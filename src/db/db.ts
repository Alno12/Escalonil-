/**
 * Banco local (IndexedDB via Dexie).
 * Tudo fica no aparelho: nenhum dado sai daqui.
 */
import Dexie, { type Table } from 'dexie'
import { LOCATION_COLORS, type Location, type LocationColor, type Payment, type Settings, type Shift } from './types'

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
  // O app abre no claro por padrão; o usuário troca em Ajustes.
  theme: 'light',
  defaultPaymentMode: 'fixed',
  defaultHourlyRate: 0,
  defaultFixedAmount: 0,
  shiftTypes: DEFAULT_SHIFT_TYPES,
  lastBackupAt: null,
  // O app foi feito de presente e já vem com a data das férias marcada — é
  // o easter egg, não uma configuração que alguém precise descobrir.
  vacationDate: '2026-10-11',
  vacationEnabled: true,
  lastSeenVersion: null,
  // Desligado: a caixa de impressão do iOS abre em Vertical, que é o caso
  // comum, e é para ele que a folha girada está calibrada.
  printLandscape: false,
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

    // v2: cor do local e título do plantão. Os índices não mudam — só os campos.
    this.version(2)
      .stores({
        shifts: 'id, startDateTime, endDateTime, locationId, expectedPaymentDate',
        locations: 'id, name',
        payments: 'id, &shiftId, receivedDate',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Distribui a paleta pelos locais já existentes, em ordem de criação,
        // para que ninguém abra o app depois da atualização sem cor nenhuma.
        const locations = await tx.table('locations').toCollection().sortBy('createdAt')
        await Promise.all(
          locations.map((location, index) =>
            tx.table('locations').update(location.id, { color: colorForIndex(index) }),
          ),
        )
        await tx.table('shifts').toCollection().modify({ title: '' })
      })

    // v3: a lógica de "atrasado" saiu, então o índice da data prevista some.
    // Os valores já gravados nos registros são preservados de propósito — se o
    // controle de prazo voltar um dia, o histórico ainda está lá.
    this.version(3).stores({
      shifts: 'id, startDateTime, endDateTime, locationId',
      locations: 'id, name',
      payments: 'id, &shiftId, receivedDate',
      settings: 'id',
    })

    // v4: plantões de uma mesma escala passam a se conhecer, para dar para
    // excluir a série inteira. Quem já existia vira plantão avulso.
    this.version(4)
      .stores({
        shifts: 'id, startDateTime, endDateTime, locationId, seriesId',
        locations: 'id, name',
        payments: 'id, &shiftId, receivedDate',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('shifts').toCollection().modify({ seriesId: '' })
      })
  }
}

/** Cor da paleta na posição informada, girando quando as cores acabam. */
export function colorForIndex(index: number): LocationColor {
  return LOCATION_COLORS[index % LOCATION_COLORS.length]
}

/** Primeira cor ainda não usada; se todas estiverem em uso, segue girando. */
export function nextLocationColor(used: LocationColor[]): LocationColor {
  const free = LOCATION_COLORS.find((color) => !used.includes(color))
  return free ?? colorForIndex(used.length)
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
