/**
 * Escalas e recorrências — o que transforma um plantão em uma série.
 *
 * O vocabulário é o do plantonista: "12×36" é trabalhar 12 horas e folgar 36;
 * "5×2" é trabalhar cinco dias e folgar dois. Toda escala é descrita pelos
 * mesmos segmentos `{work, off}`, então a geração é sempre a mesma conta.
 *
 * REGRA CENTRAL — a série sempre começa no dia marcado no formulário, mesmo
 * que esse dia já tenha passado. Nas escalas por dias da semana isso vale para
 * a semana inteira do início: marcar segunda com início na quarta inclui a
 * segunda daquela mesma semana.
 */
import type { LocalDate, LocalDateTime } from '@/db/types'
import {
  addDays,
  addHours,
  addMonths,
  datePartOf,
  daysInMonth,
  joinDateTime,
  startOfWeek,
  timePartOf,
  toDate,
  toLocalDate,
  weekdayNames,
  weekdayNamesShort,
} from '@/domain/datetime'

/** Teto de segurança de uma série — evita gerar milhares de plantões. */
export const MAX_OCCURRENCES = 120

/** Dias da semana, na ordem brasileira (domingo primeiro). */
export const WEEKDAY_OPTIONS = weekdayNamesShort.map((label, value) => ({ value, label }))

/** Um trecho de escala: trabalha `work`, folga `off`. Horas ou dias, conforme a escala. */
export interface Segment {
  work: number
  off: number
}

export type Recurrence =
  | { kind: 'none' }
  /** Ciclos de horas: 12×36 é começar de novo 48h depois. */
  | { kind: 'hours'; segments: Segment[] }
  /** Ciclos de dias: 5×2 é cinco plantões seguidos e dois dias de folga. */
  | { kind: 'days'; segments: Segment[] }
  | { kind: 'daily' }
  /** Dias marcados da semana, a cada N semanas. */
  | { kind: 'weekdays'; weekdays: number[]; everyWeeks: number }
  /** Mesmo dia do mês. */
  | { kind: 'monthlyDay' }
  /** Mesma posição no mês — "no primeiro sábado". */
  | { kind: 'monthlyWeekday' }

export const NO_RECURRENCE: Recurrence = { kind: 'none' }

export const hourScale = (...pairs: [number, number][]): Recurrence => ({
  kind: 'hours',
  segments: pairs.map(([work, off]) => ({ work, off })),
})

export const dayScale = (...pairs: [number, number][]): Recurrence => ({
  kind: 'days',
  segments: pairs.map(([work, off]) => ({ work, off })),
})

// ---------------- Geração ----------------

/**
 * Instantes de início de cada plantão da série.
 *
 * Devolve LocalDateTime (e não só a data) porque as escalas de horas caem
 * fora da meia-noite: um 12×24 que começa às 07:00 tem a ocorrência seguinte
 * às 19:00 do dia seguinte.
 */
export function recurrenceStarts(
  firstStart: LocalDateTime,
  recurrence: Recurrence,
  until: LocalDate,
  max: number = MAX_OCCURRENCES,
): LocalDateTime[] {
  const limit = Math.max(1, Math.floor(max))
  const starts = generate(firstStart, recurrence, until, limit)
  // Nenhuma escala pode devolver lista vazia: o plantão marcado sempre existe.
  return starts.length > 0 ? starts : [firstStart]
}

function generate(
  first: LocalDateTime,
  recurrence: Recurrence,
  until: LocalDate,
  limit: number,
): LocalDateTime[] {
  switch (recurrence.kind) {
    case 'none':
      return [first]
    case 'hours':
      return hourStarts(first, recurrence.segments, until, limit)
    case 'days':
      return dayStarts(first, recurrence.segments, until, limit)
    case 'daily':
      return dayStarts(first, [{ work: 1, off: 0 }], until, limit)
    case 'weekdays':
      return weekdayStarts(first, recurrence.weekdays, recurrence.everyWeeks, until, limit)
    case 'monthlyDay':
      return monthlyDayStarts(first, until, limit)
    case 'monthlyWeekday':
      return monthlyWeekdayStarts(first, until, limit)
  }
}

function hourStarts(
  first: LocalDateTime,
  segments: Segment[],
  until: LocalDate,
  limit: number,
): LocalDateTime[] {
  const cycle = normalizeSegments(segments, 1)
  const out: LocalDateTime[] = []
  let cursor = first

  for (let i = 0; datePartOf(cursor) <= until && out.length < limit; i += 1) {
    out.push(cursor)
    const segment = cycle[i % cycle.length]
    cursor = addHours(cursor, segment.work + segment.off)
  }
  return out
}

