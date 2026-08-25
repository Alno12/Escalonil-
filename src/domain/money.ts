/** Valores monetários em reais. Toda formatação de dinheiro passa por aqui. */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** Arredonda para centavos — evita o "0,1 + 0,2" do ponto flutuante. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** "R$ 1.250,00" */
export function formatMoney(value: number): string {
  return brl.format(roundMoney(value))
}

/** "R$ 1.250" — para cartões de destaque; arredonda centavos. */
export function formatMoneyCompact(value: number): string {
  const rounded = roundMoney(value)
  return Number.isInteger(rounded) ? brlCompact.format(rounded) : brl.format(rounded)
}

/** "+ R$ 100,00" / "- R$ 100,00" — usado na divergência de pagamento. */
export function formatMoneySigned(value: number): string {
  const rounded = roundMoney(value)
  if (rounded === 0) return formatMoney(0)
  return `${rounded > 0 ? '+ ' : '- '}${brl.format(Math.abs(rounded))}`
}

export function formatNumber(value: number): string {
  return decimal.format(value)
}

export function formatPercent(value: number): string {
  return `${decimal.format(value)}%`
}

/** "1.200", "12.345.678" — pontos usados como separador de milhar. */
const THOUSANDS_ONLY = /^-?\d{1,3}(\.\d{3})+$/

/**
 * Lê o que o usuário digitou em um campo de dinheiro.
 * Aceita "1.200,50", "1200,50", "1200.50", "1.200" e "R$ 1.200".
 *
 * Sem vírgula, "1.200" é ambíguo: pode ser mil e duzentos (padrão brasileiro)
 * ou um e dois décimos. Quando o ponto separa grupos exatos de 3 dígitos,
 * vale a leitura brasileira — é o que o usuário quis dizer ao digitar.
 */
export function parseMoneyInput(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) return 0

  let normalized: string
  if (cleaned.includes(',')) {
    // Com vírgula, ela é o decimal e o ponto é milhar.
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (THOUSANDS_ONLY.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? roundMoney(value) : 0
}
