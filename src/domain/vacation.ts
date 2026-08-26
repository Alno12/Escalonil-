/**
 * A contagem regressiva para as férias.
 *
 * É um easter egg: o Escalonil foi feito de presente, e a linha existe para
 * arrancar um sorriso de quem abre o app no meio de uma escala pesada.
 *
 * A frase é UMA só; o que muda com a distância é a gramática — "daqui 1 dias"
 * e "daqui 0 dias" estariam errados, então amanhã e o próprio dia têm texto
 * próprio. Passada a data, a linha some: o app não sabe quando as férias
 * acabam, e contar dias para trás não teria graça nenhuma.
 */
import type { LocalDate } from '@/db/types'
import { daysBetween, toDate, toLocalDate } from './datetime'

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Data que existe mesmo no calendário — "2026-02-31" não passa. */
function isRealDate(value: string): boolean {
  return DATE.test(value) && toLocalDate(toDate(value)) === value
}

/**
 * A frase do dia, ou `null` quando não há o que dizer: contagem desligada,
 * sem data, data impossível ou data já passada.
 */
export function vacationCountdown(
  vacationDate: LocalDate | null,
  today: LocalDate,
  enabled = true,
): string | null {
  if (!enabled || !vacationDate || !isRealDate(vacationDate)) return null

  const days = daysBetween(today, vacationDate)
  if (days < 0) return null
  if (days === 0) return 'Chegou, parente. Hoje a gente tá de férias.'
  if (days === 1) return 'Relaxa, parente, amanhã a gente tá de férias.'
  return `Relaxa, parente, daqui ${days} dias a gente tá de férias.`
}