function dayStarts(
  first: LocalDateTime,
  segments: Segment[],
  until: LocalDate,
  limit: number,
): LocalDateTime[] {
  const cycle = normalizeSegments(segments, 1)
  const time = timePartOf(first)
  const out: LocalDateTime[] = []
  let date = datePartOf(first)

  for (let i = 0; date <= until && out.length < limit; i += 1) {
    const segment = cycle[i % cycle.length]
    const work = Math.max(1, Math.round(segment.work))
    for (let d = 0; d < work && date <= until && out.length < limit; d += 1) {
      out.push(joinDateTime(date, time))
      date = addDays(date, 1)
    }
    date = addDays(date, Math.max(0, Math.round(segment.off)))
  }
  return out
}

function weekdayStarts(
  first: LocalDateTime,
  weekdays: number[],
  everyWeeks: number,
  until: LocalDate,
  limit: number,
): LocalDateTime[] {
  const start = datePartOf(first)
  const days = normalizeWeekdays(weekdays, toDate(start).getDay())
  const step = Math.max(1, Math.round(everyWeeks))
  const time = timePartOf(first)
  const out: LocalDateTime[] = []

  // A varredura começa no domingo da semana do início — um dia marcado ANTES
  // da data digitada continua valendo.
  let weekStart = startOfWeek(start)
  while (weekStart <= until && out.length < limit) {
    for (const day of days) {
      const date = addDays(weekStart, day)
      if (date <= until && out.length < limit) out.push(joinDateTime(date, time))
    }
    weekStart = addDays(weekStart, 7 * step)
  }
  return out
}

function monthlyDayStarts(first: LocalDateTime, until: LocalDate, limit: number): LocalDateTime[] {
  const anchor = datePartOf(first)
  const time = timePartOf(first)
  const out: LocalDateTime[] = []

  // Sempre a partir da âncora: 31/01 + 1 mês é 28/02, mas + 2 meses volta a 31/03.
  for (let i = 0; out.length < limit; i += 1) {
    const date = addMonths(anchor, i)
    if (date > until) break
    out.push(joinDateTime(date, time))
  }
  return out
}

function monthlyWeekdayStarts(
  first: LocalDateTime,
  until: LocalDate,
  limit: number,
): LocalDateTime[] {
  const start = datePartOf(first)
  const { nth, weekday } = nthWeekdayOf(start)
  const time = timePartOf(first)
  const base = toDate(start)
  const out: LocalDateTime[] = []

  for (let i = 0; i < 600 && out.length < limit; i += 1) {
    const month = new Date(base.getFullYear(), base.getMonth() + i, 1)
    if (toLocalDate(month) > until) break
    const date = nthWeekdayDate(month.getFullYear(), month.getMonth(), weekday, nth)
    // Meses sem a 5ª ocorrência do dia simplesmente não têm plantão.
    if (!date) continue
    if (date > until) break
    out.push(joinDateTime(date, time))
  }
  return out
}

function normalizeSegments(segments: Segment[], minWork: number): Segment[] {
  const clean = segments.map((s) => ({
    work: Math.max(minWork, s.work || 0),
    off: Math.max(0, s.off || 0),
  }))
  return clean.length > 0 ? clean : [{ work: minWork, off: minWork }]
}

