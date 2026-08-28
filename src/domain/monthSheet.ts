/**
 * A folha do mês — o mesmo desenho que vai para a impressora e para o WhatsApp.
 *
 * Aqui mora só o CONTEÚDO da folha: quais plantões caem em cada quadrado, o
 * que está escrito em cada um e o que vai no cabeçalho e no rodapé. Quem
 * desenha é `monthSheetSvg.ts` — separados porque o modelo é testável em Node
 * e o desenho é só texto.
 *
 * O plantão que atravessa a meia-noite segue a MESMA regra da agenda
 * (invariante 16): pertence ao dia em que começa e só aparece no dia seguinte
 * quando de fato o toma. Lá ele entra como CONTINUAÇÃO — "↳ Hospital Regional,
 * até 19:00" —, nunca como um plantão novo, senão a folha contaria dois.
 */
import type { LocalDate, LocationColor, ShiftView } from '@/db/types'
import {
  addDays,
  datePartOf,
  formatDate,
  formatMonthYear,
  formatTime,
  monthNamesShort,
  monthPartOf,
  startOfMonth,
  startOfWeek,
  toDate,
  weekdayNamesShort,
} from './datetime'
import { formatMoneyCompact } from './money'
import { occupiedDays, periodSummary, sortByStart } from './summary'

/** Seis semanas cobrem qualquer mês — a grade nunca muda de altura. */
const WEEKS = 6

/** Acima disso o quadrado não cabe mais linha; o resto vira "+2". */
export const MAX_ENTRIES_PER_DAY = 3

export interface SheetEntry {
  /** 'continuation' é o plantão da véspera que invadiu este dia. */
  kind: 'shift' | 'continuation'
  location: string
  color: LocationColor
  /** "19:00 → 07:00" no plantão, "até 19:00" na continuação. */
  time: string
  /** O plantão termina no dia seguinte — vira um "+1" sobrescrito. */
  overnight: boolean
  /** Só quando a folha sai com valores. */
  amount: string | null
}

export interface SheetDay {
  date: LocalDate
  number: number
  inMonth: boolean
  weekend: boolean
  entries: SheetEntry[]
  /** Quantos plantões não couberam no quadrado. */
  hidden: number
  /**
   * "JUL" no primeiro dia de cada bloco de fora do mês, `null` no resto.
   *
   * Recuar o quadrado diz que ele não é deste mês; o rótulo diz de QUAL mês
   * ele é, e é a única pista que sobrevive numa impressora preto e branco sem
   * depender de comparar dois cinzas.
   */
  monthLabel: string | null
}

export interface SheetLegendItem {
  name: string
  color: LocationColor
}

export interface MonthSheet {
  title: string
  /** O nome do local, quando a folha sai filtrada. */
  subtitle: string | null
  summary: string
  weekdays: string[]
  weeks: SheetDay[][]
  /** Vazia na folha filtrada: com um local só, ela não explicaria nada. */
  legend: SheetLegendItem[]
  footer: string
}

export interface MonthSheetOptions {
  /** `null` traz a escala inteira do mês. */
  location?: { id: string; name: string } | null
  showAmounts?: boolean
  /** Data que aparece no rodapé ("gerado em"). */
  today: LocalDate
}

