import { describe, expect, it } from 'vitest'
import {
  addDays,
  addHours,
  addMonths,
  daysBetween,
  durationInHours,
  endOfMonth,
  endOfWeek,
  formatCountdown,
  formatDate,
  formatDateShort,
  formatDuration,
  formatLongDate,
  relativeDayLabel,
  startOfWeek,
  toDate,
  toLocalDateTime,
} from '../datetime'

describe('addHours', () => {
  it('mantém o mesmo dia quando o plantão termina antes da meia-noite', () => {
    expect(addHours('2026-08-25T07:00', 12)).toBe('2026-08-25T19:00')
  })

  it('atravessa a meia-noite somando horas', () => {
    expect(addHours('2026-08-25T19:00', 12)).toBe('2026-08-26T07:00')
  })

  it('monta um plantão de 24 horas', () => {
    expect(addHours('2026-08-25T07:00', 24)).toBe('2026-08-26T07:00')
  })

  it('monta plantões longos atravessando vários dias', () => {
    expect(addHours('2026-08-25T07:00', 36)).toBe('2026-08-26T19:00')
    expect(addHours('2026-08-25T19:00', 48)).toBe('2026-08-27T19:00')
  })

  it('aceita frações de hora', () => {
    expect(addHours('2026-08-25T07:00', 6.5)).toBe('2026-08-25T13:30')
  })

  it('atravessa a virada do mês', () => {
    expect(addHours('2026-08-31T19:00', 12)).toBe('2026-09-01T07:00')
  })
})

describe('durationInHours', () => {
  it('calcula 12 horas para 19:00 → 07:00', () => {
    expect(durationInHours('2026-08-25T19:00', '2026-08-26T07:00')).toBe(12)
  })

  it('aceita minutos quebrados', () => {
    expect(durationInHours('2026-08-25T07:00', '2026-08-25T13:30')).toBe(6.5)
  })

  it('nunca devolve valor negativo', () => {
    expect(durationInHours('2026-08-25T19:00', '2026-08-25T07:00')).toBe(0)
  })
})

describe('parsing local', () => {
  it('não desloca a data por causa de fuso horário', () => {
    const parsed = toDate('2026-01-01T00:30')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(0)
    expect(parsed.getDate()).toBe(1)
    expect(toLocalDateTime(parsed)).toBe('2026-01-01T00:30')
  })
})

describe('navegação de datas', () => {
  it('soma dias atravessando o mês', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('soma meses respeitando o último dia', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('usa domingo como início da semana', () => {
    // 25/08/2026 é uma terça-feira.
    expect(startOfWeek('2026-08-25')).toBe('2026-08-23')
    expect(endOfWeek('2026-08-25')).toBe('2026-08-29')
  })

  it('calcula o fim do mês em ano bissexto', () => {
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('conta dias entre datas', () => {
    expect(daysBetween('2026-08-25', '2026-09-05')).toBe(11)
    expect(daysBetween('2026-09-05', '2026-08-25')).toBe(-11)
  })
})

describe('formatação em pt-BR', () => {
  it('formata data, duração e dia por extenso', () => {
    expect(formatDate('2026-08-25T19:00')).toBe('25/08/2026')
    expect(formatDuration(12)).toBe('12h')
    expect(formatDuration(6.5)).toBe('6h30')
    expect(formatLongDate('2026-08-25')).toBe('Terça-feira, 25 de agosto')
  })

  it('usa rótulos relativos para hoje, amanhã e ontem', () => {
    expect(relativeDayLabel('2026-08-25', '2026-08-25')).toBe('Hoje')
    expect(relativeDayLabel('2026-08-26', '2026-08-25')).toBe('Amanhã')
    expect(relativeDayLabel('2026-08-24', '2026-08-25')).toBe('Ontem')
    expect(relativeDayLabel('2026-08-28', '2026-08-25')).toBe('Sex, 28/08')
  })

  it('conta o tempo restante até o plantão', () => {
    const now = toDate('2026-08-25T16:25')
    expect(formatCountdown('2026-08-25T19:00', now)).toBe('Em 2h 35min')
    expect(formatCountdown('2026-08-25T17:00', now)).toBe('Em 35 min')
    expect(formatCountdown('2026-08-27T19:00', now)).toBe('Em 2 dias')
    expect(formatCountdown('2026-08-25T10:00', now)).toBe('Agora')
  })
})

describe('ano nas datas curtas', () => {
  it('esconde o ano quando a data é do ano corrente', () => {
    expect(formatDateShort('2026-08-25', '2026-08-27')).toBe('25/08')
  })

  it('mostra o ano quando a data é de outro ano', () => {
    expect(formatDateShort('2025-08-25', '2026-08-27')).toBe('25/08/25')
    expect(formatDateShort('2027-01-03', '2026-08-27')).toBe('03/01/27')
  })

  it('sem referência, continua o formato curto de sempre', () => {
    expect(formatDateShort('2025-08-25')).toBe('25/08')
  })

  it('o rótulo relativo leva o ano junto', () => {
    expect(relativeDayLabel('2025-08-25', '2026-08-27')).toBe('Seg, 25/08/25')
    expect(relativeDayLabel('2026-08-25', '2026-08-27')).toBe('Ter, 25/08')
  })
})
