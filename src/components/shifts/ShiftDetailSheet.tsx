import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Icon, type IconName } from '@/components/ui/Icon'
import { PaymentStatusPill, ShiftStatusPill } from '@/components/ui/StatusPill'
import { useAppData } from '@/state/appDataContext'
import { useToast } from '@/state/toastContext'
import { deleteSeries, deleteShift, setShiftCancelled } from '@/data/repository'
import {
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
  const { viewById, shifts } = useAppData()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const view = viewById.get(shiftId)
  if (!view) return null

  const { shift, location, payment } = view
  const overnight = !isSameDay(shift.startDateTime, shift.endDateTime)
  const difference = payment ? paymentDifference(payment) : 0

  // Um plantão sem `seriesId` — ou cuja série já perdeu os irmãos — se comporta
  // como avulso: uma pergunta só, sem escolha nenhuma.
  const series = shift.seriesId ? shifts.filter((s) => s.seriesId === shift.seriesId) : []
  const inSeries = series.length > 1
  // Excluir a série apaga os recebimentos junto: se houver algum, o aviso diz.
  const seriesReceived = series.filter(
    (s) => viewById.get(s.id)?.paymentStatus === 'received',
  ).length

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

  async function removeSeries() {
    const total = await deleteSeries(shift.seriesId)
    toast.success(total === 1 ? 'Plantão excluído' : `${total} plantões excluídos`)
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
              {inSeries && <span className="pill pill--neutral">Série de {series.length}</span>}
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
            {payment && (
              <DetailItem
                icon="check"
                label="Recebido"
                value={formatMoney(payment.receivedAmount)}
                hint={
                  shift.cancelled
                    ? `guardado · ${formatDate(payment.receivedDate)}`
                    : `em ${formatDate(payment.receivedDate)}`
                }
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
        message={
          payment
            ? `Ele continua no histórico marcado como cancelado e sai dos cálculos de horas e valores. O recebimento de ${formatMoney(
                payment.receivedAmount,
              )} fica guardado e volta se você reativar o plantão.`
            : 'Ele continua no histórico marcado como cancelado e sai dos cálculos de horas e valores.'
        }
        confirmLabel="Cancelar plantão"
        cancelLabel="Voltar"
        onConfirm={() => void toggleCancelled()}
        onCancel={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={inSeries ? 'Excluir plantão da série' : 'Excluir este plantão?'}
        message={
          inSeries
            ? `Este plantão faz parte de uma série de ${series.length} plantões.${
                seriesReceived > 0
                  ? ` ${seriesReceived} já ${
                      seriesReceived === 1 ? 'foi recebido' : 'foram recebidos'
                    }, e excluir a série apaga ${
                      seriesReceived === 1 ? 'esse recebimento' : 'esses recebimentos'
                    } junto.`
                  : ''
              } Esta ação não poderá ser desfeita.`
            : 'Esta ação não poderá ser desfeita.'
        }
        confirmLabel="Excluir"
        destructive
        choices={
          inSeries
            ? [
                { label: 'Excluir só este plantão', onClick: () => void remove() },
                {
                  label: `Excluir a série (${series.length})`,
                  onClick: () => void removeSeries(),
                },
              ]
            : undefined
        }
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
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
