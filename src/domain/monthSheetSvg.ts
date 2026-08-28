/**
 * O desenho da folha do mês, em SVG.
 *
 * É SVG e não HTML porque a MESMA folha serve para dois destinos: vai direto
 * para a impressora e vira imagem PNG para o WhatsApp. Em HTML seriam dois
 * desenhos obrigados a concordar para sempre — e um dia parariam.
 *
 * Duas consequências disso mandam no arquivo:
 *
 * 1. A folha é AUTOSSUFICIENTE. Carregada dentro de um `<img>` para virar
 *    imagem, ela não enxerga o CSS do app nem os tokens de cor, então as cores
 *    são escritas aqui em hexadecimal e a fonte é a pilha do sistema.
 * 2. Não existe quebra de texto automática. `fitText` corta no "…" a partir de
 *    uma largura ESTIMADA por caractere; não é medida de verdade, e não
 *    precisa ser — sobra folga em todos os campos.
 */
import type { LocationColor } from '@/db/types'
import type { MonthSheet, SheetDay, SheetEntry } from './monthSheet'

/**
 * A4 deitada, em pixels de 96dpi, já descontando 1mm de folga em cada lado —
 * é o que garante UMA folha só em qualquer impressora.
 */
export const SHEET_WIDTH = 1119
export const SHEET_HEIGHT = 786

/** As mesmas cores de `tokens.css`, no tema claro — a folha é sempre branca. */
const COLORS: Record<LocationColor, string> = {
  blue: '#007aff',
  teal: '#30b0c7',
  green: '#34c759',
  orange: '#ff9500',
  red: '#ff3b30',
  purple: '#af52de',
  pink: '#ff2d55',
  indigo: '#5856d6',
}

const INK = '#111114'
const INK_2 = '#555560'
const INK_3 = '#8e8e99'
const RULE = '#d6d6de'
const TINT = '#f4f4f7'
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

const PAD = 26
const HEADER_H = 52
const WEEKDAY_H = 17
const FOOTER_H = 20

const COL_W = (SHEET_WIDTH - PAD * 2) / 7
const GRID_TOP = PAD + HEADER_H + WEEKDAY_H
const GRID_H = SHEET_HEIGHT - PAD - FOOTER_H - 10 - GRID_TOP
const ROW_H = GRID_H / 6

/** Espaço interno do quadrado. */
const CELL_PAD = 6
/** Cada plantão ocupa duas linhas: o local e o horário. */
const ENTRY_H = 24

export function buildMonthSheetSvg(sheet: MonthSheet): string {
  const parts: string[] = []

  parts.push(header(sheet))
  parts.push(weekdays(sheet.weekdays))
  parts.push(grid(sheet))
  parts.push(footer(sheet))

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}"`,
    ` viewBox="0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}" preserveAspectRatio="xMidYMid meet"`,
    ` font-family="${FONT}" role="img" aria-label="${esc(sheet.title)}">`,
    `<rect width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}" fill="#ffffff"/>`,
    parts.join(''),
    '</svg>',
  ].join('')
}

// ---------------- Pedaços ----------------

function header(sheet: MonthSheet): string {
  const out = [
    text(sheet.title, PAD, PAD + 24, { size: 25, weight: 700, fill: INK }),
    text(sheet.summary, SHEET_WIDTH - PAD, PAD + 22, {
      size: 11.5,
      fill: INK_2,
      anchor: 'end',
    }),
  ]
  if (sheet.subtitle) {
    out.push(text(sheet.subtitle, PAD, PAD + 42, { size: 12.5, fill: INK_2 }))
  }
  return out.join('')
}

function weekdays(names: string[]): string {
  const y = PAD + HEADER_H + 12
  return names
    .map((name, i) =>
      text(name, PAD + COL_W * i + COL_W / 2, y, {
        size: 8.5,
        weight: 600,
        fill: INK_3,
        anchor: 'middle',
        spacing: 0.7,
      }),
    )
    .join('')
}

