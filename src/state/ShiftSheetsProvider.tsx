import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ShiftFormSheet, type ShiftFormMode } from '@/components/shifts/ShiftFormSheet'
import { ShiftDetailSheet } from '@/components/shifts/ShiftDetailSheet'
import { PaymentSheet } from '@/components/shifts/PaymentSheet'
import {
  emptyForm,
  formFromDuplicate,
  formFromShift,
  type ShiftFormValues,
} from '@/components/shifts/shiftFormValues'
import type { LocalDate } from '@/db/types'
import { useAppData } from './appDataContext'
import { ShiftSheetsContext, type ShiftSheetsApi } from './shiftSheetsContext'

/**
 * Cada abertura recebe uma `key` nova. Isso remonta a folha com estado limpo
 * (sem efeitos de sincronização) e mantém o conteúdo na tela durante a
 * animação de fechamento, quando `open` vira false mas a sessão continua.
 */
interface Session<T> {
  key: number
  open: boolean
  data: T
}

interface FormData {
  mode: ShiftFormMode
  shiftId?: string
  values: ShiftFormValues
}

/**
 * Centraliza as folhas de plantão (cadastro, detalhe e recebimento) para que
 * qualquer tela possa abri-las com uma chamada — sem duplicar estado.
 */
export function ShiftSheetsProvider({ children }: { children: ReactNode }) {
  const { viewById, settings } = useAppData()

  const nextKey = useRef(1)
  const [form, setForm] = useState<Session<FormData> | null>(null)
  const [detail, setDetail] = useState<Session<string> | null>(null)
  const [payment, setPayment] = useState<Session<string> | null>(null)

  const openSession = useCallback(
    <T,>(setter: (s: Session<T>) => void, data: T) => {
      setter({ key: nextKey.current++, open: true, data })
    },
    [],
  )

  const closeForm = useCallback(() => setForm((s) => (s ? { ...s, open: false } : null)), [])
  const closeDetail = useCallback(() => setDetail((s) => (s ? { ...s, open: false } : null)), [])
  const closePayment = useCallback(() => setPayment((s) => (s ? { ...s, open: false } : null)), [])

  const api = useMemo<ShiftSheetsApi>(
    () => ({
      newShift: (date?: LocalDate) =>
        openSession(setForm, { mode: 'create', values: emptyForm(settings, date) }),

      editShift: (id: string) => {
        const view = viewById.get(id)
        if (!view) return
        closeDetail()
        openSession(setForm, {
          mode: 'edit',
          shiftId: id,
          values: formFromShift(view.shift, view.location?.name ?? ''),
        })
      },

      duplicateShift: (id: string) => {
        const view = viewById.get(id)
        if (!view) return
        closeDetail()
        openSession(setForm, {
          mode: 'duplicate',
          values: formFromDuplicate(view.shift, view.location?.name ?? '', settings),
        })
      },

      openShift: (id: string) => openSession(setDetail, id),

      openPayment: (id: string) => {
        closeDetail()
        openSession(setPayment, id)
      },
    }),
    [viewById, settings, openSession, closeDetail],
  )

  return (
    <ShiftSheetsContext.Provider value={api}>
      {children}

      {form && (
        <ShiftFormSheet
          key={form.key}
          open={form.open}
          mode={form.data.mode}
          shiftId={form.data.shiftId}
          initialValues={form.data.values}
          onClose={closeForm}
        />
      )}

      {detail && (
        <ShiftDetailSheet
          key={detail.key}
          open={detail.open}
          shiftId={detail.data}
          onClose={closeDetail}
          onEdit={api.editShift}
          onDuplicate={api.duplicateShift}
          onPayment={api.openPayment}
        />
      )}

      {payment && (
        <PaymentSheet
          key={payment.key}
          open={payment.open}
          shiftId={payment.data}
          onClose={closePayment}
        />
      )}
    </ShiftSheetsContext.Provider>
  )
}
