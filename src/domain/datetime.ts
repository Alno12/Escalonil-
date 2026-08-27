/**
 * Datas e horas no "horário de parede" local.
 *
 * Regra central do app: datas são strings ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm")
 * e só viram `Date` na hora de comparar ou fazer conta. Assim não existe
 * conversão de fuso escondida em lugar nenhum.
 */
import type { LocalDate, LocalDateTime } from '@/db/types'

export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

/** Converte "YYYY-MM-DD[THH:mm]" para um Date no fuso local. */
export function toDate(value: LocalDate | LocalDateTime): Date {
  const [datePart, timePart = '00:00'] = value.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
}

export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toLocalDateTime(date: Date): LocalDateTime {
  return `${toLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function todayISO(now: Date = new Date()): LocalDate {
  return toLocalDate(now)
}

/** Parte "YYYY-MM-DD" de um LocalDateTime. */
export function datePartOf(value: LocalDateTime): LocalDate {
  return value.slice(0, 10)
}

/** Parte "HH:mm" de um LocalDateTime. */
export function timePartOf(value: LocalDateTime): string {
  return value.slice(11, 16)
}

/** Parte "YYYY-MM" de uma data — usada para agrupar por mês. */
export function monthPartOf(value: LocalDate | LocalDateTime): string {
  return value.slice(0, 7)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toDate(date)
  d.setDate(d.getDate() + days)
  return toLocalDate(d)
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const d = toDate(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  // Preserva o dia quando possível (31 de janeiro + 1 mês = 28/29 de fevereiro).
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())))
  return toLocalDate(d)
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Diferença em dias inteiros entre duas datas (b - a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS_PER_DAY)
}

/** Domingo da semana da data — convenção brasileira (domingo a sábado). */
export function startOfWeek(date: LocalDate): LocalDate {
  const d = toDate(date)
  return addDays(date, -d.getDay())
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(startOfWeek(date), 6)
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`
}

export function endOfMonth(date: LocalDate): LocalDate {
  const d = toDate(date)
  return `${date.slice(0, 7)}-${pad(daysInMonth(d.getFullYear(), d.getMonth()))}`
}

/**
 * Soma horas a um instante local, atravessando dias quando precisa.
 *
 * É o que sustenta os atalhos de duração do formulário (6h, 12h, 24h, 36h,
 * 48h): o término é sempre início + N horas, sem regra escondida de virada
 * de meia-noite — o usuário vê a data final e confere.
 */
export function addHours(value: LocalDateTime, hours: number): LocalDateTime {
  const d = toDate(value)
  d.setMinutes(d.getMinutes() + Math.round(hours * 60))
  return toLocalDateTime(d)
}

/** Junta data e hora num LocalDateTime. */
export function joinDateTime(date: LocalDate, time: string): LocalDateTime {
  return `${date}T${time}`
}

/** Duração em horas, com uma casa decimal de precisão prática. */
export function durationInHours(start: LocalDateTime, end: LocalDateTime): number {
  const ms = toDate(end).getTime() - toDate(start).getTime()
  return Math.max(0, Math.round((ms / MS_PER_HOUR) * 100) / 100)
}

// ---------------- Formatação (pt-BR) ----------------

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export const weekdayNames = WEEKDAYS
export const weekdayNamesShort = WEEKDAYS_SHORT
export const weekdayNamesMin = WEEKDAYS_MIN
export const monthNames = MONTHS
export const monthNamesShort = MONTHS_SHORT

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "25/08/2026" */
export function formatDate(value: LocalDate | LocalDateTime): string {
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * "25/08", ou "25/08/25" quando a data cai fora do ano de `today`.
 *
 * O ano só aparece quando muda alguma coisa: na lista da agenda, um plantão de
 * 2025 e um de 2026 apareciam os dois como "25/08". Sem `today`, o ano nunca
 * entra — é o formato curto de sempre.
 */
export function formatDateShort(value: LocalDate | LocalDateTime, today?: LocalDate): string {
  const [y, m, d] = value.slice(0, 10).split('-')
  const outroAno = today !== undefined && y !== today.slice(0, 4)
  return outroAno ? `${d}/${m}/${y.slice(2)}` : `${d}/${m}`
}

/** "Terça-feira, 25 de agosto" */
export function formatLongDate(value: LocalDate | LocalDateTime): string {
  const d = toDate(value.slice(0, 10))
  return `${capitalize(WEEKDAYS[d.getDay()])}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "25 de ago" */
export function formatDayMonth(value: LocalDate | LocalDateTime): string {
  const d = toDate(value.slice(0, 10))
  return `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()].toLowerCase()}`
}

/** "Agosto de 2026" */
export function formatMonthYear(value: LocalDate | LocalDateTime): string {
  const d = toDate(value.slice(0, 10))
  return `${capitalize(MONTHS[d.getMonth()])} de ${d.getFullYear()}`
}

/** "ago/26" — compacto para gráficos. */
export function formatMonthCompact(value: LocalDate | LocalDateTime): string {
  const d = toDate(value.slice(0, 10))
  return `${MONTHS_SHORT[d.getMonth()].toLowerCase()}/${String(d.getFullYear()).slice(2)}`
}

/** "19:00" */
export function formatTime(value: LocalDateTime): string {
  return timePartOf(value)
}

/** "12h" ou "12h30" */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`
}

/** "Em 2h 35min" / "Faltam 11 dias" / "Atrasado há 7 dias" */
export function formatCountdown(target: LocalDateTime, now: Date = new Date()): string {
  const diff = toDate(target).getTime() - now.getTime()
  if (diff <= 0) return 'Agora'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `Em ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0 ? `Em ${hours}h` : `Em ${hours}h ${rest}min`
  }
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Em 1 dia' : `Em ${days} dias`
}

/** "2h35" / "45min" / "3 dias" — versão curta, para caber em pílulas. */
export function formatCountdownShort(target: LocalDateTime, now: Date = new Date()): string {
  const diff = toDate(target).getTime() - now.getTime()
  if (diff <= 0) return 'agora'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest === 0 ? `${hours}h` : `${hours}h${pad(rest)}`
  }
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 dia' : `${days} dias`
}

/** Rótulo relativo de dia: "Hoje", "Amanhã", "Ontem" ou a data por extenso. */
export function relativeDayLabel(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(today, date)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  const d = toDate(date)
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${formatDateShort(date, today)}`
}

export function isSameDay(a: LocalDate | LocalDateTime, b: LocalDate | LocalDateTime): boolean {
  return a.slice(0, 10) === b.slice(0, 10)
}
