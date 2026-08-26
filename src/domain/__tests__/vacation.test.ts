import { describe, expect, it } from 'vitest'
import { vacationCountdown } from '../vacation'

const HOJE = '2026-08-26'

describe('contagem para as férias', () => {
  it('conta os dias que faltam', () => {
    expect(vacationCountdown('2026-10-11', HOJE)).toBe(
      'Relaxa, parente, daqui 46 dias a gente tá de férias.',
    )
  })

  it('não diz "daqui 1 dias" nem "daqui 0 dias"', () => {
    expect(vacationCountdown('2026-08-27', HOJE)).toBe(
      'Relaxa, parente, amanhã a gente tá de férias.',
    )
    expect(vacationCountdown('2026-08-26', HOJE)).toBe('Chegou, parente. Hoje a gente tá de férias.')
  })

  it('some depois que a data passa', () => {
    expect(vacationCountdown('2026-08-25', HOJE)).toBeNull()
    expect(vacationCountdown('2025-01-01', HOJE)).toBeNull()
  })

  it('some quando a contagem está desligada ou sem data', () => {
    expect(vacationCountdown('2026-10-11', HOJE, false)).toBeNull()
    expect(vacationCountdown(null, HOJE)).toBeNull()
  })

  it('recusa data que não existe no calendário', () => {
    expect(vacationCountdown('2026-02-31', HOJE)).toBeNull()
    expect(vacationCountdown('2027-13-01', HOJE)).toBeNull()
    expect(vacationCountdown('11/10/2026', HOJE)).toBeNull()
  })

  it('atravessa a virada do ano e o ano bissexto', () => {
    expect(vacationCountdown('2027-01-02', '2026-12-31')).toBe(
      'Relaxa, parente, daqui 2 dias a gente tá de férias.',
    )
    // 2028 é bissexto: 29 de fevereiro existe e entra na conta.
    expect(vacationCountdown('2028-03-01', '2028-02-27')).toBe(
      'Relaxa, parente, daqui 3 dias a gente tá de férias.',
    )
  })

  it('não trava com data muito distante', () => {
    expect(vacationCountdown('2030-01-01', HOJE)).toMatch(/^Relaxa, parente, daqui \d+ dias/)
  })
})
