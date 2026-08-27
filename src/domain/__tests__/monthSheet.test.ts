import { describe, expect, it } from 'vitest'
import type { LocationColor, ShiftView } from '@/db/types'
import { durationInHours } from '@/domain/datetime'
import { formatMoneyCompact } from '@/domain/money'
import { buildMonthSheet, MAX_ENTRIES_PER_DAY, type SheetDay } from '@/domain/monthSheet'
import { buildMonthSheetSvg, fitText, SHEET_HEIGHT, SHEET_WIDTH } from '@/domain/monthSheetSvg'

let seq = 0

interface Options {
  locationId?: string
  name?: string
  color?: LocationColor
  amount?: number
  cancelled?: boolean
}

function view(start: string, end: string, o: Options = {}): ShiftView {
  const amount = o.amount ?? 1000
  const shift = {
    id: `s${(seq += 1)}`,
    seriesId: '',
    locationId: o.locationId ?? 'l1',
    title: '',
    shiftType: 'Pronto-socorro',
    startDateTime: start,
    endDateTime: end,
    paymentMode: 'fixed' as const,
    fixedAmount: amount,
    hourlyRate: 0,
    expectedAmount: amount,
    notes: '',
    cancelled: o.cancelled ?? false,
    createdAt: '2026-01-01T00:00',
    updatedAt: '2026-01-01T00:00',
  }
  return {
    shift,
    location: {
      id: shift.locationId,
      name: o.name ?? 'Hospital Regional',
      color: o.color ?? 'blue',
      createdAt: '2026-01-01T00:00',
    },
    payment: undefined,
    status: 'done',
    paymentStatus: 'pending',
    durationHours: durationInHours(start, end),
  }
}

const build = (views: ShiftView[], o: Parameters<typeof buildMonthSheet>[2] = { today: '2026-08-27' }) =>
  buildMonthSheet(views, '2026-08', o)

const dayOf = (sheet: ReturnType<typeof build>, date: string): SheetDay =>
  sheet.weeks.flat().find((d) => d.date === date)!

describe('a grade da folha', () => {
  it('são sempre seis semanas de domingo a sábado', () => {
    const sheet = build([])
    expect(sheet.weeks).toHaveLength(6)
    expect(sheet.weeks.every((w) => w.length === 7)).toBe(true)
    // Agosto de 2026 começa num sábado: a grade abre em 26/07.
    expect(sheet.weeks[0][0].date).toBe('2026-07-26')
    expect(sheet.weeks[5][6].date).toBe('2026-09-05')
    expect(sheet.weekdays).toEqual(['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'])
  })

  it('marca o que é de fora do mês e o que é fim de semana', () => {
    const sheet = build([])
    expect(dayOf(sheet, '2026-07-30').inMonth).toBe(false)
    expect(dayOf(sheet, '2026-08-03').inMonth).toBe(true)
    expect(dayOf(sheet, '2026-08-02').weekend).toBe(true)
    expect(dayOf(sheet, '2026-08-03').weekend).toBe(false)
  })
})

describe('o plantão que vira a noite', () => {
  it('só entra no dia seguinte quando toma esse dia (invariante 16)', () => {
    // 19:00 → 07:00 termina antes do meio-dia: de manhã o médico vai para casa.
    const sheet = build([view('2026-08-10T19:00', '2026-08-11T07:00')])
    expect(dayOf(sheet, '2026-08-10').entries).toHaveLength(1)
    expect(dayOf(sheet, '2026-08-11').entries).toHaveLength(0)
  })

  it('vira continuação no dia seguinte, nunca um plantão novo', () => {
    const sheet = build([view('2026-08-10T19:00', '2026-08-11T19:00')])
    const next = dayOf(sheet, '2026-08-11').entries
    expect(next).toHaveLength(1)
    expect(next[0].kind).toBe('continuation')
    expect(next[0].time).toBe('até 19:00')
    // O resumo continua contando UM plantão.
    expect(build([view('2026-08-10T19:00', '2026-08-11T19:00')]).summary).toContain('1 plantão')
  })

  it('a continuação nunca repete o valor', () => {
    const sheet = build([view('2026-08-10T19:00', '2026-08-11T19:00', { amount: 3000 })], {
      today: '2026-08-27',
      showAmounts: true,
    })
    expect(dayOf(sheet, '2026-08-10').entries[0].amount).toBe(formatMoneyCompact(3000))
    expect(dayOf(sheet, '2026-08-11').entries[0].amount).toBeNull()
  })

  it('o "+1" marca quem termina no dia seguinte', () => {
    const sheet = build([
      view('2026-08-10T19:00', '2026-08-11T07:00'),
      view('2026-08-12T07:00', '2026-08-12T19:00'),
    ])
    expect(dayOf(sheet, '2026-08-10').entries[0].overnight).toBe(true)
    expect(dayOf(sheet, '2026-08-12').entries[0].overnight).toBe(false)
  })
})

