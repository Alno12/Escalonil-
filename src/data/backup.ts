/**
 * Backup e exportação (§32–§35).
 * Como não existe servidor, este é o único caminho para o usuário levar
 * os dados para outro aparelho — por isso a importação valida tudo antes
 * de tocar no banco.
 */
import { colorForIndex, db, DEFAULT_SETTINGS } from '@/db/db'
import {
  LOCATION_COLORS,
  type Location,
  type LocationColor,
  type Payment,
  type Settings,
  type Shift,
  type ShiftView,
} from '@/db/types'
import { formatDate, formatTime, todayISO } from '@/domain/datetime'
import { paymentStatusLabel, shiftStatusLabel } from '@/domain/shift'

export const BACKUP_FORMAT = 'escalonil-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  shifts: Shift[]
  locations: Location[]
  payments: Payment[]
  settings: Settings
}

export async function buildBackup(): Promise<BackupFile> {
  const [shifts, locations, payments, storedSettings] = await Promise.all([
    db.shifts.toArray(),
    db.locations.toArray(),
    db.payments.toArray(),
    db.settings.get('app'),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    shifts,
    locations,
    payments,
    settings: { ...DEFAULT_SETTINGS, ...storedSettings, id: 'app' },
  }
}

export function backupFileName(): string {
  return `plantoes-backup-${todayISO()}.json`
}

// ---------------- Validação ----------------

class ImportError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback)

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lê e valida o conteúdo de um arquivo de backup.
 * Lança `Error` com mensagem em português quando o arquivo não serve.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('O arquivo não é um JSON válido.')
  }
  if (!isObject(raw)) throw new ImportError('O arquivo não tem o formato esperado.')
  if (raw.format !== BACKUP_FORMAT) {
    throw new ImportError('Este arquivo não é um backup do Escalonil.')
  }
  if (num(raw.version) > BACKUP_VERSION) {
    throw new ImportError('Este backup veio de uma versão mais nova do aplicativo.')
  }
  if (!Array.isArray(raw.shifts) || !Array.isArray(raw.locations)) {
    throw new ImportError('O backup está incompleto.')
  }

  const locations: Location[] = raw.locations.filter(isObject).map((l, index) => ({
    id: str(l.id),
    name: str(l.name, 'Local'),
    // Backups da v1 não têm cor: a paleta é distribuída na ordem do arquivo.
    color: LOCATION_COLORS.includes(str(l.color) as LocationColor)
      ? (str(l.color) as LocationColor)
      : colorForIndex(index),
    createdAt: str(l.createdAt, new Date().toISOString()),
  }))

  const shifts: Shift[] = raw.shifts.filter(isObject).map((s) => {
    const startDateTime = str(s.startDateTime)
    const endDateTime = str(s.endDateTime)
    if (!DATE_TIME.test(startDateTime) || !DATE_TIME.test(endDateTime)) {
      throw new ImportError('Há plantões com data ou hora inválida no backup.')
    }
    return {
      id: str(s.id),
      title: str(s.title),
      startDateTime,
      endDateTime,
      locationId: str(s.locationId),
      shiftType: str(s.shiftType),
      paymentMode: s.paymentMode === 'hourly' ? 'hourly' : 'fixed',
      fixedAmount: num(s.fixedAmount),
      hourlyRate: num(s.hourlyRate),
      expectedAmount: num(s.expectedAmount),
      notes: str(s.notes),
      cancelled: bool(s.cancelled),
      createdAt: str(s.createdAt, new Date().toISOString()),
      updatedAt: str(s.updatedAt, new Date().toISOString()),
    }
  })

  if (shifts.some((s) => !s.id)) throw new ImportError('Há plantões sem identificador no backup.')

  const shiftIds = new Set(shifts.map((s) => s.id))
  const payments: Payment[] = (Array.isArray(raw.payments) ? raw.payments : [])
    .filter(isObject)
    // Descarta recebimentos de plantões que não vieram no arquivo.
    .filter((p) => shiftIds.has(str(p.shiftId)))
    .map((p) => ({
      id: str(p.id),
      shiftId: str(p.shiftId),
      expectedAmount: num(p.expectedAmount),
      receivedAmount: num(p.receivedAmount),
      receivedDate: DATE.test(str(p.receivedDate)) ? str(p.receivedDate) : todayISO(),
      notes: str(p.notes),
      createdAt: str(p.createdAt, new Date().toISOString()),
      updatedAt: str(p.updatedAt, new Date().toISOString()),
    }))

  const rawSettings = isObject(raw.settings) ? raw.settings : {}
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    theme:
      rawSettings.theme === 'dark' || rawSettings.theme === 'light' ? rawSettings.theme : 'system',
    defaultPaymentMode: rawSettings.defaultPaymentMode === 'hourly' ? 'hourly' : 'fixed',
    defaultHourlyRate: num(rawSettings.defaultHourlyRate),
    defaultFixedAmount: num(rawSettings.defaultFixedAmount),
    shiftTypes: Array.isArray(rawSettings.shiftTypes)
      ? rawSettings.shiftTypes.filter((t): t is string => typeof t === 'string')
      : DEFAULT_SETTINGS.shiftTypes,
    lastBackupAt: typeof rawSettings.lastBackupAt === 'string' ? rawSettings.lastBackupAt : null,
    id: 'app',
    updatedAt: str(rawSettings.updatedAt, new Date().toISOString()),
  }

  return {
    format: BACKUP_FORMAT,
    version: num(raw.version, BACKUP_VERSION),
    exportedAt: str(raw.exportedAt, new Date().toISOString()),
    shifts,
    locations,
    payments,
    settings,
  }
}

