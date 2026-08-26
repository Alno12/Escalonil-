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
  // `|| 0` troca -0 por 0: sem isso um arredondamento de fração de centavo
  // para baixo virava "-R$ 0,00" na tela.
  return brl.format(roundMoney(value) || 0)
}

/** "R$ 1.250" — para cartões de destaque; arredonda centavos. */
export function formatMoneyCompact(value: number): string {
  const rounded = roundMoney(value) || 0
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

/**
 * Máscara de digitação: o valor se preenche da direita para a esquerda.
 *
 * Digitar 1, 2, 0, 0, 0, 0 mostra 0,01 → 0,12 → 1,20 → 12,00 → 120,00 →
 * 1.200,00, e apagar desfaz na mesma ordem. É como funciona qualquer app de
 * banco: o plantonista nunca digita vírgula nem ponto, só os números.
 *
 * Campo vazio devolve string vazia (e não "0,00") para o placeholder aparecer.
 */
const MAX_MONEY_DIGITS = 11 // até R$ 999.999.999,99

const moneyInput = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function maskMoneyInput(raw: string): string {
  const digits = raw
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, MAX_MONEY_DIGITS)
  if (!digits) return ''
  return moneyInput.format(Number(digits) / 100)
}

/** Valor guardado no banco no formato do campo — "1.200,00". Zero vira vazio. */
export function moneyToInput(value: number): string {
  const rounded = roundMoney(value)
  return rounded > 0 ? moneyInput.format(rounded) : ''
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
