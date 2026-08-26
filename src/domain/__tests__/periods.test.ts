import { describe, expect, it } from 'vitest'
import { buildPeriod, PERIOD_OPTIONS } from '@/domain/periods'

describe('PERIOD_OPTIONS', () => {
  it('oferece o próximo mês logo depois do mês atual', () => {
    expect(PERIOD_OPTIONS.map((o) => o.value)).toEqual([
      'thisMonth',
      'nextMonth',
      'lastMonth',
      'last3',
      'last6',
      'year',
      'custom',
    ])
  })
})

describe('próximo mês', () => {
  it('cobre o mês inteiro seguinte', () => {
    const period = buildPeriod('nextMonth', '2026-08-25')
    expect(period.from).toBe('2026-09-01')
    expect(period.to).toBe('2026-09-30')
    expect(period.title).toBe('Setembro de 2026')
  })

  it('compara com o mês corrente, não com o anterior', () => {
    const period = buildPeriod('nextMonth', '2026-08-25')
    expect(period.previousFrom).toBe('2026-08-01')
    expect(period.previousTo).toBe('2026-08-31')
    expect(period.label).toBe('no mês que vem')
    expect(period.previousLabel).toBe('neste mês')
  })

  it('atravessa a virada do ano', () => {
    const period = buildPeriod('nextMonth', '2026-12-15')
    expect(period.from).toBe('2027-01-01')
    expect(period.to).toBe('2027-01-31')
    expect(period.previousFrom).toBe('2026-12-01')
  })

  it('não escorrega quando o dia não existe no mês seguinte', () => {
    // 31/01 + 1 mês cairia em 28/02; o que importa é o mês inteiro.
    const period = buildPeriod('nextMonth', '2027-01-31')
    expect(period.from).toBe('2027-02-01')
    expect(period.to).toBe('2027-02-28')
  })
})

describe('demais períodos', () => {
  it('mês atual e mês anterior seguem o de sempre', () => {
    expect(buildPeriod('thisMonth', '2026-08-25').from).toBe('2026-08-01')
    expect(buildPeriod('lastMonth', '2026-08-25').to).toBe('2026-07-31')
  })

  it('uma chave desconhecida cai no mês atual', () => {
    // @ts-expect-error a tela nunca manda isso, mas o padrão precisa existir.
    expect(buildPeriod('inexistente', '2026-08-25').key).toBe('thisMonth')
  })
})
