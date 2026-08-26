/**
 * Modelo de dados do Escalonil.
 *
 * Convenção de datas — importante:
 * - `LocalDateTime` e `LocalDate` são strings SEM fuso ("horário de parede").
 *   Um plantão marcado às 19:00 continua às 19:00 mesmo se o aparelho mudar
 *   de fuso, e o backup fica legível. Use os helpers de `domain/datetime.ts`
 *   para converter — nunca chame `new Date(string)` direto.
 * - `createdAt`/`updatedAt` são ISO completos em UTC (só auditoria).
 */

/** "YYYY-MM-DDTHH:mm" no horário local. */
export type LocalDateTime = string
/** "YYYY-MM-DD" no horário local. */
export type LocalDate = string

export type PaymentMode = 'fixed' | 'hourly'

/**
 * Cores dos locais. Guardamos a CHAVE, não o hexadecimal, para que cada tema
 * possa usar o tom certo (ver `--loc-*` em tokens.css).
 */
export const LOCATION_COLORS = [
  'blue',
  'teal',
  'green',
  'orange',
  'red',
  'purple',
  'pink',
  'indigo',
] as const

export type LocationColor = (typeof LOCATION_COLORS)[number]

export interface Shift {
  id: string
  /** Complemento livre do local ("Plantão da coordenação"). Vazio = sem título. */
  title: string
  startDateTime: LocalDateTime
  endDateTime: LocalDateTime
  locationId: string
  /** Rótulo livre ("Noturno", "Extra"...). String vazia = não informado. */
  shiftType: string
  paymentMode: PaymentMode
  /** Usado quando paymentMode === 'fixed'. */
  fixedAmount: number
  /** Usado quando paymentMode === 'hourly'. */
  hourlyRate: number
  /**
   * Derivado de paymentMode/valores/duração e persistido para manter listas
   * e relatórios rápidos. Recalculado sempre em `computeExpectedAmount`.
   */
  expectedAmount: number
  expectedPaymentDate: LocalDate | null
  notes: string
  cancelled: boolean
  createdAt: string
  updatedAt: string
}

export interface Location {
  id: string
  name: string
  /** Identifica o local de relance na agenda e nas listas. */
  color: LocationColor
  createdAt: string
}

/**
 * Registro de recebimento. Existe apenas para plantões já pagos —
 * a ausência de Payment significa "ainda não recebido".
 * `expectedAmount`/`expectedDate` são uma FOTOGRAFIA do previsto no momento
 * do registro, para que a divergência sobreviva a edições posteriores do plantão.
 */
export interface Payment {
  id: string
  shiftId: string
  expectedAmount: number
  receivedAmount: number
  expectedDate: LocalDate | null
  receivedDate: LocalDate
  notes: string
  createdAt: string
  updatedAt: string
}

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  /** Sempre 'app' — a tabela guarda uma única linha. */
  id: 'app'
  theme: ThemePreference
  defaultPaymentMode: PaymentMode
  defaultHourlyRate: number
  defaultFixedAmount: number
  /** Dias somados ao fim do plantão para sugerir a data prevista de pagamento. */
  paymentTermDays: number
  shiftTypes: string[]
  /** Quando o último backup foi exportado (ISO UTC). null = nunca. */
  lastBackupAt: string | null
  updatedAt: string
}

/** Situação temporal do plantão — sempre calculada, nunca armazenada. */
export type ShiftStatus = 'scheduled' | 'inProgress' | 'done' | 'cancelled'

/** Situação financeira — sempre calculada, nunca armazenada. */
export type PaymentStatus = 'notEligible' | 'pending' | 'received' | 'overdue' | 'cancelled'

/** Plantão com o que a interface precisa junto: local, pagamento e status. */
export interface ShiftView {
  shift: Shift
  location: Location | undefined
  payment: Payment | undefined
  status: ShiftStatus
  paymentStatus: PaymentStatus
  durationHours: number
}