/** Nunca devolve lista vazia: sem marcação, vale o dia da data de início. */
export function normalizeWeekdays(weekdays: number[], fallback: number): number[] {
  const clean = [...new Set(weekdays.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
  return clean.length > 0 ? clean : [fallback]
}

/** Posição do dia dentro do mês: 15/08 numa sexta é a "3ª sexta". */
export function nthWeekdayOf(date: LocalDate): { nth: number; weekday: number } {
  const d = toDate(date)
  return { nth: Math.floor((d.getDate() - 1) / 7) + 1, weekday: d.getDay() }
}

function nthWeekdayDate(
  year: number,
  monthIndex: number,
  weekday: number,
  nth: number,
): LocalDate | null {
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7
  if (day > daysInMonth(year, monthIndex)) return null
  return toLocalDate(new Date(year, monthIndex, day))
}

/** Duração implícita de uma escala de horas — 12×36 são plantões de 12h. */
export function recurrenceShiftHours(recurrence: Recurrence): number | null {
  if (recurrence.kind !== 'hours') return null
  const first = recurrence.segments[0]
  return first && first.work > 0 ? first.work : null
}

// ---------------- Catálogo ----------------

export type CustomKind = 'hours' | 'days' | 'weekdays'

export interface RecurrenceOption {
  id: string
  label: string
  recurrence: Recurrence
  /** Quando presente, a linha abre um editor em vez de escolher direto. */
  custom?: CustomKind
  /**
   * A linha aplica a escala E abre um ajuste embaixo dela, sem fechar a folha.
   * É o que separa "escolher e pronto" de "escolher e afinar": marcar "Todas
   * as semanas" sem poder dizer QUAIS dias deixava metade da escolha invisível.
   */
  expand?: 'weekdays'
}

export interface RecurrenceGroup {
  id: string
  title?: string
  options: RecurrenceOption[]
}

export const CUSTOM_IDS: Record<CustomKind, string> = {
  hours: 'hours-custom',
  days: 'days-custom',
  weekdays: 'weekdays-custom',
}

/** Escala padrão de cada editor personalizado, quando aberto do zero. */
export function defaultCustom(kind: CustomKind, startDate: LocalDate): Recurrence {
  if (kind === 'hours') return hourScale([12, 36])
  if (kind === 'days') return dayScale([1, 1])
  return { kind: 'weekdays', weekdays: [toDate(startDate).getDay()], everyWeeks: 1 }
}

/**
 * As escalas oferecidas na tela de frequência.
 *
 * Depende da data de início porque três opções falam dela: "todas as semanas"
 * usa o dia da semana marcado e "todos os meses no primeiro sábado" usa a
 * posição do dia dentro do mês.
 */
export function recurrenceGroups(startDate: LocalDate): RecurrenceGroup[] {
  const weekday = toDate(startDate).getDay()

  return [
    {
      id: 'none',
      options: [{ id: 'none', label: 'Nenhuma', recurrence: NO_RECURRENCE }],
    },
    {
      id: 'recurrent',
      title: 'Escalas Recorrentes',
      options: [
        {
          id: 'weekdays-1-5',
          label: 'Todas as semanas de segunda a sexta',
          recurrence: { kind: 'weekdays', weekdays: [1, 2, 3, 4, 5], everyWeeks: 1 },
        },
        {
          id: 'biweekly',
          label: 'A cada 2 semanas',
          recurrence: { kind: 'weekdays', weekdays: [weekday], everyWeeks: 2 },
        },
        { id: 'daily', label: 'Todos os dias', recurrence: { kind: 'daily' } },
        {
          id: 'weekly',
          label: 'Todas as semanas',
          recurrence: { kind: 'weekdays', weekdays: [weekday], everyWeeks: 1 },
          expand: 'weekdays',
        },
        { id: 'monthly', label: 'Todos os meses', recurrence: { kind: 'monthlyDay' } },
        {
          id: 'monthly-weekday',
          label: `Todos os meses ${nthWeekdayPhrase(startDate)}`,
          recurrence: { kind: 'monthlyWeekday' },
        },
        {
          id: CUSTOM_IDS.weekdays,
          label: 'Escala Recorrente Personalizada',
          recurrence: defaultCustom('weekdays', startDate),
          custom: 'weekdays',
        },
      ],
    },
    {
      id: 'hours',
      title: 'Escalas de Horas',
      options: [
        { id: '12x24', label: '12×24', recurrence: hourScale([12, 24]) },
        { id: '12x36', label: '12×36', recurrence: hourScale([12, 36]) },
        { id: '12x60', label: '12×60', recurrence: hourScale([12, 60]) },
        { id: '12x24-12x72', label: '12×24, 12×72', recurrence: hourScale([12, 24], [12, 72]) },
        { id: '24x48', label: '24×48', recurrence: hourScale([24, 48]) },
        { id: '24x72', label: '24×72', recurrence: hourScale([24, 72]) },
        { id: '24x120', label: '24×120', recurrence: hourScale([24, 120]) },
        {
          id: CUSTOM_IDS.hours,
          label: 'Escala de Horas Personalizada',
          recurrence: defaultCustom('hours', startDate),
          custom: 'hours',
        },
      ],
    },
    {
      id: 'days',
      title: 'Escalas de Dias',
      options: [
        { id: '2x2', label: '2×2', recurrence: dayScale([2, 2]) },
        { id: '1x1', label: '1×1', recurrence: dayScale([1, 1]) },
        { id: '1x2', label: '1×2', recurrence: dayScale([1, 2]) },
        { id: '1x3', label: '1×3', recurrence: dayScale([1, 3]) },
        { id: '1x1-1x3', label: '1×1, 1×3', recurrence: dayScale([1, 1], [1, 3]) },
        { id: '5x2', label: '5×2', recurrence: dayScale([5, 2]) },
        { id: '6x1', label: '6×1', recurrence: dayScale([6, 1]) },
        {
          id: CUSTOM_IDS.days,
          label: 'Escala de Dias Personalizada',
          recurrence: defaultCustom('days', startDate),
          custom: 'days',
        },
      ],
    },
  ]
}

const ORDINALS_M = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto']
const ORDINALS_F = ['primeira', 'segunda', 'terceira', 'quarta', 'quinta']

/** "no primeiro sábado" / "na primeira segunda-feira" — o gênero acompanha o dia. */
export function nthWeekdayPhrase(date: LocalDate): string {
  const { nth, weekday } = nthWeekdayOf(date)
  const name = weekdayNames[weekday]
  const feminine = name.endsWith('-feira')
  const ordinals = feminine ? ORDINALS_F : ORDINALS_M
  return `${feminine ? 'na' : 'no'} ${ordinals[nth - 1] ?? ordinals[0]} ${name}`
}

export function sameRecurrence(a: Recurrence, b: Recurrence): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'hours' || a.kind === 'days') {
    const other = b as Extract<Recurrence, { segments: Segment[] }>
    return (
      a.segments.length === other.segments.length &&
      a.segments.every(
        (s, i) => s.work === other.segments[i].work && s.off === other.segments[i].off,
      )
    )
  }
  if (a.kind === 'weekdays') {
    const other = b as Extract<Recurrence, { kind: 'weekdays' }>
    const mine = normalizeWeekdays(a.weekdays, 0)
    const theirs = normalizeWeekdays(other.weekdays, 0)
    return (
      a.everyWeeks === other.everyWeeks &&
      mine.length === theirs.length &&
      mine.every((d, i) => d === theirs[i])
    )
  }
  return true
}

