/**
 * Modelos de plantão — os plantões que o médico já repetiu.
 *
 * Nada é cadastrado: o modelo é DEDUZIDO do histórico. Quem faz o mesmo
 * noturno na mesma UPA toda semana não deveria redigitar local, horário e
 * valor toda vez, e nenhuma tela nova de "gerenciar modelos" precisa existir
 * para isso.
 *
 * A data NUNCA faz parte do modelo: ela é a única coisa que muda de verdade
 * de um plantão para o outro.
 */
import type { LocalDateTime, Location, LocationColor, PaymentMode, Shift } from '@/db/types'
import { durationInHours, timePartOf } from './datetime'

/**
 * Quantas vezes uma combinação precisa aparecer para virar modelo.
 *
 * Com 1, todo plantão avulso viraria "modelo" e a lista seria só o histórico
 * de novo — que já está na agenda. Modelo é o que se repete.
 */
export const MIN_TEMPLATE_USES = 2

export interface ShiftTemplate {
  /** A própria chave de agrupamento — estável entre renderizações. */
  id: string
  locationId: string
  locationName: string
  color: LocationColor
  title: string
  shiftType: string
  /** "19:00" — hora de início. */
  startTime: string
  durationHours: number
  paymentMode: PaymentMode
  fixedAmount: number
  hourlyRate: number
  expectedAmount: number
  /** Quantos plantões do histórico caem neste modelo. Ordena a lista. */
  uses: number
  /** Início do plantão mais recente do grupo — desempata modelos igualmente usados. */
  lastUsed: LocalDateTime
}

/**
 * Tudo que descreve o plantão, menos a data.
 *
 * As anotações ficam de fora de propósito: são o pedaço realmente avulso
 * ("plantão extra pedido pela coordenação"), e incluí-las partiria em dois um
 * modelo que o usuário enxerga como um só.
 */
function templateKey(shift: Shift): string {
  return [
    shift.locationId,
    shift.title.trim(),
    shift.shiftType,
    timePartOf(shift.startDateTime),
    durationInHours(shift.startDateTime, shift.endDateTime),
    shift.expectedAmount,
  ].join('|')
}

/**
 * Modelos do histórico, do mais usado para o menos.
 *
 * Cancelados ficam de fora, como em toda agregação do app: o plantão que não
 * aconteceu não é rotina.
 */
export function buildShiftTemplates(shifts: Shift[], locations: Location[]): ShiftTemplate[] {
  const groups = new Map<string, ShiftTemplate>()
  const byId = new Map(locations.map((l) => [l.id, l]))

  for (const shift of shifts) {
    if (shift.cancelled) continue
    const location = byId.get(shift.locationId)
    // Local removido: o modelo não teria nome nem cor para mostrar.
    if (!location) continue

    const id = templateKey(shift)
    const existing = groups.get(id)
    if (existing) {
      existing.uses += 1
      // O mais recente manda no que não entra na chave (a forma de pagamento).
      if (shift.startDateTime > existing.lastUsed) {
        existing.lastUsed = shift.startDateTime
        existing.paymentMode = shift.paymentMode
        existing.fixedAmount = shift.fixedAmount
        existing.hourlyRate = shift.hourlyRate
      }
      continue
    }

    groups.set(id, {
      id,
      locationId: shift.locationId,
      locationName: location.name,
      color: location.color,
      title: shift.title.trim(),
      shiftType: shift.shiftType,
      startTime: timePartOf(shift.startDateTime),
      durationHours: durationInHours(shift.startDateTime, shift.endDateTime),
      paymentMode: shift.paymentMode,
      fixedAmount: shift.fixedAmount,
      hourlyRate: shift.hourlyRate,
      expectedAmount: shift.expectedAmount,
      uses: 1,
      lastUsed: shift.startDateTime,
    })
  }

  return [...groups.values()]
    .filter((t) => t.uses >= MIN_TEMPLATE_USES)
    .sort((a, b) => b.uses - a.uses || b.lastUsed.localeCompare(a.lastUsed))
}