function grid(sheet: MonthSheet): string {
  const cells = sheet.weeks
    .flatMap((week, w) => week.map((day, d) => cell(day, PAD + COL_W * d, GRID_TOP + ROW_H * w)))
    .join('')

  // As linhas da grade vêm DEPOIS dos fundos e antes do texto ser lido: um
  // traço de 0.5 sobre o tingido some, sob ele não.
  const lines: string[] = []
  for (let i = 0; i <= 7; i += 1) {
    const x = PAD + COL_W * i
    lines.push(line(x, GRID_TOP, x, GRID_TOP + GRID_H))
  }
  for (let i = 0; i <= 6; i += 1) {
    const y = GRID_TOP + ROW_H * i
    lines.push(line(PAD, y, SHEET_WIDTH - PAD, y))
  }

  return cells + lines.join('')
}

function cell(day: SheetDay, x: number, y: number): string {
  const out: string[] = []

  /*
   * O tingido é do FIM DE SEMANA, e só dele. Fora do mês já teve o mesmo cinza,
   * e as duas coisas viravam uma mancha só: a primeira linha inteira parecia
   * fim de semana e o sábado do dia 1 se perdia no meio dela.
   *
   * O dia de fora do mês faz o que o calendário do app faz — RECUA: fundo
   * branco, número claro e os plantões apagados. Assim o cinza passa a
   * significar uma coisa só, e a faixa do fim de semana existe apenas dentro
   * do mês, que é o único lugar onde ela ajuda a planejar.
   */
  if (day.weekend && day.inMonth) {
    out.push(
      `<rect x="${r(x)}" y="${r(y)}" width="${r(COL_W)}" height="${r(ROW_H)}" fill="${TINT}"/>`,
    )
  }

  const numberSize = 11
  out.push(
    text(String(day.number), x + CELL_PAD, y + CELL_PAD + 10, {
      size: numberSize,
      weight: day.inMonth ? 700 : 400,
      fill: day.inMonth ? INK : INK_3,
    }),
  )

  if (day.monthLabel) {
    out.push(
      text(
        day.monthLabel,
        x + CELL_PAD + width(String(day.number), numberSize) + 4,
        y + CELL_PAD + 10,
        { size: 7.5, weight: 600, fill: INK_3, spacing: 0.5 },
      ),
    )
  }

  const entryWidth = COL_W - CELL_PAD * 2
  day.entries.forEach((entry, i) => {
    out.push(
      entryBlock(entry, x + CELL_PAD, y + CELL_PAD + 18 + ENTRY_H * i, entryWidth, !day.inMonth),
    )
  })

  if (day.hidden > 0) {
    // "mais 2", nunca "+2": o "+1" já é o sobrescrito do plantão que vira a
    // noite, e os dois na mesma célula seriam lidos como a mesma coisa.
    out.push(
      text(`mais ${day.hidden}`, x + CELL_PAD, y + ROW_H - CELL_PAD, {
        size: 8,
        weight: 600,
        fill: INK_3,
      }),
    )
  }

  return out.join('')
}

/** `muted` é o plantão de um dia de fora do mês: aparece, mas não compete. */
function entryBlock(
  entry: SheetEntry,
  x: number,
  y: number,
  width: number,
  muted = false,
): string {
  const color = COLORS[entry.color] ?? COLORS.blue
  const textX = x + 6
  const textW = width - 6
  const continuation = entry.kind === 'continuation'
  const faded = continuation || muted

  const out = [
    // A cor NUNCA é a única pista: o nome do local vai escrito no quadrado,
    // para a folha continuar legível em impressora preto e branco.
    `<rect x="${r(x)}" y="${r(y)}" width="2.5" height="19" rx="1.25" fill="${color}"${
      faded ? ' opacity="0.45"' : ''
    }/>`,
    text(continuation ? `↳ ${entry.location}` : entry.location, textX, y + 8, {
      size: 8.6,
      weight: continuation ? 400 : 700,
      fill: faded ? INK_2 : INK,
      max: textW,
      italic: continuation,
    }),
  ]

  const time = entry.amount ? `${entry.time} ${entry.amount}` : entry.time
  out.push(
    timeLine(time, entry.overnight, entry.amount, textX, y + 18, textW, faded ? INK_3 : INK_2),
  )
  return out.join('')
}

