import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  maskMoneyInput,
  moneyToInput,
  parseMoneyInput,
  roundMoney,
} from '@/domain/money'

describe('money', () => {
  // O Intl usa espaço não separável entre "R$" e o número.
  const normalize = (value: string) => value.replace(/\u00a0/g, ' ')

  it('formata em reais no padrão brasileiro', () => {
    expect(normalize(formatMoney(1250))).toBe('R$ 1.250,00')
    expect(normalize(formatMoney(0))).toBe('R$ 0,00')
    expect(normalize(formatMoney(1234567.891))).toBe('R$ 1.234.567,89')
  })

  it('lê valores digitados em formatos diferentes', () => {
    expect(parseMoneyInput('1.200,50')).toBe(1200.5)
    expect(parseMoneyInput('1200,50')).toBe(1200.5)
    expect(parseMoneyInput('1200.50')).toBe(1200.5)
    expect(parseMoneyInput('1.200')).toBe(1200)
    expect(parseMoneyInput('R$ 1.200')).toBe(1200)
    expect(parseMoneyInput('12.345.678')).toBe(12345678)
    expect(parseMoneyInput('100')).toBe(100)
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
  })

  it('arredonda para centavos', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  })
})

describe('maskMoneyInput', () => {
  it('preenche da direita para a esquerda', () => {
    expect(maskMoneyInput('1')).toBe('0,01')
    expect(maskMoneyInput('12')).toBe('0,12')
    expect(maskMoneyInput('120')).toBe('1,20')
    expect(maskMoneyInput('1200')).toBe('12,00')
    expect(maskMoneyInput('12000')).toBe('120,00')
    expect(maskMoneyInput('120000')).toBe('1.200,00')
    expect(maskMoneyInput('120000000')).toBe('1.200.000,00')
  })

  it('ignora tudo que não é dígito', () => {
    expect(maskMoneyInput('R$ 1.200,00')).toBe('1.200,00')
    expect(maskMoneyInput('1a2b0c0d0e0')).toBe('1.200,00')
  })

  it('campo vazio continua vazio, para o placeholder aparecer', () => {
    expect(maskMoneyInput('')).toBe('')
    expect(maskMoneyInput('abc')).toBe('')
    expect(maskMoneyInput('R$ ')).toBe('')
  })

  it('não deixa zeros à esquerda se acumularem', () => {
    expect(maskMoneyInput('0')).toBe('0,00')
    expect(maskMoneyInput('0000')).toBe('0,00')
    expect(maskMoneyInput('0005')).toBe('0,05')
  })

  it('tem teto, para não estourar o inteiro seguro', () => {
    expect(maskMoneyInput('9'.repeat(30))).toBe('999.999.999,99')
  })

  it('o que ela escreve, o parser lê de volta', () => {
    for (const digits of ['1', '120', '120000', '123456789']) {
      const masked = maskMoneyInput(digits)
      expect(parseMoneyInput(masked)).toBe(Number(digits) / 100)
    }
  })
})

describe('moneyToInput', () => {
  it('traz o valor guardado no formato do campo', () => {
    expect(moneyToInput(1200)).toBe('1.200,00')
    expect(moneyToInput(1200.5)).toBe('1.200,50')
    expect(moneyToInput(0.05)).toBe('0,05')
  })

  it('zero vira campo vazio', () => {
    expect(moneyToInput(0)).toBe('')
    expect(moneyToInput(-10)).toBe('')
  })
})