/** Qual linha da tela de frequência está marcada agora. */
export function selectedOptionId(recurrence: Recurrence, startDate: LocalDate): string {
  for (const group of recurrenceGroups(startDate)) {
    const match = group.options.find((o) => !o.custom && sameRecurrence(o.recurrence, recurrence))
    if (match) return match.id
  }
  if (recurrence.kind === 'hours') return CUSTOM_IDS.hours
  if (recurrence.kind === 'days') return CUSTOM_IDS.days
  /*
   * Escolher outros dias na linha "Todas as semanas" muda a recorrência e ela
   * deixa de bater com o preset — sem isso a marca pulava para a linha
   * "Personalizada" no primeiro dia marcado, com o editor aberto logo acima.
   * O intervalo é que decide a casa; os dias são o ajuste dentro dela.
   */
  if (recurrence.kind === 'weekdays') {
    if (recurrence.everyWeeks === 1) return 'weekly'
    if (recurrence.everyWeeks === 2) return 'biweekly'
    return CUSTOM_IDS.weekdays
  }
  return 'none'
}

const trimNumber = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','))

const segmentsLabel = (segments: Segment[]) =>
  segments.map((s) => `${trimNumber(s.work)}×${trimNumber(s.off)}`).join(', ')

/** Nome da escala como aparece na linha "Frequência". */
export function recurrenceLabel(recurrence: Recurrence, startDate: LocalDate): string {
  /*
   * "Todas as semanas" e "A cada 2 semanas" nascem com UM dia — o da data — e
   * o rótulo delas não conta qual. Depois que o usuário marca outros dias, o
   * nome pronto esconderia justamente o que ele acabou de escolher, então
   * essas caem no texto com os dias. Já "de segunda a sexta" nomeia os cinco
   * dias no próprio rótulo e continua valendo.
   */
  for (const group of recurrenceGroups(startDate)) {
    const match = group.options.find(
      (o) =>
        !o.custom &&
        !(o.recurrence.kind === 'weekdays' && o.recurrence.weekdays.length === 1) &&
        sameRecurrence(o.recurrence, recurrence),
    )
    if (match) return match.label
  }

  switch (recurrence.kind) {
    case 'hours':
      return segmentsLabel(recurrence.segments)
    case 'days':
      return `${segmentsLabel(recurrence.segments)} dias`
    case 'weekdays': {
      const days = normalizeWeekdays(recurrence.weekdays, toDate(startDate).getDay())
        .map((d) => weekdayNamesShort[d])
        .join(', ')
      const every =
        recurrence.everyWeeks > 1 ? `A cada ${recurrence.everyWeeks} semanas` : 'Toda semana'
      return `${every} · ${days}`
    }
    default:
      return 'Nenhuma'
  }
}
