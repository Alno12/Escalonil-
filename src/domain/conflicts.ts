/**
 * Detecção de sobreposição de plantões (§20 do blueprint).
 *
 * Dois plantões conflitam quando os intervalos [início, fim) se cruzam.
 * Plantões cancelados nunca conflitam, e o plantão sendo editado é ignorado.
 * O conflito AVISA, mas não impede o salvamento — a decisão é do usuário.
 */
import type { LocalDateTime, Shift } from '@/db/types'
import { toDate } from './datetime'

export interface ConflictCandidate {
  id?: string
  startDateTime: LocalDateTime
  endDateTime: LocalDateTime
}

export function overlaps(a: ConflictCandidate, b: ConflictCandidate): boolean {
  const aStart = toDate(a.startDateTime).getTime()
  const aEnd = toDate(a.endDateTime).getTime()
  const bStart = toDate(b.startDateTime).getTime()
  const bEnd = toDate(b.endDateTime).getTime()
  // Encostar não é conflito: 07:00→19:00 seguido de 19:00→07:00 é válido.
  return aStart < bEnd && bStart < aEnd
}

/** Plantões existentes que se sobrepõem ao candidato, em ordem cronológica. */
export function findConflicts(candidate: ConflictCandidate, shifts: Shift[]): Shift[] {
  return shifts
    .filter(
      (s) => !s.cancelled && s.id !== candidate.id && overlaps(candidate, s),
    )
    .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
}
