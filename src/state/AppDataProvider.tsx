import { useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, DEFAULT_SETTINGS } from '@/db/db'
import { buildShiftViews } from '@/domain/shift'
import { todayISO } from '@/domain/datetime'
import { useNow } from '@/hooks/useNow'
import { AppDataContext, type AppData } from './appDataContext'

/**
 * Carrega o banco inteiro em memória e mantém tudo reativo.
 *
 * Por que carregar tudo: o app é pessoal e mesmo alguns milhares de plantões
 * ocupam poucos megabytes. Com os dados em memória, todo cálculo (resumos,
 * conflitos, relatórios) é síncrono e instantâneo — bem mais simples e rápido
 * do que consultar o IndexedDB a cada tela.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const now = useNow()

  const shifts = useLiveQuery(() => db.shifts.orderBy('startDateTime').toArray(), [])
  const locations = useLiveQuery(() => db.locations.orderBy('name').toArray(), [])
  const payments = useLiveQuery(() => db.payments.toArray(), [])
  const storedSettings = useLiveQuery(() => db.settings.get('app'), [])

  const value = useMemo<AppData>(() => {
    const shiftList = shifts ?? []
    const locationList = locations ?? []
    const paymentList = payments ?? []
    const views = buildShiftViews(shiftList, locationList, paymentList, now)
    return {
      ready: shifts !== undefined && locations !== undefined && payments !== undefined,
      now,
      today: todayISO(now),
      shifts: shiftList,
      locations: locationList,
      payments: paymentList,
      settings: { ...DEFAULT_SETTINGS, ...storedSettings, id: 'app' },
      views,
      viewById: new Map(views.map((v) => [v.shift.id, v])),
    }
  }, [shifts, locations, payments, storedSettings, now])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