describe('o que a folha mostra', () => {
  it('a continuação vem antes dos plantões do próprio dia', () => {
    const sheet = build([
      view('2026-08-10T19:00', '2026-08-11T19:00'),
      view('2026-08-11T07:00', '2026-08-11T13:00'),
    ])
    expect(dayOf(sheet, '2026-08-11').entries.map((e) => e.kind)).toEqual([
      'continuation',
      'shift',
    ])
  })

  it('guarda o excedente do dia cheio em vez de estourar o quadrado', () => {
    const sheet = build([
      view('2026-08-10T07:00', '2026-08-10T10:00'),
      view('2026-08-10T10:00', '2026-08-10T13:00'),
      view('2026-08-10T13:00', '2026-08-10T16:00'),
      view('2026-08-10T16:00', '2026-08-10T19:00'),
      view('2026-08-10T19:00', '2026-08-10T22:00'),
    ])
    expect(dayOf(sheet, '2026-08-10').entries).toHaveLength(MAX_ENTRIES_PER_DAY)
    expect(dayOf(sheet, '2026-08-10').hidden).toBe(5 - MAX_ENTRIES_PER_DAY)
  })

  it('plantão cancelado não vai para a folha', () => {
    const sheet = build([
      view('2026-08-10T07:00', '2026-08-10T19:00'),
      view('2026-08-11T07:00', '2026-08-11T19:00', { cancelled: true }),
    ])
    expect(dayOf(sheet, '2026-08-11').entries).toHaveLength(0)
    expect(sheet.summary).toBe('1 plantão · 12 horas')
  })

  it('o valor só aparece quando a folha pede', () => {
    const views = [view('2026-08-10T07:00', '2026-08-10T19:00', { amount: 1500 })]
    expect(build(views).summary).toBe('1 plantão · 12 horas')
    expect(build(views, { today: '2026-08-27', showAmounts: true }).summary).toBe(
      `1 plantão · 12 horas · ${formatMoneyCompact(1500)}`,
    )
  })

  it('conta só os plantões DESTE mês, não os das pontas da grade', () => {
    const sheet = build([
      view('2026-07-30T07:00', '2026-07-30T19:00'),
      view('2026-08-10T07:00', '2026-08-10T19:00'),
      view('2026-09-02T07:00', '2026-09-02T19:00'),
    ])
    // Os vizinhos aparecem no desenho…
    expect(dayOf(sheet, '2026-07-30').entries).toHaveLength(1)
    expect(dayOf(sheet, '2026-09-02').entries).toHaveLength(1)
    // …mas não no resumo.
    expect(sheet.summary).toBe('1 plantão · 12 horas')
  })

  it('a legenda traz um item por local do mês', () => {
    const sheet = build([
      view('2026-08-10T07:00', '2026-08-10T19:00', { name: 'Hospital Regional', color: 'teal' }),
      view('2026-08-11T07:00', '2026-08-11T19:00', {
        locationId: 'l2',
        name: 'PS Norte',
        color: 'orange',
      }),
      view('2026-08-12T07:00', '2026-08-12T19:00', { name: 'Hospital Regional', color: 'teal' }),
    ])
    expect(sheet.legend).toEqual([
      { name: 'Hospital Regional', color: 'teal' },
      { name: 'PS Norte', color: 'orange' },
    ])
  })
})

describe('a folha de um local só', () => {
  const views = [
    view('2026-08-10T07:00', '2026-08-10T19:00', { amount: 1500 }),
    view('2026-08-11T07:00', '2026-08-11T19:00', {
      locationId: 'l2',
      name: 'PS Norte',
      amount: 700,
    }),
  ]
  const sheet = build(views, {
    today: '2026-08-27',
    showAmounts: true,
    location: { id: 'l1', name: 'Hospital Regional' },
  })

  it('deixa o resto do mês em branco', () => {
    expect(dayOf(sheet, '2026-08-10').entries).toHaveLength(1)
    expect(dayOf(sheet, '2026-08-11').entries).toHaveLength(0)
  })

  it('põe o nome do local no cabeçalho e reconta o resumo', () => {
    expect(sheet.subtitle).toBe('Hospital Regional')
    expect(sheet.summary).toBe(`1 plantão · 12 horas · ${formatMoneyCompact(1500)}`)
  })

  it('some com a legenda — com um local só ela não explica nada', () => {
    expect(sheet.legend).toEqual([])
  })
})

describe('o desenho', () => {
  it('sai em A4 deitada, com a folha inteira dentro do viewBox', () => {
    const svg = buildMonthSheetSvg(build([]))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain(`viewBox="0 0 ${SHEET_WIDTH} ${SHEET_HEIGHT}"`)
    expect(SHEET_WIDTH).toBeGreaterThan(SHEET_HEIGHT)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('escapa o que o usuário escreveu', () => {
    const svg = buildMonthSheetSvg(
      build([view('2026-08-10T07:00', '2026-08-10T19:00', { name: 'Casa & <Saúde>' })]),
    )
    expect(svg).toContain('Casa &amp; &lt;Saúde&gt;')
    expect(svg).not.toContain('<Saúde>')
  })

  it('escreve o nome do local, não só a cor — a folha vai para impressora P&B', () => {
    const svg = buildMonthSheetSvg(
      build([view('2026-08-10T07:00', '2026-08-10T19:00', { name: 'PS Norte' })]),
    )
    expect(svg).toContain('PS Norte')
  })

  it('corta o texto que não cabe', () => {
    expect(fitText('Hospital', 400, 9)).toBe('Hospital')
    const cut = fitText('Hospital Municipal Doutor Fulano de Tal', 40, 9)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.length).toBeLessThan('Hospital Municipal Doutor Fulano de Tal'.length)
  })
})
