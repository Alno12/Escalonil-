import { createContext, useContext } from 'react'
import type { LocalDate } from '@/db/types'

export interface ShiftSheetsApi {
  /** Abre o cadastro em branco (opcionalmente já com uma data escolhida). */
  newShift: (date?: LocalDate) => void
  /** Abre o cadastro preenchido com os dados do plantão, para edição. */
  editShift: (id: string) => void
  /** Abre o cadastro copiando o plantão, pedindo a nova data (§48). */
  duplicateShift: (id: string) => void
  /** Abre o detalhe do plantão. */
  openShift: (id: string) => void
  /** Abre o registro de recebimento. */
  openPayment: (id: string) => void
  /**
   * Abre a folha do mês (compartilhar ou imprimir).
   *
   * Mora aqui, e não na Agenda, porque o ícone está no cabeçalho de TODAS as
   * telas — como o `+`. Sem o mês, propõe o mês corrente; a Agenda e o
   * Financeiro passam o que está na tela.
   */
  shareMonth: (month?: string) => void
}

export const ShiftSheetsContext = createContext<ShiftSheetsApi | null>(null)

export function useShiftSheets(): ShiftSheetsApi {
  const value = useContext(ShiftSheetsContext)
  if (!value) throw new Error('useShiftSheets precisa estar dentro de <ShiftSheetsProvider>.')
  return value
}
