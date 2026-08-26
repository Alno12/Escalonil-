import { describe, expect, it } from 'vitest'
import { buildPeriod, PERIOD_OPTIONS, periodStepMonths } from '@/domain/periods'

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

describe('setas do período', () => {
  it('anda um mês de cada vez nos períodos do tamanho de um mês', () => {
    const back = buildPeriod('thisMonth', '2026-08-25', undefined, -1)
    expect(back.from).toBe('2026-07-01')
    expect(back.to).toBe('2026-07-31')
    expect(back.title).toBe('Julho de 2026')
  })

  it('anda o próprio tamanho nos intervalos', () => {
    expect(periodStepMonths('last3')).toBe(3)
    expect(periodStepMonths('year')).toBe(12)
    const back = buildPeriod('last3', '2026-08-25', undefined, -1)
    expect(back.from).toBe('2026-03-01')
    expect(back.to).toBe('2026-05-31')
  })

  it('troca as frases: fora do zero não existe "neste mês"', () => {
    const back = buildPeriod('thisMonth', '2026-08-25', undefined, -2)
    expect(back.label).toBe('em junho de 2026')
    expect(back.previousLabel).toBe('no mês anterior')
  })

  it('em "próximo mês" andado, compara com o mês antes do exibido', () => {
    // No offset zero o comparativo é o mês corrente, de propósito. Andando,
    // isso deixaria de fazer sentido.
    const moved = buildPeriod('nextMonth', '2026-08-25', undefined, 1)
    expect(moved.from).toBe('2026-10-01')
    expect(moved.previousFrom).toBe('2026-09-01')
    expect(moved.key).toBe('nextMonth')
  })

  it('desloca o personalizado pelo tamanho do intervalo', () => {
    const custom = { from: '2026-08-10', to: '2026-08-19' }
    const back = buildPeriod('custom', '2026-08-25', custom, -1)
    expect(back.from).toBe('2026-07-31')
    expect(back.to).toBe('2026-08-09')
  })

  it('atravessa a virada do ano', () => {
    expect(buildPeriod('thisMonth', '2026-01-15', undefined, -1).from).toBe('2025-12-01')
    expect(buildPeriod('year', '2026-01-15', undefined, -1).title).toBe('2025')
  })
})
