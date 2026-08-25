import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildShiftRange,
  daysBetween,
  durationInHours,
  endOfMonth,
  endOfWeek,
  formatCountdown,
  formatDate,
  formatDuration,
  formatLongDate,
  relativeDayLabel,
  startOfWeek,
  toDate,
  toLocalDateTime,
} from '../datetime'

describe('buildShiftRange', () => {
  it('mantém o mesmo dia quando o plantão termina antes da meia-noite', () => {
    expect(buildShiftRange('2026-08-25', '07:00', '19:00')).toEqual({
      startDateTime: '2026-08-25T07:00',
      endDateTime: '2026-08-25T19:00',
    })
  })

  it('avança um dia quando o plantão atravessa a meia-noite', () => {
    expect(buildShiftRange('2026-08-25', '19:00', '07:00')).toEqual({
      startDateTime: '2026-08-25T19:00',
      endDateTime: '2026-08-26T07:00',
    })
  })

  it('trata início igual ao término como plantão de 24 horas', () => {
    const range = buildShiftRange('2026-08-25', '07:00', '07:00')
    expect(range.endDateTime).toBe('2026-08-26T07:00')
    expect(durationInHours(range.startDateTime, range.endDateTime)).toBe(24)
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
