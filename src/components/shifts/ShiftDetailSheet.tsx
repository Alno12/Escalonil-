import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon, type IconName } from '@/components/ui/Icon'
import { PaymentStatusPill, ShiftStatusPill } from '@/components/ui/StatusPill'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { deleteShift, setShiftCancelled } from '@/data/repository'
import {
  daysBetween,
  formatDate,
  formatDuration,
  formatLongDate,
  formatTime,
  isSameDay,
} from '@/domain/datetime'
import { formatMoney, formatMoneySigned } from '@/domain/money'
import { paymentDifference } from '@/domain/shift'

interface ShiftDetailSheetProps {
  open: boolean
  shiftId: string
  onClose: () => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onPayment: (id: string) => void
}

/** Detalhe do plantão com as ações de §47: editar, duplicar, cancelar, excluir. */
export function ShiftDetailSheet({
  open,
  shiftId,
  onClose,
  onEdit,
  onDuplicate,
  onPayment,
}: ShiftDetailSheetProps) {
  const { viewById, today } = useAppData()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const view = viewById.get(shiftId)
  if (!view) return null

  const { shift, location, payment } = view
  const overnight = !isSameDay(shift.startDateTime, shift.endDateTime)
  const difference = payment ? paymentDifference(payment) : 0

  async function toggleCancelled() {
    await setShiftCancelled(shift.id, !shift.cancelled)
    toast.show(shift.cancelled ? 'Plantão reativado' : 'Plantão cancelado')
    setConfirmCancel(false)
    if (!shift.cancelled) onClose()
  }

  async function remove() {
    await deleteShift(shift.id)
    toast.success('Plantão excluído')
    setConfirmDelete(false)
    onClose()
  }

  return (
    <>
      <Sheet open={open} title="Plantão" onClose={onClose} size="auto">
        <div className="detail">
          <div className="detail__head">
            <h3 className="detail__location">{location?.name ?? 'Local removido'}</h3>
            <p className="detail__date">{formatLongDate(shift.startDateTime)}</p>
            <p className="detail__time num">
              {formatTime(shift.startDateTime)} → {formatTime(shift.endDateTime)}
              {overnight && <span className="detail__overnight">dia seguinte</span>}
            </p>
            <div className="detail__pills">
              <ShiftStatusPill status={view.status} />
              <PaymentStatusPill status={view.paymentStatus} />
              {shift.shiftType && <span className="pill pill--neutral">{shift.shiftType}</span>}
            </div>
          </div>

          <dl className="detail__grid">
            <DetailItem icon="clock" label="Duração" value={formatDuration(view.durationHours)} />
            <DetailItem
              icon="wallet"
              label="Valor previsto"
              value={formatMoney(shift.expectedAmount)}
              hint={
                shift.paymentMode === 'hourly'
                  ? `${formatMoney(shift.hourlyRate)}/h`
                  : 'Valor fixo'
              }
            />
            <DetailItem
              icon="calendar"
              label="Pagamento previsto"
              value={shift.expectedPaymentDate ? formatDate(shift.expectedPaymentDate) : '—'}
              hint={
                shift.expectedPaymentDate && view.paymentStatus === 'overdue'
                  ? `Atrasado há ${Math.abs(daysBetween(shift.expectedPaymentDate, today))} dia(s)`
                  : shift.expectedPaymentDate && view.paymentStatus === 'pending'
                    ? relativeTerm(daysBetween(today, shift.expectedPaymentDate))
                    : undefined
              }
            />
            {payment && (
              <DetailItem
                icon="check"
                label="Recebido"
                value={formatMoney(payment.receivedAmount)}
                hint={`em ${formatDate(payment.receivedDate)}`}
              />
            )}
          </dl>

          {payment && Math.abs(difference) >= 0.01 && (
            <div className={`alert ${difference < 0 ? 'alert--warning' : 'alert--success'}`}>
              <Icon name={difference < 0 ? 'arrowDown' : 'arrowUp'} size={18} />
              <div>
                <strong>Divergência no pagamento</strong>
                <p className="num">
                  Esperado {formatMoney(payment.expectedAmount)} · Recebido{' '}
                  {formatMoney(payment.receivedAmount)}
                </p>
                <p className="alert__figure num">{formatMoneySigned(difference)}</p>
              </div>
            </div>
          )}

          {payment?.notes && (
            <p className="detail__notes">
              <Icon name="note" size={16} />
              {payment.notes}
            </p>
          )}

          {shift.notes && (
            <p className="detail__notes">
              <Icon name="note" size={16} />
              {shift.notes}
            </p>
          )}

          {view.paymentStatus !== 'notEligible' && view.paymentStatus !== 'cancelled' && (
            <Button
              variant={payment ? 'secondary' : 'primary'}
              size="lg"
              block
              icon={payment ? 'edit' : 'check'}
              onClick={() => onPayment(shift.id)}
            >
              {payment ? 'Editar recebimento' : 'Marcar como recebido'}
            </Button>
          )}

          <div className="detail__actions">
            <Button variant="secondary" icon="edit" onClick={() => onEdit(shift.id)}>
              Editar
            </Button>
            <Button variant="secondary" icon="copy" onClick={() => onDuplicate(shift.id)}>
              Duplicar
            </Button>
            <Button
              variant="secondary"
              icon={shift.cancelled ? 'refresh' : 'ban'}
              onClick={() => (shift.cancelled ? void toggleCancelled() : setConfirmCancel(true))}
            >
              {shift.cancelled ? 'Reativar' : 'Cancelar'}
            </Button>
            <Button variant="quiet" icon="trash" onClick={() => setConfirmDelete(true)}>
              Excluir
            </Button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmCancel}
        title="Cancelar este plantão?"
        message="Ele continua no histórico marcado como cancelado e sai dos cálculos de horas e valores."
        confirmLabel="Cancelar plantão"
        cancelLabel="Voltar"
        onConfirm={() => void toggleCancelled()}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir este plantão?"
        message="Esta ação não poderá ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}

function relativeTerm(days: number): string {
  if (days === 0) return 'É hoje'
  if (days === 1) return 'Falta 1 dia'
  if (days > 1) return `Faltam ${days} dias`
  return ''
}

function DetailItem({
  icon,
  label,
  value,
  hint,
}: {
  icon: IconName
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="detail__item">
      <span className="detail__item-icon" aria-hidden="true">
        <Icon name={icon} size={17} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd className="num">{value}</dd>
        {hint && <span className="detail__item-hint">{hint}</span>}
      </div>
    </div>
  )
}