/**
 * Substitui TODOS os dados atuais pelos do backup.
 * A V1 não mescla (§34) — é tudo ou nada, dentro de uma transação.
 */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.shifts, db.locations, db.payments, db.settings, async () => {
    await Promise.all([db.shifts.clear(), db.locations.clear(), db.payments.clear(), db.settings.clear()])
    await db.locations.bulkAdd(backup.locations)
    await db.shifts.bulkAdd(backup.shifts)
    await db.payments.bulkAdd(backup.payments)
    await db.settings.put(backup.settings)
  })
}

// ---------------- CSV ----------------

const CSV_SEPARATOR = ';'

function csvCell(value: string | number): string {
  const text = String(value)
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Números com vírgula decimal, para abrir direto no Excel em português. */
function csvNumber(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export function buildShiftsCsv(views: ShiftView[]): string {
  const header = [
    'Data',
    'Início',
    'Término',
    'Duração (h)',
    'Local',
    'Tipo',
    'Valor previsto',
    'Valor recebido',
    'Data recebimento',
    'Status',
    'Status pagamento',
    'Observações',
  ]

  const rows = views.map((v) => [
    formatDate(v.shift.startDateTime),
    formatTime(v.shift.startDateTime),
    formatTime(v.shift.endDateTime),
    csvNumber(v.durationHours),
    v.location?.name ?? '',
    v.shift.shiftType,
    csvNumber(v.shift.expectedAmount),
    v.payment ? csvNumber(v.payment.receivedAmount) : '',
    v.payment ? formatDate(v.payment.receivedDate) : '',
    shiftStatusLabel[v.status],
    paymentStatusLabel[v.paymentStatus],
    v.shift.notes,
  ])

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(CSV_SEPARATOR))
    .join('\r\n')
}

export function csvFileName(): string {
  return `plantoes-${todayISO()}.csv`
}

// ---------------- Entrega do arquivo ----------------

/**
 * Salva/compartilha um arquivo gerado.
 * No iPhone o share sheet é o caminho confiável para o app instalado na
 * Tela de Início; nos demais casos cai no download tradicional.
 */
export async function saveFile(name: string, content: string, mime: string): Promise<void> {
  const file = new File([content], name, { type: mime })

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
  }
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (error) {
      // Cancelar o share sheet não é erro: só não faz nada.
      if (error instanceof DOMException && error.name === 'AbortError') return
      // Qualquer outra falha cai no download abaixo.
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Espera o navegador iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Exportação CSV precisa de BOM para o Excel entender os acentos. */
export const CSV_BOM = '﻿'
export { ImportError }

/** Reexportado para o formulário exibir o texto correto no diálogo. */
export function describeBackup(backup: BackupFile): string {
  const shifts = backup.shifts.length
  const locations = backup.locations.length
  const payments = backup.payments.length
  return `${shifts} plantão${shifts === 1 ? '' : 'es'}, ${locations} local${
    locations === 1 ? '' : 'is'
  } e ${payments} recebimento${payments === 1 ? '' : 's'}`
}