/**
 * "19:00 → 07:00⁺¹ R$ 1.600" numa linha só. O "+1" é sobrescrito e o valor vem
 * em negrito, então a linha é montada em `tspan` em vez de um texto só.
 */
function timeLine(
  full: string,
  overnight: boolean,
  amount: string | null,
  x: number,
  y: number,
  max: number,
  fill: string,
): string {
  const size = 8
  const base = amount ? full.slice(0, full.length - amount.length - 1) : full
  const spans = [`<tspan>${esc(fitText(base, max * 0.62, size, 400))}</tspan>`]
  if (overnight) spans.push(`<tspan baseline-shift="super" font-size="5.6">+1</tspan>`)
  if (amount) spans.push(`<tspan font-weight="700" dx="3">${esc(amount)}</tspan>`)
  return `<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${fill}">${spans.join('')}</text>`
}

function footer(sheet: MonthSheet): string {
  const y = SHEET_HEIGHT - PAD + 2
  const out: string[] = []

  let x = PAD
  for (const item of sheet.legend) {
    out.push(`<circle cx="${r(x + 3.5)}" cy="${r(y - 3.5)}" r="3.5" fill="${COLORS[item.color] ?? COLORS.blue}"/>`)
    const label = fitText(item.name, 150, 9, 400)
    out.push(text(label, x + 11, y, { size: 9, fill: INK_2 }))
    x += 11 + width(label, 9, 400) + 16
  }

  out.push(text(sheet.footer, SHEET_WIDTH - PAD, y, { size: 8.5, fill: INK_3, anchor: 'end' }))
  return out.join('')
}

// ---------------- Primitivas ----------------

interface TextOptions {
  size: number
  weight?: number
  fill?: string
  anchor?: 'start' | 'middle' | 'end'
  spacing?: number
  italic?: boolean
  /** Corta no "…" quando não cabe. */
  max?: number
}

function text(value: string, x: number, y: number, o: TextOptions): string {
  const content = o.max ? fitText(value, o.max, o.size, o.weight ?? 400) : value
  const attrs = [
    `x="${r(x)}"`,
    `y="${r(y)}"`,
    `font-size="${o.size}"`,
    o.weight && o.weight !== 400 ? `font-weight="${o.weight}"` : '',
    `fill="${o.fill ?? INK}"`,
    o.anchor && o.anchor !== 'start' ? `text-anchor="${o.anchor}"` : '',
    o.spacing ? `letter-spacing="${o.spacing}"` : '',
    o.italic ? 'font-style="italic"' : '',
  ].filter(Boolean)
  return `<text ${attrs.join(' ')}>${esc(content)}</text>`
}

const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${RULE}" stroke-width="0.6"/>`

/**
 * Largura ESTIMADA de um texto. Sem DOM não há como medir, e a folha também é
 * gerada fora do navegador nos testes — a tabela abaixo aproxima a Helvetica
 * bem o bastante para decidir onde cortar.
 */
const NARROW = new Set([...'iljtfIr.,;:!|\'`()[]{} '])
const WIDE = new Set([...'mwMW@'])

export function width(value: string, size: number, weight = 400): number {
  let units = 0
  for (const char of value) {
    if (NARROW.has(char)) units += 0.31
    else if (WIDE.has(char)) units += 0.86
    else if (char >= 'A' && char <= 'Z') units += 0.68
    else units += 0.55
  }
  return units * size * (weight >= 600 ? 1.05 : 1)
}

/** Corta no último caractere que ainda cabe e fecha com "…". */
export function fitText(value: string, max: number, size: number, weight = 400): string {
  if (max <= 0 || width(value, size, weight) <= max) return value
  const chars = [...value]
  let out = ''
  for (const char of chars) {
    if (width(`${out}${char}…`, size, weight) > max) break
    out += char
  }
  return `${out.trimEnd()}…`
}

const r = (n: number) => Math.round(n * 100) / 100

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
