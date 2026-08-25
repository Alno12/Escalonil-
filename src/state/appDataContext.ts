import { createContext, useContext } from 'react'
import type { LocalDate, Location, Payment, Settings, Shift, ShiftView } from '@/db/types'

export interface AppData {
  /** false enquanto o IndexedDB ainda não respondeu. */
  ready: boolean
  now: Date
  today: LocalDate
  shifts: Shift[]
  locations: Location[]
  payments: Payment[]
  settings: Settings
  /** Todos os plantões com local, pagamento e status, em ordem cronológica. */
  views: ShiftView[]
  viewById: Map<string, ShiftView>
}

export const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData precisa estar dentro de <AppDataProvider>.')
  return value
}