const LOCATION_FALLBACK = 'Local removido'

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`

/** "174 horas" — a folha não tem espaço para minutos quebrados. */
function hoursLabel(hours: number): string {
  const rounded = Math.round(hours)
  return plural(rounded, 'hora', 'horas')
}

export function buildMonthSheet(
  views: ShiftView[],
  month: string,
  { location = null, showAmounts = false, today }: MonthSheetOptions,
): MonthSheet {
  // Plantão cancelado não vai para a folha: quem recebe a escala precisa saber
  // onde o médico ESTARÁ, e um cancelado não é escala nenhuma.
  const active = views.filter(
    (v) => !v.shift.cancelled && (!location || v.shift.locationId === location.id),
  )

  const gridStart = startOfWeek(startOfMonth(`${month}-01`))
  const inGrid = new Map<LocalDate, ShiftView[]>()
  const continuations = new Map<LocalDate, ShiftView[]>()

  for (const view of active) {
    const [start, ...rest] = occupiedDays(view.shift)
    push(inGrid, start, view)
    for (const day of rest) push(continuations, day, view)
  }

  const weeks: SheetDay[][] = []
  // O rótulo do mês vizinho vai só na ABERTURA de cada bloco de fora — em todos
  // os dias ele viraria uma coluna de ruído ao lado dos números.
  let prevInMonth = true
  for (let w = 0; w < WEEKS; w += 1) {
    const days: SheetDay[] = []
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(gridStart, w * 7 + d)
      const own = sortByStart(inGrid.get(date) ?? [])
      const carried = sortByStart(continuations.get(date) ?? [])
      // A continuação vem primeiro: ela começou antes de todo mundo.
      const all = [
        ...carried.map((v) => entryOf(v, 'continuation', showAmounts)),
        ...own.map((v) => entryOf(v, 'shift', showAmounts)),
      ]
      const inMonth = monthPartOf(date) === month
      days.push({
        date,
        number: toDate(date).getDate(),
        inMonth,
        weekend: d === 0 || d === 6,
        entries: all.slice(0, MAX_ENTRIES_PER_DAY),
        hidden: Math.max(0, all.length - MAX_ENTRIES_PER_DAY),
        monthLabel:
          !inMonth && prevInMonth
            ? monthNamesShort[toDate(date).getMonth()].toUpperCase()
            : null,
      })
      prevInMonth = inMonth
    }
    weeks.push(days)
  }

  // O resumo conta o que está NO MÊS, não o que aparece na grade: as
  // continuações e os dias vizinhos que sobram nas pontas não são plantões
  // deste mês.
  const ofMonth = active.filter((v) => monthPartOf(v.shift.startDateTime) === month)
  const totals = periodSummary(ofMonth)
  const summary = [
    plural(totals.shifts, 'plantão', 'plantões'),
    hoursLabel(totals.hours),
    ...(showAmounts ? [formatMoneyCompact(totals.expected)] : []),
  ].join(' · ')

  return {
    title: formatMonthYear(`${month}-01`),
    subtitle: location?.name ?? null,
    summary,
    weekdays: weekdayNamesShort.map((name) => name.toUpperCase()),
    weeks,
    legend: location ? [] : legendOf(ofMonth),
    footer: `Escalonil · gerado em ${formatDate(today)}`,
  }
}

function push(map: Map<LocalDate, ShiftView[]>, day: LocalDate, view: ShiftView) {
  const list = map.get(day)
  if (list) list.push(view)
  else map.set(day, [view])
}

function entryOf(
  view: ShiftView,
  kind: SheetEntry['kind'],
  showAmounts: boolean,
): SheetEntry {
  const { shift } = view
  const overnight = kind === 'shift' && datePartOf(shift.endDateTime) !== datePartOf(shift.startDateTime)
  return {
    kind,
    location: view.location?.name ?? LOCATION_FALLBACK,
    color: view.location?.color ?? 'blue',
    time:
      kind === 'continuation'
        ? `até ${formatTime(shift.endDateTime)}`
        : `${formatTime(shift.startDateTime)} → ${formatTime(shift.endDateTime)}`,
    overnight,
    // O valor pertence ao plantão, não à continuação: repetido nos dois dias,
    // a folha pareceria somar duas vezes.
    amount: showAmounts && kind === 'shift' ? formatMoneyCompact(shift.expectedAmount) : null,
  }
}

/** Um item por local que aparece no mês, na ordem em que a agenda os mostra. */
function legendOf(views: ShiftView[]): SheetLegendItem[] {
  const seen = new Map<string, SheetLegendItem>()
  for (const view of sortByStart(views)) {
    const name = view.location?.name ?? LOCATION_FALLBACK
    if (!seen.has(name)) seen.set(name, { name, color: view.location?.color ?? 'blue' })
  }
  return [...seen.values()]
}
